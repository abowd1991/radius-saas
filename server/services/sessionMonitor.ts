/**
 * Session Monitor Service
 * 
 * This service runs a periodic check (every 30 seconds) to:
 * 1. Find active sessions where user's internet time has expired (Max-All-Session)
 * 2. Find active sessions where user's card validity has expired (Expiration)
 * 3. Send CoA/Disconnect to MikroTik immediately
 * 4. Update radacct with termination cause
 * 5. Update card status in database (used/expired)
 * 
 * Time Logic:
 * - Max-All-Session: Total internet time allowed (e.g., 6 hours)
 *   - Calculated from radreply Max-All-Session attribute
 *   - Used time = SUM(acctsessiontime) from all sessions in radacct
 *   - If usedTime >= Max-All-Session → disconnect (time exhausted)
 * 
 * - Expiration: Card validity date (e.g., 12 hours from activation)
 *   - Stored in radcheck Expiration attribute
 *   - If current time >= Expiration → disconnect (card expired)
 * 
 * Example Scenario:
 * - Card with 6 hours internet time, 12 hours validity
 * - User can use 6 hours intermittently within 12 hours
 * - After 6 hours total usage → disconnect (even if validity remains)
 * - After 12 hours from activation → disconnect (even if time remains)
 */

import { getDb } from "../db";
import { radacct, radreply, radcheck, radiusCards, cardBatches, nasDevices } from "../../drizzle/schema";
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
  // Max-All-Session (total internet time)
  maxAllSession: number;        // Total allowed time in seconds
  totalUsedTime: number;        // Total used from all sessions
  currentSessionTime: number;   // Current active session time
  remainingInternetTime: number; // Remaining internet time
  // Expiration (card validity)
  expirationDate: Date | null;  // Card expiration date
  isExpired: boolean;           // Is card validity expired?
  // Disconnect decision
  shouldDisconnect: boolean;
  disconnectReason: 'time_exhausted' | 'card_expired' | 'none';
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
    
    return sessions.map((s: any) => ({
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
 * Get Max-All-Session from radreply (total internet time allowed)
 */
async function getMaxAllSession(username: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    const [result] = await db.select({ value: radreply.value })
      .from(radreply)
      .where(and(
        eq(radreply.username, username),
        eq(radreply.attribute, 'Max-All-Session')
      ))
      .limit(1);
    
    return result ? parseInt(result.value) || 0 : 0;
  } catch (error) {
    console.error(`[SessionMonitor] Error getting Max-All-Session for ${username}:`, error);
    return 0;
  }
}

/**
 * Get Expiration date from radcheck (card validity)
 */
async function getExpirationDate(username: string): Promise<Date | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const [result] = await db.select({ value: radcheck.value })
      .from(radcheck)
      .where(and(
        eq(radcheck.username, username),
        eq(radcheck.attribute, 'Expiration')
      ))
      .limit(1);
    
    if (!result?.value) return null;
    
    // Parse FreeRADIUS date format: "Jan 09 2026 12:00:00"
    const dateStr = result.value;
    
    // Check for far future date (card not activated yet or no expiration)
    if (dateStr.includes('2099')) return null;
    
    // Parse the date
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      // Try alternative parsing for "Jan 09 2026 12:00:00" format
      const months: { [key: string]: number } = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      const parts = dateStr.split(' ');
      if (parts.length >= 4) {
        const month = months[parts[0]];
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        const timeParts = parts[3]?.split(':') || ['0', '0', '0'];
        const hour = parseInt(timeParts[0]) || 0;
        const minute = parseInt(timeParts[1]) || 0;
        const second = parseInt(timeParts[2]) || 0;
        
        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          return new Date(year, month, day, hour, minute, second);
        }
      }
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error(`[SessionMonitor] Error getting Expiration for ${username}:`, error);
    return null;
  }
}

/**
 * Get total used time from ALL sessions in radacct (completed + current)
 */
async function getTotalUsedTime(username: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    // Get sum of all completed sessions
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
 * Update card status in database
 */
async function updateCardStatus(username: string, status: 'used' | 'expired'): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.update(radiusCards)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(radiusCards.username, username));
    
    console.log(`[SessionMonitor] Updated card ${username} status to ${status}`);
  } catch (error) {
    console.error(`[SessionMonitor] Error updating card status for ${username}:`, error);
  }
}

/**
 * Check if a session should be disconnected
 */
async function checkSession(session: ActiveSession): Promise<SessionCheckResult> {
  const maxAllSession = await getMaxAllSession(session.username);
  const expirationDate = await getExpirationDate(session.username);
  const totalUsedTime = await getTotalUsedTime(session.username);
  const currentSessionTime = calculateCurrentSessionTime(session.startTime, session.currentSessionTime);
  
  // Calculate remaining internet time
  const totalTimeUsed = totalUsedTime + currentSessionTime;
  const remainingInternetTime = maxAllSession > 0 ? maxAllSession - totalTimeUsed : Infinity;
  
  // Check if card validity expired
  const now = new Date();
  const isExpired = expirationDate !== null && now >= expirationDate;
  
  // Determine if should disconnect and why
  let shouldDisconnect = false;
  let disconnectReason: 'time_exhausted' | 'card_expired' | 'none' = 'none';
  
  // Priority 1: Check if internet time exhausted
  if (maxAllSession > 0 && remainingInternetTime <= 0) {
    shouldDisconnect = true;
    disconnectReason = 'time_exhausted';
  }
  // Priority 2: Check if card validity expired
  else if (isExpired) {
    shouldDisconnect = true;
    disconnectReason = 'card_expired';
  }
  
  return {
    username: session.username,
    maxAllSession,
    totalUsedTime,
    currentSessionTime,
    remainingInternetTime: Math.max(0, remainingInternetTime === Infinity ? -1 : remainingInternetTime),
    expirationDate,
    isExpired,
    shouldDisconnect,
    disconnectReason,
  };
}

