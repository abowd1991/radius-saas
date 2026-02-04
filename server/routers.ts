import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, superAdminProcedure, resellerProcedure, clientProcedure, activeSubscriptionProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as walletDb from "./db/wallet";
import * as planDb from "./db/plans";
import * as nasDb from "./db/nas";
import * as cardDb from "./db/vouchers";
import * as invoiceDb from "./db/invoices";
import * as subscriptionDb from "./db/subscriptions";
import * as ticketDb from "./db/tickets";
import * as notificationDb from "./db/notifications";
import * as templateDb from "./db/cardTemplates";
import { generateCardsPDFHTML, generateCardsCSV, saveBatchPDF, saveBatchPDFWithTemplate, generateCardsPDFHTMLWithTemplate } from "./services/pdfGenerator";
import { storagePut } from "./storage";
import * as mikrotikApi from "./services/mikrotikApi";
import * as coaService from "./services/coaService";
import * as vpnApi from "./services/vpnApiService";
import * as sshVpn from "./services/sshVpnService";
import * as accountingService from "./services/accountingService";
import * as sessionMonitor from "./services/sessionMonitor";
import * as authService from "./services/authService";
import { getDb } from "./db";
import { radcheck, nasDevices, radiusCards, radacct, users } from "../drizzle/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import * as radiusSubscribers from "./db/radiusSubscribers";
import { logAudit } from "./services/auditLogService";
import * as vpnIpPool from "./db/vpnIpPool";
import * as freeradiusService from "./services/freeradiusService";
import * as multiChannelNotification from "./services/multiChannelNotificationService";
import * as tweetsmsService from "./services/tweetsmsService";
import * as smsDb from "./db/sms";
import * as twoPhaseProvisioning from "./services/twoPhaseProvisioningService";

// ============================================================================
// AUTH ROUTER
// ============================================================================
import * as permissionsService from "./services/permissionsService";

const authRouter = router({
  me: publicProcedure.query(opts => {
    if (!opts.ctx.user) return null;
    const permissions = permissionsService.getRolePermissions(opts.ctx.user.role as any);
    const canSeeFinancials = permissionsService.canSeeFinancials(opts.ctx.user.role as any);
    const isAdmin = permissionsService.isAdmin(opts.ctx.user.role as any);
    return {
      ...opts.ctx.user,
      permissions,
      canSeeFinancials,
      isAdmin,
      // SaaS account status fields
      accountStatus: (opts.ctx.user as any).accountStatus || 'active',
      trialStartDate: (opts.ctx.user as any).trialStartDate || null,
      trialEndDate: (opts.ctx.user as any).trialEndDate || null,
      subscriptionStartDate: (opts.ctx.user as any).subscriptionStartDate || null,
      subscriptionEndDate: (opts.ctx.user as any).subscriptionEndDate || null,
      subscriptionPlanId: (opts.ctx.user as any).subscriptionPlanId || null,
    };
  }),
  
  // Traditional registration
  register: publicProcedure
    .input(z.object({
      username: z.string().min(3, "Username must be at least 3 characters"),
      email: z.string().email("Invalid email address"),
      password: z.string().min(6, "Password must be at least 6 characters"),
      name: z.string().optional(),
      phone: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await authService.registerUser(input);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return { success: true, message: "Registration successful! You can now login." };
    }),
  
  // Traditional login
  login: publicProcedure
    .input(z.object({
      usernameOrEmail: z.string().min(1, "Username or email is required"),
      password: z.string().min(1, "Password is required"),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await authService.loginUser(input);
      if (!result.success || !result.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: result.error || "Login failed" });
      }
      
      // Create session token using SDK and set cookie
      const { sdk } = await import("./_core/sdk");
      // Use a unique identifier for traditional auth users
      const sessionOpenId = `local_${result.user.id}`;
      const token = await sdk.createSessionToken(sessionOpenId, { name: result.user.name || result.user.username || "" });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
      
      return { success: true, user: result.user };
    }),
  
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  // Email verification
  verifyEmail: publicProcedure
    .input(z.object({
      email: z.string().email("Invalid email address"),
      code: z.string().length(6, "Verification code must be 6 digits"),
    }))
    .mutation(async ({ input }) => {
      const result = await authService.verifyEmail(input.email, input.code);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return { success: true, message: "Email verified successfully!" };
    }),

  // Resend verification code
  resendVerificationCode: publicProcedure
    .input(z.object({
      email: z.string().email("Invalid email address"),
    }))
    .mutation(async ({ input }) => {
      const result = await authService.resendVerificationCode(input.email);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return { success: true, message: "Verification code sent!" };
    }),

  // Request password reset
  forgotPassword: publicProcedure
    .input(z.object({
      email: z.string().email("Invalid email address"),
    }))
    .mutation(async ({ input }) => {
      const result = await authService.requestPasswordReset(input.email);
      // Always return success to prevent email enumeration
      return { success: true, message: "If this email exists, a reset code has been sent." };
    }),

  // Verify reset code
  verifyResetCode: publicProcedure
    .input(z.object({
      email: z.string().email("Invalid email address"),
      code: z.string().length(6, "Reset code must be 6 digits"),
    }))
    .mutation(async ({ input }) => {
      const result = await authService.verifyResetCode(input.email, input.code);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return { success: true };
    }),

  // Reset password with code
  resetPassword: publicProcedure
    .input(z.object({
      email: z.string().email("Invalid email address"),
      code: z.string().length(6, "Reset code must be 6 digits"),
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
    }))
    .mutation(async ({ input }) => {
      const result = await authService.resetPassword(input.email, input.code, input.newPassword);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return { success: true, message: "Password reset successful! You can now login." };
    }),

  // Update profile
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.updateUser(ctx.user.id, input);
      return { success: true, user: result };
    }),

  // Update avatar
  updateAvatar: protectedProcedure
    .input(z.object({
      avatarUrl: z.string().url("Invalid URL"),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.updateUser(ctx.user.id, { avatarUrl: input.avatarUrl });
      return { success: true, avatarUrl: input.avatarUrl };
    }),

  // Request password change (for logged-in users)
  requestPasswordChange: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.user.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No email associated with this account" });
      }
      const result = await authService.requestPasswordReset(ctx.user.email);
      return { success: true, message: "Password reset code sent to your email" };
    }),
});

// ============================================================================
// USERS ROUTER
// ============================================================================
const usersRouter = router({
  list: superAdminProcedure
    .input(z.object({
      role: z.enum(['super_admin', 'reseller', 'client']).optional(),
      status: z.enum(['active', 'suspended', 'inactive']).optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ input }) => {
      return db.getAllUsers();
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const user = await db.getUserById(input.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      
      if (ctx.user.role === 'client' && ctx.user.id !== input.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      if (ctx.user.role === 'reseller' && user.resellerId !== ctx.user.id && ctx.user.id !== input.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      return user;
    }),

  getMyClients: resellerProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      return db.getUsersByRole('client');
    }
    return db.getUsersByResellerId(ctx.user.id);
  }),

  updateStatus: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      status: z.enum(['active', 'suspended', 'inactive']),
    }))
    .mutation(async ({ input }) => {
      return { success: true };
    }),

  // Get all clients with subscription details (Super Admin)
  getClientsWithSubscription: superAdminProcedure
    .input(z.object({
      status: z.enum(['trial', 'active', 'expired', 'suspended', 'all']).default('all'),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ input }) => {
      const allUsers = await db.getAllUsers();
      let clients = allUsers.filter((u: any) => u.role !== 'super_admin');
      
      // Filter by status
      if (input?.status && input.status !== 'all') {
        clients = clients.filter((c: any) => c.accountStatus === input.status);
      }
      
      // Search
      if (input?.search) {
        const search = input.search.toLowerCase();
        clients = clients.filter((c: any) => 
          c.name?.toLowerCase().includes(search) ||
          c.email?.toLowerCase().includes(search) ||
          c.username?.toLowerCase().includes(search)
        );
      }
      
      // Get plan names for each client
      const plans = await saasPlansDb.getAllPlans(false);
      const planMap = new Map(plans.map((p: any) => [p.id, p.name]));
      
      const clientsWithPlan = clients.map((c: any) => ({
        ...c,
        planName: c.subscriptionPlanId ? planMap.get(c.subscriptionPlanId) : null,
        daysRemaining: c.trialEndDate 
          ? Math.max(0, Math.ceil((new Date(c.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : c.subscriptionEndDate
            ? Math.max(0, Math.ceil((new Date(c.subscriptionEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null,
      }));
      
      // Pagination
      const page = input?.page || 1;
      const limit = input?.limit || 20;
      const start = (page - 1) * limit;
      const paginated = clientsWithPlan.slice(start, start + limit);
      
      return {
        clients: paginated,
        total: clientsWithPlan.length,
        page,
        totalPages: Math.ceil(clientsWithPlan.length / limit),
      };
    }),

  // Activate client account
  activateClient: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      planId: z.number().optional(),
      durationDays: z.number().default(30),
    }))
    .mutation(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      const now = new Date();
      const endDate = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000);
      
      // Update user status
      await drizzleDb.update(users)
        .set({
          accountStatus: 'active',
          subscriptionStartDate: now,
          subscriptionEndDate: endDate,
          subscriptionPlanId: input.planId || null,
        })
        .where(eq(users.id, input.userId));
      
      // Enable all NAS devices
      await drizzleDb.execute(
        sql`UPDATE nas SET is_active = 1 WHERE owner_id = ${input.userId}`
      );
      
      // Activate daily billing
      const { activateDailyBilling } = await import("./services/billingService");
      await activateDailyBilling(input.userId, input.userId);
      
      console.log(`[Client Control] Activated user ${input.userId} for ${input.durationDays} days with daily billing`);
      return { success: true, message: 'Client activated successfully with billing enabled' };
    }),

  // Suspend client account
  suspendClient: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      // Update user status
      await drizzleDb.update(users)
        .set({ accountStatus: 'suspended' })
        .where(eq(users.id, input.userId));
      
      // Disable all NAS devices
      await drizzleDb.execute(
        sql`UPDATE nas SET is_active = 0 WHERE owner_id = ${input.userId}`
      );
      
      // Block all cards (add Auth-Type := Reject)
      // Get user's cards and block them
      const userCardsResult = await drizzleDb.execute(
        sql`SELECT username FROM radius_cards WHERE owner_id = ${input.userId}`
      );
      const userCards = (userCardsResult as any)[0] || [];
      for (const card of userCards) {
        await drizzleDb.execute(
          sql`INSERT INTO radcheck (username, attribute, op, value) VALUES (${card.username}, 'Auth-Type', ':=', 'Reject') ON DUPLICATE KEY UPDATE value = 'Reject'`
        );
      }
      
      console.log(`[Client Control] Suspended user ${input.userId}`);
      return { success: true, message: 'Client suspended successfully' };
    }),

  // Extend subscription
  extendSubscription: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      days: z.number().min(1),
    }))
    .mutation(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      const currentEnd = (user as any).subscriptionEndDate 
        ? new Date((user as any).subscriptionEndDate) 
        : (user as any).trialEndDate 
          ? new Date((user as any).trialEndDate)
          : new Date();
      
      const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()) + input.days * 24 * 60 * 60 * 1000);
      
      await drizzleDb.update(users)
        .set({
          accountStatus: 'active',
          subscriptionEndDate: newEnd,
        })
        .where(eq(users.id, input.userId));
      
      // Re-enable NAS devices
      await drizzleDb.execute(
        sql`UPDATE nas SET is_active = 1 WHERE owner_id = ${input.userId}`
      );
      
      console.log(`[Client Control] Extended user ${input.userId} subscription by ${input.days} days`);
      return { success: true, newEndDate: newEnd };
    }),

  // Change client plan
  changeClientPlan: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      planId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      const plan = await saasPlansDb.getPlanById(input.planId);
      if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });
      
      await drizzleDb.update(users)
        .set({ subscriptionPlanId: input.planId })
        .where(eq(users.id, input.userId));
      
      console.log(`[Client Control] Changed user ${input.userId} plan to ${plan.name}`);
      return { success: true, planName: plan.name };
    }),

  // Get client details with stats
  getClientDetails: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      // Get NAS count
      const nasCount = await drizzleDb.select({ count: sql<number>`count(*)` })
        .from(nasDevices)
        .where(eq(nasDevices.ownerId, input.userId));
      
      // Get cards count - use raw SQL for simplicity
      const cardsResult = await drizzleDb.execute(
        sql`SELECT COUNT(*) as count FROM radius_cards WHERE owner_id = ${input.userId}`
      );
      const cardsCount = (cardsResult as any)[0]?.[0]?.count || 0;
      
      // Get active sessions
      const sessionsResult = await drizzleDb.execute(
        sql`SELECT COUNT(*) as count FROM radacct WHERE acctstoptime IS NULL AND username IN (SELECT username FROM radius_cards WHERE owner_id = ${input.userId})`
      );
      const sessionsCount = (sessionsResult as any)[0]?.[0]?.count || 0;
      
      // Get plan details
      let plan = null;
      if ((user as any).subscriptionPlanId) {
        plan = await saasPlansDb.getPlanById((user as any).subscriptionPlanId);
      }
      
      return {
        user,
        stats: {
          nasCount: Number(nasCount[0]?.count || 0),
          cardsCount: Number(cardsCount),
          activeSessions: Number(sessionsCount),
        },
        plan,
      };
    }),

  // Change user role (Super Admin only)
  changeRole: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['super_admin', 'reseller', 'client']),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      
      // Prevent changing own role
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot change your own role' });
      }
      
      // Only allow promoting to super_admin if current user is super_admin
      if (input.role === 'super_admin' && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only super admin can promote to super admin' });
      }
      
      await db.updateUserRole(input.userId, input.role);
      console.log(`[User Role] Super admin ${ctx.user.id} changed user ${input.userId} role to ${input.role}`);
      return { success: true, message: `Role changed to ${input.role}` };
    }),

  // Update profile (any authenticated user)
  updateProfile: protectedProcedure
    .input(z.object({
      username: z.string().min(3),
      email: z.string().email(),
    }))
    .mutation(async ({ input, ctx }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      // Check if username is already taken by another user
      const existingUser = await drizzleDb.select().from(users).where(eq(users.username, input.username));
      if (existingUser.length > 0 && existingUser[0].id !== ctx.user.id) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Username already taken' });
      }
      
      // Check if email is already taken by another user
      const existingEmail = await drizzleDb.select().from(users).where(eq(users.email, input.email));
      if (existingEmail.length > 0 && existingEmail[0].id !== ctx.user.id) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already taken' });
      }
      
      await drizzleDb.update(users)
        .set({
          username: input.username,
          email: input.email,
        })
        .where(eq(users.id, ctx.user.id));
      
      console.log(`[User Profile] User ${ctx.user.id} updated profile`);
      return { success: true, message: 'Profile updated successfully' };
    }),

  // Change password (any authenticated user)
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      // Get current user with password
      const [user] = await drizzleDb.select().from(users).where(eq(users.id, ctx.user.id));
      if (!user || !user.password) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      
      // Verify current password
      const bcrypt = await import('bcryptjs');
      const isValid = await bcrypt.compare(input.currentPassword, user.password);
      if (!isValid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(input.newPassword, 10);
      
      // Update password
      await drizzleDb.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, ctx.user.id));
      
      console.log(`[User Password] User ${ctx.user.id} changed password`);
      return { success: true, message: 'Password changed successfully' };
    }),

  // Delete user (Super Admin only)
  delete: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserById(input.userId);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      
      // Prevent deleting super_admin
      if ((user as any).role === 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete super admin' });
      }
      
      // Prevent self-deletion
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete yourself' });
      }
      
      const drizzleDb = await getDb();
      if (!drizzleDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      // Delete user's data in order (foreign key constraints)
      // 1. Delete radcheck entries for user's cards
      await drizzleDb.execute(
        sql`DELETE FROM radcheck WHERE username IN (SELECT username FROM radius_cards WHERE owner_id = ${input.userId})`
      );
      
      // 2. Delete radreply entries for user's cards
      await drizzleDb.execute(
        sql`DELETE FROM radreply WHERE username IN (SELECT username FROM radius_cards WHERE owner_id = ${input.userId})`
      );
      
      // 3. Delete user's cards
      await drizzleDb.execute(
        sql`DELETE FROM radius_cards WHERE owner_id = ${input.userId}`
      );
      
      // 4. Delete user's NAS devices
      await drizzleDb.execute(
        sql`DELETE FROM nas WHERE owner_id = ${input.userId}`
      );
      
      // 5. Delete user's plans
      await drizzleDb.execute(
        sql`DELETE FROM plans WHERE owner_id = ${input.userId}`
      );
      
      // 6. Delete user's audit logs
      await drizzleDb.execute(
        sql`DELETE FROM audit_logs WHERE user_id = ${input.userId}`
      );
      
      // 7. Finally delete the user
      await drizzleDb.delete(users).where(eq(users.id, input.userId));
      
      console.log(`[User Delete] Super admin ${ctx.user.id} deleted user ${input.userId}`);
      return { success: true, message: 'User deleted successfully' };
    }),
});

// ============================================================================
// PLANS ROUTER
// ============================================================================
const plansRouter = router({
  // List plans - super_admin sees all, others see only their own
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      return planDb.getAllPlans();
    }
    return planDb.getPlansByOwner(ctx.user.id);
  }),

  // Get plan by ID - check ownership for non-super_admin
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const plan = await planDb.getPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && plan.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return plan;
    }),

  // Create plan - any authenticated user with active subscription can create
  create: activeSubscriptionProcedure
    .input(z.object({
      name: z.string().min(1),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      downloadSpeed: z.number().min(1),
      uploadSpeed: z.number().min(1),
      dataLimit: z.number().optional(),
      validityType: z.enum(['minutes', 'hours', 'days']).default('days'),
      validityValue: z.number().default(30),
      validityStartFrom: z.enum(['first_login', 'card_creation']).default('first_login'),
      price: z.string(),
      resellerPrice: z.string(),
      simultaneousUse: z.number().default(1),
      sessionTimeout: z.number().optional(),
      idleTimeout: z.number().optional(),
      poolName: z.string().optional(),
      mikrotikRateLimit: z.string().optional(),
      mikrotikAddressPool: z.string().optional(),
      serviceType: z.enum(['pppoe', 'hotspot', 'vpn', 'all']).default('all'),
    }))
    .mutation(async ({ ctx, input }) => {
      return planDb.createPlan({ ...input, ownerId: ctx.user.id });
    }),

  // Update plan - check ownership
  update: activeSubscriptionProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      downloadSpeed: z.number().optional(),
      uploadSpeed: z.number().optional(),
      dataLimit: z.number().optional(),
      validityType: z.enum(['minutes', 'hours', 'days']).optional(),
      validityValue: z.number().optional(),
      price: z.string().optional(),
      resellerPrice: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership for non-super_admin
      const plan = await planDb.getPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      if (ctx.user.role !== 'super_admin' && plan.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return planDb.updatePlan(input.id, input);
    }),

  // Delete plan - check ownership
  delete: activeSubscriptionProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership for non-super_admin
      const plan = await planDb.getPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      if (ctx.user.role !== 'super_admin' && plan.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return planDb.deletePlan(input.id);
    }),
});

