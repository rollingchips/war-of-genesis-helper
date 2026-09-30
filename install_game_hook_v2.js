const fs = require('fs');
const path = require('path');

const initPath = path.join(
  process.env.USERPROFILE,
  'AppData/LocalLow/Newnormal Soft/War of Genesis Idle Loot/scripts/src/init.bundle.mjs'
);

if (!fs.existsSync(initPath)) {
  console.error('File not found:', initPath);
  process.exit(1);
}

let code = fs.readFileSync(initPath, 'utf8');

// Strip previous hook if present
if (code.includes('LIVESYNC REALTIME IN-GAME HOOK')) {
  const idx = code.indexOf('// === LIVESYNC REALTIME IN-GAME HOOK ===');
  code = code.substring(0, idx);
}

const hook = `
// === LIVESYNC REALTIME IN-GAME HOOK ===
;(()=>{
  try {
    if (typeof CS !== 'undefined' && CS.UnityEngine && CS.UnityEngine.Debug) {
      CS.UnityEngine.Debug.Log("[LiveSync Hook v3.2] Full Jewel Forge, Storage & T3 Fusion Engine READY!");
    }
  } catch(e) {}

  globalThis.__wogGearFusion = (function createGearFusion(getGame, timeoutMs = 10000) {
  const sourceTiers = Object.freeze([1, 2, 3, 4, 5]);
  let busy = false, blocked = false, lastSnapshot = 0, fault = null;
  const responseShape = r => ({kind:Array.isArray(r)?"array":r===null?"null":typeof r, code: typeof r?.NetResult === "number" || typeof r?.NetResult === "string" ? String(r.NetResult).slice(0,40) : null, length:Array.isArray(r)?r.length:null});
  const seen = new Map();
  const rejected = new Map();
  const instance = 't4-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  function gameBusy() { return getGame()?.services?.workshop?._bRequesting !== false; }
  const deferred = receipt => ({...receipt, success:true, fusedCount:0, code:'WORKSHOP_BUSY', reason:'Workshop busy; wait for the current action.'});
  function inventory() {
    const n = getGame(), w = n.services.workshop;
    if (!w || !['getTableInfo', 'findFusionTable', 'validateFusionMaterials', 'reqFusionAsync'].every(k => typeof w[k] === 'function') ||
        typeof n.services.itemMove?.isEquippedItemId !== 'function' || typeof n.services.steamMarket?.staging?.isStaged !== 'function') throw Error('Required item safety checks are unavailable');
    if (typeof w._bRequesting !== 'boolean' || typeof n.db.fusion?.get !== 'function') throw Error('Required workshop preflight checks are unavailable');
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
      if (!eq || !sourceTiers.includes(eq.RatingType)) continue;
      const info = w.getTableInfo(i.itemTid, i.itemId);
      const level = info?.baseLimitLevel > 0 ? info.baseLimitLevel : eq.LimitLevel;
      if (![1, 2].includes(info?.contentType) || !Number.isFinite(level) || level <= 0) continue;
      rows.push({id, itemId: i.itemId, itemTid: i.itemTid, level, rating: eq.RatingType, type: info.contentType, location: i.location});
    }
    return {n, w, raw, rows};
  }
  function status() {
    const base = {version: 2, jewelPreservation: 1, bagOnlyRounds: 1, gearSourceTiers: [...sourceTiers], instance, busy:busy || gameBusy(), gameBusy:gameBusy(), preflight:1, blocked, generatedAt: Date.now(), fault, reason:fault?.reason};
    try {
      const {rows} = inventory(); lastSnapshot = Date.now();
      const counts = {};
      for (const tier of sourceTiers) for (const type of [1, 2]) {
        const matches = rows.filter(i => i.rating === tier && i.type === type);
        counts[tier + ':' + type] = {bag: matches.filter(i => i.location === 1).length, storage: matches.filter(i => i.location === 2).length};
      }
      return {...base, available: !blocked, counts};
    } catch (e) { return {...base, available: false, reason: e.message}; }
  }
  function select(data, cmd) {
    const rows = data.rows.filter(i => i.type === cmd.contentType && i.rating === cmd.sourceTier && i.location === 1).sort((a,b) => a.id.localeCompare(b.id));
    const count = cmd.contentType === 1 ? 6 : 3;
    const key = cmd.sourceTier + ':' + cmd.contentType;
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
    if (busy || blocked || cmd.instance !== instance || (![1, 2].includes(cmd.contentType) || !sourceTiers.includes(cmd.sourceTier)) || Date.now() - lastSnapshot > 10000) return {...receipt, success: false, reason: 'Unavailable, stale or busy fusion session'};
    if (gameBusy()) return deferred(receipt);
    busy = true;
    let sent = false, timer, responseInfo, diagnostics = {phase:'selection', contentType:cmd.contentType, sourceTier:cmd.sourceTier};
    try {
      const data = inventory();
      // Explicit materials need no staging/settings mutations or UI events.
      const plan = select(data, cmd);
      if (!plan.items) return {...receipt, success: true, fusedCount: 0, ...plan};
      // Re-check the authoritative materials immediately before submission.
      const fresh = inventory();
      const recipe = fresh.n.db.fusion.get(plan.table.FusionID);
      diagnostics = {...diagnostics, phase:'preflight', requesting:fresh.w._bRequesting, fusionId:plan.table.FusionID, groupId:recipe?.GroupID ?? null, recipeFound:!!recipe, materialCount:plan.materials.length, recipeContentType:recipe?.ContentType ?? null, recipeRating:recipe?.MaterialRating ?? null, recipeCount:recipe?.MaterialRatingCnt ?? null};
      if (gameBusy()) return deferred(receipt);
      if (!recipe || recipe.FusionID !== plan.table.FusionID || recipe.ContentType !== cmd.contentType || recipe.MaterialRating !== cmd.sourceTier || recipe.MaterialRatingCnt !== plan.materials.length) throw Error('Game recipe changed before submission');
      if (!plan.items.every(i => fresh.rows.some(x => x.id === i.id && x.itemTid === i.itemTid && x.type === i.type && x.rating === i.rating && x.level === i.level && x.location === 1)) ||
          (diagnostics.materialsValid = fresh.w.validateFusionMaterials(recipe, plan.materials) === true) !== true) throw Error('Materials changed before submission');
      diagnostics.requesting = fresh.w._bRequesting;
      if (gameBusy()) return deferred(receipt);
      diagnostics.phase = 'workshop-call';
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
      if (sent) {blocked = true;if(!fault)fault={reason:e.message,response:responseInfo,requestId:cmd.requestId,diagnostics};}
      return {...receipt, success: false, uncertain: sent, reason: e.message, response:responseInfo, diagnostics};
    } finally { clearTimeout(timer); busy = false; }
  }
  async function executeJewel(cmd) {
    const receipt={action:'fuse',requestId:cmd.requestId};
    if (typeof cmd.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,96}$/.test(cmd.requestId) || seen.has(cmd.requestId)) return {...receipt,success:false,reason:'Invalid or duplicate request identity'};
    if (seen.size>=10000) return {...receipt,success:false,reason:'Session request limit reached'};
    seen.set(cmd.requestId,true);
    if (busy || blocked || cmd.instance!==instance || Date.now()-lastSnapshot>10000 || !Array.isArray(cmd.preservedTypes) || cmd.preservedTypes.some(x=>!Number.isInteger(x)||x<=0)) return {...receipt,success:false,reason:'Unavailable, stale or busy fusion session'};
    if (gameBusy()) return deferred(receipt);
    busy=true;let sent=false,timer,responseInfo;
    try {
      const {n,w}=inventory();
      if (!['clearFusionStaging','setFusionContentType','setAutoRegisterIncludeStorage','stageFusionItem','isFusionStagingFull','reqFusionStagedAsync'].every(k=>typeof w[k]==='function')) throw Error('Required jewel preservation checks are unavailable');
      const tiers=cmd.tier!=null?[cmd.tier]:cmd.allowedTiers;
      if (!Array.isArray(tiers)||!tiers.length||tiers.some(t=>!Number.isInteger(t)||t<1||t>(cmd.automaticRound===true?5:6))) throw Error('No allowed tiers configured');
      // Upstream d09f5f8: a base TID preserves all tiers; an exact TID preserves one.
      const preserved=tid=>cmd.preservedTypes.includes(Math.floor(Number(tid)/100)*100)||cmd.preservedTypes.includes(Number(tid));
      const eligible=()=>{
        const raw=n.net.data.item.getAllItemNotStack();
        if(!Array.isArray(raw)||raw.length>5000)throw Error('Unsupported inventory');
        const ids=new Set();for(const i of raw){if(!i||i.itemId==null)continue;const id=String(i.itemId);if(ids.has(id))throw Error('Duplicate inventory identity');ids.add(id);}
        return raw.filter(i=>{
        if (!i || i.itemId==null || (typeof i.isLock!=='boolean'&&typeof i._isLock!=='boolean') || i.isLock||i._isLock||i.location!==1||preserved(i.itemTid))return false;
        if(n.services.itemMove.isEquippedItemId(i.itemId)||n.services.steamMarket.staging.isStaged(i.itemId))return false;
        const db=n.db.item.get(i.itemTid);return db?.ItemType===6&&tiers.includes(db.RatingType);
      });};
      let selected=[];
      const rows=eligible();
      for(const tier of tiers){const group=rows.filter(i=>n.db.item.get(i.itemTid).RatingType===tier);if(group.length>=6){selected=group.slice(0,6);break;}}
      if(!selected.length)return {...receipt,success:true,fusedCount:0,reason:'Insufficient unpreserved jewels'};
      const fresh=eligible();if(!selected.every(i=>fresh.some(x=>String(x.itemId)===String(i.itemId)&&x.itemTid===i.itemTid)))throw Error('Materials changed before submission');
      if (gameBusy()) return deferred(receipt);
      w.clearFusionStaging();w.setFusionContentType(20);w.setAutoRegisterIncludeStorage('Fusion',false);
      for(const i of selected)w.stageFusionItem(i.itemTid,i.itemId);
      if(w.isFusionStagingFull()!==true){w.clearFusionStaging();return {...receipt,success:true,fusedCount:0,reason:'Game rejected candidate materials'};}
      if (gameBusy()) return deferred(receipt);
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
  return {status, execute, executeJewel, locked: () => busy || blocked || gameBusy()};
}
)(() => nn);

  let lastDump = 0;
  let isEvaluating = false;
  let jewelFusedHistory = [];

  if (!globalThis.__stageTracker) {
    globalThis.__stageTracker = {
      currentRun: null,
      completedRuns: [],
      lastRecordedGameId: null
    };
  }
  if (!globalThis.__liveCombatTracker) {
    globalThis.__liveCombatTracker = {
      totalDamage: 0,
      normalDamage: 0,
      skillDamage: 0,
      hitCount: 0,
      startTime: Date.now()
    };
  }

  // Helper to dump enriched profile to disk instantly (Universal AppData + Game Dir)
  function dumpEnrichedProfile() {
    try {
      if (typeof nn === 'undefined' || !nn || !nn.netData || !nn.netData._mapContainer) return;
      if (typeof CS === 'undefined' || !CS.UnityEngine || !CS.UnityEngine.Application || !CS.NTSHelper) return;

      let pPath = null;
      let dPath = null;
      try { pPath = CS.UnityEngine.Application.persistentDataPath; } catch(_) {}
      try { dPath = CS.UnityEngine.Application.dataPath; } catch(_) {}

      const targetFiles = [];
      if (pPath) targetFiles.push(pPath + '/user_save_profile_enriched.json');
      if (dPath) targetFiles.push(dPath + '/../user_save_profile_enriched.json');
      if (targetFiles.length === 0) return;

      let userC, stageC, treeC, presetC, itemC, dungC;
      for (let [k, v] of nn.netData._mapContainer.entries()) {
        const name = k.name || k.toString();
        if (name === 'NetContainerUser') userC = v;
        if (name === 'NetContainerStage') stageC = v;
        if (name === 'NetContainerTree') treeC = v;
        if (name === 'NetContainerPreset') presetC = v;
        if (name === 'NetContainerItem') itemC = v;
        if (name === 'NetContainerDungeonInfo') dungC = v;
      }

      const currencies = {};
      if (itemC && itemC._mapItemStack) {
        for (let k of itemC._mapItemStack.keys()) {
          const it = itemC._mapItemStack.getValue(k);
          if (it) currencies[k] = { tid: it._itemTid, count: it._cnt ? it._cnt.toString() : '0' };
        }
      }

      // Extract all jewels for Lò Rèn & Kho Ngọc
      const jewels = [];
      let totalStorage = 42;
      let usedStorage = 0;

      // Count Tier 3 Gear & Accessories across Bag (1) and Storage (2)
      let t3GearInv = 0;
      let t3GearStorage = 0;
      let t3AccInv = 0;
      let t3AccStorage = 0;
      const t3GearByLevel = {};
      const t3AccByLevel = {};

      try {
        if (nn.net && nn.net.data && nn.net.data.item) {
          const allItems = nn.net.data.item.getAllItemNotStack();
          usedStorage = allItems.filter(i => i.location === 2).length;
          
          let storagePlus = 0;
          try {
            if (nn.services && nn.services.contentState) {
              storagePlus = Number(nn.services.contentState.getValue(1107) || 0);
            }
          } catch(e) {}
          totalStorage = (1 + storagePlus) * 42;

          for (let it of allItems) {
            // Jewel check
            const dbInfo = nn.db.item ? nn.db.item.get(it.itemTid) : null;
            if (dbInfo && dbInfo.ItemType === 6) { // 6 = Jewel (Ngọc)
              const loc = nn.db.locale ? nn.db.locale.get(dbInfo.ItemName) : null;
              jewels.push({
                itemId: it.itemId ? it.itemId.toString() : '',
                itemTid: it.itemTid,
                name: loc?.VI || loc?.EN || dbInfo.ItemName,
                rating: dbInfo.RatingType,
                icon: dbInfo.Icon || dbInfo.ItemIcon || '',
                location: it.location, // 1: Balo, 2: Kho, 3: Khảm
                slot: it.slotIdx,
                isLock: !!(it.isLock || it._isLock)
              });
            }

            // Tier 3 Gear & Acc check (Balo 1 & Kho 2)
            if (!it.isLock && !it._isLock && (it.location === 1 || it.location === 2)) {
              const dbEq = nn.db.equip ? nn.db.equip.get(it.itemTid) : null;
              if (dbEq && dbEq.RatingType === 3) {
                const isGear = dbEq.EquipType === 1 || (dbEq.PartsType && dbEq.PartsType <= 8);
                const isAcc = dbEq.EquipType === 2 || (dbEq.PartsType && dbEq.PartsType >= 9);
                let itemLv = (dbEq && dbEq.LimitLevel) || 1;
                try {
                  const ws = nn.services && nn.services.workshop;
                  const info = ws ? ws.getTableInfo(it.itemTid, it.itemId) : null;
                  if (info && info.baseLimitLevel > 0) itemLv = info.baseLimitLevel;
                } catch(e) {}

                if (isGear) {
                  if (it.location === 1) t3GearInv++;
                  else if (it.location === 2) t3GearStorage++;
                  t3GearByLevel[itemLv] = (t3GearByLevel[itemLv] || 0) + 1;
                } else if (isAcc) {
                  if (it.location === 1) t3AccInv++;
                  else if (it.location === 2) t3AccStorage++;
                  t3AccByLevel[itemLv] = (t3AccByLevel[itemLv] || 0) + 1;
                }
              }
            }
          }
        }
      } catch(je) {}

      const t3GearCount = t3GearInv + t3GearStorage;
      const t3AccCount = t3AccInv + t3AccStorage;
      const t3GearMaxSameLevel = Math.max(0, ...Object.values(t3GearByLevel));
      const t3GearReadySameLevel = Object.values(t3GearByLevel).reduce((acc, cnt) => acc + Math.floor(cnt / 6), 0);
      const t3AccMaxSameLevel = Math.max(0, ...Object.values(t3AccByLevel));
      const t3AccReadySameLevel = Object.values(t3AccByLevel).reduce((acc, cnt) => acc + Math.floor(cnt / 3), 0);

      const jewelsData = {
        gearFusion: globalThis.__wogGearFusion.status(),
        jewels: jewels,
        storageUsed: usedStorage,
        storageTotal: totalStorage,
        includeStorage: true,
        fusedHistory: jewelFusedHistory.splice(0, jewelFusedHistory.length),
        depositedCount: 0,
        withdrawnCount: 0,
        t3GearCount: t3GearCount,
        t3GearInvCount: t3GearInv,
        t3GearStorageCount: t3GearStorage,
        t3GearMaxSameLevel: t3GearMaxSameLevel,
        t3GearReadySameLevel: t3GearReadySameLevel,
        t3AccCount: t3AccCount,
        t3AccInvCount: t3AccInv,
        t3AccStorageCount: t3AccStorage,
        t3AccMaxSameLevel: t3AccMaxSameLevel,
        t3AccReadySameLevel: t3AccReadySameLevel
      };

      // Read current primary preset number
      let curPrimaryNo = 1;
      try {
        if (nn.services && nn.services.preset) {
          curPrimaryNo = nn.services.preset.currentPrimaryNo || 1;
        }
      } catch(_) {}

      const equippedGear = [];
      if (nn.net && nn.net.data && nn.net.data.preset) {
        const p3 = nn.net.data.preset.getPresetNoData(3, curPrimaryNo) || nn.net.data.preset.getPresetNoData(3, 1);
        if (p3 && p3._map) {
          p3._map.forEach((val, k) => {
            if (val && val._info && val._info._itemTid) {
              equippedGear.push({
                id: val._info._itemId ? val._info._itemId.toString() : '',
                tid: val._info._itemTid,
                location: 1,
                slot: Number(k),
                parts_type: Number(k),
                equip_type: 1,
                options: val._info._randomOptions || []
              });
            }
          });
        }
        const p4 = nn.net.data.preset.getPresetNoData(4, curPrimaryNo) || nn.net.data.preset.getPresetNoData(4, 1);
        if (p4 && p4._map) {
          p4._map.forEach((val, k) => {
            if (val && val._info && val._info._itemTid) {
              equippedGear.push({
                id: val._info._itemId ? val._info._itemId.toString() : '',
                tid: val._info._itemTid,
                location: 1,
                slot: Number(k),
                parts_type: Number(k),
                equip_type: 2,
                options: val._info._randomOptions || []
              });
            }
          });
        }
      }

      const trainingSkills = {};
      const skillTreeAllocations = {};
      if (treeC && treeC._mapTreeInfo) {
        const cat1 = treeC._mapTreeInfo.get(1);
        if (cat1 && cat1.keys) {
          for (let sk of cat1.keys()) {
            const node = cat1.getValue(sk);
            if (node && node._treeTid) trainingSkills[sk] = { tid: node._treeTid, level: (node._treeTid % 100) };
          }
        }
        const cat4 = treeC._mapTreeInfo.get(4);
        if (cat4 && cat4.keys) {
          for (let sk of cat4.keys()) {
            const node = cat4.getValue(sk);
            if (node && node._treeTid) {
              const baseGid = (Math.floor(node._treeTid / 1000) * 1000) + 10;
              const realLevel = Math.max(1, Math.min(10, Math.floor((node._treeTid - baseGid) / 10) + 1));
              skillTreeAllocations[sk] = { tid: node._treeTid, level: realLevel };
            }
          }
        }
      }

      let altarLevel = 28;
      if (treeC && treeC._mapTreeInfo) {
        const cat3 = treeC._mapTreeInfo.get(3);
        if (cat3 && cat3.keys) {
          for (let k of cat3.keys()) {
            const node = cat3.getValue(k);
            if (node && node._treeTid) altarLevel = (node._treeTid % 100);
          }
        }
      }

      const heroSvc = nn.services && nn.services.hero;
      const liveHeroTid = (heroSvc && heroSvc.getCurrentHeroTid) ? heroSvc.getCurrentHeroTid() : 204;
      const liveClassType = (heroSvc && heroSvc.getCurrentHeroClassType) ? heroSvc.getCurrentHeroClassType() : 2;
      let heroClass = 'Ranged';
      if (liveClassType === 3 || liveHeroTid >= 300) heroClass = 'Mage';
      else if (liveClassType === 2 || (liveHeroTid >= 200 && liveHeroTid < 300)) heroClass = 'Ranged';
      else if (liveClassType === 1 || liveHeroTid < 200) heroClass = 'Melee';

      // Dynamic extraction for Pet, Wing, Rune, Machina
      let petInfo = { tid: 610010, level: 1 };
      let wingInfo = { tid: 420050, level: 1 };
      let runeInfo = { tid: 520030, level: 1 };
      let machinaInfo = { tid: null, level: 0, unlocked: false };

      try {
        const pC = (nn.net && nn.net.data && nn.net.data.preset) ? nn.net.data.preset : presetC;
        function extractPresetTid(typeId) {
          if (!pC) return null;
          try {
            const pData = (pC.getPresetNoData ? (pC.getPresetNoData(typeId, curPrimaryNo) || pC.getPresetNoData(typeId, 1)) : null);
            if (pData && pData._map) {
              let res = null;
              if (pData._map.forEach) {
                pData._map.forEach((val) => {
                  if (!res && val && val._info && val._info._itemTid) {
                    res = {
                      tid: val._info._itemTid,
                      level: val._info._lv || val._info._level || 1
                    };
                  }
                });
              } else if (pData._map.entries) {
                for (let [slot, val] of pData._map.entries()) {
                  if (val && val._info && val._info._itemTid) {
                    res = {
                      tid: val._info._itemTid,
                      level: val._info._lv || val._info._level || 1
                    };
                    break;
                  }
                }
              }
              return res;
            }
          } catch(e) {}
          return null;
        }

        const livePet = extractPresetTid(5);
        if (livePet && livePet.tid) petInfo = livePet;
        const liveRune = extractPresetTid(6);
        if (liveRune && liveRune.tid) runeInfo = liveRune;
        const liveWing = extractPresetTid(7);
        if (liveWing && liveWing.tid) wingInfo = liveWing;

        // Machina check in _mapItemMachina
        const mItemC = (nn.net && nn.net.data && nn.net.data.item) ? nn.net.data.item : itemC;
        if (mItemC && mItemC._mapItemMachina) {
          const mapM = mItemC._mapItemMachina;
          const machinaSize = (mapM.size !== undefined) ? mapM.size : (mapM.keys ? (typeof mapM.keys === 'function' ? mapM.keys().length : mapM.keys.length) : 0);
          if (machinaSize > 0) {
            let highestMachinaTid = null;
            let mLevel = 1;
            if (typeof mapM.forEach === 'function') {
              mapM.forEach((mObj, k) => {
                highestMachinaTid = k;
                if (mObj && (mObj._lv || mObj._level)) mLevel = mObj._lv || mObj._level;
              });
            } else if (mapM.keys) {
              for (let k of mapM.keys()) {
                highestMachinaTid = k;
                const mObj = mapM.getValue(k);
                if (mObj && (mObj._lv || mObj._level)) mLevel = mObj._lv || mObj._level;
              }
            }
            machinaInfo = { tid: highestMachinaTid, level: mLevel, unlocked: true };
          } else {
            machinaInfo = { tid: null, level: 0, unlocked: false };
          }
        }
      } catch(e) {}

      function enrichItemName(info) {
        if (!info || !info.tid) return info;
        try {
          if (nn.db && nn.db.item && nn.db.locale) {
            const dbIt = nn.db.item.get(info.tid);
            if (dbIt && dbIt.ItemName) {
              const loc = nn.db.locale.get(dbIt.ItemName);
              if (loc && loc.ko) info.name = loc.ko;
              else if (loc && loc.en) info.name = loc.en;
            }
          }
        } catch(_) {}
        return info;
      }
      enrichItemName(petInfo);
      enrichItemName(wingInfo);
      enrichItemName(runeInfo);
      if (machinaInfo.tid) enrichItemName(machinaInfo);

      const systemsData = {
        pet: petInfo,
        wing: wingInfo,
        rune: runeInfo,
        machina: machinaInfo,
        altar: { level: altarLevel }
      };

      let liveRaidDamage = 0;
      let liveWorldBossDamage = 0;
      let liveRaidPlayCount = 0;
      let liveWorldBossPlayCount = 0;
      let d3Info = null;
      let d2Info = null;
      if (dungC) {
        try {
          const d3 = dungC.getDungeonInfo(3);
          if (d3) {
            liveRaidPlayCount = d3._playCnt || 0;
            d3Info = {
              dungeonTid: d3._dungeonTid || 20000,
              dungeonType: 3,
              playCount: d3._playCnt || 0,
              clearCount: d3._clearCnt || 0,
              records: d3._dungeonRecords || []
            };
            if (d3._dungeonRecords) {
              const rec1 = d3._dungeonRecords.find(function(r) { return r._type === 1 || r.type === 1; });
              if (rec1 && rec1._value) liveRaidDamage = Number(rec1._value) || 0;
            }
          }
          const d2 = dungC.getDungeonInfo(2);
          if (d2) {
            liveWorldBossPlayCount = d2._playCnt || 0;
            d2Info = {
              dungeonTid: d2._dungeonTid || 10000,
              dungeonType: 2,
              playCount: d2._playCnt || 0,
              clearCount: d2._clearCnt || 0,
              records: d2._dungeonRecords || []
            };
            if (d2._dungeonRecords) {
              const rec1 = d2._dungeonRecords.find(function(r) { return r._type === 1 || r.type === 1; });
              if (rec1 && rec1._value) liveWorldBossDamage = Number(rec1._value) || 0;
            }
          }
        } catch(e) {}
      }

      let sUser, sCombat, sContent, sTree, sStage, sDungeon;
      try {
        if (nn.services && nn.services._mapService) {
          for (let [k, v] of nn.services._mapService.entries()) {
            const name = k.name || k.toString();
            if (name === 'ServiceUser' || name.includes('ServiceUser')) sUser = v;
            if (name === 'ServiceCombat' || name.includes('ServiceCombat')) sCombat = v;
            if (name === 'ServiceContentState' || name.includes('ContentState')) sContent = v;
            if (name === 'ServiceTree' || name.includes('ServiceTree')) sTree = v;
            if (name === 'ServiceStage' || name.includes('ServiceStage')) sStage = v;
            if (name === 'ServiceDungeon' || name.includes('ServiceDungeon')) sDungeon = v;
          }
        }
      } catch(_) {}
      if (!sCombat && nn.services && nn.services.combat) sCombat = nn.services.combat;
      if (!sUser && nn.services && nn.services.user) sUser = nn.services.user;
      if (!sTree && nn.services && nn.services.tree) sTree = nn.services.tree;
      if (!sContent && nn.services && nn.services.contentState) sContent = nn.services.contentState;
      if (!sStage && nn.services && nn.services.stage) sStage = nn.services.stage;
      if (!sDungeon && nn.services && nn.services.dungeon) sDungeon = nn.services.dungeon;

      let expInfo = null;
      try {
        if (sUser && sUser.getCurrentExpInfo) {
          const rawExp = sUser.getCurrentExpInfo();
          if (rawExp) {
            const curExp = Number(rawExp.curExp || 0);
            const maxExp = Number(rawExp.maxExp || 1);
            expInfo = {
              level: rawExp.level || (userC && userC._user ? userC._user._lv : 47),
              curExp: curExp,
              maxExp: maxExp,
              expRemaining: Math.max(0, maxExp - curExp),
              expRate: rawExp.expRate !== undefined ? rawExp.expRate : (curExp / maxExp),
              isMaxLevel: !!rawExp.isMaxLevel
            };
          }
        }
      } catch(_) {}

      const stats = {};
      try {
        if (sContent && sContent._compositeAbilityMap) {
          const getAb = (t) => {
            const val = sContent._compositeAbilityMap.get(t);
            return val !== undefined ? Number(val) : 0;
          };
          const bAtk = getAb(3001), fAtk = getAb(1001), pAtk = getAb(1003);
          const bDef = getAb(3002), fDef = getAb(1005), pDef = getAb(1007);
          const bHp = getAb(3003), fHp = getAb(1009), pHp = getAb(1011);
          const bAtkSpd = getAb(3004), pAtkSpd = getAb(1013);
          const bCrit = getAb(3006), fCrit = getAb(1017);
          const bCritDmg = getAb(3007), fCritDmg = getAb(1019);
          const bMove = getAb(3005), pMove = getAb(1015);

          stats.finalAttack = Math.round((bAtk + fAtk) * (1 + pAtk / 100)) || 2330;
          stats.finalDefense = Math.round((bDef + fDef) * (1 + pDef / 100)) || 4142;
          stats.finalHp = Math.round((bHp + fHp) * (1 + pHp / 100)) || 25150;
          stats.finalAttackSpeed = Number((100 + pAtkSpd).toFixed(1)) || 117;
          stats.finalCriticalRate = Number((bCrit + fCrit).toFixed(1)) || 29.7;
          stats.finalCriticalDamage = Number((100 + bCritDmg + fCritDmg).toFixed(1)) || 174.7;
          stats.moveSpeed = Number((bMove * (1 + pMove / 100)).toFixed(1)) || 322.8;
          stats.damageReduction = Number(getAb(1059).toFixed(1));
          stats.naturalRecovery = Math.round(getAb(1095));
          stats.naturalRecoveryPct = Number(getAb(1096).toFixed(1));
          stats.pveDefense = Number(getAb(1056).toFixed(1));
          stats.pvpDefense = Number(getAb(1067).toFixed(1));
          stats.pveBonus = Number(getAb(1054).toFixed(1));
          stats.pvpBonus = Number(getAb(1065).toFixed(1));
          stats.bossBonus = Number(getAb(1057).toFixed(1));
          stats.damageBonus = Number(getAb(1058).toFixed(1));
          stats.critDmgResist = Number(getAb(1068).toFixed(1));
          stats.skillCooldownReduction = Number(getAb(1082).toFixed(1));
          stats.lightningDamage = Number(getAb(1032).toFixed(1));
          stats.poisonDamage = Number(getAb(1042).toFixed(1));
          stats.ignoreBlock = Math.round(getAb(1092));
        } else if (sContent && sContent.getValue) {
          stats.finalAttack = sContent.getValue(101) || 1337.6;
          stats.finalDefense = sContent.getValue(102) || 2219.9;
          stats.finalHp = sContent.getValue(103) || 9671.5;
          stats.finalAttackSpeed = sContent.getValue(104) || 115.95;
          stats.finalCriticalRate = sContent.getValue(106) || 23.6;
          stats.finalCriticalDamage = sContent.getValue(107) || 192.7;
          stats.damageBonus = sContent.getValue(1058) || 0;
          stats.pveBonus = sContent.getValue(1054) || 0;
          stats.bossBonus = sContent.getValue(1057) || 0;
          stats.pvpBonus = sContent.getValue(1065) || 0;
        }
      } catch(_) {}

      let stageTid = 14306;
      let clearStageTid = 14306;
      let maxUnlockedStageTid = 14306;
      try {
        if (stageC && stageC._stageInfo) {
          stageTid = stageC._stageInfo._stageTid || stageTid;
          clearStageTid = stageC._stageInfo._clearStageTid || stageTid;
          maxUnlockedStageTid = Math.max(stageTid, clearStageTid + 1);
        }
      } catch(_) {}

      const stageRuns = (globalThis.__stageTracker && globalThis.__stageTracker.completedRuns) ? globalThis.__stageTracker.completedRuns.slice(0, 100) : [];
      const curRun = (globalThis.__stageTracker && globalThis.__stageTracker.currentRun) ? {
        stage_id: globalThis.__stageTracker.currentRun.stageId,
        duration: Math.max(0.1, Math.round((globalThis.__stageTracker.currentRun.duration || 0) * 10) / 10),
        status: 'running',
        timestamp: globalThis.__stageTracker.currentRun.startTime
      } : null;

      // Active Deployed Combat Skills
      let deployedSkills = [];
      try {
        if (sCombat && typeof sCombat.createMySkillTids === 'function') {
          deployedSkills = sCombat.createMySkillTids() || [];
        }
      } catch(_) {}
      if ((!deployedSkills || deployedSkills.length === 0) && nn.net && nn.net.data && nn.net.data.preset) {
        try {
          const p2 = nn.net.data.preset.getPresetNoData(2, curPrimaryNo) || nn.net.data.preset.getPresetNoData(2, 1);
          if (p2 && p2._map) {
            deployedSkills = [];
            p2._map.forEach(val => {
              if (val && val._info && val._info._itemTid) {
                deployedSkills.push(val._info._itemTid);
              }
            });
          }
        } catch(_) {}
      }

      let liveCombatPower = null;
      if (nn.services && nn.services.combatPower) {
        try {
          const scp = nn.services.combatPower;
          if (scp._beforeCombatPower) {
            liveCombatPower = Math.round(Number(scp._beforeCombatPower));
          } else if (typeof scp.getCombatPower === 'function') {
            liveCombatPower = Math.round(Number(scp.getCombatPower()));
          } else if (scp._combatPower) {
            liveCombatPower = Math.round(Number(scp._combatPower));
          }
        } catch(_) {}
      }
      if (!liveCombatPower && userC && userC._profile && userC._profile._combatPower) {
        liveCombatPower = Math.round(Number(userC._profile._combatPower));
      }
      if (!liveCombatPower) liveCombatPower = 0;

      const payload = {
        nickname: userC && userC._user ? userC._user._nick : 'Lee',
        level: userC && userC._user ? userC._user._lv : 46,
        combatPower: String(liveCombatPower),
        stageTid: stageTid,
        clearStageTid: clearStageTid,
        maxUnlockedStageTid: maxUnlockedStageTid,
        heroTid: liveHeroTid,
        heroClass: heroClass,
        currentPrimaryNo: curPrimaryNo,
        deployedSkills: deployedSkills,
        liveSkillLevels: skillTreeAllocations,
        raidDamage: liveRaidDamage,
        worldBossDamage: liveWorldBossDamage,
        specialBattles: {
          raidDamage: liveRaidDamage,
          raidPlayCount: liveRaidPlayCount,
          worldBossDamage: liveWorldBossDamage,
          worldBossPlayCount: liveWorldBossPlayCount
        },
        specialBattleHistory: (globalThis.__specialBattleTracker && globalThis.__specialBattleTracker.completedBattles) || [],
        liveSpecialBattle: (function() {
          var c = globalThis.__specialBattleTracker && globalThis.__specialBattleTracker.current;
          if (!c) return null;
          var nowSB = Date.now();
          var durSB = Math.max(0.1, Math.round(((nowSB - (c.startTime || nowSB)) / 1000) * 10) / 10);
          return Object.assign({}, c, { duration: durSB });
        })(),
        dungeonInfo: {
          raid: d3Info,
          worldBoss: d2Info
        },
        currencies: currencies,
        jewelsData: jewelsData,
        equippedGear: equippedGear,
        trainingSkills: trainingSkills,
        skillTreeAllocations: skillTreeAllocations,
        systemsData: systemsData,
        altarLevel: altarLevel,
        stats: stats,
        expInfo: expInfo,
        stageRunHistory: stageRuns,
        currentStageRun: curRun,
        liveCombatTracker: globalThis.__liveCombatTracker || null,
        isLiveConnected: true,
        liveSyncSource: 'game_hook_v3',
        exportedAt: new Date().toISOString()
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      for (const tf of targetFiles) {
        try { CS.NTSHelper.WriteAllText(tf, jsonStr); } catch(_) {}
      }
    } catch(err) {}
  }

  // ── IN-GAME JEWEL & STORAGE ACTION HANDLER ────────────────────────────────
  globalThis.__runJewelAction = async function(cmd) {
    if (!cmd || !cmd.action) return JSON.stringify({ error: 'No action specified' });
    try {
      const executeMoveItemsToStorage = async (gs, allItems, toDeposit, targetStorage, actionName, itemTypeName = 'món đồ') => {
        if (!toDeposit || toDeposit.length === 0) {
          return JSON.stringify({ success: true, action: actionName, count: 0, msg: 'Balo không có ' + itemTypeName + ' chưa khóa nào để cất!' });
        }

        let storagePlus = 0;
        try {
          if (nn.services && nn.services.contentState) {
            storagePlus = Number(nn.services.contentState.getValue(1107) || 0);
          }
        } catch(e) {}
        const totalTabs = 1 + storagePlus;
        const target = targetStorage || 'auto';

        if (target && target !== 'auto') {
          const tabIdx = parseInt(target, 10);
          if (isNaN(tabIdx) || tabIdx < 1 || tabIdx > totalTabs) {
            return JSON.stringify({ success: false, action: actionName, count: 0, reason: 'Kho ' + tabIdx + ' chưa được mở khóa (Hiện bạn có ' + totalTabs + ' kho)!' });
          }
          const startSlot = (tabIdx - 1) * 42;
          const endSlot = tabIdx * 42 - 1;
          const occupied = new Set(allItems.filter(it => it.location === 2).map(it => it.slotIdx));
          const freeSlots = [];
          for (let s = startSlot; s <= endSlot; s++) {
            if (!occupied.has(s)) freeSlots.push(s);
          }
          if (freeSlots.length === 0) {
            return JSON.stringify({ success: false, action: actionName, count: 0, reason: 'Kho ' + tabIdx + ' đã đầy (0/42 ô trống)!' });
          }
          const countToMove = Math.min(toDeposit.length, freeSlots.length);
          let movedCount = 0;
          for (let i = 0; i < countToMove; i++) {
            const res = await gs.reqStorageMoveIn(toDeposit[i], freeSlots[i]);
            if (res && res.NetResult === 1000) {
              movedCount++;
            }
          }
          dumpEnrichedProfile();
          return JSON.stringify({
            success: true,
            action: actionName,
            targetStorage: tabIdx,
            count: movedCount,
            totalAttempted: countToMove,
            msg: 'Đã cất thành công ' + movedCount + ' ' + itemTypeName + ' vào Kho ' + tabIdx + '!'
          });
        } else {
          // Auto deposit: move into available slots across all unlocked storage tabs
          const totalStorage = totalTabs * 42;
          const usedStorage = allItems.filter(i => i.location === 2).length;
          const avail = Math.max(0, totalStorage - usedStorage);
          if (avail === 0) {
            return JSON.stringify({ success: false, action: actionName, count: 0, reason: 'Tất cả kho đồ đã đầy!' });
          }
          const chunk = toDeposit.slice(0, avail);
          const res = await gs.reqStorageMoveInList(chunk);
          dumpEnrichedProfile();
          const netRes = res ? (res.NetResult || 0) : 0;
          return JSON.stringify({
            success: (netRes === 1000 || netRes === 0),
            action: actionName,
            targetStorage: 'auto',
            count: chunk.length,
            res: netRes,
            msg: 'Đã cất ' + chunk.length + ' ' + itemTypeName + ' vào kho đồ (Tự động)!'
          });
        }
      };

      if (cmd.action === 'depositAll' || (cmd.action === 'deposit' && cmd.allBag)) {
        const gs = nn.net.manager.gameSession;
        const allItems = nn.net.data.item.getAllItemNotStack();
        const toDeposit = [];
        for (let it of allItems) {
          if (it.location === 1 && !it.isLock && !it._isLock) {
            toDeposit.push(it.itemId);
          }
        }
        return await executeMoveItemsToStorage(gs, allItems, toDeposit, cmd.targetStorage, 'depositAll', 'món đồ');
      }

      if (cmd.action === 'deposit') {
        const gs = nn.net.manager.gameSession;
        const allItems = nn.net.data.item.getAllItemNotStack();
        const toDeposit = [];
        for (let it of allItems) {
          if (it.location === 1 && !it.isLock && !it._isLock) {
            const dbInfo = nn.db.item.get(it.itemTid);
            if (dbInfo && dbInfo.ItemType === 6) { // 6 = Jewel
              toDeposit.push(it.itemId);
            }
          }
        }
        return await executeMoveItemsToStorage(gs, allItems, toDeposit, cmd.targetStorage, 'deposit', 'viên ngọc');
      }

      if (cmd.action === 'depositT3') {
        const gs = nn.net.manager.gameSession;
        const allItems = nn.net.data.item.getAllItemNotStack();
        const toDeposit = [];
        for (let it of allItems) {
          if (it.location === 1 && !it.isLock && !it._isLock) {
            if (nn.services.itemMove && nn.services.itemMove.isEquippedItemId && nn.services.itemMove.isEquippedItemId(it.itemId)) continue;
            if (nn.services.steamMarket && nn.services.steamMarket.staging && nn.services.steamMarket.staging.isStaged && nn.services.steamMarket.staging.isStaged(it.itemId)) continue;
            const dbEq = nn.db.equip ? nn.db.equip.get(it.itemTid) : null;
            if (dbEq && dbEq.RatingType === 3) {
              toDeposit.push(it.itemId);
            }
          }
        }
        return await executeMoveItemsToStorage(gs, allItems, toDeposit, cmd.targetStorage, 'depositT3', 'đồ Tier 3');
      }

      if (cmd.action === 'withdraw') {
        const gs = nn.net.manager.gameSession;
        const allItems = nn.net.data.item.getAllItemNotStack();
        const toWithdraw = [];
        for (let it of allItems) {
          if (it.location === 2 && !it.isLock && !it._isLock) {
            const dbInfo = nn.db.item.get(it.itemTid);
            if (dbInfo && dbInfo.ItemType === 6) {
              toWithdraw.push(it.itemId);
            }
          }
        }
        if (toWithdraw.length > 0) {
          const res = await gs.reqStorageMoveOutList(toWithdraw);
          dumpEnrichedProfile();
          return JSON.stringify({ success: true, action: 'withdraw', count: toWithdraw.length, res: res ? (res.NetResult || 0) : 0 });
        }
        return JSON.stringify({ success: true, action: 'withdraw', count: 0, msg: 'No vault jewels to withdraw' });
      }

      if (cmd.action === 'depositType') {
        const gs = nn.net.manager.gameSession;
        const allItems = nn.net.data.item.getAllItemNotStack();
        const toDeposit = [];
        for (let it of allItems) {
          if (it.location === 1 && !it.isLock && !it._isLock && it.itemTid === cmd.itemTid) {
            toDeposit.push(it.itemId);
          }
        }
        if (toDeposit.length > 0) {
          const res = await gs.reqStorageMoveInList(toDeposit);
          dumpEnrichedProfile();
          return JSON.stringify({ success: true, action: 'depositType', count: toDeposit.length });
        }
        return JSON.stringify({ success: true, action: 'depositType', count: 0 });
      }

      if (cmd.action === 'withdrawType') {
        const gs = nn.net.manager.gameSession;
        const allItems = nn.net.data.item.getAllItemNotStack();
        const toWithdraw = [];
        for (let it of allItems) {
          if (it.location === 2 && !it.isLock && !it._isLock && it.itemTid === cmd.itemTid) {
            toWithdraw.push(it.itemId);
          }
        }
        if (toWithdraw.length > 0) {
          const res = await gs.reqStorageMoveOutList(toWithdraw);
          dumpEnrichedProfile();
          return JSON.stringify({ success: true, action: 'withdrawType', count: toWithdraw.length });
        }
        return JSON.stringify({ success: true, action: 'withdrawType', count: 0 });
      }

      if (cmd.action === 'fuse') {
        const result = await globalThis.__wogGearFusion.executeJewel(cmd);
        dumpEnrichedProfile();
        return JSON.stringify(result);
      }
      if (cmd.action === 'fuseGearTiers') {
        const result = await globalThis.__wogGearFusion.execute(cmd);
        dumpEnrichedProfile();
        return JSON.stringify(result);
      }

      if (cmd.action === 'fuseT3') {
        const ws = nn.services.workshop;
        if (!ws) return JSON.stringify({ error: 'Workshop service not found' });
        ws.setAutoRegisterIncludeStorage('Fusion', false);

        const collectT3Candidates = (targetContentType) => {
          const allItems = nn.net.data.item.getAllItemNotStack();
          const candidates = [];
          for (let it of allItems) {
            if (!it.isLock && !it._isLock && it.location === 1) {
              if (nn.services.itemMove && nn.services.itemMove.isEquippedItemId && nn.services.itemMove.isEquippedItemId(it.itemId)) continue;
              if (nn.services.steamMarket && nn.services.steamMarket.staging && nn.services.steamMarket.staging.isStaged && nn.services.steamMarket.staging.isStaged(it.itemId)) continue;

              const dbEq = nn.db.equip ? nn.db.equip.get(it.itemTid) : null;
              if (!dbEq || dbEq.RatingType !== 3) continue;

              const info = ws.getTableInfo(it.itemTid, it.itemId);
              if (!info || info.contentType !== targetContentType) continue;

              const itemLv = (info && info.baseLimitLevel > 0) ? info.baseLimitLevel : ((dbEq && dbEq.LimitLevel) || 1);
              candidates.push({
                itemTid: it.itemTid,
                itemId: it.itemId,
                ratingType: dbEq.RatingType,
                _itemLevel: itemLv,
                location: it.location
              });
            }
          }
          return candidates;
        };

        const t3Results = [];
        const isSameLv = false; // Mặc định chỉ ghép cùng cấp độ nếu không chỉ định rõ

        // 1. Ghép Trang Bị T3 (Gear - cần 6 món)
        if (cmd.fuseGear !== false) {
          ws.setFusionContentType(1);
          ws.setAutoRegisterRating('Fusion', 3);
          let loop = 0;
          while (loop < 20) {
            const candidates = collectT3Candidates(1);
            if (candidates.length < 6) break;

            let selected = null;
            if (isSameLv) {
              const byLevel = new Map();
              for (let c of candidates) {
                const lv = c._itemLevel;
                if (!byLevel.has(lv)) byLevel.set(lv, []);
                byLevel.get(lv).push(c);
              }
              const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => b - a);
              for (let lv of sortedLevels) {
                const grp = byLevel.get(lv);
                if (grp.length >= 6) {
                  selected = grp.slice(0, 6);
                  break;
                }
              }
              if (!selected) break;
            } else {
              selected = candidates.slice(0, 6);
            }

            const maxLv = Math.max(...selected.map(i => i._itemLevel || 1));
            const tbl = ws.findFusionTable(1, 3, maxLv);
            if (!tbl) break;
            const materials = selected.map(i => ({ itemId: i.itemId, itemTid: i.itemTid, itemCnt: 1 }));
            if (!ws.validateFusionMaterials(tbl, materials)) break;
            ws.clearFusionStaging();
            const res = await ws.reqFusionAsync(tbl.FusionID, materials);
            if (res && (res.NetResult === 1000 || res.NetResult === 0 || !res.NetResult || res.Data)) {
              loop++;
              t3Results.push({ type: 'gear', res: res });
              try { nn.msgBroker.publish('onUpdateWorkShopFusion'); } catch(_) {}
            } else {
              break;
            }
          }
        }

        // 2. Ghép Trang Sức T3 (Accessories - cần 3 món)
        if (cmd.fuseAcc !== false) {
          ws.setFusionContentType(2);
          ws.setAutoRegisterRating('Fusion', 3);
          let loop = 0;
          while (loop < 20) {
            const candidates = collectT3Candidates(2);
            if (candidates.length < 3) break;

            let selected = null;
            if (isSameLv) {
              const byLevel = new Map();
              for (let c of candidates) {
                const lv = c._itemLevel;
                if (!byLevel.has(lv)) byLevel.set(lv, []);
                byLevel.get(lv).push(c);
              }
              const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => b - a);
              for (let lv of sortedLevels) {
                const grp = byLevel.get(lv);
                if (grp.length >= 3) {
                  selected = grp.slice(0, 3);
                  break;
                }
              }
              if (!selected) break;
            } else {
              selected = candidates.slice(0, 3);
            }

            const maxLv = Math.max(...selected.map(i => i._itemLevel || 1));
            const tbl = ws.findFusionTable(2, 3, maxLv);
            if (!tbl) break;
            const materials = selected.map(i => ({ itemId: i.itemId, itemTid: i.itemTid, itemCnt: 1 }));
            if (!ws.validateFusionMaterials(tbl, materials)) break;
            ws.clearFusionStaging();
            const res = await ws.reqFusionAsync(tbl.FusionID, materials);
            if (res && (res.NetResult === 1000 || res.NetResult === 0 || !res.NetResult || res.Data)) {
              loop++;
              t3Results.push({ type: 'acc', res: res });
              try { nn.msgBroker.publish('onUpdateWorkShopFusion'); } catch(_) {}
            } else {
              break;
            }
          }
        }

        dumpEnrichedProfile();
        return JSON.stringify({ success: true, action: 'fuseT3', fusedCount: t3Results.length, details: t3Results });
      }

      return JSON.stringify({ success: false, reason: 'Unknown action: ' + cmd.action });
    } catch(err) {
      return JSON.stringify({ success: false, error: err.toString(), stack: err.stack });
    }
  };

  // Serialize all workshop actions with automatic gear fusion. Uncertain fusion submissions stay blocked.
  const originalJewelAction = globalThis.__runJewelAction;
  let workshopActionBusy = false;
  globalThis.__runJewelAction = async function(cmd) {
    if (['fuse','fuseT3','fuseGearTiers','toggleStorage'].includes(cmd.action)) cmd = {...cmd, includeStorage:false};
    if (workshopActionBusy || globalThis.__wogGearFusion.locked()) {
      const state=globalThis.__wogGearFusion.status();
      return JSON.stringify({action:cmd.action,requestId:cmd.requestId,success:!state.blocked && cmd.action==='fuseGearTiers',fusedCount:0,code:state.blocked?'WORKSHOP_BLOCKED':'WORKSHOP_BUSY',uncertain:state.blocked,reason:state.blocked?(state.fault?.reason||'Workshop blocked; check the game.'):'Workshop busy; wait for the current action.',response:state.fault?.response,diagnostics:state.fault?.diagnostics});
    }
    workshopActionBusy = true;
    try { return await originalJewelAction(cmd); }
    finally { workshopActionBusy = false; }
  };

  // 1. High-speed loop (40ms) for handling interactive commands (Universal AppData + Game Dir IPC)
  setInterval(async () => {
    if (globalThis.__pendingJewelCmd && !isEvaluating) {
      const pendingCmd = globalThis.__pendingJewelCmd;
      globalThis.__pendingJewelCmd = null;
      try {
        await globalThis.__runJewelAction(pendingCmd);
      } catch(_) {}
    }

    if (isEvaluating) return;
    try {
      if (typeof CS === 'undefined' || !CS.NTSHelper || !CS.UnityEngine || !CS.UnityEngine.Application) return;
      
      let pPath = null;
      let dPath = null;
      try { pPath = CS.UnityEngine.Application.persistentDataPath; } catch(_) {}
      try { dPath = CS.UnityEngine.Application.dataPath; } catch(_) {}

      const candidateDirs = [];
      if (pPath) candidateDirs.push(pPath);
      if (dPath) candidateDirs.push(dPath + '/..');

      for (const gameDir of candidateDirs) {
        const pendingFile = gameDir + '/pending_eval.json';
        if (CS.NTSHelper.IsFileExists(pendingFile)) {
          isEvaluating = true;
          let raw = '';
          try {
            raw = CS.NTSHelper.ReadAllText(pendingFile);
            CS.System.IO.File.Delete(pendingFile);
          } catch(e) {
            isEvaluating = false;
            continue;
          }

          if (raw && raw.trim()) {
            try {
              const data = JSON.parse(raw);
              let evalRes = await eval(data.code);
              let valStr = (typeof evalRes === 'string') ? evalRes : JSON.stringify(evalRes);
              for (const outDir of candidateDirs) {
                try { CS.NTSHelper.WriteAllText(outDir + '/eval_result.json', JSON.stringify({ id: data.id, result: valStr })); } catch(_) {}
              }
            } catch(err) {
              for (const outDir of candidateDirs) {
                try { CS.NTSHelper.WriteAllText(outDir + '/eval_result.json', JSON.stringify({ id: data ? data.id : 1, error: err.toString() })); } catch(_) {}
              }
            }
          }
          isEvaluating = false;
          break;
        }
      }
    } catch(e) {
      isEvaluating = false;
    }
  }, 40);

  // 2. Real-time Combat & Stage Run Tracker (100ms loop)
  setInterval(() => {
    try {
      if (typeof nn === 'undefined' || !nn || !nn.services) return;
      let sCombat = nn.services.combat;
      let sStage = nn.services.stage;
      let sDungeon = nn.services.dungeon;
      if (!sCombat && nn.services._mapService) {
        for (let [k, v] of nn.services._mapService.entries()) {
          const name = k.name || k.toString();
          if (name.includes('Combat')) sCombat = v;
          if (name.includes('Stage')) sStage = v;
          if (name.includes('Dungeon')) sDungeon = v;
        }
      }
      const curProxy = sCombat ? sCombat.getCurrentActiveCombatProxy() : null;

      // Special Battle lifecycle completion check (MUST execute even if curProxy is null when battle ended!)
      if (globalThis.__specialBattleTracker && globalThis.__specialBattleTracker.current) {
        const cs = globalThis.__specialBattleTracker.current;
        const nowTs = Date.now();
        let curFId = (curProxy && (curProxy.fieldTid || curProxy._fieldTid || (curProxy._gameContext && curProxy._gameContext._initData && curProxy._gameContext._initData.fieldId))) || 0;
        let curDType = (curProxy && curProxy._dungeonType) || 0;
        if (curDType === 0 && curFId > 0) {
          if ((curFId >= 700000 && curFId < 800000) || curFId === 20000) curDType = 3;
          else if ((curFId >= 600000 && curFId < 700000) || curFId === 10000) curDType = 2;
        }
        const isGameEnd = !curProxy || curDType === 0 || !!curProxy._isGameEnd || curProxy._gameState === 4 || curProxy._gameState === 5 || (nowTs - (cs.lastHit || nowTs) > 8000);
        if (isGameEnd && cs.total_damage > 0) {
          cs.duration = Math.max(1, Math.round(((nowTs - cs.startTime) / 1000) * 10) / 10);
          cs.status = 'victory';
          cs.timestamp = cs.startTime;

          // Enrich with true game results from ServiceDungeon if available
          try {
            if (!sDungeon && nn.services && nn.services._mapService) {
              for (let [k, v] of nn.services._mapService.entries()) {
                if ((k.name || '').includes('Dungeon')) sDungeon = v;
              }
            }
            if (sDungeon && sDungeon._dungeonResultInfo) {
              const dri = sDungeon._dungeonResultInfo;
              const isMatch = dri && (
                dri.dungeonTid === cs.field_id ||
                (cs.dungeon_type === 3 && (dri.dungeonTid === 20000 || dri.dungeonType === 3)) ||
                (cs.dungeon_type === 2 && (dri.dungeonTid === 10000 || dri.dungeonType === 2))
              );
              if (isMatch && dri.totalDamage !== undefined) {
                const gameTotal = Math.round(parseFloat(dri.totalDamage) || 0);
                const measured = cs.total_damage;
                if (gameTotal > 0 && measured > 0) {
                  const factor = gameTotal / measured;
                  for (const k in cs.skill_breakdown) {
                    if (cs.skill_breakdown[k]) {
                      cs.skill_breakdown[k].damage = Math.round(cs.skill_breakdown[k].damage * factor);
                    }
                  }
                  cs.total_damage = gameTotal;
                }
                if (parseFloat(dri.endTime) > 0) {
                  cs.duration = Math.round(parseFloat(dri.endTime) * 10) / 10;
                }
                try {
                  const br = sDungeon._dungeonBattleRecord;
                  if (br && br.clearStep) cs.boss_level = br.clearStep;
                } catch (_) {}
              }
            }
          } catch (_) {}

          globalThis.__specialBattleTracker.completedBattles.unshift(cs);
          if (globalThis.__specialBattleTracker.completedBattles.length > 50) {
            globalThis.__specialBattleTracker.completedBattles = globalThis.__specialBattleTracker.completedBattles.slice(0, 50);
          }
          globalThis.__specialBattleTracker.current = null;
        }
      }

      // ─── Stage run tracking ───────────────────────────────────────────────
      // IMPORTANT: this block runs BEFORE the curProxy null-guard so it still
      // executes when the combat proxy disappears after a successful stage clear.
      // curProxy may be null here — treat that as "battle just ended".
      {
        const sTracker = globalThis.__stageTracker;
        const nowTs = Date.now();
        // When curProxy is null the battle has ended; read what we can from sStage.
        const curDType = (curProxy && curProxy._dungeonType) || 0;
        if (sTracker && curDType === 0) {
          const heroPawn = curProxy && curProxy.getMyHeroPawn ? curProxy.getMyHeroPawn() : null;
          const activeStageTid = (sStage && sStage.playingStageTid) ? sStage.playingStageTid
                                : (sStage && sStage.stageTid)       ? sStage.stageTid
                                : (curProxy ? curProxy.fieldTid : 0);
          const curClearTid   = (sStage && sStage.stageInfo) ? sStage.stageInfo._clearStageTid : 0;
          const isHeroDead    = heroPawn ? (heroPawn._isDead || heroPawn._isAlive === false || heroPawn.isDead || (heroPawn._curHp !== undefined && heroPawn._curHp <= 0) || (heroPawn.hp !== undefined && heroPawn.hp <= 0)) : false;
          // When proxy is null, clear sequence flags must come from sStage or prior latching
          const isClearSeqStarted = !!(
            (curProxy && (curProxy._bStageClearSequenceStarted || curProxy._bStageClearSequenceActive || curProxy._isWin === true || curProxy._gameResult === 1 || curProxy._isClear === true)) ||
            (sStage && (sStage._bStageClearSequenceStarted || sStage._isWin === true || sStage._isClear === true))
          );
          // CRITICAL: _gameState 4 is WaitResult (boss death animation), NOT GameEnd!
          // Game only ends at state 5 (GameEnd), _isGameEnd === true, or when proxy is destroyed.
          const isGameEnd     = !curProxy
                                || !!curProxy._isGameEnd
                                || curProxy._gameState === 5;
          const curElapsed    = (curProxy && curProxy.elapsedTime) || 0;
          const curGameId     = (curProxy && (curProxy._gameId || curProxy.gameId)) || null;

          if (sTracker.currentRun) {
            const cur = sTracker.currentRun;
            const sameGame = curGameId && cur.gameId
              ? (curGameId === cur.gameId)
              : (curProxy ? curProxy.fieldTid === cur.stageId : false);

            if (sameGame) {
              cur.duration = curElapsed > 0 ? curElapsed : ((nowTs - cur.startTime) / 1000);
              if (isHeroDead) cur.wasHeroDead = true;
              if (curClearTid > cur.initialClearTid) cur.clearedNewStage = true;
            }

            // Latch clear/defeat regardless of sameGame — proxy may change id on the clear tick
            if (isClearSeqStarted) cur.wasClearSeqStarted = true;
            if (curProxy && (curProxy._isDefeat === true || curProxy._gameResult === 2 || curProxy._bStageFailSequenceStarted === true)) cur.wasDefeat = true;

            // When stage advances to a higher stage (e.g. 14406 -> 14407), the battle was 100% cleared!
            const isStageAdvanced = (activeStageTid > 0 && activeStageTid > cur.stageId);
            if (isStageAdvanced) cur.wasClearSeqStarted = true;

            // When curProxy is null: if sStage shows a higher clearTid than when the run started
            if (!curProxy && sStage && curClearTid > cur.initialClearTid) cur.wasClearSeqStarted = true;

            const proxyGone   = !curProxy;
            const battleEnded = proxyGone || (!sameGame && curGameId) || isGameEnd || isClearSeqStarted
                                || cur.wasHeroDead || cur.wasDefeat
                                || (activeStageTid > 0 && activeStageTid !== cur.stageId);

            if (battleEnded && !cur.recorded && cur.duration >= 1) {
              if (cur.duration < 1) cur.duration = (nowTs - cur.startTime) / 1000;

              const isCleared       = !!(isClearSeqStarted || cur.wasClearSeqStarted || cur.clearedNewStage || isStageAdvanced
                                         || (curProxy && (curProxy._bStageClearSequenceStarted || curProxy._bStageClearSequenceActive || curProxy._isWin === true || curProxy._gameResult === 1 || curProxy._isClear === true)));
              const isExplicitDefeat = !!(cur.wasHeroDead || cur.wasDefeat
                                          || (curProxy && (curProxy._isDefeat === true || curProxy._gameResult === 2 || curProxy._bStageFailSequenceStarted === true)));
              const isStageAbandoned = !!(activeStageTid > 0 && activeStageTid !== cur.stageId && !isStageAdvanced);

              let runStatus = 'abandoned';
              if (isCleared || isStageAdvanced) {
                runStatus = 'success';
              } else if (isExplicitDefeat) {
                runStatus = 'failed';
              } else if (proxyGone && !isExplicitDefeat) {
                // Proxy gone but no defeat signal — assume auto-battle moved to next stage (success-like)
                runStatus = 'success';
              } else if (isGameEnd) {
                runStatus = 'failed';
              } else if (isStageAbandoned) {
                runStatus = cur.duration < 6.0 ? 'partial' : 'abandoned';
              } else if (cur.duration < 6.0) {
                runStatus = 'partial';
              }

              cur.recorded = true;
              if (cur.gameId) sTracker.lastRecordedGameId = cur.gameId;

              sTracker.completedRuns.unshift({
                stage_id: cur.stageId,
                status: runStatus,
                duration: Math.max(1, Math.round(cur.duration * 10) / 10),
                timestamp: nowTs
              });
              if (sTracker.completedRuns.length > 100) {
                sTracker.completedRuns = sTracker.completedRuns.slice(0, 100);
              }
              sTracker.currentRun = null;
            }
          }

          if (!sTracker.currentRun && activeStageTid > 0 && !isGameEnd && !isHeroDead && curProxy) {
            if (!curGameId || curGameId !== sTracker.lastRecordedGameId) {
              sTracker.currentRun = {
                gameId: curGameId || null,
                stageId: activeStageTid,
                startTime: nowTs,
                duration: curElapsed > 0 ? curElapsed : 0,
                wasHeroDead: false,
                wasClearSeqStarted: false,
                clearedNewStage: false,
                wasDefeat: false,
                initialClearTid: curClearTid,
                recorded: false
              };
              if (globalThis.__liveCombatTracker) {
                globalThis.__liveCombatTracker.totalDamage = 0;
                globalThis.__liveCombatTracker.normalDamage = 0;
                globalThis.__liveCombatTracker.skillDamage = 0;
                globalThis.__liveCombatTracker.hitCount = 0;
                globalThis.__liveCombatTracker.startTime = nowTs;
              }
            }
          }
        }
      }

      if (!curProxy) return;

      // Real-time damage text hook
      if (curProxy._combatController && curProxy._combatController.__dmgHookVersion !== 'v9_livesync') {
        const cc = curProxy._combatController;
        cc.__dmgHookVersion = 'v9_livesync';
        let origShow = cc.showDamageText;
        let guard = 0;
        while (origShow && origShow.__isDmgHook && guard < 20) { origShow = origShow.__origDmg; guard++; }
        const newHook = function(pos, damage, damageType) {
          try {
            const dmg = typeof damage === 'number' ? damage : (damage ? parseFloat(damage) : 0);
            if (dmg > 0 && globalThis.__liveCombatTracker) {
              globalThis.__liveCombatTracker.totalDamage += dmg;
              globalThis.__liveCombatTracker.hitCount++;
              if (damageType === 2 || damageType === 4) {
                globalThis.__liveCombatTracker.normalDamage += dmg;
              } else {
                globalThis.__liveCombatTracker.skillDamage += dmg;
              }
            }

            // Special Battle (World Boss / Raid) Damage Tracking
            let activeProxy = (sCombat && sCombat.getCurrentActiveCombatProxy) ? sCombat.getCurrentActiveCombatProxy() : curProxy;
            if (!activeProxy && this && (this._combatProxy || this.combatProxy)) activeProxy = this._combatProxy || this.combatProxy;
            let fId = (activeProxy && (activeProxy.fieldTid || activeProxy._fieldTid || (activeProxy._gameContext && activeProxy._gameContext._initData && activeProxy._gameContext._initData.fieldId))) || (curProxy && (curProxy.fieldTid || curProxy._fieldTid || (curProxy._gameContext && curProxy._gameContext._initData && curProxy._gameContext._initData.fieldId))) || 0;
            let dType = (activeProxy && activeProxy._dungeonType) || (curProxy && curProxy._dungeonType) || 0;
            if (dType === 0) {
              if ((fId >= 700000 && fId < 800000) || fId === 20000) dType = 3;
              else if ((fId >= 600000 && fId < 700000) || fId === 10000) dType = 2;
            }

            if (dType > 0 && dmg > 0) {
              if (!globalThis.__specialBattleTracker) {
                globalThis.__specialBattleTracker = { current: null, completedBattles: [] };
              }
              const sbt = globalThis.__specialBattleTracker;
              const gId = (activeProxy && activeProxy._gameId) || (curProxy && curProxy._gameId) || null;
              const skTid = (activeProxy && activeProxy._lastUsedSkillTid) || (curProxy && curProxy._lastUsedSkillTid) || 0;
              const nowD = Date.now();
              const bKind = (dType === 3 ? 'raid' : 'worldboss');

              if (!sbt.current || sbt.current.field_id !== fId || (sbt.current.game_id && gId && sbt.current.game_id !== gId && dType === 3)) {
                if (sbt.current && sbt.current.total_damage > 0) {
                  sbt.current.duration = Math.max(1, Math.round(((nowD - sbt.current.startTime) / 1000) * 10) / 10);
                  sbt.completedBattles.unshift(sbt.current);
                  if (sbt.completedBattles.length > 50) sbt.completedBattles = sbt.completedBattles.slice(0, 50);
                }
                let hCls = 'Ranged';
                if (liveClassType === 3 || liveHeroTid >= 300) hCls = 'Mage';
                else if (liveClassType === 2 || (liveHeroTid >= 200 && liveHeroTid < 300)) hCls = 'Ranged';
                else if (liveClassType === 1 || liveHeroTid < 200) hCls = 'Melee';

                sbt.current = {
                  battle_kind: bKind,
                  field_id: fId,
                  dungeon_type: dType,
                  game_id: gId,
                  total_damage: 0,
                  startTime: nowD,
                  lastHit: nowD,
                  hero_class: hCls,
                  hero_level: (userC && userC._user ? userC._user._lv : 48),
                  skill_breakdown: {}
                };
              }

              const cs = sbt.current;
              cs.total_damage += dmg;
              cs.lastHit = nowD;
              const isNormal = (damageType === 2 || damageType === 4);
              let normTid = skTid;
              try { const srow = nn.db.skill.get(skTid); if (srow && srow.GroupID) normTid = srow.GroupID; } catch (_) {}
              const key = (isNormal || skTid === 0 || normTid === 2000 || normTid === 3000) ? '2000' : String(normTid);
              if (!cs.skill_breakdown[key]) cs.skill_breakdown[key] = { damage: 0, hits: 0 };
              cs.skill_breakdown[key].damage += dmg;
              cs.skill_breakdown[key].hits += 1;
            }
          } catch(_) {}
          return origShow.apply(this, arguments);
        };
        newHook.__isDmgHook = true;
        newHook.__origDmg = origShow;
        cc.showDamageText = newHook;
      }
    } catch(_) {}
  }, 100);

  // 3. Continuous 1-second loop for dumping live player stats INCLUDING JEWELS, STATS & EXP
  setInterval(() => {
    const now = Date.now();
    if (now - lastDump < 1000) return;
    lastDump = now;
    dumpEnrichedProfile();
  }, 1000);
})();
`;

fs.writeFileSync(initPath, code.trim() + '\n' + hook, 'utf8');
console.log('Hook v3.2 successfully updated into init.bundle.mjs with full T3 Engine!');
