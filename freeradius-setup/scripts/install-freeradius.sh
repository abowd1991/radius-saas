#!/bin/bash
#===============================================================================
# FreeRADIUS Installation Script for RADIUS SaaS Platform
# Compatible with: Ubuntu 20.04 / 22.04 / Debian 11 / 12
# 
# Usage: sudo bash install-freeradius.sh
#
# This script will:
# 1. Install FreeRADIUS with MySQL support
# 2. Configure database connection
# 3. Set up authentication and accounting
# 4. Configure for MikroTik integration
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - MODIFY THESE VALUES
#===============================================================================
# Database Configuration (Your RADIUS SaaS Database)
DB_HOST="gateway01.us-east-1.prod.aws.tidbcloud.com"
DB_PORT="4000"
DB_NAME="radius_saas"
DB_USER="your_db_user"
DB_PASS="your_db_password"
DB_SSL="true"

# RADIUS Configuration
RADIUS_SECRET="your_radius_secret"  # Shared secret for NAS devices
RADIUS_PORT_AUTH="1812"
RADIUS_PORT_ACCT="1813"
RADIUS_PORT_COA="3799"

# VPN Configuration (Optional)
ENABLE_VPN="false"
VPN_SUBNET="10.0.0.0/24"
VPN_LOCAL_IP="10.0.0.1"
#===============================================================================

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║           FreeRADIUS Installation for RADIUS SaaS                ║"
    echo "║                    Version 1.0.0                                 ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run this script as root (sudo bash install-freeradius.sh)"
        exit 1
    fi
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        print_error "Cannot detect OS. This script supports Ubuntu 20.04/22.04 and Debian 11/12"
        exit 1
    fi
    
    print_info "Detected OS: $OS $VERSION"
    
    case "$OS" in
        ubuntu)
            if [[ "$VERSION" != "20.04" && "$VERSION" != "22.04" && "$VERSION" != "24.04" ]]; then
                print_warning "Ubuntu $VERSION may not be fully tested. Proceeding anyway..."
            fi
            ;;
        debian)
            if [[ "$VERSION" != "11" && "$VERSION" != "12" ]]; then
                print_warning "Debian $VERSION may not be fully tested. Proceeding anyway..."
            fi
            ;;
        *)
            print_error "Unsupported OS: $OS. This script supports Ubuntu and Debian only."
            exit 1
            ;;
    esac
}

# Update system and install dependencies
install_dependencies() {
    print_step "Updating system packages..."
    apt-get update -y
    apt-get upgrade -y
    
    print_step "Installing dependencies..."
    apt-get install -y \
        wget \
        curl \
        gnupg2 \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        mysql-client \
        libmysqlclient-dev \
        build-essential \
        libssl-dev \
        libtalloc-dev \
        libpcre3-dev \
        libcurl4-openssl-dev \
        net-tools \
        ufw
}

# Install FreeRADIUS
install_freeradius() {
    print_step "Installing FreeRADIUS..."
    
    # Install FreeRADIUS with MySQL support
    apt-get install -y freeradius freeradius-mysql freeradius-utils
    
    # Stop FreeRADIUS for configuration
    systemctl stop freeradius
    
    print_success "FreeRADIUS installed successfully"
}

