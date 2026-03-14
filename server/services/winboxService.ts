/**
 * WinboxService
 * Manages TCP port forwarding (socat) on the VPS for Winbox remote access.
 * Each NAS device gets a unique port on the VPS that forwards to the device's VPN IP:8291.
 *
 * Port range: 45000 - 49999 (5000 possible ports)
 * Connection: SSH to VPS using stored credentials
 * Tool: socat (pre-installed on VPS) running as systemd service
 */

import { exec } from "child_process";
import { promisify } from "util";
import { getDb } from "../db";
import { nasDevices } from "../../drizzle/schema";
import { eq, isNotNull, sql } from "drizzle-orm";

const execAsync = promisify(exec);

// VPS SSH credentials
const VPS_HOST = "37.60.228.5";
const VPS_PORT = "1991";
const VPS_USER = "root";
const VPS_PASS = "2U8@tWz@zYnecb2";

const WINBOX_PORT_MIN = 45000;
const WINBOX_PORT_MAX = 49999;
const MIKROTIK_WINBOX_PORT = 8291;

/**
 * Run a command on the VPS via SSH
 */
async function sshExec(command: string): Promise<{ stdout: string; stderr: string }> {
  const sshCmd = `sshpass -p '${VPS_PASS}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${VPS_PORT} ${VPS_USER}@${VPS_HOST} "${command.replace(/"/g, '\\"')}"`;
  try {
    return await execAsync(sshCmd, { timeout: 15000 });
  } catch (err: any) {
    return { stdout: err.stdout || "", stderr: err.stderr || err.message };
  }
}

/**
 * Get a unique available port in range 45000-49999
 */
export async function allocateWinboxPort(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all used ports
  const usedPorts = await db
    .select({ port: nasDevices.winboxPort })
    .from(nasDevices)
    .where(isNotNull(nasDevices.winboxPort));

  const usedSet = new Set(usedPorts.map((r: any) => r.port));

  // Find first available port
  for (let port = WINBOX_PORT_MIN; port <= WINBOX_PORT_MAX; port++) {
    if (!usedSet.has(port)) return port;
  }
  throw new Error("No available Winbox ports in range 45000-49999");
}

/**
 * Create a systemd service for socat port forwarding
 * Service name: winbox-{nasId}
 */
export async function enableWinboxForward(nasId: number, vpnIp: string, port: number): Promise<{ success: boolean; error?: string }> {
  const serviceName = `winbox-${nasId}`;
  const serviceContent = `[Unit]
Description=Winbox TCP Forward for NAS ${nasId} (${vpnIp})
After=network.target

[Service]
ExecStart=/usr/bin/socat TCP-LISTEN:${port},fork,reuseaddr TCP:${vpnIp}:${MIKROTIK_WINBOX_PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target`;

  // Write service file and enable it
  const commands = [
    `echo '${serviceContent.replace(/'/g, "'\\''")}' > /etc/systemd/system/${serviceName}.service`,
    `systemctl daemon-reload`,
    `systemctl enable ${serviceName}`,
    `systemctl start ${serviceName}`,
    `systemctl is-active ${serviceName}`,
  ].join(" && ");

  const { stdout, stderr } = await sshExec(commands);
  const isActive = stdout.trim().includes("active") || stdout.trim() === "active";

  if (!isActive && stderr && !stderr.includes("Warning")) {
    console.error(`[WinboxService] Failed to start ${serviceName}:`, stderr);
    return { success: false, error: stderr.substring(0, 200) };
  }

  // Update DB
  const db = await getDb();
  if (db) {
    await db.update(nasDevices)
      .set({ winboxPort: port, winboxEnabled: true } as any)
      .where(eq(nasDevices.id, nasId));
  }

  console.log(`[WinboxService] ✅ ${serviceName} started on port ${port} → ${vpnIp}:${MIKROTIK_WINBOX_PORT}`);
  return { success: true };
}

/**
 * Disable and remove socat service for a NAS
 */
export async function disableWinboxForward(nasId: number): Promise<{ success: boolean; error?: string }> {
  const serviceName = `winbox-${nasId}`;

  const commands = [
    `systemctl stop ${serviceName} 2>/dev/null || true`,
    `systemctl disable ${serviceName} 2>/dev/null || true`,
    `rm -f /etc/systemd/system/${serviceName}.service`,
    `systemctl daemon-reload`,
    `echo done`,
  ].join(" && ");

  const { stdout, stderr } = await sshExec(commands);

  if (!stdout.includes("done")) {
    console.error(`[WinboxService] Failed to stop ${serviceName}:`, stderr);
    return { success: false, error: stderr.substring(0, 200) };
  }

  // Update DB
  const db = await getDb();
  if (db) {
    await db.update(nasDevices)
      .set({ winboxEnabled: false } as any)
      .where(eq(nasDevices.id, nasId));
  }

  console.log(`[WinboxService] ✅ ${serviceName} stopped and removed`);
  return { success: true };
}

/**
 * Check if socat service is running for a NAS
 */
export async function checkWinboxStatus(nasId: number): Promise<"active" | "inactive" | "unknown"> {
  const serviceName = `winbox-${nasId}`;
  const { stdout } = await sshExec(`systemctl is-active ${serviceName} 2>/dev/null || echo inactive`);
  const status = stdout.trim();
  if (status === "active") return "active";
  if (status === "inactive" || status === "failed") return "inactive";
  return "unknown";
}

/**
 * Restart socat service (useful when VPN IP changes)
 */
export async function restartWinboxForward(nasId: number, vpnIp: string, port: number): Promise<{ success: boolean; error?: string }> {
  await disableWinboxForward(nasId);
  return enableWinboxForward(nasId, vpnIp, port);
}
