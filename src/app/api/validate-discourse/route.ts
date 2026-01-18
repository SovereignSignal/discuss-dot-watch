import { NextRequest, NextResponse } from 'next/server';

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
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ valid: false, error: 'URL is required' }, { status: 400 });
  }

  try {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    let forumName = 'Discourse Forum';

    // Try /site.json first (most reliable for Discourse detection)
    const siteResponse = await tryFetch(`${baseUrl}/site.json`);
    if (siteResponse) {
      try {
        const siteData = await siteResponse.json();
        if (siteData.default_locale !== undefined || siteData.categories !== undefined) {
          forumName = siteData.title || siteData.description || forumName;
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
          forumName = aboutData.about.title || forumName;
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
          // Extract name from URL if we got here
          const hostname = new URL(baseUrl).hostname;
          forumName = hostname.replace('www.', '').split('.')[0];
          forumName = forumName.charAt(0).toUpperCase() + forumName.slice(1) + ' Forum';
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
        const hostname = new URL(baseUrl).hostname;
        forumName = hostname.replace('www.', '').split('.')[0];
        forumName = forumName.charAt(0).toUpperCase() + forumName.slice(1) + ' Forum';
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
