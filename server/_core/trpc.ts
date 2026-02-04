import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Super Admin only procedure (includes owner role)
export const superAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== 'super_admin' && ctx.user.role !== 'owner')) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Reseller, Client, or Super Admin procedure (for managing own resources)
export const resellerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // Allow super_admin, owner, reseller, and client to manage their own resources
    if (!ctx.user || (ctx.user.role !== 'super_admin' && ctx.user.role !== 'owner' && ctx.user.role !== 'reseller' && ctx.user.role !== 'client')) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied. Client, Reseller or Admin access required." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Client or higher procedure (any authenticated user)
export const clientProcedure = t.procedure.use(requireUser);

// Legacy admin procedure (maps to super_admin)
export const adminProcedure = superAdminProcedure;

// Support procedure - view only access
export const supportProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    // Support can access, but also allow higher roles
    const allowedRoles = ['super_admin', 'owner', 'support'];
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied. Support access required." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Permission-based procedure factory
export const createPermissionProcedure = (resource: string, action: string) => {
  return t.procedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      // Import permissions service
      const { hasPermission } = await import('../services/permissionsService');
      const allowed = hasPermission(ctx.user.role as any, resource as any, action as any);

      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `ليس لديك صلاحية ${action} في ${resource}`,
        });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );
};

// Active subscription procedure - blocks write operations when subscription is expired
// Import this dynamically to avoid circular dependencies
export const activeSubscriptionProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    // Super admin and owner bypass subscription check
    if (ctx.user.role === 'super_admin' || ctx.user.role === 'owner') {
      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }

    // Check subscription status
    const { isSubscriptionActive } = await import('./tenantSubscriptions');
    const isActive = await isSubscriptionActive(ctx.user.id);

    if (!isActive) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your subscription has expired or is inactive. Please contact support to renew your subscription.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
