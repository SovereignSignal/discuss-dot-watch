import test from 'node:test';
import assert from 'node:assert/strict';
import { logPostgresNotice } from '@/lib/db';

test('routine notices are dropped, warnings still log on one line', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  logPostgresNotice({ severity: 'NOTICE', code: '42P07', message: 'relation "intelligence_documents" already exists, skipping' });
  logPostgresNotice({ severity: 'NOTICE', code: '54000', message: 'word is too long to be indexed' });
  assert.equal(warn.mock.callCount(), 0);
  logPostgresNotice({ severity: 'WARNING', code: '01000', message: 'there is no transaction in progress' });
  assert.equal(warn.mock.callCount(), 1);
  assert.equal(warn.mock.calls[0].arguments[0], '[Postgres] WARNING 01000 there is no transaction in progress');
});
