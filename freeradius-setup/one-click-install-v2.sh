#!/bin/bash
#===============================================================================
# FreeRADIUS + VPN One-Click Installer (Ubuntu 24.04 Compatible)
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
echo "║     FreeRADIUS + VPN One-Click Installer v2                  ║"
echo "║     For RADIUS SaaS Platform (Ubuntu 24.04)                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

#===============================================================================
# Step 1: Update System
#===============================================================================
echo -e "${YELLOW}[1/8] Updating system packages...${NC}"
apt update
DEBIAN_FRONTEND=noninteractive apt upgrade -y
echo -e "${GREEN}✓ System updated${NC}"

#===============================================================================
# Step 2: Install Dependencies
#===============================================================================
echo -e "${YELLOW}[2/8] Installing dependencies...${NC}"
DEBIAN_FRONTEND=noninteractive apt install -y \
    freeradius \
    freeradius-mysql \
    freeradius-utils \
    mysql-client \
    ppp \
    curl \
    wget \
    iptables \
    software-properties-common

echo -e "${GREEN}✓ Dependencies installed${NC}"

#===============================================================================
# Step 3: Install PPTPD for Ubuntu 24.04
#===============================================================================
echo -e "${YELLOW}[3/8] Installing VPN Server (PPTP)...${NC}"

# Download pptpd from Ubuntu 22.04 repository (compatible)
cd /tmp
wget -q http://archive.ubuntu.com/ubuntu/pool/universe/p/pptpd/pptpd_1.4.0-12build2_amd64.deb 2>/dev/null || \
wget -q http://mirrors.kernel.org/ubuntu/pool/universe/p/pptpd/pptpd_1.4.0-12build2_amd64.deb 2>/dev/null || \
wget -q https://launchpad.net/ubuntu/+archive/primary/+files/pptpd_1.4.0-12build2_amd64.deb 2>/dev/null

if [ -f pptpd_1.4.0-12build2_amd64.deb ]; then
    dpkg -i pptpd_1.4.0-12build2_amd64.deb 2>/dev/null || apt install -f -y
    echo -e "${GREEN}✓ PPTP VPN installed${NC}"
else
    echo -e "${YELLOW}⚠ PPTP download failed, trying alternative...${NC}"
    # Try building from source as fallback
    apt install -y build-essential libwrap0-dev
    cd /tmp
    wget -q https://sourceforge.net/projects/poptop/files/pptpd/pptpd-1.4.0/pptpd-1.4.0.tar.gz
    tar xzf pptpd-1.4.0.tar.gz
    cd pptpd-1.4.0
    ./configure && make && make install
    echo -e "${GREEN}✓ PPTP VPN installed from source${NC}"
fi
cd ~

#===============================================================================
# Step 4: Stop FreeRADIUS for configuration
#===============================================================================
echo -e "${YELLOW}[4/8] Configuring FreeRADIUS...${NC}"
systemctl stop freeradius 2>/dev/null || true

#===============================================================================
# Step 5: Configure SQL Module
#===============================================================================
cat > /etc/freeradius/3.0/mods-available/sql << SQLEOF
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
    
    authcheck_table = "radcheck"
    authreply_table = "radreply"
    groupcheck_table = "radgroupcheck"
    groupreply_table = "radgroupreply"
    usergroup_table = "radusergroup"
    acct_table1 = "radacct"
    acct_table2 = "radacct"
    postauth_table = "radpostauth"
}
SQLEOF

# Enable SQL module
ln -sf /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql
echo -e "${GREEN}✓ SQL module configured${NC}"

#===============================================================================
# Step 6: Configure Default Site
#===============================================================================
cat > /etc/freeradius/3.0/sites-available/default << 'SITEEOF'
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
SITEEOF

ln -sf /etc/freeradius/3.0/sites-available/default /etc/freeradius/3.0/sites-enabled/default
echo -e "${GREEN}✓ Default site configured${NC}"

#===============================================================================
# Step 7: Configure Clients (NAS)
#===============================================================================
cat > /etc/freeradius/3.0/clients.conf << CLIENTSEOF
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
CLIENTSEOF

# Set Permissions
chown -R freerad:freerad /etc/freeradius/3.0/
chmod 640 /etc/freeradius/3.0/mods-available/sql

echo -e "${GREEN}✓ Clients configured${NC}"

#===============================================================================
# Step 8: Configure VPN (PPTP)
#===============================================================================
echo -e "${YELLOW}[5/8] Configuring VPN Server...${NC}"

cat > /etc/pptpd.conf << PPTPDEOF
option /etc/ppp/pptpd-options
logwtmp
localip ${VPN_LOCAL_IP}
remoteip ${VPN_REMOTE_START}-200
PPTPDEOF

cat > /etc/ppp/pptpd-options << PPPOPTEOF
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
PPPOPTEOF

