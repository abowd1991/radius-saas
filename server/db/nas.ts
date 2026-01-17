import { eq, desc, and, ne } from "drizzle-orm";
import { getDb } from "../db";
import { nasDevices, InsertNasDevice, radcheck, radreply } from "../../drizzle/schema";

// Get all NAS devices (for super_admin only)
export async function getAllNasDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(nasDevices).orderBy(desc(nasDevices.createdAt));
}

// Get NAS devices by owner (for multi-tenancy)
export async function getNasDevicesByOwner(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(nasDevices)
    .where(eq(nasDevices.ownerId, ownerId))
    .orderBy(desc(nasDevices.createdAt));
}

export async function getActiveNasDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(nasDevices).where(eq(nasDevices.status, "active"));
}

export async function getNasById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(nasDevices).where(eq(nasDevices.id, id)).limit(1);
  return result[0] || null;
}

export async function getNasByIp(ipAddress: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(nasDevices).where(eq(nasDevices.nasname, ipAddress)).limit(1);
  return result[0] || null;
}

export async function getNasByVpnUsername(vpnUsername: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(nasDevices).where(eq(nasDevices.vpnUsername, vpnUsername)).limit(1);
  return result[0] || null;
}

// Create NAS device (FreeRADIUS compatible)
// For VPN connections: nasname='pending', status='pending', provisioningStatus='pending'
// For public_ip: nasname=actual IP, status='active', provisioningStatus='ready'
export async function createNas(data: {
  name: string;
  ipAddress: string;
  secret: string;
  type?: string;
  connectionType?: "public_ip" | "vpn_l2tp" | "vpn_sstp";
  description?: string;
  location?: string;
  ports?: number;
  mikrotikApiPort?: number;
  mikrotikApiUser?: string;
  mikrotikApiPassword?: string;
  vpnUsername?: string;
  vpnPassword?: string;
  apiEnabled?: boolean;
  ownerId: number; // Required for multi-tenancy
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Determine initial status based on connection type
  const isVpnConnection = data.connectionType === 'vpn_l2tp' || data.connectionType === 'vpn_sstp';
  
  // For VPN connections: start with 'pending' status until provisioned
  // This prevents FreeRADIUS from loading this NAS until it has a real IP
  const initialStatus = isVpnConnection ? 'pending' : 'active';
  const initialProvisioningStatus = isVpnConnection ? 'pending' : 'ready';
  const initialNasname = isVpnConnection ? 'pending' : data.ipAddress;
  
  const result = await db.insert(nasDevices).values({
    nasname: initialNasname, // 'pending' for VPN, actual IP for public_ip
    shortname: data.name,
    secret: data.secret,
    type: data.type || "other",
    connectionType: data.connectionType || "public_ip",
    description: data.description,
    location: data.location,
    ports: data.ports,
    mikrotikApiPort: data.mikrotikApiPort,
    mikrotikApiUser: data.mikrotikApiUser,
    mikrotikApiPassword: data.mikrotikApiPassword,
    vpnUsername: data.vpnUsername,
    vpnPassword: data.vpnPassword,
    apiEnabled: data.apiEnabled || false,
    ownerId: data.ownerId, // Multi-tenancy owner
    status: initialStatus as "active" | "inactive",
    provisioningStatus: initialProvisioningStatus as "pending" | "provisioning" | "ready" | "error",
  });
  
  return { success: true, id: result[0].insertId, status: initialStatus, provisioningStatus: initialProvisioningStatus };
}

/**
 * Update NAS after VPN provisioning completes
 * This is called when VPN connects and we have the actual IP and MAC
 */
export async function finalizeNasProvisioning(
  nasId: number,
  actualIp: string,
  macAddress: string
): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "Database not available" };
  
  const nas = await getNasById(nasId);
  if (!nas) return { success: false, message: "NAS not found" };
  
  // Check if already provisioned with same IP (idempotency)
  if (nas.provisioningStatus === 'ready' && nas.nasname === actualIp) {
    console.log(`[NAS Provisioning] NAS ${nasId} already provisioned with IP ${actualIp}`);
    return { success: true, message: "Already provisioned" };
  }
  
  // Update NAS with actual IP and activate it
  await db.update(nasDevices)
    .set({
      nasname: actualIp,
      status: 'active',
      provisioningStatus: 'ready',
      allocatedIp: actualIp,
      lastMac: macAddress,
      vpnTunnelIp: actualIp,
      provisionedAt: new Date(),
      provisioningError: null,
    })
    .where(eq(nasDevices.id, nasId));
  
  console.log(`[NAS Provisioning] NAS ${nasId} finalized: nasname=${actualIp}, MAC=${macAddress}`);
  return { success: true, message: `Provisioned with IP ${actualIp}` };
}

