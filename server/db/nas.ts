import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { nasDevices, InsertNasDevice } from "../../drizzle/schema";

export async function getAllNasDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(nasDevices).orderBy(desc(nasDevices.createdAt));
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

// Create NAS device (FreeRADIUS compatible)
export async function createNas(data: {
  name: string;
  ipAddress: string;
  secret: string;
  type?: string;
  connectionType?: "public_ip" | "vpn_pptp" | "vpn_sstp";
  description?: string;
  location?: string;
  ports?: number;
  mikrotikApiPort?: number;
  mikrotikApiUser?: string;
  mikrotikApiPassword?: string;
  vpnUsername?: string;
  vpnPassword?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(nasDevices).values({
    nasname: data.ipAddress, // FreeRADIUS uses nasname for IP
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
    status: "active",
  });
  
  return { success: true, id: result[0].insertId };
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
  connectionType?: "public_ip" | "vpn_pptp" | "vpn_sstp";
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
  
  await db.delete(nasDevices).where(eq(nasDevices.id, id));
  return { success: true };
}

export async function updateLastSeen(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(nasDevices)
    .set({ lastSeen: new Date() })
    .where(eq(nasDevices.id, id));
}

// Get NAS for FreeRADIUS (returns in FreeRADIUS format)
export async function getNasForRadius() {
  const db = await getDb();
  if (!db) return [];
  
  const devices = await db.select().from(nasDevices).where(eq(nasDevices.status, "active"));
  
  return devices.map(d => ({
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
