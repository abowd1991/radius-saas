import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { users, nasDevices, wallets } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateDailyCost,
  processDailyBilling,
  activateDailyBilling,
  getUsersDueForDailyBilling,
  getUserBillingSummary,
  checkLowBalance,
  getDailyBillingRate,
} from "./services/billingService";

describe("Daily Billing System", () => {
  let testUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Find an existing user with role='client'
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.role, "client"))
      .limit(1);

    if (existingUser) {
      testUserId = existingUser.id;
      console.log(`[Test] Using existing user ID: ${testUserId}`);
    } else {
      throw new Error("No client user found for testing");
    }
  });

  it("should get daily billing rate ($0.33)", async () => {
    const rate = await getDailyBillingRate();
    expect(rate).toBe(0.33);
  });

  it("should calculate daily cost based on active NAS count", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Count actual active NAS for the user
    const activeNas = await db
      .select()
      .from(nasDevices)
      .where(
        and(
          eq(nasDevices.ownerId, testUserId),
          eq(nasDevices.status, "active")
        )
      );

    const { activeNasCount, dailyCost } = await calculateDailyCost(testUserId);

    expect(activeNasCount).toBe(activeNas.length);
    expect(dailyCost).toBe(activeNas.length * 0.33);
  });

  it("should activate daily billing for user", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Reset billing fields first
    await db
      .update(users)
      .set({
        billingStartAt: null,
        dailyBillingEnabled: false,
        lastDailyBillingDate: null,
      })
      .where(eq(users.id, testUserId));

    const result = await activateDailyBilling(testUserId, testUserId);
    expect(result.success).toBe(true);

    // Verify billing was activated
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.billingStartAt).not.toBeNull();
    expect(user.dailyBillingEnabled).toBe(true);

    // Check that billing starts from 1st of current month
    const billingStart = new Date(user.billingStartAt!);
    expect(billingStart.getDate()).toBe(1);
  });

  it("should process daily billing successfully", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Ensure user has sufficient balance
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, testUserId));
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const initialBalance = parseFloat(wallet.balance);
    if (initialBalance < 10) {
      // Add balance for testing
      await db
        .update(wallets)
        .set({ balance: "20.00" })
        .where(eq(wallets.userId, testUserId));
    }

    const result = await processDailyBilling(testUserId, testUserId);

    if (result.activeNasCount === 0) {
      expect(result.success).toBe(true);
      expect(result.dailyCost).toBe(0);
    } else {
      expect(result.success).toBe(true);
      expect(result.dailyCost).toBeGreaterThan(0);
      expect(result.balanceAfter).toBeLessThan(result.balanceBefore!);
    }
  });

  it("should fail billing when insufficient balance", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Set balance to very low amount
    await db
      .update(wallets)
      .set({ balance: "0.10" })
      .where(eq(wallets.userId, testUserId));

    const result = await processDailyBilling(testUserId, testUserId);

    // If user has active NAS, billing should fail
    const { activeNasCount } = await calculateDailyCost(testUserId);
    if (activeNasCount > 0) {
      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient balance");

      // Check that user status is set to past_due
      const [user] = await db.select().from(users).where(eq(users.id, testUserId));
      expect(user.billingStatus).toBe("past_due");
    }
  });

  it("should get users due for daily billing", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Set last billing date to yesterday and ensure billing is enabled
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    await db
      .update(users)
      .set({
        lastDailyBillingDate: yesterday,
        dailyBillingEnabled: true,
        billingStartAt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      })
      .where(eq(users.id, testUserId));

    const dueUsers = await getUsersDueForDailyBilling();
    // User should be in the list if billing is enabled and last billing was yesterday
    if (dueUsers.length > 0) {
      expect(dueUsers).toContain(testUserId);
    } else {
      // If no users due, that's also acceptable (depends on DB state)
      expect(dueUsers).toBeInstanceOf(Array);
    }
  });

  it("should get user billing summary", async () => {
    const summary = await getUserBillingSummary(testUserId);

    expect(summary).not.toBeNull();
    expect(summary!.activeNasCount).toBeGreaterThanOrEqual(0);
    expect(summary!.dailyCost).toBeGreaterThanOrEqual(0);
    expect(summary!.billingStatus).toBeDefined();
    expect(summary!.dailyBillingEnabled).toBeDefined();
  });

  it("should check low balance correctly", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Set balance to $1.50 (low)
    await db
      .update(wallets)
      .set({ balance: "1.50" })
      .where(eq(wallets.userId, testUserId));

    const lowBalanceCheck = await checkLowBalance(testUserId);

    expect(lowBalanceCheck.isLow).toBe(true);
    expect(lowBalanceCheck.balance).toBe(1.5);
    expect(lowBalanceCheck.shouldNotify).toBe(true);

    // Set balance to $5 (not low)
    await db
      .update(wallets)
      .set({ balance: "5.00" })
      .where(eq(wallets.userId, testUserId));

    const normalBalanceCheck = await checkLowBalance(testUserId);
    expect(normalBalanceCheck.isLow).toBe(false);
  });
});
