/* TTESPL v44.6 - dates are SHOWN as dd/mm/yyyy everywhere (stored data stays yyyy-mm-dd, so nothing else changes).
   Works on the screen text, on printed invoices / PDFs, and on the customer store. Date pickers keep the phone's own format. */
(function (g) {
  'use strict';
  var RX = /(^|[^\w\-\/.:])((?:19|20)\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?![\w\-:])/g;
  function dmy(s) { return String(s == null ? '' : s).replace(RX, function (m, p, y, mo, d) { return p + d + '/' + mo + '/' + y; }); }
  /* for a whole HTML string: only the text between tags is changed, never tag attributes */
  function dmyHtml(h) { return String(h == null ? '' : h).split(/(<[^>]*>)/).map(function (seg) { return seg.charAt(0) === '<' ? seg : dmy(seg); }).join(''); }
  g.ttDmy = dmy; g.ttDmyHtml = dmyHtml;

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, INPUT: 1, SELECT: 0 };
  function okNode(n) {
    for (var e = n.parentNode; e && e.nodeType === 1; e = e.parentNode) { if (SKIP[e.tagName] || e.isContentEditable || (e.classList && e.classList.contains('ttx-nodmy'))) return false; }
    return true;
  }
  function fixText(n) { var v = n.nodeValue; if (v && v.length >= 10 && v.indexOf('-') > 0) { var w = dmy(v); if (w !== v && okNode(n)) n.nodeValue = w; } }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    var tw = document.createTreeWalker(root, 4, null, false), n; while ((n = tw.nextNode())) fixText(n);
  }
  var q = [], sched = false;
  function flush() { sched = false; var l = q; q = []; l.forEach(walk); }
  function push(n) { q.push(n); if (!sched) { sched = true; (g.requestAnimationFrame || setTimeout)(flush); } }
  function start() {
    if (!g.MutationObserver || !document.body) return;
    walk(document.body);
    new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === 'characterData') push(m.target); else for (var i = 0; i < m.addedNodes.length; i++) push(m.addedNodes[i]); }); }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* printed / saved-as-PDF pages are built from strings in a hidden frame */
  function wrapPrint() { var f = g.ttPrintHtml; if (typeof f !== 'function' || f.__dmy) return; var w = function (t, b) { return f.call(this, t, dmyHtml(b)); }; w.__dmy = 1; g.ttPrintHtml = w; try { ttPrintHtml = w; } catch (e) {} }
  wrapPrint(); setTimeout(wrapPrint, 1500);
})(window);
