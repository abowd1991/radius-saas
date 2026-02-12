/**
 * CoA (Change of Authorization) Service
 * 
 * This service provides RADIUS CoA/Disconnect functionality for:
 * - Disconnecting active sessions
 * - Updating session attributes (speed, limits)
 * - Real-time user management
 * 
 * CoA requests are sent via SSH tunnel to VPS, then radclient to MikroTik
 */

import { getDb } from "../db";
import { radacct, nasDevices, systemSettings, radreply } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// CoA Response interface
interface CoAResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// VPS SSH Configuration
const VPS_HOST = '37.60.228.5';
const VPS_PORT = 1991;
const VPS_USER = 'root';
const VPS_PASS = '2U8@tWz@zYnecb2';

// Get NAS device by IP
async function getNasByIp(nasIp: string) {
  const db = await getDb();
  if (!db) return null;
  
  const [nas] = await db.select()
    .from(nasDevices)
    .where(eq(nasDevices.nasname, nasIp))
    .limit(1);
  
  return nas;
}

// Get RADIUS VPN IP from settings
async function getRadiusVpnIp(): Promise<string> {
  const db = await getDb();
  if (!db) return '192.168.30.1';
  
  const settings = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'radius_server_vpn_ip'));
  
  return settings[0]?.value || '192.168.30.1';
}

/**
 * Execute radclient command via SSH tunnel to VPS
 */
async function executeRadclient(
  nasIp: string,
  port: number,
  secret: string,
  packetType: 'disconnect' | 'coa',
  attributes: string
): Promise<{ success: boolean; output: string }> {
  try {
    // Build radclient command
    const radclientCmd = `echo '${attributes}' | radclient -x ${nasIp}:${port} ${packetType} ${secret}`;
    
    // Execute via SSH
    const sshCmd = `sshpass -p '${VPS_PASS}' ssh -p ${VPS_PORT} -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "timeout 5 bash -c \\"${radclientCmd} 2>&1\\" || echo 'TIMEOUT'"`;
    
    console.log(`[CoA] Executing radclient via SSH: ${packetType} to ${nasIp}:${port}`);
    
    const { stdout, stderr } = await execAsync(sshCmd);
    const output = stdout + stderr;
    
    console.log(`[CoA] radclient output:`, output);
    
    // Check for success
    const isDisconnectSuccess = output.includes('Disconnect-ACK');
    const isCoASuccess = output.includes('CoA-ACK');
    const isTimeout = output.includes('TIMEOUT') || output.includes('No reply from server');
    
    if (isDisconnectSuccess || isCoASuccess) {
      return { success: true, output };
    } else if (isTimeout) {
      return { success: false, output: 'Timeout - MikroTik not responding on CoA port 3799' };
    } else {
      return { success: false, output };
    }
  } catch (error: any) {
    console.error('[CoA] radclient error:', error);
    return { success: false, output: error.message };
  }
}

/**
 * Send CoA Disconnect-Request via SSH tunnel + radclient
 */
export async function disconnectSession(
  username: string,
  nasIp: string,
  sessionId?: string,
  framedIp?: string
): Promise<CoAResponse> {
  try {
    const nas = await getNasByIp(nasIp);
    const secret = nas?.secret || '10020300';
    
    console.log(`Sending CoA Disconnect to ${nasIp}:3799 for user ${username}`);
    
    // Build RADIUS attributes
    let attributes = `User-Name=${username}`;
    if (sessionId) {
      attributes += `,Acct-Session-Id=${sessionId}`;
    }
    if (framedIp) {
      attributes += `,Framed-IP-Address=${framedIp}`;
    }
    
    // Send CoA via SSH tunnel + radclient
    const result = await executeRadclient(nasIp, 3799, secret, 'disconnect', attributes);
    
    if (result.success) {
      // Update radacct to mark session as stopped
      const db = await getDb();
      if (db && sessionId) {
        await db.update(radacct)
          .set({
            acctstoptime: new Date(),
            acctterminatecause: 'Admin-Reset',
          })
          .where(eq(radacct.acctsessionid, sessionId));
      }
      
      return {
        success: true,
        message: `Session disconnected successfully for user ${username}`,
        data: { username, nasIp, sessionId, output: result.output }
      };
    } else {
      // Still update database even if CoA fails
      const db = await getDb();
      if (db && sessionId) {
        await db.update(radacct)
          .set({
            acctstoptime: new Date(),
            acctterminatecause: 'Admin-Reset',
          })
          .where(eq(radacct.acctsessionid, sessionId));
      }
      
      return {
        success: false,
        message: 'Disconnect request failed',
        error: result.output
      };
    }
  } catch (error: any) {
    console.error('CoA Disconnect error:', error);
    
    // Still update database even if CoA fails
    const db = await getDb();
    if (db && sessionId) {
      await db.update(radacct)
        .set({
          acctstoptime: new Date(),
          acctterminatecause: 'Admin-Reset',
        })
        .where(eq(radacct.acctsessionid, sessionId));
    }
    
    return {
      success: true,
      message: 'Session marked as disconnected in database (CoA may have failed)',
      error: error.message
    };
  }
}

