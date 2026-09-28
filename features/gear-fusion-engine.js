function createGearFusion(getGame, timeoutMs = 10000) {
  let busy = false, blocked = false, lastSnapshot = 0, fault = null;
  const responseShape = r => ({kind:Array.isArray(r)?"array":r===null?"null":typeof r, code: typeof r?.NetResult === "number" || typeof r?.NetResult === "string" ? String(r.NetResult).slice(0,40) : null, length:Array.isArray(r)?r.length:null});
  const seen = new Map();
  const rejected = new Map();
  const instance = 't4-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  function inventory() {
    const n = getGame(), w = n.services.workshop;
    if (!w || !['getTableInfo', 'findFusionTable', 'validateFusionMaterials', 'reqFusionAsync', 'clearFusionStaging', 'setFusionContentType', 'setAutoRegisterRating', 'setAutoRegisterIncludeStorage'].every(k => typeof w[k] === 'function') ||
        typeof n.services.itemMove?.isEquippedItemId !== 'function' || typeof n.services.steamMarket?.staging?.isStaged !== 'function') throw Error('Required item safety checks are unavailable');
    const raw = n.net.data.item.getAllItemNotStack();
    if (!Array.isArray(raw) || raw.length > 5000) throw Error('Unsupported inventory');
    const ids = new Set(), rows = [];
    for (const i of raw) {
      if (i.itemId == null) continue;
      const id = String(i.itemId);
      if (ids.has(id)) throw Error('Duplicate inventory identity');
      ids.add(id);
      if ((typeof i.isLock !== 'boolean' && typeof i._isLock !== 'boolean') || i.isLock || i._isLock || ![1, 2].includes(i.location) || n.services.itemMove.isEquippedItemId(i.itemId) || n.services.steamMarket.staging.isStaged(i.itemId)) continue;
      const eq = n.db.equip.get(i.itemTid);
      if (!eq || ![1, 2, 3, 4].includes(eq.RatingType)) continue;
      const info = w.getTableInfo(i.itemTid, i.itemId);
      const level = info?.baseLimitLevel > 0 ? info.baseLimitLevel : eq.LimitLevel;
      if (![1, 2].includes(info?.contentType) || !Number.isFinite(level) || level <= 0) continue;
      rows.push({id, itemId: i.itemId, itemTid: i.itemTid, level, rating: eq.RatingType, type: info.contentType, location: i.location});
    }
    return {n, w, raw, rows};
  }
  function status() {
    const base = {version: 2, jewelPreservation: 1, instance, busy, blocked, generatedAt: Date.now(), fault, reason:fault?.reason};
    try {
      const {rows} = inventory(); lastSnapshot = Date.now();
      const counts = {};
      for (const tier of [1, 2, 3, 4]) for (const type of [1, 2]) {
        const matches = rows.filter(i => i.rating === tier && i.type === type);
        counts[tier + ':' + type] = {bag: matches.filter(i => i.location === 1).length, storage: matches.filter(i => i.location === 2).length};
      }
      return {...base, available: !blocked, counts};
    } catch (e) { return {...base, available: false, reason: e.message}; }
  }
  function select(data, cmd) {
    const rows = data.rows.filter(i => i.type === cmd.contentType && i.rating === cmd.sourceTier && (i.location === 1 || cmd.includeStorage === true)).sort((a,b) => a.id.localeCompare(b.id));
    const count = cmd.contentType === 1 ? 6 : 3;
    const key = cmd.sourceTier + ':' + cmd.contentType + ':' + (cmd.includeStorage === true);
    const fingerprint = JSON.stringify(rows.map(i => [i.id,i.itemTid,i.level,i.location]));
    if (rows.length < count) return {reason: 'Insufficient eligible materials', availableCount: rows.length, requiredCount: count};
    if (rejected.get(key)?.fingerprint === fingerprint) return rejected.get(key).result;
    let attempts = 0, foundRecipe = false;
    // Sliding windows and one-item substitutions cover common rejected-head cases,
    // with a fixed CPU/validator budget rather than combinatorial search.
    const visited = new Set();
    const candidates = [];
    for (let start=0; start<=rows.length-count && candidates.length<32; start++) candidates.push(rows.slice(start,start+count));
    for (let i=count; i<rows.length && candidates.length<64; i++) for (let slot=0;slot<count && candidates.length<64;slot++) {
      const items=rows.slice(0,count);items[slot]=rows[i];candidates.push(items);
    }
    for (const items of candidates) {
      const signature=items.map(i=>i.id).sort().join('|');if(visited.has(signature))continue;visited.add(signature);
      const table = data.w.findFusionTable(cmd.contentType, cmd.sourceTier, Math.max(...items.map(i => i.level)));
      if (!table || table.FusionID == null) continue;
      foundRecipe = true; attempts++;
      const materials = items.map(i => ({itemId: i.itemId, itemTid: i.itemTid, itemCnt: 1}));
      if (data.w.validateFusionMaterials(table, materials) === true) { rejected.delete(key); return {table, materials, items}; }
    }
    const result={reason: foundRecipe ? 'Game rejected candidate materials' : 'No matching game recipe', availableCount:rows.length,requiredCount:count,attempts};
    rejected.set(key,{fingerprint,result});return result;
  }
  async function execute(cmd) {
    const receipt = {action: 'fuseGearTiers', requestId: cmd.requestId};
    if (typeof cmd.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,96}$/.test(cmd.requestId)) return {...receipt, success: false, reason: 'Invalid request identity'};
    if (seen.has(cmd.requestId)) return {...receipt, success: false, reason: 'Duplicate request; no action repeated'};
    if (seen.size >= 10000) return {...receipt, success: false, reason: 'Session request limit reached'};
    seen.set(cmd.requestId, true);
    if (busy || blocked || cmd.instance !== instance || (![1, 2].includes(cmd.contentType) || ![1, 2, 3, 4].includes(cmd.sourceTier)) || Date.now() - lastSnapshot > 10000) return {...receipt, success: false, reason: 'Unavailable, stale or busy fusion session'};
    busy = true;
    let sent = false, timer, responseInfo;
    try {
      const data = inventory();
      data.w.setFusionContentType(cmd.contentType);
      data.w.setAutoRegisterRating('Fusion', cmd.sourceTier);
      data.w.setAutoRegisterIncludeStorage('Fusion', cmd.includeStorage === true);
      const plan = select(data, cmd);
      if (!plan.items) return {...receipt, success: true, fusedCount: 0, ...plan};
      // Re-check the authoritative materials immediately before submission.
      const fresh = inventory();
      if (!plan.items.every(i => fresh.rows.some(x => x.id === i.id && x.itemTid === i.itemTid && x.type === i.type && x.rating === i.rating && x.level === i.level && (x.location === 1 || cmd.includeStorage === true))) ||
          fresh.w.validateFusionMaterials(plan.table, plan.materials) !== true) throw Error('Materials changed before submission');
      fresh.w.clearFusionStaging();
      sent = true;
      const pending = Promise.resolve(fresh.w.reqFusionAsync(plan.table.FusionID, plan.materials));
      const response = await Promise.race([pending, new Promise((_, reject) => {timer = setTimeout(() => reject(Error('Fusion timed out; reconcile in game before restarting LiveSync')), timeoutMs);})]);
      clearTimeout(timer);
      responseInfo=responseShape(response);
      if (!response || ![0, 1000].includes(response.NetResult)) throw Error('Fusion response was unsuccessful or uncertain');
      const after = fresh.n.net.data.item.getAllItemNotStack();
      if (!Array.isArray(after) || plan.items.some(i => after.some(x => String(x.itemId) === i.id))) throw Error('Fusion materials are not reconciled; check the game before restarting LiveSync');
      try { fresh.n.msgBroker.publish('onUpdateWorkShopFusion'); } catch (_) {}
      return {...receipt, success: true, fusedCount: 1};
    } catch (e) {
      if (sent) {blocked = true;if(!fault)fault={reason:e.message,response:responseInfo,requestId:cmd.requestId};}
      return {...receipt, success: false, uncertain: sent, reason: e.message, response:responseInfo};
    } finally { clearTimeout(timer); busy = false; }
  }
  async function executeJewel(cmd) {
    const receipt={action:'fuse',requestId:cmd.requestId};
    if (typeof cmd.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,96}$/.test(cmd.requestId) || seen.has(cmd.requestId)) return {...receipt,success:false,reason:'Invalid or duplicate request identity'};
    if (seen.size>=10000) return {...receipt,success:false,reason:'Session request limit reached'};
    seen.set(cmd.requestId,true);
    if (busy || blocked || cmd.instance!==instance || Date.now()-lastSnapshot>10000 || !Array.isArray(cmd.preservedTypes) || cmd.preservedTypes.some(x=>!Number.isInteger(x)||x<=0)) return {...receipt,success:false,reason:'Unavailable, stale or busy fusion session'};
    busy=true;let sent=false,timer,responseInfo;
    try {
      const {n,w}=inventory();
      if (!['stageFusionItem','isFusionStagingFull','reqFusionStagedAsync'].every(k=>typeof w[k]==='function')) throw Error('Required jewel preservation checks are unavailable');
      const tiers=cmd.tier!=null?[cmd.tier]:cmd.allowedTiers;
      if (!Array.isArray(tiers)||!tiers.length||tiers.some(t=>!Number.isInteger(t)||t<1||t>6)) throw Error('No allowed tiers configured');
      // Upstream d09f5f8: a base TID preserves all tiers; an exact TID preserves one.
      const preserved=tid=>cmd.preservedTypes.includes(Math.floor(Number(tid)/100)*100)||cmd.preservedTypes.includes(Number(tid));
      const eligible=()=>{
        const raw=n.net.data.item.getAllItemNotStack();
        if(!Array.isArray(raw)||raw.length>5000)throw Error('Unsupported inventory');
        const ids=new Set();for(const i of raw){if(!i||i.itemId==null)continue;const id=String(i.itemId);if(ids.has(id))throw Error('Duplicate inventory identity');ids.add(id);}
        return raw.filter(i=>{
        if (!i || i.itemId==null || (typeof i.isLock!=='boolean'&&typeof i._isLock!=='boolean') || i.isLock||i._isLock||!(i.location===1||(cmd.includeStorage===true&&i.location===2))||preserved(i.itemTid))return false;
        if(n.services.itemMove.isEquippedItemId(i.itemId)||n.services.steamMarket.staging.isStaged(i.itemId))return false;
        const db=n.db.item.get(i.itemTid);return db?.ItemType===6&&tiers.includes(db.RatingType);
      });};
      let selected=[];
      const rows=eligible();
      for(const tier of tiers){const group=rows.filter(i=>n.db.item.get(i.itemTid).RatingType===tier);if(group.length>=6){selected=group.slice(0,6);break;}}
      if(!selected.length)return {...receipt,success:true,fusedCount:0,reason:'Insufficient unpreserved jewels'};
      const fresh=eligible();if(!selected.every(i=>fresh.some(x=>String(x.itemId)===String(i.itemId)&&x.itemTid===i.itemTid)))throw Error('Materials changed before submission');
      w.clearFusionStaging();w.setFusionContentType(20);w.setAutoRegisterIncludeStorage('Fusion',cmd.includeStorage===true);
      for(const i of selected)w.stageFusionItem(i.itemTid,i.itemId);
      if(w.isFusionStagingFull()!==true){w.clearFusionStaging();return {...receipt,success:true,fusedCount:0,reason:'Game rejected candidate materials'};}
      sent=true;
      const response=await Promise.race([Promise.resolve(w.reqFusionStagedAsync()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Fusion timed out; reconcile in game before restarting LiveSync')),timeoutMs);})]);
      clearTimeout(timer);
      responseInfo=responseShape(response);
      // Staged jewel API returns result items, unlike the direct equipment API.
      if(!Array.isArray(response)||response.length===0)throw Error('Fusion response was unsuccessful or uncertain');
      const after=n.net.data.item.getAllItemNotStack();
      if(!Array.isArray(after)||selected.some(i=>after.some(x=>String(x.itemId)===String(i.itemId))))throw Error('Fusion materials are not reconciled; check the game before restarting LiveSync');
      w.clearFusionStaging();try{n.msgBroker.publish('onUpdateWorkShopFusion');}catch(_){}
      return {...receipt,success:true,fusedCount:1};
    }catch(e){if(sent){blocked=true;if(!fault)fault={reason:e.message,response:responseInfo,requestId:cmd.requestId};}return {...receipt,success:false,uncertain:sent,reason:e.message,response:responseInfo};}
    finally{clearTimeout(timer);busy=false;}
  }
  return {status, execute, executeJewel, locked: () => busy || blocked};
}