// ============================================================================
// NAS DEVICES ROUTER
// ============================================================================
const nasRouter = router({
  // List NAS devices - super_admin sees all, others see only their own
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      return nasDb.getAllNasDevices();
    }
    return nasDb.getNasDevicesByOwner(ctx.user.id);
  }),

  // Get NAS by ID - check ownership for non-super_admin
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const nas = await nasDb.getNasById(input.id);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return nas;
    }),

  // Create NAS - any authenticated user can create, ownerId is set automatically
  // Requires active subscription to create new NAS
  // TWO-PHASE PROVISIONING:
  // - Phase 1 (here): Create NAS with nasname='pending', status='pending'
  // - Phase 2 (background): When VPN connects, read actual IP, create DHCP reservation, update nasname
  create: activeSubscriptionProcedure
    .input(z.object({
      name: z.string().min(1),
      ipAddress: z.string().min(1),
      secret: z.string().min(1),
      type: z.enum(['mikrotik', 'cisco', 'other']).default('mikrotik'),
      connectionType: z.enum(['public_ip', 'vpn_l2tp', 'vpn_sstp']).default('public_ip'),
      description: z.string().optional(),
      location: z.string().optional(),
      ports: z.number().optional(),
      // MikroTik API settings (optional - for instant speed changes)
      apiEnabled: z.boolean().optional().default(false),
      mikrotikApiPort: z.number().optional().default(8728),
      mikrotikApiUser: z.string().optional(),
      mikrotikApiPassword: z.string().optional(),
      vpnUsername: z.string().optional(),
      vpnPassword: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Set ownerId to current user
      const ownerId = ctx.user.id;
      
      // Check billing status - block if past_due
      if (ctx.user.billingStatus === 'past_due') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot create NAS: Your account has insufficient balance. Please add credit to your wallet.',
        });
      }
      
      // For VPN connections, generate unique credentials if not provided
      if (input.connectionType !== 'public_ip') {
        // Generate VPN username if not provided
        if (!input.vpnUsername || input.vpnUsername.trim() === '') {
          const cleanName = input.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
          input.vpnUsername = `${cleanName}-${Date.now().toString(36)}`;
        }
        // Generate VPN password if not provided
        if (!input.vpnPassword || input.vpnPassword.trim() === '') {
          input.vpnPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }
        // TWO-PHASE PROVISIONING: For VPN connections, IP is 'pending' until VPN connects
        // nasname will be set to actual IP after VPN connection is established
        // This prevents IP mismatch between pre-allocated IP and DHCP-assigned IP
        input.ipAddress = 'pending'; // Will be updated in Phase 2
        
        // Create VPN user in SoftEther (without static IP - DHCP will assign)
        try {
          console.log(`[Phase 1] Creating VPN user: ${input.vpnUsername} (no static IP - DHCP will assign)`);
          const vpnResult = await sshVpn.createVpnUser(input.vpnUsername, input.vpnPassword!);
          console.log('[Phase 1] VPN User creation result:', vpnResult);
          
          if (!vpnResult.success) {
            console.error('[Phase 1] VPN User creation failed:', vpnResult.error);
          }
        } catch (error) {
          console.error('[Phase 1] Failed to create VPN user:', error);
        }
        
        // Create RADIUS entry for VPN user authentication
        try {
          console.log(`[Phase 1] Creating RADIUS entry for VPN user: ${input.vpnUsername}`);
          const database = await getDb();
          if (database) {
            const existingUser = await database.select()
              .from(radcheck)
              .where(eq(radcheck.username, input.vpnUsername))
              .limit(1);
            
            if (existingUser.length === 0) {
              await database.insert(radcheck).values({
                username: input.vpnUsername,
                attribute: 'Cleartext-Password',
                op: ':=',
                value: input.vpnPassword,
              });
              console.log(`[Phase 1] RADIUS user created: ${input.vpnUsername}`);
            }
          }
        } catch (error) {
          console.error('[Phase 1] Failed to create RADIUS entry:', error);
        }
      }
      
      // Create NAS in database
      // For VPN: nasname='pending', status='pending', provisioningStatus='pending'
      // For public_ip: nasname=actual IP, status='active', provisioningStatus='ready'
      const nasInput = { ...input, ownerId };
      const newNas = await nasDb.createNas(nasInput);
      
      console.log(`[Phase 1] NAS created: ID=${newNas.id}, status=${newNas.status}, provisioningStatus=${newNas.provisioningStatus}`);
      
      // For VPN connections, start Phase 2 auto-provisioning in background
      if (input.connectionType === 'vpn_l2tp' || input.connectionType === 'vpn_sstp') {
        if (input.vpnUsername) {
          // Run Phase 2 in background - don't await
          // This will wait for VPN connection, read actual IP, create DHCP reservation, update nasname
          twoPhaseProvisioning.autoProvisionNewNas(
            newNas.id,
            input.vpnUsername,
            60, // 60 retries (5 minutes total)
            5000 // 5 seconds interval
          ).then(result => {
            if (result.success) {
              console.log(`[Phase 2] NAS ${newNas.id} provisioned: IP=${result.actualIp}, MAC=${result.macAddress}`);
            } else {
              console.error(`[Phase 2] NAS ${newNas.id} provisioning failed:`, result.message);
            }
          }).catch(error => {
            console.error(`[Phase 2] Error provisioning NAS ${newNas.id}:`, error);
          });
        }
        
        // Return NAS with inactive status (will be updated when VPN connects)
        return {
          ...newNas,
          nasname: 'pending',
          status: 'inactive',
          provisioningStatus: 'pending',
          message: 'NAS created. Connect VPN to complete provisioning.',
        };
      }
      
      // For public_ip connections, reload FreeRADIUS immediately
      twoPhaseProvisioning.rateLimitedReload().then(result => {
        console.log(`[NAS Create] FreeRADIUS reload:`, result.message);
      }).catch(error => {
        console.error(`[NAS Create] Error reloading FreeRADIUS:`, error);
      });
      
      return newNas;
    }),

  // Get setup scripts for a NAS device - check ownership
  getSetupScripts: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const nas = await nasDb.getNasById(input.id);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      // Get system settings for RADIUS server addresses
      const settings = await db.getSystemSettings();
      const radiusPublicIp = settings.radius_server_public_ip || '';
      const radiusVpnIp = settings.radius_server_vpn_ip || '192.168.30.1';
      const vpnServerAddress = settings.vpn_server_address || '';
      const coaPort = '3799';
      
      const scripts: Array<{
        id: string;
        title: string;
        titleAr: string;
        description: string;
        descriptionAr: string;
        command: string;
        category: 'vpn' | 'radius' | 'hotspot' | 'pppoe';
        required: boolean;
      }> = [];
      
      // VPN Setup Scripts (only for VPN connection types)
      if (nas.connectionType === 'vpn_l2tp') {
        if (!vpnServerAddress) {
          // Warning: VPN server address not configured
          scripts.push({
            id: 'vpn-warning',
            title: 'VPN Server Not Configured',
            titleAr: 'خادم VPN غير مهيأ',
            description: 'Please configure VPN server address in System Settings first',
            descriptionAr: 'يرجى إعداد عنوان خادم VPN في إعدادات النظام أولاً',
            command: '# يرجى إعداد عنوان خادم VPN في إعدادات النظام',
            category: 'vpn',
            required: true,
          });
        } else {
          scripts.push({
            id: 'l2tp-client',
            title: 'Create L2TP/IPSec Client',
            titleAr: 'إنشاء اتصال L2TP/IPSec',
            description: `Create L2TP/IPSec VPN tunnel to RADIUS server (${vpnServerAddress})`,
            descriptionAr: `إنشاء نفق VPN L2TP/IPSec للاتصال بخادم RADIUS (${vpnServerAddress})`,
            command: `/interface l2tp-client add name=radius-vpn connect-to=${vpnServerAddress} user=${nas.vpnUsername || 'nas-user'}@VPN password=${nas.vpnPassword || 'nas-pass'} use-ipsec=yes ipsec-secret=softether disabled=no add-default-route=no`,
            category: 'vpn',
            required: true,
          });
          
          // Add route for RADIUS network (automatically included in VPN setup)
          scripts.push({
            id: 'vpn-route',
            title: 'Add RADIUS Network Route',
            titleAr: 'إضافة مسار شبكة RADIUS',
            description: 'Add route to reach RADIUS server through VPN tunnel',
            descriptionAr: 'إضافة مسار للوصول إلى خادم RADIUS عبر نفق VPN',
            command: `/ip route add dst-address=192.168.30.0/24 gateway=radius-vpn comment="RADIUS Network via VPN"`,
            category: 'vpn',
            required: true,
          });
          
          // Note: Static IP is now assigned by SoftEther server automatically
          // No need for /ip address add on MikroTik - PPP gets IP from server
          // The IP assigned by SoftEther matches what's registered in RADIUS
          if (nas.nasname && !nas.nasname.startsWith('pending-') && !nas.nasname.startsWith('allocating')) {
            scripts.push({
              id: 'vpn-ip-info',
              title: 'VPN IP Information',
              titleAr: 'معلومات IP الـ VPN',
              description: `Your VPN will automatically receive IP: ${nas.nasname} from the server`,
              descriptionAr: `سيحصل اتصال VPN تلقائياً على IP: ${nas.nasname} من السيرفر`,
              command: `# IP ${nas.nasname} سيتم تعيينه تلقائياً من سيرفر VPN - لا حاجة لأي أوامر إضافية`,
              category: 'vpn',
              required: false,
            });
          }
        }
      } else if (nas.connectionType === 'vpn_sstp') {
        if (!vpnServerAddress) {
          scripts.push({
            id: 'vpn-warning',
            title: 'VPN Server Not Configured',
            titleAr: 'خادم VPN غير مهيأ',
            description: 'Please configure VPN server address in System Settings first',
            descriptionAr: 'يرجى إعداد عنوان خادم VPN في إعدادات النظام أولاً',
            command: '# يرجى إعداد عنوان خادم VPN في إعدادات النظام',
            category: 'vpn',
            required: true,
          });
        } else {
          scripts.push({
            id: 'sstp-client',
            title: 'Create SSTP Client',
            titleAr: 'إنشاء اتصال SSTP',
            description: `Create SSTP VPN tunnel to RADIUS server (${vpnServerAddress})`,
            descriptionAr: `إنشاء نفق VPN SSTP للاتصال بخادم RADIUS (${vpnServerAddress})`,
            command: `/interface sstp-client add name=radius-vpn connect-to=${vpnServerAddress} user=${nas.vpnUsername || 'nas-user'}@VPN password=${nas.vpnPassword || 'nas-pass'} profile=default-encryption disabled=no verify-server-certificate=no`,
            category: 'vpn',
            required: true,
          });
          
          // Add route for RADIUS network (automatically included in VPN setup)
          scripts.push({
            id: 'vpn-route',
            title: 'Add RADIUS Network Route',
            titleAr: 'إضافة مسار شبكة RADIUS',
            description: 'Add route to reach RADIUS server through VPN tunnel',
            descriptionAr: 'إضافة مسار للوصول إلى خادم RADIUS عبر نفق VPN',
            command: `/ip route add dst-address=192.168.30.0/24 gateway=radius-vpn comment="RADIUS Network via VPN"`,
            category: 'vpn',
            required: true,
          });
          
          // Note: Static IP is now assigned by SoftEther server automatically
          // No need for /ip address add on MikroTik - PPP gets IP from server
          // The IP assigned by SoftEther matches what's registered in RADIUS
          if (nas.nasname && !nas.nasname.startsWith('pending-') && !nas.nasname.startsWith('allocating')) {
            scripts.push({
              id: 'vpn-ip-info',
              title: 'VPN IP Information',
              titleAr: 'معلومات IP الـ VPN',
              description: `Your VPN will automatically receive IP: ${nas.nasname} from the server`,
              descriptionAr: `سيحصل اتصال VPN تلقائياً على IP: ${nas.nasname} من السيرفر`,
              command: `# IP ${nas.nasname} سيتم تعيينه تلقائياً من سيرفر VPN - لا حاجة لأي أوامر إضافية`,
              category: 'vpn',
              required: false,
            });
          }
        }
      }
      
      // RADIUS Server Setup (always required)
      // For public IP: use the configured public RADIUS IP
      // For VPN: use the VPN tunnel IP that MikroTik can reach after connecting
      const radiusAddress = nas.connectionType === 'public_ip' ? radiusPublicIp : radiusVpnIp;
      scripts.push({
        id: 'radius-server',
        title: 'Add RADIUS Server',
        titleAr: 'إضافة خادم RADIUS',
        description: 'Add RADIUS server for authentication and accounting',
        descriptionAr: 'إضافة خادم RADIUS للمصادقة والمحاسبة',
        command: `/radius add address=${radiusAddress} secret=${nas.secret} timeout=3s service=ppp,hotspot,login`,
        category: 'radius',
        required: true,
      });
      
      // RADIUS Incoming (CoA/Disconnect)
      scripts.push({
        id: 'radius-incoming',
        title: 'Enable RADIUS Incoming',
        titleAr: 'تفعيل RADIUS Incoming',
        description: 'Enable receiving CoA and Disconnect commands',
        descriptionAr: 'تفعيل استقبال أوامر CoA و Disconnect',
        command: `/radius incoming set port=${coaPort} accept=yes`,
        category: 'radius',
        required: true,
      });
      
      // Disable require-message-auth for compatibility
      scripts.push({
        id: 'message-auth',
        title: 'Disable Message Auth',
        titleAr: 'تعطيل Message Auth',
        description: 'Disable require-message-auth for FreeRADIUS compatibility',
        descriptionAr: 'تعطيل require-message-auth للتوافق مع FreeRADIUS',
        command: `/radius set [find] require-message-auth=no`,
        category: 'radius',
        required: true,
      });
      
      // PPP/PPPoE Setup
      scripts.push({
        id: 'ppp-aaa',
        title: 'Enable PPP RADIUS',
        titleAr: 'تفعيل RADIUS لـ PPP',
        description: 'Enable RADIUS authentication for PPP/PPPoE',
        descriptionAr: 'تفعيل مصادقة RADIUS لـ PPP/PPPoE',
        command: `/ppp aaa set use-radius=yes accounting=yes interim-update=1m`,
        category: 'pppoe',
        required: true,
      });
      
      // Hotspot Setup
      scripts.push({
        id: 'hotspot-radius',
        title: 'Enable Hotspot RADIUS',
        titleAr: 'تفعيل RADIUS لـ Hotspot',
        description: 'Enable RADIUS for all Hotspot profiles with 30-second interim updates',
        descriptionAr: 'تفعيل RADIUS لجميع بروفايلات Hotspot مع تحديث كل 30 ثانية',
        command: `:foreach profile in=[/ip hotspot profile find] do={
  /ip hotspot profile set \$profile login-by=cookie,http-pap,mac-cookie use-radius=yes radius-accounting=yes radius-interim-update=30s
}`,
        category: 'hotspot',
        required: true,
      });
      
      // Combined script for one-click setup
      const allRequiredCommands = scripts
        .filter(s => s.required)
        .map(s => s.command)
        .join('\n');
      
      return {
        nas,
        scripts,
        combinedScript: allRequiredCommands,
        vpnTunnelIp: nas.connectionType !== 'public_ip' ? radiusVpnIp : null,
        radiusAddress,
        vpnServerAddress: nas.connectionType !== 'public_ip' ? vpnServerAddress : null,
      };
    }),

  // Update NAS - check ownership (requires active subscription)
  update: activeSubscriptionProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      ipAddress: z.string().optional(),
      secret: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional(),
      connectionType: z.enum(['public_ip', 'vpn_l2tp', 'vpn_sstp']).optional(),
      // MikroTik API settings (optional - for instant speed changes)
      apiEnabled: z.boolean().optional(),
      mikrotikApiPort: z.number().optional(),
      mikrotikApiUser: z.string().optional(),
      mikrotikApiPassword: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership for non-super_admin
      const nas = await nasDb.getNasById(input.id);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      const updatedNas = await nasDb.updateNas(input.id, input);
      
      // Reload FreeRADIUS to pick up NAS changes
      freeradiusService.reloadFreeRADIUS().then(result => {
        if (result.success) {
          console.log(`[NAS Update] FreeRADIUS reloaded successfully for NAS ${input.id}`);
        } else {
          console.error(`[NAS Update] Failed to reload FreeRADIUS:`, result.message);
        }
      }).catch(error => {
        console.error(`[NAS Update] Error reloading FreeRADIUS:`, error);
      });
      
      return updatedNas;
    }),

  // Delete NAS - check ownership (requires active subscription)
  delete: activeSubscriptionProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership for non-super_admin
      const nasCheck = await nasDb.getNasById(input.id);
      if (!nasCheck) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      if (ctx.user.role !== 'super_admin' && nasCheck.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      // Delete NAS and get VPN username for cleanup
      const result = await nasDb.deleteNas(input.id);
      
      // If NAS had a VPN user, clean up VPN and RADIUS entries
      if (result.vpnUsername) {
        const vpnUsername = result.vpnUsername;
        console.log(`[NAS Delete] Cleaning up VPN user: ${vpnUsername}`);
        
        // 1. Delete VPN user from SoftEther
        try {
          console.log(`[NAS Delete] Deleting VPN user from SoftEther: ${vpnUsername}`);
          const vpnResult = await sshVpn.deleteVpnUser(vpnUsername);
          console.log('[NAS Delete] VPN user deletion result:', vpnResult);
        } catch (error) {
          console.error('[NAS Delete] Failed to delete VPN user:', error);
        }
        
        // 2. Delete RADIUS entries from database
        try {
          console.log(`[NAS Delete] Deleting RADIUS entries for: ${vpnUsername}`);
          const database = await getDb();
          if (database) {
            // Delete from radcheck
            await database.delete(radcheck).where(eq(radcheck.username, vpnUsername));
            console.log(`[NAS Delete] Deleted radcheck entries for: ${vpnUsername}`);
          }
        } catch (error) {
          console.error('[NAS Delete] Failed to delete RADIUS entries:', error);
        }
        
        // 3. Disconnect any active VPN sessions
        try {
          console.log(`[NAS Delete] Disconnecting VPN sessions for: ${vpnUsername}`);
          await sshVpn.disconnectVpnSession(vpnUsername);
        } catch (error) {
          console.error('[NAS Delete] Failed to disconnect VPN session:', error);
        }
        
        // 4. Delete DHCP reservation from VPS (Hard Delete - Single Source of Truth)
        try {
          // DHCP hostname format: nas-{ip without dots}
          const allocatedIp = nasCheck.allocatedIp;
          if (allocatedIp) {
            const dhcpHostname = `nas-${allocatedIp.replace(/\./g, '')}`;
            console.log(`[NAS Delete] Deleting DHCP reservation: ${dhcpHostname}`);
            const dhcpResult = await vpnApi.deleteDhcpReservation(dhcpHostname);
            if (dhcpResult.success) {
              console.log(`[NAS Delete] DHCP reservation deleted: ${dhcpHostname}`);
            } else {
              console.error(`[NAS Delete] Failed to delete DHCP reservation:`, dhcpResult.error);
            }
          }
        } catch (error) {
          console.error('[NAS Delete] Failed to delete DHCP reservation:', error);
        }
        
        // 5. Release allocated VPN IP from pool (Hard Delete - Single Source of Truth)
        try {
          console.log(`[NAS Delete] Releasing allocated VPN IP for NAS ${input.id}`);
          const database = await getDb();
          if (database) {
            const { allocatedVpnIps } = await import('../drizzle/schema');
            await database.delete(allocatedVpnIps).where(eq(allocatedVpnIps.nasId, input.id));
            console.log(`[NAS Delete] Released allocated VPN IP for NAS ${input.id}`);
          }
        } catch (error) {
          console.error('[NAS Delete] Failed to release allocated VPN IP:', error);
        }
      }
      
      // Reload FreeRADIUS to remove deleted NAS client
      freeradiusService.reloadFreeRADIUS().then(reloadResult => {
        if (reloadResult.success) {
          console.log(`[NAS Delete] FreeRADIUS reloaded successfully after deleting NAS ${input.id}`);
        } else {
          console.error(`[NAS Delete] Failed to reload FreeRADIUS:`, reloadResult.message);
        }
      }).catch(error => {
        console.error(`[NAS Delete] Error reloading FreeRADIUS:`, error);
      });
      
      return { success: true };
    }),

  // Sync VPN IP - Updates nasname with actual VPN local IP from SoftEther
  // This MUST be called after VPN connects to make RADIUS work
  syncVpnIp: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Get NAS device
      const nas = await nasDb.getNasById(input.id);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      // Only for VPN connection types
      if (nas.connectionType === 'public_ip') {
        return { success: false, message: 'هذا الجهاز يستخدم IP عام، لا يحتاج مزامنة VPN' };
      }
      
      // Get VPN username
      if (!nas.vpnUsername) {
        return { success: false, message: 'لم يتم العثور على اسم مستخدم VPN' };
      }
      
      // Get local IP from SoftEther
      const vpnLocalIp = await sshVpn.getVpnUserLocalIp(nas.vpnUsername);
      
      if (!vpnLocalIp) {
        return { 
          success: false, 
          message: 'الجهاز غير متصل عبر VPN. تأكد من اتصال VPN أولاً ثم أعد المحاولة.',
          currentNasname: nas.nasname
        };
      }
      
      // Update nasname with actual VPN IP
      await nasDb.updateNas(input.id, { ipAddress: vpnLocalIp });
      
      // Also update vpnTunnelIp field
      const database = await getDb();
      if (database) {
        await database.update(nasDevices)
          .set({ vpnTunnelIp: vpnLocalIp })
          .where(eq(nasDevices.id, input.id));
      }
      
      console.log(`[NAS Sync] Updated nasname for NAS ${input.id}: ${nas.nasname} -> ${vpnLocalIp}`);
      
      return { 
        success: true, 
        message: `تم تحديث عنوان IP بنجاح: ${vpnLocalIp}`,
        previousNasname: nas.nasname,
        newNasname: vpnLocalIp,
        vpnUsername: nas.vpnUsername
      };
    }),

  // Manual update of VPN IP - allows user to set IP manually if auto-sync fails
  updateVpnIp: protectedProcedure
    .input(z.object({ 
      id: z.number(),
      vpnLocalIp: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IPv4 address')
    }))
    .mutation(async ({ ctx, input }) => {
      // Get NAS device
      const nas = await nasDb.getNasById(input.id);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      // Update nasname with provided IP
      await nasDb.updateNas(input.id, { ipAddress: input.vpnLocalIp });
      
      // Also update vpnTunnelIp field
      const database = await getDb();
      if (database) {
        await database.update(nasDevices)
          .set({ vpnTunnelIp: input.vpnLocalIp })
          .where(eq(nasDevices.id, input.id));
      }
      
      console.log(`[NAS Update] Manual IP update for NAS ${input.id}: ${nas.nasname} -> ${input.vpnLocalIp}`);
      
      return { 
        success: true, 
        message: `تم تحديث عنوان IP بنجاح: ${input.vpnLocalIp}`,
        previousNasname: nas.nasname,
        newNasname: input.vpnLocalIp
      };
    }),

  // Test MikroTik API connection - any authenticated user can test
  testApiConnection: protectedProcedure
    .input(z.object({
      nasIp: z.string(),
      apiPort: z.number().default(8728),
      apiUser: z.string(),
      apiPassword: z.string(),
      nasId: z.number().optional(), // Optional NAS ID to get VPN local IP
    }))
    .mutation(async ({ input }) => {
      const mikrotikApi = await import('./services/mikrotikApiService');
      
      // Determine the actual IP to connect to
      let connectIp = input.nasIp;
      
      // If nasId is provided, check if this NAS is connected via VPN
      if (input.nasId) {
        const nas = await nasDb.getNasById(input.nasId);
        if (nas && (nas.connectionType === 'vpn_l2tp' || nas.connectionType === 'vpn_sstp') && nas.vpnUsername) {
          // Try to get the local IP from VPN session
          const vpnLocalIp = await sshVpn.getVpnUserLocalIp(nas.vpnUsername);
          if (vpnLocalIp) {
            console.log(`[MikroTik API Test] Using VPN local IP: ${vpnLocalIp} instead of ${input.nasIp}`);
            connectIp = vpnLocalIp;
          } else {
            return {
              success: false,
              message: 'الجهاز غير متصل عبر VPN. تأكد من اتصال VPN أولاً.',
              error: 'VPN_NOT_CONNECTED'
            };
          }
        }
      }
      
      console.log(`[MikroTik API Test] Connecting to ${connectIp}:${input.apiPort}`);
      
      // Create a temporary test connection
      const net = await import('net');
      const crypto = await import('crypto');
      
      return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;
        
        socket.setTimeout(10000); // 10 second timeout
        
        socket.on('timeout', () => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
            resolve({
              success: false,
              message: 'Connection timeout - check IP and port',
              error: 'TIMEOUT'
            });
          }
        });
        
        socket.on('error', (err: any) => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
            resolve({
              success: false,
              message: `Connection failed: ${err.message}`,
              error: 'CONNECTION_ERROR'
            });
          }
        });
        
        socket.connect(input.apiPort, connectIp, async () => {
          try {
            // Try to login
            const encodeWord = (word: string): Buffer => {
              const wordBuffer = Buffer.from(word, 'utf8');
              const length = wordBuffer.length;
              let lengthBuffer: Buffer;
              
              if (length < 0x80) {
                lengthBuffer = Buffer.from([length]);
              } else if (length < 0x4000) {
                lengthBuffer = Buffer.from([
                  ((length >> 8) & 0x3F) | 0x80,
                  length & 0xFF
                ]);
              } else {
                lengthBuffer = Buffer.from([length]);
              }
              
              return Buffer.concat([lengthBuffer, wordBuffer]);
            };
            
            const loginCmd = Buffer.concat([
              encodeWord('/login'),
              encodeWord(`=name=${input.apiUser}`),
              encodeWord(`=password=${input.apiPassword}`),
              Buffer.from([0]) // End of sentence
            ]);
            
            socket.write(loginCmd);
            
            socket.once('data', (data: Buffer) => {
              const response = data.toString('utf8');
              socket.destroy();
              
              if (!resolved) {
                resolved = true;
                
                if (response.includes('!done')) {
                  resolve({
                    success: true,
                    message: 'API connection successful! Credentials are valid.',
                    data: { connected: true }
                  });
                } else if (response.includes('!trap')) {
                  resolve({
                    success: false,
                    message: 'Login failed - invalid username or password',
                    error: 'AUTH_FAILED'
                  });
                } else {
                  // Old-style login with challenge - try simplified approach
                  resolve({
                    success: true,
                    message: 'API connection established (legacy auth mode)',
                    data: { connected: true, legacyAuth: true }
                  });
                }
              }
            });
            
          } catch (error: any) {
            if (!resolved) {
              resolved = true;
              socket.destroy();
              resolve({
                success: false,
                message: `Login error: ${error.message}`,
                error: 'LOGIN_ERROR'
              });
            }
          }
        });
        
        // Fallback timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
            resolve({
              success: false,
              message: 'Connection timeout',
              error: 'TIMEOUT'
            });
          }
        }, 15000);
      });
    }),

  // Get VPN status for a NAS device
  getVpnStatus: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      // Get NAS device
      const nas = await nasDb.getNasById(input.id);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      // Only for VPN connection types
      if (nas.connectionType === 'public_ip') {
        return {
          isVpn: false,
          connected: null,
          vpnLocalIp: null,
          nasname: nas.nasname,
          vpnUsername: null,
          needsSync: false,
          message: 'هذا الجهاز يستخدم IP عام'
        };
      }
      
      // Get VPN session info
      let vpnLocalIp: string | null = null;
      let connected = false;
      
      if (nas.vpnUsername) {
        vpnLocalIp = await sshVpn.getVpnUserLocalIp(nas.vpnUsername);
        connected = !!vpnLocalIp;
      }
      
      // Check if nasname needs sync (is placeholder or doesn't match VPN IP)
      const isPlaceholder = nas.nasname.startsWith('pending-vpn-') || nas.nasname.startsWith('vpn-');
      const needsSync = connected && vpnLocalIp && (isPlaceholder || nas.nasname !== vpnLocalIp);
      
      return {
        isVpn: true,
        connected,
        vpnLocalIp,
        nasname: nas.nasname,
        vpnUsername: nas.vpnUsername,
        vpnTunnelIp: nas.vpnTunnelIp,
        needsSync,
        isPlaceholder,
        message: connected 
          ? (needsSync ? 'متصل - يحتاج مزامنة IP' : 'متصل - IP متزامن')
          : 'غير متصل'
      };
    }),

  // Auto-sync VPN IP with retry logic
  autoSyncVpnIp: protectedProcedure
    .input(z.object({ 
      id: z.number(),
      maxRetries: z.number().default(3),
      retryDelayMs: z.number().default(5000)
    }))
    .mutation(async ({ ctx, input }) => {
      // Get NAS device
      const nas = await nasDb.getNasById(input.id);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      // Only for VPN connection types
      if (nas.connectionType === 'public_ip') {
        return { success: false, message: 'هذا الجهاز يستخدم IP عام' };
      }
      
      if (!nas.vpnUsername) {
        return { success: false, message: 'لم يتم العثور على اسم مستخدم VPN' };
      }
      
      // Retry logic
      let vpnLocalIp: string | null = null;
      let attempts = 0;
      
      while (attempts < input.maxRetries && !vpnLocalIp) {
        attempts++;
        console.log(`[Auto-Sync] Attempt ${attempts}/${input.maxRetries} for NAS ${input.id}`);
        
        vpnLocalIp = await sshVpn.getVpnUserLocalIp(nas.vpnUsername);
        
        if (!vpnLocalIp && attempts < input.maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, input.retryDelayMs));
        }
      }
      
      if (!vpnLocalIp) {
        return { 
          success: false, 
          message: `فشل المزامنة بعد ${attempts} محاولات. تأكد من اتصال VPN.`,
          attempts
        };
      }
      
      // Update nasname with actual VPN IP
      await nasDb.updateNas(input.id, { ipAddress: vpnLocalIp });
      
      // Also update vpnTunnelIp field
      const database = await getDb();
      if (database) {
        await database.update(nasDevices)
          .set({ vpnTunnelIp: vpnLocalIp })
          .where(eq(nasDevices.id, input.id));
      }
      
      console.log(`[Auto-Sync] Success for NAS ${input.id}: ${nas.nasname} -> ${vpnLocalIp} (${attempts} attempts)`);
      
      return { 
        success: true, 
        message: `تم المزامنة بنجاح: ${vpnLocalIp}`,
        previousNasname: nas.nasname,
        newNasname: vpnLocalIp,
        attempts
      };
    }),

  // Get health status for all NAS devices
  getHealthStatus: superAdminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { devices: [], lastChecked: new Date() };
      
      // Get all NAS devices
      const devices = await db.select().from(nasDevices);
      
      // Get active sessions count per NAS
      const { radacct } = await import('../drizzle/schema');
      const { sql, isNull, eq, count } = await import('drizzle-orm');
      
      const sessionCounts = await db.select({
        nasipaddress: radacct.nasipaddress,
        count: count(),
      })
        .from(radacct)
        .where(isNull(radacct.acctstoptime))
        .groupBy(radacct.nasipaddress);
      
      const sessionMap = new Map(sessionCounts.map((s: any) => [s.nasipaddress, s.count]));
      
      // Build health status for each device
      const healthDevices = devices.map((device: any) => {
        // Determine status based on last activity
        let status: 'online' | 'offline' | 'warning' | 'unknown' = 'unknown';
        const activeSessions = Number(sessionMap.get(device.nasname) || 0);
        
        // If device has active sessions, it's online
        if (activeSessions > 0) {
          status = 'online';
        } else if (device.connectionType !== 'public_ip') {
          // VPN devices - check if VPN tunnel IP is set
          if (device.vpnTunnelIp) {
            status = 'online';
          } else {
            status = 'offline';
          }
        } else {
          // Public IP devices - assume online if configured
          status = device.nasname ? 'online' : 'offline';
        }
        
        return {
          id: device.id,
          shortname: device.shortname || device.nasname,
          nasname: device.nasname,
          description: device.description,
          connectionType: device.connectionType,
          status,
          lastSeen: device.updatedAt,
          responseTime: null, // Would need actual ping
          activeSessions,
          uptime: null,
          cpuUsage: null,
          memoryUsage: null,
          lastChecked: new Date(),
        };
      });
      
      return {
        devices: healthDevices,
        lastChecked: new Date(),
      };
    }),

  // Get VPN IP Pool statistics
  getVpnIpPoolStats: superAdminProcedure
    .query(async () => {
      const stats = await vpnIpPool.getPoolStats();
      if (!stats) {
        return {
          hasPool: false,
          message: 'لا يوجد IP Pool نشط'
        };
      }
      return {
        hasPool: true,
        totalIps: stats.totalIps,
        allocatedCount: stats.allocatedCount,
        availableCount: stats.availableCount,
        pool: stats.pool
      };
    }),

  // Get allocated IP for a specific NAS
  getAllocatedVpnIp: protectedProcedure
    .input(z.object({ nasId: z.number() }))
    .query(async ({ ctx, input }) => {
      const nas = await nasDb.getNasById(input.nasId);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      
      // Check ownership
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      const allocatedIp = await vpnIpPool.getAllocatedIpForNas(input.nasId);
      return {
        nasId: input.nasId,
        allocatedIp,
        nasname: nas.nasname,
        isVpn: nas.connectionType !== 'public_ip'
      };
    }),

  // Get all allocated VPN IPs with NAS details
  getAllAllocatedVpnIps: superAdminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { allocations: [], pool: null };
      
      const { allocatedVpnIps, vpnIpPool: vpnIpPoolTable } = await import('../drizzle/schema');
      
      // Get pool info
      const pools = await db.select()
        .from(vpnIpPoolTable)
        .where(eq(vpnIpPoolTable.isActive, true))
        .limit(1);
      const pool = pools[0] || null;
      
      // Get all allocations with NAS details
      const allocations = await db.select({
        id: allocatedVpnIps.id,
        ipAddress: allocatedVpnIps.ipAddress,
        nasId: allocatedVpnIps.nasId,
        allocatedAt: allocatedVpnIps.allocatedAt,
        nasShortname: nasDevices.shortname,
        nasDescription: nasDevices.description,
        connectionType: nasDevices.connectionType,
        vpnUsername: nasDevices.vpnUsername,
        ownerId: nasDevices.ownerId,
      })
        .from(allocatedVpnIps)
        .leftJoin(nasDevices, eq(allocatedVpnIps.nasId, nasDevices.id))
        .orderBy(allocatedVpnIps.ipAddress);
      
      return { allocations, pool };
    }),

  // Get available IPs in the pool
  getAvailableVpnIps: superAdminProcedure
    .query(async () => {
      const stats = await vpnIpPool.getPoolStats();
      if (!stats || !stats.pool) {
        return { availableIps: [], pool: null };
      }
      
      const db = await getDb();
      if (!db) return { availableIps: [], pool: stats.pool };
      
      const { allocatedVpnIps } = await import('../drizzle/schema');
      
      // Get all allocated IPs
      const allocated = await db.select({ ipAddress: allocatedVpnIps.ipAddress })
        .from(allocatedVpnIps)
        .where(eq(allocatedVpnIps.poolId, stats.pool.id));
      const allocatedSet = new Set(allocated.map((a: any) => a.ipAddress));
      
      // Generate list of available IPs
      const ipToInt = (ip: string): number => {
        const parts = ip.split('.').map(Number);
        return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
      };
      const intToIp = (num: number): string => [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255,
      ].join('.');
      
      const startInt = ipToInt(stats.pool.startIp);
      const endInt = ipToInt(stats.pool.endIp);
      const availableIps: string[] = [];
      
      for (let i = startInt; i <= endInt; i++) {
        const ip = intToIp(i);
        if (!allocatedSet.has(ip)) {
          availableIps.push(ip);
        }
      }
      
      return { availableIps, pool: stats.pool };
    }),

  // Manually release an IP
  releaseVpnIp: superAdminProcedure
    .input(z.object({ nasId: z.number() }))
    .mutation(async ({ input }) => {
      const released = await vpnIpPool.releaseIpForNas(input.nasId);
      return { success: released, message: released ? 'تم تحرير الـ IP بنجاح' : 'فشل تحرير الـ IP' };
    }),

  // Update pool configuration
  updateVpnIpPool: superAdminProcedure
    .input(z.object({
      poolId: z.number(),
      name: z.string().optional(),
      startIp: z.string().optional(),
      endIp: z.string().optional(),
      gateway: z.string().optional(),
      subnet: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { poolId, ...data } = input;
      const updated = await vpnIpPool.updatePool(poolId, data);
      return { success: updated, message: updated ? 'تم تحديث إعدادات الـ Pool' : 'فشل التحديث' };
    }),

  // Create a new IP pool
  createVpnIpPool: superAdminProcedure
    .input(z.object({
      name: z.string().default('Default VPN Pool'),
      startIp: z.string(),
      endIp: z.string(),
      gateway: z.string().default('192.168.30.1'),
      subnet: z.string().default('255.255.255.0'),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      const { vpnIpPool: vpnIpPoolTable } = await import('../drizzle/schema');
      
      // Deactivate any existing pools
      await db.update(vpnIpPoolTable)
        .set({ isActive: false });
      
      // Create new pool
      const result = await db.insert(vpnIpPoolTable).values({
        name: input.name,
        startIp: input.startIp,
        endIp: input.endIp,
        gateway: input.gateway,
        subnet: input.subnet,
        isActive: true,
      });
      
      return { success: true, poolId: Number((result as any)[0]?.insertId || 0), message: 'تم إنشاء الـ Pool بنجاح' };
    }),

  // ============================================================================
  // TWO-PHASE AUTO PROVISIONING ENDPOINTS
  // ============================================================================

  // Get provisioning status for a NAS
  getProvisioningStatus: protectedProcedure
    .input(z.object({ nasId: z.number() }))
    .query(async ({ ctx, input }) => {
      const nas = await nasDb.getNasById(input.nasId);
      if (!nas) throw new TRPCError({ code: 'NOT_FOUND', message: 'NAS not found' });
      
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      
      return {
        nasId: nas.id,
        status: (nas as any).provisioningStatus || 'pending',
        allocatedIp: (nas as any).allocatedIp,
        lastTempIp: (nas as any).lastTempIp,
        lastMac: (nas as any).lastMac,
        provisionedAt: (nas as any).provisionedAt,
        error: (nas as any).provisioningError,
      };
    }),

  // Retry provisioning for a NAS
  retryProvisioning: protectedProcedure
    .input(z.object({ nasId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const nas = await nasDb.getNasById(input.nasId);
      if (!nas) throw new TRPCError({ code: 'NOT_FOUND', message: 'NAS not found' });
      
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      
      // Only for VPN connections
      if (nas.connectionType === 'public_ip') {
        return { success: false, message: 'Public IP NAS does not need provisioning' };
      }
      
      // Import and run provisioning
      const { provisionNas } = await import('./services/provisioningService');
      const result = await provisionNas(input.nasId);
      
      return result;
    }),

  // Trigger provisioning manually (admin only)
  triggerProvisioning: superAdminProcedure
    .input(z.object({ nasId: z.number() }))
    .mutation(async ({ input }) => {
      const result = await twoPhaseProvisioning.manualProvision(input.nasId);
      return result;
    }),

  // List all NAS with provisioning status
  listWithProvisioningStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      
      let devices;
      if (ctx.user.role === 'super_admin') {
        devices = await db.select().from(nasDevices);
      } else {
        devices = await db.select().from(nasDevices).where(eq(nasDevices.ownerId, ctx.user.id));
      }
      
      return devices.map((nas: any) => ({
        ...nas,
        provisioningStatus: (nas as any).provisioningStatus || 'pending',
        allocatedIp: (nas as any).allocatedIp,
        lastTempIp: (nas as any).lastTempIp,
        lastMac: (nas as any).lastMac,
      }));
    }),
});

