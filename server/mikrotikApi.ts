/**
 * MikroTik RouterOS API Client
 * 
 * This module provides functions to interact with MikroTik routers via API
 * for real-time speed changes, user disconnection, and session management.
 */

import net from 'net';

interface MikroTikConnection {
  socket: net.Socket;
  connected: boolean;
}

interface MikroTikResponse {
  success: boolean;
  data?: any[];
  error?: string;
}

interface HotspotUser {
  id: string;
  user: string;
  address: string;
  macAddress: string;
  uptime: string;
  bytesIn: string;
  bytesOut: string;
  rateLimit?: string;
}

interface QueueEntry {
  id: string;
  name: string;
  target: string;
  maxLimit: string;
  burstLimit?: string;
}

/**
 * MikroTik API Client Class
 */
export class MikroTikAPI {
  private host: string;
  private port: number;
  private username: string;
  private password: string;
  private socket: net.Socket | null = null;
  private connected: boolean = false;
  private buffer: Buffer = Buffer.alloc(0);

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
    } else if (length < 0x10000000) {
      return Buffer.from([
        ((length >> 24) | 0xE0),
        ((length >> 16) & 0xFF),
        ((length >> 8) & 0xFF),
        (length & 0xFF)
      ]);
    } else {
      return Buffer.from([
        0xF0,
        ((length >> 24) & 0xFF),
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
    // End of sentence
    this.socket?.write(Buffer.from([0]));
  }

  /**
   * Read response from router
   */
  private async readResponse(): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const sentences: string[][] = [];
      let currentSentence: string[] = [];
      let timeout: NodeJS.Timeout;

      const processBuffer = () => {
        while (this.buffer.length > 0) {
          // Read length
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
          } else if (this.buffer[0] < 0xF0) {
            if (this.buffer.length < 4) return;
            length = ((this.buffer[0] & 0x0F) << 24) + (this.buffer[1] << 16) + (this.buffer[2] << 8) + this.buffer[3];
            offset = 4;
          } else {
            if (this.buffer.length < 5) return;
            length = (this.buffer[1] << 24) + (this.buffer[2] << 16) + (this.buffer[3] << 8) + this.buffer[4];
            offset = 5;
          }

          if (this.buffer.length < offset + length) return;

          if (length === 0) {
            // End of sentence
            if (currentSentence.length > 0) {
              sentences.push([...currentSentence]);
              
              // Check if we got !done or !trap
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

      // Parse response
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
  async getHotspotActiveUsers(): Promise<HotspotUser[]> {
    const result = await this.execute('/ip/hotspot/active/print');
    if (!result.success || !result.data) return [];

    return result.data.map(item => ({
      id: item['.id'] || '',
      user: item['user'] || '',
      address: item['address'] || '',
      macAddress: item['mac-address'] || '',
      uptime: item['uptime'] || '',
      bytesIn: item['bytes-in'] || '0',
      bytesOut: item['bytes-out'] || '0',
      rateLimit: item['rate-limit'] || ''
    }));
  }

  /**
   * Get simple queues
   */
  async getSimpleQueues(): Promise<QueueEntry[]> {
    const result = await this.execute('/queue/simple/print');
    if (!result.success || !result.data) return [];

    return result.data.map(item => ({
      id: item['.id'] || '',
      name: item['name'] || '',
      target: item['target'] || '',
      maxLimit: item['max-limit'] || '',
      burstLimit: item['burst-limit'] || ''
    }));
  }

  /**
   * Change speed for a hotspot user (by updating their queue)
   * @param username - The username to update
   * @param uploadSpeed - Upload speed (e.g., "1M", "5M", "10M")
   * @param downloadSpeed - Download speed (e.g., "1M", "5M", "10M")
   */
  async changeUserSpeed(username: string, uploadSpeed: string, downloadSpeed: string): Promise<MikroTikResponse> {
    // First, find the queue for this user
    const queues = await this.getSimpleQueues();
    const userQueue = queues.find(q => 
      q.name.toLowerCase().includes(username.toLowerCase()) ||
      q.name.includes(`<hotspot-${username}>`) ||
      q.name === username
    );

    if (userQueue) {
      // Update existing queue
      return await this.execute('/queue/simple/set', {
        'numbers': userQueue.id,
        'max-limit': `${uploadSpeed}/${downloadSpeed}`
      });
    }

    // Try to find by target IP from hotspot active
    const activeUsers = await this.getHotspotActiveUsers();
    const activeUser = activeUsers.find(u => u.user === username);

    if (activeUser) {
      // Find queue by target IP
      const queueByIp = queues.find(q => q.target.includes(activeUser.address));
      if (queueByIp) {
        return await this.execute('/queue/simple/set', {
          'numbers': queueByIp.id,
          'max-limit': `${uploadSpeed}/${downloadSpeed}`
        });
      }

      // Create new queue for this user
      return await this.execute('/queue/simple/add', {
        'name': `speed-${username}`,
        'target': activeUser.address,
        'max-limit': `${uploadSpeed}/${downloadSpeed}`
      });
    }

    return { success: false, error: 'User not found in active sessions or queues' };
  }

  /**
   * Disconnect a hotspot user
   */
  async disconnectHotspotUser(username: string): Promise<MikroTikResponse> {
    const activeUsers = await this.getHotspotActiveUsers();
    const user = activeUsers.find(u => u.user === username);

    if (!user) {
      return { success: false, error: 'User not found in active hotspot sessions' };
    }

    return await this.execute('/ip/hotspot/active/remove', {
      'numbers': user.id
    });
  }

  /**
   * Get PPP active connections
   */
  async getPPPActiveConnections(): Promise<any[]> {
    const result = await this.execute('/ppp/active/print');
    if (!result.success || !result.data) return [];
    return result.data;
  }

  /**
   * Disconnect a PPP user
   */
  async disconnectPPPUser(username: string): Promise<MikroTikResponse> {
    const activeConnections = await this.getPPPActiveConnections();
    const connection = activeConnections.find((c: any) => c.name === username);

    if (!connection) {
      return { success: false, error: 'User not found in active PPP connections' };
    }

    return await this.execute('/ppp/active/remove', {
      'numbers': connection['.id']
    });
  }

  /**
   * Change PPP user speed by updating their profile or creating a dynamic queue
   */
  async changePPPUserSpeed(username: string, uploadSpeed: string, downloadSpeed: string): Promise<MikroTikResponse> {
    // Get active PPP connection
    const activeConnections = await this.getPPPActiveConnections();
    const connection = activeConnections.find((c: any) => c.name === username);

    if (!connection) {
      return { success: false, error: 'User not found in active PPP connections' };
    }

    // Get the user's IP address
    const userAddress = connection['address'];
    if (!userAddress) {
      return { success: false, error: 'User has no assigned IP address' };
    }

    // Find or create queue for this user
    const queues = await this.getSimpleQueues();
    const existingQueue = queues.find(q => 
      q.target.includes(userAddress) || 
      q.name.includes(username)
    );

    if (existingQueue) {
      return await this.execute('/queue/simple/set', {
        'numbers': existingQueue.id,
        'max-limit': `${uploadSpeed}/${downloadSpeed}`
      });
    }

    // Create new queue
    return await this.execute('/queue/simple/add', {
      'name': `ppp-${username}`,
      'target': userAddress,
      'max-limit': `${uploadSpeed}/${downloadSpeed}`
    });
  }
}

/**
 * Helper function to create and use MikroTik API connection
 */
export async function withMikroTik<T>(
  host: string,
  port: number,
  username: string,
  password: string,
  callback: (api: MikroTikAPI) => Promise<T>
): Promise<T> {
  const api = new MikroTikAPI(host, port, username, password);
  try {
    await api.connect();
    return await callback(api);
  } finally {
    api.disconnect();
  }
}

/**
 * Quick function to change user speed
 */
export async function changeUserSpeedOnMikroTik(
  mikrotikHost: string,
  mikrotikPort: number,
  mikrotikUser: string,
  mikrotikPass: string,
  username: string,
  uploadSpeed: string,
  downloadSpeed: string
): Promise<MikroTikResponse> {
  return withMikroTik(mikrotikHost, mikrotikPort, mikrotikUser, mikrotikPass, async (api) => {
    // Try hotspot first
    let result = await api.changeUserSpeed(username, uploadSpeed, downloadSpeed);
    if (result.success) return result;

    // Try PPP
    result = await api.changePPPUserSpeed(username, uploadSpeed, downloadSpeed);
    return result;
  });
}

/**
 * Quick function to disconnect user
 */
export async function disconnectUserOnMikroTik(
  mikrotikHost: string,
  mikrotikPort: number,
  mikrotikUser: string,
  mikrotikPass: string,
  username: string
): Promise<MikroTikResponse> {
  return withMikroTik(mikrotikHost, mikrotikPort, mikrotikUser, mikrotikPass, async (api) => {
    // Try hotspot first
    let result = await api.disconnectHotspotUser(username);
    if (result.success) return result;

    // Try PPP
    result = await api.disconnectPPPUser(username);
    return result;
  });
}
