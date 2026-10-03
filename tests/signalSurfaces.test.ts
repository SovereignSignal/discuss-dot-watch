import test from 'node:test';
import assert from 'node:assert/strict';
import { getSignalSurfaces, type ForumPreset } from '../src/lib/forumPresets';
import { signalSurfaceFeedUrl } from '../src/lib/grantsScan';

const preset: ForumPreset = {
  name: 'X', url: 'https://forum.example/', tier: 1,
  grantsCategories: [{ id: 10, slug: 'grants' }],
  signalSurfaces: [{ lane: 'opportunities', type: 'tag', slug: 'rfp' }],
};

test('legacy grant categories migrate alongside explicit signal surfaces', () => {
  const surfaces = getSignalSurfaces(preset);
  assert.equal(surfaces.length, 2);
  assert.ok(surfaces.some(s => s.lane === 'funding' && s.type === 'category'));
  assert.ok(surfaces.some(s => s.lane === 'opportunities' && s.type === 'tag'));
});

test('signal surface URLs support categories and tags', () => {
  const [cat, tag] = getSignalSurfaces(preset);
  assert.equal(signalSurfaceFeedUrl(preset.url, cat), 'https://forum.example/c/grants/10.rss');
  assert.equal(signalSurfaceFeedUrl(preset.url, tag), 'https://forum.example/tag/rfp.rss');
});
