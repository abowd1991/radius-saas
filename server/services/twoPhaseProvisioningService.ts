/**
 * Two-Phase NAS Provisioning Service
 * 
 * This service handles the enterprise-standard two-phase provisioning for VPN-connected NAS devices:
 * 
 * Phase 1 (Create NAS):
 * - nasname = 'pending'
 * - status = 'pending' (FreeRADIUS won't load it)
 * - provisioningStatus = 'pending'
 * - VPN user created in SoftEther
 * 
 * Phase 2 (First VPN Connect):
 * - Read actual IP from VPN session
 * - Read MAC from DHCP leases
 * - Create DHCP reservation (MAC → actual IP)
 * - Update nasname = actual IP
 * - Update status = 'active', provisioningStatus = 'ready'
 * - Reload FreeRADIUS
 * 
 * Security:
 * - FreeRADIUS only accepts NAS with status='active' AND provisioningStatus='ready'
 * - Pending NAS cannot authenticate
 * 
 * Idempotency:
 * - Check if reservation already exists before creating
 * - Rate-limit reload calls (30 seconds minimum)
 * - Don't update nasname if already 'ready' unless IP actually changed
 */

import * as nasDb from '../db/nas';
import * as sshVpn from './sshVpnService';
import * as freeradiusService from './freeradiusService';
import { getDb } from '../db';
import { nasDevices, allocatedVpnIps } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

// Rate limiting for FreeRADIUS reload
let lastReloadTime = 0;
const RELOAD_RATE_LIMIT_MS = 30000; // 30 seconds

/**
 * Rate-limited FreeRADIUS reload
 * Prevents excessive reloads that could disrupt service
 */
export async function rateLimitedReload(): Promise<{ success: boolean; message: string; skipped?: boolean }> {
  const now = Date.now();
  const timeSinceLastReload = now - lastReloadTime;
  
  if (timeSinceLastReload < RELOAD_RATE_LIMIT_MS) {
    const waitTime = Math.ceil((RELOAD_RATE_LIMIT_MS - timeSinceLastReload) / 1000);
    console.log(`[Provisioning] Skipping reload - rate limited (${waitTime}s remaining)`);
    return { success: true, message: `Rate limited, next reload in ${waitTime}s`, skipped: true };
  }
  
  const result = await freeradiusService.reloadFreeRADIUS();
  if (result.success) {
    lastReloadTime = now;
  }
  
  return result;
}

/**
 * Check if DHCP reservation already exists for this NAS
 */
