/**
 * Subscription Enforcer Service
 * 
 * This service runs periodically to:
 * 1. Check for expired trials and subscriptions
 * 2. Disable NAS devices for expired accounts
 * 3. Update account status to 'expired'
 */

import { eq, and, lt } from "drizzle-orm";
import { getDb } from "../db";
import { users, nasDevices } from "../../drizzle/schema";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

export async function checkExpiredAccounts(): Promise<{
  expiredTrials: number;
  expiredSubscriptions: number;
  disabledNas: number;
}> {
  const db = await getDb();
  if (!db) {
    console.error("[SubscriptionEnforcer] Database connection failed");
    return { expiredTrials: 0, expiredSubscriptions: 0, disabledNas: 0 };
  }

  const now = new Date();
  let expiredTrials = 0;
  let expiredSubscriptions = 0;
  let disabledNas = 0;

  try {
    // 1. Find users with expired trials (accountStatus = 'trial' AND trialEndDate < now)
    const expiredTrialUsers = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(
        eq(users.accountStatus, "trial"),
        lt(users.trialEndDate, now)
      ));

    for (const user of expiredTrialUsers) {
      console.log(`[SubscriptionEnforcer] Trial expired for user: ${user.username} (ID: ${user.id})`);
      
      // Update account status to expired
      await db
        .update(users)
        .set({ accountStatus: "expired" })
        .where(eq(users.id, user.id));
      
      // Disable all NAS devices owned by this user
      const userNasDevicesList = await db
        .select({ id: nasDevices.id })
        .from(nasDevices)
        .where(eq(nasDevices.ownerId, user.id));
      
      for (const nasDevice of userNasDevicesList) {
        await db
          .update(nasDevices)
          .set({ status: "inactive" })
          .where(eq(nasDevices.id, nasDevice.id));
        disabledNas++;
      }
      
      expiredTrials++;
    }

    // 2. Find users with expired subscriptions (accountStatus = 'active' AND subscriptionEndDate < now)
    const expiredSubUsers = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(
        eq(users.accountStatus, "active"),
        lt(users.subscriptionEndDate, now)
      ));

    for (const user of expiredSubUsers) {
      console.log(`[SubscriptionEnforcer] Subscription expired for user: ${user.username} (ID: ${user.id})`);
      
      // Update account status to expired
      await db
        .update(users)
        .set({ accountStatus: "expired" })
        .where(eq(users.id, user.id));
      
      // Disable all NAS devices owned by this user
      const userNasDevicesList = await db
        .select({ id: nasDevices.id })
        .from(nasDevices)
        .where(eq(nasDevices.ownerId, user.id));
      
      for (const nasDevice of userNasDevicesList) {
        await db
          .update(nasDevices)
          .set({ status: "inactive" })
          .where(eq(nasDevices.id, nasDevice.id));
        disabledNas++;
      }
      
      expiredSubscriptions++;
    }

    if (expiredTrials > 0 || expiredSubscriptions > 0) {
      console.log(`[SubscriptionEnforcer] Processed: ${expiredTrials} expired trials, ${expiredSubscriptions} expired subscriptions, ${disabledNas} NAS disabled`);
    }

  } catch (error) {
    console.error("[SubscriptionEnforcer] Error checking expired accounts:", error);
  }

  return { expiredTrials, expiredSubscriptions, disabledNas };
}

export function startSubscriptionEnforcer(): void {
  if (isRunning) {
    console.log("[SubscriptionEnforcer] Already running");
    return;
  }

  console.log("[SubscriptionEnforcer] Starting subscription enforcer service...");
  isRunning = true;

  // Run immediately on start
  checkExpiredAccounts().catch(console.error);

  // Then run periodically
  intervalId = setInterval(() => {
    checkExpiredAccounts().catch(console.error);
  }, CHECK_INTERVAL_MS);
}

export function stopSubscriptionEnforcer(): void {
  if (!isRunning) return;

  console.log("[SubscriptionEnforcer] Stopping subscription enforcer service...");
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  isRunning = false;
}

// ============================================================================
// RADIUS AUTHENTICATION CHECK
// ============================================================================

/**
 * Check if a user's account is valid for RADIUS authentication
 * This is called during RADIUS auth to block expired accounts
 */
export async function isAccountValidForRadius(ownerId: number): Promise<{
  valid: boolean;
  reason?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { valid: false, reason: "database_error" };
  }

  const [user] = await db
    .select({
      accountStatus: users.accountStatus,
      trialEndDate: users.trialEndDate,
      subscriptionEndDate: users.subscriptionEndDate,
    })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  if (!user) {
    return { valid: false, reason: "user_not_found" };
  }

  const now = new Date();

  // Check account status
  switch (user.accountStatus) {
    case "suspended":
      return { valid: false, reason: "account_suspended" };
    
    case "expired":
      return { valid: false, reason: "account_expired" };
    
    case "trial":
      if (user.trialEndDate && new Date(user.trialEndDate) < now) {
        return { valid: false, reason: "trial_expired" };
      }
      return { valid: true };
    
    case "active":
      if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) < now) {
        return { valid: false, reason: "subscription_expired" };
      }
      return { valid: true };
    
    default:
      return { valid: true };
  }
}

/**
 * Get account limits based on subscription plan
 */
export async function getAccountLimits(userId: number): Promise<{
  maxNasDevices: number;
  maxCards: number;
  maxSubscribers: number;
  features: {
    mikrotikApi: boolean;
    coaDisconnect: boolean;
    staticVpnIp: boolean;
    advancedReports: boolean;
  };
}> {
  const db = await getDb();
  if (!db) {
    // Return trial limits as default
    return {
      maxNasDevices: 1,
      maxCards: 50,
      maxSubscribers: 20,
      features: {
        mikrotikApi: false,
        coaDisconnect: true,
        staticVpnIp: false,
        advancedReports: false,
      },
    };
  }

  const { saasPlans } = await import("../../drizzle/schema");

  const [user] = await db
    .select({
      accountStatus: users.accountStatus,
      subscriptionPlanId: users.subscriptionPlanId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return {
      maxNasDevices: 0,
      maxCards: 0,
      maxSubscribers: 0,
      features: {
        mikrotikApi: false,
        coaDisconnect: false,
        staticVpnIp: false,
        advancedReports: false,
      },
    };
  }

  // Trial accounts get basic limits
  if (user.accountStatus === "trial") {
    return {
      maxNasDevices: 1,
      maxCards: 50,
      maxSubscribers: 20,
      features: {
        mikrotikApi: false,
        coaDisconnect: true,
        staticVpnIp: false,
        advancedReports: false,
      },
    };
  }

  // Get plan limits
  if (user.subscriptionPlanId) {
    const [plan] = await db
      .select()
      .from(saasPlans)
      .where(eq(saasPlans.id, user.subscriptionPlanId))
      .limit(1);

    if (plan) {
      return {
        maxNasDevices: plan.maxNasDevices,
        maxCards: plan.maxCards,
        maxSubscribers: plan.maxSubscribers || 50,
        features: {
          mikrotikApi: plan.featureMikrotikApi || false,
          coaDisconnect: plan.featureCoaDisconnect || false,
          staticVpnIp: plan.featureStaticVpnIp || false,
          advancedReports: plan.featureAdvancedReports || false,
        },
      };
    }
  }

  // Expired or no plan - return minimal limits
  return {
    maxNasDevices: 0,
    maxCards: 0,
    maxSubscribers: 0,
    features: {
      mikrotikApi: false,
      coaDisconnect: false,
      staticVpnIp: false,
      advancedReports: false,
    },
  };
}
