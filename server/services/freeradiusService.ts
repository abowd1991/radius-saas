/**
 * FreeRADIUS Service - Auto reload on NAS changes
 * Connects to RADIUS server via SSH and reloads FreeRADIUS
 */

import { Client, ClientChannel } from 'ssh2';

// RADIUS Server Configuration
const RADIUS_SERVER = {
  host: '37.60.228.5',
  port: 22,
  username: 'root',
  password: '00~tvUNn1uubZjls'
};

/**
 * Execute command on RADIUS server via SSH
 */
async function executeSSHCommand(command: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const conn = new Client();
    let output = '';
    
    conn.on('ready', () => {
      console.log('[FreeRADIUS] SSH connection established');
      conn.exec(command, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          console.error('[FreeRADIUS] SSH exec error:', err);
          conn.end();
          resolve({ success: false, output: err.message });
          return;
        }
        
        stream.on('close', (code: number) => {
          console.log(`[FreeRADIUS] Command exited with code: ${code}`);
          conn.end();
          resolve({ success: code === 0, output });
        });
        
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data: Buffer) => {
          output += data.toString();
        });
      });
    });
    
    conn.on('error', (err: Error) => {
      console.error('[FreeRADIUS] SSH connection error:', err);
      resolve({ success: false, output: err.message });
    });
    
    conn.connect(RADIUS_SERVER);
  });
}

/**
 * Reload FreeRADIUS to pick up new NAS clients
 * Uses 'systemctl reload freeradius' which is graceful and doesn't drop connections
 */
export async function reloadFreeRADIUS(): Promise<{ success: boolean; message: string }> {
  console.log('[FreeRADIUS] Reloading FreeRADIUS service...');
  
  try {
    // First try graceful reload
    const reloadResult = await executeSSHCommand('systemctl reload freeradius 2>&1 || systemctl restart freeradius 2>&1');
    
    if (reloadResult.success) {
      console.log('[FreeRADIUS] ✅ FreeRADIUS reloaded successfully');
      return { success: true, message: 'FreeRADIUS reloaded successfully' };
    }
    
    // If reload fails, try restart
    console.log('[FreeRADIUS] Reload failed, trying restart...');
    const restartResult = await executeSSHCommand('systemctl restart freeradius 2>&1');
    
    if (restartResult.success) {
      console.log('[FreeRADIUS] ✅ FreeRADIUS restarted successfully');
      return { success: true, message: 'FreeRADIUS restarted successfully' };
    }
    
    console.error('[FreeRADIUS] ❌ Failed to reload/restart FreeRADIUS:', restartResult.output);
    return { success: false, message: `Failed to reload FreeRADIUS: ${restartResult.output}` };
    
  } catch (error) {
    console.error('[FreeRADIUS] ❌ Error reloading FreeRADIUS:', error);
    return { success: false, message: `Error: ${error}` };
  }
}

/**
 * Check FreeRADIUS status
 */
export async function checkFreeRADIUSStatus(): Promise<{ running: boolean; status: string }> {
  console.log('[FreeRADIUS] Checking FreeRADIUS status...');
  
  try {
    const result = await executeSSHCommand('systemctl is-active freeradius');
    const isRunning = result.output.trim() === 'active';
    
    return { 
      running: isRunning, 
      status: result.output.trim() 
    };
  } catch (error) {
    console.error('[FreeRADIUS] Error checking status:', error);
    return { running: false, status: 'unknown' };
  }
}

/**
 * Get FreeRADIUS logs
 */
export async function getFreeRADIUSLogs(lines: number = 50): Promise<string> {
  console.log(`[FreeRADIUS] Getting last ${lines} log lines...`);
  
  try {
    const result = await executeSSHCommand(`journalctl -u freeradius --no-pager -n ${lines}`);
    return result.output;
  } catch (error) {
    console.error('[FreeRADIUS] Error getting logs:', error);
    return `Error: ${error}`;
  }
}

