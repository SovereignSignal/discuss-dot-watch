import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreOpportunityFit, isJobSeekerTitle } from '../src/lib/opportunityFit';
import { buildOpportunityPage, eligibleOpportunity, parseOpportunityQuery } from '../src/lib/opportunityFeed';
import { selectBriefRoles } from '../src/lib/briefRoleSelection';
import { correctRoleClassification } from '../src/lib/grantsClassifier';
import type { GrantsItemRow, BriefItemRow } from '../src/lib/grantsStore';
const now = Date.parse('2026-10-04T15:00:00Z');
function row(id:number, extra:Partial<GrantsItemRow> = {}):GrantsItemRow {
  return {id,topic_ref_id:'test-' + id,forum_url:'https://example.org',protocol:'Test',vertical:'oss',
    title:'Position ' + id,url:'https://example.org/t/' + id,signal:null,classification:'ROLE',kind:'other',confidence:90,
    program:null,amount_min:null,amount_max:null,currency:null,deadline:null,chain:null,status:'open',apply_url:null,
    replies:0,views:0,likes:0,topic_created_at:new Date('2026-10-01T12:00:00Z'),last_activity_at:null,
    first_seen_at:new Date('2026-10-03T12:00:00Z'),updated_at:new Date('2026-10-03T12:00:00Z'),model:'fixture',...extra};
}
const q = {limit:2,sort:'recent' as const};
test('fit values are separate from confidence and keep different work sizes eligible', () => {
  const ops = scoreOpportunityFit({title:'Hiring Senior AI & Automation Operations Lead'});
  const compiler = scoreOpportunityFit({title:'Cisco Software Engineer Compiler II (Full Time)'});
  assert.ok(ops.score > compiler.score);
  assert.ok(ops.reasons.length >= 2);
  for (const title of ['Fractional COO','Full-time Operations Manager','Consulting engagement: AI implementation','Small workflow automation contract']) {
    assert.ok(scoreOpportunityFit({title}).score >= 20,title);
  }
});
test('title evidence outweighs incidental body keywords', () => {
  assert.ok(scoreOpportunityFit({title:'Operations lead'}).score > scoreOpportunityFit({title:'Compiler engineer',first_post_text:'Our team includes operations and AI implementation colleagues.'}).score);
});
test('job seekers are excluded without excluding first-person employers', () => {
  assert.equal(isJobSeekerTitle('I want to learn N8N and need internship under a mentor'),true);
  assert.equal(isJobSeekerTitle('I need an automation consultant for my company'),false);
  assert.equal(isJobSeekerTitle('I am hiring a program manager'),false);
  assert.equal(isJobSeekerTitle('Looking for an n8n freelancer'),false);
  assert.equal(correctRoleClassification('I am hiring a full-time operations lead','','ROLE','full_time').classification,'ROLE');
});
test('quality rules apply to already stored seeker and appointment rows', () => {
  assert.equal(eligibleOpportunity(row(1,{title:'I want to learn N8N and need internship under a mentor',kind:'internship'}),now),null);
  assert.equal(eligibleOpportunity(row(2,{title:'Self-nomination for community council'}),now),null);
  assert.equal(eligibleOpportunity(row(3,{title:'Someone has joined our organization'}),now),null);
});
test('existing unsupported full-time label is cleared on read', () => {
  const item = eligibleOpportunity(row(1,{title:'[HIRING] n8n + Looker Studio builder | Paid test to ongoing',kind:'full_time'}),now);
  assert.ok(item); assert.equal(item.kind,null); assert.equal(item.confidence,90);
});
test('pagination uses the last returned ID, not the last prefetched ID', () => {
  const rows = Array.from({length:100},(_,i) => row(100-i));
  const first = buildOpportunityPage(rows,q,now);
  assert.deepEqual(first.items.map(i => i.id),[100,99]);
  assert.equal(first.meta.nextCursor,99);
  const second = buildOpportunityPage(rows.filter(r => r.id < first.meta.nextCursor!),q,now);
  assert.deepEqual(second.items.map(i => i.id),[98,97]);
});
test('no valid rows are lost across recent-mode pages', () => {
  const rows = Array.from({length:80},(_,i) => row(80-i,{status:i%4 === 0 ? 'closed' : 'open'}));
  const seen:number[] = []; let cursor:number|undefined;
  do {
    const page = buildOpportunityPage(rows.filter(r => cursor === undefined || r.id < cursor),{...q,limit:7},now);
    seen.push(...page.items.map(i => i.id)); cursor = page.meta.nextCursor ?? undefined;
  } while (cursor !== undefined);
  assert.deepEqual(seen,rows.filter(r => r.status === 'open').map(r => r.id));
});
test('kind filtering occurs before the page cap', () => {
  const rows = [row(5),row(4),row(3,{title:'Full-time operations manager',kind:'full_time'}),row(2,{title:'Full-time delivery lead',kind:'full_time'})];
  assert.equal(buildOpportunityPage(rows,{...q,kind:'full_time'},now).items.length,2);
});
test('invalid cursor, limit, filters and ranked cursor are rejected', () => {
  for (const query of ['cursor=invalid','cursor=-1','cursor=1abc','cursor=90071992547409999','limit=0','limit=NaN','wire=unknown','kind=oops','sort=oops','sort=fit&cursor=12']) {
    assert.throws(() => parseOpportunityQuery(new URLSearchParams(query)),/Invalid|shortlist/,query);
  }
});
test('calendar deadline is inclusive and stale unbounded roles are excluded', () => {
  assert.ok(eligibleOpportunity(row(1,{deadline:new Date('2026-10-04T00:00:00Z')}),now));
  assert.equal(eligibleOpportunity(row(2,{deadline:new Date('2026-10-03T00:00:00Z')}),now),null);
  assert.equal(eligibleOpportunity(row(3,{topic_created_at:new Date('2024-01-01')}),now),null);
});
test('ranked API retains specialist rows and publishes bounds', () => {
  const result = buildOpportunityPage([row(3,{title:'Compiler engineer'}),row(2,{title:'Operations and AI automation consultant'}),row(1)],{limit:100,sort:'fit'},now);
  assert.equal(result.items[0].id,2);
  assert.equal(result.items.length,3);
  assert.equal(result.meta.fitIsConfidence,false);
  assert.equal(result.meta.candidateLimit,500);
});
test('private brief ranks before capping and retains urgent deadlines', () => {
  const candidates:BriefItemRow[] = [row(20,{title:'Compiler engineer'}),row(19,{title:'Operations and AI implementation consultant'}),row(18,{title:'Urgent paid assignment',deadline:new Date(now+86400000)})];
  assert.deepEqual(selectBriefRoles(candidates,2,now).map(r => r.id),[18,19]);
});
