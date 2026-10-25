/* TTESPL ERP module: 07-profit-loss-sales-settings.js */
/* =====================================================================
   v23: PROFIT & LOSS (premium) - sales profit / margin / markup, with-GST / without-GST,
   monthly overheads (salary, rent, electricity ...), pending cost-price list, PDF / CSV / Share.
   (old data / formulas untouched - only reads Orders + Stock, writes only new OVERHEADS and Stock prices)
   ===================================================================== */
var overheadsData = getStored("OVERHEADS", []);
window.overheadsData = overheadsData;
window.ttRenderPnlIfOpen = function () {
  var m = document.getElementById('ttPnlModal'), f = document.getElementById('ttPnlFormModal'), p = document.getElementById('ttPnlPriceModal');
  if (m && m.style.display === 'flex' && !(f && f.style.display === 'flex') && !(p && p.style.display === 'flex') && typeof window.ttPnlRender === 'function') window.ttPnlRender();
  if (typeof window.ttPnlBadge === 'function') window.ttPnlBadge();
};

(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var N = function (x) { return Number(x) || 0; };
  var r2 = function (x) { return Math.round((N(x) + 1e-9) * 100) / 100; };
  var INR = function (n) { n = N(n); return (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var PCT = function (n) { n = N(n); return (isFinite(n) ? r2(n) : 0).toFixed(2) + '%'; };
  var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); };
  var isAdm = function () { try { return typeof isAdminUser === 'function' && isAdminUser(); } catch (e) { return false; } };
  var CATS = ['Salary', 'Rent', 'Electricity Bill', 'Water Bill', 'Internet / Phone', 'Transport / Fuel', 'Marketing', 'Maintenance', 'Office Supplies', 'Taxes / Fees', 'Other'];
  var Q = { from: '', to: '', gst: 'ex', tab: 'ov' };
  var PRESETS = [['today', 'Today'], ['7d', 'Last 7 Days'], ['month', 'This Month'], ['last', 'Last Month'], ['fy', 'This FY'], ['all', 'All Time']];

  function iso(d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  function preset(k) {
    var t = new Date(), y = t.getFullYear(), m = t.getMonth();
    if (k === 'today') return [iso(t), iso(t)];
    if (k === '7d') { var a = new Date(t); a.setDate(a.getDate() - 6); return [iso(a), iso(t)]; }
    if (k === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
    if (k === 'last') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    if (k === 'fy') { var fy = m >= 3 ? y : y - 1; return [fy + '-04-01', (fy + 1) + '-03-31']; }
    return ['', ''];
  }
  Q.from = preset('month')[0]; Q.to = preset('month')[1];
  function inRange(d) { return (!Q.from || d >= Q.from) && (!Q.to || d <= Q.to); }
  function monthLabel(m) { try { var p = m.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' }); } catch (e) { return m; } }
  function frac(month) {
    if (!Q.from && !Q.to) return 1;
    var y = +month.slice(0, 4), m = +month.slice(5, 7); if (!y || !m) return 0;
    var ms = iso(new Date(y, m - 1, 1)), me = iso(new Date(y, m, 0));
    var a = (Q.from && Q.from > ms) ? Q.from : ms, b = (Q.to && Q.to < me) ? Q.to : me;
    if (a > b) return 0;
    var days = Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5) + 1, dim = new Date(y, m, 0).getDate();
    return Math.min(1, days / dim);
  }
  function modal(id, z, w) {
    var m = $(id);
    if (!m) { m = document.createElement('div'); m.id = id; m.className = 'auth-overlay'; document.body.appendChild(m); }
    m.style.zIndex = z; m.setAttribute('data-w', w || 720);
    return m;
  }
  function setModal(m, html) { m.innerHTML = '<div class="auth-card tt23-card" style="max-width:' + (m.getAttribute('data-w') || 720) + 'px;width:100%;">' + html + '</div>'; }

  /* ---------- data ---------- */
  function invIndex() {
    var byId = {}, byName = {}, byCode = {};
    (sampleInventory || []).forEach(function (p) {
      byId[String(p.id)] = p; var n = norm(p.name); if (n && !byName[n]) byName[n] = p; if (p.code) { var c = norm(p.code); if (!byCode[c]) byCode[c] = p; }
    });
    return { byId: byId, byName: byName, byCode: byCode, alias: aliasMap() };
  }
  function resolve(it, idx) { var al = idx.alias && idx.alias[norm(it.name)]; if (al != null && idx.byId[String(al)]) return idx.byId[String(al)]; return idx.byId[String(it.id)] || idx.byName[norm(it.name)] || (it.code ? idx.byCode[norm(it.code)] : null) || null; }
  function acc() { return { sale: 0, saleAll: 0, cost: 0, unp: 0, unpSale: 0, qty: 0, n: 0 }; }
  function add(a, L) { a.saleAll += L.sale; a.qty += L.qty; if (L.priced) { a.sale += L.sale; a.cost += L.cost; } else { a.unp++; a.unpSale += L.sale; } }
  function fin(a) { a.profit = a.sale - a.cost; a.margin = a.sale > 0 ? a.profit / a.sale * 100 : 0; a.markup = a.cost > 0 ? a.profit / a.cost * 100 : 0; return a; }
  function prodKey(it, p) { return p ? 'i' + p.id : 'n' + norm(it.name); }

  function buildLines(o, idx, f) {
    return (o.items || []).map(function (it) {
      var p = resolve(it, idx), qty = N(it.qty), tot = N(it.total) || r2(qty * N(it.rate)), ff = (f !== 1 && window.ttItemGstRate) ? 1 / (1 + ttItemGstRate(it) / 100) : f;   /* v41: per-item GST rate */
      var unit = p ? N(p.dealerPrice) : 0, priced = unit > 0;
      var L = { it: it, p: p, aliased: !!(idx.alias && idx.alias[norm(it.name)]), key: prodKey(it, p), name: it.name || (p && p.name) || 'Item', qty: qty, sale: tot * ff, priced: priced, unitCost: unit * ff, cost: priced ? unit * qty * ff : 0, unitSale: qty ? tot * ff / qty : 0 };
      L.profit = priced ? L.sale - L.cost : 0;
      L.margin = priced && L.sale > 0 ? L.profit / L.sale * 100 : 0;
      L.markup = priced && L.cost > 0 ? L.profit / L.cost * 100 : 0;
      return L;
    });
  }

  function calc() {
    var idx = invIndex(), f = Q.gst === 'ex' ? 1 / 1.18 : 1;
    var orders = (ordersData || []).filter(function (o) { return o && o.status === 'Delivered' && inRange(ttDateOf(o)); });
    var T = acc(), invs = [], prod = {}, cust = {}, mon = {};
    orders.forEach(function (o) {
      var I = { o: o, id: o.id, cust: o.customerName || '', date: ttDateOf(o), lines: buildLines(o, idx, f), a: acc() };
      var cK = norm(I.cust) || 'unknown', mK = I.date.slice(0, 7);
      cust[cK] = cust[cK] || { name: I.cust || 'Unknown', a: acc(), inv: 0 }; cust[cK].inv++;
      mon[mK] = mon[mK] || acc();
      I.lines.forEach(function (L) {
        add(I.a, L); add(T, L); add(cust[cK].a, L); add(mon[mK], L);
        var pr = prod[L.key] = prod[L.key] || { name: L.name, a: acc() }; add(pr.a, L);
      });
      fin(I.a); invs.push(I);
    });
    fin(T);
    invs.sort(function (a, b) { return (b.date + b.id).localeCompare(a.date + a.id); });
    var oh = [], ohCat = {}, ohMon = {}, OH = 0;
    (overheadsData || []).concat(typeof window.ttPnlExpenseOh === 'function' ? window.ttPnlExpenseOh() : []).forEach(function (e) {
      if (!e || !e.month) return; var amt = N(e.amount) * frac(e.month); if (amt <= 0) return;
      oh.push({ e: e, amt: amt }); OH += amt; ohCat[e.cat || 'Other'] = (ohCat[e.cat || 'Other'] || 0) + amt; ohMon[e.month] = (ohMon[e.month] || 0) + amt;
    });
    var months = {}; Object.keys(mon).forEach(function (k) { months[k] = 1; }); Object.keys(ohMon).forEach(function (k) { months[k] = 1; });
    var monthRows = Object.keys(months).filter(Boolean).sort().reverse().map(function (k) {
      var a = fin(mon[k] || acc()); return { m: k, a: a, oh: ohMon[k] || 0, net: a.profit - (ohMon[k] || 0) };
    });
    return { T: T, invs: invs, prod: prod, cust: cust, oh: oh, ohCat: ohCat, OH: OH, monthRows: monthRows, net: T.profit - OH, spend: T.cost + OH };
  }

  /* pending: every product sold (all delivered bills, all time) that has no cost / dealer price */
  function pending() {
    var idx = invIndex(), g = {};
    (ordersData || []).forEach(function (o) {
      if (!o || o.status !== 'Delivered') return;
      (o.items || []).forEach(function (it) {
        var p = resolve(it, idx); if (p && N(p.dealerPrice) > 0) return;
        var k = prodKey(it, p), qty = N(it.qty), tot = N(it.total) || r2(qty * N(it.rate));
        var x = g[k] = g[k] || { key: k, name: it.name || (p && p.name) || 'Item', p: p, times: 0, qty: 0, last: 0, lastDate: '', hsn: it.hsn };
        x.times++; x.qty += qty; var d = ttDateOf(o); if (d >= x.lastDate) { x.lastDate = d; x.last = qty ? tot / qty : tot; }
        if (p) x.p = p;
      });
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.times - a.times; });
  }
  window.ttPnlBadge = function () {
    var n = 0; try { n = pending().length; } catch (e) {}
    var b = $('ttPnlLedBadge'); if (b) { b.textContent = n; b.style.display = n ? 'inline-flex' : 'none'; }
    return n;
  };

  /* ---------- UI ---------- */
  function chips() {
    return '<div class="tt21-chips">' + PRESETS.map(function (p) {
      var r = preset(p[0]), on = (r[0] === Q.from && r[1] === Q.to);
      return '<button type="button" class="' + (on ? 'on' : '') + '" onclick="triggerAppHaptic(); ttPnlPreset(\'' + p[0] + '\')">' + p[1] + '</button>'; }).join('') + '</div>';
  }
  function filterBar() {
    return '<div class="tt23-filter">' +
      '<div class="grid-2"><div class="form-group" style="margin-bottom:6px;"><label class="form-label">From date</label><input type="date" id="ttPnlFrom" value="' + H(Q.from) + '" onchange="ttPnlSet()"></div>' +
      '<div class="form-group" style="margin-bottom:6px;"><label class="form-label">To date</label><input type="date" id="ttPnlTo" value="' + H(Q.to) + '" onchange="ttPnlSet()"></div></div>' +
      chips() +
      '<div class="tt23-gst"><span>Prices basis:</span>' +
      '<button type="button" class="' + (Q.gst === 'ex' ? 'on' : '') + '" onclick="triggerAppHaptic(); ttPnlGst(\'ex\')">Without GST</button>' +
      '<button type="button" class="' + (Q.gst === 'inc' ? 'on' : '') + '" onclick="triggerAppHaptic(); ttPnlGst(\'inc\')">With GST</button></div></div>';
  }
  function pc(v) { return v > 0.004 ? 'tt23-pos' : (v < -0.004 ? 'tt23-neg' : ''); }
  function tile(label, val, cls, sub) { return '<div class="tt23-tile ' + (cls || '') + '"><small>' + label + '</small><b>' + val + '</b>' + (sub ? '<i>' + sub + '</i>' : '') + '</div>'; }
  function outBar(id) {
    var a = id ? ",'" + H(id) + "'" : '';
    return '<div class="tt23-out"><button class="btn btn-primary btn-sm" onclick="triggerAppHaptic(); ttPnlOut(\'pdf\'' + a + ')">📄 PDF</button><button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ttPnlOut(\'csv\'' + a + ')">⬇️ CSV</button><button class="btn btn-wa btn-sm" onclick="triggerAppHaptic(); ttPnlOut(\'share\'' + a + ')">📤 Share</button></div>';
  }
  function warn(C) {
    var n = pending().length;
    if (!n) return '';
    return '<div class="tt23-warn" onclick="triggerAppHaptic(); ttPnlTab(\'pend\')">⚠️ <b>' + n + ' product' + (n > 1 ? 's' : '') + '</b> sold in bills have no cost (dealer) price. ' +
      (C && C.unp ? C.unp + ' bill line(s) worth ' + INR(C.unpSale) + ' in this period are excluded from profit. ' : '') + 'Tap to update prices →</div>';
  }
  function tabsBar() {
    var n = pending().length;
    var T = [['ov', '📊 Overview'], ['inv', '🧾 Invoices'], ['prod', '📦 Products'], ['cust', '👤 Customers'], ['oh', '💸 Overheads'], ['pend', '⚠️ Pending Prices' + (n ? ' <span class="tt23-cnt">' + n + '</span>' : '')]];
    return '<div class="sub-tabs tt23-tabs">' + T.map(function (t) { return '<button type="button" class="sub-tab-btn ' + (Q.tab === t[0] ? 'active' : '') + '" onclick="triggerAppHaptic(); ttPnlTab(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function rowM(a) {
    return '<div class="tt23-mini"><span>Sales <b>' + INR(a.sale) + '</b></span><span>Cost <b>' + INR(a.cost) + '</b></span><span class="' + pc(a.profit) + '">Profit <b>' + INR(a.profit) + '</b></span><span>Margin <b>' + PCT(a.margin) + '</b></span><span>Markup <b>' + PCT(a.markup) + '</b></span></div>';
  }

  function viewOv(C) {
    var T = C.T, h = '';
    h += '<div class="tt23-hero ' + (C.net >= 0 ? 'good' : 'bad') + '"><small>' + (C.net >= 0 ? 'NET PROFIT' : 'NET LOSS') + ' · ' + (Q.gst === 'ex' ? 'WITHOUT GST' : 'WITH GST') + '</small><b>' + INR(C.net) + '</b><span>Gross profit ' + INR(T.profit) + ' − Overheads ' + INR(C.OH) + '</span><em>' + (C.net >= 0 ? '📈' : '📉') + '</em></div>';
    h += '<div class="tt23-grid">' +
      tile('SALES (costed items)', INR(T.sale), '', C.invs.length + ' invoices') +
      tile('COST OF GOODS', INR(T.cost)) +
      tile('GROSS PROFIT', INR(T.profit), pc(T.profit)) +
      tile('PROFIT MARGIN', PCT(T.margin), pc(T.profit), 'profit ÷ sales') +
      tile('PROFIT MARKUP', PCT(T.markup), pc(T.profit), 'profit ÷ cost') +
      tile('OVERHEADS', INR(C.OH), 'bad', 'salary, rent, bills…') +
      tile('TOTAL SPEND', INR(C.spend), '', 'goods + overheads') +
      tile('ALL SALES', INR(T.saleAll), '', 'incl. items without cost') + '</div>';
    h += warn(T);
    h += '<div class="tt23-sec">📅 Month-wise Profit / Loss</div>';
    if (!C.monthRows.length) h += '<div class="tt23-empty">No sales or overheads in this period.</div>';
    else h += '<div class="tt23-tw"><table class="tt23-tbl"><thead><tr><th>Month</th><th>Sales</th><th>Cost</th><th>Gross</th><th>Overheads</th><th>Net</th></tr></thead><tbody>' + C.monthRows.map(function (r) {
      return '<tr><td>' + H(monthLabel(r.m)) + '</td><td>' + INR(r.a.sale) + '</td><td>' + INR(r.a.cost) + '</td><td class="' + pc(r.a.profit) + '">' + INR(r.a.profit) + '</td><td>' + INR(r.oh) + '</td><td class="' + pc(r.net) + '"><b>' + INR(r.net) + '</b></td></tr>'; }).join('') + '</tbody></table></div>';
    var cats = Object.keys(C.ohCat).sort(function (a, b) { return C.ohCat[b] - C.ohCat[a]; });
    if (cats.length) h += '<div class="tt23-sec">💸 Overheads by category</div>' + cats.map(function (k) { return '<div class="tt23-line"><span>' + H(k) + '</span><b>' + INR(C.ohCat[k]) + '</b></div>'; }).join('');
    h += '<div class="tt23-note">Overheads of a partly selected month are pro-rated by days. Courier charges are not counted as sales. Cost uses the current Dealer Price in Stock.</div>';
    return h;
  }
  function viewInv(C) {
    if (!C.invs.length) return '<div class="tt23-empty">No delivered invoices in this period.</div>';
    return C.invs.map(function (I) {
      return '<div class="tt23-row" onclick="triggerAppHaptic(); ttPnlInv(\'' + H(I.id).replace(/&#39;/g, "\\'") + '\')"><div class="tt23-rh"><div><b>' + H(I.cust) + '</b><small>' + H(I.id) + ' · ' + H(I.date) + (I.a.unp ? ' · <span class="tt23-neg">⚠ ' + I.a.unp + ' line(s) no cost</span>' : '') + '</small></div><div class="tt23-rp ' + pc(I.a.profit) + '">' + INR(I.a.profit) + '<small>profit</small></div></div>' + rowM(I.a) + '</div>';
    }).join('');
  }
  function viewAgg(map, kind) {
    var list = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return fin(b.a).profit - fin(a.a).profit; });
    if (!list.length) return '<div class="tt23-empty">No data in this period.</div>';
    return list.map(function (x) { fin(x.a);
      return '<div class="tt23-row"><div class="tt23-rh"><div><b>' + H(x.name) + '</b><small>' + (kind === 'cust' ? x.inv + ' invoices · ' : '') + 'Qty ' + x.a.qty + (x.a.unp ? ' · <span class="tt23-neg">⚠ ' + x.a.unp + ' line(s) no cost</span>' : '') + '</small></div><div class="tt23-rp ' + pc(x.a.profit) + '">' + INR(x.a.profit) + '<small>profit</small></div></div>' + rowM(x.a) + '</div>'; }).join('');
  }
  function viewOh(C) {
    var h = '<div class="tt23-ohbar"><button class="btn btn-primary btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttPnlOhForm()">➕ Add Expense</button><button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttPnlOhCopy()">📋 Copy last month</button></div>';
    h += '<div class="tt23-grid">' + tile('TOTAL OVERHEADS', INR(C.OH), 'bad', 'in selected period') + tile('TOTAL SALARY', INR(C.ohCat['Salary'] || 0), '', '') + tile('RENT', INR(C.ohCat['Rent'] || 0), '', '') + tile('ELECTRICITY', INR(C.ohCat['Electricity Bill'] || 0), '', '') + '</div>';
    var list = (overheadsData || []).filter(function (e) { return e && e.month && frac(e.month) > 0; }).sort(function (a, b) { return (b.month + (b.at || '')).localeCompare(a.month + (a.at || '')); });
    if (!list.length) return h + '<div class="tt23-empty">No overhead entries for this period. Add salary, rent, electricity bill etc. month by month.</div>';
    var last = '';
    list.forEach(function (e) {
      if (e.month !== last) { last = e.month; h += '<div class="tt23-sec">' + H(monthLabel(e.month)) + '</div>'; }
      h += '<div class="tt23-line tt23-click" onclick="triggerAppHaptic(); ttPnlOhForm(\'' + H(e.id) + '\')"><span>' + H(e.cat || 'Other') + (e.note ? '<small>' + H(e.note) + '</small>' : '') + '</span><b>' + INR(e.amount) + '</b></div>';
    });
    return h;
  }
  function viewPend() {
    var L = pending();
    var h = '<div class="tt23-note" style="margin-top:0;">Enter the <b>Dealer (cost) price with GST</b> for each product. If the invoice name is spelled differently from Stock, tap a row and <b>search &amp; pick the correct Stock product</b> - the link is remembered for every invoice, and the price is saved to Stock.</div>';
    if (!L.length) return h + '<div class="tt23-empty">✅ All sold products have a cost price. Nothing pending.</div>';
    return h + L.map(function (x) {
      return '<div class="tt23-row" onclick="triggerAppHaptic(); ttPnlPrice(\'' + H(x.key).replace(/&#39;/g, "\\'") + '\')"><div class="tt23-rh"><div><b>' + H(x.name) + '</b><small>Sold ' + x.times + '× · Qty ' + x.qty + ' · Last rate ' + INR(x.last) + (x.p ? '' : ' · <span class="tt23-neg">not matched to Stock</span>') + '</small></div><div class="tt23-edit">✏️ Edit / Match</div></div></div>'; }).join('');
  }

  window.ttPnlRender = function () {
    var m = $('ttPnlModal'); if (!m) return;
    var st = m.scrollTop, C = calc(), body;
    if (Q.tab === 'ov') body = viewOv(C); else if (Q.tab === 'inv') body = viewInv(C); else if (Q.tab === 'prod') body = viewAgg(C.prod, 'prod');
    else if (Q.tab === 'cust') body = viewAgg(C.cust, 'cust'); else if (Q.tab === 'oh') body = viewOh(C); else body = viewPend();
    setModal(m, '<div class="card-header"><div><strong class="card-title">📈 Profit & Loss</strong><div style="font-size:11px;opacity:.7;">Delivered invoices · ' + (Q.from || Q.to ? H(Q.from || 'start') + ' → ' + H(Q.to || 'today') : 'All time') + '</div></div><button class="btn btn-outline btn-sm" onclick="ttPnlClose()">✕</button></div>' +
      (Q.tab === 'pend' ? '' : filterBar()) + tabsBar() + (Q.tab === 'pend' ? '' : outBar()) + '<div id="ttPnlBody">' + body + '</div>');
    m.scrollTop = st;
    window.ttPnlBadge();
  };
  window.openProfitLossModal = function () {
    if (!isAdm()) { alert('Only Admin can view Profit & Loss.'); return; }
    var m = modal('ttPnlModal', 3400, 760); m.style.display = 'flex'; window.ttPnlRender();
  };
  window.ttPnlClose = function () { var m = $('ttPnlModal'); if (m) m.style.display = 'none'; };
  window.ttPnlSet = function () { Q.from = ($('ttPnlFrom') || {}).value || ''; Q.to = ($('ttPnlTo') || {}).value || ''; window.ttPnlRender(); };
  window.ttPnlPreset = function (k) { var r = preset(k); Q.from = r[0]; Q.to = r[1]; window.ttPnlRender(); };
  window.ttPnlGst = function (g) { Q.gst = g; window.ttPnlRender(); if ($('ttPnlInvModal') && $('ttPnlInvModal').style.display === 'flex' && window.__ttPnlInvId) window.ttPnlInv(window.__ttPnlInvId); };
  window.ttPnlTab = function (t) { Q.tab = t; var m = $('ttPnlModal'); if (m) m.scrollTop = 0; window.ttPnlRender(); };

  /* ---------- invoice detail (per product profit) ---------- */
  function invExport(I) {
    var rows = I.lines.map(function (L) { return [L.name, L.qty, L.unitSale, L.priced ? L.unitCost : 'NO COST', L.priced ? L.profit : '', L.priced ? PCT(L.margin) : '', L.priced ? PCT(L.markup) : '']; });
    return { title: 'Invoice Profit - ' + I.id + ' - ' + I.cust, cols: ['Product', 'Qty', 'Sell / unit', 'Cost / unit', 'Profit', 'Margin', 'Markup'], rows: rows,
      sum: [['Invoice', I.id], ['Customer', I.cust], ['Date', I.date], ['Sales (costed)', INR(I.a.sale)], ['Cost', INR(I.a.cost)], ['Profit', INR(I.a.profit)], ['Margin', PCT(I.a.margin)], ['Markup', PCT(I.a.markup)]], money: [2, 3, 4] };
  }
  window.ttPnlInv = function (id) {
    var C = calc(), I = C.invs.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!I) { var o = (ordersData || []).filter(function (x) { return String(x.id) === String(id); })[0]; if (!o) return;
      var idx = invIndex(), f = Q.gst === 'ex' ? 1 / 1.18 : 1; I = { o: o, id: o.id, cust: o.customerName || '', date: ttDateOf(o), lines: buildLines(o, idx, f), a: acc() }; I.lines.forEach(function (L) { add(I.a, L); }); fin(I.a); }
    window.__ttPnlInvId = String(id);
    var m = modal('ttPnlInvModal', 3500, 680);
    m.style.display = 'flex';
    setModal(m, '<div class="card-header"><div><strong class="card-title">🧾 ' + H(I.cust) + '</strong><div style="font-size:11px;opacity:.7;">' + H(I.id) + ' · ' + H(I.date) + ' · ' + (Q.gst === 'ex' ? 'Without GST' : 'With GST') + '</div></div><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'ttPnlInvModal\').style.display=\'none\'">✕</button></div>' +
      '<div class="tt23-grid">' + tile('SALES', INR(I.a.sale)) + tile('COST', INR(I.a.cost)) + tile('PROFIT', INR(I.a.profit), pc(I.a.profit)) + tile('MARGIN / MARKUP', PCT(I.a.margin) + ' / ' + PCT(I.a.markup), pc(I.a.profit)) + '</div>' +
      outBar(I.id) + '<div class="tt23-sec">Products in this bill</div>' +
      I.lines.map(function (L) {
        return '<div class="tt23-row' + (L.priced ? '' : ' tt23-unp') + '"><div class="tt23-rh"><div><b>' + H(L.name) + '</b><small>Qty ' + L.qty + ' · Sell ' + INR(L.unitSale) + ' · Cost ' + (L.priced ? INR(L.unitCost) : '<span class="tt23-neg">not set</span>') + '</small></div>' +
          (L.priced ? '<div class="tt23-rp ' + pc(L.profit) + '">' + INR(L.profit) + '<small>profit</small>' + (L.aliased ? '<small style="display:block;color:#0284c7;font-weight:800;" data-k="' + H(L.key) + '" data-n="' + H(L.name) + '" onclick="event.stopPropagation(); ttPnlRematch(this)">🔗 matched · change</small>' : '') + '</div>' : '<button class="btn btn-accent btn-sm" onclick="event.stopPropagation(); triggerAppHaptic(); ttPnlPrice(\'' + H(L.key).replace(/&#39;/g, "\\'") + '\')">Set cost</button>') + '</div>' +
          (L.priced ? '<div class="tt23-mini"><span>Sales <b>' + INR(L.sale) + '</b></span><span>Cost <b>' + INR(L.cost) + '</b></span><span>Margin <b>' + PCT(L.margin) + '</b></span><span>Markup <b>' + PCT(L.markup) + '</b></span></div>' : '') + '</div>'; }).join('') +
      '<div class="tt23-note">Total for this bill: Profit ' + INR(I.a.profit) + ' · Margin ' + PCT(I.a.margin) + ' · Markup ' + PCT(I.a.markup) + (I.a.unp ? ' (lines without cost price are excluded)' : '') + '</div>');
  };

  /* ---------- pending price editor + searchable Stock match -> updates Stock ---------- */
  var PS = { key: '', name: '', last: 0, hsn: '', sel: null, timer: 0 };
  function aliasList() { try { var r = window.ttx && window.ttx.byId('OFFICE_CFG', 'pnl_aliases'); return (r && Array.isArray(r.list)) ? r.list : []; } catch (e) { return []; } }
  function aliasMap() { var m = {}; aliasList().forEach(function (a) { if (a && a.n && a.id != null) m[a.n] = a.id; }); return m; }
  function setAlias(name, pid) {
    var X = window.ttx, n = norm(name); if (!X || !n) return;
    var rec = JSON.parse(JSON.stringify(X.byId('OFFICE_CFG', 'pnl_aliases') || { id: 'pnl_aliases', list: [] }));
    rec.list = (rec.list || []).filter(function (a) { return a && a.n !== n; });
    rec.list.push({ n: n, id: pid, at: new Date().toISOString() });
    X.upsert('OFFICE_CFG', rec);
  }
  function bgm(x) { x = norm(x).replace(/[^a-z0-9]/g, ''); var o = {}; for (var i = 0; i < x.length - 1; i++) o[x.substr(i, 2)] = 1; return o; }
  function sim(a, b) { var n = 0, ta = 0, tb = 0, k; for (k in a) { ta++; if (b[k]) n++; } for (k in b) tb++; return ta + tb ? 2 * n / (ta + tb) : 0; }
  function closest(name, min, lim) {
    var q = bgm(name), out = [];
    (sampleInventory || []).forEach(function (p) { if (!p || !p.name) return; var v = sim(q, bgm(p.name)); if (v >= min) out.push({ v: v, p: p }); });
    out.sort(function (x, y) { return y.v - x.v; });
    return out.slice(0, lim).map(function (x) { return x.p; });
  }
  function findStock(q) {
    var t = norm(q).split(' ').filter(Boolean); if (!t.length) return { list: [], fuzzy: false };
    var first = [], rest = [], list = sampleInventory || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i]; if (!p) continue;
      var nm = norm(p.name), hay = nm + ' ' + norm(p.code) + ' ' + norm(p.machine) + ' ' + norm(p.category) + ' ' + norm(p.subCategory);
      if (t.every(function (w) { return hay.indexOf(w) >= 0; })) (nm.indexOf(t[0]) === 0 ? first : rest).push(p);
    }
    var r = first.concat(rest).slice(0, 40);
    return r.length ? { list: r, fuzzy: false } : { list: closest(q, 0.3, 12), fuzzy: true };
  }
  function pInfo(p) { return H(p.code || '') + (p.category ? ' · ' + H(p.category) : '') + ' · Cost ' + (N(p.dealerPrice) > 0 ? INR(p.dealerPrice) : '<span class="tt23-neg">not set</span>') + ' · Sell ' + (N(p.rate) > 0 ? INR(p.rate) : '—'); }
  function drawSel() {
    var b = $('ttPnlPSel'), n = $('ttPnlPNote'), p = PS.sel; if (!b) return;
    b.innerHTML = p ? '<div class="ttpk-sel"><div style="min-width:0"><b>✅ ' + H(p.name) + '</b><small>' + pInfo(p) + '</small></div><button type="button" class="ttpk-x" onclick="ttPnlPClear()">Change</button></div>'
      : '<div class="ttpk-none">No Stock product selected - a new product will be added to Stock with 0 quantity.</div>';
    if (n) n.innerHTML = p ? 'Invoice name <b>' + H(PS.name) + '</b> will be linked to this Stock product (all invoices), and the prices below are saved to it.' : 'Search the Stock list above to pick the right product, or just enter a price to add this as a new product.';
  }
  function drawRes(q) {
    var r = $('ttPnlPRes'); if (!r) return; var h = '';
    if (!q) {
      if (!PS.sel) { var sg = closest(PS.name, 0.3, 5); if (sg.length) h = '<div class="ttpk-h">💡 Suggested matches</div>' + sg.map(function (p) { return '<div class="ttpk-it" data-id="' + H(p.id) + '"><b>' + H(p.name) + '</b><small>' + pInfo(p) + '</small></div>'; }).join(''); }
    } else {
      var f = findStock(q);
      if (!f.list.length) h = '<div class="ttpk-h">No product found</div>';
      else h = (f.fuzzy ? '<div class="ttpk-h">No exact match - closest products</div>' : '') + f.list.map(function (p) { return '<div class="ttpk-it" data-id="' + H(p.id) + '"><b>' + H(p.name) + '</b><small>' + pInfo(p) + '</small></div>'; }).join('');
    }
    r.innerHTML = h; r.style.display = h ? 'block' : 'none';
  }
  window.ttPnlPQ = function (v) { clearTimeout(PS.timer); PS.timer = setTimeout(function () { drawRes(String(v || '')); }, 120); };
  window.ttPnlPPick = function (ev) {
    var el = ev && ev.target && ev.target.closest ? ev.target.closest('[data-id]') : null; if (!el) return;
    var id = el.getAttribute('data-id'), p = (sampleInventory || []).filter(function (x) { return String(x.id) === id; })[0]; if (!p) return;
    try { triggerAppHaptic(); } catch (e) {}
    PS.sel = p; drawSel();
    var d = $('ttPnlPDealer'), c = $('ttPnlPCust'), s = $('ttPnlPSearch');
    if (d) d.value = N(p.dealerPrice) > 0 ? N(p.dealerPrice) : '';
    if (c) c.value = N(p.rate) > 0 ? N(p.rate) : (PS.last ? r2(PS.last) : '');
    if (s) { s.value = ''; s.blur(); } drawRes('');
  };
  window.ttPnlPClear = function () { PS.sel = null; drawSel(); drawRes(''); var s = $('ttPnlPSearch'); if (s) s.focus(); };
  window.ttPnlRematch = function (el) { if (el) window.ttPnlPrice(el.getAttribute('data-k'), el.getAttribute('data-n')); };

  window.ttPnlPrice = function (key, nm) {
    var g = pending().filter(function (x) { return x.key === key; })[0];
    var p = g ? g.p : null, name = nm || (g ? g.name : '');
    if (!g && key.charAt(0) === 'i') { p = (sampleInventory || []).filter(function (x) { return 'i' + x.id === key; })[0] || null; if (!name && p) name = p.name; }
    else if (!g && !name) name = key.slice(1);
    if (!name && !p) return;
    PS = { key: key, name: name, last: g ? g.last : 0, hsn: (g && g.hsn) || '', sel: p, timer: 0 };
    var m = modal('ttPnlPriceModal', 3700, 440); m.style.display = 'flex';
    setModal(m, '<div class="card-header"><span class="card-title">✏️ Edit Product &amp; Price</span><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'ttPnlPriceModal\').style.display=\'none\'">✕</button></div>' +
      '<div style="font-size:11px;opacity:.7;">Name on invoice</div><div style="font-size:14px;font-weight:800;margin-bottom:10px;">' + H(name) + '</div>' +
      '<input type="hidden" id="ttPnlPKey" value="' + H(key) + '"><input type="hidden" id="ttPnlPName" value="' + H(name) + '">' +
      '<div class="form-group"><label class="form-label">🔎 Correct Stock product (search name / code)</label><div id="ttPnlPSel"></div>' +
      '<input type="search" id="ttPnlPSearch" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type to search Stock…" oninput="ttPnlPQ(this.value)" onfocus="ttPnlPQ(this.value)">' +
      '<div id="ttPnlPRes" class="ttpk-res" style="display:none" onclick="ttPnlPPick(event)"></div></div>' +
      '<div id="ttPnlPNote" style="font-size:11px;opacity:.75;margin-bottom:10px;"></div>' +
      '<div class="form-group"><label class="form-label">🏷️ Dealer / Cost Price (with GST) ₹ *</label><input type="number" id="ttPnlPDealer" min="0" step="any" inputmode="decimal" value="' + (p && N(p.dealerPrice) > 0 ? N(p.dealerPrice) : '') + '" placeholder="e.g. 850"></div>' +
      '<div class="form-group"><label class="form-label">👤 Customer Price (with GST) ₹</label><input type="number" id="ttPnlPCust" min="0" step="any" inputmode="decimal" value="' + (p && N(p.rate) > 0 ? N(p.rate) : (g && g.last ? r2(g.last) : '')) + '" placeholder="optional"></div>' +
      '<button class="btn btn-primary btn-block" onclick="triggerAppHaptic(); ttPnlSavePrice()">💾 Save &amp; Match</button>');
    drawSel(); drawRes('');
  };
  window.ttPnlSavePrice = function () {
    if (!isAdm()) { alert('Only Admin can do this.'); return; }
    var key = $('ttPnlPKey').value, name = $('ttPnlPName').value, dp = parseFloat($('ttPnlPDealer').value) || 0, cp = parseFloat($('ttPnlPCust').value) || 0;
    var g = pending().filter(function (x) { return x.key === key; })[0], p = PS.sel || null;
    if (p && !(dp > 0)) dp = N(p.dealerPrice);
    if (dp <= 0) { alert('Please enter a Dealer (cost) price greater than 0.'); return; }
    if (!p) {
      p = { id: Date.now(), name: name, code: '', category: 'General', stock: 0, dealerPrice: 0, rate: 0, machine: '', hsn: (g && g.hsn) || PS.hsn || '84139190', desc: '' };
      sampleInventory.unshift(p);
    }
    p.dealerPrice = dp; if (cp > 0) p.rate = cp;
    if (name && norm(name) !== norm(p.name)) setAlias(name, p.id);
    window.sampleInventory = sampleInventory;
    setStored("INVENTORY", sampleInventory);
    $('ttPnlPriceModal').style.display = 'none';
    try { if (typeof renderStockList === 'function') renderStockList(); if (typeof renderCatalog === 'function') renderCatalog(); } catch (e) {}
    window.ttPnlRender();
    if ($('ttPnlInvModal') && $('ttPnlInvModal').style.display === 'flex' && window.__ttPnlInvId) window.ttPnlInv(window.__ttPnlInvId);
    try { if (typeof showSuccessToast === 'function') showSuccessToast('Matched & price saved to Stock'); } catch (e) {}
  };

  /* ---------- overheads entry ---------- */
  function curMonth() { return iso(new Date()).slice(0, 7); }
  window.ttPnlOhForm = function (id) {
    if (!isAdm()) { alert('Only Admin can do this.'); return; }
    var e = id ? (overheadsData || []).filter(function (x) { return String(x.id) === String(id); })[0] : null;
    var month = e ? e.month : ((Q.to || Q.from || iso(new Date())).slice(0, 7));
    var m = modal('ttPnlFormModal', 3700, 400); m.style.display = 'flex';
    setModal(m, '<div class="card-header"><span class="card-title">' + (e ? '✏️ Edit Expense' : '➕ Add Expense') + '</span><button class="btn btn-outline btn-sm" onclick="ttPnlFormClose()">✕</button></div>' +
      '<input type="hidden" id="ttPnlOId" value="' + H(e ? e.id : '') + '">' +
      '<div class="form-group"><label class="form-label">Category</label><input type="text" id="ttPnlOCat" list="ttPnlCats" value="' + H(e ? e.cat : 'Salary') + '" autocomplete="off"><datalist id="ttPnlCats">' + CATS.map(function (c) { return '<option value="' + H(c) + '">'; }).join('') + '</datalist></div>' +
      '<div class="tt21-chips" style="margin-bottom:8px;">' + CATS.slice(0, 6).map(function (c) { return '<button type="button" onclick="document.getElementById(\'ttPnlOCat\').value=\'' + c + '\'">' + H(c) + '</button>'; }).join('') + '</div>' +
      '<div class="grid-2"><div class="form-group"><label class="form-label">Month</label><input type="month" id="ttPnlOMonth" value="' + H(month) + '"></div>' +
      '<div class="form-group"><label class="form-label">Amount ₹</label><input type="number" id="ttPnlOAmt" min="0" step="any" inputmode="decimal" value="' + (e ? N(e.amount) : '') + '"></div></div>' +
      '<div class="form-group"><label class="form-label">Note (optional)</label><input type="text" id="ttPnlONote" value="' + H(e ? e.note : '') + '" placeholder="e.g. 6 staff, Sept salary"></div>' +
      '<div style="display:flex;gap:8px;"><button class="btn btn-primary" style="flex:1;" onclick="triggerAppHaptic(); ttPnlOhSave()">💾 Save</button>' + (e ? '<button class="btn btn-danger-sm" onclick="triggerAppHaptic(); ttPnlOhDel(\'' + H(e.id) + '\')">🗑️</button>' : '') + '</div>');
  };
  window.ttPnlFormClose = function () { var m = $('ttPnlFormModal'); if (m) m.style.display = 'none'; };
  function ohPersist() { window.overheadsData = overheadsData; setStored("OVERHEADS", overheadsData); }
  window.ttPnlOhSave = function () {
    var id = $('ttPnlOId').value, cat = ($('ttPnlOCat').value || '').trim() || 'Other', month = $('ttPnlOMonth').value, amt = parseFloat($('ttPnlOAmt').value) || 0, note = ($('ttPnlONote').value || '').trim();
    if (!month) { alert('Please choose the month.'); return; }
    if (amt <= 0) { alert('Please enter an amount greater than 0.'); return; }
    var by = ''; try { by = currentUser && currentUser.name || ''; } catch (e) {}
    if (id) { var e = overheadsData.filter(function (x) { return String(x.id) === String(id); })[0]; if (e) { e.cat = cat; e.month = month; e.amount = amt; e.note = note; e.updatedAt = new Date().toISOString(); } }
    else overheadsData.unshift({ id: 'OH' + Date.now() + Math.floor(Math.random() * 1000), cat: cat, month: month, amount: amt, note: note, by: by, at: new Date().toISOString() });
    ohPersist(); window.ttPnlFormClose(); window.ttPnlRender();
  };
  window.ttPnlOhDel = function (id) {
    if (!confirm('Delete this expense entry?')) return;
    overheadsData = (overheadsData || []).filter(function (x) { return String(x.id) !== String(id); });
    try { if (window.cloudSync && window.cloudSync.deleteItem) window.cloudSync.deleteItem('OVERHEADS', id); } catch (e) {}
    ohPersist(); window.ttPnlFormClose(); window.ttPnlRender();
  };
  window.ttPnlOhCopy = function () {
    if (!isAdm()) { alert('Only Admin can do this.'); return; }
    var cur = curMonth(), p = new Date(); p.setDate(1); p.setMonth(p.getMonth() - 1); var prev = iso(p).slice(0, 7);
    var src = (overheadsData || []).filter(function (x) { return x.month === prev; });
    if (!src.length) { alert('No entries found for ' + monthLabel(prev) + '.'); return; }
    var have = {}; (overheadsData || []).forEach(function (x) { if (x.month === cur) have[norm(x.cat)] = 1; });
    var add = src.filter(function (x) { return !have[norm(x.cat)]; });
    if (!add.length) { alert('All categories of ' + monthLabel(prev) + ' already exist in ' + monthLabel(cur) + '.'); return; }
    if (!confirm('Copy ' + add.length + ' entries from ' + monthLabel(prev) + ' to ' + monthLabel(cur) + '? You can edit the amounts afterwards.')) return;
    add.forEach(function (x, i) { overheadsData.unshift({ id: 'OH' + Date.now() + i + Math.floor(Math.random() * 1000), cat: x.cat, month: cur, amount: x.amount, note: x.note || '', by: x.by || '', at: new Date().toISOString() }); });
    ohPersist(); window.ttPnlRender();
  };

  /* ---------- export: PDF / CSV / Share ---------- */
  function exportMain() {
    var C = calc(), basis = Q.gst === 'ex' ? 'Without GST' : 'With GST', per = (Q.from || Q.to) ? ((Q.from || 'start') + ' to ' + (Q.to || 'today')) : 'All time';
    var common = [['Period', per], ['Prices', basis]];
    var E;
    if (Q.tab === 'inv') E = { title: 'Invoice-wise Profit', cols: ['Invoice', 'Date', 'Customer', 'Sales', 'Cost', 'Profit', 'Margin', 'Markup', 'Lines without cost'], money: [3, 4, 5],
      rows: C.invs.map(function (I) { return [I.id, I.date, I.cust, I.a.sale, I.a.cost, I.a.profit, PCT(I.a.margin), PCT(I.a.markup), I.a.unp]; }), sum: [['Invoices', C.invs.length], ['Gross profit', INR(C.T.profit)]] };
    else if (Q.tab === 'prod' || Q.tab === 'cust') {
      var map = Q.tab === 'prod' ? C.prod : C.cust, list = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return fin(b.a).profit - fin(a.a).profit; });
      E = { title: Q.tab === 'prod' ? 'Product-wise Profit' : 'Customer-wise Profit', cols: [Q.tab === 'prod' ? 'Product' : 'Customer', Q.tab === 'prod' ? 'Qty' : 'Invoices', 'Sales', 'Cost', 'Profit', 'Margin', 'Markup'], money: [2, 3, 4],
        rows: list.map(function (x) { return [x.name, Q.tab === 'prod' ? x.a.qty : x.inv, x.a.sale, x.a.cost, x.a.profit, PCT(x.a.margin), PCT(x.a.markup)]; }), sum: [['Gross profit', INR(C.T.profit)]] };
    } else if (Q.tab === 'oh') E = { title: 'Overheads (Salary, Rent, Bills)', cols: ['Month', 'Category', 'Amount', 'Counted in period', 'Note'], money: [2, 3],
      rows: C.oh.map(function (x) { return [monthLabel(x.e.month), x.e.cat, N(x.e.amount), x.amt, x.e.note || '']; }), sum: [['Total overheads', INR(C.OH)]] };
    else E = { title: 'Profit & Loss Report', cols: ['Month', 'Sales', 'Cost', 'Gross Profit', 'Overheads', 'Net Profit / Loss'], money: [1, 2, 3, 4, 5],
      rows: C.monthRows.map(function (r) { return [monthLabel(r.m), r.a.sale, r.a.cost, r.a.profit, r.oh, r.net]; }),
      sum: [['Sales (costed items)', INR(C.T.sale)], ['Cost of goods', INR(C.T.cost)], ['Gross profit', INR(C.T.profit)], ['Profit margin', PCT(C.T.margin)], ['Profit markup', PCT(C.T.markup)], ['Overheads', INR(C.OH)], ['Total spend', INR(C.spend)], [C.net >= 0 ? 'NET PROFIT' : 'NET LOSS', INR(C.net)]] };
    E.sum = common.concat(E.sum); return E;
  }
  function exportPend() { var L = pending(); return { title: 'Pending Cost Prices', cols: ['Product', 'Times sold', 'Qty', 'Last sale rate', 'In Stock list'], money: [3], rows: L.map(function (x) { return [x.name, x.times, x.qty, r2(x.last), x.p ? 'Yes' : 'No']; }), sum: [['Products pending', L.length]] }; }
  function getExport(id) {
    if (id) { var I = calc().invs.filter(function (x) { return String(x.id) === String(id); })[0]; if (!I) { var o = (ordersData || []).filter(function (x) { return String(x.id) === String(id); })[0]; if (!o) return null; var f = Q.gst === 'ex' ? 1 / 1.18 : 1; I = { id: o.id, cust: o.customerName || '', date: ttDateOf(o), lines: buildLines(o, invIndex(), f), a: acc() }; I.lines.forEach(function (L) { add(I.a, L); }); fin(I.a); }
      var E = invExport(I); E.sum.push(['Prices', Q.gst === 'ex' ? 'Without GST' : 'With GST']); return E; }
    return Q.tab === 'pend' ? exportPend() : exportMain();
  }
  function cell(v, money) { return money && typeof v === 'number' ? INR(v) : H(v); }
  window.ttPnlOut = function (kind, id) {
    var E = getExport(id); if (!E) return;
    if (kind === 'pdf') {
      var th = 'border:1px solid #999;padding:4px 6px;background:#eef2f7;font-size:11px;text-align:left;', td = 'border:1px solid #bbb;padding:4px 6px;font-size:11px;';
      var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;"><div style="text-align:center;margin-bottom:8px;"><div style="font-size:15px;font-weight:800;">TWINTOWN EXPRESS SERVICES PVT LTD</div><div style="font-size:13px;font-weight:700;margin-top:2px;">' + H(E.title.toUpperCase()) + '</div></div>' +
        '<table style="border-collapse:collapse;width:100%;margin-bottom:10px;">' + E.sum.map(function (s) { return '<tr><td style="' + td + 'font-weight:700;width:38%;">' + H(s[0]) + '</td><td style="' + td + '">' + H(s[1]) + '</td></tr>'; }).join('') + '</table>' +
        '<table style="border-collapse:collapse;width:100%;"><thead><tr>' + E.cols.map(function (c) { return '<th style="' + th + '">' + H(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        E.rows.map(function (r) { return '<tr>' + r.map(function (v, i) { var mo = E.money && E.money.indexOf(i) >= 0; return '<td style="' + td + (mo ? 'text-align:right;' : '') + '">' + cell(v, mo) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' +
        '<div style="margin-top:12px;font-size:9px;text-align:center;color:#555;">This is a computer generated report. Cost is based on the Dealer Price saved in Stock.</div></div>';
      ttPrintHtml(E.title, html);
    } else if (kind === 'csv') {
      var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var out = E.sum.map(function (s) { return q(s[0]) + ',' + q(s[1]); }).join('\n') + '\n\n' + E.cols.map(q).join(',') + '\n' + E.rows.map(function (r) { return r.map(function (v, i) { return q(typeof v === 'number' ? r2(v) : v); }).join(','); }).join('\n');
      downloadFile('﻿' + out, E.title.replace(/[^\w]+/g, '_') + '.csv', 'text/csv;charset=utf-8');
    } else {
      var txt = '*' + E.title + '*\n' + E.sum.map(function (s) { return s[0] + ': ' + s[1]; }).join('\n') + '\n\n' + E.rows.slice(0, 25).map(function (r, i) { return (i + 1) + '. ' + r.map(function (v, k) { return typeof v === 'number' && E.money && E.money.indexOf(k) >= 0 ? INR(v) : v; }).join(' | '); }).join('\n') + (E.rows.length > 25 ? '\n… +' + (E.rows.length - 25) + ' more (see PDF / CSV)' : '') + '\n\n— TTESPL';
      ttNativeShareOrFallback({ title: E.title, text: txt }, function () { window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); });
    }
  };

  /* ---------- Ledger header button: admin only + pending badge ---------- */
  function wrapLedger() {
    if (typeof window.renderBilling !== 'function' || window.renderBilling.__tt23) return;
    var orig = window.renderBilling;
    window.renderBilling = function () {
      var r = orig.apply(this, arguments);
      try { var b = $('ttPnlLedBtn'); if (b) b.style.display = isAdm() ? '' : 'none'; window.ttPnlBadge(); } catch (e) {}
      return r;
    };
    window.renderBilling.__tt23 = true;
  }
  wrapLedger(); setTimeout(wrapLedger, 1500);
  setTimeout(function () { try { var b = $('ttPnlLedBtn'); if (b) b.style.display = isAdm() ? '' : 'none'; window.ttPnlBadge(); } catch (e) {} }, 2500);
})();


/* ===== v25 FEATURE PACK (Settings + premium features; every feature has an on/off switch) ===== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var N = function (v) { v = parseFloat(v); return isFinite(v) ? v : 0; };
  var R2 = function (v) { return Math.round((N(v) + Number.EPSILON) * 100) / 100; };
  var INR = function (n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
  var todayStr = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var isAdm = function () { try { return typeof isAdminUser === 'function' && isAdminUser(); } catch (e) { return false; } };
  var meName = function () { try { return (currentUser && currentUser.name) || 'Staff'; } catch (e) { return 'Staff'; } };
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  function toast(msg, kind) { try { if (kind === 'err' && window.ttShowErrorToast) return ttShowErrorToast(msg); if (window.ttShowSuccessToast) return ttShowSuccessToast(msg); } catch (e) {} try { alert(msg); } catch (e) {} }
  function ensureModal(id, z, maxW) {
    var m = $(id);
    if (!m) { m = document.createElement('div'); m.id = id; m.className = 'auth-overlay'; m.style.display = 'none'; m.style.zIndex = String(z || 3300); m.innerHTML = '<div class="auth-card tt25-card" style="max-width:' + (maxW || 560) + 'px;"></div>'; document.body.appendChild(m); }
    return m;
  }
  function show(m, html) { m.firstChild.innerHTML = html; m.style.display = 'flex'; }
  function hide(id) { var m = $(id); if (m) m.style.display = 'none'; }
  function head(title, closeId) { return '<div class="card-header"><span class="card-title">' + title + '</span><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'' + closeId + '\').style.display=\'none\'">✕</button></div>'; }
  function waPhone(p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return d; }
  function waOpen(phone, text) { var p = waPhone(phone); window.open('https://wa.me/' + (p || '') + '?text=' + encodeURIComponent(text), '_blank'); }
  function custPhoneOf(o) {
    if (o && o.phone) return o.phone;
    try { var c = (customerDatabase || []).find(function (x) { return x.name === o.customerName; }); return c ? c.phone : ''; } catch (e) { return ''; }
  }

  /* ---------------- SETTINGS STORE (this device only) ---------------- */
  var SK = 'TTESPL_ERP_UI_SETTINGS';
  var DEF = {
    pillnav: 0, compact: 0, autodark: 0, accent: '', countup: 1, sparkline: 1, swipe: 1, swipeclose: 1, emptystates: 1,
    haptic: 1, sound: 1,
    waRemind: 1, upiInvoice: 1, expInPnl: 1, gstReport: 1, creditLimit: 0,
    lowStock: 1, lowThreshold: 5, barcode: 1, timeline: 1, dupOrder: 1, quoteToOrder: 1,
    leadSnooze: 1, svcPhotos: 1, custCard: 1,
    activityLog: 1, syncSheet: 1, appLock: 0,
    mHub: 1, mFollow: 1, mTasks: 1, mPurch: 1, mAttend: 1, mCal: 1, mRecon: 1, mC360: 1, mBoard: 1, mSyncC: 1, mBackup: 1, mDashCard: 1, mFilters: 1, mBulk: 1, mPerf: 1, mDup: 1, purchLimit: 0,
    mAi: 1, mAiImg: 1, mAiProd: 1, mAiCopilot: 1, mAiInsights: 1, mAiDocs: 1
  };
  var cfg = {};
  try { cfg = JSON.parse(lsGet(SK) || '{}') || {}; } catch (e) { cfg = {}; }
  function get(k) { return (k in cfg) ? cfg[k] : DEF[k]; }
  function set(k, v) { cfg[k] = v; lsSet(SK, JSON.stringify(cfg)); applyLook(); }
  window.ttFeat = { get: get, set: set };

  var ACCENTS = { '': ['Brand red', '#E8212B'], blue: ['Blue', '#3b82f6'], green: ['Green', '#10b981'], violet: ['Violet', '#8b5cf6'], orange: ['Orange', '#f97316'], pink: ['Pink', '#ec4899'] };
  var dmq = null;
  function applyLook() {
    var b = document.body; if (!b) return;
    b.classList.toggle('tt-pillnav', !!get('pillnav'));
    b.classList.toggle('tt-compact', !!get('compact'));
    var ac = get('accent'), st = $('tt25AccentStyle');
    if (!st) { st = document.createElement('style'); st.id = 'tt25AccentStyle'; document.head.appendChild(st); }
    st.textContent = (ac && ACCENTS[ac]) ? ':root,[data-theme]{--brand-red:' + ACCENTS[ac][1] + ' !important;--brand-red-dark:' + ACCENTS[ac][1] + ' !important;--cyan:' + ACCENTS[ac][1] + ' !important;--accent:' + ACCENTS[ac][1] + ' !important;}' : '';
    if (get('autodark')) {
      try {
        if (!dmq) { dmq = window.matchMedia('(prefers-color-scheme: dark)'); dmq.addEventListener && dmq.addEventListener('change', function () { if (get('autodark')) applyAutoDark(); }); }
        applyAutoDark();
      } catch (e) {}
    }
    var sp = $('tt25Spark'); if (sp) sp.style.display = get('sparkline') ? '' : 'none';
    applyPerms();
  }
  function applyAutoDark() {
    var want = (dmq && dmq.matches) ? 'dark' : 'light';
    if (document.body.getAttribute('data-theme') !== want) { document.body.setAttribute('data-theme', want); try { if (typeof updateThemeMenuLabel === 'function') updateThemeMenuLabel(want); } catch (e) {} }
  }

  /* ---------------- HAPTIC / SOUND GATES ---------------- */
  (function () {
    var oh = window.triggerAppHaptic;
    if (typeof oh === 'function') window.triggerAppHaptic = function () { if (!get('haptic')) return; return oh.apply(this, arguments); };
    ['playOrderPlacedSound', 'playDeliverySound', 'playAtmCashSound', 'playCoinSound'].forEach(function (n) {
      var f = window[n]; if (typeof f === 'function') window[n] = function () { if (!get('sound')) return; return f.apply(this, arguments); };
    });
  })();

  /* ---------------- ROLE PERMISSIONS (cloud key PERMS: one doc id 'staff') ---------------- */
  var permsData = [];
  try { permsData = getStored('PERMS', []); } catch (e) { permsData = []; }
  window.permsData = permsData;
  var PERM_LIST = [['billing', 'Ledger / Billing tab'], ['inventory', 'Stock tab'], ['services', 'Services tab'], ['leads', 'Leads tab'], ['chat', 'Chat tab']];
  function permDoc() { var d = (window.permsData || []).find(function (x) { return x && x.id === 'staff'; }); return d || { id: 'staff', deny: {} }; }
  function applyPerms() {
    var items = document.querySelectorAll('.nav-item'); if (!items.length) return;
    var deny = (permDoc().deny) || {}, admin = isAdm();
    items.forEach(function (n) {
      var m = /switchTab\('(\w+)'/.exec(n.getAttribute('onclick') || ''); if (!m) return;
      n.style.display = (!admin && deny[m[1]]) ? 'none' : '';
    });
  }
  window.ttRenderPermsIfOpen = function () { applyPerms(); };
  function openPerms() {
    if (!isAdm()) return toast('Only Admin can change permissions', 'err');
    var d = permDoc(), m = ensureModal('tt25PermModal', 3400, 460);
    show(m, head('🛡️ Staff Permissions', 'tt25PermModal') + '<div class="tt25-sub">Switch OFF a tab to hide it for all non-admin staff. Admin always sees everything.</div>' +
      PERM_LIST.map(function (p) { return '<div class="tt25-row"><div class="tt25-rt"><b>' + p[1] + '</b></div><label class="tt25-sw"><input type="checkbox" ' + (d.deny[p[0]] ? '' : 'checked') + ' onchange="ttPermSet(\'' + p[0] + '\',this.checked)"><i></i></label></div>'; }).join(''));
  }
  window.ttPermSet = function (k, on) {
    var list = (window.permsData || []).slice(), d = list.find(function (x) { return x && x.id === 'staff'; });
    if (!d) { d = { id: 'staff', deny: {} }; list.push(d); }
    d.deny = d.deny || {}; if (on) delete d.deny[k]; else d.deny[k] = true;
    window.permsData = list; permsData = list; setStored('PERMS', list); applyPerms();
  };

  /* ---------------- SETTINGS MODAL ---------------- */
  function sw(k, title, sub) {
    return '<div class="tt25-row"><div class="tt25-rt"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><label class="tt25-sw"><input type="checkbox" ' + (get(k) ? 'checked' : '') + ' onchange="ttSetOpt(\'' + k + '\',this.checked?1:0)"><i></i></label></div>';
  }
  function num(k, title, sub, ph) {
    return '<div class="tt25-row"><div class="tt25-rt"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><input class="tt25-num" type="number" min="0" inputmode="numeric" placeholder="' + (ph || '0') + '" value="' + (get(k) || '') + '" onchange="ttSetOpt(\'' + k + '\',Number(this.value)||0)"></div>';
  }
  function act(title, sub, fn, label) {
    return '<div class="tt25-row"><div class="tt25-rt"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><button class="btn btn-outline btn-sm" onclick="' + fn + '">' + label + '</button></div>';
  }
  function group(t, rows) { return '<div class="tt25-grp"><div class="tt25-gt">' + t + '</div>' + rows.join('') + '</div>'; }
  /* ===== iPhone-style Settings: root list of categories -> sub-pages, search, back button =====
     Same switches / values as before (sw, num, act, ttSetOpt) - only the layout changed. */
  var SP = { page: 'root', q: '', dir: 'push' };
  var PAGE_STYLE = { look: ['🎨', '#bf5af2', '#8e44d6'], feed: ['🔔', '#ff453a', '#d62d20'], money: ['💰', '#34c759', '#1f9d45'], stock: ['📦', '#ff9f0a', '#e07c00'], cust: ['👥', '#0a84ff', '#0063d1'], reports: ['📑', '#5e5ce6', '#4340c4'], system: ['🔒', '#8e8e93', '#636366'], data: ['🧬', '#ff375f', '#d81b45'], mods: ['🧩', '#30b0c7', '#1b8da3'], ai: ['🤖', '#7d7aff', '#5856d6'] };
  function plain(h) { return String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function iosPages() {
    var admin = isAdm(), ac = get('accent'), P = [];
    var accHtml = '<div class="tt25-row" style="display:block;"><div class="tt25-rt"><b>Accent colour</b><small>Main highlight colour of the app</small></div><div class="tt25-acc">' +
      Object.keys(ACCENTS).map(function (k) { return '<button class="' + (ac === k ? 'on' : '') + '" style="background:' + ACCENTS[k][1] + '" title="' + ACCENTS[k][0] + '" aria-label="' + ACCENTS[k][0] + '" onclick="ttSetOpt(\'accent\',\'' + k + '\')"></button>'; }).join('') + '</div></div>';
    var pin = lsGet('TTESPL_ERP_LOCK_PIN');
    var pinRow = '<div class="tt25-row"><div class="tt25-rt"><b>App lock (PIN)</b><small>' + (pin ? 'PIN is set' : 'No PIN set') + '</small></div><div style="display:flex;gap:6px;"><button class="btn btn-outline btn-sm" onclick="ttLockSetPin()">' + (pin ? 'Change' : 'Set') + '</button>' + (pin ? '<button class="btn btn-danger-sm btn-sm" onclick="ttLockClear()">Remove</button>' : '') + '</div></div>';
    function add(id, title, sub, sec, lists) { var s = PAGE_STYLE[id] || ['⚙️', '#8e8e93', '#636366']; P.push({ id: id, icon: s[0], c1: s[1], c2: s[2], title: title, sub: sub, sec: sec, lists: lists.filter(function (l) { return l[1].length; }) }); }
    add('look', 'Look & Feel', 'Theme, colour, gestures', 1, [['Appearance', [sw('pillnav', 'Floating pill navigation', 'Bottom bar floats with rounded corners'), sw('compact', 'Compact density', 'Tighter cards, more on screen'), sw('autodark', 'Auto dark mode', 'Follow the phone day/night setting'), accHtml]], ['Motion and gestures', [sw('countup', 'Animated numbers', 'Home numbers count up'), sw('sparkline', 'Sales sparkline on Home', 'Last 7 days trend'), sw('swipe', 'Swipe actions on cards', 'Swipe a card left for Call / WhatsApp'), sw('swipeclose', 'Swipe down to close sheets', 'Drag a popup down to dismiss'), sw('emptystates', 'Friendly empty screens', 'Icon + hint when a list is empty'), act('Glass effects', 'Auto adapts to your phone. Lite is faster on older phones', 'ttLgCycleMode && ttLgCycleMode()', (window.ttLgMode ? window.ttLgMode() : 'Auto'))]]]);
    add('feed', 'Sounds & Haptics', 'Vibration and sounds', 1, [['Feedback', [sw('haptic', 'Vibration on tap', ''), sw('sound', 'Sounds', 'Order / delivery / cash sounds')]]]);
    add('money', 'Money', 'Reminders, UPI, credit limit', 2, [['Payments', [sw('waRemind', 'WhatsApp due reminder', 'Button on every ledger card with due'), sw('upiInvoice', 'UPI QR on invoice', 'Pay-now QR on bills with due amount'), sw('expInPnl', 'Staff expenses in Profit & Loss', 'Approved / reimbursed expenses count as spend')]], ['Tax and limits', [sw('gstReport', 'GST report', 'Menu item with PDF / CSV / share'), num('creditLimit', 'Customer credit limit (₹)', 'Warn when a customer\'s total due crosses this. 0 = off')]]]);
    add('stock', 'Stock & Orders', 'Low stock, barcode, timeline', 2, [['Stock', [sw('lowStock', 'Low-stock list', 'Button on Stock tab'), num('lowThreshold', 'Low-stock level', 'Items at or below this quantity', '5'), sw('barcode', 'Barcode scan', 'Scan a product code on Stock tab')]], ['Orders', [sw('timeline', 'Order timeline', 'Booked → Payment → Delivery steps'), sw('dupOrder', 'Duplicate order', 'Copy an order into a new one'), sw('quoteToOrder', 'Quotation → Order', 'Convert a quotation in one tap')]]]);
    add('cust', 'Customers & Service', 'Customer card, GST lookup, photos', 2, [['Customers', [sw('custCard', 'Customer card in order form', 'Shows GSTIN & address after selecting a customer'), act('GST lookup server', 'Recommended: free Cloudflare server URL + password (works on every phone)', 'ttSetGstProxy()', '🌐 Set'), act('GST lookup key', 'Only if no server: key saved on this device (may be blocked by the browser)', 'ttSetGstKey()', '🔑 Set')]], ['Leads and service', [sw('leadSnooze', 'Lead follow-up snooze', '+1 / +3 / +7 days buttons'), sw('svcPhotos', 'Service photos & warranty', 'Before/After photos and warranty countdown')]]]);
    add('reports', 'Reports', 'GST report, low-stock list', 2, [['Open a report', [act('GST report', 'Taxable / CGST / SGST by date range', 'ttOpenGst()', 'Open'), act('Low-stock list', 'Items that need re-ordering', 'ttOpenLowStock()', 'Open')]]]);
    add('system', 'Security & Backup', 'PIN lock, backup, permissions', 3, [['Security', [pinRow].concat(admin ? [act('Staff permissions', 'Hide tabs for non-admin staff', 'ttOpenPerms()', 'Open')] : [])], ['Backup and sync', [sw('syncSheet', 'Sync status sheet', 'Tap the Live Cloud pill in the header'), act('Share backup', 'Send the data backup via WhatsApp / Drive / Mail', 'ttShareBackup()', '📤 Share')]], ['Activity', [sw('activityLog', 'Activity log', 'Who changed what (records new changes)')].concat(admin ? [act('Activity log', 'See recent changes', 'ttOpenActivity()', 'View')] : [])]]);
    /* groups added by other modules (Office modules, AI) become their own pages */
    var extra = []; try { if (window.ttModSettings) window.ttModSettings(sw, function (t, rows) { extra.push([t, rows]); return ''; }); } catch (e) { console.warn('settings modules', e); }
    extra.forEach(function (g, i) { var m = /^(\S+)\s+(.*?)\s*(\(on \/ off\))?$/.exec(g[0]) || [0, '⚙️', g[0]], isAi = /AI/.test(g[0]); var pid = isAi ? 'ai' : (i === 0 ? 'mods' : 'mods' + i);
      /* v41: each new category gets its own colourful icon + short subtitle (looked up by title, so it does not depend on the order) */
      if (!isAi && window.ttGroupStyles && window.ttGroupStyles[m[2]]) PAGE_STYLE[pid] = window.ttGroupStyles[m[2]];
      add(pid, m[2], isAi ? 'Models, limits, usage' : ((window.ttGroupSubs && window.ttGroupSubs[m[2]]) || 'Turn tools on or off'), 3, [['Switches', g[1]]]); });
    if (admin && (window.ttOpenDuplicates || window.ttOpenDataMergeLog)) add('data', 'Data cleanup', 'Duplicates and merge', 3, [['Master catalog', [act('Sync master catalog to cloud', 'Adds missing master items & customers to the live cloud. Existing stock, prices and edits are never overwritten', 'ttSyncMasterToCloud && ttSyncMasterToCloud()', 'Sync')]], ['Duplicates', [act('Duplicate review', 'Find duplicate customers, stock and leads — then merge them into one', 'ttOpenDuplicates()', 'Open'), act('Merge log (stock & customers)', 'See past merges and undo one', 'ttOpenDataMergeLog && ttOpenDataMergeLog()', 'View'), act('Merge log (leads)', 'See past lead merges and undo one', 'ttOpenMergeLog && ttOpenMergeLog()', 'View')]]]);
    return P;
  }
  function iosList(caption, rows) { return (caption ? '<div class="ios-cap">' + caption + '</div>' : '') + '<div class="ios-list">' + rows.join('') + '</div>'; }
  function iosBody() {
    var P = iosPages(), q = SP.q.trim().toLowerCase(), h = '';
    if (SP.page === 'root') {
      if (q) {
        var hits = '';
        P.forEach(function (p) { p.lists.forEach(function (l) { var r = l[1].filter(function (x) { return plain(x).indexOf(q) >= 0; }); if (r.length) hits += iosList(p.title + ' › ' + l[0], r); }); });
        return hits || '<div class="ios-empty">No settings match “' + String(SP.q).replace(/[<>&"]/g, '') + '”.</div>';
      }
      var u = (typeof currentUser !== 'undefined' && currentUser) || {}, nm = String(u.name || 'User').replace(/[<>&"']/g, '');
      h += '<div class="ios-me"><span class="ios-av">' + (nm.trim().charAt(0) || 'U').toUpperCase() + '</span><div><b>' + nm + '</b><small>' + String(u.role || 'Staff').replace(/[<>&"']/g, '') + ' · this device only</small></div></div>';
      [1, 2, 3].forEach(function (sec) {
        var rows = P.filter(function (p) { return p.sec === sec; }).map(function (p) { return '<button class="ios-nav" onclick="ttSetNav(\'' + p.id + '\')"><span class="ios-ic" style="background:linear-gradient(160deg,' + p.c1 + ',' + p.c2 + ')">' + p.icon + '</span><span class="ios-nt"><b>' + p.title + '</b><small>' + p.sub + '</small></span><i class="ios-chev" aria-hidden="true"></i></button>'; });
        if (rows.length) h += '<div class="ios-list">' + rows.join('') + '</div>';
      });
      return h;
    }
    var pg = P.filter(function (p) { return p.id === SP.page; })[0];
    if (!pg) { SP.page = 'root'; return iosBody(); }
    return pg.lists.map(function (l) { return iosList(l[0], l[1]); }).join('');
  }
  function iosTitle() { if (SP.page === 'root') return 'Settings'; var p = iosPages().filter(function (x) { return x.id === SP.page; })[0]; return p ? p.title : 'Settings'; }
  function iosRender(full) {
    var m = ensureModal('tt25SetModal', 3400, 520), card = m.firstChild; card.classList.add('ios-set');
    var root = SP.page === 'root';
    if (full || !card.querySelector('#iosBody')) {
      card.innerHTML = '<div class="ios-bar"><button class="ios-back" ' + (root ? 'style="visibility:hidden"' : '') + ' onclick="ttSetNav(\'root\',1)"><i class="ios-chev back" aria-hidden="true"></i>Settings</button><span class="ios-bt" id="iosBt">' + (root ? '' : iosTitle()) + '</span><button class="ios-done" onclick="document.getElementById(\'tt25SetModal\').style.display=\'none\'">Done</button></div>' +
        '<div class="ios-scroll"><h2 class="ios-large">' + iosTitle() + '</h2>' + (root ? '<input class="ios-search" id="iosQ" type="search" placeholder="Search settings" autocomplete="off" value="' + SP.q.replace(/[<>&"]/g, '') + '" oninput="ttSetQ(this.value)">' : '') + '<div id="iosBody" class="ios-page ' + (SP.dir === 'pop' ? 'pop' : 'push') + '">' + iosBody() + '</div></div>';
      m.style.display = 'flex';
    } else { card.querySelector('#iosBody').innerHTML = iosBody(); }
  }
  window.ttSetNav = function (p, back) { SP.page = p; SP.q = ''; SP.dir = back ? 'pop' : 'push'; iosRender(true); var sc = document.querySelector('#tt25SetModal .ios-scroll'); if (sc) sc.scrollTop = 0; };
  window.ttSetQ = function (v) { SP.q = String(v || ''); iosRender(false); };
  function openSettings() {
    var m = ensureModal('tt25SetModal', 3400, 520);
    if (m.style.display === 'none' || !m.firstChild.querySelector('#iosBody')) { SP.page = 'root'; SP.q = ''; SP.dir = 'push'; iosRender(true); } else iosRender(false);
  }
  window.ttOpenSettings = openSettings; window.ttOpenPerms = openPerms;
  window.ttSetOpt = function (k, v) { set(k, v); if (k === 'accent') openSettings(); if (k === 'activityLog' || k === 'swipe') {} refreshInjections(); try { window.ttxRefresh && window.ttxRefresh(); } catch (e) {} };

  /* ---------------- PROFILE MENU ITEMS ---------------- */
  function menuItem(icon, label, tag, fn) {
    var d = document.createElement('div'); d.className = 'profile-menu-item tt25-mi';
    d.setAttribute('onclick', 'triggerAppHaptic(); ' + fn + '; closeProfileDrawer();');
    d.innerHTML = '<div class="profile-menu-item-left"><span>' + icon + '</span><span>' + label + '</span></div>' + (tag ? '<span style="font-size:10px;color:#38bdf8;">' + tag + '</span>' : '');
    return d;
  }
  function injectMenu() {
    var list = document.querySelector('#profileDropdownCard .profile-menu-list'); if (!list || list.querySelector('.tt25-mi')) return;
    var first = list.firstElementChild;
    list.insertBefore(menuItem('⚙️', 'Settings', 'On / Off', 'ttOpenSettings()'), first);
    var bk = Array.prototype.find.call(list.children, function (e) { return (e.getAttribute('onclick') || '').indexOf('openBackupModal') >= 0; });
    var g = menuItem('📑', 'GST Report', 'PDF · CSV', 'ttOpenGst()'); g.id = 'tt25MenuGst';
    var l = menuItem('📉', 'Low Stock List', 'Re-order', 'ttOpenLowStock()'); l.id = 'tt25MenuLow';
    var a = menuItem('🧾', 'Activity Log', 'Admin', 'ttOpenActivity()'); a.id = 'tt25MenuAct';
    list.insertBefore(g, bk || null); list.insertBefore(l, bk || null); list.insertBefore(a, bk || null);
    refreshInjections();
  }
  function refreshInjections() {
    var g = $('tt25MenuGst'), l = $('tt25MenuLow'), a = $('tt25MenuAct');
    if (g) g.style.display = get('gstReport') ? '' : 'none';
    if (l) l.style.display = get('lowStock') ? '' : 'none';
    if (a) a.style.display = (get('activityLog') && isAdm()) ? '' : 'none';
    var lb = $('tt25LowBtnRow'); if (lb) lb.style.display = (get('lowStock') || get('barcode')) ? '' : 'none';
    var lbtn = $('tt25LowBtn'); if (lbtn) lbtn.style.display = get('lowStock') ? '' : 'none';
    var bbtn = $('tt25ScanBtn'); if (bbtn) bbtn.style.display = get('barcode') ? '' : 'none';
    applyPerms();
  }
  window.ttRefreshProfileMenu = refreshInjections;
  var _openProf = window.toggleProfileDrawer || window.openProfileDrawer;
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.profile-avatar-btn')) setTimeout(refreshInjections, 30); }, true);

  /* ---------------- COUNT-UP NUMBERS + SPARKLINE ---------------- */
  function countUp(el) {
    if (!el || !get('countup')) return;
    var txt = el.textContent, m = /^(\D*)([\d,]+(?:\.\d+)?)(.*)$/.exec(txt); if (!m) return;
    var to = parseFloat(m[2].replace(/,/g, '')), from = parseFloat(el.dataset.v || '0'); el.dataset.v = String(to);
    if (!isFinite(to) || from === to) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var t0 = performance.now(), dur = 650, dec = (m[2].split('.')[1] || '').length;
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3), v = from + (to - from) * e;
      el.textContent = m[1] + v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
      if (p < 1) requestAnimationFrame(step); else el.textContent = txt;
    })(t0);
  }
  function sparkHtml() {
    var days = [], map = {}, i, d;
    for (i = 6; i >= 0; i--) { d = new Date(); d.setDate(d.getDate() - i); var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); days.push(k); map[k] = 0; }
    (ordersData || []).forEach(function (o) { if (o && o.status === 'Delivered') { var k = String(o.deliveredDate || o.orderDate || '').slice(0, 10); if (k in map) map[k] += N(o.totalAmount); } });
    var vals = days.map(function (k) { return map[k]; }), max = Math.max.apply(null, vals.concat([1])), tot = vals.reduce(function (a, b) { return a + b; }, 0);
    var W = 300, Hh = 46, pts = vals.map(function (v, j) { return [Math.round(j * W / 6), Math.round(Hh - 4 - (v / max) * (Hh - 10))]; });
    var path = pts.map(function (p, j) { return (j ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' ');
    return '<div class="tt25-sp-top"><div><b>Sales — last 7 days</b><small>Delivered orders</small></div><strong>' + INR(tot) + '</strong></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none" class="tt25-sp-svg"><defs><linearGradient id="tt25g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cyan)" stop-opacity=".35"/><stop offset="1" stop-color="var(--cyan)" stop-opacity="0"/></linearGradient></defs><path d="' + path + ' L' + W + ' ' + Hh + ' L0 ' + Hh + ' Z" fill="url(#tt25g)"/><path d="' + path + '" fill="none" stroke="var(--cyan)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<div class="tt25-sp-days">' + days.map(function (k) { return '<span>' + k.slice(8) + '</span>'; }).join('') + '</div>';
  }
  function afterDashboard() {
    ['dashTodayRecv', 'dashTotalDue', 'dashActiveServices', 'dashTotalItems', 'dashTotalClients'].forEach(function (id) { countUp($(id)); });
    var host = $('view-dashboard'); if (!host) return;
    var sp = $('tt25Spark');
    if (!sp) { sp = document.createElement('div'); sp.id = 'tt25Spark'; sp.className = 'card tt25-spark'; var grid = host.querySelector('.grid-4'); if (grid && grid.parentNode) grid.parentNode.insertBefore(sp, grid.nextSibling); else host.appendChild(sp); }
    sp.style.display = get('sparkline') ? '' : 'none';
    if (get('sparkline')) sp.innerHTML = sparkHtml();
  }
  wrap('renderDashboard', afterDashboard);

  /* ---------------- generic after-wrapper ---------------- */
  function wrap(name, after) {
    var f = window[name]; if (typeof f !== 'function') return;
    var w = function () { var r = f.apply(this, arguments); try { after.apply(this, arguments); } catch (e) { console.warn('v25 ' + name, e); } return r; };
    window[name] = w;
    try { (0, eval)(name + ' = window.' + name + ';'); } catch (e) {}
  }

  /* ---------------- EMPTY STATES ---------------- */
  var EMPTY = [['No active pending orders', '📦', 'No pending orders', 'New orders will show up here.'], ['No active inquiries', '🎯', 'No inquiries yet', 'Add a lead to start tracking follow-ups.'], ['No repair calls pending', '🛠️', 'All clear', 'No service calls pending right now.']];
  function emptyFix(id) {
    if (!get('emptystates')) return; var c = $(id); if (!c || c.children.length !== 1) return;
    var t = c.textContent || '';
    EMPTY.forEach(function (e) { if (t.indexOf(e[0]) >= 0 && !c.querySelector('.empty-state')) c.innerHTML = '<div class="empty-state"><span class="empty-icon">' + e[1] + '</span><div class="empty-title">' + e[2] + '</div><div class="empty-sub">' + e[3] + '</div></div>'; });
  }

  /* ---------------- ORDERS: timeline, duplicate, swipe actions ---------------- */
  function timelineHtml(o) {
    var t = todayStr(), paid = N(o.recvAmount) > 0, full = N(o.dueAmount) <= 0, late = o.deliveryDate && o.deliveryDate < t;
    function st(done, label, sub, warn) { return '<div class="tt25-st ' + (done ? 'done' : '') + (warn ? ' warn' : '') + '"><i></i><b>' + label + '</b><small>' + H(sub || '') + '</small></div>'; }
    return '<div class="tt25-tl">' + st(true, 'Booked', o.orderDate) + st(paid, full ? 'Paid' : (paid ? 'Part paid' : 'Payment'), paid ? INR(o.recvAmount) : 'Awaiting') + st(false, late ? 'Delayed' : 'Delivery', o.deliveryDate, late) + st(o.status === 'Delivered', 'Delivered', o.deliveredDate || '') + '</div>';
  }
  function afterOrders() {
    var c = $('ordersListContainer'); if (!c) return; emptyFix('ordersListContainer');
    c.querySelectorAll('.card').forEach(function (card) {
      var m = /Ref:\s*(ORD-\d+)/.exec(card.textContent || ''); if (!m) return;
      var o = (ordersData || []).find(function (x) { return x.id === m[1]; }); if (!o) return;
      card.dataset.rec = 'order:' + o.id;
      if (get('timeline') && !card.querySelector('.tt25-tl')) { var box = card.querySelector('div[style*="background:var(--bg)"]'); if (box) box.insertAdjacentHTML('beforebegin', timelineHtml(o)); }
      if (get('dupOrder') && o.status === 'Pending' && !card.querySelector('.tt25-dup')) {
        var rows = card.querySelectorAll('div[style*="flex-wrap:wrap"]'), row = rows[rows.length - 1];
        if (row) row.insertAdjacentHTML('beforeend', '<button class="btn btn-outline btn-sm tt25-dup" style="flex:1;" onclick="triggerAppHaptic(); ttDupOrder(\'' + o.id + '\')">📑 Duplicate</button>');
      }
    });
  }
  wrap('renderOrders', afterOrders);
  window.ttDupOrder = function (id) {
    var o = (ordersData || []).find(function (x) { return x.id === id; }); if (!o) return;
    openOrderModal();
    $('ordCustSearchInput').value = o.customerName + ' (' + (custPhoneOf(o) || '') + ')';
    try { $('ordStaffSelect').value = meName(); } catch (e) {}
    $('ordDate').value = todayStr();
    var d = new Date(); d.setDate(d.getDate() + 2); $('ordDelDate').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if ($('ordTaxType') && o.taxType) $('ordTaxType').value = o.taxType;
    $('orderItemsTbody').innerHTML = '';
    (o.items || []).forEach(function (it) { addOrderItemRow(it.name, it.qty, it.mrp || it.rate, it.disc || 0, it.rate, it.gstRate); });
    if ($('ordRecvAmt')) $('ordRecvAmt').value = 0;
    calcOrderTotals(); toast('Order copied — review and save');
  };

  /* ---------------- BILLING: WhatsApp due reminder ---------------- */
  window.ttWaRemind = function (id) {
    var o = (ordersData || []).find(function (x) { return x.id === id; }); if (!o) return;
    var due = N(o.dueAmount), upi = (typeof companyDetailsData !== 'undefined' && companyDetailsData.upi) || 'eazypay.574099310@icici';
    var msg = 'Namaste ' + o.customerName + ',\nThis is a gentle reminder from Twin Town Express Services Pvt Ltd.\nInvoice ' + o.id + ' (' + ttDateOf(o) + ') — pending amount: ' + INR(due) + '.\nYou can pay by UPI: ' + upi + ' or bank transfer. Please share the payment screenshot after paying.\nThank you!';
    waOpen(custPhoneOf(o), msg);
  };
  function afterBilling() {
    var c = $('billingListContainer') || document.querySelector('#view-billing .card-container, #view-billing');
    document.querySelectorAll('#view-billing .card').forEach(function (card) {
      var b = card.querySelector('button[onclick*="collectDuePayment"]'); if (!b) return;
      var m = /collectDuePayment\('([^']+)'/.exec(b.getAttribute('onclick')); if (!m) return;
      card.dataset.rec = 'order:' + m[1];
      var ex = card.querySelector('.tt25-wa');
      if (get('waRemind') && !ex) b.insertAdjacentHTML('afterend', '<button class="btn btn-wa btn-sm tt25-wa" style="flex:1;" onclick="triggerAppHaptic(); ttWaRemind(\'' + m[1] + '\')">💬 Remind</button>');
      if (!get('waRemind') && ex) ex.remove();
    });
  }
  wrap('renderBilling', afterBilling);

  /* ---------------- UPI QR ON INVOICE ---------------- */
  (function () {
    var f = window.ttBuildInvoicePaged; if (typeof f !== 'function') return;
    window.ttBuildInvoicePaged = function (o, opt) {
      var html = f.apply(this, arguments);
      try {
        var due = N(o && o.dueAmount);
        if (get('upiInvoice') && due > 0 && typeof html === 'string') {
          var upi = (typeof companyDetailsData !== 'undefined' && companyDetailsData.upi) || 'eazypay.574099310@icici';
          var payload = 'upi://pay?pa=' + upi + '&pn=' + encodeURIComponent('TWINTOWN EXPRESS SERVICES') + '&am=' + due.toFixed(2) + '&cu=INR';
          var svg;
          if (typeof qrcode === 'function') { var q = qrcode(0, 'M'); q.addData(payload); q.make(); svg = q.createSvgTag({ cellSize: 3, margin: 1, scalable: true }).replace('<svg', '<svg style="width:100%;height:100%"'); }
          else svg = '<img alt="UPI QR" style="width:100%;height:100%" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&ecc=M&data=' + encodeURIComponent(payload) + '">';
          var OPEN = '<div style="padding:5px 6px;border-left:1px solid #000;text-align:right;font-size:10.5px;">for <strong>TWINTOWN EXPRESS SERVICES PVT LTD</strong><br><br><br>Authorised Signatory</div>';
          var cell = '<div style="padding:5px 6px;border-left:1px solid #000;font-size:10.5px;display:flex;justify-content:space-between;align-items:flex-end;gap:6px;"><div style="font-size:8px;line-height:1.25;text-align:left;"><div style="width:58px;height:58px;">' + svg + '</div><b>Scan &amp; Pay ' + INR(due) + '</b></div><div style="text-align:right;">for <strong>TWINTOWN EXPRESS SERVICES PVT LTD</strong><br><br><br>Authorised Signatory</div></div>';
          var pos = html.indexOf(OPEN);
          if (pos >= 0) html = html.slice(0, pos) + cell + html.slice(pos + OPEN.length);
        }
        } catch (e) { console.warn('UPI QR on invoice failed', e); }
      return html;
    };
    try { (0, eval)('ttBuildInvoicePaged = window.ttBuildInvoicePaged;'); } catch (e) {}
  })();

  /* ---------------- CREDIT LIMIT WARNING ---------------- */
  (function () {
    var f = window.saveOrderAction; if (typeof f !== 'function') return;
    window.saveOrderAction = function () {
      try {
        var lim = N(get('creditLimit'));
        if (lim > 0) {
          var txt = $('ordCustSearchInput').value.trim(), cust = resolveCustomerFromSearch(txt), name = cust ? cust.name : txt.split('(')[0].trim(), edit = $('editOrderId').value;
          var other = (ordersData || []).filter(function (o) { return o.customerName === name && o.status !== 'Cancelled' && o.id !== edit; }).reduce(function (a, o) { return a + N(o.dueAmount); }, 0);
          var tot = other + N($('ordDueAmt').value);
          if (tot > lim && !confirm('Credit limit warning!\n\n' + name + ' will have a total due of ' + INR(tot) + '\n(limit ' + INR(lim) + ').\n\nSave this order anyway?')) return;
        }
      } catch (e) { console.warn('credit limit check', e); }
      return f.apply(this, arguments);
    };
    try { (0, eval)('saveOrderAction = window.saveOrderAction;'); } catch (e) {}
  })();

  /* ---------------- LEADS: follow-up snooze ---------------- */
  window.ttSnoozeLead = function (id, days) {
    var l = (leadsData || []).find(function (x) { return x.id === id; }); if (!l) return;
    var base = (l.followupDate && l.followupDate > todayStr()) ? l.followupDate : todayStr(), d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + days);
    l.followupDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    setStored('LEADS', leadsData); renderLeads(); toast('Follow-up moved to ' + l.followupDate);
  };
  function afterLeads() {
    emptyFix('leadsListContainer'); var c = $('leadsListContainer'); if (!c) return;
    c.querySelectorAll('.card').forEach(function (card) {
      var b = card.querySelector('button[onclick*="editLeadPrompt"]'); if (!b) return;
      var m = /editLeadPrompt\('([^']+)'/.exec(b.getAttribute('onclick')); if (!m) return;
      card.dataset.rec = 'lead:' + m[1];
      if (get('leadSnooze') && !card.querySelector('.tt25-snz') && !/Installed/.test((card.querySelector('.badge') || {}).textContent || '')) {
        card.insertAdjacentHTML('beforeend', '<div class="tt25-snz"><span>⏰ Snooze follow-up</span>' + [1, 3, 7].map(function (n) { return '<button onclick="triggerAppHaptic(); ttSnoozeLead(\'' + m[1] + '\',' + n + ')">+' + n + 'd</button>'; }).join('') + '</div>');
      }
    });
  }
  wrap('renderLeads', afterLeads);

  /* ---------------- SERVICES: photos + warranty ---------------- */
  function warrantyBadge(s) {
    if (!s.warrantyUntil) return '';
    var d = Math.ceil((new Date(s.warrantyUntil + 'T23:59:59') - new Date()) / 86400000);
    var cls = d < 0 ? 'bad' : (d <= 30 ? 'warn' : 'ok');
    return '<span class="tt25-wty ' + cls + '">🛡️ ' + (d < 0 ? 'Warranty expired' : d + ' days warranty left') + '</span>';
  }
  function afterServices() {
    emptyFix('serviceListContainer'); var c = $('serviceListContainer'); if (!c) return;
    c.querySelectorAll('.card').forEach(function (card) {
      var b = card.querySelector('button[onclick*="editServicePrompt"]'); if (!b) return;
      var m = /editServicePrompt\('([^']+)'/.exec(b.getAttribute('onclick')); if (!m) return;
      var s = (serviceCallsData || []).find(function (x) { return String(x.id) === m[1]; }); if (!s) return;
      card.dataset.rec = 'service:' + s.id;
      var old = card.querySelector('.tt25-svc'); if (old) old.remove();
      if (get('svcPhotos')) card.insertAdjacentHTML('beforeend', '<div class="tt25-svc">' + warrantyBadge(s) + (s.photoBefore || s.photoAfter ? '<span class="tt25-wty ok">📷 ' + (s.photoBefore ? 'Before ' : '') + (s.photoAfter ? 'After' : '') + '</span>' : '') + '<button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ttSvcMedia(\'' + s.id + '\')">📷 Photos &amp; Warranty</button></div>');
    });
  }
  wrap('renderServices', afterServices);
  window.ttSvcMedia = function (id) {
    var s = (serviceCallsData || []).find(function (x) { return String(x.id) === String(id); }); if (!s) return;
    var m = ensureModal('tt25SvcModal', 3400, 480);
    function slot(k, label) { return '<div class="tt25-ph"><b>' + label + '</b>' + (s[k] ? '<img src="' + s[k] + '" alt="">' : '<div class="tt25-ph-e">No photo</div>') + '<label class="btn btn-outline btn-sm" style="margin-top:6px;">📷 ' + (s[k] ? 'Replace' : 'Add') + '<input type="file" accept="image/*" capture="environment" style="display:none;" onchange="ttSvcPhoto(\'' + s.id + '\',\'' + k + '\',event)"></label></div>'; }
    show(m, head('📷 ' + H(s.customerName), 'tt25SvcModal') + '<div class="tt25-two">' + slot('photoBefore', 'Before') + slot('photoAfter', 'After') + '</div>' +
      '<div class="form-group" style="margin-top:12px;"><label class="form-label">Warranty valid till</label><input type="date" id="tt25Wty" value="' + H(s.warrantyUntil || '') + '"></div><div style="margin:4px 0 10px;">' + warrantyBadge(s) + '</div>' +
      '<button class="btn btn-primary btn-block" onclick="ttSvcSaveWty(\'' + s.id + '\')">💾 Save warranty date</button>');
  };
  window.ttSvcPhoto = function (id, key, ev) {
    var f = ev.target.files[0]; if (!f) return; var r = new FileReader();
    r.onload = function (e) {
      ttCompressImageSafe(e.target.result, 640, 0.5, 90000).then(function (cd) {
        var s = serviceCallsData.find(function (x) { return String(x.id) === String(id); }); if (!s) return;
        s[key] = cd; setStored('SERVICES', serviceCallsData); ttSvcMedia(id); renderServices();
      });
    }; r.readAsDataURL(f);
  };
  window.ttSvcSaveWty = function (id) {
    var s = serviceCallsData.find(function (x) { return String(x.id) === String(id); }); if (!s) return;
    s.warrantyUntil = $('tt25Wty').value || ''; setStored('SERVICES', serviceCallsData); ttSvcMedia(id); renderServices(); toast('Warranty saved');
  };

  /* ---------------- QUOTATION → ORDER ---------------- */
  window.ttQuoteToOrder = function (id) {
    var q = (quotationsData || []).find(function (x) { return x && x.id === id; }); if (!q) return;
    document.querySelectorAll('.auth-overlay').forEach(function (m) { if (m.querySelector('#qhSearch')) m.style.display = 'none'; });
    openOrderModal();
    $('ordCustSearchInput').value = q.custName + ' (' + (q.custPhone || '') + ')';
    try { $('ordStaffSelect').value = meName(); } catch (e) {}
    $('orderItemsTbody').innerHTML = '';
    (q.items || []).forEach(function (it) {
      var qty = N(it.qty) || 1, incl = R2((N(it.amount) / qty) * 1.18);
      addOrderItemRow(it.name, qty, incl, 0, incl);
    });
    calcOrderTotals(); toast('Quotation copied to a new order — check rates and save');
  };
  wrap('ttRenderQuotationHistory', function () {
    if (!get('quoteToOrder')) return; var box = $('qhList') || document;
    document.querySelectorAll('button[onclick*="ttEditQuotation"]').forEach(function (b) {
      var m = /ttEditQuotation\('([^']+)'/.exec(b.getAttribute('onclick')); if (!m) return;
      if (b.parentNode.querySelector('.tt25-q2o')) return;
      b.insertAdjacentHTML('afterend', '<button class="btn btn-primary btn-sm tt25-q2o" style="flex:1;" onclick="triggerAppHaptic(); ttQuoteToOrder(\'' + m[1] + '\')">🛒 → Order</button>');
    });
  });

  /* ---------------- STOCK: low-stock list, barcode scan ---------------- */
  function catalogIds() { var s = {}; try { (catalogCatsData || []).forEach(function (c) { if (c) { s[String(c.id)] = 1; s[String(c.name)] = 1; } }); } catch (e) {} return s; }
  function lowItems() {
    var th = N(get('lowThreshold')) || 5, cat = catalogIds();
    return (sampleInventory || []).filter(function (i) { return i && typeof i.stock === 'number' && i.stock <= ((Number(i.minStock) > 0) ? Number(i.minStock) : th) && !cat[String(i.category)]; }).sort(function (a, b) { return a.stock - b.stock; });
  }
  window.ttOpenLowStock = function () {
    var list = lowItems(), m = ensureModal('tt25LowModal', 3400, 560), th = N(get('lowThreshold')) || 5;
    show(m, head('📉 Low Stock (≤ ' + th + ')', 'tt25LowModal') + '<div class="tt25-sub">' + list.length + ' item(s) need re-ordering.</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;"><button class="btn btn-wa btn-sm" style="flex:1;" onclick="ttLowShare()">💬 WhatsApp to dealer</button><button class="btn btn-print btn-sm" style="flex:1;" onclick="ttLowPdf()">🖨️ PDF</button><button class="btn btn-outline btn-sm" style="flex:1;" onclick="ttLowCsv()">⬇️ CSV</button></div>' +
      (list.length ? list.slice(0, 300).map(function (i) { return '<div class="tt25-row"><div class="tt25-rt"><b>' + H(i.name) + '</b><small>' + H(i.code || '') + ' · ' + H(i.category || '') + '</small></div><span class="badge ' + (i.stock <= 0 ? 'badge-danger' : 'badge-pending') + '">' + i.stock + ' left</span></div>'; }).join('') : '<div class="empty-state"><span class="empty-icon">✅</span><div class="empty-sub">Everything is well stocked.</div></div>'));
  };
  window.ttLowShare = function () { var l = lowItems(); if (!l.length) return; waOpen('', 'Re-order request — Twin Town Express Services Pvt Ltd\n\n' + l.slice(0, 80).map(function (i, n) { return (n + 1) + '. ' + i.name + ' (stock ' + i.stock + ')'; }).join('\n') + '\n\nPlease share rates & availability.'); };
  window.ttLowCsv = function () { var l = lowItems(); downloadFile('Code,Name,Category,Stock\n' + l.map(function (i) { return [i.code || '', i.name, i.category || '', i.stock].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'), 'Low_Stock_' + todayStr() + '.csv', 'text/csv'); };
  window.ttLowPdf = function () { var l = lowItems(); ttPrintHtml('Low Stock List', '<h2>Low Stock List — ' + todayStr() + '</h2><table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:12px;"><tr><th>#</th><th>Code</th><th>Product</th><th>Category</th><th>Stock</th></tr>' + l.map(function (i, n) { return '<tr><td>' + (n + 1) + '</td><td>' + H(i.code || '') + '</td><td>' + H(i.name) + '</td><td>' + H(i.category || '') + '</td><td style="text-align:right;">' + i.stock + '</td></tr>'; }).join('') + '</table>'); };

  var camStream = null;
  window.ttOpenScan = function () {
    var m = ensureModal('tt25ScanModal', 3500, 480);
    var ok = ('BarcodeDetector' in window) && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    show(m, head('🔎 Scan Product Code', 'tt25ScanModal').replace("style.display='none'", "style.display='none';ttStopScan()") +
      (ok ? '<video id="tt25Vid" playsinline muted style="width:100%;border-radius:12px;background:#000;max-height:320px;"></video><div class="tt25-sub" id="tt25ScanMsg">Point the camera at the barcode…</div>' : '<div class="tt25-sub">Camera scanning is not supported in this browser. Type the code instead.</div>') +
      '<div style="display:flex;gap:6px;"><input type="text" id="tt25Code" placeholder="Type product code" style="flex:1;"><button class="btn btn-primary btn-sm" onclick="ttScanFind(document.getElementById(\'tt25Code\').value)">Find</button></div>');
    if (!ok) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (st) {
      camStream = st; var v = $('tt25Vid'); v.srcObject = st; v.play();
      var det = new BarcodeDetector(), busy = false;
      (function loop() {
        if (!camStream) return;
        if (!busy && v.readyState >= 2) { busy = true; det.detect(v).then(function (r) { busy = false; if (r && r.length) { ttScanFind(r[0].rawValue); } else setTimeout(loop, 250); }).catch(function () { busy = false; setTimeout(loop, 400); }); }
        else setTimeout(loop, 250);
      })();
    }).catch(function () { var s = $('tt25ScanMsg'); if (s) s.textContent = 'Camera permission denied. Type the code below.'; });
  };
  window.ttStopScan = function () { if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; } };
  window.ttScanFind = function (code) {
    code = String(code || '').trim().toLowerCase(); if (!code) return;
    var it = (sampleInventory || []).find(function (i) { return String(i.code || '').toLowerCase() === code || String(i.barcode || '').toLowerCase() === code; });
    if (!it) { var s = $('tt25ScanMsg'); if (s) s.textContent = 'No product with code "' + code + '".'; else toast('No product with that code', 'err'); return; }
    ttStopScan(); hide('tt25ScanModal'); openStockDetailModal(it.id);
  };
  wrap('renderStockList', function () {
    var c = $('stockListContainer'); if (!c || $('tt25LowBtnRow')) { refreshInjections(); return; }
    c.insertAdjacentHTML('beforebegin', '<div id="tt25LowBtnRow" class="tt25-tools"><button id="tt25LowBtn" class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ttOpenLowStock()">📉 Low-stock list</button><button id="tt25ScanBtn" class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ttOpenScan()">🔎 Scan code</button></div>');
    refreshInjections();
  });

  /* ---------------- GST REPORT ---------------- */
  function gstRows(from, to) {
    var rows = [];
    (ordersData || []).forEach(function (o) {
      if (!o || o.status !== 'Delivered') return; var d = ttDateOf(o); if (from && d < from) return; if (to && d > to) return;
      var taxable = 0, gross = 0, cT = (window.ttCourierTaxable && ttCourierTaxable() && N(o.courierCharge) > 0) ? R2(N(o.courierCharge) / 1.18) : 0;
      (o.items || []).forEach(function (it) { var incl = N(it.total), rt = window.ttItemGstRate ? ttItemGstRate(it) : 18; gross += incl; taxable += R2(incl / (1 + rt / 100)); });
      if (cT) { gross += N(o.courierCharge); taxable += cT; }
      taxable = R2(taxable); var tax = R2(gross - taxable), intra = (o.taxType || 'INTRA') !== 'INTER';
      var cust = (customerDatabase || []).find(function (c) { return (c.phone && c.phone === o.phone) || c.name === o.customerName; }) || {};
      rows.push({ id: o.id, date: d, cust: o.customerName, gst: cust.gst || '', taxable: taxable, cgst: intra ? R2(tax / 2) : 0, sgst: intra ? R2(tax - R2(tax / 2)) : 0, igst: intra ? 0 : tax, courier: cT ? 0 : N(o.courierCharge), total: cT ? R2(gross) : R2(gross + N(o.courierCharge)) });
    });
    return rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  var gstState = { from: '', to: '' };
  function monthStart() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  window.ttOpenGst = function () {
    if (!isAdm()) return toast('GST report is for Admin only', 'err');
    if (!gstState.from) { gstState.from = monthStart(); gstState.to = todayStr(); }
    var rows = gstRows(gstState.from, gstState.to), T = rows.reduce(function (a, r) { ['taxable', 'cgst', 'sgst', 'igst', 'courier', 'total'].forEach(function (k) { a[k] += r[k]; }); return a; }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, courier: 0, total: 0 });
    var m = ensureModal('tt25GstModal', 3400, 640);
    show(m, head('📑 GST Report', 'tt25GstModal') + '<div class="tt25-two"><div class="form-group"><label class="form-label">From</label><input type="date" value="' + gstState.from + '" onchange="ttGstSet(\'from\',this.value)"></div><div class="form-group"><label class="form-label">To</label><input type="date" value="' + gstState.to + '" onchange="ttGstSet(\'to\',this.value)"></div></div>' +
      '<div class="tt25-kpis"><div><small>Invoices</small><b>' + rows.length + '</b></div><div><small>Taxable</small><b>' + INR(T.taxable) + '</b></div><div><small>CGST+SGST</small><b>' + INR(T.cgst + T.sgst) + '</b></div><div><small>IGST</small><b>' + INR(T.igst) + '</b></div></div>' +
      '<div style="display:flex;gap:6px;margin:10px 0;"><button class="btn btn-print btn-sm" style="flex:1;" onclick="ttGstOut(\'pdf\')">🖨️ PDF</button><button class="btn btn-outline btn-sm" style="flex:1;" onclick="ttGstOut(\'csv\')">⬇️ CSV</button><button class="btn btn-wa btn-sm" style="flex:1;" onclick="ttGstOut(\'share\')">📤 Share</button></div>' +
      '<div class="tt25-scroll"><table class="tt25-tbl"><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr>' +
      rows.map(function (r) { return '<tr><td>' + r.date + '</td><td>' + H(r.id) + '</td><td>' + H(r.cust) + '</td><td>' + r.taxable.toFixed(2) + '</td><td>' + r.cgst.toFixed(2) + '</td><td>' + r.sgst.toFixed(2) + '</td><td>' + r.igst.toFixed(2) + '</td><td>' + r.total.toFixed(2) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td colspan="3">Total</td><td>' + T.taxable.toFixed(2) + '</td><td>' + T.cgst.toFixed(2) + '</td><td>' + T.sgst.toFixed(2) + '</td><td>' + T.igst.toFixed(2) + '</td><td>' + T.total.toFixed(2) + '</td></tr></table></div><div class="tt25-sub" style="margin-top:8px;">Taxable value = bill amount ÷ 1.18 per item (same as the invoice). Courier is added to the total, not taxed here.</div>');
  };
  window.ttGstSet = function (k, v) { gstState[k] = v; ttOpenGst(); };
  window.ttGstOut = function (kind) {
    var rows = gstRows(gstState.from, gstState.to); if (!rows.length) return toast('No invoices in this range', 'err');
    var ttl = 'GST Report ' + gstState.from + ' to ' + gstState.to;
    var T = rows.reduce(function (a, r) { ['taxable', 'cgst', 'sgst', 'igst', 'total'].forEach(function (k) { a[k] += r[k]; }); return a; }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
    if (kind === 'csv') {
      downloadFile('Date,Invoice,Customer,GSTIN,Taxable,CGST,SGST,IGST,Courier,Total\n' + rows.map(function (r) { return [r.date, r.id, r.cust, r.gst, r.taxable, r.cgst, r.sgst, r.igst, r.courier, r.total].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'), 'GST_Report_' + gstState.from + '_' + gstState.to + '.csv', 'text/csv');
    } else if (kind === 'pdf') {
      ttPrintHtml(ttl, '<h2>Twin Town Express Services Pvt Ltd</h2><h3>' + ttl + '</h3><table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:11px;"><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>GSTIN</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr>' + rows.map(function (r) { return '<tr><td>' + r.date + '</td><td>' + H(r.id) + '</td><td>' + H(r.cust) + '</td><td>' + H(r.gst) + '</td><td align="right">' + r.taxable.toFixed(2) + '</td><td align="right">' + r.cgst.toFixed(2) + '</td><td align="right">' + r.sgst.toFixed(2) + '</td><td align="right">' + r.igst.toFixed(2) + '</td><td align="right">' + r.total.toFixed(2) + '</td></tr>'; }).join('') + '<tr><th colspan="4">Total</th><th align="right">' + T.taxable.toFixed(2) + '</th><th align="right">' + T.cgst.toFixed(2) + '</th><th align="right">' + T.sgst.toFixed(2) + '</th><th align="right">' + T.igst.toFixed(2) + '</th><th align="right">' + T.total.toFixed(2) + '</th></tr></table>');
    } else {
      ttNativeShareOrFallback({ title: ttl, text: ttl + '\nInvoices: ' + rows.length + '\nTaxable: ' + INR(T.taxable) + '\nCGST: ' + INR(T.cgst) + '\nSGST: ' + INR(T.sgst) + '\nIGST: ' + INR(T.igst) + '\nTotal: ' + INR(T.total) }, function () { ttGstOut('pdf'); });
    }
  };

  /* ---------------- EXPENSES → P&L (virtual overhead entries) ---------------- */
  window.ttPnlExpenseOh = function () {
    if (!get('expInPnl')) return [];
    return (window.expensesData || []).filter(function (r) { return r && (r.status === 'Approved' || r.status === 'Reimbursed') && r.date && N(r.amount) > 0; })
      .map(function (r) { return { id: 'EXP-' + r.id, cat: 'Staff Expenses', month: String(r.date).slice(0, 7), amount: N(r.amount), note: (r.emp || '') + ' · ' + (r.cat || ''), virtual: true }; });
  };

  /* ---------------- ACTIVITY LOG (cloud key ACTIVITY) ---------------- */
  var actData = []; try { actData = getStored('ACTIVITY', []); } catch (e) { actData = []; }
  window.activityData = actData;
  window.ttRenderActivityIfOpen = function () { var m = $('tt25ActModal'); if (m && m.style.display === 'flex') ttOpenActivity(); };
  var WATCH = { ORDERS: 'Order', LEADS: 'Lead', SERVICES: 'Service', INVENTORY: 'Stock', CUSTOMERS: 'Customer', EXPENSES: 'Expense', QUOTATIONS: 'Quotation' };
  var snap = {};
  function sig(x) { try { return JSON.stringify(x, function (k, v) { return (typeof v === 'string' && v.length > 300) ? v.length : v; }); } catch (e) { return ''; } }
  function labelOf(k, x) { return x.customerName || x.custName || x.name || x.title || x.id; }
  function baseline(k) { var raw = lsGet('TTESPL_ERP_' + k), o = {}; try { (JSON.parse(raw || '[]') || []).forEach(function (x) { if (x && x.id != null) o[x.id] = sig(x); }); } catch (e) {} return o; }
  var oSet = window.setStored;
  window.setStored = function (key, val) {
    var pre = null;
    try { if (get('activityLog') && WATCH[key] && Array.isArray(val)) pre = baseline(key); } catch (e) {}
    var r = oSet.apply(this, arguments);
    try {
      if (pre) {
        var now = {}, adds = [], by = meName(), at = new Date().toISOString();
        val.forEach(function (x) { if (!x || x.id == null) return; var s = sig(x); now[x.id] = s; if (!(x.id in pre)) adds.push({ a: 'added', x: x }); else if (pre[x.id] !== s) adds.push({ a: 'changed', x: x }); });
        Object.keys(pre).forEach(function (id) { if (!(id in now)) adds.push({ a: 'removed', x: { id: id } }); });
        if (adds.length && adds.length <= 15) {
          var list = (window.activityData || []).slice();
          adds.forEach(function (e, i) { list.unshift({ id: 'A' + Date.now() + i + Math.floor(Math.random() * 99), at: at, by: by, kind: WATCH[key], act: e.a, ref: String(e.x.id), label: e.a === 'removed' ? '' : String(labelOf(key, e.x) || '') }); });
          window.activityData = list.slice(0, 400); actData = window.activityData; oSet('ACTIVITY', window.activityData);
        }
      }
    } catch (e) { console.warn('activity log', e); }
    return r;
  };
  try { (0, eval)('setStored = window.setStored;'); } catch (e) {}
  window.ttActAdd = function (kind, act, ref, label) {
    if (!get('activityLog')) return;
    var list = (window.activityData || []).slice();
    list.unshift({ id: 'A' + Date.now() + Math.floor(Math.random() * 99), at: new Date().toISOString(), by: meName(), kind: kind, act: act, ref: String(ref), label: String(label || '') });
    window.activityData = list.slice(0, 400); actData = window.activityData; oSet('ACTIVITY', window.activityData);
  };
  window.ttOpenActivity = function () {
    if (!isAdm()) return toast('Activity log is for Admin only', 'err');
    var list = (window.activityData || []).slice(0, 150), m = ensureModal('tt25ActModal', 3400, 560);
    show(m, head('🧾 Activity Log', 'tt25ActModal') + '<div class="tt25-sub">Recent changes made on devices running this version (newest first).</div>' +
      (list.length ? list.map(function (e) { return '<div class="tt25-row"><div class="tt25-rt"><b>' + H(e.kind) + ' ' + H(e.act) + '</b><small>' + H(e.label) + ' · ' + H(e.ref) + '</small></div><div style="text-align:right;font-size:10.5px;color:var(--text-muted);">' + H(e.by) + '<br>' + new Date(e.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</div></div>'; }).join('') : '<div class="empty-state"><span class="empty-icon">🧾</span><div class="empty-sub">No activity recorded yet.</div></div>'));
  };

  /* ---------------- SHARE BACKUP ---------------- */
  window.ttShareBackup = function () {
    try {
      var sets = ttBackupSets(), out = { app: 'TTESPL-ERP', version: 1, exportedAt: new Date().toISOString(), data: {} };
      Object.keys(sets).forEach(function (k) { out.data[k] = Array.isArray(sets[k]) ? sets[k] : []; });
      var name = 'TTESPL_Backup_' + todayStr() + '.json', blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
      var file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'TTESPL Backup' }).catch(function () {});
      else { downloadFile(JSON.stringify(out), name, 'application/json'); toast('Sharing is not supported here — backup downloaded instead'); }
    } catch (e) { toast('Backup failed: ' + e.message, 'err'); }
  };

  /* ---------------- SYNC STATUS SHEET ---------------- */
  function syncHtml() {
    var on = navigator.onLine, rows = [['Orders', ordersData], ['Leads', leadsData], ['Services', serviceCallsData], ['Stock items', sampleInventory], ['Customers', customerDatabase], ['Quotations', quotationsData]];
    return head('☁️ Sync Status', 'tt25SyncModal') + '<div class="tt25-kpis"><div><small>Internet</small><b style="color:' + (on ? '#10b981' : '#ef4444') + '">' + (on ? 'Online' : 'Offline') + '</b></div><div><small>First load</small><b>' + (window.ttCloudInitialLoadDone === false ? 'Loading…' : 'Done') + '</b></div></div>' +
      '<div class="tt25-sub" style="margin-top:8px;">' + (on ? 'Changes are pushed to the cloud immediately.' : 'You are offline. Changes are saved on this phone and are sent to the cloud automatically when the internet returns.') + '</div>' +
      rows.map(function (r) { return '<div class="tt25-row"><div class="tt25-rt"><b>' + r[0] + '</b></div><span class="badge badge-info">' + ((r[1] || []).length) + ' records</span></div>'; }).join('');
  }
  document.addEventListener('click', function (e) {
    var p = e.target.closest && e.target.closest('.tt-live-pill'); if (!p || !get('syncSheet')) return;
    var m = ensureModal('tt25SyncModal', 3400, 460); show(m, syncHtml());
  }, true);
  window.addEventListener('online', function () { var m = $('tt25SyncModal'); if (m && m.style.display === 'flex') m.firstChild.innerHTML = syncHtml(); });
  window.addEventListener('offline', function () { var m = $('tt25SyncModal'); if (m && m.style.display === 'flex') m.firstChild.innerHTML = syncHtml(); });

  /* ---------------- APP LOCK ---------------- */
  var PK = 'TTESPL_ERP_LOCK_PIN', LK = 'TTESPL_ERP_LOCK_HIDDEN_AT';
  function hash(p) { var h = 5381; for (var i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) | 0; return 'h' + h + ':' + p.length; }
  window.ttLockSetPin = function () {
    var p = prompt('Enter a new 4–6 digit PIN'); if (p === null) return;
    if (!/^\d{4,6}$/.test(p)) return toast('PIN must be 4 to 6 digits', 'err');
    if (prompt('Re-enter the PIN') !== p) return toast('PINs do not match', 'err');
    lsSet(PK, hash(p)); set('appLock', 1); toast('App lock is ON'); openSettings();
  };
  window.ttLockClear = function () { if (!confirm('Remove the app lock PIN?')) return; try { localStorage.removeItem(PK); } catch (e) {} set('appLock', 0); openSettings(); };
  function lockScreen() {
    if (!lsGet(PK) || $('tt25Lock')) return;
    var d = document.createElement('div'); d.id = 'tt25Lock';
    d.innerHTML = '<div class="tt25-lk"><div style="font-size:42px;">🔒</div><b>TTESPL ERP is locked</b><input id="tt25LockIn" type="password" inputmode="numeric" maxlength="6" placeholder="Enter PIN" autocomplete="off"><div id="tt25LockErr"></div><button class="btn btn-primary btn-block" onclick="ttLockTry()">Unlock</button></div>';
    document.body.appendChild(d); setTimeout(function () { var i = $('tt25LockIn'); if (i) i.focus(); }, 100);
    $('tt25LockIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') ttLockTry(); });
  }
  window.ttLockTry = function () {
    var v = ($('tt25LockIn') || {}).value || '';
    if (hash(v) === lsGet(PK)) { var d = $('tt25Lock'); if (d) d.remove(); } else { $('tt25LockErr').textContent = 'Wrong PIN'; $('tt25LockIn').value = ''; }
  };
  if (lsGet(PK)) { if (document.body) lockScreen(); else document.addEventListener('DOMContentLoaded', lockScreen); }
  document.addEventListener('visibilitychange', function () {
    if (!lsGet(PK)) return;
    if (document.hidden) lsSet(LK, String(Date.now()));
    else { var t = Number(lsGet(LK) || 0); if (t && Date.now() - t > 60000) lockScreen(); }
  });

  /* ---------------- SWIPE ACTIONS + SWIPE-DOWN-TO-CLOSE ---------------- */
  (function () {
    var sx = 0, sy = 0, card = null, sheet = null, sheetDy = 0, sheetStartScroll = 0;
    document.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; card = null; sheet = null; sheetDy = 0;
      var tg = e.target; if (!tg.closest) return;
      if (get('swipeclose')) { var sc = tg.closest('.tt-sheet-card'); if (sc && !tg.closest('input,textarea,select,table')) { var r = sc.getBoundingClientRect(); if (t.clientY - r.top < 70) { sheet = sc; sheetStartScroll = sc.scrollTop; } } }
      if (get('swipe')) card = tg.closest('.card[data-rec]');
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!sheet) return; var dy = e.touches[0].clientY - sy;
      if (dy > 0 && sheetStartScroll <= 0) { sheetDy = dy; sheet.style.animation = 'none'; sheet.style.transform = 'translateY(' + dy + 'px)'; }
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (sheet) {
        var s = sheet; sheet = null;
        if (sheetDy > 110) { var m = s.closest('.auth-overlay'); s.style.transform = ''; s.style.animation = ''; if (m && m.id) ttCloseSheetModal(m.id); else if (m) m.style.display = 'none'; }
        else { s.style.transition = 'transform .2s'; s.style.transform = ''; setTimeout(function () { s.style.transition = ''; s.style.animation = ''; }, 220); }
        return;
      }
      if (card && dx < -90 && Math.abs(dy) < 40) { openQuick(card.dataset.rec); }
      card = null;
    }, { passive: true });
  })();
  function openQuick(rec) {
    var p = rec.split(':'), kind = p[0], id = p.slice(1).join(':'), name = '', phone = '', extra = '';
    if (kind === 'order') { var o = (ordersData || []).find(function (x) { return x.id === id; }); if (!o) return; name = o.customerName; phone = custPhoneOf(o); if (N(o.dueAmount) > 0) extra = '<button class="btn btn-wa btn-block" onclick="ttWaRemind(\'' + o.id + '\');hide25()">💬 Due reminder (' + INR(o.dueAmount) + ')</button>'; }
    else if (kind === 'lead') { var l = (leadsData || []).find(function (x) { return x.id === id; }); if (!l) return; name = l.customerName; phone = l.phone; }
    else { var s = (serviceCallsData || []).find(function (x) { return String(x.id) === id; }); if (!s) return; name = s.customerName; phone = s.phone; }
    if (!phone) { try { var c = (customerDatabase || []).find(function (x) { return x.name === name; }); phone = c ? c.phone : ''; } catch (e) {} }
    var m = ensureModal('tt25QuickModal', 3400, 380); window.hide25 = function () { hide('tt25QuickModal'); };
    show(m, head(H(name), 'tt25QuickModal') + '<div class="tt25-sub">' + (phone ? H(phone) : 'No phone number saved') + '</div>' +
      (phone ? '<a class="btn btn-primary btn-block" style="text-decoration:none;text-align:center;margin-bottom:8px;" href="tel:' + H(phone) + '">📞 Call</a><button class="btn btn-wa btn-block" style="margin-bottom:8px;" onclick="ttWaOpenPlain(\'' + H(phone) + '\',\'' + H(name).replace(/'/g, '') + '\')">💬 WhatsApp</button>' : '') + extra);
  }
  window.ttWaOpenPlain = function (phone, name) { waOpen(phone, 'Namaste ' + name + ','); hide('tt25QuickModal'); };

  /* ---------------- boot ---------------- */
  function boot() { injectMenu(); applyLook(); try { if ($('view-dashboard')) afterDashboard(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 1200);
})();
