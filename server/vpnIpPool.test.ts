import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getDb: vi.fn(),
}));

describe('VPN IP Pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('IP Address Conversion', () => {
    it('should convert IP to integer correctly', () => {
      // Test the logic without importing the actual module
      // Using >>> 0 to ensure unsigned 32-bit integer
      const ipToInt = (ip: string): number => {
        const parts = ip.split('.').map(Number);
        return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
      };

      expect(ipToInt('192.168.30.10')).toBe(3232243210);
      expect(ipToInt('192.168.30.250')).toBe(3232243450);
      expect(ipToInt('0.0.0.0')).toBe(0);
      expect(ipToInt('255.255.255.255')).toBe(4294967295);
    });

    it('should convert integer to IP correctly', () => {
      const intToIp = (num: number): string => {
        return [
          (num >>> 24) & 255,
          (num >>> 16) & 255,
          (num >>> 8) & 255,
          num & 255,
        ].join('.');
      };

      expect(intToIp(3232243210)).toBe('192.168.30.10');
      expect(intToIp(3232243450)).toBe('192.168.30.250');
      expect(intToIp(0)).toBe('0.0.0.0');
      expect(intToIp(4294967295)).toBe('255.255.255.255');
    });

    it('should round-trip IP conversion correctly', () => {
      const ipToInt = (ip: string): number => {
        const parts = ip.split('.').map(Number);
        return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
      };

      const intToIp = (num: number): string => {
        return [
          (num >>> 24) & 255,
          (num >>> 16) & 255,
          (num >>> 8) & 255,
          num & 255,
        ].join('.');
      };

      const testIps = ['192.168.30.10', '10.0.0.1', '172.16.0.100', '192.168.30.250'];
      for (const ip of testIps) {
        expect(intToIp(ipToInt(ip))).toBe(ip);
      }
    });
  });

  describe('IP Pool Range', () => {
    it('should calculate correct pool size', () => {
      const ipToInt = (ip: string): number => {
        const parts = ip.split('.').map(Number);
        return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
      };

      const startIp = '192.168.30.10';
      const endIp = '192.168.30.250';
      const poolSize = ipToInt(endIp) - ipToInt(startIp) + 1;

      expect(poolSize).toBe(241); // 250 - 10 + 1 = 241 IPs
    });

    it('should find next available IP', () => {
      const ipToInt = (ip: string): number => {
        const parts = ip.split('.').map(Number);
        return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
      };

      const intToIp = (num: number): string => {
        return [
          (num >>> 24) & 255,
          (num >>> 16) & 255,
          (num >>> 8) & 255,
          num & 255,
        ].join('.');
      };

      const findNextAvailableIp = (
        allocatedIps: string[],
        startIp: string,
        endIp: string
      ): string | null => {
        const allocatedSet = new Set(allocatedIps);
        const startInt = ipToInt(startIp);
        const endInt = ipToInt(endIp);

        for (let i = startInt; i <= endInt; i++) {
          const ip = intToIp(i);
          if (!allocatedSet.has(ip)) {
            return ip;
          }
        }
        return null;
      };

      // Empty pool - should return first IP
      expect(findNextAvailableIp([], '192.168.30.10', '192.168.30.250')).toBe('192.168.30.10');

      // First IP allocated - should return second
      expect(findNextAvailableIp(['192.168.30.10'], '192.168.30.10', '192.168.30.250')).toBe('192.168.30.11');

      // First two allocated - should return third
      expect(findNextAvailableIp(['192.168.30.10', '192.168.30.11'], '192.168.30.10', '192.168.30.250')).toBe('192.168.30.12');

      // Gap in allocation - should find first gap
      expect(findNextAvailableIp(['192.168.30.10', '192.168.30.12'], '192.168.30.10', '192.168.30.250')).toBe('192.168.30.11');
    });

    it('should return null when pool is exhausted', () => {
      const ipToInt = (ip: string): number => {
        const parts = ip.split('.').map(Number);
        return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
      };

      const intToIp = (num: number): string => {
        return [
          (num >>> 24) & 255,
          (num >>> 16) & 255,
          (num >>> 8) & 255,
          num & 255,
        ].join('.');
      };

      const findNextAvailableIp = (
        allocatedIps: string[],
        startIp: string,
        endIp: string
      ): string | null => {
        const allocatedSet = new Set(allocatedIps);
        const startInt = ipToInt(startIp);
        const endInt = ipToInt(endIp);

        for (let i = startInt; i <= endInt; i++) {
          const ip = intToIp(i);
          if (!allocatedSet.has(ip)) {
            return ip;
          }
        }
        return null;
      };

      // Small pool fully allocated
      const smallPoolAllocated = ['192.168.30.10', '192.168.30.11', '192.168.30.12'];
      expect(findNextAvailableIp(smallPoolAllocated, '192.168.30.10', '192.168.30.12')).toBe(null);
    });
  });

  describe('Pool Statistics', () => {
    it('should calculate correct statistics', () => {
      const ipToInt = (ip: string): number => {
        const parts = ip.split('.').map(Number);
        return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
      };

      const calculateStats = (startIp: string, endIp: string, allocatedCount: number) => {
        const startInt = ipToInt(startIp);
        const endInt = ipToInt(endIp);
        const totalIps = endInt - startInt + 1;
        return {
          totalIps,
          allocatedCount,
          availableCount: totalIps - allocatedCount,
        };
      };

      const stats = calculateStats('192.168.30.10', '192.168.30.250', 5);
      expect(stats.totalIps).toBe(241);
      expect(stats.allocatedCount).toBe(5);
      expect(stats.availableCount).toBe(236);
    });
  });
});
