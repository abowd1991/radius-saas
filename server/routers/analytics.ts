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

      const result = await db.execute(sql.raw(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m-%d') as date,
          SUM(amount) as revenue,
          COUNT(*) as transaction_count
        FROM invoices
        WHERE created_at >= '${startDate.toISOString()}'
          AND created_at <= '${endDate.toISOString()}'
          AND status = 'paid'
          AND ${ownerCondition}
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
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
          DATE_FORMAT(start_time, '%Y-%m-%d') as date,
          COUNT(DISTINCT username) as unique_users,
          COUNT(*) as total_sessions,
          SUM(TIMESTAMPDIFF(SECOND, start_time, COALESCE(stop_time, NOW()))) / 3600 as total_hours
        FROM radacct
        WHERE start_time >= '${startDate.toISOString()}'
          AND start_time <= '${endDate.toISOString()}'
          AND ${ownerCondition}
        GROUP BY DATE_FORMAT(start_time, '%Y-%m-%d')
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
      LEFT JOIN radacct r ON r.nasipaddress = n.nasname AND r.stop_time IS NULL
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
      WHERE stop_time IS NULL
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
});

export { analyticsRouter };
