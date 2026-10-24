/* TTESPL ERP v41 - FEATURES MODULE (screens opened from Settings / profile menu). Needs js/18-v41-core.js */
(function () {
  'use strict';
  var V = window.ttV41; if (!V) return;
  var F = V.F, $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return ttEscHtml(s); };
  var inr = function (n) { return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var N = function (x) { return Number(x) || 0; };
  var R2 = function (x) { return Math.round(N(x) * 100) / 100; };
  function isAdm() { return V.isAdm(); }
  function toast(m, bad) { V.toast(m, bad); }
  function cloud() { return window.cloudSync; }
  function orders() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function dateOf(o) { return String(o.deliveredDate || o.orderDate || '').slice(0, 10); }
  function bar(p, c) { return '<div class="tt41-bar"><i style="width:' + Math.max(2, Math.min(100, p)) + '%;background:' + (c || '#3b82f6') + '"></i></div>'; }
  function head2(t) { return '<div class="tt41-h2">' + t + '</div>'; }

  /* ===== Recycle bin ===== */
  window.ttOpenRecycle = function () {
    if (!isAdm()) return toast('Only Admin can open the recycle bin', true);
    var bin = ((window.TTX && TTX.RECYCLE) || []).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    var h = '<div class="tt41-sub">' + bin.length + ' deleted record(s). Restore puts the record back everywhere. Photos are not kept in the bin.</div>' +
      (bin.length ? bin.slice(0, 200).map(function (r) { return '<div class="tt41-row"><div style="min-width:0;flex:1;"><b>' + H(r.kind) + ': ' + H(r.label) + '</b><small>' + H(String(r.at || '').replace('T', ' ').slice(0, 16)) + ' · deleted by ' + H(r.by) + '</small></div><button class="btn btn-outline btn-sm" onclick="ttV41.restoreFromBin(\'' + esc(r.id) + '\');ttOpenRecycle()">↩ Restore</button><button class="btn btn-danger-sm btn-sm" onclick="ttBinForever(\'' + esc(r.id) + '\')">🗑</button></div>'; }).join('') : '<div class="tt41-empty">Recycle bin is empty.</div>');
    V.modal('tt41Bin', '🗑️ Recycle bin', h);
  };
  window.ttBinForever = function (id) { if (!isAdm() || !confirm('Delete this for ever? It cannot be restored.')) return; cloud().deleteItem('RECYCLE', id); setTimeout(ttOpenRecycle, 400); };

  /* ===== Receipts, refund, credit note ===== */
  var RC = { q: '', id: '' };
  function payList(o) { return (o.payments || []).map(function (p, i) { return { p: p, i: i }; }); }
  window.ttOpenReceipts = function () { RC.q = ''; RC.id = ''; rcDraw(); };
  function rcDraw() {
    var h;
    if (!RC.id) {
      var q = RC.q.toLowerCase(), list = orders().filter(function (o) { return o && o.status !== 'Cancelled' && (N(o.recvAmount) > 0 || (o.payments || []).length) && (!q || (String(o.id) + ' ' + (o.invoiceNo || '') + ' ' + (o.customerName || '')).toLowerCase().indexOf(q) >= 0); }).sort(function (a, b) { return dateOf(b) < dateOf(a) ? -1 : 1; }).slice(0, 60);
      h = '<input class="tt41-in" placeholder="Search bill no. or customer" value="' + H(RC.q) + '" oninput="ttRcQ(this.value)">' + list.map(function (o) { return '<div class="tt41-row" onclick="ttRcPick(\'' + esc(o.id) + '\')" style="cursor:pointer;"><div style="flex:1;min-width:0;"><b>' + H(o.customerName) + '</b><small>' + H(o.invoiceNo || o.id) + ' · ' + H(dateOf(o)) + ' · received ₹' + inr(o.recvAmount) + '</small></div><span>›</span></div>'; }).join('');
    } else {
      var o = orders().find(function (x) { return x.id === RC.id; });
      if (!o) { RC.id = ''; return rcDraw(); }
      h = '<button class="btn btn-outline btn-sm" onclick="ttRcPick(\'\')">‹ Back</button><div class="tt41-h2">' + H(o.customerName) + ' — ' + H(o.invoiceNo || o.id) + '</div><div class="tt41-sub">Total ₹' + inr(o.totalAmount) + ' · Received ₹' + inr(o.recvAmount) + ' · Due ₹' + inr(o.dueAmount) + '</div>' +
        (payList(o).length ? payList(o).map(function (x) { var p = x.p, ref = !!p.refund; return '<div class="tt41-row"><div style="flex:1;min-width:0;"><b style="color:' + (ref ? '#dc2626' : 'inherit') + '">' + (ref ? '− ' : '') + '₹' + inr(Math.abs(N(p.amount))) + ' · ' + H(p.mode || '') + '</b><small>' + H(p.at || '') + ' · ' + H(p.by || '') + ' · ' + H((ref ? p.cnNo : p.rno) || (ref ? 'credit note pending' : 'no receipt no.')) + (ref && p.reason ? ' · ' + H(p.reason) : '') + '</small></div><button class="btn btn-outline btn-sm" onclick="ttRcPrint(\'' + esc(o.id) + '\',' + x.i + ')">🖨</button></div>'; }).join('') : '<div class="tt41-empty">No payment entries (old bill).</div>') +
        (isAdm() ? '<button class="btn btn-danger-sm" style="width:100%;margin-top:10px;" onclick="ttRcRefund(\'' + esc(o.id) + '\')">↩ Record a refund / credit note</button>' : '');
    }
    V.modal('tt41Rc', '🧾 Receipts & refunds', h);
  }
  window.ttRcQ = function (v) { RC.q = v; var el = document.querySelector('#tt41Rc .tt41-in'), pos = el && el.selectionStart; rcDraw(); el = document.querySelector('#tt41Rc .tt41-in'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } };
  window.ttRcPick = function (id) { RC.id = id; rcDraw(); };
  function docHtml(title, no, o, p, extra) {
    var d = window.companyDetailsData || {};
    return '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;border:1px solid #000;padding:16px;font-size:13px;"><div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;"><b style="font-size:17px;">TWINTOWN EXPRESS SERVICES PVT LTD</b><br>' + H(d.address || '') + '<br>GSTIN: ' + H(d.gstin || '') + ' · ' + H(d.contact || '') + '</div><h2 style="text-align:center;margin:10px 0;">' + title + '</h2>' +
      '<table style="width:100%;font-size:13px;"><tr><td><b>No.:</b> ' + H(no || '—') + '</td><td style="text-align:right;"><b>Date:</b> ' + H(String(p.at || '').slice(0, 10)) + '</td></tr><tr><td colspan="2"><b>Customer:</b> ' + H(o.customerName) + (o.phone ? ' (' + H(o.phone) + ')' : '') + '</td></tr><tr><td colspan="2"><b>Against bill:</b> ' + H(o.invoiceNo || o.id) + '</td></tr><tr><td colspan="2"><b>Mode:</b> ' + H(p.mode || '') + '</td></tr></table>' +
      '<div style="margin:14px 0;padding:10px;border:1px solid #000;font-size:16px;"><b>Amount: ₹ ' + inr(Math.abs(N(p.amount))) + '</b>' + (window.ttWords ? '<br><small>' + H(ttWords(Math.abs(N(p.amount)))) + '</small>' : '') + '</div>' + (extra || '') +
      '<div style="display:flex;justify-content:space-between;margin-top:30px;"><span>Customer sign</span><span>for TWINTOWN EXPRESS SERVICES PVT LTD<br><br>Authorised Signatory</span></div></div>';
  }
  window.ttRcPrint = function (id, i) {
    var o = orders().find(function (x) { return x.id === id; }), p = o && (o.payments || [])[i]; if (!o || !p) return;
    var ref = !!p.refund, bal = '<div>Bill total ₹' + inr(o.totalAmount) + ' · Received ₹' + inr(o.recvAmount) + ' · Balance due ₹' + inr(o.dueAmount) + '</div>';
    ttPrintHtml(ref ? 'Credit Note' : 'Receipt', docHtml(ref ? 'CREDIT NOTE / REFUND VOUCHER' : 'PAYMENT RECEIPT', ref ? p.cnNo : p.rno, o, p, (ref && p.reason ? '<div>Reason: ' + H(p.reason) + '</div>' : '') + bal));
  };
  window.ttRcRefund = async function (id) {
    if (!isAdm()) return;
    var o = orders().find(function (x) { return x.id === id; }); if (!o) return;
    var a = prompt('Refund amount (₹). Received so far: ₹' + inr(o.recvAmount), ''); var amt = R2(a); if (!(amt > 0)) return;
    if (amt > N(o.recvAmount) + 0.009) return alert('Refund is more than the received amount.');
    var reason = (prompt('Reason for refund / credit note:', '') || '').trim(); if (!reason) return alert('Please type a reason.');
    var mode = (prompt('Refund mode (Cash / UPI / Bank):', 'Cash') || 'Cash').trim();
    o.payments = Array.isArray(o.payments) ? o.payments : [];
    var p = { amount: -amt, refund: true, mode: ttCleanText(mode, 20), reason: ttCleanText(reason, 120), at: getNowStr(), by: V.me(), needCn: true };
    o.payments.push(p); o.recvAmount = R2(N(o.recvAmount) - amt); o.dueAmount = Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount)));
    o.auditTrail = o.auditTrail || []; o.auditTrail.unshift({ by: V.me() + ' (Admin)', time: getNowStr(), note: 'Refund ₹' + amt + ' — ' + p.reason });
    setStored('ORDERS', ordersData);
    try { ttActAdd && ttActAdd('Payment', 'refund', o.id, '₹' + amt + ' ' + p.reason); } catch (e) {}
    V.nextNo('cn', 'CN', 1).then(function (no) { p.cnNo = no; delete p.needCn; setStored('ORDERS', ordersData); rcDraw(); }).catch(function () { /* offline: number added later */ });
    try { renderBilling('all'); renderDashboard(); } catch (e) {}
    rcDraw(); toast('Refund recorded');
  };
  setInterval(function () {   // credit-note numbers for refunds made offline
    if (!navigator.onLine || !window.ttCloudInitialLoadDone) return;
    orders().forEach(function (o) { (o.payments || []).forEach(function (p) { if (p && p.needCn && !p.cnNo) V.nextNo('cn', 'CN', 1).then(function (no) { p.cnNo = no; delete p.needCn; setStored('ORDERS', ordersData); }).catch(function () {}); }); });
  }, 60000);

  /* ===== Customer statement ===== */
  window.ttOpenStatement = function () {
    var names = {}; orders().forEach(function (o) { if (o && o.customerName) names[o.customerName] = 1; });
    var h = '<input class="tt41-in" id="tt41StName" list="tt41StList" placeholder="Customer name" autocomplete="off"><datalist id="tt41StList">' + Object.keys(names).sort().slice(0, 1500).map(function (n) { return '<option value="' + H(n) + '">'; }).join('') + '</datalist><div class="tt41-row2"><input type="date" class="tt41-in" id="tt41StFrom"><input type="date" class="tt41-in" id="tt41StTo"></div><button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="ttStatementGo()">Show statement</button><div id="tt41StOut"></div>';
    V.modal('tt41St', '📄 Customer statement', h);
  };
  function stData() {
    var nm = ($('tt41StName').value || '').trim(), from = $('tt41StFrom').value, to = $('tt41StTo').value; if (!nm) return null;
    var key = nm.toLowerCase(), first = orders().find(function (o) { return String(o.customerName || '').toLowerCase() === key; }), ph = first && String(first.phone || '').slice(-10);
    var list = orders().filter(function (o) { return o && o.status !== 'Cancelled' && (String(o.customerName || '').toLowerCase() === key || (ph && String(o.phone || '').slice(-10) === ph)) && (!from || dateOf(o) >= from) && (!to || dateOf(o) <= to); }).sort(function (a, b) { return dateOf(a) < dateOf(b) ? -1 : 1; });
    var t = 0, r = 0; list.forEach(function (o) { t += N(o.totalAmount); r += N(o.recvAmount); });
    return { nm: nm, list: list, t: R2(t), r: R2(r), d: R2(t - r), ph: ph || '' };
  }
  function stTable(s) { return '<table style="width:100%;border-collapse:collapse;font-size:12px;" border="1" cellpadding="4"><tr><th>Date</th><th>Bill</th><th>Status</th><th>Total</th><th>Received</th><th>Due</th></tr>' + s.list.map(function (o) { return '<tr><td>' + H(dateOf(o)) + '</td><td>' + H(o.invoiceNo || o.id) + '</td><td>' + H(o.status) + '</td><td align="right">' + inr(o.totalAmount) + '</td><td align="right">' + inr(o.recvAmount) + '</td><td align="right">' + inr(o.dueAmount) + '</td></tr>'; }).join('') + '<tr style="font-weight:bold;"><td colspan="3">Total</td><td align="right">' + inr(s.t) + '</td><td align="right">' + inr(s.r) + '</td><td align="right">' + inr(s.d) + '</td></tr></table>'; }
  window.ttStatementGo = function () {
    var s = stData(); if (!s) return alert('Type a customer name.');
    $('tt41StOut').innerHTML = (s.list.length ? stTable(s) + '<div class="tt41-row2" style="margin-top:8px;"><button class="btn btn-print btn-sm" onclick="ttStatementPrint()">🖨 PDF / Print</button><button class="btn btn-wa btn-sm" onclick="ttStatementWa()">💬 WhatsApp</button></div>' : '<div class="tt41-empty">No bills found.</div>');
  };
  window.ttStatementPrint = function () { var s = stData(); if (s) ttPrintHtml('Statement', '<h2>Statement of Account — ' + H(s.nm) + '</h2><div>TWINTOWN EXPRESS SERVICES PVT LTD · ' + H(ttYmd()) + '</div><br>' + stTable(s)); };
  window.ttStatementWa = function () { var s = stData(); if (!s) return; var txt = 'Statement — ' + s.nm + '\nTotal billed ₹' + inr(s.t) + '\nReceived ₹' + inr(s.r) + '\nBalance due ₹' + inr(s.d) + '\n\nTwin Town Express Services Pvt Ltd'; window.open('https://wa.me/' + (s.ph ? '91' + s.ph : '') + '?text=' + encodeURIComponent(txt), '_blank'); };

  /* ===== Stock in / adjust (with log) ===== */
  window.ttOpenStockAdjust = function () {
    var inv = (typeof sampleInventory !== 'undefined' && sampleInventory) || [];
    var h = '<input class="tt41-in" id="tt41SaItem" list="tt41SaList" placeholder="Item name or code" autocomplete="off"><datalist id="tt41SaList">' + inv.slice(0, 3000).map(function (i) { return '<option value="' + H(i.name) + '">'; }).join('') + '</datalist>' +
      '<select class="tt41-in" id="tt41SaMode"><option value="add">➕ Goods received (add)</option><option value="sub">➖ Remove (damage / loss)</option><option value="set">✏️ Correct stock to exact number</option></select><input type="number" class="tt41-in" id="tt41SaQty" min="0" step="any" placeholder="Quantity"><input class="tt41-in" id="tt41SaWhy" placeholder="Reason / supplier / bill no."><button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="ttStockAdjustGo()">Save</button><div id="tt41SaOut" class="tt41-sub"></div>';
    V.modal('tt41Sa', '📦 Stock in / adjust', h);
  };
  window.ttStockAdjustGo = function () {
    var nm = ($('tt41SaItem').value || '').trim().toLowerCase(), mode = $('tt41SaMode').value, q = N($('tt41SaQty').value), why = ttCleanText($('tt41SaWhy').value, 100);
    var inv = sampleInventory, p = inv.find(function (i) { return String(i.name).toLowerCase() === nm; }) || inv.find(function (i) { return String(i.code || '').toLowerCase() === nm; });
    if (!p) return alert('Item not found. Pick it from the list.'); if (!(q >= 0) || (mode !== 'set' && q <= 0)) return alert('Enter a quantity.'); if (!why) return alert('Please type a reason.');
    var old = N(p.stock), nw = mode === 'add' ? old + q : mode === 'sub' ? Math.max(0, old - q) : q;
    p.stock = nw; setStored('INVENTORY', sampleInventory); try { renderStockList(); } catch (e) {}
    try { ttActAdd && ttActAdd('Stock', mode === 'add' ? 'stock in' : mode === 'sub' ? 'stock out' : 'stock correction', p.name, old + ' → ' + nw + ' (' + why + ')'); } catch (e) {}
    $('tt41SaOut').textContent = '✅ ' + p.name + ': ' + old + ' → ' + nw; $('tt41SaQty').value = ''; $('tt41SaItem').value = '';
  };

  /* ===== Business insights ===== */
  window.ttOpenInsights = function () {
    var now = new Date(), cur = ttYmd(now).slice(0, 7), pd = new Date(now.getFullYear(), now.getMonth() - 1, 1), prev = ttYmd(pd).slice(0, 7);
    var del = orders().filter(function (o) { return o && o.status === 'Delivered'; });
    function agg(m) { var t = 0, c = 0, due = 0; del.forEach(function (o) { if (dateOf(o).slice(0, 7) === m) { t += N(o.totalAmount); c++; due += N(o.dueAmount); } }); return { t: R2(t), c: c, due: R2(due) }; }
    var a = agg(cur), b = agg(prev), pct = b.t > 0 ? Math.round((a.t - b.t) / b.t * 100) : null;
    function top(keyFn, filt, n) { var m = {}; del.forEach(function (o) { if (filt(o)) keyFn(o).forEach(function (kv) { m[kv[0]] = (m[kv[0]] || 0) + kv[1]; }); }); return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, n); }
    var inCur = function (o) { return dateOf(o).slice(0, 7) === cur; };
    var cust = top(function (o) { return [[o.customerName || '—', N(o.totalAmount)]]; }, inCur, 8);
    var staff = top(function (o) { return [[o.bookedBy || '—', N(o.totalAmount)]]; }, inCur, 8);
    var items = top(function (o) { return (o.items || []).map(function (i) { return [i.name || '—', N(i.total)]; }); }, inCur, 8);
    var due = {}; del.forEach(function (o) { if (N(o.dueAmount) > 0) due[o.customerName || '—'] = (due[o.customerName || '—'] || 0) + N(o.dueAmount); });
    var dues = Object.keys(due).map(function (k) { return [k, due[k]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 8);
    function list(arr, color) { var mx = arr.length ? arr[0][1] : 1; return arr.length ? arr.map(function (x) { return '<div class="tt41-ins"><span>' + H(x[0]) + '</span><b>₹' + inr(x[1]) + '</b></div>' + bar(x[1] / mx * 100, color); }).join('') : '<div class="tt41-empty">No data</div>'; }
    var h = '<div class="tt41-kpis"><div><small>This month</small><b>₹' + inr(a.t) + '</b><small>' + a.c + ' bills</small></div><div><small>Last month</small><b>₹' + inr(b.t) + '</b><small>' + b.c + ' bills</small></div><div><small>Change</small><b style="color:' + (pct == null ? 'inherit' : pct >= 0 ? '#16a34a' : '#dc2626') + '">' + (pct == null ? '—' : (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '%') + '</b></div></div>' +
      head2('👥 Top customers (this month)') + list(cust, '#3b82f6') + head2('🧑‍💼 Staff-wise sales (this month)') + list(staff, '#8b5cf6') + head2('📦 Top items (this month)') + list(items, '#f59e0b') + head2('⏳ Highest pending dues (all time)') + list(dues, '#ef4444');
    V.modal('tt41Ins', '📊 Business Insights', h, true);
  };

  /* ===== Export (Excel opens CSV) ===== */
  var EXP = {
    orders: ['Orders / Bills', function () { return [['Bill', 'Invoice No', 'Date', 'Customer', 'Phone', 'Status', 'Total', 'Received', 'Due', 'Booked by']].concat(orders().map(function (o) { return [o.id, o.invoiceNo || '', dateOf(o), o.customerName, o.phone, o.status, o.totalAmount, o.recvAmount, o.dueAmount, o.bookedBy]; })); }],
    customers: ['Customers', function () { return [['Name', 'Contact person', 'Phone', 'Email', 'GSTIN', 'Address']].concat((customerDatabase || []).map(function (c) { return [c.name, c.person, c.phone, c.email, c.gst, c.address]; })); }],
    stock: ['Stock', function () { return [['Code', 'Name', 'Category', 'Stock', 'Min stock', 'Rate', 'Dealer price', 'HSN', 'GST %']].concat((sampleInventory || []).map(function (i) { return [i.code, i.name, i.category, i.stock, i.minStock || '', i.rate, i.dealerPrice, i.hsn, i.gstRate == null ? '' : i.gstRate]; })); }],
    leads: ['Leads', function () { return [['Customer', 'Phone', 'Machine', 'Status', 'Remarks']].concat((leadsData || []).map(function (l) { return [l.customerName, l.phone, l.machine, l.status, l.remarks]; })); }],
    payments: ['Payments (every entry)', function () { var rows = [['Bill', 'Customer', 'Date/time', 'Amount', 'Mode', 'By', 'Receipt/Credit note', 'Type']]; orders().forEach(function (o) { (o.payments || []).forEach(function (p) { rows.push([o.id, o.customerName, p.at, p.amount, p.mode, p.by, p.refund ? p.cnNo || '' : p.rno || '', p.refund ? 'Refund' : 'Payment']); }); }); return rows; }]
  };
  window.ttOpenExport = function () {
    V.modal('tt41Ex', '📤 Export to Excel (CSV)', Object.keys(EXP).map(function (k) { return '<div class="tt41-row"><b style="flex:1;">' + EXP[k][0] + '</b><button class="btn btn-outline btn-sm" onclick="ttExportGo(\'' + k + '\')">Download</button></div>'; }).join('') + '<div class="tt41-sub">Opens directly in Excel / Google Sheets.</div>');
  };
  window.ttExportGo = function (k) { var rows = EXP[k][1](); var csv = '\ufeff' + rows.map(function (r) { return r.map(V.csvCell).join(','); }).join('\r\n'); downloadFile(csv, 'TTESPL_' + k + '_' + ttYmd() + '.csv', 'text/csv;charset=utf-8'); };

  /* ===== Backup reminder ===== */
  var BK = 'TTESPL_V41_LASTBK', BKN = 'TTESPL_V41_LASTNAG';
  (function () { var o = window.downloadFullBackup; if (typeof o === 'function') window.downloadFullBackup = function () { try { localStorage.setItem(BK, String(Date.now())); } catch (e) {} return o.apply(this, arguments); }; })();
  setTimeout(function () {
    try {
      if (!F('backupRemind') || !isAdm()) return;
      var last = Number(localStorage.getItem(BK) || 0), nag = Number(localStorage.getItem(BKN) || 0), days = Math.max(1, N(F('backupDays')) || 7), day = 86400000;
      if (Date.now() - last < days * day || Date.now() - nag < day) return;
      localStorage.setItem(BKN, String(Date.now()));
      V.modal('tt41Bk', '💾 Backup reminder', '<div class="tt41-sub">' + (last ? 'Last backup: ' + Math.floor((Date.now() - last) / day) + ' day(s) ago.' : 'No backup was downloaded from this phone yet.') + ' Download one now to keep your data safe.</div><button class="btn btn-primary" style="width:100%;" onclick="downloadFullBackup();document.getElementById(\'tt41Bk\').remove()">⬇ Download backup now</button><button class="btn btn-outline" style="width:100%;margin-top:8px;" onclick="document.getElementById(\'tt41Bk\').remove()">Later</button>');
    } catch (e) {}
  }, 25000);

  /* ===== Add staff (Admin) ===== */
  window.ttOpenAddStaff = function () {
    if (!isAdm()) return alert('Only Admin can add staff.');
    var h = '<input class="tt41-in" id="tt41SfName" placeholder="Full name"><input class="tt41-in" id="tt41SfMob" inputmode="numeric" maxlength="10" placeholder="10-digit mobile"><select class="tt41-in" id="tt41SfRole">' + TT_ROLES.map(function (r) { return '<option>' + H(r) + '</option>'; }).join('') + '</select><input type="password" class="tt41-in" id="tt41SfPass" placeholder="Password (min 6)" autocomplete="new-password"><input type="password" class="tt41-in" id="tt41SfPin" inputmode="numeric" maxlength="6" placeholder="PIN (4 or 6 digits) for password reset" autocomplete="new-password"><button class="btn btn-primary" style="width:100%;margin-top:8px;" onclick="ttAddStaffGo()">Create account</button>';
    V.modal('tt41Sf', '➕ Add staff', h);
  };
  window.ttAddStaffGo = async function () {
    var name = ttCleanText($('tt41SfName').value, 50), mob = $('tt41SfMob').value.replace(/\D/g, ''), role = $('tt41SfRole').value, pass = $('tt41SfPass').value, pin = $('tt41SfPin').value;
    if (!name || mob.length !== 10 || pass.length < 6 || !/^(\d{4}|\d{6})$/.test(pin)) return alert('Please fill: name, 10-digit mobile, password (min 6) and a 4 or 6-digit PIN.');
    if (registeredEmployees.some(function (u) { return u.mobile === mob; })) return alert('An account already exists with this mobile number!');
    registeredEmployees.push({ id: Date.now(), name: name, mobile: mob, role: role, passHash: await ttHashSecret(pass), pinHash: await ttHashSecret(pin) });
    setStored('STAFF', registeredEmployees); try { ttActAdd && ttActAdd('Staff', 'added', name, role); } catch (e) {}
    var m = $('tt41Sf'); if (m) m.remove(); try { openStaffManageModal(); } catch (e) {} alert('Account created for ' + name + '.');
  };
  function injectStaffBtn() {
    var box = $('staffManageList'); if (!box || !box.parentNode || $('tt41AddStaffBtn')) return;
    var b = document.createElement('button'); b.id = 'tt41AddStaffBtn'; b.className = 'btn btn-primary btn-sm'; b.style.cssText = 'width:100%;margin-bottom:10px;'; b.textContent = '➕ Add staff'; b.onclick = ttOpenAddStaff;
    box.parentNode.insertBefore(b, box);
  }
  (function () { var o = window.openStaffManageModal; if (typeof o === 'function') window.openStaffManageModal = function () { var r = o.apply(this, arguments); try { injectStaffBtn(); } catch (e) {} return r; }; })();

  /* ===== Pages for long lists ===== */
  var IDS = ['stockListContainer', 'billingListContainer', 'ordersListContainer'], applying = false, obs = null;
  function pgApply(c) {
    if (applying || !c) return; applying = true;
    try {
      var N0 = Math.max(10, N(F('pageSize')) || 50), old = c.querySelector(':scope > .tt41-more'); if (old) old.remove();
      var kids = [].filter.call(c.children, function (k) { return !k.classList.contains('tt41-more'); });
      if (!F('pageLists') || kids.length <= N0) { kids.forEach(function (k) { k.classList.remove('tt41-hide'); }); }
      else {
        if (c.__first !== kids[0]) { c.__first = kids[0]; c.__shown = N0; }
        var shown = c.__shown || N0;
        kids.forEach(function (k, i) { k.classList.toggle('tt41-hide', i >= shown); });
        if (shown < kids.length) {
          var b = document.createElement('button'); b.className = 'btn btn-outline tt41-more'; b.style.cssText = 'width:100%;margin:8px 0;'; b.textContent = 'Show more (' + (kids.length - shown) + ' left)';
          b.onclick = function () { c.__shown = shown + N0; pgApply(c); }; c.appendChild(b);
        }
      }
    } finally { applying = false; if (obs) obs.takeRecords(); }
  }
  window.ttPgRefresh = function () { IDS.forEach(function (id) { var c = $(id); if (c) { c.__first = null; pgApply(c); } }); };
  function pgInit() {
    if (obs) return; var any = false;
    obs = new MutationObserver(function (recs) { if (applying) return; var seen = {}; recs.forEach(function (r) { if (r.target && r.target.id && !seen[r.target.id]) { seen[r.target.id] = 1; pgApply(r.target); } }); });
    IDS.forEach(function (id) { var c = $(id); if (c) { any = true; obs.observe(c, { childList: true }); pgApply(c); } });
    if (!any) obs = null;
  }
  document.addEventListener('DOMContentLoaded', function () { setTimeout(pgInit, 800); setTimeout(pgInit, 3000); });
  if (document.readyState !== 'loading') setTimeout(pgInit, 800);

  /* ===== profile menu: Business Insights / Receipts shortcuts ===== */
  function menuItem(icon, label, tag, fn) { var d = document.createElement('div'); d.className = 'profile-menu-item tt41-mi'; d.setAttribute('onclick', 'triggerAppHaptic(); ' + fn + '; closeProfileDrawer();'); d.innerHTML = '<div class="profile-menu-item-left"><span>' + icon + '</span><span>' + label + '</span></div><span style="font-size:10px;color:#38bdf8;">' + tag + '</span>'; return d; }
  function injectMenu() {
    var list = document.querySelector('#profileDropdownCard .profile-menu-list'); if (!list) return;
    [].forEach.call(list.querySelectorAll('.tt41-mi'), function (e) { e.remove(); });
    var anchor = list.querySelector('.tt25-mi') ? list.querySelector('.tt25-mi').nextSibling : list.firstElementChild;
    var items = [];
    if (F('insights')) items.push(menuItem('📊', 'Business Insights', 'Month · Top', 'ttOpenInsights()'));
    items.push(menuItem('🧾', 'Receipts & Refunds', 'Print', 'ttOpenReceipts()'));
    if (isAdm() && F('recycleBin')) items.push(menuItem('🗑️', 'Recycle bin', 'Admin', 'ttOpenRecycle()'));
    items.forEach(function (it) { list.insertBefore(it, anchor); });
  }
  setTimeout(injectMenu, 1500); setInterval(function () { var l = document.querySelector('#profileDropdownCard .profile-menu-list'); if (l && !l.querySelector('.tt41-mi')) injectMenu(); }, 4000);
  function esc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
})();
