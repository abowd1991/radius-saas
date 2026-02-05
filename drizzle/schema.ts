import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint } from "drizzle-orm/mysql-core";

// ============================================================================
// USERS & AUTHENTICATION
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // Optional for traditional auth
  username: varchar("username", { length: 64 }).unique(), // For traditional auth
  passwordHash: varchar("passwordHash", { length: 255 }), // For traditional auth
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["owner", "super_admin", "client_admin", "reseller", "client", "support"]).default("client").notNull(),
  ownerId: int("ownerId"), // Tenant/Client owner (null for Owner himself)
  resellerId: int("resellerId"), // For clients: their reseller ID
  status: mysqlEnum("status", ["active", "suspended", "inactive"]).default("active").notNull(),
  accountStatus: mysqlEnum("accountStatus", ["trial", "active", "expired", "suspended"]).default("trial").notNull(),
  trialStartDate: timestamp("trialStartDate"),
  trialEndDate: timestamp("trialEndDate"),
  subscriptionPlanId: int("subscriptionPlanId"), // Reference to saasPlans
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  // Permission Plan (for global permission management)
  permissionPlanId: int("permissionPlanId"), // Reference to permission_plans
  // SaaS Billing (Daily - $0.33 per NAS per day)
  billingStartAt: timestamp("billingStartAt"), // When billing cycle starts (1st of month)
  lastDailyBillingDate: timestamp("lastDailyBillingDate"), // Last daily billing date
  dailyBillingEnabled: boolean("dailyBillingEnabled").default(true).notNull(),
  billingStatus: mysqlEnum("billingStatus", ["active", "past_due", "suspended"]).default("active").notNull(),
  lowBalanceNotifiedAt: timestamp("lowBalanceNotifiedAt"), // Last low balance notification time
  language: mysqlEnum("language", ["ar", "en"]).default("ar").notNull(),
  avatarUrl: text("avatarUrl"),
  emailVerified: boolean("emailVerified").default(false),
  emailVerificationCode: varchar("emailVerificationCode", { length: 10 }),
  emailVerificationExpires: timestamp("emailVerificationExpires"),
  passwordResetCode: varchar("passwordResetCode", { length: 10 }),
  passwordResetExpires: timestamp("passwordResetExpires"),
  trialExpirationNotified: boolean("trialExpirationNotified").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// RESELLER PROFILES (Extended info for resellers)
// ============================================================================

export const resellerProfiles = mysqlTable("reseller_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  companyName: varchar("companyName", { length: 255 }),
  companyAddress: text("companyAddress"),
  taxNumber: varchar("taxNumber", { length: 50 }),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 2 }).default("0.00"),
  creditLimit: decimal("creditLimit", { precision: 12, scale: 2 }).default("0.00"),
  canCreateCards: boolean("canCreateCards").default(true),
  maxClients: int("maxClients").default(100),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ResellerProfile = typeof resellerProfiles.$inferSelect;
export type InsertResellerProfile = typeof resellerProfiles.$inferInsert;

// ============================================================================
// TENANT SUBSCRIPTIONS
// ============================================================================

