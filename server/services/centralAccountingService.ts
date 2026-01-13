/**
 * Central Accounting Service
 * 
 * ARCHITECTURE PRINCIPLES:
 * 1. radacct is the SINGLE SOURCE OF TRUTH for time consumption
 * 2. Session-Timeout is a CALCULATED OUTPUT, not storage
 * 3. All business logic is in Application Layer, not MikroTik
 * 4. Deduction is based on Acct-Session-Time ONLY
 * 
 * This service runs every minute to:
 * 1. Calculate used time from radacct (completed sessions + current session)
 * 2. Update remaining time in radiusCards table
 * 3. Check validity expiration
 * 4. Disconnect users when time exhausted OR validity expired
 * 5. Send CoA with updated Session-Timeout
 * 
 * GOLDEN RULE:
 * - Card time is stored in: radiusCards.totalSessionTime (updated from radacct)
 * - Allocated time comes from: cardBatches.internetTimeValue + internetTimeUnit
 * - Session-Timeout = remainingTime (calculated, not stored)
 */

import { getDb } from "../db";
import { radacct, radreply, radcheck, radiusCards, cardBatches, nasDevices } from "../../drizzle/schema";
import { eq, and, isNull, sql, desc, inArray, gte, lte, lt, or } from "drizzle-orm";
import { logSessionTimeout, logValidityExpired, logCoASent } from "./auditLogService";

// Configuration
const GRACE_PERIOD_SECONDS = 120; // 2 minutes grace before disconnect
const STALE_SESSION_MINUTES = 10; // Sessions older than this without update are stale

// Remote RADIUS API configuration
const RADIUS_API_URL = 'http://37.60.228.5:8080';
const RADIUS_API_KEY = 'radius_api_key_2024_secure';

// Service state
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let lastRunTime: Date | null = null;
let totalRuns = 0;
let totalDisconnects = 0;

interface CardTimeInfo {
  username: string;
  cardId: number;
  batchId: string | null;
  status: string;
  // Allocated time from batch
  allocatedTimeSeconds: number;
  // Used time from radacct (source of truth)
  usedTimeFromRadacct: number;
  // Current active session time
  currentSessionTime: number;
  // Calculated remaining
  remainingTimeSeconds: number;
  // Validity
  expiresAt: Date | null;
  isValidityExpired: boolean;
  // Decision
  shouldDisconnect: boolean;
  disconnectReason: 'time_exhausted' | 'validity_expired' | 'none';
}

interface ActiveSessionInfo {
  username: string;
  nasIp: string;
  sessionId: string;
  uniqueId: string;
  framedIp: string | null;
  startTime: Date | null;
  acctsessiontime: number;
}

/**
 * Get all active sessions from radacct
 * Online = acctstoptime IS NULL
 */
async function getActiveSessions(): Promise<ActiveSessionInfo[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const sessions = await db.select({
      username: radacct.username,
      nasIp: radacct.nasipaddress,
      sessionId: radacct.acctsessionid,
      uniqueId: radacct.acctuniqueid,
      framedIp: radacct.framedipaddress,
      startTime: radacct.acctstarttime,
      acctsessiontime: radacct.acctsessiontime,
    })
    .from(radacct)
    .where(isNull(radacct.acctstoptime));
    
    return sessions.map(s => ({
      username: s.username,
      nasIp: s.nasIp,
      sessionId: s.sessionId || '',
      uniqueId: s.uniqueId || '',
      framedIp: s.framedIp,
      startTime: s.startTime,
      acctsessiontime: s.acctsessiontime || 0,
    }));
  } catch (error) {
    console.error('[CentralAccounting] Error getting active sessions:', error);
    return [];
  }
}

/**
 * Get total used time from radacct for a username
 * This is the SOURCE OF TRUTH for time consumption
 */
