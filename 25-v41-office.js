/* TTESPL ERP v41 - OFFICE TOOLS
   Collection list · Daily summary · Staff targets · Delivery challan · Price list share · Barcode labels · E-way bill draft file
   Auto service reminder after delivering a machine · Credit limit per customer · Customer documents · Customer statement shortcut
   Every part has a switch / button in Settings > Office Tools. */
(function () {
  'use strict';
  var V = window.ttV41; if (!V) return;
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return window.ttEscHtml(s); };
  var N = function (x) { return Number(x) || 0; };
  var R2 = function (x) { return Math.round(N(x) * 100) / 100; };
  var inr = function (n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
  var l10 = function (p) { return String(p || '').replace(/\D/g, '').slice(-10); };
  var D = { creditPerCustomer: 1, creditBlockStaff: 1, svcRemind: 1, svcMonths: 6, svcCats: 'Machines & Equipment', dailySummary: 1, custDocs: 1 };
  Object.keys(D).forEach(function (k) { V.DEFAULTS[k] = D[k]; if (window.ttFeat && ttFeat.get(k) === undefined) ttFeat.set(k, D[k]); });
  var F = V.F;
  function ord() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function inv() { return (typeof sampleInventory !== 'undefined' && sampleInventory) || []; }
  function custs() { return (typeof customerDatabase !== 'undefined' && customerDatabase) || []; }
  function isAdm() { return V.isAdm(); }
  function dateOf(o) { return String(o.deliveredDate || o.orderDate || '').slice(0, 10); }
  function company() { return window.companyDetailsData || {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function waLink(phone, text) { return 'https://wa.me/' + (l10(phone) ? '91' + l10(phone) : '') + '?text=' + encodeURIComponent(text); }
  function daysSince(d) { var t = new Date(String(d).slice(0, 10) + 'T00:00:00'); return isNaN(t) ? 0 : Math.floor((Date.now() - t.getTime()) / 86400000); }

  /* ---------- settings ---------- */
  function row(t, s, ctl) { return '<div class="tt25-row"><div class="tt25-rt"><b>' + t + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</div>' + ctl + '</div>'; }
  var prevSet = window.ttModSettings;
  window.ttModSettings = function (sw, group) {
    var r; try { r = prevSet ? prevSet(sw, group) : ''; } catch (e) { console.warn(e); }
    function act(t, s, fn, l) { return row(t, s, '<button class="btn btn-outline btn-sm" onclick="' + fn + '">' + l + '</button>'); }
    function num(k, t, s) { return row(t, s, '<input class="tt25-num" type="number" min="0" inputmode="numeric" value="' + (F(k) || '') + '" onchange="ttSetOpt(\'' + k + '\',Number(this.value)||0)">'); }
    function txt(k, t, s) { return row(t, s, '<input class="tt25-num" style="width:150px;text-align:left;" type="text" value="' + H(F(k) || '') + '" onchange="ttSetOpt(\'' + k + '\',this.value.trim())">'); }
    var cust = [sw('creditPerCustomer', 'Credit limit per customer', 'Type a “Credit limit” inside the customer. An order that takes the customer over it asks first'),
      sw('creditBlockStaff', 'Only Admin can pass the limit', 'Staff get a message instead of the question'),
      sw('custDocs', 'Customer documents', 'Attach GST certificate, PAN, visiting card (photo / small PDF) inside the customer')];
    group('👥 Customers & Credit (on / off)', cust);
    var off = [act('Collection list', 'Who owes money, oldest first, one-tap WhatsApp / call / collect', 'ttOpenCollect()', 'Open'),
      act('Daily summary', 'Sales, collection, pending, low stock for a day', 'ttOpenDaily()', 'Open'),
      sw('dailySummary', 'Evening summary notification (8 pm)', 'Needs the Cloud Function from the README. Sent to everyone with notifications on'),
      act('Staff targets', 'Monthly target, achievement % and incentive per staff', 'ttOpenTargets()', 'Open'),
      act('Delivery challan', 'Print a challan (no prices) for a bill', 'ttOpenChallan()', 'Open'),
      act('Share price list', 'Send a price list on WhatsApp', 'ttOpenPriceList()', 'Open'),
      act('Barcode labels', 'Print stock labels with a barcode', 'ttOpenLabels()', 'Open'),
      act('E-way bill file (draft)', 'Make the JSON file for the e-way bill portal. Check it on the portal before use', 'ttOpenEway()', 'Open'),
      sw('svcRemind', 'Auto service reminder after delivery', 'When a machine is delivered, a service reminder is added to Machine reminders'),
      num('svcMonths', 'Service every (months)', 'Used by the auto reminder'), txt('svcCats', 'Machine categories', 'Stock categories that count as machines (comma separated)')];
    group('🧰 Office Tools (on / off)', off);
    return r;
  };
  window.ttGroupStyles = Object.assign(window.ttGroupStyles || {}, { 'Customers & Credit': ['👥', '#32ade6', '#0a84c6'], 'Office Tools': ['🧰', '#8e8e93', '#636366'] });
  window.ttGroupSubs = Object.assign(window.ttGroupSubs || {}, { 'Customers & Credit': 'Credit limit, documents', 'Office Tools': 'Collection, summary, targets, labels…' });
  var oSet = window.ttSetOpt;
  window.ttSetOpt = function (k, v) {
    var r = oSet ? oSet.apply(this, arguments) : undefined;
    if (k === 'dailySummary') { try { window.ttx && ttx.upsert('OFFICE_CFG', { id: 'v41_flags', dailySummary: !!v, updatedBy: V.me(), updatedAt: new Date().toISOString() }); } catch (e) { console.warn(e); } }
    return r;
  };
  V.menuExtra = (V.menuExtra || []).concat([['💰', 'Collection list', 'Dues', 'ttOpenCollect()'], ['🗒️', 'Daily summary', 'Today', 'ttOpenDaily()']]);

  /* ================= collection list ================= */
  var CL = { f: 'all', open: {} };
  function dueGroups() {
    var g = {};
    ord().forEach(function (o) {
      if (!o || o.status !== 'Delivered' || !(N(o.dueAmount) > 0)) return;
      var key = l10(o.phone) || ('n:' + String(o.customerName || '').toLowerCase()), x = g[key] || (g[key] = { key: key, name: o.customerName, phone: l10(o.phone), bills: [], due: 0, oldest: '9999-12-31', follow: '' });
      x.bills.push(o); x.due += N(o.dueAmount); var d = dateOf(o); if (d && d < x.oldest) x.oldest = d; if (o.payFollowupDate && (!x.follow || o.payFollowupDate < x.follow)) x.follow = o.payFollowupDate;
    });
    return Object.keys(g).map(function (k) { g[k].due = R2(g[k].due); g[k].age = daysSince(g[k].oldest); return g[k]; });
  }
  window.ttOpenCollect = function () { clDraw(); };
  function clDraw() {
    var all = dueGroups(), today = ttYmd(), total = R2(all.reduce(function (a, x) { return a + x.due; }, 0)), old30 = R2(all.filter(function (x) { return x.age >= 30; }).reduce(function (a, x) { return a + x.due; }, 0));
    var list = all.filter(function (x) { return CL.f === 'all' || (CL.f === 'old' && x.age >= 30) || (CL.f === 'today' && x.follow && x.follow <= today); }).sort(function (a, b) { return b.age - a.age || b.due - a.due; });
    var h = '<div class="tt41-kpis"><div><small>Pending</small><b>' + inr(total) + '</b></div><div><small>Customers</small><b>' + all.length + '</b></div><div><small>30+ days</small><b style="color:#dc2626">' + inr(old30) + '</b></div></div>' +
      '<div class="tt41-row2" style="margin:10px 0;">' + [['all', 'All'], ['old', '30+ days'], ['today', 'Follow-up today']].map(function (t) { return '<button class="btn ' + (CL.f === t[0] ? 'btn-primary' : 'btn-outline') + ' btn-sm" onclick="ttClF(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>';
    h += list.length ? list.slice(0, 120).map(function (x) {
      var open = CL.open[x.key], msg = 'Namaste ' + x.name + ', Twin Town Express Services Pvt Ltd. Aapka ' + inr(x.due) + ' baaki hai (' + x.bills.map(function (b) { return (window.ttInvNo ? ttInvNo(b) : b.id) + ' ' + inr(b.dueAmount); }).join(', ') + '). Kripya jald bhugtan karein' + (company().upi ? ' – UPI: ' + company().upi : '') + '. Dhanyavaad.';
      return '<div class="tt41-cl"><div class="tt41-cl-h" onclick="ttClOpen(\'' + esc(x.key) + '\')"><div style="flex:1;min-width:0;"><b>' + H(x.name) + '</b><small>' + x.bills.length + ' bill' + (x.bills.length > 1 ? 's' : '') + ' · oldest ' + x.age + ' day' + (x.age === 1 ? '' : 's') + (x.follow ? ' · 📅 ' + H(x.follow) : '') + '</small></div><b class="tt41-cl-due' + (x.age >= 30 ? ' old' : '') + '">' + inr(x.due) + '</b></div>' +
        '<div class="tt41-act" style="justify-content:flex-start;padding-top:6px;"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + waLink(x.phone, msg) + '">💬 Remind</a>' + (x.phone ? '<a class="btn btn-outline btn-sm" href="tel:+91' + x.phone + '">📞 Call</a>' : '') + '<button class="btn btn-outline btn-sm" onclick="ttClOpen(\'' + esc(x.key) + '\')">' + (open ? '▲ Bills' : '▼ Bills') + '</button></div>' +
        (open ? x.bills.sort(function (a, b) { return dateOf(a) < dateOf(b) ? -1 : 1; }).map(function (b) { return '<div class="tt41-row"><div style="flex:1;min-width:0;"><b>' + H(window.ttInvNo ? ttInvNo(b) : b.id) + '</b><small>' + H(dateOf(b)) + ' · total ' + inr(b.totalAmount) + ' · due ' + inr(b.dueAmount) + '</small></div><button class="btn btn-primary btn-sm" onclick="ttClCollect(\'' + esc(b.id) + '\')">💵 Collect</button><button class="btn btn-outline btn-sm" onclick="ttClFollow(\'' + esc(b.id) + '\')">📅</button></div>'; }).join('') : '') + '</div>';
    }).join('') : '<div class="tt41-empty">Nothing here 🎉</div>';
    V.modal('tt41Cl', '💰 Collection list', h, true);
  }
  window.ttClF = function (f) { CL.f = f; clDraw(); };
  window.ttClOpen = function (k) { CL.open[k] = !CL.open[k]; var sc = document.querySelector('#tt41Cl .tt41-bd'), y = sc ? sc.scrollTop : 0; clDraw(); sc = document.querySelector('#tt41Cl .tt41-bd'); if (sc) sc.scrollTop = y; };
  window.ttClCollect = function (id) { var m = $('tt41Cl'); if (m) m.remove(); try { collectDuePayment(id); } catch (e) { alert('Open the bill in Ledger and press Collect Due.'); } };
  window.ttClFollow = function (id) { var m = $('tt41Cl'); if (m) m.remove(); try { openPayFollowupModal(id); } catch (e) {} };

  /* ================= daily summary ================= */
  function dayStats(d) {
    var s = { sales: 0, bills: 0, coll: 0, booked: 0, bookedVal: 0, pend: 0, pendVal: 0, dueAll: 0, due30: 0 };
    ord().forEach(function (o) {
      if (!o || o.status === 'Cancelled') return;
      var pays = Array.isArray(o.payments) ? o.payments : [], sum = pays.reduce(function (a, p) { return a + N(p.amount); }, 0);
      if (o.status === 'Delivered' && dateOf(o) === d) { s.sales += N(o.totalAmount); s.bills++; }
      if (o.orderDate === d) { s.booked++; s.bookedVal += N(o.totalAmount); var adv = R2(N(o.recvAmount) - sum); if (adv > 0) s.coll += adv; }
      pays.forEach(function (p) { if (p && !p.adjust && N(p.amount) > 0 && String(p.at || '').slice(0, 10) === d) s.coll += N(p.amount); });
      if (o.status === 'Pending') { s.pend++; s.pendVal += N(o.totalAmount); }
      if (o.status === 'Delivered' && N(o.dueAmount) > 0) { s.dueAll += N(o.dueAmount); if (daysSince(dateOf(o)) >= 30) s.due30 += N(o.dueAmount); }
    });
    s.low = inv().filter(function (p) { return N(p.stock) <= ttLowLimit(p) && p.category !== 'Catalog Equipment'; }).length;
    s.svc = ((typeof serviceCallsData !== 'undefined' && serviceCallsData) || []).filter(function (x) { return x && x.status !== 'Work Completed' && x.status !== 'Completed'; }).length;
    Object.keys(s).forEach(function (k) { s[k] = R2(s[k]); }); return s;
  }
  window.ttOpenDaily = function (d) {
    d = d || ttYmd(); var s = dayStats(d);
    var text = '📊 TTESPL summary ' + d + '\nSales (delivered): ' + inr(s.sales) + ' (' + s.bills + ' bills)\nCollection: ' + inr(s.coll) + '\nNew orders: ' + s.booked + ' (' + inr(s.bookedVal) + ')\nPending deliveries: ' + s.pend + ' (' + inr(s.pendVal) + ')\nTotal dues: ' + inr(s.dueAll) + ' (30+ days ' + inr(s.due30) + ')\nLow stock items: ' + s.low;
    V.modal('tt41Ds', '🗒️ Daily summary', '<input type="date" class="tt41-in" value="' + d + '" max="' + ttYmd() + '" onchange="ttOpenDaily(this.value)">' +
      '<div class="tt41-kpis" style="margin-top:8px;"><div><small>Sales</small><b>' + inr(s.sales) + '</b><small>' + s.bills + ' bills</small></div><div><small>Collection</small><b style="color:#16a34a">' + inr(s.coll) + '</b></div><div><small>New orders</small><b>' + s.booked + '</b><small>' + inr(s.bookedVal) + '</small></div></div>' +
      '<div class="tt41-kpis" style="margin-top:8px;"><div><small>Pending deliveries</small><b>' + s.pend + '</b><small>' + inr(s.pendVal) + '</small></div><div><small>Total dues</small><b style="color:#dc2626">' + inr(s.dueAll) + '</b><small>30+ ' + inr(s.due30) + '</small></div><div><small>Low stock</small><b>' + s.low + '</b><small>' + s.svc + ' service open</small></div></div>' +
      '<a class="btn btn-wa" style="width:100%;margin-top:12px;text-align:center;display:block;" target="_blank" rel="noopener" href="' + waLink('', text) + '">💬 Share on WhatsApp</a>');
  };

  /* ================= staff targets ================= */
  function tgDoc() { try { return (window.ttx && ttx.byId('OFFICE_CFG', 'v41_targets')) || { id: 'v41_targets', list: [] }; } catch (e) { return { id: 'v41_targets', list: [] }; } }
  window.ttOpenTargets = function () {
    var doc = tgDoc(), month = ttYmd().slice(0, 7), emps = (typeof registeredEmployees !== 'undefined' && registeredEmployees) || [], adm = isAdm(), me = (V.me() || '').toLowerCase();
    var sales = {}; ord().forEach(function (o) { if (o && o.status === 'Delivered' && dateOf(o).slice(0, 7) === month) { var k = String(o.bookedBy || '').trim().toLowerCase(); sales[k] = (sales[k] || 0) + N(o.totalAmount); } });
    var rows = emps.filter(function (e) { return adm || String(e.name || '').toLowerCase() === me; }).map(function (e) {
      var cfg = (doc.list || []).find(function (x) { return String(x.name).toLowerCase() === String(e.name).toLowerCase(); }) || {}, sv = R2(sales[String(e.name || '').trim().toLowerCase()] || 0), tgt = N(cfg.target), inc = N(cfg.inc), pct = tgt > 0 ? Math.round(sv / tgt * 100) : 0;
      return '<div class="tt41-tg" data-n="' + H(e.name) + '"><div class="tt41-tgh"><b>' + H(e.name) + '</b><small>' + H(e.role || '') + '</small></div>' +
        '<div class="tt41-ins"><span>Sales this month</span><b>' + inr(sv) + '</b></div>' + (tgt > 0 ? '<div class="tt41-bar"><i style="width:' + Math.min(100, pct) + '%;background:' + (pct >= 100 ? '#16a34a' : '#3b82f6') + '"></i></div><div class="tt41-sub" style="margin:4px 0 0;">' + pct + '% of ' + inr(tgt) + (pct >= 100 ? ' ✅ target achieved' : '') + (inc > 0 ? ' · incentive ' + inc + '% = <b>' + inr(sv * inc / 100) + '</b>' : '') + '</div>' : '<div class="tt41-sub" style="margin:4px 0 0;">No target set</div>') +
        (adm ? '<div class="tt41-row2" style="margin-top:6px;"><input type="number" class="tt41-in" data-f="target" min="0" placeholder="Target ₹" value="' + (tgt || '') + '"><input type="number" class="tt41-in" data-f="inc" min="0" step="any" placeholder="Incentive %" value="' + (inc || '') + '"></div>' : '') + '</div>';
    }).join('');
    V.modal('tt41Tg', '🎯 Staff targets — ' + month, (rows || '<div class="tt41-empty">No staff found</div>') + (adm && rows ? '<button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="ttTgSave()">💾 Save targets</button>' : ''), true);
  };
  window.ttTgSave = function () {
    if (!isAdm()) return; var list = [];
    document.querySelectorAll('#tt41Tg .tt41-tg').forEach(function (r) { var t = N((r.querySelector('[data-f=target]') || {}).value), i = N((r.querySelector('[data-f=inc]') || {}).value); if (t > 0 || i > 0) list.push({ name: r.getAttribute('data-n'), target: t, inc: i }); });
    try { ttx.upsert('OFFICE_CFG', { id: 'v41_targets', list: list, updatedBy: V.me(), updatedAt: new Date().toISOString() }); V.toast('Targets saved'); ttOpenTargets(); } catch (e) { V.toast('Could not save', true); }
  };

  /* ================= delivery challan ================= */
  var CH = { q: '' };
  window.ttOpenChallan = function () { CH.q = ''; chDraw(); };
  function chDraw() {
    var q = CH.q.toLowerCase(), list = ord().filter(function (o) { return o && o.status !== 'Cancelled' && (!q || (String(o.id) + ' ' + (o.invoiceNo || '') + ' ' + (o.customerName || '')).toLowerCase().indexOf(q) >= 0); }).sort(function (a, b) { return dateOf(b) < dateOf(a) ? -1 : 1; }).slice(0, 40);
    V.modal('tt41Ch', '🚚 Delivery challan', '<input class="tt41-in" placeholder="Search bill no. or customer" value="' + H(CH.q) + '" oninput="ttChQ(this.value)">' + list.map(function (o) { return '<div class="tt41-row" style="cursor:pointer" onclick="ttChPrint(\'' + esc(o.id) + '\')"><div style="flex:1;min-width:0;"><b>' + H(o.customerName) + '</b><small>' + H(window.ttInvNo ? ttInvNo(o) : o.id) + ' · ' + H(dateOf(o)) + ' · ' + (o.items || []).length + ' item(s)</small></div><span>🖨</span></div>'; }).join(''));
  }
  window.ttChQ = function (v) { CH.q = v; var el = document.querySelector('#tt41Ch .tt41-in'), pos = el && el.selectionStart; chDraw(); el = document.querySelector('#tt41Ch .tt41-in'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } };
  window.ttChPrint = function (id) {
    var o = ord().find(function (x) { return x.id === id; }); if (!o) return;
    var d = company(), c = custs().find(function (x) { return l10(x.phone) === l10(o.phone) || String(x.name).toLowerCase() === String(o.customerName).toLowerCase(); }) || {}, m = o.invMeta || {};
    var rows = (o.items || []).map(function (it, i) { return '<tr><td>' + (i + 1) + '</td><td style="text-align:left">' + H(it.name) + '</td><td>' + H(window.ttItemHsn ? ttItemHsn(it) : (it.hsn || '')) + '</td><td>' + H(it.qty) + '</td><td>PCS</td></tr>'; }).join('');
    ttPrintHtml('Delivery Challan', '<div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;border:1px solid #000;padding:14px;font-size:13px;"><div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;"><b style="font-size:17px;">TWINTOWN EXPRESS SERVICES PVT LTD</b><br>' + H(d.address || '') + '<br>GSTIN: ' + H(d.gstin || '') + ' · ' + H(d.contact || '') + '</div><h2 style="text-align:center;margin:10px 0;">DELIVERY CHALLAN</h2>' +
      '<table style="width:100%;font-size:13px;margin-bottom:8px;"><tr><td><b>Challan no.:</b> DC/' + H(window.ttInvNo ? ttInvNo(o) : o.id) + '</td><td style="text-align:right;"><b>Date:</b> ' + H(dateOf(o)) + '</td></tr><tr><td colspan="2"><b>To:</b> ' + H(o.customerName) + (o.phone ? ' (' + H(o.phone) + ')' : '') + '<br>' + H(c.address || '') + (c.gst && c.gst !== 'Unregistered' ? '<br>GSTIN: ' + H(c.gst) : '') + '</td></tr>' +
      ((m.dispatchedThrough || m.destination) ? '<tr><td colspan="2"><b>Dispatched through:</b> ' + H(m.dispatchedThrough || '') + ' &nbsp; <b>Destination:</b> ' + H(m.destination || '') + '</td></tr>' : '') + '</table>' +
      '<table style="width:100%;border-collapse:collapse;text-align:center;" border="1" cellpadding="5"><tr><th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Unit</th></tr>' + rows + '</table><p style="font-size:12px;">Goods received in good condition.</p>' +
      '<div style="display:flex;justify-content:space-between;margin-top:34px;"><span>Receiver’s sign &amp; stamp</span><span>for TWINTOWN EXPRESS SERVICES PVT LTD<br><br>Authorised Signatory</span></div></div>');
  };

  /* ================= price list ================= */
  var PL = { cat: '', q: '', type: 'rate', sel: {} };
  window.ttOpenPriceList = function () { PL.sel = {}; plDraw(); };
  function plItems() { var q = PL.q.toLowerCase(); return inv().filter(function (p) { return (!PL.cat || p.category === PL.cat) && (!q || (String(p.name) + ' ' + String(p.code || '')).toLowerCase().indexOf(q) >= 0) && N(p[PL.type === 'rate' ? 'rate' : 'dealerPrice']) > 0; }); }
  function plDraw() {
    var cats = Array.from(new Set(inv().map(function (p) { return p.category; }).filter(Boolean))).sort(), list = plItems(), selIds = Object.keys(PL.sel);
    var text = selIds.length ? 'Twin Town Express Services – Price list (' + ttYmd() + ')\n' + (PL.type === 'rate' ? 'MRP incl. GST' : 'Dealer price incl. GST') + '\n\n' + selIds.slice(0, 80).map(function (id) { var p = inv().find(function (x) { return String(x.id) === id; }); return p ? '• ' + p.name + ' – ' + inr(p[PL.type === 'rate' ? 'rate' : 'dealerPrice']) : ''; }).filter(Boolean).join('\n') : '';
    var h = '<select class="tt41-in" onchange="PL_cat(this.value)"><option value="">All categories</option>' + cats.map(function (c) { return '<option' + (PL.cat === c ? ' selected' : '') + '>' + H(c) + '</option>'; }).join('') + '</select>' +
      '<div class="tt41-row2"><button class="btn ' + (PL.type === 'rate' ? 'btn-primary' : 'btn-outline') + ' btn-sm" onclick="PL_type(\'rate\')">MRP</button><button class="btn ' + (PL.type === 'dealer' ? 'btn-primary' : 'btn-outline') + ' btn-sm" onclick="PL_type(\'dealer\')">Dealer price</button></div>' +
      '<input class="tt41-in" placeholder="Search item" value="' + H(PL.q) + '" oninput="PL_q(this.value)"><div class="tt41-sub">' + selIds.length + ' selected · tap an item to select (max 80)</div>' +
      list.slice(0, 60).map(function (p) { var on = PL.sel[String(p.id)]; return '<div class="tt41-row" style="cursor:pointer;' + (on ? 'background:rgba(34,197,94,.1);' : '') + '" onclick="PL_tog(\'' + esc(p.id) + '\')"><span>' + (on ? '☑' : '☐') + '</span><div style="flex:1;min-width:0;"><b style="font-size:12.5px;">' + H(p.name) + '</b></div><b>' + inr(p[PL.type === 'rate' ? 'rate' : 'dealerPrice']) + '</b></div>'; }).join('') + (list.length > 60 ? '<div class="tt41-sub">Showing 60 of ' + list.length + ' – search to narrow</div>' : '') +
      (text ? '<textarea class="tt41-in" rows="5" readonly onclick="this.select()">' + H(text) + '</textarea><div class="tt41-row2"><input class="tt41-in" id="tt41PlPh" inputmode="numeric" maxlength="10" placeholder="Customer mobile (optional)"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" onclick="this.href=ttPlLink()" href="#">💬 WhatsApp</a></div>' : '');
    var keepScroll = document.querySelector('#tt41Pl .tt41-bd'), y = keepScroll ? keepScroll.scrollTop : 0; V.modal('tt41Pl', '🏷️ Share price list', h, true); keepScroll = document.querySelector('#tt41Pl .tt41-bd'); if (keepScroll) keepScroll.scrollTop = y;
    PL.text = text;
  }
  window.PL_cat = function (v) { PL.cat = v; plDraw(); }; window.PL_type = function (t) { PL.type = t; PL.sel = {}; plDraw(); };
  window.PL_q = function (v) { PL.q = v; var el = document.querySelector('#tt41Pl .tt41-in:nth-of-type(1)'); plDraw(); var inp = document.querySelector('#tt41Pl input[placeholder="Search item"]'); if (inp) { inp.focus(); try { inp.setSelectionRange(v.length, v.length); } catch (e) {} } };
  window.PL_tog = function (id) { if (PL.sel[id]) delete PL.sel[id]; else if (Object.keys(PL.sel).length < 80) PL.sel[id] = 1; plDraw(); };
  window.ttPlLink = function () { return waLink(($('tt41PlPh') || {}).value, PL.text || ''); };

  /* ================= barcode labels (Code 39 – any scanner reads it) ================= */
  var C39 = { '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn', 'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn' };
  V.code39 = function (text, h) {
    var s = '*' + String(text || '').toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+%]/g, '-') + '*', x = 0, w = 0, bars = '', narrow = 1.4, wide = 3.6;
    for (var i = 0; i < s.length; i++) { var p = C39[s[i]]; for (var k = 0; k < 9; k++) { var wd = p[k] === 'w' ? wide : narrow; if (k % 2 === 0) bars += '<rect x="' + x.toFixed(2) + '" y="0" width="' + wd + '" height="' + h + '" fill="#000"/>'; x += wd; } x += narrow; }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + x.toFixed(1) + ' ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h * 0.55 + 'px;display:block;">' + bars + '</svg>';
  };
  var LB = { q: '', sel: {} };
  window.ttOpenLabels = function () { LB.sel = {}; lbDraw(); };
  function lbDraw() {
    var q = LB.q.toLowerCase(), list = inv().filter(function (p) { return !q || (String(p.name) + ' ' + String(p.code || '')).toLowerCase().indexOf(q) >= 0; }).slice(0, 40), n = Object.keys(LB.sel).length;
    var h = '<input class="tt41-in" placeholder="Search item or code" value="' + H(LB.q) + '" oninput="LB_q(this.value)"><div class="tt41-sub">' + n + ' item(s) selected. Label barcode = item code (or id). Tap to select; set how many copies.</div>' +
      list.map(function (p) { var on = LB.sel[String(p.id)]; return '<div class="tt41-row" style="' + (on ? 'background:rgba(34,197,94,.1);' : '') + '"><span style="cursor:pointer" onclick="LB_tog(\'' + esc(p.id) + '\')">' + (on ? '☑' : '☐') + '</span><div style="flex:1;min-width:0;cursor:pointer" onclick="LB_tog(\'' + esc(p.id) + '\')"><b style="font-size:12.5px;">' + H(p.name) + '</b><small>' + H(p.code || p.id) + ' · ' + inr(p.rate) + '</small></div>' + (on ? '<input type="number" min="1" max="60" value="' + on + '" style="width:54px" onchange="LB_cnt(\'' + esc(p.id) + '\',this.value)">' : '') + '</div>'; }).join('') +
      '<button class="btn btn-primary" style="width:100%;margin-top:10px;"' + (n ? '' : ' disabled') + ' onclick="ttLbPrint()">🖨 Print labels</button>';
    var sc = document.querySelector('#tt41Lb .tt41-bd'), y = sc ? sc.scrollTop : 0; V.modal('tt41Lb', '🏷️ Barcode labels', h, true); sc = document.querySelector('#tt41Lb .tt41-bd'); if (sc) sc.scrollTop = y;
  }
  window.LB_q = function (v) { LB.q = v; lbDraw(); var i = document.querySelector('#tt41Lb input[placeholder^="Search"]'); if (i) { i.focus(); try { i.setSelectionRange(v.length, v.length); } catch (e) {} } };
  window.LB_tog = function (id) { if (LB.sel[id]) delete LB.sel[id]; else LB.sel[id] = 1; lbDraw(); };
  window.LB_cnt = function (id, v) { LB.sel[id] = Math.min(60, Math.max(1, parseInt(v) || 1)); };
  window.ttLbPrint = function () {
    var cells = [];
    Object.keys(LB.sel).forEach(function (id) { var p = inv().find(function (x) { return String(x.id) === id; }); if (!p) return; for (var i = 0; i < LB.sel[id]; i++) cells.push('<div class="lb"><div class="n">' + H(p.name) + '</div>' + V.code39(p.code || p.id, 34) + '<div class="c">' + H(p.code || p.id) + '</div><div class="p">MRP ' + inr(p.rate) + '</div></div>'); });
    ttPrintHtml('Labels', '<style>.g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.lb{border:1px dashed #999;padding:5px;text-align:center;font-family:Arial,sans-serif;page-break-inside:avoid}.n{font-size:10px;font-weight:700;height:24px;overflow:hidden;line-height:12px}.c{font-size:9px;letter-spacing:1px}.p{font-size:11px;font-weight:800}</style><div class="g">' + cells.join('') + '</div>');
  };

  /* ================= e-way bill draft file ================= */
  var EW = { q: '' };
  window.ttOpenEway = function () { EW.q = ''; ewDraw(); };
  function ewDraw() {
    var q = EW.q.toLowerCase(), list = ord().filter(function (o) { return o && o.status === 'Delivered' && (!q || (String(o.id) + ' ' + (o.invoiceNo || '') + ' ' + (o.customerName || '')).toLowerCase().indexOf(q) >= 0); }).sort(function (a, b) { return dateOf(b) < dateOf(a) ? -1 : 1; }).slice(0, 30);
    V.modal('tt41Ew', '🚛 E-way bill file (draft)', '<div class="tt41-sub">Makes a JSON file for the e-way bill portal (bulk upload). It is a <b>draft</b>: open it on the portal and check addresses, pincodes and values before generating.</div><input class="tt41-in" placeholder="Search delivered bill" value="' + H(EW.q) + '" oninput="ttEwQ(this.value)">' + list.map(function (o) { return '<div class="tt41-row" style="cursor:pointer" onclick="ttEwForm(\'' + esc(o.id) + '\')"><div style="flex:1;min-width:0;"><b>' + H(o.customerName) + '</b><small>' + H(window.ttInvNo ? ttInvNo(o) : o.id) + ' · ' + H(dateOf(o)) + ' · ' + inr(o.totalAmount) + '</small></div><span>›</span></div>'; }).join(''));
  }
  window.ttEwQ = function (v) { EW.q = v; ewDraw(); var i = document.querySelector('#tt41Ew .tt41-in'); if (i) { i.focus(); try { i.setSelectionRange(v.length, v.length); } catch (e) {} } };
  function pin(s) { var m = String(s || '').match(/\b(\d{6})\b/); return m ? m[1] : ''; }
  window.ttEwForm = function (id) {
    var o = ord().find(function (x) { return x.id === id; }); if (!o) return;
    var c = custs().find(function (x) { return l10(x.phone) === l10(o.phone) || String(x.name).toLowerCase() === String(o.customerName).toLowerCase(); }) || {}, d = company();
    var h = '<div class="tt41-sub"><b>' + H(o.customerName) + '</b> · ' + H(window.ttInvNo ? ttInvNo(o) : o.id) + ' · ' + inr(o.totalAmount) + (N(o.totalAmount) < 50000 ? '<br>⚠ Value is below ₹50,000 – an e-way bill is normally not needed.' : '') + '</div>' +
      '<div class="tt41-mg"><div><label class="form-label">From pincode</label><input class="tt41-in" id="tt41EwFp" inputmode="numeric" maxlength="6" value="' + pin(d.address) + '"></div><div><label class="form-label">To pincode</label><input class="tt41-in" id="tt41EwTp" inputmode="numeric" maxlength="6" value="' + pin(c.address) + '"></div>' +
      '<div><label class="form-label">Distance (km)</label><input class="tt41-in" id="tt41EwKm" type="number" min="0" value="0"></div><div><label class="form-label">Vehicle no.</label><input class="tt41-in" id="tt41EwVh" maxlength="12" placeholder="OD02AB1234"></div>' +
      '<div><label class="form-label">Transporter name</label><input class="tt41-in" id="tt41EwTn" maxlength="40"></div><div><label class="form-label">Transporter GSTIN</label><input class="tt41-in" id="tt41EwTi" maxlength="15"></div></div>' +
      '<button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="ttEwMake(\'' + esc(o.id) + '\')">⬇ Download JSON</button>';
    V.modal('tt41Ew', '🚛 E-way bill file (draft)', h);
  };
  window.ttEwMake = function (id) {
    var o = ord().find(function (x) { return x.id === id; }); if (!o) return;
    var c = custs().find(function (x) { return l10(x.phone) === l10(o.phone) || String(x.name).toLowerCase() === String(o.customerName).toLowerCase(); }) || {}, d = company(), inter = o.taxType === 'INTER';
    var fg = String(d.gstin || '').toUpperCase(), tg = /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(String(c.gst || '').toUpperCase()) ? String(c.gst).toUpperCase() : 'URP';
    var fs = parseInt(fg.slice(0, 2)) || 21, ts = tg !== 'URP' ? parseInt(tg.slice(0, 2)) : (inter ? 0 : fs), fp = parseInt($('tt41EwFp').value) || 0, tp = parseInt($('tt41EwTp').value) || 0;
    if (fg.length !== 15) return alert('Your company GSTIN is missing in Company Details.');
    if (String(fp).length !== 6 || String(tp).length !== 6) return alert('Enter 6-digit pincodes for From and To.');
    var items = [], tv = 0, tc = 0, ti = 0;
    (o.items || []).forEach(function (it) {
      var g = window.ttItemGstRate ? ttItemGstRate(it) : 18, incl = N(it.total), txb = R2(incl / (1 + g / 100)), tax = R2(incl - txb); tv += txb; if (inter) ti += tax; else tc += tax / 2;
      items.push({ productName: String(it.name || '').slice(0, 100), productDesc: String(it.name || '').slice(0, 100), hsnCode: parseInt(window.ttItemHsn ? ttItemHsn(it) : it.hsn) || 0, quantity: N(it.qty), qtyUnit: 'PCS', taxableAmount: txb, sgstRate: inter ? 0 : g / 2, cgstRate: inter ? 0 : g / 2, igstRate: inter ? g : 0, cessRate: 0 });
    });
    var dd = dateOf(o).split('-'), docDate = dd[2] + '/' + dd[1] + '/' + dd[0];
    var bill = { userGstin: fg, supplyType: 'O', subSupplyType: 1, docType: 'INV', docNo: String(window.ttInvNo ? ttInvNo(o) : o.id), docDate: docDate,
      fromGstin: fg, fromTrdName: 'TWINTOWN EXPRESS SERVICES PVT LTD', fromAddr1: String(d.address || '').slice(0, 120), fromAddr2: '', fromPlace: String(d.branch || 'Bhubaneswar'), fromPincode: fp, fromStateCode: fs, actFromStateCode: fs,
      toGstin: tg, toTrdName: String(o.customerName || '').slice(0, 100), toAddr1: String(c.address || '').slice(0, 120), toAddr2: '', toPlace: String(c.address || '').split(',').slice(-2)[0] || '', toPincode: tp, toStateCode: ts, actToStateCode: ts,
      totalValue: R2(tv), cgstValue: R2(tc), sgstValue: R2(tc), igstValue: R2(ti), cessValue: 0, totInvValue: R2(o.totalAmount), transMode: '1', transDistance: String(parseInt(($('tt41EwKm') || {}).value) || 0),
      transporterId: String(($('tt41EwTi') || {}).value || '').toUpperCase(), transporterName: String(($('tt41EwTn') || {}).value || ''), vehicleNo: String(($('tt41EwVh') || {}).value || '').toUpperCase().replace(/\s/g, ''), vehicleType: 'R', itemList: items };
    downloadFile(JSON.stringify({ version: '1.0.0621', billLists: [bill] }, null, 2), 'EWB_' + String(bill.docNo).replace(/[^\w-]/g, '_') + '.json', 'application/json');
    V.toast('Draft file downloaded – check it on the e-way bill portal');
  };

  /* ================= auto service reminder after delivery ================= */
  (function () {
    var prev = window.executeConfirmedDelivery; if (typeof prev !== 'function') return;
    window.executeConfirmedDelivery = function () {
      var id = ($('pendingDeliverOrderId') || {}).value, o = ord().find(function (x) { return x.id === id; }), was = o && o.status;
      return Promise.resolve(prev.apply(this, arguments)).then(function (r) {
        try {
          if (o && was !== 'Delivered' && o.status === 'Delivered' && F('svcRemind')) {
            var words = String(F('svcCats') || '').toLowerCase().split(',').map(function (x) { return x.trim(); }).filter(Boolean), made = 0;
            if (words.length && typeof machinePartsData !== 'undefined') {
              (o.items || []).forEach(function (it, i) {
                var p = ttFindStock(it), cat = String((p && p.category) || '').toLowerCase(); if (!cat || !words.some(function (w) { return cat.indexOf(w) >= 0; })) return;
                var key = o.id + '|' + String(it.name || ''); if (machinePartsData.some(function (m) { return m.autoKey === key; })) return;
                machinePartsData.push({ id: 'MP' + Date.now() + i, machineName: String(it.name || '').slice(0, 60), partName: 'General service', installedDate: o.deliveredDate || ttYmd(), intervalMonths: Math.max(1, N(F('svcMonths')) || 6), customerName: o.customerName || '', addedBy: V.me() || 'Staff', autoKey: key }); made++;
              });
              if (made) { window.machinePartsData = machinePartsData; setStored('MACHINE_PARTS', machinePartsData); try { updateGlobalReminders(); } catch (e) {} V.toast('Service reminder added for ' + made + ' machine' + (made > 1 ? 's' : '')); }
            }
          }
        } catch (e) { console.warn('service reminder', e); }
        return r;
      });
    };
  })();

  /* ================= credit limit per customer ================= */
  function outstanding(c, excludeId) {
    var names = {}, phones = {}; names[String(c.name || '').toLowerCase()] = 1; (c.aliases || []).forEach(function (a) { names[String(a).toLowerCase()] = 1; });
    if (l10(c.phone)) phones[l10(c.phone)] = 1; (c.contacts || []).forEach(function (k) { if (l10(k.phone)) phones[l10(k.phone)] = 1; });
    return ord().filter(function (o) { return o && o.status !== 'Cancelled' && o.id !== excludeId && (names[String(o.customerName || '').toLowerCase()] || phones[l10(o.phone)]); }).reduce(function (a, o) { return a + N(o.dueAmount); }, 0);
  }
  (function () {
    var s = window.saveOrderAction; if (typeof s !== 'function') return;
    window.saveOrderAction = function () {
      try {
        if (F('creditPerCustomer')) {
          var c = resolveCustomerFromSearch(($('ordCustSearchInput') || {}).value.trim()), lim = c && N(c.creditLimit);
          if (lim > 0) {
            var tot = outstanding(c, ($('editOrderId') || {}).value) + N(($('ordDueAmt') || {}).value);
            if (tot > lim) {
              var msg = 'Credit limit of ' + c.name + ' is ' + inr(lim) + '.\nWith this order the total due becomes ' + inr(tot) + '.';
              if (!isAdm() && F('creditBlockStaff')) { alert(msg + '\n\nOnly Admin can approve this order.'); return; }
              if (!confirm(msg + '\n\nSave this order anyway?')) return;
            }
          }
        }
      } catch (e) { console.warn('credit check', e); }
      return s.apply(this, arguments);
    };
  })();

  /* ================= customer form: credit limit + documents ================= */
  var DOCS = [], DOC_MAX = 5, DOC_CHARS = 850000;
  function injectCust() {
    var card = $('customerModal') && $('customerModal').querySelector('.auth-card'), ct = $('tt41Ct'); if (!card || !ct || $('tt41Cr')) return;
    var cr = document.createElement('div'); cr.id = 'tt41Cr'; cr.innerHTML = '<div class="form-group"><label class="form-label">Credit limit (₹) <small style="opacity:.6">– 0 or blank = no personal limit</small></label><input type="number" id="cCredit" min="0" step="any" inputmode="decimal" placeholder="e.g. 50000"></div>';
    card.insertBefore(cr, ct);
    var dc = document.createElement('div'); dc.id = 'tt41Dc'; dc.className = 'tt41-ct';
    dc.innerHTML = '<div class="tt41-ct-h"><b>📎 Documents <span id="tt41DcN"></span></b><small>GST certificate, PAN, visiting card – photo or small PDF (max ' + DOC_MAX + ')</small></div><div id="tt41DcList"></div><button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById(\'tt41DcFile\').click()">➕ Add document</button><input type="file" id="tt41DcFile" accept="image/*,application/pdf" style="display:none" onchange="ttDcPick(this)">';
    card.insertBefore(dc, ct.nextSibling);
  }
  function dcDraw() {
    var l = $('tt41DcList'); if (!l) return;
    l.innerHTML = DOCS.map(function (d, i) { return '<div class="tt41-row"><span>' + (d.type === 'pdf' ? '📄' : '🖼️') + '</span><div style="flex:1;min-width:0;"><b style="font-size:12.5px;">' + H(d.name) + '</b><small>' + Math.round(d.data.length * 0.75 / 1024) + ' KB</small></div><button type="button" class="btn btn-outline btn-sm" onclick="ttDcView(' + i + ')">View</button><button type="button" class="btn btn-danger-sm btn-sm" onclick="ttDcDel(' + i + ')">✕</button></div>'; }).join('');
    var n = $('tt41DcN'); if (n) n.textContent = DOCS.length ? '(' + DOCS.length + ')' : '';
  }
  window.ttDcPick = function (inp) {
    var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    if (DOCS.length >= DOC_MAX) return alert('Maximum ' + DOC_MAX + ' documents.');
    var isPdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
    if (isPdf && f.size > 300 * 1024) return alert('PDF is too big (max 300 KB). Take a photo of it instead.');
    var r = new FileReader();
    r.onload = function (e) {
      var go = isPdf ? Promise.resolve(e.target.result) : (window.ttCompressImageSafe ? ttCompressImageSafe(e.target.result, 900, 0.6, 200000) : Promise.resolve(e.target.result));
      go.then(function (data) {
        var total = DOCS.reduce(function (a, d) { return a + d.data.length; }, 0) + data.length;
        if (total > DOC_CHARS) return alert('Documents of one customer are limited to about 600 KB in total. Remove one first.');
        DOCS.push({ id: 'd' + Date.now().toString(36), name: window.ttCleanText ? ttCleanText(f.name, 40) : f.name.slice(0, 40), type: isPdf ? 'pdf' : 'img', data: data, at: ttYmd(), by: V.me() }); dcDraw();
      });
    };
    r.readAsDataURL(f);
  };
  window.ttDcDel = function (i) { DOCS.splice(i, 1); dcDraw(); };
  window.ttDcView = function (i, fromCust) {
    var d = (fromCust ? fromCust : DOCS)[i]; if (!d) return;
    fetch(d.data).then(function (r) { return r.blob(); }).then(function (b) { window.open(URL.createObjectURL(b), '_blank'); }).catch(function () { alert('Cannot open this file.'); });
  };
  window.ttCustDocs = function (id) {
    var c = custs().find(function (x) { return String(x.id) === String(id); }); if (!c || !(c.docs || []).length) return;
    V.modal('tt41Cd', '📎 ' + H(c.name) + ' – documents', c.docs.map(function (d, i) { return '<div class="tt41-row"><span>' + (d.type === 'pdf' ? '📄' : '🖼️') + '</span><div style="flex:1;min-width:0;"><b style="font-size:12.5px;">' + H(d.name) + '</b><small>' + H(d.at || '') + ' · ' + H(d.by || '') + '</small></div><button class="btn btn-outline btn-sm" onclick="ttDcViewC(\'' + esc(id) + '\',' + i + ')">View</button></div>'; }).join(''));
  };
  window.ttDcViewC = function (id, i) { var c = custs().find(function (x) { return String(x.id) === String(id); }); if (c) ttDcView(i, c.docs); };
  (function () {
    var o = window.openAddCustomerModal;
    if (typeof o === 'function') window.openAddCustomerModal = function (cObj) {
      var r = o.apply(this, arguments);
      try { injectCust(); $('cCredit').value = cObj && N(cObj.creditLimit) > 0 ? cObj.creditLimit : ''; DOCS = cObj && Array.isArray(cObj.docs) ? cObj.docs.map(function (d) { return Object.assign({}, d); }) : []; dcDraw(); $('tt41Dc').style.display = F('custDocs') ? '' : 'none'; } catch (e) { console.warn(e); }
      return r;
    };
    var s = window.saveCustomerAction;
    if (typeof s === 'function') window.saveCustomerAction = function () {
      var editId = ($('editCustId') || {}).value, lim = N(($('cCredit') || {}).value), docs = DOCS.slice(), haveDocsUi = !!$('tt41Dc');
      var r = s.apply(this, arguments);
      try {
        if ($('customerModal').style.display !== 'none') return r;
        var c = editId ? custs().find(function (x) { return String(x.id) === String(editId); }) : custs()[0];
        if (c) { if (lim > 0) c.creditLimit = lim; else delete c.creditLimit; if (haveDocsUi && F('custDocs')) { if (docs.length) c.docs = docs; else delete c.docs; } setStored('CUSTOMERS', customerDatabase); try { renderStockList(); } catch (e) {} }
      } catch (e) { console.warn('customer extras', e); }
      return r;
    };
  })();

  /* ================= customer card shortcuts ================= */
  window.ttCustActions = function (c) {
    if (!c) return '';
    var b = '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();ttOpenStatement(\'' + esc(c.name) + '\')">📄 Statement</button>';
    if (F('custDocs') && (c.docs || []).length) b += '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();ttCustDocs(\'' + esc(c.id) + '\')">📎 Docs (' + c.docs.length + ')</button>';
    if (N(c.creditLimit) > 0) b += '<span class="tt41-cc">Limit ' + inr(c.creditLimit) + '</span>';
    return '<div class="tt41-cchips" onclick="event.stopPropagation()">' + b + '</div>';
  };
  document.addEventListener('DOMContentLoaded', injectCust);
  setTimeout(injectCust, 1500);
})();
