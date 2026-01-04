import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { nasDevices, InsertNasDevice } from "../../drizzle/schema";

export async function getAllNasDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(nasDevices).orderBy(desc(nasDevices.createdAt));
}

export async function getActiveNasDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(nasDevices).where(eq(nasDevices.status, "active"));
}

export async function getNasById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(nasDevices).where(eq(nasDevices.id, id)).limit(1);
  return result[0] || null;
}

export async function getNasByIp(ipAddress: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(nasDevices).where(eq(nasDevices.ipAddress, ipAddress)).limit(1);
  return result[0] || null;
}

export async function createNas(data: Omit<InsertNasDevice, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(nasDevices).values(data);
  return { success: true, id: result[0].insertId };
}

export async function updateNas(id: number, data: Partial<InsertNasDevice>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(nasDevices).set(data).where(eq(nasDevices.id, id));
  return { success: true };
}

export async function deleteNas(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(nasDevices).where(eq(nasDevices.id, id));
  return { success: true };
}

export async function updateLastSeen(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(nasDevices)
    .set({ lastSeen: new Date() })
    .where(eq(nasDevices.id, id));
}
