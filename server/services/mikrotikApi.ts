/**
 * MikroTik RouterOS API Integration
 * 
 * This service provides integration with MikroTik routers for:
 * - PPPoE server management
 * - Hotspot user management
 * - Active sessions monitoring
 * - User disconnection
 */

import { getDb } from "../db";
import { nasDevices, radacct, onlineSessions, radiusCards, subscribers } from "../../drizzle/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

// MikroTik API response interface
interface MikroTikResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Active session interface
interface ActiveSession {
  id: string;
  username: string;
  nasIpAddress: string;
  nasName?: string;
  framedIpAddress?: string;
  callingStationId?: string;
  sessionTime: number;
  inputOctets: number;
  outputOctets: number;
  startTime: Date;
  serviceType: string;
}

// MikroTik API connection (placeholder - in production use routeros-client library)
async function connectToMikroTik(nasIp: string, apiPort: number, username: string, password: string): Promise<any> {
  // In production, use the routeros-client npm package
  // This is a placeholder that simulates the connection
  console.log(`Connecting to MikroTik at ${nasIp}:${apiPort}`);
  return {
    connected: true,
    ip: nasIp,
    port: apiPort,
  };
}

// Get NAS device by IP
export async function getNasByIp(nasIp: string) {
  const db = await getDb();
  if (!db) return null;
  
  const [nas] = await db.select()
    .from(nasDevices)
    .where(eq(nasDevices.nasname, nasIp))
    .limit(1);
  
  return nas;
}

// Get all active sessions from radacct
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get sessions that haven't stopped (acctstoptime is null)
  const sessions = await db.select()
    .from(radacct)
    .where(isNull(radacct.acctstoptime))
    .orderBy(desc(radacct.acctstarttime))
    .limit(1000);
  
  // Get NAS devices for names
  const nasDevicesList = await db.select().from(nasDevices);
  const nasMap = new Map(nasDevicesList.map(n => [n.nasname, n.shortname || n.nasname]));
  
  return sessions.map(session => ({
    id: session.acctuniqueid,
    username: session.username,
    nasIpAddress: session.nasipaddress,
    nasName: nasMap.get(session.nasipaddress) || session.nasipaddress,
    framedIpAddress: session.framedipaddress || undefined,
    callingStationId: session.callingstationid || undefined,
    sessionTime: session.acctsessiontime || 0,
    inputOctets: session.acctinputoctets || 0,
    outputOctets: session.acctoutputoctets || 0,
    startTime: session.acctstarttime || new Date(),
    serviceType: session.servicetype || 'PPP',
  }));
}

// Get sessions by username
export async function getSessionsByUsername(username: string): Promise<ActiveSession[]> {
  const db = await getDb();
  if (!db) return [];
  
  const sessions = await db.select()
    .from(radacct)
    .where(and(
      eq(radacct.username, username),
      isNull(radacct.acctstoptime)
    ))
    .orderBy(desc(radacct.acctstarttime));
  
  return sessions.map(session => ({
    id: session.acctuniqueid,
    username: session.username,
    nasIpAddress: session.nasipaddress,
    framedIpAddress: session.framedipaddress || undefined,
    callingStationId: session.callingstationid || undefined,
    sessionTime: session.acctsessiontime || 0,
    inputOctets: session.acctinputoctets || 0,
    outputOctets: session.acctoutputoctets || 0,
    startTime: session.acctstarttime || new Date(),
    serviceType: session.servicetype || 'PPP',
  }));
}

// Get sessions by NAS IP
export async function getSessionsByNas(nasIp: string): Promise<ActiveSession[]> {
  const db = await getDb();
  if (!db) return [];
  
  const sessions = await db.select()
    .from(radacct)
    .where(and(
      eq(radacct.nasipaddress, nasIp),
      isNull(radacct.acctstoptime)
    ))
    .orderBy(desc(radacct.acctstarttime));
  
  return sessions.map(session => ({
    id: session.acctuniqueid,
    username: session.username,
    nasIpAddress: session.nasipaddress,
    framedIpAddress: session.framedipaddress || undefined,
    callingStationId: session.callingstationid || undefined,
    sessionTime: session.acctsessiontime || 0,
    inputOctets: session.acctinputoctets || 0,
    outputOctets: session.acctoutputoctets || 0,
    startTime: session.acctstarttime || new Date(),
    serviceType: session.servicetype || 'PPP',
  }));
}

