const fs = require('node:fs');
const path = require('node:path');
const engine = fs.readFileSync(path.join(__dirname, '../features/gear-fusion-engine.js'), 'utf8');
const workshopUI = fs.readFileSync(path.join(__dirname, '../features/workshop-status-ui.js'), 'utf8');
const jewelUI = fs.readFileSync(path.join(__dirname, '../features/jewel-preservation-ui.js'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '../features/gear-fusion-ui.js'), 'utf8');
function once(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Gear fusion extension anchor mismatch: ' + before);
  return source.replace(before, () => after);
}
function patchHook(source) {
  const escaped = ('globalThis.__wogGearFusion = (' + engine + ')(() => nn);\n').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  source = once(source, '  let lastDump = 0;', '  ' + escaped + '\n  let lastDump = 0;');
  source = once(source, '      const jewelsData = {', '      const jewelsData = {\n        gearFusion: globalThis.__wogGearFusion.status(),');
  source = once(source, "      if (cmd.action === 'fuseT3') {", "      if (cmd.action === 'fuseGearTiers') {\n        const result = await globalThis.__wogGearFusion.execute(cmd);\n        dumpEnrichedProfile();\n        return JSON.stringify(result);\n      }\n\n      if (cmd.action === 'fuseT3') {");
  const fuseStart=source.indexOf("      if (cmd.action === 'fuse') {");
  const fuseEnd=source.indexOf("      if (cmd.action === 'fuseGearTiers') {",fuseStart);
  if(fuseStart<0||fuseEnd<0)throw Error('Jewel dispatch anchors missing');
  source=source.slice(0,fuseStart)+"      if (cmd.action === 'fuse') {\n        const result = await globalThis.__wogGearFusion.executeJewel(cmd);\n        dumpEnrichedProfile();\n        return JSON.stringify(result);\n      }\n"+source.slice(fuseEnd);
  source = once(source, "const isSameLv = (cmd.sameLevelOnly !== false);", "const isSameLv = false;");
  const guard = `  // Serialize all workshop actions with automatic gear fusion. Uncertain fusion submissions stay blocked.
  const originalJewelAction = globalThis.__runJewelAction;
  let workshopActionBusy = false;
  globalThis.__runJewelAction = async function(cmd) {
    if (workshopActionBusy || globalThis.__wogGearFusion.locked()) {
      const state=globalThis.__wogGearFusion.status();
      return JSON.stringify({action:cmd.action,requestId:cmd.requestId,success:!state.blocked && cmd.action==='fuseGearTiers',fusedCount:0,code:state.blocked?'WORKSHOP_BLOCKED':'WORKSHOP_BUSY',uncertain:state.blocked,reason:state.blocked?(state.fault?.reason||'Workshop blocked; check the game.'):'Workshop busy; wait for the current action.',response:state.fault?.response,diagnostics:state.fault?.diagnostics});
    }
    workshopActionBusy = true;
    try { return await originalJewelAction(cmd); }
    finally { workshopActionBusy = false; }
  };

`;
  return once(source, '  // 1. High-speed loop', guard + '  // 1. High-speed loop');
}
function patchFrontend(html) {
  const controlsStart = html.indexOf('      <!-- TIER 3 GEAR FUSE SWITCH -->');
  const controlsEnd = html.indexOf('      <!-- TIER 3 SAME LEVEL ONLY CHECKBOX OPTION -->', controlsStart);
  if (controlsStart < 0 || controlsEnd < 0) throw Error('Legacy automatic controls missing');
  html = html.slice(0, controlsStart) + '      <div id="gearFusionControls"></div>\n\n' + html.slice(controlsEnd);
  const sameStart = html.indexOf('      <!-- TIER 3 SAME LEVEL ONLY CHECKBOX OPTION -->');
  const sameEnd = html.indexOf('      <div class="jewel-switch-wrap" onclick="toggleIncludeStorageJewels()">', sameStart);
  if(sameStart<0||sameEnd<0)throw Error('Same-level control anchors missing');
  html=html.slice(0,sameStart)+html.slice(sameEnd);
  html=once(html,"let isFuseT3SameLevelOnlyActive = localStorage.getItem('genesis_fuse_t3_same_level_only') !== 'false'; // Default TRUE","const isFuseT3SameLevelOnlyActive = false; // Retired preference never restricts fusion.");
  const toggleStart=html.indexOf('function toggleFuseT3SameLevelOnly() {');
  const toggleEnd=html.indexOf('\nfunction ',toggleStart+10);
  html=html.slice(0,toggleStart)+'function toggleFuseT3SameLevelOnly() { /* Retired compatibility no-op. */ }\n'+html.slice(toggleEnd);
  const autoStart = html.indexOf('    // Auto-fuse T3 checks');
  const autoEnd = html.indexOf('    // Log any fusion events', autoStart);
  if (autoStart < 0 || autoEnd < 0) throw Error('Legacy automatic scheduler missing');
  html = html.slice(0, autoStart) + '    // Unified rating 1-4 scheduler owns automatic gear fusion.\n\n' + html.slice(autoEnd);

  html = once(html, 'function applyLiveGameData(data) {', 'function applyLiveGameData(data) {\n  if (window.wogGearFusionTick) window.wogGearFusionTick(data && data.jewelsData);');
  const marker = 'if (data && data.action) {';
  if (html.split(marker).length !== 3) throw Error('Expected both LiveSync action handlers');
  html = html.replaceAll(marker, marker + '\n            if (window.wogWorkshopReceipt) window.wogWorkshopReceipt(data);\n            if (window.wogGearFusionReply) window.wogGearFusionReply(data);\n            if (window.wogJewelPreservationReply) window.wogJewelPreservationReply(data);');
  // Upstream preservation semantics applied to both manual and automatic counts.
  html=html.replaceAll('if (!j.isLock && (j.location === 1 || (isIncludeStorageJewelActive && j.location === 2)))', 'if (!j.isLock && !window.isJewelPreserved(j) && (j.location === 1 || (isIncludeStorageJewelActive && j.location === 2)))');
  html=html.replaceAll('jewels.filter(j => !j.isLock && (j.location === 1 || (isIncludeStorageJewelActive && j.location === 2))', 'jewels.filter(j => !j.isLock && !window.isJewelPreserved(j) && (j.location === 1 || (isIncludeStorageJewelActive && j.location === 2))');
  html=html.replaceAll('const isSameLv = cmd.sameLevelOnly !== undefined ? cmd.sameLevelOnly : (cfg && cfg.sameLevelOnly);','const isSameLv = false;');
  return once(html, '</body>', '<script>\n'+workshopUI+'\n</script>\n<script>\n' + ui + '\n</script>\n<script>\n'+jewelUI+'\n</script>\n</body>');
}
module.exports = {patchHook, patchFrontend};
