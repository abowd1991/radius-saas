import bcrypt from "bcryptjs";
import { eq, or, and, gt } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { createTenantSubscription } from "../_core/tenantSubscriptions";
import { 
  generateVerificationCode, 
  sendVerificationEmail, 
  sendPasswordResetEmail,
  sendWelcomeEmail 
} from "./emailService";

const SALT_ROUNDS = 10;
const CODE_EXPIRY_MINUTES = 15;

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  name?: string;
  phone?: string;
}

export interface LoginInput {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: typeof users.$inferSelect;
  error?: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Register new user with traditional auth
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database connection failed" };
  }

  // Validate input
  if (!input.username || input.username.length < 3) {
    return { success: false, error: "Username must be at least 3 characters" };
  }
  if (!input.email || !input.email.includes("@")) {
    return { success: false, error: "Invalid email address" };
  }
  if (!input.password || input.password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters" };
  }

  // Check if username or email already exists
  const existing = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.username, input.username),
        eq(users.email, input.email)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].username === input.username) {
      return { success: false, error: "Username already exists" };
    }
    if (existing[0].email === input.email) {
      return { success: false, error: "Email already exists" };
    }
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Generate email verification code
  const verificationCode = generateVerificationCode();
  const verificationExpires = new Date();
  verificationExpires.setMinutes(verificationExpires.getMinutes() + CODE_EXPIRY_MINUTES);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      username: input.username,
      email: input.email,
      passwordHash,
      name: input.name || input.username,
      phone: input.phone,
      loginMethod: "traditional",
      role: "client", // New users are clients (SaaS customers who manage their own network)
      status: "active",
      emailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: verificationExpires,
    })
    .$returningId();

  // Get the created user
  const [createdUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, newUser.id))
    .limit(1);

  if (!createdUser) {
    return { success: false, error: "Failed to create user" };
  }

  // Create 7-day trial subscription automatically
  const trialExpiresAt = new Date();
  trialExpiresAt.setDate(trialExpiresAt.getDate() + 7);
  
  const { tenantSubscriptions } = await import("../../drizzle/schema");
  await db.insert(tenantSubscriptions).values({
    tenantId: createdUser.id,
    status: "active",
    pricePerMonth: "0.00",
    startDate: new Date(),
    expiresAt: trialExpiresAt,
    notes: "7-day free trial",
  });

  // Send verification email (async, don't wait)
  sendVerificationEmail(input.email, input.name || input.username, verificationCode)
    .then(sent => {
      if (sent) {
        console.log(`[Auth] Verification email sent to ${input.email}`);
      }
    })
    .catch(err => console.error(`[Auth] Failed to send verification email:`, err));

  return { success: true, user: createdUser };
}

// Login with username/email and password
export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database connection failed" };
  }

  // Find user by username or email
  const [user] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.username, input.usernameOrEmail),
        eq(users.email, input.usernameOrEmail)
      )
    )
    .limit(1);

  if (!user) {
    return { success: false, error: "Invalid username or password" };
  }

  // Check if user has password (traditional auth)
  if (!user.passwordHash) {
    return { success: false, error: "This account uses OAuth login. Please use the OAuth button." };
  }

  // Verify password
  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "Invalid username or password" };
  }

  // Check if user is active
  if (user.status !== "active") {
    return { success: false, error: "Your account has been suspended. Please contact support." };
  }

  // Update last signed in
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  return { success: true, user };
}

// Get user by ID
export async function getUserById(id: number): Promise<typeof users.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user || null;
}

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

// Verify email with code
export async function verifyEmail(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database connection failed" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, email),
        eq(users.emailVerificationCode, code),
        gt(users.emailVerificationExpires, new Date())
      )
    )
    .limit(1);

  if (!user) {
    return { success: false, error: "Invalid or expired verification code" };
  }

  // Update user as verified
  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpires: null,
    })
    .where(eq(users.id, user.id));

  // Send welcome email
  sendWelcomeEmail(email, user.name || user.username || "User")
    .catch(err => console.error(`[Auth] Failed to send welcome email:`, err));

  return { success: true };
}

// Resend verification code
export async function resendVerificationCode(email: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database connection failed" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return { success: false, error: "Email not found" };
  }

  if (user.emailVerified) {
    return { success: false, error: "Email already verified" };
  }

  // Generate new code
  const newCode = generateVerificationCode();
  const newExpires = new Date();
  newExpires.setMinutes(newExpires.getMinutes() + CODE_EXPIRY_MINUTES);

  await db
    .update(users)
    .set({
      emailVerificationCode: newCode,
      emailVerificationExpires: newExpires,
    })
    .where(eq(users.id, user.id));

  // Send verification email
  const sent = await sendVerificationEmail(email, user.name || user.username || "User", newCode);
  if (!sent) {
    return { success: false, error: "Failed to send verification email" };
  }

  return { success: true };
}

// ============================================================================
// PASSWORD RESET
// ============================================================================

// Request password reset
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database connection failed" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    // Don't reveal if email exists or not for security
    return { success: true };
  }

  // Only allow password reset for traditional auth users
  if (!user.passwordHash) {
    return { success: true }; // Silent success for OAuth users
  }

  // Generate reset code
  const resetCode = generateVerificationCode();
  const resetExpires = new Date();
  resetExpires.setMinutes(resetExpires.getMinutes() + CODE_EXPIRY_MINUTES);

  await db
    .update(users)
    .set({
      passwordResetCode: resetCode,
      passwordResetExpires: resetExpires,
    })
    .where(eq(users.id, user.id));

  // Send reset email
  sendPasswordResetEmail(email, user.name || user.username || "User", resetCode)
    .then(sent => {
      if (sent) {
        console.log(`[Auth] Password reset email sent to ${email}`);
      }
    })
    .catch(err => console.error(`[Auth] Failed to send reset email:`, err));

  return { success: true };
}

// Verify reset code (check if valid)
export async function verifyResetCode(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database connection failed" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, email),
        eq(users.passwordResetCode, code),
        gt(users.passwordResetExpires, new Date())
      )
    )
    .limit(1);

  if (!user) {
    return { success: false, error: "Invalid or expired reset code" };
  }

  return { success: true };
}

// Reset password with code
export async function resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database connection failed" };
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: "Password must be at least 6 characters" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, email),
        eq(users.passwordResetCode, code),
        gt(users.passwordResetExpires, new Date())
      )
    )
    .limit(1);

  if (!user) {
    return { success: false, error: "Invalid or expired reset code" };
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and clear reset code
  await db
    .update(users)
    .set({
      passwordHash,
      passwordResetCode: null,
      passwordResetExpires: null,
    })
    .where(eq(users.id, user.id));

  console.log(`[Auth] Password reset successful for ${email}`);
  return { success: true };
}
