import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, chatMessages, supportTickets } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import * as ticketDb from "./db/tickets";

describe("Support Chat - isRead Field", () => {
  let testUserId: number;
  let testTicketId: number;
  let testMessageId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const [user] = await db.insert(users).values({
      name: "Test User for isRead",
      email: `test-isread-${Date.now()}@example.com`,
      role: "client_owner",
      status: "active",
      accountStatus: "active",
    });
    testUserId = user.insertId;

    // Create test ticket
    const result = await ticketDb.createTicket({
      userId: testUserId,
      subject: "Test Ticket for isRead",
      priority: "medium",
      category: "technical",
      message: "Initial message",
    });
    testTicketId = result.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Cleanup
    if (testTicketId) {
      await db.delete(chatMessages).where(eq(chatMessages.ticketId, testTicketId));
      await db.delete(supportTickets).where(eq(supportTickets.id, testTicketId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("should create message with isRead=false by default", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Add message
    await ticketDb.addMessage({
      ticketId: testTicketId,
      senderId: testUserId,
      message: "Test message for isRead check",
    });

    // Get messages
    const messages = await ticketDb.getMessagesByTicketId(testTicketId);
    
    // Find the message we just created
    const newMessage = messages.find(m => m.message === "Test message for isRead check");
    
    expect(newMessage).toBeDefined();
    expect(newMessage?.isRead).toBe(false);
  });

  it("should include isRead field in getMessagesByTicketId", async () => {
    const messages = await ticketDb.getMessagesByTicketId(testTicketId);
    
    expect(messages.length).toBeGreaterThan(0);
    
    // Check that all messages have isRead field
    messages.forEach(msg => {
      expect(msg).toHaveProperty("isRead");
      expect(typeof msg.isRead).toBe("boolean");
    });
  });

  it("should allow updating isRead status", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Add a new message
    await ticketDb.addMessage({
      ticketId: testTicketId,
      senderId: testUserId,
      message: "Message to mark as read",
    });

    // Get the message
    let messages = await ticketDb.getMessagesByTicketId(testTicketId);
    const targetMessage = messages.find(m => m.message === "Message to mark as read");
    
    expect(targetMessage?.isRead).toBe(false);

    // Update isRead to true
    await db.update(chatMessages)
      .set({ isRead: true })
      .where(eq(chatMessages.id, targetMessage!.id));

    // Verify update
    messages = await ticketDb.getMessagesByTicketId(testTicketId);
    const updatedMessage = messages.find(m => m.id === targetMessage!.id);
    
    expect(updatedMessage?.isRead).toBe(true);
  });
});
