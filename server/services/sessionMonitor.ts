/**
 * Session Monitor Service
 * 
 * This service runs a periodic check (every 30 seconds) to:
 * 1. Find active sessions where user's time has expired
 * 2. Send CoA/Disconnect to MikroTik immediately
 * 3. Update radacct with termination cause
 * 
 * The time calculation is:
 * - Get original Session-Timeout from radreply
 * - Get total used time from radacct (completed sessions)
 * - Get current session time from radacct (active session)
 * - Remaining = Original - Used - Current
 * - If Remaining <= 0, disconnect immediately
 */

import { getDb } from "../db";
import { radacct, radreply, radiusCards, cardBatches, nasDevices } from "../../drizzle/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";

// Remote RADIUS API configuration
const RADIUS_API_URL = 'http://37.60.228.5:8080';
const RADIUS_API_KEY = 'radius_api_key_2024_secure';

interface ActiveSession {
  username: string;
  nasIp: string;
  sessionId: string;
  uniqueId: string;
  framedIp: string | null;
  currentSessionTime: number;
  startTime: Date | null;
}

interface SessionCheckResult {
  username: string;
  originalTime: number;
  usedTime: number;
  currentSessionTime: number;
  remainingTime: number;
  shouldDisconnect: boolean;
}

// Monitor state
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let lastCheckTime: Date | null = null;
let totalChecks = 0;
let totalDisconnects = 0;

/**
 * Get all active sessions from radacct
 */
async function getActiveSessions(): Promise<ActiveSession[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const sessions = await db.select({
      username: radacct.username,
      nasIp: radacct.nasipaddress,
      sessionId: radacct.acctsessionid,
      uniqueId: radacct.acctuniqueid,
      framedIp: radacct.framedipaddress,
      currentSessionTime: radacct.acctsessiontime,
      startTime: radacct.acctstarttime,
    })
    .from(radacct)
    .where(isNull(radacct.acctstoptime));
    
    return sessions.map(s => ({
      username: s.username,
      nasIp: s.nasIp,
      sessionId: s.sessionId || '',
      uniqueId: s.uniqueId || '',
      framedIp: s.framedIp,
      currentSessionTime: s.currentSessionTime || 0,
      startTime: s.startTime,
    }));
  } catch (error) {
    console.error('[SessionMonitor] Error getting active sessions:', error);
    return [];
  }
}

/**
 * Get original Session-Timeout from radreply
 */
async function getOriginalTimeout(username: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    const [result] = await db.select({ value: radreply.value })
      .from(radreply)
      .where(and(
        eq(radreply.username, username),
        eq(radreply.attribute, 'Session-Timeout')
      ))
      .limit(1);
    
    return result ? parseInt(result.value) || 0 : 0;
  } catch (error) {
    console.error(`[SessionMonitor] Error getting timeout for ${username}:`, error);
    return 0;
  }
}

/**
 * Get total used time from completed sessions in radacct
 */
