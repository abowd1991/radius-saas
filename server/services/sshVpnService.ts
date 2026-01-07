/**
 * SSH VPN Service
 * 
 * This service executes VPN commands directly on the RADIUS server via SSH
 * to ensure reliable VPN user creation and management.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// SSH Configuration
const SSH_HOST = '37.60.228.5';
const SSH_USER = 'root';
const SSH_PASSWORD = '!@Abowd329324';
const API_KEY = 'radius_api_key_2024_secure';

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
      console.log('[SSH] Command output:', stdout.substring(0, 200));
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Create a VPN user in SoftEther with Password authentication
 * Uses curl to localhost API on the server for reliable creation
 */
export async function createVpnUser(username: string, password: string): Promise<VPNResult> {
  try {
    console.log(`[SSH VPN] Creating VPN user: ${username}`);
    
    // Escape username and password for JSON
    const safeUsername = username.replace(/['"\\]/g, '');
    const safePassword = password.replace(/['"\\]/g, '');
    
    // Use curl to call the API from localhost on the server
    // API now requires password for Password Authentication
    const createCommand = `curl -s -X POST -H 'Content-Type: application/json' -H 'X-API-Key: ${API_KEY}' -d '{"username":"${safeUsername}","password":"${safePassword}","realname":"NAS","note":"Auto-created"}' http://localhost:8080/api/vpn/users`;
    
    console.log('[SSH VPN] Running create command via SSH...');
    const { stdout, stderr } = await executeSSH(createCommand, 60000);
    console.log(`[SSH VPN] Create response: ${stdout}`);
    
    if (stderr) {
      console.log(`[SSH VPN] stderr: ${stderr}`);
    }
    
    // Parse response
    try {
      const response = JSON.parse(stdout.trim());
      if (response.success) {
        console.log(`[SSH VPN] User ${username} created successfully`);
        return { success: true, message: `User ${username} created successfully` };
      }
      console.error(`[SSH VPN] API returned error: ${response.error}`);
      return { success: false, error: response.error || 'Unknown error' };
    } catch (parseError) {
      console.error('[SSH VPN] Failed to parse response:', stdout);
      return { success: false, error: 'Failed to parse API response' };
    }
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
    
    const safeUsername = username.replace(/['"\\]/g, '');
    const deleteCommand = `curl -s -X DELETE -H 'X-API-Key: ${API_KEY}' http://localhost:8080/api/vpn/users/${safeUsername}`;
    
    const { stdout } = await executeSSH(deleteCommand, 30000);
    console.log(`[SSH VPN] Delete response: ${stdout}`);
    
    try {
      const response = JSON.parse(stdout.trim());
      if (response.success) {
        return { success: true, message: `User ${username} deleted` };
      }
      return { success: false, error: response.error || 'Unknown error' };
    } catch {
      return { success: false, error: 'Failed to parse response' };
    }
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
    const listCommand = `curl -s -H 'X-API-Key: ${API_KEY}' http://localhost:8080/api/vpn/users`;
    
    const { stdout } = await executeSSH(listCommand, 30000);
    
    try {
      const response = JSON.parse(stdout.trim());
      if (response.success) {
        return { success: true, users: response.users || [] };
      }
      return { success: false, error: response.error || 'Unknown error' };
    } catch {
      console.error('[SSH VPN] Failed to parse response:', stdout);
      return { success: false, error: 'Failed to parse API response' };
    }
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
    
    const safeUsername = username.replace(/['"\\]/g, '');
    const disconnectCommand = `/opt/vpn-scripts/disconnect_vpn_user.sh ${safeUsername}`;
    
    await executeSSH(disconnectCommand, 30000);
    console.log(`[SSH VPN] Session disconnected for ${username}`);
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
    const sessionsCommand = `curl -s -H 'X-API-Key: ${API_KEY}' http://localhost:8080/api/vpn/sessions`;
    
    const { stdout } = await executeSSH(sessionsCommand, 30000);
    
    try {
      const response = JSON.parse(stdout.trim());
      if (response.success) {
        return { success: true, sessions: response.sessions || [] };
      }
      return { success: false, error: response.error || 'Unknown error' };
    } catch {
      console.error('[SSH VPN] Failed to parse response:', stdout);
      return { success: false, error: 'Failed to parse API response' };
    }
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
