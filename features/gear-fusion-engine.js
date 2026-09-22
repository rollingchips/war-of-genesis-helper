function createGearFusion(getGame, timeoutMs = 10000) {
  let busy = false, blocked = false, lastSnapshot = 0;
  const seen = new Map();
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
      if (!eq || ![3, 4].includes(eq.RatingType)) continue;
      const info = w.getTableInfo(i.itemTid, i.itemId);
      const level = info?.baseLimitLevel > 0 ? info.baseLimitLevel : eq.LimitLevel;
      if (![1, 2].includes(info?.contentType) || !Number.isFinite(level) || level <= 0) continue;
      rows.push({id, itemId: i.itemId, itemTid: i.itemTid, level, rating: eq.RatingType, type: info.contentType, location: i.location});
    }
    return {n, w, raw, rows};
  }
  function status() {
    const base = {version: 1, instance, busy, blocked, generatedAt: Date.now()};
    try {
      const {rows} = inventory(); lastSnapshot = Date.now();
      const counts = {};
      for (const tier of [3, 4]) for (const type of [1, 2]) {
        const matches = rows.filter(i => i.rating === tier && i.type === type);
        counts[tier + ':' + type] = {bag: matches.filter(i => i.location === 1).length, storage: matches.filter(i => i.location === 2).length};
      }
      return {...base, available: !blocked, counts};
    } catch (e) { return {...base, available: false, reason: e.message}; }
  }
  function select(data, cmd) {
    const rows = data.rows.filter(i => i.type === cmd.contentType && i.rating === cmd.sourceTier && (i.location === 1 || cmd.includeStorage === true));
    const levels = cmd.sameLevelOnly !== false ? [...new Set(rows.map(i => i.level))].sort((a,b) => b-a) : [null];
    for (const level of levels) {
      const group = level === null ? rows : rows.filter(i => i.level === level);
      const count = cmd.contentType === 1 ? 6 : 3;
      if (group.length >= count) {
        const items = group.slice(0, count), maxLevel = Math.max(...items.map(i => i.level));
        const table = data.w.findFusionTable(cmd.contentType, cmd.sourceTier, maxLevel);
        if (!table || table.FusionID == null) continue;
        const materials = items.map(i => ({itemId: i.itemId, itemTid: i.itemTid, itemCnt: 1}));
        if (data.w.validateFusionMaterials(table, materials) === true) return {table, materials, items};
      }
    }
    return null;
  }
  async function execute(cmd) {
    const receipt = {action: 'fuseGearTiers', requestId: cmd.requestId};
    if (typeof cmd.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,96}$/.test(cmd.requestId)) return {...receipt, success: false, reason: 'Invalid request identity'};
    if (seen.has(cmd.requestId)) return {...receipt, success: false, reason: 'Duplicate request; no action repeated'};
    if (seen.size >= 10000) return {...receipt, success: false, reason: 'Session request limit reached'};
    seen.set(cmd.requestId, true);
    if (busy || blocked || cmd.instance !== instance || (![1, 2].includes(cmd.contentType) || ![3, 4].includes(cmd.sourceTier)) || Date.now() - lastSnapshot > 10000) return {...receipt, success: false, reason: 'Unavailable, stale or busy fusion session'};
    busy = true;
    let sent = false, timer;
    try {
      const data = inventory();
      data.w.setFusionContentType(cmd.contentType);
      data.w.setAutoRegisterRating('Fusion', cmd.sourceTier);
      data.w.setAutoRegisterIncludeStorage('Fusion', cmd.includeStorage === true);
      const plan = select(data, cmd);
      if (!plan) return {...receipt, success: true, fusedCount: 0, reason: 'No game-validated T3/T4 batch is ready'};
      // Re-check the authoritative materials immediately before submission.
      const fresh = inventory();
      if (!plan.items.every(i => fresh.rows.some(x => x.id === i.id && x.type === i.type && x.rating === i.rating && x.level === i.level && (x.location === 1 || cmd.includeStorage === true))) ||
          fresh.w.validateFusionMaterials(plan.table, plan.materials) !== true) throw Error('Materials changed before submission');
      fresh.w.clearFusionStaging();
      sent = true;
      const pending = Promise.resolve(fresh.w.reqFusionAsync(plan.table.FusionID, plan.materials));
      const response = await Promise.race([pending, new Promise((_, reject) => {timer = setTimeout(() => reject(Error('Fusion timed out; reconcile in game before restarting LiveSync')), timeoutMs);})]);
      clearTimeout(timer);
      if (!response || ![0, 1000].includes(response.NetResult)) throw Error('Fusion response was unsuccessful or uncertain');
      const after = fresh.n.net.data.item.getAllItemNotStack();
      if (!Array.isArray(after) || plan.items.some(i => after.some(x => String(x.itemId) === i.id))) throw Error('Fusion materials are not reconciled; check the game before restarting LiveSync');
      try { fresh.n.msgBroker.publish('onUpdateWorkShopFusion'); } catch (_) {}
      return {...receipt, success: true, fusedCount: 1};
    } catch (e) {
      if (sent) blocked = true;
      return {...receipt, success: false, uncertain: sent, reason: e.message};
    } finally { clearTimeout(timer); busy = false; }
  }
  return {status, execute, locked: () => busy || blocked};
}
