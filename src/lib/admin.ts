/**
 * Admin utilities
 * 
 * Controls who can access admin features
 */

// Admin emails — read from ADMIN_EMAILS env var (comma-separated), falling back to hardcoded default
const ADMIN_EMAILS: string[] = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean)
  : ['sov@sovereignsignal.com'];

// Admin Privy DIDs (optional, for wallet-based auth)
const ADMIN_DIDS: string[] = [
  // Add Privy DIDs here if needed
];

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
