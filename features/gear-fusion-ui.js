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
    const includeStorage = isIncludeStorageJewelActive;
    let chosen = null;
    for (let i = 0; i < combinations.length; i++) {
      const index = (state.nextIndex + i) % combinations.length, [tier,type] = combinations[index];
      const count = cap.counts?.[tier + ':' + type];
      if (count && Number.isInteger(count.bag) && Number.isInteger(count.storage) && count.bag + (includeStorage ? count.storage : 0) >= (type === 1 ? 6 : 3)) { chosen = {index,tier,type}; break; }
    }
    if (!chosen) return;
    const requestId = 'gear-' + crypto.randomUUID(); state.pending = requestId; state.nextIndex = (chosen.index + 1) % combinations.length;
    timer = setTimeout(() => { if (state.pending === requestId) { state.uncertain = true; state.pending = null; stop('No fusion receipt. Check the game before enabling again.'); } }, 15000);
    queueJewelCmd({action: 'fuseGearTiers', requestId, instance: cap.instance, contentType: chosen.type, sourceTier: chosen.tier, includeStorage, sameLevelOnly: isFuseT3SameLevelOnlyActive});
  };
  function mount() {
    const box = el('gearFusionControls'); if (!box) return;
    box.setAttribute('data-user-content', '');
    box.innerHTML = `<style>
      #gearFusionControls .gear-fusion-toggle { position:relative; display:block; flex-shrink:0; width:44px; height:22px; }
      #autoGearFusion { position:absolute; inset:0; width:44px; height:22px; margin:0; opacity:0; z-index:1; cursor:pointer; }
      #autoGearFusion + .jewel-switch { display:block; box-sizing:border-box; }
      #autoGearFusion:checked + .jewel-switch { background:#238636; border-color:#2ea043; }
      #autoGearFusion:checked + .jewel-switch::after { transform:translateX(20px); background:#fff; }
      #autoGearFusion:disabled { cursor:not-allowed; }
      #autoGearFusion:disabled + .jewel-switch { opacity:0.5; }
      #autoGearFusion:focus-visible + .jewel-switch { outline:2px solid #58a6ff; outline-offset:3px; }
    </style>
    <label class="jewel-switch-wrap" style="margin:0 0 10px;">
      <span class="gear-fusion-toggle"><input id="autoGearFusion" type="checkbox" role="switch" aria-labelledby="gearFusionLabel" aria-describedby="gearFusionStatus" disabled><span class="jewel-switch" aria-hidden="true"></span></span>
      <span style="flex:1;min-width:0;">
        <span id="gearFusionLabel" style="display:block;font-weight:bold;font-size:13.5px;color:#58a6ff;">T3 + T4 Equipment &amp; Accessories</span>
        <span style="display:block;font-size:11.5px;color:#8b949e;">Auto-fuse 6 equipment items or 3 accessories per batch. Same tier only.</span>
        <span id="gearFusionCounts" style="display:block;font-size:11.5px;color:#8b949e;"></span>
        <span id="gearFusionStatus" role="status" style="display:block;font-size:11.5px;color:#8b949e;">Updated LiveSync connection required. Automation starts off.</span>
      </span>
    </label>`;
    el('autoGearFusion').addEventListener('change', e => {
      if (e.target.checked && !available()) {e.target.checked = false; stop('Fresh LiveSync data required.'); return;}
      state.enabled = e.target.checked; note('T3 + T4 automation ' + (state.enabled ? 'enabled' : 'off') + '.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
