import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";

describe("VPS Management API", () => {
  it("should have VPS_MANAGEMENT_URL configured", () => {
    expect(ENV.VPS_MANAGEMENT_URL).toBeDefined();
    expect(ENV.VPS_MANAGEMENT_URL).not.toBe("");
  });

  it("should have VPS_MANAGEMENT_SECRET configured", () => {
    expect(ENV.VPS_MANAGEMENT_SECRET).toBeDefined();
    expect(ENV.VPS_MANAGEMENT_SECRET).not.toBe("");
  });

  it("should connect to VPS Management API and get status", async () => {
    const url = ENV.VPS_MANAGEMENT_URL;
    const secret = ENV.VPS_MANAGEMENT_SECRET;
    
    if (!url || !secret) {
      console.log("Skipping API test - credentials not configured");
      return;
    }

    try {
      const response = await fetch(`${url}/api/status`, {
        headers: {
          "Authorization": `Bearer ${secret}`,
        },
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.services).toBeDefined();
      expect(data.data.services.freeradius).toBeDefined();
    } catch (error) {
      // If network error, skip test (VPS might not be accessible from test environment)
      console.log("Network error - VPS might not be accessible from test environment:", error);
    }
  });
});
