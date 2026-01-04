import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

// Mock user types
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Helper to create mock context
function createMockContext(role: "super_admin" | "reseller" | "client" = "super_admin"): { 
  ctx: TrpcContext; 
  clearedCookies: CookieCall[] 
} {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: role,
    status: "active",
    phone: null,
    address: null,
    resellerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Auth Router", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const { ctx } = createMockContext("super_admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@example.com");
    expect(result?.role).toBe("super_admin");
  });

  it("clears session cookie on logout", async () => {
    const { ctx, clearedCookies } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("Plans Router", () => {
  it("lists plans for authenticated user", async () => {
    const { ctx } = createMockContext("super_admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.plans.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("validates plan creation input", async () => {
    const { ctx } = createMockContext("super_admin");
    const caller = appRouter.createCaller(ctx);
    
    // Test that invalid input throws
    await expect(caller.plans.create({
      name: "",
      nameAr: "",
      price: "invalid",
      resellerPrice: "invalid",
      duration: -1,
      downloadSpeed: -1,
      uploadSpeed: -1,
    })).rejects.toThrow();
  });
});

describe("NAS Router", () => {
  it("lists NAS devices for super admin", async () => {
    const { ctx } = createMockContext("super_admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.nas.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("validates NAS creation input", async () => {
    const { ctx } = createMockContext("super_admin");
    const caller = appRouter.createCaller(ctx);
    
    // Test that invalid input throws
    await expect(caller.nas.create({
      name: "",
      ipAddress: "invalid-ip",
      secret: "",
      type: "invalid" as any,
    })).rejects.toThrow();
  });
});

describe("Wallet Router", () => {
  it("gets wallet for authenticated user", async () => {
    const { ctx } = createMockContext("client");
    const caller = appRouter.createCaller(ctx);
    
    // This may return null if no wallet exists yet
    const result = await caller.wallet.getMyWallet();
    // Just verify it doesn't throw
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("gets transactions for authenticated user", async () => {
    const { ctx } = createMockContext("client");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.wallet.getTransactions({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Vouchers Router", () => {
  it("lists vouchers for reseller", async () => {
    const { ctx } = createMockContext("reseller");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.vouchers.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Invoices Router", () => {
  it("lists invoices for authenticated user", async () => {
    const { ctx } = createMockContext("super_admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.invoices.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Tickets Router", () => {
  it("lists tickets for authenticated user", async () => {
    const { ctx } = createMockContext("client");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.tickets.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("validates ticket creation input", async () => {
    const { ctx } = createMockContext("client");
    const caller = appRouter.createCaller(ctx);
    
    // Test that invalid input throws
    await expect(caller.tickets.create({
      subject: "",
      message: "",
      priority: "invalid" as any,
    })).rejects.toThrow();
  });
});

describe("Notifications Router", () => {
  it("lists notifications for authenticated user", async () => {
    const { ctx } = createMockContext("client");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.notifications.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Users Router", () => {
  it("lists users for super admin", async () => {
    const { ctx } = createMockContext("super_admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
