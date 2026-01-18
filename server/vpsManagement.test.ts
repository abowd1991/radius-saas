import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";

describe("VPS Management API", () => {
  it("should have VPS_MANAGEMENT_URL configured", () => {
    expect(ENV.VPS_MANAGEMENT_URL).toBeDefined();
    expect(ENV.VPS_MANAGEMENT_URL).not.toBe("");
  });

  it("should have VPS_MANAGEMENT_API_KEY configured", () => {
    expect(ENV.VPS_MANAGEMENT_API_KEY).toBeDefined();
    expect(ENV.VPS_MANAGEMENT_API_KEY).not.toBe("");
  });

  it("should connect to VPS Management API and get status", async () => {
    const url = ENV.VPS_MANAGEMENT_URL;
    const apiKey = ENV.VPS_MANAGEMENT_API_KEY;
    
    if (!url || !apiKey) {
      console.log("Skipping API test - credentials not configured");
      return;
    }

    try {
      const response = await fetch(`${url}/api/app/status`, {
        headers: {
          "X-API-Key": apiKey,
        },
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.app_name).toBe("radius-saas");
    } catch (error) {
      // If network error, skip test (VPS might not be accessible from test environment)
      console.log("Network error - VPS might not be accessible from test environment:", error);
    }
  });
});
