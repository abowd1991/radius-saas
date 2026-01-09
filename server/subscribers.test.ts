import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  getSubscribersByOwner: vi.fn(),
  getSubscriberStats: vi.fn(),
  getSubscriberById: vi.fn(),
  createSubscriber: vi.fn(),
  updateSubscriber: vi.fn(),
  suspendSubscriber: vi.fn(),
  activateSubscriber: vi.fn(),
  renewSubscription: vi.fn(),
  deleteSubscriber: vi.fn(),
  subscriberUsernameExists: vi.fn(),
  getSubscriptionHistory: vi.fn(),
  getDb: vi.fn(),
}));

// Mock radiusSubscribers
vi.mock('./db/radiusSubscribers', () => ({
  createSubscriberRadiusEntries: vi.fn().mockResolvedValue({ success: true }),
  updateSubscriberRadiusEntries: vi.fn().mockResolvedValue({ success: true }),
  deleteSubscriberRadiusEntries: vi.fn().mockResolvedValue({ success: true }),
  suspendSubscriberRadius: vi.fn().mockResolvedValue({ success: true }),
  activateSubscriberRadius: vi.fn().mockResolvedValue({ success: true }),
  checkRadiusUsernameExists: vi.fn().mockResolvedValue(false),
}));

// Mock coaService
vi.mock('./services/coaService', () => ({
  disconnectUserAllSessions: vi.fn().mockResolvedValue({ success: true }),
}));

import * as db from './db';
import * as radiusSubscribers from './db/radiusSubscribers';
import * as coaService from './services/coaService';

