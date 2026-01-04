import { eq, desc, and, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { radiusCards, radacct, onlineSessions, plans } from "../../drizzle/schema";

// Get all active cards (subscriptions)
export async function getAllSubscriptions(options?: { status?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  if (options?.status) {
    return db.select()
      .from(radiusCards)
      .where(eq(radiusCards.status, options.status as any))
      .orderBy(desc(radiusCards.createdAt))
      .limit(options?.limit || 50);
  }
  
  return db.select()
    .from(radiusCards)
    .orderBy(desc(radiusCards.createdAt))
    .limit(options?.limit || 50);
}

export async function getSubscriptionsByUserId(userId: number, options?: { status?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(radiusCards.usedBy, userId)];
  
  if (options?.status) {
    conditions.push(eq(radiusCards.status, options.status as any));
  }
  
  return db.select()
    .from(radiusCards)
    .where(and(...conditions))
    .orderBy(desc(radiusCards.createdAt))
    .limit(options?.limit || 50);
}

export async function getSubscriptionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(radiusCards).where(eq(radiusCards.id, id)).limit(1);
  return result[0] || null;
}

export async function getSubscriptionByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(radiusCards).where(eq(radiusCards.username, username)).limit(1);
  return result[0] || null;
}

export async function updateSubscriptionStatus(id: number, status: "active" | "suspended" | "expired" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(radiusCards).set({ status }).where(eq(radiusCards.id, id));
  return { success: true };
}

export async function renewSubscription(id: number, additionalDays: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const card = await getSubscriptionById(id);
  if (!card) throw new Error("Subscription not found");
  
  const currentExpiry = card.expiresAt ? new Date(card.expiresAt) : new Date();
  const now = new Date();
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);
  
  await db.update(radiusCards)
    .set({
      expiresAt: newExpiry,
      status: "active",
    })
    .where(eq(radiusCards.id, id));
  
  return { success: true, newExpiresAt: newExpiry };
}

// Get active sessions from radacct (real RADIUS accounting)
export async function getActiveSessions(options?: { page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(radacct)
    .where(isNull(radacct.acctstoptime))
    .orderBy(desc(radacct.acctstarttime))
    .limit(options?.limit || 50);
}

// Get online sessions (real-time tracking)
export async function getOnlineSessions(options?: { page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(onlineSessions)
    .orderBy(desc(onlineSessions.startTime))
    .limit(options?.limit || 50);
}

export async function getSessionsByUsername(username: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(radacct)
    .where(eq(radacct.username, username))
    .orderBy(desc(radacct.acctstarttime))
    .limit(100);
}

// Get session history from radacct
export async function getSessionHistory(options?: { 
  username?: string;
  nasIp?: string;
  page?: number; 
  limit?: number 
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options?.username) {
    conditions.push(eq(radacct.username, options.username));
  }
  if (options?.nasIp) {
    conditions.push(eq(radacct.nasipaddress, options.nasIp));
  }
  
  if (conditions.length > 0) {
    return db.select()
      .from(radacct)
      .where(and(...conditions))
      .orderBy(desc(radacct.acctstarttime))
      .limit(options?.limit || 50);
  }
  
  return db.select()
    .from(radacct)
    .orderBy(desc(radacct.acctstarttime))
    .limit(options?.limit || 50);
}

export async function getActiveSubscriptionsCount(userId?: number) {
  const db = await getDb();
  if (!db) return 0;
  
  let query;
  if (userId) {
    query = db.select()
      .from(radiusCards)
      .where(and(eq(radiusCards.status, "active"), eq(radiusCards.usedBy, userId)));
  } else {
    query = db.select()
      .from(radiusCards)
      .where(eq(radiusCards.status, "active"));
  }
  
  const result = await query;
  return result.length;
}

// Get active sessions count
export async function getActiveSessionsCount() {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select()
    .from(radacct)
    .where(isNull(radacct.acctstoptime));
  
  return result.length;
}

// Disconnect a session (requires MikroTik API integration)
export async function disconnectSession(acctSessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // This would typically call MikroTik API to disconnect the user
  // For now, we just mark it in the database
  await db.update(radacct)
    .set({
      acctstoptime: new Date(),
      acctterminatecause: "Admin-Reset",
    })
    .where(eq(radacct.acctsessionid, acctSessionId));
  
  return { success: true };
}
