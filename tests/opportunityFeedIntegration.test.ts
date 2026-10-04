import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {getDb,initializeSchema} from '../src/lib/db';
import {queryOpportunityFeed} from '../src/lib/opportunityFeed';
import {getUnnotifiedItems} from '../src/lib/grantsStore';
const testUrl = process.env.CORPUS_TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
after(async () => {if(testUrl) await getDb().end({timeout:5});});
test('PostgreSQL opportunity query, full paging and fit-ranked brief selection', {skip:!testUrl}, async () => {
  await initializeSchema();
  const db = getDb();
  const samples = [
    {ref:'fit-test-compiler',title:'Compiler engineer',kind:'full_time',body:'A full-time compiler engineering role.'},
    {ref:'fit-test-ops',title:'Hiring Senior AI & Automation Operations Lead',kind:'other',body:'Lead practical AI implementation and business workflows.'},
    {ref:'fit-test-seeker',title:'I want to learn N8N and need internship under a mentor',kind:'internship',body:'I am looking for training.'},
    {ref:'fit-test-contract',title:'Contract implementer (remote, 1099)',kind:'contract',body:'Paid contract implementation.'},
    {ref:'fit-test-inference',title:'Automation builder, paid test to ongoing',kind:'full_time',body:'A paid test followed by ongoing work.'},
  ];
  for (const s of samples) await db`
    INSERT INTO grants_items(topic_ref_id,protocol,vertical,title,url,classification,kind,confidence,status,first_post_text,topic_created_at,first_seen_at)
    VALUES(${s.ref},'Fit integration fixture','oss',${s.title},${'https://example.org/' + s.ref},'ROLE',${s.kind},90,'open',${s.body},NOW(),NOW())
  `;
  const large = await queryOpportunityFeed({limit:100,sort:'recent',wire:'oss'});
  assert.equal(large.items.length,4);
  assert.equal(large.items.some(i => i.refId === 'fit-test-seeker'),false);
  assert.equal(large.items.find(i => i.refId === 'fit-test-inference')?.engagement,'other');
  const paged:number[] = []; let cursor:number|undefined;
  do {
    const part = await queryOpportunityFeed({limit:1,sort:'recent',wire:'oss',cursor});
    paged.push(...part.items.map(i => i.id));
    cursor = part.meta.nextCursor ?? undefined;
  } while(cursor !== undefined);
  assert.deepEqual(paged,large.items.map(i => i.id));
  const fit = await queryOpportunityFeed({limit:100,sort:'fit',wire:'oss'});
  assert.equal(fit.items[0].refId,'fit-test-ops');
  const brief = await getUnnotifiedItems('ROLE',60,2);
  assert.equal(brief[0].topic_ref_id,'fit-test-ops');
  assert.equal(brief.some(i => i.topic_ref_id === 'fit-test-seeker'),false);
  const untouched = await db`SELECT count(*)::int n FROM grants_items WHERE protocol='Fit integration fixture' AND notified_at IS NOT NULL`;
  assert.equal(untouched[0].n,0);
  console.log('OPPORTUNITY_INTEGRATION_PROOF ' + JSON.stringify({pagingComplete:true,storedSeekerExcluded:true,unsupportedKindCleared:true,fitIndependent:true,briefRanksBeforeCap:true,notificationsSent:0}));
});