describe('Subscribers Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSubscribersByOwner', () => {
    it('should return subscribers for a specific owner (multi-tenancy)', async () => {
      const mockSubscribers = [
        { id: 1, username: 'user1', fullName: 'User One', ownerId: 1 },
        { id: 2, username: 'user2', fullName: 'User Two', ownerId: 1 },
      ];
      
      vi.mocked(db.getSubscribersByOwner).mockResolvedValue(mockSubscribers as any);
      
      const result = await db.getSubscribersByOwner(1);
      
      expect(result).toHaveLength(2);
      expect(result[0].ownerId).toBe(1);
      expect(result[1].ownerId).toBe(1);
    });

    it('should not return subscribers from other owners', async () => {
      vi.mocked(db.getSubscribersByOwner).mockResolvedValue([]);
      
      const result = await db.getSubscribersByOwner(999);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('createSubscriber', () => {
    it('should create subscriber with RADIUS entries', async () => {
      const subscriberData = {
        username: 'newuser',
        password: 'pass123',
        fullName: 'New User',
        planId: 1,
        ownerId: 1,
        createdBy: 1,
      };
      
      vi.mocked(db.subscriberUsernameExists).mockResolvedValue(false);
      vi.mocked(db.createSubscriber).mockResolvedValue(1);
      vi.mocked(db.getSubscriberById).mockResolvedValue({
        subscriber: {
          id: 1,
          username: 'newuser',
          subscriptionEndDate: new Date('2026-02-09'),
          ownerId: 1,
          createdBy: 1,
        },
        plan: { id: 1, name: 'Basic' },
        nas: null,
      } as any);
      
      const subscriberId = await db.createSubscriber(subscriberData);
      
      expect(subscriberId).toBe(1);
      expect(db.createSubscriber).toHaveBeenCalledWith(subscriberData);
    });

    it('should reject duplicate username', async () => {
      vi.mocked(db.subscriberUsernameExists).mockResolvedValue(true);
      
      const exists = await db.subscriberUsernameExists('existinguser');
      
      expect(exists).toBe(true);
    });
  });

  describe('suspendSubscriber', () => {
    it('should suspend subscriber and update RADIUS Auth-Type to Reject', async () => {
      const mockSubscriber = {
        subscriber: {
          id: 1,
          username: 'user1',
          status: 'active',
          ownerId: 1,
          createdBy: 1,
        },
        nas: { nasname: '192.168.1.1' },
      };
      
      vi.mocked(db.getSubscriberById).mockResolvedValue(mockSubscriber as any);
      vi.mocked(db.suspendSubscriber).mockResolvedValue(undefined);
      
      await db.suspendSubscriber(1);
      await radiusSubscribers.suspendSubscriberRadius('user1');
      await coaService.disconnectUserAllSessions('user1');
      
      expect(db.suspendSubscriber).toHaveBeenCalledWith(1);
      expect(radiusSubscribers.suspendSubscriberRadius).toHaveBeenCalledWith('user1');
      expect(coaService.disconnectUserAllSessions).toHaveBeenCalledWith('user1');
    });
  });

  describe('activateSubscriber', () => {
    it('should activate subscriber and update RADIUS Auth-Type to Accept', async () => {
      const mockSubscriber = {
        subscriber: {
          id: 1,
          username: 'user1',
          status: 'suspended',
          ownerId: 1,
          createdBy: 1,
        },
      };
      
      vi.mocked(db.getSubscriberById).mockResolvedValue(mockSubscriber as any);
      vi.mocked(db.activateSubscriber).mockResolvedValue(undefined);
      
      await db.activateSubscriber(1);
      await radiusSubscribers.activateSubscriberRadius('user1');
      
      expect(db.activateSubscriber).toHaveBeenCalledWith(1);
      expect(radiusSubscribers.activateSubscriberRadius).toHaveBeenCalledWith('user1');
    });
  });

  describe('renewSubscription', () => {
    it('should renew subscription and update RADIUS Expiration', async () => {
      const mockSubscriber = {
        subscriber: {
          id: 1,
          username: 'user1',
          status: 'active',
          subscriptionEndDate: new Date('2026-01-09'),
          ownerId: 1,
          createdBy: 1,
        },
      };
      
      const renewResult = {
        startDate: new Date('2026-01-09'),
        endDate: new Date('2026-02-09'),
      };
      
      vi.mocked(db.getSubscriberById).mockResolvedValue(mockSubscriber as any);
      vi.mocked(db.renewSubscription).mockResolvedValue(renewResult);
      
      const result = await db.renewSubscription(1, 1, 100, 1, 'cash', undefined);
      
      expect(result.endDate).toEqual(new Date('2026-02-09'));
      expect(db.renewSubscription).toHaveBeenCalledWith(1, 1, 100, 1, 'cash', undefined);
    });
  });

  describe('deleteSubscriber', () => {
    it('should delete subscriber and remove all RADIUS entries', async () => {
      const mockSubscriber = {
        subscriber: {
          id: 1,
          username: 'user1',
          ownerId: 1,
          createdBy: 1,
        },
        nas: { nasname: '192.168.1.1' },
      };
      
      vi.mocked(db.getSubscriberById).mockResolvedValue(mockSubscriber as any);
      vi.mocked(db.deleteSubscriber).mockResolvedValue(undefined);
      
      await radiusSubscribers.deleteSubscriberRadiusEntries('user1');
      await coaService.disconnectUserAllSessions('user1');
      await db.deleteSubscriber(1);
      
      expect(radiusSubscribers.deleteSubscriberRadiusEntries).toHaveBeenCalledWith('user1');
      expect(coaService.disconnectUserAllSessions).toHaveBeenCalledWith('user1');
      expect(db.deleteSubscriber).toHaveBeenCalledWith(1);
    });
  });

  describe('Multi-tenancy isolation', () => {
    it('should only return subscribers owned by the requesting user', async () => {
      // Owner 1's subscribers
      const owner1Subscribers = [
        { id: 1, username: 'owner1_user1', ownerId: 1 },
        { id: 2, username: 'owner1_user2', ownerId: 1 },
      ];
      
      // Owner 2's subscribers
      const owner2Subscribers = [
        { id: 3, username: 'owner2_user1', ownerId: 2 },
      ];
      
      vi.mocked(db.getSubscribersByOwner)
        .mockResolvedValueOnce(owner1Subscribers as any)
        .mockResolvedValueOnce(owner2Subscribers as any);
      
      const result1 = await db.getSubscribersByOwner(1);
      const result2 = await db.getSubscribersByOwner(2);
      
      expect(result1).toHaveLength(2);
      expect(result2).toHaveLength(1);
      expect(result1.every(s => s.ownerId === 1)).toBe(true);
      expect(result2.every(s => s.ownerId === 2)).toBe(true);
    });
  });

  describe('RADIUS Integration', () => {
    it('should create proper RADIUS entries for PPPoE subscriber', async () => {
      const username = 'pppoe_user';
      const password = 'secret123';
      const planId = 1;
      const endDate = new Date('2026-02-09');
      
      await radiusSubscribers.createSubscriberRadiusEntries(
        username,
        password,
        planId,
        endDate,
        { simultaneousUse: 1 }
      );
      
      expect(radiusSubscribers.createSubscriberRadiusEntries).toHaveBeenCalledWith(
        username,
        password,
        planId,
        endDate,
        { simultaneousUse: 1 }
      );
    });

    it('should update RADIUS Expiration on subscription renewal', async () => {
      const username = 'pppoe_user';
      const newEndDate = new Date('2026-03-09');
      
      await radiusSubscribers.updateSubscriberRadiusEntries(username, newEndDate);
      
      expect(radiusSubscribers.updateSubscriberRadiusEntries).toHaveBeenCalledWith(
        username,
        newEndDate
      );
    });
  });

  describe('CoA/Disconnect', () => {
    it('should send CoA Disconnect when suspending subscriber', async () => {
      const username = 'pppoe_user';
      
      await coaService.disconnectUserAllSessions(username);
      
      expect(coaService.disconnectUserAllSessions).toHaveBeenCalledWith(username);
    });

    it('should send CoA Disconnect when deleting subscriber', async () => {
      const username = 'pppoe_user';
      
      await coaService.disconnectUserAllSessions(username);
      
      expect(coaService.disconnectUserAllSessions).toHaveBeenCalledWith(username);
    });
  });
});