/**
 * Send CoA Disconnect via remote API
 */
async function sendDisconnect(
  session: ActiveSession, 
  reason: 'time_exhausted' | 'card_expired'
): Promise<boolean> {
  try {
    const terminateCause = reason === 'time_exhausted' ? 'Session-Timeout' : 'User-Request';
    console.log(`[SessionMonitor] Sending disconnect for ${session.username} to ${session.nasIp} (reason: ${reason})`);
    
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
          acctterminatecause: terminateCause,
        })
        .where(eq(radacct.acctuniqueid, session.uniqueId));
    }
    
    // Update card status
    const cardStatus = reason === 'time_exhausted' ? 'used' : 'expired';
    await updateCardStatus(session.username, cardStatus);
    
    if (result.success) {
      console.log(`[SessionMonitor] Successfully disconnected ${session.username} (${reason})`);
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
      const terminateCause = reason === 'time_exhausted' ? 'Session-Timeout' : 'User-Request';
      await db.update(radacct)
        .set({
          acctstoptime: new Date(),
          acctterminatecause: terminateCause,
        })
        .where(eq(radacct.acctuniqueid, session.uniqueId));
      
      // Update card status
      const cardStatus = reason === 'time_exhausted' ? 'used' : 'expired';
      await updateCardStatus(session.username, cardStatus);
    }
    
    return true; // Count as success since we updated the database
  }
}

/**
 * Main check function - runs every 30 seconds
 */
async function runCheck(): Promise<{ 
  checked: number; 
  disconnected: number; 
  timeExhausted: number;
  cardExpired: number;
  errors: string[] 
}> {
  const errors: string[] = [];
  let disconnected = 0;
  let timeExhausted = 0;
  let cardExpired = 0;
  
  try {
    const sessions = await getActiveSessions();
    
    for (const session of sessions) {
      try {
        const result = await checkSession(session);
        
        if (result.shouldDisconnect && result.disconnectReason !== 'none') {
          const reasonText = result.disconnectReason === 'time_exhausted' 
            ? `Internet time exhausted: Max=${result.maxAllSession}s, Used=${result.totalUsedTime}s, Current=${result.currentSessionTime}s`
            : `Card validity expired: Expiration=${result.expirationDate?.toISOString()}`;
          
          console.log(`[SessionMonitor] User ${session.username} - ${reasonText}`);
          
          const success = await sendDisconnect(session, result.disconnectReason);
          if (success) {
            disconnected++;
            totalDisconnects++;
            
            if (result.disconnectReason === 'time_exhausted') {
              timeExhausted++;
            } else {
              cardExpired++;
            }
          }
        }
      } catch (error: any) {
        errors.push(`Error checking ${session.username}: ${error.message}`);
      }
    }
    
    lastCheckTime = new Date();
    totalChecks++;
    
    return { checked: sessions.length, disconnected, timeExhausted, cardExpired, errors };
  } catch (error: any) {
    console.error('[SessionMonitor] Error in runCheck:', error);
    return { checked: 0, disconnected: 0, timeExhausted: 0, cardExpired: 0, errors: [error.message] };
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
  console.log('[SessionMonitor] Monitoring: Max-All-Session (internet time) + Expiration (card validity)');
  isRunning = true;
  
  // Run immediately
  runCheck().then(result => {
    console.log(`[SessionMonitor] Initial check: ${result.checked} sessions, ${result.disconnected} disconnected ` +
      `(${result.timeExhausted} time exhausted, ${result.cardExpired} card expired)`);
  });
  
  // Then run periodically
  intervalId = setInterval(async () => {
    const result = await runCheck();
    if (result.disconnected > 0) {
      console.log(`[SessionMonitor] Check complete: ${result.checked} sessions, ${result.disconnected} disconnected ` +
        `(${result.timeExhausted} time exhausted, ${result.cardExpired} card expired)`);
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
export async function triggerCheck(): Promise<{ 
  checked: number; 
  disconnected: number; 
  timeExhausted: number;
  cardExpired: number;
  errors: string[] 
}> {
  return runCheck();
}

/**
 * Check a specific user's time status (for debugging/API)
 */
export async function checkUserTimeStatus(username: string): Promise<{
  maxAllSession: number;
  totalUsedTime: number;
  remainingInternetTime: number;
  expirationDate: Date | null;
  isExpired: boolean;
  canConnect: boolean;
} | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const maxAllSession = await getMaxAllSession(username);
    const expirationDate = await getExpirationDate(username);
    const totalUsedTime = await getTotalUsedTime(username);
    
    const remainingInternetTime = maxAllSession > 0 ? Math.max(0, maxAllSession - totalUsedTime) : -1;
    const now = new Date();
    const isExpired = expirationDate !== null && now >= expirationDate;
    
    // Can connect if:
    // 1. Has remaining internet time (or no limit)
    // 2. Card is not expired
    const canConnect = (remainingInternetTime > 0 || remainingInternetTime === -1) && !isExpired;
    
    return {
      maxAllSession,
      totalUsedTime,
      remainingInternetTime,
      expirationDate,
      isExpired,
      canConnect,
    };
  } catch (error) {
    console.error(`[SessionMonitor] Error checking user status for ${username}:`, error);
    return null;
  }
}
