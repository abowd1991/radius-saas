import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "phone", "address"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      // Owner gets super_admin role
      values.role = 'super_admin';
      updateSet.role = 'super_admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// USER QUERIES
// ============================================================================

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUsersByRole(role: 'super_admin' | 'reseller' | 'client') {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, role));
}

export async function getUsersByResellerId(resellerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.resellerId, resellerId));
}

export async function updateUserStatus(userId: number, status: 'active' | 'suspended' | 'inactive') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ status }).where(eq(users.id, userId));
  return { success: true };
}

export async function updateUserRole(userId: number, role: 'super_admin' | 'reseller' | 'client') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return { success: true };
}

export async function assignReseller(userId: number, resellerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ resellerId }).where(eq(users.id, userId));
  return { success: true };
}

export async function updateUser(userId: number, data: { name?: string; phone?: string; address?: string; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set(data).where(eq(users.id, userId));
  const updated = await db.select().from(users).where(eq(users.id, userId));
  return updated[0];
}


// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

import { systemSettings } from "../drizzle/schema";

export async function getSystemSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  
  const settings = await db.select().from(systemSettings);
  const result: Record<string, string> = {};
  
  for (const setting of settings) {
    result[setting.key] = setting.value || '';
  }
  
  return result;
}

export async function getSystemSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return result[0]?.value || null;
}

export async function setSystemSetting(key: string, value: string, description?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(systemSettings)
    .values({ key, value, description })
    .onDuplicateKeyUpdate({ set: { value, description } });
}


// ============================================================================
// PPPoE SUBSCRIBERS QUERIES
// ============================================================================

import { subscribers, subscriberSubscriptions, plans, nasDevices } from "../drizzle/schema";
import { or, desc, and, lte, gte, sql } from "drizzle-orm";

export type SubscriberStatus = 'active' | 'suspended' | 'expired' | 'pending';
export type SubscriberPaymentMethod = 'cash' | 'wallet' | 'card' | 'bank_transfer' | 'online';

export interface CreateSubscriberInput {
  username: string;
  password: string;
  ownerId: number;
  createdBy: number;
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  nationalId?: string;
  notes?: string;
  planId: number;
  nasId?: number;
  ipAssignmentType?: 'dynamic' | 'static';
  staticIp?: string;
  simultaneousUse?: number;
  macAddress?: string;
  macBindingEnabled?: boolean;
  subscriptionMonths?: number;
  amount?: number;
  paymentMethod?: SubscriberPaymentMethod;
}

// Get all subscribers for an owner (multi-tenant)
export async function getSubscribersByOwner(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    subscriber: subscribers,
    plan: {
      id: plans.id,
      name: plans.name,
      downloadSpeed: plans.downloadSpeed,
      uploadSpeed: plans.uploadSpeed,
      price: plans.price,
    },
    nas: {
      id: nasDevices.id,
      nasname: nasDevices.nasname,
      shortname: nasDevices.shortname,
    }
  })
  .from(subscribers)
  .leftJoin(plans, eq(subscribers.planId, plans.id))
  .leftJoin(nasDevices, eq(subscribers.nasId, nasDevices.id))
  .where(or(eq(subscribers.ownerId, ownerId), eq(subscribers.createdBy, ownerId)))
  .orderBy(desc(subscribers.createdAt));
}

// Get subscriber by ID
export async function getSubscriberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select({
    subscriber: subscribers,
    plan: {
      id: plans.id,
      name: plans.name,
      downloadSpeed: plans.downloadSpeed,
      uploadSpeed: plans.uploadSpeed,
      price: plans.price,

    },
    nas: {
      id: nasDevices.id,
      nasname: nasDevices.nasname,
      shortname: nasDevices.shortname,
    }
  })
  .from(subscribers)
  .leftJoin(plans, eq(subscribers.planId, plans.id))
  .leftJoin(nasDevices, eq(subscribers.nasId, nasDevices.id))
  .where(eq(subscribers.id, id))
  .limit(1);
  
  return result[0];
}

// Check if username exists
export async function subscriberUsernameExists(username: string) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ id: subscribers.id })
    .from(subscribers)
    .where(eq(subscribers.username, username))
    .limit(1);
  
  return result.length > 0;
}

// Create new subscriber
export async function createSubscriber(input: CreateSubscriberInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Calculate subscription dates
  const now = new Date();
  const months = input.subscriptionMonths || 1;
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + months);
  
  // Insert subscriber
  const [result] = await db.insert(subscribers).values({
    username: input.username,
    password: input.password,
    ownerId: input.ownerId,
    createdBy: input.createdBy,
    fullName: input.fullName,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    nationalId: input.nationalId || null,
    notes: input.notes || null,
    planId: input.planId,
    nasId: input.nasId || null,
    ipAssignmentType: input.ipAssignmentType || 'dynamic',
    staticIp: input.staticIp || null,
    simultaneousUse: input.simultaneousUse || 1,
    macAddress: input.macAddress || null,
    macBindingEnabled: input.macBindingEnabled || false,
    status: 'active',
    subscriptionStartDate: now,
    subscriptionEndDate: endDate,
  });
  
  const subscriberId = result.insertId;
  
  // Create subscription record
  if (input.amount && input.amount > 0) {
    await db.insert(subscriberSubscriptions).values({
      subscriberId: subscriberId,
      startDate: now,
      endDate: endDate,
      planId: input.planId,
      planName: '', // Will be filled by the caller
      amount: input.amount.toString(),
      currency: 'USD',
      paymentMethod: input.paymentMethod || 'cash',
      status: 'active',
      processedBy: input.createdBy,
      notes: input.notes || null,
    });
  }
  
  return subscriberId;
}

