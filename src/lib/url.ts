/** Private / reserved IPv4 ranges (loopback, RFC1918, link-local, CGNAT, 0/8). */
function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]), d = Number(m[4]);
  if (a > 255 || b > 255 || c > 255 || d > 255) return false;
  if (a === 0) return true;                          // 0.0.0.0/8
  if (a === 127) return true;                        // loopback
  if (a === 10) return true;                         // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true;  // RFC1918
  if (a === 192 && b === 168) return true;           // RFC1918
  if (a === 169 && b === 254) return true;           // link-local (cloud metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}

/**
 * Check if an IP address is private/internal.
 * Used to validate both hostnames and DNS-resolved IPs. Handles IPv4, bracketed
 * IPv6, and — critically — IPv6-mapped IPv4 in BOTH dotted (`::ffff:169.254.169.254`)
 * and hex-compressed (`::ffff:a9fe:a9fe`) forms, which Node may emit and which
 * otherwise bypass the IPv4 checks straight to cloud metadata.
 */
export function isPrivateIP(ip: string): boolean {
  const addr = ip.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();

  // IPv6-mapped IPv4 — normalize the embedded address and re-check.
  const mapped = addr.match(/^::ffff:(.+)$/);
  if (mapped) {
    const inner = mapped[1];
    if (inner.includes('.')) {
      return isPrivateIPv4(inner);
    }
    const groups = inner.split(':');
    if (groups.length === 2) {
      const hi = parseInt(groups[0], 16);
      const lo = parseInt(groups[1], 16);
      if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
        const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateIPv4(dotted);
      }
    }
    return true; // any other mapped form we can't parse — fail safe
  }

  // Plain IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) {
    return isPrivateIPv4(addr);
  }

  // IPv6 special ranges
  if (addr === '::1') return true;                   // loopback
  if (addr === '::') return true;                    // unspecified
  if (addr.startsWith('fe80:')) return true;         // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true;  // fc00::/7 unique-local

  return false;
}

/**
 * Check if a URL is potentially unsafe (SSRF protection)
 * Blocks localhost, private IPs, and cloud metadata endpoints
 *
 * Note: This validates the URL string at parse time only. For DNS-rebinding
 * protection (a public hostname that resolves to a private IP), fetch through
 * `safeFetch()` in lib/safeFetch.ts, which resolves DNS and re-checks every IP.
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Only allow http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // Block localhost variants
    if (hostname === 'localhost' ||
        hostname === '::1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.localhost')) {
      return false;
    }

    // Check if hostname is an IP (incl. bracketed IPv6 / IPv6-mapped IPv4) and private
    if (isPrivateIP(hostname)) {
      return false;
    }

    // Block cloud metadata endpoints by hostname
    if (hostname === 'metadata.google.internal' ||
        hostname === 'metadata.goog' ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.local')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a redirect URL is safe (SSRF protection for redirects)
 * This should be called before following any redirect
 */
export function isAllowedRedirectUrl(originalUrl: string, redirectUrl: string): boolean {
  // First check if the redirect URL itself is allowed
  if (!isAllowedUrl(redirectUrl)) {
    return false;
  }

  try {
    const original = new URL(originalUrl);
    const redirect = new URL(redirectUrl);

    // Block protocol downgrade (https -> http)
    if (original.protocol === 'https:' && redirect.protocol === 'http:') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    normalized = normalized.replace(/\/+$/, '');
    if (!normalized.endsWith('/')) {
      normalized += '/';
    }
    return normalized;
  } catch {
    return url;
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function validateDiscourseUrl(url: string): Promise<{ valid: boolean; name?: string; error?: string }> {
  if (!isValidUrl(url)) {
    return { valid: false, error: 'Invalid URL format' };
  }

  try {
    const normalizedUrl = normalizeUrl(url);
    const response = await fetch(`/api/validate-discourse?url=${encodeURIComponent(normalizedUrl)}`);
    const data = await response.json();
    
    if (data.valid) {
      return { valid: true, name: data.name };
    } else {
      return { valid: false, error: data.error || 'Not a valid Discourse forum' };
    }
  } catch {
    return { valid: false, error: 'Could not validate forum URL' };
  }
}
