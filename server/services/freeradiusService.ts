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

// Export as service object for easier testing and usage
export const freeradiusService = {
  reloadFreeRADIUS,
  checkFreeRADIUSStatus: async () => {
    const result = await checkFreeRADIUSStatus();
    return { running: result.running, message: result.status };
  },
  getFreeRADIUSLogs,
  addNASClient,
};
