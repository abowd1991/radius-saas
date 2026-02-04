/**
 * Billing Cron Job
 * 
 * Runs every hour to check for users due for billing
 * and processes their monthly payments
 */

import { getUsersDueForBilling, processUserBilling } from "./billingService";

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Process billing for all due users
 */
async function processBillingCycle(): Promise<{
  checked: number;
  processed: number;
  failed: number;
  skipped: number;
}> {
  if (isRunning) {
    console.log("[BillingCron] Already running, skipping this cycle");
    return { checked: 0, processed: 0, failed: 0, skipped: 0 };
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log("[BillingCron] Starting billing cycle...");

    // Get all users due for billing
    const dueUserIds = await getUsersDueForBilling();
    console.log(`[BillingCron] Found ${dueUserIds.length} users due for billing`);

    if (dueUserIds.length === 0) {
      return { checked: 0, processed: 0, failed: 0, skipped: 0 };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    // Process each user
    for (const userId of dueUserIds) {
      try {
        const result = await processUserBilling(userId);
        
        if (result.success) {
          if (result.activeNasCount === 0) {
            skipped++;
            console.log(`[BillingCron] Skipped user ${userId} (no active NAS)`);
          } else {
            processed++;
            console.log(
              `[BillingCron] Processed user ${userId}: ${result.activeNasCount} NAS × $${result.monthlyCost / result.activeNasCount} = $${result.monthlyCost}`
            );
          }
        } else {
          failed++;
          console.error(`[BillingCron] Failed to process user ${userId}: ${result.error}`);
        }
      } catch (error: any) {
        failed++;
        console.error(`[BillingCron] Error processing user ${userId}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[BillingCron] Cycle complete in ${duration}ms: ${dueUserIds.length} checked, ${processed} processed, ${failed} failed, ${skipped} skipped`
    );

    return {
      checked: dueUserIds.length,
      processed,
      failed,
      skipped,
    };
  } catch (error: any) {
    console.error("[BillingCron] Error in billing cycle:", error);
    return { checked: 0, processed: 0, failed: 0, skipped: 0 };
  } finally {
    isRunning = false;
  }
}

/**
 * Start the billing cron job
 * Runs every hour
 */
export function startBillingCron(): void {
  if (intervalId) {
    console.log("[BillingCron] Already started");
    return;
  }

  console.log("[BillingCron] Starting billing cron job...");

  // Run immediately on startup
  processBillingCycle().catch(console.error);

  // Then run every hour
  intervalId = setInterval(() => {
    processBillingCycle().catch(console.error);
  }, 60 * 60 * 1000); // 1 hour

  console.log("[BillingCron] Started - checking for due users every hour");
}

/**
 * Stop the billing cron job
 */
export function stopBillingCron(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[BillingCron] Stopped");
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
}> {
  console.log("[BillingCron] Manual trigger requested");
  return processBillingCycle();
}
