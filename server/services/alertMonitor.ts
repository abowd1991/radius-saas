import { getDb } from "../db";
import { radiusCards, nasDevices, users } from "../../drizzle/schema";
import { eq, and, lt, isNull, sql } from "drizzle-orm";
import * as internalNotificationService from "./internalNotificationService";
import net from "net";

// Track NAS connection status
const nasConnectionStatus = new Map<number, boolean>();

// Check if NAS is reachable via TCP connection to API port
async function checkNasConnection(ip: string, port: number = 8728): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000; // 5 seconds timeout

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    try {
      socket.connect(port, ip);
    } catch {
      resolve(false);
    }
  });
}

// Get all super admins for notifications
async function getSuperAdmins(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "super_admin"));

    return admins.map((a) => a.id);
  } catch (error) {
    console.error("[AlertMonitor] Error getting super admins:", error);
    return [];
  }
}

// Check for expired cards and notify
async function checkExpiredCards(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const now = new Date();

    // Find cards that just expired (within last check interval)
    const expiredCards = await db
      .select({
        id: radiusCards.id,
        username: radiusCards.username,
        createdBy: radiusCards.createdBy,
        expiresAt: radiusCards.expiresAt,
      })
      .from(radiusCards)
      .where(
        and(
          eq(radiusCards.status, "active"),
          lt(radiusCards.expiresAt, now)
        )
      )
      .limit(50);

    if (expiredCards.length === 0) return;

    console.log(`[AlertMonitor] Found ${expiredCards.length} expired cards`);

    // Get super admins
    const adminIds = await getSuperAdmins();

    // Notify about each expired card
    for (const card of expiredCards) {
      // Notify all super admins
      for (const adminId of adminIds) {
        await internalNotificationService.notifyCardExpired(
          adminId,
          card.username,
          card.id
        );
      }

      // Also notify the card owner if they exist
      if (card.createdBy) {
        await internalNotificationService.notifyCardExpired(
          card.createdBy,
          card.username,
          card.id
        );
      }

      // Update card status to expired
      await db
        .update(radiusCards)
        .set({ status: "expired" })
        .where(eq(radiusCards.id, card.id));
    }
  } catch (error) {
    console.error("[AlertMonitor] Error checking expired cards:", error);
  }
}

// Check for cards expiring soon (within 30 minutes)
async function checkExpiringCards(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);

    // Find cards expiring within 30 minutes
    const expiringCards = await db
      .select({
        id: radiusCards.id,
        username: radiusCards.username,
        createdBy: radiusCards.createdBy,
        expiresAt: radiusCards.expiresAt,
      })
      .from(radiusCards)
      .where(
        and(
          eq(radiusCards.status, "active"),
          lt(radiusCards.expiresAt, thirtyMinutesLater),
          sql`${radiusCards.expiresAt} > ${now}`
        )
      )
      .limit(20);

    if (expiringCards.length === 0) return;

    console.log(`[AlertMonitor] Found ${expiringCards.length} cards expiring soon`);

    const adminIds = await getSuperAdmins();

    for (const card of expiringCards) {
      const remainingMinutes = Math.round(
        (new Date(card.expiresAt!).getTime() - now.getTime()) / 60000
      );

      // Notify all super admins
      for (const adminId of adminIds) {
        await internalNotificationService.notifyCardExpiring(
          adminId,
          card.username,
          card.id,
          remainingMinutes
        );
      }
    }
  } catch (error) {
    console.error("[AlertMonitor] Error checking expiring cards:", error);
  }
}

// Check NAS device connections
async function checkNasConnections(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Get all active NAS devices
    const devices = await db
      .select({
        id: nasDevices.id,
        name: nasDevices.shortname,
        ipAddress: nasDevices.nasname,
        apiPort: nasDevices.mikrotikApiPort,
        ownerId: nasDevices.ownerId,
      })
      .from(nasDevices)
      .where(eq(nasDevices.status, "active"));

    if (devices.length === 0) return;

    const adminIds = await getSuperAdmins();

    for (const device of devices) {
      const port = device.apiPort || 8728;
      const isConnected = await checkNasConnection(device.ipAddress, port);
      const wasConnected = nasConnectionStatus.get(device.id);

      // First check - just record status
      if (wasConnected === undefined) {
        nasConnectionStatus.set(device.id, isConnected);
        continue;
      }

      // Status changed - send notification
      if (wasConnected && !isConnected) {
        // Was connected, now disconnected
        console.log(`[AlertMonitor] NAS ${device.name} (${device.ipAddress}) disconnected`);

        for (const adminId of adminIds) {
          await internalNotificationService.notifyNasDisconnected(
            adminId,
            device.name || 'Unknown',
            device.id,
            device.ipAddress
          );
        }

        // Also notify owner
        if (device.ownerId) {
          await internalNotificationService.notifyNasDisconnected(
            device.ownerId,
            device.name || 'Unknown',
            device.id,
            device.ipAddress
          );
        }
      } else if (!wasConnected && isConnected) {
        // Was disconnected, now connected
        console.log(`[AlertMonitor] NAS ${device.name} (${device.ipAddress}) reconnected`);

        for (const adminId of adminIds) {
          await internalNotificationService.notifyNasReconnected(
            adminId,
            device.name || 'Unknown',
            device.id,
            device.ipAddress
          );
        }

        if (device.ownerId) {
          await internalNotificationService.notifyNasReconnected(
            device.ownerId,
            device.name || 'Unknown',
            device.id,
            device.ipAddress
          );
        }
      }

      nasConnectionStatus.set(device.id, isConnected);
    }
  } catch (error) {
    console.error("[AlertMonitor] Error checking NAS connections:", error);
  }
}

// Run all checks
async function runAllChecks(): Promise<void> {
  console.log("[AlertMonitor] Running checks...");
  
  await checkExpiredCards();
  await checkExpiringCards();
  await checkNasConnections();
  
  console.log("[AlertMonitor] Checks completed");
}

// Scheduler
let monitorInterval: NodeJS.Timeout | null = null;

export function startAlertMonitor(): void {
  console.log("[AlertMonitor] Starting alert monitor...");

  // Run checks every 5 minutes
  monitorInterval = setInterval(() => {
    runAllChecks();
  }, 5 * 60 * 1000); // 5 minutes

  // Run initial check after 30 seconds
  setTimeout(() => {
    runAllChecks();
  }, 30 * 1000);

  console.log("[AlertMonitor] Started - checking every 5 minutes");
}

export function stopAlertMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  console.log("[AlertMonitor] Stopped");
}
