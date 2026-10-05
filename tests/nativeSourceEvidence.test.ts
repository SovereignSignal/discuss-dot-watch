import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBoard} from '../src/lib/sourceAdapters';
import {parseFeed} from '../src/lib/strictFeed';
import {sourceText} from '../src/lib/sourceBodyText';

test('Greenhouse encoded HTML becomes readable source evidence and keeps application URLs',()=>{
  const parsed=parseBoard('greenhouse',{jobs:[{id:42,title:'Operations lead',absolute_url:'https://example.org/job/42',first_published:'2026-08-06T12:50:10-04:00',updated_at:'2026-09-24T13:34:54-04:00',content:'&lt;div&gt;&lt;p&gt;We are hiring a paid operations lead.&lt;/p&gt;&lt;a href=&quot;https://example.org/apply?x=1&amp;y=2&quot;&gt;Apply here&lt;/a&gt;&lt;script&gt;bad()&lt;/script&gt;&lt;/div&gt;'}]},'https://boards-api.greenhouse.io/v1/boards/example/jobs');
  const item=parsed.items[0];
  assert.ok(item.body.includes('We are hiring a paid operations lead.'));
  assert.ok(item.body.includes('https://example.org/apply?x=1&y=2'));
  assert.ok(!item.body.includes('<div>'));assert.ok(!item.body.includes('bad()'));
  assert.equal(item.createdAt,'2026-08-06T16:50:10.000Z');
  assert.equal(item.updatedAt,'2026-09-24T17:34:54.000Z');
});
test('channel build dates never substitute for absent per-item publication dates',()=>{
  const parsed=parseFeed('<rss><channel><lastBuildDate>Mon, 05 Oct 2026 02:26:21 +0000</lastBuildDate><item><title>Python job</title><link>https://example.org/job/42</link><description>&lt;p&gt;Paid work&lt;/p&gt;</description></item></channel></rss>','https://example.org');
  assert.equal(parsed.items[0].publishedAt,null);assert.equal(parsed.items[0].updatedAt,null);
  assert.equal(parsed.items[0].body,'Paid work');
});
test('ordinary HTML application links retain existing behavior',()=>{
  assert.ok(sourceText('<p>Paid contract</p><a href="https://example.org/apply">Apply</a>').includes('https://example.org/apply'));
  assert.equal(sourceText('Plain source text'),'Plain source text');
});
