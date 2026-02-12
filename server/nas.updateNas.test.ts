/**
 * Test: updateNas() should not update nasname if value is unchanged
 * 
 * This test verifies the fix for UNIQUE constraint error when updating NAS devices.
 * The bug was that updateNas() was always including nasname in the UPDATE query,
 * even when the value was the same, causing MySQL UNIQUE constraint violation.
 * 
 * Expected behavior:
 * - If ipAddress is provided and DIFFERENT from current nasname → update nasname
 * - If ipAddress is provided but SAME as current nasname → skip nasname update
 * - If ipAddress is not provided → skip nasname update
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as nasDb from './db/nas';
import { getDb } from './db';
import { nasDevices } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

describe('updateNas() - UNIQUE constraint fix', () => {
  let testNasId: number;
  const testOwnerId = 17; // User abowd

  beforeAll(async () => {
    // Create a test NAS device
    const result = await nasDb.createNas({
      name: 'Test NAS for Update',
      ipAddress: '192.168.30.100',
      secret: 'test-secret-123',
      connectionType: 'public_ip',
      ownerId: testOwnerId,
    });
    testNasId = result.id;
    console.log(`[Test] Created test NAS with ID: ${testNasId}`);
  });

  afterAll(async () => {
    // Clean up test NAS
    const db = await getDb();
    if (db && testNasId) {
      await db.delete(nasDevices).where(eq(nasDevices.id, testNasId));
      console.log(`[Test] Deleted test NAS with ID: ${testNasId}`);
    }
  });

  it('should NOT throw UNIQUE constraint error when updating with same IP', async () => {
    // Get current NAS
    const beforeUpdate = await nasDb.getNasById(testNasId);
    expect(beforeUpdate).toBeTruthy();
    expect(beforeUpdate!.nasname).toBe('192.168.30.100');

    // Update with SAME IP (this should NOT cause UNIQUE constraint error)
    await expect(
      nasDb.updateNas(testNasId, {
        ipAddress: '192.168.30.100', // Same as current
        description: 'Updated description',
      })
    ).resolves.toMatchObject({ success: true });

    // Verify NAS was updated (description changed, IP unchanged)
    const afterUpdate = await nasDb.getNasById(testNasId);
    expect(afterUpdate!.nasname).toBe('192.168.30.100'); // IP unchanged
    expect(afterUpdate!.description).toBe('Updated description'); // Description updated
  });

  it('should update nasname when IP is DIFFERENT', async () => {
    // Update with DIFFERENT IP
    await nasDb.updateNas(testNasId, {
      ipAddress: '192.168.30.101', // Different from current
    });

    // Verify IP was updated
    const afterUpdate = await nasDb.getNasById(testNasId);
    expect(afterUpdate!.nasname).toBe('192.168.30.101');
  });

  it('should NOT update nasname when ipAddress is not provided', async () => {
    // Get current IP
    const before = await nasDb.getNasById(testNasId);
    const currentIp = before!.nasname;

    // Update other fields without providing ipAddress
    await nasDb.updateNas(testNasId, {
      name: 'Updated Name',
      description: 'Updated description 2',
    });

    // Verify IP was NOT changed
    const after = await nasDb.getNasById(testNasId);
    expect(after!.nasname).toBe(currentIp); // IP unchanged
    expect(after!.shortname).toBe('Updated Name'); // Name updated
  });

  it('should handle multiple updates with same IP without errors', async () => {
    // Perform 5 consecutive updates with same IP
    for (let i = 0; i < 5; i++) {
      await expect(
        nasDb.updateNas(testNasId, {
          ipAddress: '192.168.30.101', // Same IP every time
          description: `Update iteration ${i}`,
        })
      ).resolves.toMatchObject({ success: true });
    }

    // Verify final state
    const final = await nasDb.getNasById(testNasId);
    expect(final!.nasname).toBe('192.168.30.101');
    expect(final!.description).toBe('Update iteration 4');
  });
});
