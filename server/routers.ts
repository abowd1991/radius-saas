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
import { getDb } from "./db";
import { radcheck } from "../drizzle/schema";
import { eq } from "drizzle-orm";

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
  create: activeSubscriptionProcedure
    .input(z.object({
      name: z.string().min(1),
      ipAddress: z.string().min(1),
      secret: z.string().min(1),
      type: z.enum(['mikrotik', 'cisco', 'other']).default('mikrotik'),
      connectionType: z.enum(['public_ip', 'vpn_pptp', 'vpn_sstp']).default('public_ip'),
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
        // For VPN, IP will be assigned when connection is established
        // Use unique identifier based on vpnUsername to avoid duplicate nasname
        if (input.ipAddress === 'pending' || input.ipAddress === 'سيتم تعيينه تلقائي' || !input.ipAddress) {
          input.ipAddress = `vpn-${input.vpnUsername}`;
        }
        
        // Create VPN user in SoftEther automatically via SSH (for SSTP/PPTP connections)
        // Using SSH ensures reliable user creation directly on the server
        // Now using Password Authentication instead of RADIUS Authentication
        try {
          console.log(`[SSH] Creating VPN user: ${input.vpnUsername} with password auth for connection type: ${input.connectionType}`);
          const vpnResult = await sshVpn.createVpnUser(input.vpnUsername, input.vpnPassword!);
          console.log('[SSH] VPN User creation result:', vpnResult);
          
          if (!vpnResult.success) {
            console.error('[SSH] VPN User creation failed:', vpnResult.error);
            // Log the error but continue - VPN user might already exist
            console.log('[SSH] Continuing with NAS creation despite VPN user creation failure');
          }
        } catch (error) {
          console.error('[SSH] Failed to create VPN user:', error);
          // Continue with NAS creation - VPN user might already exist or will be created manually
        }
        
        // Create RADIUS entry for VPN user authentication in database directly
        try {
          console.log(`Creating RADIUS entry in database for VPN user: ${input.vpnUsername}`);
          const database = await getDb();
          if (database) {
            // Check if user already exists
            const existingUser = await database.select()
              .from(radcheck)
              .where(eq(radcheck.username, input.vpnUsername))
              .limit(1);
            
            if (existingUser.length === 0) {
              // Create RADIUS user with password
              await database.insert(radcheck).values({
                username: input.vpnUsername,
                attribute: 'Cleartext-Password',
                op: ':=',
                value: input.vpnPassword,
              });
              console.log(`RADIUS user created in database: ${input.vpnUsername}`);
            } else {
              console.log(`RADIUS user already exists: ${input.vpnUsername}`);
            }
          }
        } catch (error) {
          console.error('Failed to create RADIUS entry in database:', error);
        }
      }
      return nasDb.createNas({ ...input, ownerId });
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
      const coaPort = '1700';
      
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
      if (nas.connectionType === 'vpn_pptp') {
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
            id: 'pptp-client',
            title: 'Create PPTP Client',
            titleAr: 'إنشاء اتصال PPTP',
            description: `Create PPTP VPN tunnel to RADIUS server (${vpnServerAddress})`,
            descriptionAr: `إنشاء نفق VPN PPTP للاتصال بخادم RADIUS (${vpnServerAddress})`,
            command: `/interface pptp-client add name=radius-vpn connect-to=${vpnServerAddress} user=${nas.vpnUsername || 'nas-user'}@VPN password=${nas.vpnPassword || 'nas-pass'} profile=default-encryption disabled=no add-default-route=no`,
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
            command: `/interface sstp-client add name=radius-vpn connect-to=${vpnServerAddress}:443 user=${nas.vpnUsername || 'nas-user'}@VPN password=${nas.vpnPassword || 'nas-pass'} profile=default-encryption disabled=no verify-server-certificate=no`,
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
      connectionType: z.enum(['public_ip', 'vpn_pptp', 'vpn_sstp']).optional(),
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
      return nasDb.updateNas(input.id, input);
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
      }
      
      return { success: true };
    }),

  // Test MikroTik API connection - any authenticated user can test
  testApiConnection: protectedProcedure
    .input(z.object({
      nasIp: z.string(),
      apiPort: z.number().default(8728),
      apiUser: z.string(),
      apiPassword: z.string(),
    }))
    .mutation(async ({ input }) => {
      const mikrotikApi = await import('./services/mikrotikApiService');
      
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
        
        socket.connect(input.apiPort, input.nasIp, async () => {
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
          usernameFontFamily: (textSettings?.username.fontFamily ?? template.usernameFontFamily ?? "normal") as "normal" | "clear" | "digital",
          usernameFontColor: textSettings?.username.color ?? template.usernameFontColor ?? "#0066cc",
          usernameAlign: (textSettings?.username.align ?? template.usernameAlign ?? "center") as "left" | "center" | "right",
          passwordX: textSettings?.password.x ?? template.passwordX ?? 50,
          passwordY: textSettings?.password.y ?? template.passwordY ?? 60,
          passwordFontSize: textSettings?.password.fontSize ?? template.passwordFontSize ?? 14,
          passwordFontFamily: (textSettings?.password.fontFamily ?? template.passwordFontFamily ?? "normal") as "normal" | "clear" | "digital",
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
      const ownerNasIps = ownerNasDevices.map(n => n.nasname);
      
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
  // List sessions - filter by owner's NAS devices
  list: protectedProcedure.query(async ({ ctx }) => {
    const allSessions = await mikrotikApi.getActiveSessions();
    
    // Super admin sees all sessions
    if (ctx.user.role === 'super_admin') {
      return allSessions;
    }
    
    // Get owner's NAS devices
    const ownerNasDevices = await nasDb.getNasDevicesByOwner(ctx.user.id);
    const ownerNasIps = ownerNasDevices.map(n => n.nasname);
    
    // Filter sessions by owner's NAS
    return allSessions.filter((s: any) => ownerNasIps.includes(s.nasIpAddress || s.nasipaddress));
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
      const ownerNasIps = ownerNasDevices.map(n => n.nasname);
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
  coaDisconnect: superAdminProcedure
    .input(z.object({
      username: z.string(),
      nasIp: z.string(),
      sessionId: z.string().optional(),
      framedIp: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return coaService.disconnectSession(
        input.username,
        input.nasIp,
        input.sessionId,
        input.framedIp
      );
    }),

  // Disconnect all sessions for a user using CoA
  coaDisconnectUser: superAdminProcedure
    .input(z.object({ username: z.string() }))
    .mutation(async ({ input }) => {
      return coaService.disconnectUserAllSessions(input.username);
    }),

  // Update session attributes (speed, timeout) using CoA
  coaUpdateSession: superAdminProcedure
    .input(z.object({
      username: z.string(),
      nasIp: z.string(),
      sessionId: z.string(),
      framedIp: z.string().optional(),
      downloadSpeed: z.number().optional(),
      uploadSpeed: z.number().optional(),
      sessionTimeout: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return coaService.updateSessionAttributes(
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
    }),

  // Change user speed with fallback to disconnect
  changeUserSpeed: superAdminProcedure
    .input(z.object({
      username: z.string(),
      uploadSpeedMbps: z.number(),
      downloadSpeedMbps: z.number(),
    }))
    .mutation(async ({ input }) => {
      return coaService.changeUserSpeed(
        input.username,
        input.uploadSpeedMbps,
        input.downloadSpeedMbps
      );
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
        allocatedTimeFormatted: accountingService.formatTime(balance.allocatedTime),
        usedTimeFormatted: accountingService.formatTime(balance.usedTime),
        remainingTimeFormatted: accountingService.formatTime(balance.remainingTime),
      };
    }),

  // Get users with low remaining time
  getLowTimeUsers: superAdminProcedure
    .input(z.object({ thresholdMinutes: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      const threshold = input?.thresholdMinutes || 30;
      const users = await accountingService.getUsersWithLowTime(threshold);
      return users.map(u => ({
        ...u,
        remainingTimeFormatted: accountingService.formatTime(u.remainingTime),
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

const tenantSubscriptionsRouter = router({
  // Get all tenant subscriptions (Super Admin only)
  list: superAdminProcedure.query(async () => {
    const subscriptions = await tenantSubDb.getAllTenantSubscriptions();
    // Get user info for each subscription
    const enriched = await Promise.all(
      subscriptions.map(async (sub) => {
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
  tenantSubscriptions: tenantSubscriptionsRouter,
  tickets: ticketsRouter,
  notifications: notificationsRouter,
  dashboard: dashboardRouter,
  sessions: sessionsRouter,
  templates: templatesRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
