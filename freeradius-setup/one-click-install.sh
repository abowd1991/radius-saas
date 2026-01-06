#!/bin/bash
#===============================================================================
# FreeRADIUS + VPN One-Click Installer
# For RADIUS SaaS Platform
#===============================================================================

set -e

# Database Configuration
DB_HOST="gateway02.us-east-1.prod.aws.tidbcloud.com"
DB_PORT="4000"
DB_USER="38MgGCfAkTTcdrf.ae1ad98e5b22"
DB_PASS="EC3yRA4et9YNOg9jZ78W"
DB_NAME="JYruXSQahvP3cr6rPdjNhA"

# RADIUS Configuration
RADIUS_SECRET="radius_secret_2024"

# VPN Configuration
VPN_LOCAL_IP="10.0.0.1"
VPN_REMOTE_START="10.0.0.100"
VPN_REMOTE_END="10.0.0.200"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     FreeRADIUS + VPN One-Click Installer                     ║"
echo "║     For RADIUS SaaS Platform                                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

#===============================================================================
# Step 1: Update System
#===============================================================================
echo -e "${YELLOW}[1/7] Updating system packages...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✓ System updated${NC}"

#===============================================================================
# Step 2: Install Dependencies
#===============================================================================
echo -e "${YELLOW}[2/7] Installing dependencies...${NC}"
apt install -y \
    freeradius \
    freeradius-mysql \
    freeradius-utils \
    mysql-client \
    pptpd \
    iptables-persistent \
    curl \
    wget
echo -e "${GREEN}✓ Dependencies installed${NC}"

#===============================================================================
# Step 3: Stop FreeRADIUS for configuration
#===============================================================================
echo -e "${YELLOW}[3/7] Configuring FreeRADIUS...${NC}"
systemctl stop freeradius 2>/dev/null || true

#===============================================================================
# Step 4: Configure SQL Module
#===============================================================================
cat > /etc/freeradius/3.0/mods-available/sql << SQLCONF
sql {
    driver = "rlm_sql_mysql"
    dialect = "mysql"
    
    server = "${DB_HOST}"
    port = ${DB_PORT}
    login = "${DB_USER}"
    password = "${DB_PASS}"
    radius_db = "${DB_NAME}"
    
    mysql {
        tls {
            ca_file = "/etc/ssl/certs/ca-certificates.crt"
        }
        warnings = auto
    }
    
    pool {
        start = 5
        min = 3
        max = 32
        spare = 3
        uses = 0
        lifetime = 0
        idle_timeout = 60
    }
    
    read_clients = yes
    client_table = "nas"
    
    # Table configuration
    authcheck_table = "radcheck"
    authreply_table = "radreply"
    groupcheck_table = "radgroupcheck"
    groupreply_table = "radgroupreply"
    usergroup_table = "radusergroup"
    acct_table1 = "radacct"
    acct_table2 = "radacct"
    postauth_table = "radpostauth"
}
SQLCONF

# Enable SQL module
ln -sf /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql
echo -e "${GREEN}✓ SQL module configured${NC}"

#===============================================================================
# Step 5: Configure Default Site
#===============================================================================
cat > /etc/freeradius/3.0/sites-available/default << 'DEFAULTSITE'
server default {
    listen {
        type = auth
        ipaddr = *
        port = 1812
    }
    
    listen {
        type = acct
        ipaddr = *
        port = 1813
    }
    
    authorize {
        filter_username
        preprocess
        chap
        mschap
        suffix
        eap {
            ok = return
        }
        sql
        pap
    }
    
    authenticate {
        Auth-Type PAP {
            pap
        }
        Auth-Type CHAP {
            chap
        }
        Auth-Type MS-CHAP {
            mschap
        }
        eap
    }
    
    preacct {
        preprocess
        acct_unique
        suffix
    }
    
    accounting {
        sql
    }
    
    session {
        sql
    }
    
    post-auth {
        sql
        Post-Auth-Type REJECT {
            sql
        }
    }
}
DEFAULTSITE

ln -sf /etc/freeradius/3.0/sites-available/default /etc/freeradius/3.0/sites-enabled/default
echo -e "${GREEN}✓ Default site configured${NC}"

#===============================================================================
# Step 6: Configure Clients (NAS)
#===============================================================================
cat > /etc/freeradius/3.0/clients.conf << CLIENTSCONF
client localhost {
    ipaddr = 127.0.0.1
    secret = testing123
    shortname = localhost
}

