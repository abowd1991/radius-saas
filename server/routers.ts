import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, superAdminProcedure, resellerProcedure, clientProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as walletDb from "./db/wallet";
import * as planDb from "./db/plans";
import * as nasDb from "./db/nas";
import * as voucherDb from "./db/vouchers";
import * as invoiceDb from "./db/invoices";
import * as subscriptionDb from "./db/subscriptions";
import * as ticketDb from "./db/tickets";
import * as notificationDb from "./db/notifications";

// ============================================================================
// AUTH ROUTER
// ============================================================================
const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ============================================================================
// USERS ROUTER
// ============================================================================
const usersRouter = router({
  // Get all users (super admin only)
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

  // Get user by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const user = await db.getUserById(input.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      
      // Check permissions
      if (ctx.user.role === 'client' && ctx.user.id !== input.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      if (ctx.user.role === 'reseller' && user.parentId !== ctx.user.id && ctx.user.id !== input.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      return user;
    }),

  // Get reseller's clients
  getMyClients: resellerProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      return db.getUsersByRole('client');
    }
    return db.getUsersByParentId(ctx.user.id);
  }),

  // Update user status
  updateStatus: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      status: z.enum(['active', 'suspended', 'inactive']),
    }))
    .mutation(async ({ input }) => {
      // Implementation will be added
      return { success: true };
    }),
});

// ============================================================================
// PLANS ROUTER
// ============================================================================
const plansRouter = router({
  list: publicProcedure.query(async () => {
    return planDb.getAllPlans();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const plan = await planDb.getPlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      return plan;
    }),

  create: superAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      downloadSpeed: z.number().min(1),
      uploadSpeed: z.number().min(1),
      dataLimit: z.number().optional(),
      durationDays: z.number().default(30),
      price: z.string(),
      resellerPrice: z.string(),
      simultaneousUsers: z.number().default(1),
      poolName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return planDb.createPlan(input);
    }),

  update: superAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      downloadSpeed: z.number().optional(),
      uploadSpeed: z.number().optional(),
      dataLimit: z.number().optional(),
      durationDays: z.number().optional(),
      price: z.string().optional(),
      resellerPrice: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional(),
    }))
    .mutation(async ({ input }) => {
      return planDb.updatePlan(input.id, input);
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return planDb.deletePlan(input.id);
    }),
});

// ============================================================================
// NAS DEVICES ROUTER
// ============================================================================
const nasRouter = router({
  list: superAdminProcedure.query(async () => {
    return nasDb.getAllNasDevices();
  }),

  getById: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const nas = await nasDb.getNasById(input.id);
      if (!nas) throw new TRPCError({ code: "NOT_FOUND", message: "NAS device not found" });
      return nas;
    }),

  create: superAdminProcedure
    .input(z.object({
      name: z.string().min(1),
      ipAddress: z.string().min(1),
      secret: z.string().min(1),
      type: z.enum(['mikrotik', 'cisco', 'other']).default('mikrotik'),
      description: z.string().optional(),
      location: z.string().optional(),
      ports: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return nasDb.createNas(input);
    }),

  update: superAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      ipAddress: z.string().optional(),
      secret: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional(),
    }))
    .mutation(async ({ input }) => {
      return nasDb.updateNas(input.id, input);
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return nasDb.deleteNas(input.id);
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
});

// ============================================================================
// VOUCHERS ROUTER
// ============================================================================
const vouchersRouter = router({
  list: resellerProcedure
    .input(z.object({
      status: z.enum(['unused', 'used', 'expired', 'cancelled']).optional(),
      batchId: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === 'super_admin') {
        return voucherDb.getAllVouchers(input);
      }
      return voucherDb.getVouchersByReseller(ctx.user.id, input);
    }),

  getById: resellerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const voucher = await voucherDb.getVoucherById(input.id);
      if (!voucher) throw new TRPCError({ code: "NOT_FOUND", message: "Voucher not found" });
      return voucher;
    }),

  generate: resellerProcedure
    .input(z.object({
      planId: z.number(),
      quantity: z.number().min(1).max(1000),
      expiresInDays: z.number().optional(),
      batchName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return voucherDb.generateVouchers({
        ...input,
        createdBy: ctx.user.id,
        resellerId: ctx.user.role === 'reseller' ? ctx.user.id : undefined,
      });
    }),

  redeem: clientProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return voucherDb.redeemVoucher(input.code, ctx.user.id);
    }),

  getBatches: resellerProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      return voucherDb.getAllBatches();
    }
    return voucherDb.getBatchesByCreator(ctx.user.id);
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
      
      // Check permissions
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
// SUBSCRIPTIONS ROUTER
// ============================================================================
const subscriptionsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['active', 'suspended', 'expired', 'cancelled']).optional(),
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
      
      if (ctx.user.role !== 'super_admin' && subscription.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      
      return subscription;
    }),

  create: resellerProcedure
    .input(z.object({
      userId: z.number(),
      planId: z.number(),
      nasId: z.number().optional(),
      username: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      return subscriptionDb.createSubscription(input);
    }),

  updateStatus: superAdminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['active', 'suspended', 'expired', 'cancelled']),
    }))
    .mutation(async ({ input }) => {
      return subscriptionDb.updateSubscriptionStatus(input.id, input.status);
    }),

  getActiveSessions: superAdminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      return subscriptionDb.getActiveSessions(input);
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
});

// ============================================================================
// DASHBOARD STATS ROUTER
// ============================================================================
const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      return {
        totalUsers: 0,
        totalResellers: 0,
        totalClients: 0,
        activeSubscriptions: 0,
        totalRevenue: "0.00",
        pendingInvoices: 0,
        activeSessions: 0,
        openTickets: 0,
      };
    } else if (ctx.user.role === 'reseller') {
      return {
        totalClients: 0,
        activeSubscriptions: 0,
        walletBalance: "0.00",
        pendingInvoices: 0,
        totalVouchers: 0,
        usedVouchers: 0,
      };
    } else {
      return {
        walletBalance: "0.00",
        activeSubscriptions: 0,
        pendingInvoices: 0,
        totalDataUsed: 0,
      };
    }
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
  nas: nasRouter,
  wallet: walletRouter,
  vouchers: vouchersRouter,
  invoices: invoicesRouter,
  subscriptions: subscriptionsRouter,
  tickets: ticketsRouter,
  notifications: notificationsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