// ============================================================================
// WALLET ROUTER
// ============================================================================
const walletRouter = router({
  getMyWallet: protectedProcedure.query(async ({ ctx }) => {
    return walletDb.getWalletByUserId(ctx.user.id);
  }),

  getWalletByUserId: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return walletDb.getWalletByUserId(input.userId);
    }),

  getTransactions: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx }) => {
      return walletDb.getTransactionsByUserId(ctx.user.id);
    }),

  deposit: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      amount: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return walletDb.deposit(input.userId, input.amount, input.description);
    }),

  // Wallet Ledger endpoints
  addCredit: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      amount: z.number().positive(),
      reason: z.string(),
      reasonAr: z.string().optional(),
      entityType: z.string().optional(),
      entityId: z.number().optional(),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { walletLedgerService } = await import("./services/walletLedgerService");
      return walletLedgerService.addCredit({
        ...input,
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
      });
    }),

  deductBalance: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      amount: z.number().positive(),
      reason: z.string(),
      reasonAr: z.string().optional(),
      entityType: z.string().optional(),
      entityId: z.number().optional(),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { walletLedgerService } = await import("./services/walletLedgerService");
      return walletLedgerService.deductBalance({
        ...input,
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
      });
    }),

  getTransactionHistory: protectedProcedure
    .input(z.object({
      userId: z.number().optional(),
      type: z.enum(["credit", "debit"]).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input, ctx }) => {
      const { walletLedgerService } = await import("./services/walletLedgerService");
      const userId = input?.userId || ctx.user.id;
      
      // Only super_admin can view other users' transactions
      if (userId !== ctx.user.id && ctx.user.role !== "super_admin" && ctx.user.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      return walletLedgerService.getTransactionHistory({
        userId,
        type: input?.type,
        startDate: input?.startDate,
        endDate: input?.endDate,
        limit: input?.limit || 50,
        offset: input?.offset || 0,
      });
    }),

  getWalletSummary: protectedProcedure
    .input(z.object({
      userId: z.number().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const { walletLedgerService } = await import("./services/walletLedgerService");
      const userId = input?.userId || ctx.user.id;
      
      // Only super_admin can view other users' summary
      if (userId !== ctx.user.id && ctx.user.role !== "super_admin" && ctx.user.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      return walletLedgerService.getWalletSummary(userId);
    }),
});

// ============================================================================
// RADIUS CARDS ROUTER (Vouchers)
// ============================================================================
const vouchersRouter = router({
  list: resellerProcedure
    .input(z.object({
      status: z.enum(['unused', 'active', 'used', 'expired', 'suspended', 'cancelled']).optional(),
      batchId: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === 'super_admin') {
        return cardDb.getAllCards(input);
      }
      return cardDb.getCardsByReseller(ctx.user.id, input);
    }),

  // Get card by ID - check ownership
  getById: resellerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const card = await cardDb.getCardById(input.id);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && card.createdBy !== ctx.user.id && card.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return card;
    }),

  // Requires active subscription to generate new cards
  generate: activeSubscriptionProcedure
    .input(z.object({
      planId: z.number(),
      quantity: z.number().min(1).max(1000),
      batchName: z.string().optional(),
      purchasePrice: z.number().optional(),
      salePrice: z.number().optional(),
      // New fields for RADIUS card creation
      simultaneousUse: z.number().min(1).max(100).default(1),
      hotspotPort: z.string().optional(),
      timeFromActivation: z.boolean().default(true),
      internetTimeValue: z.number().min(0).default(0),
      internetTimeUnit: z.enum(['hours', 'days']).default('hours'),
      cardTimeValue: z.number().min(0).default(0),
      cardTimeUnit: z.enum(['hours', 'days']).default('hours'),
      macBinding: z.boolean().default(false),
      prefix: z.string().max(10).optional(),
      usernameLength: z.number().min(4).max(20).default(6),
      passwordLength: z.number().min(4).max(20).default(4),
      subscriberGroup: z.string().default('Default group'),
      cardPrice: z.number().default(0),
      // New Time Budget System
      usageBudgetSeconds: z.number().min(0).default(0),
      windowSeconds: z.number().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check billing status - block if past_due
      if (ctx.user.billingStatus === 'past_due') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot generate cards: Your account has insufficient balance. Please add credit to your wallet.',
        });
      }
      
      return cardDb.generateCards({
        ...input,
        createdBy: ctx.user.id,
        resellerId: ctx.user.role === 'reseller' ? ctx.user.id : undefined,
      });
    }),

  // Get subscriber groups for dropdown
  getSubscriberGroups: resellerProcedure.query(async () => {
    return cardDb.getSubscriberGroups();
  }),

  activate: clientProcedure
    .input(z.object({ serialNumber: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return cardDb.activateCard(input.serialNumber, ctx.user.id);
    }),

  // Suspend card - check ownership (requires active subscription)
  suspend: activeSubscriptionProcedure
    .input(z.object({ cardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const card = await cardDb.getCardById(input.cardId);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      if (ctx.user.role !== 'super_admin' && card.createdBy !== ctx.user.id && card.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return cardDb.suspendCard(input.cardId);
    }),

  // Unsuspend card - check ownership (requires active subscription)
  unsuspend: activeSubscriptionProcedure
    .input(z.object({ cardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const card = await cardDb.getCardById(input.cardId);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      if (ctx.user.role !== 'super_admin' && card.createdBy !== ctx.user.id && card.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return cardDb.unsuspendCard(input.cardId);
    }),

  getBatches: resellerProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      return cardDb.getAllBatchesWithStats();
    }
    return cardDb.getBatchesByResellerWithStats(ctx.user.id);
  }),

  // Get batch with statistics - check ownership
  getBatchWithStats: resellerProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const batch = await cardDb.getBatchWithStats(input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && batch.createdBy !== ctx.user.id && batch.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return batch;
    }),

  // Enable batch - activate all cards for RADIUS - check ownership (requires active subscription)
  enableBatch: activeSubscriptionProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const batch = await cardDb.getBatchWithStats(input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      if (ctx.user.role !== 'super_admin' && batch.createdBy !== ctx.user.id && batch.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return cardDb.enableBatch(input.batchId);
    }),

  // Disable batch - deactivate all cards for RADIUS and disconnect active sessions - check ownership (requires active subscription)
  disableBatch: activeSubscriptionProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership first
      const batch = await cardDb.getBatchWithStats(input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      if (ctx.user.role !== 'super_admin' && batch.createdBy !== ctx.user.id && batch.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      // First, get all cards in the batch to disconnect their sessions
      const cards = await cardDb.getCardsByBatch(input.batchId);
      
      // Disconnect all active sessions for these cards
      const disconnectPromises = cards.map(async (card: { username: string }) => {
        try {
          // Disconnect from RADIUS (MikroTik sessions)
          await coaService.disconnectUserAllSessions(card.username);
          // Disconnect from VPN (SoftEther sessions)
          await vpnApi.disconnectVpnSession(card.username);
        } catch (error) {
          console.error(`Failed to disconnect session for ${card.username}:`, error);
        }
      });
      
      await Promise.allSettled(disconnectPromises);
      
      // Then disable the batch in database
      return cardDb.disableBatch(input.batchId);
    }),

  // Update batch time settings - check ownership (requires active subscription)
  updateBatchTime: activeSubscriptionProcedure
    .input(z.object({
      batchId: z.string(),
      cardTimeValue: z.number().optional(),
      cardTimeUnit: z.enum(['hours', 'days']).optional(),
      internetTimeValue: z.number().optional(),
      internetTimeUnit: z.enum(['hours', 'days']).optional(),
      timeFromActivation: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership first
      const batch = await cardDb.getBatchWithStats(input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      if (ctx.user.role !== 'super_admin' && batch.createdBy !== ctx.user.id && batch.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      const { batchId, ...data } = input;
      return cardDb.updateBatchTime(batchId, data);
    }),

  // Update batch properties
  updateBatchProperties: superAdminProcedure
    .input(z.object({
      batchId: z.string(),
      simultaneousUse: z.number().optional(),
      planId: z.number().optional(),
      hotspotPort: z.string().optional(),
      macBinding: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { batchId, ...data } = input;
      return cardDb.updateBatchProperties(batchId, data);
    }),

  // Delete batch
  deleteBatch: superAdminProcedure
    .input(z.object({
      batchId: z.string(),
      deleteCards: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      return cardDb.deleteBatch(input.batchId, input.deleteCards);
    }),

  getCardsByBatch: resellerProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check ownership for non-super_admin
      const batches = await cardDb.getAllBatches();
      const batch = batches.find((b: any) => b.batchId === input.batchId);
      if (batch && ctx.user.role !== 'super_admin' && batch.createdBy !== ctx.user.id && batch.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return cardDb.getCardsByBatch(input.batchId);
    }),

  // Legacy alias for redeem
  redeem: clientProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return cardDb.activateCard(input.code, ctx.user.id);
    }),

  // Generate PDF for batch
  generateBatchPDF: resellerProcedure
    .input(z.object({
      batchId: z.string(),
      companyName: z.string().optional(),
      hotspotUrl: z.string().optional(),
      cardsPerPage: z.number().default(8),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get batch and cards
      const batches = await cardDb.getAllBatches();
      const batch = batches.find((b: any) => b.batchId === input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && batch.createdBy !== ctx.user.id && batch.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const cards = await cardDb.getCardsByBatch(input.batchId);
      if (!cards || cards.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No cards found in batch" });
      }

      // Get plan details for each card
      const plans = await planDb.getAllPlans();
      const planMap = new Map(plans.map((p: any) => [p.id, p]));

      const cardData = cards.map((card: any) => {
        const plan: any = planMap.get(card.planId);
        return {
          serialNumber: card.serialNumber,
          username: card.username,
          password: card.password,
          planName: plan?.name || 'Unknown',
          planNameAr: plan?.nameAr || undefined,
          validityDays: plan?.validityValue || 30,
          downloadSpeed: Math.round((plan?.downloadSpeed || 0) / 1000),
          uploadSpeed: Math.round((plan?.uploadSpeed || 0) / 1000),
          price: plan?.price || '0',
        };
      });

      // Generate and save PDF
      const result = await saveBatchPDF({
        batchId: input.batchId,
        batchName: batch.name,
        cards: cardData,
        companyName: input.companyName,
        hotspotUrl: input.hotspotUrl,
        cardsPerPage: input.cardsPerPage,
      });

      return {
        success: true,
        htmlUrl: result.pdfUrl,
        cardsCount: cards.length,
      };
    }),

  // Get batch PDF HTML (for preview)
  getBatchPDFPreview: resellerProcedure
    .input(z.object({
      batchId: z.string(),
      companyName: z.string().optional(),
      hotspotUrl: z.string().optional(),
      cardsPerPage: z.number().default(8),
    }))
    .query(async ({ ctx, input }) => {
      const batches = await cardDb.getAllBatches();
      const batch = batches.find((b: any) => b.batchId === input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && batch.createdBy !== ctx.user.id && batch.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const cards = await cardDb.getCardsByBatch(input.batchId);
      if (!cards || cards.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No cards found in batch" });
      }

      const plans = await planDb.getAllPlans();
      const planMap = new Map(plans.map((p: any) => [p.id, p]));

      const cardData = cards.map((card: any) => {
        const plan: any = planMap.get(card.planId);
        return {
          serialNumber: card.serialNumber,
          username: card.username,
          password: card.password,
          planName: plan?.name || 'Unknown',
          planNameAr: plan?.nameAr || undefined,
          validityDays: plan?.validityValue || 30,
          downloadSpeed: Math.round((plan?.downloadSpeed || 0) / 1000),
          uploadSpeed: Math.round((plan?.uploadSpeed || 0) / 1000),
          price: plan?.price || '0',
        };
      });

      const html = generateCardsPDFHTML({
        batchId: input.batchId,
        batchName: batch.name,
        cards: cardData,
        companyName: input.companyName,
        hotspotUrl: input.hotspotUrl,
        cardsPerPage: input.cardsPerPage,
      });

      return { html };
    }),

  // Generate PDF with template
  generateBatchPDFWithTemplate: resellerProcedure
    .input(z.object({
      batchId: z.string(),
      templateId: z.number().optional(),
      printSettings: z.object({
        columns: z.number().default(5),
        cardsPerPage: z.number().default(50),
        marginTop: z.number().default(5),
        marginBottom: z.number().default(5),
        marginLeft: z.number().default(5),
        marginRight: z.number().default(5),
        spacingH: z.number().default(2),
        spacingV: z.number().default(2),
      }).optional(),
      qrEnabled: z.boolean().optional(),
      qrDomain: z.string().optional(),
      qrSettings: z.object({
        x: z.number(),
        y: z.number(),
        size: z.number(),
      }).optional(),
      textSettings: z.object({
        username: z.object({
          x: z.number(),
          y: z.number(),
          fontSize: z.number(),
          fontFamily: z.string(),
          color: z.string(),
          align: z.enum(["left", "center", "right"]),
        }),
        password: z.object({
          x: z.number(),
          y: z.number(),
          fontSize: z.number(),
          fontFamily: z.string(),
          color: z.string(),
          align: z.enum(["left", "center", "right"]),
        }),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get batch and cards
      const batches = await cardDb.getAllBatches();
      const batch = batches.find((b: any) => b.batchId === input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      // Check ownership for non-super_admin
      if (ctx.user.role !== 'super_admin' && batch.createdBy !== ctx.user.id && batch.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const cards = await cardDb.getCardsByBatch(input.batchId);
      if (!cards || cards.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No cards found in batch" });
      }

      // Get template if provided
      let template = null;
      if (input.templateId) {
        template = await templateDb.getTemplateById(input.templateId);
      }

      // Get plan details for each card
      const plans = await planDb.getAllPlans();
      const planMap = new Map(plans.map((p: any) => [p.id, p]));

      const cardData = cards.map((card: any) => {
        const plan: any = planMap.get(card.planId);
        return {
          serialNumber: card.serialNumber,
          username: card.username,
          password: card.password,
          planName: plan?.name || 'Unknown',
          planNameAr: plan?.nameAr || undefined,
          validityDays: plan?.validityValue || 30,
          downloadSpeed: Math.round((plan?.downloadSpeed || 0) / 1000),
          uploadSpeed: Math.round((plan?.uploadSpeed || 0) / 1000),
          price: plan?.price || '0',
        };
      });

      // Default print settings
      const printSettings = input.printSettings || {
        columns: 5,
        cardsPerPage: 50,
        marginTop: 5,
        marginBottom: 5,
        marginLeft: 5,
        marginRight: 5,
        spacingH: 2,
        spacingV: 2,
      };

      // Use textSettings from preview if provided, otherwise fall back to template settings
      const textSettings = input.textSettings;
      const qrSettings = {
        enabled: input.qrEnabled ?? template?.qrCodeEnabled ?? false,
        domain: input.qrDomain ?? template?.qrCodeDomain ?? null,
        x: input.qrSettings?.x ?? template?.qrCodeX ?? 10,
        y: input.qrSettings?.y ?? template?.qrCodeY ?? 10,
        size: input.qrSettings?.size ?? template?.qrCodeSize ?? 80,
      };

      // Generate and save PDF with template - using preview settings (WYSIWYG)
      const result = await saveBatchPDFWithTemplate({
        batchId: input.batchId,
        batchName: batch.name,
        cards: cardData,
        printSettings,
        template: template ? {
          imageUrl: template.imageUrl,
          cardWidth: template.cardWidth || 400,
          cardHeight: template.cardHeight || 250,
          // Use textSettings from preview if provided (WYSIWYG)
          usernameX: textSettings?.username.x ?? template.usernameX ?? 50,
          usernameY: textSettings?.username.y ?? template.usernameY ?? 40,
          usernameFontSize: textSettings?.username.fontSize ?? template.usernameFontSize ?? 14,
          usernameFontFamily: textSettings?.username.fontFamily ?? template.usernameFontFamily ?? "Arial",
          usernameFontColor: textSettings?.username.color ?? template.usernameFontColor ?? "#0066cc",
          usernameAlign: (textSettings?.username.align ?? template.usernameAlign ?? "center") as "left" | "center" | "right",
          passwordX: textSettings?.password.x ?? template.passwordX ?? 50,
          passwordY: textSettings?.password.y ?? template.passwordY ?? 60,
          passwordFontSize: textSettings?.password.fontSize ?? template.passwordFontSize ?? 14,
          passwordFontFamily: textSettings?.password.fontFamily ?? template.passwordFontFamily ?? "Arial",
          passwordFontColor: textSettings?.password.color ?? template.passwordFontColor ?? "#cc0000",
          passwordAlign: (textSettings?.password.align ?? template.passwordAlign ?? "center") as "left" | "center" | "right",
          // Use QR settings from preview (WYSIWYG)
          qrCodeEnabled: qrSettings.enabled,
          qrCodeX: qrSettings.x,
          qrCodeY: qrSettings.y,
          qrCodeSize: qrSettings.size,
          qrCodeDomain: qrSettings.domain,
          cardsPerPage: template.cardsPerPage || 8,
          marginTop: template.marginTop || "1.8",
          marginHorizontal: template.marginHorizontal || "1.8",
          columnsPerPage: template.columnsPerPage || 5,
        } : undefined,
      });

      return {
        success: true,
        htmlUrl: result.pdfUrl,
        cardsCount: cards.length,
      };
    }),

  // Export batch as CSV
  exportBatchCSV: resellerProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check ownership for non-super_admin
      const batches = await cardDb.getAllBatches();
      const batch = batches.find((b: any) => b.batchId === input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
      if (ctx.user.role !== 'super_admin' && batch.createdBy !== ctx.user.id && batch.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      const cards = await cardDb.getCardsByBatch(input.batchId);
      if (!cards || cards.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No cards found in batch" });
      }

      const plans = await planDb.getAllPlans();
      const planMap = new Map(plans.map((p: any) => [p.id, p]));

      const cardData = cards.map((card: any) => {
        const plan: any = planMap.get(card.planId);
        return {
          serialNumber: card.serialNumber,
          username: card.username,
          password: card.password,
          planName: plan?.name || 'Unknown',
          validityDays: plan?.validityValue || 30,
          downloadSpeed: Math.round((plan?.downloadSpeed || 0) / 1000),
          uploadSpeed: Math.round((plan?.uploadSpeed || 0) / 1000),
          price: plan?.price || '0',
        };
      });

      const csv = generateCardsCSV(cardData);
      return { csv };
    }),
});

// ============================================================================
// INVOICES ROUTER
// ============================================================================
const invoicesRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['draft', 'pending', 'paid', 'cancelled', 'refunded']).optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === 'super_admin') {
        return invoiceDb.getAllInvoices(input);
      }
      return invoiceDb.getInvoicesByUserId(ctx.user.id, input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const invoice = await invoiceDb.getInvoiceById(input.id);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      
      if (ctx.user.role !== 'super_admin' && invoice.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      return invoice;
    }),

  create: resellerProcedure
    .input(z.object({
      userId: z.number(),
      type: z.enum(['subscription', 'card_purchase', 'deposit', 'other']),
      items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.string(),
      })),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return invoiceDb.createInvoice({
        ...input,
        resellerId: ctx.user.role === 'reseller' ? ctx.user.id : undefined,
      });
    }),

  updateStatus: superAdminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['draft', 'pending', 'paid', 'cancelled', 'refunded']),
    }))
    .mutation(async ({ input }) => {
      return invoiceDb.updateInvoiceStatus(input.id, input.status);
    }),
});

