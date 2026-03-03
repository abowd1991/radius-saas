/**
 * Production-Grade Card Generation System (v4 - Zero Collision Guarantee)
 *
 * Algorithm: Set-Based Unique Generation per Owner
 * ─────────────────────────────────────────────────
 * 1. Fetch existing usernames for this owner from DB (one query)
 * 2. Build a candidate pool using Fisher-Yates partial shuffle
 * 3. Exclude already-used usernames → guaranteed zero collision
 * 4. Bulk insert in batches of 500 (handles 5000 cards in ~10s)
 *
 * Capacity per digit length:
 *   5 digits → 90,000 unique codes (10000–99999)
 *   6 digits → 900,000 unique codes
 *   7 digits → 9,000,000 unique codes
 *   8 digits → 90,000,000 unique codes
 *
 * Smart Namespace Isolation:
 *   - Uniqueness is enforced per owner (createdBy), not globally
 *   - Two clients CAN have the same code (different NAS → different owner)
 *   - DB constraint: UNIQUE KEY uniq_cards_owner_username (createdBy, username)
 */

import { getDb } from '../db';
import { plans, cardBatches, radiusCards } from '../../drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sql } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateCardsInput {
  planId: number;
  quantity: number;
  createdBy: number;
  resellerId?: number;
  batchName?: string;
  purchasePrice?: number;
  salePrice?: number;
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
  usageBudgetSeconds?: number;
  windowSeconds?: number;
}

interface GeneratedCard {
  serialNumber: string;
  username: string;
  password: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BULK_INSERT_BATCH_SIZE = 500; // 500 rows per INSERT → optimal for TiDB
const MAX_CARDS_PER_BATCH = 5000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a numeric-only password
 */
function generatePassword(length: number = 4): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

/**
 * Generate a unique serial number
 */
function generateSerialNumber(): string {
  return nanoid(12);
}

/**
 * Generate a pool of unique numeric usernames for a given owner.
 *
 * Strategy:
 * - Build the full range [min, max] for the given digit length
 * - Apply optional prefix filter
 * - Exclude already-used codes (fetched from DB)
 * - Partial Fisher-Yates shuffle to pick `quantity` codes randomly
 *
 * @param quantity     Number of unique codes needed
 * @param length       Total digit length (5–8)
 * @param prefix       Optional leading digit(s) e.g. "5" → codes start with 5
 * @param usedSet      Set of usernames already used by this owner
 */
function generateUniqueUsernames(
  quantity: number,
  length: number,
  prefix: string,
  usedSet: Set<string>
): string[] {
  // Build numeric range based on length
  const min = Math.pow(10, length - 1);  // e.g. 10000 for length=5
  const max = Math.pow(10, length) - 1;  // e.g. 99999 for length=5

  // Filter by prefix if provided
  let candidates: number[] = [];

  if (prefix) {
    // Only include numbers that start with the given prefix
    const prefixNum = parseInt(prefix, 10);
    const prefixLen = prefix.length;
    const remainingLen = length - prefixLen;
    if (remainingLen <= 0) {
      throw new Error(`Prefix "${prefix}" is too long for username length ${length}`);
    }
    const rangeMin = prefixNum * Math.pow(10, remainingLen);
    const rangeMax = (prefixNum + 1) * Math.pow(10, remainingLen) - 1;

    // Build candidates array (only numbers in prefix range, excluding used)
    for (let n = rangeMin; n <= rangeMax; n++) {
      const code = n.toString().padStart(length, '0');
      if (!usedSet.has(code)) {
        candidates.push(n);
      }
    }
  } else {
    // All numbers in range, excluding used
    for (let n = min; n <= max; n++) {
      const code = n.toString();
      if (!usedSet.has(code)) {
        candidates.push(n);
      }
    }
  }

  // Check capacity
  if (candidates.length < quantity) {
    throw new Error(
      `Not enough unique codes available. ` +
      `Requested: ${quantity}, Available: ${candidates.length}. ` +
      `Consider increasing username length or changing prefix.`
    );
  }

  // Partial Fisher-Yates shuffle: pick `quantity` random elements
  // Only shuffle the first `quantity` positions → O(quantity) not O(total)
  for (let i = 0; i < quantity; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i));
    // Swap
    const temp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = temp;
  }

  // Return first `quantity` as zero-padded strings
  return candidates.slice(0, quantity).map(n => n.toString().padStart(length, '0'));
}

/**
 * Bulk insert with configurable batch size
 */
