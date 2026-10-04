// Build-time replacement of the upstream file-IPC action queue. No game execution.
function patchBridge(source) {
  const start=source.indexOf('const evalQueue = [];');
  const end=source.indexOf('// ── Steam Community Market Query Engine',start);
  if(start<0||end<0)throw Error('Bridge queue anchors missing');
  const old=source.slice(start,end);
  const helpers=old.slice(old.indexOf('function writePendingEval'),old.indexOf('function enqueueEvalCommand'));
  return source.slice(0,start)+`const evalQueue = [];
let isQueueBusy = false, actionBlocked = false;
let ipcSequence = 0, recoveryUntil = 0;
const ipcSession = crypto.randomBytes(12).toString('hex');
${helpers}
function transportFault(socket,id,reason) {
  wsSend(socket,buildCdpResponse(id,{action:'workshopTransport',success:false,uncertain:true,code:'WORKSHOP_TRANSPORT_UNCERTAIN',reason}));
}
function fusionRecovery(code) {
  // Parse only the exact structured invocation emitted by queueJewelCmd; never eval.
  try {
    const start=code.indexOf('return await globalThis.__runJewelAction(');
    const end=code.indexOf('); } else',start);
    if(start<0||end<0)return null;
    const cmd=JSON.parse(code.slice(start+'return await globalThis.__runJewelAction('.length,end));
    if(cmd.automaticRound!==true||!['fuse','fuseGearTiers'].includes(cmd.action)||
       typeof cmd.requestId!=='string'||!/^round-[a-zA-Z0-9-]{1,90}$/.test(cmd.requestId)||
       !Number.isFinite(cmd.expiresAt)||cmd.expiresAt>Date.now()+15000)return null;
    return {action:cmd.action,requestId:cmd.requestId,expiresAt:cmd.expiresAt};
  }catch(_){return null;}
}
function itemFault(item,reason) {
  if(item.fusion){
    wsSend(item.socket,buildCdpResponse(item.id,{action:item.fusion.action,requestId:item.fusion.requestId,
      success:false,retryable:true,uncertain:false,code:'FUSION_TRANSPORT_RETRY',
      reason:'Fusion reply unavailable; next round will continue automatically.'}));
  }else transportFault(item.socket,item.id,reason);
}
function enqueueEvalCommand(reqId, code, socket) {
  if(actionBlocked){transportFault(socket,reqId,'Bridge action result uncertain; check the game before restarting LiveSync.');return;}
  const item={id:reqId,code,socket,queuedAt:Date.now(),fusion:fusionRecovery(code)};
  if(Date.now()<recoveryUntil){itemFault(item,'Bridge cooling down; command not submitted.');return;}
  evalQueue.push(item);
  processNextInQueue();
}
function processNextInQueue() {
  if(isQueueBusy||actionBlocked||!evalQueue.length)return;
  const item=evalQueue.shift();
  // A queued action must not start after its browser receipt deadline approaches.
  if(Date.now()-item.queuedAt>1000 || (item.fusion&&item.fusion.expiresAt<=Date.now())){
    itemFault(item,'Bridge queue delay; command not submitted. Check the game before restarting LiveSync.');
    if(item.fusion)recoveryUntil=Date.now()+60000;else actionBlocked=true;
    for(const queued of evalQueue.splice(0))itemFault(queued,'Bridge paused; queued command not submitted.');
    return;
  }
  isQueueBusy=true;
  const ipcId=ipcSession+'-'+(++ipcSequence);
  let pollInterval;
  function fail(reason) {
    clearInterval(pollInterval);isQueueBusy=false;
    if(item.fusion)recoveryUntil=Date.now()+60000;else actionBlocked=true;
    // Do not delete an uncertain in-flight command or claim it was cancelled.
    itemFault(item,reason);
    for(const queued of evalQueue.splice(0))itemFault(queued,'Bridge paused; queued command not submitted.');
  }
  try {
    cleanupPendingFiles();
    writePendingEval(JSON.stringify({id:ipcId,code:item.code}));
    const started=Date.now();
    pollInterval=setInterval(()=>{
      try {
        const data=checkAndClearResultFile();
        if(data&&data.id===ipcId){
          if(data.error||data.result==null){fail('Game action returned no usable receipt. Check the game before restarting LiveSync.');return;}
          clearInterval(pollInterval);
          wsSend(item.socket,buildCdpResponse(item.id,data.result));
          isQueueBusy=false;setImmediate(processNextInQueue);return;
        }
        if(Date.now()-started>=12000)fail('Bridge action timed out. Check the game before restarting LiveSync.');
      }catch(_){fail('Bridge receipt read failed. Check the game before restarting LiveSync.');}
    },20);
  }catch(_){fail('Bridge action dispatch failed. Check the game before restarting LiveSync.');}
}

`+source.slice(end);
}
module.exports={patchBridge};
