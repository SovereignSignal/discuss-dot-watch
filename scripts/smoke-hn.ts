/* Runnable smoke check for the HN client (no test framework in repo). */
import assert from 'node:assert/strict';
import { fetchHackerNewsStories } from '../src/lib/hackerNewsClient';

const { posts, error } = await fetchHackerNewsStories('LLM GPT Anthropic inference', 75, 5);

assert.ok(!error, `expected no error, got: ${error}`);
assert.ok(posts.length > 0, 'expected at least one post');
for (const p of posts) {
  assert.ok(p.refId.startsWith('hackernews:'), `bad refId: ${p.refId}`);
  assert.equal(p.sourceType, 'hackernews');
  assert.ok(p.title.length > 0, 'title present');
  assert.ok(p.externalUrl?.includes('news.ycombinator.com/item?id='), `expected HN comments-thread URL, got: ${p.externalUrl}`);
  assert.equal(typeof p.score, 'number');
  assert.ok((p.score ?? 0) >= 75, `points below threshold: ${p.score}`);
}
console.log(`✓ HN smoke passed: ${posts.length} posts — e.g. "${posts[0].title}" (${posts[0].score} pts)`);
