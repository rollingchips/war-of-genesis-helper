const {test} = require('node:test');
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
  const w={setFusionContentType(){},setAutoRegisterRating(){},setAutoRegisterIncludeStorage(){},getTableInfo:()=>({contentType:type,baseLimitLevel:20}),findFusionTable:(t,r,l)=>t===type&&[3,4].includes(r)&&l===20?{FusionID:404}:null,
    validateFusionMaterials:(_,ms)=>ms.length===count,clearFusionStaging(){},reqFusionAsync:async(_,ms)=>{calls++;selected=ms;if(consume)items=items.filter(i=>!ms.some(m=>m.itemId===i.itemId));return {NetResult:reply,Data:{}};}};
  const n={services:{workshop:w,itemMove:{isEquippedItemId:id=>equipped.has(id)},steamMarket:{staging:{isStaged:id=>staged.has(id)}}},net:{data:{item:{getAllItemNotStack:()=>items}}},db:{equip:{get:id=>db.get(id)}},msgBroker:{publish(){}}};
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
test('same-level constraint and no wrong-category fusion',async()=>{
 const f=setup();f.w.getTableInfo=(tid)=>({contentType:1,baseLimitLevel:tid===1?19:20});
 assert.equal((await f.engine.execute(f.command())).fusedCount,0);
 assert.equal((await f.engine.execute(f.command({contentType:2}))).fusedCount,0);
 assert.equal((await f.engine.execute(f.command({sameLevelOnly:false}))).fusedCount,1);
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
test('one offline UI switch schedules all four tier/category combinations without legacy auto controls',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
  await context.addInitScript(()=>{
    localStorage.setItem('genesis_update_notice_dismissed_v20260920','true');
    localStorage.setItem('genesis_auto_fuse_gear_t3','true');localStorage.setItem('genesis_auto_fuse_acc_t3','true');
    if(localStorage.getItem('genesis_include_storage_jewel')===null) localStorage.setItem('genesis_include_storage_jewel','false');
    if(localStorage.getItem('genesis_fuse_t3_same_level_only')===null) localStorage.setItem('genesis_fuse_t3_same_level_only','true');
    window.WebSocket=class{static OPEN=1;constructor(){this.readyState=0}close(){}send(){throw Error('Real game calls prohibited')}};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(require('node:path').resolve('index.html')).href);
  await page.evaluate(()=>switchMainTab('jewel'));
  assert.equal(await page.locator('#autoGearFusion').isChecked(),false);assert(await page.locator('#autoGearFusion').isDisabled());
  assert.equal(await page.locator('#switchAutoFuseGearT3, #switchAutoFuseAccT3, #autoT4Gear, #autoT4Acc').count(),0);
  assert.equal(await page.locator('#gearFusionPanel, #gearFusionSameLevel, #gearFusionStorage').count(),0);
  assert.equal(await page.locator('.jewel-control-card #autoGearFusion').count(),1);
  assert.equal(await page.locator('#chkFuseT3SameLevelOnly').count(),1);
  assert.equal(await page.evaluate(()=>{
    const row=document.getElementById('gearFusionControls');
    return row.previousElementSibling.contains(document.getElementById('switchAutoFuse')) && row.nextElementSibling.contains(document.getElementById('chkFuseT3SameLevelOnly'));
  }),true,'Unified row must replace the original T3 rows, not add a card');
  await page.evaluate(()=>{
    window.__commands=[];liveWs=new EventTarget();liveWs.readyState=1;liveWs.send=()=>{};queueJewelCmd=c=>window.__commands.push(c);
    window.__cap={version:1,instance:'test',available:true,counts:{'3:1':{bag:6,storage:0},'4:1':{bag:6,storage:0},'3:2':{bag:3,storage:0},'4:2':{bag:3,storage:0}},generatedAt:Date.now()};
    wogGearFusionTick({gearFusion:__cap});
  });
  assert.equal(await page.evaluate(()=>__commands.length),0);
  await page.locator('#autoGearFusion').check();await page.evaluate(()=>wogGearFusionTick({gearFusion:__cap}));
  let commands=await page.evaluate(()=>window.__commands);assert.equal(commands.length,1);assert.equal(commands[0].sameLevelOnly,true);assert.equal(commands[0].includeStorage,false);
  await page.evaluate(()=>{wogGearFusionTick({gearFusion:__cap});wogGearFusionReply({action:'fuseGearTiers',requestId:'wrong',success:true});wogGearFusionTick({gearFusion:__cap});});assert.equal(await page.evaluate(()=>__commands.length),1);
  for(let i=0;i<3;i++)await page.evaluate(()=>{
    wogGearFusionReply({action:'fuseGearTiers',requestId:__commands.at(-1).requestId,success:true,fusedCount:1});
    const previous=Date.now;Date.now=()=>previous()+5001;__cap.generatedAt=Date.now();wogGearFusionTick({gearFusion:__cap});
  });
  commands=await page.evaluate(()=>__commands);assert.deepEqual(commands.map(c=>[c.sourceTier,c.contentType]),[[3,1],[4,1],[3,2],[4,2]]);
  await page.locator('#chkFuseT3SameLevelOnly').click();
  await page.locator('#switchIncludeStorage').click();
  await page.evaluate(()=>{
    const prior=__commands.findLast(c=>c.action==='fuseGearTiers');
    wogGearFusionReply({action:'fuseGearTiers',requestId:prior.requestId,success:true,fusedCount:1});
    const previous=Date.now;Date.now=()=>previous()+5001;__cap.generatedAt=Date.now();wogGearFusionTick({gearFusion:__cap});
  });
  commands=await page.evaluate(()=>__commands);
  assert.equal(commands.at(-1).action,'fuseGearTiers');
  assert.equal(commands.at(-1).sameLevelOnly,false,'Existing same-level checkbox governs the next batch');
  assert.equal(commands.at(-1).includeStorage,true,'Existing storage control governs the next batch');
  await page.evaluate(()=>wogGearFusionReply({action:'fuseGearTiers',requestId:__commands.at(-1).requestId,success:false,reason:'Uncertain test result'}));assert.equal(await page.locator('#autoGearFusion').isChecked(),false);
  await page.locator('#autoGearFusion').check();await page.evaluate(()=>liveWs.dispatchEvent(new Event('close')));assert.equal(await page.locator('#autoGearFusion').isChecked(),false);
  await page.evaluate(()=>wogGearFusionTick({gearFusion:{...__cap,generatedAt:1}}));assert(await page.locator('#autoGearFusion').isDisabled());
  await page.screenshot({path:'/var/tmp/wog-gear-fusion-'+width+'.png',fullPage:true});
  await page.locator('#gearFusionControls').locator('..').screenshot({path:'/var/tmp/wog-automation-card-'+width+'.png'});
  await page.reload();await page.evaluate(()=>switchMainTab('jewel'));
  assert.equal(await page.locator('#autoGearFusion').isChecked(),false,'Reload never enables automatic fusion');
  assert.equal(await page.locator('#chkFuseT3SameLevelOnly').isChecked(),false,'Existing checkbox preference survives reload');
  assert.equal(await page.evaluate(()=>isIncludeStorageJewelActive),true,'Existing storage preference survives reload');
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close()}
});
test('rating 3 OR 4 supported, never mixed together and no ratings 1/2/5',async()=>{
 const f=setup();f.items.forEach((i,n)=>f.db.get(i.itemTid).RatingType=n<3?3:4);
 assert.equal((await f.engine.execute(f.command({sourceTier:3}))).fusedCount,0);
 assert.equal((await f.engine.execute(f.command({sourceTier:4}))).fusedCount,0);assert.equal(f.calls,0);
 f.items.forEach(i=>f.db.get(i.itemTid).RatingType=3);assert.equal((await f.engine.execute(f.command({sourceTier:3}))).fusedCount,1);
 for(const tier of [1,2,5]) { const x=setup();x.items.forEach(i=>x.db.get(i.itemTid).RatingType=tier);await x.engine.execute(x.command({sourceTier:tier}));assert.equal(x.calls,0); }
});
