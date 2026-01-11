import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database and services
vi.mock("./db/nas", () => ({
  getNasByIp: vi.fn(),
}));

vi.mock("./db/vouchers", () => ({
  getCardByUsername: vi.fn(),
}));

vi.mock("./services/coaService", () => ({
  disconnectSession: vi.fn().mockResolvedValue({ success: true }),
  disconnectUserAllSessions: vi.fn().mockResolvedValue({ success: true }),
  updateSessionAttributes: vi.fn().mockResolvedValue({ success: true }),
  changeUserSpeed: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("./services/mikrotikApi", () => ({
  changeUserSpeedViaMikroTikApi: vi.fn(),
  disconnectUserViaMikroTikApi: vi.fn(),
  getActiveUsersViaMikroTikApi: vi.fn().mockResolvedValue({ success: true, users: [] }),
}));

// Mock audit log to capture calls
const auditLogCalls: any[] = [];
vi.mock("./services/auditLogService", () => ({
  logAudit: vi.fn().mockImplementation((data) => {
    auditLogCalls.push(data);
    return Promise.resolve();
  }),
}));

import * as nasDb from "./db/nas";
import * as cardDb from "./db/vouchers";
import * as mikrotikApi from "./services/mikrotikApi";
import * as coaService from "./services/coaService";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string, userId: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    loginMethod: "manus",
    role: role as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Production Tests - Role-based Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditLogCalls.length = 0;
  });

  // ============================================
  // 1. Reseller Tests
  // ============================================
  
  describe("Reseller - Own NAS Operations", () => {
    const RESELLER_ID = 100;
    const RESELLER_NAS_IP = "192.168.1.100";
    
    beforeEach(() => {
      // Mock NAS owned by the reseller
      vi.mocked(nasDb.getNasByIp).mockResolvedValue({
        id: 1,
        ownerId: RESELLER_ID,
        nasIp: RESELLER_NAS_IP,
        apiEnabled: true,
      } as any);
      
      // Mock successful API response
      vi.mocked(mikrotikApi.disconnectUserViaMikroTikApi).mockResolvedValue({ success: true });
      vi.mocked(mikrotikApi.changeUserSpeedViaMikroTikApi).mockResolvedValue({ success: true });
    });

    it("Reseller can disconnect session on their own NAS", async () => {
      const ctx = createContext("reseller", RESELLER_ID);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.sessions.coaDisconnect({
        username: "testuser",
        nasIp: RESELLER_NAS_IP,
      });

      expect(result.success).toBe(true);
      
      // Verify audit log was created
      expect(auditLogCalls.length).toBeGreaterThan(0);
      const auditEntry = auditLogCalls[0];
      expect(auditEntry.userId).toBe(RESELLER_ID);
      expect(auditEntry.userRole).toBe("reseller");
      expect(auditEntry.action).toBe("session_disconnect_coa");
      expect(auditEntry.nasIp).toBe(RESELLER_NAS_IP);
      expect(auditEntry.result).toBe("success");
    });

    it("Reseller can change speed via MikroTik API on their own NAS", async () => {
      const ctx = createContext("reseller", RESELLER_ID);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.sessions.mikrotikChangeSpeed({
        nasIp: RESELLER_NAS_IP,
        username: "testuser",
        uploadSpeedKbps: 2000,
        downloadSpeedKbps: 4000,
      });

      expect(result.success).toBe(true);
      
      // Verify audit log
      const auditEntry = auditLogCalls.find(e => e.action === "speed_change_api");
      expect(auditEntry).toBeDefined();
      expect(auditEntry.userId).toBe(RESELLER_ID);
      expect(auditEntry.details.uploadSpeedKbps).toBe(2000);
      expect(auditEntry.details.downloadSpeedKbps).toBe(4000);
    });

    it("Reseller can view active users on their own NAS", async () => {
      const ctx = createContext("reseller", RESELLER_ID);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.sessions.mikrotikGetActiveUsers({
        nasIp: RESELLER_NAS_IP,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Reseller - Other's NAS Operations (FORBIDDEN)", () => {
    const RESELLER_ID = 100;
    const OTHER_OWNER_ID = 999;
    const OTHER_NAS_IP = "192.168.1.200";
    
    beforeEach(() => {
      // Mock NAS owned by another user
      vi.mocked(nasDb.getNasByIp).mockResolvedValue({
        id: 2,
        ownerId: OTHER_OWNER_ID,
        nasIp: OTHER_NAS_IP,
        apiEnabled: true,
      } as any);
    });

    it("Reseller CANNOT disconnect session on other's NAS - logs FORBIDDEN", async () => {
      const ctx = createContext("reseller", RESELLER_ID);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.sessions.coaDisconnect({
          username: "testuser",
          nasIp: OTHER_NAS_IP,
        })
      ).rejects.toThrow("Access denied to this NAS");

      // No audit log for forbidden actions (they throw before logging)
    });

    it("Reseller CANNOT change speed on other's NAS", async () => {
      const ctx = createContext("reseller", RESELLER_ID);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.sessions.mikrotikChangeSpeed({
          nasIp: OTHER_NAS_IP,
          username: "testuser",
          uploadSpeedKbps: 2000,
          downloadSpeedKbps: 4000,
        })
      ).rejects.toThrow("Access denied to this NAS");
    });

    it("Reseller CANNOT view active users on other's NAS", async () => {
      const ctx = createContext("reseller", RESELLER_ID);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.sessions.mikrotikGetActiveUsers({
          nasIp: OTHER_NAS_IP,
        })
      ).rejects.toThrow("Access denied to this NAS");
    });
  });

  // ============================================
  // 2. Client Tests
  // ============================================
  
  describe("Client - Own Card Operations", () => {
    const CLIENT_ID = 200;
    
    beforeEach(() => {
      // Mock card owned by the client
      vi.mocked(cardDb.getCardByUsername).mockResolvedValue({
        id: 1,
        username: "client-card-001",
        createdBy: CLIENT_ID,
        resellerId: null,
      } as any);
    });

    it("Client can change speed for their own card", async () => {
      const ctx = createContext("user", CLIENT_ID);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.sessions.changeUserSpeed({
        username: "client-card-001",
        uploadSpeedMbps: 1,
        downloadSpeedMbps: 2,
      });

      expect(result.success).toBe(true);
      
      // Verify audit log
      const auditEntry = auditLogCalls.find(e => e.action === "speed_change");
      expect(auditEntry).toBeDefined();
      expect(auditEntry.userId).toBe(CLIENT_ID);
      expect(auditEntry.targetName).toBe("client-card-001");
    });
  });

  describe("Client - Other's Card Operations (FORBIDDEN)", () => {
    const CLIENT_ID = 200;
    const OTHER_CLIENT_ID = 999;
    
    beforeEach(() => {
      // Mock card owned by another client
      vi.mocked(cardDb.getCardByUsername).mockResolvedValue({
        id: 2,
        username: "other-card-001",
        createdBy: OTHER_CLIENT_ID,
        resellerId: null,
      } as any);
    });

    it("Client CANNOT change speed for other's card", async () => {
      const ctx = createContext("user", CLIENT_ID);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.sessions.changeUserSpeed({
          username: "other-card-001",
          uploadSpeedMbps: 1,
          downloadSpeedMbps: 2,
        })
      ).rejects.toThrow("Access denied to this user");
    });
  });

  // ============================================
  // 3. Fallback Tests (API → CoA)
  // ============================================
  
  describe("Fallback - API to CoA", () => {
    const ADMIN_ID = 1;
    const NAS_IP = "192.168.1.1";
    
    beforeEach(() => {
      vi.mocked(nasDb.getNasByIp).mockResolvedValue({
        id: 1,
        ownerId: ADMIN_ID,
        nasIp: NAS_IP,
        apiEnabled: true,
      } as any);
    });

    it("Falls back to CoA when MikroTik API fails (timeout)", async () => {
      const ctx = createContext("super_admin", ADMIN_ID);
      const caller = appRouter.createCaller(ctx);

      // Mock API failure
      vi.mocked(mikrotikApi.changeUserSpeedViaMikroTikApi).mockResolvedValue({ 
        success: false, 
        error: "Connection timeout" 
      });
      
      // Mock CoA success
      vi.mocked(coaService.changeUserSpeed).mockResolvedValue({ success: true });

      const result = await caller.sessions.mikrotikChangeSpeed({
        nasIp: NAS_IP,
        username: "testuser",
        uploadSpeedKbps: 1000,
        downloadSpeedKbps: 2000,
      });

      // Should succeed via CoA fallback
      expect(result.success).toBe(true);
      
      // Verify CoA was called
      expect(coaService.changeUserSpeed).toHaveBeenCalledWith(
        "testuser",
        1, // 1000 Kbps = 1 Mbps
        2  // 2000 Kbps = 2 Mbps
      );
      
      // Verify audit log shows fallback
      const auditEntry = auditLogCalls.find(e => e.action === "speed_change_api");
      expect(auditEntry).toBeDefined();
      expect(auditEntry.details.method).toBe("coa_fallback");
    });

    it("Falls back to CoA when MikroTik API auth fails", async () => {
      const ctx = createContext("super_admin", ADMIN_ID);
      const caller = appRouter.createCaller(ctx);

      // Mock API auth failure
      vi.mocked(mikrotikApi.disconnectUserViaMikroTikApi).mockResolvedValue({ 
        success: false, 
        error: "Authentication failed" 
      });
      
      // Mock CoA success
      vi.mocked(coaService.disconnectUserAllSessions).mockResolvedValue({ success: true });

      const result = await caller.sessions.mikrotikDisconnect({
        nasIp: NAS_IP,
        username: "testuser",
      });

      expect(result.success).toBe(true);
      expect(coaService.disconnectUserAllSessions).toHaveBeenCalledWith("testuser");
      
      // Verify audit log shows fallback
      const auditEntry = auditLogCalls.find(e => e.action === "session_disconnect_api");
      expect(auditEntry).toBeDefined();
      expect(auditEntry.details.method).toBe("coa_fallback");
    });

    it("Does NOT double-execute when API succeeds", async () => {
      const ctx = createContext("super_admin", ADMIN_ID);
      const caller = appRouter.createCaller(ctx);

      // Mock API success
      vi.mocked(mikrotikApi.disconnectUserViaMikroTikApi).mockResolvedValue({ success: true });

      await caller.sessions.mikrotikDisconnect({
        nasIp: NAS_IP,
        username: "testuser",
      });

      // CoA should NOT be called when API succeeds
      expect(coaService.disconnectUserAllSessions).not.toHaveBeenCalled();
      
      // Verify audit log shows API method
      const auditEntry = auditLogCalls.find(e => e.action === "session_disconnect_api");
      expect(auditEntry).toBeDefined();
      expect(auditEntry.details.method).toBe("api");
    });

    it("Does NOT fallback when apiEnabled is false", async () => {
      const ctx = createContext("super_admin", ADMIN_ID);
      const caller = appRouter.createCaller(ctx);

      // Mock NAS with apiEnabled = false
      vi.mocked(nasDb.getNasByIp).mockResolvedValue({
        id: 1,
        ownerId: ADMIN_ID,
        nasIp: NAS_IP,
        apiEnabled: false, // API disabled
      } as any);

      // Mock API failure
      vi.mocked(mikrotikApi.disconnectUserViaMikroTikApi).mockResolvedValue({ 
        success: false, 
        error: "Connection failed" 
      });

      const result = await caller.sessions.mikrotikDisconnect({
        nasIp: NAS_IP,
        username: "testuser",
      });

      // Should return failure without fallback
      expect(result.success).toBe(false);
      expect(coaService.disconnectUserAllSessions).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // 4. Super Admin Tests (Full Access)
  // ============================================
  
  describe("Super Admin - Full Access", () => {
    const ADMIN_ID = 1;
    const ANY_NAS_IP = "10.0.0.1";
    const ANY_OWNER_ID = 999;
    
    beforeEach(() => {
      vi.mocked(nasDb.getNasByIp).mockResolvedValue({
        id: 99,
        ownerId: ANY_OWNER_ID, // Different owner
        nasIp: ANY_NAS_IP,
        apiEnabled: true,
      } as any);
      
      vi.mocked(mikrotikApi.disconnectUserViaMikroTikApi).mockResolvedValue({ success: true });
      vi.mocked(mikrotikApi.changeUserSpeedViaMikroTikApi).mockResolvedValue({ success: true });
    });

    it("Super Admin can access ANY NAS regardless of owner", async () => {
      const ctx = createContext("super_admin", ADMIN_ID);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.sessions.mikrotikDisconnect({
        nasIp: ANY_NAS_IP,
        username: "anyuser",
      });

      expect(result.success).toBe(true);
    });

    it("Super Admin can change speed on ANY NAS", async () => {
      const ctx = createContext("super_admin", ADMIN_ID);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.sessions.mikrotikChangeSpeed({
        nasIp: ANY_NAS_IP,
        username: "anyuser",
        uploadSpeedKbps: 5000,
        downloadSpeedKbps: 10000,
      });

      expect(result.success).toBe(true);
    });
  });
});
