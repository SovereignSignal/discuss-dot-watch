import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminActionSchema } from '@/lib/delegates/adminSchemas';

const validDelegate = {
  username: 'delegate_one',
  displayName: 'Delegate One',
  walletAddress: '0x1111111111111111111111111111111111111111',
};

test('accepts a bounded, safe tenant action', () => {
  const result = AdminActionSchema.safeParse({
    action: 'create-tenant',
    slug: 'uniswap-governance',
    name: 'Uniswap Governance',
    forumUrl: 'https://gov.uniswap.org',
    apiKey: 'secret',
    apiUsername: 'system',
    config: { refreshIntervalHours: 4, branding: { accentColor: '#ff007a' } },
  });
  assert.equal(result.success, true);
});

test('rejects private network forum URLs and malformed wallets', () => {
  assert.equal(AdminActionSchema.safeParse({
    action: 'create-tenant', slug: 'bad', name: 'Bad', forumUrl: 'http://127.0.0.1:3000', apiKey: 'x', apiUsername: 'x',
  }).success, false);
  assert.equal(AdminActionSchema.safeParse({
    action: 'upsert-delegate', tenantSlug: 'uniswap', delegate: { ...validDelegate, walletAddress: '0x1234' },
  }).success, false);
});

test('rejects unknown config fields and oversized bulk writes', () => {
  assert.equal(AdminActionSchema.safeParse({
    action: 'update-tenant', tenantSlug: 'uniswap', config: { hiddenPrivilege: true },
  }).success, false);
  assert.equal(AdminActionSchema.safeParse({
    action: 'bulk-upsert-delegates', tenantSlug: 'uniswap', delegates: Array.from({ length: 201 }, () => validDelegate),
  }).success, false);
});
