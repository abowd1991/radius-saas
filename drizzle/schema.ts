import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint } from "drizzle-orm/mysql-core";

// ============================================================================
// USERS & AUTHENTICATION
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["super_admin", "reseller", "client"]).default("client").notNull(),
  resellerId: int("resellerId"), // For clients: their reseller ID
  status: mysqlEnum("status", ["active", "suspended", "inactive"]).default("active").notNull(),
  language: mysqlEnum("language", ["ar", "en"]).default("ar").notNull(),
  avatarUrl: text("avatarUrl"),
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
// INTERNET PLANS / PACKAGES
// ============================================================================

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
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
  // Extended fields for our system
  location: varchar("location", { length: 255 }),
  mikrotikApiPort: int("mikrotikApiPort").default(8728),
  mikrotikApiUser: varchar("mikrotikApiUser", { length: 64 }),
  mikrotikApiPassword: varchar("mikrotikApiPassword", { length: 128 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  lastSeen: timestamp("lastSeen"),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
  // Position settings for printing (in pixels)
  usernameX: int("usernameX").default(50),
  usernameY: int("usernameY").default(100),
  passwordX: int("passwordX").default(50),
  passwordY: int("passwordY").default(130),
  qrCodeX: int("qrCodeX").default(200),
  qrCodeY: int("qrCodeY").default(50),
  qrCodeSize: int("qrCodeSize").default(80),
  // Font settings
  fontSize: int("fontSize").default(12),
  fontColor: varchar("fontColor", { length: 7 }).default("#000000"),
  // Card dimensions
  cardWidth: int("cardWidth").default(350),
  cardHeight: int("cardHeight").default(200),
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
