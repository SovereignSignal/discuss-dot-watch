/**
 * SSRF-safe fetch (server-only).
 *
 * `isAllowedUrl()` (lib/url.ts) validates a URL *string*, but a public hostname can
 * still resolve to a private IP (DNS rebinding / plain internal A record). This module
 * adds the resolution-time check the docs promise: it resolves DNS, rejects any private
 * resolved address, follows redirects MANUALLY, and re-validates every hop.
 *
 * Use this for EVERY fetch of a user- or tenant-supplied URL. Do not import it into
 * client components — it depends on node:dns. (url.ts stays dependency-free for clients.)
 */
import { promises as dns } from 'dns';
import { isAllowedUrl, isAllowedRedirectUrl, isPrivateIP } from './url';

export type SafeFetchInit = RequestInit & {
  maxRedirects?: number;
  /** Restrict redirects to the original hostname (the stricter /api/discourse rule). */
  sameHost?: boolean;
  /** Per-hop timeout, applied only when the caller passes no signal of its own.
   *  Bounds background refresh/backfill against hung upstream sockets. */
  timeoutMs?: number;
  // Next.js fetch cache hint (passed through transparently)
  next?: { revalidate?: number | false; tags?: string[] };
};

/** Resolve a hostname (or IP literal) and throw if any resolved address is private. */
async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[/, '').replace(/\]$/, '');

  // Literal IPs short-circuit (isAllowedUrl already checked, but be defensive).
  if (isPrivateIP(host)) {
    throw new Error('Blocked request to private address');
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('DNS resolution failed');
  }
  for (const { address } of addresses) {
    if (isPrivateIP(address)) {
      throw new Error('Hostname resolves to a private address');
    }
  }
}

/**
 * Fetch a URL with SSRF protection. Throws on disallowed URLs, private-resolving
 * hosts, unsafe redirects, or too many redirects — callers should catch and degrade.
 */
export async function safeFetch(url: string, init: SafeFetchInit = {}): Promise<Response> {
  const { maxRedirects = 3, sameHost = false, timeoutMs = 15_000, ...rest } = init;
  let currentUrl = url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!isAllowedUrl(currentUrl)) {
      throw new Error('URL not allowed');
    }
    const parsed = new URL(currentUrl);
    await assertPublicHost(parsed.hostname);

    const response = await fetch(currentUrl, {
      ...rest,
      signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isAllowedRedirectUrl(currentUrl, nextUrl)) {
        throw new Error('Unsafe redirect blocked');
      }
      if (sameHost && new URL(nextUrl).hostname !== parsed.hostname) {
        throw new Error('Cross-host redirect blocked');
      }
      currentUrl = nextUrl;
      continue;
    }
    return response;
  }

  throw new Error('Too many redirects');
}

/**
 * Read a response body as text, capped at `maxBytes` to avoid memory exhaustion
 * from a hostile/huge upstream (e.g. validating an arbitrary URL as a forum).
 */
export async function readCappedText(response: Response, maxBytes = 512 * 1024): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
          break;
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return new TextDecoder().decode(concat(chunks));
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}
