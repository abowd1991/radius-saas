import { describe, it, expect, beforeAll } from "vitest";
import { getTenantContext, canSeeAllData, getEffectiveOwnerId } from "./tenant-isolation";

describe("Tenant Isolation", () => {
  describe("getTenantContext", () => {
    it("should extract tenant context from owner user", () => {
      const user = { id: 1, role: "owner" as const, tenantId: null, resellerId: null } as any;
      const context = getTenantContext(user);
      
      expect(context.userId).toBe(1);
      expect(context.role).toBe("owner");
      expect(context.tenantId).toBeNull();
    });

    it("should extract tenant context from client_owner", () => {
      const user = { id: 2, role: "client_owner" as const, tenantId: null, resellerId: null } as any;
      const context = getTenantContext(user);
      
      expect(context.userId).toBe(2);
      expect(context.role).toBe("client_owner");
      expect(context.tenantId).toBeNull();
    });

    it("should extract tenant context from client_admin (sub-admin)", () => {
      const user = { id: 3, role: "client_admin" as const, tenantId: 2, resellerId: null } as any;
      const context = getTenantContext(user);
      
      expect(context.userId).toBe(3);
      expect(context.role).toBe("client_admin");
      expect(context.tenantId).toBe(2); // Points to parent client
    });

    it("should extract tenant context from client_staff", () => {
      const user = { id: 4, role: "client_staff" as const, tenantId: 2, resellerId: null } as any;
      const context = getTenantContext(user);
      
      expect(context.userId).toBe(4);
      expect(context.role).toBe("client_staff");
      expect(context.tenantId).toBe(2);
    });
  });

  describe("canSeeAllData", () => {
    it("should return true for owner", () => {
      const context = { userId: 1, role: "owner" as const, tenantId: null };
      expect(canSeeAllData(context)).toBe(true);
    });

    it("should return true for super_admin", () => {
      const context = { userId: 1, role: "super_admin" as const, tenantId: null };
      expect(canSeeAllData(context)).toBe(true);
    });

    it("should return false for client_owner", () => {
      const context = { userId: 2, role: "client_owner" as const, tenantId: null };
      expect(canSeeAllData(context)).toBe(false);
    });

    it("should return false for client_admin", () => {
      const context = { userId: 3, role: "client_admin" as const, tenantId: 2 };
      expect(canSeeAllData(context)).toBe(false);
    });

    it("should return false for client_staff", () => {
      const context = { userId: 4, role: "client_staff" as const, tenantId: 2 };
      expect(canSeeAllData(context)).toBe(false);
    });

    it("should return false for reseller", () => {
      const context = { userId: 5, role: "reseller" as const, tenantId: null };
      expect(canSeeAllData(context)).toBe(false);
    });
  });

  describe("getEffectiveOwnerId", () => {
    it("should return userId for client_owner", () => {
      const context = { userId: 2, role: "client_owner" as const, tenantId: null };
      expect(getEffectiveOwnerId(context)).toBe(2);
    });

    it("should return tenantId for client_admin", () => {
      const context = { userId: 3, role: "client_admin" as const, tenantId: 2 };
      expect(getEffectiveOwnerId(context)).toBe(2); // Parent client's ID
    });

    it("should return tenantId for client_staff", () => {
      const context = { userId: 4, role: "client_staff" as const, tenantId: 2 };
      expect(getEffectiveOwnerId(context)).toBe(2); // Parent client's ID
    });

    it("should return userId for reseller", () => {
      const context = { userId: 5, role: "reseller" as const, tenantId: null };
      expect(getEffectiveOwnerId(context)).toBe(5);
    });

    it("should return userId for owner", () => {
      const context = { userId: 1, role: "owner" as const, tenantId: null };
      expect(getEffectiveOwnerId(context)).toBe(1);
    });
  });

  describe("Tenant Isolation Scenarios", () => {
    it("Scenario 1: Client A cannot see Client B's data", () => {
      const clientA = { id: 10, role: "client_owner" as const, tenantId: null, resellerId: null };
      const clientB = { id: 20, role: "client_owner" as const, tenantId: null, resellerId: null };
      
      const contextA = getTenantContext(clientA);
      const contextB = getTenantContext(clientB);
      
      // Each client should only see their own data
      expect(getEffectiveOwnerId(contextA)).toBe(10);
      expect(getEffectiveOwnerId(contextB)).toBe(20);
      expect(getEffectiveOwnerId(contextA)).not.toBe(getEffectiveOwnerId(contextB));
    });

    it("Scenario 2: Sub-admin sees parent client's data", () => {
      const clientOwner = { id: 10, role: "client_owner" as const, tenantId: null, resellerId: null };
      const subAdmin = { id: 11, role: "client_admin" as const, tenantId: 10, resellerId: null };
      
      const ownerContext = getTenantContext(clientOwner);
      const subAdminContext = getTenantContext(subAdmin);
      
      // Sub-admin should see same data as owner
      expect(getEffectiveOwnerId(ownerContext)).toBe(10);
      expect(getEffectiveOwnerId(subAdminContext)).toBe(10); // Same as owner
    });

    it("Scenario 3: Owner sees all data", () => {
      const owner = { id: 1, role: "owner" as const, tenantId: null, resellerId: null };
      const context = getTenantContext(owner);
      
      expect(canSeeAllData(context)).toBe(true);
    });

    it("Scenario 4: Multiple sub-admins of same client see same data", () => {
      const subAdmin1 = { id: 11, role: "client_admin" as const, tenantId: 10, resellerId: null };
      const subAdmin2 = { id: 12, role: "client_staff" as const, tenantId: 10, resellerId: null };
      
      const context1 = getTenantContext(subAdmin1);
      const context2 = getTenantContext(subAdmin2);
      
      // Both should see client 10's data
      expect(getEffectiveOwnerId(context1)).toBe(10);
      expect(getEffectiveOwnerId(context2)).toBe(10);
    });

    it("Scenario 5: Sub-admins of different clients are isolated", () => {
      const subAdminA = { id: 11, role: "client_admin" as const, tenantId: 10, resellerId: null };
      const subAdminB = { id: 21, role: "client_admin" as const, tenantId: 20, resellerId: null };
      
      const contextA = getTenantContext(subAdminA);
      const contextB = getTenantContext(subAdminB);
      
      // Each sub-admin sees only their parent client's data
      expect(getEffectiveOwnerId(contextA)).toBe(10);
      expect(getEffectiveOwnerId(contextB)).toBe(20);
      expect(getEffectiveOwnerId(contextA)).not.toBe(getEffectiveOwnerId(contextB));
    });
  });
});