// ============================================================================
// SUBSCRIPTIONS ROUTER (Active Cards)
// ============================================================================
const subscriptionsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['unused', 'active', 'used', 'expired', 'suspended', 'cancelled']).optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === 'super_admin') {
        return subscriptionDb.getAllSubscriptions(input);
      }
      return subscriptionDb.getSubscriptionsByUserId(ctx.user.id, input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const subscription = await subscriptionDb.getSubscriptionById(input.id);
      if (!subscription) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
      
      if (ctx.user.role !== 'super_admin' && subscription.usedBy !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      return subscription;
    }),

  updateStatus: superAdminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['active', 'suspended', 'expired', 'cancelled']),
    }))
    .mutation(async ({ input }) => {
      return subscriptionDb.updateSubscriptionStatus(input.id, input.status);
    }),

  renew: resellerProcedure
    .input(z.object({
      id: z.number(),
      additionalDays: z.number().min(1),
    }))
    .mutation(async ({ input }) => {
      return subscriptionDb.renewSubscription(input.id, input.additionalDays);
    }),

  getActiveSessions: superAdminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      return subscriptionDb.getActiveSessions(input);
    }),

  getOnlineSessions: superAdminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      return subscriptionDb.getOnlineSessions(input);
    }),

  getSessionHistory: superAdminProcedure
    .input(z.object({
      username: z.string().optional(),
      nasIp: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      return subscriptionDb.getSessionHistory(input);
    }),

  disconnectSession: superAdminProcedure
    .input(z.object({ acctSessionId: z.string() }))
    .mutation(async ({ input }) => {
      return subscriptionDb.disconnectSession(input.acctSessionId);
    }),
});

