import { describe, it, expect } from "vitest";
import { getSystemStatus } from "./vpsManagementService";

describe("VPS Management Service", () => {
  it("should connect to VPS API and get system status", async () => {
    const result = await getSystemStatus();
    
    // Should return success
    expect(result.success).toBe(true);
    
    // Should have data
    expect(result.data).toBeDefined();
    
    // Should have services status
    expect(result.data?.services).toBeDefined();
    expect(result.data?.services.freeradius).toBeDefined();
    expect(result.data?.services.vpn).toBeDefined();
    expect(result.data?.services.dhcp).toBeDefined();
    
    // At least one service should be active (API is responding)
    const services = result.data?.services;
    const hasActiveService = 
      services?.freeradius === "active" || 
      services?.vpn === "active" || 
      services?.dhcp === "active";
    
    expect(hasActiveService).toBe(true);
  }, 15000); // 15 second timeout for API calls
});
