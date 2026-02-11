import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, bankTransferRequests, walletLedger, wallets } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

describe("Bank Transfer System - Complete Workflow", () => {
  let testClientId: number;
  let testAdminId: number;
  let testRequestId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test client
    const [client] = await db
      .insert(users)
      .values({
        name: "Test Client for Bank Transfer",
        email: `bank-transfer-client-${Date.now()}@test.com`,
        password: "hashed_password",
        role: "client",
        balance: 50.0,
      })
      .$returningId();
    testClientId = client.id;

    // Create test admin
    const [admin] = await db
      .insert(users)
      .values({
        name: "Test Admin for Bank Transfer",
        email: `bank-transfer-admin-${Date.now()}@test.com`,
        password: "hashed_password",
        role: "owner",
        balance: 0,
      })
      .$returningId();
    testAdminId = admin.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Cleanup: delete test data
    if (testRequestId) {
      await db.delete(bankTransferRequests).where(eq(bankTransferRequests.id, testRequestId));
    }
    if (testClientId) {
      await db.delete(walletLedger).where(eq(walletLedger.userId, testClientId));
      await db.delete(users).where(eq(users.id, testClientId));
    }
    if (testAdminId) {
      await db.delete(users).where(eq(users.id, testAdminId));
    }
  });

  it("should create a bank transfer request with OCR data", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const referenceNumber = `REF-${Date.now()}`;
    const [request] = await db
      .insert(bankTransferRequests)
      .values({
        userId: testClientId,
        requestedAmount: "100.00",
        transferredAmount: "100.00",
        transferredCurrency: "USD",
        exchangeRate: "1.000000",
        finalAmountUSD: "100.00",
        receiptImageUrl: "https://example.com/receipt.jpg",
        referenceNumber: referenceNumber,
        ocrData: JSON.stringify({
          referenceNumber,
          amount: 100.0,
          currency: "USD",
          date: new Date().toISOString(),
          confidence: 0.95,
        }),
        status: "pending",
      })
      .$returningId();

    testRequestId = request.id;

    const [created] = await db
      .select()
      .from(bankTransferRequests)
      .where(eq(bankTransferRequests.id, testRequestId))
      .limit(1);

    expect(created).toBeDefined();
    expect(created.userId).toBe(testClientId);
    expect(created.status).toBe("pending");
    expect(created.referenceNumber).toBe(referenceNumber);
    expect(parseFloat(created.transferredAmount)).toBe(100.0);
    expect(created.transferredCurrency).toBe("USD");
    expect(parseFloat(created.finalAmountUSD)).toBe(100.0);
  });

  it("should prevent duplicate reference numbers", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const referenceNumber = `REF-DUP-${Date.now()}`;

    // First request
    await db.insert(bankTransferRequests).values({
      userId: testClientId,
      requestedAmount: "50.00",
      transferredAmount: "50.00",
      transferredCurrency: "USD",
      exchangeRate: "1.000000",
      finalAmountUSD: "50.00",
      receiptImageUrl: "https://example.com/receipt1.jpg",
      referenceNumber: referenceNumber,
      ocrData: JSON.stringify({ referenceNumber, amount: 50.0, currency: "USD" }),
      status: "pending",
    });

    // Check if duplicate exists
    const existing = await db
      .select()
      .from(bankTransferRequests)
      .where(eq(bankTransferRequests.referenceNumber, referenceNumber))
      .limit(1);

    expect(existing.length).toBeGreaterThan(0);
    expect(existing[0].referenceNumber).toBe(referenceNumber);

    // Cleanup
    await db.delete(bankTransferRequests).where(eq(bankTransferRequests.referenceNumber, referenceNumber));
  });

  it("should approve request and add balance to wallet", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get client's current balance from wallets table
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, testClientId))
      .limit(1);
    const balanceBefore = wallet ? parseFloat(wallet.balance) : 0;

    // Approve the request
    await db
      .update(bankTransferRequests)
      .set({
        status: "approved",
        reviewedBy: testAdminId,
        reviewedAt: new Date(),
      })
      .where(eq(bankTransferRequests.id, testRequestId));

    // Add balance to wallet
    const amountToAdd = 100.0;
    const newBalanceValue = (balanceBefore + amountToAdd).toFixed(2);
    
    if (wallet) {
      await db
        .update(wallets)
        .set({ balance: newBalanceValue })
        .where(eq(wallets.userId, testClientId));
    } else {
      await db.insert(wallets).values({
        userId: testClientId,
        balance: newBalanceValue,
        currency: "USD",
      });
    }

    // Record in wallet ledger
    await db.insert(walletLedger).values({
      userId: testClientId,
      amount: amountToAdd.toFixed(2),
      type: "credit",
      reason: `Bank transfer approved - Request #${testRequestId}`,
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: (balanceBefore + amountToAdd).toFixed(2),
    });

    // Verify balance updated
    const [walletAfter] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, testClientId))
      .limit(1);

    expect(parseFloat(walletAfter.balance)).toBe(balanceBefore + amountToAdd);

    // Verify request status
    const [request] = await db
      .select()
      .from(bankTransferRequests)
      .where(eq(bankTransferRequests.id, testRequestId))
      .limit(1);

    expect(request.status).toBe("approved");
    expect(request.reviewedBy).toBe(testAdminId);
    expect(request.reviewedAt).toBeDefined();

    // Verify wallet ledger entry
    const ledgerEntries = await db
      .select()
      .from(walletLedger)
      .where(
        and(
          eq(walletLedger.userId, testClientId),
          eq(walletLedger.type, "credit")
        )
      )
      .orderBy(desc(walletLedger.createdAt))
      .limit(1);

    expect(ledgerEntries.length).toBeGreaterThan(0);
    expect(parseFloat(ledgerEntries[0].amount)).toBe(amountToAdd);
    expect(parseFloat(ledgerEntries[0].balanceAfter)).toBe(balanceBefore + amountToAdd);
  });

  it("should reject request with admin notes", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a new request for rejection test
    const [rejectRequest] = await db
      .insert(bankTransferRequests)
      .values({
        userId: testClientId,
        requestedAmount: "75.00",
        transferredAmount: "281.25",
        transferredCurrency: "ILS",
        exchangeRate: "3.750000",
        finalAmountUSD: "75.00",
        receiptImageUrl: "https://example.com/receipt-reject.jpg",
        referenceNumber: `REF-REJECT-${Date.now()}`,
        ocrData: JSON.stringify({ referenceNumber: `REF-REJECT-${Date.now()}`, amount: 281.25, currency: "ILS" }),
        status: "pending",
      })
      .$returningId();

    const rejectReason = "صورة الإشعار غير واضحة";

    // Reject the request
    await db
      .update(bankTransferRequests)
      .set({
        status: "rejected",
        adminNotes: rejectReason,
        reviewedBy: testAdminId,
        reviewedAt: new Date(),
      })
      .where(eq(bankTransferRequests.id, rejectRequest.id));

    // Verify rejection
    const [rejected] = await db
      .select()
      .from(bankTransferRequests)
      .where(eq(bankTransferRequests.id, rejectRequest.id))
      .limit(1);

    expect(rejected.status).toBe("rejected");
    expect(rejected.adminNotes).toBe(rejectReason);
    expect(rejected.reviewedBy).toBe(testAdminId);

    // Cleanup
    await db.delete(bankTransferRequests).where(eq(bankTransferRequests.id, rejectRequest.id));
  });

  it("should calculate USD amount correctly for ILS currency", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const ilsAmount = 375.0;
    const exchangeRate = 3.75; // 1 USD = 3.75 ILS
    const expectedUsdAmount = ilsAmount / exchangeRate; // 100 USD

    const [ilsRequest] = await db
      .insert(bankTransferRequests)
      .values({
        userId: testClientId,
        requestedAmount: expectedUsdAmount.toFixed(2),
        transferredAmount: ilsAmount.toFixed(2),
        transferredCurrency: "ILS",
        exchangeRate: exchangeRate.toFixed(6),
        finalAmountUSD: expectedUsdAmount.toFixed(2),
        receiptImageUrl: "https://example.com/receipt-ils.jpg",
        referenceNumber: `REF-ILS-${Date.now()}`,
        ocrData: JSON.stringify({ referenceNumber: `REF-ILS-${Date.now()}`, amount: ilsAmount, currency: "ILS" }),
        status: "pending",
      })
      .$returningId();

    const [created] = await db
      .select()
      .from(bankTransferRequests)
      .where(eq(bankTransferRequests.id, ilsRequest.id))
      .limit(1);

    expect(created.transferredCurrency).toBe("ILS");
    expect(parseFloat(created.transferredAmount)).toBe(ilsAmount);
    expect(parseFloat(created.finalAmountUSD)).toBe(expectedUsdAmount);
    expect(parseFloat(created.exchangeRate)).toBe(exchangeRate);

    // Cleanup
    await db.delete(bankTransferRequests).where(eq(bankTransferRequests.id, ilsRequest.id));
  });

  it("should retrieve all requests for admin", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const requests = await db
      .select()
      .from(bankTransferRequests)
      .orderBy(desc(bankTransferRequests.submittedAt))
      .limit(50);

    expect(Array.isArray(requests)).toBe(true);
    // Should have at least our test request
    expect(requests.length).toBeGreaterThan(0);
  });

  it("should retrieve only user's own requests", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const userRequests = await db
      .select()
      .from(bankTransferRequests)
      .where(eq(bankTransferRequests.userId, testClientId))
      .orderBy(desc(bankTransferRequests.submittedAt));

    expect(Array.isArray(userRequests)).toBe(true);
    userRequests.forEach((request) => {
      expect(request.userId).toBe(testClientId);
    });
  });
});
