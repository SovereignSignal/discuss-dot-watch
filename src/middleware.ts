import { NextRequest, NextResponse } from 'next/server';

const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Slug format for [tenant] dynamic route
const VALID_SLUG = /^[a-z0-9][a-z0-9-]*$/;

// Routes that have their own static pages (not caught by [tenant])
const STATIC_ROUTES = new Set([
  'admin', 'api', 'app', 'feed', 'privacy', 'terms',
  'sitemap.xml', 'robots.txt', 'icon.svg',
]);

function addSecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  // Redirect bare domain to www (only for the exact production domain)
  if (host === 'discuss.watch') {
    const url = request.nextUrl.clone();
    url.host = 'www.discuss.watch';
    return NextResponse.redirect(url, 301);
  }

  // Validate [tenant] slug format before rendering starts.
  // notFound() in async server components can't set HTTP 404 because
  // Next.js streaming commits the 200 status before they resolve.
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 1 && !STATIC_ROUTES.has(segments[0])) {
    const slug = segments[0];
    if (!VALID_SLUG.test(slug) || slug.length > 64) {
      const url = request.nextUrl.clone();
      url.pathname = '/_not-found';
      return addSecurityHeaders(NextResponse.rewrite(url));
    }
  }

  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)).*)',
  ],
};