// ============================================================================
// SUPPORT TICKETS ROUTER
// ============================================================================
const ticketsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === 'super_admin') {
        return ticketDb.getAllTickets(input);
      }
      return ticketDb.getTicketsByUserId(ctx.user.id, input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const ticket = await ticketDb.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      
      if (ctx.user.role !== 'super_admin' && ticket.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      return ticket;
    }),

  create: protectedProcedure
    .input(z.object({
      subject: z.string().min(1),
      message: z.string().min(1),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ticketDb.createTicket({
        ...input,
        userId: ctx.user.id,
      });
    }),

  addMessage: protectedProcedure
    .input(z.object({
      ticketId: z.number(),
      message: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return ticketDb.addMessage({
        ...input,
        senderId: ctx.user.id,
      });
    }),

  getMessages: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ ctx, input }) => {
      const ticket = await ticketDb.getTicketById(input.ticketId);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found" });
      
      if (ctx.user.role !== 'super_admin' && ticket.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      return ticketDb.getMessagesByTicketId(input.ticketId);
    }),

  updateStatus: superAdminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']),
    }))
    .mutation(async ({ input }) => {
      return ticketDb.updateTicketStatus(input.id, input.status);
    }),
});

// ============================================================================
// NOTIFICATIONS ROUTER
// ============================================================================
const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({
      unreadOnly: z.boolean().default(false),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return notificationDb.getNotificationsByUserId(ctx.user.id, input);
    }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return notificationDb.markAsRead(input.id, ctx.user.id);
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    return notificationDb.markAllAsRead(ctx.user.id);
  }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    return notificationDb.getUnreadCount(ctx.user.id);
  }),

  // SMS Balance Check (Super Admin only)
  getSmsBalance: superAdminProcedure.query(async () => {
    return multiChannelNotification.getSmsBalance();
  }),

  // Send Test SMS (Super Admin only)
  sendTestSms: superAdminProcedure
    .input(z.object({
      phone: z.string().min(9, "رقم الهاتف غير صالح"),
      message: z.string().min(1, "الرسالة مطلوبة").max(160, "الرسالة طويلة جداً"),
    }))
    .mutation(async ({ input }) => {
      const result = await tweetsmsService.sendSms(input.phone, input.message);
      if (!result.success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.errorMessage || 'فشل إرسال الرسالة' });
      }
      return { success: true, smsId: result.smsId };
    }),

  // Send SMS to User (Super Admin only)
  sendSmsToUser: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      message: z.string().min(1).max(160),
    }))
    .mutation(async ({ input }) => {
      const results = await multiChannelNotification.sendCustomNotification(
        input.userId,
        { ar: 'رسالة من الإدارة', en: 'Message from Admin' },
        { ar: input.message, en: input.message },
        ['sms', 'push']
      );
      const smsResult = results.find(r => r.channel === 'sms');
      if (!smsResult?.success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: smsResult?.error || 'فشل إرسال الرسالة' });
      }
      return { success: true };
    }),

  // Send Bulk SMS (Super Admin only)
  sendBulkSms: superAdminProcedure
    .input(z.object({
      phones: z.array(z.string()).min(1),
      message: z.string().min(1).max(160),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await tweetsmsService.sendBulkSms(input.phones, input.message, undefined, {
        sentBy: ctx.user.id,
      });
      return result;
    }),

  // ============================================================================
  // SMS LOGS
  // ============================================================================
  
  // Get SMS Logs (Super Admin only)
  getSmsLogs: superAdminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      status: z.enum(["pending", "sent", "delivered", "failed"]).optional(),
      type: z.enum(["manual", "bulk", "automatic"]).optional(),
      phone: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return smsDb.getSmsLogs({
        ...input,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
      });
    }),

  // Get SMS Stats (Super Admin only)
  getSmsStats: superAdminProcedure.query(async () => {
    return smsDb.getSmsStats();
  }),

  // ============================================================================
  // SMS TEMPLATES
  // ============================================================================
  
  // Get SMS Templates (Super Admin only)
  getSmsTemplates: superAdminProcedure
    .input(z.object({ activeOnly: z.boolean().default(false) }).optional())
    .query(async ({ input }) => {
      return smsDb.getSmsTemplates(input?.activeOnly);
    }),

  // Get SMS Template by ID (Super Admin only)
  getSmsTemplate: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const template = await smsDb.getSmsTemplateById(input.id);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "القالب غير موجود" });
      }
      return template;
    }),

  // Create SMS Template (Super Admin only)
  createSmsTemplate: superAdminProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      nameAr: z.string().max(100).optional(),
      content: z.string().min(1),
      contentAr: z.string().optional(),
      type: z.enum(["subscription_expiry", "welcome", "payment_reminder", "custom"]).default("custom"),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const id = await smsDb.createSmsTemplate(input);
      return { id, success: true };
    }),

  // Update SMS Template (Super Admin only)
  updateSmsTemplate: superAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      nameAr: z.string().max(100).optional(),
      content: z.string().min(1).optional(),
      contentAr: z.string().optional(),
      type: z.enum(["subscription_expiry", "welcome", "payment_reminder", "custom"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await smsDb.updateSmsTemplate(id, data);
      return { success: true };
    }),

  // Delete SMS Template (Super Admin only)
  deleteSmsTemplate: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await smsDb.deleteSmsTemplate(input.id);
        return { success: true };
      } catch (error) {
        if (error instanceof Error && error.message.includes("system")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن حذف قوالب النظام" });
        }
        throw error;
      }
    }),

  // Send SMS with Template (Super Admin only)
  sendSmsWithTemplate: superAdminProcedure
    .input(z.object({
      phone: z.string().min(9),
      templateId: z.number(),
      variables: z.record(z.string(), z.union([z.string(), z.number()])),
      language: z.enum(["ar", "en"]).default("ar"),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await smsDb.getSmsTemplateById(input.templateId);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "القالب غير موجود" });
      }
      
      const content = input.language === "ar" && template.contentAr 
        ? template.contentAr 
        : template.content;
      
      const message = smsDb.replaceTemplateVariables(content, input.variables);
      
      const result = await tweetsmsService.sendSms(input.phone, message, undefined, {
        templateId: template.id,
        sentBy: ctx.user.id,
        type: "manual",
      });
      
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.errorMessage || "فشل إرسال الرسالة" });
      }
      
      return { success: true, smsId: result.smsId };
    }),
});

// ============================================================================
// DASHBOARD STATS ROUTER
// ============================================================================
const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      // Super admin sees all stats
      const activeSessionsCount = await subscriptionDb.getActiveSessionsCount();
      const allNasDevices = await nasDb.getAllNasDevices();
      const allBatches = await cardDb.getAllBatchesWithStats();
      const totalCards = allBatches.reduce((sum, b) => sum + (b.stats?.total || 0), 0);
      const usedCards = allBatches.reduce((sum, b) => sum + (b.stats?.used || 0), 0);
      
      return {
        totalUsers: 0,
        totalResellers: 0,
        totalClients: 0,
        activeSubscriptions: 0,
        totalRevenue: "0.00",
        pendingInvoices: 0,
        activeSessions: activeSessionsCount,
        openTickets: 0,
        totalNasDevices: allNasDevices.length,
        totalCards,
        usedCards,
      };
    } else {
      // Client/Reseller sees only their own stats
      const ownerNasDevices = await nasDb.getNasDevicesByOwner(ctx.user.id);
      const ownerNasIps = ownerNasDevices.map((n: any) => n.nasname);
      
      // Get active sessions for owner's NAS devices
      const allSessions = await mikrotikApi.getActiveSessions();
      const ownerSessions = allSessions.filter((s: any) => 
        ownerNasIps.includes(s.nasIpAddress || s.nasipaddress)
      );
      
      // Get owner's batches and cards
      const ownerBatches = await cardDb.getBatchesByResellerWithStats(ctx.user.id);
      const totalCards = ownerBatches.reduce((sum, b) => sum + (b.stats?.total || 0), 0);
      const usedCards = ownerBatches.reduce((sum, b) => sum + (b.stats?.used || 0), 0);
      
      return {
        totalNasDevices: ownerNasDevices.length,
        activeSessions: ownerSessions.length,
        totalCards,
        usedCards,
        walletBalance: "0.00",
        pendingInvoices: 0,
      };
    }
  }),
});

