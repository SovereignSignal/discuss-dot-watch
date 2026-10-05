import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceChoices} from '../src/lib/evidenceChoices';
import {validateCorpusExtraction} from '../src/lib/corpusClassifier';
const body='We build workflow systems. Competitive compensation 💸 – We offer fair and attractive pay. Through this form you can request financial support for your project.';
const base={relevant:true,kind:'paid_work',availability:'open',engagement:null,paidEvidence:true,confidence:90,evidence:'Competitive compensation 💸 – We offer fair and attractive pay.',deadline:null,applicationUrl:null};
const input={title:'Program and paid work',body,tags:[],createdAt:new Date().toISOString(),closed:false,lane:'opportunities' as const};
test('evidence choices are bounded literal source quotations',()=>{
 const choices=evidenceChoices(body);assert.ok(choices.length>0);assert.ok(choices.length<=16);
 for(const choice of choices){assert.ok(body.includes(choice));assert.ok(choice.length<=280);}
 assert.ok(choices.includes(base.evidence));
});
test('copied source evidence remains accepted while rewritten text fails closed',()=>{
 assert.equal(validateCorpusExtraction(base,input).actionable,true);
 assert.equal(validateCorpusExtraction({...base,evidence:'We offer $500,000 salary and compensation.'},input).actionable,false);
});
test('a funder application call differs from an applicant submission',()=>{
 const evidence='Through this form you can request financial support for your project.';
 const call=validateCorpusExtraction({...base,kind:'open_call',paidEvidence:false,evidence},{...input,lane:'funding'});
 assert.equal(call.actionable,true);
 assert.equal(validateCorpusExtraction({...base,kind:'application',paidEvidence:false,evidence},{...input,lane:'funding'}).actionable,false);
});
test('long source sentences remain bounded and unaltered',()=>{
 const source='prefix '.repeat(200)+'hiring a paid consultant '+ 'detail '.repeat(200);
 for(const choice of evidenceChoices(source)){assert.ok(source.includes(choice));assert.ok(choice.length<=280);}
});