# Configure FreeRADIUS SQL module
configure_sql() {
    print_step "Configuring SQL module..."
    
    # Backup original files
    cp /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-available/sql.backup
    
    # Create SQL configuration
    cat > /etc/freeradius/3.0/mods-available/sql << EOF
sql {
    driver = "rlm_sql_mysql"
    dialect = "mysql"
    
    # Connection info
    server = "${DB_HOST}"
    port = ${DB_PORT}
    login = "${DB_USER}"
    password = "${DB_PASS}"
    
    # Database name
    radius_db = "${DB_NAME}"
    
    # SSL/TLS Configuration
    mysql {
        tls {
            # Enable TLS for secure connection
            ca_file = "/etc/ssl/certs/ca-certificates.crt"
            cipher = "DHE-RSA-AES256-SHA:AES128-SHA"
        }
        warnings = auto
    }
    
    # Connection pool
    pool {
        start = 5
        min = 3
        max = 32
        spare = 3
        uses = 0
        lifetime = 0
        idle_timeout = 60
    }
    
    # Table names (matching your schema)
    read_clients = yes
    client_table = "nas"
    
    # Authorize query - check user credentials
    authorize_check_query = "\\
        SELECT id, username, attribute, value, op \\
        FROM radcheck \\
        WHERE username = '%{SQL-User-Name}' \\
        ORDER BY id"
    
    authorize_reply_query = "\\
        SELECT id, username, attribute, value, op \\
        FROM radreply \\
        WHERE username = '%{SQL-User-Name}' \\
        ORDER BY id"
    
    # Group queries
    authorize_group_check_query = "\\
        SELECT id, groupname, attribute, value, op \\
        FROM radgroupcheck \\
        WHERE groupname = '%{SQL-Group}' \\
        ORDER BY id"
    
    authorize_group_reply_query = "\\
        SELECT id, groupname, attribute, value, op \\
        FROM radgroupreply \\
        WHERE groupname = '%{SQL-Group}' \\
        ORDER BY id"
    
    group_membership_query = "\\
        SELECT groupname \\
        FROM radusergroup \\
        WHERE username = '%{SQL-User-Name}' \\
        ORDER BY priority"
    
    # Simultaneous use checking
    simul_count_query = "\\
        SELECT COUNT(*) \\
        FROM radacct \\
        WHERE username = '%{SQL-User-Name}' \\
        AND acctstoptime IS NULL"
    
    simul_verify_query = "\\
        SELECT radacctid, acctsessionid, username, nasipaddress, nasportid, \\
               framedipaddress, callingstationid, framedprotocol \\
        FROM radacct \\
        WHERE username = '%{SQL-User-Name}' \\
        AND acctstoptime IS NULL"
    
    # Accounting queries
    accounting {
        # Start accounting
        start_query = "\\
            INSERT INTO radacct \\
                (acctsessionid, acctuniqueid, username, realm, nasipaddress, \\
                 nasportid, nasporttype, acctstarttime, acctupdatetime, \\
                 acctstoptime, acctsessiontime, acctauthentic, connectinfo_start, \\
                 acctinputoctets, acctoutputoctets, calledstationid, callingstationid, \\
                 acctterminatecause, servicetype, framedprotocol, framedipaddress) \\
            VALUES \\
                ('%{Acct-Session-Id}', '%{Acct-Unique-Session-Id}', '%{SQL-User-Name}', \\
                 '%{Realm}', '%{NAS-IP-Address}', '%{NAS-Port}', '%{NAS-Port-Type}', \\
                 FROM_UNIXTIME(%{integer:Event-Timestamp}), FROM_UNIXTIME(%{integer:Event-Timestamp}), \\
                 NULL, 0, '%{Acct-Authentic}', '%{Connect-Info}', \\
                 0, 0, '%{Called-Station-Id}', '%{Calling-Station-Id}', \\
                 '', '%{Service-Type}', '%{Framed-Protocol}', '%{Framed-IP-Address}')"
        
        # Interim update
        interim_query = "\\
            UPDATE radacct \\
            SET acctupdatetime = FROM_UNIXTIME(%{integer:Event-Timestamp}), \\
                acctsessiontime = %{Acct-Session-Time}, \\
                acctinputoctets = %{Acct-Input-Octets}, \\
                acctoutputoctets = %{Acct-Output-Octets}, \\
                framedipaddress = '%{Framed-IP-Address}' \\
            WHERE acctsessionid = '%{Acct-Session-Id}' \\
            AND username = '%{SQL-User-Name}' \\
            AND nasipaddress = '%{NAS-IP-Address}'"
        
        # Stop accounting
        stop_query = "\\
            UPDATE radacct \\
            SET acctstoptime = FROM_UNIXTIME(%{integer:Event-Timestamp}), \\
                acctsessiontime = %{Acct-Session-Time}, \\
                acctinputoctets = %{Acct-Input-Octets}, \\
                acctoutputoctets = %{Acct-Output-Octets}, \\
                acctterminatecause = '%{Acct-Terminate-Cause}', \\
                framedipaddress = '%{Framed-IP-Address}' \\
            WHERE acctsessionid = '%{Acct-Session-Id}' \\
            AND username = '%{SQL-User-Name}' \\
            AND nasipaddress = '%{NAS-IP-Address}'"
    }
    
    # Post-auth logging
    post-auth {
        query = "\\
            INSERT INTO radpostauth \\
                (username, pass, reply, authdate) \\
            VALUES \\
                ('%{SQL-User-Name}', '%{User-Password}', '%{reply:Packet-Type}', NOW())"
    }
}
EOF
    
    # Enable SQL module
    ln -sf /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql
    
    print_success "SQL module configured"
}

