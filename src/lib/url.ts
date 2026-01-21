/**
 * Check if a URL is potentially unsafe (SSRF protection)
 * Blocks localhost, private IPs, and cloud metadata endpoints
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
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.localhost')) {
      return false;
    }

    // Block private IP ranges (RFC 1918)
    // 10.0.0.0 - 10.255.255.255
    if (hostname.match(/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      return false;
    }

    // 172.16.0.0 - 172.31.255.255
    if (hostname.match(/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/)) {
      return false;
    }

    // 192.168.0.0 - 192.168.255.255
    if (hostname.match(/^192\.168\.\d{1,3}\.\d{1,3}$/)) {
      return false;
    }

    // Block link-local addresses (169.254.x.x) - includes AWS metadata
    if (hostname.match(/^169\.254\.\d{1,3}\.\d{1,3}$/)) {
      return false;
    }

    // Block IPv6 loopback and link-local
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
