/**
 * VPS Management Service
 * Provides interface for Update, Rollback, Backup, Restore operations on VPS
 */

import { ENV } from "../_core/env";

// VPS Management API configuration
const VPS_API_URL = ENV.VPS_MANAGEMENT_URL || "http://127.0.0.1:8081";
const VPS_API_SECRET = ENV.VPS_MANAGEMENT_SECRET || "";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

interface ServiceStatus {
  app: string;
  freeradius: string;
  vpn: string;
  dhcp: string;
}

interface HealthCheck {
  app_running: boolean;
  api_responding: boolean;
  db_connected: boolean;
}

interface SystemStatus {
  version: string;
  services: ServiceStatus;
  disk_usage: string;
  backups_count: number;
  health: HealthCheck;
  timestamp: string;
}

interface VersionInfo {
  hash: string;
  message: string;
  date: string;
}

interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  created: string;
}

interface UpdateResult {
  old_version: string;
  new_version: string;
  health: HealthCheck;
  backup_id: string;
}

interface RollbackResult {
  previous_version: string;
  current_version: string;
}

interface BackupResult {
  backup_id: string;
  path: string;
  size: number;
}

interface RestoreResult {
  restored_backup: string;
  timestamp: string;
}

async function callVpsApi<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${VPS_API_URL}${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${VPS_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (error) {
    console.error(`[VPSManagement] API call failed: ${endpoint}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get system status including services, version, and health
 */
export async function getSystemStatus(): Promise<ApiResponse<SystemStatus>> {
  return callVpsApi<SystemStatus>("/api/status");
}

/**
 * Get list of available versions (git commits)
 */
export async function getVersions(): Promise<ApiResponse<{ current: string; versions: VersionInfo[] }>> {
  return callVpsApi<{ current: string; versions: VersionInfo[] }>("/api/versions");
}

/**
 * Update to latest version
 */
export async function updateSystem(): Promise<ApiResponse<UpdateResult>> {
  return callVpsApi<UpdateResult>("/api/update", "POST");
}

/**
 * Rollback to a specific version
 */
export async function rollbackSystem(version?: string): Promise<ApiResponse<RollbackResult>> {
  return callVpsApi<RollbackResult>("/api/rollback", "POST", version ? { version } : undefined);
}

/**
 * Get list of available backups
 */
export async function getBackups(): Promise<ApiResponse<BackupInfo[]>> {
  return callVpsApi<BackupInfo[]>("/api/backups");
}

/**
 * Create a new backup
 */
export async function createBackup(prefix: string = "manual"): Promise<ApiResponse<BackupResult>> {
  return callVpsApi<BackupResult>("/api/backup", "POST", { prefix });
}

/**
 * Restore from a backup
 */
export async function restoreBackup(backupId: string): Promise<ApiResponse<RestoreResult>> {
  return callVpsApi<RestoreResult>("/api/restore", "POST", { backup_id: backupId });
}

/**
 * Get service logs
 */
export async function getServiceLogs(
  serviceName: string,
  lines: number = 100
): Promise<ApiResponse<{ service: string; logs: string }>> {
  return callVpsApi<{ service: string; logs: string }>(`/api/logs/${serviceName}?lines=${lines}`);
}

/**
 * Manage a service (start/stop/restart/reload)
 * Note: Only 'app' and 'dhcp' can be managed via API
 */
export async function manageService(
  serviceName: string,
  action: "start" | "stop" | "restart" | "reload"
): Promise<ApiResponse<{ service: string; action: string; new_status: string }>> {
  return callVpsApi<{ service: string; action: string; new_status: string }>(
    `/api/service/${serviceName}/${action}`,
    "POST"
  );
}

/**
 * Deploy update package to VPS (Zero Downtime)
 * @param packageData Base64 encoded tar.gz file
 */
export async function deployUpdate(packageData: string): Promise<ApiResponse<{ message: string; output: string }>> {
  return callVpsApi<{ message: string; output: string }>("/api/deploy", "POST", { package: packageData });
}

/**
 * Quick reload of the application (Zero Downtime)
 */
export async function reloadApp(): Promise<ApiResponse<{ message: string; status: string; output: string }>> {
  return callVpsApi<{ message: string; status: string; output: string }>("/api/reload", "POST");
}

export const vpsManagementService = {
  getSystemStatus,
  getVersions,
  updateSystem,
  rollbackSystem,
  getBackups,
  createBackup,
  restoreBackup,
  getServiceLogs,
  manageService,
  deployUpdate,
  reloadApp,
};
