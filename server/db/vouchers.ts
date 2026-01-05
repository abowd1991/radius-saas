import { eq, desc, and } from "drizzle-orm";
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

export async function getCardsByReseller(resellerId: number, options?: { status?: string; batchId?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let conditions = [eq(radiusCards.resellerId, resellerId)];
  
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
    
    if (data.internetTimeValue && data.internetTimeValue > 0) {
      let maxAllSession: number;
      if (data.internetTimeUnit === 'days') {
        maxAllSession = data.internetTimeValue * 24 * 60 * 60;
      } else {
        maxAllSession = data.internetTimeValue * 60 * 60;
      }
      allRadreplyValues.push({
        username,
        attribute: "Max-All-Session",
        op: ":=",
        value: String(maxAllSession),
      });
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
