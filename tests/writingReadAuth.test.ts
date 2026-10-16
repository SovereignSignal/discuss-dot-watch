import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { verifyWritingReadAuth, verifyAdminAuth, isAuthError } from '../src/lib/auth';

const req = (token?: string) => new NextRequest('https://www.discuss.watch/api/v1/writing-exemplars', { headers: token ? { authorization: `Bearer ${token}` } : {} });

test('the writing read token opens the writing surfaces only; privileged tokens still work; unset means privileged only', async () => {
  const saved = { cron: process.env.CRON_SECRET, admin: process.env.ADMIN_SECRET, writing: process.env.WRITING_CONTEXT_TOKEN };
  try {
    process.env.CRON_SECRET = 'cron-secret-value'; delete process.env.ADMIN_SECRET; process.env.WRITING_CONTEXT_TOKEN = 'reader-token-value';
    assert.deepEqual(await verifyWritingReadAuth(req('reader-token-value')), { userId: 'writing-reader' });
    assert.deepEqual(await verifyWritingReadAuth(req('cron-secret-value')), { userId: 'admin', isSuperAdmin: true });
    assert.equal(isAuthError(await verifyWritingReadAuth(req('wrong'))), true);
    assert.equal((await verifyWritingReadAuth(req()) as { status: number }).status, 401);
    // The read token is not an admin token anywhere else.
    assert.equal((await verifyAdminAuth(req('reader-token-value')) as { status: number }).status, 403);
    delete process.env.WRITING_CONTEXT_TOKEN;
    assert.equal((await verifyWritingReadAuth(req('reader-token-value')) as { status: number }).status, 403);
    process.env.WRITING_CONTEXT_TOKEN = '';
    assert.equal((await verifyWritingReadAuth(req('')) as { status: number }).status, 401);
  } finally {
    for (const [k, v] of [['CRON_SECRET', saved.cron], ['ADMIN_SECRET', saved.admin], ['WRITING_CONTEXT_TOKEN', saved.writing]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
