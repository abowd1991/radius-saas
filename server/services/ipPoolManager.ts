/**
 * IP Pool Manager
 * Manages NAS IP allocation from a predefined pool
 */

import { getDb } from "../db";
import { nasDevices } from "../../drizzle/schema";
import { sql } from "drizzle-orm";

// IP Pool Configuration
const IP_POOL_START = "192.168.30.10";
const IP_POOL_END = "192.168.30.200";
const IP_POOL_SUBNET = "192.168.30";

/**
 * Convert IP string to number for comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Convert number back to IP string
 */
function numberToIp(num: number): string {
  return [
    (num >>> 24) & 0xFF,
    (num >>> 16) & 0xFF,
    (num >>> 8) & 0xFF,
    num & 0xFF
  ].join('.');
}

/**
 * Get all allocated IPs from database
 */
async function getAllocatedIPs(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  const allocatedNas = await db
    .select({ allocatedIp: nasDevices.allocatedIp })
    .from(nasDevices)
    .where(sql`${nasDevices.allocatedIp} IS NOT NULL`);
  
  return allocatedNas.map((n: any) => n.allocatedIp!).filter(Boolean);
}

/**
 * Get next available IP from pool
 * @returns Next available IP address or null if pool is exhausted
 */
export async function getNextAvailableIP(): Promise<string | null> {
  const allocatedIPs = await getAllocatedIPs();
  const allocatedSet = new Set(allocatedIPs);
  
  const startNum = ipToNumber(IP_POOL_START);
  const endNum = ipToNumber(IP_POOL_END);
  
  for (let ipNum = startNum; ipNum <= endNum; ipNum++) {
    const ip = numberToIp(ipNum);
    if (!allocatedSet.has(ip)) {
      return ip;
    }
  }
  
  return null; // Pool exhausted
}

/**
 * Check if IP is within the pool range
 */
export function isIPInPool(ip: string): boolean {
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(IP_POOL_START);
  const endNum = ipToNumber(IP_POOL_END);
  
  return ipNum >= startNum && ipNum <= endNum;
}

/**
 * Get pool statistics
 */
export async function getPoolStats(): Promise<{
  total: number;
  allocated: number;
  available: number;
  utilizationPercent: number;
}> {
  const allocatedIPs = await getAllocatedIPs();
  const startNum = ipToNumber(IP_POOL_START);
  const endNum = ipToNumber(IP_POOL_END);
  const total = endNum - startNum + 1;
  const allocated = allocatedIPs.length;
  const available = total - allocated;
  const utilizationPercent = Math.round((allocated / total) * 100);
  
  return {
    total,
    allocated,
    available,
    utilizationPercent
  };
}

/**
 * Release IP back to pool (mark as available)
 * This is called when NAS is disabled or deleted
 */
export async function releaseIP(ip: string): Promise<void> {
  // IP is automatically released when allocatedIp is set to NULL in database
  // This function is here for explicit documentation and future enhancements
  console.log(`[IP Pool] Released IP: ${ip}`);
}

/**
 * Reserve IP for a NAS
 * @param nasId NAS ID to reserve IP for
 * @returns Reserved IP address or null if pool exhausted
 */
export async function reserveIPForNAS(nasId: number): Promise<string | null> {
  const nextIP = await getNextAvailableIP();
  
  if (!nextIP) {
    console.error('[IP Pool] Pool exhausted - no IPs available');
    return null;
  }
  
  console.log(`[IP Pool] Reserved IP ${nextIP} for NAS ${nasId}`);
  return nextIP;
}
