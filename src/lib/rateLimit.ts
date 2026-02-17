/**
 * Simple in-memory rate limiter for API routes
 * Limits requests per IP address within a sliding window
 *
 * Note: Uses lazy cleanup on access to avoid memory leaks in serverless environments.
 * Each entry expires automatically when accessed after its resetAt time.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>();

// Maximum number of entries to prevent unbounded growth
const MAX_ENTRIES = 10000;

// Last cleanup timestamp
let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 60000; // 1 minute

/**
 * Performs lazy cleanup of expired entries.
 * Only runs if enough time has passed since last cleanup.
 * This avoids the memory leak of a persistent setInterval timer.
 */
function lazyCleanup() {
  const now = Date.now();

  // Only cleanup if interval has passed
  if (now - lastCleanupTime < CLEANUP_INTERVAL) {
    return;
  }

  lastCleanupTime = now;

  // Remove expired entries
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }

  // If still too many entries, remove oldest ones
  if (rateLimitStore.size > MAX_ENTRIES) {
    const entries = Array.from(rateLimitStore.entries())
      .sort((a, b) => a[1].resetAt - b[1].resetAt);

    const toRemove = entries.slice(0, rateLimitStore.size - MAX_ENTRIES);
    for (const [key] of toRemove) {
      rateLimitStore.delete(key);
    }
  }
}

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 30 }
): RateLimitResult {
  // Perform lazy cleanup to prevent memory leaks
  lazyCleanup();

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No existing entry or window expired - create new entry
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Increment count
  entry.count += 1;
  const allowed = entry.count <= config.maxRequests;

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Outgoing per-domain rate limiter
 * Throttles outbound requests to Discourse forums to avoid 429s.
 * Keyed by target domain (not client IP) — shared across all server requests.
 * Conservative limit: 20 req/min (Discourse default is 60/min, some forums lower it).
 */
const OUTGOING_RATE_LIMIT: RateLimitConfig = { windowMs: 60000, maxRequests: 20 };

export function checkOutgoingRateLimit(domain: string): RateLimitResult {
  const key = `outgoing:${domain}`;
  return checkRateLimit(key, OUTGOING_RATE_LIMIT);
}

/**
 * Get rate limit key from request (uses IP address or forwarded header)
 */
export function getRateLimitKey(request: Request): string {
  // Try to get real IP from forwarded headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Get first IP in chain (client IP)
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a generic key (all requests share same limit)
  return 'anonymous';
}
