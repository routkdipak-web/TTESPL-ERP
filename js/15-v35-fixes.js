/* TTESPL ERP module: 15-v35-fixes.js  (adds behaviour only; no existing function/formula is changed) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function navFor(tab) {
    var items = document.querySelectorAll('.nav-item');
    for (var i = 0; i < items.length; i++) { var oc = items[i].getAttribute('onclick') || ''; if (oc.indexOf("switchTab('" + tab + "'") >= 0) return items[i]; }
    return null;
  }

  /* ---------- profile menu: blurred, untouchable background ---------- */
  function initScrim() {
    var card = $('profileDropdownCard'); if (!card || $('ttProfScrim')) return;
    var sc = document.createElement('div'); sc.id = 'ttProfScrim'; sc.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sc);
    function sync() { sc.classList.toggle('on', card.classList.contains('show')); }
    function shut(e) { e.preventDefault(); e.stopPropagation(); try { closeProfileDrawer(); } catch (x) { card.classList.remove('show'); } sync(); }
    sc.addEventListener('click', shut); sc.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    new MutationObserver(sync).observe(card, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  /* ---------- Home tiles open the matching list ---------- */
  var TILES = {
    dashTodayRecv: function () { openLedger({ from: today(), to: today(), type: 'all' }); },
    dashTotalDue: function () { openLedger({ from: '', to: '', type: 'due' }); },
    dashActiveServices: function () { go('services'); },
    dashTotalItems: function () { go('inventory'); }
  };
  function go(tab) { try { switchTab(tab, navFor(tab)); } catch (e) { console.warn(e); } }
  function openLedger(f) {
    var L = window.__ttLedState;
    if (L) { L.from = f.from; L.to = f.to; L.emp = 'ALL'; L.type = f.type; }
    go('billing');
    try { renderBilling(); } catch (e) { try { renderBilling(f.type === 'due' ? 'due' : 'all'); } catch (e2) {} }
    var body = document.querySelector('#view-billing'); if (body && body.scrollTo) { try { body.scrollTo(0, 0); } catch (e) {} } try { window.scrollTo(0, 0); } catch (e) {}
  }
  function initTiles() {
    Object.keys(TILES).forEach(function (id) {
      var el = $(id), card = el && el.closest('.stat-card'); if (!card || card.__tt35) return; card.__tt35 = 1;
      card.classList.add('tt-tile-link'); card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0');
      var run = function () { try { triggerAppHaptic(); } catch (e) {} TILES[id](); };
      card.addEventListener('click', run);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } });
    });
  }

  /* ---------- New Order: customer's latest 3 bills ---------- */
  function last10(p) { return String(p || '').replace(/\D/g, '').slice(-10); }
  function nm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function parseCust(v) {
    v = String(v || ''); var m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(v);
    return m ? { name: m[1].trim(), phone: last10(m[2]) } : { name: v.trim(), phone: '' };
  }
  function daysAgo(d) { var a = new Date(String(d).slice(0, 10) + 'T00:00:00'), b = new Date(today() + 'T00:00:00'); return Math.round((b - a) / 86400000); }
  function dFmt(s) { try { return new Date(String(s).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return s || ''; } }
  function renderRecent() {
    var inp = $('ordCustSearchInput'); if (!inp) return;
    var box = $('ttRecentOrders');
    if (!box) {
      box = document.createElement('div'); box.id = 'ttRecentOrders'; box.style.display = 'none';
      var g = inp.closest('.grid-2'); if (g && g.parentNode) g.parentNode.insertBefore(box, g.nextSibling); else return;
    }
    var c = parseCust(inp.value);
    if (!c.name && !c.phone) { box.style.display = 'none'; return; }
    var list = []; try { list = ordersData || []; } catch (e) {}
    var editing = ($('editOrderId') || {}).value || '';
    var hits = list.filter(function (o) {
      if (!o || o.status === 'Cancelled' || String(o.id) === String(editing)) return false;
      if (c.phone && last10(o.phone) === c.phone) return true;
      return c.name && nm(o.customerName) === nm(c.name) && (!c.phone || !last10(o.phone));
    });
    if (!hits.length) { box.style.display = 'none'; return; }
    hits = hits.map(function (o, i) { return { o: o, i: i }; }).sort(function (a, b) {
      var da = String(a.o.orderDate || ''), db = String(b.o.orderDate || ''); if (da !== db) return da < db ? 1 : -1; return a.i - b.i;
    }).slice(0, 3).map(function (x) { return x.o; });
    var newest = daysAgo(hits[0].orderDate), warn = '';
    if (!isNaN(newest) && newest >= 0 && newest <= 7) warn = '<div class="tro-warn">⚠ Last order was ' + (newest === 0 ? 'TODAY' : newest + ' day' + (newest > 1 ? 's' : '') + ' ago') + ' — check it is not a duplicate entry.</div>';
    box.innerHTML = '<div class="tro-h"><span>🧾 Latest orders of ' + esc(c.name || c.phone) + '</span><span style="opacity:.6">' + hits.length + ' shown</span></div>' + warn +
      hits.map(function (o) {
        var st = o.status || '', cls = st === 'Delivered' ? 'ok' : 'pe', due = Number(o.dueAmount) || 0;
        return '<div class="tro-r"><div><b>' + esc(o.id) + '</b><small>' + esc(dFmt(o.orderDate)) + (due > 0 ? ' · Due ' + inr(due) : '') + '</small></div><div style="text-align:right"><b>' + inr(o.totalAmount) + '</b><br><span class="tro-st ' + cls + '">' + esc(st || 'Order') + '</span></div></div>';
      }).join('');
    box.style.display = 'block';
  }
  function initRecent() {
    var inp = $('ordCustSearchInput'); if (!inp || inp.__tt35) return; inp.__tt35 = 1;
    var t = 0; inp.addEventListener('input', function () { clearTimeout(t); t = setTimeout(renderRecent, 180); });
    inp.addEventListener('change', renderRecent);
    if (typeof window.selectCustomerSuggestion === 'function') {
      var orig = window.selectCustomerSuggestion;
      window.selectCustomerSuggestion = function (id) { var r = orig.apply(this, arguments); if (id === 'ordCustSearchInput') renderRecent(); return r; };
    }
    if (typeof window.openOrderModal === 'function') {
      var oo = window.openOrderModal;
      window.openOrderModal = function () { var r = oo.apply(this, arguments); setTimeout(renderRecent, 30); return r; };
    }
  }

  function boot() { initScrim(); initTiles(); initRecent(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 800);
})();
