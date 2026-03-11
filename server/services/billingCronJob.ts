/**
 * Daily Billing Cron Job
 * 
 * Runs daily to check for users due for billing
 * and processes their daily payments
 */

import { getUsersDueForDailyBilling, processDailyBilling, checkLowBalance, markLowBalanceNotified } from "./billingService";
import { notifyOwner } from "../_core/notification";
import { sendSms } from "./tweetsmsService";

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Build low balance SMS message for the client
 */
function buildLowBalanceMessage(
  name: string | null,
  balance: number,
  daysRemaining: number,
  activeNasCount: number,
  language: string
): string {
  const clientName = name || "العميل";
  if (language === "ar") {
    return `مرحباً ${clientName}،\nتنبيه: رصيدك في RadiusPro وصل إلى $${balance.toFixed(2)} فقط.\nيرجى شحن رصيدك فوراً لتجنب انقطاع الخدمة.\nradius-pro.com`;
  }
  return `Hello ${clientName},\nAlert: Your RadiusPro balance has reached $${balance.toFixed(2)}.\nPlease top up immediately to avoid service interruption.\nradius-pro.com`;
}

/**
 * Process daily billing for all due users
 */
async function processDailyBillingCycle(): Promise<{
  checked: number;
  processed: number;
  failed: number;
  skipped: number;
  lowBalanceNotifications: number;
}> {
  if (isRunning) {
    console.log("[DailyBillingCron] Already running, skipping this cycle");
    return { checked: 0, processed: 0, failed: 0, skipped: 0, lowBalanceNotifications: 0 };
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log("[DailyBillingCron] Starting daily billing cycle...");

    // Get all users due for daily billing
    const dueUserIds = await getUsersDueForDailyBilling();
    console.log(`[DailyBillingCron] Found ${dueUserIds.length} users due for daily billing`);

    if (dueUserIds.length === 0) {
      return { checked: 0, processed: 0, failed: 0, skipped: 0, lowBalanceNotifications: 0 };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    let lowBalanceNotifications = 0;

    // Process each user
    for (const userId of dueUserIds) {
      try {
        const result = await processDailyBilling(userId);
        
        if (result.success) {
          if (result.activeNasCount === 0) {
            skipped++;
            console.log(`[DailyBillingCron] Skipped user ${userId} (no active NAS)`);
          } else {
            processed++;
            const dailyRate = result.dailyCost! / (result.activeNasCount || 1);
            console.log(
              `[DailyBillingCron] Processed user ${userId}: ${result.activeNasCount} NAS × $${dailyRate.toFixed(2)} = $${result.dailyCost!.toFixed(2)}`
            );
          }
        } else {
          failed++;
          console.error(`[DailyBillingCron] Failed to process user ${userId}: ${result.error}`);
        }

        // Check for low balance (≤ 3 days remaining) and send notification
        const lowBalanceCheck = await checkLowBalance(userId);
        if (lowBalanceCheck.isLow && lowBalanceCheck.shouldNotify) {
          try {
            const message = buildLowBalanceMessage(
              lowBalanceCheck.name,
              lowBalanceCheck.balance,
              lowBalanceCheck.daysRemaining,
              lowBalanceCheck.activeNasCount,
              lowBalanceCheck.language
            );

            // 1. Send SMS to client's phone number directly
            if (lowBalanceCheck.phone) {
              const smsResult = await sendSms(lowBalanceCheck.phone, message);
              if (smsResult.success) {
                console.log(`[DailyBillingCron] SMS sent to user ${userId} (${lowBalanceCheck.phone}): ${lowBalanceCheck.daysRemaining} days remaining`);
              } else {
                console.warn(`[DailyBillingCron] SMS failed for user ${userId}: ${smsResult.errorMessage}`);
              }
            } else {
              console.warn(`[DailyBillingCron] User ${userId} has no phone number, skipping SMS`);
            }

            // 2. Notify owner/admin about the low balance
            await notifyOwner({
              title: "⚠️ تحذير رصيد منخفض",
              content: `المستخدم "${lowBalanceCheck.name || `ID:${userId}`}" لديه رصيد منخفض: $${lowBalanceCheck.balance.toFixed(2)} (${lowBalanceCheck.daysRemaining} يوم متبقي). تم إرسال SMS للعميل.`,
            });

            await markLowBalanceNotified(userId);
            lowBalanceNotifications++;
            console.log(`[DailyBillingCron] Low balance notification sent for user ${userId}: ${lowBalanceCheck.daysRemaining} days remaining`);
          } catch (notifyError: any) {
            console.error(`[DailyBillingCron] Failed to send low balance notification for user ${userId}:`, notifyError.message);
          }
        }
      } catch (error: any) {
        failed++;
        console.error(`[DailyBillingCron] Error processing user ${userId}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[DailyBillingCron] Cycle complete in ${duration}ms: ${dueUserIds.length} checked, ${processed} processed, ${failed} failed, ${skipped} skipped, ${lowBalanceNotifications} low balance notifications`
    );

    return {
      checked: dueUserIds.length,
      processed,
      failed,
      skipped,
      lowBalanceNotifications,
    };
  } catch (error: any) {
    console.error("[DailyBillingCron] Error in billing cycle:", error);
    return { checked: 0, processed: 0, failed: 0, skipped: 0, lowBalanceNotifications: 0 };
  } finally {
    isRunning = false;
  }
}

/**
 * Start the daily billing cron job
 * Runs every 24 hours at midnight
 */
export function startBillingCron(): void {
  if (intervalId) {
    console.log("[DailyBillingCron] Already started");
    return;
  }

  console.log("[DailyBillingCron] Starting daily billing cron job...");

  // Run immediately on startup
  processDailyBillingCycle().catch(console.error);

  // Then run every 24 hours
  intervalId = setInterval(() => {
    processDailyBillingCycle().catch(console.error);
  }, 24 * 60 * 60 * 1000); // 24 hours

  console.log("[DailyBillingCron] Started - checking for due users every 24 hours");
}

/**
 * Stop the billing cron job
 */
export function stopBillingCron(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[DailyBillingCron] Stopped");
  }
}

/**
 * Manually trigger billing cycle (for testing)
 */
export async function triggerBillingCycle(): Promise<{
  checked: number;
  processed: number;
  failed: number;
  skipped: number;
  lowBalanceNotifications: number;
}> {
  console.log("[DailyBillingCron] Manual trigger requested");
  return processDailyBillingCycle();
}