# Configure default site
configure_default_site() {
    print_step "Configuring default site..."
    
    # Backup original
    cp /etc/freeradius/3.0/sites-available/default /etc/freeradius/3.0/sites-available/default.backup
    
    cat > /etc/freeradius/3.0/sites-available/default << 'EOF'
server default {
    listen {
        type = auth
        ipaddr = *
        port = 1812
        limit {
            max_connections = 256
            lifetime = 0
            idle_timeout = 30
        }
    }
    
    listen {
        type = acct
        ipaddr = *
        port = 1813
        limit {
            max_connections = 256
            lifetime = 0
            idle_timeout = 30
        }
    }
    
    # CoA/Disconnect
    listen {
        type = coa
        ipaddr = *
        port = 3799
    }
    
    authorize {
        # Log the request
        preprocess
        
        # Check if user is in SQL database
        sql
        
        # If no Auth-Type set, reject
        if (!control:Auth-Type) {
            reject
        }
        
        # Check for disabled users (Auth-Type := Reject)
        if (&control:Auth-Type == "Reject") {
            reject
        }
        
        # Set default Auth-Type if not set
        if (!control:Auth-Type) {
            update control {
                Auth-Type := "PAP"
            }
        }
        
        # Check expiration
        expiration
        logintime
        
        # Simultaneous use check
        sql
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
    }
    
    preacct {
        preprocess
        acct_unique
    }
    
    accounting {
        # Log accounting to SQL
        sql
        
        # Update session info
        if (Acct-Status-Type == "Start") {
            sql
        }
        
        if (Acct-Status-Type == "Interim-Update") {
            sql
        }
        
        if (Acct-Status-Type == "Stop") {
            sql
        }
    }
    
    session {
        sql
    }
    
    post-auth {
        # Log successful auth
        sql
        
        # Reply with attributes from radreply
        if (session-state:) {
            update reply {
                &session-state:
            }
        }
        
        Post-Auth-Type REJECT {
            sql
        }
    }
    
    pre-proxy {
    }
    
    post-proxy {
    }
}
EOF
    
    print_success "Default site configured"
}