async function getUsedTime(username: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    const [result] = await db.select({
      totalUsed: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`
    })
    .from(radacct)
    .where(and(
      eq(radacct.username, username),
      sql`${radacct.acctstoptime} IS NOT NULL`
    ));
    
    return result?.totalUsed || 0;
  } catch (error) {
    console.error(`[SessionMonitor] Error getting used time for ${username}:`, error);
    return 0;
  }
}

/**
 * Calculate current session time (time since session started)
 * This is more accurate than relying on acctsessiontime which may not be updated
 */
function calculateCurrentSessionTime(startTime: Date | null, reportedTime: number): number {
  if (!startTime) return reportedTime;
  
  const now = new Date();
  const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
  
  // Use the larger value (reported or calculated) for safety
  return Math.max(elapsed, reportedTime);
}

/**
 * Check if a session should be disconnected
 */
async function checkSession(session: ActiveSession): Promise<SessionCheckResult> {
  const originalTime = await getOriginalTimeout(session.username);
  const usedTime = await getUsedTime(session.username);
  const currentSessionTime = calculateCurrentSessionTime(session.startTime, session.currentSessionTime);
  
  // Remaining = Original - (Used from completed sessions) - (Current session time)
  const remainingTime = originalTime - usedTime - currentSessionTime;
  
  return {
    username: session.username,
    originalTime,
    usedTime,
    currentSessionTime,
    remainingTime,
    shouldDisconnect: remainingTime <= 0 && originalTime > 0,
  };
}

/**
 * Send CoA Disconnect via remote API
 */
async function sendDisconnect(session: ActiveSession): Promise<boolean> {
  try {
    console.log(`[SessionMonitor] Sending disconnect for ${session.username} to ${session.nasIp}`);
    
    // Get NAS secret
    const db = await getDb();
    let secret = 'radius_secret_2024';
    
    if (db) {
      const [nas] = await db.select({ secret: nasDevices.secret })
        .from(nasDevices)
        .where(eq(nasDevices.nasname, session.nasIp))
        .limit(1);
      
      if (nas?.secret) {
        secret = nas.secret;
      }
    }
    
    // Send disconnect via remote API
    const response = await fetch(`${RADIUS_API_URL}/api/radius/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': RADIUS_API_KEY,
      },
      body: JSON.stringify({
        username: session.username,
        nas_ip: session.nasIp,
        secret,
        session_id: session.sessionId,
        framed_ip: session.framedIp,
      }),
    });
    
    const result = await response.json();
    
    // Update radacct regardless of CoA result
    if (db) {
      await db.update(radacct)
        .set({
          acctstoptime: new Date(),
          acctterminatecause: 'Session-Timeout',
        })
        .where(eq(radacct.acctuniqueid, session.uniqueId));
    }
    
    if (result.success) {
      console.log(`[SessionMonitor] Successfully disconnected ${session.username}`);
      return true;
    } else {
      console.log(`[SessionMonitor] CoA failed for ${session.username}, but session marked as stopped`);
      return true; // Still count as success since we updated the database
    }
  } catch (error) {
    console.error(`[SessionMonitor] Error disconnecting ${session.username}:`, error);
    
    // Still try to update database
    const db = await getDb();
    if (db) {
      await db.update(radacct)
        .set({
          acctstoptime: new Date(),
          acctterminatecause: 'Session-Timeout',
        })
        .where(eq(radacct.acctuniqueid, session.uniqueId));
    }
    
    return true; // Count as success since we updated the database
  }
}

/**
 * Main check function - runs every 30 seconds
 */
async function runCheck(): Promise<{ checked: number; disconnected: number; errors: string[] }> {
  const errors: string[] = [];
  let disconnected = 0;
  
  try {
    const sessions = await getActiveSessions();
    
    for (const session of sessions) {
      try {
        const result = await checkSession(session);
        
        if (result.shouldDisconnect) {
          console.log(`[SessionMonitor] User ${session.username} time expired: ` +
            `Original=${result.originalTime}s, Used=${result.usedTime}s, ` +
            `Current=${result.currentSessionTime}s, Remaining=${result.remainingTime}s`);
          
          const success = await sendDisconnect(session);
          if (success) {
            disconnected++;
            totalDisconnects++;
          }
        }
      } catch (error: any) {
        errors.push(`Error checking ${session.username}: ${error.message}`);
      }
    }
    
    lastCheckTime = new Date();
    totalChecks++;
    
    return { checked: sessions.length, disconnected, errors };
  } catch (error: any) {
    console.error('[SessionMonitor] Error in runCheck:', error);
    return { checked: 0, disconnected: 0, errors: [error.message] };
  }
}

/**
 * Start the session monitor
 */
export function startMonitor(intervalMs: number = 30000): void {
  if (isRunning) {
    console.log('[SessionMonitor] Already running');
    return;
  }
  
  console.log(`[SessionMonitor] Starting with interval ${intervalMs}ms`);
  isRunning = true;
  
  // Run immediately
  runCheck().then(result => {
    console.log(`[SessionMonitor] Initial check: ${result.checked} sessions, ${result.disconnected} disconnected`);
  });
  
  // Then run periodically
  intervalId = setInterval(async () => {
    const result = await runCheck();
    if (result.disconnected > 0) {
      console.log(`[SessionMonitor] Check complete: ${result.checked} sessions, ${result.disconnected} disconnected`);
    }
  }, intervalMs);
}

/**
 * Stop the session monitor
 */
export function stopMonitor(): void {
  if (!isRunning) {
    console.log('[SessionMonitor] Not running');
    return;
  }
  
  console.log('[SessionMonitor] Stopping');
  isRunning = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Get monitor status
 */
export function getMonitorStatus(): {
  isRunning: boolean;
  lastCheckTime: Date | null;
  totalChecks: number;
  totalDisconnects: number;
} {
  return {
    isRunning,
    lastCheckTime,
    totalChecks,
    totalDisconnects,
  };
}

/**
 * Manually trigger a check
 */
export async function triggerCheck(): Promise<{ checked: number; disconnected: number; errors: string[] }> {
  return runCheck();
}
