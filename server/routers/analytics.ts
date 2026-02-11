import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";

const analyticsRouter = router({
  // Revenue trend - last N days
  revenueTrend: protectedProcedure
    .input(z.object({
      days: z.number().min(7).max(365).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const { days } = input;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const ownerCondition = ctx.user.role === 'super_admin' || ctx.user.role === 'owner'
        ? '1=1'
        : `user_id = ${ctx.user.id}`;

      const userCondition = ctx.user.role === 'super_admin' || ctx.user.role === 'owner'
        ? '1=1'
        : `userId = ${ctx.user.id}`;

      const result = await db.execute(sql.raw(`
        SELECT 
          DATE(createdAt) as date,
          SUM(total) as revenue,
          COUNT(*) as transaction_count
        FROM invoices
        WHERE createdAt >= '${startDate.toISOString()}'
          AND createdAt <= '${endDate.toISOString()}'
          AND status = 'paid'
          AND ${userCondition}
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `));

      return result;
    }),

  // Active sessions trend
  sessionsTrend: protectedProcedure
    .input(z.object({
      days: z.number().min(7).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const { days } = input;
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Owner sees all sessions, clients see only their own
      const ownerCondition = ctx.user.role === 'super_admin' || ctx.user.role === 'owner'
        ? '1=1'
        : `owner_id = ${ctx.user.id}`;

      const result = await db.execute(sql.raw(`
        SELECT 
          DATE(acctstarttime) as date,
          COUNT(DISTINCT username) as unique_users,
          COUNT(*) as total_sessions,
          SUM(TIMESTAMPDIFF(SECOND, acctstarttime, COALESCE(acctstoptime, NOW()))) / 3600 as total_hours
        FROM radacct
        WHERE acctstarttime >= '${startDate.toISOString()}'
          AND acctstarttime <= '${endDate.toISOString()}'
          AND ${ownerCondition}
        GROUP BY DATE(acctstarttime)
        ORDER BY date ASC
      `));

      return result;
    }),

  // NAS health status
  nasHealth: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

    // Owner sees all NAS, clients see only their own
    const ownerCondition = ctx.user.role === 'super_admin' || ctx.user.role === 'owner'
      ? '1=1'
      : `owner_id = ${ctx.user.id}`;

    const result = await db.execute(sql.raw(`
      SELECT 
        status,
        COUNT(*) as count
      FROM nas
      WHERE ${ownerCondition}
      GROUP BY status
    `));

    // Get total active sessions per NAS
    const sessionsResult = await db.execute(sql.raw(`
      SELECT 
        n.nasname,
        n.shortname,
        COUNT(r.username) as active_sessions
      FROM nas n
      LEFT JOIN radacct r ON r.nasipaddress = n.nasname AND r.acctstoptime IS NULL
      WHERE ${ownerCondition}
      GROUP BY n.nasname, n.shortname
      ORDER BY active_sessions DESC
      LIMIT 10
    `));

    return {
      statusCounts: result,
      topNas: sessionsResult,
    };
  }),

  // Dashboard summary stats
  dashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

    // Owner sees all, clients see only their own
    const ownerCondition = ctx.user.role === 'super_admin' || ctx.user.role === 'owner'
      ? '1=1'
      : `owner_id = ${ctx.user.id}`;

    const userCondition = ctx.user.role === 'super_admin' || ctx.user.role === 'owner'
      ? '1=1'
      : `user_id = ${ctx.user.id}`;

    const createdByCondition = ctx.user.role === 'super_admin' || ctx.user.role === 'owner'
      ? '1=1'
      : `created_by = ${ctx.user.id}`;

    // Total revenue (this month)
    const revenueResult = await db.execute(sql.raw(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_revenue,
        COUNT(*) as invoice_count
      FROM invoices
      WHERE status = 'paid'
        AND MONTH(created_at) = MONTH(NOW())
        AND YEAR(created_at) = YEAR(NOW())
        AND ${userCondition}
    `));

    // Active sessions count
    const sessionsResult = await db.execute(sql.raw(`
      SELECT COUNT(*) as active_sessions
      FROM radacct
      WHERE acctstoptime IS NULL
        AND ${ownerCondition}
    `));

    // Total NAS devices
    const nasResult = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) as total_nas,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_nas
      FROM nas
      WHERE ${ownerCondition}
    `));

    // Total vouchers/cards
    const cardsResult = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) as total_cards,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_cards
      FROM radius_cards
      WHERE ${createdByCondition}
    `));

    return {
      revenue: revenueResult[0],
      sessions: sessionsResult[0],
      nas: nasResult[0],
      cards: cardsResult[0],
    };
  }),

  // User growth trend (new registrations per day)
  userGrowth: protectedProcedure
    .input(z.object({
      days: z.number().min(7).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const { days } = input;
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Only super_admin/owner can see all users
      if (ctx.user.role !== 'super_admin' && ctx.user.role !== 'owner') {
        throw new Error('Unauthorized: Only admins can view user growth');
      }

      const result = await db.execute(sql.raw(`
        SELECT 
          DATE(createdAt) as date,
          COUNT(*) as new_users,
          SUM(CASE WHEN role = 'client' THEN 1 ELSE 0 END) as new_clients,
          SUM(CASE WHEN role = 'reseller' THEN 1 ELSE 0 END) as new_resellers
        FROM users
        WHERE createdAt >= '${startDate.toISOString()}'
          AND createdAt <= '${endDate.toISOString()}'
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `));

      return result;
    }),

  // Sessions timeline (last 24 hours - hourly)
  sessionsTimeline: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    
    // Only super_admin/owner can see all sessions
    if (ctx.user.role !== 'super_admin' && ctx.user.role !== 'owner') {
      throw new Error('Unauthorized: Only admins can view sessions timeline');
    }

    const result = await db.execute(sql.raw(`
      SELECT 
        DATE_FORMAT(acctstarttime, '%Y-%m-%d %H:00:00') as hour,
        COUNT(*) as session_count,
        COUNT(DISTINCT username) as unique_users
      FROM radacct
      WHERE acctstarttime >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY DATE_FORMAT(acctstarttime, '%Y-%m-%d %H:00:00')
      ORDER BY hour ASC
    `));

    return result;
  }),

  // Total cards created in system (Admin only)
  totalCardsCreated: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    
    // Only super_admin/owner can see total cards
    if (ctx.user.role !== 'super_admin' && ctx.user.role !== 'owner') {
      throw new Error('Unauthorized: Only admins can view total cards');
    }

    const result = await db.execute(sql.raw(`
      SELECT 
        COUNT(*) as total_cards,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_cards,
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used_cards,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_cards
      FROM radius_cards
    `));

    return result[0];
  }),

  // Client card sales analytics
  clientCardSales: protectedProcedure
    .input(z.object({
      days: z.number().min(7).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const { days } = input;
      
      // Clients can view their own data, owner/super_admin can view all
      const isAdmin = ctx.user.role === 'super_admin' || ctx.user.role === 'owner';

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Total cards sold (created by this client)
      const totalSalesResult = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total_cards,
          SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as sold_cards,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as available_cards,
          SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_cards
        FROM cards
        WHERE createdBy = ${ctx.user.id}
      `));

      // Sales trend (cards used per day)
      const salesTrendResult = await db.execute(sql.raw(`
        SELECT 
          DATE(updatedAt) as date,
          COUNT(*) as cards_sold
        FROM cards
        WHERE createdBy = ${ctx.user.id}
          AND status = 'used'
          AND updatedAt >= '${startDate.toISOString()}'
          AND updatedAt <= '${endDate.toISOString()}'
        GROUP BY DATE(updatedAt)
        ORDER BY date ASC
      `));

      // Revenue from cards (estimated based on plan prices)
      const revenueResult = await db.execute(sql.raw(`
        SELECT 
          COALESCE(SUM(p.price), 0) as total_revenue
        FROM cards rc
        LEFT JOIN plans p ON rc.planId = p.id
        WHERE rc.createdBy = ${ctx.user.id}
          AND rc.status = 'used'
      `));

      // Top selling plans
      const topPlansResult = await db.execute(sql.raw(`
        SELECT 
          p.name as plan_name,
          COUNT(rc.id) as cards_sold,
          SUM(p.price) as revenue
        FROM cards rc
        LEFT JOIN plans p ON rc.planId = p.id
        WHERE rc.createdBy = ${ctx.user.id}
          AND rc.status = 'used'
        GROUP BY p.id, p.name
        ORDER BY cards_sold DESC
        LIMIT 5
      `));

      // Recent sales (last 10)
      const recentSalesResult = await db.execute(sql.raw(`
        SELECT 
          rc.username,
          rc.password,
          p.name as plan_name,
          rc.status,
          rc.updatedAt as sold_at
        FROM cards rc
        LEFT JOIN plans p ON rc.planId = p.id
        WHERE rc.createdBy = ${ctx.user.id}
          AND rc.status = 'used'
        ORDER BY rc.updatedAt DESC
        LIMIT 10
      `));

      return {
        totalSales: totalSalesResult[0],
        salesTrend: salesTrendResult,
        revenue: revenueResult[0],
        topPlans: topPlansResult,
        recentSales: recentSalesResult,
      };
    }),
});

export { analyticsRouter };
