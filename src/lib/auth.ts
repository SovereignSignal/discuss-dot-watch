/**
 * Server-side authentication middleware.
 *
 * verifyAuth    — verifies Privy access token, returns user DID. Used by /api/user/* routes.
 * verifyAdminAuth — checks CRON_SECRET first (machine-to-machine), then Privy + admin allowlist.
 */

import { timingSafeEqual, createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { PrivyClient } from '@privy-io/node';
import { isAdminEmail, isAdminDid } from './admin';
import { getDb, isDatabaseConfigured } from './db';

/** Constant-time string comparison to prevent timing attacks.
 *  Hashes both inputs to fixed-length values to avoid leaking length information. */
function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB) && a.length === b.length;
}

// Lazy singleton — avoids constructing when env vars are missing (dev mode)
let _privy: PrivyClient | null = null;

function getPrivyClient(): PrivyClient | null {
  if (_privy) return _privy;

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) return null;

  _privy = new PrivyClient({ appId, appSecret });
  return _privy;
}

export interface AuthResult {
  userId: string; // Privy DID (e.g. "did:privy:xxx")
}

export interface AuthError {
  error: string;
  status: number;
}

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/**
 * Verify a Privy access token from the Authorization header.
 * Returns the authenticated user's DID or an error.
 */
export async function verifyAuth(
  request: NextRequest,
): Promise<AuthResult | AuthError> {
  const token = extractBearerToken(request);
  if (!token) {
    return { error: 'Missing Authorization header', status: 401 };
  }

  const privy = getPrivyClient();
  if (!privy) {
    return { error: 'Auth not configured', status: 503 };
  }

  try {
    const claims = await privy.utils().auth().verifyAccessToken(token);
    return { userId: claims.user_id };
  } catch {
    return { error: 'Invalid or expired token', status: 401 };
  }
}

/**
 * Verify admin access. Checks in order:
 * 1. CRON_SECRET Bearer token (machine-to-machine)
 * 2. Privy access token + admin allowlist (email or DID)
 */
export async function verifyAdminAuth(
  request: NextRequest,
): Promise<AuthResult | AuthError> {
  const token = extractBearerToken(request);

  // 1. CRON_SECRET check (machine-to-machine)
  const cronSecret = process.env.CRON_SECRET;
  if (token && cronSecret && safeCompare(token, cronSecret)) {
    return { userId: 'cron' };
  }

  // 2. Privy token verification + admin check
  if (!token) {
    return { error: 'Missing Authorization header', status: 401 };
  }

  const privy = getPrivyClient();
  if (!privy) {
    return { error: 'Auth not configured', status: 503 };
  }

  let userId: string;
  try {
    const claims = await privy.utils().auth().verifyAccessToken(token);
    userId = claims.user_id;
  } catch {
    return { error: 'Invalid or expired token', status: 401 };
  }

  // Look up user email from DB for admin check
  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      const users = await db`SELECT email FROM users WHERE privy_did = ${userId}`;
      if (users.length > 0 && isAdminEmail(users[0].email)) {
        return { userId };
      }
    } catch {
      // DB lookup failed — fall through to DID check
    }
  }

  // Also check admin DID list
  if (isAdminDid(userId)) {
    return { userId };
  }

  return { error: 'Unauthorized', status: 403 };
}

/** Type guard to check if result is an error */
export function isAuthError(
  result: AuthResult | AuthError,
): result is AuthError {
  return 'error' in result;
}

/**
 * Validate CRON_SECRET from Authorization header (Bearer token).
 * Shared by cron endpoints (delegates, digest).
 * In development mode, allows access when CRON_SECRET is not set.
 */
export function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!authHeader || !cronSecret) return false;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return false;

  return safeCompare(token, cronSecret);
}
