// Preservation matching and storage key ported from upstream d09f5f8.
// The fork adds a capability guard and correlated receipts for old-hook safety.
(() => {
  const key='genesis_autofuse_preserved_jewel_types';
  let preserved=[],invalid=false,pending=null,timer,uncertain=false;
  try {const saved=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(saved)||saved.some(x=>!Number.isInteger(x)||x<=0))throw Error();preserved=[...new Set(saved)];}catch(_){invalid=true;}
  window.isJewelPreserved = jewel => invalid || preserved.includes(Math.floor(Number(jewel.itemTid)/100)*100)||preserved.includes(Number(jewel.itemTid));
  const status=text=>{const node=document.getElementById('jewelPreserveStatus');if(node)node.textContent=text;};
  const baseTypes=()=>{
    const map=new Map();
    for(const item of jewelDatabase){if(item.id===9600)continue;const id=Math.floor(item.id/100)*100;
      if(!map.has(id))map.set(id,{id,name:window.zhText((item.name_vi||item.name_en||String(id)).replace(/\s*Cấp.*$/,'').trim())});}
    return [...map.values()];
  };
  function save(){invalid=false;localStorage.setItem(key,JSON.stringify(preserved));render();}
  function render(){
    const root=document.getElementById('jewelPreserveOptions');if(!root)return;root.replaceChildren();
    for(const base of baseTypes()){
      const row=document.createElement('div');row.style.cssText='display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin:8px 0';
      const name=document.createElement('span');name.textContent=base.name;name.style.cssText='width:125px;font-size:12px';row.append(name);
      for(const tier of [0,1,2,3,4,5,6]){
        const button=document.createElement('button'),exact=base.id+tier;
        const active=preserved.includes(base.id)||(tier>0?preserved.includes(exact):[1,2,3,4,5,6].every(t=>preserved.includes(base.id+t)));
        button.type='button';button.textContent=tier?'T'+tier:'全部';button.dataset.tid=exact;
        button.setAttribute('aria-pressed',String(active));button.title=base.name+' '+(tier?'T'+tier:'全部階級')+'：'+(active?'已保留':'可合成');
        button.style.cssText='padding:5px 7px;border-radius:5px;border:1px solid '+(active?'#3fb950':'#30363d')+';background:'+(active?'#164b2b':'#161b22')+';color:'+(active?'#7ee787':'#c9d1d9');
        button.addEventListener('click',()=>{
          if(!tier){preserved=preserved.filter(x=>x<base.id||x>base.id+6);if(!active)preserved.push(base.id);}
          else {if(preserved.includes(base.id)){preserved=preserved.filter(x=>x!==base.id);for(let t=1;t<=6;t++)if(t!==tier&&!preserved.includes(base.id+t))preserved.push(base.id+t);}
          else if(active)preserved=preserved.filter(x=>x!==exact);else preserved.push(exact);}
          save();
        });row.append(button);
      }root.append(row);
    }
    status(invalid?'保留設定無法讀取；已暫停寶石合成，請重新選擇保留項目。':'綠色代表保留；自動與手動合成都不會使用這些寶石。');
  }
  function mount(){
    const anchor=document.getElementById('gearFusionControls');if(!anchor)return;
    const box=document.createElement('details');box.id='jewelPreserveControls';box.style.cssText='margin:12px 0;padding:10px;border:1px solid #30363d;border-radius:8px';
    box.innerHTML='<summary style="cursor:pointer;font-weight:bold">🛡️ 寶石保留設定</summary><p id="jewelPreserveStatus" role="status" style="font-size:12px"></p><div id="jewelPreserveOptions"></div>';
    anchor.parentElement.append(box);render();
  }
  const original=queueJewelCmd;
  queueJewelCmd=function(cmd){
    if(!cmd)return;
    if(pending){status('寶石合成處理中，等待確認結果。');return;}
    if(cmd.action!=='fuse')return original(cmd);
    const cap=window.wogWorkshopCapability;
    if(invalid||uncertain||!cap||cap.version!==2||cap.jewelPreservation!==1||!cap.available||cap.busy||!Number.isFinite(cap.generatedAt)||Date.now()-cap.generatedAt>8000||cap.generatedAt>Date.now()+1000){status('請更新並連接 LiveSync；結果不明時請先確認遊戲，再重新載入。');return;}
    pending='jewel-'+crypto.randomUUID();window.wogJewelPending=pending;
    const id=pending;
    timer=setTimeout(()=>{if(pending===id){uncertain=true;pending=null;window.wogJewelPending=null;window.wogWorkshopReceipt?.({uncertain:true,reason:'No fusion receipt. Check the game before enabling again.'});status('未收到寶石合成結果；請先確認遊戲，再重新載入。');}},15000);
    original({...cmd,requestId:id,instance:cap.instance,preservedTypes:[...preserved]});
  };
  window.wogJewelPreservationReply=data=>{
    if(data.action!=='fuse'||!pending||data.requestId!==pending)return;
    clearTimeout(timer);pending=null;window.wogJewelPending=null;
    if(data.uncertain)uncertain=true;
    status(data.success===true?(data.fusedCount?'寶石合成完成，已確認材料消耗。':window.zhText(data.reason||'Insufficient unpreserved jewels')):window.zhText(data.reason||'Fusion stopped; check the game.'));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