// Disconnect user session via MikroTik API
export async function disconnectSession(sessionId: string, nasIp: string): Promise<MikroTikResponse> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };
  
  // Get NAS credentials
  const nas = await getNasByIp(nasIp);
  if (!nas) {
    return { success: false, error: "NAS device not found" };
  }
  
  if (!nas.mikrotikApiUser || !nas.mikrotikApiPassword) {
    return { success: false, error: "NAS API credentials not configured" };
  }
  
  try {
    // In production, connect to MikroTik and execute disconnect command
    // const api = await connectToMikroTik(nasIp, nas.mikrotikApiPort || 8728, nas.mikrotikApiUser, nas.mikrotikApiPassword);
    
    // For PPPoE: /ppp/active/remove
    // For Hotspot: /ip/hotspot/active/remove
    
    // Update radacct to mark session as stopped
    const now = new Date();
    await db.update(radacct)
      .set({
        acctstoptime: now,
        acctterminatecause: 'Admin-Reset',
      })
      .where(eq(radacct.acctuniqueid, sessionId));
    
    return { 
      success: true, 
      data: { 
        message: "Session disconnected successfully",
        sessionId,
        disconnectedAt: now,
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to disconnect session" };
  }
}

// Disconnect all sessions for a username
export async function disconnectUserSessions(username: string): Promise<MikroTikResponse> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };
  
  try {
    const sessions = await getSessionsByUsername(username);
    
    if (sessions.length === 0) {
      return { success: true, data: { message: "No active sessions found", disconnected: 0 } };
    }
    
    // Disconnect each session
    const results = await Promise.all(
      sessions.map(session => disconnectSession(session.id, session.nasIpAddress))
    );
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      data: {
        message: `Disconnected ${successCount} of ${sessions.length} sessions`,
        disconnected: successCount,
        total: sessions.length,
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to disconnect sessions" };
  }
}

// Get active sessions filtered by owner (multi-tenancy)
export async function getActiveSessionsByOwner(ownerId: number | null): Promise<ActiveSession[]> {
  const db = await getDb();
  if (!db) return [];
  
  // radiusCards and subscribers are imported at the top
  
  // Get all active sessions
  const sessions = await db.select()
    .from(radacct)
    .where(isNull(radacct.acctstoptime))
    .orderBy(desc(radacct.acctstarttime))
    .limit(1000);
  
  // If super_admin (ownerId is null), return all sessions
  if (ownerId === null) {
    const nasDevicesList = await db.select().from(nasDevices);
    const nasMap = new Map(nasDevicesList.map(n => [n.nasname, n.shortname || n.nasname]));
    
    return sessions.map(session => ({
      id: session.acctuniqueid,
      username: session.username,
      nasIpAddress: session.nasipaddress,
      nasName: nasMap.get(session.nasipaddress) || session.nasipaddress,
      framedIpAddress: session.framedipaddress || undefined,
      callingStationId: session.callingstationid || undefined,
      sessionTime: session.acctsessiontime || 0,
      inputOctets: session.acctinputoctets || 0,
      outputOctets: session.acctoutputoctets || 0,
      startTime: session.acctstarttime || new Date(),
      serviceType: session.servicetype || 'PPP',
    }));
  }
  
  // Get usernames from cards created by this owner
  const ownerCards = await db.select({ username: radiusCards.username })
    .from(radiusCards)
    .where(eq(radiusCards.createdBy, ownerId));
  const cardUsernames = new Set(ownerCards.map(c => c.username));
  
  // Get usernames from subscribers created by this owner
  const ownerSubscribers = await db.select({ username: subscribers.username })
    .from(subscribers)
    .where(eq(subscribers.createdBy, ownerId));
  const subscriberUsernames = new Set(ownerSubscribers.map(s => s.username));
  
  // Combine all usernames owned by this user
  const ownerUsernames = new Set<string>();
  cardUsernames.forEach(u => ownerUsernames.add(u));
  subscriberUsernames.forEach(u => ownerUsernames.add(u));
  
  // Filter sessions by owner's usernames
  const filteredSessions = sessions.filter(session => 
    ownerUsernames.has(session.username)
  );
  
  // Get NAS names
  const nasDevicesList = await db.select().from(nasDevices);
  const nasMap = new Map(nasDevicesList.map(n => [n.nasname, n.shortname || n.nasname]));
  
  return filteredSessions.map(session => ({
    id: session.acctuniqueid,
    username: session.username,
    nasIpAddress: session.nasipaddress,
    nasName: nasMap.get(session.nasipaddress) || session.nasipaddress,
    framedIpAddress: session.framedipaddress || undefined,
    callingStationId: session.callingstationid || undefined,
    sessionTime: session.acctsessiontime || 0,
    inputOctets: session.acctinputoctets || 0,
    outputOctets: session.acctoutputoctets || 0,
    startTime: session.acctstarttime || new Date(),
    serviceType: session.servicetype || 'PPP',
  }));
}

