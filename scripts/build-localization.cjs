// Reproducible offline localization of the pinned upstream single-file application.
const fs = require('node:fs');
const cp = require('node:child_process');
const acorn = require('acorn');
const upstream = '068353206c5f043c6a45b49ac2df636fca96af48';
let html = cp.execFileSync('git', ['show', upstream + ':index.html'], {maxBuffer: 12 * 1024 * 1024}).toString();
const terms = {};
for (const line of fs.readFileSync('localization/zh-Hant.tsv', 'utf8').split(/\r?\n/)) {
  if (!line.includes('\t')) continue;
  const [source, target] = line.split('\t');
  if (!source || !target) throw Error('Invalid translation row');
  terms[source.toLowerCase()] = target;
}
const patterns = JSON.parse(fs.readFileSync('localization/skill-patterns.json', 'utf8'));
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp('(?<![\\p{L}_])(?:' + Object.keys(terms).sort((a,b) => b.length-a.length).map(esc).join('|') + ')(?![\\p{L}_])', 'giu');
function translate(s) {
  for (const [source, target] of patterns) {
    const r = new RegExp(source.split('{}').map(esc).join('(\\d+(?:\\.\\d+)?)'), 'giu');
    s = s.replace(r, (...args) => target.replace(/\{(\d+)\}/g, (_, i) => args[Number(i)+1]));
  }
  return s.replace(regex, m => terms[m.toLowerCase()]);
}
const exact = {};
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'ObjectExpression') {
    const fields = {};
    for (const p of node.properties) if (p.type === 'Property' && p.value.type === 'Literal' && typeof p.value.value === 'string') fields[p.key.name || p.key.value] = p.value.value;
    for (const [key, value] of Object.entries(fields)) {
      if (key.endsWith('_vi') && fields[key.slice(0,-3)+'_en']) exact[fields[key.slice(0,-3)+'_en']] = translate(value);
    }
  }
  if (node.type === 'VariableDeclarator' && node.id.name === 'I18N_DICT') {
    for (const p of node.init.properties) if (p.key.type === 'Literal' && p.value.type === 'Literal') exact[p.value.value] = translate(p.key.value);
  }
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
}
for (const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) walk(acorn.parse(script[1], {ecmaVersion:'latest'}));
// Do not override explicit whole-phrase translations with upstream language aliases.
for (const [key, value] of Object.entries(exact)) if (terms[key.toLowerCase()]) exact[key] = terms[key.toLowerCase()];
function patch(before, after) {
  if (!html.includes(before)) throw Error('Missing patch anchor: ' + before);
  html = html.replace(before, () => after);
}
patch('<html lang="vi">', '<html lang="zh-Hant">');
const start = html.indexOf('        <div class="lang-switch-group');
const end = html.indexOf('\n        </div>', start) + '\n        </div>'.length;
if (start < 0 || end < start) throw Error('Missing language controls');
html = html.slice(0,start) + '        <div class="lang-switch-group" title="顯示語言"><span class="lang-btn active">繁體中文</span></div>' + html.slice(end);
patch("const savedLang = localStorage.getItem('genesis_helper_lang') || 'vi';", "const savedLang = 'zh-Hant';");
// Reuse upstream's non-English data branch without changing its source values.
patch('function switchLanguage(lang) {', "function switchLanguage(lang) {\n  lang = 'zh-Hant';");
const domStart = html.indexOf('function updateDOMTranslations(lang) {');
const domEnd = html.indexOf('\nfunction switchLanguage', domStart);
html = html.slice(0,domStart) + 'function updateDOMTranslations() {\n  window.applyTraditionalChinese();\n}\n' + html.slice(domEnd);
patch("if (q && !e.name_vi.toLowerCase().includes(q) && !e.name_en.toLowerCase().includes(q) && !(e.slot_name || '').toLowerCase().includes(q)) return false;", "if (q && !zhSearch(e.name_vi, q) && !zhSearch(e.name_en, q) && !zhSearch(e.slot_name, q)) return false;");
patch("if (!vName.includes(query) && !eName.includes(query) && !oTexts.includes(query)) return false;", "if (!zhSearch(vName, query) && !zhSearch(eName, query) && !zhSearch(oTexts, query)) return false;");
patch("(s.display_tag && s.display_tag.toLowerCase().includes(query))", "zhSearch(s.display_tag, query)");
patch("(s.area_name && s.area_name.toLowerCase().includes(query))", "zhSearch(s.area_name, query)");
patch("(s.difficulty && s.difficulty.toLowerCase().includes(query))", "zhSearch(s.difficulty, query)");
patch("g.name.toLowerCase().includes(q) || String(g.itemTid).includes(q)", "zhSearch(g.name, q) || String(g.itemTid).includes(q)");
let runtime = fs.readFileSync('localization/runtime.js', 'utf8');
for (const [key,value] of Object.entries({__ZH_EXACT__:exact, __ZH_TERMS__:terms, __ZH_PATTERNS__:patterns})) runtime = runtime.replace(key, () => JSON.stringify(value).replace(/</g,'\\u003c'));
patch('</head>', '<style>\n'+fs.readFileSync('localization/layout.css','utf8')+'\n</style>\n<script>\n'+runtime+'\n</script>\n</head>');
// Parsing every script prevents localization edits from producing a broken artifact.
for (const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) acorn.parse(script[1], {ecmaVersion:'latest'});
fs.writeFileSync('index.html', html);
console.log(`Built zh-Hant: ${Object.keys(terms).length} glossary entries, ${Object.keys(exact).length} exact display aliases, ${patterns.length} skill patterns.`);
