import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Readable} from 'node:stream';
import {Connection, PublicKey} from '@solana/web3.js';
import {GovernanceAccountParser, Proposal, ProposalState} from '@solana/spl-governance';
const require = createRequire(import.meta.url);
// Fixed ProposalV1 wire layout, independent of the SDK serializer.
function fixture() {
  const n64=(n:bigint)=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(n);return b;};
  const str=(s:string)=>{const b=Buffer.from(s);const n=Buffer.alloc(4);n.writeUInt32LE(b.length);return Buffer.concat([n,b]);};
  return Buffer.concat([
    Buffer.from([5]),Buffer.alloc(32,1),Buffer.alloc(32,2),Buffer.from([2]),Buffer.alloc(32,3),Buffer.from([1,1]),
    n64(12345678901234n),n64(30n),Buffer.alloc(6),n64(1780000000n),
    Buffer.from([0]),Buffer.from([1]),n64(1780000100n),Buffer.from([0,0,0,0]),
    Buffer.from([0,0,0]),str('Read-only governance fixture'),str('https://example.org/proposal'),
  ]);
}
test('Solana RPC request IDs, account bytes and governance decoding survive dependency changes',async()=>{
  const owner=new PublicKey(Buffer.alloc(32,4)), address=new PublicKey(Buffer.alloc(32,5));
  const ids=new Set<string>();
  const connection=new Connection('https://rpc.example.org',{
    commitment:'confirmed',disableRetryOnRateLimit:true,
    fetch:async(_url,init)=>{
      const req=JSON.parse(String(init?.body)) as {id:string;method:string;params:unknown[]};
      assert.equal(req.method,'getProgramAccounts');
      assert.match(req.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.ok(!ids.has(req.id));ids.add(req.id);assert.equal(req.params[0],owner.toBase58());
      return new Response(JSON.stringify({jsonrpc:'2.0',id:req.id,result:[{pubkey:address.toBase58(),account:{owner:owner.toBase58(),data:[fixture().toString('base64'),'base64'],lamports:1,executable:false,rentEpoch:0}}]}),{status:200});
    },
  });
  for(let i=0;i<3;i++){
    const rows=await connection.getProgramAccounts(owner,{filters:[{memcmp:{offset:1,bytes:new PublicKey(Buffer.alloc(32,1)).toBase58()}}]});
    assert.equal(rows.length,1);
    const parsed=GovernanceAccountParser(Proposal)(rows[0].pubkey,rows[0].account).account;
    assert.equal(parsed.name,'Read-only governance fixture');assert.equal(parsed.state,ProposalState.Voting);
    assert.equal(parsed.getYesVoteCount().toString(),'12345678901234');assert.equal(parsed.getNoVoteCount().toString(),'30');
    assert.equal(parsed.votingAt?.toString(),'1780000100');assert.equal(parsed.descriptionLink,'https://example.org/proposal');
  }
  assert.equal(ids.size,3);
});
test('Jayson streaming API parses fragmented newline-delimited JSON',async()=>{
  const utils=require('jayson/lib/utils') as {parseStream(s:Readable,opts:object,cb:(error:Error|null,value:unknown)=>void):void};
  const values:unknown[]=[];
  const stream=Readable.from(['{"jsonrpc":"2.0",','"id":1,"result":[1,2]}\n','{"jsonrpc":"2.0","id":2,"result":null}\n']);
  await new Promise<void>((resolve,reject)=>{
    utils.parseStream(stream,{},(error,value)=>{if(error)reject(error);else{values.push(value);if(values.length===2)resolve();}});
  });
  assert.deepEqual(values,[{jsonrpc:'2.0',id:1,result:[1,2]},{jsonrpc:'2.0',id:2,result:null}]);
});
