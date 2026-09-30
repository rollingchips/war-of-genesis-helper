const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),acorn=require('acorn');
const html=fs.readFileSync('index.html','utf8');
const context={window:{__currentEps:125},stageData:[],userLevelsData:{1:{req_exp:100},2:{req_exp:200}},getStageHistory:()=>[]};
vm.createContext(context);
for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
 const js=match[1];
 for(const node of acorn.parse(js,{ecmaVersion:'latest'}).body)if(node.type==='FunctionDeclaration'&&['levelUpEta','calculateRecentFarmExpPerSec'].includes(node.id.name))vm.runInContext(js.slice(node.start,node.end),context);
}
const eta=context.levelUpEta,rate=context.calculateRecentFarmExpPerSec;
assert.equal(rate(20,true),null); // Neither estimated-stage nor 125 fallback is evidence.
assert.equal(eta({},125),'估算中');
assert.equal(eta({expInfo:{curExp:0,maxExp:100}},null),'估算中');
assert.equal(eta({expInfo:{curExp:0,maxExp:3661}},1),'約 1 小時 1 分鐘');
assert.equal(eta({expInfo:{curExp:0,maxExp:61}},1),'約 1 分鐘 1 秒');
assert.equal(eta({expInfo:{curExp:0,maxExp:90000}},1),'約 1 天 1 小時');
assert.equal(eta({expInfo:{curExp:100,maxExp:100}},null),'可升級');
assert.equal(eta({expInfo:{curExp:-1,maxExp:100}},1),'估算中');
assert.equal(eta({level:2,currencies:{2000:{count:'150'}}},10),'約 5 秒');
context.getStageHistory=()=>[
 {status:'success',duration:10,total_exp:100},
 {status:'success',duration:10,total_exp:200},
 {status:'success',duration:10,total_exp:1000,isPartial:true},
 {status:'failed',duration:10,total_exp:1000},
 {status:'success',duration:Infinity,total_exp:100},
 {status:'success',duration:10,total_exp:NaN}
];
assert.equal(rate(20,true),15);
assert.equal(rate(1,true),10);
assert(html.includes("levelUpEta(data, calculateRecentFarmExpPerSec(20, true))"));
console.log('Level ETA: observed-only rate, missing/invalid progress, duration units and top-bar wiring passed');
