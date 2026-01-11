/**
 * VPN Service
 * 
 * This service manages VPN users via HTTP API running on the RADIUS server.
 * The API uses vpncmd to manage SoftEther VPN users.
 */

// VPN API Configuration
const VPN_API_URL = 'http://37.60.228.5:8080';
const API_KEY = 'radius_api_key_2024_secure';

interface VPNResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Make HTTP request to VPN API
 */
async function apiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: object
): Promise<any> {
  const url = `${VPN_API_URL}${endpoint}`;
  
  console.log(`[VPN API] ${method} ${url}`);
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    console.log(`[VPN API] Response:`, data);
    return data;
  } catch (error: any) {
    console.error(`[VPN API] Error:`, error.message);
    throw error;
  }
}

/**
 * Create a VPN user in SoftEther with Password authentication
 */
export async function createVpnUser(username: string, password: string): Promise<VPNResult> {
  try {
    console.log(`[VPN API] Creating VPN user: ${username}`);
    
    const result = await apiRequest('/api/vpn/users', 'POST', {
      username,
      password,
    });
    
    if (result.success) {
      console.log(`[VPN API] User ${username} created successfully`);
      return { success: true, message: result.message };
    } else {
      console.error(`[VPN API] Failed to create user:`, result.error);
      return { success: false, error: result.error || 'Failed to create user' };
    }
  } catch (error: any) {
    console.error('[VPN API] Error creating user:', error.message);
    return { success: false, error: error.message || 'Failed to create VPN user' };
  }
}

/**
 * Delete a VPN user from SoftEther
 */
export async function deleteVpnUser(username: string): Promise<VPNResult> {
  try {
    console.log(`[VPN API] Deleting VPN user: ${username}`);
    
    const result = await apiRequest(`/api/vpn/users/${encodeURIComponent(username)}`, 'DELETE');
    
    if (result.success) {
      return { success: true, message: result.message };
    } else {
      return { success: false, error: result.error || 'Failed to delete user' };
    }
  } catch (error: any) {
    console.error('[VPN API] Error deleting user:', error.message);
    return { success: false, error: error.message || 'Failed to delete VPN user' };
  }
}

/**
 * List all VPN users
 */
export async function listVpnUsers(): Promise<VPNResult & { users?: string[] }> {
  try {
    const result = await apiRequest('/api/vpn/users', 'GET');
    
    if (result.success) {
      // Parse user list from output
      const users: string[] = [];
      if (result.output) {
        const lines = result.output.split('\n');
        for (const line of lines) {
          if (line.includes('User Name') && line.includes('|')) {
            const parts = line.split('|');
            if (parts.length >= 2) {
              const userName = parts[1]?.trim();
              if (userName && userName !== 'Value') {
                users.push(userName);
              }
            }
          }
        }
      }
      return { success: true, users };
    }
    return { success: false, error: result.error };
  } catch (error: any) {
    console.error('[VPN API] Error listing users:', error.message);
    return { success: false, error: error.message || 'Failed to list VPN users' };
  }
}

/**
 * Disconnect a VPN session (placeholder - needs implementation on API side)
 */
export async function disconnectVpnSession(username: string): Promise<VPNResult> {
  console.log(`[VPN API] Disconnect session for ${username} - not implemented yet`);
  return { success: true, message: 'Session disconnect not implemented' };
}

/**
 * Get active VPN sessions (placeholder - needs implementation on API side)
 */
export async function getVpnSessions(): Promise<VPNResult & { sessions?: Array<{ session_name: string; username: string; source_ip: string }> }> {
  return { success: true, sessions: [] };
}

/**
 * Check if VPN API is working
 */
export async function checkConnection(): Promise<VPNResult> {
  try {
    const response = await fetch(`${VPN_API_URL}/health`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      return { success: true, message: 'VPN API connection working' };
    }
    return { success: false, error: 'VPN API not responding correctly' };
  } catch (error: any) {
    return { success: false, error: error.message || 'VPN API connection failed' };
  }
}

/**
 * Check if a VPN user exists
 */
export async function userExists(username: string): Promise<boolean> {
  try {
    const result = await listVpnUsers();
    if (result.success && result.users) {
      return result.users.includes(username);
    }
    return false;
  } catch (error) {
    return false;
  }
}
