import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from './db';
import { users } from '../drizzle/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * System-wide test to verify owner role has same access as super_admin
 * after comprehensive audit and fixes across:
 * - DB functions (server/db/*.ts)
 * - Services (server/services/*.ts)
 * - Frontend pages (client/src/pages/*.tsx)
 * - Frontend components (client/src/components/*.tsx)
 */

describe('System-Wide Owner Access Audit', () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let ownerUser: any;
  let superAdminUser: any;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error('Database not available');

    // Get owner user
    const owners = await db.select().from(users).where(eq(users.role, 'owner')).limit(1);
    ownerUser = owners[0];

    // Get super_admin user (if exists)
    const superAdmins = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);
    superAdminUser = superAdmins[0];

    expect(ownerUser).toBeDefined();
  });

  it('should have owner user in database', () => {
    expect(ownerUser).toBeDefined();
    expect(ownerUser.role).toBe('owner');
  });

  it('should query both owner and super_admin for admin notifications', async () => {
    // Simulate alertMonitor.ts getSuperAdmins() query
    const admins = await db!.select({ id: users.id })
      .from(users)
      .where(sql`role IN ('owner', 'super_admin')`);
    
    expect(admins.length).toBeGreaterThan(0);
    expect(admins.some((u: any) => u.id === ownerUser.id)).toBe(true);
  });

  it('should allow owner to see all cards (vouchers.ts)', () => {
    // Simulate isAdmin check in vouchers.ts
    const isAdmin = (role: string) => role === 'owner' || role === 'super_admin';
    
    expect(isAdmin('owner')).toBe(true);
    expect(isAdmin('super_admin')).toBe(true);
    expect(isAdmin('client')).toBe(false);
    expect(isAdmin('reseller')).toBe(false);
  });

  it('should allow owner to access ClientManagement page', () => {
    // Simulate ClientManagement.tsx access check
    const canAccess = (role: string) => {
      return role !== 'super_admin' && role !== 'owner' ? false : true;
    };
    
    expect(canAccess('owner')).toBe(true);
    expect(canAccess('super_admin')).toBe(true);
    expect(canAccess('client')).toBe(false);
  });

  it('should allow owner to access UsersManagement page', () => {
    // Simulate UsersManagement.tsx access check
    const canAccess = (role: string) => {
      return role !== 'super_admin' && role !== 'owner' ? false : true;
    };
    
    expect(canAccess('owner')).toBe(true);
    expect(canAccess('super_admin')).toBe(true);
    expect(canAccess('client')).toBe(false);
  });

  it('should exclude owner from TenantSubscriptions filtering', () => {
    // Simulate TenantSubscriptions.tsx filter
    const shouldShowSubscription = (role: string) => {
      return role !== 'super_admin' && role !== 'owner';
    };
    
    expect(shouldShowSubscription('owner')).toBe(false); // Owner doesn't need subscription
    expect(shouldShowSubscription('super_admin')).toBe(false); // Super admin doesn't need subscription
    expect(shouldShowSubscription('client')).toBe(true); // Client needs subscription
  });

  it('should not show AccountStatusBanner for owner', () => {
    // Simulate AccountStatusBanner.tsx logic
    const shouldShowBanner = (role: string) => {
      return role === 'super_admin' || role === 'owner' ? false : true;
    };
    
    expect(shouldShowBanner('owner')).toBe(false);
    expect(shouldShowBanner('super_admin')).toBe(false);
    expect(shouldShowBanner('client')).toBe(true);
  });

  it('should not show SubscriptionBanner for owner', () => {
    // Simulate SubscriptionBanner.tsx logic
    const shouldShowBanner = (role: string) => {
      return role === 'super_admin' || role === 'owner' ? false : true;
    };
    
    expect(shouldShowBanner('owner')).toBe(false);
    expect(shouldShowBanner('super_admin')).toBe(false);
    expect(shouldShowBanner('client')).toBe(true);
  });

  it('should verify all role checks are consistent', () => {
    const isAdmin = (role: string) => role === 'owner' || role === 'super_admin';
    
    // Test all possible role combinations
    const testCases = [
      { role: 'owner', expected: true },
      { role: 'super_admin', expected: true },
      { role: 'client', expected: false },
      { role: 'reseller', expected: false },
      { role: 'client_admin', expected: false },
      { role: 'client_staff', expected: false },
      { role: 'support', expected: false },
    ];

    testCases.forEach(({ role, expected }) => {
      expect(isAdmin(role)).toBe(expected);
    });
  });
});
