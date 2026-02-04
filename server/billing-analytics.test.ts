import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { users, wallets, walletLedger } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  getDailyRevenue,
  getMonthlyRevenue,
  getTotalRevenue,
  getClientsByBillingStatus,
  getAverageClientBalance,
  getLowBalanceClients,
  getRevenueHistory,
  getDashboardStats,
} from "./services/billingAnalyticsService";

describe("Billing Analytics Service", () => {
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

  it("should get daily revenue", async () => {
    const revenue = await getDailyRevenue();
    expect(typeof revenue).toBe("number");
    expect(revenue).toBeGreaterThanOrEqual(0);
  });

  it("should get monthly revenue", async () => {
    const revenue = await getMonthlyRevenue();
    expect(typeof revenue).toBe("number");
    expect(revenue).toBeGreaterThanOrEqual(0);
  });

  it("should get total revenue", async () => {
    const revenue = await getTotalRevenue();
    expect(typeof revenue).toBe("number");
    expect(revenue).toBeGreaterThanOrEqual(0);
  });

  it("should get clients by billing status", async () => {
    const statusCounts = await getClientsByBillingStatus();
    
    expect(statusCounts).toHaveProperty("active");
    expect(statusCounts).toHaveProperty("pastDue");
    expect(statusCounts).toHaveProperty("suspended");
    
    expect(typeof statusCounts.active).toBe("number");
    expect(typeof statusCounts.pastDue).toBe("number");
    expect(typeof statusCounts.suspended).toBe("number");
    
    expect(statusCounts.active).toBeGreaterThanOrEqual(0);
    expect(statusCounts.pastDue).toBeGreaterThanOrEqual(0);
    expect(statusCounts.suspended).toBeGreaterThanOrEqual(0);
  });

  it("should get average client balance", async () => {
    const avgBalance = await getAverageClientBalance();
    expect(typeof avgBalance).toBe("number");
    expect(avgBalance).toBeGreaterThanOrEqual(0);
  });

  it("should get low balance clients", async () => {
    const lowBalanceClients = await getLowBalanceClients();
    
    expect(Array.isArray(lowBalanceClients)).toBe(true);
    
    // If there are low balance clients, verify structure
    if (lowBalanceClients.length > 0) {
      const client = lowBalanceClients[0];
      expect(client).toHaveProperty("id");
      expect(client).toHaveProperty("username");
      expect(client).toHaveProperty("email");
      expect(client).toHaveProperty("balance");
      expect(client).toHaveProperty("activeNasCount");
      expect(client).toHaveProperty("billingStatus");
      
      // Verify balance is <= 5
      expect(client.balance).toBeLessThanOrEqual(5);
    }
  });

  it("should get revenue history", async () => {
    const history = await getRevenueHistory(30);
    
    expect(Array.isArray(history)).toBe(true);
    
    // If there is history, verify structure
    if (history.length > 0) {
      const dataPoint = history[0];
      expect(dataPoint).toHaveProperty("date");
      expect(dataPoint).toHaveProperty("revenue");
      expect(typeof dataPoint.revenue).toBe("number");
      expect(dataPoint.revenue).toBeGreaterThanOrEqual(0);
    }
  });

  it("should get complete dashboard stats", async () => {
    const stats = await getDashboardStats();
    
    expect(stats).toHaveProperty("dailyRevenue");
    expect(stats).toHaveProperty("monthlyRevenue");
    expect(stats).toHaveProperty("totalRevenue");
    expect(stats).toHaveProperty("activeClients");
    expect(stats).toHaveProperty("pastDueClients");
    expect(stats).toHaveProperty("suspendedClients");
    expect(stats).toHaveProperty("averageBalance");
    expect(stats).toHaveProperty("lowBalanceCount");
    
    expect(typeof stats.dailyRevenue).toBe("number");
    expect(typeof stats.monthlyRevenue).toBe("number");
    expect(typeof stats.totalRevenue).toBe("number");
    expect(typeof stats.activeClients).toBe("number");
    expect(typeof stats.pastDueClients).toBe("number");
    expect(typeof stats.suspendedClients).toBe("number");
    expect(typeof stats.averageBalance).toBe("number");
    expect(typeof stats.lowBalanceCount).toBe("number");
    
    // All values should be non-negative
    expect(stats.dailyRevenue).toBeGreaterThanOrEqual(0);
    expect(stats.monthlyRevenue).toBeGreaterThanOrEqual(0);
    expect(stats.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(stats.activeClients).toBeGreaterThanOrEqual(0);
    expect(stats.pastDueClients).toBeGreaterThanOrEqual(0);
    expect(stats.suspendedClients).toBeGreaterThanOrEqual(0);
    expect(stats.averageBalance).toBeGreaterThanOrEqual(0);
    expect(stats.lowBalanceCount).toBeGreaterThanOrEqual(0);
  });
});