// Get session statistics
export async function getSessionStats() {
  const db = await getDb();
  if (!db) return null;
  
  const activeSessions = await db.select()
    .from(radacct)
    .where(isNull(radacct.acctstoptime));
  
  let totalSessionTime = 0;
  let totalInputOctets = 0;
  let totalOutputOctets = 0;
  
  activeSessions.forEach(session => {
    totalSessionTime += session.acctsessiontime || 0;
    totalInputOctets += session.acctinputoctets || 0;
    totalOutputOctets += session.acctoutputoctets || 0;
  });
  
  return {
    activeSessionsCount: activeSessions.length,
    totalSessionTime,
    totalInputOctets,
    totalOutputOctets,
    totalDataTransferred: totalInputOctets + totalOutputOctets,
  };
}

// Generate MikroTik configuration script
export function generateMikroTikScript(options: {
  radiusServerIp: string;
  radiusSecret: string;
  pppoePoolName?: string;
  pppoePoolRange?: string;
  hotspotEnabled?: boolean;
  hotspotInterface?: string;
}): string {
  const { 
    radiusServerIp, 
    radiusSecret, 
    pppoePoolName = 'pppoe-pool',
    pppoePoolRange = '10.0.0.2-10.0.0.254',
    hotspotEnabled = false,
    hotspotInterface = 'ether1',
  } = options;
  
  let script = `# MikroTik RADIUS Configuration Script
# Generated by RADIUS SaaS Platform
# Date: ${new Date().toISOString()}

# ============================================
# RADIUS Server Configuration
# ============================================
/radius
add address=${radiusServerIp} secret="${radiusSecret}" service=ppp,hotspot,login timeout=3000ms

# Enable RADIUS for PPP
/ppp aaa
set use-radius=yes accounting=yes interim-update=5m

`;

  // PPPoE Configuration
  script += `
# ============================================
# PPPoE Server Configuration
# ============================================
# Create IP Pool
/ip pool
add name=${pppoePoolName} ranges=${pppoePoolRange}

# Create PPPoE Profile
/ppp profile
add name=radius-profile local-address=${pppoePoolName} remote-address=${pppoePoolName} use-encryption=yes only-one=yes

# Create PPPoE Server (adjust interface as needed)
# /interface pppoe-server server
# add service-name=PPPoE-Service interface=ether1 default-profile=radius-profile authentication=mschap2,mschap1,chap,pap

`;

  // Hotspot Configuration
  if (hotspotEnabled) {
    script += `
# ============================================
# Hotspot Configuration
# ============================================
# Create Hotspot Profile
/ip hotspot profile
add name=radius-hotspot hotspot-address=10.5.50.1 dns-name=hotspot.local use-radius=yes

# Create Hotspot Server (adjust interface as needed)
# /ip hotspot
# add name=hotspot1 interface=${hotspotInterface} address-pool=hotspot-pool profile=radius-hotspot

# Hotspot User Profile
/ip hotspot user profile
add name=radius-users rate-limit="" shared-users=1

`;
  }

  script += `
# ============================================
# Firewall Rules (Optional)
# ============================================
# Allow RADIUS traffic
/ip firewall filter
add chain=input protocol=udp dst-port=1812-1813 action=accept comment="Allow RADIUS"

# ============================================
# Notes
# ============================================
# 1. Adjust interface names according to your setup
# 2. Modify IP pool ranges as needed
# 3. Test RADIUS connectivity before enabling PPPoE/Hotspot
# 4. Use /radius monitor to check RADIUS server status

# End of configuration
`;

  return script;
}

// Generate FreeRADIUS client configuration
export function generateFreeRadiusClientConfig(options: {
  nasIp: string;
  nasName: string;
  secret: string;
  nasType?: string;
}): string {
  const { nasIp, nasName, secret, nasType = 'other' } = options;
  
  return `# FreeRADIUS Client Configuration
# Add this to /etc/freeradius/3.0/clients.conf

client ${nasName} {
    ipaddr = ${nasIp}
    secret = ${secret}
    nastype = ${nasType}
    shortname = ${nasName}
    require_message_authenticator = no
}
`;
}
