/* Runnable smoke check for the Anticapture client (POC).
 * Requires ANTICAPTURE_API_KEY in env (the dev token). Hits the live MCP gateway.
 *   ANTICAPTURE_API_KEY=<token> npx tsx scripts/smoke-anticapture.ts
 */
import assert from 'node:assert/strict';
import { isAnticaptureConfigured, getDaos, getGovernanceSnapshot } from '../src/lib/delegates/anticaptureClient';

assert.ok(isAnticaptureConfigured(), 'set ANTICAPTURE_API_KEY in the environment');

const daos = await getDaos();
assert.ok(Array.isArray(daos) && daos.length >= 5, `expected the supported-DAO list, got ${daos.length}`);
assert.ok(daos.every((d) => typeof d.id === 'string'), 'each DAO has an id');
console.log(`✓ daos: ${daos.length} supported — ${daos.map((d) => d.id).join(', ')}`);

const snap = await getGovernanceSnapshot('uni', { topDelegates: 10 });
assert.ok(snap.votingPowers.length > 0, 'expected voting-power entries for uni');
const top = snap.votingPowers[0];
assert.ok(top.accountId.startsWith('0x') && typeof top.votesCount === 'number', 'voting-power entry shape');
assert.ok(Array.isArray(snap.feedEvents), 'feedEvents is an array');
console.log(
  `✓ uni snapshot: ${snap.votingPowers.length} delegates (top votesCount=${top.votesCount}), ` +
    `${snap.feedEvents.length} feed events, ${snap.proposals.length} proposals, treasury=${snap.treasury ? 'present' : 'none'}`,
);
console.log('✓ Anticapture data-layer POC works end-to-end (via MCP gateway)');
