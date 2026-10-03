import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeDirectoryItems } from '../src/lib/delegates/contributorDedupe';
import type { DirectoryItem } from '../src/types/delegates';

function item(username: string, postCount: number): DirectoryItem {
  return {
    username,
    name: username,
    avatarTemplate: '',
    postCount,
    topicCount: 0,
    likesReceived: 0,
    likesGiven: 0,
    daysVisited: 0,
    postsRead: 0,
    topicsEntered: 0,
  };
}

test('dedupeDirectoryItems removes pagination duplicates and keeps newest data', () => {
  const result = dedupeDirectoryItems([
    item('alice', 10),
    item('bob', 5),
    item('alice', 11),
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(x => x.username), ['alice', 'bob']);
  assert.equal(result.find(x => x.username === 'alice')?.postCount, 11);
});
