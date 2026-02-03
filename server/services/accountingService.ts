/**
 * Accounting Service
 * 
 * This service handles RADIUS accounting data processing:
 * - Calculate used time from radacct (including active sessions)
 * - Track remaining usage time (Usage Budget)
 * - Track validity window (starts from first use)
 * - Auto-disconnect when time expires or window ends
 * 
 * Time Budget Model:
 * - usageBudgetSeconds: Total usage time allowed (deducted only while connected)
 * - windowSeconds: Validity window duration from first use
 * - firstUseAt: When card was first used (triggers window start)
 * - windowEndTime: When the validity window expires (firstUseAt + windowSeconds)
 * 
 * Card expires when EITHER:
 * 1. used_seconds >= usageBudgetSeconds (usage exhausted)
 * 2. now > windowEndTime (validity window expired)
 */

import { getDb } from "../db";
import { radacct, radcheck, radreply, radiusCards, cardBatches } from "../../drizzle/schema";
import { eq, and, isNull, sql, sum, desc, or } from "drizzle-orm";
import * as coaService from "./coaService";
import * as vpnApi from "./vpnApiService";

// Palestine timezone
const PALESTINE_TZ = 'Asia/Hebron';

interface UsageStats {
  username: string;
  totalSessionTime: number; // in seconds (closed sessions)
  activeSessionTime: number; // in seconds (current open session)
  totalUsedTime: number; // totalSessionTime + activeSessionTime
  totalInputOctets: number;
  totalOutputOctets: number;
  sessionCount: number;
  hasActiveSession: boolean;
  lastSession?: {
    startTime: Date | null;
    stopTime: Date | null;
    sessionTime: number;
    nasIp: string;
  };
}

interface TimeBalance {
  username: string;
  usageBudgetSeconds: number; // Total allowed usage time
  windowSeconds: number; // Validity window duration
  usedTime: number; // Total used time (closed + active sessions)
  remainingUsageTime: number; // usageBudgetSeconds - usedTime
  firstUseAt: Date | null; // When card was first used
  windowEndTime: Date | null; // When validity window expires
  windowRemainingSeconds: number; // Time until window expires
  isUsageExpired: boolean; // usedTime >= usageBudgetSeconds
  isWindowExpired: boolean; // now > windowEndTime
  isExpired: boolean; // isUsageExpired OR isWindowExpired
  expirationReason?: 'usage' | 'window' | 'both';
}

/**
 * Get current time in Palestine timezone
 */
function getPalestineTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: PALESTINE_TZ }));
}

/**
 * Get usage statistics for a username from radacct
 * Includes both closed sessions and active (open) sessions
 */
