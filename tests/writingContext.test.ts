import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpec, tierThreads, computeStats, replySnippets, pickExemplars, cardPrompt, mineObjections, type CorpusThread } from '../src/lib/writingContext';

const thread = (id: number, replies: number, score: number, body: string, posts: CorpusThread['posts'] = []): CorpusThread => ({
  id: `discourse:${id}`, title: `Thread ${id}`, url: `https://gov.example.org/t/thread-${id}/${id}`, body, createdAt: `2026-0${1 + (id % 9)}-10T00:00:00.000Z`, closed: false,
  replies, likes: score, views: 100, score, posts,
});
const reply = (body: string, score = 1) => ({ username: 'delegate', body, score, replyTo: null });
const corpus = (): CorpusThread[] => [
  ...Array.from({ length: 9 }, (_, i) => thread(i + 1, i, i, `Summary: a modest ask. Budget: ${i}k. ${'word '.repeat(50 + i)}`)),
  thread(10, 40, 30, 'TL;DR: fund the thing. Motivation: we need it. Budget: 40k. Timeline: six months. ' + 'detail '.repeat(300), [reply('What is the total budget and who owns delivery?', 20), reply('Have you considered a smaller pilot first?', 9), reply('Thanks, great work.', 1)]),
  thread(11, 25, 12, 'Summary: another proposal. Budget: 10k. ' + 'detail '.repeat(120), [reply('Who owns delivery and what are the milestones?', 7), reply('What is the budget breakdown?', 5), reply('Please share the milestone schedule before the vote.', 2)]),
  thread(12, 0, 0, 'No sections at all, just a paragraph of text that nobody replied to.'),
];

test('spec validation accepts a discourse or magnum community and rejects junk', () => {
  const spec = parseSpec({ key: 'uniswap', genre: 'proposal', name: 'Uniswap Governance', discourse: { origin: 'https://gov.uniswap.org/', categoryIds: [5, 9] } });
  assert.equal(spec.discourse?.origin, 'https://gov.uniswap.org');
  assert.deepEqual(parseSpec({ key: 'ea', genre: 'post', name: 'EA Forum', magnum: { source: 'ea-forum' } }).magnum, { source: 'ea-forum' });
  for (const bad of [{ key: 'Bad Key', genre: 'x', name: 'n', magnum: { source: 'ea-forum' } }, { key: 'k', genre: 'g', name: 'n' }, { key: 'k', genre: 'g', name: 'n', discourse: { origin: 'http://x.org', categoryIds: [1] } },
    { key: 'k', genre: 'g', name: 'n', discourse: { origin: 'https://x.org/path', categoryIds: [1] } }, { key: 'k', genre: 'g', name: 'n', magnum: { source: 'reddit' } }]) assert.throws(() => parseSpec(bad), /invalid_community_spec/);
});
test('tiers, stats and exemplars come from the numbers, not the model', () => {
  const threads = corpus(), tiers = tierThreads(threads);
  assert.equal(tiers.get('discourse:10'), 'top');
  assert.equal(tiers.get('discourse:11'), 'top');
  assert.equal(tiers.get('discourse:12'), 'quiet');
  assert.equal(tiers.get('discourse:5'), 'typical');
  const stats = computeStats(threads, tiers);
  assert.equal(stats.threads, 12);
  assert.equal(stats.withReplies, 10);
  assert.equal(stats.topTier.threads, 2);
  assert.ok(stats.topTier.medianWords > stats.medianWords);
  const labels = Object.fromEntries(stats.sectionLabels.map(s => [s.label, s]));
  assert.ok(labels.budget.share > 0.8);
  assert.equal(labels.budget.topShare, 1);
  assert.ok(labels.summary);
  assert.equal(stats.period.from, '2026-01-10T00:00:00.000Z');
  const exemplars = pickExemplars(threads, tiers, 6);
  assert.deepEqual(exemplars.map(e => e.tier), ['top', 'top', 'typical', 'typical', 'quiet', 'quiet']);
  assert.equal(exemplars[0].id, 'discourse:10');
  assert.ok(exemplars[0].excerpt.endsWith('…'));
  const snippets = replySnippets(threads, tiers);
  assert.equal(snippets.length, 5);
  assert.match(snippets[0], /^\[Thread 10\] What is the total budget/);
  assert.ok(!snippets.some(s => s.includes('Thanks, great work')));
});
test('objections are mined by the model but a quote the replies do not contain is dropped, and singletons are dropped', async () => {
  const threads = corpus(), tiers = tierThreads(threads), spec = parseSpec({ key: 'k', genre: 'proposal', name: 'Example', magnum: { source: 'ea-forum' } });
  let prompt = '';
  const generate = async (req: { prompt: string }) => { prompt = req.prompt; return { model: 'fixture', output: { objections: [
    { text: 'Who owns delivery', count: 2, example: 'who owns delivery' }, { text: 'Budget breakdown', count: 3, example: 'this phrase was invented' }, { text: 'Only once', count: 1, example: 'smaller pilot' }] } }; };
  const mined = await mineObjections(replySnippets(threads, tiers), spec, generate as never);
  assert.match(prompt, /replies to proposal posts on Example/);
  assert.deepEqual(mined.objections.map(o => [o.text, o.count, o.example]), [['Budget breakdown', 3, ''], ['Who owns delivery', 2, 'who owns delivery']]);
  assert.equal(mined.model, 'fixture');
  assert.deepEqual(await mineObjections(['too', 'few'], spec, generate as never), { objections: [], model: null });
  const text = cardPrompt(spec, computeStats(threads, tiers), mined.objections, pickExemplars(threads, tiers), threads);
  assert.match(text, /median length \d+ words/);
  assert.match(text, /Budget breakdown \(3\)/);
  assert.match(text, /### Thread 10 \(40 replies, score 30\)/);
  assert.match(text, /## Pitfalls seen here/);
});
