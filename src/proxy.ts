import { NextRequest, NextResponse } from 'next/server';
import { isValidTenantSlug, RESERVED_SLUGS } from '@/lib/tenantSlug';

const baseSecurityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const appSecurityHeaders: Record<string, string> = {
  ...baseSecurityHeaders,
  'X-Frame-Options': 'DENY',
  // Conservative CSP: these directives can't break scripts, styles, fonts, Privy or
  // wallet connectors (they don't constrain script-src/connect-src/frame-src), but do
  // block <base> hijacking and plugin objects.
  // A full script/style CSP needs a nonce setup + Privy/WalletConnect allowlist — TODO.
  'Content-Security-Policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
};

const embedSecurityHeaders: Record<string, string> = {
  ...baseSecurityHeaders,
  // The embed page is intentionally rendered inside third-party iframes.
  // Do not set X-Frame-Options here; use CSP frame-ancestors to allow framing.
  'Content-Security-Policy': "base-uri 'self'; object-src 'none'; frame-ancestors *",
};

// Reserved routes that have their own static pages and should never be treated as a tenant slug.
const STATIC_ROUTES = RESERVED_SLUGS;

function isEmbedPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  // /[tenant]/embed or /[tenant]/embed/...
  return segments.length >= 2 && segments[1] === 'embed';
}

function addSecurityHeaders(response: NextResponse, isEmbed: boolean) {
  const headers = isEmbed ? embedSecurityHeaders : appSecurityHeaders;
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function proxy(request: NextRequest) {
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
    if (!isValidTenantSlug(slug)) {
      const url = request.nextUrl.clone();
      url.pathname = '/_not-found';
      return addSecurityHeaders(NextResponse.rewrite(url), false);
    }
  }

  const response = NextResponse.next();
  return addSecurityHeaders(response, isEmbedPath(pathname));
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)).*)',
  ],
};