// ============================================================================
// SESSIONS ROUTER (Active RADIUS Sessions)
// ============================================================================
const sessionsRouter = router({
  // List sessions - filter by owner's cards/subscribers (multi-tenancy)
  list: protectedProcedure.query(async ({ ctx }) => {
    // Super admin sees all sessions (pass null)
    // Others see only their cards/subscribers sessions
    const ownerId = ctx.user.role === 'super_admin' ? null : ctx.user.id;
    return mikrotikApi.getActiveSessionsByOwner(ownerId);
  }),

  // Get sessions by username - filter by owner's NAS
  getByUsername: protectedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const sessions = await mikrotikApi.getSessionsByUsername(input.username);
      
      if (ctx.user.role === 'super_admin') {
        return sessions;
      }
      
      const ownerNasDevices = await nasDb.getNasDevicesByOwner(ctx.user.id);
      const ownerNasIps = ownerNasDevices.map((n: any) => n.nasname);
      return sessions.filter((s: any) => ownerNasIps.includes(s.nasIpAddress || s.nasipaddress));
    }),

  // Get sessions by NAS - check ownership
  getByNas: protectedProcedure
    .input(z.object({ nasIp: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasByIp(input.nasIp);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS not found" });
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return mikrotikApi.getSessionsByNas(input.nasIp);
    }),

  // Disconnect session - check NAS ownership
  disconnect: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      nasIp: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasByIp(input.nasIp);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS not found" });
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return mikrotikApi.disconnectSession(input.sessionId, input.nasIp);
    }),

  // Disconnect user - check card ownership
  disconnectUser: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user owns the card
      if (ctx.user.role !== 'super_admin') {
        const card = await cardDb.getCardByUsername(input.username);
        if (card && card.createdBy !== ctx.user.id && card.resellerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
      }
      // Disconnect from RADIUS (MikroTik sessions)
      const radiusResult = await mikrotikApi.disconnectUserSessions(input.username);
      
      // Also disconnect from VPN (SoftEther sessions)
      try {
        await vpnApi.disconnectVpnSession(input.username);
      } catch (error) {
        console.error('Failed to disconnect VPN session:', error);
      }
      
      return radiusResult;
    }),

  // Get VPN sessions
  getVpnSessions: superAdminProcedure.query(async () => {
    return vpnApi.getVpnSessions();
  }),

  // Disconnect VPN session
  disconnectVpnSession: superAdminProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ input }) => {
      return vpnApi.disconnectVpnSession(input.username);
    }),

  getStats: superAdminProcedure.query(async () => {
    return mikrotikApi.getSessionStats();
  }),

  // Generate MikroTik configuration script
  generateMikroTikScript: superAdminProcedure
    .input(z.object({
      radiusServerIp: z.string(),
      radiusSecret: z.string(),
      pppoePoolName: z.string().optional(),
      pppoePoolRange: z.string().optional(),
      hotspotEnabled: z.boolean().optional(),
      hotspotInterface: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const script = mikrotikApi.generateMikroTikScript(input);
      return { script };
    }),

  // Generate FreeRADIUS client config
  generateFreeRadiusConfig: superAdminProcedure
    .input(z.object({
      nasIp: z.string(),
      nasName: z.string(),
      secret: z.string(),
      nasType: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const config = mikrotikApi.generateFreeRadiusClientConfig(input);
      return { config };
    }),

  // ============================================
  // CoA (Change of Authorization) Endpoints
  // ============================================
  
  // Disconnect a specific session using CoA
  coaDisconnect: protectedProcedure
    .input(z.object({
      username: z.string(),
      nasIp: z.string(),
      sessionId: z.string().optional(),
      framedIp: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasByIp(input.nasIp);
      if (!nas) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NAS not found" });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this NAS" });
      }
      
      const result = await coaService.disconnectSession(
        input.username,
        input.nasIp,
        input.sessionId,
        input.framedIp
      );
      
      // Log audit
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'session_disconnect_coa',
        targetType: 'session',
        targetId: input.sessionId || input.username,
        targetName: input.username,
        nasId: nas.id,
        nasIp: input.nasIp,
        details: { sessionId: input.sessionId, framedIp: input.framedIp },
        result: result.success ? 'success' : 'failure',
        errorMessage: result.success ? undefined : result.error,
      });
      
      return result;
    }),

  // Disconnect all sessions for a user using CoA
  coaDisconnectUser: protectedProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check card ownership
      const card = await cardDb.getCardByUsername(input.username);
      if (!card) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      if (ctx.user.role !== 'super_admin' && card.createdBy !== ctx.user.id && card.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this user" });
      }
      
      const result = await coaService.disconnectUserAllSessions(input.username);
      
      // Log audit
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'session_disconnect_coa',
        targetType: 'session',
        targetId: input.username,
        targetName: input.username,
        details: { allSessions: true },
        result: result.success ? 'success' : 'failure',
        errorMessage: result.success ? undefined : result.error,
      });
      
      return result;
    }),

  // Update session attributes (speed, timeout) using CoA
  coaUpdateSession: protectedProcedure
    .input(z.object({
      username: z.string(),
      nasIp: z.string(),
      sessionId: z.string(),
      framedIp: z.string().optional(),
      downloadSpeed: z.number().optional(),
      uploadSpeed: z.number().optional(),
      sessionTimeout: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasByIp(input.nasIp);
      if (!nas) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NAS not found" });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this NAS" });
      }
      
      const result = await coaService.updateSessionAttributes(
        input.username,
        input.nasIp,
        input.sessionId,
        input.framedIp,
        {
          downloadSpeed: input.downloadSpeed,
          uploadSpeed: input.uploadSpeed,
          sessionTimeout: input.sessionTimeout,
        }
      );
      
      // Log audit
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'speed_change_coa',
        targetType: 'session',
        targetId: input.sessionId,
        targetName: input.username,
        nasId: nas.id,
        nasIp: input.nasIp,
        details: { downloadSpeed: input.downloadSpeed, uploadSpeed: input.uploadSpeed, sessionTimeout: input.sessionTimeout },
        result: result.success ? 'success' : 'failure',
        errorMessage: result.success ? undefined : result.error,
      });
      
      return result;
    }),

  // Change user speed with fallback to disconnect
  changeUserSpeed: protectedProcedure
    .input(z.object({
      username: z.string(),
      uploadSpeedMbps: z.number(),
      downloadSpeedMbps: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check card ownership
      const card = await cardDb.getCardByUsername(input.username);
      if (!card) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      if (ctx.user.role !== 'super_admin' && card.createdBy !== ctx.user.id && card.resellerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this user" });
      }
      
      const result = await coaService.changeUserSpeed(
        input.username,
        input.uploadSpeedMbps,
        input.downloadSpeedMbps
      );
      
      // Log audit
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'speed_change',
        targetType: 'session',
        targetId: input.username,
        targetName: input.username,
        details: { uploadSpeedMbps: input.uploadSpeedMbps, downloadSpeedMbps: input.downloadSpeedMbps },
        result: result.success ? 'success' : 'failure',
        errorMessage: result.success ? undefined : result.error,
      });
      
      return result;
    }),

  // Test CoA connectivity to a NAS
  coaTest: superAdminProcedure
    .input(z.object({ nasIp: z.string() }))
    .query(async ({ input }) => {
      return coaService.testCoAConnection(input.nasIp);
    }),

  // ============================================
  // Accounting Endpoints
  // ============================================
  
  // Get usage statistics for a user
  getUserUsage: superAdminProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      return accountingService.getUserUsageStats(input.username);
    }),

  // Get time balance for a user/card
  getTimeBalance: superAdminProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      const balance = await accountingService.getTimeBalance(input.username);
      if (!balance) return null;
      
      return {
        ...balance,
        allocatedTimeFormatted: accountingService.formatTime((balance as any).allocatedTime || 0),
        usedTimeFormatted: accountingService.formatTime((balance as any).usedTime || 0),
        remainingTimeFormatted: accountingService.formatTime((balance as any).remainingTime || 0),
      };
    }),

  // Get users with low remaining time
  getLowTimeUsers: superAdminProcedure
    .input(z.object({ thresholdMinutes: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      const threshold = input?.thresholdMinutes || 30;
      const users = await accountingService.getUsersWithLowTime(threshold);
      return users.map((u: any) => ({
        ...u,
        remainingTimeFormatted: accountingService.formatTime(u.remainingTime || 0),
      }));
    }),

  // Check and disconnect expired users
  checkExpiredUsers: superAdminProcedure
    .mutation(async () => {
      return accountingService.checkAndDisconnectExpiredUsers();
    }),

  // Update session timeout for a user based on remaining time
  updateUserTimeout: superAdminProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ input }) => {
      const success = await accountingService.updateSessionTimeout(input.username);
      return { success };
    }),

  // ============================================
  // Session Monitor Endpoints
  // ============================================
  
  // Get session monitor status
  monitorStatus: superAdminProcedure
    .query(async () => {
      return sessionMonitor.getMonitorStatus();
    }),

  // Manually trigger a session check
  triggerMonitorCheck: superAdminProcedure
    .mutation(async () => {
      return sessionMonitor.triggerCheck();
    }),

  // Start session monitor
  startMonitor: superAdminProcedure
    .input(z.object({ intervalMs: z.number().default(30000) }).optional())
    .mutation(async ({ input }) => {
      sessionMonitor.startMonitor(input?.intervalMs || 30000);
      return { success: true, message: 'Session monitor started' };
    }),

  // Stop session monitor
  stopMonitor: superAdminProcedure
    .mutation(async () => {
      sessionMonitor.stopMonitor();
      return { success: true, message: 'Session monitor stopped' };
    }),

  // ============================================
  // MikroTik API Direct Control Endpoints
  // ============================================
  
  // Change user speed via MikroTik API (without disconnecting)
  mikrotikChangeSpeed: protectedProcedure
    .input(z.object({
      nasIp: z.string(),
      username: z.string(),
      uploadSpeedKbps: z.number(),
      downloadSpeedKbps: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasByIp(input.nasIp);
      if (!nas) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NAS not found" });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this NAS" });
      }
      
      // Try MikroTik API first
      let result = await mikrotikApi.changeUserSpeedViaMikroTikApi(
        input.nasIp,
        input.username,
        input.uploadSpeedKbps,
        input.downloadSpeedKbps
      );
      
      // Fallback to CoA if API fails
      let method = 'api';
      if (!result.success && nas.apiEnabled) {
        console.log(`[MikroTik API] Failed, falling back to CoA for ${input.username}`);
        const coaResult = await coaService.changeUserSpeed(
          input.username,
          input.uploadSpeedKbps / 1000, // Convert Kbps to Mbps
          input.downloadSpeedKbps / 1000
        );
        result = { ...coaResult, method: 'coa_fallback' };
        method = 'coa_fallback';
      }
      
      // Log audit
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'speed_change_api',
        targetType: 'session',
        targetId: input.username,
        targetName: input.username,
        nasId: nas.id,
        nasIp: input.nasIp,
        details: { uploadSpeedKbps: input.uploadSpeedKbps, downloadSpeedKbps: input.downloadSpeedKbps, method },
        result: result.success ? 'success' : 'failure',
        errorMessage: result.success ? undefined : result.error,
      });
      
      return result;
    }),

  // Disconnect user via MikroTik API
  mikrotikDisconnect: protectedProcedure
    .input(z.object({
      nasIp: z.string(),
      username: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasByIp(input.nasIp);
      if (!nas) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NAS not found" });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this NAS" });
      }
      
      // Try MikroTik API first
      let result = await mikrotikApi.disconnectUserViaMikroTikApi(
        input.nasIp,
        input.username
      );
      
      // Fallback to CoA if API fails
      let method = 'api';
      if (!result.success && nas.apiEnabled) {
        console.log(`[MikroTik API] Failed, falling back to CoA for ${input.username}`);
        const coaResult = await coaService.disconnectUserAllSessions(input.username);
        result = { ...coaResult, method: 'coa_fallback' };
        method = 'coa_fallback';
      }
      
      // Log audit
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'session_disconnect_api',
        targetType: 'session',
        targetId: input.username,
        targetName: input.username,
        nasId: nas.id,
        nasIp: input.nasIp,
        details: { method },
        result: result.success ? 'success' : 'failure',
        errorMessage: result.success ? undefined : result.error,
      });
      
      return result;
    }),

  // Get active users from MikroTik via API
  mikrotikGetActiveUsers: protectedProcedure
    .input(z.object({ nasIp: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasByIp(input.nasIp);
      if (!nas) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NAS not found" });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this NAS" });
      }
      
      return mikrotikApi.getActiveUsersViaMikroTikApi(input.nasIp);
    }),

  // Check user time status (Max-All-Session + Expiration)
  checkUserTimeStatus: protectedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check card ownership
      if (ctx.user.role !== 'super_admin') {
        const card = await cardDb.getCardByUsername(input.username);
        if (card && card.createdBy !== ctx.user.id && card.resellerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
      }
      
      const status = await sessionMonitor.checkUserTimeStatus(input.username);
      if (!status) {
        return null;
      }
      
      return {
        ...status,
        maxAllSessionFormatted: status.maxAllSession > 0 
          ? accountingService.formatTime(status.maxAllSession) 
          : 'غير محدود',
        totalUsedTimeFormatted: accountingService.formatTime(status.totalUsedTime),
        remainingInternetTimeFormatted: status.remainingInternetTime >= 0 
          ? accountingService.formatTime(status.remainingInternetTime) 
          : 'غير محدود',
        expirationDateFormatted: status.expirationDate 
          ? status.expirationDate.toLocaleString('ar-SA') 
          : 'غير محدد',
      };
    }),
});

// ============================================================================
// CARD TEMPLATES ROUTER
// ============================================================================
const templatesRouter = router({
  // List all templates
  list: resellerProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      return templateDb.getTemplates();
    }
    return templateDb.getTemplates(ctx.user.id);
  }),

  // Get single template
  getById: resellerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const template = await templateDb.getTemplateById(input.id);
      return template ?? null;
    }),

  // Get default template
  getDefault: resellerProcedure.query(async ({ ctx }) => {
    let template;
    if (ctx.user.role === 'super_admin') {
      template = await templateDb.getDefaultTemplate();
    } else {
      template = await templateDb.getDefaultTemplate(ctx.user.id);
    }
    // Return null instead of undefined to avoid tRPC error
    return template ?? null;
  }),

  // Create template with image upload
  create: resellerProcedure
    .input(z.object({
      name: z.string().min(1),
      imageBase64: z.string(), // Base64 encoded image
      imageType: z.string().default('image/png'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Decode base64 and upload to S3
      const buffer = Buffer.from(input.imageBase64, 'base64');
      const fileKey = `templates/${ctx.user.id}/${Date.now()}-${input.name.replace(/\s+/g, '_')}.png`;
      const { url } = await storagePut(fileKey, buffer, input.imageType);

      // Create template in database
      const id = await templateDb.createTemplate({
        name: input.name,
        resellerId: ctx.user.role === 'super_admin' ? null : ctx.user.id,
        imageUrl: url,
        imageKey: fileKey,
      });

      return { id, imageUrl: url };
    }),

  // Create multiple templates at once
  createMultiple: resellerProcedure
    .input(z.array(z.object({
      name: z.string().min(1),
      imageBase64: z.string(),
      imageType: z.string().default('image/png'),
    })))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      for (const template of input) {
        const buffer = Buffer.from(template.imageBase64, 'base64');
        const fileKey = `templates/${ctx.user.id}/${Date.now()}-${template.name.replace(/\s+/g, '_')}.png`;
        const { url } = await storagePut(fileKey, buffer, template.imageType);

        const id = await templateDb.createTemplate({
          name: template.name,
          resellerId: ctx.user.role === 'super_admin' ? null : ctx.user.id,
          imageUrl: url,
          imageKey: fileKey,
        });

        results.push({ id, name: template.name, imageUrl: url });
      }
      return results;
    }),

  // Update template
  update: resellerProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      // Text positions
      usernameX: z.number().optional(),
      usernameY: z.number().optional(),
      passwordX: z.number().optional(),
      passwordY: z.number().optional(),
      // Username font settings
      usernameFontSize: z.number().optional(),
      usernameFontFamily: z.string().optional(),
      usernameFontColor: z.string().optional(),
      usernameAlign: z.enum(['left', 'center', 'right']).optional(),
      // Password font settings
      passwordFontSize: z.number().optional(),
      passwordFontFamily: z.string().optional(),
      passwordFontColor: z.string().optional(),
      passwordAlign: z.enum(['left', 'center', 'right']).optional(),
      // QR Code settings
      qrCodeEnabled: z.boolean().optional(),
      qrCodeX: z.number().optional(),
      qrCodeY: z.number().optional(),
      qrCodeSize: z.number().optional(),
      qrCodeDomain: z.string().optional(),
      // Print settings
      cardsPerPage: z.number().optional(),
      marginTop: z.string().optional(),
      marginHorizontal: z.string().optional(),
      columnsPerPage: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await templateDb.updateTemplate(id, data);
      return { success: true };
    }),

  // Set as default
  setDefault: resellerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const resellerId = ctx.user.role === 'super_admin' ? undefined : ctx.user.id;
      await templateDb.setDefaultTemplate(input.id, resellerId);
      return { success: true };
    }),

  // Delete template
  delete: resellerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await templateDb.deleteTemplate(input.id);
      return { success: true };
    }),
});

// ============================================================================
// SETTINGS ROUTER
// ============================================================================
const settingsRouter = router({
  getAll: superAdminProcedure.query(async () => {
    return db.getSystemSettings();
  }),
  
  get: superAdminProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      return db.getSystemSetting(input.key);
    }),
  
  update: superAdminProcedure
    .input(z.object({
      key: z.string(),
      value: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.setSystemSetting(input.key, input.value, input.description);
      return { success: true };
    }),
});

// ============================================================================
// TENANT SUBSCRIPTIONS ROUTER (Admin only)
// ============================================================================
import * as tenantSubDb from "./_core/tenantSubscriptions";
import * as reportsService from "./services/reportsService";
import * as reportExporter from "./services/reportExporter";
import * as backupService from "./services/backupService";
import * as internalNotificationService from "./services/internalNotificationService";

const tenantSubscriptionsRouter = router({
  // Get all tenant subscriptions (Super Admin only)
  list: superAdminProcedure.query(async () => {
    const subscriptions = await tenantSubDb.getAllTenantSubscriptions();
    // Get user info for each subscription
    const enriched = await Promise.all(
      subscriptions.map(async (sub: any) => {
        const user = await db.getUserById(sub.tenantId);
        return {
          ...sub,
          tenantName: user?.name || 'Unknown',
          tenantEmail: user?.email || 'Unknown',
        };
      })
    );
    return enriched;
  }),

  // Get subscription by tenant ID
  getByTenantId: superAdminProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return tenantSubDb.getSubscriptionByTenantId(input.tenantId);
    }),

  // Get current user's subscription status
  myStatus: protectedProcedure.query(async ({ ctx }) => {
    return tenantSubDb.getSubscriptionStatus(ctx.user.id);
  }),

  // Create subscription for a tenant (Super Admin only)
  create: superAdminProcedure
    .input(z.object({
      tenantId: z.number(),
      months: z.number().min(1).default(1),
      pricePerMonth: z.string().default("10.00"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if subscription already exists
      const existing = await tenantSubDb.getSubscriptionByTenantId(input.tenantId);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Subscription already exists for this tenant. Use extend or activate instead.",
        });
      }
      return tenantSubDb.createTenantSubscription({
        ...input,
        createdBy: ctx.user.id,
      });
    }),

  // Extend subscription (Super Admin only)
  extend: superAdminProcedure
    .input(z.object({
      tenantId: z.number(),
      months: z.number().min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await tenantSubDb.extendTenantSubscription(
        input.tenantId,
        input.months,
        ctx.user.id,
        input.notes
      );
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found for this tenant.",
        });
      }
      return result;
    }),

  // Suspend subscription (Super Admin only)
  suspend: superAdminProcedure
    .input(z.object({
      tenantId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return tenantSubDb.suspendTenantSubscription(input.tenantId, input.notes);
    }),

  // Activate subscription (Super Admin only)
  activate: superAdminProcedure
    .input(z.object({
      tenantId: z.number(),
      months: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await tenantSubDb.activateTenantSubscription(
        input.tenantId,
        input.months,
        ctx.user.id
      );
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found for this tenant.",
        });
      }
      return result;
    }),

  // Get expiring subscriptions (Super Admin only)
  getExpiring: superAdminProcedure
    .input(z.object({ withinDays: z.number().default(7) }))
    .query(async ({ input }) => {
      return tenantSubDb.getExpiringSubscriptions(input.withinDays);
    }),

  // Delete subscription (Super Admin only)
  delete: superAdminProcedure
    .input(z.object({ tenantId: z.number() }))
    .mutation(async ({ input }) => {
      return tenantSubDb.deleteTenantSubscription(input.tenantId);
    }),
});

// ============================================================================
// REPORTS ROUTER
// ============================================================================
const reportsRouter = router({
  // Get dashboard summary
  dashboardSummary: protectedProcedure.query(async ({ ctx }) => {
    return reportsService.getDashboardSummary(ctx.user.id);
  }),

  // Get revenue report
  revenue: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      groupBy: z.enum(["day", "week", "month"]).default("day"),
    }))
    .query(async ({ ctx, input }) => {
      return reportsService.getRevenueReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate),
        input.groupBy
      );
    }),

  // Get subscribers report
  subscribers: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return reportsService.getSubscribersReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
    }),

  // Get cards report
  cards: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return reportsService.getCardsReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
    }),

  // Get sessions report
  sessions: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return reportsService.getSessionsReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
    }),

  // Export revenue to Excel
  exportRevenueExcel: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      groupBy: z.enum(["day", "week", "month"]).default("day"),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = await reportsService.getRevenueReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate),
        input.groupBy
      );
      const buffer = reportExporter.generateRevenueExcel(data);
      return { data: buffer.toString("base64"), filename: `revenue-report-${input.startDate}-${input.endDate}.xlsx` };
    }),

  // Export cards to Excel
  exportCardsExcel: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = await reportsService.getCardsReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      const buffer = reportExporter.generateCardsExcel(data);
      return { data: buffer.toString("base64"), filename: `cards-report-${input.startDate}-${input.endDate}.xlsx` };
    }),

  // Export sessions to Excel
  exportSessionsExcel: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = await reportsService.getSessionsReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      const buffer = reportExporter.generateSessionsExcel(data);
      return { data: buffer.toString("base64"), filename: `sessions-report-${input.startDate}-${input.endDate}.xlsx` };
    }),

  // Export subscribers to Excel
  exportSubscribersExcel: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = await reportsService.getSubscribersReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      const buffer = reportExporter.generateSubscribersExcel(data);
      return { data: buffer.toString("base64"), filename: `subscribers-report-${input.startDate}-${input.endDate}.xlsx` };
    }),

  // Export revenue to PDF (HTML)
  exportRevenuePDF: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      groupBy: z.enum(["day", "week", "month"]).default("day"),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = await reportsService.getRevenueReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate),
        input.groupBy
      );
      const dateRange = `${input.startDate} - ${input.endDate}`;
      const html = reportExporter.generateRevenuePDFHTML(data, dateRange);
      return { html, filename: `revenue-report-${input.startDate}-${input.endDate}.html` };
    }),

  // Export cards to PDF (HTML)
  exportCardsPDF: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = await reportsService.getCardsReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      const dateRange = `${input.startDate} - ${input.endDate}`;
      const html = reportExporter.generateCardsPDFHTML(data, dateRange);
      return { html, filename: `cards-report-${input.startDate}-${input.endDate}.html` };
    }),

  // Export sessions to PDF (HTML)
  exportSessionsPDF: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = await reportsService.getSessionsReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      const dateRange = `${input.startDate} - ${input.endDate}`;
      const html = reportExporter.generateSessionsPDFHTML(data, dateRange);
      return { html, filename: `sessions-report-${input.startDate}-${input.endDate}.html` };
    }),

  // Get usage report (peak hours, daily/weekly)
  usage: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return reportsService.getUsageReport(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
    }),

  // Get bandwidth usage report from radacct
  getBandwidthUsage: superAdminProcedure
    .input(z.object({
      dateRange: z.string().default('today'),
      sortBy: z.string().default('totalData'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { userUsage: [], nasUsage: [], stats: { totalDownload: 0, totalUpload: 0, totalData: 0, activeUsers: 0 } };
      
      const { radacct } = await import('../drizzle/schema');
      const { sql, and, gte, lte, desc, asc, count, sum, countDistinct } = await import('drizzle-orm');
      
      // Build date filter
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      const now = new Date();
      
      switch (input.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      
      const conditions: any[] = [];
      if (startDate) conditions.push(gte(radacct.acctstarttime, startDate));
      if (endDate) conditions.push(lte(radacct.acctstarttime, endDate));
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      // Get user usage
      const userUsage = await db.select({
        username: radacct.username,
        totalDownload: sum(radacct.acctinputoctets),
        totalUpload: sum(radacct.acctoutputoctets),
        sessionCount: count(),
        totalTime: sum(radacct.acctsessiontime),
      })
        .from(radacct)
        .where(whereClause)
        .groupBy(radacct.username)
        .orderBy(input.sortOrder === 'desc' ? desc(sum(radacct.acctinputoctets)) : asc(sum(radacct.acctinputoctets)))
        .limit(100);
      
      // Get NAS usage
      const nasUsage = await db.select({
        nasipaddress: radacct.nasipaddress,
        totalDownload: sum(radacct.acctinputoctets),
        totalUpload: sum(radacct.acctoutputoctets),
        userCount: countDistinct(radacct.username),
        sessionCount: count(),
      })
        .from(radacct)
        .where(whereClause)
        .groupBy(radacct.nasipaddress)
        .orderBy(input.sortOrder === 'desc' ? desc(sum(radacct.acctinputoctets)) : asc(sum(radacct.acctinputoctets)));
      
      // Get NAS names
      const nasNames = await db.select({ nasname: nasDevices.nasname, shortname: nasDevices.shortname })
        .from(nasDevices);
      const nasNameMap = new Map(nasNames.map((n: any) => [n.nasname, n.shortname]));
      
      // Get overall stats
      const statsResult = await db.select({
        totalDownload: sum(radacct.acctinputoctets),
        totalUpload: sum(radacct.acctoutputoctets),
        activeUsers: countDistinct(radacct.username),
      })
        .from(radacct)
        .where(whereClause);
      
      const stats = statsResult[0] || { totalDownload: 0, totalUpload: 0, activeUsers: 0 };
      
      return {
        userUsage: userUsage.map((u: any) => ({
          username: u.username,
          totalDownload: Number(u.totalDownload) || 0,
          totalUpload: Number(u.totalUpload) || 0,
          totalData: (Number(u.totalDownload) || 0) + (Number(u.totalUpload) || 0),
          sessionCount: u.sessionCount,
          totalTime: Number(u.totalTime) || 0,
          lastActivity: null,
        })),
        nasUsage: nasUsage.map((n: any) => ({
          nasipaddress: n.nasipaddress,
          nasShortname: nasNameMap.get(n.nasipaddress) || null,
          totalDownload: Number(n.totalDownload) || 0,
          totalUpload: Number(n.totalUpload) || 0,
          totalData: (Number(n.totalDownload) || 0) + (Number(n.totalUpload) || 0),
          userCount: n.userCount,
          sessionCount: n.sessionCount,
        })),
        stats: {
          totalDownload: Number(stats.totalDownload) || 0,
          totalUpload: Number(stats.totalUpload) || 0,
          totalData: (Number(stats.totalDownload) || 0) + (Number(stats.totalUpload) || 0),
          activeUsers: stats.activeUsers || 0,
        },
      };
    }),
});

// ============================================================================
// INTERNAL NOTIFICATIONS ROUTER
// ============================================================================
const internalNotificationsRouter = router({
  // Get notifications for current user
  list: protectedProcedure
    .input(z.object({
      limit: z.number().optional(),
      unreadOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return internalNotificationService.getNotifications(ctx.user.id, {
        limit: input?.limit,
        unreadOnly: input?.unreadOnly,
      });
    }),

  // Get unread count
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return internalNotificationService.getUnreadCount(ctx.user.id);
  }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await internalNotificationService.markAsRead(input.id, ctx.user.id);
      return { success };
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const success = await internalNotificationService.markAllAsRead(ctx.user.id);
    return { success };
  }),

  // Delete notification
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await internalNotificationService.deleteNotification(input.id, ctx.user.id);
      return { success };
    }),
});

