import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { plans, InsertPlan } from "../../drizzle/schema";

export async function getAllPlans() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(plans).orderBy(desc(plans.createdAt));
}

export async function getActivePlans() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(plans).where(eq(plans.status, "active")).orderBy(plans.price);
}

export async function getPlanById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  return result[0] || null;
}

export async function createPlan(data: Omit<InsertPlan, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(plans).values(data);
  return { success: true, id: result[0].insertId };
}

export async function updatePlan(id: number, data: Partial<InsertPlan>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(plans).set(data).where(eq(plans.id, id));
  return { success: true };
}

export async function deletePlan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(plans).where(eq(plans.id, id));
  return { success: true };
}
