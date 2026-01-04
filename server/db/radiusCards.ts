import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { radiusCards, cardBatches, plans, radcheck, radreply, radusergroup } from "../../drizzle/schema";
import { nanoid } from "nanoid";

// Generate random username (8 characters)
function generateUsername(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate random password (8 characters)
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
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

// Create RADIUS card and insert into FreeRADIUS tables
export async function createRadiusCard(data: {
  planId: number;
  createdBy: number;
  resellerId?: number;
  batchId?: string;
  purchasePrice?: number;
  salePrice?: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get plan details
  const [plan] = await db.select().from(plans).where(eq(plans.id, data.planId)).limit(1);
  if (!plan) throw new Error("Plan not found");

  const username = generateUsername();
  const password = generatePassword();
  const serialNumber = generateSerialNumber();

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
  });

  const cardId = result.insertId;

  // Insert into radcheck table (Cleartext-Password)
  await db.insert(radcheck).values({
    username,
    attribute: 'Cleartext-Password',
    op: ':=',
    value: password,
  });

  // Insert Expiration attribute (card not activated yet, set far future)
  await db.insert(radcheck).values({
    username,
    attribute: 'Expiration',
    op: ':=',
    value: 'Jan 01 2099 00:00:00',
  });

  // Insert Auth-Type attribute
  await db.insert(radcheck).values({
    username,
    attribute: 'Auth-Type',
    op: ':=',
    value: 'Accept',
  });

  // Insert into radreply table based on plan settings
  const radreplyValues = [];

  // Session-Timeout (in seconds)
  if (plan.sessionTimeout && plan.sessionTimeout > 0) {
    radreplyValues.push({
      username,
      attribute: 'Session-Timeout',
      op: '=',
      value: plan.sessionTimeout.toString(),
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
  if (plan.downloadSpeed || plan.uploadSpeed) {
    const rateLimit = `${plan.uploadSpeed || 0}M/${plan.downloadSpeed || 0}M`;
    radreplyValues.push({
      username,
      attribute: 'Mikrotik-Rate-Limit',
      op: '=',
      value: rateLimit,
    });
  }

  // Simultaneous-Use (max connections)
  if (plan.simultaneousUse && plan.simultaneousUse > 0) {
    radreplyValues.push({
      username,
      attribute: 'Simultaneous-Use',
      op: ':=',
      value: plan.simultaneousUse.toString(),
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

  // Insert all radreply values
  if (radreplyValues.length > 0) {
    await db.insert(radreply).values(radreplyValues);
  }

  // Insert into radusergroup (link user to plan group)
  await db.insert(radusergroup).values({
    username,
    groupname: `plan_${plan.id}`,
    priority: 1,
  });

  return {
    id: cardId,
    username,
    password,
    serialNumber,
    planId: data.planId,
    planName: plan.name,
  };
}

// Create batch of RADIUS cards
export async function createCardBatch(data: {
  name: string;
  planId: number;
  quantity: number;
  createdBy: number;
  resellerId?: number;
  purchasePrice?: number;
  salePrice?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const batchId = `BATCH-${Date.now()}-${nanoid(6)}`;

  // Create batch record
  await db.insert(cardBatches).values({
    batchId,
    name: data.name,
    planId: data.planId,
    createdBy: data.createdBy,
    resellerId: data.resellerId || null,
    quantity: data.quantity,
    status: 'generating',
  });

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
        salePrice: data.salePrice,
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

// Activate a RADIUS card
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

  // Calculate expiration based on plan validity
  if (plan.validityType === 'days' && plan.validityValue) {
    expiresAt = new Date(now.getTime() + plan.validityValue * 24 * 60 * 60 * 1000);
  } else if (plan.validityType === 'hours' && plan.validityValue) {
    expiresAt = new Date(now.getTime() + plan.validityValue * 60 * 60 * 1000);
  } else if (plan.validityType === 'minutes' && plan.validityValue) {
    expiresAt = new Date(now.getTime() + plan.validityValue * 60 * 1000);
  } else {
    // Default 30 days
    expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  // Update card status
  await db.update(radiusCards)
    .set({
      status: 'active',
      activatedAt: now,
      expiresAt,
      usedBy: userId || null,
    })
    .where(eq(radiusCards.id, cardId));

  // Update radcheck Expiration attribute
  const expirationStr = expiresAt.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');

  await db.update(radcheck)
    .set({ value: expirationStr })
    .where(and(
      eq(radcheck.username, card.username),
      eq(radcheck.attribute, 'Expiration')
    ));

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

// Get card by serial number
export async function getCardBySerial(serialNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [card] = await db.select().from(radiusCards)
    .where(eq(radiusCards.serialNumber, serialNumber))
    .limit(1);

  return card;
}

// List all cards with pagination and filters
export async function listRadiusCards(options: {
  page?: number;
  limit?: number;
  status?: string;
  planId?: number;
  resellerId?: number;
  batchId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  let query = db.select().from(radiusCards);
  const conditions = [];

  if (options.status) {
    conditions.push(eq(radiusCards.status, options.status as any));
  }
  if (options.planId) {
    conditions.push(eq(radiusCards.planId, options.planId));
  }
  if (options.resellerId) {
    conditions.push(eq(radiusCards.resellerId, options.resellerId));
  }
  if (options.batchId) {
    conditions.push(eq(radiusCards.batchId, options.batchId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const cards = await query
    .orderBy(desc(radiusCards.createdAt))
    .limit(limit)
    .offset(offset);

  return cards;
}

// List all batches
export async function listCardBatches(options: {
  page?: number;
  limit?: number;
  resellerId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  let query = db.select().from(cardBatches);

  if (options.resellerId) {
    query = query.where(eq(cardBatches.resellerId, options.resellerId)) as any;
  }

  return await query
    .orderBy(desc(cardBatches.createdAt))
    .limit(limit)
    .offset(offset);
}

// Recharge card (extend validity)
export async function rechargeCard(cardId: number, additionalDays: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [card] = await db.select().from(radiusCards).where(eq(radiusCards.id, cardId)).limit(1);
  if (!card) throw new Error("Card not found");

  const currentExpiry = card.expiresAt || new Date();
  const newExpiry = new Date(currentExpiry.getTime() + additionalDays * 24 * 60 * 60 * 1000);

  // Update card
  await db.update(radiusCards)
    .set({
      expiresAt: newExpiry,
      status: 'active',
    })
    .where(eq(radiusCards.id, cardId));

  // Update radcheck Expiration
  const expirationStr = newExpiry.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');

  await db.update(radcheck)
    .set({ value: expirationStr })
    .where(and(
      eq(radcheck.username, card.username),
      eq(radcheck.attribute, 'Expiration')
    ));

  // Update Auth-Type to Accept
  await db.update(radcheck)
    .set({ value: 'Accept' })
    .where(and(
      eq(radcheck.username, card.username),
      eq(radcheck.attribute, 'Auth-Type')
    ));

  return {
    id: cardId,
    newExpiresAt: newExpiry,
  };
}
