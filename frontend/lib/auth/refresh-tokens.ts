import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db";
import { generateOpaqueToken, sha256 } from "@/lib/auth/crypto";

const REFRESH_TOKEN_TTL_DAYS = 30;

type RefreshTokenRow = RowDataPacket & {
  user_id: number;
  expires_at: Date;
  revoked_at: Date | null;
};

function buildExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function issueRefreshToken(userId: number): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const db = getDbPool();
  const token = generateOpaqueToken();
  const tokenHash = sha256(token);
  const expiresAt = buildExpiryDate();

  await db.execute(
    `INSERT INTO auth_refresh_tokens (refresh_token_id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [randomUUID(), userId, tokenHash, expiresAt],
  );

  return { token, expiresAt };
}

export async function rotateRefreshToken(currentToken: string): Promise<{
  userId: number;
  newToken: string;
  newExpiresAt: Date;
} | null> {
  const db = getDbPool();
  const currentHash = sha256(currentToken);
  const newToken = generateOpaqueToken();
  const newTokenHash = sha256(newToken);
  const newExpiresAt = buildExpiryDate();

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<RefreshTokenRow[]>(
      `SELECT user_id, expires_at, revoked_at
       FROM auth_refresh_tokens
       WHERE token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [currentHash],
    );

    if (!rows.length) {
      await connection.rollback();
      return null;
    }

    const row = rows[0];
    const isExpired = row.expires_at.getTime() <= Date.now();
    const isRevoked = row.revoked_at !== null;
    if (isExpired || isRevoked) {
      await connection.rollback();
      return null;
    }

    await connection.execute(
      `UPDATE auth_refresh_tokens
       SET revoked_at = NOW(), replaced_by_token_hash = ?
       WHERE token_hash = ?`,
      [newTokenHash, currentHash],
    );

    await connection.execute(
      `INSERT INTO auth_refresh_tokens (refresh_token_id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [randomUUID(), row.user_id, newTokenHash, newExpiresAt],
    );

    await connection.commit();
    return {
      userId: row.user_id,
      newToken,
      newExpiresAt,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const db = getDbPool();
  await db.execute(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [sha256(token)],
  );
}
