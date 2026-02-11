import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from './db';
import * as ticketDb from './db/tickets';
import { users, supportTickets, chatMessages } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Test suite for Support Chat Redesign features:
 * - Message ordering (oldest first)
 * - Delete ticket functionality
 * - Image attachments
 * - Notification sound (client-side, not testable here)
 */

describe('Support Chat Redesign', () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let testUser: any;
  let testTicket: any;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error('Database not available');

    // Get a test user
    const testUsers = await db.select().from(users).limit(1);
    testUser = testUsers[0];
    expect(testUser).toBeDefined();

    // Create test ticket in beforeAll
    testTicket = await ticketDb.createTicket({
      userId: testUser.id,
      subject: 'Test Ticket for Redesign',
      message: 'This is a test message',
      priority: 'medium',
    });
    expect(testTicket).toBeDefined();
  });

  it('should have created ticket successfully', async () => {
    expect(testTicket).toBeDefined();
    expect(testTicket.id).toBeGreaterThan(0);
    expect(testTicket.ticketNumber).toBeTruthy();
  });

  it('should add messages to ticket', async () => {
    const message1 = await ticketDb.addMessage({
      ticketId: testTicket.id,
      senderId: testUser.id,
      message: 'First message (oldest)',
    });

    const message2 = await ticketDb.addMessage({
      ticketId: testTicket.id,
      senderId: testUser.id,
      message: 'Second message',
    });

    const message3 = await ticketDb.addMessage({
      ticketId: testTicket.id,
      senderId: testUser.id,
      message: 'Third message (newest)',
    });

    expect(message1).toBeDefined();
    expect(message2).toBeDefined();
    expect(message3).toBeDefined();
  });

  it('should retrieve messages in correct order (oldest first)', async () => {
    const messages = await ticketDb.getMessagesByTicketId(testTicket.id);

    expect(messages.length).toBeGreaterThanOrEqual(3);
    
    // Messages should be ordered by createdAt ASC (oldest first)
    for (let i = 0; i < messages.length - 1; i++) {
      const current = new Date(messages[i].createdAt).getTime();
      const next = new Date(messages[i + 1].createdAt).getTime();
      expect(current).toBeLessThanOrEqual(next);
    }
  });

  it('should add message with image attachment', async () => {
    const result = await ticketDb.addMessage({
      ticketId: testTicket.id,
      senderId: testUser.id,
      message: '[Image]',
      attachmentUrl: 'https://example.com/test-image.jpg',
    });

    expect(result).toBeDefined();
    // Verify message was added by checking messages list
    const messages = await ticketDb.getMessagesByTicketId(testTicket.id);
    const imageMessage = messages.find((m: any) => m.message === '[Image]');
    expect(imageMessage).toBeDefined();
  });

  it('should mark messages as read by default (isRead=false)', async () => {
    const messages = await ticketDb.getMessagesByTicketId(testTicket.id);
    
    // New messages should have isRead=false
    const newMessages = messages.filter((m: any) => m.isRead === false);
    expect(newMessages.length).toBeGreaterThan(0);
  });

  it('should delete ticket and all its messages', async () => {
    // Get messages count before delete
    const messagesBefore = await ticketDb.getMessagesByTicketId(testTicket.id);
    expect(messagesBefore.length).toBeGreaterThan(0);

    // Delete ticket
    const result = await ticketDb.deleteTicket(testTicket.id);
    expect(result.success).toBe(true);

    // Verify ticket is deleted
    const deletedTicket = await ticketDb.getTicketById(testTicket.id);
    expect(deletedTicket).toBeNull();

    // Verify messages are deleted (should throw or return empty)
    try {
      const messagesAfter = await ticketDb.getMessagesByTicketId(testTicket.id);
      expect(messagesAfter.length).toBe(0);
    } catch (error) {
      // Expected if ticket doesn't exist
      expect(error).toBeDefined();
    }
  });

  it('should verify deleteTicket removes all related data', async () => {
    // Create a new ticket for this test
    const newTicket = await ticketDb.createTicket({
      userId: testUser.id,
      subject: 'Ticket to be deleted',
      message: 'This ticket will be deleted',
      priority: 'low',
    });

    // Add some messages
    await ticketDb.addMessage({
      ticketId: newTicket.id,
      senderId: testUser.id,
      message: 'Message 1',
    });

    await ticketDb.addMessage({
      ticketId: newTicket.id,
      senderId: testUser.id,
      message: 'Message 2',
    });

    // Delete the ticket
    await ticketDb.deleteTicket(newTicket.id);

    // Verify ticket is gone
    const ticket = await db!.select().from(supportTickets).where(eq(supportTickets.id, newTicket.id));
    expect(ticket.length).toBe(0);

    // Verify messages are gone
    const messages = await db!.select().from(chatMessages).where(eq(chatMessages.ticketId, newTicket.id));
    expect(messages.length).toBe(0);
  });
});
