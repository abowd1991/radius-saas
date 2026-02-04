import { getDb } from "../db";
import { users, nasDevices, systemSettings, walletLedger, wallets } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAudit } from "./auditLogService";

/**
 * SaaS Billing Service
 * 
 * Billing Model:
 * - $10/month per active NAS
 * - Billing cycle: every 30 days from activation date
 * - Deduct from wallet_ledger
 * - Set billing_status = 'past_due' if insufficient balance
 */

interface BillingResult {
  success: boolean;
  userId: number;
  activeNasCount: number;
  monthlyCost: number;
  balanceBefore: number;
  balanceAfter?: number;
  error?: string;
  billingDate: Date;
}

/**
 * Get NAS billing rate from system settings
 */
export async function getNasBillingRate(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "nas_billing_rate"));

  return setting ? parseFloat(setting.value || "10") : 10;
}

/**
 * Calculate monthly cost for a user based on active NAS count
 */
export async function calculateMonthlyCost(userId: number): Promise<{ activeNasCount: number; monthlyCost: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Count active NAS devices owned by this user
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(nasDevices)
    .where(
      and(
        eq(nasDevices.ownerId, userId),
        eq(nasDevices.status, "active")
      )
    );

  const activeNasCount = Number(result[0]?.count || 0);
  const nasBillingRate = await getNasBillingRate();
  const monthlyCost = activeNasCount * nasBillingRate;

  return { activeNasCount, monthlyCost };
}

/**
 * Get next billing date (30 days from last billing or activation)
 */
export function getNextBillingDate(lastBillingDate: Date): Date {
  const nextDate = new Date(lastBillingDate);
  nextDate.setDate(nextDate.getDate() + 30);
  return nextDate;
}

/**
 * Check if user billing is due
 */