# Configure inner-tunnel (for EAP)
configure_inner_tunnel() {
    print_step "Configuring inner-tunnel..."
    
    cp /etc/freeradius/3.0/sites-available/inner-tunnel /etc/freeradius/3.0/sites-available/inner-tunnel.backup
    
    cat > /etc/freeradius/3.0/sites-available/inner-tunnel << 'EOF'
server inner-tunnel {
    listen {
        ipaddr = 127.0.0.1
        port = 18120
        type = auth
    }
    
    authorize {
        preprocess
        sql
        
        if (!control:Auth-Type) {
            update control {
                Auth-Type := "PAP"
            }
        }
        
        expiration
        logintime
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
EOF
    
    print_success "Inner-tunnel configured"
}

# Configure clients (NAS devices)
configure_clients() {
    print_step "Configuring clients..."
    
    # Backup original
    cp /etc/freeradius/3.0/clients.conf /etc/freeradius/3.0/clients.conf.backup
    
    cat > /etc/freeradius/3.0/clients.conf << EOF
# Default client for localhost testing
client localhost {
    ipaddr = 127.0.0.1
    secret = testing123
    require_message_authenticator = no
    nas_type = other
}

client localhost_ipv6 {
    ipaddr = ::1
    secret = testing123
    require_message_authenticator = no
}

# Allow any client (for dynamic NAS from database)
# In production, you should restrict this
client any {
    ipaddr = 0.0.0.0/0
    secret = ${RADIUS_SECRET}
    require_message_authenticator = no
    nas_type = mikrotik
    shortname = dynamic
}

# Read clients from SQL database
# This allows dynamic NAS management from your web interface
# Clients are read from the 'nas' table
EOF
    
    print_success "Clients configured"
}

# Configure radiusd.conf
configure_radiusd() {
    print_step "Configuring radiusd.conf..."
    
    # Update main configuration
    sed -i 's/^#\s*\$INCLUDE clients.conf/$INCLUDE clients.conf/' /etc/freeradius/3.0/radiusd.conf
    
    # Enable SQL in radiusd.conf
    if ! grep -q "read_clients = yes" /etc/freeradius/3.0/radiusd.conf; then
        echo "" >> /etc/freeradius/3.0/radiusd.conf
        echo "# Read clients from SQL" >> /etc/freeradius/3.0/radiusd.conf
    fi
    
    print_success "radiusd.conf configured"
}

# Configure firewall
configure_firewall() {
    print_step "Configuring firewall..."
    
    # Enable UFW if not enabled
    ufw --force enable
    
    # Allow RADIUS ports
    ufw allow ${RADIUS_PORT_AUTH}/udp comment "RADIUS Auth"
    ufw allow ${RADIUS_PORT_ACCT}/udp comment "RADIUS Acct"
    ufw allow ${RADIUS_PORT_COA}/udp comment "RADIUS CoA"
    
    # Allow SSH
    ufw allow 22/tcp comment "SSH"
    
    # If VPN is enabled, allow VPN ports
    if [ "$ENABLE_VPN" = "true" ]; then
        ufw allow 1723/tcp comment "PPTP VPN"
        ufw allow 47/tcp comment "GRE"
    fi
    
    ufw reload
    
    print_success "Firewall configured"
}

# Install and configure PPTP VPN (optional)
install_vpn() {
    if [ "$ENABLE_VPN" != "true" ]; then
        print_info "VPN installation skipped (ENABLE_VPN=false)"
        return
    fi
    
    print_step "Installing PPTP VPN server..."
    
    apt-get install -y pptpd
    
    # Configure pptpd
    cat > /etc/pptpd.conf << EOF
option /etc/ppp/pptpd-options
logwtmp
localip ${VPN_LOCAL_IP}
remoteip 10.0.0.100-200
EOF
    
    # Configure PPP options
    cat > /etc/ppp/pptpd-options << EOF
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
EOF
    
    # Enable IP forwarding
    echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    sysctl -p
    
    # Configure NAT
    iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
    iptables -A FORWARD -i ppp+ -o eth0 -j ACCEPT
    iptables -A FORWARD -i eth0 -o ppp+ -m state --state RELATED,ESTABLISHED -j ACCEPT
    
    # Save iptables rules
    apt-get install -y iptables-persistent
    netfilter-persistent save
    
    # Start PPTP
    systemctl enable pptpd
    systemctl start pptpd
    
    print_success "PPTP VPN server installed"
}

# Create helper scripts
create_helper_scripts() {
    print_step "Creating helper scripts..."
    
    # Create test script
    cat > /usr/local/bin/radius-test << 'EOF'
#!/bin/bash
# Test RADIUS authentication
# Usage: radius-test <username> <password>

if [ $# -lt 2 ]; then
    echo "Usage: radius-test <username> <password>"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

echo "Testing RADIUS authentication for user: $USERNAME"
radtest "$USERNAME" "$PASSWORD" localhost 0 testing123

echo ""
echo "If you see 'Access-Accept', authentication is working!"
echo "If you see 'Access-Reject', check the username/password or radcheck table."
EOF
    chmod +x /usr/local/bin/radius-test
    
    # Create status script
    cat > /usr/local/bin/radius-status << 'EOF'
#!/bin/bash
# Check RADIUS server status

echo "=== FreeRADIUS Status ==="
systemctl status freeradius --no-pager

echo ""
echo "=== Listening Ports ==="
netstat -tulpn | grep -E "(1812|1813|3799)"

echo ""
echo "=== Recent Auth Logs ==="
tail -20 /var/log/freeradius/radius.log 2>/dev/null || echo "No log file found"
EOF
    chmod +x /usr/local/bin/radius-status
    
    # Create add-vpn-user script
    cat > /usr/local/bin/add-vpn-user << 'EOF'
#!/bin/bash
# Add VPN user
# Usage: add-vpn-user <username> <password>

if [ $# -lt 2 ]; then
    echo "Usage: add-vpn-user <username> <password>"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

echo "$USERNAME pptpd $PASSWORD *" >> /etc/ppp/chap-secrets
echo "VPN user $USERNAME added successfully"
EOF
    chmod +x /usr/local/bin/add-vpn-user
    
    print_success "Helper scripts created"
}

# Set correct permissions
set_permissions() {
    print_step "Setting permissions..."
    
    chown -R freerad:freerad /etc/freeradius/3.0/
    chmod 640 /etc/freeradius/3.0/mods-available/sql
    
    print_success "Permissions set"
}

# Start FreeRADIUS
start_freeradius() {
    print_step "Starting FreeRADIUS..."
    
    # Test configuration first
    print_info "Testing configuration..."
    freeradius -CX
    
    if [ $? -eq 0 ]; then
        print_success "Configuration test passed"
        
        # Enable and start service
        systemctl enable freeradius
        systemctl start freeradius
        
        # Check status
        sleep 2
        if systemctl is-active --quiet freeradius; then
            print_success "FreeRADIUS started successfully"
        else
            print_error "FreeRADIUS failed to start. Check logs: journalctl -u freeradius"
            exit 1
        fi
    else
        print_error "Configuration test failed. Please check the configuration files."
        exit 1
    fi
}

# Print final instructions
print_final_instructions() {
    echo ""
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║              Installation Complete!                              ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo ""
    echo "=== Server Information ==="
    echo "RADIUS Auth Port: ${RADIUS_PORT_AUTH}/udp"
    echo "RADIUS Acct Port: ${RADIUS_PORT_ACCT}/udp"
    echo "RADIUS CoA Port:  ${RADIUS_PORT_COA}/udp"
    echo "Shared Secret:    ${RADIUS_SECRET}"
    
    if [ "$ENABLE_VPN" = "true" ]; then
        echo ""
        echo "=== VPN Information ==="
        echo "VPN Type: PPTP"
        echo "VPN Port: 1723/tcp"
        echo "VPN Local IP: ${VPN_LOCAL_IP}"
        echo "VPN Client Range: 10.0.0.100-200"
    fi
    
    echo ""
    echo "=== Quick Commands ==="
    echo "Test authentication:  radius-test <username> <password>"
    echo "Check server status:  radius-status"
    echo "View logs:            tail -f /var/log/freeradius/radius.log"
    echo "Restart service:      systemctl restart freeradius"
    
    if [ "$ENABLE_VPN" = "true" ]; then
        echo "Add VPN user:         add-vpn-user <username> <password>"
    fi
    
    echo ""
    echo "=== MikroTik Configuration ==="
    echo "Run these commands on your MikroTik router:"
    echo ""
    echo "/radius add address=$(hostname -I | awk '{print $1}') secret=${RADIUS_SECRET} timeout=3s service=ppp,hotspot,login"
    echo "/radius incoming set accept=yes port=3799"
    echo "/radius set [find] require-message-auth=no"
    echo "/ppp aaa set use-radius=yes accounting=yes interim-update=1m"
    echo ""
    
    echo -e "${YELLOW}IMPORTANT: Update the database credentials in /etc/freeradius/3.0/mods-available/sql${NC}"
    echo ""
}

# Main installation function
main() {
    print_header
    
    check_root
    detect_os
    
    print_step "Starting FreeRADIUS installation..."
    
    install_dependencies
    install_freeradius
    configure_sql
    configure_default_site
    configure_inner_tunnel
    configure_clients
    configure_radiusd
    configure_firewall
    install_vpn
    create_helper_scripts
    set_permissions
    start_freeradius
    
    print_final_instructions
}

# Run main function
main "$@"
