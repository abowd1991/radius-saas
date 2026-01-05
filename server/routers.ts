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
import * as cardDb from "./db/vouchers";
import * as invoiceDb from "./db/invoices";
import * as subscriptionDb from "./db/subscriptions";
import * as ticketDb from "./db/tickets";
import * as notificationDb from "./db/notifications";
import * as templateDb from "./db/cardTemplates";
import { generateCardsPDFHTML, generateCardsCSV, saveBatchPDF, saveBatchPDFWithTemplate, generateCardsPDFHTMLWithTemplate } from "./services/pdfGenerator";
import { storagePut } from "./storage";
import * as mikrotikApi from "./services/mikrotikApi";

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
      validityType: z.enum(['minutes', 'hours', 'days']).optional(),
      validityValue: z.number().optional(),
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
      connectionType: z.enum(['public_ip', 'vpn_pptp', 'vpn_sstp']).default('public_ip'),
      description: z.string().optional(),
      location: z.string().optional(),
      ports: z.number().optional(),
      mikrotikApiPort: z.number().optional(),
      mikrotikApiUser: z.string().optional(),
      mikrotikApiPassword: z.string().optional(),
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
      connectionType: z.enum(['public_ip', 'vpn_pptp', 'vpn_sstp']).optional(),
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

  getById: resellerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const card = await cardDb.getCardById(input.id);
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      return card;
    }),

  generate: resellerProcedure
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
    }))
    .mutation(async ({ ctx, input }) => {
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

  suspend: superAdminProcedure
    .input(z.object({ cardId: z.number() }))
    .mutation(async ({ input }) => {
      return cardDb.suspendCard(input.cardId);
    }),

  unsuspend: superAdminProcedure
    .input(z.object({ cardId: z.number() }))
    .mutation(async ({ input }) => {
      return cardDb.unsuspendCard(input.cardId);
    }),

  getBatches: resellerProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      return cardDb.getAllBatches();
    }
    return cardDb.getBatchesByReseller(ctx.user.id);
  }),

  getCardsByBatch: resellerProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ input }) => {
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
    .mutation(async ({ input }) => {
      // Get batch and cards
      const batches = await cardDb.getAllBatches();
      const batch = batches.find(b => b.batchId === input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });

      const cards = await cardDb.getCardsByBatch(input.batchId);
      if (!cards || cards.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No cards found in batch" });
      }

      // Get plan details for each card
      const plans = await planDb.getAllPlans();
      const planMap = new Map(plans.map(p => [p.id, p]));

      const cardData = cards.map(card => {
        const plan = planMap.get(card.planId);
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
    .query(async ({ input }) => {
      const batches = await cardDb.getAllBatches();
      const batch = batches.find(b => b.batchId === input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });

      const cards = await cardDb.getCardsByBatch(input.batchId);
      if (!cards || cards.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No cards found in batch" });
      }

      const plans = await planDb.getAllPlans();
      const planMap = new Map(plans.map(p => [p.id, p]));

      const cardData = cards.map(card => {
        const plan = planMap.get(card.planId);
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
    }))
    .mutation(async ({ input }) => {
      // Get batch and cards
      const batches = await cardDb.getAllBatches();
      const batch = batches.find(b => b.batchId === input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });

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
      const planMap = new Map(plans.map(p => [p.id, p]));

      const cardData = cards.map(card => {
        const plan = planMap.get(card.planId);
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

      // Generate and save PDF with template
      const result = await saveBatchPDFWithTemplate({
        batchId: input.batchId,
        batchName: batch.name,
        cards: cardData,
        printSettings,
        template: template ? {
          imageUrl: template.imageUrl,
          cardWidth: template.cardWidth || 400,
          cardHeight: template.cardHeight || 250,
          usernameX: template.usernameX || 100,
          usernameY: template.usernameY || 100,
          usernameFontSize: template.usernameFontSize || 14,
          usernameFontFamily: (template.usernameFontFamily || "normal") as "normal" | "clear" | "digital",
          usernameFontColor: template.usernameFontColor || "#0066cc",
          usernameAlign: (template.usernameAlign || "left") as "left" | "center" | "right",
          passwordX: template.passwordX || 100,
          passwordY: template.passwordY || 130,
          passwordFontSize: template.passwordFontSize || 14,
          passwordFontFamily: (template.passwordFontFamily || "normal") as "normal" | "clear" | "digital",
          passwordFontColor: template.passwordFontColor || "#cc0000",
          passwordAlign: (template.passwordAlign || "left") as "left" | "center" | "right",
          qrCodeEnabled: template.qrCodeEnabled || false,
          qrCodeX: template.qrCodeX || 0,
          qrCodeY: template.qrCodeY || 0,
          qrCodeSize: template.qrCodeSize || 80,
          qrCodeDomain: template.qrCodeDomain || null,
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
    .query(async ({ input }) => {
      const cards = await cardDb.getCardsByBatch(input.batchId);
      if (!cards || cards.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No cards found in batch" });
      }

      const plans = await planDb.getAllPlans();
      const planMap = new Map(plans.map(p => [p.id, p]));

      const cardData = cards.map(card => {
        const plan = planMap.get(card.planId);
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
});

// ============================================================================
// DASHBOARD STATS ROUTER
// ============================================================================
const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'super_admin') {
      const activeSessionsCount = await subscriptionDb.getActiveSessionsCount();
      return {
        totalUsers: 0,
        totalResellers: 0,
        totalClients: 0,
        activeSubscriptions: 0,
        totalRevenue: "0.00",
        pendingInvoices: 0,
        activeSessions: activeSessionsCount,
        openTickets: 0,
      };
    } else if (ctx.user.role === 'reseller') {
      return {
        totalClients: 0,
        activeSubscriptions: 0,
        walletBalance: "0.00",
        pendingInvoices: 0,
        totalCards: 0,
        usedCards: 0,
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
// SESSIONS ROUTER (Active RADIUS Sessions)
// ============================================================================
const sessionsRouter = router({
  list: superAdminProcedure.query(async () => {
    return mikrotikApi.getActiveSessions();
  }),

  getByUsername: superAdminProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      return mikrotikApi.getSessionsByUsername(input.username);
    }),

  getByNas: superAdminProcedure
    .input(z.object({ nasIp: z.string() }))
    .query(async ({ input }) => {
      return mikrotikApi.getSessionsByNas(input.nasIp);
    }),

  disconnect: superAdminProcedure
    .input(z.object({
      sessionId: z.string(),
      nasIp: z.string(),
    }))
    .mutation(async ({ input }) => {
      return mikrotikApi.disconnectSession(input.sessionId, input.nasIp);
    }),

  disconnectUser: superAdminProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ input }) => {
      return mikrotikApi.disconnectUserSessions(input.username);
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
      usernameFontFamily: z.enum(['normal', 'clear', 'digital']).optional(),
      usernameFontColor: z.string().optional(),
      usernameAlign: z.enum(['left', 'center', 'right']).optional(),
      // Password font settings
      passwordFontSize: z.number().optional(),
      passwordFontFamily: z.enum(['normal', 'clear', 'digital']).optional(),
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
  sessions: sessionsRouter,
  templates: templatesRouter,
});

export type AppRouter = typeof appRouter;
