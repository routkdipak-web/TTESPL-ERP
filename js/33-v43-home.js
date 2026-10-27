/* TTESPL ERP v43 - HOME SMART CARDS (23) + ANIMATED NUMBERS & SPARKLINES (24)
   Read-only: reads Orders / Leads / Services / Stock and draws on the Home screen. Nothing is saved or changed. */
(function () {
  'use strict';
  function $(i) { return document.getElementById(i); }
  function N(x) { var v = parseFloat(x); return isNaN(v) ? 0 : v; }
  function R2(x) { return Math.round((N(x) + Number.EPSILON) * 100) / 100; }
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inr(n) { return '₹' + Math.round(N(n)).toLocaleString('en-IN'); }
  function short(n) { n = N(n); return n >= 1e7 ? '₹' + (n / 1e7).toFixed(2) + 'Cr' : n >= 1e5 ? '₹' + (n / 1e5).toFixed(2) + 'L' : n >= 1e3 ? '₹' + (n / 1e3).toFixed(1) + 'k' : '₹' + Math.round(n); }
  function cfg() { return window.ttAppear ? ttAppear() : { smart: true, anim: true }; }
  function iso(d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  function toIso(s) { s = String(s || '').trim(); var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2); m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(s); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; }
  function orders() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function leads() { return (typeof leadsData !== 'undefined' && leadsData) || []; }
  function svcs() { return (typeof serviceCallsData !== 'undefined' && serviceCallsData) || []; }
  function stock() { return (typeof sampleInventory !== 'undefined' && sampleInventory) || []; }
  function dOf(o) { return toIso(o.deliveredDate || o.orderDate); }
  function daysAgo(d) { var t = new Date(); t.setHours(0, 0, 0, 0); var x = new Date(d + 'T00:00:00'); return Math.round((t - x) / 864e5); }

  /* ---------- numbers ---------- */
  function series(days) {
    var t = new Date(), keys = [], S = {}, C = {};
    for (var i = days - 1; i >= 0; i--) { var d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i); var k = iso(d); keys.push(k); S[k] = 0; C[k] = 0; }
    orders().forEach(function (o) {
      if (!o || o.status === 'Cancelled') return;
      if (o.status === 'Delivered') { var d = dOf(o); if (d in S) S[d] += N(o.totalAmount); }
      (o.payments || []).forEach(function (p) { if (!p || p.refund || N(p.amount) <= 0) return; var d = toIso(p.at || p.date); if (d in C) C[d] += N(p.amount); });
    });
    return { keys: keys, sales: keys.map(function (k) { return R2(S[k]); }), coll: keys.map(function (k) { return R2(C[k]); }) };
  }
  function stats() {
    var today = iso(new Date()), s = { coll: 0, delivToday: 0, delivLate: 0, fu: 0, due30: 0, due30n: 0, low: 0, svc: 0 };
    orders().forEach(function (o) {
      if (!o || o.status === 'Cancelled') return;
      (o.payments || []).forEach(function (p) { if (p && !p.refund && N(p.amount) > 0 && toIso(p.at || p.date) === today) s.coll += N(p.amount); });
      if (o.status === 'Pending') { var dd = toIso(o.deliveryDate); if (dd === today) s.delivToday++; else if (dd && dd < today) s.delivLate++; }
      var due = Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount)));
      if (o.status === 'Delivered' && due > 0.009) { if (o.payFollowupDate && toIso(o.payFollowupDate) <= today) s.fu++; var d0 = dOf(o); if (d0 && daysAgo(d0) >= 30) { s.due30 += due; s.due30n++; } }
    });
    leads().forEach(function (l) { if (l && l.followupDate && toIso(l.followupDate) <= today && !/convert|lost|closed|won|cancel/i.test(String(l.status || ''))) s.fu++; });
    try { s.low = stock().filter(function (p) { return p && p.category !== 'Catalog Equipment' && N(p.stock) <= (window.ttLowLimit ? ttLowLimit(p) : 2); }).length; } catch (e) {}
    s.svc = svcs().filter(function (x) { return x && !/completed/i.test(String(x.status || '')); }).length;
    s.coll = R2(s.coll); s.due30 = R2(s.due30); return s;
  }
  function go(tab) {
    var el = document.querySelector('.nav-item[onclick*="\'' + tab + '\'"]');
    try { switchTab(tab, el); } catch (e) {}
  }
  window.ttGoTab = go;

  /* ---------- smart cards ---------- */
  var CARD = 'flex:0 0 auto;min-width:128px;scroll-snap-align:start;border-radius:16px;padding:11px 13px;cursor:pointer;border:1px solid var(--border);background:var(--card);box-shadow:0 1px 4px rgba(0,0,0,.08);';
  function card(ico, label, val, sub, act, tone) {
    var col = tone === 'bad' ? 'var(--danger)' : tone === 'ok' ? 'var(--success)' : tone === 'warn' ? 'var(--warning,#d97706)' : 'var(--text-main)';
    return '<div class="tt43-sc" onclick="triggerAppHaptic&&triggerAppHaptic();' + act + '" style="' + CARD + '"><div style="font-size:11px;font-weight:800;color:var(--text-muted)">' + ico + ' ' + label + '</div>' +
      '<div class="tt43-num" style="font-size:20px;font-weight:900;color:' + col + ';margin-top:3px">' + val + '</div><div style="font-size:10.5px;color:var(--text-muted);margin-top:1px">' + sub + '</div></div>';
  }
  function smartHtml() {
    var s = stats();
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin:2px 2px 6px"><b style="font-size:13px">📌 Today at a glance</b><small style="color:var(--text-muted)">tap a card</small></div>' +
      '<div style="display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 10px;-webkit-overflow-scrolling:touch">' +
      (window.ttClaimsPending && ttClaimsPending() ? card('💳', 'Payment claims', String(ttClaimsPending()), 'customers say paid · verify', 'ttOpenClaims()', 'bad') : '') +
      card('💰', 'Collected today', inr(s.coll), 'cash + UPI + bank', 'ttOpenDaily&&ttOpenDaily()', 'ok') +
      card('🚚', 'Deliveries', s.delivToday + (s.delivLate ? ' <small style="font-size:11px;color:var(--danger)">+' + s.delivLate + ' late</small>' : ''), 'due today', "ttGoTab('orders')", s.delivLate ? 'warn' : '') +
      card('📞', 'Follow-ups', String(s.fu), 'payments + leads', 'ttOpenFollowups?ttOpenFollowups():ttGoTab(\'leads\')', s.fu ? 'warn' : '') +
      card('⏰', 'Overdue 30+ days', short(s.due30), s.due30n + ' bill' + (s.due30n === 1 ? '' : 's'), 'ttOpenCollect&&ttOpenCollect()', s.due30 > 0 ? 'bad' : 'ok') +
      card('📦', 'Low stock', String(s.low), 'items to reorder', 'ttOpenLowStock&&ttOpenLowStock()', s.low ? 'warn' : 'ok') +
      card('🛠️', 'Open service calls', String(s.svc), 'pending / warranty', "ttGoTab('services')", '') +
      card('🌙', 'Close the day', '📋', 'report for owner', 'ttOpenClosing&&ttOpenClosing()', '') + '</div>';
  }
  function bars(S) {
    var max = Math.max.apply(null, S.sales.concat(S.coll, [1])), W = 320, Hh = 96, bw = 14, gap = (W - 7 * bw * 2) / 8, out = '';
    for (var i = 0; i < 7; i++) {
      var x = gap + i * (bw * 2 + gap), h1 = Math.max(2, S.sales[i] / max * (Hh - 22)), h2 = Math.max(2, S.coll[i] / max * (Hh - 22)), day = S.keys[i].slice(8) + '/' + S.keys[i].slice(5, 7);
      out += '<g onclick="ttTrendTip(' + i + ')" style="cursor:pointer"><rect x="' + x + '" y="' + (Hh - 14 - h1) + '" width="' + bw + '" height="' + h1 + '" rx="3" fill="var(--primary,#38bdf8)" opacity=".85"/><rect x="' + (x + bw + 1) + '" y="' + (Hh - 14 - h2) + '" width="' + bw + '" height="' + h2 + '" rx="3" fill="var(--success,#16a34a)" opacity=".85"/>' +
        '<text x="' + (x + bw) + '" y="' + (Hh - 2) + '" text-anchor="middle" font-size="8.5" fill="var(--text-muted)">' + day + '</text></g>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" style="width:100%;height:auto;display:block">' + out + '</svg>';
  }
  window.ttTrendTip = function (i) {
    var S = series(7), el = $('tt43TrendTip'); if (!el) return;
    el.innerHTML = '<b>' + S.keys[i].slice(8) + '/' + S.keys[i].slice(5, 7) + '</b> · Sales ' + inr(S.sales[i]) + ' · Collected ' + inr(S.coll[i]);
  };
  function trendHtml() {
    var S = series(7), ts = S.sales.reduce(function (a, b) { return a + b; }, 0), tc = S.coll.reduce(function (a, b) { return a + b; }, 0);
    return '<div class="card" id="tt43Trend" style="margin-bottom:14px"><div class="card-header"><strong class="card-title">📈 Last 7 days</strong><span style="font-size:11px;color:var(--text-muted)"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--primary,#38bdf8)"></i> Sales ' + short(ts) +
      ' &nbsp;<i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--success,#16a34a)"></i> Collected ' + short(tc) + '</span></div>' + bars(S) +
      '<div id="tt43TrendTip" style="font-size:11.5px;color:var(--text-muted);text-align:center;min-height:16px;margin-top:4px">Tap a bar to see the day</div></div>';
  }
  function spark(vals, color) {
    var max = Math.max.apply(null, vals.concat([1])), w = 70, h = 22, pts = vals.map(function (v, i) { return (i * (w / (vals.length - 1))).toFixed(1) + ',' + (h - 2 - v / max * (h - 5)).toFixed(1); });
    return '<svg class="tt43-spark" viewBox="0 0 ' + w + ' ' + h + '" style="position:absolute;right:10px;bottom:8px;width:70px;height:22px;opacity:.7;pointer-events:none"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function render() {
    var dash = $('view-dashboard'); if (!dash) return;
    var c = cfg(), host = $('tt43Smart');
    if (!c.smart) { if (host) host.remove(); var t0 = $('tt43Trend'); if (t0) t0.remove(); document.querySelectorAll('.tt43-spark').forEach(function (e) { e.remove(); }); return; }
    var grid = dash.querySelector('.grid-4'); if (!grid) return;
    if (!host) { host = document.createElement('div'); host.id = 'tt43Smart'; host.style.cssText = 'margin-bottom:6px'; grid.parentNode.insertBefore(host, grid); }
    var keepScroll = (host.querySelector('div[style*="overflow-x"]') || {}).scrollLeft || 0;
    host.innerHTML = smartHtml();
    var sc = host.querySelector('div[style*="overflow-x"]'); if (sc) sc.scrollLeft = keepScroll;
    var tr = $('tt43Trend'); if (tr) tr.remove();
    var st = grid.querySelector('.stat-card'); if (st && !st.querySelector('.tt43-spark')) { st.style.position = 'relative'; st.insertAdjacentHTML('beforeend', spark(series(7).coll, 'rgba(255,255,255,.85)')); }
    else if (st) { var old = st.querySelector('.tt43-spark'); if (old) old.outerHTML = spark(series(7).coll, 'rgba(255,255,255,.85)'); }
    countAll(host);
  }

  /* ---------- count-up animation ---------- */
  var BUSY = false, LAST = {}, RAF = {};
  function lite() { return document.documentElement.classList.contains('v42-lite') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function animate(el, key) {
    var txt = el.textContent, m = /(\d[\d,]*(?:\.\d+)?)/.exec(txt); if (!m) return;
    var to = parseFloat(m[1].replace(/,/g, '')), dec = (m[1].split('.')[1] || '').length, from = LAST[key] != null ? LAST[key] : 0; LAST[key] = to;
    if (from === to || lite() || !cfg().anim) return;
    var pre = txt.slice(0, m.index), post = txt.slice(m.index + m[1].length), t0 = performance.now(), D = 650;
    cancelAnimationFrame(RAF[key]);
    (function step(t) {
      var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3), v = from + (to - from) * e;
      el.textContent = pre + (k < 1 ? v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : m[1]) + post; el.__own = el.textContent;
      if (k < 1) RAF[key] = requestAnimationFrame(step);
    })(t0);
  }
  var IDS = ['dashTodayRecv', 'dashTotalDue', 'dashActiveServices', 'dashTotalItems', 'dashTotalClients'];
  function countAll(host) { if (host) [].forEach.call(host.querySelectorAll('.tt43-num'), function (e, i) { var txt = e.textContent; e.textContent = txt; LAST['sc' + i] = LAST['sc' + i] != null ? LAST['sc' + i] : 0; animate(e, 'sc' + i); }); }
  function watch() {
    IDS.forEach(function (id) {
      var el = $(id); if (!el || el.__w) return; el.__w = 1;
      new MutationObserver(function () { if (el.textContent === el.__own) return; animate(el, id); }).observe(el, { childList: true, characterData: true, subtree: true });
      animate(el, id);
    });
  }

  var wrapped = false;
  function wrapDash() {
    var f = window.renderDashboard; if (typeof f !== 'function' || f.__sc) return;
    var w = function () { var r = f.apply(this, arguments); setTimeout(function () { render(); watch(); }, 60); return r; }; w.__sc = 1; window.renderDashboard = w; try { renderDashboard = w; } catch (e) {}
  }
  wrapDash(); setTimeout(wrapDash, 1500);
  document.addEventListener('tt-appear', function () { render(); });
  document.addEventListener('DOMContentLoaded', function () { render(); watch(); });
  setTimeout(function () { render(); watch(); }, 1800);
  setInterval(function () { var d = $('view-dashboard'); if (d && d.classList.contains('active') && !document.hidden) { render(); watch(); } }, 30000);
  window.ttRenderHome = function () { render(); watch(); };
})();