export const tenantSubscriptions = mysqlTable("tenant_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().unique(), // User ID of the tenant
  status: mysqlEnum("status", ["active", "expired", "suspended", "cancelled"]).default("active").notNull(),
  pricePerMonth: decimal("pricePerMonth", { precision: 10, scale: 2 }).default("10.00").notNull(),
  startDate: timestamp("startDate").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastRenewalDate: timestamp("lastRenewalDate"),
  renewedBy: int("renewedBy"), // Admin who renewed
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
export type InsertTenantSubscription = typeof tenantSubscriptions.$inferInsert;

// ============================================================================
// INTERNET PLANS / PACKAGES
// ============================================================================

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(), // Owner (client/reseller) who created this plan
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("nameAr", { length: 100 }),
  description: text("description"),
  descriptionAr: text("descriptionAr"),
  downloadSpeed: int("downloadSpeed").notNull(), // in Kbps
  uploadSpeed: int("uploadSpeed").notNull(), // in Kbps
  dataLimit: bigint("dataLimit", { mode: "number" }), // in bytes, null = unlimited
  // Validity settings
  validityType: mysqlEnum("validityType", ["minutes", "hours", "days"]).default("days").notNull(),
  validityValue: int("validityValue").notNull().default(30), // e.g., 30 days, 24 hours, etc.
  validityStartFrom: mysqlEnum("validityStartFrom", ["first_login", "card_creation"]).default("first_login").notNull(),
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  resellerPrice: decimal("resellerPrice", { precision: 10, scale: 2 }).notNull(),
  // RADIUS attributes
  simultaneousUse: int("simultaneousUse").default(1), // Simultaneous-Use attribute
  sessionTimeout: int("sessionTimeout"), // Session-Timeout in seconds
  idleTimeout: int("idleTimeout"), // Idle-Timeout in seconds
  // MikroTik specific
  poolName: varchar("poolName", { length: 50 }),
  mikrotikRateLimit: varchar("mikrotikRateLimit", { length: 100 }), // e.g., "10M/5M" for 10Mbps down/5Mbps up
  mikrotikAddressPool: varchar("mikrotikAddressPool", { length: 50 }),
  // Service type
  serviceType: mysqlEnum("serviceType", ["pppoe", "hotspot", "vpn", "all"]).default("all").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

// ============================================================================
// NAS DEVICES (MikroTik Routers) - FreeRADIUS Compatible
// ============================================================================

export const nasDevices = mysqlTable("nas", {
  id: int("id").autoincrement().primaryKey(),
  nasname: varchar("nasname", { length: 128 }).notNull().unique(), // IP Address
  shortname: varchar("shortname", { length: 32 }),
  type: varchar("type", { length: 30 }).default("other"),
  ports: int("ports"),
  secret: varchar("secret", { length: 60 }).notNull(),
  server: varchar("server", { length: 64 }),
  community: varchar("community", { length: 50 }),
  description: varchar("description", { length: 200 }),
  connectionType: mysqlEnum("connectionType", ["public_ip", "vpn_sstp", "vpn_l2tp"]).default("public_ip"),
  // VPN credentials for SSTP/L2TP connections
  vpnUsername: varchar("vpnUsername", { length: 64 }),
  vpnPassword: varchar("vpnPassword", { length: 128 }),
  vpnTunnelIp: varchar("vpnTunnelIp", { length: 45 }), // Assigned IP after VPN connects
  // Extended fields for our system
  ownerId: int("ownerId").notNull(), // Owner user ID for multi-tenancy
  location: varchar("location", { length: 255 }),
  // MikroTik API settings (optional - for instant speed changes)
  apiEnabled: boolean("apiEnabled").default(false), // Enable/disable API access
  mikrotikApiPort: int("mikrotikApiPort").default(8728),
  mikrotikApiUser: varchar("mikrotikApiUser", { length: 64 }),
  mikrotikApiPassword: varchar("mikrotikApiPassword", { length: 128 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  lastSeen: timestamp("lastSeen"),
  // Two-Phase Auto Provisioning fields
  provisioningStatus: mysqlEnum("provisioningStatus", ["pending", "provisioning", "ready", "error"]).default("pending"),
  allocatedIp: varchar("allocatedIp", { length: 45 }),
  lastTempIp: varchar("lastTempIp", { length: 45 }),
  lastMac: varchar("lastMac", { length: 17 }),
  provisionedAt: timestamp("provisionedAt"),
  provisioningError: text("provisioningError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NasDevice = typeof nasDevices.$inferSelect;
export type InsertNasDevice = typeof nasDevices.$inferInsert;

// ============================================================================
// FREERADIUS CORE TABLES
// ============================================================================

// radcheck - Authentication check attributes
export const radcheck = mysqlTable("radcheck", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  attribute: varchar("attribute", { length: 64 }).notNull(),
  op: varchar("op", { length: 2 }).default(":=").notNull(),
  value: varchar("value", { length: 253 }).notNull(),
});

export type Radcheck = typeof radcheck.$inferSelect;
export type InsertRadcheck = typeof radcheck.$inferInsert;

// radreply - Reply attributes sent to NAS
export const radreply = mysqlTable("radreply", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  attribute: varchar("attribute", { length: 64 }).notNull(),
  op: varchar("op", { length: 2 }).default("=").notNull(),
  value: varchar("value", { length: 253 }).notNull(),
});

export type Radreply = typeof radreply.$inferSelect;
export type InsertRadreply = typeof radreply.$inferInsert;

// radgroupcheck - Group check attributes
export const radgroupcheck = mysqlTable("radgroupcheck", {
  id: int("id").autoincrement().primaryKey(),
  groupname: varchar("groupname", { length: 64 }).notNull(),
  attribute: varchar("attribute", { length: 64 }).notNull(),
  op: varchar("op", { length: 2 }).default(":=").notNull(),
  value: varchar("value", { length: 253 }).notNull(),
});

export type Radgroupcheck = typeof radgroupcheck.$inferSelect;
export type InsertRadgroupcheck = typeof radgroupcheck.$inferInsert;

// radgroupreply - Group reply attributes
export const radgroupreply = mysqlTable("radgroupreply", {
  id: int("id").autoincrement().primaryKey(),
  groupname: varchar("groupname", { length: 64 }).notNull(),
  attribute: varchar("attribute", { length: 64 }).notNull(),
  op: varchar("op", { length: 2 }).default("=").notNull(),
  value: varchar("value", { length: 253 }).notNull(),
});

export type Radgroupreply = typeof radgroupreply.$inferSelect;
export type InsertRadgroupreply = typeof radgroupreply.$inferInsert;

// radusergroup - User to group mapping
export const radusergroup = mysqlTable("radusergroup", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  groupname: varchar("groupname", { length: 64 }).notNull(),
  priority: int("priority").default(1).notNull(),
});

export type Radusergroup = typeof radusergroup.$inferSelect;
export type InsertRadusergroup = typeof radusergroup.$inferInsert;

// radacct - Accounting data
export const radacct = mysqlTable("radacct", {
  radacctid: bigint("radacctid", { mode: "number" }).autoincrement().primaryKey(),
  acctsessionid: varchar("acctsessionid", { length: 64 }).notNull(),
  acctuniqueid: varchar("acctuniqueid", { length: 32 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull(),
  groupname: varchar("groupname", { length: 64 }),
  realm: varchar("realm", { length: 64 }),
  nasipaddress: varchar("nasipaddress", { length: 15 }).notNull(),
  nasportid: varchar("nasportid", { length: 32 }),
  nasporttype: varchar("nasporttype", { length: 32 }),
  acctstarttime: timestamp("acctstarttime"),
  acctupdatetime: timestamp("acctupdatetime"),
  acctstoptime: timestamp("acctstoptime"),
  acctinterval: int("acctinterval"),
  acctsessiontime: int("acctsessiontime"),
  acctauthentic: varchar("acctauthentic", { length: 32 }),
  connectinfo_start: varchar("connectinfo_start", { length: 50 }),
  connectinfo_stop: varchar("connectinfo_stop", { length: 50 }),
  acctinputoctets: bigint("acctinputoctets", { mode: "number" }),
  acctoutputoctets: bigint("acctoutputoctets", { mode: "number" }),
  calledstationid: varchar("calledstationid", { length: 50 }),
  callingstationid: varchar("callingstationid", { length: 50 }),
  acctterminatecause: varchar("acctterminatecause", { length: 32 }),
  servicetype: varchar("servicetype", { length: 32 }),
  framedprotocol: varchar("framedprotocol", { length: 32 }),
  framedipaddress: varchar("framedipaddress", { length: 15 }),
  framedipv6address: varchar("framedipv6address", { length: 45 }),
  framedipv6prefix: varchar("framedipv6prefix", { length: 45 }),
  framedinterfaceid: varchar("framedinterfaceid", { length: 44 }),
  delegatedipv6prefix: varchar("delegatedipv6prefix", { length: 45 }),
});

export type Radacct = typeof radacct.$inferSelect;
export type InsertRadacct = typeof radacct.$inferInsert;

// radpostauth - Post-authentication log
export const radpostauth = mysqlTable("radpostauth", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  pass: varchar("pass", { length: 64 }),
  reply: varchar("reply", { length: 32 }),
  authdate: timestamp("authdate").defaultNow().notNull(),
});

export type Radpostauth = typeof radpostauth.$inferSelect;
export type InsertRadpostauth = typeof radpostauth.$inferInsert;

// ============================================================================
// RADIUS CARDS (Real RADIUS Accounts)
// ============================================================================

export const radiusCards = mysqlTable("radius_cards", {
  id: int("id").autoincrement().primaryKey(),
  // RADIUS credentials
  username: varchar("username", { length: 64 }).notNull().unique(),
  password: varchar("password", { length: 64 }).notNull(),
  // Card info
  serialNumber: varchar("serialNumber", { length: 20 }).notNull().unique(),
  batchId: varchar("batchId", { length: 50 }),
  planId: int("planId").notNull(),
  // Ownership
  createdBy: int("createdBy").notNull(),
  resellerId: int("resellerId"),
  usedBy: int("usedBy"),
  // Status
  status: mysqlEnum("status", ["unused", "active", "used", "expired", "suspended", "cancelled"]).default("unused").notNull(),
  // Validity tracking
  activatedAt: timestamp("activatedAt"),
  firstLoginAt: timestamp("firstLoginAt"),
  expiresAt: timestamp("expiresAt"),
  // Usage tracking
  totalSessionTime: int("totalSessionTime").default(0), // in seconds
  totalDataUsed: bigint("totalDataUsed", { mode: "number" }).default(0), // in bytes
  lastActivity: timestamp("lastActivity"),
  // Time Budget System (Customer-Defined Window + Usage Budget)
  usageBudgetSeconds: int("usageBudgetSeconds").default(0), // Total usage time allowed (deducted while connected)
  windowSeconds: int("windowSeconds").default(0), // Validity window duration from first use
  firstUseAt: timestamp("firstUseAt"), // When card was first used (triggers window start)
  windowEndTime: timestamp("windowEndTime"), // When the validity window expires
  // Pricing
  purchasePrice: decimal("purchasePrice", { precision: 10, scale: 2 }),
  salePrice: decimal("salePrice", { precision: 10, scale: 2 }),
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RadiusCard = typeof radiusCards.$inferSelect;
export type InsertRadiusCard = typeof radiusCards.$inferInsert;

// ============================================================================
// CARD BATCHES (For PDF generation)
// ============================================================================

export const cardBatches = mysqlTable("card_batches", {
  id: int("id").autoincrement().primaryKey(),
  batchId: varchar("batchId", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  planId: int("planId").notNull(),
  createdBy: int("createdBy").notNull(),
  resellerId: int("resellerId"),
  quantity: int("quantity").notNull(),
  // Card design
  templateImageUrl: text("templateImageUrl"),
  cardsPerPage: int("cardsPerPage").default(8),
  qrCodeUrl: varchar("qrCodeUrl", { length: 255 }), // MikroTik login page URL
  // Generated files
  pdfUrl: text("pdfUrl"),
  csvUrl: text("csvUrl"),
  // Status
  status: mysqlEnum("status", ["generating", "completed", "failed"]).default("generating").notNull(),
  errorMessage: text("errorMessage"),
  // Batch control settings
  enabled: boolean("enabled").default(true).notNull(), // Enable/Disable all cards in batch
  simultaneousUse: int("simultaneousUse").default(1), // Number of devices allowed
  // Time settings (Legacy - kept for backward compatibility)
  cardTimeValue: int("cardTimeValue").default(0), // Card activation time
  cardTimeUnit: mysqlEnum("cardTimeUnit", ["hours", "days"]).default("hours"),
  internetTimeValue: int("internetTimeValue").default(0), // Internet time available
  internetTimeUnit: mysqlEnum("internetTimeUnit", ["hours", "days"]).default("hours"),
  timeFromActivation: boolean("timeFromActivation").default(true), // Count from activation
  // New Time Budget System
  usageBudgetSeconds: int("usageBudgetSeconds").default(0), // Total usage time allowed (deducted while connected)
  windowSeconds: int("windowSeconds").default(0), // Validity window duration from first use
  // Additional settings
  hotspotPort: varchar("hotspotPort", { length: 100 }), // Hotspot port restriction
  macBinding: boolean("macBinding").default(false), // MAC binding option
  prefix: varchar("prefix", { length: 20 }), // Card prefix
  usernameLength: int("usernameLength").default(6),
  passwordLength: int("passwordLength").default(4),
  cardPrice: decimal("cardPrice", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type CardBatch = typeof cardBatches.$inferSelect;
export type InsertCardBatch = typeof cardBatches.$inferInsert;

// ============================================================================
// WALLET / BALANCE
// ============================================================================

export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

// ============================================================================
// TRANSACTIONS
// ============================================================================

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdrawal", "card_purchase", "subscription", "refund", "commission"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  referenceType: varchar("referenceType", { length: 50 }),
  referenceId: int("referenceId"),
  status: mysqlEnum("status", ["pending", "completed", "failed", "cancelled"]).default("completed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ============================================================================
// INVOICES
// ============================================================================

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  userId: int("userId").notNull(),
  resellerId: int("resellerId"),
  type: mysqlEnum("type", ["subscription", "card_purchase", "deposit", "other"]).notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 12, scale: 2 }).default("0.00").notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: mysqlEnum("status", ["draft", "pending", "paid", "cancelled", "refunded"]).default("pending").notNull(),
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paymentReference: varchar("paymentReference", { length: 255 }),
  notes: text("notes"),
  items: json("items"),
  pdfUrl: text("pdfUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ============================================================================
// CHAT MESSAGES
// ============================================================================

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  senderId: int("senderId").notNull(),
  message: text("message").notNull(),
  attachmentUrl: text("attachmentUrl"),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  ticketNumber: varchar("ticketNumber", { length: 20 }).notNull().unique(),
  userId: int("userId").notNull(),
  assignedTo: int("assignedTo"),
  subject: varchar("subject", { length: 255 }).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "waiting", "resolved", "closed"]).default("open").notNull(),
  category: varchar("category", { length: 50 }),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["invoice", "payment", "card", "support", "balance", "subscription", "system"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }),
  message: text("message").notNull(),
  messageAr: text("messageAr"),
  data: json("data"),
  isRead: boolean("isRead").default(false),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ============================================================================
// PAYMENT GATEWAY SETTINGS
// ============================================================================

export const paymentGateways = mysqlTable("payment_gateways", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  displayName: varchar("displayName", { length: 100 }).notNull(),
  displayNameAr: varchar("displayNameAr", { length: 100 }),
  type: mysqlEnum("type", ["paypal", "stripe", "bank_of_palestine", "manual"]).notNull(),
  config: json("config"),
  isActive: boolean("isActive").default(false),
  testMode: boolean("testMode").default(true),
  supportedCurrencies: json("supportedCurrencies"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentGateway = typeof paymentGateways.$inferSelect;
export type InsertPaymentGateway = typeof paymentGateways.$inferInsert;

// ============================================================================
// PAYMENTS
// ============================================================================

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  userId: int("userId").notNull(),
  gatewayId: int("gatewayId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed", "refunded"]).default("pending").notNull(),
  gatewayTransactionId: varchar("gatewayTransactionId", { length: 255 }),
  gatewayResponse: json("gatewayResponse"),
  errorMessage: text("errorMessage"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  type: mysqlEnum("type", ["string", "number", "boolean", "json"]).default("string").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }),
  entityId: int("entityId"),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ============================================================================
// CARD TEMPLATES (For PDF Design)
// ============================================================================

export const cardTemplates = mysqlTable("card_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  resellerId: int("resellerId"), // null = system template
  imageUrl: text("imageUrl").notNull(),
  imageKey: text("imageKey"), // S3 key for deletion
  
  // Username text settings
  usernameX: int("usernameX").default(50),
  usernameY: int("usernameY").default(40),
  usernameFontSize: int("usernameFontSize").default(14),
  usernameFontFamily: varchar("usernameFontFamily", { length: 50 }).default("Arial"),
  usernameFontColor: varchar("usernameFontColor", { length: 9 }).default("#000000"),
  usernameAlign: mysqlEnum("usernameAlign", ["left", "center", "right"]).default("center"),
  
  // Password text settings
  passwordX: int("passwordX").default(50),
  passwordY: int("passwordY").default(60),
  passwordFontSize: int("passwordFontSize").default(14),
  passwordFontFamily: varchar("passwordFontFamily", { length: 50 }).default("Arial"),
  passwordFontColor: varchar("passwordFontColor", { length: 9 }).default("#000000"),
  passwordAlign: mysqlEnum("passwordAlign", ["left", "center", "right"]).default("center"),
  
  // QR Code settings
  qrCodeEnabled: boolean("qrCodeEnabled").default(false),
  qrCodeX: int("qrCodeX").default(50),
  qrCodeY: int("qrCodeY").default(50),
  qrCodeSize: int("qrCodeSize").default(50),
  qrCodeDomain: varchar("qrCodeDomain", { length: 255 }), // IP or domain for QR
  
  // Card dimensions
  cardWidth: int("cardWidth").default(350),
  cardHeight: int("cardHeight").default(200),
  
  // Print settings
  cardsPerPage: int("cardsPerPage").default(8),
  marginTop: decimal("marginTop", { precision: 4, scale: 2 }).default("1.8"),
  marginHorizontal: decimal("marginHorizontal", { precision: 4, scale: 2 }).default("1.8"),
  columnsPerPage: int("columnsPerPage").default(5),
  
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CardTemplate = typeof cardTemplates.$inferSelect;
export type InsertCardTemplate = typeof cardTemplates.$inferInsert;

// ============================================================================
// ONLINE SESSIONS (Real-time tracking)
// ============================================================================

export const onlineSessions = mysqlTable("online_sessions", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull(),
  cardId: int("cardId"),
  nasId: int("nasId"),
  acctSessionId: varchar("acctSessionId", { length: 64 }).notNull(),
  framedIpAddress: varchar("framedIpAddress", { length: 15 }),
  callingStationId: varchar("callingStationId", { length: 50 }), // MAC
  startTime: timestamp("startTime").defaultNow().notNull(),
  lastUpdate: timestamp("lastUpdate").defaultNow().notNull(),
  sessionTime: int("sessionTime").default(0), // seconds
  inputOctets: bigint("inputOctets", { mode: "number" }).default(0),
  outputOctets: bigint("outputOctets", { mode: "number" }).default(0),
});

export type OnlineSession = typeof onlineSessions.$inferSelect;
export type InsertOnlineSession = typeof onlineSessions.$inferInsert;


// ============================================================================
// INTERNAL NOTIFICATIONS
// ============================================================================

export const internalNotifications = mysqlTable("internal_notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // Target user (super_admin or reseller)
  type: mysqlEnum("type", [
    "card_expired",      // كرت انتهى وقته
    "card_expiring",     // كرت على وشك الانتهاء
    "nas_disconnected",  // NAS انقطع اتصاله
    "nas_reconnected",   // NAS عاد للاتصال
    "low_balance",       // رصيد منخفض
    "new_subscription",  // اشتراك جديد
    "subscription_expired", // اشتراك انتهى
    "system"             // إشعار نظام عام
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entityType", { length: 50 }), // card, nas, user, etc.
  entityId: int("entityId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InternalNotification = typeof internalNotifications.$inferSelect;
export type InsertInternalNotification = typeof internalNotifications.$inferInsert;


// ============================================================================
// PPPoE SUBSCRIBERS (Monthly Prepaid Subscribers)
// ============================================================================

export const subscribers = mysqlTable("subscribers", {
  id: int("id").autoincrement().primaryKey(),
  
  // RADIUS credentials
  username: varchar("username", { length: 64 }).notNull().unique(),
  password: varchar("password", { length: 64 }).notNull(),
  
  // Owner (for multi-tenancy)
  ownerId: int("ownerId").notNull(), // Client/Reseller who owns this subscriber
  createdBy: int("createdBy").notNull(), // User who created this subscriber
  
  // Subscriber info
  fullName: varchar("fullName", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  nationalId: varchar("nationalId", { length: 50 }), // رقم الهوية
  notes: text("notes"),
  
  // Service configuration
  planId: int("planId").notNull(), // Linked plan for speed/limits
  nasId: int("nasId"), // Optional: restrict to specific NAS
  
  // IP Assignment
  ipAssignmentType: mysqlEnum("ipAssignmentType", ["dynamic", "static"]).default("dynamic").notNull(),
  staticIp: varchar("staticIp", { length: 45 }), // If static IP assigned
  
  // RADIUS attributes
  simultaneousUse: int("simultaneousUse").default(1), // Number of concurrent sessions
  
  // Status
  status: mysqlEnum("status", ["active", "suspended", "expired", "pending"]).default("pending").notNull(),
  
  // Subscription dates
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  
  // MAC binding (optional)
  macAddress: varchar("macAddress", { length: 17 }),
  macBindingEnabled: boolean("macBindingEnabled").default(false),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
});

export type Subscriber = typeof subscribers.$inferSelect;
export type InsertSubscriber = typeof subscribers.$inferInsert;

// ============================================================================
// SUBSCRIBER SUBSCRIPTIONS (Payment/Renewal History)
// ============================================================================

export const subscriberSubscriptions = mysqlTable("subscriber_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  subscriberId: int("subscriberId").notNull(),
  
  // Subscription period
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  
  // Plan at time of subscription (for historical reference)
  planId: int("planId").notNull(),
  planName: varchar("planName", { length: 100 }).notNull(),
  
  // Payment info
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "wallet", "card", "bank_transfer", "online"]).default("cash").notNull(),
  
  // Status
  status: mysqlEnum("status", ["active", "expired", "cancelled", "refunded"]).default("active").notNull(),
  
  // Who processed this subscription
  processedBy: int("processedBy").notNull(),
  
  // Notes
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SubscriberSubscription = typeof subscriberSubscriptions.$inferSelect;
export type InsertSubscriberSubscription = typeof subscriberSubscriptions.$inferInsert;


// ============================================================================
// VPN CONNECTIONS STATUS (Real-time VPN monitoring)
// ============================================================================

export const vpnConnections = mysqlTable("vpn_connections", {
  id: int("id").autoincrement().primaryKey(),
  nasId: int("nasId").notNull().unique(), // Reference to nas table
  
  // Connection type (from NAS settings)
  connectionType: mysqlEnum("connectionType", ["public_ip", "vpn_sstp", "vpn_l2tp"]).notNull(),
  
  // Connection status
  status: mysqlEnum("status", ["connected", "disconnected", "connecting", "error"]).default("disconnected").notNull(),
  
  // IP addresses
  localVpnIp: varchar("localVpnIp", { length: 45 }), // VPN tunnel IP assigned to NAS
  remoteIp: varchar("remoteIp", { length: 45 }), // Public IP of NAS
  serverIp: varchar("serverIp", { length: 45 }), // VPN server IP
  
  // Connection metrics
  uptime: int("uptime").default(0), // seconds since connection
  lastConnectedAt: timestamp("lastConnectedAt"),
  lastDisconnectedAt: timestamp("lastDisconnectedAt"),
  disconnectCount: int("disconnectCount").default(0), // Total disconnections
  
  // Last error info
  lastError: text("lastError"),
  lastErrorAt: timestamp("lastErrorAt"),
  
  // Traffic stats (optional)
  bytesIn: bigint("bytesIn", { mode: "number" }).default(0),
  bytesOut: bigint("bytesOut", { mode: "number" }).default(0),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VpnConnection = typeof vpnConnections.$inferSelect;
export type InsertVpnConnection = typeof vpnConnections.$inferInsert;

// ============================================================================
// VPN LOGS (Connection history and events)
// ============================================================================

export const vpnLogs = mysqlTable("vpn_logs", {
  id: int("id").autoincrement().primaryKey(),
  nasId: int("nasId").notNull(), // Reference to nas table
  vpnConnectionId: int("vpnConnectionId"), // Reference to vpn_connections
  
  // Event type
  eventType: mysqlEnum("eventType", [
    "connected",           // VPN connected successfully
    "disconnected",        // VPN disconnected
    "connection_failed",   // Connection attempt failed
    "reconnecting",        // Attempting to reconnect
    "auth_failed",         // Authentication failed
    "timeout",             // Connection timeout
    "manual_disconnect",   // Manual disconnect by admin
    "manual_restart",      // Manual restart by admin
    "error",               // General error
    "radius_error"         // RADIUS-related error
  ]).notNull(),
  
  // Event details
  message: text("message"),
  details: json("details"), // Additional JSON data
  
  // IP info at time of event
  localIp: varchar("localIp", { length: 45 }),
  remoteIp: varchar("remoteIp", { length: 45 }),
  
  // Error info (if applicable)
  errorCode: varchar("errorCode", { length: 50 }),
  errorMessage: text("errorMessage"),
  
  // Who triggered (for manual actions)
  triggeredBy: int("triggeredBy"), // User ID if manual action
  
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VpnLog = typeof vpnLogs.$inferSelect;
export type InsertVpnLog = typeof vpnLogs.$inferInsert;


// ============================================================================
// AUDIT LOGS (Security and compliance tracking)
// ============================================================================

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Who performed the action
  userId: int("userId").notNull(),
  userRole: varchar("userRole", { length: 50 }).notNull(),
  
  // What action was performed
  action: varchar("action", { length: 100 }).notNull(),
  
  // Target of the action
  targetType: varchar("targetType", { length: 50 }).notNull(), // session, nas, card, subscriber, user, vpn
  targetId: varchar("targetId", { length: 100 }), // ID of the target (username, session ID, etc.)
  targetName: varchar("targetName", { length: 255 }), // Human-readable name
  
  // NAS context (if applicable)
  nasId: int("nasId"),
  nasIp: varchar("nasIp", { length: 45 }),
  
  // Additional details (JSON)
  details: json("details"),
  
  // Result of the action
  result: mysqlEnum("result", ["success", "failure", "partial"]).notNull(),
  errorMessage: text("errorMessage"),
  
  // Request context
  ipAddress: varchar("ipAddress", { length: 45 }),
  
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;


// ============================================================================
// VPN IP POOL (Static IP allocation for VPN NAS devices)
// ============================================================================

export const vpnIpPool = mysqlTable("vpn_ip_pool", {
  id: int("id").autoincrement().primaryKey(),
  
  // Pool configuration
  name: varchar("name", { length: 100 }).notNull().default("Default VPN Pool"),
  startIp: varchar("startIp", { length: 45 }).notNull(), // e.g., 192.168.30.10
  endIp: varchar("endIp", { length: 45 }).notNull(), // e.g., 192.168.30.250
  gateway: varchar("gateway", { length: 45 }).notNull().default("192.168.30.1"), // RADIUS server IP
  subnet: varchar("subnet", { length: 45 }).notNull().default("255.255.255.0"),
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VpnIpPool = typeof vpnIpPool.$inferSelect;
export type InsertVpnIpPool = typeof vpnIpPool.$inferInsert;

// ============================================================================
// ALLOCATED VPN IPS (Track which IPs are assigned to which NAS)
// ============================================================================

export const allocatedVpnIps = mysqlTable("allocated_vpn_ips", {
  id: int("id").autoincrement().primaryKey(),
  
  // Pool reference
  poolId: int("poolId").notNull(),
  
  // Allocated IP
  ipAddress: varchar("ipAddress", { length: 45 }).notNull().unique(),
  
  // NAS assignment
  nasId: int("nasId").notNull().unique(), // One IP per NAS
  
  // Timestamps
  allocatedAt: timestamp("allocatedAt").defaultNow().notNull(),
});

export type AllocatedVpnIp = typeof allocatedVpnIps.$inferSelect;
export type InsertAllocatedVpnIp = typeof allocatedVpnIps.$inferInsert;


// ============================================================================
// SAAS PLANS (Commercial Subscription Plans)
// ============================================================================

export const saasPlans = mysqlTable("saas_plans", {
  id: int("id").autoincrement().primaryKey(),
  
  // Basic info
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("nameAr", { length: 100 }),
  description: text("description"),
  descriptionAr: text("descriptionAr"),
  
  // Pricing
  priceMonthly: decimal("priceMonthly", { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal("priceYearly", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  
  // Limits
  maxNasDevices: int("maxNasDevices").notNull().default(1),
  maxCards: int("maxCards").notNull().default(100),
  maxSubscribers: int("maxSubscribers").default(50),
  
  // Features (JSON or individual booleans)
  featureMikrotikApi: boolean("featureMikrotikApi").default(false),
  featureCoaDisconnect: boolean("featureCoaDisconnect").default(true),
  featureStaticVpnIp: boolean("featureStaticVpnIp").default(false),
  featureAdvancedReports: boolean("featureAdvancedReports").default(false),
  featureCustomBranding: boolean("featureCustomBranding").default(false),
  featurePrioritySupport: boolean("featurePrioritySupport").default(false),
  
  // Display
  displayOrder: int("displayOrder").default(0),
  isPopular: boolean("isPopular").default(false),
  isActive: boolean("isActive").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SaasPlan = typeof saasPlans.$inferSelect;
export type InsertSaasPlan = typeof saasPlans.$inferInsert;

// ============================================================================
// SAAS SUBSCRIPTIONS (User subscription history)
// ============================================================================

export const saasSubscriptions = mysqlTable("saas_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference
  userId: int("userId").notNull(),
  
  // Plan reference
  planId: int("planId").notNull(),
  planName: varchar("planName", { length: 100 }).notNull(), // Snapshot at time of subscription
  
  // Subscription period
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  
  // Billing
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).default("monthly").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  
  // Status
  status: mysqlEnum("status", ["active", "expired", "cancelled", "suspended"]).default("active").notNull(),
  
  // Payment info
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paymentReference: varchar("paymentReference", { length: 255 }),
  
  // Admin actions
  activatedBy: int("activatedBy"), // Admin who activated
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SaasSubscription = typeof saasSubscriptions.$inferSelect;
export type InsertSaasSubscription = typeof saasSubscriptions.$inferInsert;


// ============================================================================
// SMS LOGS (Track all sent SMS messages)
// ============================================================================

export const smsLogs = mysqlTable("sms_logs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Recipient info
  phone: varchar("phone", { length: 20 }).notNull(),
  userId: int("userId"), // Optional: if sent to a registered user
  
  // Message content
  message: text("message").notNull(),
  templateId: int("templateId"), // Optional: if using a template
  
  // Delivery status
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed"]).default("pending").notNull(),
  smsId: varchar("smsId", { length: 100 }), // TweetSMS message ID
  errorCode: varchar("errorCode", { length: 20 }),
  errorMessage: text("errorMessage"),
  
  // Metadata
  type: mysqlEnum("type", ["manual", "bulk", "automatic"]).default("manual").notNull(),
  triggeredBy: varchar("triggeredBy", { length: 50 }), // e.g., "subscription_expiry", "admin_manual"
  sentBy: int("sentBy"), // Admin who sent (for manual)
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
});

export type SmsLog = typeof smsLogs.$inferSelect;
export type InsertSmsLog = typeof smsLogs.$inferInsert;

// ============================================================================
// SMS TEMPLATES (Reusable message templates)
// ============================================================================

export const smsTemplates = mysqlTable("sms_templates", {
  id: int("id").autoincrement().primaryKey(),
  
  // Template info
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("nameAr", { length: 100 }),
  
  // Template content (supports variables like {name}, {days}, {plan})
  content: text("content").notNull(),
  contentAr: text("contentAr"),
  
  // Template type
  type: mysqlEnum("type", ["subscription_expiry", "welcome", "payment_reminder", "custom"]).default("custom").notNull(),
  
  // Settings
  isActive: boolean("isActive").default(true).notNull(),
  isSystem: boolean("isSystem").default(false).notNull(), // System templates can't be deleted
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = typeof smsTemplates.$inferInsert;

// ============================================================================
// SMS NOTIFICATION TRACKING (Prevent duplicate notifications)
// ============================================================================

export const smsNotificationTracking = mysqlTable("sms_notification_tracking", {
  id: int("id").autoincrement().primaryKey(),
  
  // Target
  userId: int("userId").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  
  // Notification type
  notificationType: varchar("notificationType", { length: 50 }).notNull(), // e.g., "subscription_expiry_2days"
  
  // Reference (e.g., subscription ID)
  referenceId: int("referenceId"),
  referenceType: varchar("referenceType", { length: 50 }), // e.g., "tenant_subscription"
  
  // Status
  smsLogId: int("smsLogId"), // Reference to sms_logs
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type SmsNotificationTracking = typeof smsNotificationTracking.$inferSelect;
export type InsertSmsNotificationTracking = typeof smsNotificationTracking.$inferInsert;

// ============================================================================
// WALLET LEDGER (Transaction History)
// ============================================================================

export const walletLedger = mysqlTable("wallet_ledger", {
  id: int("id").autoincrement().primaryKey(),
  
  // User reference
  userId: int("userId").notNull(),
  
  // Transaction type
  type: mysqlEnum("type", ["credit", "debit"]).notNull(),
  
  // Amount
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  
  // Balance before and after
  balanceBefore: decimal("balanceBefore", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 12, scale: 2 }).notNull(),
  
  // Reason/Description
  reason: varchar("reason", { length: 255 }).notNull(),
  reasonAr: varchar("reasonAr", { length: 255 }),
  
  // Reference to related entity
  entityType: varchar("entityType", { length: 50 }), // e.g., "card", "subscription", "invoice", "manual"
  entityId: int("entityId"),
  
  // Actor (who performed this transaction)
  actorId: int("actorId"), // User who performed the action (admin/reseller)
  actorRole: varchar("actorRole", { length: 50 }),
  
  // Additional metadata
  metadata: json("metadata"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WalletLedger = typeof walletLedger.$inferSelect;
export type InsertWalletLedger = typeof walletLedger.$inferInsert;



// ============================================================================
// FEATURE ACCESS CONTROL (Owner controls what clients can see)
// ============================================================================

export const featureAccessControl = mysqlTable("feature_access_control", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Client user ID
  // Dashboard & Monitoring
  canViewDashboard: boolean("canViewDashboard").default(true).notNull(),
  canViewActiveSessions: boolean("canViewActiveSessions").default(true).notNull(),
  canViewRadiusLogs: boolean("canViewRadiusLogs").default(false).notNull(),
  canViewNasHealth: boolean("canViewNasHealth").default(true).notNull(),
  // Infrastructure
  canManageNas: boolean("canManageNas").default(true).notNull(),
  canViewVpn: boolean("canViewVpn").default(false).notNull(),
  canManageMikrotik: boolean("canManageMikrotik").default(true).notNull(),
  // Subscribers & Users
  canManageSubscribers: boolean("canManageSubscribers").default(true).notNull(),
  canViewClients: boolean("canViewClients").default(false).notNull(), // For resellers
  // Access Control
  canManagePlans: boolean("canManagePlans").default(true).notNull(),
  canAccessRadiusControl: boolean("canAccessRadiusControl").default(false).notNull(),
  // Cards & Vouchers
  canManageCards: boolean("canManageCards").default(true).notNull(),
  canPrintCards: boolean("canPrintCards").default(true).notNull(),
  // Billing & Financial
  canViewWallet: boolean("canViewWallet").default(true).notNull(),
  canViewInvoices: boolean("canViewInvoices").default(true).notNull(),
  canViewSubscriptions: boolean("canViewSubscriptions").default(true).notNull(),
  canViewBillingDashboard: boolean("canViewBillingDashboard").default(false).notNull(),
  canViewSaasPlans: boolean("canViewSaasPlans").default(false).notNull(),
  // Reports & Analytics
  canViewReports: boolean("canViewReports").default(true).notNull(),
  canViewBandwidthAnalytics: boolean("canViewBandwidthAnalytics").default(true).notNull(),
  // System
  canViewSettings: boolean("canViewSettings").default(true).notNull(),
  canViewAuditLog: boolean("canViewAuditLog").default(false).notNull(),
  canAccessSupport: boolean("canAccessSupport").default(true).notNull(),
  canManageSms: boolean("canManageSms").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeatureAccessControl = typeof featureAccessControl.$inferSelect;
export type InsertFeatureAccessControl = typeof featureAccessControl.$inferInsert;

// ============================================================================
// SITE SETTINGS (Owner customization for landing page & branding)
// ============================================================================

export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Branding
  siteName: varchar("siteName", { length: 100 }).default("Radius Pro").notNull(),
  siteNameAr: varchar("siteNameAr", { length: 100 }).default("راديوس برو"),
  tagline: varchar("tagline", { length: 500 }).default("Professional RADIUS Management Platform"),
  taglineAr: varchar("taglineAr", { length: 500 }).default("منصة RADIUS احترافية لإدارة الإنترنت والكروت"),
  logoUrl: text("logoUrl"),
  faviconUrl: text("faviconUrl"),
  // Hero Section
  heroTitle: varchar("heroTitle", { length: 255 }).default("Complete SaaS System"),
  heroTitleAr: varchar("heroTitleAr", { length: 255 }).default("نظام SaaS متكامل"),
  heroSubtitle: varchar("heroSubtitle", { length: 500 }).default("Professional RADIUS platform for Internet and card management"),
  heroSubtitleAr: varchar("heroSubtitleAr", { length: 500 }).default("منصة RADIUS احترافية لإدارة الإنترنت والكروت"),
  heroDescription: text("heroDescription"),
  heroDescriptionAr: text("heroDescriptionAr"),
  // Stats
  uptimePercent: varchar("uptimePercent", { length: 10 }).default("99.9%"),
  activeClients: varchar("activeClients", { length: 20 }).default("+1000"),
  managedCards: varchar("managedCards", { length: 20 }).default("+50K"),
  supportHours: varchar("supportHours", { length: 20 }).default("24/7"),
  // Contact Info
  supportEmail: varchar("supportEmail", { length: 320 }).default("support@radius-pro.com"),
  supportPhone: varchar("supportPhone", { length: 50 }).default("+970 59 XXX XXXX"),
  supportHoursText: varchar("supportHoursText", { length: 255 }).default("Saturday - Thursday: 9 AM - 6 PM"),
  supportHoursTextAr: varchar("supportHoursTextAr", { length: 255 }).default("السبت - الخميس: 9 صباحاً - 6 مساءً"),
  // Footer
  companyName: varchar("companyName", { length: 255 }).default("RadiusPro"),
  companyNameAr: varchar("companyNameAr", { length: 255 }).default("راديوس برو"),
  copyrightText: varchar("copyrightText", { length: 255 }).default("© 2026 RadiusPro. All rights reserved."),
  copyrightTextAr: varchar("copyrightTextAr", { length: 255 }).default("جميع الحقوق محفوظة. RadiusPro 2026 ©"),
  // Social Media
  facebookUrl: text("facebookUrl"),
  twitterUrl: text("twitterUrl"),
  linkedinUrl: text("linkedinUrl"),
  instagramUrl: text("instagramUrl"),
  // SEO
  metaTitle: varchar("metaTitle", { length: 255 }).default("Radius Pro - Professional RADIUS Management"),
  metaTitleAr: varchar("metaTitleAr", { length: 255 }).default("راديوس برو - إدارة RADIUS احترافية"),
  metaDescription: text("metaDescription"),
  metaDescriptionAr: text("metaDescriptionAr"),
  metaKeywords: text("metaKeywords"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SiteSettings = typeof siteSettings.$inferSelect;
export type InsertSiteSettings = typeof siteSettings.$inferInsert;

// ============================================================================
// SUBSCRIPTION PLANS (For landing page pricing section)
// ============================================================================

export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  // Plan Info
  name: varchar("name", { length: 100 }).notNull(),
  nameAr: varchar("nameAr", { length: 100 }).notNull(),
  description: text("description"),
  descriptionAr: text("descriptionAr"),
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  billingPeriod: mysqlEnum("billingPeriod", ["monthly", "yearly"]).default("monthly").notNull(),
  // Features (JSON array of strings)
  features: json("features").notNull(), // ["Feature 1", "Feature 2", ...]
  featuresAr: json("featuresAr").notNull(),
  // Limits
  maxCards: int("maxCards"), // null = unlimited
  maxNasDevices: int("maxNasDevices"), // null = unlimited
  maxResellers: int("maxResellers"), // null = unlimited
  // Display
  isPopular: boolean("isPopular").default(false).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// ============================================================================
// PERMISSION PLANS SYSTEM (Global Plans like SaaS Platforms)
// ============================================================================

/**
 * Permission Groups - Define logical groups of menu items
 * Each group represents a section in the sidebar (e.g., "إدارة العملاء", "البطاقات")
 */
export const permissionGroups = mysqlTable("permission_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(), // e.g., "client_management"
  nameAr: varchar("nameAr", { length: 100 }).notNull(), // e.g., "إدارة العملاء"
  description: text("description"),
  descriptionAr: text("descriptionAr"),
  // Menu items that belong to this group (JSON array of paths)
  menuItems: json("menuItems").notNull(), // e.g., ["/clients", "/users-management"]
  // Applicable roles
  applicableRoles: json("applicableRoles").notNull(), // e.g., ["owner", "reseller", "client"]
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PermissionGroup = typeof permissionGroups.$inferSelect;
export type InsertPermissionGroup = typeof permissionGroups.$inferInsert;

/**
 * Permission Plans - Predefined plans with sets of permission groups
 * Examples: "Basic Client", "Pro Client", "Reseller Basic", "Reseller Pro"
 */
export const permissionPlans = mysqlTable("permission_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Basic Client"
  nameAr: varchar("nameAr", { length: 100 }).notNull(), // e.g., "عميل أساسي"
  description: text("description"),
  descriptionAr: text("descriptionAr"),
  // Target role for this plan
  role: mysqlEnum("role", ["reseller", "client"]).notNull(),
  // Is this the default plan for new users of this role?
  isDefault: boolean("isDefault").default(false).notNull(),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PermissionPlan = typeof permissionPlans.$inferSelect;
export type InsertPermissionPlan = typeof permissionPlans.$inferInsert;

/**
 * Permission Plan Groups - Many-to-many relationship
 * Links permission plans to their included permission groups
 */
export const permissionPlanGroups = mysqlTable("permission_plan_groups", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  groupId: int("groupId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PermissionPlanGroup = typeof permissionPlanGroups.$inferSelect;
export type InsertPermissionPlanGroup = typeof permissionPlanGroups.$inferInsert;

/**
 * User Permission Overrides - Exceptions for specific users
 * Allows granting or revoking specific permission groups without changing the plan
 */
export const userPermissionOverrides = mysqlTable("user_permission_overrides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  groupId: int("groupId").notNull(),
  // true = grant access, false = revoke access
  isGranted: boolean("isGranted").notNull(),
  // Who made this override
  createdBy: int("createdBy").notNull(), // Owner user ID
  reason: text("reason"), // Optional reason for the override
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
export type InsertUserPermissionOverride = typeof userPermissionOverrides.$inferInsert;
