/**
 * Privy server-side API client
 * 
 * Used for fetching user data from Privy's REST API
 */

interface PrivyLinkedAccount {
  type: string;
  address?: string;
  verified_at?: number;
}

interface PrivyUser {
  id: string; // DID like "did:privy:xxx"
  created_at: number;
  linked_accounts: PrivyLinkedAccount[];
  has_accepted_terms?: boolean;
  is_guest?: boolean;
}

interface PrivyUsersResponse {
  data: PrivyUser[];
  next_cursor?: string;
}

/**
 * Check if Privy server API is configured
 */
export function isPrivyServerConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

/**
 * Get Basic Auth header for Privy API
 */
function getPrivyAuthHeader(): string {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
  const appSecret = process.env.PRIVY_APP_SECRET!;
  const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Fetch all users from Privy API with pagination
 */
export async function fetchPrivyUsers(): Promise<PrivyUser[]> {
  if (!isPrivyServerConfigured()) {
    throw new Error('Privy server API not configured. Set PRIVY_APP_SECRET.');
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
  const allUsers: PrivyUser[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL('https://auth.privy.io/api/v1/users');
    url.searchParams.set('limit', '100');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': getPrivyAuthHeader(),
        'privy-app-id': appId,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Privy API error ${response.status}: ${errorText}`);
    }

    const data: PrivyUsersResponse = await response.json();
    allUsers.push(...data.data);
    cursor = data.next_cursor;
  } while (cursor);

  return allUsers;
}

/**
 * Extract email from Privy user's linked accounts
 */
export function getEmailFromPrivyUser(user: PrivyUser): string | null {
  const emailAccount = user.linked_accounts.find(a => a.type === 'email');
  return emailAccount?.address || null;
}

/**
 * Extract wallet address from Privy user's linked accounts
 */
export function getWalletFromPrivyUser(user: PrivyUser): string | null {
  const walletAccount = user.linked_accounts.find(a => a.type === 'wallet');
  return walletAccount?.address || null;
}

/**
 * Fetch a single Privy user by DID via the REST API.
 * Returns null when Privy is not configured or the lookup fails (fail-closed).
 */
export async function fetchPrivyUserById(did: string): Promise<PrivyUser | null> {
  if (!isPrivyServerConfigured()) return null;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
  try {
    const response = await fetch(
      `https://auth.privy.io/api/v1/users/${encodeURIComponent(did)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': getPrivyAuthHeader(),
          'privy-app-id': appId,
        },
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as PrivyUser;
  } catch {
    return null;
  }
}

// Short-TTL cache of DID → verified email so admin checks don't hit Privy on every request.
const _verifiedEmailCache = new Map<string, { email: string | null; expires: number }>();
const VERIFIED_EMAIL_TTL_MS = 60_000;

/**
 * Resolve the *verified* email for a Privy DID from Privy itself — NOT from the
 * user-writable `users.email` column. This is the authoritative source for
 * admin-allowlist checks. Never trust a locally-stored email for authorization.
 */
export async function getVerifiedEmailForDid(did: string): Promise<string | null> {
  const now = Date.now();
  const cached = _verifiedEmailCache.get(did);
  if (cached && cached.expires > now) return cached.email;

  const user = await fetchPrivyUserById(did);
  const email = user ? getEmailFromPrivyUser(user) : null;
  _verifiedEmailCache.set(did, { email, expires: now + VERIFIED_EMAIL_TTL_MS });
  return email;
}

export type { PrivyUser, PrivyLinkedAccount };
