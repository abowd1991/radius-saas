import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

describe("Data Isolation Tests", () => {
  const ownerContext: Context = {
    user: {
      id: 1,
      role: "owner",
      username: "owner",
      email: "owner@test.com",
      name: "Owner",
      ownerId: null,
      resellerId: null,
      status: "active",
      accountStatus: "active",
      subscriptionEndDate: new Date("2030-01-01"),
      trialEndDate: null,
      billingStatus: "active",
      dailyBillingEnabled: false,
      language: "en",
      emailVerified: true,
      trialExpirationNotified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const clientContext: Context = {
    user: {
      id: 2,
      role: "client",
      username: "client",
      email: "client@test.com",
      name: "Client",
      ownerId: 1,
      resellerId: null,
      status: "active",
      accountStatus: "active",
      subscriptionEndDate: new Date("2030-01-01"),
      trialEndDate: null,
      billingStatus: "active",
      dailyBillingEnabled: false,
      language: "en",
      emailVerified: true,
      trialExpirationNotified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const ownerCaller = appRouter.createCaller(ownerContext);
  const clientCaller = appRouter.createCaller(clientContext);

  it("Owner should see all NAS devices", async () => {
    const result = await ownerCaller.nas.list();
    expect(Array.isArray(result)).toBe(true);
    // Owner sees all NAS (no filtering by ownerId)
  });

  it("Client should see only their own NAS devices", async () => {
    const result = await clientCaller.nas.list();
    expect(Array.isArray(result)).toBe(true);
    // All returned NAS should belong to client (ownerId = 2)
    result.forEach((nas: any) => {
      expect(nas.ownerId).toBe(2);
    });
  });

  it("Owner should see all vouchers", async () => {
    const result = await ownerCaller.vouchers.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("Client should see only their own vouchers", async () => {
    const result = await clientCaller.vouchers.list();
    expect(Array.isArray(result)).toBe(true);
    // All returned cards should belong to client (createdBy = 2)
    result.forEach((card: any) => {
      expect(card.createdBy).toBe(2);
    });
  });

  it("Owner should see all plans", async () => {
    const result = await ownerCaller.plans.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("Client should see only their own plans", async () => {
    const result = await clientCaller.plans.list();
    expect(Array.isArray(result)).toBe(true);
    // All returned plans should belong to client (ownerId = 2)
    result.forEach((plan: any) => {
      expect(plan.ownerId).toBe(2);
    });
  });

  it("Owner should see all invoices", async () => {
    const result = await ownerCaller.invoices.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("Client should see only their own invoices", async () => {
    const result = await clientCaller.invoices.list();
    expect(Array.isArray(result)).toBe(true);
    // All returned invoices should belong to client (userId = 2)
    result.forEach((invoice: any) => {
      expect(invoice.userId).toBe(2);
    });
  });

  it("Owner should see all sessions", async () => {
    const result = await ownerCaller.sessions.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("Client should see only their own sessions", async () => {
    const result = await clientCaller.sessions.list();
    expect(Array.isArray(result)).toBe(true);
    // Sessions filtering is done by owner's cards/subscribers
  });
});