async function bulkInsert(tx: any, table: any, values: any[], batchSize: number = BULK_INSERT_BATCH_SIZE) {
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    await tx.insert(table).values(batch);
  }
}

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Generate cards with Production-Grade Zero-Collision guarantee
 *
 * Flow:
 * 1. Validate inputs
 * 2. Fetch plan details
 * 3. Fetch existing usernames for this owner (one DB query)
 * 4. Generate unique usernames using partial Fisher-Yates
 * 5. Build card rows in memory
 * 6. Bulk insert in transaction (500 rows per batch)
 */
export async function generateCardsV2(data: GenerateCardsInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ── Validate quantity ──
  if (data.quantity < 1) throw new Error("Quantity must be at least 1");
  if (data.quantity > MAX_CARDS_PER_BATCH) {
    throw new Error(`Maximum ${MAX_CARDS_PER_BATCH} cards per batch`);
  }

  // ── Get plan details ──
  const planResult = await db.select().from(plans).where(eq(plans.id, data.planId)).limit(1);
  const plan = planResult[0];
  if (!plan) throw new Error("Plan not found");

  // ── Configuration ──
  const batchId = nanoid(10);
  const passwordLength = Math.max(2, Math.min(6, data.passwordLength || 4));
  const usernameLength = Math.max(5, Math.min(8, data.usernameLength || 5));
  const prefix = (data.prefix || '').trim();
  const simultaneousUse = data.simultaneousUse || 1;
  const subscriberGroup = data.subscriberGroup || 'Default group';
  const timeFromActivation = data.timeFromActivation !== false;

  // ── Calculate expiration ──
  let expiresAt: Date | null = null;
  if (!timeFromActivation) {
    const now = new Date();
    if (data.cardTimeValue && data.cardTimeValue > 0) {
      const ms = data.cardTimeUnit === 'days'
        ? data.cardTimeValue * 86400000
        : data.cardTimeValue * 3600000;
      expiresAt = new Date(now.getTime() + ms);
    } else if (plan.validityValue) {
      const ms = plan.validityType === 'days'
        ? plan.validityValue * 86400000
        : plan.validityType === 'hours'
          ? plan.validityValue * 3600000
          : plan.validityValue * 60000;
      expiresAt = new Date(now.getTime() + ms);
    } else {
      expiresAt = new Date(now.getTime() + 30 * 86400000);
    }
  }

  // ── Step 1: Fetch existing usernames for this owner (one query) ──
  const existingRows = await db
    .select({ username: radiusCards.username })
    .from(radiusCards)
    .where(eq(radiusCards.createdBy, data.createdBy));

  const usedSet = new Set<string>(existingRows.map((r: { username: string }) => r.username));

  // ── Step 2: Generate unique usernames (zero collision) ──
  let usernames: string[];
  try {
    usernames = generateUniqueUsernames(data.quantity, usernameLength, prefix, usedSet);
  } catch (err: any) {
    throw new Error(`Username generation failed: ${err.message}`);
  }

  // ── Step 3: Build card rows in memory ──
  const generatedCards: GeneratedCard[] = [];
  const allCardValues: any[] = [];

  for (const username of usernames) {
    const password = generatePassword(passwordLength);
    const serialNumber = generateSerialNumber();

    allCardValues.push({
      username,
      password,
      serialNumber,
      batchId,
      planId: data.planId,
      createdBy: data.createdBy,
      resellerId: data.resellerId ?? null,
      status: "unused",
      expiresAt,
      purchasePrice: data.purchasePrice != null ? String(data.purchasePrice) : plan.resellerPrice,
      salePrice: (data.salePrice ?? data.cardPrice) != null
        ? String(data.salePrice ?? data.cardPrice)
        : plan.price,
      usageBudgetSeconds: data.usageBudgetSeconds || 0,
      windowSeconds: data.windowSeconds || 0,
    });

    generatedCards.push({ serialNumber, username, password });
  }

  // ── Step 4: Single Transaction - All-or-Nothing ──
  await db.transaction(async (tx: any) => {
    // 4a. Create batch record
    await tx.insert(cardBatches).values({
      batchId,
      name: data.batchName || `Batch ${batchId}`,
      planId: data.planId,
      createdBy: data.createdBy,
      resellerId: data.resellerId ?? null,
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
      cardPrice: data.cardPrice != null ? String(data.cardPrice) : '0',
      usageBudgetSeconds: data.usageBudgetSeconds || 0,
      windowSeconds: data.windowSeconds || 0,
    } as any);

    // 4b. Bulk insert radius_cards (500 rows per batch)
    await bulkInsert(tx, radiusCards, allCardValues);

    // 4c. Update batch status to completed
    await tx.update(cardBatches)
      .set({ status: "completed" })
      .where(eq(cardBatches.batchId, batchId));
  });

  return {
    success: true,
    batchId,
    cards: generatedCards,
    quantity: data.quantity,
    planName: plan.name,
    usernameLength,
    passwordLength,
  };
}