/**
 * Disconnect all sessions for a specific username
 */
export async function disconnectUserAllSessions(username: string): Promise<CoAResponse> {
  const db = await getDb();
  if (!db) {
    return { success: false, message: 'Database not available', error: 'DB_ERROR' };
  }
  
  try {
    // Get all active sessions for this user
    const sessions = await db.select()
      .from(radacct)
      .where(and(
        eq(radacct.username, username),
        isNull(radacct.acctstoptime)
      ));
    
    if (sessions.length === 0) {
      // Try to disconnect anyway using all NAS devices
      const allNas = await db.select().from(nasDevices);
      
      if (allNas.length > 0) {
        // Try to disconnect from each NAS
        const results = await Promise.all(
          allNas.map((nas: any) => 
            disconnectSession(username, nas.nasname, undefined, undefined)
          )
        );
        
        return {
          success: true,
          message: 'Disconnect requests sent to all NAS devices',
          data: { results }
        };
      }
      
      return {
        success: true,
        message: 'No active sessions found for this user',
        data: { disconnected: 0 }
      };
    }
    
    // Disconnect each session
    const results = await Promise.all(
      sessions.map((session: any) => 
        disconnectSession(
          username,
          session.nasipaddress,
          session.acctsessionid || undefined,
          session.framedipaddress || undefined
        )
      )
    );
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      message: `Disconnected ${successCount} of ${sessions.length} sessions`,
      data: {
        disconnected: successCount,
        total: sessions.length,
        results
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to disconnect sessions',
      error: error.message
    };
  }
}

/**
 * Send CoA request to update session attributes (e.g., change speed)
 */
export async function updateSessionAttributes(
  username: string,
  nasIp: string,
  sessionId: string,
  framedIp?: string,
  attributes?: {
    downloadSpeed?: number;
    uploadSpeed?: number;
    sessionTimeout?: number;
  }
): Promise<CoAResponse> {
  try {
    const nas = await getNasByIp(nasIp);
    const secret = nas?.secret || '10020300';
    
    console.log(`Sending CoA Update to ${nasIp}:3799 for user ${username}`);
    
    // Build RADIUS attributes
    let radiusAttrs = `User-Name=${username},Acct-Session-Id=${sessionId}`;
    
    if (framedIp) {
      radiusAttrs += `,Framed-IP-Address=${framedIp}`;
    }
    
    // Add Mikrotik-Rate-Limit if speed is specified
    if (attributes?.downloadSpeed && attributes?.uploadSpeed) {
      const uploadKbps = attributes.uploadSpeed * 1000;
      const downloadKbps = attributes.downloadSpeed * 1000;
      const rateLimit = `${uploadKbps}k/${downloadKbps}k`;
      radiusAttrs += `,Mikrotik-Rate-Limit=${rateLimit}`;
    }
    
    // Add Session-Timeout if specified
    if (attributes?.sessionTimeout) {
      radiusAttrs += `,Session-Timeout=${attributes.sessionTimeout}`;
    }
    
    // Send CoA via SSH tunnel + radclient
    const result = await executeRadclient(nasIp, 3799, secret, 'coa', radiusAttrs);
    
    if (result.success) {
      return {
        success: true,
        message: `Session attributes updated for user ${username}`,
        data: { username, nasIp, sessionId, attributes, output: result.output }
      };
    } else {
      return {
        success: false,
        message: 'CoA update failed',
        error: result.output
      };
    }
  } catch (error: any) {
    console.error('CoA Update error:', error);
    return {
      success: false,
      message: 'Failed to update session attributes',
      error: error.message
    };
  }
}

