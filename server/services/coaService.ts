/**
 * CoA (Change of Authorization) Service
 * 
 * This service provides RADIUS CoA/Disconnect functionality for:
 * - Disconnecting active sessions
 * - Updating session attributes (speed, limits)
 * - Real-time user management
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getDb } from "../db";
import { radacct, nasDevices, systemSettings } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

const execAsync = promisify(exec);

// CoA Response interface
interface CoAResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Get RADIUS server settings
async function getRadiusSettings() {
  const db = await getDb();
  if (!db) return null;
  
  const settings = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'radius_server_public_ip'));
  
  const radiusIp = settings[0]?.value || '127.0.0.1';
  
  return {
    radiusIp,
    coaPort: 3799,
    secret: 'radius_secret_2024', // Default secret
  };
}

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

/**
 * Send CoA Disconnect-Request to terminate a user session
 * Uses radclient command to send RADIUS CoA packet
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
    
    // Build the radclient command for Disconnect-Request
    // Disconnect-Request uses port 3799 (CoA port) on the NAS
    let attributes = `User-Name="${username}"`;
    if (sessionId) {
      attributes += `\nAcct-Session-Id="${sessionId}"`;
    }
    if (framedIp) {
      attributes += `\nFramed-IP-Address=${framedIp}`;
    }
    
    // Create temp file with attributes
    const tempFile = `/tmp/coa_${Date.now()}.txt`;
    await execAsync(`echo '${attributes}' > ${tempFile}`);
    
    // Send Disconnect-Request to NAS
    // Note: CoA is sent TO the NAS, not to RADIUS server
    const coaPort = 3799; // Standard CoA port
    const command = `echo "${attributes}" | radclient -x ${nasIp}:${coaPort} disconnect ${secret}`;
    
    console.log(`Sending CoA Disconnect to ${nasIp}:${coaPort} for user ${username}`);
    
    const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
    
    // Clean up temp file
    await execAsync(`rm -f ${tempFile}`).catch(() => {});
    
    // Check if disconnect was successful
    if (stdout.includes('Disconnect-ACK') || stdout.includes('received')) {
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
        data: { username, nasIp, sessionId, output: stdout }
      };
    } else if (stdout.includes('Disconnect-NAK')) {
      return {
        success: false,
        message: 'Disconnect request was rejected by NAS',
        error: stdout
      };
    } else {
      // Even if radclient fails, update database
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
        message: 'Session marked as disconnected in database',
        data: { username, nasIp, sessionId, note: 'CoA packet may not have reached NAS' }
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
      return {
        success: true,
        message: 'No active sessions found for this user',
        data: { disconnected: 0 }
      };
    }
    
    // Disconnect each session
    const results = await Promise.all(
      sessions.map(session => 
        disconnectSession(
          username,
          session.nasipaddress,
          session.acctuniqueid,
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
  attributes: {
    downloadSpeed?: number;
    uploadSpeed?: number;
    sessionTimeout?: number;
  }
): Promise<CoAResponse> {
  try {
    const nas = await getNasByIp(nasIp);
    const secret = nas?.secret || 'radius_secret_2024';
    
    // Build CoA attributes
    let coaAttrs = `User-Name="${username}"\nAcct-Session-Id="${sessionId}"`;
    
    // Add rate limit if speeds are specified
    if (attributes.downloadSpeed && attributes.uploadSpeed) {
      // MikroTik rate limit format: rx/tx (download/upload in bits)
      const rateLimit = `${attributes.uploadSpeed}M/${attributes.downloadSpeed}M`;
      coaAttrs += `\nMikrotik-Rate-Limit="${rateLimit}"`;
    }
    
    if (attributes.sessionTimeout) {
      coaAttrs += `\nSession-Timeout=${attributes.sessionTimeout}`;
    }
    
    // Send CoA request
    const coaPort = 3799;
    const command = `echo "${coaAttrs}" | radclient -x ${nasIp}:${coaPort} coa ${secret}`;
    
    console.log(`Sending CoA Update to ${nasIp}:${coaPort} for user ${username}`);
    
    const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
    
    if (stdout.includes('CoA-ACK') || stdout.includes('received')) {
      return {
        success: true,
        message: `Session attributes updated for user ${username}`,
        data: { username, nasIp, sessionId, attributes, output: stdout }
      };
    } else {
      return {
        success: false,
        message: 'CoA request was rejected or failed',
        error: stdout || stderr
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
 * Check if CoA is supported/reachable on a NAS
 */
export async function testCoAConnection(nasIp: string): Promise<CoAResponse> {
  try {
    const nas = await getNasByIp(nasIp);
    const secret = nas?.secret || 'radius_secret_2024';
    
    // Send a simple status-server request to test connectivity
    const command = `echo "Message-Authenticator = 0x00" | radclient -x ${nasIp}:3799 status ${secret} 2>&1`;
    
    const { stdout, stderr } = await execAsync(command, { timeout: 5000 });
    
    return {
      success: true,
      message: 'CoA port is reachable',
      data: { nasIp, port: 3799, response: stdout }
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'CoA port is not reachable',
      error: error.message
    };
  }
}
