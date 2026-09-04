import test from 'node:test';
import assert from 'node:assert/strict';
import { FORUM_CATEGORIES } from '@/lib/forumPresets';
import { categoryFeedUrl } from '@/lib/grantsScan';

const feeds = FORUM_CATEGORIES.flatMap(cat =>
  cat.forums.flatMap(p => (p.grantsCategories ?? []).map(c => ({ forum: p.name, url: p.url, cat: c }))),
);

test('every configured grants feed has a usable id and slug', () => {
  assert.ok(feeds.length > 0, 'no grants categories configured at all');
  for (const { forum, cat } of feeds) {
    assert.ok(Number.isInteger(cat.id) && cat.id > 0, `${forum}: bad category id ${cat.id}`);
    assert.match(cat.slug, /^[a-z0-9-]+$/, `${forum}: bad slug ${cat.slug}`);
    if (cat.parentSlug !== undefined) {
      assert.match(cat.parentSlug, /^[a-z0-9-]+$/, `${forum}: bad parentSlug ${cat.parentSlug}`);
    }
  }
});

test('a forum never lists the same category id twice', () => {
  const byForum = new Map<string, Set<number>>();
  for (const { forum, cat } of feeds) {
    const seen = byForum.get(forum) ?? new Set<number>();
    assert.ok(!seen.has(cat.id), `${forum}: duplicate category id ${cat.id}`);
    seen.add(cat.id);
    byForum.set(forum, seen);
  }
});

test('every feed builds an absolute https RSS url', () => {
  for (const { forum, url, cat } of feeds) {
    const u = categoryFeedUrl(url, cat);
    assert.ok(u.startsWith('https://'), `${forum}: ${u}`);
    assert.match(u, /\/c\/[a-z0-9-]+(\/[a-z0-9-]+)?\/\d+\.rss$/, `${forum}: ${u}`);
    assert.ok(!u.includes('//c/'), `${forum}: double slash in ${u}`);
  }
});

test('duplicate slugs within a forum are disambiguated by parentSlug', () => {
  // ENS has two "resource-requests" categories under different parents; a
  // flat /c/{slug}/{id}.rss returns an empty feed for both.
  const bySlug = new Map<string, Set<string | undefined>>();
  for (const { forum, cat } of feeds) {
    const key = `${forum}:${cat.slug}`;
    const parents = bySlug.get(key) ?? new Set<string | undefined>();
    parents.add(cat.parentSlug);
    bySlug.set(key, parents);
  }
  for (const [key, parents] of bySlug) {
    if (parents.size > 1) assert.ok(!parents.has(undefined), `${key}: ambiguous, one entry has no parentSlug`);
  }
});
