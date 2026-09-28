const {test,before,after} = require('node:test');
let server,testUrl;
before(async()=>{server=require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync('index.html'));});await new Promise(r=>server.listen(0,'127.0.0.1',r));testUrl='http://127.0.0.1:'+server.address().port;});
after(()=>new Promise(r=>server.close(r)));
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const {unzipSync, strFromU8} = require('fflate');
const {chromium} = require('playwright');
const {pathToFileURL} = require('node:url');
const engineSource = fs.readFileSync('features/gear-fusion-engine.js','utf8');
const factory = vm.runInNewContext('(' + engineSource + ')', {setTimeout,clearTimeout});
function setup({count=6,type=1,reply=1000,consume=true}={}) {
  let items = Array.from({length:count},(_,i)=>({itemId:i+1,itemTid:i+1,location:1,isLock:false}));
  const db = new Map(items.map(i=>[i.itemTid,{RatingType:4,LimitLevel:20}]));
  const equipped = new Set(), staged = new Set(); let calls=0, selected=[];
  const w={_bRequesting:false,setFusionContentType(){},setAutoRegisterRating(){},setAutoRegisterIncludeStorage(){},getTableInfo:()=>({contentType:type,baseLimitLevel:20}),findFusionTable:(t,r,l)=>t===type&&[1,2,3,4].includes(r)&&l===20?{FusionID:404,GroupID:3000,ContentType:t,MaterialRating:r,MaterialRatingCnt:t===1?6:3}:null,
    validateFusionMaterials:(_,ms)=>ms.length===(type===1?6:3),clearFusionStaging(){},reqFusionAsync:async(_,ms)=>{calls++;selected=ms;if(consume)items=items.filter(i=>!ms.some(m=>m.itemId===i.itemId));return {NetResult:reply,Data:{}};}};
  const n={services:{workshop:w,itemMove:{isEquippedItemId:id=>equipped.has(id)},steamMarket:{staging:{isStaged:id=>staged.has(id)}}},net:{data:{item:{getAllItemNotStack:()=>items}}},db:{equip:{get:id=>db.get(id)},fusion:{get:id=>id===404?w.findFusionTable(type,db.values().next().value.RatingType,20):null}},msgBroker:{publish(){}}};
  const engine=factory(()=>n,30);let seq=0;
  const command=extra=>({action:'fuseGearTiers',instance:engine.status().instance,requestId:'test-'+(++seq),contentType:type,sourceTier:4,sameLevelOnly:true,includeStorage:false,...extra});
  return {engine,n,w,db,equipped,staged,command,get items(){return items},set items(v){items=v},get calls(){return calls},get selected(){return selected}};
}
test('operator-confirmed quantities are fixed and still checked by the game validator',async()=>{
 for(const [type,count]of [[1,6],[2,3]]){const f=setup({type,count}),cmd=f.command();assert.equal((await f.engine.execute(cmd)).fusedCount,1);assert.equal(f.selected.length,count);assert.equal(f.calls,1);await f.engine.execute(cmd);assert.equal(f.calls,1);}
});
test('validator accepting undersized batches cannot change the fixed quantity',async()=>{
 const f=setup({count:5});f.w.validateFusionMaterials=()=>true;assert.equal((await f.engine.execute(f.command())).fusedCount,0);assert.equal(f.calls,0);
});
test('locked, equipped, staged, other tier, storage and unknown level never consumed',async()=>{
 for(const mutation of [f=>f.items[0].isLock=true,f=>f.items[0]._isLock=true,f=>delete f.items[0].isLock,f=>f.equipped.add(1),f=>f.staged.add(1),f=>f.db.get(1).RatingType=5,f=>f.items[0].location=2,f=>f.w.getTableInfo=()=>({contentType:1})]){
 const f=setup(); if(mutation.toString().includes('getTableInfo'))f.db.get(1).LimitLevel=undefined;
 mutation(f);assert.equal((await f.engine.execute(f.command())).fusedCount,0);assert.equal(f.calls,0);}
 const f=setup();f.items[0].location=2;assert.equal((await f.engine.execute(f.command({includeStorage:true}))).fusedCount,1);
});
test('retired same-level flag cannot restrict mixed levels; categories remain separate',async()=>{
 const f=setup();f.w.getTableInfo=(tid)=>({contentType:1,baseLimitLevel:tid===1?19:20});
 assert.equal((await f.engine.execute(f.command({contentType:2}))).fusedCount,0);
 assert.equal((await f.engine.execute(f.command({sameLevelOnly:true}))).fusedCount,1);
});
test('absent checks, recipes and duplicate inventory fail closed',async()=>{
 for(const mutate of [f=>delete f.n.services.itemMove.isEquippedItemId,f=>f.w.findFusionTable=()=>null,f=>f.items.push({...f.items[0]})]){
 const f=setup();mutate(f);await f.engine.execute(f.command());assert.equal(f.calls,0);}
});
test('bad response with Data is not success; unreconciled inventory blocks repeats',async()=>{
 for(const args of [{reply:999},{reply:undefined},{consume:false}]){
 const f=setup(args);if(args.reply===undefined&&!('consume'in args))f.w.reqFusionAsync=async()=>({Data:{}});
 assert.equal((await f.engine.execute(f.command())).success,false);assert(f.engine.locked());await f.engine.execute(f.command());assert(f.calls<=1);}
});
test('timeout and overlapping requests cannot submit a second batch',async()=>{
 const f=setup();let submissions=0;f.w.reqFusionAsync=()=>{submissions++;return new Promise(()=>{})};
 const pending=f.engine.execute(f.command());assert.equal((await f.engine.execute(f.command())).success,false);
 const result=await pending;assert.equal(result.uncertain,true);assert(f.engine.locked());await f.engine.execute(f.command());assert.equal(submissions,1);
});
test('stale hook identity rejects before any action',async()=>{
 const f=setup();assert.equal((await f.engine.execute(f.command({instance:'old-hook'}))).success,false);assert.equal(f.calls,0);
});
test('built installer parses, injects executable engine and routes action without executing installer',async()=>{
 const archive=unzipSync(fs.readFileSync('LiveSync_1Click.zip')),source=strFromU8(archive['install_game_hook_v2.js']);
 const ast=require('acorn').parse(source,{ecmaVersion:'latest'});
 const decl=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='hook')).declarations.find(d=>d.id.name==='hook');
 const hook=vm.runInNewContext(source.slice(decl.init.start,decl.init.end));require('acorn').parse(hook,{ecmaVersion:'latest'});
 const f=setup(),context={nn:f.n,setInterval(){},setTimeout,clearTimeout,console};vm.createContext(context);vm.runInContext(hook,context);
 const cap=context.__wogGearFusion.status();const result=JSON.parse(await context.__runJewelAction({...f.command(),instance:cap.instance}));
 assert.equal(result.fusedCount,1);assert.equal(f.calls,1);
});
test('one offline UI switch schedules all eight tier/category combinations without legacy auto controls',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(testUrl)?r.abort():r.continue());
  await context.addInitScript(()=>{
    localStorage.setItem('genesis_update_notice_dismissed_v20260920','true');
    localStorage.setItem('genesis_auto_fuse_gear_t3','true');localStorage.setItem('genesis_auto_fuse_acc_t3','true');
    if(localStorage.getItem('genesis_include_storage_jewel')===null) localStorage.setItem('genesis_include_storage_jewel','false');
    if(localStorage.getItem('genesis_fuse_t3_same_level_only')===null) localStorage.setItem('genesis_fuse_t3_same_level_only','true');
    window.WebSocket=class{static OPEN=1;constructor(){this.readyState=0}close(){}send(){throw Error('Real game calls prohibited')}};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(testUrl);
  await page.evaluate(()=>switchMainTab('jewel'));
  assert.equal(await page.locator('#autoGearFusion').isChecked(),false);assert(await page.locator('#autoGearFusion').isDisabled());
  assert.equal(await page.locator('#switchAutoFuseGearT3, #switchAutoFuseAccT3, #autoT4Gear, #autoT4Acc').count(),0);
  assert.equal(await page.locator('#gearFusionPanel, #gearFusionSameLevel, #gearFusionStorage').count(),0);
  assert.equal(await page.locator('.jewel-control-card #autoGearFusion').count(),1);
  assert.equal(await page.locator('#chkFuseT3SameLevelOnly').count(),0);
  assert.equal(await page.evaluate(()=>{
    const row=document.getElementById('gearFusionControls');
    return row.previousElementSibling.contains(document.getElementById('switchAutoFuse')) && row.nextElementSibling.contains(document.getElementById('switchIncludeStorage'));
  }),true,'Unified row must replace the original T3 rows, not add a card');
  await page.evaluate(()=>{
    window.__commands=[];liveWs=new EventTarget();liveWs.readyState=1;liveWs.send=()=>{};queueJewelCmd=c=>window.__commands.push(c);
    window.__cap={version:2,jewelPreservation:1,instance:'test',available:true,counts:Object.fromEntries([1,2,3,4].flatMap(t=>[1,2].map(c=>[t+':'+c,{bag:c===1?6:3,storage:0}]))),generatedAt:Date.now()};
    wogGearFusionTick({gearFusion:__cap});
  });
  assert.equal(await page.evaluate(()=>__commands.length),0);
  await page.locator('#autoGearFusion').check();await page.evaluate(()=>wogGearFusionTick({gearFusion:__cap}));
  let commands=await page.evaluate(()=>window.__commands);assert.equal(commands.length,1);assert.equal(commands[0].sameLevelOnly,false);assert.equal(commands[0].includeStorage,false);
  await page.evaluate(()=>{wogGearFusionTick({gearFusion:__cap});wogGearFusionReply({action:'fuseGearTiers',requestId:'wrong',success:true});wogGearFusionTick({gearFusion:__cap});});assert.equal(await page.evaluate(()=>__commands.length),1);
  for(let i=0;i<7;i++)await page.evaluate(()=>{
    wogGearFusionReply({action:'fuseGearTiers',requestId:__commands.at(-1).requestId,success:true,fusedCount:1});
    const previous=Date.now;Date.now=()=>previous()+5001;__cap.generatedAt=Date.now();wogGearFusionTick({gearFusion:__cap});
  });
  commands=await page.evaluate(()=>__commands);assert.deepEqual(commands.map(c=>[c.sourceTier,c.contentType]),[[1,1],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[4,2]]);
  await page.locator('#switchIncludeStorage').click();
  await page.evaluate(()=>{
    const prior=__commands.findLast(c=>c.action==='fuseGearTiers');
    wogGearFusionReply({action:'fuseGearTiers',requestId:prior.requestId,success:true,fusedCount:1});
    const previous=Date.now;Date.now=()=>previous()+5001;__cap.generatedAt=Date.now();wogGearFusionTick({gearFusion:__cap});
  });
  commands=await page.evaluate(()=>__commands);
  assert.equal(commands.at(-1).action,'fuseGearTiers');
  assert.equal(commands.at(-1).sameLevelOnly,false,'Retired preference stays disabled');
  assert.equal(commands.at(-1).includeStorage,true,'Existing storage control governs the next batch');
  await page.evaluate(()=>wogGearFusionReply({action:'fuseGearTiers',requestId:__commands.at(-1).requestId,success:false,reason:'Uncertain test result'}));assert.equal(await page.locator('#autoGearFusion').isChecked(),false);
  await page.locator('#autoGearFusion').check();await page.evaluate(()=>liveWs.dispatchEvent(new Event('close')));assert.equal(await page.locator('#autoGearFusion').isChecked(),false);
  await page.evaluate(()=>wogGearFusionTick({gearFusion:{...__cap,generatedAt:1}}));assert(await page.locator('#autoGearFusion').isDisabled());
  await page.screenshot({path:'/var/tmp/wog-gear-fusion-'+width+'.png',fullPage:true});
  await page.locator('#gearFusionControls').locator('..').screenshot({path:'/var/tmp/wog-automation-card-'+width+'.png'});
  await page.reload();await page.evaluate(()=>switchMainTab('jewel'));
  assert.equal(await page.locator('#autoGearFusion').isChecked(),false,'Reload never enables automatic fusion');
  assert.equal(await page.locator('#chkFuseT3SameLevelOnly').count(),0);
  assert.equal(await page.evaluate(()=>isFuseT3SameLevelOnlyActive),false);
  assert.equal(await page.evaluate(()=>isIncludeStorageJewelActive),true,'Existing storage preference survives reload');
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close()}
});
test('tiers never mix and out-of-range tiers are rejected',async()=>{
 const f=setup();f.items.forEach((i,n)=>f.db.get(i.itemTid).RatingType=n<3?3:4);
 assert.equal((await f.engine.execute(f.command({sourceTier:3}))).fusedCount,0);
 assert.equal((await f.engine.execute(f.command({sourceTier:4}))).fusedCount,0);assert.equal(f.calls,0);
 f.items.forEach(i=>f.db.get(i.itemTid).RatingType=3);assert.equal((await f.engine.execute(f.command({sourceTier:3}))).fusedCount,1);
 for(const tier of [0,5,6]) { const x=setup();x.items.forEach(i=>x.db.get(i.itemTid).RatingType=tier);await x.engine.execute(x.command({sourceTier:tier}));assert.equal(x.calls,0); }
});

