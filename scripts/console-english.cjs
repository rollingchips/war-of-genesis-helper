// Build-time presentation changes only. Never execute the Windows installer or bridge.
const acorn = require('acorn');
const mapping = require('../localization/console-en.json');
function englishBat(source) {
  const seen = new Set();
  const output = source.replace(/^(\s*echo\s+)(.*)$/gm, (line, prefix, text) => {
    const key = text.trimEnd();
    if (!Object.hasOwn(mapping.bat, key)) return line;
    const value = mapping.bat[key];
    if (/[^\x20-\x7e]|[&|<>^%]/.test(value)) throw Error('Unsafe BAT display text: ' + key);
    seen.add(key);
    return prefix + value;
  });
  for (const key of Object.keys(mapping.bat)) if (!seen.has(key)) throw Error('Missing BAT display anchor: ' + key);
  return output;
}
function englishBridge(source) {
  const edits = [], seen = new Set();
  function replacePart(node, text, quoted) {
    if (!Object.hasOwn(mapping.bridge, text)) return;
    const value = mapping.bridge[text];
    if (!quoted && /[`\\]|\$\{/.test(value)) throw Error('Unsafe template display text');
    edits.push({start:node.start,end:node.end,text:quoted ? JSON.stringify(value) : value});
    seen.add(text);
  }
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && (node.callee?.name === 'log' ||
      (node.callee?.object?.name === 'console' && ['log','warn','error'].includes(node.callee?.property?.name)))) {
      for (const arg of node.arguments) {
        if (arg.type === 'TemplateLiteral') for (const part of arg.quasis) replacePart(part,part.value.raw,false);
        else if (arg.type === 'Literal' && typeof arg.value === 'string') replacePart(arg,arg.value,true);
      }
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
  }
  walk(acorn.parse(source,{ecmaVersion:'latest'}));
  for (const key of Object.keys(mapping.bridge)) if (!seen.has(key)) throw Error('Missing bridge display anchor: ' + key);
  for (const edit of edits.sort((a,b)=>b.start-a.start)) source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  acorn.parse(source,{ecmaVersion:'latest'});
  return source;
}
module.exports={englishBat,englishBridge};
