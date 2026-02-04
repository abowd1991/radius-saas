import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { users, nasDevices, wallets } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  calculateMonthlyCost,
  processUserBilling,
  activateUserBilling,
  getUserBillingSummary,
  getNasBillingRate,
} from "./services/billingService";

describe("SaaS Billing System", () => {
  let testUserId: number;
  let ownerUserId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Find an owner user
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.role, "owner"))
      .limit(1);

    if (!owner) {
      throw new Error("No owner user found. Please create an owner user first.");
    }

    ownerUserId = owner.id;

    // Find a client user for testing
    const [client] = await db
      .select()
      .from(users)
      .where(eq(users.role, "client"))
      .limit(1);

    if (!client) {
      throw new Error("No client user found. Please create a client user first.");
    }

    testUserId = client.id;
  });

  it("should get NAS billing rate from settings", async () => {
    const rate = await getNasBillingRate();
    expect(rate).toBe(10);
  });

  it("should calculate monthly cost based on active NAS count", async () => {
    const result = await calculateMonthlyCost(testUserId);
    
    expect(result).toHaveProperty("activeNasCount");
    expect(result).toHaveProperty("monthlyCost");
    expect(typeof result.activeNasCount).toBe("number");
    expect(typeof result.monthlyCost).toBe("number");
    
    // Cost should be activeNasCount * 10
    expect(result.monthlyCost).toBe(result.activeNasCount * 10);
  });

  it("should activate billing for a user", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Reset billing fields first
    await db
      .update(users)
      .set({
        billingStartAt: null,
        lastBillingAt: null,
        nextBillingAt: null,
        billingStatus: "active",
      })
      .where(eq(users.id, testUserId));

    // Activate billing
    const result = await activateUserBilling(testUserId, ownerUserId);
    expect(result.success).toBe(true);

    // Verify billing was activated
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.billingStartAt).not.toBeNull();
    expect(user.nextBillingAt).not.toBeNull();
    expect(user.billingStatus).toBe("active");
  });

  it("should not activate billing twice", async () => {
    // Try to activate again
    const result = await activateUserBilling(testUserId, ownerUserId);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Billing already activated");
  });

  it("should get user billing summary", async () => {
    const summary = await getUserBillingSummary(testUserId);
    
    expect(summary).not.toBeNull();
    expect(summary).toHaveProperty("activeNasCount");
    expect(summary).toHaveProperty("monthlyCost");
    expect(summary).toHaveProperty("billingStatus");
    expect(summary).toHaveProperty("currentBalance");
    expect(summary).toHaveProperty("billingStartAt");
    expect(summary).toHaveProperty("nextBillingAt");
  });

  it("should process billing successfully with sufficient balance", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Ensure user has sufficient balance
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, testUserId));
    
    if (!wallet) {
      // Create wallet if doesn't exist
      await db.insert(wallets).values({
        userId: testUserId,
        balance: "1000.00",
        currency: "USD",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Update balance to ensure sufficient funds
      await db
        .update(wallets)
        .set({ balance: "1000.00", updatedAt: new Date() })
        .where(eq(wallets.userId, testUserId));
    }

    // Get cost before billing
    const { monthlyCost } = await calculateMonthlyCost(testUserId);

    // Process billing
    const result = await processUserBilling(testUserId, ownerUserId);
    
    if (monthlyCost === 0) {
      // No active NAS, billing should succeed but skip
      expect(result.success).toBe(true);
      expect(result.activeNasCount).toBe(0);
    } else {
      // Has active NAS, billing should process
      expect(result.success).toBe(true);
      expect(result.monthlyCost).toBe(monthlyCost);
      expect(result.balanceBefore).toBeGreaterThanOrEqual(monthlyCost);
      expect(result.balanceAfter).toBe(result.balanceBefore - monthlyCost);
    }
  });

  it("should fail billing with insufficient balance", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get cost
    const { monthlyCost } = await calculateMonthlyCost(testUserId);

    // Skip if no active NAS
    if (monthlyCost === 0) {
      console.log("Skipping insufficient balance test - no active NAS");
      return;
    }

    // Set balance to less than cost
    await db
      .update(wallets)
      .set({ balance: "5.00", updatedAt: new Date() })
      .where(eq(wallets.userId, testUserId));

    // Process billing
    const result = await processUserBilling(testUserId, ownerUserId);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe("Insufficient balance");

    // Verify user status changed to past_due
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.billingStatus).toBe("past_due");
  });

  it("should calculate cost correctly for multiple NAS", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Count active NAS
    const activeNas = await db
      .select()
      .from(nasDevices)
      .where(eq(nasDevices.ownerId, testUserId));

    const activeCount = activeNas.filter((nas) => nas.status === "active").length;

    const result = await calculateMonthlyCost(testUserId);
    
    expect(result.activeNasCount).toBe(activeCount);
    expect(result.monthlyCost).toBe(activeCount * 10);
  });
});
