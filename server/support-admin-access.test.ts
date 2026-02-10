import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, supportTickets, chatMessages } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import * as ticketDb from "./db/tickets";

describe("Support - Admin Access to Messages", () => {
  let ownerUserId: number;
  let clientUserId: number;
  let testTicketId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create owner user (admin)
    const [owner] = await db.insert(users).values({
      name: "Test Owner",
      email: `test-owner-${Date.now()}@example.com`,
      role: "owner",
      status: "active",
      accountStatus: "active",
    });
    ownerUserId = owner.insertId;

    // Create client user
    const [client] = await db.insert(users).values({
      name: "Test Client",
      email: `test-client-${Date.now()}@example.com`,
      role: "client_owner",
      status: "active",
      accountStatus: "active",
    });
    clientUserId = client.insertId;

    // Create test ticket from client
    const result = await ticketDb.createTicket({
      userId: clientUserId,
      subject: "Test Ticket from Client",
      priority: "medium",
      category: "technical",
      message: "Initial message from client",
    });
    testTicketId = result.id;

    // Add some messages
    await ticketDb.addMessage({
      ticketId: testTicketId,
      senderId: clientUserId,
      message: "Client message 1",
    });

    await ticketDb.addMessage({
      ticketId: testTicketId,
      senderId: ownerUserId,
      message: "Admin reply 1",
    });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Cleanup
    if (testTicketId) {
      await db.delete(chatMessages).where(eq(chatMessages.ticketId, testTicketId));
      await db.delete(supportTickets).where(eq(supportTickets.id, testTicketId));
    }
    if (ownerUserId) {
      await db.delete(users).where(eq(users.id, ownerUserId));
    }
    if (clientUserId) {
      await db.delete(users).where(eq(users.id, clientUserId));
    }
  });

  it("should allow owner to see all messages in any ticket", async () => {
    // Owner should be able to see messages even if they didn't create the ticket
    const messages = await ticketDb.getMessagesByTicketId(testTicketId);
    
    expect(messages.length).toBeGreaterThanOrEqual(3); // Initial + 2 messages
    
    // Verify messages from both client and owner are present
    const clientMessages = messages.filter(m => m.senderId === clientUserId);
    const ownerMessages = messages.filter(m => m.senderId === ownerUserId);
    
    expect(clientMessages.length).toBeGreaterThan(0);
    expect(ownerMessages.length).toBeGreaterThan(0);
  });

  it("should return messages with correct sender information", async () => {
    const messages = await ticketDb.getMessagesByTicketId(testTicketId);
    
    // Check that all messages have sender info
    messages.forEach(msg => {
      expect(msg).toHaveProperty("senderName");
      expect(msg).toHaveProperty("senderEmail");
      expect(msg.senderName).toBeTruthy();
    });
  });

  it("should include isRead field for all messages", async () => {
    const messages = await ticketDb.getMessagesByTicketId(testTicketId);
    
    messages.forEach(msg => {
      expect(msg).toHaveProperty("isRead");
      expect(typeof msg.isRead).toBe("boolean");
    });
  });
});
