import { getDb } from "../db";
import { users, radiusCards, radacct, plans, tenantSubscriptions, wallets, transactions, invoices, nasDevices } from "../../drizzle/schema";
import { eq, and, gte, lte, sql, count, sum, desc, asc, isNull, isNotNull } from "drizzle-orm";

// ============================================================================
// REVENUE REPORTS
// ============================================================================

export interface RevenueData {
  date: string;
  revenue: number;
  transactions: number;
}

export interface RevenueReport {
  totalRevenue: number;
  totalTransactions: number;
  averageTransaction: number;
  revenueByPeriod: RevenueData[];
  revenueByClient: { clientId: number; clientName: string; revenue: number }[];
}

export async function getRevenueReport(
  ownerId: number,
  startDate: Date,
  endDate: Date,
  groupBy: "day" | "week" | "month" = "day"
): Promise<RevenueReport> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Get total revenue from transactions
  const totalResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'credit' THEN ${transactions.amount} ELSE 0 END), 0)`,
      count: count(),
    })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .innerJoin(users, eq(wallets.userId, users.id))
    .where(
      and(
        eq(users.id, ownerId),
        gte(transactions.createdAt, startDate),
        lte(transactions.createdAt, endDate),
        sql`${transactions.type} = 'deposit'`
      )
    );

  const totalRevenue = Number(totalResult[0]?.total || 0);
  const totalTransactions = Number(totalResult[0]?.count || 0);

  // Get revenue by period
  let dateFormat: string;
  switch (groupBy) {
    case "week":
      dateFormat = "%Y-%u"; // Year-Week
      break;
    case "month":
      dateFormat = "%Y-%m"; // Year-Month
      break;
    default:
      dateFormat = "%Y-%m-%d"; // Year-Month-Day
  }

  const revenueByPeriod = await db
    .select({
      date: sql<string>`CAST(DATE(${transactions.createdAt}) AS CHAR)`,
      revenue: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      transactions: count(),
    })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .innerJoin(users, eq(wallets.userId, users.id))
    .where(
      and(
        eq(users.id, ownerId),
        gte(transactions.createdAt, startDate),
        lte(transactions.createdAt, endDate),
        sql`${transactions.type} = 'deposit'`
      )
    )
    .groupBy(sql`DATE(${transactions.createdAt})`)
    .orderBy(asc(sql`DATE(${transactions.createdAt})`));

  // Get revenue by client (for super admin - show all clients)
  const revenueByClient = await db
    .select({
      clientId: users.id,
      clientName: users.name,
      revenue: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .innerJoin(users, eq(wallets.userId, users.id))
    .where(
      and(
        gte(transactions.createdAt, startDate),
        lte(transactions.createdAt, endDate),
        sql`${transactions.type} = 'deposit'`
      )
    )
    .groupBy(users.id, users.name)
    .orderBy(desc(sql`COALESCE(SUM(${transactions.amount}), 0)`))
    .limit(10);

  return {
    totalRevenue,
    totalTransactions,
    averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
    revenueByPeriod: revenueByPeriod.map((r: any) => ({
      date: r.date,
      revenue: Number(r.revenue),
      transactions: Number(r.transactions),
    })),
    revenueByClient: revenueByClient.map((c: any) => ({
      clientId: c.clientId,
      clientName: c.clientName || "غير معروف",
      revenue: Number(c.revenue),
    })),
  };
}

// ============================================================================
// SUBSCRIBERS REPORTS
// ============================================================================

export interface SubscribersReport {
  totalSubscribers: number;
  activeSubscribers: number;
  expiredSubscribers: number;
  suspendedSubscribers: number;
  newSubscribersThisPeriod: number;
  subscriberGrowth: { date: string; count: number }[];
}

export async function getSubscribersReport(
  ownerId: number,
  startDate: Date,
  endDate: Date
): Promise<SubscribersReport> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Get subscriber counts by status
  const statusCounts = await db
    .select({
      status: tenantSubscriptions.status,
      count: count(),
    })
    .from(tenantSubscriptions)
    .groupBy(tenantSubscriptions.status);

  const statusMap: Record<string, number> = {};
  statusCounts.forEach((s: any) => {
    statusMap[s.status] = Number(s.count);
  });

  // Get new subscribers in period
  const newSubscribers = await db
    .select({ count: count() })
    .from(tenantSubscriptions)
    .where(
      and(
        gte(tenantSubscriptions.createdAt, startDate),
        lte(tenantSubscriptions.createdAt, endDate)
      )
    );

  // Get subscriber growth over time
  const subscriberGrowth = await db
    .select({
      date: sql<string>`CAST(DATE(${tenantSubscriptions.createdAt}) AS CHAR)`,
      count: count(),
    })
    .from(tenantSubscriptions)
    .where(
      and(
        gte(tenantSubscriptions.createdAt, startDate),
        lte(tenantSubscriptions.createdAt, endDate)
      )
    )
    .groupBy(sql`DATE(${tenantSubscriptions.createdAt})`)
    .orderBy(asc(sql`DATE(${tenantSubscriptions.createdAt})`));

  return {
    totalSubscribers: Object.values(statusMap).reduce((a, b) => a + b, 0),
    activeSubscribers: statusMap["active"] || 0,
    expiredSubscribers: statusMap["expired"] || 0,
    suspendedSubscribers: statusMap["suspended"] || 0,
    newSubscribersThisPeriod: Number(newSubscribers[0]?.count || 0),
    subscriberGrowth: subscriberGrowth.map((g: any) => ({
      date: g.date,
      count: Number(g.count),
    })),
  };
}

// ============================================================================
// CARDS & PLANS REPORTS
// ============================================================================

export interface CardsReport {
  totalCards: number;
  unusedCards: number;
  activeCards: number;
  usedCards: number;
  expiredCards: number;
  bestSellingPlans: { planId: number; planName: string; count: number; revenue: number }[];
  cardsByStatus: { status: string; count: number }[];
  timeConsumptionByCard: { cardId: number; username: string; totalTime: number; planName: string }[];
}

export async function getCardsReport(
  ownerId: number,
  startDate: Date,
  endDate: Date
): Promise<CardsReport> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Get card counts by status
  const cardStatusCounts = await db
    .select({
      status: radiusCards.status,
      count: count(),
    })
    .from(radiusCards)
    .where(eq(radiusCards.createdBy, ownerId))
    .groupBy(radiusCards.status);

  const statusMap: Record<string, number> = {};
  cardStatusCounts.forEach((s: any) => {
    statusMap[s.status] = Number(s.count);
  });

  // Get best selling plans
  const bestSellingPlans = await db
    .select({
      planId: radiusCards.planId,
      planName: plans.name,
      count: count(),
      revenue: sql<number>`COALESCE(SUM(${radiusCards.salePrice}), 0)`,
    })
    .from(radiusCards)
    .innerJoin(plans, eq(radiusCards.planId, plans.id))
    .where(
      and(
        eq(radiusCards.createdBy, ownerId),
        gte(radiusCards.createdAt, startDate),
        lte(radiusCards.createdAt, endDate)
      )
    )
    .groupBy(radiusCards.planId, plans.name)
    .orderBy(desc(count()))
    .limit(10);

  // Get time consumption by card (top 20)
  const timeConsumption = await db
    .select({
      cardId: radiusCards.id,
      username: radiusCards.username,
      totalTime: radiusCards.totalSessionTime,
      planName: plans.name,
    })
    .from(radiusCards)
    .innerJoin(plans, eq(radiusCards.planId, plans.id))
    .where(
      and(
        eq(radiusCards.createdBy, ownerId),
        isNotNull(radiusCards.totalSessionTime)
      )
    )
    .orderBy(desc(radiusCards.totalSessionTime))
    .limit(20);

  return {
    totalCards: Object.values(statusMap).reduce((a, b) => a + b, 0),
    unusedCards: statusMap["unused"] || 0,
    activeCards: statusMap["active"] || 0,
    usedCards: statusMap["used"] || 0,
    expiredCards: statusMap["expired"] || 0,
    bestSellingPlans: bestSellingPlans.map((p: any) => ({
      planId: p.planId,
      planName: p.planName || "غير معروف",
      count: Number(p.count),
      revenue: Number(p.revenue),
    })),
    cardsByStatus: cardStatusCounts.map((s: any) => ({
      status: s.status,
      count: Number(s.count),
    })),
    timeConsumptionByCard: timeConsumption.map((t: any) => ({
      cardId: t.cardId,
      username: t.username,
      totalTime: Number(t.totalTime || 0),
      planName: t.planName || "غير معروف",
    })),
  };
}

// ============================================================================
// SESSIONS REPORTS
// ============================================================================

export interface SessionsReport {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  averageSessionDuration: number;
  totalSessionTime: number;
  sessionsByDay: { date: string; count: number; duration: number }[];
  sessionsByNas: { nasIp: string; nasName: string; count: number }[];
}

export async function getSessionsReport(
  ownerId: number,
  startDate: Date,
  endDate: Date
): Promise<SessionsReport> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Get total sessions
  const totalResult = await db
    .select({
      total: count(),
      active: sql<number>`SUM(CASE WHEN ${radacct.acctstoptime} IS NULL THEN 1 ELSE 0 END)`,
      completed: sql<number>`SUM(CASE WHEN ${radacct.acctstoptime} IS NOT NULL THEN 1 ELSE 0 END)`,
      totalTime: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`,
    })
    .from(radacct)
    .innerJoin(nasDevices, eq(radacct.nasipaddress, nasDevices.nasname))
    .where(
      and(
        eq(nasDevices.ownerId, ownerId),
        gte(radacct.acctstarttime, startDate),
        lte(radacct.acctstarttime, endDate)
      )
    );

  const totalSessions = Number(totalResult[0]?.total || 0);
  const activeSessions = Number(totalResult[0]?.active || 0);
  const completedSessions = Number(totalResult[0]?.completed || 0);
  const totalSessionTime = Number(totalResult[0]?.totalTime || 0);

  // Get sessions by day
  const sessionsByDay = await db
    .select({
      date: sql<string>`CAST(DATE(${radacct.acctstarttime}) AS CHAR)`,
      count: count(),
      duration: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`,
    })
    .from(radacct)
    .innerJoin(nasDevices, eq(radacct.nasipaddress, nasDevices.nasname))
    .where(
      and(
        eq(nasDevices.ownerId, ownerId),
        gte(radacct.acctstarttime, startDate),
        lte(radacct.acctstarttime, endDate)
      )
    )
    .groupBy(sql`DATE(${radacct.acctstarttime})`)
    .orderBy(asc(sql`DATE(${radacct.acctstarttime})`));

  // Get sessions by NAS
  const sessionsByNas = await db
    .select({
      nasIp: radacct.nasipaddress,
      nasName: nasDevices.shortname,
      count: count(),
    })
    .from(radacct)
    .innerJoin(nasDevices, eq(radacct.nasipaddress, nasDevices.nasname))
    .where(
      and(
        eq(nasDevices.ownerId, ownerId),
        gte(radacct.acctstarttime, startDate),
        lte(radacct.acctstarttime, endDate)
      )
    )
    .groupBy(radacct.nasipaddress, nasDevices.shortname)
    .orderBy(desc(count()))
    .limit(10);

  return {
    totalSessions,
    activeSessions,
    completedSessions,
    averageSessionDuration: completedSessions > 0 ? totalSessionTime / completedSessions : 0,
    totalSessionTime,
    sessionsByDay: sessionsByDay.map((s: any) => ({
      date: s.date,
      count: Number(s.count),
      duration: Number(s.duration),
    })),
    sessionsByNas: sessionsByNas.map((s: any) => ({
      nasIp: s.nasIp,
      nasName: s.nasName || s.nasIp,
      count: Number(s.count),
    })),
  };
}

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

export interface DashboardSummary {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    growth: number; // percentage
  };
  subscribers: {
    total: number;
    active: number;
    new: number;
  };
  cards: {
    total: number;
    active: number;
    unused: number;
  };
  sessions: {
    active: number;
    today: number;
  };
}

export async function getDashboardSummary(ownerId: number): Promise<DashboardSummary> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Revenue calculations
  const revenueToday = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(
      and(
        eq(wallets.userId, ownerId),
        gte(transactions.createdAt, todayStart),
        sql`${transactions.type} = 'deposit'`
      )
    );

  const revenueThisWeek = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(
      and(
        eq(wallets.userId, ownerId),
        gte(transactions.createdAt, weekStart),
        sql`${transactions.type} = 'deposit'`
      )
    );

  const revenueThisMonth = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(
      and(
        eq(wallets.userId, ownerId),
        gte(transactions.createdAt, monthStart),
        sql`${transactions.type} = 'deposit'`
      )
    );

  const revenueLastMonth = await db
    .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .where(
      and(
        eq(wallets.userId, ownerId),
        gte(transactions.createdAt, lastMonthStart),
        lte(transactions.createdAt, lastMonthEnd),
        sql`${transactions.type} = 'deposit'`
      )
    );

  const thisMonthRev = Number(revenueThisMonth[0]?.total || 0);
  const lastMonthRev = Number(revenueLastMonth[0]?.total || 0);
  const growth = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

  // Subscribers
  const subscriberStats = await db
    .select({
      total: count(),
      active: sql<number>`SUM(CASE WHEN ${tenantSubscriptions.status} = 'active' THEN 1 ELSE 0 END)`,
    })
    .from(tenantSubscriptions);

  const newSubscribers = await db
    .select({ count: count() })
    .from(tenantSubscriptions)
    .where(gte(tenantSubscriptions.createdAt, monthStart));

  // Cards
  const cardStats = await db
    .select({
      total: count(),
      active: sql<number>`SUM(CASE WHEN ${radiusCards.status} = 'active' THEN 1 ELSE 0 END)`,
      unused: sql<number>`SUM(CASE WHEN ${radiusCards.status} = 'unused' THEN 1 ELSE 0 END)`,
    })
    .from(radiusCards)
    .where(eq(radiusCards.createdBy, ownerId));

  // Sessions
  const activeSessions = await db
    .select({ count: count() })
    .from(radacct)
    .innerJoin(nasDevices, eq(radacct.nasipaddress, nasDevices.nasname))
    .where(
      and(
        eq(nasDevices.ownerId, ownerId),
        isNull(radacct.acctstoptime)
      )
    );

  const todaySessions = await db
    .select({ count: count() })
    .from(radacct)
    .innerJoin(nasDevices, eq(radacct.nasipaddress, nasDevices.nasname))
    .where(
      and(
        eq(nasDevices.ownerId, ownerId),
        gte(radacct.acctstarttime, todayStart)
      )
    );

  return {
    revenue: {
      today: Number(revenueToday[0]?.total || 0),
      thisWeek: Number(revenueThisWeek[0]?.total || 0),
      thisMonth: thisMonthRev,
      growth: Math.round(growth * 100) / 100,
    },
    subscribers: {
      total: Number(subscriberStats[0]?.total || 0),
      active: Number(subscriberStats[0]?.active || 0),
      new: Number(newSubscribers[0]?.count || 0),
    },
    cards: {
      total: Number(cardStats[0]?.total || 0),
      active: Number(cardStats[0]?.active || 0),
      unused: Number(cardStats[0]?.unused || 0),
    },
    sessions: {
      active: Number(activeSessions[0]?.count || 0),
      today: Number(todaySessions[0]?.count || 0),
    },
  };
}

// ============================================================================
// USAGE REPORTS (Peak Hours & Daily/Weekly)
// ============================================================================

export interface UsageReport {
  // Peak hours analysis
  peakHours: { hour: number; sessions: number; totalTime: number }[];
  // Daily usage
  dailyUsage: { date: string; sessions: number; totalTime: number; uniqueUsers: number }[];
  // Weekly summary
  weeklySummary: {
    weekNumber: number;
    startDate: string;
    endDate: string;
    sessions: number;
    totalTime: number;
    uniqueUsers: number;
    avgSessionDuration: number;
  }[];
  // Top users by time
  topUsersByTime: { username: string; totalTime: number; sessions: number }[];
  // Summary stats
  summary: {
    totalSessions: number;
    totalTime: number;
    uniqueUsers: number;
    avgSessionDuration: number;
    peakHour: number;
    peakDay: string;
  };
}

export async function getUsageReport(
  ownerId: number,
  startDate: Date,
  endDate: Date
): Promise<UsageReport> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Get peak hours (sessions by hour of day)
  const peakHours = await db
    .select({
      hour: sql<number>`HOUR(${radacct.acctstarttime})`,
      sessions: count(),
      totalTime: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`,
    })
    .from(radacct)
    .innerJoin(nasDevices, eq(radacct.nasipaddress, nasDevices.nasname))
    .where(
      and(
        eq(nasDevices.ownerId, ownerId),
        gte(radacct.acctstarttime, startDate),
        lte(radacct.acctstarttime, endDate)
      )
    )
    .groupBy(sql`HOUR(${radacct.acctstarttime})`)
    .orderBy(sql`HOUR(${radacct.acctstarttime})`);

  // Get daily usage
  const dailyUsage = await db
    .select({
      date: sql<string>`CAST(DATE(${radacct.acctstarttime}) AS CHAR)`,
      sessions: count(),
      totalTime: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${radacct.username})`,
    })
    .from(radacct)
    .innerJoin(nasDevices, eq(radacct.nasipaddress, nasDevices.nasname))
    .where(
      and(
        eq(nasDevices.ownerId, ownerId),
        gte(radacct.acctstarttime, startDate),
        lte(radacct.acctstarttime, endDate)
      )
    )
    .groupBy(sql`DATE(${radacct.acctstarttime})`)
    .orderBy(asc(sql`DATE(${radacct.acctstarttime})`));

  // Get weekly summary
  const weeklySummary = await db
    .select({
      weekNumber: sql<number>`WEEK(${radacct.acctstarttime}, 1)`,
      startDate: sql<string>`CAST(DATE(DATE_SUB(${radacct.acctstarttime}, INTERVAL WEEKDAY(${radacct.acctstarttime}) DAY)) AS CHAR)`,
      endDate: sql<string>`CAST(DATE(DATE_ADD(DATE_SUB(${radacct.acctstarttime}, INTERVAL WEEKDAY(${radacct.acctstarttime}) DAY), INTERVAL 6 DAY)) AS CHAR)`,
      sessions: count(),
      totalTime: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${radacct.username})`,
    })
    .from(radacct)
    .innerJoin(nasDevices, eq(radacct.nasipaddress, nasDevices.nasname))
    .where(
      and(
        eq(nasDevices.ownerId, ownerId),
        gte(radacct.acctstarttime, startDate),
        lte(radacct.acctstarttime, endDate)
      )
    )
    .groupBy(
      sql`WEEK(${radacct.acctstarttime}, 1)`,
      sql`DATE(DATE_SUB(${radacct.acctstarttime}, INTERVAL WEEKDAY(${radacct.acctstarttime}) DAY))`,
      sql`DATE(DATE_ADD(DATE_SUB(${radacct.acctstarttime}, INTERVAL WEEKDAY(${radacct.acctstarttime}) DAY), INTERVAL 6 DAY))`
    )
    .orderBy(sql`WEEK(${radacct.acctstarttime}, 1)`);

  // Get top users by time
  const topUsersByTime = await db
    .select({
      username: radacct.username,
      totalTime: sql<number>`COALESCE(SUM(${radacct.acctsessiontime}), 0)`,
      sessions: count(),
    })
    .from(radacct)
    .innerJoin(nasDevices, eq(radacct.nasipaddress, nasDevices.nasname))
    .where(
      and(
        eq(nasDevices.ownerId, ownerId),
        gte(radacct.acctstarttime, startDate),
        lte(radacct.acctstarttime, endDate)
      )
    )
    .groupBy(radacct.username)
    .orderBy(desc(sql`COALESCE(SUM(${radacct.acctsessiontime}), 0)`))
    .limit(20);

  // Calculate summary
  const totalSessions = dailyUsage.reduce((sum: number, d: any) => sum + Number(d.sessions), 0);
  const totalTime = dailyUsage.reduce((sum: number, d: any) => sum + Number(d.totalTime), 0);
  const uniqueUsersSet = new Set(topUsersByTime.map((u: any) => u.username));
  
  // Find peak hour
  const peakHourData = peakHours.reduce((max: any, h: any) => 
    Number(h.sessions) > Number(max?.sessions || 0) ? h : max, 
    peakHours[0]
  );
  
  // Find peak day
  const peakDayData = dailyUsage.reduce((max: any, d: any) => 
    Number(d.sessions) > Number(max?.sessions || 0) ? d : max,
    dailyUsage[0]
  );

  return {
    peakHours: peakHours.map((h: any) => ({
      hour: Number(h.hour),
      sessions: Number(h.sessions),
      totalTime: Number(h.totalTime),
    })),
    dailyUsage: dailyUsage.map((d: any) => ({
      date: d.date,
      sessions: Number(d.sessions),
      totalTime: Number(d.totalTime),
      uniqueUsers: Number(d.uniqueUsers),
    })),
    weeklySummary: weeklySummary.map((w: any) => ({
      weekNumber: Number(w.weekNumber),
      startDate: w.startDate,
      endDate: w.endDate,
      sessions: Number(w.sessions),
      totalTime: Number(w.totalTime),
      uniqueUsers: Number(w.uniqueUsers),
      avgSessionDuration: Number(w.sessions) > 0 ? Number(w.totalTime) / Number(w.sessions) : 0,
    })),
    topUsersByTime: topUsersByTime.map((u: any) => ({
      username: u.username,
      totalTime: Number(u.totalTime),
      sessions: Number(u.sessions),
    })),
    summary: {
      totalSessions,
      totalTime,
      uniqueUsers: uniqueUsersSet.size,
      avgSessionDuration: totalSessions > 0 ? totalTime / totalSessions : 0,
      peakHour: Number(peakHourData?.hour || 0),
      peakDay: peakDayData?.date || '',
    },
  };
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}س ${minutes}د`;
  } else if (minutes > 0) {
    return `${minutes}د ${secs}ث`;
  }
  return `${secs}ث`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
