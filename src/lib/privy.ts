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

export type { PrivyUser, PrivyLinkedAccount };