/**
 * Mark NAS provisioning as failed
 */
export async function markNasProvisioningError(
  nasId: number,
  errorMessage: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(nasDevices)
    .set({
      provisioningStatus: 'error',
      provisioningError: errorMessage,
    })
    .where(eq(nasDevices.id, nasId));
  
  console.log(`[NAS Provisioning] NAS ${nasId} marked as error: ${errorMessage}`);
}

/**
 * Get pending NAS devices that need provisioning
 */
export async function getPendingNasDevices() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(nasDevices)
    .where(
      and(
        eq(nasDevices.provisioningStatus, 'pending'),
        ne(nasDevices.connectionType, 'public_ip')
      )
    );
}

export async function updateNas(id: number, data: {
  name?: string;
  ipAddress?: string;
  secret?: string;
  type?: string;
  description?: string;
  location?: string;
  ports?: number;
  status?: "active" | "inactive";
  connectionType?: "public_ip" | "vpn_l2tp" | "vpn_sstp";
  mikrotikApiPort?: number;
  mikrotikApiUser?: string;
  mikrotikApiPassword?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = {};
  if (data.name) updateData.shortname = data.name;
  if (data.ipAddress) updateData.nasname = data.ipAddress;
  if (data.secret) updateData.secret = data.secret;
  if (data.type) updateData.type = data.type;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.ports !== undefined) updateData.ports = data.ports;
  if (data.status) updateData.status = data.status;
  if (data.connectionType) updateData.connectionType = data.connectionType;
  if (data.mikrotikApiPort !== undefined) updateData.mikrotikApiPort = data.mikrotikApiPort;
  if (data.mikrotikApiUser !== undefined) updateData.mikrotikApiUser = data.mikrotikApiUser;
  if (data.mikrotikApiPassword !== undefined) updateData.mikrotikApiPassword = data.mikrotikApiPassword;
  
  await db.update(nasDevices).set(updateData).where(eq(nasDevices.id, id));
  return { success: true };
}

export async function deleteNas(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // First, get the NAS device to retrieve VPN username
  const nasDevice = await db.select().from(nasDevices).where(eq(nasDevices.id, id)).limit(1);
  const nas = nasDevice[0];
  
  if (!nas) {
    throw new Error("NAS device not found");
  }
  
  // Store VPN username for cleanup
  const vpnUsername = nas.vpnUsername;
  
  // Delete the NAS device from database
  await db.delete(nasDevices).where(eq(nasDevices.id, id));
  
  // Return with VPN username for cleanup in router
  return { success: true, vpnUsername };
}

export async function updateLastSeen(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(nasDevices)
    .set({ lastSeen: new Date() })
    .where(eq(nasDevices.id, id));
}

// Get NAS for FreeRADIUS (returns in FreeRADIUS format)
// IMPORTANT: Only returns NAS with status='active' AND provisioningStatus='ready'
// This ensures FreeRADIUS only loads fully provisioned NAS devices
export async function getNasForRadius() {
  const db = await getDb();
  if (!db) return [];
  
  const devices = await db.select().from(nasDevices)
    .where(
      and(
        eq(nasDevices.status, "active"),
        eq(nasDevices.provisioningStatus, "ready")
      )
    );
  
  return devices.map((d: typeof nasDevices.$inferSelect) => ({
    nasname: d.nasname,
    shortname: d.shortname,
    type: d.type,
    ports: d.ports,
    secret: d.secret,
    server: d.server,
    community: d.community,
    description: d.description,
  }));
}