client vpn_network {
    ipaddr = 10.0.0.0/24
    secret = ${RADIUS_SECRET}
    shortname = vpn_clients
}

client any {
    ipaddr = 0.0.0.0/0
    secret = ${RADIUS_SECRET}
    shortname = any_client
}
CLIENTSCONF
echo -e "${GREEN}✓ Clients configured${NC}"

#===============================================================================
# Step 7: Set Permissions
#===============================================================================
chown -R freerad:freerad /etc/freeradius/3.0/
chmod 640 /etc/freeradius/3.0/mods-available/sql

#===============================================================================
# Step 8: Configure VPN (PPTP)
#===============================================================================
echo -e "${YELLOW}[4/7] Configuring VPN Server (PPTP)...${NC}"

cat > /etc/pptpd.conf << PPTPDCONF
option /etc/ppp/pptpd-options
logwtmp
localip ${VPN_LOCAL_IP}
remoteip ${VPN_REMOTE_START}-200
PPTPDCONF

cat > /etc/ppp/pptpd-options << PPTPOPTIONS
name pptpd
refuse-pap
refuse-chap
refuse-mschap
require-mschap-v2
require-mppe-128
ms-dns 8.8.8.8
ms-dns 8.8.4.4
proxyarp
lock
nobsdcomp
novj
novjccomp
nologfd
PPTPOPTIONS

# Add VPN user
cat > /etc/ppp/chap-secrets << CHAPSECRETS
# client    server  secret          IP addresses
vpnuser     pptpd   vpnpass123      *
radius      pptpd   radius123       *
CHAPSECRETS

chmod 600 /etc/ppp/chap-secrets
echo -e "${GREEN}✓ VPN configured${NC}"

#===============================================================================
# Step 9: Configure Firewall
#===============================================================================
echo -e "${YELLOW}[5/7] Configuring firewall...${NC}"

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

# Configure iptables
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
iptables -A FORWARD -i ppp+ -o eth0 -j ACCEPT
iptables -A FORWARD -i eth0 -o ppp+ -j ACCEPT
iptables -A INPUT -p tcp --dport 1723 -j ACCEPT
iptables -A INPUT -p gre -j ACCEPT
iptables -A INPUT -p udp --dport 1812 -j ACCEPT
iptables -A INPUT -p udp --dport 1813 -j ACCEPT

# Save iptables rules
netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4
echo -e "${GREEN}✓ Firewall configured${NC}"

#===============================================================================
# Step 10: Start Services
#===============================================================================
echo -e "${YELLOW}[6/7] Starting services...${NC}"

systemctl enable freeradius
systemctl enable pptpd

systemctl start pptpd
systemctl start freeradius

echo -e "${GREEN}✓ Services started${NC}"

#===============================================================================
# Step 11: Test Configuration
#===============================================================================
echo -e "${YELLOW}[7/7] Testing configuration...${NC}"

sleep 2

# Check FreeRADIUS status
if systemctl is-active --quiet freeradius; then
    echo -e "${GREEN}✓ FreeRADIUS is running${NC}"
else
    echo -e "${RED}✗ FreeRADIUS failed to start${NC}"
    echo "Running in debug mode..."
    freeradius -X &
    sleep 5
    pkill freeradius
fi

# Check PPTP status
if systemctl is-active --quiet pptpd; then
    echo -e "${GREEN}✓ PPTP VPN is running${NC}"
else
    echo -e "${RED}✗ PPTP VPN failed to start${NC}"
fi

# Check ports
echo ""
echo "Checking ports..."
ss -tlnp | grep -E "1812|1813|1723" || echo "Ports not detected"

#===============================================================================
# Final Summary
#===============================================================================
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    INSTALLATION COMPLETE!                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "Server IP: ${SERVER_IP}"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "RADIUS Server:"
echo "  - IP: ${SERVER_IP}"
echo "  - Auth Port: 1812"
echo "  - Acct Port: 1813"
echo "  - Secret: ${RADIUS_SECRET}"
echo ""
echo "VPN Server (PPTP):"
echo "  - IP: ${SERVER_IP}"
echo "  - Port: 1723"
echo "  - Username: vpnuser"
echo "  - Password: vpnpass123"
echo "  - RADIUS User: radius / radius123"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Test RADIUS with:"
echo "  radtest testuser testpass localhost 0 testing123"
echo ""
echo "MikroTik RADIUS Command:"
echo "  /radius add address=${SERVER_IP} secret=${RADIUS_SECRET} service=ppp,hotspot"
echo ""
echo "═══════════════════════════════════════════════════════════════"
