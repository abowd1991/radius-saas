import { getDb } from "../db";
import { users, tenantSubscriptions } from "../../drizzle/schema";
import { eq, and, lte, gte, lt, isNull, or } from "drizzle-orm";
import { sendTrialExpiringEmail, sendSubscriptionExpiredEmail } from "./emailService";
import * as tweetsmsService from "./tweetsmsService";
import * as smsDb from "../db/sms";

const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // Check every 6 hours

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Check for trials and subscriptions expiring soon and send notification emails
 */
export async function checkExpiringSubscriptions(): Promise<void> {
  await checkExpiringTrials();
  await checkExpiringTenantSubscriptions();
}

/**
 * Check for trials expiring in 2 days
 */
async function checkExpiringTrials(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const minDate = new Date(twoDaysFromNow.getTime() - 12 * 60 * 60 * 1000);
    const maxDate = new Date(twoDaysFromNow.getTime() + 12 * 60 * 60 * 1000);

    // Find users with trials expiring in ~2 days
    const expiringTrials = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        trialEndDate: users.trialEndDate,
        notified: users.trialExpirationNotified,
      })
      .from(users)
      .where(
        and(
          eq(users.accountStatus, "trial"),
          gte(users.trialEndDate, minDate),
          lte(users.trialEndDate, maxDate),
          eq(users.trialExpirationNotified, false)
        )
      );

    console.log(`[SubscriptionNotifier] Found ${expiringTrials.length} trials expiring in ~2 days`);

    for (const user of expiringTrials) {
      if (!user.email || !user.trialEndDate) continue;

      const daysLeft = Math.ceil((user.trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const expiryDateStr = user.trialEndDate.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const sent = await sendTrialExpiringEmail(
        user.email,
        user.name || "User",
        daysLeft,
        expiryDateStr
      );

      if (sent) {
        await db
          .update(users)
          .set({ trialExpirationNotified: true })
          .where(eq(users.id, user.id));
        console.log(`[SubscriptionNotifier] Sent trial expiration warning to ${user.email}`);
      }
      
      // Also send SMS if user has phone
      const userWithPhone = await db.select({ phone: users.phone, language: users.language })
        .from(users)
        .where(eq(users.id, user.id));
      
      if (userWithPhone[0]?.phone) {
        await sendExpirationSms(
          user.id,
          userWithPhone[0].phone,
          user.name || "عزيزي العميل",
          daysLeft,
          userWithPhone[0].language || "ar",
          "trial"
        );
      }
    }
  } catch (error) {
    console.error("[SubscriptionNotifier] Error checking expiring trials:", error);
  }
}

/**
 * Check for tenant subscriptions expiring in 2 days (legacy)
 */
