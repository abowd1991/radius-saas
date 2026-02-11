import { getDb } from "../db";
import { users, nasDevices, systemSettings, walletLedger, wallets } from "../../drizzle/schema";
import { eq, and, lte, isNull, or, sql } from "drizzle-orm";
import { logAudit } from "./auditLogService";

/**
 * SaaS Daily Billing Service
 * 
 * Billing Model:
 * - $0.33/day per active NAS
 * - Billing starts from 1st of month
 * - Daily deduction when NAS is active
 * - Set billing_status = 'past_due' if insufficient balance
 * - Low balance notification when balance ≤ $2
 */

/**
 * Get daily billing rate from system settings
 */
export async function getDailyBillingRate(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "nas_daily_rate"));

  return setting ? parseFloat(setting.value) : 0.33; // Default: $0.33/day
}

/**
 * Calculate daily cost for a user based on active NAS count
 */
export async function calculateDailyCost(userId: number): Promise<{
  activeNasCount: number;
  dailyCost: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Count active NAS devices for this user
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
  const dailyRate = await getDailyBillingRate();
  const dailyCost = activeNasCount * dailyRate;

  return {
    activeNasCount,
    dailyCost,
  };
}

/**
 * Process daily billing for a user
 */
export async function processDailyBilling(
  userId: number,
  actorId?: number
): Promise<{
  success: boolean;
  activeNasCount?: number;
  dailyCost?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  error?: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Check if daily billing is enabled
    if (!user.dailyBillingEnabled) {
      return { success: false, error: "Daily billing not enabled" };
    }

    // Check if user is still in trial period
    if (user.accountStatus === 'trial' && user.trialEndDate) {
      const now = new Date();
      const trialEnd = new Date(user.trialEndDate);
      if (now < trialEnd) {
        return { 
          success: false, 
          error: "User is in trial period - no billing" 
        };
      }
    }

    // Calculate daily cost
    const { activeNasCount, dailyCost } = await calculateDailyCost(userId);

    // Skip if no active NAS
    if (activeNasCount === 0 || dailyCost === 0) {
      // Update last billing date even if no charge
      await db
        .update(users)
        .set({ 
          lastDailyBillingDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return {
        success: true,
        activeNasCount: 0,
        dailyCost: 0,
      };
    }

    // Get wallet balance
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    if (!wallet) {
      return { success: false, error: "Wallet not found" };
    }

    const balanceBefore = parseFloat(wallet.balance);

    // Check if sufficient balance
    if (balanceBefore < dailyCost) {
      // Insufficient balance - set past_due status
      await db
        .update(users)
        .set({
          billingStatus: "past_due",
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

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
          dailyCost,
          balanceBefore,
        },
      });

      return {
        success: false,
        error: "Insufficient balance",
        activeNasCount,
        dailyCost,
        balanceBefore,
      };
    }

    // Deduct from wallet
    const balanceAfter = balanceBefore - dailyCost;
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
      amount: dailyCost.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      reason: `Daily billing: ${activeNasCount} active NAS × $${(await getDailyBillingRate()).toFixed(2)}`,
      reasonAr: `فوترة يومية: ${activeNasCount} NAS نشط × $${(await getDailyBillingRate()).toFixed(2)}`,
      entityType: "billing",
      entityId: userId,
      actorId: actorId || userId,
      actorRole: "system",
      metadata: JSON.stringify({
        activeNasCount,
        dailyRate: await getDailyBillingRate(),
        billingPeriod: "daily",
      }),
      createdAt: new Date(),
    });

    // Update last billing date and status
    await db
      .update(users)
      .set({
        lastDailyBillingDate: new Date(),
        billingStatus: "active",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await logAudit({
      userId: actorId || userId,
      userRole: "system",
      action: "billing_processed",
      targetType: "user",
      targetId: userId.toString(),
      result: "success",
      details: {
        activeNasCount,
        dailyCost,
        balanceBefore,
        balanceAfter,
      },
    });

    return {
      success: true,
      activeNasCount,
      dailyCost,
      balanceBefore,
      balanceAfter,
    };
  } catch (error: any) {
    console.error("[BillingService] Error processing daily billing:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Activate daily billing for a user (set billing_start_at to 1st of current month)
 */
export async function activateDailyBilling(
  userId: number,
  actorId: number
): Promise<{ success: boolean; error?: string }> {
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

    // Set billing start to 1st of current month
    const now = new Date();
    const billingStartAt = new Date(now.getFullYear(), now.getMonth(), 1);

    await db
      .update(users)
      .set({
        billingStartAt,
        dailyBillingEnabled: true,
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
        billingStartAt,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[BillingService] Error activating billing:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get users that need daily billing (haven't been billed today)
 */
export async function getUsersDueForDailyBilling(): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "client"),
        eq(users.dailyBillingEnabled, true),
        sql`${users.billingStartAt} IS NOT NULL`,
        or(
          isNull(users.lastDailyBillingDate),
          sql`DATE(${users.lastDailyBillingDate}) < DATE(${today})`
        )
      )
    );

  return dueUsers.map((u: { id: number }) => u.id);
}

/**
 * Get user billing summary
 */
export async function getUserBillingSummary(userId: number): Promise<{
  activeNasCount: number;
  dailyCost: number;
  billingStatus: string;
  billingStartAt: Date | null;
  lastDailyBillingDate: Date | null;
  dailyBillingEnabled: boolean;
  currentBalance: number;
} | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const { activeNasCount, dailyCost } = await calculateDailyCost(userId);

  // Get current balance
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
  const currentBalance = wallet ? parseFloat(wallet.balance) : 0;

  return {
    activeNasCount,
    dailyCost,
    billingStatus: user.billingStatus,
    billingStartAt: user.billingStartAt,
    lastDailyBillingDate: user.lastDailyBillingDate,
    dailyBillingEnabled: user.dailyBillingEnabled,
    currentBalance,
  };
}

/**
 * Check if user has low balance (≤ $2)
 */
export async function checkLowBalance(userId: number): Promise<{
  isLow: boolean;
  balance: number;
  shouldNotify: boolean;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get current balance
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
  const balance = wallet ? parseFloat(wallet.balance) : 0;

  const isLow = balance <= 2;

  if (!isLow) {
    return { isLow: false, balance, shouldNotify: false };
  }

  // Check if we should notify (last notification was more than 24 hours ago)
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return { isLow, balance, shouldNotify: false };
  }

  const shouldNotify =
    !user.lowBalanceNotifiedAt ||
    new Date().getTime() - new Date(user.lowBalanceNotifiedAt).getTime() >
      24 * 60 * 60 * 1000; // 24 hours

  return { isLow, balance, shouldNotify };
}

/**
 * Mark user as notified for low balance
 */
export async function markLowBalanceNotified(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ 
      lowBalanceNotifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// Backward compatibility exports (for old monthly system)
export const getNasBillingRate = getDailyBillingRate;
export const calculateMonthlyCost = calculateDailyCost;
export const processUserBilling = processDailyBilling;
export const activateUserBilling = activateDailyBilling;
export const getUsersDueForBilling = getUsersDueForDailyBilling;