// ============================================================================
// BACKUPS ROUTER (Super Admin only)
// ============================================================================
const backupsRouter = router({
  // List all backups
  list: superAdminProcedure
    .input(z.object({
      type: z.enum(["daily", "weekly", "manual"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      return backupService.listBackups(input?.type);
    }),

  // Get backup statistics
  stats: superAdminProcedure.query(async () => {
    return backupService.getBackupStats();
  }),

  // Create manual backup
  create: superAdminProcedure.mutation(async () => {
    return backupService.createDatabaseBackup("manual");
  }),

  // Download backup
  download: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const content = await backupService.getBackupContent(input.id);
      if (!content) {
        throw new TRPCError({ code: "NOT_FOUND", message: "النسخة الاحتياطية غير موجودة" });
      }
      const backup = await backupService.getBackup(input.id);
      return {
        data: content.toString("base64"),
        filename: backup?.filename || "backup.sql",
      };
    }),

  // Delete backup
  delete: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const success = await backupService.deleteBackup(input.id);
      if (!success) {
        throw new TRPCError({ code: "NOT_FOUND", message: "النسخة الاحتياطية غير موجودة" });
      }
      return { success: true };
    }),

  // Cleanup old backups
  cleanup: superAdminProcedure.mutation(async () => {
    return backupService.cleanupOldBackups();
  }),

  // Run scheduled backup manually
  runScheduled: superAdminProcedure
    .input(z.object({ type: z.enum(["daily", "weekly"]) }))
    .mutation(async ({ input }) => {
      await backupService.runScheduledBackup(input.type);
      return { success: true };
    }),
});

// ============================================================================
// PPPoE SUBSCRIBERS ROUTER
// ============================================================================
const subscribersRouter = router({
  // List all subscribers for owner
  list: resellerProcedure.query(async ({ ctx }) => {
    const subscribers = await db.getSubscribersByOwner(ctx.user.id);
    const stats = await db.getSubscriberStats(ctx.user.id);
    return { subscribers, stats };
  }),

  // Get single subscriber
  get: resellerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const subscriber = await db.getSubscriberById(input.id);
      if (!subscriber) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'المشترك غير موجود' });
      }
      // Check ownership
      if (subscriber.subscriber.ownerId !== ctx.user.id && subscriber.subscriber.createdBy !== ctx.user.id && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح' });
      }
      return subscriber;
    }),

  // Create new subscriber
  create: resellerProcedure
    .input(z.object({
      username: z.string().min(3).max(64),
      password: z.string().min(4).max(64),
      fullName: z.string().min(2).max(255),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      nationalId: z.string().optional(),
      notes: z.string().optional(),
      planId: z.number(),
      nasId: z.number().optional(),
      ipAssignmentType: z.enum(['dynamic', 'static']).optional(),
      staticIp: z.string().optional(),
      simultaneousUse: z.number().min(1).max(10).optional(),
      macAddress: z.string().optional(),
      macBindingEnabled: z.boolean().optional(),
      subscriptionMonths: z.number().min(1).max(24).optional(),
      amount: z.number().min(0).optional(),
      paymentMethod: z.enum(['cash', 'wallet', 'card', 'bank_transfer', 'online']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if username exists
      const exists = await db.subscriberUsernameExists(input.username);
      if (exists) {
        throw new TRPCError({ code: 'CONFLICT', message: 'اسم المستخدم موجود مسبقاً' });
      }

      // Create subscriber
      const subscriberId = await db.createSubscriber({
        ...input,
        ownerId: ctx.user.id,
        createdBy: ctx.user.id,
      });

      // Get subscriber to get subscription end date
      const subscriber = await db.getSubscriberById(subscriberId);
      if (subscriber && subscriber.subscriber.subscriptionEndDate) {
        // Create RADIUS entries for PPPoE authentication
        await radiusSubscribers.createSubscriberRadiusEntries(
          input.username,
          input.password,
          input.planId,
          new Date(subscriber.subscriber.subscriptionEndDate),
          {
            simultaneousUse: input.simultaneousUse,
            staticIp: input.staticIp,
          }
        );
      }

      return { id: subscriberId, success: true };
    }),

  // Update subscriber
  update: resellerProcedure
    .input(z.object({
      id: z.number(),
      fullName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      nationalId: z.string().optional(),
      notes: z.string().optional(),
      planId: z.number().optional(),
      nasId: z.number().optional(),
      ipAssignmentType: z.enum(['dynamic', 'static']).optional(),
      staticIp: z.string().optional(),
      simultaneousUse: z.number().optional(),
      macAddress: z.string().optional(),
      macBindingEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const subscriber = await db.getSubscriberById(input.id);
      if (!subscriber) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'المشترك غير موجود' });
      }
      // Check ownership
      if (subscriber.subscriber.ownerId !== ctx.user.id && subscriber.subscriber.createdBy !== ctx.user.id && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح' });
      }

      const { id, ...data } = input;
      await db.updateSubscriber(id, data);

      return { success: true };
    }),

  // Suspend subscriber
  suspend: resellerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const subscriber = await db.getSubscriberById(input.id);
      if (!subscriber) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'المشترك غير موجود' });
      }
      // Check ownership
      if (subscriber.subscriber.ownerId !== ctx.user.id && subscriber.subscriber.createdBy !== ctx.user.id && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح' });
      }

      await db.suspendSubscriber(input.id);

      // Suspend in RADIUS (set Auth-Type to Reject)
      await radiusSubscribers.suspendSubscriberRadius(subscriber.subscriber.username);

      // Send CoA Disconnect to kick user off
      try {
        await coaService.disconnectUserAllSessions(subscriber.subscriber.username);
      } catch (e) {
        console.error('[Subscribers] Failed to disconnect user:', e);
      }

      return { success: true };
    }),

  // Activate subscriber
  activate: resellerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const subscriber = await db.getSubscriberById(input.id);
      if (!subscriber) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'المشترك غير موجود' });
      }
      // Check ownership
      if (subscriber.subscriber.ownerId !== ctx.user.id && subscriber.subscriber.createdBy !== ctx.user.id && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح' });
      }

      await db.activateSubscriber(input.id);

      // Activate in RADIUS (set Auth-Type to Accept)
      await radiusSubscribers.activateSubscriberRadius(subscriber.subscriber.username);

      return { success: true };
    }),

  // Renew subscription
  renew: resellerProcedure
    .input(z.object({
      id: z.number(),
      months: z.number().min(1).max(24),
      amount: z.number().min(0),
      paymentMethod: z.enum(['cash', 'wallet', 'card', 'bank_transfer', 'online']).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const subscriber = await db.getSubscriberById(input.id);
      if (!subscriber) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'المشترك غير موجود' });
      }
      // Check ownership
      if (subscriber.subscriber.ownerId !== ctx.user.id && subscriber.subscriber.createdBy !== ctx.user.id && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح' });
      }

      const result = await db.renewSubscription(
        input.id,
        input.months,
        input.amount,
        ctx.user.id,
        input.paymentMethod || 'cash',
        input.notes
      );

      // Update RADIUS Expiration date
      if (result.endDate) {
        await radiusSubscribers.updateSubscriberRadiusEntries(
          subscriber.subscriber.username,
          new Date(result.endDate)
        );
      }

      // Activate in RADIUS if was expired
      if (subscriber.subscriber.status === 'expired') {
        await radiusSubscribers.activateSubscriberRadius(subscriber.subscriber.username);
      }

      return { success: true, ...result };
    }),

  // Get subscription history
  history: resellerProcedure
    .input(z.object({ subscriberId: z.number() }))
    .query(async ({ input, ctx }) => {
      const subscriber = await db.getSubscriberById(input.subscriberId);
      if (!subscriber) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'المشترك غير موجود' });
      }
      // Check ownership
      if (subscriber.subscriber.ownerId !== ctx.user.id && subscriber.subscriber.createdBy !== ctx.user.id && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح' });
      }

      return db.getSubscriptionHistory(input.subscriberId);
    }),

  // Delete subscriber
  delete: resellerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const subscriber = await db.getSubscriberById(input.id);
      if (!subscriber) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'المشترك غير موجود' });
      }
      // Check ownership
      if (subscriber.subscriber.ownerId !== ctx.user.id && subscriber.subscriber.createdBy !== ctx.user.id && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح' });
      }

      // Remove all RADIUS entries (radcheck, radreply, radusergroup)
      await radiusSubscribers.deleteSubscriberRadiusEntries(subscriber.subscriber.username);

      // Disconnect user if online
      try {
        await coaService.disconnectUserAllSessions(subscriber.subscriber.username);
      } catch (e) {
        console.error('[Subscribers] Failed to disconnect user:', e);
      }

      await db.deleteSubscriber(input.id);
      return { success: true };
    }),

  // Disconnect user (kick off network)
  disconnect: resellerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const subscriber = await db.getSubscriberById(input.id);
      if (!subscriber) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'المشترك غير موجود' });
      }
      // Check ownership
      if (subscriber.subscriber.ownerId !== ctx.user.id && subscriber.subscriber.createdBy !== ctx.user.id && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'غير مصرح' });
      }

      if (subscriber.nas) {
        await coaService.disconnectUserAllSessions(subscriber.subscriber.username);
      }

      return { success: true };
    }),
});

/// ============================================================================
// BILLING ROUTER (SaaS Billing Standard)
// ============================================================================
const billingRouter = router({
  // Get billing summary for current user
  getMySummary: protectedProcedure.query(async ({ ctx }) => {
    const { getUserBillingSummary } = await import("./services/billingService");
    return getUserBillingSummary(ctx.user.id);
  }),

  // Get billing summary for any user (owner only)
  getUserSummary: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const { getUserBillingSummary } = await import("./services/billingService");
      return getUserBillingSummary(input.userId);
    }),

  // Activate billing for a user (owner only)
  activateUser: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { activateUserBilling } = await import("./services/billingService");
      const result = await activateUserBilling(input.userId, ctx.user.id);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error || "Failed to activate billing" });
      }
      return result;
    }),

  // Process billing manually for a user (owner only)
  processUserBilling: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { processUserBilling } = await import("./services/billingService");
      const result = await processUserBilling(input.userId, ctx.user.id);
      if (!result.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error || "Billing failed" });
      }
      return result;
    }),

  // Get NAS billing rate
  getBillingRate: publicProcedure.query(async () => {
    const { getNasBillingRate } = await import("./services/billingService");
    return { rate: await getNasBillingRate() };
  }),

  // Get users due for billing (owner only)
  getUsersDue: superAdminProcedure.query(async () => {
    const { getUsersDueForBilling } = await import("./services/billingService");
    return { userIds: await getUsersDueForBilling() };
  }),

  // Get dashboard analytics (owner only)
  getDashboardStats: superAdminProcedure.query(async () => {
    const { getDashboardStats } = await import("./services/billingAnalyticsService");
    return getDashboardStats();
  }),

  // Get revenue history chart data (owner only)
  getRevenueHistory: superAdminProcedure
    .input(z.object({ days: z.number().optional().default(30) }))
    .query(async ({ input }) => {
      const { getRevenueHistory } = await import("./services/billingAnalyticsService");
      return getRevenueHistory(input.days);
    }),

  // Get low balance clients (owner only)
  getLowBalanceClients: superAdminProcedure.query(async () => {
    const { getLowBalanceClients } = await import("./services/billingAnalyticsService");
    return getLowBalanceClients();
  }),
});

// ============================================================================
// VPS MANAGEMENT ROUTER
// ============================================================================
import * as vpnConnectionService from "./services/vpnConnectionService";

const vpnRouter = router({
  // List all VPN connections with status (from SoftEther)
  list: protectedProcedure.query(async ({ ctx }) => {
    // Only owner/super_admin can see VPN connections
    if (ctx.user.role !== 'owner' && ctx.user.role !== 'super_admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only administrators can view VPN connections' });
    }
    
    // Get active sessions from SoftEther
    const sessionsResult = await sshVpn.getVpnSessionsFromServer();
    const sessions = sessionsResult.sessions || [];
    
    // Get all VPN NAS devices
    const allNasDevices = await nasDb.getAllNasDevices();
    const vpnNasDevices = allNasDevices.filter((nas: any) => 
      nas.connectionType && nas.connectionType !== 'public_ip'
    );
    
    // Map sessions to NAS devices
    const connections = vpnNasDevices.map((nas: any) => {
      const session = sessions.find((s: any) => 
        s.username && nas.vpnUsername && 
        s.username.toLowerCase() === nas.vpnUsername.toLowerCase()
      );
      
      return {
        vpn: {
          id: nas.id,
          nasId: nas.id,
          status: session ? 'connected' : 'disconnected',
          sessionName: session?.sessionName || null,
          sourceHost: session?.sourceHost || null,
          transferBytes: session?.transferBytes || null,
          localVpnIp: session?.localIp || null,
          lastConnectedAt: session?.connectedAt || null,
          clientIp: session?.clientIp || null,
          protocol: session?.protocol || null,
          updatedAt: new Date(),
        },
        nas: {
          id: nas.id,
          nasname: nas.nasname,
          shortname: nas.shortname,
          connectionType: nas.connectionType,
          vpnUsername: nas.vpnUsername,
          status: nas.status,
          ownerId: nas.ownerId,
        }
      };
    });
    
    // Calculate stats
    const stats = {
      total: connections.length,
      connected: connections.filter((c: any) => c.vpn.status === 'connected').length,
      disconnected: connections.filter((c: any) => c.vpn.status === 'disconnected').length,
      connecting: 0,
      error: 0,
    };
    
    return { connections, stats };
  }),

  // Get VPN connection by NAS ID
  getByNasId: protectedProcedure
    .input(z.object({ nasId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasById(input.nasId);
      if (!nas) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'NAS device not found' });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      const connection = await db.getVpnConnectionByNasId(input.nasId);
      return connection;
    }),

  // Get VPN status from MikroTik
  getStatus: protectedProcedure
    .input(z.object({ nasId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasById(input.nasId);
      if (!nas) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'NAS device not found' });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return vpnConnectionService.getVpnStatus(input.nasId);
    }),

  // Restart VPN connection
  restart: protectedProcedure
    .input(z.object({ nasId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasById(input.nasId);
      if (!nas) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'NAS device not found' });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return vpnConnectionService.restartVpnConnection(input.nasId, ctx.user.id);
    }),

  // Disconnect VPN
  disconnect: protectedProcedure
    .input(z.object({ nasId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasById(input.nasId);
      if (!nas) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'NAS device not found' });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return vpnConnectionService.disconnectVpn(input.nasId, ctx.user.id);
    }),

  // Connect VPN
  connect: protectedProcedure
    .input(z.object({ nasId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasById(input.nasId);
      if (!nas) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'NAS device not found' });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return vpnConnectionService.connectVpn(input.nasId, ctx.user.id);
    }),

  // Sync all VPN statuses
  syncAll: protectedProcedure.mutation(async ({ ctx }) => {
    const ownerId = ctx.user.role === 'super_admin' ? undefined : ctx.user.id;
    return vpnConnectionService.syncAllVpnStatuses(ownerId);
  }),

  // Get VPN logs from SoftEther server
  logs: protectedProcedure
    .input(z.object({
      nasId: z.number().optional(),
      eventType: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Only owner/super_admin can see VPN logs
      if (ctx.user.role !== 'owner' && ctx.user.role !== 'super_admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only administrators can view VPN logs' });
      }
      
      // Get logs from SoftEther API
      const result = await sshVpn.getVpnLogs();
      
      if (!result.success) {
        console.error('[VPN] Failed to get logs:', result.error);
        return { logs: [], total: 0 };
      }
      
      let logs = result.logs || [];
      
      // Filter by event type if specified
      if (input.eventType && input.eventType !== 'all') {
        logs = logs.filter((log: any) => log.eventType === input.eventType);
      }
      
      // Limit results
      const limit = input.limit || 100;
      logs = logs.slice(-limit).reverse();
      
      return { logs, total: logs.length };
    }),

  // Get VPN stats
  stats: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.user.role === 'super_admin' ? undefined : ctx.user.id;
    return db.getVpnConnectionStats(ownerId);
  }),
});

