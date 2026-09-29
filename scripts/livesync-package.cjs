// Build-only archive handling. Never execute installer or game scripts.
const cp = require('node:child_process');
const { unzipSync, strFromU8, strToU8 } = require('fflate');
const { englishBat, englishBridge } = require('./console-english.cjs');
const revision = require('../localization/upstream.json').commit;
const files = unzipSync(cp.execFileSync('git', ['show', revision + ':LiveSync_1Click.zip']));
const originalBat = strFromU8(files['cai_dat_livesync.bat']).replace(/\r\n/g, '\n');
const sourceLaunch = 'start "" "https://titlee2111.github.io/war-of-genesis-helper/"';
const localLaunch = [
  'if exist "%~dp0index.html" (',
  '    start "" "%~dp0index.html"',
  ') else (',
  '    echo [NOTICE] index.html is missing. Open your fork index.html manually.',
  ')',
].join('\n');
if (originalBat.split(sourceLaunch).length !== 2) throw Error('Unexpected upstream browser launch');
const bat = englishBat(originalBat.replace(sourceLaunch, localLaunch).replace(
  'echo        Dang mo Web Helper tai: https://titlee2111.github.io/war-of-genesis-helper/',
  'echo        Opening bundled fork: index.html'
));
function buildFiles() {
  return {
    'livesync_bridge.js': strToU8(require('./bridge-receipts.cjs').patchBridge(englishBridge(strFromU8(files['livesync_bridge.js'])))),
    'install_game_hook_v2.js': strToU8(require('./gear-fusion-extension.cjs').patchHook(strFromU8(files['install_game_hook_v2.js']))),
    'cai_dat_livesync.bat': strToU8(bat.replace(/\n/g, '\r\n'))
  };
}
module.exports = { bat, buildFiles };
