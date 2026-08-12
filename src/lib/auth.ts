/**
 * Server-side authentication for privileged routes.
 *
 * The reader app is public — no user accounts. Admin and cron routes accept a
 * Bearer token matching CRON_SECRET or ADMIN_SECRET.
 */

import { timingSafeEqual, createHash } from 'crypto';
import { NextRequest } from 'next/server';

/** Constant-time string comparison to prevent timing attacks.
 *  Hashing both inputs to fixed-length SHA-256 digests equalizes length, so the
 *  timingSafeEqual comparison is already complete and length-safe on its own. */
function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export interface AuthResult {
  userId: string;
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

function matchesSecret(token: string, secret: string | undefined): boolean {
  return !!secret && safeCompare(token, secret);
}

/** True when the bearer token matches CRON_SECRET or ADMIN_SECRET. */
function isPrivilegedToken(token: string | null): boolean {
  if (!token) return false;
  return (
    matchesSecret(token, process.env.CRON_SECRET) ||
    matchesSecret(token, process.env.ADMIN_SECRET)
  );
}

/** Type guard to check if result is an error */
export function isAuthError(
  result: AuthResult | AuthError,
): result is AuthError {
  return 'error' in result;
}

/**
 * Verify admin access via CRON_SECRET or ADMIN_SECRET Bearer token.
 */
export async function verifyAdminAuth(
  request: NextRequest,
): Promise<AuthResult | AuthError> {
  const token = extractBearerToken(request);

  if (isPrivilegedToken(token)) {
    return { userId: 'admin', isSuperAdmin: true };
  }

  if (!token) {
    return { error: 'Missing Authorization header', status: 401 };
  }

  return { error: 'Unauthorized', status: 403 };
}

/**
 * Verify tenant-scoped admin access. With no user accounts, a valid
 * CRON_SECRET / ADMIN_SECRET grants super-admin access to every tenant.
 */
export async function verifyTenantAdmin(
  request: NextRequest,
  _tenantSlug: string,
): Promise<AuthResult | AuthError> {
  return verifyAdminAuth(request);
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
