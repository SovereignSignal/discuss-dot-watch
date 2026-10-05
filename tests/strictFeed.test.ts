import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchStrictFeed,parseFeed,assertXmlBudget} from '../src/lib/strictFeed';
const base='https://forum.example.org';
const rss=(body='')=>'<?xml version="1.0"?><rss version="2.0"><channel>'+body+'</channel></rss>';
const item='<item><title>Paid &amp; open</title><link>https://forum.example.org/t/role/42</link><description><![CDATA[<p>We are hiring a contractor.</p>]]></description><pubDate>2026-10-04T00:00:00Z</pubDate></item>';
test('valid empty RSS differs from HTML, malformed XML and invalid-only items',()=>{
  assert.deepEqual(parseFeed(rss(),base),{items:[],invalidItems:0});
  for(const body of ['<html><body>blocked</body></html>','<rss><channel></rss>',rss('<item><title>Missing link</title></item>'),'<?xml version="1.0"?><rss><channel><item></channel></item></rss>'])assert.throws(()=>parseFeed(body,base));
});
test('RSS entities, first-post HTML, native identities and original dates survive parsing',()=>{
  const out=parseFeed(rss(item),base);assert.equal(out.items[0].title,'Paid & open');assert.equal(out.items[0].body,'We are hiring a contractor.');assert.equal(out.items[0].publishedAt,'2026-10-04T00:00:00.000Z');
});
test('Atom alternate links and content work without inventing creation dates',()=>{
  const out=parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Research contract</title><link href="/jobs/42"/><updated>2026-10-04T12:00:00Z</updated><content type="html">&lt;p&gt;Paid research&lt;/p&gt;</content></entry></feed>',base);
  assert.equal(out.items[0].url,base+'/jobs/42');assert.equal(out.items[0].publishedAt,null);assert.equal(out.items[0].body,'Paid research');
});
test('DTD and extreme nesting are rejected before parser recursion',()=>{
  assert.throws(()=>assertXmlBudget('<!DOCTYPE rss SYSTEM "file:///etc/passwd">'+rss()),/forbidden/);
  assert.throws(()=>assertXmlBudget('<x>'.repeat(65)+'</x>'.repeat(65)),/structure/);
  assert.doesNotThrow(()=>assertXmlBudget(rss('<item><description><![CDATA[Example <!DOCTYPE html>]]></description></item>')));
});
test('HTTP, parse and empty outcomes retain truthful evidence',async()=>{
  const empty=await fetchStrictFeed(base,async()=>new Response(rss()));assert.equal(empty.status,'empty');assert.equal(empty.httpStatus,200);
  const blocked=await fetchStrictFeed(base,async()=>new Response('<html/>'));assert.equal(blocked.status,'failed');assert.equal(blocked.errorCode,'not_rss_or_atom');
  const failed=await fetchStrictFeed(base,async()=>new Response('',{status:429,headers:{'retry-after':'120'}}));assert.equal(failed.status,'failed');assert.equal(failed.retrySeconds,120);
});
