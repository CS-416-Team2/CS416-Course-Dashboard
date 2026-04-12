import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { getDbPool } from "@/lib/db";

export type AuthUserRecord = {
  userId: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  sessionVersion: number;
};

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid credentials")
    .max(254, "Invalid credentials")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "Invalid credentials")
    .max(128, "Invalid credentials"),
});

export const registrationSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(254, "Email is too long")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50, "First name is too long"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(50, "Last name is too long"),
});

const BCRYPT_ROUNDS = 12;

export async function createUser(
  data: z.infer<typeof registrationSchema>,
): Promise<{ userId: number } | { error: string }> {
  const db = getDbPool();

  const existing = await findUserByEmail(data.email);
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO users (email, password_hash, first_name, last_name, is_active, session_version)
     VALUES (?, ?, ?, ?, 1, 1)`,
    [data.email, passwordHash, data.firstName, data.lastName],
  );

  return { userId: result.insertId };
}

type UserRow = RowDataPacket & {
  user_id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  is_active: 0 | 1;
  session_version: number;
};

export async function findUserByEmail(email: string): Promise<AuthUserRecord | null> {
  const db = getDbPool();
  const [rows] = await db.execute<UserRow[]>(
    `SELECT user_id, email, password_hash, first_name, last_name, is_active, session_version
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  );

  if (!rows.length) {
    return null;
  }

  const row = rows[0];
  return {
    userId: row.user_id,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    isActive: row.is_active === 1,
    sessionVersion: row.session_version,
  };
}

type SessionMetaRow = RowDataPacket & {
  is_active: 0 | 1;
  session_version: number;
};

export async function getUserSessionMeta(userId: number): Promise<{
  isActive: boolean;
  sessionVersion: number;
} | null> {
  const db = getDbPool();
  const [rows] = await db.execute<SessionMetaRow[]>(
    `SELECT is_active, session_version FROM users WHERE user_id = ? LIMIT 1`,
    [userId],
  );

  if (!rows.length) {
    return null;
  }

  return {
    isActive: rows[0].is_active === 1,
    sessionVersion: rows[0].session_version,
  };
}
