import { NextRequest, NextResponse } from 'next/server';

const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const isDev = host.startsWith('localhost') || host.startsWith('127.0.0.1');

  // Redirect non-www to www (production only)
  if (!isDev && !host.startsWith('www.')) {
    const url = request.nextUrl.clone();
    url.host = `www.${host}`;
    return NextResponse.redirect(url, 301);
  }

  const response = NextResponse.next();

  // Set security headers on all responses
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)).*)',
  ],
};
