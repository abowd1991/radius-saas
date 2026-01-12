import { describe, it, expect } from 'vitest';

describe('SMTP Configuration', () => {
  it('should have SMTP_USER configured', () => {
    expect(process.env.SMTP_USER).toBeDefined();
    expect(process.env.SMTP_USER).not.toBe('');
    expect(process.env.SMTP_USER).toContain('@');
  });

  it('should have SMTP_PASS configured', () => {
    expect(process.env.SMTP_PASS).toBeDefined();
    expect(process.env.SMTP_PASS).not.toBe('');
    expect(process.env.SMTP_PASS!.length).toBeGreaterThan(5);
  });

  it('should be able to create nodemailer transporter', async () => {
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: 'mail.privateemail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    expect(transporter).toBeDefined();
  });

  it('should verify SMTP connection', async () => {
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: 'mail.privateemail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
    });

    // This will throw if credentials are invalid
    const verified = await transporter.verify();
    expect(verified).toBe(true);
  }, 15000);
});
