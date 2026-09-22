// Audit delivered UI text, not console strings, source identifiers or translated test copies.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const properNames=String.raw`War of Genesis(?::)?(?: Idle Loot)?(?: Helper)?|Genesis(?:\.exe| Helper)?|LiveSync|Steam|Node\.js|nodejs\.org|Windows|AppData|DPS|EXP|ATK|DEF|PvE|PvP|AFK|AoE|JSON|Base64|LTS|BAT|ZIP|JPG|PNG|WebP|Ctrl|MB|VietQR|Binance(?: Pay)?|PayPal|Buy Me a Coffee|buymeacoffee\.com/titlee|USDT|BUSD|BNB|BTC|ETH|User-9e11c|LY THAI SON|cai_dat_livesync\.bat|Wiki|Discord|Pay|Lee|Gishche|Firebase|apiKey|projectId|Excel|CSV|PDF`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',r=>/^(https?|steam):/.test(r.request().url())?r.abort():r.continue());
 await context.addInitScript(()=>{
  localStorage.setItem('genesis_update_notice_dismissed_v20260920','true');
  window.__gameCommands=0;
  window.WebSocket=class{static OPEN=1;constructor(){this.readyState=0}addEventListener(){}close(){}send(){__gameCommands++;throw Error('No live game operations allowed')}};
  window.open=()=>{throw Error('No external launches allowed')};
 });
 const page=await context.newPage(),errors=[],dialogs=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss()});
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 async function scan(label){
  await page.waitForTimeout(60);
  const bad=await page.evaluate(source=>{
   const allowed=new RegExp(source,'gi'),rows=new Set();
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
   while(node=walker.nextNode()){
    if(node.parentElement.closest('script,style,code,pre,textarea,[data-user-content],#barPlayerName'))continue;
    if(node.textContent.trim())rows.add(node.textContent.trim());
   }
   for(const el of document.querySelectorAll('[title],[placeholder],[alt],[aria-label]')){
    if(el.closest('code,pre,[data-user-content]'))continue;
    for(const attr of ['title','placeholder','alt','aria-label']){
     const value=el.getAttribute(attr);
     // Existing icon IDs are asset identities, not natural-language labels.
     if(value && !(attr==='alt'&&/^[\w]+_[\w]+$/.test(value)))rows.add(value);
    }
   }
   return [...rows].filter(t=>{const rest=t.replace(allowed,'');return /[关时认点击载显级装闭开选战伤仓宝网络为设无数发构连]/u.test(rest)||/[a-z]{3}/i.test(rest)||[...rest].some(c=>c.codePointAt(0)>127&&/\p{Script=Latin}/u.test(c));});
  },properNames);
  assert.deepEqual(bad,[],'Untranslated UI in '+label);
 }
 for(const tab of ['tree','stage','stageHistory','dps','profile','training','equip','jewel_lookup','jewel','ai','community']){
  await page.evaluate(t=>switchMainTab(t),tab);await scan(tab);
 }
 for(const fn of ['openSaveLocatorModal','openWatchdogModal','openDonateModal','openLiveSyncHelpModal','openImportBuildModal','openCloudConfigModal','openUpdateNoticeModal']){
  await page.evaluate(n=>window[n](),fn);await scan(fn);
  await page.evaluate(()=>{document.querySelectorAll('[id$="Modal"]').forEach(e=>e.style.display='none')});
 }
 // Every authored exact phrase resolves to its reviewed Chinese target and stays stable.
 const phrases=JSON.parse(fs.readFileSync('localization/ui-phrases.json','utf8'));
 for(const [source,target]of Object.entries(phrases)){
  assert.equal(await page.evaluate(s=>zhText(s),source),target,'Phrase: '+source);
  assert.equal(await page.evaluate(s=>zhText(s),target),target,'Unstable target: '+target);
 }
 // Known success/failure logs, counters and storage options must translate before and after DOM insertion.
 const samples=[
  ['🎉 Workshop fused 6x [Tier 3] jewels ➔ Received 1x [Gold Knight]!','🎉 已合成 6 顆 T3 寶石 ➔ 獲得 1 顆 [Gold Knight]！'],
  ['🎉 Workshop fused 6x [Tier 3] jewels ➔ Received 1x [Gold Knight (Tier 4)]!','🎉 已合成 6 顆 T3 寶石 ➔ 獲得 1 顆 [Gold Knight]（T4）！'],
  ['📦 Successfully deposited 6 jewels into [Storage 2]!','📦 已將 6 顆寶石存入倉庫 2！'],
  ['🛡️ Successfully deposited 3 Tier 3 gear/accessories into [Storage 1]!','🛡️ 已將 3 件 T3 裝備／飾品存入倉庫 1！'],
  ['🏛️ Set target storage for loose jewels: [All Tabs (Auto)].','🏛️ 寶石存放目標已設為：所有倉庫（自動）。'],
  ['🏛️ Set target storage for Tier 3 items: [Storage 3].','🏛️ T3 物品存放目標已設為：倉庫 3。'],
  ['Storage 3 is full (42/42)!','倉庫 3 已滿（42／42）！'],
  ['⚡ Requesting Workshop to auto-fuse selected tiers [1,3,4] (6 jewels/set)...','⚡ 正在要求鍛造爐合成所選階級 [1,3,4]（每批 6 顆）…'],
  ['Fusion timed out; reconcile in game before restarting LiveSync','合成逾時；重新啟動 LiveSync 前，請先在遊戲內確認材料與結果'],
  ['Has 3/6 jewels (Need 6)','持有 3／6 顆寶石（需要 6 顆）'],
  ['14 / 84 slots (2 Tabs)','14／84 格（2 個倉庫）'],
  ['🎉 Workshop successfully fused 6 jewels ➔ Received 1x [Gold Knight]!','🎉 已合成 6 顆寶石 ➔ 獲得 1 顆 [Gold Knight]！'],
 ];
 for(const [source,target] of samples)assert.equal(await page.evaluate(s=>zhText(s),source),target);
 await page.evaluate(()=>{
  switchMainTab('jewel');
  addJewelLog('🔒 Đã BẬT: Chỉ ghép trang bị/trang sức Tier 3 CÙNG CẤP ĐỘ (Level).');
  addJewelLog('📦 Đã cất 6 viên ngọc vào [Kho 2] thành công!');
  const textarea=document.getElementById('importBuildTextarea')||document.querySelector('textarea');
  textarea.value='Gold Knight JSON code';textarea.placeholder='Please paste share code or JSON content!';
  const label=document.createElement('span');label.id='uiDynamicProbe';label.textContent='Storage 3 is full (42/42)!';label.title='Required item safety checks are unavailable';document.body.appendChild(label);
 });
 await scan('dynamic logs and attributes');
 assert.equal(await page.locator('#uiDynamicProbe').innerText(),'倉庫 3 已滿（42／42）！');
 assert.equal(await page.locator('#uiDynamicProbe').getAttribute('title'),'無法執行必要的物品保護檢查');
 assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('textarea')).find(x=>x.value==='Gold Knight JSON code')?.value),'Gold Knight JSON code');
 assert.equal(await page.evaluate(()=>confirm('Are you sure you want to delete this build? This action will permanently remove it from the list.')),false);
 assert.equal(dialogs.pop(),'確定要刪除此配置嗎？此操作會將它從列表永久移除。');
 await page.evaluate(()=>{switchMainTab('jewel');closeUpdateNoticeModal()});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await scan('layout '+width);
  assert.equal(await page.locator('.jewel-control-card #autoGearFusion').count(),1);
  assert.equal(await page.locator('#chkFuseT3SameLevelOnly').count(),1);
  assert.equal(await page.locator('#gearFusionPanel, #gearFusionSameLevel, #gearFusionStorage').count(),0);
  await page.locator('#gearFusionControls').locator('..').screenshot({path:'/var/tmp/wog-full-zh-card-'+width+'.png'});
 }
 assert.equal(await page.evaluate(()=>__gameCommands),0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({tabs:11,modals:7,phrases:Object.keys(phrases).length,dynamicSamples:samples.length,viewports:[1440,390],gameCommands:0,pageErrors:0}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
