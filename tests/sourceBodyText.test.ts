import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeed} from '../src/lib/strictFeed';
import {sourceText} from '../src/lib/sourceBodyText';
test('RSS application URLs remain usable after HTML sanitization',()=>{
 const parsed=parseFeed('<rss><channel><item><title>Paid work</title><link>https://example.org/t/work/42</link><description><![CDATA[<p>We are hiring. <a href="https://example.org/apply?x=1&amp;y=2">Apply here</a></p>]]></description></item></channel></rss>','https://example.org');
 assert.ok(parsed.items[0].body.includes('https://example.org/apply?x=1&y=2'));
 assert.ok(!parsed.items[0].body.includes('<a'));
});
test('source extraction leaves truncation accounting to the corpus writer',()=>{
 const body=sourceText('<p>'+ 'a'.repeat(80010)+'</p>');
 assert.equal(body.length,80010);
 assert.ok(!sourceText('<script>steal()</script><p>Good</p><a href="javascript:bad()">link</a>').includes('javascript:'));
});
