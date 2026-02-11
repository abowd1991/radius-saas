import { describe, it, expect, beforeAll } from 'vitest';
import { createRadiusCard } from './db/radiusCards';
import { getDb } from './db';

describe('RADIUS Card Tenant Isolation', () => {
  beforeAll(async () => {
    // Ensure database is available
    const db = await getDb();
    expect(db).toBeDefined();
  });

  it('should generate unique usernames for different tenants', async () => {
    // Create card for user 1
    const card1 = await createRadiusCard({
      planId: 1,
      createdBy: 17, // User ID 17
      usernameLength: 6,
      passwordLength: 4,
      prefix: '',
    });

    // Create card for user 2
    const card2 = await createRadiusCard({
      planId: 1,
      createdBy: 25, // User ID 25
      usernameLength: 6,
      passwordLength: 4,
      prefix: '',
    });

    // Usernames should be different due to userId prefix
    expect(card1.username).not.toBe(card2.username);
    
    // Card 1 should start with U17-
    expect(card1.username).toMatch(/^U17-\d{6}$/);
    
    // Card 2 should start with U25-
    expect(card2.username).toMatch(/^U25-\d{6}$/);
  });

  it('should support custom prefix with userId prefix', async () => {
    const card = await createRadiusCard({
      planId: 1,
      createdBy: 17,
      usernameLength: 6,
      passwordLength: 4,
      prefix: 'VIP',
    });

    // Should have format: U17-VIP123456
    expect(card.username).toMatch(/^U17-VIP\d{6}$/);
  });

  it('should generate different usernames for same tenant', async () => {
    const card1 = await createRadiusCard({
      planId: 1,
      createdBy: 17,
      usernameLength: 6,
      passwordLength: 4,
    });

    const card2 = await createRadiusCard({
      planId: 1,
      createdBy: 17,
      usernameLength: 6,
      passwordLength: 4,
    });

    // Even same tenant should have different usernames (random numbers)
    expect(card1.username).not.toBe(card2.username);
    
    // Both should start with U17-
    expect(card1.username).toMatch(/^U17-/);
    expect(card2.username).toMatch(/^U17-/);
  });

  it('should ensure username uniqueness in database', async () => {
    const cards = [];
    
    // Create 10 cards for user 17
    for (let i = 0; i < 10; i++) {
      const card = await createRadiusCard({
        planId: 1,
        createdBy: 17,
        usernameLength: 6,
        passwordLength: 4,
      });
      cards.push(card.username);
    }

    // All usernames should be unique
    const uniqueUsernames = new Set(cards);
    expect(uniqueUsernames.size).toBe(10);
  });
});