// Update subscriber
export async function updateSubscriber(id: number, data: Partial<{
  fullName: string;
  phone: string;
  email: string;
  address: string;
  nationalId: string;
  notes: string;
  planId: number;
  nasId: number;
  ipAssignmentType: 'dynamic' | 'static';
  staticIp: string;
  simultaneousUse: number;
  macAddress: string;
  macBindingEnabled: boolean;
  status: SubscriberStatus;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscribers)
    .set(data)
    .where(eq(subscribers.id, id));
}

// Suspend subscriber
export async function suspendSubscriber(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscribers)
    .set({ status: 'suspended' })
    .where(eq(subscribers.id, id));
}

// Activate subscriber
export async function activateSubscriber(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscribers)
    .set({ status: 'active' })
    .where(eq(subscribers.id, id));
}

// Renew subscription
export async function renewSubscription(
  subscriberId: number, 
  months: number, 
  amount: number, 
  processedBy: number,
  paymentMethod: SubscriberPaymentMethod = 'cash',
  notes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current subscriber
  const [subscriber] = await db.select()
    .from(subscribers)
    .where(eq(subscribers.id, subscriberId))
    .limit(1);
  
  if (!subscriber) throw new Error("Subscriber not found");
  
  // Calculate new end date
  const now = new Date();
  const currentEnd = subscriber.subscriptionEndDate || now;
  const startDate = currentEnd > now ? currentEnd : now;
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
  
  // Get plan name
  const [plan] = await db.select({ name: plans.name })
    .from(plans)
    .where(eq(plans.id, subscriber.planId))
    .limit(1);
  
  // Update subscriber
  await db.update(subscribers)
    .set({ 
      status: 'active',
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
    })
    .where(eq(subscribers.id, subscriberId));
  
  // Create subscription record
  await db.insert(subscriberSubscriptions).values({
    subscriberId: subscriberId,
    startDate: startDate,
    endDate: endDate,
    planId: subscriber.planId,
    planName: plan?.name || 'Unknown',
    amount: amount.toString(),
    currency: 'USD',
    paymentMethod: paymentMethod,
    status: 'active',
    processedBy: processedBy,
    notes: notes || null,
  });
  
  return { startDate, endDate };
}

// Get subscription history
export async function getSubscriptionHistory(subscriberId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(subscriberSubscriptions)
    .where(eq(subscriberSubscriptions.subscriberId, subscriberId))
    .orderBy(desc(subscriberSubscriptions.createdAt));
}

// Get expired subscribers (for cron job)
export async function getExpiredSubscribers() {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  
  return db.select()
    .from(subscribers)
    .where(and(
      eq(subscribers.status, 'active'),
      lte(subscribers.subscriptionEndDate, now)
    ));
}

// Mark subscriber as expired
export async function markSubscriberExpired(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(subscribers)
    .set({ status: 'expired' })
    .where(eq(subscribers.id, id));
}

// Get subscriber stats for owner
export async function getSubscriberStats(ownerId: number) {
  const db = await getDb();
  if (!db) return { total: 0, active: 0, suspended: 0, expired: 0, pending: 0 };
  
  const result = await db.select({
    status: subscribers.status,
    count: sql<number>`COUNT(*)`,
  })
  .from(subscribers)
  .where(or(eq(subscribers.ownerId, ownerId), eq(subscribers.createdBy, ownerId)))
  .groupBy(subscribers.status);
  
  const stats = { total: 0, active: 0, suspended: 0, expired: 0, pending: 0 };
  
  for (const row of result) {
    const count = Number(row.count);
    stats.total += count;
    if (row.status === 'active') stats.active = count;
    else if (row.status === 'suspended') stats.suspended = count;
    else if (row.status === 'expired') stats.expired = count;
    else if (row.status === 'pending') stats.pending = count;
  }
  
  return stats;
}

// Delete subscriber
export async function deleteSubscriber(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete subscription history first
  await db.delete(subscriberSubscriptions)
    .where(eq(subscriberSubscriptions.subscriberId, id));
  
  // Delete subscriber
  await db.delete(subscribers)
    .where(eq(subscribers.id, id));
}

// Update last login
export async function updateSubscriberLastLogin(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(subscribers)
    .set({ lastLoginAt: new Date() })
    .where(eq(subscribers.id, id));
}
