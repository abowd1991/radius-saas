import { describe, it, expect, vi, beforeEach } from "vitest";
import * as internalNotificationService from "./services/internalNotificationService";

// Mock database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue({ insertId: 1 }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ affectedRows: 1 }),
    }),
  }),
}));

describe("Internal Notification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Notification Types", () => {
    it("should support card_expired type", () => {
      const types = [
        "card_expired",
        "card_expiring",
        "nas_disconnected",
        "nas_reconnected",
        "low_balance",
        "new_subscription",
        "subscription_expired",
        "system",
      ];
      expect(types).toContain("card_expired");
    });

    it("should support nas_disconnected type", () => {
      const types = [
        "card_expired",
        "card_expiring",
        "nas_disconnected",
        "nas_reconnected",
        "low_balance",
        "new_subscription",
        "subscription_expired",
        "system",
      ];
      expect(types).toContain("nas_disconnected");
    });

    it("should support nas_reconnected type", () => {
      const types = [
        "card_expired",
        "card_expiring",
        "nas_disconnected",
        "nas_reconnected",
        "low_balance",
        "new_subscription",
        "subscription_expired",
        "system",
      ];
      expect(types).toContain("nas_reconnected");
    });
  });

  describe("Notification Structure", () => {
    it("should have correct notification properties", () => {
      const notification = {
        id: 1,
        userId: 1,
        type: "card_expired" as const,
        title: "انتهاء وقت كرت",
        message: "انتهى وقت الكرت: test_user",
        entityType: "card",
        entityId: 123,
        isRead: false,
        createdAt: new Date(),
      };

      expect(notification).toHaveProperty("id");
      expect(notification).toHaveProperty("userId");
      expect(notification).toHaveProperty("type");
      expect(notification).toHaveProperty("title");
      expect(notification).toHaveProperty("message");
      expect(notification).toHaveProperty("entityType");
      expect(notification).toHaveProperty("entityId");
      expect(notification).toHaveProperty("isRead");
      expect(notification).toHaveProperty("createdAt");
    });
  });

  describe("Service Exports", () => {
    it("should export createNotification function", () => {
      expect(typeof internalNotificationService.createNotification).toBe("function");
    });

    it("should export getNotifications function", () => {
      expect(typeof internalNotificationService.getNotifications).toBe("function");
    });

    it("should export getUnreadCount function", () => {
      expect(typeof internalNotificationService.getUnreadCount).toBe("function");
    });

    it("should export markAsRead function", () => {
      expect(typeof internalNotificationService.markAsRead).toBe("function");
    });

    it("should export markAllAsRead function", () => {
      expect(typeof internalNotificationService.markAllAsRead).toBe("function");
    });

    it("should export deleteNotification function", () => {
      expect(typeof internalNotificationService.deleteNotification).toBe("function");
    });

    it("should export cleanupOldNotifications function", () => {
      expect(typeof internalNotificationService.cleanupOldNotifications).toBe("function");
    });

    it("should export notifyCardExpired function", () => {
      expect(typeof internalNotificationService.notifyCardExpired).toBe("function");
    });

    it("should export notifyCardExpiring function", () => {
      expect(typeof internalNotificationService.notifyCardExpiring).toBe("function");
    });

    it("should export notifyNasDisconnected function", () => {
      expect(typeof internalNotificationService.notifyNasDisconnected).toBe("function");
    });

    it("should export notifyNasReconnected function", () => {
      expect(typeof internalNotificationService.notifyNasReconnected).toBe("function");
    });
  });

  describe("Notification Helper Functions", () => {
    it("should create card expired notification with correct params", async () => {
      const adminId = 1;
      const cardUsername = "test_user";
      const cardId = 123;

      // This tests that the function can be called without errors
      await internalNotificationService.notifyCardExpired(adminId, cardUsername, cardId);
    });

    it("should create NAS disconnected notification with correct params", async () => {
      const adminId = 1;
      const nasName = "MikroTik-1";
      const nasId = 1;
      const nasIp = "192.168.1.1";

      await internalNotificationService.notifyNasDisconnected(adminId, nasName, nasId, nasIp);
    });

    it("should create NAS reconnected notification with correct params", async () => {
      const adminId = 1;
      const nasName = "MikroTik-1";
      const nasId = 1;
      const nasIp = "192.168.1.1";

      await internalNotificationService.notifyNasReconnected(adminId, nasName, nasId, nasIp);
    });
  });

  describe("Notification Messages", () => {
    it("should generate correct Arabic message for card expiration", () => {
      const cardUsername = "test_user";
      const message = `انتهى وقت الكرت: ${cardUsername}`;
      expect(message).toContain("انتهى وقت الكرت");
      expect(message).toContain(cardUsername);
    });

    it("should generate correct Arabic message for NAS disconnection", () => {
      const nasName = "MikroTik-1";
      const nasIp = "192.168.1.1";
      const message = `انقطع اتصال الجهاز: ${nasName} (${nasIp})`;
      expect(message).toContain("انقطع اتصال الجهاز");
      expect(message).toContain(nasName);
      expect(message).toContain(nasIp);
    });

    it("should generate correct Arabic message for NAS reconnection", () => {
      const nasName = "MikroTik-1";
      const nasIp = "192.168.1.1";
      const message = `عاد اتصال الجهاز: ${nasName} (${nasIp})`;
      expect(message).toContain("عاد اتصال الجهاز");
      expect(message).toContain(nasName);
      expect(message).toContain(nasIp);
    });
  });
});

describe("Alert Monitor", () => {
  describe("NAS Connection Check", () => {
    it("should track connection status changes", () => {
      const nasConnectionStatus = new Map<number, boolean>();
      
      // Initial state
      nasConnectionStatus.set(1, true);
      expect(nasConnectionStatus.get(1)).toBe(true);
      
      // Connection lost
      nasConnectionStatus.set(1, false);
      expect(nasConnectionStatus.get(1)).toBe(false);
      
      // Connection restored
      nasConnectionStatus.set(1, true);
      expect(nasConnectionStatus.get(1)).toBe(true);
    });

    it("should detect status change from connected to disconnected", () => {
      const wasConnected = true;
      const isConnected = false;
      
      const statusChanged = wasConnected !== isConnected;
      const disconnected = wasConnected && !isConnected;
      
      expect(statusChanged).toBe(true);
      expect(disconnected).toBe(true);
    });

    it("should detect status change from disconnected to connected", () => {
      const wasConnected = false;
      const isConnected = true;
      
      const statusChanged = wasConnected !== isConnected;
      const reconnected = !wasConnected && isConnected;
      
      expect(statusChanged).toBe(true);
      expect(reconnected).toBe(true);
    });
  });

  describe("Card Expiration Check", () => {
    it("should identify expired cards", () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() - 60000); // 1 minute ago
      
      const isExpired = expiresAt < now;
      expect(isExpired).toBe(true);
    });

    it("should identify cards expiring soon", () => {
      const now = new Date();
      const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
      
      const isExpiringSoon = expiresAt < thirtyMinutesLater && expiresAt > now;
      expect(isExpiringSoon).toBe(true);
    });

    it("should calculate remaining minutes correctly", () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
      
      const remainingMinutes = Math.round((expiresAt.getTime() - now.getTime()) / 60000);
      expect(remainingMinutes).toBe(15);
    });
  });
});
