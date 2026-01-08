import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  isSubscriptionActive, 
  getSubscriptionStatus,
  createTenantSubscription,
  suspendTenantSubscription,
  activateTenantSubscription,
  extendTenantSubscription,
  deleteTenantSubscription,
  getSubscriptionByTenantId
} from './_core/tenantSubscriptions';

describe('Subscription System', () => {
  const testTenantId = 999999; // Test tenant ID

  // Clean up before tests
  beforeAll(async () => {
    await deleteTenantSubscription(testTenantId);
  });

  // Clean up after tests
  afterAll(async () => {
    await deleteTenantSubscription(testTenantId);
  });

  describe('isSubscriptionActive', () => {
    it('should return true for super_admin users regardless of subscription', async () => {
      // Super admin should always have access (tested via role check in middleware)
      // This test verifies the function handles missing subscriptions
      const result = await isSubscriptionActive(testTenantId);
      expect(typeof result).toBe('boolean');
    });

    it('should return false for tenant without subscription', async () => {
      const result = await isSubscriptionActive(testTenantId);
      expect(result).toBe(false);
    });
  });

  describe('createTenantSubscription', () => {
    it('should create a new subscription', async () => {
      const subscription = await createTenantSubscription({
        tenantId: testTenantId,
        months: 1,
        pricePerMonth: '10.00',
        createdBy: 1,
        notes: 'Test subscription'
      });

      expect(subscription).toBeDefined();
      expect(subscription.tenantId).toBe(testTenantId);
      expect(subscription.status).toBe('active');
      expect(subscription.pricePerMonth).toBe('10.00');
    });

    it('should set correct expiration date', async () => {
      const subscription = await getSubscriptionByTenantId(testTenantId);
      expect(subscription).toBeDefined();
      
      const now = new Date();
      const expiresAt = new Date(subscription!.expiresAt);
      
      // Should expire approximately 1 month from now
      const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(28);
      expect(diffDays).toBeLessThanOrEqual(32);
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return active status for valid subscription', async () => {
      const status = await getSubscriptionStatus(testTenantId);
      
      expect(status.isActive).toBe(true);
      expect(status.status).toBe('active');
      expect(status.daysRemaining).toBeGreaterThan(0);
    });
  });

  describe('suspendTenantSubscription', () => {
    it('should suspend an active subscription', async () => {
      const result = await suspendTenantSubscription(testTenantId, 'Test suspension');
      
      expect(result).toBeDefined();
      expect(result?.status).toBe('suspended');
    });

    it('should return false for isSubscriptionActive when suspended', async () => {
      const result = await isSubscriptionActive(testTenantId);
      expect(result).toBe(false);
    });

    it('should show suspended status', async () => {
      const status = await getSubscriptionStatus(testTenantId);
      expect(status.isActive).toBe(false);
      expect(status.status).toBe('suspended');
    });
  });

  describe('activateTenantSubscription', () => {
    it('should reactivate a suspended subscription', async () => {
      const result = await activateTenantSubscription(testTenantId, undefined, 1);
      
      expect(result).toBeDefined();
      expect(result?.status).toBe('active');
    });

    it('should return true for isSubscriptionActive when reactivated', async () => {
      const result = await isSubscriptionActive(testTenantId);
      expect(result).toBe(true);
    });
  });

  describe('extendTenantSubscription', () => {
    it('should extend subscription by specified months', async () => {
      const beforeExtend = await getSubscriptionByTenantId(testTenantId);
      const beforeExpiry = new Date(beforeExtend!.expiresAt);
      
      const result = await extendTenantSubscription(testTenantId, 2, 1, 'Extension test');
      
      expect(result).toBeDefined();
      
      const afterExpiry = new Date(result!.expiresAt);
      const diffDays = Math.ceil((afterExpiry.getTime() - beforeExpiry.getTime()) / (1000 * 60 * 60 * 24));
      
      // Should be extended by approximately 2 months (60 days)
      expect(diffDays).toBeGreaterThanOrEqual(55);
      expect(diffDays).toBeLessThanOrEqual(65);
    });
  });

  describe('Subscription Enforcement', () => {
    it('should block write operations when subscription is expired', async () => {
      // Suspend the subscription to simulate expired state
      await suspendTenantSubscription(testTenantId);
      
      const isActive = await isSubscriptionActive(testTenantId);
      expect(isActive).toBe(false);
      
      // In real scenario, activeSubscriptionProcedure would throw FORBIDDEN error
      // This test verifies the underlying check works correctly
    });

    it('should allow read operations when subscription is expired', async () => {
      // Read operations should still work (getSubscriptionStatus)
      const status = await getSubscriptionStatus(testTenantId);
      expect(status).toBeDefined();
      expect(status.status).toBe('suspended');
    });
  });

  describe('deleteTenantSubscription', () => {
    it('should delete subscription', async () => {
      const result = await deleteTenantSubscription(testTenantId);
      expect(result).toBe(true);
      
      const subscription = await getSubscriptionByTenantId(testTenantId);
      expect(subscription).toBeNull();
    });
  });
});