test('all four tiers supported independently',async()=>{for(const tier of [1,2,3,4]){const f=setup();f.items.forEach(i=>f.db.get(i.itemTid).RatingType=tier);assert.equal((await f.engine.execute(f.command({sourceTier:tier}))).fusedCount,1);}});
test('rejected head finds alternate six; unchanged rejected inventory is not retried',async()=>{
 const f=setup({count:7});f.w.validateFusionMaterials=(_,ms)=>ms.length===6&&!ms.some(i=>i.itemId===1);
 assert.equal((await f.engine.execute(f.command())).fusedCount,1);assert(!f.selected.some(i=>i.itemId===1));
 const x=setup({count:7});let checks=0;x.w.validateFusionMaterials=()=>{checks++;return false};
 assert.equal((await x.engine.execute(x.command())).reason,'Game rejected candidate materials');const before=checks;
 await x.engine.execute(x.command());assert.equal(checks,before);x.items[0].itemId=99;await x.engine.execute(x.command());assert(checks>before);assert.equal(x.calls,0);
});
function jewels(){
 const f=setup({count:12});f.items.forEach((i,n)=>i.itemTid=n<6?195101:195201);
 f.n.db.item={get:tid=>({ItemType:6,RatingType:tid%100})};f.n.db.equip.get=()=>null;
 let stage=[],sent=[];
 f.w.clearFusionStaging=()=>{stage=[]};f.w.stageFusionItem=(tid,id)=>stage.push({tid,id});f.w.isFusionStagingFull=()=>stage.length===6;
 f.w.reqFusionStagedAsync=async()=>{sent=[...stage];f.items=f.items.filter(i=>!sent.some(s=>s.id===i.itemId));return [{ok:true}]};
 return {f,get sent(){return sent},cmd:extra=>f.command({action:'fuse',allowedTiers:[1],preservedTypes:[],...extra})};
}
test('base or exact jewel preservation keeps protected items; sends only six eligible',async()=>{
 for(const preserved of [195100,195101]){const j=jewels();const cmd=j.cmd({preservedTypes:[preserved]});
 assert.equal((await j.f.engine.executeJewel(cmd)).fusedCount,1);assert.equal(j.sent.length,6);assert(j.sent.every(i=>i.tid===195201));assert.equal(j.f.items.length,6);assert(j.f.items.every(i=>i.itemTid===195101));
 assert.equal((await j.f.engine.executeJewel(cmd)).success,false);}
});
test('jewel exclusions, undersized batches, invalid policy and stale hooks fail closed',async()=>{
 for(const mutate of [j=>j.f.items[6].isLock=true,j=>j.f.items[6].location=2,j=>j.f.equipped.add(7),j=>j.f.staged.add(7),j=>delete j.f.items[6].isLock]){
 const j=jewels();mutate(j);assert.equal((await j.f.engine.executeJewel(j.cmd({preservedTypes:[195100]}))).fusedCount,0);assert.equal(j.sent.length,0);}
 for(const extra of [{preservedTypes:null},{instance:'old'},{allowedTiers:[7]}]){const j=jewels();assert.equal((await j.f.engine.executeJewel(j.cmd(extra))).success,false);assert.equal(j.sent.length,0);}
});
test('jewel timeout blocks all later equipment actions and never reports success',async()=>{
 const j=jewels();let calls=0;j.f.w.reqFusionStagedAsync=()=>{calls++;return new Promise(()=>{})};
 const pending=j.f.engine.executeJewel(j.cmd());assert.equal((await j.f.engine.execute(j.f.command())).success,false);
 assert.equal((await pending).uncertain,true);assert(j.f.engine.locked());assert.equal((await j.f.engine.executeJewel(j.cmd())).success,false);assert.equal(calls,1);
});
test('jewel preservation UI persists, sends policy and rejects old hooks offline',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 const context=await browser.newContext({viewport:{width:390,height:1000}});await context.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(testUrl)?r.abort():r.continue());
 await context.addInitScript(()=>{window.WebSocket=class{static OPEN=1;constructor(){this.readyState=0}close(){}send(){throw Error('No game')}};localStorage.setItem('genesis_update_notice_dismissed_v20260920','true');});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(testUrl);await page.evaluate(()=>switchMainTab('jewel'));
 await page.locator('#jewelPreserveControls summary').click();const first=page.locator('#jewelPreserveOptions button').first();const base=Number(await first.getAttribute('data-tid'));await first.click();assert.equal(await first.getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(id=>isJewelPreserved({itemTid:id+1}),base),true);
 await page.evaluate(()=>{window.__sent=[];liveWs={readyState:1,send:s=>__sent.push(JSON.parse(s))};window.wogWorkshopCapability={version:1,available:true,generatedAt:Date.now()};queueJewelCmd({action:'fuse',allowedTiers:[1]});});assert.equal(await page.evaluate(()=>__sent.length),0);
 await page.evaluate(()=>{window.wogWorkshopCapability={version:2,jewelPreservation:1,instance:'test',available:true,generatedAt:Date.now()};queueJewelCmd({action:'fuse',allowedTiers:[1]});});
 const sent=await page.evaluate(()=>__sent);assert(sent.length>0);assert(JSON.stringify(sent).includes(String(base)));
 await page.locator('#jewelPreserveControls').screenshot({path:'/var/tmp/wog-preserve-390.png'});
 await page.reload();assert.equal(await page.evaluate(id=>isJewelPreserved({itemTid:id+1}),base),true);assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close()}
});
test('built hook routes jewel preservation without the legacy unfiltered fallback',async()=>{
 const archive=unzipSync(fs.readFileSync('LiveSync_1Click.zip')),source=strFromU8(archive['install_game_hook_v2.js']);
 const ast=require('acorn').parse(source,{ecmaVersion:'latest'});const decl=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='hook')).declarations.find(d=>d.id.name==='hook');
 const hook=vm.runInNewContext(source.slice(decl.init.start,decl.init.end));const j=jewels(),context={nn:j.f.n,setInterval(){},setTimeout,clearTimeout,console};vm.createContext(context);vm.runInContext(hook,context);
 const cap=context.__wogGearFusion.status();const result=JSON.parse(await context.__runJewelAction({...j.cmd({preservedTypes:[195100]}),instance:cap.instance}));
 assert.equal(result.fusedCount,1);assert(j.sent.every(i=>i.tid===195201));assert.equal(j.f.items.length,6);
});
test('exact jewel tier preservation does not protect unrelated tiers of that type',async()=>{
 const j=jewels();j.f.items.forEach(i=>i.itemTid=195102);const result=await j.f.engine.executeJewel(j.cmd({allowedTiers:[2],preservedTypes:[195101]}));assert.equal(result.fusedCount,1);assert.equal(j.sent.length,6);
});
test('first post-submission fault survives capability polling and rejected later commands',async()=>{
 const f=setup({reply:999});const receipt=await f.engine.execute(f.command());assert.equal(receipt.uncertain,true);
 const first=JSON.stringify(f.engine.status().fault);assert.equal(f.engine.status().fault.response.code,'999');
 await f.engine.execute(f.command());assert.equal(JSON.stringify(f.engine.status().fault),first);
 assert.equal(f.engine.status().reason,receipt.reason);
});
test('blocked workshop stops all producers and retains first error outside rolling logs',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 const context=await browser.newContext();await context.route('**/*',r=>/^https?:/.test(r.request().url())&&!r.request().url().startsWith(testUrl)?r.abort():r.continue());
 await context.addInitScript(()=>{window.WebSocket=class{static OPEN=1;constructor(){this.readyState=0}close(){}send(){throw Error('No game')}};localStorage.setItem('genesis_update_notice_dismissed_v20260920','true');});
 const page=await context.newPage();await page.goto(testUrl);
 const result=await page.evaluate(()=>{
  window.__sent=[];liveWs={readyState:1,send:s=>__sent.push(s)};
  const cap={version:2,jewelPreservation:1,instance:'session-a',available:false,blocked:true,fault:{reason:'Fusion response was unsuccessful or uncertain',response:{kind:'object',code:'999',length:null},diagnostics:{phase:'workshop-call',fusionId:10603,requesting:false,materialsValid:true}},generatedAt:Date.now()};
  wogWorkshopStatus(cap);
  for(let n=0;n<100;n++){for(const action of ['fuse','fuseGearTiers','deposit','depositT3','withdraw','toggleStorage'])queueJewelCmd({action});wogWorkshopStatus(cap);}
  wogWorkshopReceipt({uncertain:true,reason:'later error'});
  return {sent:__sent.length,jewel:isAutoFuseJewelActive,deposit:isAutoDepositJewelActive,t3:isAutoDepositT3Active,fault:JSON.parse(sessionStorage.getItem('wog_workshop_first_fault')),text:document.getElementById('workshopFirstFault').textContent};
 });
 assert.equal(result.sent,0);assert.equal(result.jewel,false);assert.equal(result.deposit,false);assert.equal(result.t3,false);assert.equal(result.fault.response.code,'999');assert(!result.text.includes('later error'));assert.equal(result.fault.diagnostics.fusionId,10603);assert(result.text.includes('配方：10603'));assert(result.text.includes('材料驗證：通過'));
 await page.reload();assert((await page.locator('#workshopFirstFault').innerText()).includes('999'));assert((await page.locator('#workshopFirstFault').innerText()).includes('10603'));
 await page.evaluate(()=>{window.__sent=[];liveWs={readyState:1,send:s=>__sent.push(s)};wogWorkshopStatus({instance:'b',available:true,busy:true});queueJewelCmd({action:'deposit'});});assert.equal(await page.evaluate(()=>__sent.length),0);
 await page.evaluate(()=>{wogWorkshopStatus({instance:'b',available:true,busy:false});queueJewelCmd({action:'deposit'});});assert.equal(await page.evaluate(()=>__sent.length),1);
 await context.close();
 }finally{await browser.close()}
});

