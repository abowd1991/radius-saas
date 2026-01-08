import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { createTenantSubscription } from "../_core/tenantSubscriptions";

const SALT_ROUNDS = 10;

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
      role: "reseller", // New users are resellers (can create NAS and cards)
      status: "active",
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
