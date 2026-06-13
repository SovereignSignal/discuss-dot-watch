/**
 * Admin utilities
 * 
 * Controls who can access admin features
 */

// Admin emails — read from ADMIN_EMAILS env var (comma-separated), falling back to hardcoded default
const ADMIN_EMAILS: string[] = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean)
  : ['sov@sovereignsignal.com'];

// Admin Privy DIDs — read from ADMIN_DIDS env var (comma-separated).
// A DID is cryptographically bound to the verified Privy access token, so this is
// the most robust admin check: it needs no DB/network lookup and cannot be spoofed.
const ADMIN_DIDS: string[] = process.env.ADMIN_DIDS
  ? process.env.ADMIN_DIDS.split(',').map(d => d.trim()).filter(Boolean)
  : [];

/**
 * Check if a user is an admin by email
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some(
    adminEmail => adminEmail.toLowerCase() === email.toLowerCase()
  );
}

/**
 * Check if a user is an admin by Privy DID
 */
export function isAdminDid(did: string | null | undefined): boolean {
  if (!did) return false;
  return ADMIN_DIDS.includes(did);
}

/**
 * Check if a user is an admin (by email or DID)
 */
export function isAdmin(params: { 
  email?: string | null; 
  did?: string | null;
}): boolean {
  return isAdminEmail(params.email) || isAdminDid(params.did);
}

/**
 * Get admin emails (for display purposes)
 */
export function getAdminEmails(): string[] {
  return [...ADMIN_EMAILS];
}