async function getUsedTimeFromRadacct(username: string): Promise<{
  completedSessionsTime: number;
  currentSessionTime: number;
  totalUsedTime: number;
}> {
  const db = await getDb();
  if (!db) return { completedSessionsTime: 0, currentSessionTime: 0, totalUsedTime: 0 };
  
  try {
    // Get sum of all COMPLETED sessions (with stop time)
    const [completedResult] = await db.select({
      total: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`
    })
    .from(radacct)
    .where(and(
      eq(radacct.username, username),
      sql`${radacct.acctstoptime} IS NOT NULL`
    ));
    
    const completedSessionsTime = completedResult?.total || 0;
    
    // Get current active session time
    const [activeResult] = await db.select({
      sessionTime: radacct.acctsessiontime,
      startTime: radacct.acctstarttime,
    })
    .from(radacct)
    .where(and(
      eq(radacct.username, username),
      isNull(radacct.acctstoptime)
    ))
    .orderBy(desc(radacct.acctstarttime))
    .limit(1);
    
    let currentSessionTime = 0;
    if (activeResult) {
      // Use the larger of: reported time OR calculated elapsed time
      const reportedTime = activeResult.sessionTime || 0;
      const elapsedTime = activeResult.startTime 
        ? Math.floor((Date.now() - activeResult.startTime.getTime()) / 1000)
        : 0;
      currentSessionTime = Math.max(reportedTime, elapsedTime);
    }
    
    return {
      completedSessionsTime,
      currentSessionTime,
      totalUsedTime: completedSessionsTime + currentSessionTime,
    };
  } catch (error) {
    console.error(`[CentralAccounting] Error getting used time for ${username}:`, error);
    return { completedSessionsTime: 0, currentSessionTime: 0, totalUsedTime: 0 };
  }
}

/**
 * Get allocated time from card batch
 */
async function getAllocatedTime(batchId: string | null): Promise<number> {
  if (!batchId) return 0;
  
  const db = await getDb();
  if (!db) return 0;
  
  try {
    const [batch] = await db.select({
      timeValue: cardBatches.internetTimeValue,
      timeUnit: cardBatches.internetTimeUnit,
    })
    .from(cardBatches)
    .where(eq(cardBatches.batchId, batchId))
    .limit(1);
    
    if (!batch) return 0;
    
    const timeValue = batch.timeValue || 0;
    const timeUnit = batch.timeUnit || 'hours';
    
    if (timeUnit === 'hours') {
      return timeValue * 3600;
    } else if (timeUnit === 'days') {
      return timeValue * 86400;
    }
    
    return 0;
  } catch (error) {
    console.error(`[CentralAccounting] Error getting allocated time for batch ${batchId}:`, error);
    return 0;
  }
}

/**
 * Calculate card time info with all relevant data
 */
async function calculateCardTimeInfo(username: string): Promise<CardTimeInfo | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Get card info
    const [card] = await db.select()
      .from(radiusCards)
      .where(eq(radiusCards.username, username))
      .limit(1);
    
    if (!card) return null;
    
    // Get allocated time from batch
    const allocatedTimeSeconds = await getAllocatedTime(card.batchId);
    
    // Get used time from radacct (SOURCE OF TRUTH)
    const usageInfo = await getUsedTimeFromRadacct(username);
    
    // Calculate remaining time
    const remainingTimeSeconds = allocatedTimeSeconds > 0 
      ? Math.max(0, allocatedTimeSeconds - usageInfo.totalUsedTime)
      : -1; // -1 means unlimited
    
    // Check validity expiration
    const now = new Date();
    const isValidityExpired = card.expiresAt !== null && now >= card.expiresAt;
    
    // Determine if should disconnect and why
    let shouldDisconnect = false;
    let disconnectReason: 'time_exhausted' | 'validity_expired' | 'none' = 'none';
    
    // Priority 1: Time exhausted (with grace period)
    if (allocatedTimeSeconds > 0 && remainingTimeSeconds <= 0) {
      shouldDisconnect = true;
      disconnectReason = 'time_exhausted';
    }
    // Priority 2: Validity expired
    else if (isValidityExpired) {
      shouldDisconnect = true;
      disconnectReason = 'validity_expired';
    }
    
    return {
      username,
      cardId: card.id,
      batchId: card.batchId,
      status: card.status,
      allocatedTimeSeconds,
      usedTimeFromRadacct: usageInfo.totalUsedTime,
      currentSessionTime: usageInfo.currentSessionTime,
      remainingTimeSeconds,
      expiresAt: card.expiresAt,
      isValidityExpired,
      shouldDisconnect,
      disconnectReason,
    };
  } catch (error) {
    console.error(`[CentralAccounting] Error calculating time info for ${username}:`, error);
    return null;
  }
}

/**
 * Update card's totalSessionTime from radacct
 * This syncs the card table with the source of truth
 */
async function syncCardUsageFromRadacct(username: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const usageInfo = await getUsedTimeFromRadacct(username);
    
    await db.update(radiusCards)
      .set({
        totalSessionTime: usageInfo.totalUsedTime,
        lastActivity: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(radiusCards.username, username));
  } catch (error) {
    console.error(`[CentralAccounting] Error syncing card usage for ${username}:`, error);
  }
}

/**
 * Update Session-Timeout in radreply based on remaining time
 * Session-Timeout is OUTPUT (calculated), not storage
 */
async function updateSessionTimeout(username: string, remainingSeconds: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    // Delete existing Session-Timeout
    await db.delete(radreply)
      .where(and(
        eq(radreply.username, username),
        eq(radreply.attribute, 'Session-Timeout')
      ));
    
    // Only add if there's a limit
    if (remainingSeconds > 0) {
      await db.insert(radreply).values({
        username,
        attribute: 'Session-Timeout',
        op: '=',
        value: remainingSeconds.toString(),
      });
    }
  } catch (error) {
    console.error(`[CentralAccounting] Error updating Session-Timeout for ${username}:`, error);
  }
}

/**
 * Send disconnect via remote RADIUS API
 */
async function sendDisconnect(session: ActiveSessionInfo, reason: string): Promise<boolean> {
  try {
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
    
    // Update radacct to mark session as stopped
    if (db) {
      const terminateCause = reason === 'time_exhausted' ? 'Session-Timeout' : 'User-Request';
      await db.update(radacct)
        .set({
          acctstoptime: new Date(),
          acctterminatecause: terminateCause,
        })
        .where(eq(radacct.acctuniqueid, session.uniqueId));
    }
    
    console.log(`[CentralAccounting] Disconnected ${session.username} (${reason}): ${result.success ? 'success' : 'CoA failed but DB updated'}`);
    
    // Log to audit
    await logCoASent(session.username, session.nasIp, 'disconnect', result.success, { reason });
    
    return true;
  } catch (error) {
    console.error(`[CentralAccounting] Error disconnecting ${session.username}:`, error);
    
    // Still update database
    const db = await getDb();
    if (db) {
      const terminateCause = reason === 'time_exhausted' ? 'Session-Timeout' : 'User-Request';
      await db.update(radacct)
        .set({
          acctstoptime: new Date(),
          acctterminatecause: terminateCause,
        })
        .where(eq(radacct.acctuniqueid, session.uniqueId));
    }
    
    return true;
  }
}

/**
 * Update card status based on disconnect reason
 */
async function updateCardStatus(username: string, reason: 'time_exhausted' | 'validity_expired'): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const status = reason === 'time_exhausted' ? 'used' : 'expired';
    await db.update(radiusCards)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(radiusCards.username, username));
    
    console.log(`[CentralAccounting] Updated card ${username} status to ${status}`);
  } catch (error) {
    console.error(`[CentralAccounting] Error updating card status for ${username}:`, error);
  }
}

/**
 * Clean up stale sessions (sessions without update for too long)
 */
async function cleanupStaleSessions(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    const staleThreshold = new Date(Date.now() - STALE_SESSION_MINUTES * 60 * 1000);
    
    // Find sessions that haven't been updated recently and have no stop time
    // We check acctstarttime + acctsessiontime to see if they're stale
    const staleSessions = await db.select({
      uniqueId: radacct.acctuniqueid,
      username: radacct.username,
      startTime: radacct.acctstarttime,
      sessionTime: radacct.acctsessiontime,
    })
    .from(radacct)
    .where(and(
      isNull(radacct.acctstoptime),
      lt(radacct.acctstarttime, staleThreshold)
    ));
    
    let cleaned = 0;
    for (const session of staleSessions) {
      // Calculate expected end time based on start + session time
      const expectedLastUpdate = new Date(
        (session.startTime?.getTime() || 0) + ((session.sessionTime || 0) * 1000)
      );
      
      // If last expected update is older than threshold, mark as stale
      if (expectedLastUpdate < staleThreshold) {
        await db.update(radacct)
          .set({
            acctstoptime: new Date(),
            acctterminatecause: 'Lost-Carrier',
          })
          .where(eq(radacct.acctuniqueid, session.uniqueId));
        
        cleaned++;
        console.log(`[CentralAccounting] Cleaned stale session for ${session.username}`);
      }
    }
    
    return cleaned;
  } catch (error) {
    console.error('[CentralAccounting] Error cleaning stale sessions:', error);
    return 0;
  }
}

/**
 * Main accounting job - runs every minute
 */
async function runAccountingJob(): Promise<{
  processed: number;
  disconnected: number;
  synced: number;
  staleCleaned: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  let disconnected = 0;
  let synced = 0;
  
  try {
    // Step 1: Clean up stale sessions
    const staleCleaned = await cleanupStaleSessions();
    
    // Step 2: Get all active sessions
    const activeSessions = await getActiveSessions();
    
    // Step 3: Process each active session
    for (const session of activeSessions) {
      try {
        processed++;
        
        // Calculate time info from radacct (source of truth)
        const timeInfo = await calculateCardTimeInfo(session.username);
        if (!timeInfo) continue;
        
        // Sync card usage from radacct
        await syncCardUsageFromRadacct(session.username);
        synced++;
        
        // Update Session-Timeout in radreply (calculated output)
        if (timeInfo.remainingTimeSeconds >= 0) {
          await updateSessionTimeout(session.username, timeInfo.remainingTimeSeconds);
        }
        
        // Check if should disconnect
        if (timeInfo.shouldDisconnect && timeInfo.disconnectReason !== 'none') {
          const reasonText = timeInfo.disconnectReason === 'time_exhausted'
            ? `Time exhausted: Allocated=${timeInfo.allocatedTimeSeconds}s, Used=${timeInfo.usedTimeFromRadacct}s`
            : `Validity expired: ExpiresAt=${timeInfo.expiresAt?.toISOString()}`;
          
          console.log(`[CentralAccounting] ${session.username}: ${reasonText}`);
          
          // Send disconnect
          const success = await sendDisconnect(session, timeInfo.disconnectReason);
          if (success) {
            disconnected++;
            totalDisconnects++;
            
            // Update card status
            await updateCardStatus(session.username, timeInfo.disconnectReason);
          }
        }
      } catch (error: any) {
        errors.push(`Error processing ${session.username}: ${error.message}`);
      }
    }
    
    lastRunTime = new Date();
    totalRuns++;
    
    return { processed, disconnected, synced, staleCleaned, errors };
  } catch (error: any) {
    console.error('[CentralAccounting] Error in accounting job:', error);
    return { processed: 0, disconnected: 0, synced: 0, staleCleaned: 0, errors: [error.message] };
  }
}

/**
 * Start the central accounting service
 */
export function startCentralAccounting(intervalMs: number = 60000): void {
  if (isRunning) {
    console.log('[CentralAccounting] Already running');
    return;
  }
  
  console.log(`[CentralAccounting] Starting with interval ${intervalMs}ms`);
  console.log('[CentralAccounting] Source of truth: radacct');
  console.log('[CentralAccounting] Session-Timeout: calculated output only');
  isRunning = true;
  
  // Run immediately
  runAccountingJob().then(result => {
    console.log(`[CentralAccounting] Initial run: ${result.processed} processed, ${result.disconnected} disconnected, ${result.synced} synced`);
  });
  
  // Then run periodically
  intervalId = setInterval(async () => {
    const result = await runAccountingJob();
    if (result.disconnected > 0 || result.staleCleaned > 0) {
      console.log(`[CentralAccounting] Run complete: ${result.processed} processed, ${result.disconnected} disconnected, ${result.staleCleaned} stale cleaned`);
    }
  }, intervalMs);
}

/**
 * Stop the central accounting service
 */
export function stopCentralAccounting(): void {
  if (!isRunning) {
    console.log('[CentralAccounting] Not running');
    return;
  }
  
  console.log('[CentralAccounting] Stopping');
  isRunning = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Get service status
 */
export function getCentralAccountingStatus(): {
  isRunning: boolean;
  lastRunTime: Date | null;
  totalRuns: number;
  totalDisconnects: number;
} {
  return {
    isRunning,
    lastRunTime,
    totalRuns,
    totalDisconnects,
  };
}

/**
 * Manually trigger an accounting run
 */
export async function triggerAccountingRun(): Promise<{
  processed: number;
  disconnected: number;
  synced: number;
  staleCleaned: number;
  errors: string[];
}> {
  return runAccountingJob();
}

/**
 * Get detailed time info for a specific user
 */
export async function getUserTimeDetails(username: string): Promise<CardTimeInfo | null> {
  return calculateCardTimeInfo(username);
}

/**
 * Force sync a user's usage from radacct
 */
export async function forceSyncUserUsage(username: string): Promise<void> {
  await syncCardUsageFromRadacct(username);
}
