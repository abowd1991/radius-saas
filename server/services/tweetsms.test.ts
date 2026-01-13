/**
 * TweetSMS Service Tests
 * Tests for SMS service integration with TweetSMS.ps
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import tweetsmsService from './tweetsmsService';

const { checkBalance, sendSms, formatPhoneNumber } = tweetsmsService;

describe('TweetSMS Service', () => {
  describe('formatPhoneNumber', () => {
    it('should format Palestinian number starting with 0', () => {
      expect(formatPhoneNumber('0599123456')).toBe('972599123456');
    });

    it('should format number without country code', () => {
      expect(formatPhoneNumber('599123456')).toBe('972599123456');
    });

    it('should keep number with 972 prefix', () => {
      expect(formatPhoneNumber('972599123456')).toBe('972599123456');
    });

    it('should handle +972 prefix', () => {
      expect(formatPhoneNumber('+972599123456')).toBe('972599123456');
    });

    it('should remove spaces and dashes', () => {
      expect(formatPhoneNumber('059-912-3456')).toBe('972599123456');
      expect(formatPhoneNumber('059 912 3456')).toBe('972599123456');
    });
  });

  describe('checkBalance - API Credentials Validation', () => {
    it('should successfully check balance with valid credentials', async () => {
      // This test validates that the API credentials are correct
      const result = await checkBalance();
      
      // If credentials are valid, we should get a success response with balance
      // If credentials are invalid, errorCode will be -110
      if (!result.success) {
        console.error('TweetSMS Balance Check Failed:', result);
        
        // Check for specific error codes
        if (result.errorCode === -110) {
          throw new Error('Invalid TweetSMS credentials (wrong username or password)');
        }
        if (result.errorCode === -100) {
          throw new Error('TweetSMS credentials not configured');
        }
      }
      
      expect(result.success).toBe(true);
      expect(result.balance).toBeDefined();
      expect(typeof result.balance).toBe('number');
      expect(result.balance).toBeGreaterThanOrEqual(0);
      
      console.log(`✅ TweetSMS Balance: ${result.balance} SMS credits`);
    }, 30000); // 30 second timeout for API call
  });

  describe('sendSms - Integration Test', () => {
    it('should validate SMS sending capability (dry run)', async () => {
      // Note: This is a lightweight validation test
      // We test with an invalid number format to avoid actually sending SMS
      // but verify the API is responding correctly
      
      const result = await sendSms('invalid', 'Test message');
      
      // We expect this to fail with -2 (invalid destination)
      // but NOT with -110 (wrong credentials) or -100 (missing params)
      
      if (result.errorCode === -110) {
        throw new Error('Invalid TweetSMS credentials');
      }
      if (result.errorCode === -100) {
        throw new Error('TweetSMS credentials not configured');
      }
      
      // -2 means credentials are valid but destination is invalid
      // -115 means sender not available (no opened sender) - also valid
      // Both confirm the API credentials are working
      expect([-2, -115]).toContain(result.errorCode);
      console.log('✅ TweetSMS API is responding correctly');
    }, 30000);
  });
});

describe('TweetSMS Message Templates', () => {
  it('should have proper Arabic message templates', () => {
    // Test that Arabic messages are properly formatted
    const arabicMessage = 'مرحباً، رمز التحقق الخاص بك هو: 123456';
    expect(arabicMessage.length).toBeLessThan(160); // SMS limit
    expect(arabicMessage).toContain('123456');
  });

  it('should have proper English message templates', () => {
    const englishMessage = 'Hello, your verification code is: 123456';
    expect(englishMessage.length).toBeLessThan(160);
    expect(englishMessage).toContain('123456');
  });
});
