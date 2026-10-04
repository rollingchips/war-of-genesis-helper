const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {unzipSync,strFromU8}=require('fflate');
function setup(){
 const source=strFromU8(Object.fromEntries(['cai_dat_livesync.bat','install_game_hook_v2.js','livesync_bridge.js'].map(name=>[name,fs.readFileSync(name)]))['livesync_bridge.js']);
 const part=source.slice(source.indexOf('const evalQueue = [];'),source.indexOf('// ── Steam Community Market Query Engine'));
 let now=0,tick=null;const files=new Map(),sent=[],immediate=[];
 const ctx={crypto:{randomBytes:()=>Buffer.from('session')},Date:{now:()=>now},getCandidateDirs:()=>['/game'],path:require('node:path'),
 fs:{writeFileSync:(p,s)=>files.set(p,s),existsSync:p=>files.has(p),readFileSync:p=>files.get(p),unlinkSync:p=>files.delete(p)},
 wsSend:(socket,s)=>sent.push({socket,data:JSON.parse(s)}),buildCdpResponse:(id,data)=>JSON.stringify({id,data}),
 setInterval:f=>{tick=f;return 1},clearInterval:()=>{tick=null},setImmediate:f=>immediate.push(f)};
 vm.createContext(ctx);vm.runInContext(part,ctx);
 return {send:(id=1,code='test')=>ctx.enqueueEvalCommand(id,code,{}),get now(){return now},advance:ms=>{now+=ms;tick?.();},reply:(result,id)=>files.set('/game/eval_result.json',JSON.stringify({id:id??JSON.parse(files.get('/game/pending_eval.json')).id,...result})),flush:()=>{while(immediate.length)immediate.shift()();},files,sent};
}
test('delayed hook receipt after old 2.5-second cutoff keeps original browser ID',()=>{const f=setup();f.send(123);f.advance(3000);assert.equal(f.sent.length,0);f.reply({result:'{"action":"fuse","requestId":"jewel-a","success":true}'});f.advance(20);assert.equal(f.sent[0].data.id,123);assert.equal(JSON.parse(f.sent[0].data.data).requestId,'jewel-a');});
test('unmatched stale IPC receipt cannot settle an action',()=>{const f=setup();f.send();f.reply({result:'old'},'old-id');f.advance(20);assert.equal(f.sent.length,0);f.reply({result:'matching'});f.advance(20);assert.equal(f.sent[0].data.data,'matching');});
test('deadline pauses queue and keeps uncertain command without profile fallback',()=>{const f=setup();f.send();f.send(2);f.advance(12000);assert.equal(f.sent.length,2);assert(f.sent.every(x=>x.data.data.uncertain));const pending=f.files.get('/game/pending_eval.json');assert(pending);f.send(3);f.flush();assert.equal(f.files.get('/game/pending_eval.json'),pending);assert.equal(f.sent.length,3);});
test('hook error is explicit uncertainty, not a profile pretending to be receipt',()=>{const f=setup();f.send();f.reply({error:'failed'});f.advance(20);assert.equal(f.sent[0].data.data.code,'WORKSHOP_TRANSPORT_UNCERTAIN');f.send(2);assert.equal(f.sent.length,2);});
test('expired queued action never executes and repeated browser IDs get unique IPC IDs',()=>{const f=setup();f.send(1);const first=JSON.parse(f.files.get('/game/pending_eval.json')).id;f.reply({result:'ok'});f.advance(20);f.send(1);const second=JSON.parse(f.files.get('/game/pending_eval.json')).id;assert.notEqual(first,second);f.send(2);f.advance(3000);f.reply({result:'ok'});f.advance(20);f.flush();assert.equal(f.sent.at(-1).data.data.uncertain,true);assert.equal(JSON.parse(f.files.get('/game/pending_eval.json')).id,second);});

function autoCode(f,id,extra={}){return '(async () => { return await globalThis.__runJewelAction('+JSON.stringify({action:'fuseGearTiers',automaticRound:true,requestId:'round-'+id,expiresAt:f.now+15000,...extra})+'); } else {})()'}
test('automatic fusion timeout cools down then admits a fresh round; stale IPC replies ignored',()=>{
 const f=setup();f.send(1,autoCode(f,1));const old=JSON.parse(f.files.get('/game/pending_eval.json')).id;
 f.send(2,autoCode(f,2));f.advance(12000);assert.equal(f.sent.length,2);assert(f.sent.every(x=>x.data.data.retryable));assert.equal(f.sent[0].data.data.requestId,'round-1');
 f.send(3,autoCode(f,3));assert.equal(f.sent.at(-1).data.data.retryable,true);assert.equal(JSON.parse(f.files.get('/game/pending_eval.json')).id,old);
 f.advance(60000);f.send(4,autoCode(f,4));const next=JSON.parse(f.files.get('/game/pending_eval.json')).id;assert.notEqual(old,next);
 const count=f.sent.length;f.reply({result:'old'},old);f.advance(20);assert.equal(f.sent.length,count);
 f.reply({result:'new'},next);f.advance(20);assert.equal(f.sent.at(-1).data.data,'new');
});
test('expired automatic commands never write pending IPC and do not permanently block',()=>{
 const f=setup();f.send(1,autoCode(f,1,{expiresAt:0}));assert.equal(f.files.size,0);assert.equal(f.sent[0].data.data.retryable,true);
 f.advance(60000);f.send(2,autoCode(f,2));assert(f.files.has('/game/pending_eval.json'));
});
test('automatic null/error replies are recoverable; manual commands retain original interlock',()=>{
 for(const result of [{result:null},{error:'failed'}]){const f=setup();f.send(1,autoCode(f,1));f.reply(result);f.advance(20);assert.equal(f.sent[0].data.data.retryable,true);f.advance(60000);f.send(2,autoCode(f,2));assert.equal(f.sent.length,1);}
 const g=setup();g.send(1,autoCode(g,1,{automaticRound:false}));g.advance(12000);assert.equal(g.sent[0].data.data.uncertain,true);
});
