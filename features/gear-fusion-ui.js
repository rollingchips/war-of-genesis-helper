// One clock and one in-flight operation for both bag-only fusion round switches.
(() => {
  const PERIOD = 60000, ROUND_LIMIT = 300000;
  const state = {gear:false, jewel:false, due:{gear:Infinity,jewel:Infinity}, epoch:{gear:0,jewel:0}, round:null, pending:null, cap:null, uncertain:false};
  const watched = new WeakSet();
  let receiptTimer;
  const el = id => document.getElementById(id);
  const note = (kind,text) => {const node=el(kind==='gear'?'gearFusionStatus':'jewelFusionStatus');if(node)node.textContent=window.zhText(text);};
  const socket = () => (typeof liveWs!=='undefined' && liveWs?.readyState===1)?liveWs:window.GenesisGameBridge?.ws;
  const fresh = () => socket()?.readyState===1 && state.cap?.boundedFusionCommands===1 && state.cap?.dispatchOnlyFusion===1 && state.cap?.version===2 && state.cap?.bagOnlyRounds===1 && state.cap?.jewelPreservation===1 && state.cap?.gearSourceTiers?.includes(5) && state.cap?.available && Number.isFinite(state.cap.generatedAt) && Date.now()-state.cap.generatedAt<8000 && state.cap.generatedAt<=Date.now()+1000;
  function setEnabled(kind,on) {
    state.epoch[kind]++;state[kind]=on;state.due[kind]=on?Date.now()+PERIOD:Infinity;
    const input=el(kind==='gear'?'autoGearFusion':'autoJewelFusion');if(input)input.checked=on;
    if(kind==='jewel'){isAutoFuseJewelActive=on;window.isAutoFuseJewelActive=on;updateJewelSwitches();}
    note(kind,on?'已啟用；每分鐘開始一輪，只使用背包材料。':'已關閉；不再送出後續合成。');
  }
  function stop(reason) {
    for(const kind of ['gear','jewel']){setEnabled(kind,false);note(kind,reason);}
    // Keep pending receipt/timeout: turning a toggle off is not cancellation.
    state.round=null;
  }
  window.wogGearFusionPause=stop;
  function retryRound() {
    const id=state.pending?.requestId;
    clearTimeout(receiptTimer);state.pending=null;window.wogFusionPending=null;
    if(id){window.wogJewelRelease?.(id);if(window.__pendingJewelCmd?.requestId===id)window.__pendingJewelCmd=null;}
    state.round=null;
    for(const kind of ['gear','jewel'])if(state[kind]){state.due[kind]=Date.now()+PERIOD;note(kind,'未收到有效回覆，本輪結束；一分鐘後自動繼續。');}
  }
  window.wogFusionTransportRetry=data=>{
    if(!state.pending||data.requestId!==state.pending.requestId)return false;
    retryRound();return true;
  };
  window.wogGearFusionReply=data=>{
    const pending=state.pending;
    if(!pending || data.action!==pending.action || data.requestId!==pending.requestId)return;
    if(data.uncertain||data.retryable){retryRound();return;}
    clearTimeout(receiptTimer);state.pending=null;window.wogFusionPending=null;
    if(window.__pendingJewelCmd?.requestId===data.requestId)window.__pendingJewelCmd=null;
    if(data.code==='WORKSHOP_BUSY'){if(state.round)state.round=null;note(pending.kind,'遊戲忙碌，本輪結束；等待下次排程。');return;}
    if(data.success!==true){stop(data.reason||'Fusion stopped; check the game.');return;}
    if(data.dispatchedCount===1){
      if(typeof addJewelLog==='function'){
        const category=pending.kind==='jewel'?'寶石':pending.contentType===1?'裝備':'飾品';
        addJewelLog('▶ ['+new Date(pending.roundAt).toLocaleTimeString('zh-TW',{hour12:false})+' 本輪 #'+pending.batch+'] T'+pending.tier+' '+category+'已執行合成動作 1 次', 'info');
      }
      if(state.round)state.round.fused++;
      note(pending.kind,'已執行合成動作，繼續處理本輪。');
      return;
    }
    if(!Number.isInteger(data.fusedCount)||![0,1].includes(data.fusedCount)){retryRound();return;}
    if(data.fusedCount===1 && typeof addJewelLog==='function') {
      const category=pending.kind==='jewel'?'寶石':pending.contentType===1?'裝備':'飾品';
      addJewelLog('✅ ['+new Date(pending.roundAt).toLocaleTimeString('zh-TW',{hour12:false})+' 本輪 #'+pending.batch+'] T'+pending.tier+' '+category+'合成已確認完成 1 批', 'success');
    }
    if(state.round){
      if(data.fusedCount===0)state.round.index++;
      else state.round.fused++;
    }
    note(pending.kind,data.fusedCount===1?'本批合成已確認，繼續處理本輪。':'此階目前無可合成材料，跳過。');
  };
  window.wogGearFusionTick=data=>{
    const cap=data?.gearFusion;state.cap=cap||null;window.wogWorkshopCapability=state.cap;
    window.wogWorkshopStatus?.(state.cap);
    const ws=socket();
    if(ws&&!watched.has(ws)){watched.add(ws);ws.addEventListener?.('close',()=>{state.cap=null;window.wogWorkshopCapability=null;stop('Disconnected. Re-enable fusion only after reconnecting.');},{once:true});}
    for(const id of ['autoGearFusion','autoJewelFusion'])if(el(id))el(id).disabled=!fresh()||state.uncertain;
    if(!fresh()){stop(cap?.blocked?(cap.reason||'Fusion blocked; check the game.'):'Updated LiveSync connection required.');}
    // A profile is health data only. It never starts or advances a round.
  };
  function pump() {
    if(state.pending || state.uncertain)return;
    const now=Date.now();
    if(state.round && (now-state.round.started>=ROUND_LIMIT||state.round.commands>=1000)){
      for(const kind of state.round.kinds)note(kind,'本輪已達時間或批次上限，等待下次排程。');state.round=null;
      for(const kind of ['gear','jewel'])if(state[kind])state.due[kind]=now+PERIOD;
      return;
    }
    if(!fresh()){if(state.gear||state.jewel)stop('Fresh LiveSync data required.');return;}
    if(state.cap.busy||state.cap.gameBusy||window.wogJewelPending||window.__pendingJewelCmd)return;
    if(!state.round){
      const kinds=['gear','jewel'].filter(k=>state[k]&&now>=state.due[k]);if(!kinds.length)return;
      const jobs=[];
      for(const kind of kinds){
        state.due[kind]=now+PERIOD;
        if(kind==='gear')for(const contentType of [1,2])for(const tier of [3,4,5])jobs.push({kind,epoch:state.epoch[kind],action:'fuseGearTiers',contentType,sourceTier:tier});
        else for(const tier of [3,4,5])jobs.push({kind,epoch:state.epoch[kind],action:'fuse',tier,allowedTiers:[tier]});
      }
      state.round={kinds,jobs,index:0,started:now,commands:0,fused:0};
    }
    const round=state.round;
    while(round.index<round.jobs.length && (!state[round.jobs[round.index].kind] || round.jobs[round.index].epoch!==state.epoch[round.jobs[round.index].kind]))round.index++;
    if(round.index>=round.jobs.length){
      for(const kind of round.kinds){if(state[kind]){note(kind,'本輪完成，等待下一分鐘。');if(state.due[kind]<=now)state.due[kind]=now+PERIOD;}}
      state.round=null;return;
    }
    const {kind,epoch,...job}=round.jobs[round.index];
    const requestId='round-'+crypto.randomUUID();
    state.pending={kind,action:job.action,requestId,tier:job.sourceTier??job.tier,contentType:job.contentType,roundAt:round.started,batch:round.commands+1};window.wogFusionPending=requestId;
    note(kind,'正在送出合成動作。');
    receiptTimer=setTimeout(()=>{
      if(state.pending?.requestId!==requestId)return;
      retryRound();
    },15000);
    try{
      const accepted=queueJewelCmd({...job,automaticRound:true,expiresAt:Date.now()+15000,requestId,instance:state.cap.instance,includeStorage:false,sameLevelOnly:false});
      if(accepted===false){clearTimeout(receiptTimer);state.pending=null;window.wogFusionPending=null;state.round=null;note(kind,'尚未送出，等待下一分鐘。');}
      else round.commands++;
    }catch(_){retryRound();}
  }
  function mount(){
    const box=el('gearFusionControls');if(!box)return;
    box.innerHTML=`<style>
    #gearFusionControls .fusion-toggle{position:relative;display:block;flex-shrink:0;width:44px;height:22px}
    #gearFusionControls input{position:absolute;inset:0;width:44px;height:22px;margin:0;opacity:0;z-index:1;cursor:pointer}
    #gearFusionControls input+.jewel-switch{display:block;box-sizing:border-box}
    #gearFusionControls input:checked+.jewel-switch{background:#238636;border-color:#2ea043}
    #gearFusionControls input:checked+.jewel-switch::after{transform:translateX(20px);background:#fff}
    #gearFusionControls input:disabled+.jewel-switch{opacity:0.5}
    #gearFusionControls input:focus-visible+.jewel-switch{outline:2px solid #58a6ff;outline-offset:3px}
    </style>`+['gear','jewel'].map(kind=>{
      const gear=kind==='gear',id=gear?'autoGearFusion':'autoJewelFusion',label=gear?'gearFusionLabel':'jewelFusionLabel',status=gear?'gearFusionStatus':'jewelFusionStatus';
      return `<div class="jewel-switch-wrap" style="margin:0 0 10px;cursor:default"><label class="fusion-toggle"><input id="${id}" type="checkbox" role="switch" aria-labelledby="${label}" aria-describedby="${status}" disabled><span class="jewel-switch" aria-hidden="true"></span></label><span style="flex:1;min-width:0"><span id="${label}" style="display:block;font-weight:bold;color:#58a6ff">${gear?'T3～T5 裝備／飾品':'T3～T5 寶石'}</span><span style="display:block;font-size:11.5px;color:#8b949e">每分鐘一輪，僅背包 T3～T5；${gear?'每批 6 件裝備／3 件飾品，不混階、不限等級。':'每批 6 顆同階寶石，保留設定持續生效。'}</span><span id="${status}" role="status" style="display:block;font-size:11.5px;color:#8b949e">連線後可啟用；預設關閉。</span></span></div>`;
    }).join('');
    for(const kind of ['gear','jewel'])el(kind==='gear'?'autoGearFusion':'autoJewelFusion').addEventListener('change',e=>{
      if(e.target.checked&&(!fresh()||state.uncertain)){e.target.checked=false;return;}
      setEnabled(kind,e.target.checked);
    });
  }
  setInterval(pump,1000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