export async function isBillingDue(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return false;

  // If no billing start date, not activated yet
  if (!user.billingStartAt) return false;

  // If never billed, check if 30 days passed since activation
  if (!user.lastBillingAt) {
    const daysSinceActivation = Math.floor(
      (Date.now() - new Date(user.billingStartAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceActivation >= 30;
  }

  // Check if 30 days passed since last billing
  const daysSinceLastBilling = Math.floor(
    (Date.now() - new Date(user.lastBillingAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceLastBilling >= 30;
}

/**
 * Process billing for a user
 * - Calculate cost based on active NAS
 * - Deduct from wallet
 * - Update billing dates
 * - Set billing_status if insufficient balance
 */
export async function processUserBilling(userId: number, actorId?: number): Promise<BillingResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const billingDate = new Date();

  try {
    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return {
        success: false,
        userId,
        activeNasCount: 0,
        monthlyCost: 0,
        balanceBefore: 0,
        error: "User not found",
        billingDate,
      };
    }

    // Calculate cost
    const { activeNasCount, monthlyCost } = await calculateMonthlyCost(userId);

    // If no active NAS, skip billing
    if (activeNasCount === 0) {
      return {
        success: true,
        userId,
        activeNasCount: 0,
        monthlyCost: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        billingDate,
      };
    }

    // Get wallet balance
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    if (!wallet) {
      return {
        success: false,
        userId,
        activeNasCount,
        monthlyCost,
        balanceBefore: 0,
        error: "Wallet not found",
        billingDate,
      };
    }

    const balanceBefore = parseFloat(wallet.balance);

    // Check if sufficient balance
    if (balanceBefore < monthlyCost) {
      // Insufficient balance - set past_due status
      await db
        .update(users)
        .set({
          billingStatus: "past_due",
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Log audit
      await logAudit({
        userId: actorId || userId,
        userRole: "system",
        action: "billing_failed_insufficient_balance",
        targetType: "user",
        targetId: userId.toString(),
        result: "failure",
        errorMessage: "Insufficient balance",
        details: {
          activeNasCount,
          monthlyCost,
          balanceBefore,
        },
      });

      return {
        success: false,
        userId,
        activeNasCount,
        monthlyCost,
        balanceBefore,
        error: "Insufficient balance",
        billingDate,
      };
    }

    // Deduct from wallet
    const balanceAfter = balanceBefore - monthlyCost;
    await db
      .update(wallets)
      .set({
        balance: balanceAfter.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId));

    // Record in wallet_ledger
    await db.insert(walletLedger).values({
      userId,
      type: "debit",
      amount: monthlyCost.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      reason: `Monthly billing: ${activeNasCount} active NAS × $${await getNasBillingRate()}`,
      reasonAr: `فوترة شهرية: ${activeNasCount} NAS نشط × $${await getNasBillingRate()}`,
      entityType: "billing",
      entityId: userId,
      actorId: actorId || userId,
      actorRole: "system",
      metadata: JSON.stringify({
        activeNasCount,
        nasBillingRate: await getNasBillingRate(),
        billingPeriod: "30_days",
      }),
      createdAt: billingDate,
    });

    // Update user billing dates
    const nextBillingAt = getNextBillingDate(billingDate);
    await db
      .update(users)
      .set({
        lastBillingAt: billingDate,
        nextBillingAt,
        billingStatus: "active",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Log audit
    await logAudit({
      userId: actorId || userId,
      userRole: "system",
      action: "billing_processed",
      targetType: "user",
      targetId: userId.toString(),
      result: "success",
      details: {
        activeNasCount,
        monthlyCost,
        balanceBefore,
        balanceAfter,
        nextBillingAt,
      },
    });

    return {
      success: true,
      userId,
      activeNasCount,
      monthlyCost,
      balanceBefore,
      balanceAfter,
      billingDate,
    };
  } catch (error: any) {
    console.error("[BillingService] Error processing billing:", error);
    
    // Log error
    await logAudit({
      userId: actorId || userId,
      userRole: "system",
      action: "billing_error",
      targetType: "user",
      targetId: userId.toString(),
      result: "failure",
      errorMessage: error.message,
    });

    return {
      success: false,
      userId,
      activeNasCount: 0,
      monthlyCost: 0,
      balanceBefore: 0,
      error: error.message,
      billingDate,
    };
  }
}

/**
 * Activate billing for a user (set billing_start_at)
 */
export async function activateUserBilling(userId: number, actorId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (user.billingStartAt) {
      return { success: false, error: "Billing already activated" };
    }

    const now = new Date();
    const nextBillingAt = getNextBillingDate(now);

    await db
      .update(users)
      .set({
        billingStartAt: now,
        nextBillingAt,
        billingStatus: "active",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await logAudit({
      userId: actorId,
      userRole: "owner",
      action: "billing_activated",
      targetType: "user",
      targetId: userId.toString(),
      result: "success",
      details: {
        billingStartAt: now,
        nextBillingAt,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[BillingService] Error activating billing:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all users due for billing
 */
export async function getUsersDueForBilling(): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get users where:
  // 1. billing_start_at is set (activated)
  // 2. last_billing_at is null OR > 30 days ago
  // 3. role = 'client' (only clients are billed)
  const dueUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`${users.billingStartAt} IS NOT NULL`,
        sql`${users.role} = 'client'`,
        sql`(${users.lastBillingAt} IS NULL OR ${users.lastBillingAt} <= ${thirtyDaysAgo})`
      )
    );

  return dueUsers.map((u: { id: number }) => u.id);
}

/**
 * Get billing summary for a user
 */
export async function getUserBillingSummary(userId: number): Promise<{
  activeNasCount: number;
  monthlyCost: number;
  billingStatus: string;
  billingStartAt: Date | null;
  lastBillingAt: Date | null;
  nextBillingAt: Date | null;
  daysUntilNextBilling: number | null;
  currentBalance: number;
} | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
  const currentBalance = wallet ? parseFloat(wallet.balance) : 0;

  const { activeNasCount, monthlyCost } = await calculateMonthlyCost(userId);

  let daysUntilNextBilling: number | null = null;
  if (user.nextBillingAt) {
    const now = new Date();
    const next = new Date(user.nextBillingAt);
    daysUntilNextBilling = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    activeNasCount,
    monthlyCost,
    billingStatus: user.billingStatus,
    billingStartAt: user.billingStartAt,
    lastBillingAt: user.lastBillingAt,
    nextBillingAt: user.nextBillingAt,
    daysUntilNextBilling,
    currentBalance,
  };
}
