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
  // New Time Budget System
  usageBudgetSeconds: number; // Total usage time allowed
  windowSeconds: number; // Validity window duration from first use
  // Used time from radacct (source of truth)
  usedTimeFromRadacct: number;
  // Current active session time
  currentSessionTime: number;
  // Calculated remaining usage time
  remainingUsageSeconds: number;
  // First use tracking
  firstUseAt: Date | null;
  windowEndTime: Date | null;
  windowRemainingSeconds: number;
  // Expiration status
  isUsageExpired: boolean; // usedTime >= usageBudgetSeconds
  isWindowExpired: boolean; // now > windowEndTime
  // Legacy compatibility
  allocatedTimeSeconds: number;
  remainingTimeSeconds: number;
  expiresAt: Date | null;
  isValidityExpired: boolean;
  // Decision
  shouldDisconnect: boolean;
  disconnectReason: 'time_exhausted' | 'window_expired' | 'validity_expired' | 'none';
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
 * Get time budget from card or batch (New Time Budget System)
 */
async function getTimeBudget(card: any): Promise<{
  usageBudgetSeconds: number;
  windowSeconds: number;
}> {
  // Priority 1: Card-level values
  if (card.usageBudgetSeconds && card.usageBudgetSeconds > 0) {
    return {
      usageBudgetSeconds: card.usageBudgetSeconds,
      windowSeconds: card.windowSeconds || 0,
    };
  }
  
  // Priority 2: Batch-level values
  if (!card.batchId) return { usageBudgetSeconds: 0, windowSeconds: 0 };
  
  const db = await getDb();
  if (!db) return { usageBudgetSeconds: 0, windowSeconds: 0 };
  
  try {
    const [batch] = await db.select()
      .from(cardBatches)
      .where(eq(cardBatches.batchId, card.batchId))
      .limit(1);
    
    if (!batch) return { usageBudgetSeconds: 0, windowSeconds: 0 };
    
    // Try new fields first
    let usageBudgetSeconds = batch.usageBudgetSeconds || 0;
    let windowSeconds = batch.windowSeconds || 0;
    
    // Fall back to legacy fields
    if (usageBudgetSeconds === 0 && batch.internetTimeValue) {
      const timeUnit = batch.internetTimeUnit || 'hours';
      if (timeUnit === 'hours') {
        usageBudgetSeconds = batch.internetTimeValue * 3600;
      } else if (timeUnit === 'days') {
        usageBudgetSeconds = batch.internetTimeValue * 86400;
      }
    }
    
    if (windowSeconds === 0 && batch.cardTimeValue) {
      const timeUnit = batch.cardTimeUnit || 'hours';
      if (timeUnit === 'hours') {
        windowSeconds = batch.cardTimeValue * 3600;
      } else if (timeUnit === 'days') {
        windowSeconds = batch.cardTimeValue * 86400;
      }
    }
    
    return { usageBudgetSeconds, windowSeconds };
  } catch (error) {
    console.error(`[CentralAccounting] Error getting time budget for batch ${card.batchId}:`, error);
    return { usageBudgetSeconds: 0, windowSeconds: 0 };
  }
}

/**
 * Record first use of a card (sets firstUseAt and windowEndTime)
 */
async function recordFirstUseIfNeeded(card: any, acctstarttime: Date | null): Promise<{
  firstUseAt: Date | null;
  windowEndTime: Date | null;
}> {
  const db = await getDb();
  if (!db) return { firstUseAt: card.firstUseAt, windowEndTime: card.windowEndTime };
  
  // Already recorded
  if (card.firstUseAt) {
    return { firstUseAt: card.firstUseAt, windowEndTime: card.windowEndTime };
  }
  
  // Get window seconds
  const { windowSeconds } = await getTimeBudget(card);
  
  // Use acctstarttime from radacct as firstUseAt
  const firstUseAt = acctstarttime || new Date();
  const windowEndTime = windowSeconds > 0 
    ? new Date(firstUseAt.getTime() + windowSeconds * 1000)
    : null;
  
  try {
    await db.update(radiusCards)
      .set({
        firstUseAt,
        windowEndTime,
        status: card.status === 'unused' ? 'active' : card.status,
        activatedAt: card.activatedAt || firstUseAt,
        updatedAt: new Date(),
      })
      .where(eq(radiusCards.id, card.id));
    
    console.log(`[CentralAccounting] Recorded first use for ${card.username}: firstUseAt=${firstUseAt.toISOString()}, windowEndTime=${windowEndTime?.toISOString() || 'none'}`);
    
    return { firstUseAt, windowEndTime };
  } catch (error) {
    console.error(`[CentralAccounting] Error recording first use for ${card.username}:`, error);
    return { firstUseAt: card.firstUseAt, windowEndTime: card.windowEndTime };
  }
}

