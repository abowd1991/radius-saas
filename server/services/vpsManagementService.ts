/**
 * VPS Management Service
 * Provides interface for system status and management operations
 * 
 * Uses TWO APIs:
 * - Port 8081: Management API (App updates only) - NEW
 * - Port 8080: Legacy API (RADIUS/VPN/DHCP status)
 * 
 * ⚠️ IMPORTANT: Management API (8081) does NOT touch:
 * - FreeRADIUS
 * - VPN/SoftEther
 * - DHCP
 * - Any system services
 * 
 * It ONLY handles: git pull → pnpm install → pnpm build → pm2 reload app
 */

import { ENV } from "../_core/env";

// Management API (Port 8081) - App updates only
const MGMT_API_URL = ENV.VPS_MANAGEMENT_URL || "http://37.60.228.5:8081";
const MGMT_API_KEY = ENV.VPS_MANAGEMENT_API_KEY || "";

// Legacy API (Port 8080) - RADIUS/VPN/DHCP status
const LEGACY_API_URL = ENV.VPS_LEGACY_URL || "http://37.60.228.5:8080";
const LEGACY_API_KEY = ENV.VPS_LEGACY_SECRET || "radius_api_key_2024_secure";

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
  memory_usage: string;
  cpu_usage: string;
  backups_count: number;
  health: HealthCheck;
  timestamp: string;
  uptime: string;
}

interface VersionInfo {
  hash: string;
  message: string;
  date: string;
}

interface BackupInfo {
  id: string;
  filename: string;
  size: string;
  created: string;
}

interface UpdateResult {
  old_version: string;
  new_version: string;
  health: HealthCheck;
  backup_id: string;
  message: string;
}

interface RollbackResult {
  previous_version: string;
  current_version: string;
  message: string;
}

/**
 * Call Management API (Port 8081) - For app updates only
 */
