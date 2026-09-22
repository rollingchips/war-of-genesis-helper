const fs = require('node:fs');
const path = require('node:path');
const engine = fs.readFileSync(path.join(__dirname, '../features/gear-fusion-engine.js'), 'utf8');
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
  const guard = `  // Serialize all workshop actions with automatic gear fusion. Uncertain fusion submissions stay blocked.
  const originalJewelAction = globalThis.__runJewelAction;
  let workshopActionBusy = false;
  globalThis.__runJewelAction = async function(cmd) {
    if (workshopActionBusy || globalThis.__wogGearFusion.locked()) return JSON.stringify({action: cmd.action, requestId: cmd.requestId, success: false, reason: 'Workshop busy or unreconciled'});
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
  const autoStart = html.indexOf('    // Auto-fuse T3 checks');
  const autoEnd = html.indexOf('    // Log any fusion events', autoStart);
  if (autoStart < 0 || autoEnd < 0) throw Error('Legacy automatic scheduler missing');
  html = html.slice(0, autoStart) + '    // Unified rating 3/4 scheduler owns automatic gear fusion.\n\n' + html.slice(autoEnd);

  html = once(html, 'function applyLiveGameData(data) {', 'function applyLiveGameData(data) {\n  if (window.wogGearFusionTick) window.wogGearFusionTick(data && data.jewelsData);');
  const marker = 'if (data && data.action) {';
  if (html.split(marker).length !== 3) throw Error('Expected both LiveSync action handlers');
  html = html.replaceAll(marker, marker + '\n            if (window.wogGearFusionReply) window.wogGearFusionReply(data);');
  return once(html, '</body>', '<script>\n' + ui + '\n</script>\n</body>');
}
module.exports = {patchHook, patchFrontend};
