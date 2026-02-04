/**
 * Daily Billing Cron Job
 * 
 * Runs daily to check for users due for billing
 * and processes their daily payments
 */

import { getUsersDueForDailyBilling, processDailyBilling, checkLowBalance, markLowBalanceNotified } from "./billingService";
import { notifyOwner } from "../_core/notification";

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

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

        // Check for low balance and send notification
        const lowBalanceCheck = await checkLowBalance(userId);
        if (lowBalanceCheck.isLow && lowBalanceCheck.shouldNotify) {
          try {
            await notifyOwner({
              title: "⚠️ Low Balance Alert",
              content: `User ID ${userId} has low balance: $${lowBalanceCheck.balance.toFixed(2)}. Please add credit to avoid service interruption.`,
            });
            await markLowBalanceNotified(userId);
            lowBalanceNotifications++;
            console.log(`[DailyBillingCron] Sent low balance notification for user ${userId}`);
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
