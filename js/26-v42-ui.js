/* TTESPL ERP v42.1 - SMOOTH + MINIMAL UI
   - Profile menu: same items, grouped into sections (the original list stays in the page and every click is forwarded to it)
   - Toast instead of blocking "saved" pop-ups   - Ultra smooth mode   - scroll position per tab   - swipe a popup down to close
   - nothing animates while the app is hidden
   No data, formula or existing function is changed. */
(function () {
  'use strict';
  var root = document.documentElement;
  function $(s, r) { return (r || document).querySelector(s); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem('TTESPL_V42_' + k); localStorage.setItem('TTESPL_V42_' + k, v); } catch (e) {} return null; }

  /* ---------- Ultra smooth mode (auto-on for low-memory phones the first time) ---------- */
  function liteOn() { return root.classList.contains('v42-lite'); }
  function setLite(on) { root.classList.toggle('v42-lite', !!on); store('LITE', on ? '1' : '0'); }
  (function () {
    var s = store('LITE');
    if (s === null) { var low = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4); s = low ? '1' : '0'; }
    root.classList.toggle('v42-lite', s === '1');
  })();

  /* ---------- pause animations when hidden ---------- */
  document.addEventListener('visibilitychange', function () { root.classList.toggle('v42-paused', document.hidden); });

  /* ---------- toast instead of blocking alert for plain success messages ---------- */
  var tEl, tTimer;
  function toast(msg) {
    if (!tEl) { tEl = document.createElement('div'); tEl.id = 'v42Toast'; tEl.setAttribute('role', 'status'); document.body.appendChild(tEl); }
    tEl.textContent = msg; tEl.classList.remove('on'); void tEl.offsetWidth; tEl.classList.add('on');
    clearTimeout(tTimer); tTimer = setTimeout(function () { tEl.classList.remove('on'); }, 2300);
  }
  window.ttToast42 = toast;
  var nativeAlert = window.alert.bind(window);
  window.alert = function (m) {
    var s = String(m == null ? '' : m);
    var good = /(success|saved|updated|added|deleted|removed|delivered|copied|done)/i.test(s);
    var bad = /(fail|error|invalid|cannot|can't|not |please|denied|required|only|must|unable|wrong|restor|import|backup|reload|restart|password|pin|login|logout|\n)/i.test(s);
    if (good && !bad && s.length <= 90 && document.body) { toast(s.replace(/^[^\w₹]+/, '')); return; }
    return nativeAlert(s);
  };

  /* ---------- keep each tab's scroll position ---------- */
  (function () {
    var pos = {};
    function wrap() {
      var o = window.switchTab; if (typeof o !== 'function' || o.__v42) return;
      var w = function (tab, el) {
        var cur = $('.view-panel.active'); if (cur) pos[cur.id] = window.scrollY || 0;
        var r = o.apply(this, arguments);
        var y = pos['view-' + tab] || 0;
        requestAnimationFrame(function () { window.scrollTo(0, y); });
        return r;
      };
      w.__v42 = 1; window.switchTab = w;
    }
    wrap(); document.addEventListener('DOMContentLoaded', wrap); setTimeout(wrap, 1200);
  })();

  /* ---------- swipe a popup down (from its header) to close ---------- */
  (function () {
    var card, ov, y0 = 0, dy = 0, on = false;
    document.addEventListener('touchstart', function (e) {
      var h = e.target.closest && e.target.closest('.tt-sheet-card .card-header'); if (!h || e.target.closest('button, input, select, a')) return;
      card = h.closest('.tt-sheet-card'); ov = card.closest('.auth-overlay'); y0 = e.touches[0].clientY; dy = 0; on = true;
      card.classList.add('v42-dragging');
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!on) return; dy = Math.max(0, e.touches[0].clientY - y0); card.style.transform = 'translate3d(0,' + dy + 'px,0)';
    }, { passive: true });
    function end() {
      if (!on) return; on = false; card.classList.remove('v42-dragging');
      if (dy > 90) {
        var btn = card.querySelector('.card-header button'); card.classList.add('v42-snap'); card.style.transform = 'translate3d(0,100%,0)';
        var c = card; setTimeout(function () { if (btn) btn.click(); setTimeout(function () { c.classList.remove('v42-snap'); c.style.transform = ''; c.style.animation = ''; }, 320); }, 140);
      } else {
        card.classList.add('v42-snap'); card.style.transform = 'none'; var c2 = card;
        setTimeout(function () { c2.classList.remove('v42-snap'); c2.style.transform = ''; c2.style.animationName = 'none'; }, 240);
        if (ov && !ov.__v42w) { ov.__v42w = 1; new MutationObserver(function () { if (ov.style.display === 'none') { c2.style.animationName = ''; } }).observe(ov, { attributes: true, attributeFilter: ['style'] }); }
      }
    }
    document.addEventListener('touchend', end, { passive: true }); document.addEventListener('touchcancel', end, { passive: true });
  })();

  /* ---------- PROFILE MENU: grouped mirror of the original list ---------- */
  var CATS = [
    { id: 'biz', title: 'Sales & Reports', fns: /ttOpenInsights|ttOpenDaily|ttOpenCollect|ttOpenReceipts|ttOpenGst|openQuotationHistory|ttOpenTally|ttOpenClosing|ttOpenClaims|ttOpenOnline|ttOpenShop|ttOpenOnlineCust/ },
    { id: 'work', title: 'Work & Team', fns: /ttOpenHub|openNotionCrm|openTravelExpenses|ttExpOpen|ttOpenLowStock|ttaiCentre|ttOpenPurchaseBill|ttOpenPublicLinks/ },
    { id: 'admin', title: 'Admin & Data', fns: /openStaffManageModal|ttOpenActivity|ttOpenRecycle|openBackupModal/ },
    { id: 'pref', title: 'Preferences', fns: /requestAppSystemPermissions|ttOpenAppearance|ttOpenBiometric/ }
  ];
  var QUICK = /openGlobalSearchModal|toggleThemeMode|ttOpenSettings/;
  var OUT = /performFullLogout/;
  var openSec = {}; try { openSec = JSON.parse(store('PMOPEN') || 'null') || { biz: 1 }; } catch (e) { openSec = { biz: 1 }; }
  var query = '';

  function visible(el) { return el && el.style.display !== 'none'; }
  function readItems() {
    var list = $('#profileDropdownCard .profile-menu-list'); if (!list) return [];
    return [].slice.call(list.querySelectorAll('.profile-menu-item')).filter(visible).map(function (el) {
      var sp = el.querySelectorAll('.profile-menu-item-left span'), icon = sp[0] ? sp[0].textContent.trim() : '•', label = sp[1] ? sp[1].textContent.trim() : el.textContent.trim();
      var tail = el.lastElementChild, tag = (tail && !tail.classList.contains('profile-menu-item-left')) ? tail.textContent.trim() : '';
      var fn = el.getAttribute('onclick') || '';
      return { el: el, icon: icon, label: label, tag: tag, fn: fn, key: (label + ' ' + tag).toLowerCase() };
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function row(it, isQuick) {
    var tag = (/\d/.test(it.tag) || /toggleThemeMode/.test(it.fn)) ? '<span class="pm-tg">' + esc(it.tag.replace(/^\W+/, '')) + '</span>' : '';
    return isQuick ? '<div class="pm-q" data-i="' + it.idx + '"><i>' + esc(it.icon) + '</i><span>' + esc(/toggleThemeMode/.test(it.fn) ? 'Theme' : /Search/.test(it.label) ? 'Search' : it.label.split(' ')[0]) + '</span></div>'
      : '<div class="pm-row" data-i="' + it.idx + '" data-k="' + esc(it.key) + '"><span class="pm-ic">' + esc(it.icon) + '</span><span class="pm-lb">' + esc(it.label) + '</span>' + tag + '<span class="pm-go"></span></div>';
  }
  var cache = [];
  function build() {
    var card = $('#profileDropdownCard'); if (!card) return;
    var items = readItems(); items.forEach(function (it, i) { it.idx = i; }); cache = items;
    var nm = ($('#menuStaffName') || {}).textContent || 'Staff', role = ($('#menuStaffRole') || {}).textContent || '', ph = (($('#menuStaffPhone') || {}).textContent || '').replace(/^Mob:\s*/i, '');
    var quick = items.filter(function (i) { return QUICK.test(i.fn); }), out = items.filter(function (i) { return OUT.test(i.fn); }), used = {};
    quick.concat(out).forEach(function (i) { used[i.idx] = 1; });
    var secs = CATS.map(function (c) { return { c: c, list: items.filter(function (i) { return !used[i.idx] && c.fns.test(i.fn) && (used[i.idx] = 1); }) }; });
    var rest = items.filter(function (i) { return !used[i.idx]; }); if (rest.length) secs.push({ c: { id: 'more', title: 'More' }, list: rest });
    var html = '<div class="pm-me"><div class="pm-av">' + esc((nm.trim()[0] || 'S').toUpperCase()) + '</div><div style="min-width:0"><div class="pm-nm">' + esc(nm) + '</div><div class="pm-sub"><span class="pm-role">' + esc(role) + '</span><span>' + esc(ph) + '</span></div></div></div>' +
      '<label class="pm-find"><span style="opacity:.6">🔎</span><input type="search" id="pm2Q" placeholder="Search menu" autocomplete="off" value="' + esc(query) + '"></label>' +
      '<div class="pm-quick">' + quick.map(function (i) { return row(i, true); }).join('') + '</div>' +
      secs.filter(function (s) { return s.list.length; }).map(function (s) {
        return '<div class="pm-sec' + (openSec[s.c.id] ? ' open' : '') + '" data-s="' + s.c.id + '"><div class="pm-sh"><b>' + esc(s.c.title) + '</b><span class="pm-n">' + s.list.length + '</span><span class="pm-ch"></span></div><div class="pm-sb"><div class="pm-si">' +
          s.list.map(function (i) { return row(i); }).join('') + (s.c.id === 'pref' ? '<div class="pm-row" data-lite="1"><span class="pm-ic">⚡</span><span class="pm-lb">Ultra smooth mode</span><span class="pm-sw' + (liteOn() ? ' on' : '') + '"></span></div>' : '') + '</div></div></div>';
      }).join('') + (secs.every(function (s) { return !s.list.length; }) ? '' : '') +
      '<div class="pm-none pm-hide">Nothing found</div>' +
      (out[0] ? '<div class="pm-out" data-i="' + out[0].idx + '"><span>' + esc(out[0].icon) + '</span><span>Log out</span></div>' : '');
    var box = $('#pm2', card);
    if (!box) { box = document.createElement('div'); box.id = 'pm2'; card.insertBefore(box, card.firstChild); }
    box.innerHTML = html; applyFilter();
  }
  function applyFilter() {
    var box = $('#pm2'); if (!box) return; var q = query.trim().toLowerCase();
    box.classList.toggle('pm-searching', !!q);
    var any = false;
    [].forEach.call(box.querySelectorAll('.pm-row[data-k]'), function (r) { var m = !q || r.getAttribute('data-k').indexOf(q) >= 0; r.classList.toggle('pm-hide', !m); if (m) any = true; });
    [].forEach.call(box.querySelectorAll('.pm-sec'), function (s) { s.classList.toggle('pm-hide', !!q && !s.querySelector('.pm-row[data-k]:not(.pm-hide)')); });
    var q1 = box.querySelector('.pm-quick'); if (q1) q1.classList.toggle('pm-hide', !!q);
    var none = box.querySelector('.pm-none'); if (none) none.classList.toggle('pm-hide', !q || any);
  }
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'pm2Q') { query = e.target.value; applyFilter(); } });
  document.addEventListener('click', function (e) {
    var box = e.target.closest && e.target.closest('#pm2'); if (!box) return;
    var sh = e.target.closest('.pm-sh');
    if (sh) { var s = sh.parentNode, id = s.getAttribute('data-s'); s.classList.toggle('open'); openSec[id] = s.classList.contains('open') ? 1 : 0; store('PMOPEN', JSON.stringify(openSec)); return; }
    var lite = e.target.closest('[data-lite]');
    if (lite) { setLite(!liteOn()); lite.querySelector('.pm-sw').classList.toggle('on', liteOn()); toast(liteOn() ? 'Ultra smooth mode on' : 'Ultra smooth mode off'); return; }
    var t = e.target.closest('[data-i]'); if (!t) return;
    var it = cache[Number(t.getAttribute('data-i'))]; if (!it || !it.el) return;
    try { if (typeof triggerAppHaptic === 'function') triggerAppHaptic(); } catch (x) {}
    it.el.click();   /* runs the original inline handler (it also closes the drawer) */
  });

  /* rebuild whenever the drawer opens, and when other scripts add / change original items */
  var timer;
  function later() { clearTimeout(timer); timer = setTimeout(function () { if (document.activeElement && document.activeElement.id === 'pm2Q') return; build(); }, 150); }
  function boot() {
    var card = $('#profileDropdownCard'); if (!card) return false;
    build();
    new MutationObserver(function () { if (card.classList.contains('show')) build(); }).observe(card, { attributes: true, attributeFilter: ['class'] });
    var list = $('.profile-menu-list', card);
    if (list) new MutationObserver(later).observe(list, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] });
    return true;
  }
  if (!boot()) document.addEventListener('DOMContentLoaded', boot);
  setTimeout(build, 2500); setTimeout(build, 6000);
})();
