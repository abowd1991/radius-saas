/**
 * SSH VPN Service
 * 
 * This service executes VPN commands directly on the RADIUS server via SSH
 * using vpncmd to manage SoftEther VPN users.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// SSH Configuration
const SSH_HOST = '37.60.228.5';
const SSH_USER = 'root';
const SSH_PASSWORD = '!@Abowd329324';
const VPNCMD_PATH = '/opt/vpnserver/vpncmd';
const VPN_HUB = 'VPN';

interface VPNResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Execute SSH command on the RADIUS server using sshpass
 */
async function executeSSH(command: string, timeout: number = 30000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const sshCommand = `sshpass -p '${SSH_PASSWORD}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o ServerAliveInterval=5 ${SSH_USER}@${SSH_HOST} "${command.replace(/"/g, '\\"')}"`;
    
    console.log('[SSH] Executing command...');
    
    exec(sshCommand, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[SSH] Command error:', error.message);
        reject(error);
        return;
      }
      console.log('[SSH] Command output:', stdout.substring(0, 500));
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Create a VPN user in SoftEther with Password authentication
 * Uses vpncmd directly on the server
 */
export async function createVpnUser(username: string, password: string): Promise<VPNResult> {
  try {
    console.log(`[SSH VPN] Creating VPN user: ${username}`);
    
    // Escape username and password for shell
    const safeUsername = username.replace(/['"\\$`]/g, '');
    const safePassword = password.replace(/['"\\$`]/g, '');
    
    // Step 1: Create user with vpncmd
    const createCommand = `${VPNCMD_PATH} localhost /SERVER /HUB:${VPN_HUB} /CMD UserCreate ${safeUsername} /GROUP:none /REALNAME:NAS /NOTE:Auto-created`;
    
    console.log('[SSH VPN] Running create command via SSH...');
    const { stdout: createOutput } = await executeSSH(createCommand, 60000);
    console.log(`[SSH VPN] Create response: ${createOutput}`);
    
    // Check if user was created or already exists
    if (createOutput.includes('Error occurred') && !createOutput.includes('already exists')) {
      console.error('[SSH VPN] User creation failed:', createOutput);
      return { success: false, error: 'Failed to create user' };
    }
    
    // Step 2: Set password for the user
    const passwordCommand = `${VPNCMD_PATH} localhost /SERVER /HUB:${VPN_HUB} /CMD UserPasswordSet ${safeUsername} /PASSWORD:${safePassword}`;
    
    console.log('[SSH VPN] Setting password...');
    const { stdout: passwordOutput } = await executeSSH(passwordCommand, 60000);
    console.log(`[SSH VPN] Password response: ${passwordOutput}`);
    
    if (passwordOutput.includes('Error occurred')) {
      console.error('[SSH VPN] Password set failed:', passwordOutput);
      return { success: false, error: 'Failed to set password' };
    }
    
    console.log(`[SSH VPN] User ${username} created successfully with password auth`);
    return { success: true, message: `User ${username} created successfully` };
    
  } catch (error: any) {
    console.error('[SSH VPN] Error creating user:', error.message);
    return { success: false, error: error.message || 'Failed to create VPN user' };
  }
}

/**
 * Delete a VPN user from SoftEther
 */
export async function deleteVpnUser(username: string): Promise<VPNResult> {
  try {
    console.log(`[SSH VPN] Deleting VPN user: ${username}`);
    
    const safeUsername = username.replace(/['"\\$`]/g, '');
    const deleteCommand = `${VPNCMD_PATH} localhost /SERVER /HUB:${VPN_HUB} /CMD UserDelete ${safeUsername}`;
    
    const { stdout } = await executeSSH(deleteCommand, 30000);
    console.log(`[SSH VPN] Delete response: ${stdout}`);
    
    if (stdout.includes('Error occurred') && !stdout.includes('not found')) {
      return { success: false, error: 'Failed to delete user' };
    }
    
    return { success: true, message: `User ${username} deleted` };
  } catch (error: any) {
    console.error('[SSH VPN] Error deleting user:', error.message);
    return { success: false, error: error.message || 'Failed to delete VPN user' };
  }
}

/**
 * List all VPN users
 */
export async function listVpnUsers(): Promise<VPNResult & { users?: string[] }> {
  try {
    const listCommand = `${VPNCMD_PATH} localhost /SERVER /HUB:${VPN_HUB} /CMD UserList`;
    
    const { stdout } = await executeSSH(listCommand, 30000);
    
    // Parse user list from vpncmd output
    const users: string[] = [];
    const lines = stdout.split('\n');
    let inUserSection = false;
    
    for (const line of lines) {
      if (line.includes('User Name')) {
        inUserSection = true;
        continue;
      }
      if (inUserSection && line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 2) {
          const userName = parts[1]?.trim();
          if (userName && userName !== 'Value' && !userName.includes('-')) {
            users.push(userName);
          }
        }
      }
    }
    
    return { success: true, users };
  } catch (error: any) {
    console.error('[SSH VPN] Error listing users:', error.message);
    return { success: false, error: error.message || 'Failed to list VPN users' };
  }
}

/**
 * Disconnect a VPN session
 */
export async function disconnectVpnSession(username: string): Promise<VPNResult> {
  try {
    console.log(`[SSH VPN] Disconnecting session for: ${username}`);
    
    const safeUsername = username.replace(/['"\\$`]/g, '');
    
    // Get session list first
    const sessionListCommand = `${VPNCMD_PATH} localhost /SERVER /HUB:${VPN_HUB} /CMD SessionList`;
    const { stdout: sessionList } = await executeSSH(sessionListCommand, 30000);
    
    // Find session for this user and disconnect
    const lines = sessionList.split('\n');
    for (const line of lines) {
      if (line.includes(safeUsername)) {
        // Extract session name
        const match = line.match(/Session Name\s*\|\s*(\S+)/);
        if (match) {
          const sessionName = match[1];
          const disconnectCommand = `${VPNCMD_PATH} localhost /SERVER /HUB:${VPN_HUB} /CMD SessionDisconnect ${sessionName}`;
          await executeSSH(disconnectCommand, 30000);
          console.log(`[SSH VPN] Session ${sessionName} disconnected for ${username}`);
        }
      }
    }
    
    return { success: true, message: `Session disconnected for ${username}` };
  } catch (error: any) {
    console.error('[SSH VPN] Error disconnecting session:', error.message);
    return { success: false, error: error.message || 'Failed to disconnect session' };
  }
}

/**
 * Get active VPN sessions
 */
export async function getVpnSessions(): Promise<VPNResult & { sessions?: Array<{ session_name: string; username: string; source_ip: string }> }> {
  try {
    const sessionsCommand = `${VPNCMD_PATH} localhost /SERVER /HUB:${VPN_HUB} /CMD SessionList`;
    
    const { stdout } = await executeSSH(sessionsCommand, 30000);
    
    // Parse session list from vpncmd output
    const sessions: Array<{ session_name: string; username: string; source_ip: string }> = [];
    const lines = stdout.split('\n');
    let currentSession: any = {};
    
    for (const line of lines) {
      if (line.includes('Session Name') && line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 2) {
          currentSession.session_name = parts[1]?.trim();
        }
      }
      if (line.includes('User Name') && line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 2) {
          currentSession.username = parts[1]?.trim();
        }
      }
      if (line.includes('Source IP') && line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 2) {
          currentSession.source_ip = parts[1]?.trim();
        }
      }
      if (line.includes('---') && currentSession.session_name) {
        sessions.push({ ...currentSession });
        currentSession = {};
      }
    }
    
    return { success: true, sessions };
  } catch (error: any) {
    console.error('[SSH VPN] Error getting sessions:', error.message);
    return { success: false, error: error.message || 'Failed to get VPN sessions' };
  }
}

/**
 * Check if SSH connection to RADIUS server is working
 */
export async function checkConnection(): Promise<VPNResult> {
  try {
    const { stdout } = await executeSSH('echo SSH_OK', 10000);
    if (stdout.includes('SSH_OK')) {
      return { success: true, message: 'SSH connection working' };
    }
    return { success: false, error: 'SSH connection failed' };
  } catch (error: any) {
    return { success: false, error: error.message || 'SSH connection failed' };
  }
}

/**
 * Check if a VPN user exists
 */
export async function userExists(username: string): Promise<boolean> {
  try {
    const safeUsername = username.replace(/['"\\$`]/g, '');
    const checkCommand = `${VPNCMD_PATH} localhost /SERVER /HUB:${VPN_HUB} /CMD UserGet ${safeUsername}`;
    
    const { stdout } = await executeSSH(checkCommand, 30000);
    
    // If we get user info without error, user exists
    return !stdout.includes('Error occurred');
  } catch (error) {
    return false;
  }
}
