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
