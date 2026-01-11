import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Mock the sshVpnService
vi.mock("./services/sshVpnService", () => ({
  getVpnUserLocalIp: vi.fn(),
  createVpnUser: vi.fn().mockResolvedValue({ success: true }),
  deleteVpnUser: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock the nasDb
vi.mock("./db/nas", () => ({
  getNasById: vi.fn(),
  updateNas: vi.fn().mockResolvedValue({}),
  createNas: vi.fn().mockResolvedValue({ id: 1 }),
}));

// Mock getDb
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  getSystemSettings: vi.fn().mockResolvedValue({}),
}));

function createAuthContext(role: "user" | "super_admin" = "user", userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role,
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
    } as unknown as TrpcContext["res"],
  };
}

describe("nas.getVpnStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isVpn=false for public_ip connection type", async () => {
    const nasDb = await import("./db/nas");
    vi.mocked(nasDb.getNasById).mockResolvedValue({
      id: 1,
      nasname: "192.168.1.1",
      shortname: "test-nas",
      secret: "secret123",
      type: "mikrotik",
      status: "active",
      connectionType: "public_ip",
      ownerId: 1,
      vpnUsername: null,
      vpnPassword: null,
      vpnTunnelIp: null,
      description: null,
      server: null,
      community: null,
      ports: null,
      apiEnabled: false,
      mikrotikApiPort: 8728,
      mikrotikApiUser: null,
      mikrotikApiPassword: null,
      lastSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ctx = createAuthContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nas.getVpnStatus({ id: 1 });

    expect(result.isVpn).toBe(false);
    expect(result.connected).toBeNull();
    expect(result.needsSync).toBe(false);
  });

  it("returns connected=true when VPN session has local IP", async () => {
    const nasDb = await import("./db/nas");
    const sshVpn = await import("./services/sshVpnService");
    
    vi.mocked(nasDb.getNasById).mockResolvedValue({
      id: 1,
      nasname: "pending-vpn-123",
      shortname: "test-nas",
      secret: "secret123",
      type: "mikrotik",
      status: "active",
      connectionType: "vpn_l2tp",
      ownerId: 1,
      vpnUsername: "test-user@VPN",
      vpnPassword: "test-pass",
      vpnTunnelIp: null,
      description: null,
      server: null,
      community: null,
      ports: null,
      apiEnabled: false,
      mikrotikApiPort: 8728,
      mikrotikApiUser: null,
      mikrotikApiPassword: null,
      lastSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    vi.mocked(sshVpn.getVpnUserLocalIp).mockResolvedValue("192.168.30.100");

    const ctx = createAuthContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nas.getVpnStatus({ id: 1 });

    expect(result.isVpn).toBe(true);
    expect(result.connected).toBe(true);
    expect(result.vpnLocalIp).toBe("192.168.30.100");
    expect(result.needsSync).toBe(true); // nasname is placeholder, needs sync
  });

  it("returns connected=false when VPN session has no local IP", async () => {
    const nasDb = await import("./db/nas");
    const sshVpn = await import("./services/sshVpnService");
    
    vi.mocked(nasDb.getNasById).mockResolvedValue({
      id: 1,
      nasname: "pending-vpn-123",
      shortname: "test-nas",
      secret: "secret123",
      type: "mikrotik",
      status: "active",
      connectionType: "vpn_l2tp",
      ownerId: 1,
      vpnUsername: "test-user@VPN",
      vpnPassword: "test-pass",
      vpnTunnelIp: null,
      description: null,
      server: null,
      community: null,
      ports: null,
      apiEnabled: false,
      mikrotikApiPort: 8728,
      mikrotikApiUser: null,
      mikrotikApiPassword: null,
      lastSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    vi.mocked(sshVpn.getVpnUserLocalIp).mockResolvedValue(null);

    const ctx = createAuthContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nas.getVpnStatus({ id: 1 });

    expect(result.isVpn).toBe(true);
    expect(result.connected).toBe(false);
    expect(result.vpnLocalIp).toBeNull();
  });

  it("throws FORBIDDEN for non-owner access", async () => {
    const nasDb = await import("./db/nas");
    
    vi.mocked(nasDb.getNasById).mockResolvedValue({
      id: 1,
      nasname: "192.168.1.1",
      shortname: "test-nas",
      secret: "secret123",
      type: "mikrotik",
      status: "active",
      connectionType: "vpn_l2tp",
      ownerId: 2, // Different owner
      vpnUsername: "test-user@VPN",
      vpnPassword: "test-pass",
      vpnTunnelIp: null,
      description: null,
      server: null,
      community: null,
      ports: null,
      apiEnabled: false,
      mikrotikApiPort: 8728,
      mikrotikApiUser: null,
      mikrotikApiPassword: null,
      lastSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ctx = createAuthContext("user", 1); // User 1 trying to access NAS owned by user 2
    const caller = appRouter.createCaller(ctx);

    await expect(caller.nas.getVpnStatus({ id: 1 })).rejects.toThrow("Access denied");
  });
});

describe("nas.syncVpnIp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success=false for public_ip connection type", async () => {
    const nasDb = await import("./db/nas");
    
    vi.mocked(nasDb.getNasById).mockResolvedValue({
      id: 1,
      nasname: "192.168.1.1",
      shortname: "test-nas",
      secret: "secret123",
      type: "mikrotik",
      status: "active",
      connectionType: "public_ip",
      ownerId: 1,
      vpnUsername: null,
      vpnPassword: null,
      vpnTunnelIp: null,
      description: null,
      server: null,
      community: null,
      ports: null,
      apiEnabled: false,
      mikrotikApiPort: 8728,
      mikrotikApiUser: null,
      mikrotikApiPassword: null,
      lastSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ctx = createAuthContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nas.syncVpnIp({ id: 1 });

    expect(result.success).toBe(false);
    expect(result.message).toContain("IP عام");
  });

  it("updates nasname when VPN is connected", async () => {
    const nasDb = await import("./db/nas");
    const sshVpn = await import("./services/sshVpnService");
    
    vi.mocked(nasDb.getNasById).mockResolvedValue({
      id: 1,
      nasname: "pending-vpn-123",
      shortname: "test-nas",
      secret: "secret123",
      type: "mikrotik",
      status: "active",
      connectionType: "vpn_l2tp",
      ownerId: 1,
      vpnUsername: "test-user@VPN",
      vpnPassword: "test-pass",
      vpnTunnelIp: null,
      description: null,
      server: null,
      community: null,
      ports: null,
      apiEnabled: false,
      mikrotikApiPort: 8728,
      mikrotikApiUser: null,
      mikrotikApiPassword: null,
      lastSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    vi.mocked(sshVpn.getVpnUserLocalIp).mockResolvedValue("192.168.30.100");

    const ctx = createAuthContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nas.syncVpnIp({ id: 1 });

    expect(result.success).toBe(true);
    expect(result.newNasname).toBe("192.168.30.100");
    expect(nasDb.updateNas).toHaveBeenCalledWith(1, { ipAddress: "192.168.30.100" });
  });

  it("returns error when VPN is not connected", async () => {
    const nasDb = await import("./db/nas");
    const sshVpn = await import("./services/sshVpnService");
    
    vi.mocked(nasDb.getNasById).mockResolvedValue({
      id: 1,
      nasname: "pending-vpn-123",
      shortname: "test-nas",
      secret: "secret123",
      type: "mikrotik",
      status: "active",
      connectionType: "vpn_l2tp",
      ownerId: 1,
      vpnUsername: "test-user@VPN",
      vpnPassword: "test-pass",
      vpnTunnelIp: null,
      description: null,
      server: null,
      community: null,
      ports: null,
      apiEnabled: false,
      mikrotikApiPort: 8728,
      mikrotikApiUser: null,
      mikrotikApiPassword: null,
      lastSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    vi.mocked(sshVpn.getVpnUserLocalIp).mockResolvedValue(null);

    const ctx = createAuthContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nas.syncVpnIp({ id: 1 });

    expect(result.success).toBe(false);
    expect(result.message).toContain("غير متصل");
  });
});

describe("nas.updateVpnIp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates IPv4 address format", async () => {
    const nasDb = await import("./db/nas");
    
    vi.mocked(nasDb.getNasById).mockResolvedValue({
      id: 1,
      nasname: "pending-vpn-123",
      shortname: "test-nas",
      secret: "secret123",
      type: "mikrotik",
      status: "active",
      connectionType: "vpn_l2tp",
      ownerId: 1,
      vpnUsername: "test-user@VPN",
      vpnPassword: "test-pass",
      vpnTunnelIp: null,
      description: null,
      server: null,
      community: null,
      ports: null,
      apiEnabled: false,
      mikrotikApiPort: 8728,
      mikrotikApiUser: null,
      mikrotikApiPassword: null,
      lastSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ctx = createAuthContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    // Invalid IP should throw
    await expect(caller.nas.updateVpnIp({ id: 1, vpnLocalIp: "invalid-ip" })).rejects.toThrow();
    
    // Valid IP should succeed
    const result = await caller.nas.updateVpnIp({ id: 1, vpnLocalIp: "192.168.30.100" });
    expect(result.success).toBe(true);
    expect(result.newNasname).toBe("192.168.30.100");
  });
});