async function callMgmtApi<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    const url = `${MGMT_API_URL}${endpoint}`;
    console.log(`[VPSManagement] Calling MGMT API: ${method} ${url}`);
    
    const response = await fetch(url, {
      method,
      headers: {
        "X-API-Key": MGMT_API_KEY,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn(`[VPSManagement] MGMT API returned non-JSON response (${contentType})`);
      return {
        success: false,
        error: "Management API unavailable or returned invalid response",
      };
    }
    
    const data = await response.json();
    console.log(`[VPSManagement] MGMT Response:`, JSON.stringify(data).substring(0, 200));
    
    if (!response.ok || data.success === false) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
        details: data,
      };
    }

    return { success: true, data: data.data || data };
  } catch (error) {
    console.error(`[VPSManagement] MGMT API call failed: ${endpoint}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Call Legacy API (Port 8080) - For RADIUS/VPN/DHCP status
 */
async function callLegacyApi<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    const url = `${LEGACY_API_URL}${endpoint}`;
    console.log(`[VPSManagement] Calling Legacy API: ${method} ${url}`);
    
    const response = await fetch(url, {
      method,
      headers: {
        "X-API-Key": LEGACY_API_KEY,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: errorText,
      };
    }

    const data = await response.json();
    console.log(`[VPSManagement] Legacy Response:`, JSON.stringify(data).substring(0, 200));
    return { success: true, data: data as T };
  } catch (error) {
    console.error(`[VPSManagement] Legacy API call failed: ${endpoint}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get system status by aggregating from both APIs
 */
export async function getSystemStatus(): Promise<ApiResponse<SystemStatus>> {
  try {
    // Fetch from Management API (8081) - App status and system info
    const [systemInfoResult, appStatusResult] = await Promise.all([
      callMgmtApi<{
        disk: { total: string; used: string; free: string; percent: string };
        memory: { total: string; used: string; free: string; percent: string };
        cpu: { cores: number; usage: string };
        uptime: string;
        app: { status: string; uptime: string; memory: string; cpu: string; restarts: number };
      }>("/api/system/info"),
      callMgmtApi<{
        app_name: string;
        status: string;
        uptime: string;
        version: string;
      }>("/api/app/status"),
    ]);

    // Fetch from Legacy API (8080) - RADIUS/VPN/DHCP status
    const [radiusResult, vpnResult, dhcpResult] = await Promise.all([
      callLegacyApi<{ isActive: boolean; status: string; success: boolean }>("/api/radius/status"),
      callLegacyApi<{ status: { hubName: string; online: boolean }; success: boolean } | { hubName: string; online: boolean }>("/api/vpn/status"),
      callLegacyApi<{ count: number; leases: unknown[] }>("/api/dhcp/leases"),
    ]);

    // Build services status
    let vpnOnline = false;
    if (vpnResult.success && vpnResult.data) {
      const vpnData = vpnResult.data as { status?: { online: boolean }; online?: boolean };
      vpnOnline = vpnData.status?.online ?? vpnData.online ?? false;
    }
    
    const appStatus = appStatusResult.success && appStatusResult.data 
      ? (appStatusResult.data as { status: string }).status 
      : "unknown";
    
    const services: ServiceStatus = {
      app: appStatus === "online" ? "active" : appStatus,
      freeradius: radiusResult.success && radiusResult.data?.isActive ? "active" : "inactive",
      vpn: vpnResult.success && vpnOnline ? "active" : "inactive",
      dhcp: dhcpResult.success ? "active" : "inactive",
    };

    // Extract system info
    const sysInfo = systemInfoResult.data as {
      disk?: { percent: string };
      memory?: { percent: string };
      cpu?: { usage: string };
      uptime?: string;
      app?: { status: string };
    } | undefined;

    // Health check
    const health: HealthCheck = {
      app_running: services.app === "active",
      api_responding: systemInfoResult.success,
      db_connected: true,
    };

    const systemStatus: SystemStatus = {
      version: (appStatusResult.data as { version?: string })?.version || "v1.0.0",
      services,
      disk_usage: sysInfo?.disk?.percent || "N/A",
      memory_usage: sysInfo?.memory?.percent || "N/A",
      cpu_usage: sysInfo?.cpu?.usage || "N/A",
      backups_count: 0,
      health,
      timestamp: new Date().toISOString(),
      uptime: sysInfo?.uptime || "N/A",
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
 * Get list of available versions/releases
 */
export async function getVersions(): Promise<ApiResponse<{ current: string; versions: VersionInfo[] }>> {
  const result = await callMgmtApi<{
    current: string;
    currentRelease: string;
    versions: Array<{
      name: string;
      version: string;
      message: string;
      created: string;
      isCurrent: boolean;
    }>;
  }>("/api/app/versions");

  if (!result.success) {
    return {
      success: false,
      error: result.error || "Failed to get versions",
    };
  }

  const data = result.data;
  return {
    success: true,
    data: {
      current: data?.current || "unknown",
      versions: (data?.versions || []).map(v => ({
        hash: v.name,
        message: v.message || v.version,
        date: v.created,
      })),
    },
  };
}

/**
 * Update to latest version
 * Uses Management API (8081) - ONLY does: git pull → build → reload app
 * Does NOT touch: RADIUS, VPN, DHCP, or any system services
 */
export async function updateSystem(): Promise<ApiResponse<UpdateResult>> {
  console.log("[VPSManagement] Starting app update via Management API (8081)");
  
  const result = await callMgmtApi<{
    message: string;
    release: string;
    version: string;
    previousVersion: string;
    backupCreated: string;
  }>("/api/app/update", "POST");

  if (!result.success) {
    return {
      success: false,
      error: result.error || "فشل التحديث",
      details: result.details,
    };
  }

  const data = result.data;
  return {
    success: true,
    data: {
      old_version: data?.previousVersion || "unknown",
      new_version: data?.version || "unknown",
      health: {
        app_running: true,
        api_responding: true,
        db_connected: true,
      },
      backup_id: data?.backupCreated || "",
      message: data?.message || "تم التحديث بنجاح",
    },
  };
}

/**
 * Rollback to a specific version
 * Uses Management API (8081) - ONLY switches symlink and reloads app
 * Does NOT touch: RADIUS, VPN, DHCP, or any system services
 */
export async function rollbackSystem(version?: string): Promise<ApiResponse<RollbackResult>> {
  console.log(`[VPSManagement] Starting rollback via Management API (8081) to: ${version || "previous"}`);
  
  const result = await callMgmtApi<{
    message: string;
    release: string;
    previousRelease: string;
  }>("/api/app/rollback", "POST", version ? { release: version } : undefined);

  if (!result.success) {
    return {
      success: false,
      error: result.error || "فشل الرجوع للنسخة السابقة",
      details: result.details,
    };
  }

  const data = result.data;
  return {
    success: true,
    data: {
      previous_version: data?.previousRelease || "unknown",
      current_version: data?.release || "unknown",
      message: data?.message || "تم الرجوع للنسخة السابقة بنجاح",
    },
  };
}

/**
 * Get list of available backups
 */
export async function getBackups(): Promise<ApiResponse<BackupInfo[]>> {
  const result = await callMgmtApi<{
    backups: Array<{
      name: string;
      size: string;
      created: string;
    }>;
  }>("/api/app/backups");

  if (!result.success) {
    return {
      success: true,
      data: [], // Return empty array on error
    };
  }

  const data = result.data;
  return {
    success: true,
    data: (data?.backups || []).map(b => ({
      id: b.name,
      filename: b.name,
      size: b.size,
      created: b.created,
    })),
  };
}

/**
 * Get service logs (app logs only)
 */
export async function getServiceLogs(
  serviceName: string,
  lines: number = 100
): Promise<ApiResponse<{ service: string; logs: string }>> {
  if (serviceName !== "app" && serviceName !== "radius-saas") {
    return {
      success: false,
      error: "سجلات هذه الخدمة غير متاحة من Management API",
    };
  }

  const result = await callMgmtApi<{ logs: string }>(`/api/app/logs?lines=${Math.min(lines, 200)}`);

  if (!result.success) {
    return {
      success: false,
      error: result.error || "فشل جلب السجلات",
    };
  }

  return {
    success: true,
    data: {
      service: serviceName,
      logs: (result.data as { logs: string })?.logs || "",
    },
  };
}

/**
 * Manage a service (start/stop/restart/reload)
 * Only RADIUS reload is available via Legacy API (8080)
 * App reload is available via Management API (8081)
 */
export async function manageService(
  serviceName: string,
  action: "start" | "stop" | "restart" | "reload"
): Promise<ApiResponse<{ service: string; action: string; new_status: string }>> {
  // App reload via Management API (8081)
  if ((serviceName === "app" || serviceName === "radius-saas") && action === "reload") {
    const result = await callMgmtApi<{ message: string }>("/api/app/reload", "POST");
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
      error: result.error || "Failed to reload app",
    };
  }

  // RADIUS reload via Legacy API (8080)
  if (serviceName === "freeradius" && action === "reload") {
    const result = await callLegacyApi<{ success: boolean; message?: string }>("/api/radius/reload", "POST");
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
    error: `إدارة الخدمة ${serviceName} (${action}) غير متاحة.`,
  };
}

/**
 * Quick reload of the application
 */
export async function reloadApp(): Promise<ApiResponse<{ message: string; status: string; output: string }>> {
  const result = await callMgmtApi<{ message: string }>("/api/app/reload", "POST");
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || "فشل إعادة تحميل التطبيق",
    };
  }

  return {
    success: true,
    data: {
      message: (result.data as { message: string })?.message || "تم إعادة تحميل التطبيق",
      status: "active",
      output: "",
    },
  };
}

// Legacy functions - kept for compatibility but return not available
export async function createBackup(prefix: string = "manual"): Promise<ApiResponse<{ backup_id: string; path: string; size: number }>> {
  return {
    success: false,
    error: "إنشاء النسخ الاحتياطية غير متاح من هذه الواجهة.",
  };
}

export async function restoreBackup(backupId: string): Promise<ApiResponse<{ restored_backup: string; timestamp: string }>> {
  return {
    success: false,
    error: "استعادة النسخ الاحتياطية غير متاحة من هذه الواجهة.",
  };
}

export async function deployUpdate(packageData: string): Promise<ApiResponse<{ message: string; output: string }>> {
  return {
    success: false,
    error: "استخدم زر التحديث بدلاً من هذه الوظيفة.",
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
