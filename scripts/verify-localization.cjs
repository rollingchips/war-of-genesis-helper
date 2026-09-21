const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const acorn = require('acorn');
const {chromium} = require('playwright');
const html = fs.readFileSync('index.html','utf8');
const upstream = cp.execFileSync('git',['show',require('../localization/upstream.json').commit+':index.html'],{maxBuffer:12e6}).toString();
const {unzipSync,strFromU8}=require('fflate');
const archive=unzipSync(fs.readFileSync('LiveSync_1Click.zip'));
const originalArchive=unzipSync(cp.execFileSync('git',['show',require('../localization/upstream.json').commit+':LiveSync_1Click.zip']));
assert.deepEqual(Object.keys(archive).sort(),['cai_dat_livesync.bat','install_game_hook_v2.js','livesync_bridge.js','wog-helper.html']);
for(const name of ['install_game_hook_v2.js','livesync_bridge.js']) assert.deepEqual(archive[name],originalArchive[name],'Upstream game script changed');
assert.equal(strFromU8(archive['wog-helper.html']),html,'Bundled HTML does not match fork');
const launcher=strFromU8(archive['cai_dat_livesync.bat']).replace(/\r\n/g,'\n');
assert(launcher.includes('if exist "%~dp0wog-helper.html" (\n    start "" "%~dp0wog-helper.html"'));
assert(launcher.includes('Open your fork index.html manually.'));
assert(!launcher.includes('titlee2111.github.io'),'Launcher still targets upstream');
const expectedLauncher=strFromU8(originalArchive['cai_dat_livesync.bat']).replace(/\r\n/g,'\n').replace('start "" "https://titlee2111.github.io/war-of-genesis-helper/"',[
'if exist "%~dp0wog-helper.html" (','    start "" "%~dp0wog-helper.html"',') else (','    echo [NOTICE] wog-helper.html is missing. Open your fork index.html manually.',')'].join('\n')).replace('echo        Dang mo Web Helper tai: https://titlee2111.github.io/war-of-genesis-helper/','echo        Opening bundled fork: wog-helper.html');
assert.equal(launcher,expectedLauncher,'Non-browser BAT behavior changed');
const changed = new Set(['renderStageTable','getFilteredEquipments','getFilteredJewels','renderJewelTable','updateDOMTranslations','switchLanguage','__i18nTranslateMutations']);
let preservedFunctions=0, preservedDeclarations=0;
for (const match of upstream.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
  const ast=acorn.parse(match[1],{ecmaVersion:'latest'});
  for (const node of ast.body) {
    const raw=match[1].slice(node.start,node.end);
    if (node.type==='FunctionDeclaration' && !changed.has(node.id.name)) { assert(html.includes(raw), 'Unexpected function change: '+node.id.name);preservedFunctions++; }
    if (node.type==='VariableDeclaration' && !node.declarations.some(d=>d.id.name==='LIVESYNC_BAT_CONTENT')) { assert(html.includes(raw),'Unexpected data or initial-state change');preservedDeclarations++; }
  }
}
for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))acorn.parse(match[1],{ecmaVersion:'latest'});
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('**/*',r=>/^(https?|steam):/.test(r.request().url())?r.abort():r.continue());
    await context.addInitScript(()=>{
      window.__gameCommands=0;
      window.open=()=>{throw Error('External launches prohibited in verification');};
      window.WebSocket=class {static OPEN=1;static CONNECTING=0;constructor(){this.readyState=0;}addEventListener(){}close(){}send(){window.__gameCommands++;throw Error('Game commands prohibited in verification');}};
      // A previous English preference must not override this localized fork.
      localStorage.setItem('genesis_helper_lang','en');
    });
    const page=await context.newPage(), errors=[], dialogs=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    await page.waitForTimeout(150);
    assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hant');
    assert.equal(await page.evaluate(()=>localStorage.getItem('genesis_helper_lang')),'zh-Hant');
    assert.equal(await page.evaluate(()=>LIVESYNC_BAT_CONTENT),launcher,'Embedded BAT differs from archive');
    const labels=JSON.parse(fs.readFileSync('localization/upstream-ui.json','utf8'));
    for(const target of Object.values(labels)) assert.equal(await page.evaluate(t=>zhText(zhText(t)),target),target,'Supplemental label must be stable');
    const sample=await page.evaluate(()=>({
      plain:zhText('Gây 280% sát thương.'),
      timed:zhText('Hồi 5% HP mỗi 10 giây.'),
      compound:zhText('Gây 200% sát thương. Trong 10 giây, mỗi đòn đánh thường tăng 20% sát thương trong 5 giây. (Tối đa 3 cộng dồn)'),
      search:zhSearch('Iron Sword','鐵劍'),
      stable:zhText(zhText('Cây Kỹ Năng'))
    }));
    assert.equal(sample.plain,'造成 280% 傷害。');
    assert.equal(sample.timed,'每 10 秒恢復 5% HP。');
    assert.equal(sample.compound,'造成 200% 傷害。在 10 秒內，每次普通攻擊使傷害提高 20%，持續 5 秒。（最多疊加 3 次）');
    assert(sample.search);assert.equal(sample.stable,'技能樹');
    const catalog=await page.evaluate(()=>{
      const rows=[];
      function walk(x){if(!x||typeof x!=='object')return;for(const [k,v]of Object.entries(x)){
        if(typeof v==='string'&&/^(name_vi|name_en|desc_vi|desc_en|text_vi|text_en|class_name|branch_name|area_name|slot_name|grade_name_vi|category_vi|display_full)$/.test(k))rows.push({source:v,result:zhText(v)});
        else if(v&&typeof v==='object')walk(v);
      }}
      walk({skillTrees,trainingSkills,equipments,jewelDatabase,stageData});return rows;
    });
    assert(catalog.length>8000);
    assert.deepEqual(catalog.filter(r=>/[À-ỹĐđ]|[A-Za-z]{3}/.test(r.result)),[],'Untranslated catalog fields');
    const tabs=['tree','stage','stageHistory','dps','profile','training','equip','jewel_lookup','jewel','ai'];
    for(const tab of tabs){
      await page.evaluate(t=>switchMainTab(t),tab);await page.waitForTimeout(30);
      assert(!/[À-ỹĐđ]/.test(await page.locator('body').innerText()),'Untranslated page: '+tab+'\n'+(await page.locator('body').innerText()).split('\n').filter(x=>/[À-ỹĐđ]/.test(x)).join('\n'));
    }
    for(const cls of ['Melee','Ranged','Mage']){
      await page.evaluate(c=>{switchMainTab('tree');switchClass(c);},cls);await page.waitForTimeout(30);
      assert(!/[À-ỹĐđ]/.test(await page.locator('body').innerText()),'Untranslated class '+cls);
    }
    // Catalog filters must match the same item identity for translated searches.
    const filters=await page.evaluate(()=>{
      document.getElementById('equipSearch').value='鐵劍';
      return getFilteredEquipments().map(e=>e.name_en);
    });
    assert(filters.length>0 && filters.some(n=>n==='Iron Sword'));
    await page.evaluate(()=>{const el=document.createElement('span');el.id='translationProbe';el.textContent='Đã sao chép';el.title='Sao chép';document.body.appendChild(el);});
    await page.waitForTimeout(30);
    assert.equal(await page.locator('#translationProbe').innerText(),'已複製');
    assert.equal(await page.locator('#translationProbe').getAttribute('title'),'複製');
    await page.evaluate(()=>{document.getElementById('translationProbe').textContent='Đang kết nối...';});
    await page.waitForTimeout(30);assert.equal(await page.locator('#translationProbe').innerText(),'連線中…');
    await page.evaluate(()=>{document.getElementById('barPlayerName').firstChild.nodeValue='Gold Knight';});
    await page.waitForTimeout(30);assert((await page.locator('#barPlayerName').innerText()).includes('Gold Knight'));
    assert.equal(await page.evaluate(()=>confirm('Bạn có chắc muốn xóa sạch 20 ải trong lịch sử chạy không?')),false);
    assert.equal(dialogs.pop(),'確定要清除最近 20 次通關紀錄嗎？');
    for(const name of ['openSaveLocatorModal','openWatchdogModal','openDonateModal','openLiveSyncHelpModal']){
      await page.evaluate(n=>window[n](),name);await page.waitForTimeout(30);
      assert(!/[À-ỹĐđ]/.test(await page.locator('body').innerText()),'Untranslated modal: '+name+'\n'+(await page.locator('body').innerText()).split('\n').filter(x=>/[À-ỹĐđ]/.test(x)).join('\n'));
    }
    const downloadLinks=await page.locator('a[href="LiveSync_1Click.zip"]').count();
    assert(downloadLinks>0,'LiveSync archive download link is missing');
    assert.equal(await page.evaluate(()=>typeof toggleLangDropdown),'function','Language adapter removed an unrelated function');
    await page.evaluate(()=>{switchLanguage('en');updateLiveSyncI18n('en');});
    await page.waitForTimeout(60);
    assert.equal(await page.locator('#lsBannerBadge').innerText(),'Required for LiveSync','English reverse alias must use the same terminal label');
    await page.reload();await page.waitForTimeout(60);
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});await page.waitForTimeout(30);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width);
      if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`zh-Hant-${width}.png`)});}
    }
    assert.equal(await page.evaluate(()=>window.__gameCommands),0);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({preservedFunctions,preservedDeclarations,catalogFields:catalog.length,tabs:tabs.length,classes:3,modals:4,downloadLinks,gameScriptsMatchUpstream:true,bundledForkVerified:true,viewports:[1440,390],gameCommands:0,pageErrors:0}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
