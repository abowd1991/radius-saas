/**
 * Standalone RADIUS Server Startup Script
 * Run with: node start-radius.mjs
 */

import * as dgram from 'dgram';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const radius = require('radius');
import mysql from 'mysql2/promise';

const RADIUS_SECRET = 'testing123';
const AUTH_PORT = 1812;
const ACCT_PORT = 1813;

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;

let db = null;

async function getDbConnection() {
  if (!db) {
    if (!DATABASE_URL) {
      console.error('[RADIUS] DATABASE_URL not set');
      return null;
    }
    try {
      db = await mysql.createConnection(DATABASE_URL);
      console.log('[RADIUS] Database connected');
    } catch (error) {
      console.error('[RADIUS] Database connection failed:', error.message);
      return null;
    }
  }
  return db;
}

/**
 * Handle Access-Request (Authentication)
 */
async function handleAccessRequest(packet, rinfo) {
  const username = packet.attributes['User-Name'];
  const password = packet.attributes['User-Password'];
  
  console.log(`[RADIUS] Access-Request from ${rinfo.address}:${rinfo.port}`);
  console.log(`[RADIUS] Username: ${username}, Password: ${password ? '***' : 'empty'}`);
  
  try {
    const conn = await getDbConnection();
    if (!conn) {
      console.log('[RADIUS] Database not available');
      return createResponse('Access-Reject', packet, {});
    }
    
    // Check user credentials in radcheck table
    const [checks] = await conn.execute(
      'SELECT * FROM radcheck WHERE username = ?',
      [username]
    );
    
    if (!checks || checks.length === 0) {
      console.log(`[RADIUS] User ${username} not found`);
      return createResponse('Access-Reject', packet, {});
    }
    
    // Find password
    const passwordCheck = checks.find(c => 
      c.attribute === 'Cleartext-Password' || 
      c.attribute === 'User-Password'
    );
    
    if (!passwordCheck || passwordCheck.value !== password) {
      console.log(`[RADIUS] Invalid password for ${username}`);
      console.log(`[RADIUS] Expected: ${passwordCheck?.value}, Got: ${password}`);
      return createResponse('Access-Reject', packet, {});
    }
    
    console.log(`[RADIUS] User ${username} authenticated successfully!`);
    
    // Get reply attributes
    const replyAttrs = [];
    
    // Add Session-Timeout if exists
    const sessionTimeout = checks.find(c => c.attribute === 'Session-Timeout');
    if (sessionTimeout) {
      replyAttrs.push(['Session-Timeout', parseInt(sessionTimeout.value)]);
    }
    
    // Get radreply attributes
    const [replies] = await conn.execute(
      'SELECT * FROM radreply WHERE username = ?',
      [username]
    );
    
    for (const reply of replies) {
      // Handle speed limits
      if (reply.attribute === 'Mikrotik-Rate-Limit') {
        replyAttrs.push(['Mikrotik-Rate-Limit', reply.value]);
      } else {
        replyAttrs.push([reply.attribute, reply.value]);
      }
    }
    
    console.log(`[RADIUS] Reply attributes:`, replyAttrs);
    
    return createResponse('Access-Accept', packet, replyAttrs);
    
  } catch (error) {
    console.error('[RADIUS] Database error:', error);
    return createResponse('Access-Reject', packet, {});
  }
}

/**
 * Handle Accounting-Request
 */
async function handleAccountingRequest(packet, rinfo) {
  const statusType = packet.attributes['Acct-Status-Type'];
  const username = packet.attributes['User-Name'];
  const sessionId = packet.attributes['Acct-Session-Id'];
  const nasIp = packet.attributes['NAS-IP-Address'] || rinfo.address;
  const framedIp = packet.attributes['Framed-IP-Address'];
  const sessionTime = packet.attributes['Acct-Session-Time'] || 0;
  const inputOctets = packet.attributes['Acct-Input-Octets'] || 0;
  const outputOctets = packet.attributes['Acct-Output-Octets'] || 0;
  
  console.log(`[RADIUS] Accounting-Request: ${statusType} for ${username}`);
  console.log(`[RADIUS] Session: ${sessionId}, NAS: ${nasIp}, IP: ${framedIp}`);
  
  try {
    const conn = await getDbConnection();
    if (!conn) {
      console.log('[RADIUS] Database not available');
      return createResponse('Accounting-Response', packet, []);
    }
    
    const now = new Date();
    
    if (statusType === 'Start') {
      // Insert new session
      await conn.execute(
        `INSERT INTO radacct (username, nasipaddress, acctsessionid, acctuniqueid, framedipaddress, acctstarttime, acctsessiontime, acctinputoctets, acctoutputoctets)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)`,
        [username, nasIp, sessionId, `${sessionId}-${Date.now()}`, framedIp, now]
      );
      console.log(`[RADIUS] Session started for ${username}`);
      
    } else if (statusType === 'Stop') {
      // Update session with stop time
      const terminateCause = packet.attributes['Acct-Terminate-Cause'] || 'User-Request';
      await conn.execute(
        `UPDATE radacct SET acctstoptime = ?, acctsessiontime = ?, acctinputoctets = ?, acctoutputoctets = ?, acctterminatecause = ?
         WHERE acctsessionid = ? AND acctstoptime IS NULL`,
        [now, sessionTime, inputOctets, outputOctets, terminateCause, sessionId]
      );
      console.log(`[RADIUS] Session stopped for ${username}`);
      
    } else if (statusType === 'Interim-Update') {
      // Update session with current stats
      await conn.execute(
        `UPDATE radacct SET acctsessiontime = ?, acctinputoctets = ?, acctoutputoctets = ?
         WHERE acctsessionid = ? AND acctstoptime IS NULL`,
        [sessionTime, inputOctets, outputOctets, sessionId]
      );
      console.log(`[RADIUS] Session updated for ${username}`);
    }
    
  } catch (error) {
    console.error('[RADIUS] Accounting error:', error);
  }
  
  // Always respond with Accounting-Response
  return createResponse('Accounting-Response', packet, []);
}

