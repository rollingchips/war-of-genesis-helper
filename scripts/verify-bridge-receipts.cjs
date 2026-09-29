const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {unzipSync,strFromU8}=require('fflate');
function setup(){
 const source=strFromU8(unzipSync(fs.readFileSync('LiveSync_1Click.zip'))['livesync_bridge.js']);
 const part=source.slice(source.indexOf('const evalQueue = [];'),source.indexOf('// ── Steam Community Market Query Engine'));
 let now=0,tick=null;const files=new Map(),sent=[],immediate=[];
 const ctx={crypto:{randomBytes:()=>Buffer.from('session')},Date:{now:()=>now},getCandidateDirs:()=>['/game'],path:require('node:path'),
 fs:{writeFileSync:(p,s)=>files.set(p,s),existsSync:p=>files.has(p),readFileSync:p=>files.get(p),unlinkSync:p=>files.delete(p)},
 wsSend:(socket,s)=>sent.push({socket,data:JSON.parse(s)}),buildCdpResponse:(id,data)=>JSON.stringify({id,data}),
 setInterval:f=>{tick=f;return 1},clearInterval:()=>{tick=null},setImmediate:f=>immediate.push(f)};
 vm.createContext(ctx);vm.runInContext(part,ctx);
 return {send:(id=1)=>ctx.enqueueEvalCommand(id,'test',{}),advance:ms=>{now+=ms;tick?.();},reply:(result,id)=>files.set('/game/eval_result.json',JSON.stringify({id:id??JSON.parse(files.get('/game/pending_eval.json')).id,...result})),flush:()=>{while(immediate.length)immediate.shift()();},files,sent};
}
test('delayed hook receipt after old 2.5-second cutoff keeps original browser ID',()=>{const f=setup();f.send(123);f.advance(3000);assert.equal(f.sent.length,0);f.reply({result:'{"action":"fuse","requestId":"jewel-a","success":true}'});f.advance(20);assert.equal(f.sent[0].data.id,123);assert.equal(JSON.parse(f.sent[0].data.data).requestId,'jewel-a');});
test('unmatched stale IPC receipt cannot settle an action',()=>{const f=setup();f.send();f.reply({result:'old'},'old-id');f.advance(20);assert.equal(f.sent.length,0);f.reply({result:'matching'});f.advance(20);assert.equal(f.sent[0].data.data,'matching');});
test('deadline pauses queue and keeps uncertain command without profile fallback',()=>{const f=setup();f.send();f.send(2);f.advance(12000);assert.equal(f.sent.length,2);assert(f.sent.every(x=>x.data.data.uncertain));const pending=f.files.get('/game/pending_eval.json');assert(pending);f.send(3);f.flush();assert.equal(f.files.get('/game/pending_eval.json'),pending);assert.equal(f.sent.length,3);});
test('hook error is explicit uncertainty, not a profile pretending to be receipt',()=>{const f=setup();f.send();f.reply({error:'failed'});f.advance(20);assert.equal(f.sent[0].data.data.code,'WORKSHOP_TRANSPORT_UNCERTAIN');f.send(2);assert.equal(f.sent.length,2);});
test('expired queued action never executes and repeated browser IDs get unique IPC IDs',()=>{const f=setup();f.send(1);const first=JSON.parse(f.files.get('/game/pending_eval.json')).id;f.reply({result:'ok'});f.advance(20);f.send(1);const second=JSON.parse(f.files.get('/game/pending_eval.json')).id;assert.notEqual(first,second);f.send(2);f.advance(3000);f.reply({result:'ok'});f.advance(20);f.flush();assert.equal(f.sent.at(-1).data.data.uncertain,true);assert.equal(JSON.parse(f.files.get('/game/pending_eval.json')).id,second);});
