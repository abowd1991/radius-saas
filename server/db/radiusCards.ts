import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { radiusCards, cardBatches, plans, radcheck, radreply, radusergroup } from "../../drizzle/schema";
import { nanoid } from "nanoid";

// Generate random username with configurable length and prefix
function generateUsername(length: number = 6, prefix: string = ''): string {
  const chars = '0123456789';
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate random password with configurable length
function generatePassword(length: number = 4): string {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate serial number (12 digits)
function generateSerialNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return timestamp + random;
}

// Card creation options interface
interface CardCreationOptions {
  planId: number;
  createdBy: number;
  resellerId?: number;
  batchId?: string;
  purchasePrice?: number;
  salePrice?: number;
  notes?: string;
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
  // New Time Budget System
  usageBudgetSeconds?: number; // Total usage time allowed (deducted while connected)
  windowSeconds?: number; // Validity window duration from first use
}

// Create RADIUS card and insert into FreeRADIUS tables
export async function createRadiusCard(data: CardCreationOptions) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get plan details
  const [plan] = await db.select().from(plans).where(eq(plans.id, data.planId)).limit(1);
  if (!plan) throw new Error("Plan not found");

  const usernameLength = data.usernameLength || 6;
  const passwordLength = data.passwordLength || 4;
  const prefix = data.prefix || '';
  
  const username = generateUsername(usernameLength, prefix);
  const password = generatePassword(passwordLength);
  const serialNumber = generateSerialNumber();

  // Calculate session timeout based on card time settings
  let sessionTimeout: number | null = null;
  if (data.cardTimeValue && data.cardTimeValue > 0) {
    if (data.cardTimeUnit === 'days') {
      sessionTimeout = data.cardTimeValue * 24 * 60 * 60; // days to seconds
    } else {
      sessionTimeout = data.cardTimeValue * 60 * 60; // hours to seconds
    }
  }

  // Calculate usageBudgetSeconds and windowSeconds if not provided
  let usageBudgetSeconds = data.usageBudgetSeconds || 0;
  let windowSeconds = data.windowSeconds || 0;
  
  // Fall back to legacy fields if new fields not provided
  if (usageBudgetSeconds === 0 && data.internetTimeValue && data.internetTimeValue > 0) {
    if (data.internetTimeUnit === 'days') {
      usageBudgetSeconds = data.internetTimeValue * 86400;
    } else {
      usageBudgetSeconds = data.internetTimeValue * 3600;
    }
  }
  
  if (windowSeconds === 0 && data.cardTimeValue && data.cardTimeValue > 0) {
    if (data.cardTimeUnit === 'days') {
      windowSeconds = data.cardTimeValue * 86400;
    } else {
      windowSeconds = data.cardTimeValue * 3600;
    }
  }

  // Insert into radius_cards table
  const [result] = await db.insert(radiusCards).values({
    username,
    password,
    serialNumber,
    batchId: data.batchId || null,
    planId: data.planId,
    createdBy: data.createdBy,
    resellerId: data.resellerId || null,
    purchasePrice: data.purchasePrice?.toString() || null,
    salePrice: data.salePrice?.toString() || null,
    notes: data.notes || null,
    status: 'unused',
    // New fields
    simultaneousUse: data.simultaneousUse || 1,
    hotspotPort: data.hotspotPort || null,
    timeFromActivation: data.timeFromActivation !== false,
    internetTimeValue: data.internetTimeValue || 0,
    internetTimeUnit: data.internetTimeUnit || 'hours',
    cardTimeValue: data.cardTimeValue || 0,
    cardTimeUnit: data.cardTimeUnit || 'hours',
    macBinding: data.macBinding || false,
    prefix: prefix || null,
    usernameLength,
    passwordLength,
    subscriberGroup: data.subscriberGroup || 'Default group',
    // New Time Budget System
    usageBudgetSeconds,
    windowSeconds,
  } as any);

  const cardId = result.insertId;

  // Insert into radcheck table (Cleartext-Password)
  await db.insert(radcheck).values({
    username,
    attribute: 'Cleartext-Password',
    op: ':=',
    value: password,
  });

  // Insert Expiration attribute based on timeFromActivation setting
  if (data.timeFromActivation === false) {
    // Calculate expiration from now (card creation)
    let expiresAt: Date;
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
    
    const expirationStr = formatExpirationDate(expiresAt);
    await db.insert(radcheck).values({
      username,
      attribute: 'Expiration',
      op: ':=',
      value: expirationStr,
    });
  } else {
    // Set far future expiration (will be updated on first login)
    await db.insert(radcheck).values({
      username,
      attribute: 'Expiration',
      op: ':=',
      value: 'Jan 01 2099 00:00:00',
    });
  }

  // Insert Auth-Type attribute
  await db.insert(radcheck).values({
    username,
    attribute: 'Auth-Type',
    op: ':=',
    value: 'Accept',
  });

  // Insert Simultaneous-Use in radcheck (this is a check attribute)
  const simultaneousUse = data.simultaneousUse || plan.simultaneousUse || 1;
  await db.insert(radcheck).values({
    username,
    attribute: 'Simultaneous-Use',
    op: ':=',
    value: simultaneousUse.toString(),
  });

  // Insert into radreply table based on plan settings
  const radreplyValues = [];

  // Session-Timeout (in seconds) - from usageBudgetSeconds, card settings, or plan
  // Priority: usageBudgetSeconds > sessionTimeout > plan.sessionTimeout
  let finalSessionTimeout = 0;
  if (usageBudgetSeconds && usageBudgetSeconds > 0) {
    finalSessionTimeout = usageBudgetSeconds;
  } else if (sessionTimeout && sessionTimeout > 0) {
    finalSessionTimeout = sessionTimeout;
  } else if (plan.sessionTimeout && plan.sessionTimeout > 0) {
    finalSessionTimeout = plan.sessionTimeout;
  }
  
  if (finalSessionTimeout > 0) {
    radreplyValues.push({
      username,
      attribute: 'Session-Timeout',
      op: '=',
      value: finalSessionTimeout.toString(),
    });
  }

  // Idle-Timeout
  if (plan.idleTimeout && plan.idleTimeout > 0) {
    radreplyValues.push({
      username,
      attribute: 'Idle-Timeout',
      op: '=',
      value: plan.idleTimeout.toString(),
    });
  }

  // MikroTik Rate-Limit (download/upload)
  if (plan.mikrotikRateLimit) {
    radreplyValues.push({
      username,
      attribute: 'Mikrotik-Rate-Limit',
      op: '=',
      value: plan.mikrotikRateLimit,
    });
  } else if (plan.downloadSpeed || plan.uploadSpeed) {
    const download = plan.downloadSpeed ? `${plan.downloadSpeed}k` : '0';
    const upload = plan.uploadSpeed ? `${plan.uploadSpeed}k` : '0';
    radreplyValues.push({
      username,
      attribute: 'Mikrotik-Rate-Limit',
      op: '=',
      value: `${upload}/${download}`,
    });
  }

  // Framed-Pool (IP Pool)
  if (plan.mikrotikAddressPool) {
    radreplyValues.push({
      username,
      attribute: 'Framed-Pool',
      op: '=',
      value: plan.mikrotikAddressPool,
    });
  }

  // Hotspot port restriction (Called-Station-Id)
  if (data.hotspotPort) {
    radreplyValues.push({
      username,
      attribute: 'Called-Station-Id',
      op: '==',
      value: data.hotspotPort,
    });
  }

  // Note: Max-All-Session was removed because it's not a standard FreeRADIUS attribute
  // Internet time limits should be handled via Session-Timeout or external accounting

  // Insert all radreply values
  if (radreplyValues.length > 0) {
    await db.insert(radreply).values(radreplyValues);
  }

  // Insert into radusergroup (link user to subscriber group)
  const groupName = data.subscriberGroup || 'Default group';
  await db.insert(radusergroup).values({
    username,
    groupname: groupName,
    priority: 1,
  });

  return {
    id: cardId,
    username,
    password,
    serialNumber,
    planId: data.planId,
    planName: plan.name,
    simultaneousUse,
  };
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

// Batch creation options interface
interface BatchCreationOptions {
  name: string;
  planId: number;
  quantity: number;
  createdBy: number;
  resellerId?: number;
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
}

// Create batch of RADIUS cards
export async function createCardBatch(data: BatchCreationOptions) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const batchId = `BATCH-${Date.now()}-${nanoid(6)}`;

  // Create batch record with all new fields
  await db.insert(cardBatches).values({
    batchId,
    name: data.name,
    planId: data.planId,
    createdBy: data.createdBy,
    resellerId: data.resellerId || null,
    quantity: data.quantity,
    status: 'generating',
    // New fields
    simultaneousUse: data.simultaneousUse || 1,
    hotspotPort: data.hotspotPort || null,
    timeFromActivation: data.timeFromActivation !== false,
    internetTimeValue: data.internetTimeValue || 0,
    internetTimeUnit: data.internetTimeUnit || 'hours',
    cardTimeValue: data.cardTimeValue || 0,
    cardTimeUnit: data.cardTimeUnit || 'hours',
    macBinding: data.macBinding || false,
    prefix: data.prefix || null,
    usernameLength: data.usernameLength || 6,
    passwordLength: data.passwordLength || 4,
    subscriberGroup: data.subscriberGroup || 'Default group',
    cardPrice: data.cardPrice?.toString() || '0',
    // New Time Budget System
    usageBudgetSeconds: data.usageBudgetSeconds || 0,
    windowSeconds: data.windowSeconds || 0,
  } as any);

  // Create cards
  const cards = [];
  for (let i = 0; i < data.quantity; i++) {
    try {
      const card = await createRadiusCard({
        planId: data.planId,
        createdBy: data.createdBy,
        resellerId: data.resellerId,
        batchId,
        purchasePrice: data.purchasePrice,
        salePrice: data.salePrice || data.cardPrice,
        // Pass all new fields
        simultaneousUse: data.simultaneousUse,
        hotspotPort: data.hotspotPort,
        timeFromActivation: data.timeFromActivation,
        internetTimeValue: data.internetTimeValue,
        internetTimeUnit: data.internetTimeUnit,
        cardTimeValue: data.cardTimeValue,
        cardTimeUnit: data.cardTimeUnit,
        macBinding: data.macBinding,
        prefix: data.prefix,
        usernameLength: data.usernameLength,
        passwordLength: data.passwordLength,
        subscriberGroup: data.subscriberGroup,
        // New Time Budget System
        usageBudgetSeconds: data.usageBudgetSeconds,
        windowSeconds: data.windowSeconds,
      });
      cards.push(card);
    } catch (error) {
      console.error(`Error creating card ${i + 1}:`, error);
    }
  }

  // Update batch status
  await db.update(cardBatches)
    .set({ status: 'completed' })
    .where(eq(cardBatches.batchId, batchId));

  return {
    batchId,
    name: data.name,
    quantity: cards.length,
    cards,
  };
}

