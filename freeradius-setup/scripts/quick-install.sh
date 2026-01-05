#!/bin/bash
#===============================================================================
# Quick Install Script - Interactive FreeRADIUS Setup
# 
# This script provides an interactive installation experience
# Usage: sudo bash quick-install.sh
#===============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║     ███████╗██████╗ ███████╗███████╗██████╗  █████╗ ██████╗ ██╗██╗   ██╗  ║
║     ██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██║██║   ██║  ║
║     █████╗  ██████╔╝█████╗  █████╗  ██████╔╝███████║██║  ██║██║██║   ██║  ║
║     ██╔══╝  ██╔══██╗██╔══╝  ██╔══╝  ██╔══██╗██╔══██║██║  ██║██║██║   ██║  ║
║     ██║     ██║  ██║███████╗███████╗██║  ██║██║  ██║██████╔╝██║╚██████╔╝  ║
║     ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝ ╚═════╝   ║
║                                                                           ║
║                    RADIUS SaaS - Quick Installer                          ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (sudo bash quick-install.sh)${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Welcome to the FreeRADIUS Quick Installer!${NC}"
echo ""
echo "This script will guide you through setting up FreeRADIUS for your RADIUS SaaS platform."
echo ""

# Get database information
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 1: Database Configuration${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "You can find these values in your Manus project settings (Database > Connection Info)"
echo ""

read -p "Database Host (e.g., gateway01.us-east-1.prod.aws.tidbcloud.com): " DB_HOST
read -p "Database Port [4000]: " DB_PORT
DB_PORT=${DB_PORT:-4000}
read -p "Database Name [radius_saas]: " DB_NAME
DB_NAME=${DB_NAME:-radius_saas}
read -p "Database Username: " DB_USER
read -sp "Database Password: " DB_PASS
echo ""

# Get RADIUS configuration
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 2: RADIUS Configuration${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Generate random secret if not provided
DEFAULT_SECRET=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
read -p "RADIUS Shared Secret [$DEFAULT_SECRET]: " RADIUS_SECRET
RADIUS_SECRET=${RADIUS_SECRET:-$DEFAULT_SECRET}

# VPN option
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 3: VPN Configuration (Optional)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "VPN allows MikroTik routers without public IP to connect to RADIUS."
echo ""
read -p "Install VPN Server (PPTP)? [y/N]: " INSTALL_VPN
INSTALL_VPN=${INSTALL_VPN:-n}

# Confirm settings
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Configuration Summary${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Database Host:    ${CYAN}$DB_HOST${NC}"
echo -e "Database Port:    ${CYAN}$DB_PORT${NC}"
echo -e "Database Name:    ${CYAN}$DB_NAME${NC}"
echo -e "Database User:    ${CYAN}$DB_USER${NC}"
echo -e "Database Pass:    ${CYAN}********${NC}"
echo -e "RADIUS Secret:    ${CYAN}$RADIUS_SECRET${NC}"
echo -e "Install VPN:      ${CYAN}$INSTALL_VPN${NC}"
echo ""

read -p "Proceed with installation? [Y/n]: " CONFIRM
CONFIRM=${CONFIRM:-y}

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Installation cancelled."
    exit 0
fi

# Create temporary config file
CONFIG_FILE=$(mktemp)
cat > $CONFIG_FILE << EOF
DB_HOST="$DB_HOST"
DB_PORT="$DB_PORT"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"
DB_PASS="$DB_PASS"
RADIUS_SECRET="$RADIUS_SECRET"
ENABLE_VPN="$([[ "$INSTALL_VPN" =~ ^[Yy]$ ]] && echo "true" || echo "false")"
EOF

# Start installation
echo ""
echo -e "${GREEN}Starting installation...${NC}"
echo ""

# Update system
echo -e "${BLUE}[1/8] Updating system packages...${NC}"
apt-get update -y > /dev/null 2>&1
apt-get upgrade -y > /dev/null 2>&1

# Install dependencies
echo -e "${BLUE}[2/8] Installing dependencies...${NC}"
apt-get install -y wget curl gnupg2 software-properties-common apt-transport-https \
    ca-certificates mysql-client build-essential libssl-dev libtalloc-dev \
    libpcre3-dev libcurl4-openssl-dev net-tools ufw > /dev/null 2>&1

# Install FreeRADIUS
echo -e "${BLUE}[3/8] Installing FreeRADIUS...${NC}"
apt-get install -y freeradius freeradius-mysql freeradius-utils > /dev/null 2>&1
systemctl stop freeradius

# Configure SQL
echo -e "${BLUE}[4/8] Configuring database connection...${NC}"
cat > /etc/freeradius/3.0/mods-available/sql << SQLEOF
sql {
    driver = "rlm_sql_mysql"
    dialect = "mysql"
    server = "$DB_HOST"
    port = $DB_PORT
    login = "$DB_USER"
    password = "$DB_PASS"
    radius_db = "$DB_NAME"
    
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
    
    authorize_check_query = "SELECT id, username, attribute, value, op FROM radcheck WHERE username = '%{SQL-User-Name}' ORDER BY id"
    authorize_reply_query = "SELECT id, username, attribute, value, op FROM radreply WHERE username = '%{SQL-User-Name}' ORDER BY id"
    
    simul_count_query = "SELECT COUNT(*) FROM radacct WHERE username = '%{SQL-User-Name}' AND acctstoptime IS NULL"
    
    accounting {
        start_query = "INSERT INTO radacct (acctsessionid, acctuniqueid, username, nasipaddress, nasportid, acctstarttime, acctupdatetime, framedipaddress, callingstationid) VALUES ('%{Acct-Session-Id}', '%{Acct-Unique-Session-Id}', '%{SQL-User-Name}', '%{NAS-IP-Address}', '%{NAS-Port}', NOW(), NOW(), '%{Framed-IP-Address}', '%{Calling-Station-Id}')"
        interim_query = "UPDATE radacct SET acctupdatetime = NOW(), acctsessiontime = %{%{Acct-Session-Time}:-0}, acctinputoctets = %{%{Acct-Input-Octets}:-0}, acctoutputoctets = %{%{Acct-Output-Octets}:-0} WHERE acctsessionid = '%{Acct-Session-Id}' AND username = '%{SQL-User-Name}'"
        stop_query = "UPDATE radacct SET acctstoptime = NOW(), acctsessiontime = %{%{Acct-Session-Time}:-0}, acctinputoctets = %{%{Acct-Input-Octets}:-0}, acctoutputoctets = %{%{Acct-Output-Octets}:-0}, acctterminatecause = '%{Acct-Terminate-Cause}' WHERE acctsessionid = '%{Acct-Session-Id}' AND username = '%{SQL-User-Name}'"
    }
    
    post-auth {
        query = "INSERT INTO radpostauth (username, pass, reply, authdate) VALUES ('%{SQL-User-Name}', '%{User-Password}', '%{reply:Packet-Type}', NOW())"
    }
}
SQLEOF

ln -sf /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql

# Configure clients
echo -e "${BLUE}[5/8] Configuring NAS clients...${NC}"
cat > /etc/freeradius/3.0/clients.conf << CLIENTEOF
client localhost {
    ipaddr = 127.0.0.1
    secret = testing123
    require_message_authenticator = no
}

client any {
    ipaddr = 0.0.0.0/0
    secret = $RADIUS_SECRET
    require_message_authenticator = no
    nas_type = mikrotik
}
CLIENTEOF

# Configure firewall
echo -e "${BLUE}[6/8] Configuring firewall...${NC}"
ufw --force enable > /dev/null 2>&1
ufw allow 1812/udp > /dev/null 2>&1
ufw allow 1813/udp > /dev/null 2>&1
ufw allow 3799/udp > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1

# Set permissions
echo -e "${BLUE}[7/8] Setting permissions...${NC}"
chown -R freerad:freerad /etc/freeradius/3.0/
chmod 640 /etc/freeradius/3.0/mods-available/sql

# Start service
echo -e "${BLUE}[8/8] Starting FreeRADIUS...${NC}"
systemctl enable freeradius > /dev/null 2>&1
systemctl start freeradius

# Install VPN if requested
if [[ "$INSTALL_VPN" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Installing VPN Server...${NC}"
    
    apt-get install -y pptpd iptables-persistent > /dev/null 2>&1
    
    cat > /etc/pptpd.conf << PPTPEOF
option /etc/ppp/pptpd-options
logwtmp
localip 10.0.0.1
remoteip 10.0.0.100-200
PPTPEOF
    
    cat > /etc/ppp/pptpd-options << PPPEOF
name pptpd
refuse-pap
refuse-chap
refuse-mschap
require-mschap-v2
require-mppe-128
ms-dns 8.8.8.8
ms-dns 8.8.4.4
proxyarp
nodefaultroute
lock
nobsdcomp
novj
novjccomp
nologfd
PPPEOF
    
    # Enable forwarding
    echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    sysctl -p > /dev/null 2>&1
    
    # Configure NAT
    IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
    iptables -t nat -A POSTROUTING -o $IFACE -j MASQUERADE
    iptables -A FORWARD -i ppp+ -o $IFACE -j ACCEPT
    iptables -A FORWARD -i $IFACE -o ppp+ -m state --state RELATED,ESTABLISHED -j ACCEPT
    netfilter-persistent save > /dev/null 2>&1
    
    # Create VPN user
    VPN_USER="mikrotik"
    VPN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 12)
    echo "$VPN_USER pptpd $VPN_PASS *" > /etc/ppp/chap-secrets
    
    # Allow VPN port
    ufw allow 1723/tcp > /dev/null 2>&1
    
    # Start VPN
    systemctl enable pptpd > /dev/null 2>&1
    systemctl start pptpd
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

# Clean up
rm -f $CONFIG_FILE

# Print results
echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                    Installation Complete!                                 ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}RADIUS Server Information${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Server IP:        ${GREEN}$SERVER_IP${NC}"
echo -e "Auth Port:        ${GREEN}1812/udp${NC}"
echo -e "Acct Port:        ${GREEN}1813/udp${NC}"
echo -e "CoA Port:         ${GREEN}3799/udp${NC}"
echo -e "Shared Secret:    ${GREEN}$RADIUS_SECRET${NC}"

if [[ "$INSTALL_VPN" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}VPN Server Information${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "VPN Type:         ${GREEN}PPTP${NC}"
    echo -e "VPN Port:         ${GREEN}1723/tcp${NC}"
    echo -e "VPN Local IP:     ${GREEN}10.0.0.1${NC}"
    echo -e "VPN Username:     ${GREEN}$VPN_USER${NC}"
    echo -e "VPN Password:     ${GREEN}$VPN_PASS${NC}"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}MikroTik Configuration Commands${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

if [[ "$INSTALL_VPN" =~ ^[Yy]$ ]]; then
    echo "# 1. Create VPN Connection"
    echo "/interface pptp-client add name=vpn-radius connect-to=$SERVER_IP user=$VPN_USER password=$VPN_PASS disabled=no"
    echo ""
    echo "# 2. Add RADIUS Server (use VPN IP)"
    echo "/radius add address=10.0.0.1 secret=$RADIUS_SECRET timeout=3s service=ppp,hotspot,login"
else
    echo "# Add RADIUS Server"
    echo "/radius add address=$SERVER_IP secret=$RADIUS_SECRET timeout=3s service=ppp,hotspot,login"
fi

echo ""
echo "# Enable RADIUS Incoming"
echo "/radius incoming set accept=yes port=3799"
echo ""
echo "# Disable Message Auth"
echo "/radius set [find] require-message-auth=no"
echo ""
echo "# Enable RADIUS for PPP"
echo "/ppp aaa set use-radius=yes accounting=yes interim-update=1m"
echo ""
echo "# Enable RADIUS for Hotspot"
echo "/ip hotspot profile set [find] use-radius=yes"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}Quick Test${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "# Test RADIUS locally:"
echo "radtest testuser testpass localhost 0 testing123"
echo ""

echo -e "${YELLOW}IMPORTANT: Save the credentials above!${NC}"
echo ""
echo -e "${GREEN}FreeRADIUS is now running and ready to accept connections.${NC}"
echo ""
