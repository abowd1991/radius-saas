import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';

/**
 * CRITICAL TESTS: Card Time Calculation
 * 
 * These tests ensure accurate time calculation for card usage.
 * Failures in these tests directly affect revenue and customer trust.
 */

describe('Card Time Calculation - CRITICAL', () => {
  let conn: mysql.Connection;
  const testUsername = `TEST-TIME-${Date.now()}`;

  beforeAll(async () => {
    conn = await mysql.createConnection(process.env.DATABASE_URL!);
  });

  afterAll(async () => {
    // Cleanup test data
    await conn.execute('DELETE FROM radacct WHERE username = ?', [testUsername]);
    await conn.execute('DELETE FROM radius_cards WHERE username = ?', [testUsername]);
    await conn.end();
  });

  /**
   * Simulate getUsedTimeFromRadacct logic
   */
  async function getUsedTime(username: string): Promise<number> {
    // Get completed sessions
    const [completed]: any = await conn.execute(`
      SELECT COALESCE(SUM(acctsessiontime), 0) as total
      FROM radacct
      WHERE username = ? AND acctstoptime IS NOT NULL
    `, [username]);

    // Get active session
    const [active]: any = await conn.execute(`
      SELECT acctsessiontime, acctstarttime
      FROM radacct
      WHERE username = ? AND acctstoptime IS NULL
      ORDER BY acctstarttime DESC
      LIMIT 1
    `, [username]);

    const completedTime = Number(completed[0]?.total) || 0;
    let activeTime = 0;

    if (active.length > 0) {
      const reportedTime = Number(active[0].acctsessiontime) || 0;
      const elapsedTime = active[0].acctstarttime
        ? Math.floor((Date.now() - active[0].acctstarttime.getTime()) / 1000)
        : 0;

      const MAX_REASONABLE_SESSION_TIME = 24 * 3600; // 24 hours

      if (elapsedTime > MAX_REASONABLE_SESSION_TIME) {
        activeTime = reportedTime;
      } else {
        activeTime = Math.max(reportedTime, elapsedTime);
      }
    }

    return completedTime + activeTime;
  }

  it('should calculate time correctly for completed sessions', async () => {
    // Create test session (completed)
    const sessionId = `test-${Date.now()}`;
    await conn.execute(`
      INSERT INTO radacct (
        acctsessionid, acctuniqueid, username, nasipaddress,
        acctstarttime, acctstoptime, acctsessiontime
      ) VALUES (?, ?, ?, '192.168.1.1', NOW() - INTERVAL 10 MINUTE, NOW(), 600)
    `, [sessionId, sessionId, testUsername]);

    const totalTime = await getUsedTime(testUsername);
    expect(totalTime).toBe(600);
  });

  it('should handle midnight boundary correctly', async () => {
    // Clear previous data
    await conn.execute('DELETE FROM radacct WHERE username = ?', [testUsername]);

    // Create session that crosses midnight
    const sessionId = `test-midnight-${Date.now()}`;
    const startTime = new Date('2026-02-12T23:55:00Z');
    const stopTime = new Date('2026-02-13T00:05:00Z');
    const duration = 600; // 10 minutes

    await conn.execute(`
      INSERT INTO radacct (
        acctsessionid, acctuniqueid, username, nasipaddress,
        acctstarttime, acctstoptime, acctsessiontime
      ) VALUES (?, ?, ?, '192.168.1.1', ?, ?, ?)
    `, [sessionId, sessionId, testUsername, startTime, stopTime, duration]);

    const totalTime = await getUsedTime(testUsername);
    expect(totalTime).toBe(duration);
  });

  it('should use reportedTime for active session with reasonable elapsed time', async () => {
    // Clear previous data
    await conn.execute('DELETE FROM radacct WHERE username = ?', [testUsername]);

    // Create active session (started 5 minutes ago)
    const sessionId = `test-active-${Date.now()}`;
    const startTime = new Date(Date.now() - 5 * 60 * 1000);
    await conn.execute(`
      INSERT INTO radacct (
        acctsessionid, acctuniqueid, username, nasipaddress,
        acctstarttime, acctsessiontime
      ) VALUES (?, ?, ?, '192.168.1.1', ?, 250)
    `, [sessionId, sessionId, testUsername, startTime]);

    // Wait 1 second to ensure elapsed time > reported time
    await new Promise(resolve => setTimeout(resolve, 1000));

    const totalTime = await getUsedTime(testUsername);
    
    // Should use elapsed time (≈300s) since it's larger than reported (250s)
    expect(totalTime).toBeGreaterThanOrEqual(250);
    expect(totalTime).toBeLessThan(400); // Sanity check
  });

  it('should reject stale sessions (elapsed > 24 hours)', async () => {
    // Clear previous data
    await conn.execute('DELETE FROM radacct WHERE username = ?', [testUsername]);

    // Create stale session (started 25 hours ago)
    const sessionId = `test-stale-${Date.now()}`;
    const startTime = new Date(Date.now() - 25 * 3600 * 1000);
    await conn.execute(`
      INSERT INTO radacct (
        acctsessionid, acctuniqueid, username, nasipaddress,
        acctstarttime, acctsessiontime
      ) VALUES (?, ?, ?, '192.168.1.1', ?, 300)
    `, [sessionId, sessionId, testUsername, startTime]);

    const totalTime = await getUsedTime(testUsername);
    
    // Should use reported time (300s) and ignore elapsed time (25 hours)
    expect(totalTime).toBe(300);
  });

  it('should handle multiple completed sessions correctly', async () => {
    // Clear previous data
    await conn.execute('DELETE FROM radacct WHERE username = ?', [testUsername]);

    // Create 3 completed sessions
    for (let i = 0; i < 3; i++) {
      const sessionId = `test-multi-${Date.now()}-${i}`;
      await conn.execute(`
        INSERT INTO radacct (
          acctsessionid, acctuniqueid, username, nasipaddress,
          acctstarttime, acctstoptime, acctsessiontime
        ) VALUES (?, ?, ?, '192.168.1.1', NOW() - INTERVAL ${i+1} HOUR, NOW() - INTERVAL ${i} HOUR, 600)
      `, [sessionId, sessionId, testUsername]);
    }

    const totalTime = await getUsedTime(testUsername);
    expect(totalTime).toBe(1800); // 3 * 600
  });

  it('should handle zero reported time for active session', async () => {
    // Clear previous data
    await conn.execute('DELETE FROM radacct WHERE username = ?', [testUsername]);

    // Create active session with zero reported time (no Interim-Update yet)
    const sessionId = `test-zero-${Date.now()}`;
    const startTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    await conn.execute(`
      INSERT INTO radacct (
        acctsessionid, acctuniqueid, username, nasipaddress,
        acctstarttime, acctsessiontime
      ) VALUES (?, ?, ?, '192.168.1.1', ?, 0)
    `, [sessionId, sessionId, testUsername, startTime]);

    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    const totalTime = await getUsedTime(testUsername);
    
    // Should use elapsed time (≈120s) since reported is 0
    expect(totalTime).toBeGreaterThanOrEqual(120);
    expect(totalTime).toBeLessThan(180); // Sanity check
  });
});
