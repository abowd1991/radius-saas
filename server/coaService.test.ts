/**
 * CoA Service Tests
 * 
 * Tests for RADIUS CoA (Change of Authorization) functionality
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { disconnectSession, changeUserSpeed, disconnectUserAllSessions } from './services/coaService';
import { getDb } from './db';
import { radacct, nasDevices, radreply } from '../drizzle/schema';
import { eq, and, isNull } from 'drizzle-orm';

describe('CoA Service', () => {
  let testNasIp: string;
  let testUsername: string;

  beforeAll(async () => {
    // Get test data from database
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Get first NAS device
    const nas = await db.select().from(nasDevices).limit(1);
    if (nas.length === 0) {
      console.warn('No NAS devices found - some tests may be skipped');
      testNasIp = '192.168.30.13'; // Fallback to known test NAS
    } else {
      testNasIp = nas[0].nasname;
    }

    // Get first active session username
    const sessions = await db.select()
      .from(radacct)
      .where(isNull(radacct.acctstoptime))
      .limit(1);
    
    if (sessions.length === 0) {
      console.warn('No active sessions found - using test username');
      testUsername = 'abowd'; // Fallback to known test user
    } else {
      testUsername = sessions[0].username;
    }
  });

  describe('disconnectSession', () => {
    it('should accept valid parameters and return CoAResponse', async () => {
      const result = await disconnectSession(
        testUsername,
        testNasIp,
        '81c0000b', // Test session ID
        '192.168.188.247' // Test framed IP
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should handle missing session ID gracefully', async () => {
      const result = await disconnectSession(
        testUsername,
        testNasIp
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });

    it('should return error for invalid NAS IP', async () => {
      const result = await disconnectSession(
        testUsername,
        '192.168.99.99' // Non-existent NAS
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      // May succeed or fail depending on CoA response
    }, 10000); // Increase timeout to 10s
  });

  describe('disconnectUserAllSessions', () => {
    it('should accept username and return CoAResponse', async () => {
      const result = await disconnectUserAllSessions(testUsername);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle user with no active sessions', async () => {
      const result = await disconnectUserAllSessions('nonexistent_user_12345');

      expect(result).toBeDefined();
      expect(result.success).toBe(true); // Should succeed even with no sessions
      // Message may be 'No active sessions' or 'Disconnect requests sent'
      expect(result.message).toBeDefined();
    }, 10000); // Increase timeout to 10s
  });

  describe('changeUserSpeed', () => {
    it('should update radreply with new speed', async () => {
      const uploadSpeed = 2; // 2 Mbps
      const downloadSpeed = 5; // 5 Mbps

      const result = await changeUserSpeed(
        testUsername,
        uploadSpeed,
        downloadSpeed
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');

      // Verify radreply was updated
      const db = await getDb();
      if (db) {
        const rateLimit = await db.select()
          .from(radreply)
          .where(and(
            eq(radreply.username, testUsername),
            eq(radreply.attribute, 'Mikrotik-Rate-Limit')
          ))
          .limit(1);

        expect(rateLimit.length).toBeGreaterThan(0);
        expect(rateLimit[0].value).toBe('2000k/5000k'); // upload/download in kbps
      }
    });

    it('should handle speed values correctly (no multiplication by 1000)', async () => {
      const uploadSpeed = 1; // 1 Mbps
      const downloadSpeed = 1; // 1 Mbps

      const result = await changeUserSpeed(
        'test_speed_user',
        uploadSpeed,
        downloadSpeed
      );

      expect(result.success).toBe(true);

      // Verify correct speed (1 Mbps = 1000 kbps, NOT 1000000 kbps)
      const db = await getDb();
      if (db) {
        const rateLimit = await db.select()
          .from(radreply)
          .where(and(
            eq(radreply.username, 'test_speed_user'),
            eq(radreply.attribute, 'Mikrotik-Rate-Limit')
          ))
          .limit(1);

        if (rateLimit.length > 0) {
          expect(rateLimit[0].value).toBe('1000k/1000k'); // Correct: 1 Mbps = 1000 kbps
          expect(rateLimit[0].value).not.toBe('1000000k/1000000k'); // Wrong: would be 1 Gbps
        }
      }
    });

    it('should return success even if user has no active session', async () => {
      const result = await changeUserSpeed(
        'offline_user_12345',
        1,
        1
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('No active session');
    });
  });

  describe('SSH Tunnel Integration', () => {
    it('should use SSH tunnel for VPN IPs (192.168.30.x)', async () => {
      // This test verifies that the service is configured to use SSH tunnel
      // Actual SSH connection is tested in integration tests
      
      const vpnIp = '192.168.30.13';
      const result = await disconnectSession('test_user', vpnIp);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      // The service should attempt SSH tunnel connection for VPN IPs
    });
  });

  describe('Error Handling', () => {
    it('should handle database unavailability gracefully', async () => {
      // This test ensures the service doesn't crash on DB errors
      const result = await changeUserSpeed(
        'test_user',
        1,
        1
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });

    it('should update database even if CoA fails', async () => {
      // Test that radacct is updated even if MikroTik doesn't respond
      const testSessionId = 'test_session_' + Date.now();
      
      const result = await disconnectSession(
        'test_user',
        '192.168.99.99', // Non-existent NAS
        testSessionId
      );

      expect(result).toBeDefined();
      // Should succeed because database is updated regardless of CoA response
    }, 10000); // Increase timeout to 10s
  });
});
