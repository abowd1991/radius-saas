/**
 * Production-Grade Card Generation Test
 * 
 * Requirements:
 * - Generate 5000 cards in one operation
 * - Verify 0 duplicates
 * - Verify all cards have radcheck + radreply
 * - Performance: < 15 seconds
 * - Use COUNT/GROUP BY (not loop queries)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { generateCardsV2 } from '../db/generateCardsV2';
import { getDb } from '../db';
import { plans, radiusCards, radcheck, radreply, radusergroup } from '../../drizzle/schema';
import { eq, sql } from 'drizzle-orm';

describe('Production-Grade Card Generation (5000 cards)', () => {
  let testPlanId: number;
  let testUserId: number = 1; // Assume owner user exists

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Use an existing plan or create one
    const existingPlans = await db.select().from(plans).where(eq(plans.ownerId, testUserId)).limit(1);
    
    if (existingPlans.length > 0) {
      testPlanId = existingPlans[0].id;
      console.log(`Using existing plan ID: ${testPlanId}`);
    } else {
      // Create a test plan
      await db.insert(plans).values({
        name: 'Bulk Test Plan',
        price: '10',
        resellerPrice: '8',
        downloadSpeed: 1024,
        uploadSpeed: 512,
        validityType: 'days',
        validityValue: 30,
        sessionTimeout: 3600,
        simultaneousUse: 1,
        mikrotikRateLimit: '1024k/512k',
        ownerId: testUserId,
        role: 'owner',
      } as any);
      
      // Get the created plan
      const createdPlans = await db.select().from(plans).where(eq(plans.name, 'Bulk Test Plan')).limit(1);
      testPlanId = createdPlans[0].id;
      console.log(`Created new plan ID: ${testPlanId}`);
    }
  });

  it('should generate 5000 cards successfully', async () => {
    const startTime = Date.now();

    const result = await generateCardsV2({
      planId: testPlanId,
      quantity: 5000,
      createdBy: testUserId,
      prefix: 'test_',
      passwordLength: 8,
      simultaneousUse: 1,
      subscriberGroup: 'Test Group',
      usageBudgetSeconds: 3600,
      windowSeconds: 86400,
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`\n=== Test Results ===`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Cards generated: ${result.quantity}`);
    console.log(`Batch ID: ${result.batchId}`);
    console.log(`Attempts: ${result.attempts}`);

    // Verify success
    expect(result.success).toBe(true);
    expect(result.quantity).toBe(5000);
    expect(result.cards.length).toBe(5000);

    // Verify performance (< 15 seconds)
    expect(duration).toBeLessThan(15);

    // Store batchId for next tests
    (global as any).testBatchId = result.batchId;
  }, 30000); // 30s timeout

  it('should have 0 duplicate usernames in radius_cards', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const batchId = (global as any).testBatchId;

    // COUNT/GROUP BY to find duplicates
    const duplicates = await db.execute(sql`
      SELECT username, COUNT(*) as count
      FROM radius_cards
      WHERE batchId = ${batchId}
      GROUP BY username
      HAVING COUNT(*) > 1
    `);

    const rows = Array.isArray(duplicates) ? duplicates : [];
    console.log(`\nDuplicate usernames: ${rows.length}`);
    expect(rows.length).toBe(0);
  });

  it('should have exactly 5000 cards in radius_cards', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const batchId = (global as any).testBatchId;

    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM radius_cards
      WHERE batchId = ${batchId}
    `);

    const count = Array.isArray(result) && result.length > 0 ? (result[0] as any).count : 0;
    console.log(`\nTotal cards in radius_cards: ${count}`);
    expect(count).toBe(5000);
  });

  it('should have 0 duplicate (username, attribute) in radcheck', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const batchId = (global as any).testBatchId;

    // Get all usernames from this batch
    const cards = await db.select({ username: radiusCards.username })
      .from(radiusCards)
      .where(eq(radiusCards.batchId, batchId));

    const usernames = cards.map(c => c.username);

    // Check duplicates in radcheck
    const duplicates = await db.execute(sql`
      SELECT username, attribute, COUNT(*) as count
      FROM radcheck
      WHERE username IN (${sql.join(usernames.map(u => sql`${u}`), sql`, `)})
      GROUP BY username, attribute
      HAVING COUNT(*) > 1
    `);

    const rows = Array.isArray(duplicates) ? duplicates : [];
    console.log(`\nDuplicate (username, attribute) in radcheck: ${rows.length}`);
    expect(rows.length).toBe(0);
  });

  it('should have 0 duplicate (username, attribute) in radreply', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const batchId = (global as any).testBatchId;

    // Get all usernames from this batch
    const cards = await db.select({ username: radiusCards.username })
      .from(radiusCards)
      .where(eq(radiusCards.batchId, batchId));

    const usernames = cards.map(c => c.username);

    // Check duplicates in radreply
    const duplicates = await db.execute(sql`
      SELECT username, attribute, COUNT(*) as count
      FROM radreply
      WHERE username IN (${sql.join(usernames.map(u => sql`${u}`), sql`, `)})
      GROUP BY username, attribute
      HAVING COUNT(*) > 1
    `);

    const rows = Array.isArray(duplicates) ? duplicates : [];
    console.log(`\nDuplicate (username, attribute) in radreply: ${rows.length}`);
    expect(rows.length).toBe(0);
  });

  it('should verify all cards have radcheck entries (sample 20 cards)', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const batchId = (global as any).testBatchId;

    // Get 20 random cards
    const cards = await db.select()
      .from(radiusCards)
      .where(eq(radiusCards.batchId, batchId))
      .limit(20);

    console.log(`\nVerifying radcheck for ${cards.length} sample cards...`);

    for (const card of cards) {
      const checks = await db.select()
        .from(radcheck)
        .where(eq(radcheck.username, card.username));

      expect(checks.length).toBeGreaterThan(0);
      
      // Verify required attributes
      const attributes = checks.map(c => c.attribute);
      expect(attributes).toContain('Cleartext-Password');
      expect(attributes).toContain('Simultaneous-Use');
      expect(attributes).toContain('Auth-Type');
      expect(attributes).toContain('Expiration');
    }

    console.log(`✅ All sample cards have complete radcheck entries`);
  });

  it('should verify all cards have radreply entries (sample 20 cards)', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const batchId = (global as any).testBatchId;

    // Get 20 random cards
    const cards = await db.select()
      .from(radiusCards)
      .where(eq(radiusCards.batchId, batchId))
      .limit(20);

    console.log(`\nVerifying radreply for ${cards.length} sample cards...`);

    for (const card of cards) {
      const replies = await db.select()
        .from(radreply)
        .where(eq(radreply.username, card.username));

      expect(replies.length).toBeGreaterThan(0);
      
      // Verify required attributes
      const attributes = replies.map(r => r.attribute);
      expect(attributes).toContain('Session-Timeout');
      expect(attributes).toContain('Mikrotik-Rate-Limit');
    }

    console.log(`✅ All sample cards have complete radreply entries`);
  });

  it('should verify COUNT/GROUP BY performance', async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const batchId = (global as any).testBatchId;

    const startTime = Date.now();

    // Aggregate query (fast)
    const radcheckResult = await db.execute(sql`
      SELECT COUNT(DISTINCT username) as count
      FROM radcheck
      WHERE username IN (
        SELECT username FROM radius_cards WHERE batchId = ${batchId}
      )
    `);

    const radreplyResult = await db.execute(sql`
      SELECT COUNT(DISTINCT username) as count
      FROM radreply
      WHERE username IN (
        SELECT username FROM radius_cards WHERE batchId = ${batchId}
      )
    `);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    const radcheckCount = Array.isArray(radcheckResult) && radcheckResult.length > 0 ? (radcheckResult[0] as any).count : 0;
    const radreplyCount = Array.isArray(radreplyResult) && radreplyResult.length > 0 ? (radreplyResult[0] as any).count : 0;

    console.log(`\nCOUNT/GROUP BY duration: ${duration.toFixed(3)}s`);
    console.log(`radcheck usernames: ${radcheckCount}`);
    console.log(`radreply usernames: ${radreplyCount}`);

    // Should be very fast (< 1 second)
    expect(duration).toBeLessThan(1);
  });
});
