import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRolesKeywords } from '../src/lib/grantsDetect';

test('opportunity prefilter finds general employment and contract language', () => {
  assert.ok(matchRolesKeywords('We are hiring a senior engineer', [], '').length > 0);
  assert.ok(matchRolesKeywords('Seeking a fractional operations consultant', [], '').length > 0);
  assert.ok(matchRolesKeywords('Research fellowship applications open', [], '').length > 0);
});
