import { eq, desc, and, or, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { radiusCards, cardBatches, radcheck, radreply, radusergroup, plans, InsertRadiusCard, InsertCardBatch } from "../../drizzle/schema";
import { nanoid } from "nanoid";

// Generate random username for RADIUS
function generateUsername(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let username = "user_";
  for (let i = 0; i < 8; i++) {
    username += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return username;
}

// Generate random password for RADIUS
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Generate serial number for card
function generateSerialNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let serial = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) serial += "-";
    serial += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return serial;
}

// Calculate expiration based on plan validity
function calculateExpiration(plan: any, startFrom: "first_login" | "card_creation"): Date | null {
  if (startFrom === "first_login") {
    return null; // Will be set on first login
  }
  
  const now = new Date();
  switch (plan.validityType) {
    case "minutes":
      return new Date(now.getTime() + plan.validityValue * 60 * 1000);
    case "hours":
      return new Date(now.getTime() + plan.validityValue * 60 * 60 * 1000);
    case "days":
    default:
      return new Date(now.getTime() + plan.validityValue * 24 * 60 * 60 * 1000);
  }
}

// Insert RADIUS attributes for a card
async function insertRadiusAttributes(db: any, username: string, password: string, plan: any) {
  // Insert into radcheck (authentication)
  await db.insert(radcheck).values([
    { username, attribute: "Cleartext-Password", op: ":=", value: password },
    { username, attribute: "Simultaneous-Use", op: ":=", value: String(plan.simultaneousUse || 1) },
  ]);
  
  // Build radreply attributes
  const replyAttributes: { username: string; attribute: string; op: string; value: string }[] = [];
  
  // Speed limit (MikroTik Rate-Limit)
  if (plan.mikrotikRateLimit) {
    replyAttributes.push({
      username,
      attribute: "Mikrotik-Rate-Limit",
      op: "=",
      value: plan.mikrotikRateLimit,
    });
  } else if (plan.downloadSpeed && plan.uploadSpeed) {
    // Convert Kbps to format: rx-rate/tx-rate (download/upload)
    const rateLimit = `${plan.downloadSpeed}k/${plan.uploadSpeed}k`;
    replyAttributes.push({
      username,
      attribute: "Mikrotik-Rate-Limit",
      op: "=",
      value: rateLimit,
    });
  }
  
  // Session timeout
  if (plan.sessionTimeout) {
    replyAttributes.push({
      username,
      attribute: "Session-Timeout",
      op: "=",
      value: String(plan.sessionTimeout),
    });
  }
  
  // Idle timeout
  if (plan.idleTimeout) {
    replyAttributes.push({
      username,
      attribute: "Idle-Timeout",
      op: "=",
      value: String(plan.idleTimeout),
    });
  }
  
  // Address pool
  if (plan.mikrotikAddressPool) {
    replyAttributes.push({
      username,
      attribute: "Framed-Pool",
      op: "=",
      value: plan.mikrotikAddressPool,
    });
  }
  
  // Data limit (if set)
  if (plan.dataLimit) {
    replyAttributes.push({
      username,
      attribute: "Max-All-Session",
      op: "=",
      value: String(plan.dataLimit),
    });
  }
  
  // Insert reply attributes
  if (replyAttributes.length > 0) {
    await db.insert(radreply).values(replyAttributes);
  }
  
  // Add to user group (plan name as group)
  await db.insert(radusergroup).values({
    username,
    groupname: `plan_${plan.id}`,
    priority: 1,
  });
}

export async function getAllCards(options?: { status?: string; batchId?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options?.status) {
    conditions.push(eq(radiusCards.status, options.status as any));
  }
  if (options?.batchId) {
    conditions.push(eq(radiusCards.batchId, options.batchId));
  }
  
  if (conditions.length > 0) {
    return db.select()
      .from(radiusCards)
      .where(and(...conditions))
      .orderBy(desc(radiusCards.createdAt))
      .limit(options?.limit || 50);
  }
  
  return db.select()
    .from(radiusCards)
    .orderBy(desc(radiusCards.createdAt))
    .limit(options?.limit || 50);
}

