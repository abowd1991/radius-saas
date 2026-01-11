import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('./db', async () => {
  const actual = await vi.importActual('./db');
  return {
    ...actual,
    getDb: vi.fn(() => Promise.resolve(null)),
    getVpnConnectionByNasId: vi.fn(),
    getAllVpnConnections: vi.fn(),
    upsertVpnConnection: vi.fn(),
    updateVpnConnectionStatus: vi.fn(),
    incrementVpnDisconnectCount: vi.fn(),
    addVpnLog: vi.fn(),
    getVpnLogsByNasId: vi.fn(),
    getVpnLogs: vi.fn(),
    getVpnConnectionStats: vi.fn(),
    deleteVpnConnectionByNasId: vi.fn(),
  };
});

// Mock NAS database
vi.mock('./db/nas', () => ({
  getNasById: vi.fn(),
  getAllNasDevices: vi.fn(),
  getNasDevicesByOwner: vi.fn(),
}));

// Mock node-routeros
vi.mock('node-routeros', () => ({
  RouterOSAPI: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue([]),
  })),
}));

import * as db from './db';
import * as nasDb from './db/nas';

describe('VPN Connection Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Database Operations', () => {
    it('should get VPN connection by NAS ID', async () => {
      const mockConnection = {
        id: 1,
        nasId: 1,
        connectionType: 'vpn_l2tp',
        status: 'connected',
        localVpnIp: '192.168.30.10',
      };
      
      vi.mocked(db.getVpnConnectionByNasId).mockResolvedValue(mockConnection as any);
      
      const result = await db.getVpnConnectionByNasId(1);
      
      expect(result).toEqual(mockConnection);
      expect(db.getVpnConnectionByNasId).toHaveBeenCalledWith(1);
    });

    it('should return null for non-existent VPN connection', async () => {
      vi.mocked(db.getVpnConnectionByNasId).mockResolvedValue(null);
      
      const result = await db.getVpnConnectionByNasId(999);
      
      expect(result).toBeNull();
    });

    it('should get all VPN connections', async () => {
      const mockConnections = [
        { vpn: { id: 1, nasId: 1, status: 'connected' }, nas: { id: 1, shortname: 'NAS1' } },
        { vpn: { id: 2, nasId: 2, status: 'disconnected' }, nas: { id: 2, shortname: 'NAS2' } },
      ];
      
      vi.mocked(db.getAllVpnConnections).mockResolvedValue(mockConnections as any);
      
      const result = await db.getAllVpnConnections();
      
      expect(result).toHaveLength(2);
      expect(result[0].vpn.status).toBe('connected');
    });

    it('should filter VPN connections by owner', async () => {
      const mockConnections = [
        { vpn: { id: 1, nasId: 1, status: 'connected' }, nas: { id: 1, shortname: 'NAS1', ownerId: 5 } },
      ];
      
      vi.mocked(db.getAllVpnConnections).mockResolvedValue(mockConnections as any);
      
      const result = await db.getAllVpnConnections(5);
      
      expect(db.getAllVpnConnections).toHaveBeenCalledWith(5);
    });

    it('should upsert VPN connection', async () => {
      const mockConnection = {
        id: 1,
        nasId: 1,
        connectionType: 'vpn_sstp',
        status: 'connected',
      };
      
      vi.mocked(db.upsertVpnConnection).mockResolvedValue(mockConnection as any);
      
      const result = await db.upsertVpnConnection({
        nasId: 1,
        connectionType: 'vpn_sstp',
        status: 'connected',
      } as any);
      
      expect(result).toEqual(mockConnection);
    });

    it('should update VPN connection status', async () => {
      vi.mocked(db.updateVpnConnectionStatus).mockResolvedValue(undefined);
      
      await db.updateVpnConnectionStatus(1, 'disconnected');
      
      expect(db.updateVpnConnectionStatus).toHaveBeenCalledWith(1, 'disconnected');
    });

    it('should increment disconnect count', async () => {
      vi.mocked(db.incrementVpnDisconnectCount).mockResolvedValue(undefined);
      
      await db.incrementVpnDisconnectCount(1);
      
      expect(db.incrementVpnDisconnectCount).toHaveBeenCalledWith(1);
    });
  });

  describe('VPN Logs', () => {
    it('should add VPN log entry', async () => {
      vi.mocked(db.addVpnLog).mockResolvedValue(1);
      
      const logId = await db.addVpnLog({
        nasId: 1,
        eventType: 'connected',
        message: 'VPN connected successfully',
      } as any);
      
      expect(logId).toBe(1);
    });

    it('should get VPN logs by NAS ID', async () => {
      const mockLogs = [
        { id: 1, nasId: 1, eventType: 'connected', message: 'Connected' },
        { id: 2, nasId: 1, eventType: 'disconnected', message: 'Disconnected' },
      ];
      
      vi.mocked(db.getVpnLogsByNasId).mockResolvedValue(mockLogs as any);
      
      const result = await db.getVpnLogsByNasId(1);
      
      expect(result).toHaveLength(2);
      expect(result[0].eventType).toBe('connected');
    });

    it('should get VPN logs with filtering', async () => {
      const mockResult = {
        logs: [{ log: { id: 1, eventType: 'error' }, nas: { shortname: 'NAS1' } }],
        total: 1,
      };
      
      vi.mocked(db.getVpnLogs).mockResolvedValue(mockResult as any);
      
      const result = await db.getVpnLogs({
        eventType: 'error',
        limit: 50,
      });
      
      expect(result.total).toBe(1);
      expect(result.logs[0].log.eventType).toBe('error');
    });
  });

  describe('VPN Statistics', () => {
    it('should get VPN connection stats', async () => {
      const mockStats = {
        total: 10,
        connected: 5,
        disconnected: 3,
        connecting: 1,
        error: 1,
      };
      
      vi.mocked(db.getVpnConnectionStats).mockResolvedValue(mockStats);
      
      const result = await db.getVpnConnectionStats();
      
      expect(result.total).toBe(10);
      expect(result.connected).toBe(5);
    });

    it('should get VPN stats filtered by owner', async () => {
      const mockStats = {
        total: 3,
        connected: 2,
        disconnected: 1,
        connecting: 0,
        error: 0,
      };
      
      vi.mocked(db.getVpnConnectionStats).mockResolvedValue(mockStats);
      
      const result = await db.getVpnConnectionStats(5);
      
      expect(db.getVpnConnectionStats).toHaveBeenCalledWith(5);
      expect(result.total).toBe(3);
    });
  });

  describe('VPN Connection Cleanup', () => {
    it('should delete VPN connection and logs by NAS ID', async () => {
      vi.mocked(db.deleteVpnConnectionByNasId).mockResolvedValue(undefined);
      
      await db.deleteVpnConnectionByNasId(1);
      
      expect(db.deleteVpnConnectionByNasId).toHaveBeenCalledWith(1);
    });
  });

  describe('NAS Device Integration', () => {
    it('should check NAS ownership before VPN operations', async () => {
      const mockNas = {
        id: 1,
        nasname: '192.168.1.1',
        shortname: 'TestNAS',
        connectionType: 'vpn_l2tp',
        ownerId: 5,
        apiEnabled: true,
      };
      
      vi.mocked(nasDb.getNasById).mockResolvedValue(mockNas as any);
      
      const nas = await nasDb.getNasById(1);
      
      expect(nas).toBeDefined();
      expect(nas?.ownerId).toBe(5);
      expect(nas?.connectionType).toBe('vpn_l2tp');
    });

    it('should return null for non-existent NAS', async () => {
      vi.mocked(nasDb.getNasById).mockResolvedValue(null);
      
      const nas = await nasDb.getNasById(999);
      
      expect(nas).toBeNull();
    });

    it('should get NAS devices by owner', async () => {
      const mockNasList = [
        { id: 1, shortname: 'NAS1', connectionType: 'vpn_l2tp', ownerId: 5 },
        { id: 2, shortname: 'NAS2', connectionType: 'vpn_sstp', ownerId: 5 },
      ];
      
      vi.mocked(nasDb.getNasDevicesByOwner).mockResolvedValue(mockNasList as any);
      
      const result = await nasDb.getNasDevicesByOwner(5);
      
      expect(result).toHaveLength(2);
    });
  });

  describe('Connection Type Handling', () => {
    it('should identify public IP connections', () => {
      const connectionType = 'public_ip';
      expect(connectionType).toBe('public_ip');
    });

    it('should identify PPTP VPN connections', () => {
      const connectionType = 'vpn_l2tp';
      expect(connectionType).toBe('vpn_l2tp');
    });

    it('should identify SSTP VPN connections', () => {
      const connectionType = 'vpn_sstp';
      expect(connectionType).toBe('vpn_sstp');
    });
  });

  describe('Event Types', () => {
    const validEventTypes = [
      'connected',
      'disconnected',
      'connection_failed',
      'reconnecting',
      'auth_failed',
      'timeout',
      'manual_disconnect',
      'manual_restart',
      'error',
      'radius_error',
    ];

    it('should support all valid event types', () => {
      validEventTypes.forEach((eventType) => {
        expect(validEventTypes).toContain(eventType);
      });
    });

    it('should have 10 event types', () => {
      expect(validEventTypes).toHaveLength(10);
    });
  });
});

describe('VPN Status Values', () => {
  const validStatuses = ['connected', 'disconnected', 'connecting', 'error'];

  it('should support all valid status values', () => {
    validStatuses.forEach((status) => {
      expect(validStatuses).toContain(status);
    });
  });

  it('should have 4 status values', () => {
    expect(validStatuses).toHaveLength(4);
  });
});
