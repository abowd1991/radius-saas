import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users, featureAccessControl } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Feature Access Control", () => {
  let db: any;
  let ownerId: number;
  let clientId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test owner
    const ownerResult = await db.insert(users).values({
      username: "test_owner_fac",
      email: "owner_fac@test.com",
      name: "Test Owner FAC",
      role: "owner",
      status: "active",
      accountStatus: "active",
    });
    ownerId = ownerResult[0].insertId;

    // Create test client
    const clientResult = await db.insert(users).values({
      username: "test_client_fac",
      email: "client_fac@test.com",
      name: "Test Client FAC",
      role: "client",
      status: "active",
      accountStatus: "active",
      ownerId: ownerId,
    });
    clientId = clientResult[0].insertId;
  });

  afterAll(async () => {
    if (!db) return;
    // Cleanup
    await db.delete(featureAccessControl).where(eq(featureAccessControl.userId, clientId));
    await db.delete(users).where(eq(users.id, clientId));
    await db.delete(users).where(eq(users.id, ownerId));
  });

  it("should list clients with permission status", async () => {
    const caller = appRouter.createCaller({
      user: { id: ownerId, role: "owner" },
    } as any);

    const result = await caller.featureAccess.listClientsWithPermissions();
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    
    const testClient = result.find((c: any) => c.id === clientId);
    expect(testClient).toBeDefined();
    expect(testClient?.hasCustomPermissions).toBe(false);
  });

  it("should get default permissions for client without custom settings", async () => {
    const caller = appRouter.createCaller({
      user: { id: ownerId, role: "owner" },
    } as any);

    const permissions = await caller.featureAccess.getUserPermissions({
      userId: clientId,
    });

    expect(permissions).toBeDefined();
    expect(permissions.canViewDashboard).toBe(true);
    expect(permissions.canManageNas).toBe(true);
    expect(permissions.canViewRadiusLogs).toBe(false);
  });

  it("should update client permissions", async () => {
    const caller = appRouter.createCaller({
      user: { id: ownerId, role: "owner" },
    } as any);

    const result = await caller.featureAccess.updatePermissions({
      userId: clientId,
      permissions: {
        canViewDashboard: false,
        canViewRadiusLogs: true,
        canManageNas: false,
      },
    });

    expect(result.success).toBe(true);

    // Verify permissions were updated
    const updatedPermissions = await caller.featureAccess.getUserPermissions({
      userId: clientId,
    });

    expect(updatedPermissions.canViewDashboard).toBe(false);
    expect(updatedPermissions.canViewRadiusLogs).toBe(true);
    expect(updatedPermissions.canManageNas).toBe(false);
  });

  it("should prevent non-owner from updating permissions", async () => {
    const caller = appRouter.createCaller({
      user: { id: clientId, role: "client" },
    } as any);

    await expect(
      caller.featureAccess.updatePermissions({
        userId: clientId,
        permissions: {
          canViewDashboard: true,
        },
      })
    ).rejects.toThrow("Only owner can update permissions");
  });

  it("should prevent non-owner from listing clients", async () => {
    const caller = appRouter.createCaller({
      user: { id: clientId, role: "client" },
    } as any);

    await expect(
      caller.featureAccess.listClientsWithPermissions()
    ).rejects.toThrow("Only owner can list clients");
  });
});
