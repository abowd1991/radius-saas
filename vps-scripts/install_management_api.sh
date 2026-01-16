#!/bin/bash
# Install VPS Management API
# Run this script on the VPS as root

set -e

echo "=== Installing VPS Management API ==="

# Generate secure API secret
API_SECRET=$(openssl rand -hex 32)
echo "Generated API Secret: $API_SECRET"
echo "SAVE THIS SECRET - you'll need it for the admin panel!"

# Install dependencies
apt-get update
apt-get install -y python3-pip python3-flask

# Create directories
mkdir -p /opt/radius-saas/vps-scripts
mkdir -p /opt/backups

# Copy the management API script
cp vps_management_api.py /opt/radius-saas/vps-scripts/

# Create systemd service
cat > /etc/systemd/system/radius-saas-management.service << EOF
[Unit]
Description=RADIUS SaaS VPS Management API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/radius-saas
Environment=VPS_API_SECRET=$API_SECRET
ExecStart=/usr/bin/python3 /opt/radius-saas/vps-scripts/vps_management_api.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
systemctl daemon-reload
systemctl enable radius-saas-management
systemctl start radius-saas-management

# Check status
systemctl status radius-saas-management --no-pager

echo ""
echo "=== Installation Complete ==="
echo "API is running on http://127.0.0.1:8081"
echo ""
echo "API Secret: $API_SECRET"
echo ""
echo "Add this to your .env file:"
echo "VPS_MANAGEMENT_API_SECRET=$API_SECRET"
echo ""
echo "To test:"
echo "curl -H 'Authorization: Bearer $API_SECRET' http://127.0.0.1:8081/api/status"
