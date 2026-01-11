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


// ============================================
// MikroTik RouterOS API Direct Connection
// ============================================

import net from 'net';

interface MikroTikApiConnection {
  socket: net.Socket;
  buffer: Buffer;
}

/**
 * MikroTik RouterOS API Client for direct connection
 */
export class MikroTikApiClient {
  private host: string;
  private port: number;
  private username: string;
  private password: string;
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private connected: boolean = false;

  constructor(host: string, port: number = 8728, username: string, password: string) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
  }

  /**
   * Connect to MikroTik Router
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(10000);

      this.socket.connect(this.port, this.host, async () => {
        try {
          await this.login();
          this.connected = true;
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });

      this.socket.on('error', (err) => {
        this.connected = false;
        reject(err);
      });

      this.socket.on('timeout', () => {
        this.connected = false;
        reject(new Error('Connection timeout'));
      });
    });
  }

  /**
   * Disconnect from MikroTik Router
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Encode word length for RouterOS API protocol
   */
  private encodeLength(length: number): Buffer {
    if (length < 0x80) {
      return Buffer.from([length]);
    } else if (length < 0x4000) {
      return Buffer.from([((length >> 8) | 0x80), (length & 0xFF)]);
    } else if (length < 0x200000) {
      return Buffer.from([
        ((length >> 16) | 0xC0),
        ((length >> 8) & 0xFF),
        (length & 0xFF)
      ]);
    } else {
      return Buffer.from([
        ((length >> 24) | 0xE0),
        ((length >> 16) & 0xFF),
        ((length >> 8) & 0xFF),
        (length & 0xFF)
      ]);
    }
  }

  /**
   * Send a word to the router
   */
  private sendWord(word: string): void {
    if (!this.socket) throw new Error('Not connected');
    const wordBuffer = Buffer.from(word, 'utf8');
    const lengthBuffer = this.encodeLength(wordBuffer.length);
    this.socket.write(Buffer.concat([lengthBuffer, wordBuffer]));
  }

  /**
   * Send a sentence (array of words) to the router
   */
  private sendSentence(words: string[]): void {
    for (const word of words) {
      this.sendWord(word);
    }
    this.socket?.write(Buffer.from([0]));
  }

  /**
   * Read response from router
   */
  private async readResponse(): Promise<string[][]> {
    return new Promise((resolve) => {
      const sentences: string[][] = [];
      let currentSentence: string[] = [];
      let timeout: NodeJS.Timeout;

      const processBuffer = () => {
        while (this.buffer.length > 0) {
          let length = 0;
          let offset = 0;

          if (this.buffer[0] < 0x80) {
            length = this.buffer[0];
            offset = 1;
          } else if (this.buffer[0] < 0xC0) {
            if (this.buffer.length < 2) return;
            length = ((this.buffer[0] & 0x3F) << 8) + this.buffer[1];
            offset = 2;
          } else if (this.buffer[0] < 0xE0) {
            if (this.buffer.length < 3) return;
            length = ((this.buffer[0] & 0x1F) << 16) + (this.buffer[1] << 8) + this.buffer[2];
            offset = 3;
          } else {
            if (this.buffer.length < 4) return;
            length = ((this.buffer[0] & 0x0F) << 24) + (this.buffer[1] << 16) + (this.buffer[2] << 8) + this.buffer[3];
            offset = 4;
          }

          if (this.buffer.length < offset + length) return;

          if (length === 0) {
            if (currentSentence.length > 0) {
              sentences.push([...currentSentence]);
              if (currentSentence.includes('!done') || currentSentence.some(w => w.startsWith('!trap'))) {
                clearTimeout(timeout);
                this.socket?.removeListener('data', onData);
                resolve(sentences);
                return;
              }
              currentSentence = [];
            }
          } else {
            const word = this.buffer.slice(offset, offset + length).toString('utf8');
            currentSentence.push(word);
          }

          this.buffer = this.buffer.slice(offset + length);
        }
      };

      const onData = (data: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, data]);
        processBuffer();
      };

      timeout = setTimeout(() => {
        this.socket?.removeListener('data', onData);
        resolve(sentences);
      }, 5000);

      this.socket?.on('data', onData);
      processBuffer();
    });
  }

  /**
   * Login to the router
   */
  private async login(): Promise<void> {
    this.sendSentence(['/login', `=name=${this.username}`, `=password=${this.password}`]);
    const response = await this.readResponse();
    const flatResponse = response.flat();
    if (!flatResponse.includes('!done')) {
      throw new Error('Login failed: ' + JSON.stringify(response));
    }
  }

  /**
   * Execute a command on the router
   */
  async execute(command: string, params?: Record<string, string>): Promise<MikroTikResponse> {
    if (!this.connected || !this.socket) {
      return { success: false, error: 'Not connected' };
    }

    try {
      const words = [command];
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          words.push(`=${key}=${value}`);
        }
      }

      this.sendSentence(words);
      const response = await this.readResponse();

      const data: any[] = [];
      let error: string | undefined;

      for (const sentence of response) {
        if (sentence.includes('!trap')) {
          const msgWord = sentence.find(w => w.startsWith('=message='));
          error = msgWord ? msgWord.substring(9) : 'Unknown error';
        } else if (sentence.includes('!re')) {
          const item: Record<string, string> = {};
          for (const word of sentence) {
            if (word.startsWith('=') && word !== '!re') {
              const eqIndex = word.indexOf('=', 1);
              if (eqIndex > 0) {
                const key = word.substring(1, eqIndex);
                const value = word.substring(eqIndex + 1);
                item[key] = value;
              }
            }
          }
          if (Object.keys(item).length > 0) {
            data.push(item);
          }
        }
      }

      return { success: !error, data, error };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Get active hotspot users
   */
  async getHotspotActiveUsers(): Promise<any[]> {
    const result = await this.execute('/ip/hotspot/active/print');
    return result.success ? (result.data || []) : [];
  }

  /**
   * Get simple queues
   */
  async getSimpleQueues(): Promise<any[]> {
    const result = await this.execute('/queue/simple/print');
    return result.success ? (result.data || []) : [];
  }

  /**
   * Get PPP active connections
   */
  async getPPPActiveConnections(): Promise<any[]> {
    const result = await this.execute('/ppp/active/print');
    return result.success ? (result.data || []) : [];
  }

  /**
   * Change user speed by updating queue
   */
  async changeUserSpeedByQueue(username: string, uploadSpeed: string, downloadSpeed: string): Promise<MikroTikResponse> {
    // Find queue for this user
    const queues = await this.getSimpleQueues();
    const userQueue = queues.find((q: any) => 
      q.name?.toLowerCase().includes(username.toLowerCase()) ||
      q.name?.includes(`<hotspot-${username}>`) ||
      q.name === username
    );

    if (userQueue) {
      return await this.execute('/queue/simple/set', {
        'numbers': userQueue['.id'],
        'max-limit': `${uploadSpeed}/${downloadSpeed}`
      });
    }

    // Try to find by target IP from hotspot active
    const activeUsers = await this.getHotspotActiveUsers();
    const activeUser = activeUsers.find((u: any) => u.user === username);

    if (activeUser) {
      const queueByIp = queues.find((q: any) => q.target?.includes(activeUser.address));
      if (queueByIp) {
        return await this.execute('/queue/simple/set', {
          'numbers': queueByIp['.id'],
          'max-limit': `${uploadSpeed}/${downloadSpeed}`
        });
      }

      // Create new queue
      return await this.execute('/queue/simple/add', {
        'name': `speed-${username}`,
        'target': activeUser.address,
        'max-limit': `${uploadSpeed}/${downloadSpeed}`
      });
    }

    // Try PPP connections
    const pppConnections = await this.getPPPActiveConnections();
    const pppUser = pppConnections.find((c: any) => c.name === username);

    if (pppUser && pppUser.address) {
      const queueByIp = queues.find((q: any) => q.target?.includes(pppUser.address));
      if (queueByIp) {
        return await this.execute('/queue/simple/set', {
          'numbers': queueByIp['.id'],
          'max-limit': `${uploadSpeed}/${downloadSpeed}`
        });
      }

      // Create new queue
      return await this.execute('/queue/simple/add', {
        'name': `ppp-${username}`,
        'target': pppUser.address,
        'max-limit': `${uploadSpeed}/${downloadSpeed}`
      });
    }

    return { success: false, error: 'User not found in active sessions' };
  }

  /**
   * Disconnect hotspot user
   */
  async disconnectHotspotUser(username: string): Promise<MikroTikResponse> {
    const activeUsers = await this.getHotspotActiveUsers();
    const user = activeUsers.find((u: any) => u.user === username);

    if (!user) {
      return { success: false, error: 'User not found in active hotspot sessions' };
    }

    return await this.execute('/ip/hotspot/active/remove', {
      'numbers': user['.id']
    });
  }

  /**
   * Disconnect PPP user
   */
  async disconnectPPPUser(username: string): Promise<MikroTikResponse> {
    const connections = await this.getPPPActiveConnections();
    const connection = connections.find((c: any) => c.name === username);

    if (!connection) {
      return { success: false, error: 'User not found in active PPP connections' };
    }

    return await this.execute('/ppp/active/remove', {
      'numbers': connection['.id']
    });
  }
}

