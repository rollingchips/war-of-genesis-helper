// Build-time retirement of the upstream count-driven/storage automations.
const acorn=require('acorn');
function span(html,start,end,replacement=''){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 if(a<0||b<0)throw Error('Minute-round anchor missing: '+start);
 return html.slice(0,a)+replacement+html.slice(b);
}
function patchMinuteFrontend(html){
 html=span(html,'      <div class="jewel-switch-wrap" onclick="toggleAutoFuseJewels()">','      <div id="gearFusionControls">');
 html=span(html,'      <div class="jewel-switch-wrap" onclick="toggleIncludeStorageJewels()">','      <!-- AUTO EQUIP BEST WEAPONS ON CLASS SWITCH -->');
 const group=html.indexOf('id="jewelTierCheckboxGroup"');
 const a=html.lastIndexOf('      <div style="margin-top:14px; padding-top:12px; border-top:1px solid #30363d;">',group);
 const b=html.indexOf('\n    </div>\n\n    <!-- ACTIVITY LOG PANEL -->',group);
 if(a<0||b<0)throw Error('Tier selection block missing');
 html=html.slice(0,a)+html.slice(b);
 html=span(html,'    // AUTO-AUTOMATION LOOP (checked every 2s poll)','    // Re-render jewel section if visible','    // Automatic fusion is owned by the minute-round scheduler. No automatic deposits.\n\n');
 for(const [name,key] of [['isAutoFuseJewelActive','auto_fuse_jewel'],['isIncludeStorageJewelActive','include_storage_jewel'],['isAutoDepositJewelActive','auto_deposit_jewel'],['isAutoDepositT3Active','auto_deposit_t3']]){
  const old=`window.${name} = localStorage.getItem('genesis_${key}') !== 'false'; // Default TRUE`;
  if(!html.includes(old))throw Error('Missing saved preference '+name);
  html=html.replace(old,`window.${name} = false; // Retired stored preferences never activate automation.`);
 }
 const tiersStart='let autoFuseAllowedTiers = [1, 2]; // SAFEGUARD: Default only Tier 1 & 2 jewels';
 html=span(html,tiersStart,'function toggleJewelTierFuse(tier)', 'const autoFuseAllowedTiers = Object.freeze([3,4,5]);\n\n');
 const noop=new Set(['toggleAutoFuseJewels','toggleIncludeStorageJewels','toggleAutoDepositJewels','setAutoDepositJewelTargetStorage','toggleAutoDepositT3','setAutoDepositT3TargetStorage','toggleJewelTierFuse','selectAllJewelTiers','renderJewelTierCheckboxes']);
 html=html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,(_,open,js,close)=>{
  const edits=[];
  for(const n of acorn.parse(js,{ecmaVersion:'latest'}).body){
   if(n.type==='FunctionDeclaration'&&noop.has(n.id.name))edits.push([n.start,n.end,`function ${n.id.name}() { /* Retired: two minute-round switches own automation. */ }`]);
   if(n.type==='FunctionDeclaration'&&n.id.name==='queueJewelCmd'){
    let raw=js.slice(n.start,n.end).replace('if (!cmd) return;','if (!cmd) return false;');
    raw=raw.replace('      }));\n    } catch(e) {','      }));\n      return true;\n    } catch(e) {');
    raw=raw.replace('      window.__pendingJewelCmd = null;\n    }','      window.__pendingJewelCmd = null;\n      window.wogWorkshopReceipt?.({action:cmd.action,requestId:cmd.requestId,retryable:cmd.automaticRound===true,uncertain:true,reason:"No fusion receipt. Check the game before enabling again."});\n      throw e;\n    }');
    raw=raw.replace(/\n}$/, '\n  return false;\n}');
    edits.push([n.start,n.end,raw]);
   }
  }
  for(const [a,b,text]of edits.sort((a,b)=>b[0]-a[0]))js=js.slice(0,a)+text+js.slice(b);
  return open+js+close;
 });
 html=html.replaceAll("sWorkshop.setAutoRegisterIncludeStorage('Fusion', true)","sWorkshop.setAutoRegisterIncludeStorage('Fusion', false)");
 html=html.replaceAll('(it.location === 1 || it.location === 2)', 'it.location === 1');
 html=html.replaceAll("if (typeof addJewelLog === 'function') {", "if (typeof addJewelLog === 'function' && !data.requestId?.startsWith('round-')) {");
 // The overview now describes actual eligible inventory, not retired warehouse use.
 html=html.replace('Gom cả Balo & Kho (trừ ngọc đang khảm trên người)','僅使用背包材料；排除鎖定、穿戴與保留寶石');
 return html;
}
module.exports={patchMinuteFrontend};
