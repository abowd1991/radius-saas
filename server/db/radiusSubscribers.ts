import { eq, and, or } from "drizzle-orm";
import { getDb } from "../db";
import { subscribers, plans, radcheck, radreply, radusergroup } from "../../drizzle/schema";

// Format expiration date for FreeRADIUS (MMM DD YYYY HH:MM:SS)
function formatExpirationDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${month} ${day} ${year} ${hours}:${minutes}:${seconds}`;
}

// Create RADIUS entries for a PPPoE subscriber
export async function createSubscriberRadiusEntries(
  username: string,
  password: string,
  planId: number,
  subscriptionEndDate: Date,
  options: {
    simultaneousUse?: number;
    staticIp?: string;
    subscriberGroup?: string;
  } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get plan details
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!plan) throw new Error("Plan not found");

  // Delete existing entries for this username (if any)
  await db.delete(radcheck).where(eq(radcheck.username, username));
  await db.delete(radreply).where(eq(radreply.username, username));
  await db.delete(radusergroup).where(eq(radusergroup.username, username));

  // Insert Cleartext-Password
  await db.insert(radcheck).values({
    username,
    attribute: 'Cleartext-Password',
    op: ':=',
    value: password,
  });

  // Insert Expiration
  const expirationStr = formatExpirationDate(subscriptionEndDate);
  await db.insert(radcheck).values({
    username,
    attribute: 'Expiration',
    op: ':=',
    value: expirationStr,
  });

  // Insert Auth-Type
  await db.insert(radcheck).values({
    username,
    attribute: 'Auth-Type',
    op: ':=',
    value: 'Accept',
  });

  // Insert Simultaneous-Use
  const simultaneousUse = options.simultaneousUse || plan.simultaneousUse || 1;
  await db.insert(radcheck).values({
    username,
    attribute: 'Simultaneous-Use',
    op: ':=',
    value: simultaneousUse.toString(),
  });

  // Insert radreply values
  const radreplyValues = [];

  // MikroTik Rate-Limit (download/upload)
  if (plan.mikrotikRateLimit) {
    radreplyValues.push({
      username,
      attribute: 'Mikrotik-Rate-Limit',
      op: '=',
      value: plan.mikrotikRateLimit,
    });
  } else if (plan.downloadSpeed || plan.uploadSpeed) {
    // Speed is already stored in Kbps in the plans table
    const download = plan.downloadSpeed ? `${plan.downloadSpeed}k` : '0';
    const upload = plan.uploadSpeed ? `${plan.uploadSpeed}k` : '0';
    radreplyValues.push({
      username,
      attribute: 'Mikrotik-Rate-Limit',
      op: '=',
      value: `${upload}/${download}`,
    });
  }

  // Framed-Pool (IP Pool)
  if (plan.mikrotikAddressPool) {
    radreplyValues.push({
      username,
      attribute: 'Framed-Pool',
      op: '=',
      value: plan.mikrotikAddressPool,
    });
  }

  // Static IP (Framed-IP-Address)
  if (options.staticIp) {
    radreplyValues.push({
      username,
      attribute: 'Framed-IP-Address',
      op: '=',
      value: options.staticIp,
    });
  }

  // Service-Type for PPPoE
  radreplyValues.push({
    username,
    attribute: 'Service-Type',
    op: '=',
    value: 'Framed-User',
  });

  // Framed-Protocol for PPPoE
  radreplyValues.push({
    username,
    attribute: 'Framed-Protocol',
    op: '=',
    value: 'PPP',
  });

  // Insert all radreply values
  if (radreplyValues.length > 0) {
    await db.insert(radreply).values(radreplyValues);
  }

  // Insert into radusergroup
  const groupName = options.subscriberGroup || 'pppoe-subscribers';
  await db.insert(radusergroup).values({
    username,
    groupname: groupName,
    priority: 1,
  });

  return { success: true };
}

// Update RADIUS entries for a subscriber (e.g., after renewal or plan change)
export async function updateSubscriberRadiusEntries(
  username: string,
  subscriptionEndDate: Date,
  planId?: number,
  options: {
    simultaneousUse?: number;
    staticIp?: string;
    password?: string;
  } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update Expiration
  const expirationStr = formatExpirationDate(subscriptionEndDate);
  await db.update(radcheck)
    .set({ value: expirationStr })
    .where(and(
      eq(radcheck.username, username),
      eq(radcheck.attribute, 'Expiration')
    ));

  // Update password if provided
  if (options.password) {
    await db.update(radcheck)
      .set({ value: options.password })
      .where(and(
        eq(radcheck.username, username),
        eq(radcheck.attribute, 'Cleartext-Password')
      ));
  }

  // Update plan-related attributes if planId is provided
  if (planId) {
    const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (plan) {
      // Update rate limit
      let rateLimit: string;
      if (plan.mikrotikRateLimit) {
        rateLimit = plan.mikrotikRateLimit;
      } else if (plan.downloadSpeed || plan.uploadSpeed) {
        const download = plan.downloadSpeed ? `${plan.downloadSpeed * 1000}k` : '0';
        const upload = plan.uploadSpeed ? `${plan.uploadSpeed * 1000}k` : '0';
        rateLimit = `${upload}/${download}`;
      } else {
        rateLimit = '0/0';
      }

      // Check if rate limit exists, update or insert
      const [existingRateLimit] = await db.select()
        .from(radreply)
        .where(and(
          eq(radreply.username, username),
          eq(radreply.attribute, 'Mikrotik-Rate-Limit')
        ))
        .limit(1);

      if (existingRateLimit) {
        await db.update(radreply)
          .set({ value: rateLimit })
          .where(and(
            eq(radreply.username, username),
            eq(radreply.attribute, 'Mikrotik-Rate-Limit')
          ));
      } else {
        await db.insert(radreply).values({
          username,
          attribute: 'Mikrotik-Rate-Limit',
          op: '=',
          value: rateLimit,
        });
      }
    }
  }

  // Update static IP if provided
  if (options.staticIp) {
    const [existingIp] = await db.select()
      .from(radreply)
      .where(and(
        eq(radreply.username, username),
        eq(radreply.attribute, 'Framed-IP-Address')
      ))
      .limit(1);

    if (existingIp) {
      await db.update(radreply)
        .set({ value: options.staticIp })
        .where(and(
          eq(radreply.username, username),
          eq(radreply.attribute, 'Framed-IP-Address')
        ));
    } else {
      await db.insert(radreply).values({
        username,
        attribute: 'Framed-IP-Address',
        op: '=',
        value: options.staticIp,
      });
    }
  }

  return { success: true };
}

// Delete RADIUS entries for a subscriber
export async function deleteSubscriberRadiusEntries(username: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(radcheck).where(eq(radcheck.username, username));
  await db.delete(radreply).where(eq(radreply.username, username));
  await db.delete(radusergroup).where(eq(radusergroup.username, username));

  return { success: true };
}

// Suspend subscriber (set Auth-Type to Reject)
export async function suspendSubscriberRadius(username: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update Auth-Type to Reject
  await db.update(radcheck)
    .set({ value: 'Reject' })
    .where(and(
      eq(radcheck.username, username),
      eq(radcheck.attribute, 'Auth-Type')
    ));

  return { success: true };
}

// Activate subscriber (set Auth-Type to Accept)
export async function activateSubscriberRadius(username: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update Auth-Type to Accept
  await db.update(radcheck)
    .set({ value: 'Accept' })
    .where(and(
      eq(radcheck.username, username),
      eq(radcheck.attribute, 'Auth-Type')
    ));

  return { success: true };
}

// Check if username exists in RADIUS
export async function checkRadiusUsernameExists(username: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db.select()
    .from(radcheck)
    .where(and(
      eq(radcheck.username, username),
      eq(radcheck.attribute, 'Cleartext-Password')
    ))
    .limit(1);

  return !!existing;
}
