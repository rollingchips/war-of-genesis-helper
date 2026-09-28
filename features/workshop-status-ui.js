// Shared dispatch interlock. Diagnostics are separate from the rolling activity log.
(() => {
  const key='wog_workshop_first_fault';let fault=null,paused=false,instance=null,cap=null;
  try{fault=JSON.parse(sessionStorage.getItem(key)||'null');}catch(_){}
  function draw(){const node=document.getElementById('workshopFirstFault');if(node)node.textContent=fault?new Date(fault.at).toLocaleString()+' · '+window.zhText(fault.reason)+(fault.response?' · 回傳類型：'+({array:'陣列',object:'物件',undefined:'未提供',null:'空值',string:'文字',number:'數值',boolean:'布林值'}[fault.response.kind]||'未知')+'；結果碼：'+(fault.response.code??'未提供'):''):'尚無未確認的鍛造錯誤。';}
  function pause(reason,response){
    paused=true;
    if(!fault){fault={at:Date.now(),reason:reason||'Workshop blocked; check the game.',response};try{sessionStorage.setItem(key,JSON.stringify(fault));}catch(_){}draw();}
    isAutoFuseJewelActive=false;isAutoDepositJewelActive=false;isAutoDepositT3Active=false;
    window.isAutoFuseJewelActive=false;window.isAutoDepositJewelActive=false;window.isAutoDepositT3Active=false;
    for(const name of ['genesis_auto_fuse_jewel','genesis_auto_deposit_jewel','genesis_auto_deposit_t3'])localStorage.setItem(name,'false');
    updateJewelSwitches();
    window.wogGearFusionPause?.(reason);
  }
  window.wogWorkshopStatus=value=>{
    cap=value||null;
    if(!cap||typeof cap.instance!=='string'||!cap.instance)return;
    if(instance!==cap.instance){if(instance!==null)paused=false;instance=cap.instance;}
    if(cap.blocked)pause(cap.fault?.reason||cap.reason,cap.fault?.response);
  };
  window.wogWorkshopReceipt=data=>{
    if(data.uncertain||data.code==='WORKSHOP_BLOCKED')pause(data.reason,data.response);
  };
  const send=queueJewelCmd;
  queueJewelCmd=function(cmd){
    if(paused||cap?.blocked){pause(cap?.fault?.reason||fault?.reason);return;}
    if(cap?.busy)return;
    return send(cmd);
  };
  function mount(){
    const anchor=document.getElementById('gearFusionControls');if(!anchor)return;
    const box=document.createElement('div');box.style.cssText='padding:10px;margin:10px 0;border:1px solid #8b949e;border-radius:6px';
    box.innerHTML='<strong>鍛造首筆錯誤</strong><p id="workshopFirstFault" role="status" style="font-size:12px;overflow-wrap:anywhere"></p><button type="button" id="clearWorkshopFault">清除錯誤紀錄</button><p style="font-size:11px">此紀錄不會被活動紀錄洗掉；清除紀錄不會解除遊戲端的停止保護。</p>';
    anchor.parentElement.append(box);draw();
    document.getElementById('clearWorkshopFault').onclick=()=>{fault=null;sessionStorage.removeItem(key);draw();};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
