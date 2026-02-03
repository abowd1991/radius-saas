/**
 * CoA (Change of Authorization) Service
 * 
 * This service provides RADIUS CoA/Disconnect functionality for:
 * - Disconnecting active sessions
 * - Updating session attributes (speed, limits)
 * - Real-time user management
 * 
 * CoA requests are sent via the remote RADIUS API server
 */

import { getDb } from "../db";
import { radacct, nasDevices, systemSettings, radreply } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

// CoA Response interface
interface CoAResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Remote API configuration
const RADIUS_API_URL = 'http://37.60.228.5:8080';
const RADIUS_API_KEY = 'radius_api_key_2024_secure';

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
 * Send CoA Disconnect-Request via remote API
 */
export async function disconnectSession(
  username: string,
  nasIp: string,
  sessionId?: string,
  framedIp?: string
): Promise<CoAResponse> {
  try {
    const nas = await getNasByIp(nasIp);
    const secret = nas?.secret || 'radius_secret_2024';
    
    console.log(`Sending CoA Disconnect to ${nasIp}:3799 for user ${username} via remote API`);
    
    // Send CoA via remote API
    const response = await fetch(`${RADIUS_API_URL}/api/radius/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': RADIUS_API_KEY,
      },
      body: JSON.stringify({
        username,
        nas_ip: nasIp,
        secret,
        session_id: sessionId,
        framed_ip: framedIp,
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update radacct to mark session as stopped
      const db = await getDb();
      if (db && sessionId) {
        await db.update(radacct)
          .set({
            acctstoptime: new Date(),
            acctterminatecause: 'Admin-Reset',
          })
          .where(eq(radacct.acctuniqueid, sessionId));
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
          .where(eq(radacct.acctuniqueid, sessionId));
      }
      
      return {
        success: false,
        message: result.message || 'Disconnect request failed',
        error: result.output || result.error
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
        .where(eq(radacct.acctuniqueid, sessionId));
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
      // Try to disconnect anyway using VPN IP as NAS
      const radiusVpnIp = await getRadiusVpnIp();
      
      // Get all NAS devices to try disconnecting from each
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
    const secret = nas?.secret || 'radius_secret_2024';
    
    console.log(`Sending CoA Update to ${nasIp}:3799 for user ${username}`);
    
    // Build rate limit string (upload/download in kbps)
    let rateLimit: string | undefined;
    if (attributes?.downloadSpeed && attributes?.uploadSpeed) {
      rateLimit = `${attributes.uploadSpeed * 1000}k/${attributes.downloadSpeed * 1000}k`;
    }
    
    // Send CoA via remote API
    const response = await fetch(`${RADIUS_API_URL}/api/radius/coa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': RADIUS_API_KEY,
      },
      body: JSON.stringify({
        username,
        nas_ip: nasIp,
        secret,
        session_id: sessionId,
        framed_ip: framedIp,
        rate_limit: rateLimit,
        session_timeout: attributes?.sessionTimeout,
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        message: `Session attributes updated for user ${username}`,
        data: { username, nasIp, sessionId, attributes, output: result.output }
      };
    } else {
      return {
        success: false,
        message: result.message || 'CoA update failed',
        error: result.output || result.error
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
 * 1. Try MikroTik API if enabled (instant, no disconnect)
 * 2. Try RADIUS CoA (may or may not work depending on MikroTik support)
 * 3. Fallback to Disconnect + Reconnect (always works)
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
    
    // Import MikroTik API service
    const mikrotikApi = await import('./mikrotikApiService');
    
    // Try each active session
    for (const session of sessions) {
      const nasIp = session.nasipaddress;
      
      // Step 1: Try MikroTik API if enabled for this NAS
      const apiEnabled = await mikrotikApi.isApiEnabled(nasIp);
      
      if (apiEnabled) {
        console.log(`[Speed Change] Trying MikroTik API for ${username} on NAS ${nasIp}`);
        
        const apiResult = await mikrotikApi.changeSpeedViaApi(
          nasIp,
          username,
          uploadSpeedKbps,
          downloadSpeedKbps
        );
        
        if (apiResult.success) {
          console.log(`[Speed Change] ✅ API success for ${username}`);
          return {
            success: true,
            message: `Speed changed instantly for ${username} to ${rateLimit} via MikroTik API`,
            data: { rateLimit, method: 'mikrotik-api', ...apiResult.data }
          };
        } else {
          console.log(`[Speed Change] API failed: ${apiResult.message}, trying CoA...`);
        }
      }
      
      // Step 2: Try RADIUS CoA
      console.log(`[Speed Change] Trying RADIUS CoA for ${username} on NAS ${nasIp}`);
      
      const coaResult = await updateSessionAttributes(
        username,
        nasIp,
        session.acctsessionid || '',
        session.framedipaddress || undefined,
        {
          downloadSpeed: downloadSpeedMbps,
          uploadSpeed: uploadSpeedMbps,
        }
      );
      
      if (coaResult.success) {
        console.log(`[Speed Change] ✅ CoA success for ${username}`);
        return {
          success: true,
          message: `Speed changed for ${username} to ${rateLimit} via RADIUS CoA`,
          data: { rateLimit, method: 'radius-coa' }
        };
      }
      
      // Step 3: Fallback to Disconnect + Reconnect
      console.log(`[Speed Change] CoA failed, disconnecting ${username} for reconnect...`);
      
      await disconnectSession(
        username,
        nasIp,
        session.acctsessionid || undefined,
        session.framedipaddress || undefined
      );
    }
    
    return {
      success: true,
      message: `Speed updated for ${username}. User disconnected - new speed (${rateLimit}) will apply on reconnect.`,
      data: { rateLimit, method: 'disconnect-reconnect' }
    };
    
  } catch (error: any) {
    console.error('[CoA] Error changing speed:', error);
    return {
      success: false,
      message: 'Failed to change speed',
      error: error.message
    };
  }
}

/**
 * Check if CoA is supported/reachable on a NAS
 */
export async function testCoAConnection(nasIp: string): Promise<CoAResponse> {
  try {
    // Test via remote API
    const response = await fetch(`${RADIUS_API_URL}/api/health`, {
      method: 'GET',
      headers: {
        'X-API-Key': RADIUS_API_KEY,
      },
    });
    
    if (response.ok) {
      return {
        success: true,
        message: 'Remote API is reachable, CoA should work',
        data: { nasIp, port: 3799 }
      };
    } else {
      return {
        success: false,
        message: 'Remote API is not responding',
        error: `HTTP ${response.status}`
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: 'CoA test failed',
      error: error.message
    };
  }
}
