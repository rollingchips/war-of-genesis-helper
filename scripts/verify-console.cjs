// Compare delivered executable structures without running installer or opening sockets.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),acorn=require('acorn');
const {unzipSync,strFromU8}=require('fflate');
const mapping=require('../localization/console-en.json');
const before=unzipSync(cp.execFileSync('git',['show',require('../localization/upstream.json').commit+':LiveSync_1Click.zip']));
const after=unzipSync(fs.readFileSync('LiveSync_1Click.zip'));
function ast(source, original) {
 const tree=acorn.parse(source,{ecmaVersion:'latest'});
 let count=0;
 function walk(node) {
  if(!node||typeof node!=='object')return;
  if(node.type==='CallExpression'&&(node.callee?.name==='log'||(node.callee?.object?.name==='console'&&['log','warn','error'].includes(node.callee?.property?.name)))) {
   for(const arg of node.arguments) if(arg.type==='TemplateLiteral') for(const part of arg.quasis) {
    if(original&&Object.hasOwn(mapping.bridge,part.value.raw)) {
     part.value.raw=mapping.bridge[part.value.raw];part.value.cooked=part.value.raw;count++;
    }
    assert(!/[\p{Script=Latin}]/u.test(part.value.raw.replace(/[\x00-\x7f]/g,'')),'Non-English authored console text');
   }
  }
  delete node.start;delete node.end;
  // Raw literal quote style is irrelevant, literal semantic values are not.
  if(node.type==='Literal')delete node.raw;
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
 }
 walk(tree);if(original)assert.equal(count,Object.keys(mapping.bridge).length);
 return tree;
}
assert.deepEqual(ast(strFromU8(after['livesync_bridge.js']),false),ast(strFromU8(before['livesync_bridge.js']),true),'Bridge expressions/control flow/protocol changed');
const bat=strFromU8(after['cai_dat_livesync.bat']);
assert.equal(bat.replace(/\r\n/g,'').includes('\n'),false,'BAT must use CRLF');
for(const value of Object.values(mapping.bat))assert(bat.includes(value),'Missing English prompt: '+value);
for(const source of Object.keys(mapping.bat))assert(!bat.includes(source),'Old Vietnamese prompt remains: '+source);
assert(bat.includes('node "%~dp0install_game_hook_v2.js"'));
assert(bat.includes('node "%~dp0livesync_bridge.js"'));
console.log(JSON.stringify({englishBatPrompts:Object.keys(mapping.bat).length,englishBridgeParts:Object.keys(mapping.bridge).length,bridgeExecutableAstPreserved:true,windowsExecution:false}));
