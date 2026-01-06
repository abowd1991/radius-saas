/**
 * Accounting Service
 * 
 * This service handles RADIUS accounting data processing:
 * - Calculate used time from radacct
 * - Deduct time from card balance
 * - Track remaining time
 * - Auto-disconnect when time expires
 */

import { getDb } from "../db";
import { radacct, radcheck, radiusCards, cardBatches } from "../../drizzle/schema";
import { eq, and, isNull, sql, sum, desc } from "drizzle-orm";
import * as coaService from "./coaService";
import * as vpnApi from "./vpnApiService";

interface UsageStats {
  username: string;
  totalSessionTime: number; // in seconds
  totalInputOctets: number;
  totalOutputOctets: number;
  sessionCount: number;
  lastSession?: {
    startTime: Date | null;
    stopTime: Date | null;
    sessionTime: number;
    nasIp: string;
  };
}

interface TimeBalance {
  username: string;
  allocatedTime: number; // in seconds
  usedTime: number; // in seconds
  remainingTime: number; // in seconds
  isExpired: boolean;
}

/**
 * Get usage statistics for a username from radacct
 */
export async function getUserUsageStats(username: string): Promise<UsageStats | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    // Get aggregated stats
    const stats = await db.select({
      totalSessionTime: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`,
      totalInputOctets: sql<number>`COALESCE(SUM(${radacct.acctinputoctets}), 0)`,
      totalOutputOctets: sql<number>`COALESCE(SUM(${radacct.acctoutputoctets}), 0)`,
      sessionCount: sql<number>`COUNT(*)`,
    })
    .from(radacct)
    .where(eq(radacct.username, username));
    
    // Get last session
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
    
    return {
      username,
      totalSessionTime: stats[0]?.totalSessionTime || 0,
      totalInputOctets: stats[0]?.totalInputOctets || 0,
      totalOutputOctets: stats[0]?.totalOutputOctets || 0,
      sessionCount: stats[0]?.sessionCount || 0,
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
 * Get time balance for a card/username
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
    
    // Get the batch to find allocated time
    if (!card.batchId) return null;
    
    const [batch] = await db.select()
      .from(cardBatches)
      .where(eq(cardBatches.batchId, card.batchId))
      .limit(1);
    
    // Calculate allocated time in seconds
    let allocatedTime = 0;
    if (batch) {
      const timeValue = batch.internetTimeValue || 0;
      const timeUnit = batch.internetTimeUnit || 'hours';
      
      if (timeUnit === 'hours') {
        allocatedTime = timeValue * 3600;
      } else if (timeUnit === 'days') {
        allocatedTime = timeValue * 86400;
      }
    }
    
    // Get used time from radacct
    const usageStats = await getUserUsageStats(username);
    const usedTime = usageStats?.totalSessionTime || 0;
    
    const remainingTime = Math.max(0, allocatedTime - usedTime);
    const isExpired = remainingTime <= 0 && allocatedTime > 0;
    
    return {
      username,
      allocatedTime,
      usedTime,
      remainingTime,
      isExpired,
    };
  } catch (error) {
    console.error('Error getting time balance:', error);
    return null;
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
 * Update Session-Timeout in radcheck based on remaining time
 * This ensures RADIUS will reject connections when time is exhausted
 */
export async function updateSessionTimeout(username: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const balance = await getTimeBalance(username);
    if (!balance) return false;
    
    // Update or insert Session-Timeout
    const existingTimeout = await db.select()
      .from(radcheck)
      .where(and(
        eq(radcheck.username, username),
        eq(radcheck.attribute, 'Session-Timeout')
      ))
      .limit(1);
    
    if (existingTimeout.length > 0) {
      await db.update(radcheck)
        .set({ value: balance.remainingTime.toString() })
        .where(and(
          eq(radcheck.username, username),
          eq(radcheck.attribute, 'Session-Timeout')
        ));
    } else {
      await db.insert(radcheck).values({
        username,
        attribute: 'Session-Timeout',
        op: ':=',
        value: balance.remainingTime.toString(),
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
      if (balance && balance.remainingTime > 0 && balance.remainingTime <= thresholdSeconds) {
        lowTimeUsers.push(balance);
      }
    }
    
    return lowTimeUsers;
  } catch (error) {
    console.error('Error getting users with low time:', error);
    return [];
  }
}

/**
 * Format seconds to human-readable time
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
