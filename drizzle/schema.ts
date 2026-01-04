import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

// ============================================================================
// USERS & AUTHENTICATION
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["super_admin", "reseller", "client"]).default("client").notNull(),
  parentId: int("parentId"), // For clients: their reseller ID
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
  dataLimit: int("dataLimit"), // in MB, null = unlimited
  durationDays: int("durationDays").notNull().default(30),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  resellerPrice: decimal("resellerPrice", { precision: 10, scale: 2 }).notNull(),
  simultaneousUsers: int("simultaneousUsers").default(1),
  poolName: varchar("poolName", { length: 50 }),
  radiusAttributes: json("radiusAttributes"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

// ============================================================================
// NAS DEVICES (MikroTik Routers)
// ============================================================================

export const nasDevices = mysqlTable("nas_devices", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull().unique(),
  secret: varchar("secret", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["mikrotik", "cisco", "other"]).default("mikrotik").notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  ports: int("ports"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  lastSeen: timestamp("lastSeen"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NasDevice = typeof nasDevices.$inferSelect;
export type InsertNasDevice = typeof nasDevices.$inferInsert;

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
  referenceType: varchar("referenceType", { length: 50 }), // invoice, voucher, etc.
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
  items: json("items"), // Array of invoice items
  pdfUrl: text("pdfUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ============================================================================
// VOUCHERS / CARDS
// ============================================================================

export const vouchers = mysqlTable("vouchers", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  planId: int("planId").notNull(),
  createdBy: int("createdBy").notNull(), // User who created the voucher
  resellerId: int("resellerId"), // Reseller who owns this voucher
  batchId: varchar("batchId", { length: 50 }), // For grouping vouchers
  value: decimal("value", { precision: 10, scale: 2 }), // Optional monetary value
  status: mysqlEnum("status", ["unused", "used", "expired", "cancelled"]).default("unused").notNull(),
  usedBy: int("usedBy"),
  usedAt: timestamp("usedAt"),
  expiresAt: timestamp("expiresAt"),
  imageUrl: text("imageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Voucher = typeof vouchers.$inferSelect;
export type InsertVoucher = typeof vouchers.$inferInsert;

// ============================================================================
// VOUCHER BATCHES (For PDF generation)
// ============================================================================

export const voucherBatches = mysqlTable("voucher_batches", {
  id: int("id").autoincrement().primaryKey(),
  batchId: varchar("batchId", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  planId: int("planId").notNull(),
  createdBy: int("createdBy").notNull(),
  quantity: int("quantity").notNull(),
  templateImageUrl: text("templateImageUrl"),
  pdfUrl: text("pdfUrl"),
  status: mysqlEnum("status", ["generating", "completed", "failed"]).default("generating").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VoucherBatch = typeof voucherBatches.$inferSelect;
export type InsertVoucherBatch = typeof voucherBatches.$inferInsert;

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  nasId: int("nasId"),
  username: varchar("username", { length: 64 }).notNull().unique(), // RADIUS username
  password: varchar("password", { length: 64 }).notNull(), // RADIUS password
  status: mysqlEnum("status", ["active", "suspended", "expired", "cancelled"]).default("active").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  macAddress: varchar("macAddress", { length: 17 }),
  startDate: timestamp("startDate").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  dataUsed: int("dataUsed").default(0), // in MB
  lastActivity: timestamp("lastActivity"),
  autoRenew: boolean("autoRenew").default(false),
  voucherId: int("voucherId"),
  invoiceId: int("invoiceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ============================================================================
// RADIUS SESSIONS (Accounting)
// ============================================================================

export const radiusSessions = mysqlTable("radius_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  subscriptionId: int("subscriptionId"),
  username: varchar("username", { length: 64 }).notNull(),
  nasId: int("nasId"),
  nasIpAddress: varchar("nasIpAddress", { length: 45 }),
  nasPort: int("nasPort"),
  framedIpAddress: varchar("framedIpAddress", { length: 45 }),
  callingStationId: varchar("callingStationId", { length: 50 }), // MAC address
  startTime: timestamp("startTime").notNull(),
  stopTime: timestamp("stopTime"),
  sessionTime: int("sessionTime").default(0), // in seconds
  inputOctets: int("inputOctets").default(0),
  outputOctets: int("outputOctets").default(0),
  terminateCause: varchar("terminateCause", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RadiusSession = typeof radiusSessions.$inferSelect;
export type InsertRadiusSession = typeof radiusSessions.$inferInsert;

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
  type: mysqlEnum("type", ["invoice", "payment", "voucher", "support", "balance", "subscription", "system"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }),
  message: text("message").notNull(),
  messageAr: text("messageAr"),
  data: json("data"), // Additional data for the notification
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
  config: json("config"), // Encrypted gateway configuration
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
