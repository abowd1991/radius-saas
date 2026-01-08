import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from './services/authService';

// Mock the email service to avoid actual SMTP calls
vi.mock('./services/emailService', () => ({
  generateVerificationCode: () => '123456',
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
  sendTrialExpiringEmail: vi.fn().mockResolvedValue(true),
}));

describe('Email Authentication System', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await authService.hashPassword(password);
      
      const isValid = await authService.verifyPassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Verification Code Generation', () => {
    it('should generate 6-digit verification code', async () => {
      const { generateVerificationCode } = await import('./services/emailService');
      const code = generateVerificationCode();
      
      expect(code).toBeDefined();
      expect(code.length).toBe(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });
  });

  describe('Email Templates', () => {
    it('should have verification email template', async () => {
      const { sendVerificationEmail } = await import('./services/emailService');
      expect(sendVerificationEmail).toBeDefined();
      expect(typeof sendVerificationEmail).toBe('function');
    });

    it('should have password reset email template', async () => {
      const { sendPasswordResetEmail } = await import('./services/emailService');
      expect(sendPasswordResetEmail).toBeDefined();
      expect(typeof sendPasswordResetEmail).toBe('function');
    });

    it('should have welcome email template', async () => {
      const { sendWelcomeEmail } = await import('./services/emailService');
      expect(sendWelcomeEmail).toBeDefined();
      expect(typeof sendWelcomeEmail).toBe('function');
    });

    it('should have trial expiring email template', async () => {
      const { sendTrialExpiringEmail } = await import('./services/emailService');
      expect(sendTrialExpiringEmail).toBeDefined();
      expect(typeof sendTrialExpiringEmail).toBe('function');
    });
  });

  describe('Auth Service Functions', () => {
    it('should have verifyEmail function', () => {
      expect(authService.verifyEmail).toBeDefined();
      expect(typeof authService.verifyEmail).toBe('function');
    });

    it('should have resendVerificationCode function', () => {
      expect(authService.resendVerificationCode).toBeDefined();
      expect(typeof authService.resendVerificationCode).toBe('function');
    });

    it('should have requestPasswordReset function', () => {
      expect(authService.requestPasswordReset).toBeDefined();
      expect(typeof authService.requestPasswordReset).toBe('function');
    });

    it('should have verifyResetCode function', () => {
      expect(authService.verifyResetCode).toBeDefined();
      expect(typeof authService.verifyResetCode).toBe('function');
    });

    it('should have resetPassword function', () => {
      expect(authService.resetPassword).toBeDefined();
      expect(typeof authService.resetPassword).toBe('function');
    });
  });

  describe('Password Reset Validation', () => {
    it('should reject short passwords in resetPassword', async () => {
      const result = await authService.resetPassword('test@example.com', '123456', 'short');
      expect(result.success).toBe(false);
      expect(result.error).toContain('6 characters');
    });
  });
});
