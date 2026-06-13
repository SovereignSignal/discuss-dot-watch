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
import { isDatabaseConfigured } from './db';
import { getVerifiedEmailForDid } from './privy';

/** Constant-time string comparison to prevent timing attacks.
 *  Hashing both inputs to fixed-length SHA-256 digests equalizes length, so the
 *  timingSafeEqual comparison is already complete and length-safe on its own. */
function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
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
  isSuperAdmin?: boolean;
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

  // 1. DID allowlist — cryptographically bound to the verified token, no lookup needed.
  if (isAdminDid(userId)) {
    return { userId };
  }

  // 2. Verified email from Privy (the authoritative source — NEVER the user-writable
  //    users.email column, which a client can set to any address).
  try {
    const email = await getVerifiedEmailForDid(userId);
    if (isAdminEmail(email)) {
      return { userId };
    }
  } catch (err) {
    console.error('[auth] admin email resolution failed:', err);
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
 * Check if a Privy DID belongs to a super admin.
 * Looks up email from DB, then checks email + DID allowlists.
 */
export async function checkIsSuperAdmin(privyDid: string): Promise<boolean> {
  if (isAdminDid(privyDid)) return true;

  // Resolve the verified email from Privy, not from the user-writable users.email column.
  try {
    const email = await getVerifiedEmailForDid(privyDid);
    if (isAdminEmail(email)) {
      return true;
    }
  } catch (err) {
    console.error('[auth] super-admin email resolution failed:', err);
  }

  return false;
}

/**
 * Verify tenant-scoped admin access. Checks in order:
 * 1. CRON_SECRET → super admin
 * 2. Privy token → super admin (email/DID allowlist)
 * 3. Privy token → tenant_admins table for the given slug
 * 4. Otherwise → 403
 */
export async function verifyTenantAdmin(
  request: NextRequest,
  tenantSlug: string,
): Promise<AuthResult | AuthError> {
  const token = extractBearerToken(request);

  // 1. CRON_SECRET check
  const cronSecret = process.env.CRON_SECRET;
  if (token && cronSecret && safeCompare(token, cronSecret)) {
    return { userId: 'cron', isSuperAdmin: true };
  }

  // 2 & 3. Privy token verification
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

  // Check super admin first
  if (await checkIsSuperAdmin(userId)) {
    return { userId, isSuperAdmin: true };
  }

  // Check tenant-scoped admin
  if (isDatabaseConfigured()) {
    try {
      const { isTenantAdmin } = await import('./delegates/db');
      if (await isTenantAdmin(userId, tenantSlug)) {
        return { userId, isSuperAdmin: false };
      }
    } catch {
      // DB lookup failed
    }
  }

  return { error: 'Unauthorized', status: 403 };
}

/**
 * Validate CRON_SECRET from Authorization header (Bearer token).
 * Shared by cron endpoints (delegates, digest).
 * In development mode, allows access when CRON_SECRET is not set.
 */
export function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Dev-only bypass: allow ONLY when no secret is configured, we are explicitly in
  // development, AND there are no proxy-forwarded headers (i.e. a genuinely local
  // request, never a deployed preview/staging env where a proxy sits in front).
  if (!cronSecret) {
    const isLocalDev =
      process.env.NODE_ENV === 'development' &&
      !request.headers.get('x-forwarded-for') &&
      !request.headers.get('x-forwarded-host');
    if (isLocalDev) {
      console.warn('[auth] CRON_SECRET unset — allowing cron access in local dev only');
      return true;
    }
    return false;
  }

  if (!authHeader) return false;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return false;

  return safeCompare(token, cronSecret);
}
