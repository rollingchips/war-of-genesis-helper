(() => {
  const state = {enabled: false, pending: null, nextIndex: 0, nextAt: 0, lastAt: 0, capability: null, uncertain: false};
  const combinations = [[3, 1], [4, 1], [3, 2], [4, 2]];
  let timer;
  const watched = new WeakSet();
  const el = id => document.getElementById(id);
  function note(text) { const node = el('gearFusionStatus'); if (node) node.textContent = text; }
  function stop(text) {
    state.enabled = false;
    if (el('autoGearFusion')) el('autoGearFusion').checked = false;
    note(text);
  }
  function socket() {
    return (typeof liveWs !== 'undefined' && liveWs?.readyState === 1) ? liveWs : window.GenesisGameBridge?.ws;
  }
  function connected() { return socket()?.readyState === 1; }
  function available() { return !state.uncertain && connected() && state.capability?.available && Date.now() - state.lastAt < 8000; }
  window.wogGearFusionReply = data => {
    if (data.action !== 'fuseGearTiers' || !state.pending || data.requestId !== state.pending) return;
    clearTimeout(timer); state.pending = null; state.nextAt = Date.now() + 5000;
    if (data.success !== true) stop(data.reason || 'Fusion stopped; check the game.');
    else note(data.fusedCount === 1 ? 'Fusion completed; materials reconciled.' : 'Waiting for a game-validated batch.');
  };
  window.wogGearFusionTick = data => {
    const cap = data?.gearFusion;
    if (!cap || cap.version !== 1 || !connected() || !Number.isFinite(cap.generatedAt) || Date.now() - cap.generatedAt > 8000 || cap.generatedAt > Date.now() + 1000) {
      state.capability = null; if (el('autoGearFusion')) el('autoGearFusion').disabled = true;
      stop('Updated LiveSync connection required.'); return;
    }
    const ws = socket();
    if (!watched.has(ws)) {
      watched.add(ws);
      ws.addEventListener?.('close', () => { state.capability = null; stop('Disconnected. Re-enable fusion only after reconnecting.'); }, {once: true});
    }
    state.capability = cap; state.lastAt = Date.now();
    if (el('autoGearFusion')) el('autoGearFusion').disabled = !cap.available || state.uncertain;
    if (state.uncertain) { stop('Uncertain previous command. Reconcile in game, then reload this page.'); return; }
    if (!cap.available) { stop(cap.reason || 'Fusion blocked; check the game.'); return; }
    if (el('gearFusionCounts')) el('gearFusionCounts').textContent = combinations.map(([tier,type]) => {
      const count = cap.counts?.[tier + ':' + type];
      return 'T' + tier + (type === 1 ? ' equipment: ' : ' accessories: ') + (count ? count.bag + ' bag / ' + count.storage + ' storage' : 'unknown');
    }).join(' · ');
    if (!state.enabled || state.pending || window.__pendingJewelCmd || cap.busy || Date.now() < state.nextAt) return;
    const includeStorage = el('gearFusionStorage').checked;
    let chosen = null;
    for (let i = 0; i < combinations.length; i++) {
      const index = (state.nextIndex + i) % combinations.length, [tier,type] = combinations[index];
      const count = cap.counts?.[tier + ':' + type];
      if (count && Number.isInteger(count.bag) && Number.isInteger(count.storage) && count.bag + (includeStorage ? count.storage : 0) >= (type === 1 ? 6 : 3)) { chosen = {index,tier,type}; break; }
    }
    if (!chosen) return;
    const requestId = 'gear-' + crypto.randomUUID(); state.pending = requestId; state.nextIndex = (chosen.index + 1) % combinations.length;
    timer = setTimeout(() => { if (state.pending === requestId) { state.uncertain = true; state.pending = null; stop('No fusion receipt. Check the game before enabling again.'); } }, 15000);
    queueJewelCmd({action: 'fuseGearTiers', requestId, instance: cap.instance, contentType: chosen.type, sourceTier: chosen.tier, includeStorage, sameLevelOnly: el('gearFusionSameLevel').checked});
  };
  function mount() {
    const section = el('jewelSection'); if (!section) return;
    const box = document.createElement('div'); box.id = 'gearFusionPanel'; box.setAttribute('data-user-content', '');
    box.style.cssText = 'border:1px solid #f85149;border-radius:8px;padding:12px;margin:12px 0;color:#c9d1d9';
    box.innerHTML = '<h3 style="color:#ff7b72">Tier 3 + 4 Equipment & Accessory Fusion</h3><p>Consumes 6 same-tier equipment items or 3 same-tier accessories. Never mixes tiers or categories. T1, T2 and T5+ are excluded.</p><p><label><input id="autoGearFusion" type="checkbox" disabled> Auto-fuse T3 + T4 equipment and accessories</label></p><p><label><input id="gearFusionSameLevel" type="checkbox" checked> Same level only (automatic fusion)</label></p><p><label><input id="gearFusionStorage" type="checkbox"> Include storage materials</label></p><p id="gearFusionCounts"></p><p id="gearFusionStatus" role="status">Updated LiveSync connection required. Automation starts off.</p>';
    section.prepend(box);
    el('autoGearFusion').addEventListener('change', e => {
      if (e.target.checked && !available()) {e.target.checked = false; stop('Fresh LiveSync data required.'); return;}
      state.enabled = e.target.checked; note('T3 + T4 automation ' + (state.enabled ? 'enabled' : 'off') + '.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
