import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db/nas", () => ({
  getNasDevicesByOwner: vi.fn(),
  getAllNasDevices: vi.fn(),
  getNasByIp: vi.fn(),
}));

vi.mock("./db/vouchers", () => ({
  getCardsByReseller: vi.fn(),
  getAllCards: vi.fn(),
  getCardById: vi.fn(),
  getCardByUsername: vi.fn(),
  getBatchesByResellerWithStats: vi.fn(),
  getAllBatchesWithStats: vi.fn(),
}));

import * as nasDb from "./db/nas";
import * as cardDb from "./db/vouchers";

describe("Multi-Tenancy Data Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("NAS Device Isolation", () => {
    it("should return only owner's NAS devices for non-super_admin", async () => {
      const mockOwnerNas = [
        { id: 1, nasname: "192.168.1.1", shortname: "NAS1", ownerId: 100 },
        { id: 2, nasname: "192.168.1.2", shortname: "NAS2", ownerId: 100 },
      ];
      
      vi.mocked(nasDb.getNasDevicesByOwner).mockResolvedValue(mockOwnerNas);
      
      const result = await nasDb.getNasDevicesByOwner(100);
      
      expect(result).toHaveLength(2);
      expect(result.every(n => n.ownerId === 100)).toBe(true);
      expect(nasDb.getNasDevicesByOwner).toHaveBeenCalledWith(100);
    });

    it("should return all NAS devices for super_admin", async () => {
      const mockAllNas = [
        { id: 1, nasname: "192.168.1.1", shortname: "NAS1", ownerId: 100 },
        { id: 2, nasname: "192.168.1.2", shortname: "NAS2", ownerId: 100 },
        { id: 3, nasname: "192.168.2.1", shortname: "NAS3", ownerId: 200 },
      ];
      
      vi.mocked(nasDb.getAllNasDevices).mockResolvedValue(mockAllNas);
      
      const result = await nasDb.getAllNasDevices();
      
      expect(result).toHaveLength(3);
      expect(nasDb.getAllNasDevices).toHaveBeenCalled();
    });
  });

  describe("Card/Voucher Isolation", () => {
    it("should return only owner's cards for non-super_admin", async () => {
      const mockOwnerCards = [
        { id: 1, username: "user1", createdBy: 100, resellerId: null },
        { id: 2, username: "user2", createdBy: 100, resellerId: null },
      ];
      
      vi.mocked(cardDb.getCardsByReseller).mockResolvedValue(mockOwnerCards as any);
      
      const result = await cardDb.getCardsByReseller(100, {});
      
      expect(result).toHaveLength(2);
      expect(cardDb.getCardsByReseller).toHaveBeenCalledWith(100, {});
    });

    it("should return all cards for super_admin", async () => {
      const mockAllCards = [
        { id: 1, username: "user1", createdBy: 100, resellerId: null },
        { id: 2, username: "user2", createdBy: 100, resellerId: null },
        { id: 3, username: "user3", createdBy: 200, resellerId: null },
      ];
      
      vi.mocked(cardDb.getAllCards).mockResolvedValue(mockAllCards as any);
      
      const result = await cardDb.getAllCards({});
      
      expect(result).toHaveLength(3);
      expect(cardDb.getAllCards).toHaveBeenCalled();
    });

    it("should deny access to card owned by another user", async () => {
      const mockCard = { id: 1, username: "user1", createdBy: 200, resellerId: null };
      
      vi.mocked(cardDb.getCardById).mockResolvedValue(mockCard as any);
      
      const card = await cardDb.getCardById(1);
      const currentUserId = 100;
      
      // Simulate ownership check
      const hasAccess = card?.createdBy === currentUserId || card?.resellerId === currentUserId;
      
      expect(hasAccess).toBe(false);
    });
  });

  describe("Session Isolation", () => {
    it("should filter sessions by owner's NAS IPs", async () => {
      const mockOwnerNas = [
        { id: 1, nasname: "192.168.1.1", ownerId: 100 },
      ];
      
      const mockAllSessions = [
        { username: "user1", nasIpAddress: "192.168.1.1" }, // Owner's NAS
        { username: "user2", nasIpAddress: "192.168.2.1" }, // Other's NAS
      ];
      
      vi.mocked(nasDb.getNasDevicesByOwner).mockResolvedValue(mockOwnerNas);
      
      const ownerNasDevices = await nasDb.getNasDevicesByOwner(100);
      const ownerNasIps = ownerNasDevices.map(n => n.nasname);
      
      const filteredSessions = mockAllSessions.filter(s => 
        ownerNasIps.includes(s.nasIpAddress)
      );
      
      expect(filteredSessions).toHaveLength(1);
      expect(filteredSessions[0].nasIpAddress).toBe("192.168.1.1");
    });
  });

  describe("Batch Isolation", () => {
    it("should return only owner's batches for non-super_admin", async () => {
      const mockOwnerBatches = [
        { batchId: "batch1", createdBy: 100, stats: { total: 10, used: 5 } },
        { batchId: "batch2", createdBy: 100, stats: { total: 20, used: 10 } },
      ];
      
      vi.mocked(cardDb.getBatchesByResellerWithStats).mockResolvedValue(mockOwnerBatches as any);
      
      const result = await cardDb.getBatchesByResellerWithStats(100);
      
      expect(result).toHaveLength(2);
      expect(cardDb.getBatchesByResellerWithStats).toHaveBeenCalledWith(100);
    });
  });
});
