import test from 'node:test';
import assert from 'node:assert/strict';
import {roleContentExclusion,sourceFreshness,isImminentDeadline} from '../src/lib/opportunityEligibility';
import {compareFit} from '../src/lib/opportunityFit';
import {selectBriefRoles} from '../src/lib/briefRoleSelection';
import type {BriefItemRow} from '../src/lib/grantsStore';
const now=Date.parse('2026-10-04T17:00:00Z');

test('election discussion is not an application opportunity regardless of deadline',()=>{
  assert.equal(roleContentExclusion('2026 OSMF Board election - Discussion on candidates’ answers and manifestos is open until 2026-10-10 16:00 UTC'),'election_discussion');
  assert.equal(roleContentExclusion('How Should We Choose Intersect Board Representatives?'),'election_discussion');
  assert.equal(roleContentExclusion('2026-08 IMC Members Selection','We will be selecting 7 IMC members out of a pool of 7 nominees.'),'election_discussion');
});
test('candidate biographies are excluded even with generic titles',()=>{
  assert.equal(roleContentExclusion('Ubuntu Community Council 2026–2028','This is my self-nomination for the Ubuntu Community Council.'),'candidate_statement');
  assert.equal(roleContentExclusion('Nathan Haines for Ubuntu Community Council 2026'),'candidate_statement');
  assert.equal(roleContentExclusion('Alan Pope (popey) for CommunityCouncil 2026'),'candidate_statement');
  assert.equal(roleContentExclusion('Council candidacy','I’m nominating myself for re-election to the Ubuntu Community Council.'),'candidate_statement');
  assert.equal(roleContentExclusion('PSF board nomination: AMA with Ben Manning'),'candidate_statement');
});
test('genuine nomination and paid-work calls remain eligible',()=>{
  for(const title of ['Call for nominations: Ubuntu Community Council 2026','Applications open for paid council positions','I am hiring an operations lead','Hiring an election coordinator','Contract implementer (remote, 1099)']) assert.equal(roleContentExclusion(title),null,title);
  assert.equal(roleContentExclusion('Protocol security in 2026','We are hiring a dedicated security engineer.'),null);
  assert.equal(roleContentExclusion('AMA with GiveWell’s Chief Operations Officer','We have roles open across multiple Ops functions and hope to make multiple hires.'),null);
});
test('free application and volunteer context are not confused with unpaid roles',()=>{
  assert.equal(roleContentExclusion('Unpaid internship in AI'),'explicitly_unpaid');
  assert.equal(roleContentExclusion('Research internship','This internship is unpaid.'),'explicitly_unpaid');
  assert.equal(roleContentExclusion('Paid fellowship','Free to apply, annual stipend $125,000.'),null);
  assert.equal(roleContentExclusion('Hiring automation specialist','We are NOT asking anyone to work for free. Compensation will be agreed before work begins.'),null);
  assert.equal(roleContentExclusion('Paid volunteer coordinator','Help organize our volunteers.'),null);
});
test('current source age is not proof that applications remain open',()=>{
  assert.deepEqual(sourceFreshness('2026-10-03',now),{state:'recent_source',ageDays:1,availabilityVerified:false,sourceCheckRequired:true});
  assert.equal(sourceFreshness('2026-07-20',now).state,'older_source');
  assert.equal(sourceFreshness(null,now).state,'date_unknown');
  assert.equal(sourceFreshness('nonsense',now).state,'date_unknown');
  assert.equal(sourceFreshness('2027-01-01',now).state,'date_unknown');
});
test('today remains urgent until its UTC date ends',()=>{
  assert.equal(isImminentDeadline(new Date('2026-10-04'),now),true);
  assert.equal(isImminentDeadline(new Date('2026-10-03'),now),false);
  assert.equal(isImminentDeadline(new Date('2026-10-12'),now),false);
  const today={id:1,title:'Salesforce architect',deadline:new Date('2026-10-04')};
  const nextWeek={id:2,title:'Hiring AI and operations lead',deadline:new Date('2026-10-12')};
  assert.ok(compareFit(today,nextWeek,now)<0);
});
test('private brief excludes a body-only candidate before the cap',()=>{
  const row=(id:number,title:string,body:string):BriefItemRow=>({id,title,first_post_text:body,topic_ref_id:'test-'+id,protocol:'Test',vertical:'oss',url:'https://example.org',kind:'other',confidence:90,program:null,amount_min:null,amount_max:null,currency:null,deadline:null,topic_created_at:new Date(now),first_seen_at:new Date(now)});
  const result=selectBriefRoles([row(1,'Ubuntu Community Council 2026–2028','This is my self-nomination for the Ubuntu Community Council.'),row(2,'Hiring AI & Operations Lead','Paid contract with flexible hours.')],1,now);
  assert.deepEqual(result.map(x=>x.id),[2]);
});