test('native busy defers gear and jewels without mutation or a persistent fault',async()=>{
 const f=setup();let mutations=0;for(const k of ['clearFusionStaging','setFusionContentType','setAutoRegisterRating','setAutoRegisterIncludeStorage'])f.w[k]=()=>{mutations++};
 f.w._bRequesting=true;assert.equal(f.engine.status().busy,true);assert.equal(f.engine.status().available,true);
 const receipt=await f.engine.execute(f.command());assert.equal(receipt.code,'WORKSHOP_BUSY');assert.equal(receipt.fusedCount,0);assert.equal(f.calls,0);assert.equal(mutations,0);assert.equal(f.engine.status().blocked,false);
 f.w._bRequesting=false;assert.equal((await f.engine.execute(f.command())).fusedCount,1);assert.equal(mutations,0);
 const j=jewels();j.f.w._bRequesting=true;assert.equal((await j.f.engine.executeJewel(j.cmd())).code,'WORKSHOP_BUSY');assert.equal(j.sent.length,0);
});
test('fresh authoritative recipe and native busy are checked immediately before the call',async()=>{
 for(const mutate of [f=>f.n.db.fusion.get=()=>null,f=>f.n.db.fusion.get=()=>({FusionID:404,GroupID:3000,ContentType:2,MaterialRating:4,MaterialRatingCnt:6}),f=>delete f.w._bRequesting]){
  const f=setup();mutate(f);const receipt=await f.engine.execute(f.command());assert.equal(f.calls,0);assert.equal(f.engine.status().blocked,false);assert.notEqual(receipt.uncertain,true);
 }
 const f=setup();let checks=0;f.w.validateFusionMaterials=()=>{if(++checks===2)f.w._bRequesting=true;return true};
 assert.equal((await f.engine.execute(f.command())).code,'WORKSHOP_BUSY');assert.equal(f.calls,0);assert.equal(f.engine.status().blocked,false);
 const x=setup();let count=0;x.w.validateFusionMaterials=()=>++count===1;
 assert.equal((await x.engine.execute(x.command())).reason,'Materials changed before submission');assert.equal(x.calls,0);
});
test('operator-provided native service body succeeds without staging or settings side effects',async()=>{
 const f=setup();const submit=f.w.reqFusionAsync;let networkCalls=0;
 f.n.net.manager={gameSession:{reqItemFusion:async(group,materials)=>{networkCalls++;assert.equal(group,3000);return submit(404,materials)}}};
 // Exact operator-provided service logic: the busy flag is set synchronously.
 f.w.reqFusionAsync=vm.runInNewContext(`(async function(fusionTid,materials){if(this._bRequesting)return E_LogPort.Service,null;this._bRequesting=!0;try{var sendMaterials,fusion=nn.db.fusion.get(fusionTid);return fusion?(sendMaterials=materials??this.collectFusionMaterials(fusionTid),this.validateFusionMaterials(fusion,sendMaterials)?await nn.net.manager.gameSession.reqItemFusion(fusion.GroupID,sendMaterials):(E_LogPort.Service,sendMaterials.length,null)):(E_LogPort.Service,null)}finally{this._bRequesting=!1}})`,{nn:f.n,E_LogPort:{Service:0}});
 for(const k of ['clearFusionStaging','setFusionContentType','setAutoRegisterRating','setAutoRegisterIncludeStorage'])f.w[k]=()=>{throw Error('Unexpected game UI mutation')};
 const receipt=await f.engine.execute(f.command());assert.equal(receipt.fusedCount,1);assert.equal(networkCalls,1);assert.equal(f.w._bRequesting,false);
});
test('null after passing preflight retains bounded call-time evidence and blocks retry',async()=>{
 const f=setup();let calls=0;f.w.reqFusionAsync=async()=>{calls++;return null};
 const receipt=await f.engine.execute(f.command());assert.equal(receipt.uncertain,true);assert.equal(receipt.response.kind,'null');assert.equal(receipt.diagnostics.phase,'workshop-call');assert.equal(receipt.diagnostics.materialsValid,true);assert.equal(receipt.diagnostics.requesting,false);assert.equal(receipt.diagnostics.fusionId,404);
 assert(!JSON.stringify(receipt.diagnostics).includes('itemId'));assert.equal(f.engine.status().fault.diagnostics.fusionId,404);
 await f.engine.execute(f.command());assert.equal(calls,1);
});
test('packaged hook blocks deposits while native workshop is busy and defers gear',async()=>{
 const archive=unzipSync(fs.readFileSync('LiveSync_1Click.zip')),source=strFromU8(archive['install_game_hook_v2.js']);
 const ast=require('acorn').parse(source,{ecmaVersion:'latest'});const decl=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='hook')).declarations.find(d=>d.id.name==='hook');
 const hook=vm.runInNewContext(source.slice(decl.init.start,decl.init.end));const f=setup(),context={nn:f.n,setInterval(){},setTimeout,clearTimeout,console};vm.createContext(context);vm.runInContext(hook,context);
 f.w._bRequesting=true;
 for(const action of ['deposit','depositT3','withdraw','fuse','fuseGearTiers']){const receipt=JSON.parse(await context.__runJewelAction({action,requestId:'busy-'+action}));assert.equal(receipt.code,'WORKSHOP_BUSY');assert.equal(receipt.uncertain,false);assert.equal(receipt.success,action==='fuseGearTiers');}
 assert.equal(f.calls,0);assert.equal(context.__wogGearFusion.status().blocked,false);
});

test('protection changed during preflight never submits and network throws remain uncertain',async()=>{
 const f=setup();const read=f.n.net.data.item.getAllItemNotStack;let reads=0;
 f.n.net.data.item.getAllItemNotStack=()=>{if(++reads===3)f.items[0].isLock=true;return read()};
 const result=await f.engine.execute(f.command());assert.equal(result.success,false);assert.equal(result.uncertain,false);assert.equal(f.calls,0);assert.equal(f.engine.status().blocked,false);
 const x=setup();let calls=0;x.w.reqFusionAsync=async()=>{calls++;throw Error('Network response interrupted')};
 const failed=await x.engine.execute(x.command());assert.equal(failed.uncertain,true);assert.equal(failed.diagnostics.materialsValid,true);await x.engine.execute(x.command());assert.equal(calls,1);
});
