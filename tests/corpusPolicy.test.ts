import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPage, corpusSource, corpusWindow, firstPostDocument, plainText, retryAfterSeconds, MAX_DOCUMENT_CHARS } from '../src/lib/corpusPolicy';
import { validateCorpusExtraction, type CorpusClassificationInput } from '../src/lib/corpusClassifier';

const asOf = '2026-10-03T00:00:00.000Z';
const cutoff = '2026-09-26T00:00:00.000Z';
const topic = (id: number, created = '2026-10-01T00:00:00.000Z', pinned = false) => ({
  id, title: 'Example topic', slug: 'example', created_at: created, bumped_at: created, pinned, tags: ['test'], category_id: 2,
});
const page = (topics: unknown[], more = '/latest.json?page=1') => ({ topic_list: { topics, more_topics_url: more } });

test('corpus jobs have explicit source and date-window allowlists', () => {
  assert.equal(corpusSource('livepeer').origin, 'https://forum.livepeer.org');
  assert.throws(() => corpusSource('http://127.0.0.1'));
  assert.deepEqual(corpusWindow(7, asOf, Date.parse(asOf)), { asOf, cutoff });
  assert.throws(() => corpusWindow(365, asOf));
  assert.throws(() => corpusWindow(7, '2036-10-03T00:00:00Z', Date.parse(asOf)));
});
test('cutoff uses creation time and ignores old pins', () => {
  const result = assessPage(page([topic(1, '2020-01-01T00:00:00Z', true), topic(2)]), cutoff, asOf);
  assert.equal(result.cutoffReached, false);
  assert.equal(result.eligible.length, 1);
  assert.equal(assessPage(page([topic(2), topic(3, '2026-09-20T00:00:00Z')]), cutoff, asOf).cutoffReached, true);
});
test('malformed and out-of-order pages are errors rather than completion', () => {
  assert.throws(() => assessPage({}, cutoff, asOf));
  assert.throws(() => assessPage(page([topic(1, '2026-09-01T00:00:00Z'), topic(2)]), cutoff, asOf));
  assert.throws(() => assessPage(page([topic(1, '2020-01-01T00:00:00Z', true)]), cutoff, asOf));
  assert.equal(assessPage(page([], ''), cutoff, asOf).exhausted, true);
});
test('duplicate IDs are admitted once and future records are excluded', () => {
  const result = assessPage(page([topic(3, '2027-01-01T00:00:00Z'), topic(1), topic(1)]), cutoff, asOf);
  assert.deepEqual(result.eligible.map(t => t.id), [1]);
});
test('first-post retrieval checks identity and post number', () => {
  const data = { ...topic(1), post_stream: { posts: [{ id: 13, post_number: 2, cooked: 'Reply' }, { id: 12, post_number: 1, cooked: '<p>First &amp; only.</p>' }] } };
  const doc = firstPostDocument(data, 1);
  assert.equal(doc.bodyText, 'First & only.');
  assert.equal(doc.sourcePostId, 12);
  assert.equal(doc.truncated, false);
  assert.throws(() => firstPostDocument(data, 9));
  assert.throws(() => firstPostDocument({ ...data, post_stream: { posts: [{ id: 12, post_number: 1, cooked: 'hidden', hidden: true }] } }, 1));
});
test('body cap is explicit and scripts are discarded', () => {
  assert.equal(plainText('<script>steal()</script><p>Safe text</p>'), 'Safe text');
  const doc = firstPostDocument({ ...topic(1), post_stream: { posts: [{ id: 12, post_number: 1, cooked: 'a'.repeat(MAX_DOCUMENT_CHARS + 5) }] } }, 1);
  assert.equal(doc.bodyText.length, MAX_DOCUMENT_CHARS);
  assert.equal(doc.truncated, true);
});
test('Retry-After supports seconds and HTTP dates', () => {
  assert.equal(retryAfterSeconds('120'), 120);
  assert.equal(retryAfterSeconds('Sat, 03 Oct 2026 00:02:00 GMT', Date.parse(asOf)), 120);
  assert.equal(retryAfterSeconds('invalid'), 60);
});
const body = 'We are hiring a Rust developer for a paid six-week contract.';
const input: CorpusClassificationInput = { title: 'Work bulletin', body, tags: [], createdAt: asOf, closed: false, lane: 'opportunities' };
const output = { relevant: true, kind: 'paid_work', availability: 'open', engagement: 'contract', paidEvidence: true, confidence: 95, evidence: body, deadline: null, applicationUrl: null };
test('opportunity classification requires evidence and compensation', () => {
  assert.equal(validateCorpusExtraction(output, input, Date.parse(asOf)).actionable, true);
  assert.equal(validateCorpusExtraction({ ...output, evidence: 'Fabricated job availability' }, input, Date.parse(asOf)).actionable, false);
  assert.equal(validateCorpusExtraction({ ...output, paidEvidence: false }, input, Date.parse(asOf)).actionable, false);
});
test('closed jobs and job-seeker advertisements cannot become openings', () => {
  assert.equal(validateCorpusExtraction(output, { ...input, closed: true }, Date.parse(asOf)).availability, 'closed');
  assert.equal(validateCorpusExtraction(output, { ...input, title: 'CLOSED: Work bulletin' }, Date.parse(asOf)).actionable, false);
  assert.equal(validateCorpusExtraction(output, { ...input, title: 'Freelancer for Hire' }, Date.parse(asOf)).kind, 'job_seeker');
});
test('unsupported deadlines and URLs remain unknown', () => {
  const result = validateCorpusExtraction({ ...output, deadline: '2026-02-30', applicationUrl: 'http://127.0.0.1/private' }, input, Date.parse(asOf));
  assert.equal(result.deadline, null); assert.equal(result.applicationUrl, null);
});
test('historical classification stays review-only and does not assume availability', () => {
  const result = validateCorpusExtraction(output, { ...input, createdAt: '2022-01-01T00:00:00Z' }, Date.parse(asOf));
  assert.equal(result.reviewRequired, true);
  assert.equal(result.availability, 'unknown');
  assert.equal(result.actionable, false);
});


test('corpus opportunity fields stay grounded in the quoted evidence', () => {
  const inferred = validateCorpusExtraction(
    { ...output, engagement: 'full_time', evidence: 'We are hiring a dedicated security engineer.' },
    { ...input, body: 'We are hiring a dedicated security engineer.' },
    Date.parse(asOf),
  );
  assert.equal(inferred.paidEvidence, true);
  assert.equal(inferred.engagement, null);

  const vague = validateCorpusExtraction(
    { ...output, paidEvidence: true, evidence: 'We are looking for contributors.' },
    { ...input, body: 'We are looking for contributors.' },
    Date.parse(asOf),
  );
  assert.equal(vague.paidEvidence, false);
  assert.equal(vague.actionable, false);
});
