/**
 * Check if an IP address is private/internal
 * Used to validate both hostnames and resolved IPs
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4 checks
  // Localhost
  if (ip === '127.0.0.1' || ip.startsWith('127.')) {
    return true;
  }

  // 0.0.0.0
  if (ip === '0.0.0.0') {
    return true;
  }

  // 10.0.0.0 - 10.255.255.255
  if (ip.match(/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
    return true;
  }

  // 172.16.0.0 - 172.31.255.255
  if (ip.match(/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/)) {
    return true;
  }

  // 192.168.0.0 - 192.168.255.255
  if (ip.match(/^192\.168\.\d{1,3}\.\d{1,3}$/)) {
    return true;
  }

  // 169.254.0.0 - 169.254.255.255 (link-local, includes AWS metadata)
  if (ip.match(/^169\.254\.\d{1,3}\.\d{1,3}$/)) {
    return true;
  }

  // IPv6 loopback and link-local
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('::ffff:127.')) {
    return true;
  }

  return false;
}

/**
 * Check if a URL is potentially unsafe (SSRF protection)
 * Blocks localhost, private IPs, and cloud metadata endpoints
 *
 * Note: This validates the URL at parse time. For full DNS rebinding protection,
 * use validateResolvedIP() after DNS resolution or use safeFetch() which does both.
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

    // Check if hostname is an IP and if it's private
    if (isPrivateIP(hostname)) {
      return false;
    }

    // Block IPv6 loopback and link-local (bracketed format)
    if (hostname.startsWith('[') && (hostname.includes('::1') || hostname.includes('fe80:'))) {
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
