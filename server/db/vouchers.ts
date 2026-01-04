import { eq, desc, and, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { vouchers, voucherBatches, InsertVoucher, InsertVoucherBatch } from "../../drizzle/schema";
import { nanoid } from "nanoid";

function generateVoucherCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function getAllVouchers(options?: { status?: string; batchId?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options?.status) {
    conditions.push(eq(vouchers.status, options.status as any));
  }
  if (options?.batchId) {
    conditions.push(eq(vouchers.batchId, options.batchId));
  }
  
  if (conditions.length > 0) {
    return db.select()
      .from(vouchers)
      .where(and(...conditions))
      .orderBy(desc(vouchers.createdAt))
      .limit(options?.limit || 50);
  }
  
  return db.select()
    .from(vouchers)
    .orderBy(desc(vouchers.createdAt))
    .limit(options?.limit || 50);
}

export async function getVouchersByReseller(resellerId: number, options?: { status?: string; batchId?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let conditions = [eq(vouchers.resellerId, resellerId)];
  
  if (options?.status) {
    conditions.push(eq(vouchers.status, options.status as any));
  }
  if (options?.batchId) {
    conditions.push(eq(vouchers.batchId, options.batchId));
  }
  
  return db.select()
    .from(vouchers)
    .where(and(...conditions))
    .orderBy(desc(vouchers.createdAt))
    .limit(options?.limit || 50);
}

export async function getVoucherById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
  return result[0] || null;
}

export async function getVoucherByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(vouchers).where(eq(vouchers.code, code)).limit(1);
  return result[0] || null;
}

export async function generateVouchers(data: {
  planId: number;
  quantity: number;
  createdBy: number;
  resellerId?: number;
  expiresInDays?: number;
  batchName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const batchId = nanoid(10);
  const expiresAt = data.expiresInDays 
    ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  
  // Create batch record
  await db.insert(voucherBatches).values({
    batchId,
    name: data.batchName || `Batch ${batchId}`,
    planId: data.planId,
    createdBy: data.createdBy,
    quantity: data.quantity,
    status: "generating",
  });
  
  // Generate vouchers
  const voucherCodes: string[] = [];
  for (let i = 0; i < data.quantity; i++) {
    const code = generateVoucherCode();
    voucherCodes.push(code);
    
    await db.insert(vouchers).values({
      code,
      planId: data.planId,
      createdBy: data.createdBy,
      resellerId: data.resellerId,
      batchId,
      status: "unused",
      expiresAt,
    });
  }
  
  // Update batch status
  await db.update(voucherBatches)
    .set({ status: "completed" })
    .where(eq(voucherBatches.batchId, batchId));
  
  return { success: true, batchId, codes: voucherCodes, quantity: data.quantity };
}

export async function redeemVoucher(code: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const voucher = await getVoucherByCode(code);
  
  if (!voucher) {
    throw new Error("Invalid voucher code");
  }
  
  if (voucher.status !== "unused") {
    throw new Error("Voucher has already been used or is expired");
  }
  
  if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
    await db.update(vouchers)
      .set({ status: "expired" })
      .where(eq(vouchers.id, voucher.id));
    throw new Error("Voucher has expired");
  }
  
  // Mark voucher as used
  await db.update(vouchers)
    .set({
      status: "used",
      usedBy: userId,
      usedAt: new Date(),
    })
    .where(eq(vouchers.id, voucher.id));
  
  return { success: true, planId: voucher.planId, voucherId: voucher.id };
}

export async function getAllBatches() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(voucherBatches).orderBy(desc(voucherBatches.createdAt));
}

export async function getBatchesByCreator(createdBy: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(voucherBatches)
    .where(eq(voucherBatches.createdBy, createdBy))
    .orderBy(desc(voucherBatches.createdAt));
}

export async function getBatchById(batchId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(voucherBatches).where(eq(voucherBatches.batchId, batchId)).limit(1);
  return result[0] || null;
}
