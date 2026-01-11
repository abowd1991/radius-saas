import { describe, expect, it, vi, beforeEach } from "vitest";
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
  changeUserSpeedViaMikroTikApi: vi.fn().mockResolvedValue({ success: true }),
  disconnectUserViaMikroTikApi: vi.fn().mockResolvedValue({ success: true }),
  getActiveUsersViaMikroTikApi: vi.fn().mockResolvedValue({ success: true, users: [] }),
}));

vi.mock("./services/auditLogService", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import * as nasDb from "./db/nas";
import * as cardDb from "./db/vouchers";

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

describe("Session Permissions - CoA Disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("super_admin can disconnect any NAS", async () => {
    const ctx = createContext("super_admin", 1);
    const caller = appRouter.createCaller(ctx);

    // Mock NAS owned by another user
    vi.mocked(nasDb.getNasByIp).mockResolvedValue({
      id: 1,
      ownerId: 999, // Different owner
      nasIp: "192.168.1.1",
      coaEnabled: true,
    } as any);

    const result = await caller.sessions.coaDisconnect({
      username: "testuser",
      nasIp: "192.168.1.1",
    });

    expect(result.success).toBe(true);
  });

  it("reseller can disconnect their own NAS", async () => {
    const ctx = createContext("reseller", 10);
    const caller = appRouter.createCaller(ctx);

    // Mock NAS owned by the reseller
    vi.mocked(nasDb.getNasByIp).mockResolvedValue({
      id: 1,
      ownerId: 10, // Same as reseller
      nasIp: "192.168.1.1",
      coaEnabled: true,
    } as any);

    const result = await caller.sessions.coaDisconnect({
      username: "testuser",
      nasIp: "192.168.1.1",
    });

    expect(result.success).toBe(true);
  });

  it("reseller cannot disconnect another user's NAS", async () => {
    const ctx = createContext("reseller", 10);
    const caller = appRouter.createCaller(ctx);

    // Mock NAS owned by another user
    vi.mocked(nasDb.getNasByIp).mockResolvedValue({
      id: 1,
      ownerId: 999, // Different owner
      nasIp: "192.168.1.1",
      coaEnabled: true,
    } as any);

    await expect(
      caller.sessions.coaDisconnect({
        username: "testuser",
        nasIp: "192.168.1.1",
      })
    ).rejects.toThrow("Access denied to this NAS");
  });

  it("throws NOT_FOUND when NAS doesn't exist", async () => {
    const ctx = createContext("super_admin", 1);
    const caller = appRouter.createCaller(ctx);

    vi.mocked(nasDb.getNasByIp).mockResolvedValue(null);

    await expect(
      caller.sessions.coaDisconnect({
        username: "testuser",
        nasIp: "192.168.1.1",
      })
    ).rejects.toThrow("NAS not found");
  });
});

describe("Session Permissions - MikroTik API Change Speed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("super_admin can change speed on any NAS", async () => {
    const ctx = createContext("super_admin", 1);
    const caller = appRouter.createCaller(ctx);

    vi.mocked(nasDb.getNasByIp).mockResolvedValue({
      id: 1,
      ownerId: 999,
      nasIp: "192.168.1.1",
      coaEnabled: true,
    } as any);

    const result = await caller.sessions.mikrotikChangeSpeed({
      nasIp: "192.168.1.1",
      username: "testuser",
      uploadSpeedKbps: 1000,
      downloadSpeedKbps: 2000,
    });

    expect(result.success).toBe(true);
  });

  it("reseller can change speed on their own NAS", async () => {
    const ctx = createContext("reseller", 10);
    const caller = appRouter.createCaller(ctx);

    vi.mocked(nasDb.getNasByIp).mockResolvedValue({
      id: 1,
      ownerId: 10,
      nasIp: "192.168.1.1",
      coaEnabled: true,
    } as any);

    const result = await caller.sessions.mikrotikChangeSpeed({
      nasIp: "192.168.1.1",
      username: "testuser",
      uploadSpeedKbps: 1000,
      downloadSpeedKbps: 2000,
    });

    expect(result.success).toBe(true);
  });

  it("reseller cannot change speed on another user's NAS", async () => {
    const ctx = createContext("reseller", 10);
    const caller = appRouter.createCaller(ctx);

    vi.mocked(nasDb.getNasByIp).mockResolvedValue({
      id: 1,
      ownerId: 999,
      nasIp: "192.168.1.1",
      coaEnabled: true,
    } as any);

    await expect(
      caller.sessions.mikrotikChangeSpeed({
        nasIp: "192.168.1.1",
        username: "testuser",
        uploadSpeedKbps: 1000,
        downloadSpeedKbps: 2000,
      })
    ).rejects.toThrow("Access denied to this NAS");
  });
});

describe("Session Permissions - Change User Speed (CoA)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("super_admin can change any user's speed", async () => {
    const ctx = createContext("super_admin", 1);
    const caller = appRouter.createCaller(ctx);

    vi.mocked(cardDb.getCardByUsername).mockResolvedValue({
      id: 1,
      username: "testuser",
      createdBy: 999,
      resellerId: null,
    } as any);

    const result = await caller.sessions.changeUserSpeed({
      username: "testuser",
      uploadSpeedMbps: 1,
      downloadSpeedMbps: 2,
    });

    expect(result.success).toBe(true);
  });

  it("reseller can change speed for their own cards", async () => {
    const ctx = createContext("reseller", 10);
    const caller = appRouter.createCaller(ctx);

    vi.mocked(cardDb.getCardByUsername).mockResolvedValue({
      id: 1,
      username: "testuser",
      createdBy: 10, // Created by the reseller
      resellerId: null,
    } as any);

    const result = await caller.sessions.changeUserSpeed({
      username: "testuser",
      uploadSpeedMbps: 1,
      downloadSpeedMbps: 2,
    });

    expect(result.success).toBe(true);
  });

  it("reseller can change speed for cards under their resellerId", async () => {
    const ctx = createContext("reseller", 10);
    const caller = appRouter.createCaller(ctx);

    vi.mocked(cardDb.getCardByUsername).mockResolvedValue({
      id: 1,
      username: "testuser",
      createdBy: 999,
      resellerId: 10, // Under the reseller
    } as any);

    const result = await caller.sessions.changeUserSpeed({
      username: "testuser",
      uploadSpeedMbps: 1,
      downloadSpeedMbps: 2,
    });

    expect(result.success).toBe(true);
  });

  it("reseller cannot change speed for other users' cards", async () => {
    const ctx = createContext("reseller", 10);
    const caller = appRouter.createCaller(ctx);

    vi.mocked(cardDb.getCardByUsername).mockResolvedValue({
      id: 1,
      username: "testuser",
      createdBy: 999,
      resellerId: 888, // Different reseller
    } as any);

    await expect(
      caller.sessions.changeUserSpeed({
        username: "testuser",
        uploadSpeedMbps: 1,
        downloadSpeedMbps: 2,
      })
    ).rejects.toThrow("Access denied to this user");
  });

  it("throws NOT_FOUND when user doesn't exist", async () => {
    const ctx = createContext("super_admin", 1);
    const caller = appRouter.createCaller(ctx);

    vi.mocked(cardDb.getCardByUsername).mockResolvedValue(null);

    await expect(
      caller.sessions.changeUserSpeed({
        username: "nonexistent",
        uploadSpeedMbps: 1,
        downloadSpeedMbps: 2,
      })
    ).rejects.toThrow("User not found");
  });
});
