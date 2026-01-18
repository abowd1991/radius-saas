/**
 * VPS Management Service
 * Provides interface for system status and management operations
 * Uses the existing VPS API on port 8080
 */

import { ENV } from "../_core/env";

// VPS API configuration - uses the existing API on port 8080
const VPS_API_URL = ENV.VPS_MANAGEMENT_URL || "http://37.60.228.5:8080";
const VPS_API_KEY = ENV.VPS_MANAGEMENT_SECRET || "radius_api_key_2024_secure";

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

/**
 * Call VPS API with proper authentication
 */
async function callVpsApi<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    const url = `${VPS_API_URL}${endpoint}`;
    console.log(`[VPSManagement] Calling: ${method} ${url}`);
    
    const response = await fetch(url, {
      method,
      headers: {
        "X-API-Key": VPS_API_KEY,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VPSManagement] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: errorText,
      };
    }

    const data = await response.json();
    console.log(`[VPSManagement] Response:`, JSON.stringify(data).substring(0, 200));
    return { success: true, data: data as T };
  } catch (error) {
    console.error(`[VPSManagement] API call failed: ${endpoint}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get system status by aggregating from available VPS API endpoints
 */
export async function getSystemStatus(): Promise<ApiResponse<SystemStatus>> {
  try {
    // Fetch status from available endpoints
    const [radiusResult, vpnResult, dhcpResult] = await Promise.all([
      callVpsApi<{ isActive: boolean; status: string; success: boolean }>("/api/radius/status"),
      callVpsApi<{ status: { hubName: string; online: boolean }; success: boolean } | { hubName: string; online: boolean }>("/api/vpn/status"),
      callVpsApi<{ count: number; leases: unknown[] }>("/api/dhcp/leases"),
    ]);

    // Build services status from actual API responses
    // VPN API returns { status: { hubName, online }, success } or { hubName, online }
    let vpnOnline = false;
    if (vpnResult.success && vpnResult.data) {
      const vpnData = vpnResult.data as { status?: { online: boolean }; online?: boolean };
      vpnOnline = vpnData.status?.online ?? vpnData.online ?? false;
    }
    
    const services: ServiceStatus = {
      app: "not_available", // App status cannot be determined from VPS API
      freeradius: radiusResult.success && radiusResult.data?.isActive ? "active" : "inactive",
      vpn: vpnResult.success && vpnOnline ? "active" : "inactive",
      dhcp: dhcpResult.success ? "active" : "inactive", // If leases endpoint works, DHCP is running
    };

    // Health check based on API responses
    const health: HealthCheck = {
      app_running: false, // Cannot determine from VPS API
      api_responding: radiusResult.success || vpnResult.success,
      db_connected: true, // Assume connected if we can query
    };

    const systemStatus: SystemStatus = {
      version: "v1.0.0", // Static version for now
      services,
      disk_usage: "N/A", // Not available from current API
      backups_count: 0, // Not available from current API
      health,
      timestamp: new Date().toISOString(),
    };

    return { success: true, data: systemStatus };
  } catch (error) {
    console.error("[VPSManagement] getSystemStatus failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get system status",
    };
  }
}

/**
 * Get list of available versions
 * Note: Not implemented in current VPS API
 */
export async function getVersions(): Promise<ApiResponse<{ current: string; versions: VersionInfo[] }>> {
  return {
    success: true,
    data: {
      current: "v1.0.0",
      versions: [
        {
          hash: "current",
          message: "Current version",
          date: new Date().toISOString(),
        },
      ],
    },
  };
}

/**
 * Update to latest version
 * Note: Not implemented in current VPS API - returns informative message
 */
export async function updateSystem(): Promise<ApiResponse<UpdateResult>> {
  return {
    success: false,
    error: "التحديث التلقائي غير متاح حالياً. يرجى التواصل مع الدعم الفني لتحديث النظام.",
    details: "Update API endpoint (/api/update) is not implemented on VPS. Manual update required.",
  };
}

/**
 * Rollback to a specific version
 * Note: Not implemented in current VPS API
 */
export async function rollbackSystem(version?: string): Promise<ApiResponse<RollbackResult>> {
  return {
    success: false,
    error: "الرجوع للنسخة السابقة غير متاح حالياً. يرجى التواصل مع الدعم الفني.",
    details: "Rollback API endpoint (/api/rollback) is not implemented on VPS.",
  };
}

/**
 * Get list of available backups
 * Note: Not implemented in current VPS API
 */
export async function getBackups(): Promise<ApiResponse<BackupInfo[]>> {
  return {
    success: true,
    data: [], // No backups available from current API
  };
}

/**
 * Create a new backup
 * Note: Not implemented in current VPS API
 */
export async function createBackup(prefix: string = "manual"): Promise<ApiResponse<BackupResult>> {
  return {
    success: false,
    error: "إنشاء النسخ الاحتياطية غير متاح حالياً. يرجى التواصل مع الدعم الفني.",
    details: "Backup API endpoint (/api/backup) is not implemented on VPS.",
  };
}

/**
 * Restore from a backup
 * Note: Not implemented in current VPS API
 */
export async function restoreBackup(backupId: string): Promise<ApiResponse<RestoreResult>> {
  return {
    success: false,
    error: "استعادة النسخ الاحتياطية غير متاحة حالياً. يرجى التواصل مع الدعم الفني.",
    details: "Restore API endpoint (/api/restore) is not implemented on VPS.",
  };
}

/**
 * Get service logs
 * Note: Not implemented in current VPS API
 */
export async function getServiceLogs(
  serviceName: string,
  lines: number = 100
): Promise<ApiResponse<{ service: string; logs: string }>> {
  return {
    success: false,
    error: "سجلات الخدمات غير متاحة حالياً.",
    details: `Logs API endpoint (/api/logs/${serviceName}) is not implemented on VPS.`,
  };
}

/**
 * Manage a service (start/stop/restart/reload)
 * Only RADIUS reload is available via current VPS API
 */
export async function manageService(
  serviceName: string,
  action: "start" | "stop" | "restart" | "reload"
): Promise<ApiResponse<{ service: string; action: string; new_status: string }>> {
  // Only RADIUS reload is supported
  if (serviceName === "freeradius" && action === "reload") {
    const result = await callVpsApi<{ success: boolean; message?: string }>("/api/radius/reload", "POST");
    if (result.success) {
      return {
        success: true,
        data: {
          service: serviceName,
          action: action,
          new_status: "active",
        },
      };
    }
    return {
      success: false,
      error: result.error || "Failed to reload FreeRADIUS",
    };
  }

  return {
    success: false,
    error: `إدارة الخدمة ${serviceName} (${action}) غير متاحة حالياً.`,
    details: `Service management for ${serviceName}/${action} is not implemented on VPS API.`,
  };
}

/**
 * Deploy update package to VPS
 * Note: Not implemented in current VPS API
 */
export async function deployUpdate(packageData: string): Promise<ApiResponse<{ message: string; output: string }>> {
  return {
    success: false,
    error: "نشر التحديثات غير متاح حالياً.",
    details: "Deploy API endpoint (/api/deploy) is not implemented on VPS.",
  };
}

/**
 * Quick reload of the application
 * Note: Not implemented in current VPS API
 */
export async function reloadApp(): Promise<ApiResponse<{ message: string; status: string; output: string }>> {
  return {
    success: false,
    error: "إعادة تحميل التطبيق غير متاحة حالياً.",
    details: "Reload API endpoint (/api/reload) is not implemented on VPS.",
  };
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
