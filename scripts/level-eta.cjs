function patchLevelEta(html) {
 const replace=(from,to)=>{if(!html.includes(from))throw Error('Missing level ETA anchor: '+from.slice(0,80));html=html.replace(from,to)};
 replace('<b id="barExpRem">2.12M</b>','<b id="barExpRem">估算中</b>');
 replace('function calculateRecentFarmExpPerSec(limit = 20) {','function calculateRecentFarmExpPerSec(limit = 20, observedOnly = false) {');
 replace("if (validRuns.length === 0) {", "if (observedOnly) {\n    const rates = validRuns.map(r => {\n      const stage = (typeof stageData !== 'undefined' ? stageData : window.stageData || []).find(s => s.stage_id == r.stage_id);\n      const exp = r.total_exp ?? stage?.total_exp;\n      return typeof exp === 'number' && Number.isFinite(exp) && exp > 0 && Number.isFinite(r.duration) ? exp / r.duration : NaN;\n    }).filter(rate => Number.isFinite(rate) && rate > 0).slice(0, limit);\n    return rates.length ? rates.reduce((a,b) => a+b, 0) / rates.length : null;\n  }\n  if (validRuns.length === 0) {");
 replace("document.getElementById('barExpRem').innerText = (expRemaining > 1000000 ? (expRemaining / 1000000).toFixed(2) + 'M' : Number(expRemaining).toLocaleString());", "document.getElementById('barExpRem').innerText = levelUpEta(data, calculateRecentFarmExpPerSec(20, true));");
 replace('function formatEtaTime(seconds) {', `function levelUpEta(data, rate) {
  let current = data.expInfo?.curExp, max = data.expInfo?.maxExp;
  if (!data.expInfo) {
    const raw = data.currencies?.['2000']?.count;
    const levels = typeof userLevelsData !== 'undefined' ? userLevelsData : null;
    const prev = levels?.[data.level - 1]?.req_exp, next = levels?.[data.level]?.req_exp;
    if (raw != null && raw !== '' && Number.isFinite(Number(raw)) && Number.isFinite(prev) && Number.isFinite(next)) {
      current = Number(raw) - prev; max = next - prev;
    }
  }
  if (!Number.isFinite(current) || !Number.isFinite(max) || current < 0 || max <= 0) return '估算中';
  if (current >= max) return '可升級';
  if (!Number.isFinite(rate) || rate <= 0) return '估算中';
  const seconds = Math.ceil((max-current)/rate);
  if (!Number.isSafeInteger(seconds)) return '估算中';
  const days = Math.floor(seconds/86400), hours = Math.floor(seconds/3600)%24;
  const minutes = Math.floor(seconds/60)%60, secs = seconds%60;
  if (days) return '約 ' + days + ' 天 ' + hours + ' 小時';
  if (hours) return '約 ' + hours + ' 小時 ' + minutes + ' 分鐘';
  if (minutes) return '約 ' + minutes + ' 分鐘 ' + secs + ' 秒';
  return '約 ' + secs + ' 秒';
}
function formatEtaTime(seconds) {`);
 return html;
}
module.exports={patchLevelEta};