/**
 * Change user speed with fallback chain:
 * 1. Try RADIUS CoA (update active session speed)
 * 2. Fallback to Disconnect (force reconnect with new speed)
 */
export async function changeUserSpeed(
  username: string,
  uploadSpeedMbps: number,
  downloadSpeedMbps: number
): Promise<CoAResponse> {
  const db = await getDb();
  if (!db) {
    return { success: false, message: 'Database not available', error: 'DB_ERROR' };
  }
  
  // Build rate limit string (Mikrotik format: upload/download in kbps)
  const uploadSpeedKbps = uploadSpeedMbps * 1000;
  const downloadSpeedKbps = downloadSpeedMbps * 1000;
  const rateLimit = `${uploadSpeedKbps}k/${downloadSpeedKbps}k`;
  
  try {
    // First, update radreply with new speed (so future connections use it)
    
    // Check if Mikrotik-Rate-Limit exists for this user
    const existingRate = await db.select()
      .from(radreply)
      .where(and(
        eq(radreply.username, username),
        eq(radreply.attribute, 'Mikrotik-Rate-Limit')
      ))
      .limit(1);
    
    if (existingRate.length > 0) {
      // Update existing
      await db.update(radreply)
        .set({ value: rateLimit })
        .where(and(
          eq(radreply.username, username),
          eq(radreply.attribute, 'Mikrotik-Rate-Limit')
        ));
    } else {
      // Insert new
      await db.insert(radreply).values({
        username,
        attribute: 'Mikrotik-Rate-Limit',
        op: ':=',
        value: rateLimit,
      });
    }
    
    console.log(`[Speed Change] Updated radreply for ${username} with rate limit: ${rateLimit}`);
    
    // Get active sessions for this user
    const sessions = await db.select()
      .from(radacct)
      .where(and(
        eq(radacct.username, username),
        isNull(radacct.acctstoptime)
      ));
    
    if (sessions.length === 0) {
      return {
        success: true,
        message: `Speed updated for ${username}. No active session - new speed will apply on next login.`,
        data: { rateLimit, activeSession: false }
      };
    }
    
    // Try CoA for each active session
    const coaResults = await Promise.all(
      sessions.map((session: any) => 
        updateSessionAttributes(
          username,
          session.nasipaddress,
          session.acctsessionid,
          session.framedipaddress,
          {
            downloadSpeed: downloadSpeedMbps,
            uploadSpeed: uploadSpeedMbps
          }
        )
      )
    );
    
    const coaSuccess = coaResults.some(r => r.success);
    
    if (coaSuccess) {
      return {
        success: true,
        message: `Speed changed to ${downloadSpeedMbps}/${uploadSpeedMbps} Mbps for ${username} (CoA)`,
        data: { rateLimit, method: 'coa', results: coaResults }
      };
    }
    
    // Fallback: Disconnect user (will reconnect with new speed)
    console.log(`[Speed Change] CoA failed, disconnecting user ${username} to apply new speed`);
    
    const disconnectResult = await disconnectUserAllSessions(username);
    
    return {
      success: true,
      message: `Speed updated for ${username}. User disconnected - new speed will apply on reconnect.`,
      data: { 
        rateLimit, 
        method: 'disconnect',
        coaAttempted: true,
        coaFailed: true,
        disconnectResult 
      }
    };
    
  } catch (error: any) {
    console.error('[Speed Change] Error:', error);
    return {
      success: false,
      message: 'Failed to change user speed',
      error: error.message
    };
  }
}
