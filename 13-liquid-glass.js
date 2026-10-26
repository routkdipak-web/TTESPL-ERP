/* TTESPL ERP - Liquid Water Glass behaviour (v31).
   Lightweight, dependency-free. Only toggles classes / CSS variables - never reads or writes ERP data.
   Markup:
     Tabs : <div class="lg-glass lg-tabs" data-lg-tabs role="tablist"> <button class="lg-tab" role="tab" data-lg-target="#p1">A</button> ... </div>
            <div class="lg-panel" id="p1">...</div>
     Menu : <button data-lg-menu="#m1" aria-haspopup="menu">Open</button>  <div class="lg-glass lg-menu" id="m1" role="menu">...</div>
     Modal: <button data-lg-modal="#dlg">Open</button>  <div class="lg-overlay" id="dlg"><div class="lg-glass lg-modal-card" role="dialog" aria-modal="true">...</div></div>
   API: window.LiquidGlass.{initTabs, openMenu, closeMenu, openModal, closeModal, refresh} */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function byHash(sel) { try { return sel && sel.charAt(0) === '#' ? document.getElementById(sel.slice(1)) : null; } catch (e) { return null; } }

  /* ---------- light reflection follows the pointer (one rAF per frame) ---------- */
  var GLASS = '.lg-glass,.card,.stat-card,.page-top-header-banner,.qa-tile,.cat-chip,.nav-bar,.auth-card,.tt-sheet-card';
  var raf = 0, ptr = null;
  document.addEventListener('pointermove', function (e) {
    var t = e.target && e.target.closest ? e.target.closest(GLASS) : null;
    if (!t) return; ptr = { t: t, x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0; if (!ptr) return; var r = ptr.t.getBoundingClientRect();
      ptr.t.style.setProperty('--lg-x', (ptr.x - r.left) + 'px');
      ptr.t.style.setProperty('--lg-y', (ptr.y - r.top) + 'px');
      ptr.t.style.setProperty('--lg-angle', Math.round(((ptr.x - r.left) / Math.max(1, r.width)) * 360) + 'deg');
    });
  }, { passive: true });
  document.addEventListener('pointerdown', function (e) { var t = e.target && e.target.closest ? e.target.closest(GLASS) : null; if (!t) return; var r = t.getBoundingClientRect(); t.style.setProperty('--lg-x', (e.clientX - r.left) + 'px'); t.style.setProperty('--lg-y', (e.clientY - r.top) + 'px'); }, { passive: true });

  /* ---------- tabs ---------- */
  function initTabs(root) {
    if (!root || root.__lg) return; root.__lg = 1;
    var tabs = $$('.lg-tab', root), ind = $('.lg-tab-indicator', root);
    if (!ind) { ind = document.createElement('span'); ind.className = 'lg-tab-indicator'; ind.setAttribute('aria-hidden', 'true'); root.insertBefore(ind, root.firstChild); }
    function place(tab, animate) {
      if (!tab) return;
      var x = tab.offsetLeft, w = tab.offsetWidth;
      if (!animate || reduce) ind.style.transition = 'none';
      ind.style.width = w + 'px'; ind.style.transform = 'translate3d(' + x + 'px,0,0)'; ind.classList.add('is-ready');
      if (!animate || reduce) { void ind.offsetWidth; ind.style.transition = ''; }
      else { ind.classList.remove('is-moving'); void ind.offsetWidth; ind.classList.add('is-moving'); }
      if (root.scrollWidth > root.clientWidth) { try { tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' }); } catch (e) {} }
    }
    function select(tab, animate) {
      tabs.forEach(function (t) {
        var on = t === tab; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
        var p = byHash(t.getAttribute('data-lg-target')); if (p) p.hidden = !on;
      });
      place(tab, animate);
      root.dispatchEvent(new CustomEvent('lg:tabchange', { detail: { tab: tab, target: tab.getAttribute('data-lg-target') } }));
    }
    root.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('.lg-tab'); if (t && root.contains(t)) select(t, true); });
    root.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement); if (i < 0) return;
      var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
      if (n < 0) return; e.preventDefault(); n = (n + tabs.length) % tabs.length; tabs[n].focus(); select(tabs[n], true);
    });
    var start = $('.lg-tab[aria-selected="true"]', root) || tabs[0]; if (start) select(start, false);
    if (window.ResizeObserver) new ResizeObserver(function () { place($('.lg-tab[aria-selected="true"]', root), false); }).observe(root);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place($('.lg-tab[aria-selected="true"]', root), false); });
  }

  /* ---------- drop-down menu ---------- */
  var openMenus = [];
  function openMenu(trigger, menu) {
    if (!trigger || !menu) return; closeAllMenus(menu);
    var host = trigger.offsetParent || document.body; if (menu.parentNode !== host && host !== document.body) { /* keep in place; absolute to trigger wrapper */ }
    var tr = trigger.getBoundingClientRect(), wrap = menu.offsetParent ? menu.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    var mw = menu.offsetWidth || 220, left = tr.left - wrap.left, vw = document.documentElement.clientWidth;
    if (tr.left + mw > vw - 8) left = left - (tr.left + mw - (vw - 8));
    menu.style.left = Math.max(0, left) + 'px'; menu.style.top = (tr.bottom - wrap.top + 8) + 'px';
    menu.style.setProperty('--lg-ox', Math.max(0, Math.min(100, ((tr.left + tr.width / 2) - (wrap.left + left)) / mw * 100)) + '%');
    menu.classList.remove('is-closing'); menu.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); menu.__trigger = trigger;
    openMenus.push(menu);
    var first = $('[role="menuitem"]', menu); if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function closeMenu(menu, restore) {
    if (!menu || !menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open'); menu.classList.add('is-closing');
    var done = function () { menu.classList.remove('is-closing'); }; reduce ? done() : setTimeout(done, 190);
    var t = menu.__trigger; if (t) { t.setAttribute('aria-expanded', 'false'); if (restore) try { t.focus({ preventScroll: true }); } catch (e) {} }
    openMenus = openMenus.filter(function (m) { return m !== menu; });
  }
  function closeAllMenus(except) { openMenus.slice().forEach(function (m) { if (m !== except) closeMenu(m); }); }

  /* ---------- modal ---------- */
  var modalStack = [];
  function openModal(ov) {
    if (!ov || ov.classList.contains('is-open')) return;
    ov.__prev = document.activeElement; ov.classList.add('is-open'); modalStack.push(ov);
    document.documentElement.style.overflow = 'hidden';
    var card = $('.lg-modal-card', ov); if (card) { if (!card.hasAttribute('tabindex')) card.tabIndex = -1; setTimeout(function () { try { card.focus({ preventScroll: true }); } catch (e) {} }, 30); }
  }
  function closeModal(ov) {
    if (!ov || !ov.classList.contains('is-open')) return;
    ov.classList.remove('is-open'); modalStack = modalStack.filter(function (m) { return m !== ov; });
    if (!modalStack.length) document.documentElement.style.overflow = '';
    try { ov.__prev && ov.__prev.isConnected && ov.__prev.focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---------- delegated events (works for content added later) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t.closest) return;
    var mt = t.closest('[data-lg-menu]');
    if (mt) { var m = byHash(mt.getAttribute('data-lg-menu')); if (m) { m.classList.contains('is-open') ? closeMenu(m, true) : openMenu(mt, m); } return; }
    if (openMenus.length && !t.closest('.lg-menu')) closeAllMenus();
    else if (t.closest('.lg-menu [role="menuitem"]')) closeMenu(t.closest('.lg-menu'), true);
    var mo = t.closest('[data-lg-modal]'); if (mo) { openModal(byHash(mo.getAttribute('data-lg-modal'))); return; }
    var cl = t.closest('[data-lg-close]'); if (cl) { closeModal(cl.closest('.lg-overlay')); return; }
    if (t.classList && t.classList.contains('lg-overlay')) closeModal(t);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (modalStack.length) closeModal(modalStack[modalStack.length - 1]); else if (openMenus.length) closeMenu(openMenus[openMenus.length - 1], true);
  });
  window.addEventListener('resize', function () { closeAllMenus(); }, { passive: true });


  /* ---------- sliding liquid indicator for the app's existing tab groups ----------
     Works with whatever toggles .active / .on on the buttons (the app's own code is untouched). */
  var TAB_GROUPS = [
    { c: '.sub-tabs', b: '.sub-tab-btn', on: '.active' },
    { c: '.tt23-tabs', b: 'button', on: '.on,.active,[aria-selected="true"]' },
    { c: '.ttx-tabs', b: 'button', on: '.on' }
  ];
  function wireGroup(box, g) {
    if (box.__lgTi) return; box.__lgTi = 1; box.classList.add('lg-ti');
    var ind = document.createElement('span'); ind.className = 'lg-ti-ind'; ind.setAttribute('aria-hidden', 'true');
    var pend = 0, last = null;
    function ensure() { if (!ind.parentNode) box.insertBefore(ind, box.firstChild); }
    function place(anim) {
      pend = 0; ensure(); var act = box.querySelector(g.b.split(',').map(function (x) { return g.on.split(',').map(function (o) { return ':scope > ' + x + o; }).join(','); }).join(','));
      if (!act || !act.offsetWidth) { ind.classList.remove('is-ready'); return; }
      var moved = last !== act; last = act;
      if (!anim || reduce) ind.style.transition = 'none';
      ind.style.width = act.offsetWidth + 'px'; ind.style.height = act.offsetHeight + 'px';
      ind.style.borderRadius = getComputedStyle(act).borderRadius;
      ind.style.transform = 'translate3d(' + act.offsetLeft + 'px,' + act.offsetTop + 'px,0)'; ind.classList.add('is-ready');
      if (!anim || reduce) { void ind.offsetWidth; ind.style.transition = ''; }
      else if (moved) { ind.classList.remove('is-moving'); void ind.offsetWidth; ind.classList.add('is-moving'); }
    }
    function later() { if (!pend) pend = requestAnimationFrame(function () { place(true); }); }
    new MutationObserver(function (m) { if (m.every(function (x) { return x.target === ind || x.addedNodes[0] === ind || x.removedNodes[0] === ind; })) return; later(); })
      .observe(box, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
    if (window.ResizeObserver) new ResizeObserver(function () { place(false); }).observe(box);
    place(false);
  }
  function scanGroups() { TAB_GROUPS.forEach(function (g) { $$(g.c + ':not(.lg-ti)').forEach(function (box) { wireGroup(box, g); }); }); }
  var scanQ = 0;
  new MutationObserver(function () { if (!scanQ) scanQ = requestAnimationFrame(function () { scanQ = 0; scanGroups(); }); })
    .observe(document.documentElement, { childList: true, subtree: true });

  function refresh() { $$('[data-lg-tabs]').forEach(initTabs); scanGroups(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh); else refresh();

  window.LiquidGlass = { initTabs: initTabs, openMenu: openMenu, closeMenu: closeMenu, openModal: openModal, closeModal: closeModal, refresh: refresh };
})();

