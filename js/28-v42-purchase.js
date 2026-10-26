/* TTESPL ERP v42.1 - PURCHASE BILL ENTRY
   Enter a supplier's tax invoice (like Manmachine Works 26-27/818) -> stock of every item goes UP when you press Save.
   Items already in stock are matched by name / code; items that are not in stock are created as new stock items.
   Cost (dealer) price of each item is updated from the bill (switch on the form). Admin can delete a bill and the stock goes back.
   Reached from: Stock tab (Purchase Bill button) and Profile menu. Saved in its own cloud collection "purchase_bills". */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var H = X.H, KEY = 'PURCHASE_BILLS', ID = 'ttPB', LID = 'ttPBL', DID = 'ttPBD';
  function $(i) { return document.getElementById(i); }
  function N(x) { var v = parseFloat(x); return isNaN(v) ? 0 : v; }
  function R2(x) { return Math.round((N(x) + Number.EPSILON) * 100) / 100; }
  function R3(x) { return Math.round((N(x) + Number.EPSILON) * 1000) / 1000; }
  function inr(n) { return '₹' + N(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function inv() { return (typeof sampleInventory !== 'undefined' && sampleInventory) || []; }
  function bills() { return X.list(KEY); }
  function today() { return X.ymd(); }
  var busy = false, photo = '', CACHE = null;

  /* ---------- stock helpers ---------- */
  function findProduct(txt) {
    var q = norm(txt); if (!q) return null; var a = inv(), i;
    for (i = 0; i < a.length; i++) if (norm(a[i].name) === q) return a[i];
    for (i = 0; i < a.length; i++) if (a[i].code && norm(a[i].code) === q) return a[i];
    return null;
  }
  function suppliers() {
    var m = {}; bills().forEach(function (b) { if (b && b.supplier) m[b.supplier] = b.gstin || ''; });
    try { X.list('SUPPLIERS').forEach(function (s) { var n = s && (s.name || s.company); if (n && !(n in m)) m[n] = s.gstin || s.gst || ''; }); } catch (e) {}
    return m;
  }
  function listsHtml() {
    var sup = suppliers(), cats = {}, h = '';
    inv().forEach(function (p) { if (p.category) cats[p.category] = 1; });
    h += '<datalist id="pbSup">' + Object.keys(sup).map(function (n) { return '<option value="' + H(n) + '">'; }).join('') + '</datalist>';
    h += '<datalist id="pbCat">' + Object.keys(cats).map(function (n) { return '<option value="' + H(n) + '">'; }).join('') + '</datalist>';
    h += '<datalist id="pbProd">' + inv().map(function (p) { return '<option value="' + H(p.name) + '">' + H(p.code || '') + '</option>'; }).join('') + '</datalist>';
    return h;
  }

  /* ---------- entry form ---------- */
  function rowHtml() {
    return '<div class="pb-row"><div class="pb-top"><input class="pb-name" list="pbProd" placeholder="Product name or code" autocomplete="off"><button type="button" class="pb-x" data-a="rm" aria-label="Remove">✕</button></div>' +
      '<div class="pb-st"></div>' +
      '<div class="pb-g"><label><span>Qty</span><input class="pb-qty" type="number" inputmode="decimal" step="any" min="0" placeholder="0"></label>' +
      '<label><span>Rate (ex-GST)</span><input class="pb-rate" type="number" inputmode="decimal" step="any" min="0" placeholder="0.00"></label>' +
      '<label><span>Disc %</span><input class="pb-disc" type="number" inputmode="decimal" step="any" min="0" max="100" placeholder="0"></label>' +
      '<label><span>GST %</span><input class="pb-gst" type="number" inputmode="decimal" step="any" min="0" max="40" value="18"></label></div>' +
      '<div class="pb-new" style="display:none"><label><span>Category (new item)</span><input class="pb-cat" list="pbCat" placeholder="e.g. Machines &amp; Equipment"></label>' +
      '<label><span>HSN</span><input class="pb-hsn" placeholder="HSN / SAC"></label>' +
      '<label><span>Sell price incl. GST (optional)</span><input class="pb-sell" type="number" inputmode="decimal" step="any" min="0" placeholder="0"></label></div>' +
      '<div class="pb-amt">Amount <b>₹0.00</b></div></div>';
  }
  function formHtml() {
    return listsHtml() +
      '<div class="ttx-btns" style="margin-top:0"><button class="ttx-b" data-a="past">📋 Past purchase bills</button></div>' +
      '<div class="ttx-two">' + X.field('Supplier name *', '<input id="pbSupplier" list="pbSup" autocomplete="off" placeholder="e.g. Manmachine Works Pvt. Ltd.">') +
      X.field('Supplier GSTIN', '<input id="pbGstin" maxlength="15" style="text-transform:uppercase" placeholder="09AAACM4906A1ZX">') + '</div>' +
      '<div class="ttx-two">' + X.field('Supplier bill no. *', '<input id="pbNo" maxlength="40" placeholder="26-27/818">') +
      X.field('Bill date', '<input id="pbDate" type="date" value="' + today() + '" max="' + today() + '">') + '</div>' +
      X.field('Tax type', '<select id="pbTax"><option value="AUTO">Auto (from supplier GSTIN)</option><option value="INTER">IGST (other state)</option><option value="INTRA">CGST + SGST (same state)</option></select>') +
      '<div class="ttx-sec" style="margin:12px 0 4px"><b>Items on the bill</b></div><div id="pbItems">' + rowHtml() + '</div>' +
      '<div class="ttx-btns"><button class="ttx-b" data-a="add">＋ Add item</button></div>' +
      '<div class="pb-tot" id="pbTot"></div>' +
      '<div class="ttx-two">' + X.field('Paid now (₹)', '<input id="pbPaid" type="number" inputmode="decimal" step="any" min="0" placeholder="0">') +
      X.field('Payment mode', '<select id="pbMode"><option>Bank / NEFT</option><option>UPI</option><option>Cash</option><option>Cheque</option></select>') + '</div>' +
      '<label class="pb-chk"><input type="checkbox" id="pbCost" checked> Update cost (dealer) price of these items from this bill</label>' +
      '<div class="ttx-f"><span>Photo of the bill (optional)</span><input id="pbPhoto" type="file" accept="image/*"><img id="pbPrev" alt="" style="display:none;max-width:100%;border-radius:10px;margin-top:6px"></div>' +
      '<div class="ttx-btns"><button class="ttx-b pri" data-a="save" id="pbSave" style="flex:1">💾 Save bill &amp; add to stock</button></div>' +
      '<div class="ttx-note" style="font-size:11.5px;opacity:.8">Stock of every matched item goes up by the quantity above. Items not in stock are created automatically. An Admin can delete a bill later and the stock goes back.</div>';
  }
  function readRows() {
    var out = [];
    document.querySelectorAll('#pbItems .pb-row').forEach(function (r) {
      var q = function (c) { return (r.querySelector(c) || {}).value || ''; };
      var name = q('.pb-name').trim(); if (!name) return;
      out.push({ el: r, name: name, qty: N(q('.pb-qty')), rate: N(q('.pb-rate')), disc: Math.min(100, N(q('.pb-disc'))), gst: Math.min(40, Math.max(0, q('.pb-gst') === '' ? 18 : N(q('.pb-gst')))), cat: q('.pb-cat').trim(), hsn: q('.pb-hsn').trim(), sell: N(q('.pb-sell')) });
    });
    return out;
  }
  function isInter() {
    var t = ($('pbTax') || {}).value, g = String(($('pbGstin') || {}).value || '').trim();
    if (t === 'INTER') return true; if (t === 'INTRA') return false;
    var co = (window.companyDetailsData && (companyDetailsData.gst || companyDetailsData.gstin)) || '21AAICT6014E1ZT';
    return g.length >= 2 ? g.slice(0, 2) !== String(co).slice(0, 2) : true;
  }
  function calc() {
    var rows = readRows(), tv = 0, tx = 0, byRate = {};
    rows.forEach(function (x) {
      x.taxable = R2(x.qty * x.rate * (1 - x.disc / 100)); x.tax = R2(x.taxable * x.gst / 100); x.total = R2(x.taxable + x.tax);
      tv += x.taxable; tx += x.tax; byRate[x.gst] = (byRate[x.gst] || 0) + x.tax;
    });
    var gross = R2(tv + tx), total = Math.round(gross), ro = R2(total - gross);
    return { rows: rows, taxable: R2(tv), tax: R2(tx), round: ro, total: total, byRate: byRate };
  }
  function refresh() {
    var c = calc(), inter = isInter(), box = $('pbTot'); if (!box) return c;
    c.rows.forEach(function (x) {
      var p = findProduct(x.name), st = x.el.querySelector('.pb-st'), nw = x.el.querySelector('.pb-new');
      if (st) st.innerHTML = x.qty > 0 || x.name ? (p ? '<span class="pb-ok">✔ In stock list: ' + H(p.name) + ' · stock ' + R3(p.stock) + (x.qty > 0 ? ' → <b>' + R3(N(p.stock) + x.qty) + '</b>' : '') + '</span>' : '<span class="pb-newtag">🆕 Not in stock list – will be added as a new item</span>') : '';
      if (nw) nw.style.display = p ? 'none' : '';
      var a = x.el.querySelector('.pb-amt b'); if (a) a.textContent = inr(x.total);
      x.el.dataset.pid = p ? p.id : '';
    });
    var taxLines = Object.keys(c.byRate).sort(function (a, b) { return a - b; }).map(function (g) { var t = R2(c.byRate[g]); return inter ? '<div><span>IGST ' + g + '%</span><b>' + inr(t) + '</b></div>' : '<div><span>CGST ' + (g / 2) + '%</span><b>' + inr(t / 2) + '</b></div><div><span>SGST ' + (g / 2) + '%</span><b>' + inr(t / 2) + '</b></div>'; }).join('');
    box.innerHTML = '<div><span>Taxable value</span><b>' + inr(c.taxable) + '</b></div>' + taxLines + (c.round ? '<div><span>Round off</span><b>' + inr(c.round) + '</b></div>' : '') + '<div class="t"><span>Bill total</span><b>' + inr(c.total) + '</b></div>';
    var paid = N(($('pbPaid') || {}).value); if (paid > 0) box.innerHTML += '<div><span>Due to supplier</span><b>' + inr(Math.max(0, c.total - paid)) + '</b></div>';
    return c;
  }
  function openForm() {
    photo = '';
    var o = X.sheet(ID, '🧾 Purchase Bill Entry', formHtml(), { z: 3700 });
    X.bind(ID, { click: {
      add: function () { $('pbItems').insertAdjacentHTML('beforeend', rowHtml()); var r = document.querySelectorAll('#pbItems .pb-name'); r[r.length - 1].focus(); },
      rm: function (p, b) { var rs = document.querySelectorAll('#pbItems .pb-row'); if (rs.length <= 1) { rs[0].querySelectorAll('input').forEach(function (i) { i.value = i.classList.contains('pb-gst') ? '18' : ''; }); } else b.closest('.pb-row').remove(); refresh(); },
      save: save, past: function () { X.close(ID); openList(); }
    } });
    if (!o.__pb) {
      o.__pb = 1;
      o.addEventListener('input', function (e) {
        var t = e.target; if (t.classList.contains('pb-name')) { var p = findProduct(t.value), r = t.closest('.pb-row'); if (p && r) { var g = r.querySelector('.pb-gst'); if (g && !g.dataset.t) g.value = p.gstRate != null && p.gstRate !== '' ? p.gstRate : 18; var h = r.querySelector('.pb-hsn'); if (h && !h.value) h.value = p.hsn || ''; } }
        if (t.classList.contains('pb-gst')) t.dataset.t = '1';
        if (t.id === 'pbSupplier') { var m = suppliers()[t.value]; if (m && !$('pbGstin').value) $('pbGstin').value = m; }
        refresh();
      });
      o.addEventListener('change', function (e) {
        if (e.target.id === 'pbTax') refresh();
        if (e.target.id === 'pbPhoto') {
          var f = e.target.files && e.target.files[0]; if (!f) return; var fr = new FileReader();
          fr.onload = function () { var go = function (d) { photo = d; var im = $('pbPrev'); im.src = d; im.style.display = 'block'; }; try { ttCompressImageSafe(fr.result, 900, .6, 260000).then(go); } catch (x) { go(fr.result); } };
          fr.readAsDataURL(f);
        }
      });
    }
    refresh();
  }

  /* ---------- save: bill + stock ---------- */
  function addAudit(p, note) { p.stockAudit = p.stockAudit || []; p.stockAudit.unshift({ by: X.me(), time: (typeof getNowStr === 'function' ? getNowStr() : new Date().toLocaleString()), note: note }); if (p.stockAudit.length > 60) p.stockAudit.length = 60; }
  function save() {
    if (busy) return;
    var supplier = ($('pbSupplier').value || '').trim(), no = ($('pbNo').value || '').trim(), c = refresh(), items = c.rows.filter(function (x) { return x.qty > 0; });
    if (!supplier) return X.toast('Enter the supplier name', 1);
    if (!no) return X.toast('Enter the supplier bill number', 1);
    if (!items.length) return X.toast('Add at least one item with a quantity', 1);
    var bad = items.filter(function (x) { return !(x.rate > 0); });
    if (bad.length && !confirm('Rate is 0 for: ' + bad.map(function (x) { return x.name; }).join(', ') + '\n\nSave anyway?')) return;
    var dup = bills().filter(function (b) { return b && norm(b.supplier) === norm(supplier) && norm(b.billNo) === norm(no); })[0];
    if (dup && !confirm('Bill ' + no + ' from ' + supplier + ' is already entered (' + dup.id + ').\n\nEntering it again will add the stock a second time. Save anyway?')) return;
    busy = true; $('pbSave').disabled = true;
    try {
      var upd = $('pbCost').checked, id = 'PB-' + Date.now().toString(36).toUpperCase(), nextId = Date.now(), made = 0, upN = 0, lines = [];
      items.forEach(function (x, i) {
        var p = findProduct(x.name), created = false, unit = R2(x.rate * (1 - x.disc / 100)), cost = R2(unit * (1 + x.gst / 100));
        if (!p) {
          p = { id: nextId + i, name: x.name, code: 'PUR-' + (nextId + i).toString(36).toUpperCase(), category: x.cat || 'Machines & Equipment', stock: 0, dealerPrice: cost, rate: R2(x.sell), machine: '', hsn: x.hsn || '84249000', gstRate: x.gst };
          inv().unshift(p); created = true; made++;
        }
        var before = R3(p.stock); p.stock = R3(N(p.stock) + x.qty);
        if (!p.hsn && x.hsn) p.hsn = x.hsn;
        if (p.gstRate == null || p.gstRate === '') p.gstRate = x.gst;
        var oldCost = N(p.dealerPrice);
        if (upd && cost > 0 && !created) { p.dealerPrice = cost; upN++; }
        addAudit(p, '+' + x.qty + ' purchased · bill ' + no + ' · ' + supplier + (upd && cost > 0 && !created && oldCost !== cost ? ' · cost ' + oldCost + ' → ' + cost : ''));
        lines.push({ pid: p.id, name: p.name, billName: x.name, qty: x.qty, rate: x.rate, disc: x.disc, gst: x.gst, hsn: x.hsn || p.hsn || '', taxable: x.taxable, tax: x.tax, total: x.total, created: created, stockBefore: before, stockAfter: p.stock });
      });
      var paid = Math.min(c.total, Math.max(0, N(($('pbPaid') || {}).value))), now = new Date().toISOString();
      var bill = { id: id, supplier: supplier, gstin: ($('pbGstin').value || '').trim().toUpperCase(), billNo: no, billDate: $('pbDate').value || today(), taxType: isInter() ? 'IGST' : 'CGST+SGST', items: lines, taxable: c.taxable, tax: c.tax, round: c.round, total: c.total, paid: R2(paid), due: R2(c.total - paid), payments: paid > 0 ? [{ amount: R2(paid), mode: ($('pbMode') || {}).value || 'Cash', date: $('pbDate').value || today(), by: X.me(), at: now }] : [], costUpdated: !!upd, photo: photo || '', by: X.me(), at: now };
      X.save(KEY, [bill].concat(bills().filter(function (b) { return b && b.id !== id; })));
      setStored('INVENTORY', sampleInventory);
      try { renderStockList(); } catch (e) {} try { renderDashboard(); } catch (e) {}
      try { window.ttActAdd && ttActAdd('Stock', 'purchase', id, items.length + ' item(s) added from ' + supplier + ' bill ' + no); } catch (e) {}
      X.close(ID);
      X.toast('Saved · stock updated for ' + items.length + ' item(s)' + (made ? ' · ' + made + ' new item(s) created' : ''));
      showDetail(id);
    } catch (e) { console.error(e); X.toast('Could not save: ' + e.message, 1); }
    busy = false; var sb = $('pbSave'); if (sb) sb.disabled = false;
  }

  /* ---------- past bills ---------- */
  function openList() {
    var all = bills().slice().sort(function (a, b) { return String(b.billDate || '').localeCompare(String(a.billDate || '')) || String(b.at || '').localeCompare(String(a.at || '')); });
    var mon = today().slice(0, 7), mTot = 0, due = 0; all.forEach(function (b) { if (String(b.billDate || '').slice(0, 7) === mon) mTot += N(b.total); due += N(b.due); });
    var h = '<div class="ttx-btns" style="margin-top:0"><button class="ttx-b pri" data-a="new">＋ New purchase bill</button></div>' +
      '<div class="pb-kpi"><div><small>This month</small><b>' + inr(mTot) + '</b></div><div><small>Bills</small><b>' + all.length + '</b></div><div><small>Due to suppliers</small><b style="color:#dc2626">' + inr(due) + '</b></div></div>' +
      (all.length ? all.slice(0, 150).map(function (b) { return '<div class="pb-li" data-a="open" data-p="' + H(b.id) + '"><div style="flex:1;min-width:0"><b>' + H(b.supplier) + '</b><small>' + H(b.billNo) + ' · ' + H(X.fmtD(b.billDate)) + ' · ' + (b.items || []).length + ' item(s)</small></div><div style="text-align:right"><b>' + inr(b.total) + '</b>' + (N(b.due) > 0 ? '<small style="color:#dc2626">due ' + inr(b.due) + '</small>' : '<small style="color:#16a34a">paid</small>') + '</div></div>'; }).join('') : X.empty('🧾', 'No purchase bills yet'));
    X.sheet(LID, '📋 Purchase Bills', h, { z: 3650 });
    X.bind(LID, { click: { 'new': function () { X.close(LID); openForm(); }, open: function (p) { showDetail(p); } } });
  }
  function showDetail(id) {
    var b = X.byId(KEY, id); if (!b) return;
    var h = '<div class="pb-kpi"><div><small>Total</small><b>' + inr(b.total) + '</b></div><div><small>Paid</small><b style="color:#16a34a">' + inr(b.paid) + '</b></div><div><small>Due</small><b style="color:' + (N(b.due) > 0 ? '#dc2626' : 'inherit') + '">' + inr(b.due) + '</b></div></div>' +
      '<div class="ttx-note"><b>' + H(b.supplier) + '</b>' + (b.gstin ? ' · ' + H(b.gstin) : '') + '<br>Bill ' + H(b.billNo) + ' · ' + H(X.fmtD(b.billDate)) + ' · ' + H(b.taxType) + '<br><small>Entered by ' + H(b.by || '') + ' · ' + H(X.fmtDT(b.at)) + '</small></div>' +
      '<div class="ttx-sec"><b>Items &amp; stock</b></div>' + (b.items || []).map(function (it) { return '<div class="pb-li"><div style="flex:1;min-width:0"><b>' + H(it.name) + (it.created ? ' <span class="pb-newtag">new</span>' : '') + '</b><small>' + it.qty + ' × ' + inr(it.rate) + (it.disc ? ' −' + it.disc + '%' : '') + ' + ' + it.gst + '% GST · stock ' + R3(it.stockBefore) + ' → ' + R3(it.stockAfter) + '</small></div><b>' + inr(it.total) + '</b></div>'; }).join('') +
      ((b.payments || []).length ? '<div class="ttx-sec"><b>Payments to supplier</b></div>' + b.payments.map(function (p) { return '<div class="pb-li"><div style="flex:1"><b>' + inr(p.amount) + '</b><small>' + H(p.mode || '') + ' · ' + H(X.fmtD(p.date)) + ' · ' + H(p.by || '') + '</small></div></div>'; }).join('') : '') +
      (N(b.due) > 0 ? '<div class="ttx-sec"><b>Record a payment</b></div><div class="ttx-two"><input id="pbPayAmt" type="number" inputmode="decimal" step="any" min="0" placeholder="Amount (max ' + b.due + ')"><select id="pbPayMode"><option>Bank / NEFT</option><option>UPI</option><option>Cash</option><option>Cheque</option></select></div><div class="ttx-btns"><button class="ttx-b pri" data-a="pay" data-p="' + H(b.id) + '">Save payment</button></div>' : '') +
      (b.photo ? '<div class="ttx-sec"><b>Bill photo</b></div><img src="' + H(b.photo) + '" alt="Bill photo" style="max-width:100%;border-radius:10px">' : '') +
      '<div class="ttx-btns"><button class="ttx-b" data-a="list">📋 All bills</button>' + (X.isAdm() ? '<button class="ttx-b dng" data-a="del" data-p="' + H(b.id) + '">🗑 Delete &amp; take stock back</button>' : '') + '</div>';
    X.sheet(DID, '🧾 ' + b.billNo, h, { z: 3750 });
    X.bind(DID, { click: {
      list: function () { X.close(DID); openList(); },
      pay: function (pid) {
        var bb = X.byId(KEY, pid); if (!bb) return; var a = R2(($('pbPayAmt') || {}).value); if (!(a > 0)) return X.toast('Enter an amount', 1); if (a > N(bb.due) + 0.005) return X.toast('Amount is more than the due', 1);
        var n = JSON.parse(JSON.stringify(bb)); n.payments = (n.payments || []).concat([{ amount: a, mode: ($('pbPayMode') || {}).value, date: today(), by: X.me(), at: new Date().toISOString() }]); n.paid = R2(N(n.paid) + a); n.due = R2(Math.max(0, N(n.total) - n.paid));
        X.save(KEY, bills().map(function (x) { return x.id === n.id ? n : x; })); X.toast('Payment saved'); showDetail(n.id);
      },
      del: function (pid) {
        if (!X.isAdm()) return X.toast('Only Admin can delete', 1);
        var bb = X.byId(KEY, pid); if (!bb) return;
        if (!confirm('Delete bill ' + bb.billNo + ' (' + bb.supplier + ')?\n\nStock of its ' + (bb.items || []).length + ' item(s) will go back down by the purchased quantity.')) return;
        (bb.items || []).forEach(function (it) { var p = inv().filter(function (x) { return String(x.id) === String(it.pid); })[0]; if (p) { p.stock = R3(N(p.stock) - N(it.qty)); addAudit(p, '−' + it.qty + ' purchase bill ' + bb.billNo + ' deleted'); } });
        var before = bills().slice(), after = before.filter(function (x) { return x.id !== pid; });
        X.save(KEY, after); setStored('INVENTORY', sampleInventory);
        try { window.ttV41 && ttV41.afterDelete && ttV41.afterDelete(KEY, before, after); } catch (e) {}
        try { renderStockList(); } catch (e) {} try { window.ttActAdd && ttActAdd('Stock', 'purchase deleted', pid, 'Stock taken back for bill ' + bb.billNo); } catch (e) {}
        X.close(DID); X.toast('Bill deleted · stock taken back'); openList();
      }
    } });
  }

  window.ttOpenPurchaseBill = function () { openForm(); };
  window.ttOpenPurchaseList = function () { openList(); };

  /* ---------- entry points: Stock tab button + Profile menu item ---------- */
  function inject() {
    try {
      var bar = document.querySelector('#view-inventory .page-top-header-banner > div:last-child');
      if (bar && !bar.querySelector('.tt42-pb')) {
        bar.style.flexWrap = 'wrap'; bar.style.justifyContent = 'flex-end';
        var b = document.createElement('button'); b.className = 'btn btn-outline btn-sm tt42-pb'; b.textContent = '🧾 Purchase Bill';
        b.setAttribute('onclick', 'triggerAppHaptic(); ttOpenPurchaseBill()'); bar.insertBefore(b, bar.firstChild);
      }
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt42-mi')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt42-mi'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenPurchaseBill(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>🧾</span><span>Purchase Bill</span></div><span style="font-size:10px;color:#38bdf8;">Adds stock</span>';
        list.appendChild(d);
      }
    } catch (e) { console.warn('purchase inject', e); }
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);
})();
