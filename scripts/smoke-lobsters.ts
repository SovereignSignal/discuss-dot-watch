/* Runnable smoke check for the Lobsters client. */
import assert from 'node:assert/strict';
import { fetchLobstersStories } from '../src/lib/lobstersClient';

const { posts, error } = await fetchLobstersStories('ai', 5);

assert.ok(!error, `expected no error, got: ${error}`);
assert.ok(posts.length > 0, 'expected at least one post');
for (const p of posts) {
  assert.ok(p.refId.startsWith('lobsters:'), `bad refId: ${p.refId}`);
  assert.equal(p.sourceType, 'lobsters');
  assert.ok(p.title.length > 0, 'title present');
  assert.ok(p.externalUrl?.startsWith('http'), `bad externalUrl: ${p.externalUrl}`);
  assert.equal(typeof p.authorName, 'string');
}
console.log(`✓ Lobsters smoke passed: ${posts.length} posts — e.g. "${posts[0].title}"`);
