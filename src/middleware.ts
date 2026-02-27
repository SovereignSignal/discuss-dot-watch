import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  // Skip redirect in development
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return NextResponse.next();
  }

  // Redirect non-www to www
  if (!host.startsWith('www.')) {
    const url = request.nextUrl.clone();
    url.host = `www.${host}`;
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals, static files, and API routes
    '/((?!_next|api|favicon\\.ico|robots\\.txt|sitemap\\.xml|feed|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)).*)',
  ],
};