// Activate a RADIUS card (on first login)
export async function activateRadiusCard(cardId: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get card details
  const [card] = await db.select().from(radiusCards).where(eq(radiusCards.id, cardId)).limit(1);
  if (!card) throw new Error("Card not found");
  if (card.status !== 'unused') throw new Error("Card already used or expired");

  // Get plan details
  const [plan] = await db.select().from(plans).where(eq(plans.id, card.planId)).limit(1);
  if (!plan) throw new Error("Plan not found");

  const now = new Date();
  let expiresAt: Date;

  // Check if card has custom time settings
  const cardTimeValue = (card as any).cardTimeValue;
  const cardTimeUnit = (card as any).cardTimeUnit;
  const timeFromActivation = (card as any).timeFromActivation;

  // Only update expiration if timeFromActivation is true
  if (timeFromActivation !== false) {
    if (cardTimeValue && cardTimeValue > 0) {
      if (cardTimeUnit === 'days') {
        expiresAt = new Date(now.getTime() + cardTimeValue * 24 * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(now.getTime() + cardTimeValue * 60 * 60 * 1000);
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

    // Update radcheck Expiration attribute
    const expirationStr = formatExpirationDate(expiresAt);
    await db.update(radcheck)
      .set({ value: expirationStr })
      .where(and(
        eq(radcheck.username, card.username),
        eq(radcheck.attribute, 'Expiration')
      ));
  } else {
    // Get existing expiration
    const [expRecord] = await db.select().from(radcheck)
      .where(and(
        eq(radcheck.username, card.username),
        eq(radcheck.attribute, 'Expiration')
      )).limit(1);
    expiresAt = expRecord ? new Date(expRecord.value) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  // Update card status
  await db.update(radiusCards)
    .set({
      status: 'active',
      activatedAt: now,
      firstLoginAt: now,
      expiresAt,
      usedBy: userId || null,
    })
    .where(eq(radiusCards.id, cardId));

  return {
    id: cardId,
    username: card.username,
    status: 'active',
    activatedAt: now,
    expiresAt,
  };
}

// Suspend a RADIUS card
export async function suspendRadiusCard(cardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [card] = await db.select().from(radiusCards).where(eq(radiusCards.id, cardId)).limit(1);
  if (!card) throw new Error("Card not found");

  // Update card status
  await db.update(radiusCards)
    .set({ status: 'suspended' })
    .where(eq(radiusCards.id, cardId));

  // Update radcheck to reject authentication
  await db.update(radcheck)
    .set({ value: 'Reject' })
    .where(and(
      eq(radcheck.username, card.username),
      eq(radcheck.attribute, 'Auth-Type')
    ));

  return { id: cardId, status: 'suspended' };
}

// Reactivate a suspended RADIUS card
export async function reactivateRadiusCard(cardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [card] = await db.select().from(radiusCards).where(eq(radiusCards.id, cardId)).limit(1);
  if (!card) throw new Error("Card not found");
  if (card.status !== 'suspended') throw new Error("Card is not suspended");

  // Update card status
  await db.update(radiusCards)
    .set({ status: 'active' })
    .where(eq(radiusCards.id, cardId));

  // Update radcheck to accept authentication
  await db.update(radcheck)
    .set({ value: 'Accept' })
    .where(and(
      eq(radcheck.username, card.username),
      eq(radcheck.attribute, 'Auth-Type')
    ));

  return { id: cardId, status: 'active' };
}

// Delete a RADIUS card (and related FreeRADIUS entries)
export async function deleteRadiusCard(cardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [card] = await db.select().from(radiusCards).where(eq(radiusCards.id, cardId)).limit(1);
  if (!card) throw new Error("Card not found");

  // Delete from radcheck
  await db.delete(radcheck).where(eq(radcheck.username, card.username));

  // Delete from radreply
  await db.delete(radreply).where(eq(radreply.username, card.username));

  // Delete from radusergroup
  await db.delete(radusergroup).where(eq(radusergroup.username, card.username));

  // Delete from radius_cards
  await db.delete(radiusCards).where(eq(radiusCards.id, cardId));

  return { id: cardId, deleted: true };
}

// Get cards by batch
export async function getCardsByBatch(batchId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(radiusCards)
    .where(eq(radiusCards.batchId, batchId))
    .orderBy(desc(radiusCards.createdAt));
}

// Get card by username
export async function getCardByUsername(username: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [card] = await db.select().from(radiusCards)
    .where(eq(radiusCards.username, username))
    .limit(1);
  
  return card;
}

// List all cards with filters
export async function listCards(filters?: {
  status?: string;
  planId?: number;
  resellerId?: number;
  createdBy?: number;
  batchId?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db.select({
    card: radiusCards,
    plan: plans,
  })
    .from(radiusCards)
    .leftJoin(plans, eq(radiusCards.planId, plans.id))
    .orderBy(desc(radiusCards.createdAt));

  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(radiusCards.status, filters.status as any));
  }
  if (filters?.planId) {
    conditions.push(eq(radiusCards.planId, filters.planId));
  }
  if (filters?.resellerId) {
    conditions.push(eq(radiusCards.resellerId, filters.resellerId));
  }
  if (filters?.createdBy) {
    conditions.push(eq(radiusCards.createdBy, filters.createdBy));
  }
  if (filters?.batchId) {
    conditions.push(eq(radiusCards.batchId, filters.batchId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }

  return await query;
}

// List all batches
export async function listBatches(filters?: {
  resellerId?: number;
  createdBy?: number;
  status?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db.select({
    batch: cardBatches,
    plan: plans,
  })
    .from(cardBatches)
    .leftJoin(plans, eq(cardBatches.planId, plans.id))
    .orderBy(desc(cardBatches.createdAt));

  const conditions = [];
  
  if (filters?.resellerId) {
    conditions.push(eq(cardBatches.resellerId, filters.resellerId));
  }
  if (filters?.createdBy) {
    conditions.push(eq(cardBatches.createdBy, filters.createdBy));
  }
  if (filters?.status) {
    conditions.push(eq(cardBatches.status, filters.status as any));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }

  return await query;
}

// Get batch by ID
export async function getBatchById(batchId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [batch] = await db.select({
    batch: cardBatches,
    plan: plans,
  })
    .from(cardBatches)
    .leftJoin(plans, eq(cardBatches.planId, plans.id))
    .where(eq(cardBatches.batchId, batchId))
    .limit(1);

  return batch;
}

// Get subscriber groups
export async function getSubscriberGroups() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const groups = await db.selectDistinct({ groupname: radusergroup.groupname })
    .from(radusergroup);

  return groups.map(g => g.groupname);
}