export async function getUserUsageStats(username: string): Promise<UsageStats | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Get aggregated stats for CLOSED sessions (acctstoptime IS NOT NULL)
    const closedStats = await db.select({
      totalSessionTime: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`,
      totalInputOctets: sql<number>`COALESCE(SUM(${radacct.acctinputoctets}), 0)`,
      totalOutputOctets: sql<number>`COALESCE(SUM(${radacct.acctoutputoctets}), 0)`,
      sessionCount: sql<number>`COUNT(*)`,
    })
    .from(radacct)
    .where(and(
      eq(radacct.username, username),
      sql`${radacct.acctstoptime} IS NOT NULL`
    ));
    
    // Get ACTIVE session (acctstoptime IS NULL)
    const activeSession = await db.select({
      startTime: radacct.acctstarttime,
      sessionTime: radacct.acctsessiontime,
      nasIp: radacct.nasipaddress,
    })
    .from(radacct)
    .where(and(
      eq(radacct.username, username),
      isNull(radacct.acctstoptime)
    ))
    .limit(1);
    
    // Calculate active session time (from start until now)
    let activeSessionTime = 0;
    const hasActiveSession = activeSession.length > 0;
    if (hasActiveSession && activeSession[0].startTime) {
      const now = new Date();
      const startTime = new Date(activeSession[0].startTime);
      activeSessionTime = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      // Use the greater of calculated time or reported time
      activeSessionTime = Math.max(activeSessionTime, activeSession[0].sessionTime || 0);
    }
    
    // Get last session (for display purposes)
    const lastSession = await db.select({
      startTime: radacct.acctstarttime,
      stopTime: radacct.acctstoptime,
      sessionTime: radacct.acctsessiontime,
      nasIp: radacct.nasipaddress,
    })
    .from(radacct)
    .where(eq(radacct.username, username))
    .orderBy(desc(radacct.acctstarttime))
    .limit(1);
    
    const totalSessionTime = closedStats[0]?.totalSessionTime || 0;
    
    return {
      username,
      totalSessionTime,
      activeSessionTime,
      totalUsedTime: totalSessionTime + activeSessionTime,
      totalInputOctets: closedStats[0]?.totalInputOctets || 0,
      totalOutputOctets: closedStats[0]?.totalOutputOctets || 0,
      sessionCount: closedStats[0]?.sessionCount || 0,
      hasActiveSession,
      lastSession: lastSession[0] ? {
        startTime: lastSession[0].startTime,
        stopTime: lastSession[0].stopTime,
        sessionTime: lastSession[0].sessionTime || 0,
        nasIp: lastSession[0].nasIp,
      } : undefined,
    };
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return null;
  }
}

/**
 * Get time balance for a card/username using the new Time Budget System
 */
export async function getTimeBalance(username: string): Promise<TimeBalance | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Get the card/voucher
    const [card] = await db.select()
      .from(radiusCards)
      .where(eq(radiusCards.username, username))
      .limit(1);
    
    if (!card) return null;
    
    // Get usage budget and window from card first, then fall back to batch
    let usageBudgetSeconds = card.usageBudgetSeconds || 0;
    let windowSeconds = card.windowSeconds || 0;
    
    // If card doesn't have values, get from batch (backward compatibility)
    if (usageBudgetSeconds === 0 && windowSeconds === 0 && card.batchId) {
      const [batch] = await db.select()
        .from(cardBatches)
        .where(eq(cardBatches.batchId, card.batchId))
        .limit(1);
      
      if (batch) {
        // Use new fields if available
        if (batch.usageBudgetSeconds && batch.usageBudgetSeconds > 0) {
          usageBudgetSeconds = batch.usageBudgetSeconds;
        } else {
          // Fall back to legacy internetTimeValue
          const timeValue = batch.internetTimeValue || 0;
          const timeUnit = batch.internetTimeUnit || 'hours';
          if (timeUnit === 'hours') {
            usageBudgetSeconds = timeValue * 3600;
          } else if (timeUnit === 'days') {
            usageBudgetSeconds = timeValue * 86400;
          }
        }
        
        if (batch.windowSeconds && batch.windowSeconds > 0) {
          windowSeconds = batch.windowSeconds;
        } else {
          // Fall back to legacy cardTimeValue
          const cardTimeValue = batch.cardTimeValue || 0;
          const cardTimeUnit = batch.cardTimeUnit || 'hours';
          if (cardTimeUnit === 'hours') {
            windowSeconds = cardTimeValue * 3600;
          } else if (cardTimeUnit === 'days') {
            windowSeconds = cardTimeValue * 86400;
          }
        }
      }
    }
    
    // Get used time from radacct (including active sessions)
    const usageStats = await getUserUsageStats(username);
    const usedTime = usageStats?.totalUsedTime || 0;
    
    // Calculate remaining usage time
    const remainingUsageTime = Math.max(0, usageBudgetSeconds - usedTime);
    
    // Get first use time and window end time
    const firstUseAt = card.firstUseAt;
    let windowEndTime = card.windowEndTime;
    
    // Calculate window remaining time
    let windowRemainingSeconds = 0;
    const now = new Date();
    
    if (windowEndTime) {
      windowRemainingSeconds = Math.max(0, Math.floor((new Date(windowEndTime).getTime() - now.getTime()) / 1000));
    } else if (windowSeconds > 0 && !firstUseAt) {
      // Window hasn't started yet (card not used)
      windowRemainingSeconds = windowSeconds;
    }
    
    // Determine expiration status
    const isUsageExpired = usageBudgetSeconds > 0 && usedTime >= usageBudgetSeconds;
    const isWindowExpired = windowEndTime !== null && now > new Date(windowEndTime);
    const isExpired = isUsageExpired || isWindowExpired;
    
    let expirationReason: 'usage' | 'window' | 'both' | undefined;
    if (isUsageExpired && isWindowExpired) {
      expirationReason = 'both';
    } else if (isUsageExpired) {
      expirationReason = 'usage';
    } else if (isWindowExpired) {
      expirationReason = 'window';
    }
    
    return {
      username,
      usageBudgetSeconds,
      windowSeconds,
      usedTime,
      remainingUsageTime,
      firstUseAt,
      windowEndTime,
      windowRemainingSeconds,
      isUsageExpired,
      isWindowExpired,
      isExpired,
      expirationReason,
    };
  } catch (error) {
    console.error('Error getting time balance:', error);
    return null;
  }
}

/**
 * Record first use of a card and set window end time
 * Called when user first logs in
 */
export async function recordFirstUse(username: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const [card] = await db.select()
      .from(radiusCards)
      .where(eq(radiusCards.username, username))
      .limit(1);
    
    if (!card) return false;
    
    // Only record if not already recorded
    if (card.firstUseAt) return true;
    
    // Get window seconds
    let windowSeconds = card.windowSeconds || 0;
    
    if (windowSeconds === 0 && card.batchId) {
      const [batch] = await db.select()
        .from(cardBatches)
        .where(eq(cardBatches.batchId, card.batchId))
        .limit(1);
      
      if (batch) {
        if (batch.windowSeconds && batch.windowSeconds > 0) {
          windowSeconds = batch.windowSeconds;
        } else {
          const cardTimeValue = batch.cardTimeValue || 0;
          const cardTimeUnit = batch.cardTimeUnit || 'hours';
          if (cardTimeUnit === 'hours') {
            windowSeconds = cardTimeValue * 3600;
          } else if (cardTimeUnit === 'days') {
            windowSeconds = cardTimeValue * 86400;
          }
        }
      }
    }
    
    const now = new Date();
    const windowEndTime = windowSeconds > 0 
      ? new Date(now.getTime() + windowSeconds * 1000)
      : null;
    
    await db.update(radiusCards)
      .set({
        firstUseAt: now,
        windowEndTime,
        status: 'active',
        activatedAt: card.activatedAt || now,
      })
      .where(eq(radiusCards.username, username));
    
    return true;
  } catch (error) {
    console.error('Error recording first use:', error);
    return false;
  }
}

/**
 * Check and disconnect expired users
 * This should be called periodically (e.g., every minute)
 */
export async function checkAndDisconnectExpiredUsers(): Promise<{ disconnected: string[]; errors: string[] }> {
  const db = await getDb();
  if (!db) return { disconnected: [], errors: [] };
  
  const disconnected: string[] = [];
  const errors: string[] = [];
  
  try {
    // Get all active sessions
    const activeSessions = await db.select({
      username: radacct.username,
      nasIp: radacct.nasipaddress,
      sessionId: radacct.acctuniqueid,
    })
    .from(radacct)
    .where(isNull(radacct.acctstoptime));
    
    // Check each active session
    for (const session of activeSessions) {
      const balance = await getTimeBalance(session.username);
      
      if (balance && balance.isExpired) {
        try {
          // Disconnect from RADIUS
          await coaService.disconnectSession(
            session.username,
            session.nasIp,
            session.sessionId
          );
          
          // Disconnect from VPN
          await vpnApi.disconnectVpnSession(session.username);
          
          disconnected.push(session.username);
          
          // Update card status
          await db.update(radiusCards)
            .set({ status: 'expired' })
            .where(eq(radiusCards.username, session.username));
            
        } catch (error: any) {
          errors.push(`Failed to disconnect ${session.username}: ${error.message}`);
        }
      }
    }
    
    return { disconnected, errors };
  } catch (error: any) {
    console.error('Error checking expired users:', error);
    return { disconnected, errors: [error.message] };
  }
}

/**
 * Update Session-Timeout in radreply based on remaining time
 * This ensures RADIUS will auto-disconnect when time is exhausted
 */
export async function updateSessionTimeout(username: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const balance = await getTimeBalance(username);
    if (!balance) return false;
    
    // Calculate the effective remaining time (minimum of usage and window)
    let effectiveRemaining = balance.remainingUsageTime;
    if (balance.windowRemainingSeconds > 0) {
      effectiveRemaining = Math.min(effectiveRemaining, balance.windowRemainingSeconds);
    }
    
    // Update Session-Timeout in radreply
    const existingTimeout = await db.select()
      .from(radreply)
      .where(and(
        eq(radreply.username, username),
        eq(radreply.attribute, 'Session-Timeout')
      ))
      .limit(1);
    
    if (existingTimeout.length > 0) {
      await db.update(radreply)
        .set({ value: effectiveRemaining.toString() })
        .where(and(
          eq(radreply.username, username),
          eq(radreply.attribute, 'Session-Timeout')
        ));
    } else {
      await db.insert(radreply).values({
        username,
        attribute: 'Session-Timeout',
        op: ':=',
        value: effectiveRemaining.toString(),
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error updating session timeout:', error);
    return false;
  }
}

/**
 * Get all users with low remaining time (warning threshold)
 */
export async function getUsersWithLowTime(thresholdMinutes: number = 30): Promise<TimeBalance[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    // Get all active vouchers
    const activeCards = await db.select()
      .from(radiusCards)
      .where(eq(radiusCards.status, 'active'));
    
    const lowTimeUsers: TimeBalance[] = [];
    const thresholdSeconds = thresholdMinutes * 60;
    
    for (const card of activeCards) {
      const balance = await getTimeBalance(card.username);
      if (balance && !balance.isExpired) {
        // Check if either usage time or window time is low
        const effectiveRemaining = Math.min(
          balance.remainingUsageTime,
          balance.windowRemainingSeconds > 0 ? balance.windowRemainingSeconds : Infinity
        );
        if (effectiveRemaining > 0 && effectiveRemaining <= thresholdSeconds) {
          lowTimeUsers.push(balance);
        }
      }
    }
    
    return lowTimeUsers;
  } catch (error) {
    console.error('Error getting users with low time:', error);
    return [];
  }
}

/**
 * Format seconds to human-readable time (Arabic)
 */
export function formatTime(seconds: number): string {
  if (seconds <= 0) return '0 ثانية';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  if (secs > 0 && parts.length === 0) parts.push(`${secs} ثانية`);
  
  return parts.join(' و ');
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Legacy compatibility - keep old interface working
export { TimeBalance as TimeBalanceNew };
export interface TimeBalanceLegacy {
  username: string;
  allocatedTime: number;
  usedTime: number;
  remainingTime: number;
  isExpired: boolean;
}

/**
 * Get time balance in legacy format (for backward compatibility)
 */
export async function getTimeBalanceLegacy(username: string): Promise<TimeBalanceLegacy | null> {
  const balance = await getTimeBalance(username);
  if (!balance) return null;
  
  return {
    username: balance.username,
    allocatedTime: balance.usageBudgetSeconds,
    usedTime: balance.usedTime,
    remainingTime: balance.remainingUsageTime,
    isExpired: balance.isExpired,
  };
}