/* ==========================================================================
   Liquid motion v32: tab-open motion, nav ripple, blob stretch, auto lite-mode.
   switchTab is only WRAPPED: the original runs first-class, synchronously, with the same arguments and result.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.documentElement, LS = 'TTESPL_LG_MODE', LSA = 'TTESPL_LG_AUTO';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---------- performance mode: auto | full | lite ---------- */
  function mode() { var m = ls(LS); return m === 'full' || m === 'lite' ? m : 'auto'; }
  function applyMode() {
    var m = mode(), lite = m === 'lite' || (m === 'auto' && (ls(LSA) === 'lite' || (navigator.deviceMemory && navigator.deviceMemory <= 2)));
    root.classList.toggle('lg-lite', !!lite);
  }
  window.ttLgMode = function () { var m = mode(); return m === 'auto' ? 'Auto' : m === 'full' ? 'Full' : 'Lite'; };
  window.ttLgCycleMode = function () {
    var next = { auto: 'full', full: 'lite', lite: 'auto' }[mode()]; ls(LS, next === 'auto' ? null : next); if (next === 'auto') ls(LSA, null); applyMode();
    try { if (window.ttOpenSettings) window.ttOpenSettings(); } catch (e) {}
  };
  applyMode();

  /* auto mode: watch the real frame times of the first tab changes; slow phone -> lite (remembered) */
  var probed = 0;
  function probe() {
    if (mode() !== 'auto' || ls(LSA) || probed >= 3 || reduce) return; probed++;
    var last = performance.now(), dts = [], end = last + 700;
    (function tick(t) { dts.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else done(); })(last);
    function done() {
      dts.shift(); if (dts.length < 8) return; dts.sort(function (a, b) { return a - b; });
      var p90 = dts[Math.floor(dts.length * .9)]; if (p90 > 34) { slow = (slow || 0) + 1; } if ((slow || 0) >= 2) { ls(LSA, 'lite'); applyMode(); } else if (probed >= 3) ls(LSA, 'full');
    }
  }
  var slow = 0;

  /* ---------- veil + water ring + direction on every tab change ---------- */
  var veil, navItems = function () { return Array.prototype.slice.call(document.querySelectorAll('.nav-item')); };
  function ensureVeil() { if (!veil) { veil = document.createElement('div'); veil.id = 'lgVeil'; veil.setAttribute('aria-hidden', 'true'); document.body.appendChild(veil); } return veil; }
  function wave(x, y) {
    var w = document.createElement('div'); w.className = 'lg-wave'; w.style.left = x + 'px'; w.style.top = y + 'px';
    w.addEventListener('animationend', function () { w.remove(); }); document.body.appendChild(w); setTimeout(function () { w.remove(); }, 1200);
  }
  function prep(tab, el) {
    var items = navItems(), cur = -1, nxt = -1, i;
    for (i = 0; i < items.length; i++) {
      if (items[i].classList.contains('active')) cur = i;
      if ((items[i].getAttribute('onclick') || '').indexOf("'" + tab + "'") >= 0) nxt = i;
    }
    if (el && items.indexOf(el) >= 0) nxt = items.indexOf(el);
    if (nxt < 0 || nxt === cur) return;                                  /* same tab: no effect */
    document.body.setAttribute('data-lg-dir', nxt < cur ? 'back' : 'fwd');
    if (reduce || root.classList.contains('lg-lite')) return;
    var r = items[nxt].getBoundingClientRect(); wave(r.left + r.width / 2, r.top + r.height / 2);
    var v = ensureVeil(); v.classList.remove('go'); void v.offsetWidth; v.classList.add('go');
    probe();
  }
  function wrap() {
    var o = window.switchTab; if (typeof o !== 'function' || o.__lgW) return false;
    var w = function (tab) { try { prep(tab, arguments[1]); } catch (e) {} return o.apply(this, arguments); };
    Object.keys(o).forEach(function (k) { try { w[k] = o[k]; } catch (e) {} }); w.__lgW = true;
    window.switchTab = w; try { switchTab = w; } catch (e) {} return true;
  }
  wrap(); document.addEventListener('DOMContentLoaded', function () { wrap(); setTimeout(wrap, 600); setTimeout(wrap, 2500); });

  /* ---------- nav: tap ripple + blob stretch ---------- */
  document.addEventListener('pointerdown', function (e) {
    var it = e.target.closest && e.target.closest('.nav-item'); if (!it || reduce) return;
    var r = it.getBoundingClientRect(), s = document.createElement('span'); s.className = 'lg-rip';
    s.style.setProperty('--rx', (e.clientX - r.left) + 'px'); s.style.setProperty('--ry', (e.clientY - r.top) + 'px');
    s.addEventListener('animationend', function () { s.remove(); }); it.appendChild(s); setTimeout(function () { s.remove(); }, 1100);
  }, { passive: true });
  function watchPill() {
    var pill = document.getElementById('navActivePill'); if (!pill || pill.__lgW) return; pill.__lgW = 1;
    var last = pill.style.transform;
    new MutationObserver(function () {
      if (pill.style.transform === last) return; last = pill.style.transform; if (reduce) return;
      pill.classList.remove('is-moving'); void pill.offsetWidth; pill.classList.add('is-moving');
    }).observe(pill, { attributes: true, attributeFilter: ['style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchPill); else watchPill();
})();
