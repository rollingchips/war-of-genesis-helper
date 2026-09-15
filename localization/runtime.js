// Presentation-only localization. Source data, option values and protocols are unchanged.
(function () {
  const exact = __ZH_EXACT__;
  const terms = __ZH_TERMS__;
  const patterns = __ZH_PATTERNS__.map(([source, target]) => {
    const escaped = source.split('{}').map(escapeRegExp).join('(\\d+(?:\\.\\d+)?)');
    return [new RegExp(escaped, 'giu'), target];
  });
  function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const keys = Object.keys(terms).sort((a, b) => b.length - a.length);
  const phrases = new RegExp('(?<![\\p{L}_])(?:' + keys.map(escapeRegExp).join('|') + ')(?![\\p{L}_])', 'giu');
  const cache = new Map();
  function translate(text) {
    if (typeof text !== 'string' || !text.trim()) return text;
    if (cache.has(text)) return cache.get(text);
    const trimmed = text.trim();
    let result;
    if (Object.hasOwn(exact, trimmed)) {
      result = text.slice(0, text.indexOf(trimmed)) + exact[trimmed] + text.slice(text.indexOf(trimmed) + trimmed.length);
    } else {
      result = text;
      for (const [pattern, target] of patterns) {
        result = result.replace(pattern, (...args) => target.replace(/\{(\d+)\}/g, (_, i) => args[Number(i) + 1]));
      }
      result = result.replace(phrases, match => terms[match.toLowerCase()]);
    }
    if (cache.size > 12000) cache.clear();
    cache.set(text, result);
    return result;
  }
  window.zhText = translate;
  window.zhSearch = (text, query) => String(text || '').toLowerCase().includes(query) || translate(String(text || '')).toLowerCase().includes(query);
  // Native dialogs are also presentation. Preserve their original return semantics.
  for (const method of ['alert', 'confirm', 'prompt']) {
    const original = window[method].bind(window);
    window[method] = (message, ...args) => original(translate(String(message)), ...args);
  }
  function excluded(element) {
    return !element || element.closest('script, style, code, pre, textarea, [data-user-content]');
  }
  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (excluded(node.parentElement)) return;
      if (node.parentElement.id === 'barPlayerName' && node.nodeValue.trim() !== 'Tân Thủ (Chưa nạp save)') return;
      const value = translate(node.nodeValue);
      if (value !== node.nodeValue) node.nodeValue = value;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || excluded(node)) return;
    for (const attr of ['title', 'placeholder', 'alt', 'aria-label']) {
      if (node.hasAttribute(attr)) {
        const before = node.getAttribute(attr), after = translate(before);
        if (after !== before) node.setAttribute(attr, after);
      }
    }
    for (const child of node.childNodes) translateNode(child);
  }
  window.applyTraditionalChinese = () => translateNode(document.body);
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = 'zh-Hant';
    document.title = translate(document.title);
    translateNode(document.body);
    // Only process changed subtrees; no polling, service calls or game commands.
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(translateNode);
        else translateNode(record.target);
      }
    }).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'alt', 'aria-label']});
  });
})();
