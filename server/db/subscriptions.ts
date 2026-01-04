import { eq, desc, and, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { subscriptions, radiusSessions, plans, InsertSubscription } from "../../drizzle/schema";
import { nanoid } from "nanoid";

export async function getAllSubscriptions(options?: { status?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  if (options?.status) {
    return db.select()
      .from(subscriptions)
      .where(eq(subscriptions.status, options.status as any))
      .orderBy(desc(subscriptions.createdAt))
      .limit(options?.limit || 50);
  }
  
  return db.select()
    .from(subscriptions)
    .orderBy(desc(subscriptions.createdAt))
    .limit(options?.limit || 50);
}

export async function getSubscriptionsByUserId(userId: number, options?: { status?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(subscriptions.userId, userId)];
  
  if (options?.status) {
    conditions.push(eq(subscriptions.status, options.status as any));
  }
  
  return db.select()
    .from(subscriptions)
    .where(and(...conditions))
    .orderBy(desc(subscriptions.createdAt))
    .limit(options?.limit || 50);
}

export async function getSubscriptionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return result[0] || null;
}

export async function getSubscriptionByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(subscriptions).where(eq(subscriptions.username, username)).limit(1);
  return result[0] || null;
}

export async function createSubscription(data: {
  userId: number;
  planId: number;
  nasId?: number;
  username: string;
  password: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get plan details for expiry calculation
  const planResult = await db.select().from(plans).where(eq(plans.id, data.planId)).limit(1);
  const plan = planResult[0];
  
  if (!plan) throw new Error("Plan not found");
  
  const startDate = new Date();
  const expiresAt = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
  
  const result = await db.insert(subscriptions).values({
    userId: data.userId,
    planId: data.planId,
    nasId: data.nasId,
    username: data.username,
    password: data.password,
    status: "active",
    startDate,
    expiresAt,
  });
  
  return { success: true, id: result[0].insertId };
}

export async function updateSubscriptionStatus(id: number, status: "active" | "suspended" | "expired" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscriptions).set({ status }).where(eq(subscriptions.id, id));
  return { success: true };
}

export async function renewSubscription(id: number, durationDays: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const subscription = await getSubscriptionById(id);
  if (!subscription) throw new Error("Subscription not found");
  
  const currentExpiry = new Date(subscription.expiresAt);
  const now = new Date();
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  
  await db.update(subscriptions)
    .set({
      expiresAt: newExpiry,
      status: "active",
    })
    .where(eq(subscriptions.id, id));
  
  return { success: true, newExpiresAt: newExpiry };
}

export async function getActiveSessions(options?: { page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(radiusSessions)
    .where(isNull(radiusSessions.stopTime))
    .orderBy(desc(radiusSessions.startTime))
    .limit(options?.limit || 50);
}

export async function getSessionsByUsername(username: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(radiusSessions)
    .where(eq(radiusSessions.username, username))
    .orderBy(desc(radiusSessions.startTime))
    .limit(100);
}

export async function createSession(data: {
  sessionId: string;
  subscriptionId?: number;
  username: string;
  nasId?: number;
  nasIpAddress?: string;
  nasPort?: number;
  framedIpAddress?: string;
  callingStationId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(radiusSessions).values({
    ...data,
    startTime: new Date(),
  });
  
  return { success: true };
}

export async function endSession(sessionId: string, terminateCause: string, inputOctets: number, outputOctets: number, sessionTime: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(radiusSessions)
    .set({
      stopTime: new Date(),
      terminateCause,
      inputOctets,
      outputOctets,
      sessionTime,
    })
    .where(eq(radiusSessions.sessionId, sessionId));
  
  return { success: true };
}

export async function getActiveSubscriptionsCount(userId?: number) {
  const db = await getDb();
  if (!db) return 0;
  
  let query;
  if (userId) {
    query = db.select()
      .from(subscriptions)
      .where(and(eq(subscriptions.status, "active"), eq(subscriptions.userId, userId)));
  } else {
    query = db.select()
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));
  }
  
  const result = await query;
  return result.length;
}