async function checkExpiringTenantSubscriptions(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[SubscriptionNotifier] Database connection failed");
    return;
  }

  try {
    // Calculate date range: subscriptions expiring in 2 days (±12 hours)
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const minDate = new Date(twoDaysFromNow.getTime() - 12 * 60 * 60 * 1000);
    const maxDate = new Date(twoDaysFromNow.getTime() + 12 * 60 * 60 * 1000);

    // Find subscriptions expiring in ~2 days that haven't been notified
    const expiringSubscriptions = await db
      .select({
        subscriptionId: tenantSubscriptions.id,
        tenantId: tenantSubscriptions.tenantId,
        expiresAt: tenantSubscriptions.expiresAt,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        notified: users.trialExpirationNotified,
      })
      .from(tenantSubscriptions)
      .innerJoin(users, eq(tenantSubscriptions.tenantId, users.id))
      .where(
        and(
          eq(tenantSubscriptions.status, "active"),
          gte(tenantSubscriptions.expiresAt, minDate),
          lte(tenantSubscriptions.expiresAt, maxDate),
          eq(users.trialExpirationNotified, false)
        )
      );

    console.log(`[SubscriptionNotifier] Found ${expiringSubscriptions.length} subscriptions expiring in ~2 days`);

    for (const sub of expiringSubscriptions) {
      if (!sub.userEmail) {
        console.log(`[SubscriptionNotifier] Skipping user ${sub.userId} - no email`);
        continue;
      }

      // Calculate days left
      const daysLeft = Math.ceil((sub.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const expiryDateStr = sub.expiresAt.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Send notification email
      const sent = await sendTrialExpiringEmail(
        sub.userEmail,
        sub.userName || "User",
        daysLeft,
        expiryDateStr
      );

      if (sent) {
        // Mark as notified
        await db
          .update(users)
          .set({ trialExpirationNotified: true })
          .where(eq(users.id, sub.userId));

        console.log(`[SubscriptionNotifier] Sent expiration warning to ${sub.userEmail} (${daysLeft} days left)`);
      } else {
        console.error(`[SubscriptionNotifier] Failed to send email to ${sub.userEmail}`);
      }
      
      // Also send SMS if user has phone
      const userWithPhone = await db.select({ phone: users.phone, language: users.language })
        .from(users)
        .where(eq(users.id, sub.userId));
      
      if (userWithPhone[0]?.phone) {
        await sendExpirationSms(
          sub.userId,
          userWithPhone[0].phone,
          sub.userName || "عزيزي العميل",
          daysLeft,
          userWithPhone[0].language || "ar",
          "subscription",
          sub.subscriptionId
        );
      }
    }
  } catch (error) {
    console.error("[SubscriptionNotifier] Error checking expiring subscriptions:", error);
  }
}

/**
 * Send SMS notification for expiring subscription/trial
 */
async function sendExpirationSms(
  userId: number,
  phone: string,
  name: string,
  daysLeft: number,
  language: string,
  type: "trial" | "subscription",
  subscriptionId?: number
): Promise<void> {
  try {
    // Check if SMS was already sent for this notification
    const notificationType = `subscription_expiry_${daysLeft}days`;
    const alreadySent = await smsDb.hasNotificationBeenSent(
      userId,
      notificationType,
      subscriptionId
    );
    
    if (alreadySent) {
      console.log(`[SubscriptionNotifier] SMS already sent to ${phone} for ${notificationType}`);
      return;
    }
    
    // Send SMS using template
    const result = await tweetsmsService.sendSmsWithTemplate(
      phone,
      "subscription_expiry",
      { name, days: daysLeft },
      language === "ar" ? "ar" : "en",
      {
        userId,
        type: "automatic",
        triggeredBy: "subscription_notifier",
      }
    );
    
    if (result.success) {
      // Track that we sent this notification
      await smsDb.createNotificationTracking({
        userId,
        phone,
        notificationType,
        referenceId: subscriptionId,
        referenceType: type === "trial" ? "trial" : "tenant_subscription",
        smsLogId: result.logId,
      });
      console.log(`[SubscriptionNotifier] SMS sent to ${phone} - subscription expiring in ${daysLeft} days`);
    } else {
      console.error(`[SubscriptionNotifier] Failed to send SMS to ${phone}: ${result.errorMessage}`);
    }
  } catch (error) {
    console.error(`[SubscriptionNotifier] Error sending SMS to ${phone}:`, error);
  }
}

/**
 * Start the subscription notifier cron job
 */
export function startSubscriptionNotifier(): void {
  if (isRunning) {
    console.log("[SubscriptionNotifier] Already running");
    return;
  }

  console.log(`[SubscriptionNotifier] Starting with interval ${CHECK_INTERVAL / 1000 / 60 / 60}h`);
  isRunning = true;

  // Run immediately on start
  checkExpiringSubscriptions();

  // Then run periodically
  intervalId = setInterval(checkExpiringSubscriptions, CHECK_INTERVAL);

  console.log("[SubscriptionNotifier] Started - checking for expiring subscriptions every 6 hours");
}

/**
 * Stop the subscription notifier
 */
export function stopSubscriptionNotifier(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
  console.log("[SubscriptionNotifier] Stopped");
}

/**
 * Check if notifier is running
 */
export function isNotifierRunning(): boolean {
  return isRunning;
}
