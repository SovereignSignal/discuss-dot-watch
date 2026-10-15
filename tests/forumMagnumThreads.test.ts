import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTopPosts, parseComments, topPostsQuery, commentsQuery, MAX_THREAD_COMMENTS, MAX_COMMENT_CHARS } from '../src/lib/forumMagnumThreads';

const post = (id: string, extra: Record<string, unknown> = {}) => ({ _id: id, title: `Post ${id}`, slug: `post-${id}`, postedAt: '2026-09-12T05:03:06.458Z', modifiedAt: '2026-09-13T00:00:00Z', baseScore: 179, voteCount: 90, commentCount: 75, tags: [{ name: 'Animal welfare' }, { nope: 1 }], user: { displayName: 'Author' }, contents: { html: '<p>We propose <b>a change</b>.</p>' }, ...extra });
const comment = (id: string, extra: Record<string, unknown> = {}) => ({ _id: id, parentCommentId: null, postedAt: '2026-09-15T18:10:33Z', baseScore: 187, user: { displayName: 'Lewis' }, contents: { html: '<p>Thanks for the post. I disagree.</p>' }, ...extra });

test('queries are bounded and only accept well-formed ids and dates', () => {
  assert.match(topPostsQuery('2026-09-01T00:00:00Z', 50), /view:"top", after:"2026-09-01", limit:50/);
  assert.throws(() => topPostsQuery('2026-09-01T00:00:00Z', 101), /invalid_crawl_budget/);
  assert.throws(() => topPostsQuery('not a date', 10), /invalid_timestamp/);
  assert.match(commentsQuery('imoynWhpY5AqxcaDG'), /postId:"imoynWhpY5AqxcaDG", limit:40/);
  assert.throws(() => commentsQuery('x"} ) { evil'), /invalid_post_id/);
});
test('top posts keep text, score, tags and skip empty or malformed rows', () => {
  const data = { data: { posts: { results: [post('aaa'), post('bbb', { contents: { html: '' } }), post('c c', {}), post('ddd', { postedAt: 'garbage' }), post('eee', { title: '  ' })] } } };
  const posts = parseTopPosts(data);
  assert.deepEqual(posts.map(p => p.id), ['aaa']);
  assert.equal(posts[0].bodyText, 'We propose a change.');
  assert.deepEqual(posts[0].tags, ['Animal welfare']);
  assert.equal(posts[0].score, 179);
  assert.equal(posts[0].commentCount, 75);
  assert.equal(posts[0].author, 'Author');
  assert.throws(() => parseTopPosts({ data: { posts: { results: 'nope' } } }), /invalid_post_list/);
});
test('comments keep threading and scores, drop deleted and duplicates, cap length and count', () => {
  const data = { data: { comments: { results: [comment('c1'), comment('c2', { parentCommentId: 'c1' }), comment('c3', { deleted: true }), comment('c1'), comment('c4', { contents: { html: 'x'.repeat(MAX_COMMENT_CHARS + 10) } })] } } };
  const comments = parseComments(data);
  assert.deepEqual(comments.map(c => [c.id, c.parentId]), [['c1', null], ['c2', 'c1'], ['c4', null]]);
  assert.equal(comments[0].bodyText, 'Thanks for the post. I disagree.');
  assert.equal(comments[0].score, 187);
  assert.equal(comments[2].truncated, true);
  assert.equal(comments[2].bodyText.length, MAX_COMMENT_CHARS);
  const many = { data: { comments: { results: Array.from({ length: 60 }, (_, i) => comment(`k${i}`)) } } };
  assert.equal(parseComments(many).length, MAX_THREAD_COMMENTS);
});
