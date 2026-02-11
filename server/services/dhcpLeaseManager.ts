/**
 * DHCP Lease Manager
 * Manages static DHCP leases on the VPS via SSH
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// VPS Connection Details (from environment)
const VPS_HOST = process.env.VPS_HOST || '37.60.228.5';
const VPS_PORT = process.env.VPS_SSH_PORT || '1991';
const VPS_USER = process.env.VPS_USER || 'root';
const VPS_PASSWORD = process.env.VPS_PASSWORD || '';

const DNSMASQ_CONFIG_FILE = '/etc/dnsmasq.d/radius-vpn.conf';

/**
 * Execute SSH command on VPS
 */
async function sshExec(command: string): Promise<{ stdout: string; stderr: string }> {
  const sshCommand = `sshpass -p '${VPS_PASSWORD}' ssh -o StrictHostKeyChecking=no -p ${VPS_PORT} ${VPS_USER}@${VPS_HOST} "${command.replace(/"/g, '\\"')}"`;
  
  try {
    const result = await execAsync(sshCommand);
    return result;
  } catch (error: any) {
    console.error('[DHCP Manager] SSH command failed:', error.message);
    throw new Error(`SSH execution failed: ${error.message}`);
  }
}

/**
 * Add static DHCP lease
 * @param mac MAC address (format: aa:bb:cc:dd:ee:ff)
 * @param ip IP address (format: 192.168.30.X)
 * @param hostname Hostname for the lease
 */
export async function addStaticLease(mac: string, ip: string, hostname: string): Promise<void> {
  console.log(`[DHCP Manager] Adding static lease: ${mac} -> ${ip} (${hostname})`);
  
  // Validate inputs
  if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac)) {
    throw new Error(`Invalid MAC address format: ${mac}`);
  }
  
  if (!/^192\.168\.30\.\d{1,3}$/.test(ip)) {
    throw new Error(`Invalid IP address format: ${ip}`);
  }
  
  // Check if lease already exists
  const checkCommand = `grep -q "${mac}" ${DNSMASQ_CONFIG_FILE} && echo "EXISTS" || echo "NOT_EXISTS"`;
  const checkResult = await sshExec(checkCommand);
  
  if (checkResult.stdout.trim() === 'EXISTS') {
    console.log(`[DHCP Manager] Lease for ${mac} already exists, removing old entry`);
    await removeStaticLease(mac);
  }
  
  // Add new lease
  const leaseEntry = `dhcp-host=${mac},${ip},${hostname},infinite`;
  const addCommand = `echo "${leaseEntry}" >> ${DNSMASQ_CONFIG_FILE}`;
  await sshExec(addCommand);
  
  // Restart dnsmasq
  await restartDnsmasq();
  
  console.log(`[DHCP Manager] Static lease added successfully`);
}

/**
 * Remove static DHCP lease by MAC address
 */
export async function removeStaticLease(mac: string): Promise<void> {
  console.log(`[DHCP Manager] Removing static lease for MAC: ${mac}`);
  
  // Remove line containing the MAC address
  const removeCommand = `sed -i '/${mac}/d' ${DNSMASQ_CONFIG_FILE}`;
  await sshExec(removeCommand);
  
  // Restart dnsmasq
  await restartDnsmasq();
  
  console.log(`[DHCP Manager] Static lease removed successfully`);
}

/**
 * List all static DHCP leases
 */
export async function listStaticLeases(): Promise<Array<{
  mac: string;
  ip: string;
  hostname: string;
}>> {
  console.log('[DHCP Manager] Listing static leases');
  
  const command = `grep "^dhcp-host=" ${DNSMASQ_CONFIG_FILE} || echo ""`;
  const result = await sshExec(command);
  
  const leases: Array<{ mac: string; ip: string; hostname: string }> = [];
  
  if (result.stdout.trim()) {
    const lines = result.stdout.trim().split('\n');
    
    for (const line of lines) {
      // Parse: dhcp-host=aa:bb:cc:dd:ee:ff,192.168.30.13,hostname,infinite
      const match = line.match(/dhcp-host=([^,]+),([^,]+),([^,]+)/);
      if (match) {
        leases.push({
          mac: match[1],
          ip: match[2],
          hostname: match[3]
        });
      }
    }
  }
  
  return leases;
}

/**
 * Get current DHCP leases from dnsmasq
 */
export async function getCurrentLeases(): Promise<Array<{
  mac: string;
  ip: string;
  hostname: string;
  expiry: string;
}>> {
  console.log('[DHCP Manager] Getting current DHCP leases');
  
  const command = `cat /var/lib/misc/dnsmasq.leases || echo ""`;
  const result = await sshExec(command);
  
  const leases: Array<{ mac: string; ip: string; hostname: string; expiry: string }> = [];
  
  if (result.stdout.trim()) {
    const lines = result.stdout.trim().split('\n');
    
    for (const line of lines) {
      // Parse: 1770888784 aa:bb:cc:dd:ee:ff 192.168.30.10 hostname 01:aa:bb:cc:dd:ee:ff
      const parts = line.split(' ');
      if (parts.length >= 4) {
        leases.push({
          expiry: parts[0],
          mac: parts[1],
          ip: parts[2],
          hostname: parts[3]
        });
      }
    }
  }
  
  return leases;
}

/**
 * Restart dnsmasq service
 */
async function restartDnsmasq(): Promise<void> {
  console.log('[DHCP Manager] Restarting dnsmasq');
  
  const command = 'systemctl restart dnsmasq';
  await sshExec(command);
  
  // Wait for service to stabilize
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('[DHCP Manager] dnsmasq restarted successfully');
}

/**
 * Find MAC address for a given IP from current leases
 */
export async function findMACByIP(ip: string): Promise<string | null> {
  const leases = await getCurrentLeases();
  const lease = leases.find(l => l.ip === ip);
  return lease ? lease.mac : null;
}
