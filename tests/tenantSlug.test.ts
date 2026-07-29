import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTenantSlug } from '@/lib/tenantSlug';

test('accepts supported tenant slugs', () => {
  assert.equal(isValidTenantSlug('uniswap-governance'), true);
  assert.equal(isValidTenantSlug('dao_2'), true);
});

test('rejects unsafe and out-of-contract slugs', () => {
  assert.equal(isValidTenantSlug('../admin'), false);
  assert.equal(isValidTenantSlug('with spaces'), false);
  assert.equal(isValidTenantSlug('x'.repeat(101)), false);
  assert.equal(isValidTenantSlug(null), false);
});