/**
 * Get allocated time from card batch (Legacy compatibility)
 */
async function getAllocatedTime(batchId: string | null): Promise<number> {
  if (!batchId) return 0;
  
  const db = await getDb();
  if (!db) return 0;
  
  try {
    const [batch] = await db.select({
      timeValue: cardBatches.internetTimeValue,
      timeUnit: cardBatches.internetTimeUnit,
      usageBudgetSeconds: cardBatches.usageBudgetSeconds,
    })
    .from(cardBatches)
    .where(eq(cardBatches.batchId, batchId))
    .limit(1);
    
    if (!batch) return 0;
    
    // Try new field first
    if (batch.usageBudgetSeconds && batch.usageBudgetSeconds > 0) {
      return batch.usageBudgetSeconds;
    }
    
    // Fall back to legacy
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
 * Calculate card time info with all relevant data (New Time Budget System)
 */
async function calculateCardTimeInfo(username: string, acctstarttime?: Date | null): Promise<CardTimeInfo | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Get card info
    const [card] = await db.select()
      .from(radiusCards)
      .where(eq(radiusCards.username, username))
      .limit(1);
    
    if (!card) return null;
    
    // Get time budget (new system)
    const { usageBudgetSeconds, windowSeconds } = await getTimeBudget(card);
    
    // Record first use if needed (A: عند أول Accounting Start)
    const { firstUseAt, windowEndTime } = await recordFirstUseIfNeeded(card, acctstarttime || null);
    
    // Get used time from radacct (SOURCE OF TRUTH) (B: حساب الوقت المستهلك)
    const usageInfo = await getUsedTimeFromRadacct(username);
    
    // Calculate remaining usage time
    const remainingUsageSeconds = usageBudgetSeconds > 0 
      ? Math.max(0, usageBudgetSeconds - usageInfo.totalUsedTime)
      : -1; // -1 means unlimited
    
    // Calculate window remaining time
    const now = new Date();
    let windowRemainingSeconds = 0;
    if (windowEndTime) {
      windowRemainingSeconds = Math.max(0, Math.floor((windowEndTime.getTime() - now.getTime()) / 1000));
    } else if (windowSeconds > 0 && !firstUseAt) {
      // Window hasn't started yet
      windowRemainingSeconds = windowSeconds;
    }
    
    // Check expiration conditions (شروط انتهاء الكرت)
    const isUsageExpired = usageBudgetSeconds > 0 && usageInfo.totalUsedTime >= usageBudgetSeconds;
    const isWindowExpired = windowEndTime !== null && now >= windowEndTime;
    const isValidityExpired = card.expiresAt !== null && now >= card.expiresAt;
    
    // Determine if should disconnect and why
    let shouldDisconnect = false;
    let disconnectReason: 'time_exhausted' | 'window_expired' | 'validity_expired' | 'none' = 'none';
    
    // Priority 1: Usage time exhausted
    if (isUsageExpired) {
      shouldDisconnect = true;
      disconnectReason = 'time_exhausted';
    }
    // Priority 2: Window expired
    else if (isWindowExpired) {
      shouldDisconnect = true;
      disconnectReason = 'window_expired';
    }
    // Priority 3: Legacy validity expired
    else if (isValidityExpired) {
      shouldDisconnect = true;
      disconnectReason = 'validity_expired';
    }
    
    // Legacy compatibility
    const allocatedTimeSeconds = usageBudgetSeconds || await getAllocatedTime(card.batchId);
    const remainingTimeSeconds = remainingUsageSeconds;
    
    return {
      username,
      cardId: card.id,
      batchId: card.batchId,
      status: card.status,
      // New Time Budget System
      usageBudgetSeconds,
      windowSeconds,
      usedTimeFromRadacct: usageInfo.totalUsedTime,
      currentSessionTime: usageInfo.currentSessionTime,
      remainingUsageSeconds,
      firstUseAt,
      windowEndTime,
      windowRemainingSeconds,
      isUsageExpired,
      isWindowExpired,
      // Legacy compatibility
      allocatedTimeSeconds,
      remainingTimeSeconds,
      expiresAt: card.expiresAt,
      isValidityExpired,
      // Decision
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
async function updateCardStatus(username: string, reason: 'time_exhausted' | 'window_expired' | 'validity_expired'): Promise<void> {
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
        // Pass acctstarttime for first use recording
        const timeInfo = await calculateCardTimeInfo(session.username, session.startTime);
        if (!timeInfo) continue;
        
        // Sync card usage from radacct
        await syncCardUsageFromRadacct(session.username);
        synced++;
        
        // Update Session-Timeout in radreply (calculated output)
        // Use the minimum of remaining usage time and window remaining time
        let effectiveRemaining = timeInfo.remainingUsageSeconds;
        if (effectiveRemaining < 0) effectiveRemaining = timeInfo.windowRemainingSeconds; // unlimited usage
        else if (timeInfo.windowRemainingSeconds > 0) {
          effectiveRemaining = Math.min(effectiveRemaining, timeInfo.windowRemainingSeconds);
        }
        
        if (effectiveRemaining >= 0) {
          await updateSessionTimeout(session.username, effectiveRemaining);
        }
        
        // Check if should disconnect
        if (timeInfo.shouldDisconnect && timeInfo.disconnectReason !== 'none') {
          let reasonText = '';
          switch (timeInfo.disconnectReason) {
            case 'time_exhausted':
              reasonText = `Usage exhausted: Budget=${timeInfo.usageBudgetSeconds}s, Used=${timeInfo.usedTimeFromRadacct}s`;
              break;
            case 'window_expired':
              reasonText = `Window expired: WindowEnd=${timeInfo.windowEndTime?.toISOString()}`;
              break;
            case 'validity_expired':
              reasonText = `Validity expired: ExpiresAt=${timeInfo.expiresAt?.toISOString()}`;
              break;
          }
          
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


/**
 * Backfill firstUseAt for cards that have sessions but no firstUseAt recorded
 * This is a one-time migration for existing cards
 */
export async function backfillFirstUseAt(): Promise<{
  updated: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) return { updated: 0, errors: ['Database not available'] };
  
  const errors: string[] = [];
  let updated = 0;
  
  try {
    // Find cards with sessions but no firstUseAt
    const cardsWithoutFirstUse = await db.select({
      id: radiusCards.id,
      username: radiusCards.username,
      windowSeconds: radiusCards.windowSeconds,
      batchId: radiusCards.batchId,
    })
    .from(radiusCards)
    .where(isNull(radiusCards.firstUseAt));
    
    console.log(`[CentralAccounting] Found ${cardsWithoutFirstUse.length} cards without firstUseAt`);
    
    for (const card of cardsWithoutFirstUse) {
      try {
        // Get first session for this card
        const [firstSession] = await db.select({
          startTime: radacct.acctstarttime,
        })
        .from(radacct)
        .where(eq(radacct.username, card.username))
        .orderBy(radacct.acctstarttime)
        .limit(1);
        
        if (firstSession?.startTime) {
          // Get window seconds
          const { windowSeconds } = await getTimeBudget(card);
          
          const firstUseAt = firstSession.startTime;
          const windowEndTime = windowSeconds > 0 
            ? new Date(firstUseAt.getTime() + windowSeconds * 1000)
            : null;
          
          await db.update(radiusCards)
            .set({
              firstUseAt,
              windowEndTime,
              updatedAt: new Date(),
            })
            .where(eq(radiusCards.id, card.id));
          
          updated++;
          console.log(`[CentralAccounting] Backfilled firstUseAt for ${card.username}: ${firstUseAt.toISOString()}`);
        }
      } catch (error: any) {
        errors.push(`Error backfilling ${card.username}: ${error.message}`);
      }
    }
    
    return { updated, errors };
  } catch (error: any) {
    console.error('[CentralAccounting] Error in backfillFirstUseAt:', error);
    return { updated: 0, errors: [error.message] };
  }
}
