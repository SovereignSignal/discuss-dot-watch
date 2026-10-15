import test from 'node:test';
import assert from 'node:assert/strict';
import { postText } from '@/lib/eaForumClient';

test('EA Forum and LessWrong bodies are the whole post, not the API\'s 2,000-character plaintext', () => {
  // Generator residency (2026-10-15): the stipend sits past character 2,000.
  const html = `<p>${'Context paragraph. '.repeat(150)}</p><p>Residents at Generator receive $8,500&nbsp;per month &amp; travel.</p>`;
  const text = postText({ contents: { html } })!;
  assert.ok(text.length > 2000);
  assert.match(text, /receive \$8,500 per month & travel\.$/);
  assert.equal(postText({ contents: null }), undefined);
});
