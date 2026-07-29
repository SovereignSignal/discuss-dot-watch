import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

test('redirects the bare production domain to www', () => {
  const response = proxy(new NextRequest('https://discuss.watch/app', { headers: { host: 'discuss.watch' } }));
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), 'https://www.discuss.watch/app');
});

test('applies security headers to normal requests', () => {
  const response = proxy(new NextRequest('https://www.discuss.watch/app'));
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('content-security-policy'), "base-uri 'self'; object-src 'none'");
});

test('rewrites invalid tenant slugs to the not-found route', () => {
  const response = proxy(new NextRequest('https://www.discuss.watch/%24bad'));
  assert.match(response.headers.get('x-middleware-rewrite') ?? '', /\/_not-found$/);
});