// Get cards by reseller/owner - includes cards where user is resellerId OR createdBy
export async function getCardsByReseller(userId: number, options?: { status?: string; batchId?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  // Filter by resellerId OR createdBy for multi-tenant isolation
  let conditions = [or(eq(radiusCards.resellerId, userId), eq(radiusCards.createdBy, userId))];
  
  if (options?.status) {
    conditions.push(eq(radiusCards.status, options.status as any));
  }
  if (options?.batchId) {
    conditions.push(eq(radiusCards.batchId, options.batchId));
  }
  
  return db.select()
    .from(radiusCards)
    .where(and(...conditions))
    .orderBy(desc(radiusCards.createdAt))
    .limit(options?.limit || 50);
}

export async function getCardById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(radiusCards).where(eq(radiusCards.id, id)).limit(1);
  return result[0] || null;
}

export async function getCardBySerial(serialNumber: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(radiusCards).where(eq(radiusCards.serialNumber, serialNumber)).limit(1);
  return result[0] || null;
}

export async function getCardByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(radiusCards).where(eq(radiusCards.username, username)).limit(1);
  return result[0] || null;
}

// Generate username with configurable length and prefix
function generateUsernameWithOptions(length: number = 6, prefix: string = ''): string {
  const chars = '0123456789';
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate password with configurable length
function generatePasswordWithLength(length: number = 4): string {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Format expiration date for FreeRADIUS
function formatExpirationDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${month} ${day} ${year} ${hours}:${minutes}:${seconds}`;
}

// Generate RADIUS cards with real RADIUS accounts
export async function generateCards(data: {
  planId: number;
  quantity: number;
  createdBy: number;
  resellerId?: number;
  batchName?: string;
  purchasePrice?: number;
  salePrice?: number;
  // New fields
  simultaneousUse?: number;
  hotspotPort?: string;
  timeFromActivation?: boolean;
  internetTimeValue?: number;
  internetTimeUnit?: 'hours' | 'days';
  cardTimeValue?: number;
  cardTimeUnit?: 'hours' | 'days';
  macBinding?: boolean;
  prefix?: string;
  usernameLength?: number;
  passwordLength?: number;
  subscriberGroup?: string;
  cardPrice?: number;
  // New Time Budget System
  usageBudgetSeconds?: number;
  windowSeconds?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get plan details
  const planResult = await db.select().from(plans).where(eq(plans.id, data.planId)).limit(1);
  const plan = planResult[0];
  if (!plan) throw new Error("Plan not found");
  
  const batchId = nanoid(10);
  const usernameLength = data.usernameLength || 6;
  const passwordLength = data.passwordLength || 4;
  const prefix = data.prefix || '';
  const simultaneousUse = data.simultaneousUse || 1;
  const subscriberGroup = data.subscriberGroup || 'Default group';
  const timeFromActivation = data.timeFromActivation !== false;
  
  // Create batch record with all new fields
  await db.insert(cardBatches).values({
    batchId,
    name: data.batchName || `Batch ${batchId}`,
    planId: data.planId,
    createdBy: data.createdBy,
    resellerId: data.resellerId,
    quantity: data.quantity,
    status: "generating",
    simultaneousUse,
    hotspotPort: data.hotspotPort || null,
    timeFromActivation,
    internetTimeValue: data.internetTimeValue || 0,
    internetTimeUnit: data.internetTimeUnit || 'hours',
    cardTimeValue: data.cardTimeValue || 0,
    cardTimeUnit: data.cardTimeUnit || 'hours',
    macBinding: data.macBinding || false,
    prefix: prefix || null,
    usernameLength,
    passwordLength,
    subscriberGroup,
    cardPrice: data.cardPrice ? String(data.cardPrice) : '0',
    // New Time Budget System
    usageBudgetSeconds: data.usageBudgetSeconds || 0,
    windowSeconds: data.windowSeconds || 0,
  } as any);
  
  // Calculate session timeout based on card time settings
  let sessionTimeout: number | null = null;
  if (data.cardTimeValue && data.cardTimeValue > 0) {
    if (data.cardTimeUnit === 'days') {
      sessionTimeout = data.cardTimeValue * 24 * 60 * 60;
    } else {
      sessionTimeout = data.cardTimeValue * 60 * 60;
    }
  }
  
  // Calculate expiration based on timeFromActivation setting
  let expiresAt: Date | null = null;
  if (!timeFromActivation) {
    const now = new Date();
    if (data.cardTimeValue && data.cardTimeValue > 0) {
      if (data.cardTimeUnit === 'days') {
        expiresAt = new Date(now.getTime() + data.cardTimeValue * 24 * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(now.getTime() + data.cardTimeValue * 60 * 60 * 1000);
      }
    } else if (plan.validityValue) {
      if (plan.validityType === 'days') {
        expiresAt = new Date(now.getTime() + plan.validityValue * 24 * 60 * 60 * 1000);
      } else if (plan.validityType === 'hours') {
        expiresAt = new Date(now.getTime() + plan.validityValue * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(now.getTime() + plan.validityValue * 60 * 1000);
      }
    } else {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }
  
  // Generate all cards data first (BULK PREPARATION)
  const generatedCards: { serialNumber: string; username: string; password: string }[] = [];
  const allRadcheckValues: { username: string; attribute: string; op: string; value: string }[] = [];
  const allRadreplyValues: { username: string; attribute: string; op: string; value: string }[] = [];
  const allRadusergroupValues: { username: string; groupname: string; priority: number }[] = [];
  const allCardValues: any[] = [];
  
  // Prepare rate limit string
  let rateLimitValue: string | null = null;
  if (plan.mikrotikRateLimit) {
    rateLimitValue = plan.mikrotikRateLimit;
  } else if (plan.downloadSpeed && plan.uploadSpeed) {
    rateLimitValue = `${plan.downloadSpeed}k/${plan.uploadSpeed}k`;
  }
  
  const finalSessionTimeout = sessionTimeout || plan.sessionTimeout;
  
  // Generate all data in memory first
  for (let i = 0; i < data.quantity; i++) {
    const username = generateUsernameWithOptions(usernameLength, prefix);
    const password = generatePasswordWithLength(passwordLength);
    const serialNumber = generateSerialNumber();
    
    // Radcheck values
    allRadcheckValues.push(
      { username, attribute: "Cleartext-Password", op: ":=", value: password },
      { username, attribute: "Simultaneous-Use", op: ":=", value: String(simultaneousUse) },
      { username, attribute: "Auth-Type", op: ":=", value: "Accept" },
    );
    
    // Add expiration attribute
    if (!timeFromActivation && expiresAt) {
      allRadcheckValues.push({
        username,
        attribute: "Expiration",
        op: ":=",
        value: formatExpirationDate(expiresAt),
      });
    } else {
      allRadcheckValues.push({
        username,
        attribute: "Expiration",
        op: ":=",
        value: "Jan 01 2099 00:00:00",
      });
    }
    
    // Radreply values
    if (rateLimitValue) {
      allRadreplyValues.push({
        username,
        attribute: "Mikrotik-Rate-Limit",
        op: "=",
        value: rateLimitValue,
      });
    }
    
    if (finalSessionTimeout && finalSessionTimeout > 0) {
      allRadreplyValues.push({
        username,
        attribute: "Session-Timeout",
        op: "=",
        value: String(finalSessionTimeout),
      });
    }
    
    if (plan.idleTimeout) {
      allRadreplyValues.push({
        username,
        attribute: "Idle-Timeout",
        op: "=",
        value: String(plan.idleTimeout),
      });
    }
    
    if (plan.mikrotikAddressPool) {
      allRadreplyValues.push({
        username,
        attribute: "Framed-Pool",
        op: "=",
        value: plan.mikrotikAddressPool,
      });
    }
    
    if (data.hotspotPort) {
      allRadreplyValues.push({
        username,
        attribute: "Called-Station-Id",
        op: "==",
        value: data.hotspotPort,
      });
    }
    
    // Note: Max-All-Session removed - not a standard FreeRADIUS attribute
    // Session-Timeout from usageBudgetSeconds takes priority
    if (data.usageBudgetSeconds && data.usageBudgetSeconds > 0) {
      // Override Session-Timeout with usageBudgetSeconds if provided
      // Remove any existing Session-Timeout for this user
      const existingIdx = allRadreplyValues.findIndex(
        v => v.username === username && v.attribute === 'Session-Timeout'
      );
      if (existingIdx >= 0) {
        allRadreplyValues[existingIdx].value = String(data.usageBudgetSeconds);
      } else {
        allRadreplyValues.push({
          username,
          attribute: "Session-Timeout",
          op: "=",
          value: String(data.usageBudgetSeconds),
        });
      }
    }
    
    // Radusergroup values
    allRadusergroupValues.push({
      username,
      groupname: subscriberGroup,
      priority: 1,
    });
    
    // Card record
    allCardValues.push({
      username,
      password,
      serialNumber,
      batchId,
      planId: data.planId,
      createdBy: data.createdBy,
      resellerId: data.resellerId,
      status: "unused",
      expiresAt,
      purchasePrice: data.purchasePrice ? String(data.purchasePrice) : plan.resellerPrice,
      salePrice: data.salePrice || data.cardPrice ? String(data.salePrice || data.cardPrice) : plan.price,
      // New Time Budget System
      usageBudgetSeconds: data.usageBudgetSeconds || 0,
      windowSeconds: data.windowSeconds || 0,
    });
    
    generatedCards.push({ serialNumber, username, password });
  }
  
  // BULK INSERT in batches of 100 for better performance
  const BATCH_SIZE = 100;
  
  // Insert radcheck in batches
  for (let i = 0; i < allRadcheckValues.length; i += BATCH_SIZE) {
    const batch = allRadcheckValues.slice(i, i + BATCH_SIZE);
    await db.insert(radcheck).values(batch);
  }
  
  // Insert radreply in batches
  if (allRadreplyValues.length > 0) {
    for (let i = 0; i < allRadreplyValues.length; i += BATCH_SIZE) {
      const batch = allRadreplyValues.slice(i, i + BATCH_SIZE);
      await db.insert(radreply).values(batch);
    }
  }
  
  // Insert radusergroup in batches
  for (let i = 0; i < allRadusergroupValues.length; i += BATCH_SIZE) {
    const batch = allRadusergroupValues.slice(i, i + BATCH_SIZE);
    await db.insert(radusergroup).values(batch);
  }
  
  // Insert cards in batches
  for (let i = 0; i < allCardValues.length; i += BATCH_SIZE) {
    const batch = allCardValues.slice(i, i + BATCH_SIZE);
    await db.insert(radiusCards).values(batch as any);
  }
  
  // Update batch status
  await db.update(cardBatches)
    .set({ status: "completed" })
    .where(eq(cardBatches.batchId, batchId));
  
  return { 
    success: true, 
    batchId, 
    cards: generatedCards, 
    quantity: data.quantity,
    planName: plan.name,
  };
}

// Activate a card (when user first uses it)
export async function activateCard(serialNumber: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const card = await getCardBySerial(serialNumber);
  
  if (!card) {
    throw new Error("Invalid card serial number");
  }
  
  if (card.status !== "unused") {
    throw new Error("Card has already been used or is expired");
  }
  
  // Get plan for expiration calculation
  const planResult = await db.select().from(plans).where(eq(plans.id, card.planId)).limit(1);
  const plan = planResult[0];
  
  // Calculate expiration from first login if not already set
  let expiresAt = card.expiresAt;
  if (!expiresAt && plan) {
    expiresAt = calculateExpiration(plan, "first_login");
    if (!expiresAt) {
      // Default to plan validity from now
      const now = new Date();
      switch (plan.validityType) {
        case "minutes":
          expiresAt = new Date(now.getTime() + plan.validityValue * 60 * 1000);
          break;
        case "hours":
          expiresAt = new Date(now.getTime() + plan.validityValue * 60 * 60 * 1000);
          break;
        case "days":
        default:
          expiresAt = new Date(now.getTime() + plan.validityValue * 24 * 60 * 60 * 1000);
      }
    }
    
    // Update radcheck with Expiration attribute
    await db.insert(radcheck).values({
      username: card.username,
      attribute: "Expiration",
      op: ":=",
      value: expiresAt.toISOString().replace('T', ' ').substring(0, 19),
    });
  }
  
  // Mark card as active
  await db.update(radiusCards)
    .set({
      status: "active",
      usedBy: userId,
      activatedAt: new Date(),
      firstLoginAt: new Date(),
      expiresAt,
    })
    .where(eq(radiusCards.id, card.id));
  
  return { 
    success: true, 
    planId: card.planId, 
    cardId: card.id,
    username: card.username,
    password: card.password,
    expiresAt,
  };
}

// Suspend a card
export async function suspendCard(cardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const card = await getCardById(cardId);
  if (!card) throw new Error("Card not found");
  
  // Update radcheck to disable authentication
  await db.insert(radcheck).values({
    username: card.username,
    attribute: "Auth-Type",
    op: ":=",
    value: "Reject",
  });
  
  await db.update(radiusCards)
    .set({ status: "suspended" })
    .where(eq(radiusCards.id, cardId));
  
  return { success: true };
}

// Unsuspend a card
export async function unsuspendCard(cardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const card = await getCardById(cardId);
  if (!card) throw new Error("Card not found");
  
  // Remove reject attribute
  await db.delete(radcheck)
    .where(and(
      eq(radcheck.username, card.username),
      eq(radcheck.attribute, "Auth-Type")
    ));
  
  await db.update(radiusCards)
    .set({ status: "active" })
    .where(eq(radiusCards.id, cardId));
  
  return { success: true };
}

// Get all batches
export async function getAllBatches() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cardBatches).orderBy(desc(cardBatches.createdAt));
}

export async function getBatchesByCreator(createdBy: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(cardBatches)
    .where(eq(cardBatches.createdBy, createdBy))
    .orderBy(desc(cardBatches.createdAt));
}

export async function getBatchesByReseller(resellerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(cardBatches)
    .where(eq(cardBatches.resellerId, resellerId))
    .orderBy(desc(cardBatches.createdAt));
}

export async function getBatchById(batchId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cardBatches).where(eq(cardBatches.batchId, batchId)).limit(1);
  return result[0] || null;
}

export async function getCardsByBatch(batchId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(radiusCards)
    .where(eq(radiusCards.batchId, batchId))
    .orderBy(desc(radiusCards.createdAt));
}

// Aliases for backward compatibility
export const getAllVouchers = getAllCards;
export const getVouchersByReseller = getCardsByReseller;
export const getVoucherById = getCardById;
export const getVoucherByCode = getCardBySerial;
export const generateVouchers = generateCards;
export const redeemVoucher = activateCard;


// Get subscriber groups for dropdown
export async function getSubscriberGroups() {
  const db = await getDb();
  if (!db) return ['Default group'];

  try {
    const groups = await db.selectDistinct({ groupname: radusergroup.groupname })
      .from(radusergroup);

    const groupNames = groups.map(g => g.groupname).filter(Boolean);
    
    // Always include default group
    if (!groupNames.includes('Default group')) {
      groupNames.unshift('Default group');
    }
    
    return groupNames;
  } catch (error) {
    console.error('Error fetching subscriber groups:', error);
    return ['Default group'];
  }
}


// ============================================================================
// BATCH MANAGEMENT FUNCTIONS
// ============================================================================

// Get batch statistics
export async function getBatchStats(batchId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const cards = await db.select()
    .from(radiusCards)
    .where(eq(radiusCards.batchId, batchId));
  
  const total = cards.length;
  const unused = cards.filter(c => c.status === 'unused').length;
  const active = cards.filter(c => c.status === 'active').length;
  const used = cards.filter(c => c.status === 'used').length;
  const expired = cards.filter(c => c.status === 'expired').length;
  const suspended = cards.filter(c => c.status === 'suspended').length;
  
  return {
    total,
    unused,
    active,
    used,
    expired,
    suspended,
    currentlyActive: active, // Cards that are currently in use
  };
}

// Enable batch - activate all cards in batch for RADIUS authentication
// OPTIMIZED: Uses bulk operations for better performance
export async function enableBatch(batchId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error("Batch not found");
  
  // Get all cards in batch
  const cards = await getCardsByBatch(batchId);
  if (cards.length === 0) {
    await db.update(cardBatches)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(cardBatches.batchId, batchId));
    return { success: true, affectedCards: 0 };
  }
  
  const usernames = cards.map(c => c.username);
  
  // BULK: Remove Auth-Type := Reject from all cards in batch
  await db.delete(radcheck)
    .where(and(
      inArray(radcheck.username, usernames),
      eq(radcheck.attribute, "Auth-Type"),
      eq(radcheck.value, "Reject")
    ));
  
  // BULK: Update suspended cards back to their original status
  const suspendedCards = cards.filter(c => c.status === 'suspended');
  if (suspendedCards.length > 0) {
    // Update cards with activatedAt to 'active'
    const activatedIds = suspendedCards.filter(c => c.activatedAt).map(c => c.id);
    if (activatedIds.length > 0) {
      await db.update(radiusCards)
        .set({ status: 'active' })
        .where(inArray(radiusCards.id, activatedIds));
    }
    
    // Update cards without activatedAt to 'unused'
    const unusedIds = suspendedCards.filter(c => !c.activatedAt).map(c => c.id);
    if (unusedIds.length > 0) {
      await db.update(radiusCards)
        .set({ status: 'unused' })
        .where(inArray(radiusCards.id, unusedIds));
    }
  }
  
  // Update batch enabled status
  await db.update(cardBatches)
    .set({ enabled: true, updatedAt: new Date() })
    .where(eq(cardBatches.batchId, batchId));
  
  return { success: true, affectedCards: cards.length };
}

// Disable batch - disable all cards in batch for RADIUS authentication
// OPTIMIZED: Uses bulk operations for better performance
export async function disableBatch(batchId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error("Batch not found");
  
  // Get all cards in batch
  const cards = await getCardsByBatch(batchId);
  if (cards.length === 0) {
    await db.update(cardBatches)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(cardBatches.batchId, batchId));
    return { success: true, affectedCards: 0 };
  }
  
  const usernames = cards.map(c => c.username);
  const cardIds = cards.map(c => c.id);
  
  // BULK: Remove any existing Auth-Type attributes
  await db.delete(radcheck)
    .where(and(
      inArray(radcheck.username, usernames),
      eq(radcheck.attribute, "Auth-Type")
    ));
  
  // BULK: Insert Auth-Type := Reject for all cards
  const rejectEntries = usernames.map(username => ({
    username,
    attribute: "Auth-Type",
    op: ":=",
    value: "Reject",
  }));
  
  // Insert in batches of 100 to avoid query size limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < rejectEntries.length; i += BATCH_SIZE) {
    const batch = rejectEntries.slice(i, i + BATCH_SIZE);
    await db.insert(radcheck).values(batch);
  }
  
  // BULK: Update all card statuses to suspended
  await db.update(radiusCards)
    .set({ status: 'suspended' })
    .where(inArray(radiusCards.id, cardIds));
  
  // Update batch enabled status
  await db.update(cardBatches)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(cardBatches.batchId, batchId));
  
  return { success: true, affectedCards: cards.length };
}

// Update batch time settings
// OPTIMIZED: Uses bulk operations for better performance
export async function updateBatchTime(batchId: string, data: {
  cardTimeValue?: number;
  cardTimeUnit?: 'hours' | 'days';
  internetTimeValue?: number;
  internetTimeUnit?: 'hours' | 'days';
  timeFromActivation?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error("Batch not found");
  
  // Get all cards in batch
  const cards = await getCardsByBatch(batchId);
  if (cards.length === 0) {
    // Just update batch settings
    await db.update(cardBatches)
      .set({
        cardTimeValue: data.cardTimeValue ?? batch.cardTimeValue,
        cardTimeUnit: data.cardTimeUnit ?? batch.cardTimeUnit,
        internetTimeValue: data.internetTimeValue ?? batch.internetTimeValue,
        internetTimeUnit: data.internetTimeUnit ?? batch.internetTimeUnit,
        timeFromActivation: data.timeFromActivation ?? batch.timeFromActivation,
        updatedAt: new Date(),
      })
      .where(eq(cardBatches.batchId, batchId));
    return { success: true, affectedCards: 0 };
  }
  
  const usernames = cards.map(c => c.username);
  const cardIds = cards.map(c => c.id);
  
  // Calculate new session timeout
  let sessionTimeout: number | null = null;
  const cardTimeValue = data.cardTimeValue ?? batch.cardTimeValue ?? 0;
  const cardTimeUnit = data.cardTimeUnit ?? batch.cardTimeUnit ?? 'hours';
  
  if (cardTimeValue > 0) {
    if (cardTimeUnit === 'days') {
      sessionTimeout = cardTimeValue * 24 * 60 * 60;
    } else {
      sessionTimeout = cardTimeValue * 60 * 60;
    }
  }
  
  // Calculate new expiration
  const timeFromActivation = data.timeFromActivation ?? batch.timeFromActivation ?? true;
  let expiresAt: Date | null = null;
  
  if (!timeFromActivation && cardTimeValue > 0) {
    const now = new Date();
    if (cardTimeUnit === 'days') {
      expiresAt = new Date(now.getTime() + cardTimeValue * 24 * 60 * 60 * 1000);
    } else {
      expiresAt = new Date(now.getTime() + cardTimeValue * 60 * 60 * 1000);
    }
  }
  
  // BULK: Update Session-Timeout
  if (sessionTimeout !== null) {
    // Remove old Session-Timeout for all cards
    await db.delete(radreply)
      .where(and(
        inArray(radreply.username, usernames),
        eq(radreply.attribute, "Session-Timeout")
      ));
    
    // Insert new Session-Timeout for all cards
    const timeoutEntries = usernames.map(username => ({
      username,
      attribute: "Session-Timeout",
      op: "=",
      value: String(sessionTimeout),
    }));
    
    const BATCH_SIZE = 100;
    for (let i = 0; i < timeoutEntries.length; i += BATCH_SIZE) {
      const batchEntries = timeoutEntries.slice(i, i + BATCH_SIZE);
      await db.insert(radreply).values(batchEntries);
    }
  }
  
  // BULK: Update Expiration if not counting from activation
  if (!timeFromActivation && expiresAt) {
    // Remove old Expiration for all cards
    await db.delete(radcheck)
      .where(and(
        inArray(radcheck.username, usernames),
        eq(radcheck.attribute, "Expiration")
      ));
    
    // Insert new Expiration for all cards
    const expirationEntries = usernames.map(username => ({
      username,
      attribute: "Expiration",
      op: ":=",
      value: formatExpirationDate(expiresAt!),
    }));
    
    const BATCH_SIZE = 100;
    for (let i = 0; i < expirationEntries.length; i += BATCH_SIZE) {
      const batchEntries = expirationEntries.slice(i, i + BATCH_SIZE);
      await db.insert(radcheck).values(batchEntries);
    }
    
    // Update card expiration dates
    await db.update(radiusCards)
      .set({ expiresAt })
      .where(inArray(radiusCards.id, cardIds));
  }
  
  // Update batch settings
  await db.update(cardBatches)
    .set({
      cardTimeValue: data.cardTimeValue ?? batch.cardTimeValue,
      cardTimeUnit: data.cardTimeUnit ?? batch.cardTimeUnit,
      internetTimeValue: data.internetTimeValue ?? batch.internetTimeValue,
      internetTimeUnit: data.internetTimeUnit ?? batch.internetTimeUnit,
      timeFromActivation: data.timeFromActivation ?? batch.timeFromActivation,
      updatedAt: new Date(),
    })
    .where(eq(cardBatches.batchId, batchId));
  
  return { success: true, affectedCards: cards.length };
}

// Update batch properties (simultaneous use, plan, etc.)
// OPTIMIZED: Uses bulk operations for better performance
export async function updateBatchProperties(batchId: string, data: {
  simultaneousUse?: number;
  planId?: number;
  hotspotPort?: string;
  macBinding?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error("Batch not found");
  
  // Get all cards in batch
  const cards = await getCardsByBatch(batchId);
  
  // Update batch settings first
  const updateData: any = { updatedAt: new Date() };
  if (data.simultaneousUse !== undefined) updateData.simultaneousUse = data.simultaneousUse;
  if (data.planId !== undefined) updateData.planId = data.planId;
  if (data.hotspotPort !== undefined) updateData.hotspotPort = data.hotspotPort;
  if (data.macBinding !== undefined) updateData.macBinding = data.macBinding;
  
  await db.update(cardBatches)
    .set(updateData)
    .where(eq(cardBatches.batchId, batchId));
  
  if (cards.length === 0) {
    return { success: true, affectedCards: 0 };
  }
  
  const usernames = cards.map(c => c.username);
  const cardIds = cards.map(c => c.id);
  const BATCH_SIZE = 100;
  
  // Get plan if changing
  let plan = null;
  if (data.planId) {
    const planResult = await db.select().from(plans).where(eq(plans.id, data.planId)).limit(1);
    plan = planResult[0];
    if (!plan) throw new Error("Plan not found");
  }
  
  // BULK: Update Simultaneous-Use
  if (data.simultaneousUse !== undefined) {
    // Remove old Simultaneous-Use for all cards
    await db.delete(radcheck)
      .where(and(
        inArray(radcheck.username, usernames),
        eq(radcheck.attribute, "Simultaneous-Use")
      ));
    
    // Insert new Simultaneous-Use for all cards
    const simUseEntries = usernames.map(username => ({
      username,
      attribute: "Simultaneous-Use",
      op: ":=",
      value: String(data.simultaneousUse),
    }));
    
    for (let i = 0; i < simUseEntries.length; i += BATCH_SIZE) {
      const batchEntries = simUseEntries.slice(i, i + BATCH_SIZE);
      await db.insert(radcheck).values(batchEntries);
    }
  }
  
  // BULK: Update rate limit if plan changed
  if (plan) {
    // Remove old rate limit for all cards
    await db.delete(radreply)
      .where(and(
        inArray(radreply.username, usernames),
        eq(radreply.attribute, "Mikrotik-Rate-Limit")
      ));
    
    // Add new rate limit
    let rateLimitValue: string | null = null;
    if (plan.mikrotikRateLimit) {
      rateLimitValue = plan.mikrotikRateLimit;
    } else if (plan.downloadSpeed && plan.uploadSpeed) {
      rateLimitValue = `${plan.downloadSpeed}k/${plan.uploadSpeed}k`;
    }
    
    if (rateLimitValue) {
      const rateLimitEntries = usernames.map(username => ({
        username,
        attribute: "Mikrotik-Rate-Limit",
        op: "=",
        value: rateLimitValue!,
      }));
      
      for (let i = 0; i < rateLimitEntries.length; i += BATCH_SIZE) {
        const batchEntries = rateLimitEntries.slice(i, i + BATCH_SIZE);
        await db.insert(radreply).values(batchEntries);
      }
    }
    
    // Remove old user groups for all cards
    await db.delete(radusergroup)
      .where(inArray(radusergroup.username, usernames));
    
    // Insert new user groups for all cards
    const groupEntries = usernames.map(username => ({
      username,
      groupname: `plan_${plan!.id}`,
      priority: 1,
    }));
    
    for (let i = 0; i < groupEntries.length; i += BATCH_SIZE) {
      const batchEntries = groupEntries.slice(i, i + BATCH_SIZE);
      await db.insert(radusergroup).values(batchEntries);
    }
    
    // Update card plans
    await db.update(radiusCards)
      .set({ planId: plan.id })
      .where(inArray(radiusCards.id, cardIds));
  }
  
  return { success: true, affectedCards: cards.length };
}

// Get batch with statistics
export async function getBatchWithStats(batchId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const batch = await getBatchById(batchId);
  if (!batch) return null;
  
  const stats = await getBatchStats(batchId);
  
  // Get plan name
  const planResult = await db.select().from(plans).where(eq(plans.id, batch.planId)).limit(1);
  const plan = planResult[0];
  
  return {
    ...batch,
    stats,
    planName: plan?.name || 'Unknown',
  };
}

// Get all batches with statistics
export async function getAllBatchesWithStats() {
  const db = await getDb();
  if (!db) return [];
  
  const batches = await db.select().from(cardBatches).orderBy(desc(cardBatches.createdAt));
  
  const batchesWithStats = await Promise.all(
    batches.map(async (batch) => {
      const stats = await getBatchStats(batch.batchId);
      const planResult = await db.select().from(plans).where(eq(plans.id, batch.planId)).limit(1);
      const plan = planResult[0];
      
      return {
        ...batch,
        stats,
        planName: plan?.name || 'Unknown',
      };
    })
  );
  
  return batchesWithStats;
}

// Get batches by reseller/owner with statistics
// Includes batches where user is resellerId OR createdBy (for multi-tenant isolation)
export async function getBatchesByResellerWithStats(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get batches where user is either the reseller or the creator
  const batches = await db.select()
    .from(cardBatches)
    .where(or(eq(cardBatches.resellerId, userId), eq(cardBatches.createdBy, userId)))
    .orderBy(desc(cardBatches.createdAt));
  
  const batchesWithStats = await Promise.all(
    batches.map(async (batch) => {
      const stats = await getBatchStats(batch.batchId);
      const planResult = await db.select().from(plans).where(eq(plans.id, batch.planId)).limit(1);
      const plan = planResult[0];
      
      return {
        ...batch,
        stats,
        planName: plan?.name || 'Unknown',
      };
    })
  );
  
  return batchesWithStats;
}

// Delete batch with options
// OPTIMIZED: Uses bulk operations for better performance
export async function deleteBatch(batchId: string, deleteCards: boolean = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error("Batch not found");
  
  // Get all cards in batch
  const cards = await getCardsByBatch(batchId);
  
  if (deleteCards && cards.length > 0) {
    const usernames = cards.map(c => c.username);
    const cardIds = cards.map(c => c.id);
    
    // BULK: Delete from radcheck
    await db.delete(radcheck)
      .where(inArray(radcheck.username, usernames));
    
    // BULK: Delete from radreply
    await db.delete(radreply)
      .where(inArray(radreply.username, usernames));
    
    // BULK: Delete from radusergroup
    await db.delete(radusergroup)
      .where(inArray(radusergroup.username, usernames));
    
    // BULK: Delete cards
    await db.delete(radiusCards)
      .where(inArray(radiusCards.id, cardIds));
  } else if (cards.length > 0) {
    // Just unlink cards from batch (set batchId to null)
    const cardIds = cards.map(c => c.id);
    await db.update(radiusCards)
      .set({ batchId: null })
      .where(inArray(radiusCards.id, cardIds));
  }
  
  // Delete batch
  await db.delete(cardBatches)
    .where(eq(cardBatches.batchId, batchId));
  
  return { 
    success: true, 
    deletedCards: deleteCards ? cards.length : 0,
    unlinkedCards: deleteCards ? 0 : cards.length
  };
}
