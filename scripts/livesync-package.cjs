// Build-only archive handling. Never execute installer or game scripts.
const cp = require('node:child_process');
const { zipSync, unzipSync, strFromU8, strToU8 } = require('fflate');
const revision = require('../localization/upstream.json').commit;
const files = unzipSync(cp.execFileSync('git', ['show', revision + ':LiveSync_1Click.zip']));
const originalBat = strFromU8(files['cai_dat_livesync.bat']).replace(/\r\n/g, '\n');
const sourceLaunch = 'start "" "https://titlee2111.github.io/war-of-genesis-helper/"';
const localLaunch = [
  'if exist "%~dp0wog-helper.html" (',
  '    start "" "%~dp0wog-helper.html"',
  ') else (',
  '    echo [NOTICE] wog-helper.html is missing. Open your fork index.html manually.',
  ')',
].join('\n');
if (originalBat.split(sourceLaunch).length !== 2) throw Error('Unexpected upstream browser launch');
const bat = originalBat.replace(sourceLaunch, localLaunch).replace(
  'echo        Dang mo Web Helper tai: https://titlee2111.github.io/war-of-genesis-helper/',
  'echo        Opening bundled fork: wog-helper.html'
);
function buildArchive(html) {
  const entries = { ...files, 'cai_dat_livesync.bat': strToU8(bat.replace(/\n/g, '\r\n')), 'wog-helper.html': strToU8(html) };
  return zipSync(Object.fromEntries(Object.entries(entries).map(([name, bytes]) => [name, [bytes, { mtime: new Date(2026, 0, 1, 0, 0, 0) }]])), { level: 6 });
}
module.exports = { bat, buildArchive };