export async function checkExistingReservation(nasId: number): Promise<{
  exists: boolean;
  hostname?: string;
  macAddress?: string;
  ipAddress?: string;
}> {
  try {
    const reservations = await sshVpn.listDhcpReservations();
    if (!reservations.success || !reservations.reservations) {
      return { exists: false };
    }
    
    const hostname = `nas-${nasId}`;
    const existing = reservations.reservations.find(r => r.hostname === hostname);
    
    if (existing) {
      return {
        exists: true,
        hostname: existing.hostname,
        macAddress: existing.macAddress,
        ipAddress: existing.ipAddress,
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('[Provisioning] Error checking existing reservation:', error);
    return { exists: false };
  }
}

/**
 * Complete Phase 2 provisioning for a NAS device
 * Called when VPN connection is detected
 */
export async function completeProvisioning(
  nasId: number,
  vpnUsername: string
): Promise<{
  success: boolean;
  message: string;
  actualIp?: string;
  macAddress?: string;
}> {
  console.log(`[Provisioning] Starting Phase 2 for NAS ${nasId} (VPN user: ${vpnUsername})`);
  
  // 1. Get NAS from database
  const nas = await nasDb.getNasById(nasId);
  if (!nas) {
    return { success: false, message: 'NAS not found' };
  }
  
  // 2. Get session info (MAC and IP) from VPN first to check if IP matches
  const sessionInfo = await sshVpn.getSessionMac(vpnUsername);
  if (!sessionInfo.success || !sessionInfo.macAddress || !sessionInfo.ipAddress) {
    console.log(`[Provisioning] VPN session not found for ${vpnUsername}`);
    return { success: false, message: 'VPN session not found or no MAC/IP available' };
  }
  
  const actualIp = sessionInfo.ipAddress;
  const macAddress = sessionInfo.macAddress;
  
  console.log(`[Provisioning] Found session: IP=${actualIp}, MAC=${macAddress}`);
  
  // 3. Check if already provisioned WITH CORRECT IP (idempotency)
  if (nas.provisioningStatus === 'ready' && nas.status === 'active' && nas.nasname === actualIp) {
    console.log(`[Provisioning] NAS ${nasId} already provisioned with correct IP ${nas.nasname}`);
    return { success: true, message: 'Already provisioned', actualIp: nas.nasname, macAddress: nas.lastMac || undefined };
  }
  
  // If IP mismatch, we need to re-provision
  if (nas.nasname !== 'pending' && nas.nasname !== actualIp) {
    console.log(`[Provisioning] IP MISMATCH for NAS ${nasId}: DB has ${nas.nasname}, VPN has ${actualIp}. Re-provisioning...`);
  }
  
  // 4. Check if DHCP reservation already exists (idempotency)
  const existingReservation = await checkExistingReservation(nasId);
  
  if (existingReservation.exists) {
    console.log(`[Provisioning] DHCP reservation already exists for NAS ${nasId}`);
    
    // If reservation exists but with different IP, we need to handle this
    if (existingReservation.ipAddress !== actualIp) {
      console.log(`[Provisioning] WARNING: Existing reservation IP (${existingReservation.ipAddress}) differs from current IP (${actualIp})`);
      // Delete old reservation and create new one
      await sshVpn.deleteDhcpReservation(`nas-${nasId}`);
    } else {
      // Reservation exists with correct IP, just update database
      await nasDb.finalizeNasProvisioning(nasId, actualIp, macAddress);
      await rateLimitedReload();
      return { success: true, message: 'Provisioning completed (reservation existed)', actualIp, macAddress };
    }
  }
  
  // 5. Create DHCP reservation
  const hostname = `nas-${nasId}`;
  const reservationResult = await sshVpn.createDhcpReservation(macAddress, actualIp, hostname);
  
  if (!reservationResult.success && !reservationResult.error?.includes('already exists')) {
    console.error(`[Provisioning] Failed to create DHCP reservation:`, reservationResult.error);
    await nasDb.markNasProvisioningError(nasId, `DHCP reservation failed: ${reservationResult.error}`);
    return { success: false, message: `DHCP reservation failed: ${reservationResult.error}` };
  }
  
  console.log(`[Provisioning] DHCP reservation created: ${macAddress} -> ${actualIp}`);
  
  // 6. Update NAS in database (nasname = actual IP, status = active)
  const finalizeResult = await nasDb.finalizeNasProvisioning(nasId, actualIp, macAddress);
  if (!finalizeResult.success) {
    return { success: false, message: finalizeResult.message };
  }
  
  // 7. Update allocated_vpn_ips table if needed
  const db = await getDb();
  if (db) {
    try {
      // Check if there's an existing allocation
      const existingAllocation = await db.select()
        .from(allocatedVpnIps)
        .where(eq(allocatedVpnIps.nasId, nasId))
        .limit(1);
      
      if (existingAllocation.length > 0 && existingAllocation[0].ipAddress !== actualIp) {
        // Update to actual IP
        await db.update(allocatedVpnIps)
          .set({ ipAddress: actualIp })
          .where(eq(allocatedVpnIps.nasId, nasId));
        console.log(`[Provisioning] Updated IP allocation: ${existingAllocation[0].ipAddress} -> ${actualIp}`);
      }
    } catch (error) {
      console.error('[Provisioning] Error updating IP allocation:', error);
    }
  }
  
  // 8. Reload FreeRADIUS (rate-limited)
  const reloadResult = await rateLimitedReload();
  console.log(`[Provisioning] FreeRADIUS reload:`, reloadResult.message);
  
  console.log(`[Provisioning] Phase 2 complete for NAS ${nasId}: IP=${actualIp}, MAC=${macAddress}`);
  return { success: true, message: 'Provisioning completed successfully', actualIp, macAddress };
}

/**
 * Background worker to check pending NAS devices
 * This runs periodically to catch any NAS that connected while we weren't watching
 */
export async function checkPendingNasDevices(): Promise<void> {
  console.log('[Provisioning] Checking pending NAS devices...');
  
  const pendingDevices = await nasDb.getPendingNasDevices();
  
  for (const nas of pendingDevices) {
    if (!nas.vpnUsername) continue;
    
    console.log(`[Provisioning] Checking pending NAS ${nas.id} (${nas.vpnUsername})`);
    
    // Try to complete provisioning
    const result = await completeProvisioning(nas.id, nas.vpnUsername);
    
    if (result.success) {
      console.log(`[Provisioning] Successfully provisioned NAS ${nas.id}`);
    } else {
      console.log(`[Provisioning] NAS ${nas.id} not ready: ${result.message}`);
    }
  }
}

/**
 * Auto-provision a newly created NAS
 * This is called after NAS creation to wait for VPN connection
 */
export async function autoProvisionNewNas(
  nasId: number,
  vpnUsername: string,
  maxRetries: number = 24,
  retryInterval: number = 5000
): Promise<{
  success: boolean;
  message: string;
  actualIp?: string;
  macAddress?: string;
}> {
  console.log(`[Provisioning] Starting auto-provision for NAS ${nasId} (${vpnUsername})`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Provisioning] Attempt ${attempt}/${maxRetries} for NAS ${nasId}`);
    
    const result = await completeProvisioning(nasId, vpnUsername);
    
    if (result.success) {
      return result;
    }
    
    // If not found, wait and retry
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  
  // Mark as error after all retries
  await nasDb.markNasProvisioningError(nasId, `Failed to provision after ${maxRetries} attempts`);
  return { success: false, message: `Failed to provision after ${maxRetries} attempts` };
}

/**
 * Manual trigger for provisioning (for admin use)
 */
export async function manualProvision(nasId: number): Promise<{
  success: boolean;
  message: string;
  actualIp?: string;
  macAddress?: string;
}> {
  const nas = await nasDb.getNasById(nasId);
  if (!nas) {
    return { success: false, message: 'NAS not found' };
  }
  
  if (!nas.vpnUsername) {
    return { success: false, message: 'NAS has no VPN username' };
  }
  
  return completeProvisioning(nasId, nas.vpnUsername);
}