/**
 * Create RADIUS response packet
 */
function createResponse(code, request, attributes) {
  const response = radius.encode_response({
    packet: request,
    code,
    secret: RADIUS_SECRET,
    attributes: attributes,
  });
  return response;
}

/**
 * Start RADIUS Authentication Server
 */
function startAuthServer() {
  const server = dgram.createSocket('udp4');
  
  server.on('message', async (msg, rinfo) => {
    try {
      const packet = radius.decode({ packet: msg, secret: RADIUS_SECRET });
      
      console.log(`[RADIUS] Received ${packet.code} from ${rinfo.address}:${rinfo.port}`);
      
      let response;
      
      if (packet.code === 'Access-Request') {
        response = await handleAccessRequest(packet, rinfo);
      } else {
        console.log(`[RADIUS] Unknown packet type: ${packet.code}`);
        return;
      }
      
      server.send(response, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.error('[RADIUS] Failed to send response:', err);
        } else {
          console.log(`[RADIUS] Response sent to ${rinfo.address}:${rinfo.port}`);
        }
      });
      
    } catch (error) {
      console.error('[RADIUS] Error processing packet:', error);
    }
  });
  
  server.on('error', (err) => {
    console.error('[RADIUS] Auth server error:', err);
  });
  
  server.bind(AUTH_PORT, '0.0.0.0', () => {
    console.log(`[RADIUS] Authentication server listening on 0.0.0.0:${AUTH_PORT}`);
  });
  
  return server;
}

/**
 * Start RADIUS Accounting Server
 */
function startAcctServer() {
  const server = dgram.createSocket('udp4');
  
  server.on('message', async (msg, rinfo) => {
    try {
      const packet = radius.decode({ packet: msg, secret: RADIUS_SECRET });
      
      console.log(`[RADIUS] Received ${packet.code} from ${rinfo.address}:${rinfo.port}`);
      
      let response;
      
      if (packet.code === 'Accounting-Request') {
        response = await handleAccountingRequest(packet, rinfo);
      } else {
        console.log(`[RADIUS] Unknown packet type: ${packet.code}`);
        return;
      }
      
      server.send(response, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.error('[RADIUS] Failed to send response:', err);
        } else {
          console.log(`[RADIUS] Response sent to ${rinfo.address}:${rinfo.port}`);
        }
      });
      
    } catch (error) {
      console.error('[RADIUS] Error processing packet:', error);
    }
  });
  
  server.on('error', (err) => {
    console.error('[RADIUS] Acct server error:', err);
  });
  
  server.bind(ACCT_PORT, '0.0.0.0', () => {
    console.log(`[RADIUS] Accounting server listening on 0.0.0.0:${ACCT_PORT}`);
  });
  
  return server;
}

// Start servers
console.log('='.repeat(60));
console.log('RADIUS Server Starting...');
console.log('='.repeat(60));
console.log(`Auth Port: ${AUTH_PORT}`);
console.log(`Acct Port: ${ACCT_PORT}`);
console.log(`Secret: ${RADIUS_SECRET}`);
console.log('='.repeat(60));

const authServer = startAuthServer();
const acctServer = startAcctServer();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[RADIUS] Shutting down...');
  authServer.close();
  acctServer.close();
  if (db) db.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[RADIUS] Shutting down...');
  authServer.close();
  acctServer.close();
  if (db) db.end();
  process.exit(0);
});
