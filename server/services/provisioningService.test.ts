import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import {
  getDhcpLease,
  getAllDhcpLeases,
  createDhcpReservation,
  getVpnSessions,
  findVpnSession,
  disconnectVpnSession,
} from './provisioningService';

describe('Provisioning Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDhcpLease', () => {
    it('should return DHCP lease info when found', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          ip: '192.168.30.15',
          mac: 'ca:6e:26:d3:11:35',
          state: 'active',
          hostname: 'MikroTik',
        }),
      });

      const result = await getDhcpLease('192.168.30.15');

      expect(result).not.toBeNull();
      expect(result?.ip).toBe('192.168.30.15');
      expect(result?.mac).toBe('ca:6e:26:d3:11:35');
      expect(result?.state).toBe('active');
    });

    it('should return null when lease not found', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: false,
          error: 'LEASE_NOT_FOUND',
        }),
      });

      const result = await getDhcpLease('192.168.30.99');

      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getDhcpLease('192.168.30.15');

      expect(result).toBeNull();
    });
  });

  describe('getAllDhcpLeases', () => {
    it('should return list of DHCP leases', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          leases: [
            { ip: '192.168.30.12', mac: 'aa:bb:cc:dd:ee:ff', state: 'active' },
            { ip: '192.168.30.15', mac: 'ca:6e:26:d3:11:35', state: 'active' },
          ],
        }),
      });

      const result = await getAllDhcpLeases();

      expect(result).toHaveLength(2);
      expect(result[0].ip).toBe('192.168.30.12');
    });

    it('should return empty array on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getAllDhcpLeases();

      expect(result).toEqual([]);
    });
  });

  describe('createDhcpReservation', () => {
    it('should create DHCP reservation successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          message: 'Reservation created',
        }),
      });

      const result = await createDhcpReservation(
        'ca:6e:26:d3:11:35',
        '192.168.30.17',
        'nas-123'
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/vpn/dhcp/reservation'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            macAddress: 'ca:6e:26:d3:11:35',
            ipAddress: '192.168.30.17',
            hostname: 'nas-123',
          }),
        })
      );
    });

    it('should handle reservation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: false,
          error: 'IP already reserved',
        }),
      });

      const result = await createDhcpReservation(
        'ca:6e:26:d3:11:35',
        '192.168.30.17',
        'nas-123'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('IP already reserved');
    });
  });

  describe('getVpnSessions', () => {
    it('should return VPN sessions excluding Local Bridge', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          sessions: [
            { sessionName: 'SID-TEST-1', username: 'test-user', localIp: '192.168.30.15' },
            { sessionName: 'Local Bridge', username: 'Local Bridge', localIp: '192.168.30.1' },
          ],
        }),
      });

      const result = await getVpnSessions();

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('test-user');
    });
  });

  describe('findVpnSession', () => {
    it('should find VPN session by username (case insensitive)', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          sessions: [
            { sessionName: 'SID-TEST-1', username: 'Test-User', localIp: '192.168.30.15' },
          ],
        }),
      });

      const result = await findVpnSession('test-user');

      expect(result).not.toBeNull();
      expect(result?.username).toBe('Test-User');
    });

    it('should return null when session not found', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          sessions: [],
        }),
      });

      const result = await findVpnSession('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('disconnectVpnSession', () => {
    it('should disconnect VPN session successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          message: 'Session disconnected',
        }),
      });

      const result = await disconnectVpnSession('SID-TEST-1');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/vpn/sessions/SID-TEST-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should handle disconnect failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: false,
          error: 'Session not found',
        }),
      });

      const result = await disconnectVpnSession('SID-INVALID');

      expect(result).toBe(false);
    });
  });
});