/**
 * Add NAS client to FreeRADIUS clients.conf (for manual mode)
 * Note: With dynamic clients enabled, this is not needed as NAS are read from database
 */
export async function addNASClient(params: {
  nasname: string;
  shortname: string;
  secret: string;
}): Promise<{ success: boolean; message: string }> {
  console.log(`[FreeRADIUS] Adding NAS client: ${params.nasname}`);
  
  try {
    // With dynamic clients enabled, NAS are read from database
    // This function is kept for manual mode or fallback
    const clientConfig = `
client ${params.shortname} {
    ipaddr = ${params.nasname}
    secret = ${params.secret}
    shortname = ${params.shortname}
}
`;
    
    // Append to clients.conf
    const result = await executeSSHCommand(
      `echo '${clientConfig}' >> /etc/freeradius/3.0/clients.conf && systemctl reload freeradius`
    );
    
    if (result.success) {
      console.log(`[FreeRADIUS] ✅ NAS client ${params.nasname} added successfully`);
      return { success: true, message: 'NAS client added successfully' };
    }
    
    return { success: false, message: `Failed to add NAS client: ${result.output}` };
  } catch (error) {
    console.error('[FreeRADIUS] Error adding NAS client:', error);
    return { success: false, message: `Error: ${error}` };
  }
}

/**
 * Get comprehensive system diagnostics
 */
export async function getSystemDiagnostics(): Promise<{
  freeradius: { running: boolean; status: string; uptime?: string };
  vpn: { running: boolean; status: string; activeSessions?: number };
  dhcp: { running: boolean; status: string; activeLeases?: number };
  bridge: { exists: boolean; ip?: string };
  lastCheck: Date;
}> {
  console.log('[Diagnostics] Running system diagnostics...');
  
  try {
    const result = await executeSSHCommand(`
      echo "=== FREERADIUS ==="
      systemctl is-active freeradius
      ps -p \$(pgrep freeradius 2>/dev/null || echo 0) -o etime= 2>/dev/null || echo "N/A"
      
      echo "=== VPN ==="
      systemctl is-active vpnserver
      grep -c "Session" /var/log/softether/server_log/*.log 2>/dev/null | tail -1 || echo "0"
      
      echo "=== DHCP ==="
      systemctl is-active isc-dhcp-server
      grep -c "^lease" /var/lib/dhcp/dhcpd.leases 2>/dev/null || echo "0"
      
      echo "=== BRIDGE ==="
      ip addr show br-radius 2>/dev/null | grep -oP 'inet \\K[0-9.]+' || echo "NOT_FOUND"
    `);
    
    const lines = result.output.split('\n');
    let section = '';
    const data: any = {
      freeradius: { running: false, status: 'unknown' },
      vpn: { running: false, status: 'unknown' },
      dhcp: { running: false, status: 'unknown' },
      bridge: { exists: false },
      lastCheck: new Date()
    };
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('FREERADIUS')) section = 'freeradius';
      else if (trimmed.includes('VPN')) section = 'vpn';
      else if (trimmed.includes('DHCP')) section = 'dhcp';
      else if (trimmed.includes('BRIDGE')) section = 'bridge';
      else if (trimmed && section) {
        switch (section) {
          case 'freeradius':
            if (!data.freeradius.status || data.freeradius.status === 'unknown') {
              data.freeradius.status = trimmed;
              data.freeradius.running = trimmed === 'active';
            } else if (!data.freeradius.uptime) {
              data.freeradius.uptime = trimmed;
            }
            break;
          case 'vpn':
            if (!data.vpn.status || data.vpn.status === 'unknown') {
              data.vpn.status = trimmed;
              data.vpn.running = trimmed === 'active';
            } else if (!data.vpn.activeSessions) {
              data.vpn.activeSessions = parseInt(trimmed) || 0;
            }
            break;
          case 'dhcp':
            if (!data.dhcp.status || data.dhcp.status === 'unknown') {
              data.dhcp.status = trimmed;
              data.dhcp.running = trimmed === 'active';
            } else if (!data.dhcp.activeLeases) {
              data.dhcp.activeLeases = parseInt(trimmed) || 0;
            }
            break;
          case 'bridge':
            if (trimmed !== 'NOT_FOUND') {
              data.bridge.exists = true;
              data.bridge.ip = trimmed;
            }
            break;
        }
      }
    }
    
    return data;
  } catch (error) {
    console.error('[Diagnostics] Error:', error);
    return {
      freeradius: { running: false, status: 'error' },
      vpn: { running: false, status: 'error' },
      dhcp: { running: false, status: 'error' },
      bridge: { exists: false },
      lastCheck: new Date()
    };
  }
}

