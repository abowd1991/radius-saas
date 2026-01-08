import { describe, it, expect } from "vitest";
import {
  hasPermission,
  getRolePermissions,
  getAccessibleResources,
  canAccessResource,
  getResourceActions,
  isAdmin,
  canSeeFinancials,
  canManageUsers,
  getMenuItemsForRole,
  checkPermission,
  roleLabels,
  actionLabels,
  resourceLabels,
} from "./services/permissionsService";

describe("Permissions Service", () => {
  describe("hasPermission", () => {
    it("should allow super_admin full access to all resources", () => {
      expect(hasPermission("super_admin", "dashboard", "view")).toBe(true);
      expect(hasPermission("super_admin", "users", "create")).toBe(true);
      expect(hasPermission("super_admin", "users", "delete")).toBe(true);
      expect(hasPermission("super_admin", "settings", "edit")).toBe(true);
      expect(hasPermission("super_admin", "backups", "create")).toBe(true);
    });

    it("should allow reseller limited access", () => {
      expect(hasPermission("reseller", "dashboard", "view")).toBe(true);
      expect(hasPermission("reseller", "clients", "create")).toBe(true);
      expect(hasPermission("reseller", "cards", "view")).toBe(true);
      // Reseller cannot delete clients
      expect(hasPermission("reseller", "clients", "delete")).toBe(false);
      // Reseller cannot access backups
      expect(hasPermission("reseller", "backups", "view")).toBe(false);
    });

    it("should allow client basic access", () => {
      expect(hasPermission("client", "dashboard", "view")).toBe(true);
      expect(hasPermission("client", "cards", "view")).toBe(true);
      expect(hasPermission("client", "nas", "create")).toBe(true);
      // Client cannot access users
      expect(hasPermission("client", "users", "view")).toBe(false);
      // Client cannot access backups
      expect(hasPermission("client", "backups", "view")).toBe(false);
    });

    it("should allow support view-only access without financials", () => {
      expect(hasPermission("support", "dashboard", "view")).toBe(true);
      expect(hasPermission("support", "users", "view")).toBe(true);
      expect(hasPermission("support", "clients", "view")).toBe(true);
      expect(hasPermission("support", "cards", "view")).toBe(true);
      expect(hasPermission("support", "sessions", "view")).toBe(true);
      // Support cannot create/edit/delete cards
      expect(hasPermission("support", "cards", "create")).toBe(false);
      expect(hasPermission("support", "cards", "edit")).toBe(false);
      expect(hasPermission("support", "cards", "delete")).toBe(false);
      // Support cannot access financial reports
      expect(hasPermission("support", "reports", "view")).toBe(false);
      expect(hasPermission("support", "invoices", "view")).toBe(false);
      // Support cannot access settings
      expect(hasPermission("support", "settings", "view")).toBe(false);
      // Support cannot access backups
      expect(hasPermission("support", "backups", "view")).toBe(false);
    });

    it("should allow support to manage support tickets", () => {
      expect(hasPermission("support", "support", "view")).toBe(true);
      expect(hasPermission("support", "support", "create")).toBe(true);
      expect(hasPermission("support", "support", "edit")).toBe(true);
    });
  });

  describe("getRolePermissions", () => {
    it("should return all permissions for a role", () => {
      const adminPerms = getRolePermissions("super_admin");
      expect(adminPerms.dashboard).toContain("view");
      expect(adminPerms.users).toContain("create");
      expect(adminPerms.users).toContain("delete");
    });

    it("should return empty object for unknown role", () => {
      const perms = getRolePermissions("unknown" as any);
      expect(perms).toEqual({});
    });
  });

  describe("getAccessibleResources", () => {
    it("should return all resources for super_admin", () => {
      const resources = getAccessibleResources("super_admin");
      expect(resources).toContain("dashboard");
      expect(resources).toContain("users");
      expect(resources).toContain("backups");
      expect(resources.length).toBeGreaterThan(10);
    });

    it("should return limited resources for support", () => {
      const resources = getAccessibleResources("support");
      expect(resources).toContain("dashboard");
      expect(resources).toContain("users");
      expect(resources).toContain("support");
      expect(resources).not.toContain("invoices");
      expect(resources).not.toContain("reports");
      expect(resources).not.toContain("backups");
    });
  });

  describe("canAccessResource", () => {
    it("should return true if role can access resource", () => {
      expect(canAccessResource("super_admin", "backups")).toBe(true);
      expect(canAccessResource("support", "dashboard")).toBe(true);
    });

    it("should return false if role cannot access resource", () => {
      expect(canAccessResource("support", "backups")).toBe(false);
      expect(canAccessResource("client", "users")).toBe(false);
    });
  });

  describe("getResourceActions", () => {
    it("should return all actions for super_admin on users", () => {
      const actions = getResourceActions("super_admin", "users");
      expect(actions).toContain("view");
      expect(actions).toContain("create");
      expect(actions).toContain("edit");
      expect(actions).toContain("delete");
    });

    it("should return view only for support on users", () => {
      const actions = getResourceActions("support", "users");
      expect(actions).toEqual(["view"]);
    });

    it("should return empty array for inaccessible resource", () => {
      const actions = getResourceActions("support", "backups");
      expect(actions).toEqual([]);
    });
  });

  describe("isAdmin", () => {
    it("should return true only for super_admin", () => {
      expect(isAdmin("super_admin")).toBe(true);
      expect(isAdmin("reseller")).toBe(false);
      expect(isAdmin("client")).toBe(false);
      expect(isAdmin("support")).toBe(false);
    });
  });

  describe("canSeeFinancials", () => {
    it("should return true for super_admin and reseller", () => {
      expect(canSeeFinancials("super_admin")).toBe(true);
      expect(canSeeFinancials("reseller")).toBe(true);
    });

    it("should return false for client and support", () => {
      expect(canSeeFinancials("client")).toBe(false);
      expect(canSeeFinancials("support")).toBe(false);
    });
  });

  describe("canManageUsers", () => {
    it("should return true only for super_admin", () => {
      expect(canManageUsers("super_admin")).toBe(true);
      expect(canManageUsers("reseller")).toBe(false);
      expect(canManageUsers("client")).toBe(false);
      expect(canManageUsers("support")).toBe(false);
    });
  });

  describe("getMenuItemsForRole", () => {
    it("should return appropriate menu items for each role", () => {
      const adminMenu = getMenuItemsForRole("super_admin");
      expect(adminMenu).toContain("dashboard");
      expect(adminMenu).toContain("backups");

      const supportMenu = getMenuItemsForRole("support");
      expect(supportMenu).toContain("dashboard");
      expect(supportMenu).not.toContain("backups");
      expect(supportMenu).not.toContain("invoices");
    });
  });

  describe("checkPermission", () => {
    it("should return allowed: true for valid permissions", () => {
      const result = checkPermission("super_admin", "users", "delete");
      expect(result.allowed).toBe(true);
    });

    it("should return allowed: false with reason for invalid permissions", () => {
      const result = checkPermission("support", "backups", "view");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe("Labels", () => {
    it("should have Arabic labels for all roles", () => {
      expect(roleLabels.super_admin).toBe("مدير النظام");
      expect(roleLabels.reseller).toBe("موزع");
      expect(roleLabels.client).toBe("عميل");
      expect(roleLabels.support).toBe("دعم فني");
    });

    it("should have Arabic labels for all actions", () => {
      expect(actionLabels.view).toBe("عرض");
      expect(actionLabels.create).toBe("إنشاء");
      expect(actionLabels.edit).toBe("تعديل");
      expect(actionLabels.delete).toBe("حذف");
    });

    it("should have Arabic labels for all resources", () => {
      expect(resourceLabels.dashboard).toBe("لوحة التحكم");
      expect(resourceLabels.users).toBe("المستخدمين");
      expect(resourceLabels.support).toBe("الدعم الفني");
    });
  });
});
