import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { supportTickets, chatMessages, users, InsertSupportTicket, InsertChatMessage } from "../../drizzle/schema";
import { TenantContext, canSeeAllData, getEffectiveOwnerId } from "../tenant-isolation";
import { nanoid } from "nanoid";

function generateTicketNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = nanoid(6).toUpperCase();
  return `TKT-${year}${month}-${random}`;
}

export async function getAllTickets(options?: { status?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  if (options?.status) {
    return db.select()
      .from(supportTickets)
      .where(eq(supportTickets.status, options.status as any))
      .orderBy(desc(supportTickets.createdAt))
      .limit(options?.limit || 50);
  }
  
  return db.select()
    .from(supportTickets)
    .orderBy(desc(supportTickets.createdAt))
    .limit(options?.limit || 50);
}

export async function getTicketsByUserId(userId: number, options?: { status?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(supportTickets.userId, userId)];
  
  if (options?.status) {
    conditions.push(eq(supportTickets.status, options.status as any));
  }
  
  return db.select()
    .from(supportTickets)
    .where(and(...conditions))
    .orderBy(desc(supportTickets.createdAt))
    .limit(options?.limit || 50);
}

// Get tickets with tenant isolation (supports sub-admins)
export async function getTicketsByTenant(tenantContext: TenantContext, options?: { status?: string; page?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  // Owner/super_admin see all
  if (canSeeAllData(tenantContext)) {
    return getAllTickets(options);
  }
  
  // Others see only their tickets
  const effectiveUserId = getEffectiveOwnerId(tenantContext);
  return getTicketsByUserId(effectiveUserId, options);
}

export async function getTicketById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  return result[0] || null;
}

export async function getTicketByNumber(ticketNumber: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(supportTickets).where(eq(supportTickets.ticketNumber, ticketNumber)).limit(1);
  return result[0] || null;
}

export async function createTicket(data: {
  userId: number;
  subject: string;
  message: string;
  priority?: "low" | "medium" | "high" | "urgent";
  category?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const ticketNumber = generateTicketNumber();
  
  const ticketResult = await db.insert(supportTickets).values({
    ticketNumber,
    userId: data.userId,
    subject: data.subject,
    priority: data.priority || "medium",
    category: data.category,
    status: "open",
    lastMessageAt: new Date(),
  });
  
  const ticketId = ticketResult[0].insertId;
  
  // Add initial message
  await db.insert(chatMessages).values({
    ticketId,
    senderId: data.userId,
    message: data.message,
  });
  
  return { success: true, id: ticketId, ticketNumber };
}

export async function addMessage(data: {
  ticketId: number;
  senderId: number;
  message: string;
  attachmentUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatMessages).values({
    ticketId: data.ticketId,
    senderId: data.senderId,
    message: data.message,
    attachmentUrl: data.attachmentUrl,
    isRead: false, // New messages are unread by default
  });
  
  // Update ticket last message time
  await db.update(supportTickets)
    .set({ lastMessageAt: new Date() })
    .where(eq(supportTickets.id, data.ticketId));
  
  // Return the created message
  const messageId = Number(result.insertId) || 0;
  if (messageId > 0) {
    const messages = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
    return messages[0];
  }
  
  // Fallback: return success flag
  return { success: true } as any;
}

export async function getMessagesByTicketId(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const messages = await db.select({
    id: chatMessages.id,
    ticketId: chatMessages.ticketId,
    senderId: chatMessages.senderId,
    message: chatMessages.message,
    attachmentUrl: chatMessages.attachmentUrl,
    isRead: chatMessages.isRead,
    createdAt: chatMessages.createdAt,
    senderName: users.name,
    senderEmail: users.email,
  })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.senderId, users.id))
    .where(eq(chatMessages.ticketId, ticketId))
    .orderBy(chatMessages.createdAt); // Oldest first (ASC)
    
  return messages;
}

export async function updateTicketStatus(id: number, status: "open" | "in_progress" | "waiting" | "resolved" | "closed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(supportTickets).set({ status }).where(eq(supportTickets.id, id));
  return { success: true };
}

export async function assignTicket(id: number, assignedTo: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(supportTickets)
    .set({ assignedTo, status: "in_progress" })
    .where(eq(supportTickets.id, id));
  
  return { success: true };
}

export async function markMessagesAsRead(ticketId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Mark all messages in ticket as read (except user's own messages)
  // This is a simplified version - in production you'd want more sophisticated read tracking
  await db.update(chatMessages)
    .set({ isRead: true })
    .where(eq(chatMessages.ticketId, ticketId));
}

export async function getOpenTicketsCount(userId?: number) {
  const db = await getDb();
  if (!db) return 0;
  
  let query;
  if (userId) {
    query = db.select()
      .from(supportTickets)
      .where(and(eq(supportTickets.status, "open"), eq(supportTickets.userId, userId)));
  } else {
    query = db.select()
      .from(supportTickets)
      .where(eq(supportTickets.status, "open"));
  }
  
  const result = await query;
  return result.length;
}

export async function deleteTicket(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete all messages first (foreign key constraint)
  await db.delete(chatMessages).where(eq(chatMessages.ticketId, id));
  
  // Delete the ticket
  await db.delete(supportTickets).where(eq(supportTickets.id, id));
  
  return { success: true };
}
