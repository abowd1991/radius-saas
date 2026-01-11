/**
 * Audit Log Service
 * Records all critical operations for security and compliance
 */

import { getDb } from "../db";
import { auditLogs } from "../../drizzle/schema";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";

export type AuditAction = 
  | 'session_disconnect'
  | 'session_disconnect_coa'
  | 'session_disconnect_api'
  | 'speed_change'
  | 'speed_change_coa'
  | 'speed_change_api'
  | 'nas_create'
  | 'nas_update'
  | 'nas_delete'
  | 'card_create'
  | 'card_suspend'
  | 'card_activate'
  | 'subscriber_create'
  | 'subscriber_suspend'
  | 'subscriber_activate'
  | 'vpn_connect'
  | 'vpn_disconnect'
  | 'login'
  | 'logout';

export type AuditResult = 'success' | 'failure' | 'partial';

export interface AuditLogEntry {
  userId: number;
  userRole: string;
  action: AuditAction;
  targetType: 'session' | 'nas' | 'card' | 'subscriber' | 'user' | 'vpn';
  targetId?: string;
  targetName?: string;
  nasId?: number;
  nasIp?: string;
  details?: Record<string, any>;
  result: AuditResult;
  errorMessage?: string;
  ipAddress?: string;
}

/**
 * Log an audit event
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[AuditLog] Database not available');
      return;
    }
    
    await db.insert(auditLogs).values({
      userId: entry.userId,
      userRole: entry.userRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetName: entry.targetName,
      nasId: entry.nasId,
      nasIp: entry.nasIp,
      details: entry.details ? JSON.stringify(entry.details) : null,
      result: entry.result,
      errorMessage: entry.errorMessage,
      ipAddress: entry.ipAddress,
      createdAt: new Date(),
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main operation
    console.error('[AuditLog] Failed to log audit entry:', error);
  }
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters?: {
  userId?: number;
  action?: AuditAction;
  targetType?: string;
  nasId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (filters?.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters?.targetType) {
    conditions.push(eq(auditLogs.targetType, filters.targetType));
  }
  if (filters?.nasId) {
    conditions.push(eq(auditLogs.nasId, filters.nasId));
  }
  if (filters?.startDate) {
    conditions.push(gte(auditLogs.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(auditLogs.createdAt, filters.endDate));
  }

  const query = db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters?.limit || 100)
    .offset(filters?.offset || 0);

  return query;
}

/**
 * Get audit logs for a specific NAS (for owner viewing)
 */
export async function getAuditLogsByNas(nasId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.nasId, nasId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/**
 * Get recent actions by a user
 */
export async function getRecentActionsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/**
 * Get audit statistics
 */
export async function getAuditStats(days = 7) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await db
    .select({
      action: auditLogs.action,
      result: auditLogs.result,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, startDate))
    .groupBy(auditLogs.action, auditLogs.result);

  return stats;
}
