/**
 * Input sanitization utilities
 */

/**
 * Sanitize user input by removing potentially dangerous characters
 * Used for search queries and other text inputs
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length to prevent DoS
  if (sanitized.length > 500) {
    sanitized = sanitized.slice(0, 500);
  }

  return sanitized;
}

/**
 * Sanitize a string for safe display in HTML context
 * Escapes HTML special characters
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';

  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };

  return input.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * Validate and sanitize a URL
 * Returns null if URL is invalid or potentially malicious
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url.trim());

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // Block javascript: and data: URLs that might bypass protocol check
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('javascript:') || lowerUrl.includes('data:')) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Sanitize a keyword alert input
 */
export function sanitizeKeyword(keyword: string): string {
  if (!keyword || typeof keyword !== 'string') return '';

  let sanitized = keyword.trim();

  // Remove any HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.slice(0, 100);
  }

  return sanitized;
}