// ============================================================================
// AUDIT LOG ROUTER
// ============================================================================
import * as auditLogService from "./services/auditLogService";

const auditRouter = router({
  // List audit logs with filters
  list: protectedProcedure
    .input(z.object({
      userId: z.number().optional(),
      action: z.string().optional(),
      targetType: z.string().optional(),
      nasId: z.number().optional(),
      result: z.enum(['success', 'failure', 'partial']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Super Admin sees all, others see only their own logs
      const filters: any = {
        limit: input?.limit || 100,
        offset: input?.offset || 0,
      };
      
      if (ctx.user.role !== 'super_admin') {
        filters.userId = ctx.user.id;
      } else if (input?.userId) {
        filters.userId = input.userId;
      }
      
      if (input?.action) filters.action = input.action as any;
      if (input?.targetType) filters.targetType = input.targetType;
      if (input?.nasId) filters.nasId = input.nasId;
      if (input?.startDate) filters.startDate = new Date(input.startDate);
      if (input?.endDate) filters.endDate = new Date(input.endDate);
      
      const logs = await auditLogService.getAuditLogs(filters);
      
      // Parse details JSON
      return logs.map((log: any) => ({
        ...log,
        details: log.details ? JSON.parse(log.details as string) : null,
      }));
    }),

  // Get audit logs for a specific NAS
  byNas: protectedProcedure
    .input(z.object({
      nasId: z.number(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      // Check NAS ownership
      const nas = await nasDb.getNasById(input.nasId);
      if (!nas) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'NAS not found' });
      }
      if (ctx.user.role !== 'super_admin' && nas.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }
      
      const logs = await auditLogService.getAuditLogsByNas(input.nasId, input.limit);
      return logs.map((log: any) => ({
        ...log,
        details: log.details ? JSON.parse(log.details as string) : null,
      }));
    }),

  // Get recent actions by current user
  myActions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const logs = await auditLogService.getRecentActionsByUser(ctx.user.id, input?.limit || 20);
      return logs.map((log: any) => ({
        ...log,
        details: log.details ? JSON.parse(log.details as string) : null,
      }));
    }),

  // Get audit statistics (Super Admin only)
  stats: superAdminProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(7) }).optional())
    .query(async ({ input }) => {
      return auditLogService.getAuditStats(input?.days || 7);
    }),

  // Get available action types for filter dropdown
  actionTypes: protectedProcedure.query(() => {
    return [
      { value: 'session_disconnect', label: 'فصل جلسة' },
      { value: 'session_disconnect_coa', label: 'فصل جلسة (CoA)' },
      { value: 'session_disconnect_api', label: 'فصل جلسة (API)' },
      { value: 'speed_change', label: 'تغيير سرعة' },
      { value: 'speed_change_coa', label: 'تغيير سرعة (CoA)' },
      { value: 'speed_change_api', label: 'تغيير سرعة (API)' },
      { value: 'nas_create', label: 'إنشاء NAS' },
      { value: 'nas_update', label: 'تحديث NAS' },
      { value: 'nas_delete', label: 'حذف NAS' },
      { value: 'card_create', label: 'إنشاء كرت' },
      { value: 'card_suspend', label: 'تعطيل كرت' },
      { value: 'card_activate', label: 'تفعيل كرت' },
      { value: 'subscriber_create', label: 'إنشاء مشترك' },
      { value: 'subscriber_suspend', label: 'تعطيل مشترك' },
      { value: 'subscriber_activate', label: 'تفعيل مشترك' },
      { value: 'vpn_connect', label: 'اتصال VPN' },
      { value: 'vpn_disconnect', label: 'قطع VPN' },
      { value: 'login', label: 'تسجيل دخول' },
      { value: 'logout', label: 'تسجيل خروج' },
    ];
  }),

  // Get available target types for filter dropdown
  targetTypes: protectedProcedure.query(() => {
    return [
      { value: 'session', label: 'جلسة' },
      { value: 'nas', label: 'جهاز NAS' },
      { value: 'card', label: 'كرت' },
      { value: 'subscriber', label: 'مشترك' },
      { value: 'user', label: 'مستخدم' },
      { value: 'vpn', label: 'VPN' },
    ];
  }),
});

// ============================================================================
// LOGS ROUTER (RADIUS Logs Viewer)
// ============================================================================
const logsRouter = router({
  // Get authentication logs from radpostauth
  getAuthLogs: superAdminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      search: z.string().optional(),
      status: z.string().optional(),
      nasIp: z.string().optional(),
      dateRange: z.string().default('today'),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0, stats: { accepted: 0, rejected: 0 } };
      
      const { radpostauth } = await import('../drizzle/schema');
      const { sql, and, eq, like, gte, lte, desc, count } = await import('drizzle-orm');
      
      // Build date filter
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      const now = new Date();
      
      switch (input.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      
      // Build conditions
      const conditions: any[] = [];
      if (input.search) {
        conditions.push(like(radpostauth.username, `%${input.search}%`));
      }
      if (input.status) {
        conditions.push(eq(radpostauth.reply, input.status));
      }
      if (startDate) {
        conditions.push(gte(radpostauth.authdate, startDate));
      }
      if (endDate) {
        conditions.push(lte(radpostauth.authdate, endDate));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      // Get logs
      const logs = await db.select()
        .from(radpostauth)
        .where(whereClause)
        .orderBy(desc(radpostauth.authdate))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);
      
      // Get total count
      const totalResult = await db.select({ count: count() })
        .from(radpostauth)
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      
      // Get stats
      const acceptedResult = await db.select({ count: count() })
        .from(radpostauth)
        .where(and(whereClause, eq(radpostauth.reply, 'Access-Accept')));
      const rejectedResult = await db.select({ count: count() })
        .from(radpostauth)
        .where(and(whereClause, eq(radpostauth.reply, 'Access-Reject')));
      
      return {
        logs,
        total,
        stats: {
          accepted: acceptedResult[0]?.count || 0,
          rejected: rejectedResult[0]?.count || 0,
        }
      };
    }),

  // Get accounting logs from radacct
  getAccountingLogs: superAdminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
      search: z.string().optional(),
      nasIp: z.string().optional(),
      dateRange: z.string().default('today'),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0, stats: { activeSessions: 0, totalSessionTime: 0 } };
      
      const { radacct } = await import('../drizzle/schema');
      const { sql, and, eq, like, gte, lte, desc, count, sum, isNull } = await import('drizzle-orm');
      
      // Build date filter
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      const now = new Date();
      
      switch (input.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      
      // Build conditions
      const conditions: any[] = [];
      if (input.search) {
        conditions.push(like(radacct.username, `%${input.search}%`));
      }
      if (input.nasIp) {
        conditions.push(eq(radacct.nasipaddress, input.nasIp));
      }
      if (startDate) {
        conditions.push(gte(radacct.acctstarttime, startDate));
      }
      if (endDate) {
        conditions.push(lte(radacct.acctstarttime, endDate));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      // Get logs
      const logs = await db.select()
        .from(radacct)
        .where(whereClause)
        .orderBy(desc(radacct.acctstarttime))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit);
      
      // Get total count
      const totalResult = await db.select({ count: count() })
        .from(radacct)
        .where(whereClause);
      const total = totalResult[0]?.count || 0;
      
      // Get stats - active sessions (no stop time)
      const activeResult = await db.select({ count: count() })
        .from(radacct)
        .where(and(whereClause, isNull(radacct.acctstoptime)));
      
      // Get total session time
      const timeResult = await db.select({ total: sum(radacct.acctsessiontime) })
        .from(radacct)
        .where(whereClause);
      
      return {
        logs,
        total,
        stats: {
          activeSessions: activeResult[0]?.count || 0,
          totalSessionTime: Number(timeResult[0]?.total) || 0,
        }
      };
    }),
});

// ============================================================================
// DIAGNOSTICS ROUTER (System Health & Troubleshooting)
// ============================================================================
const diagnosticsRouter = router({
  // Get comprehensive system diagnostics
  getSystemStatus: superAdminProcedure.query(async () => {
    return freeradiusService.getSystemDiagnostics();
  }),

  // Get FreeRADIUS status
  getFreeradiusStatus: superAdminProcedure.query(async () => {
    return freeradiusService.checkFreeRADIUSStatus();
  }),

  // Get FreeRADIUS logs
  getFreeradiusLogs: superAdminProcedure
    .input(z.object({ lines: z.number().default(50) }))
    .query(async ({ input }) => {
      const logs = await freeradiusService.getFreeRADIUSLogs(input.lines);
      return { logs };
    }),

  // Get unknown client attempts
  getUnknownClients: superAdminProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      return freeradiusService.getUnknownClients(input.limit);
    }),

  // Test RADIUS connectivity
  testConnectivity: superAdminProcedure.query(async () => {
    return freeradiusService.testRadiusConnectivity();
  }),

  // Reload FreeRADIUS
  reloadFreeradius: superAdminProcedure.mutation(async () => {
    return freeradiusService.reloadFreeRADIUS();
  }),
});

// ============================================================================
// SAAS PLANS ROUTER (Subscription Plans Management)
// ============================================================================
import * as saasPlansDb from './db/saasPlans';

const saasPlansRouter = router({
  // Get all active plans (public)
  getAll: publicProcedure.query(async () => {
    return saasPlansDb.getAllPlans(true);
  }),

  // Get all plans including inactive (Super Admin)
  getAllAdmin: superAdminProcedure.query(async () => {
    return saasPlansDb.getAllPlans(false);
  }),

  // Get single plan
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return saasPlansDb.getPlanById(input.id);
    }),

  // Create plan (Super Admin)
  create: superAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      priceMonthly: z.number().min(0),
      priceYearly: z.number().optional(),
      currency: z.string().default('USD'),
      maxNasDevices: z.number().min(1),
      maxCards: z.number().min(1),
      maxSubscribers: z.number().optional(),
      featureMikrotikApi: z.boolean().optional(),
      featureCoaDisconnect: z.boolean().optional(),
      featureStaticVpnIp: z.boolean().optional(),
      featureAdvancedReports: z.boolean().optional(),
      featureCustomBranding: z.boolean().optional(),
      featurePrioritySupport: z.boolean().optional(),
      displayOrder: z.number().optional(),
      isPopular: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await saasPlansDb.createPlan(input);
      if (!id) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create plan' });
      return { success: true, id };
    }),

  // Update plan (Super Admin)
  update: superAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      priceMonthly: z.number().optional(),
      priceYearly: z.number().optional(),
      currency: z.string().optional(),
      maxNasDevices: z.number().optional(),
      maxCards: z.number().optional(),
      maxSubscribers: z.number().optional(),
      featureMikrotikApi: z.boolean().optional(),
      featureCoaDisconnect: z.boolean().optional(),
      featureStaticVpnIp: z.boolean().optional(),
      featureAdvancedReports: z.boolean().optional(),
      featureCustomBranding: z.boolean().optional(),
      featurePrioritySupport: z.boolean().optional(),
      displayOrder: z.number().optional(),
      isPopular: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await saasPlansDb.updatePlan(id, data);
      return { success: true };
    }),

  // Delete plan (Super Admin)
  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await saasPlansDb.deletePlan(input.id);
      return { success: true };
    }),

  // Get user account info (current user)
  getMyAccountInfo: protectedProcedure.query(async ({ ctx }) => {
    return saasPlansDb.getUserAccountInfo(ctx.user.id);
  }),

  // Get any user's account info (Super Admin)
  getUserAccountInfo: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return saasPlansDb.getUserAccountInfo(input.userId);
    }),

  // Activate subscription for user (Super Admin)
  activateSubscription: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      planId: z.number(),
      months: z.number().min(1).max(24),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const success = await saasPlansDb.activateUserSubscription(
        input.userId,
        input.planId,
        input.months,
        ctx.user.id,
        input.notes
      );
      if (!success) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to activate subscription' });
      return { success: true };
    }),

  // Suspend user (Super Admin)
  suspendUser: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await saasPlansDb.suspendUser(input.userId);
      return { success: true };
    }),

  // Reactivate user (Super Admin)
  reactivateUser: superAdminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await saasPlansDb.reactivateUser(input.userId);
      return { success: true };
    }),

  // Get subscription history (Super Admin or own)
  getSubscriptionHistory: protectedProcedure
    .input(z.object({ userId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.role === 'super_admin' && input.userId ? input.userId : ctx.user.id;
      return saasPlansDb.getSubscriptionHistory(userId);
    }),
});

// ============================================================================
// RADIUS CONTROL PANEL ROUTER
// ============================================================================
import * as centralAccountingService from "./services/centralAccountingService";

const radiusControlRouter = router({
  // Get Central Accounting Status
  getAccountingStatus: superAdminProcedure
    .query(async () => {
      return centralAccountingService.getCentralAccountingStatus();
    }),
  
  // Get Session Monitor Status
  getSessionMonitorStatus: superAdminProcedure
    .query(async () => {
      return sessionMonitor.getMonitorStatus();
    }),
  
  // Trigger Accounting Run
  triggerAccountingRun: superAdminProcedure
    .mutation(async () => {
      return centralAccountingService.triggerAccountingRun();
    }),
  
  // Get User Time Details
  getUserTimeDetails: superAdminProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      return centralAccountingService.getUserTimeDetails(input.username);
    }),
  
  // Sync User Usage from radacct
  syncUserUsage: superAdminProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ input }) => {
      await centralAccountingService.forceSyncUserUsage(input.username);
      return { success: true };
    }),
  
  // Get Recent Audit Logs
  getRecentAuditLogs: superAdminProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      return auditLogService.getAuditLogs({ limit: input?.limit || 20 });
    }),
});

// ============================================================================
// VPS MANAGEMENT ROUTER (System Admin)
// ============================================================================
import * as vpsManagementService from "./services/vpsManagementService";

const vpsManagementRouter = router({
  // Get system status
  getStatus: superAdminProcedure
    .query(async () => {
      const result = await vpsManagementService.getSystemStatus();
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Failed to get status' });
      }
      return result.data;
    }),



  // Get backups list
  getBackups: superAdminProcedure
    .query(async () => {
      const result = await vpsManagementService.getBackups();
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Failed to get backups' });
      }
      return result.data;
    }),

  // Create new backup
  createBackup: superAdminProcedure
    .input(z.object({ prefix: z.string().default('manual') }))
    .mutation(async ({ ctx, input }) => {
      const result = await vpsManagementService.createBackup(input.prefix);
      
      // Log the action
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'backup_create',
        targetType: 'system',
        targetId: 'vps',
        details: result.success 
          ? { message: `Created backup: ${result.data?.backup_id}` }
          : { message: `Backup failed: ${result.error}` },
        result: result.success ? 'success' : 'failure',
        ipAddress: '',
      });
      
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Backup failed' });
      }
      return result.data;
    }),

  // Restore from backup
  restoreBackup: superAdminProcedure
    .input(z.object({ backupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await vpsManagementService.restoreBackup(input.backupId);
      
      // Log the action
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'backup_restore',
        targetType: 'system',
        targetId: 'vps',
        details: result.success 
          ? { message: `Restored backup: ${input.backupId}` }
          : { message: `Restore failed: ${result.error}` },
        result: result.success ? 'success' : 'failure',
        ipAddress: '',
      });
      
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Restore failed' });
      }
      return result.data;
    }),

  // Get service logs
  getServiceLogs: superAdminProcedure
    .input(z.object({ 
      serviceName: z.enum(['app', 'freeradius', 'vpn', 'dhcp']),
      lines: z.number().default(100)
    }))
    .query(async ({ input }) => {
      const result = await vpsManagementService.getServiceLogs(input.serviceName, input.lines);
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Failed to get logs' });
      }
      return result.data;
    }),

  // Manage service (only app and dhcp allowed)
  manageService: superAdminProcedure
    .input(z.object({
      serviceName: z.enum(['app', 'dhcp']),
      action: z.enum(['start', 'stop', 'restart', 'reload'])
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await vpsManagementService.manageService(input.serviceName, input.action);
      
      // Log the action
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'service_manage',
        targetType: 'system',
        targetId: 'vps',
        details: { message: `${input.action} ${input.serviceName}: ${result.success ? 'success' : result.error}` },
        result: result.success ? 'success' : 'failure',
        ipAddress: '',
      });
      
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Service action failed' });
      }
      return result.data;
    }),

  // Deploy update from Manus (Zero Downtime)
  deployUpdate: superAdminProcedure
    .input(z.object({
      packageData: z.string().describe('Base64 encoded tar.gz package')
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await vpsManagementService.deployUpdate(input.packageData);
      
      // Log the action
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'system_deploy' as any,
        targetType: 'system',
        targetId: 'vps',
        details: result.success 
          ? { message: 'Zero downtime deployment successful' }
          : { message: `Deployment failed: ${result.error}` },
        result: result.success ? 'success' : 'failure',
        ipAddress: '',
      });
      
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Deployment failed' });
      }
      return result.data;
    }),

  // Quick reload app (Zero Downtime)
  reloadApp: superAdminProcedure
    .mutation(async ({ ctx }) => {
      const result = await vpsManagementService.reloadApp();
      
      // Log the action
      await logAudit({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: 'app_reload' as any,
        targetType: 'system',
        targetId: 'vps',
        details: result.success 
          ? { message: 'Application reloaded successfully' }
          : { message: `Reload failed: ${result.error}` },
        result: result.success ? 'success' : 'failure',
        ipAddress: '',
      });
      
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Reload failed' });
      }
      return result.data;
    }),
});

// ============================================================================
// MAIN ROUTER
// ============================================================================
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  users: usersRouter,
  plans: plansRouter,
  saasPlans: saasPlansRouter,
  nas: nasRouter,
  wallet: walletRouter,
  billing: billingRouter,
  vouchers: vouchersRouter,
  invoices: invoicesRouter,
  subscriptions: subscriptionsRouter,
  tenantSubscriptions: tenantSubscriptionsRouter,
  tickets: ticketsRouter,
  notifications: notificationsRouter,
  dashboard: dashboardRouter,
  sessions: sessionsRouter,
  templates: templatesRouter,
  settings: settingsRouter,
  reports: reportsRouter,
  backups: backupsRouter,
  internalNotifications: internalNotificationsRouter,
  subscribers: subscribersRouter,
  vpn: vpnRouter,
  audit: auditRouter,
  logs: logsRouter,
  diagnostics: diagnosticsRouter,
  radius: radiusControlRouter,
  vpsManagement: vpsManagementRouter,
});

export type AppRouter = typeof appRouter;
