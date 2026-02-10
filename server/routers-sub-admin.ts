import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * Sub-Admin Router
 * 
 * Allows client_owner to create and manage sub-admins (client_admin, client_staff)
 * Sub-admins inherit the tenant context from their parent client
 */

export const subAdminRouter = router({
  /**
   * Create a new sub-admin for the current client
   * Only client_owner can create sub-admins
   */
  createSubAdmin: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        role: z.enum(["client_admin", "client_staff"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // Only client_owner can create sub-admins
      if (ctx.user.role !== "client_owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only client owners can create sub-admins",
        });
      }

      // Check if email already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email));

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already exists",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create sub-admin with tenantId = client_owner's id
      const [newSubAdmin] = await db.insert(users).values({
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: input.role,
        tenantId: ctx.user.id, // Link to parent client
        status: "active",
      });

      return {
        id: newSubAdmin.insertId,
        name: input.name,
        email: input.email,
        role: input.role,
      };
    }),

  /**
   * List all sub-admins for the current client
   */
  listMySubAdmins: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

    // Only client_owner can list sub-admins
    if (ctx.user.role !== "client_owner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only client owners can list sub-admins",
      });
    }

    // Get all users where tenantId = current user's id
    const subAdmins = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, ctx.user.id));

    return subAdmins;
  }),

  /**
   * Update a sub-admin
   */
  updateSubAdmin: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        role: z.enum(["client_admin", "client_staff"]).optional(),
        status: z.enum(["active", "suspended", "trial"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // Only client_owner can update sub-admins
      if (ctx.user.role !== "client_owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only client owners can update sub-admins",
        });
      }

      // Verify the sub-admin belongs to this client
      const [subAdmin] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, input.id), eq(users.tenantId, ctx.user.id)));

      if (!subAdmin) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sub-admin not found or does not belong to you",
        });
      }

      // Prepare update data
      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.email) updateData.email = input.email;
      if (input.role) updateData.role = input.role;
      if (input.status) updateData.status = input.status;
      if (input.password) {
        updateData.password = await bcrypt.hash(input.password, 10);
      }

      // Update sub-admin
      await db.update(users).set(updateData).where(eq(users.id, input.id));

      return { success: true };
    }),

  /**
   * Delete a sub-admin
   */
  deleteSubAdmin: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // Only client_owner can delete sub-admins
      if (ctx.user.role !== "client_owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only client owners can delete sub-admins",
        });
      }

      // Verify the sub-admin belongs to this client
      const [subAdmin] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, input.id), eq(users.tenantId, ctx.user.id)));

      if (!subAdmin) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sub-admin not found or does not belong to you",
        });
      }

      // Delete sub-admin
      await db.delete(users).where(eq(users.id, input.id));

      return { success: true };
    }),
});
