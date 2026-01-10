/**
 * Test RADIUS Authentication locally
 */

import * as dgram from 'dgram';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const radius = require('radius');

const RADIUS_SECRET = 'testing123';
const RADIUS_HOST = '127.0.0.1';
const AUTH_PORT = 1812;

// Test user
const username = 'testuser001';
const password = '1234';

console.log('='.repeat(60));
console.log('Testing RADIUS Authentication');
console.log('='.repeat(60));
console.log(`Server: ${RADIUS_HOST}:${AUTH_PORT}`);
console.log(`Username: ${username}`);
console.log(`Password: ${password}`);
console.log('='.repeat(60));

const client = dgram.createSocket('udp4');

// Create Access-Request packet
const packet = radius.encode({
  code: 'Access-Request',
  secret: RADIUS_SECRET,
  attributes: [
    ['User-Name', username],
    ['User-Password', password],
    ['NAS-IP-Address', '127.0.0.1'],
    ['NAS-Port', 1],
  ],
});

// Set timeout
const timeout = setTimeout(() => {
  console.log('ERROR: Request timed out (no response from server)');
  client.close();
  process.exit(1);
}, 5000);

// Handle response
client.on('message', (msg, rinfo) => {
  clearTimeout(timeout);
  
  try {
    const response = radius.decode({ packet: msg, secret: RADIUS_SECRET });
    
    console.log(`\nResponse from ${rinfo.address}:${rinfo.port}`);
    console.log(`Code: ${response.code}`);
    
    if (response.code === 'Access-Accept') {
      console.log('\n✅ SUCCESS: Authentication accepted!');
      console.log('\nReply Attributes:');
      for (const [key, value] of Object.entries(response.attributes)) {
        console.log(`  ${key}: ${value}`);
      }
    } else if (response.code === 'Access-Reject') {
      console.log('\n❌ REJECTED: Authentication failed');
    } else {
      console.log(`\n⚠️ Unexpected response: ${response.code}`);
    }
    
  } catch (error) {
    console.error('Error decoding response:', error);
  }
  
  client.close();
});

client.on('error', (err) => {
  clearTimeout(timeout);
  console.error('Client error:', err);
  client.close();
});

// Send request
console.log('\nSending Access-Request...');
client.send(packet, AUTH_PORT, RADIUS_HOST, (err) => {
  if (err) {
    console.error('Failed to send packet:', err);
    client.close();
  } else {
    console.log('Packet sent, waiting for response...');
  }
});