/**
 * Helper function to execute MikroTik API commands
 */
export async function withMikroTikApi<T>(
  host: string,
  port: number,
  username: string,
  password: string,
  callback: (api: MikroTikApiClient) => Promise<T>
): Promise<T> {
  const api = new MikroTikApiClient(host, port, username, password);
  try {
    await api.connect();
    return await callback(api);
  } finally {
    api.disconnect();
  }
}

/**
 * Change user speed via MikroTik API (without disconnecting)
 */
export async function changeUserSpeedViaMikroTikApi(
  nasIp: string,
  username: string,
  uploadSpeedKbps: number,
  downloadSpeedKbps: number
): Promise<MikroTikResponse> {
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

  const uploadSpeed = `${uploadSpeedKbps}k`;
  const downloadSpeed = `${downloadSpeedKbps}k`;

  try {
    return await withMikroTikApi(
      nasIp,
      nas.mikrotikApiPort || 8728,
      nas.mikrotikApiUser,
      nas.mikrotikApiPassword,
      async (api) => {
        return await api.changeUserSpeedByQueue(username, uploadSpeed, downloadSpeed);
      }
    );
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to change speed" };
  }
}

/**
 * Disconnect user via MikroTik API
 */
export async function disconnectUserViaMikroTikApi(
  nasIp: string,
  username: string
): Promise<MikroTikResponse> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const nas = await getNasByIp(nasIp);
  if (!nas) {
    return { success: false, error: "NAS device not found" };
  }

  if (!nas.mikrotikApiUser || !nas.mikrotikApiPassword) {
    return { success: false, error: "NAS API credentials not configured" };
  }

  try {
    return await withMikroTikApi(
      nasIp,
      nas.mikrotikApiPort || 8728,
      nas.mikrotikApiUser,
      nas.mikrotikApiPassword,
      async (api) => {
        // Try hotspot first
        let result = await api.disconnectHotspotUser(username);
        if (result.success) return result;

        // Try PPP
        result = await api.disconnectPPPUser(username);
        return result;
      }
    );
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to disconnect user" };
  }
}

/**
 * Get active users from MikroTik via API
 */
export async function getActiveUsersViaMikroTikApi(nasIp: string): Promise<MikroTikResponse> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const nas = await getNasByIp(nasIp);
  if (!nas) {
    return { success: false, error: "NAS device not found" };
  }

  if (!nas.mikrotikApiUser || !nas.mikrotikApiPassword) {
    return { success: false, error: "NAS API credentials not configured" };
  }

  try {
    return await withMikroTikApi(
      nasIp,
      nas.mikrotikApiPort || 8728,
      nas.mikrotikApiUser,
      nas.mikrotikApiPassword,
      async (api) => {
        const hotspotUsers = await api.getHotspotActiveUsers();
        const pppUsers = await api.getPPPActiveConnections();
        const queues = await api.getSimpleQueues();

        return {
          success: true,
          data: {
            hotspotUsers,
            pppUsers,
            queues
          }
        };
      }
    );
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to get active users" };
  }
}
