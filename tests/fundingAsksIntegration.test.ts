import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, initializeSchema } from '../src/lib/db';
import { ensureIntelligence } from '../src/lib/intelligenceStore';
import { validateCorpusExtraction, type CorpusClassify } from '../src/lib/corpusClassifier';
import { runNativeCandidateScan } from '../src/lib/nativeLaneScan';
import { getFundingAsks, getUnnotifiedItems } from '../src/lib/grantsStore';

const testUrl = process.env.CORPUS_TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
after(async () => { if (testUrl) await getDb().end({ timeout: 5 }); });

const crypto = 'https://forum.asks-crypto.example', oss = 'https://forum.asks-oss.example';
const ask = 'We request 38,500 USDT to maintain the substrate-api-client for twelve months.';
const call = 'Applications are open for project grants of $50,000 this quarter.';
// Funding lane only: the asks list reads the funding record, the opportunities lane stays irrelevant.
const classifier: CorpusClassify = async input => ({
  model: 'fixture-asks',
  extraction: validateCorpusExtraction({
    relevant: input.lane === 'funding', kind: input.body === call ? 'open_call' : 'application', availability: 'open',
    engagement: null, paidEvidence: false, confidence: 90, evidence: input.body, deadline: null, applicationUrl: null,
    program: null, amountMin: null, amountMax: input.body === ask ? 38500 : null, currency: input.body === ask ? 'USDT' : null,
  }, input),
});

async function scan(n: number, forum: string, body: string, createdAt = new Date(Date.now() - 60_000)) {
  const iso = createdAt.toISOString();
  await runNativeCandidateScan([{ refId: `asks-${n}`, forumUrl: forum, protocol: 'Asks fixture', title: `Ecosystem thread ${n}`,
    url: `${forum}/t/request/${n}`, tags: [], body, createdAt: iso, bumpedAt: iso, signal: 'keywords: grant' }], 10, classifier);
}

test('crypto funding asks seen since the last brief reach Also new, never the grants queue', { skip: !testUrl }, async () => {
  await initializeSchema(); await ensureIntelligence();
  const db = getDb();
  for (const [url, vertical] of [[crypto, 'crypto'], [oss, 'oss']])
    await db`INSERT INTO ingestion_sources(source_key,name,url,adapter,vertical,managed_by) VALUES(${url},${'Asks ' + vertical},${url},'discourse',${vertical},'preset') ON CONFLICT DO NOTHING`;
  await db`UPDATE intelligence_settings SET value=jsonb_build_object('at',now()-interval '10 minutes') WHERE name='native-cutover'`;

  await scan(1, crypto, ask);
  const since = new Date();
  await scan(2, crypto, ask);
  await scan(3, oss, ask);   // not crypto
  await scan(4, crypto, call); // an open call, not an ask
  await scan(5, crypto, ask, new Date(Date.now() - 10 * 86_400_000)); // posted 10 days ago

  const asks = await getFundingAsks(since);
  assert.deepEqual(asks.map(a => a.title), ['Ecosystem thread 2']);
  const [a] = asks;
  assert.equal(a.kind, 'application');
  assert.ok(a.id < 0);
  assert.deepEqual([Number(a.amount_max), a.currency, a.protocol], [38500, 'USDT', 'Asks crypto']);
  assert.deepEqual((await getUnnotifiedItems('GRANT')).filter(g => g.title.startsWith('Ecosystem thread') && g.title !== 'Ecosystem thread 4'), []);
});
