import { getDb } from "../db";
import { users, wallets, walletLedger } from "../../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

/**
 * Billing Analytics Service
 * Provides statistics and insights for owner dashboard
 */

interface DashboardStats {
  dailyRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
  activeClients: number;
  pastDueClients: number;
  suspendedClients: number;
  averageBalance: number;
  lowBalanceCount: number;
}

interface RevenueDataPoint {
  date: string;
  revenue: number;
}

interface LowBalanceClient {
  id: number;
  username: string;
  email: string;
  balance: number;
  activeNasCount: number;
  billingStatus: string;
  lastDailyBillingDate: Date | null;
}

/**
 * Get daily revenue (today)
 */
export async function getDailyRevenue(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await db
    .select({
      total: sql<number>`SUM(CAST(${walletLedger.amount} AS DECIMAL(10,2)))`,
    })
    .from(walletLedger)
    .where(
      and(
        eq(walletLedger.type, "debit"),
        eq(walletLedger.entityType, "billing"),
        gte(walletLedger.createdAt, today),
        lte(walletLedger.createdAt, tomorrow)
      )
    );

  return Number(result[0]?.total || 0);
}

/**
 * Get monthly revenue (current month)
 */
export async function getMonthlyRevenue(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const result = await db
    .select({
      total: sql<number>`SUM(CAST(${walletLedger.amount} AS DECIMAL(10,2)))`,
    })
    .from(walletLedger)
    .where(
      and(
        eq(walletLedger.type, "debit"),
        eq(walletLedger.entityType, "billing"),
        gte(walletLedger.createdAt, firstDayOfMonth),
        lte(walletLedger.createdAt, firstDayOfNextMonth)
      )
    );

  return Number(result[0]?.total || 0);
}

/**
 * Get total revenue (all time)
 */
export async function getTotalRevenue(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      total: sql<number>`SUM(CAST(${walletLedger.amount} AS DECIMAL(10,2)))`,
    })
    .from(walletLedger)
    .where(
      and(
        eq(walletLedger.type, "debit"),
        eq(walletLedger.entityType, "billing")
      )
    );

  return Number(result[0]?.total || 0);
}

/**
 * Get clients count by billing status
 */
export async function getClientsByBillingStatus(): Promise<{
  active: number;
  pastDue: number;
  suspended: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const activeResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(
      and(
        eq(users.role, "client"),
        eq(users.billingStatus, "active")
      )
    );

  const pastDueResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(
      and(
        eq(users.role, "client"),
        eq(users.billingStatus, "past_due")
      )
    );

  const suspendedResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(users)
    .where(
      and(
        eq(users.role, "client"),
        eq(users.billingStatus, "suspended")
      )
    );

  return {
    active: Number(activeResult[0]?.count || 0),
    pastDue: Number(pastDueResult[0]?.count || 0),
    suspended: Number(suspendedResult[0]?.count || 0),
  };
}

/**
 * Get average client balance
 */
export async function getAverageClientBalance(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      avg: sql<number>`AVG(CAST(${wallets.balance} AS DECIMAL(10,2)))`,
    })
    .from(wallets)
    .innerJoin(users, eq(wallets.userId, users.id))
    .where(eq(users.role, "client"));

  return Number(result[0]?.avg || 0);
}

/**
 * Get clients with low balance (<= $5)
 */
export async function getLowBalanceClients(): Promise<LowBalanceClient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const lowBalanceUsers = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      balance: wallets.balance,
      billingStatus: users.billingStatus,
      lastDailyBillingDate: users.lastDailyBillingDate,
    })
    .from(users)
    .innerJoin(wallets, eq(wallets.userId, users.id))
    .where(
      and(
        eq(users.role, "client"),
        sql`CAST(${wallets.balance} AS DECIMAL(10,2)) <= 5.00`
      )
    )
    .orderBy(wallets.balance);

  // Get NAS count for each user
  const clientsWithNas = await Promise.all(
    lowBalanceUsers.map(async (user: any) => {
      const nasCount = await db.execute(
        sql`SELECT COUNT(*) as count FROM nas WHERE ownerId = ${user.id} AND status = 'active'`
      );
      return {
        ...user,
        balance: parseFloat(user.balance),
        activeNasCount: Number((nasCount[0] as any)?.count || 0),
      };
    })
  );

  return clientsWithNas;
}

/**
 * Get revenue history for last N days
 */
export async function getRevenueHistory(days: number = 30): Promise<RevenueDataPoint[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const result = await db.execute(
    sql`
      SELECT 
        DATE(createdAt) as date,
        SUM(CAST(amount AS DECIMAL(10,2))) as revenue
      FROM wallet_ledger
      WHERE type = 'debit' 
        AND entityType = 'billing'
        AND createdAt >= ${startDate}
      GROUP BY DATE(createdAt)
      ORDER BY DATE(createdAt)
    `
  );

  return (result as any[]).map((row: any) => ({
    date: row.date,
    revenue: Number(row.revenue || 0),
  }));
}

/**
 * Get complete dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    dailyRevenue,
    monthlyRevenue,
    totalRevenue,
    clientsByStatus,
    averageBalance,
    lowBalanceClients,
  ] = await Promise.all([
    getDailyRevenue(),
    getMonthlyRevenue(),
    getTotalRevenue(),
    getClientsByBillingStatus(),
    getAverageClientBalance(),
    getLowBalanceClients(),
  ]);

  return {
    dailyRevenue,
    monthlyRevenue,
    totalRevenue,
    activeClients: clientsByStatus.active,
    pastDueClients: clientsByStatus.pastDue,
    suspendedClients: clientsByStatus.suspended,
    averageBalance,
    lowBalanceCount: lowBalanceClients.length,
  };
}