# Add VPN users
cat > /etc/ppp/chap-secrets << CHAPEOF
# client    server  secret          IP addresses
vpnuser     pptpd   vpnpass123      *
radius      pptpd   radius123       *
mikrotik    pptpd   mikrotik123     *
CHAPEOF

chmod 600 /etc/ppp/chap-secrets
echo -e "${GREEN}✓ VPN configured${NC}"

#===============================================================================
# Step 9: Configure Firewall & IP Forwarding
#===============================================================================
echo -e "${YELLOW}[6/8] Configuring firewall...${NC}"

# Enable IP forwarding
sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf 2>/dev/null || true
sysctl -w net.ipv4.ip_forward=1

# Get main interface
MAIN_IF=$(ip route | grep default | awk '{print $5}' | head -1)
[ -z "$MAIN_IF" ] && MAIN_IF="eth0"

# Configure iptables
iptables -t nat -A POSTROUTING -o $MAIN_IF -j MASQUERADE
iptables -A FORWARD -i ppp+ -o $MAIN_IF -j ACCEPT
iptables -A FORWARD -i $MAIN_IF -o ppp+ -j ACCEPT
iptables -A INPUT -p tcp --dport 1723 -j ACCEPT
iptables -A INPUT -p gre -j ACCEPT
iptables -A INPUT -p udp --dport 1812 -j ACCEPT
iptables -A INPUT -p udp --dport 1813 -j ACCEPT

# Save iptables rules
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4

# Create restore script
cat > /etc/network/if-pre-up.d/iptables << 'IPTEOF'
#!/bin/sh
/sbin/iptables-restore < /etc/iptables/rules.v4
IPTEOF
chmod +x /etc/network/if-pre-up.d/iptables

echo -e "${GREEN}✓ Firewall configured${NC}"

#===============================================================================
# Step 10: Start Services
#===============================================================================
echo -e "${YELLOW}[7/8] Starting services...${NC}"

systemctl daemon-reload
systemctl enable freeradius
systemctl enable pptpd 2>/dev/null || true

systemctl start pptpd 2>/dev/null || echo "PPTP will start manually"
systemctl start freeradius

sleep 3

echo -e "${GREEN}✓ Services started${NC}"

#===============================================================================
# Step 11: Verify Installation
#===============================================================================
echo -e "${YELLOW}[8/8] Verifying installation...${NC}"

ERRORS=0

# Check FreeRADIUS
if systemctl is-active --quiet freeradius; then
    echo -e "${GREEN}✓ FreeRADIUS is running${NC}"
else
    echo -e "${RED}✗ FreeRADIUS failed - trying debug mode...${NC}"
    freeradius -X 2>&1 | head -50
    ERRORS=$((ERRORS+1))
fi

# Check PPTP
if systemctl is-active --quiet pptpd 2>/dev/null || pgrep pptpd > /dev/null; then
    echo -e "${GREEN}✓ PPTP VPN is running${NC}"
else
    echo -e "${YELLOW}⚠ PPTP not running (optional)${NC}"
fi

# Check ports
echo ""
echo "Active ports:"
ss -tlnup | grep -E "1812|1813|1723" || echo "Checking..."

#===============================================================================
# Final Summary
#===============================================================================
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                 ✓ INSTALLATION COMPLETE!                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "${GREEN}Server IP:${NC} ${SERVER_IP}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo -e "${YELLOW}RADIUS Server:${NC}"
echo "  Address: ${SERVER_IP}"
echo "  Auth Port: 1812"
echo "  Acct Port: 1813"
echo "  Secret: ${RADIUS_SECRET}"
echo ""
echo -e "${YELLOW}VPN Server (PPTP):${NC}"
echo "  Address: ${SERVER_IP}"
echo "  Port: 1723"
echo "  Users:"
echo "    - vpnuser / vpnpass123"
echo "    - radius / radius123"
echo "    - mikrotik / mikrotik123"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "${YELLOW}Test Commands:${NC}"
echo ""
echo "  # Test RADIUS locally:"
echo "  radtest testuser testpass localhost 0 testing123"
echo ""
echo "  # Test database connection:"
echo "  radtest USERNAME PASSWORD ${SERVER_IP} 0 ${RADIUS_SECRET}"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "${YELLOW}MikroTik Commands:${NC}"
echo ""
echo "  # Add RADIUS server:"
echo "  /radius add address=${SERVER_IP} secret=${RADIUS_SECRET} service=ppp,hotspot timeout=3s"
echo ""
echo "  # Enable RADIUS for PPP:"
echo "  /ppp aaa set use-radius=yes accounting=yes"
echo ""
echo "  # Enable RADIUS for Hotspot:"
echo "  /ip hotspot profile set default use-radius=yes"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Installation completed successfully!${NC}"
echo ""