/**
 * Get unknown client attempts (NAS not in database)
 */
export async function getUnknownClients(limit: number = 50): Promise<{
  clients: Array<{ ip: string; timestamp: string; count: number }>;
}> {
  console.log('[Diagnostics] Getting unknown client attempts...');
  
  try {
    const result = await executeSSHCommand(
      `journalctl -u freeradius --no-pager -n 500 | grep -i "unknown client" | tail -${limit}`
    );
    
    const clients: Array<{ ip: string; timestamp: string; count: number }> = [];
    const ipCounts = new Map<string, { timestamp: string; count: number }>();
    
    const lines = result.output.split('\n').filter(l => l.trim());
    for (const line of lines) {
      // Extract IP from log line
      const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
      const timeMatch = line.match(/^(\w+\s+\d+\s+[\d:]+)/);
      
      if (ipMatch) {
        const ip = ipMatch[1];
        const existing = ipCounts.get(ip);
        if (existing) {
          existing.count++;
        } else {
          ipCounts.set(ip, { timestamp: timeMatch?.[1] || 'unknown', count: 1 });
        }
      }
    }
    
    ipCounts.forEach((data, ip) => {
      clients.push({ ip, ...data });
    });
    
    return { clients: clients.sort((a, b) => b.count - a.count) };
  } catch (error) {
    console.error('[Diagnostics] Error getting unknown clients:', error);
    return { clients: [] };
  }
}

/**
 * Test RADIUS connectivity
 */
export async function testRadiusConnectivity(): Promise<{
  localhost: boolean;
  bridge: boolean;
  message: string;
}> {
  console.log('[Diagnostics] Testing RADIUS connectivity...');
  
  try {
    const result = await executeSSHCommand(`
      echo "=== LOCALHOST ==="
      echo "User-Name=test" | radclient -t 2 -r 1 127.0.0.1:1812 auth testing123 2>&1 | grep -q "Received" && echo "OK" || echo "FAIL"
      
      echo "=== BRIDGE ==="
      echo "User-Name=test" | radclient -t 2 -r 1 192.168.30.1:1812 auth testing123 2>&1 | grep -q "Received" && echo "OK" || echo "FAIL"
    `);
    
    const localhost = result.output.includes('LOCALHOST') && result.output.split('LOCALHOST')[1]?.includes('OK');
    const bridge = result.output.includes('BRIDGE') && result.output.split('BRIDGE')[1]?.includes('OK');
    
    return {
      localhost,
      bridge,
      message: localhost && bridge ? 'All connectivity tests passed' : 
               localhost ? 'Bridge connectivity failed' : 
               'RADIUS not responding'
    };
  } catch (error) {
    console.error('[Diagnostics] Error testing connectivity:', error);
    return { localhost: false, bridge: false, message: `Error: ${error}` };
  }
}

// Export as service object for easier testing and usage
export const freeradiusService = {
  reloadFreeRADIUS,
  checkFreeRADIUSStatus: async () => {
    const result = await checkFreeRADIUSStatus();
    return { running: result.running, message: result.status };
  },
  getFreeRADIUSLogs,
  addNASClient,
  getSystemDiagnostics,
  getUnknownClients,
  testRadiusConnectivity,
};
