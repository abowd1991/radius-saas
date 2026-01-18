/**
 * VPS Management API Configuration Tests
 * Tests that API Key is properly configured
 * 
 * Note: Direct API calls are tested manually since sandbox cannot reach VPS IP
 */

import { describe, it, expect } from "vitest";

const MGMT_API_KEY = process.env.VPS_MANAGEMENT_API_KEY || "";

describe("VPS Management API Configuration", () => {
  it("should have API key configured", () => {
    expect(MGMT_API_KEY).toBeTruthy();
    expect(MGMT_API_KEY.length).toBeGreaterThan(10);
  });

  it("should have API key with correct format", () => {
    // API Key should start with mgmt_api_
    expect(MGMT_API_KEY.startsWith("mgmt_api_")).toBe(true);
  });

  it("should have API key with sufficient length for security", () => {
    // Minimum 30 characters for security
    expect(MGMT_API_KEY.length).toBeGreaterThanOrEqual(30);
  });
});
