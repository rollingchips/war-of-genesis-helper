const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {chromium}=require('playwright');
const ui=fs.readFileSync('features/gear-fusion-ui.js','utf8');
function harness(){
 let now=1700000000000,seq=0;
 const timers=new Map(),nodes=new Map(),sent=[],faults=[];
 for(const id of ['gearFusionControls','autoGearFusion','autoJewelFusion','gearFusionStatus','jewelFusionStatus'])nodes.set(id,{checked:false,disabled:true,textContent:'',addEventListener(k,fn){this[k]=fn}});
 const ws={readyState:1,addEventListener(k,fn){this[k]=fn}};
 const c={Date:class extends Date{static now(){return now}},crypto:{randomUUID:()=>String(++seq)},console,
   document:{readyState:'complete',getElementById:id=>nodes.get(id)},liveWs:ws,isAutoFuseJewelActive:false,
   zhText:s=>s,updateJewelSwitches(){},wogWorkshopStatus(){},queueJewelCmd:cmd=>{sent.push(cmd);return true},
   setInterval(fn,ms){const id=++seq;timers.set(id,{fn,at:now+ms,ms});return id},
   setTimeout(fn,ms){const id=++seq;timers.set(id,{fn,at:now+ms});return id},clearTimeout(id){timers.delete(id)}};
 c.window=c;c.wogWorkshopReceipt=r=>{if(r.uncertain){faults.push(r);c.wogGearFusionPause(r.reason)}};
 vm.createContext(c);vm.runInContext(ui,c);
 const cap={version:2,bagOnlyRounds:1,jewelPreservation:1,gearSourceTiers:[1,2,3,4,5],available:true,busy:false,gameBusy:false,instance:'fixture',generatedAt:now,counts:{}};
 function refresh(){cap.generatedAt=now;c.wogGearFusionTick({gearFusion:cap})}refresh();
 function run(ms,healthy=true){const end=now+ms;while(true){let next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;const[id,t]=next;now=t.at;if(t.ms)t.at+=t.ms;else timers.delete(id);if(healthy)refresh();t.fn();}now=end;}
 function toggle(kind,on){const n=nodes.get(kind==='gear'?'autoGearFusion':'autoJewelFusion');n.checked=on;n.change({target:n})}
 function reply(fusedCount=0,extra={}){const cmd=sent.at(-1);c.wogGearFusionReply({action:cmd.action,requestId:cmd.requestId,success:true,fusedCount,...extra})}
 return {c,nodes,cap,sent,faults,run,toggle,refresh,reply,ws};
}
test('profiles never trigger commands; first round is due after 60s despite missing counts',()=>{
 const f=harness();f.toggle('gear',true);for(let n=0;n<100;n++)f.refresh();assert.equal(f.sent.length,0);
 f.run(59000);assert.equal(f.sent.length,0);f.run(1000);assert.equal(f.sent.length,1);assert.equal(f.sent[0].sourceTier,1);
 assert.equal(f.sent[0].includeStorage,false);assert.equal(f.sent[0].sameLevelOnly,false);
});
test('one round drains each grade then advances across gear/accessories and preserved jewel requests',()=>{
 const f=harness();f.toggle('gear',true);f.toggle('jewel',true);f.run(60000);
 f.reply(1);f.run(1000);f.reply(1);f.run(1000);
 assert.deepEqual(f.sent.slice(0,3).map(x=>[x.contentType,x.sourceTier]),[[1,1],[1,1],[1,1]]);
 for(let i=0;i<15;i++){f.reply(0);f.run(1000)}
 const jobs=f.sent.slice(2).map(x=>x.action==='fuse'?['jewel',x.tier]:[x.contentType,x.sourceTier]);
 assert.deepEqual(jobs,[[1,1],[1,2],[1,3],[1,4],[1,5],[2,1],[2,2],[2,3],[2,4],[2,5],['jewel',1],['jewel',2],['jewel',3],['jewel',4],['jewel',5]]);
 assert(f.sent.every(x=>x.includeStorage===false));assert.equal(f.c.wogFusionPending,null);
 const count=f.sent.length;f.run(42000);assert.equal(f.sent.length,count);f.run(1000);assert.equal(f.sent.length,count+1);
});
test('toggle off while pending stops following batches; reenable does not resume a cancelled round',()=>{
 const f=harness();f.toggle('gear',true);f.toggle('jewel',true);f.run(60000);
 f.toggle('gear',false);f.toggle('gear',true);f.reply(1);f.run(1000);
 assert.equal(f.sent.at(-1).action,'fuse');assert.equal(f.sent.filter(x=>x.action==='fuseGearTiers').length,1);
 f.toggle('jewel',false);f.reply(1);f.run(1000);assert.equal(f.sent.length,2);
});
test('wrong receipt cannot release a pending command; timeout pauses both categories with healthy profiles',()=>{
 const f=harness();f.toggle('gear',true);f.toggle('jewel',true);f.run(60000);
 f.c.wogGearFusionReply({action:'fuseGearTiers',requestId:'wrong',success:true,fusedCount:1});f.run(14000);assert.equal(f.sent.length,1);
 f.run(1000);assert.equal(f.faults.length,1);assert.equal(f.nodes.get('autoGearFusion').checked,false);assert.equal(f.nodes.get('autoJewelFusion').checked,false);
 f.run(120000);assert.equal(f.sent.length,1);
});
test('native busy and manual pending actions serialize the timer; busy receipt ends without a retry burst',()=>{
 const f=harness();f.toggle('gear',true);f.cap.busy=true;f.run(60000);assert.equal(f.sent.length,0);
 f.cap.busy=false;f.c.wogJewelPending='manual';f.run(1000);assert.equal(f.sent.length,0);
 f.c.wogJewelPending=null;f.run(1000);assert.equal(f.sent.length,1);
 f.reply(0,{code:'WORKSHOP_BUSY'});f.run(59000);assert.equal(f.sent.length,1);f.run(1000);assert.equal(f.sent.length,2);
});
test('old hooks, stale profiles and disconnect cannot dispatch; lost connection never re-enables switches',()=>{
 for(const change of [f=>delete f.cap.bagOnlyRounds,f=>f.cap.gearSourceTiers=[1,2,3,4]]){
  const f=harness();change(f);f.refresh();assert.equal(f.nodes.get('autoJewelFusion').disabled,true);f.toggle('jewel',true);f.run(60000);assert.equal(f.sent.length,0);
 }
 const f=harness();f.toggle('gear',true);f.run(60000,false);assert.equal(f.sent.length,0);assert.equal(f.nodes.get('autoGearFusion').checked,false);
 f.refresh();f.toggle('gear',true);f.ws.close();f.run(60000);assert.equal(f.sent.length,0);
});
test('long productive round has a finite budget and no catch-up queue',()=>{
 const f=harness();f.toggle('gear',true);f.run(60000);
 for(let i=0;i<301;i++){f.reply(1);f.run(1000)}
 assert.equal(f.sent.length,300);f.run(58000);assert.equal(f.sent.length,300);f.run(1000);assert.equal(f.sent.length,301);
});
test('transport refusal schedules no retry until next minute, unknown receipt stops instead of draining',()=>{
 const f=harness();let attempts=0;f.c.queueJewelCmd=()=>{attempts++;return false};f.toggle('gear',true);f.run(119000);assert.equal(attempts,1);f.run(1000);assert.equal(attempts,2);
 const x=harness();x.toggle('gear',true);x.run(60000);x.reply(undefined,{fusedCount:undefined});assert.equal(x.faults.length,1);x.run(60000);assert.equal(x.sent.length,1);
});
test('direct UI has two default-off fusion toggles; old storage/deposit settings cannot dispatch; preservation persists',async()=>{
 const server=require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync('index.html'))});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  await context.addInitScript(()=>{for(const k of ['auto_fuse_jewel','include_storage_jewel','auto_deposit_jewel','auto_deposit_t3'])localStorage.setItem('genesis_'+k,'true');localStorage.setItem('genesis_autofuse_allowed_tiers','[6,7]');window.WebSocket=class{static OPEN=1;constructor(){this.readyState=0}close(){}send(){throw Error('No game')}};});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(url);await page.evaluate(()=>switchMainTab('jewel'));
  assert.equal(await page.locator('#gearFusionControls [role=switch]').count(),2);
  assert.equal(await page.locator('#switchAutoFuse,#switchIncludeStorage,#switchAutoDeposit,#switchAutoDepositT3,#selAutoDepositJewelTargetStorage,#selAutoDepositT3TargetStorage,#jewelTierCheckboxGroup').count(),0);
  for(const id of ['autoGearFusion','autoJewelFusion']){assert.equal(await page.locator('#'+id).isChecked(),false);assert.equal(await page.locator('#'+id).isDisabled(),true)}
  assert.equal(await page.evaluate(()=>isIncludeStorageJewelActive||isAutoDepositJewelActive||isAutoDepositT3Active||isAutoFuseJewelActive),false);
  await page.locator('#jewelPreserveControls summary').click();const preserve=page.locator('#jewelPreserveOptions button').first(),base=Number(await preserve.getAttribute('data-tid'));await preserve.click();
  await page.evaluate(()=>{
    window.__sent=[];liveWs=new EventTarget();liveWs.readyState=1;liveWs.send=s=>{const m=JSON.parse(s);if(m.params?.expression?.startsWith('(async () => { if (typeof globalThis.__runJewelAction'))__sent.push(m)};
    const profile=()=>wogGearFusionTick({gearFusion:{version:2,jewelPreservation:1,bagOnlyRounds:1,gearSourceTiers:[1,2,3,4,5],instance:'test',available:true,generatedAt:Date.now(),counts:{}}});profile();setInterval(profile,500);
  });
  await page.locator('#autoJewelFusion').check();await page.clock.runFor(59000);assert.equal(await page.evaluate(()=>__sent.length),0);await page.clock.runFor(2000);
  const sent=await page.evaluate(()=>__sent);assert.equal(sent.length,1);assert(sent[0].params.expression.includes('"preservedTypes":['+base+']'));assert(sent[0].params.expression.includes('"includeStorage":false'));assert(sent[0].params.expression.includes('"tier":1'));
  // Changing preservation affects the next batch of this same round.
  const another=page.locator('#jewelPreserveOptions button').nth(7);const secondBase=Number(await another.getAttribute('data-tid'));await another.click();
  await page.evaluate(()=>{const r={action:'fuse',requestId:window.wogFusionPending,success:true,fusedCount:1};wogWorkshopReceipt(r);wogGearFusionReply(r);wogJewelPreservationReply(r);});
  await page.clock.runFor(2000);assert.equal(await page.evaluate(()=>__sent.length),2);
  const updated=await page.evaluate(()=>__sent.at(-1).params.expression);assert(updated.includes('"preservedTypes":['+base+','+secondBase+']'));assert(updated.includes('"automaticRound":true'));
  await page.locator('#autoJewelFusion').uncheck();await page.clock.runFor(16000);assert.equal(await page.evaluate(()=>__sent.length),2,'No command after toggle off, even on timeout');
  await page.locator('#gearFusionControls').locator('..').screenshot({path:'/var/tmp/wog-minute-'+width+'.png'});
  await page.reload();assert.equal(await page.evaluate(t=>isJewelPreserved({itemTid:t+1}),base),true);assert.equal(await page.locator('#autoJewelFusion').isChecked(),false);assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
});
