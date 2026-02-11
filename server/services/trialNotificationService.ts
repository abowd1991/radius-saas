import { getDb } from "../db";
import { users, notifications } from "../../drizzle/schema";
import { eq, and, lte, gte, isNotNull } from "drizzle-orm";

/**
 * Trial Notification Service
 * 
 * Sends notifications to users 24 hours before their trial period ends
 */

/**
 * Check and send trial expiration notifications
 * Should be run daily via cron job
 */
export async function sendTrialExpirationNotifications(): Promise<{
  success: boolean;
  notificationsSent: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, notificationsSent: 0, errors: ['Database not available'] };
  }

  const errors: string[] = [];
  let notificationsSent = 0;

  try {
    // Calculate time window: 24 hours from now (±1 hour buffer)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowPlus1h = new Date(tomorrow.getTime() + 60 * 60 * 1000);
    const tomorrowMinus1h = new Date(tomorrow.getTime() - 60 * 60 * 1000);

    // Find users whose trial ends in ~24 hours
    const usersNearingTrialEnd = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.accountStatus, 'trial'),
          isNotNull(users.trialEndDate),
          gte(users.trialEndDate, tomorrowMinus1h),
          lte(users.trialEndDate, tomorrowPlus1h)
        )
      );

    console.log(`[Trial Notification] Found ${usersNearingTrialEnd.length} users nearing trial end`);

    for (const user of usersNearingTrialEnd) {
      try {
        // Check if notification already sent (avoid duplicates)
        const existingNotification = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.id),
              eq(notifications.type, 'subscription'),
              eq(notifications.title, 'Trial Ending Soon')
            )
          )
          .limit(1);

        if (existingNotification.length > 0) {
          console.log(`[Trial Notification] Skipping user ${user.id} - notification already sent`);
          continue;
        }

        // Send notification
        await db.insert(notifications).values({
          userId: user.id,
          type: 'subscription',
          title: 'Trial Ending Soon',
          titleAr: 'فترتك التجريبية تنتهي قريباً',
          message: `Your 7-day trial period ends tomorrow (${user.trialEndDate?.toLocaleDateString()}). Please add balance to your wallet to continue using the service without interruption.`,
          messageAr: `تنتهي فترتك التجريبية (7 أيام) غداً (${user.trialEndDate?.toLocaleDateString()}). يرجى إضافة رصيد إلى محفظتك لمواصلة استخدام الخدمة بدون انقطاع.`,
          isRead: false,
          createdAt: new Date(),
        });

        notificationsSent++;
        console.log(`[Trial Notification] Sent notification to user ${user.id} (${user.email})`);
      } catch (error) {
        const errorMsg = `Failed to send notification to user ${user.id}: ${error}`;
        console.error(`[Trial Notification] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return {
      success: true,
      notificationsSent,
      errors,
    };
  } catch (error) {
    console.error('[Trial Notification] Service error:', error);
    return {
      success: false,
      notificationsSent,
      errors: [`Service error: ${error}`],
    };
  }
}
