import { NextRequest, NextResponse } from 'next/server';
import { isAllowedUrl } from '@/lib/url';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';

async function tryFetch(url: string, timeout = 8000): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; GovWatch/1.0)',
      },
      signal: AbortSignal.timeout(timeout),
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting: 10 requests per minute per IP (validation is more expensive)
  const rateLimitKey = `validate:${getRateLimitKey(request)}`;
  const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 60000, maxRequests: 10 });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { valid: false, error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      }
    );
  }

  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ valid: false, error: 'URL is required' }, { status: 400 });
  }

  // SSRF protection: validate URL is not targeting internal resources
  if (!isAllowedUrl(url)) {
    return NextResponse.json({ valid: false, error: 'Invalid or disallowed URL' }, { status: 400 });
  }

  try {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    let forumName = 'Discourse Forum';

    // Helper to extract a clean name from hostname
    const getNameFromHostname = (url: string): string => {
      const hostname = new URL(url).hostname;
      // Remove common prefixes and get the main domain part
      const cleanHost = hostname
        .replace(/^(www\.|forum\.|gov\.|governance\.|discuss\.|community\.|research\.|dao\.)/i, '')
        .split('.')[0];
      // Capitalize first letter
      return cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
    };

    // Helper to validate and clean forum name
    const cleanForumName = (name: string | undefined, fallbackUrl: string): string => {
      if (!name) return getNameFromHostname(fallbackUrl);
      
      const lowerName = name.toLowerCase().trim();
      // Check for generic names that should be replaced
      const genericNames = ['forum', 'discourse', 'community', 'home', 'welcome'];
      if (genericNames.some(g => lowerName === g || lowerName.startsWith(g + ' ') || lowerName.endsWith(' ' + g))) {
        return getNameFromHostname(fallbackUrl);
      }
      
      // Clean up common patterns like "Forum - SiteName" or "SiteName Forum"
      const cleaned = name
        .replace(/^(forum|discourse|community)\s*[-–—:]\s*/i, '')
        .replace(/\s*[-–—:]\s*(forum|discourse|community)$/i, '')
        .replace(/\s+(forum|discourse|community)$/i, '')
        .trim();
      
      if (!cleaned || cleaned.toLowerCase() === 'forum') {
        return getNameFromHostname(fallbackUrl);
      }
      
      return cleaned;
    };

    // Try /site.json first (most reliable for Discourse detection)
    const siteResponse = await tryFetch(`${baseUrl}/site.json`);
    if (siteResponse) {
      try {
        const siteData = await siteResponse.json();
        if (siteData.default_locale !== undefined || siteData.categories !== undefined) {
          forumName = cleanForumName(siteData.title || siteData.description, baseUrl);
          return NextResponse.json({ valid: true, name: forumName });
        }
      } catch {
        // JSON parse failed, continue to next check
      }
    }

    // Try /about.json as fallback
    const aboutResponse = await tryFetch(`${baseUrl}/about.json`);
    if (aboutResponse) {
      try {
        const aboutData = await aboutResponse.json();
        if (aboutData.about?.title || aboutData.about?.description) {
          forumName = cleanForumName(aboutData.about.title, baseUrl);
          return NextResponse.json({ valid: true, name: forumName });
        }
      } catch {
        // JSON parse failed, continue to next check
      }
    }

    // Try /latest.json as last resort (confirms it's a Discourse forum)
    const latestResponse = await tryFetch(`${baseUrl}/latest.json`);
    if (latestResponse) {
      try {
        const latestData = await latestResponse.json();
        if (latestData.topic_list?.topics) {
          forumName = getNameFromHostname(baseUrl);
          return NextResponse.json({ valid: true, name: forumName });
        }
      } catch {
        // JSON parse failed
      }
    }

    // Check if the base URL at least returns HTML with Discourse indicators
    const htmlResponse = await tryFetch(baseUrl);
    if (htmlResponse) {
      const html = await htmlResponse.text();
      if (html.includes('discourse') || html.includes('Discourse') || html.includes('data-discourse')) {
        forumName = getNameFromHostname(baseUrl);
        return NextResponse.json({ valid: true, name: forumName });
      }
    }

    return NextResponse.json({ 
      valid: false, 
      error: 'Could not verify this is a Discourse forum. Check the URL and try again.' 
    });
  } catch (error) {
    console.error('Discourse validation error:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Failed to connect to forum. Please check the URL.' 
    });
  }
}
