/* TTESPL ERP module: 16-v36-dropdown.js  (layout only; no data / formula / existing function is changed)
   Fixes drop-down lists that overlapped the fields below, showed their letters through each other,
   or opened in the wrong place inside glass pop-ups. */
(function () {
  'use strict';
  var busy = false;

  function anchorOf(box) {
    var p = box.parentElement; if (!p) return null;
    var c = p.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=number]), input[type=number]');
    if (c) return c;
    var q = box.previousElementSibling; while (q) { if (/^(INPUT|TEXTAREA)$/.test(q.tagName)) return q; q = q.previousElementSibling; }
    return p;
  }
  function lift(box, on) {
    var el = box.parentElement, n = 0;
    while (el && el !== document.body && n < 8) {
      if (on) {
        el.classList.add('tt-ac-lift');
        if (!el.__ttPos) { var cs = getComputedStyle(el); el.__ttPos = cs.position === 'static' ? 1 : 2; if (el.__ttPos === 1) el.style.position = 'relative'; }
      } else {
        el.classList.remove('tt-ac-lift');
        if (el.__ttPos === 1) el.style.position = '';
        el.__ttPos = 0;
      }
      el = el.parentElement; n++;
    }
  }
  function place(box) {
    if (busy) return; busy = true;
    try {
      var inp = anchorOf(box); if (!inp) return;
      var r = inp.getBoundingClientRect();
      var vv = window.visualViewport, vh = vv ? vv.height : window.innerHeight, vw = vv ? vv.width : window.innerWidth;
      var h = Math.min(250, box.scrollHeight || 250);
      var left = Math.max(8, Math.min(r.left, vw - 228)), width = Math.max(220, Math.min(r.width, vw - 16));
      var top = r.bottom + 4;
      if (top + h + 8 > vh && r.top - h - 4 > 8) top = r.top - h - 4;
      else if (top + h + 8 > vh) { h = Math.max(120, vh - top - 8); }
      var s = box.style;
      s.position = 'fixed'; s.minWidth = '0'; s.maxWidth = (vw - 16) + 'px'; s.bottom = 'auto'; s.right = 'auto';
      s.width = width + 'px'; s.maxHeight = Math.min(250, h) + 'px'; s.left = left + 'px'; s.top = top + 'px';
      /* a glass pop-up can act as the "screen" for fixed items: measure and correct the difference */
      var b = box.getBoundingClientRect(), dx = b.left - left, dy = b.top - top;
      if (Math.abs(dx) > 1) s.left = (left - dx) + 'px';
      if (Math.abs(dy) > 1) s.top = (top - dy) + 'px';
    } catch (e) { console.warn('dropdown place', e); }
    finally { busy = false; }
  }
  function sync(box) {
    var open = box.style.display === 'block' || box.style.display === 'flex';
    if (open) { if (!box.__ttOpen) { box.__ttOpen = 1; lift(box, true); } place(box); }
    else if (box.__ttOpen) { box.__ttOpen = 0; lift(box, false); }
  }
  var raf = 0, pend = new Set();
  function flush() { raf = 0; pend.forEach(sync); pend.clear(); }
  function queue(box) { pend.add(box); if (!raf) raf = requestAnimationFrame(flush); }

  function boot() {
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        var t = m.target;
        if (t.nodeType === 1 && t.classList && t.classList.contains('solid-suggestion-box')) queue(t);
        else if (m.type === 'childList') {
          m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.classList.contains('solid-suggestion-box')) queue(n); else n.querySelectorAll && n.querySelectorAll('.solid-suggestion-box').forEach(queue); } });
          if (t.classList && t.classList.contains('solid-suggestion-box')) queue(t);
        }
      });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'], childList: true });
    var rep = function () { document.querySelectorAll('.solid-suggestion-box').forEach(function (b) { if (b.__ttOpen) queue(b); }); };
    window.addEventListener('scroll', rep, { capture: true, passive: true });
    window.addEventListener('resize', rep);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', rep);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
