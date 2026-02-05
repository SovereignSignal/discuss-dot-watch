/**
 * Admin utilities
 * 
 * Controls who can access admin features
 */

// Admin emails - add your email here
const ADMIN_EMAILS = [
  'sov@sovereignsignal.io',
  'jenson@sovereignsignal.io',
  // Add more admin emails as needed
];

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
