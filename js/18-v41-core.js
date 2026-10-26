/* TTESPL ERP v41 - CORE UPGRADE MODULE
   Fixes + safety layer. Everything is a switch in Settings (profile menu > Settings). The wrappers call the original
   functions, so with a switch OFF the app behaves as before. Settings are saved on THIS phone. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return (window.ttEscHtml || function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); })(s); };
  var DEFAULTS = {
    verifySession: 1, idleLogout: 0, idleMinutes: 30, openRegister: 1, blockAdminRace: 1, friendlyAlerts: 1,
    secureMode: 0, secureUrl: '',
    blockOverpay: 1, freshWrite: 1, receipts: 1,
    stockWarn: 1, singleDeliver: 1, restoreOnCancel: 1,
    seqInvoice: 0, invPrefix: 'TTE', invStart: 1, gstRowTax: 1, billSeries: 1, billPrefixB2B: 'TTESPL-', billPrefixB2C: 'TT-', billStartB2B: 101, billStartB2C: 101, gstPerItem: 0, courierTaxable: 0, autoInter: 1, bankFromCompany: 1,
    recycleBin: 1, cloudDelete: 1, backupRemind: 1, backupDays: 7,
    offlineApp: 1, photoStorage: 0, pageLists: 1, pageSize: 50, insights: 1
  };
  var FEAT = window.ttFeat;
  function F(k) { var v = FEAT ? FEAT.get(k) : undefined; return v === undefined ? DEFAULTS[k] : v; }
  window.ttV41 = { F: F, DEFAULTS: DEFAULTS };
  if (FEAT) Object.keys(DEFAULTS).forEach(function (k) { if (FEAT.get(k) === undefined) FEAT.set(k, DEFAULTS[k]); });
  function isAdm() { return typeof isAdminUser === 'function' && isAdminUser(); }
  function toast(m, bad) { try { if (bad && window.ttShowErrorToast) return ttShowErrorToast(m); if (window.ttShowSuccessToast) return ttShowSuccessToast(m); } catch (e) {} try { alert(m); } catch (e) {} }
  function online() { return navigator.onLine !== false; }
  function me() { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : ''; }
  function cloud() { return window.cloudSync; }
  function lite(o) {   // copy without big photos (for the recycle bin)
    try { return JSON.parse(JSON.stringify(o, function (k, v) { return (typeof v === 'string' && v.length > 50000 && v.indexOf('data:') === 0) ? '' : v; })); } catch (e) { return o; }
  }
  window.ttV41.lite = lite;

  /* ================= SETTINGS (new categories) ================= */
  function row(title, sub, ctl) { return '<div class="tt25-row"><div class="tt25-rt"><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + ctl + '</div>'; }
  function numRow(k, title, sub, ph) { return row(title, sub, '<input class="tt25-num" type="number" min="0" inputmode="numeric" placeholder="' + (ph || '0') + '" value="' + (F(k) || '') + '" onchange="ttSetOpt(\'' + k + '\',Number(this.value)||0)">'); }
  function txtRow(k, title, sub, ph) { return row(title, sub, '<input class="tt25-num" style="width:150px;text-align:left;" type="text" placeholder="' + H(ph || '') + '" value="' + H(F(k) || '') + '" onchange="ttSetOpt(\'' + k + '\',this.value.trim())">'); }
  function actRow(title, sub, fn, label) { return row(title, sub, '<button class="btn btn-outline btn-sm" onclick="' + fn + '">' + label + '</button>'); }
  /* colourful iOS-style icons + subtitles for the new Settings categories (read by renderer in js/07) */
  window.ttGroupStyles = Object.assign(window.ttGroupStyles || {}, {
    'Safety & Login': ['🛡️', '#ff453a', '#d62d20'], 'Payments & Receipts': ['💳', '#34c759', '#1f9d45'], 'Stock Control': ['📦', '#ff9f0a', '#e07c00'],
    'Invoice & GST': ['🧾', '#0a84ff', '#0063d1'], 'Data Safety & Export': ['🗂️', '#5e5ce6', '#4340c4'], 'Speed & Offline': ['⚡', '#ffb800', '#e08a00'],
    'Look & Speed': ['🎨', '#bf5af2', '#8e44d6'], 'Insights': ['📊', '#30b0c7', '#1b8da3']
  });
  window.ttGroupSubs = Object.assign(window.ttGroupSubs || {}, {
    'Safety & Login': 'Auto-logout, sign-up, secure mode', 'Payments & Receipts': 'Over-payment, receipts, refunds', 'Stock Control': 'Stock warnings, stock in / adjust',
    'Invoice & GST': 'Invoice number, GST rate, bank details', 'Data Safety & Export': 'Recycle bin, Excel export, backup', 'Speed & Offline': 'Offline app, photos, long lists',
    'Look & Speed': 'Compact cards, smooth mode, auto row', 'Insights': 'Month compare, top customers, profit'
  });
  var prevSet = window.ttModSettings;
  window.ttModSettings = function (sw, group) {
    var r; try { r = prevSet ? prevSet(sw, group) : ''; } catch (e) { console.warn(e); }
    var adm = isAdm();
    var sec = [sw('verifySession', 'Re-check my login with the staff list', 'If your account is removed or your role changed, the app updates / logs you out'),
      sw('idleLogout', 'Auto-logout when idle', 'Locks the app after no touch for the minutes below'), numRow('idleMinutes', 'Idle minutes', 'Used when auto-logout is ON', '30'),
      sw('friendlyAlerts', 'Friendly pop-ups', 'Show messages as app pop-ups instead of the browser alert box')];
    if (adm) sec.push(sw('openRegister', 'Allow staff to register themselves', 'OFF = only Admin adds staff (Staff Manager > Add staff)'),
      sw('blockAdminRace', 'Protect first-Admin sign-up', 'No Admin sign-up until the app is connected to the cloud'),
      sw('secureMode', 'Secure mode (Firebase sign-in)', 'Real protection: login is checked on your server. Deploy functions/ first. Read README, then press Test below'),
      txtRow('secureUrl', 'Secure login server URL', 'The https URL of the "api" Cloud Function', 'https://…cloudfunctions.net/api'),
      actRow('Test / switch on secure mode', 'Checks the server and your login before it is switched on', 'ttSecureTest()', 'Test'));
    group('🛡️ Safety & Login (on / off)', sec);
    var pay = [sw('blockOverpay', 'Block over-payment', 'A payment bigger than the due amount is refused (money was lost silently before)'),
      sw('freshWrite', 'Check the latest copy before saving a payment / delivery', 'Stops two phones overwriting each other (needs internet, else works as before)'),
      sw('receipts', 'Receipt number for every payment', 'RCPT/26-27/0001 style, shared by all phones'),
      actRow('Receipts & refunds', 'Print a receipt, record a refund / credit note', 'ttOpenReceipts()', 'Open'),
      actRow('Customer statement', 'All bills, payments and balance of one customer', 'ttOpenStatement()', 'Open')];
    group('💳 Payments & Receipts (on / off)', pay);
    var stk = [sw('stockWarn', 'Warn when order quantity is more than stock', 'Asks before saving the order'),
      sw('singleDeliver', 'Stop double delivery', 'An order already delivered cannot cut the stock a second time'),
      sw('restoreOnCancel', 'Put stock back on cancel / delete of a delivered bill', 'Asks first'),
      actRow('Stock in / adjust', 'Add received goods or correct stock, with a reason (logged)', 'ttOpenStockAdjust()', 'Open')];
    group('📦 Stock Control (on / off)', stk);
    var inv = [sw('billSeries', 'Automatic bill number on delivery', 'GST customer: TTESPL-101, 102…   Non-GST customer: TT-101, 102…  (never repeats, shared by all phones)'),
      actRow('Bill number status', 'Shows pending numbers, the next number and any problem; Retry button', 'ttBillStatus()', 'Open'),
      txtRow('billPrefixB2B', 'GST bill (B2B) prefix', '', 'TTESPL-'), numRow('billStartB2B', 'GST bills start at', 'First number (used only before the first bill)', '101'),
      txtRow('billPrefixB2C', 'Non-GST bill (B2C) prefix', '', 'TT-'), numRow('billStartB2C', 'Non-GST bills start at', 'First number (used only before the first bill)', '101'),
      sw('gstRowTax', 'GST % for every item in an order', 'A GST % box on each item + a tax table in the new order. Starts at 18% for all; change it when an item has a different rate (cloth 5%, etc.). OFF = 18% for everything'),
      sw('courierTaxable', 'Courier / transport charge is taxable (18%)', 'Counts inside taxable value on invoice and GST report. Ask your CA before using'),
      sw('autoInter', 'Auto IGST / CGST+SGST from GSTIN', 'Picks Inter-State when the customer GSTIN state differs from yours (you can still change it)'),
      sw('bankFromCompany', 'Bank details on invoice from Company Details', 'OFF = old fixed text')];
    group('🧾 Invoice & GST (on / off)', inv);
    var dat = [sw('recycleBin', 'Recycle bin', 'Deleted bills, leads, services, staff go to the bin (Admin can restore)'),
      sw('cloudDelete', 'Deleting really deletes in the cloud', 'OFF = old behaviour (deleted records could come back)'),
      actRow('Recycle bin', 'Restore deleted records', 'ttOpenRecycle()', 'Open'),
      actRow('Export to Excel (CSV)', 'Orders, customers, stock, leads', 'ttOpenExport()', 'Export'),
      sw('backupRemind', 'Backup reminder (Admin)', 'Reminds you to download a backup'), numRow('backupDays', 'Remind every (days)', '', '7')];
    group('🗂️ Data Safety & Export (on / off)', dat);
    var spd = [sw('offlineApp', 'Offline app (works without internet)', 'Keeps the app files on the phone. Needs https. Updates still load first when online'),
      sw('photoStorage', 'Keep photos in Cloud Storage', 'Delivery / payment photos go to Firebase Storage (needs Storage + storage.rules). OFF = inside the bill'),
      sw('pageLists', 'Long lists in pages', 'Stock, customers and ledger show a few at a time + “Show more” (faster)'), numRow('pageSize', 'Items per page', '', '50')];
    group('⚡ Speed & Offline (on / off)', spd);
    var ins = [sw('insights', 'Business Insights', 'Month compare, top customers, staff sales (profile menu)'), actRow('Business Insights', 'Sales this month vs last month, top customers, staff-wise sales', 'ttOpenInsights()', 'Open')];
    group('📊 Insights (on / off)', ins);
    return r;
  };
  var oOpt = window.ttSetOpt;
  window.ttSetOpt = function (k, v) {
    var r = oOpt ? oOpt.apply(this, arguments) : undefined;
    if (k === 'offlineApp') applyOffline(); else if (k === 'openRegister' || k === 'secureMode') applyFlags();
    else if (k === 'pageLists' || k === 'pageSize') { try { window.ttPgRefresh && ttPgRefresh(); } catch (e) {} }
    if (k === 'secureMode' && v) toast('Secure mode will start the next time the app opens. Everyone must sign in again.');
    return r;
  };

  /* ================= small UI helpers ================= */
  var msgQ = [], nativeAlert = window.alert.bind(window);
  function msgShow() {
    if (!msgQ.length || $('ttV41Msg')) return;
    var o = document.createElement('div'); o.id = 'ttV41Msg'; o.className = 'tt41-ov';
    o.innerHTML = '<div class="tt41-card"><div class="tt41-msg"></div><button class="btn btn-primary" style="width:100%;margin-top:12px;">OK</button></div>';
    o.querySelector('.tt41-msg').textContent = msgQ.shift();
    o.querySelector('button').onclick = function () { o.remove(); msgShow(); };
    document.body.appendChild(o); try { o.querySelector('button').focus(); } catch (e) {}
  }
  window.alert = function (m) { if (!F('friendlyAlerts') || !document.body) return nativeAlert(m); msgQ.push(String(m == null ? '' : m)); msgShow(); };
  window.ttAskSecret = function (msg) {
    return new Promise(function (res) {
      var o = document.createElement('div'); o.className = 'tt41-ov';
      o.innerHTML = '<div class="tt41-card"><div class="tt41-msg" style="margin-bottom:8px;"></div><input type="password" class="tt41-in" autocomplete="new-password"><div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-outline" style="flex:1;" data-x="0">Cancel</button><button class="btn btn-primary" style="flex:1;" data-x="1">OK</button></div></div>';
      o.querySelector('.tt41-msg').textContent = msg; document.body.appendChild(o);
      var inp = o.querySelector('input'); try { inp.focus(); } catch (e) {}
      function done(ok) { var v = inp.value; o.remove(); res(ok ? v : null); }
      o.querySelectorAll('button').forEach(function (b) { b.onclick = function () { done(b.getAttribute('data-x') === '1'); }; });
      inp.onkeydown = function (e) { if (e.key === 'Enter') done(true); };
    });
  };
  window.ttV41.modal = function (id, title, html, wide) {
    var o = $(id); if (!o) { o = document.createElement('div'); o.id = id; o.className = 'tt41-ov'; document.body.appendChild(o); }
    o.innerHTML = '<div class="tt41-card tt41-big" style="' + (wide ? 'max-width:640px;' : '') + '"><div class="tt41-hd"><b>' + title + '</b><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'' + id + '\').remove()">✕</button></div><div class="tt41-bd">' + html + '</div></div>';
    o.style.display = 'flex'; return o;
  };
  window.ttV41.csvCell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };

  /* ================= financial year + numbering ================= */
  function fyLabel(d) { d = d ? new Date(d) : new Date(); var y = d.getFullYear(), s = d.getMonth() >= 3 ? y : y - 1; return String(s).slice(2) + '-' + String(s + 1).slice(2); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function nextNo(kind, prefix, start) {   // kind: inv | rcpt | cn ; resolves "PREFIX/26-27/0001"
    var fy = fyLabel(), c = cloud();
    if (!c || !c.nextNumber || !online()) return Promise.reject(new Error('offline'));
    return c.nextNumber(kind + '_' + fy).then(function (n) { return prefix + '/' + fy + '/' + pad(n + (Math.max(1, start || 1) - 1), 4); });
  }
  window.ttV41.nextNo = nextNo; window.ttV41.fyLabel = fyLabel;
  window.ttInvNo = function (o) { return (o && o.invoiceNo) ? o.invoiceNo : (o && o.id); };
  function assignPending() {
    if (!online() || !cloud() || !window.ttCloudInitialLoadDone) return;
    var chain = Promise.resolve(), changed = false;
    (ordersData || []).forEach(function (o) {
      if (!o) return;
      if (o.needInvNo && !o.invoiceNo) chain = chain.then(function () { return nextNo('inv', F('invPrefix') || 'TTE', F('invStart')).then(function (no) { o.invoiceNo = no; delete o.needInvNo; changed = true; }); }).catch(function () {});
      (o.payments || []).forEach(function (p) { if (p && p.needRno && !p.rno) chain = chain.then(function () { return nextNo('rcpt', 'RCPT', 1).then(function (no) { p.rno = no; delete p.needRno; changed = true; }); }).catch(function () {}); });
    });
    chain.then(function () { if (changed) setStored('ORDERS', ordersData); });
  }
  window.addEventListener('online', function () { setTimeout(assignPending, 1500); });
  setInterval(assignPending, 45000);

  /* ================= B1/S2: deletes reach the cloud + recycle bin ================= */
  var LISTS = {
    ORDERS: { get: function () { return ordersData; }, kind: 'Order' }, LEADS: { get: function () { return leadsData; }, kind: 'Lead' },
    SERVICES: { get: function () { return serviceCallsData; }, kind: 'Service' }, STAFF: { get: function () { return registeredEmployees; }, kind: 'Staff' },
    MACHINE_PARTS: { get: function () { return machinePartsData; }, kind: 'Machine reminder' },
    CUSTOMERS: { get: function () { return customerDatabase; }, kind: 'Customer' }
  };
  window.ttV41.LISTS = LISTS;
  function findPart(it) {
    var inv = (typeof sampleInventory !== 'undefined' && Array.isArray(sampleInventory)) ? sampleInventory : [];
    var nm = String((it && it.name) || '').trim().toLowerCase();
    return inv.find(function (x) { return it && it.id != null && String(x.id) === String(it.id); }) || inv.find(function (x) { return nm && String(x.name || '').trim().toLowerCase() === nm; }) || null;
  }
  window.ttV41.findPart = findPart;
  function giveBackStock(o) {
    var n = 0;
    (o.items || []).forEach(function (it) { var p = findPart(it); if (p) { p.stock = (Number(p.stock) || 0) + (Number(it.qty) || 0); n++; } });
    if (n) { setStored('INVENTORY', sampleInventory); try { renderStockList(); } catch (e) {} }
    try { window.ttActAdd && ttActAdd('Stock', 'restored', o.id, 'Stock put back for ' + (o.customerName || '')); } catch (e) {}
    return n;
  }
  function afterDelete(key, before, after) {
    var have = {}; (after || []).forEach(function (x) { if (x && x.id != null) have[String(x.id)] = 1; });
    var gone = (before || []).filter(function (x) { return x && x.id != null && !have[String(x.id)]; });
    gone.forEach(function (rec) {
      var restored = false;
      if (key === 'ORDERS' && rec.status === 'Delivered' && !rec.stockRestored && F('restoreOnCancel') && confirm('This bill was already delivered.\nPut its items back into stock?')) { restored = giveBackStock(rec) > 0; }
      if (F('recycleBin') && cloud() && cloud().saveDoc) {
        try { cloud().saveDoc('RECYCLE', { id: 'RB-' + Date.now() + '-' + Math.floor(Math.random() * 1000), key: key, kind: LISTS[key].kind, refId: String(rec.id), label: String(rec.customerName || rec.name || rec.title || rec.id || ''), by: me(), at: new Date().toISOString(), stockRestored: restored, data: lite(rec) }); } catch (e) { console.warn(e); }
      }
      if (F('cloudDelete') && cloud() && cloud().deleteItem) { try { cloud().deleteItem(key, rec.id); } catch (e) { console.warn(e); } }
    });
  }
  window.ttV41.afterDelete = afterDelete;
  function wrapDelete(fn, key) {
    var orig = window[fn]; if (typeof orig !== 'function') return;
    window[fn] = function () {
      var before = (LISTS[key].get() || []).slice(), r = orig.apply(this, arguments);
      try { afterDelete(key, before, LISTS[key].get()); } catch (e) { console.warn('v41 delete hook', e); }
      return r;
    };
  }
  wrapDelete('deleteOrderAction', 'ORDERS'); wrapDelete('deleteAdminLedgerInvoice', 'ORDERS'); wrapDelete('deleteLeadAction', 'LEADS');
  wrapDelete('deleteServiceAction', 'SERVICES'); wrapDelete('deleteStaffPrompt', 'STAFF'); wrapDelete('deleteMachinePart', 'MACHINE_PARTS');
  window.ttV41.restoreFromBin = function (id) {
    if (!isAdm()) return toast('Only Admin can restore', true);
    var bin = (window.TTX && window.TTX.RECYCLE) || [], rec = bin.find(function (x) { return x && x.id === id; });
    if (!rec || !LISTS[rec.key]) return;
    var list = LISTS[rec.key].get(), data = rec.data;
    if (list.some(function (x) { return String(x.id) === String(data.id); })) { toast('Already exists again - removed from the bin'); cloud().deleteItem('RECYCLE', id); return; }
    list.unshift(data);
    if (rec.key === 'ORDERS' && rec.stockRestored) {   // stock was given back on delete: take it out again
      (data.items || []).forEach(function (it) { var p = findPart(it); if (p) p.stock = Math.max(0, (Number(p.stock) || 0) - (Number(it.qty) || 0)); });
      setStored('INVENTORY', sampleInventory);
    }
    setStored(rec.key, list); cloud().deleteItem('RECYCLE', id);
    try { renderOrders(); renderBilling('all'); renderDashboard(); renderLeads(); renderServices(); renderStockList(); } catch (e) {}
    toast('Restored: ' + rec.label);
  };

  /* ================= B5: cancel of a delivered bill ================= */
  (function () {
    var orig = window.cancelOrderAction; if (typeof orig !== 'function') return;
    window.cancelOrderAction = function (id) {
      var o = (ordersData || []).find(function (x) { return x.id === id; }), was = o && o.status;
      var r = orig.apply(this, arguments);
      try {
        if (o && was === 'Delivered' && o.status === 'Cancelled' && F('restoreOnCancel') && !o.stockRestored && confirm('This bill was delivered.\nPut its items back into stock?')) { if (giveBackStock(o) > 0) { o.stockRestored = true; setStored('ORDERS', ordersData); } }
      } catch (e) { console.warn(e); }
      return r;
    };
  })();

  /* ================= B4/B5: latest cloud copy before payment / delivery ================= */
  var FRESH = ['status', 'recvAmount', 'dueAmount', 'payments', 'payMode', 'lastPaymentDate', 'lastPaymentProof', 'deliveredDate', 'deliveredAt', 'deliveredBy'];
  function mergeFresh(o, f) { FRESH.forEach(function (k) { if (f[k] !== undefined) o[k] = f[k]; }); }
  function freshOrder(id) {
    if (!F('freshWrite') || !online() || !cloud() || !cloud().fetchDoc) return Promise.resolve(null);
    return Promise.race([cloud().fetchDoc('ORDERS', id), new Promise(function (r) { setTimeout(function () { r(null); }, 4500); })]);
  }
  var busy = {};
  (function () {
    var oDel = window.executeConfirmedDelivery; if (typeof oDel !== 'function') return;
    window.executeConfirmedDelivery = function () {
      var self = this, args = arguments, id = ($('pendingDeliverOrderId') || {}).value, o = (ordersData || []).find(function (x) { return x.id === id; });
      if (!o) return oDel.apply(self, args);
      if (busy['d' + id]) return;
      function already() { alert('This order is already marked Delivered (maybe from another phone). Stock was not cut again.'); try { closeDeliveryProofModal(); renderOrders(); renderStockList(); } catch (e) {} }
      if (F('singleDeliver') && o.status === 'Delivered') return already();
      busy['d' + id] = 1;
      return freshOrder(id).then(function (f) {
        if (f) mergeFresh(o, f);
        if (F('singleDeliver') && o.status === 'Delivered') return already();
        var was = o.status, r0 = oDel.apply(self, args);
        if (was !== 'Delivered' && o.status === 'Delivered') window.__tt41Delivered = id;   // lets the delivery add-on know this phone really delivered it
        return r0;
      }).then(function (r) { delete busy['d' + id]; return r; }, function (e) { delete busy['d' + id]; throw e; });
    };
  })();
  (function () {
    var oPay = window.executeConfirmedPaymentCollection; if (typeof oPay !== 'function') return;
    window.executeConfirmedPaymentCollection = function () {
      var self = this, args = arguments, id = ($('pendingCollectOrderId') || {}).value, amt = parseFloat(($('payCollectInputAmt') || {}).value) || 0;
      var o = (ordersData || []).find(function (x) { return x.id === id; });
      if (!o) return oPay.apply(self, args);
      if (busy['p' + id]) return;
      function go() {
        var due = Math.max(0, Math.round(((Number(o.totalAmount) || 0) - (Number(o.recvAmount) || 0)) * 100) / 100);
        if (F('blockOverpay') && amt > due + 0.009) { alert('Amount ₹' + amt.toLocaleString('en-IN') + ' is more than the due ₹' + due.toLocaleString('en-IN') + '.\nPlease enter ₹' + due.toLocaleString('en-IN') + ' or less.'); return; }
        var n0 = (o.payments || []).length, r = oPay.apply(self, args);
        try {
          if (F('receipts') && (o.payments || []).length > n0) { o.payments[o.payments.length - 1].needRno = true; setStored('ORDERS', ordersData); setTimeout(assignPending, 400); }
        } catch (e) { console.warn(e); }
        return r;
      }
      if (amt <= 0 || !(window.currentPaymentProofBase64 || (typeof currentPaymentProofBase64 !== 'undefined' && currentPaymentProofBase64))) return oPay.apply(self, args);   // let the original show its own message
      busy['p' + id] = 1;
      return freshOrder(id).then(function (f) { if (f) mergeFresh(o, f); return go(); }).then(function (r) { delete busy['p' + id]; return r; }, function (e) { delete busy['p' + id]; throw e; });
    };
  })();

  /* ================= order save: stock warning, invoice no., GST stamp ================= */
  (function () {
    var oSave = window.saveOrderAction; if (typeof oSave !== 'function') return;
    window.saveOrderAction = function () {
      var editId = ($('editOrderId') || {}).value, ex = editId && (ordersData || []).find(function (x) { return x.id === editId; });
      if (F('stockWarn') && !(ex && ex.status === 'Delivered')) {
        var warns = [];
        document.querySelectorAll('#orderItemsTbody tr').forEach(function (r) {
          try {
            var pn = r.querySelector('.item-product-input').value.trim(), q = parseFloat(r.querySelector('.item-qty').value) || 0, part = pn && resolvePartFromSearch(pn);
            if (part && typeof part.stock === 'number' && q > part.stock) warns.push('• ' + part.name + ': stock ' + part.stock + ', ordering ' + q);
          } catch (e) {}
        });
        if (warns.length && !confirm('Not enough stock for:\n' + warns.join('\n') + '\n\nSave the order anyway?')) return;
      }
      var seen = {}; (ordersData || []).forEach(function (o) { seen[o.id] = 1; });
      var rowRates = []; document.querySelectorAll('#orderItemsTbody tr').forEach(function (r) { var nm = (r.querySelector('.item-product-input') || {}).value; if (nm && nm.trim()) { var g = parseFloat((r.querySelector('.item-gst') || {}).value); rowRates.push(isNaN(g) ? 18 : Math.min(40, Math.max(0, g))); } });
      var r = oSave.apply(this, arguments);
      try {
        var o = editId ? ex : (ordersData || []).find(function (x) { return !seen[x.id]; });
        if (o) {
          if (F('gstRowTax')) { var ch = false; (o.items || []).forEach(function (it, i) { var g = rowRates[i]; g = (g == null || isNaN(g)) ? 18 : g; if (it.gstRate !== g) { it.gstRate = g; ch = true; } }); if (ch) setStored('ORDERS', ordersData); }
          if (!editId && F('seqInvoice') && !o.invoiceNo) { o.needInvNo = true; setStored('ORDERS', ordersData); setTimeout(assignPending, 300); }
        }
      } catch (e) { console.warn('v41 save hook', e); }
      return r;
    };
  })();

  /* ================= GST helpers used by invoice / GST report ================= */
  window.ttItemGstRate = function (it) {   // GST % of one bill line: what was saved on the line (default 18). Old lines without a rate stay at 18.
    if (!F('gstRowTax')) return 18;
    var r = it && it.gstRate; if (r == null || r === '') return 18;
    r = Number(r); return (isFinite(r) && r >= 0 && r <= 40) ? r : 18;
  };
  window.ttCourierTaxable = function () { return !!F('courierTaxable'); };
  window.ttBankLines = function () {
    if (!F('bankFromCompany')) return 'Bank Name : ICICI BANK AC-150005501249<br>A/c No. : 150005501249<br>Branch &amp; IFS Code : CUTTACK ROAD &amp; ICIC0001500';
    var d = window.companyDetailsData || {};
    return 'Bank Name : ' + H(d.bankName || '') + '<br>A/c No. : ' + H(d.accountNo || '') + '<br>IFS Code : ' + H(d.ifsc || '');
  };
  (function () {   // auto Intra / Inter from GSTIN state code
    var o = window.selectCustomerSuggestion; if (typeof o !== 'function') return;
    window.selectCustomerSuggestion = function (target, encName, phone) {
      var r = o.apply(this, arguments);
      try {
        if (target === 'ordCustSearchInput' && F('autoInter')) {
          var nm = ''; try { nm = decodeURIComponent(encName); } catch (e) { nm = encName; }
          var c = (customerDatabase || []).find(function (x) { return (phone && x.phone === phone) || x.name === nm; });
          var cs = c && /^\d{2}[A-Z]/i.test(String(c.gst || '')) ? String(c.gst).slice(0, 2) : '', co = String((window.companyDetailsData || {}).gstin || '').slice(0, 2), sel = $('ordTaxType');
          if (cs && /^\d{2}$/.test(co) && sel) { sel.value = (cs === co) ? 'INTRA' : 'INTER'; sel.dispatchEvent(new Event('change')); }
        }
      } catch (e) { console.warn(e); }
      return r;
    };
  })();
  /* stock form: GST % and minimum stock */
  function injectStockFields() {
    var hsn = $('stkHsn'); if (!hsn || $('stkGst')) return;
    var grid = hsn.closest('.grid-2'); if (!grid) return;
    var d = document.createElement('div'); d.className = 'grid-2';
    d.innerHTML = '<div class="form-group"><label class="form-label">GST % (when "GST per item" is ON)</label><select id="stkGst"><option>0</option><option>5</option><option>12</option><option selected>18</option><option>28</option></select></div><div class="form-group"><label class="form-label">Minimum stock (alert)</label><input type="number" id="stkMin" min="0" placeholder="blank = use Settings level"></div>';
    grid.parentNode.insertBefore(d, grid.nextSibling);
  }
  (function () {
    var oOpen = window.openAddPartModal;
    if (typeof oOpen === 'function') window.openAddPartModal = function (p) { injectStockFields(); var r = oOpen.apply(this, arguments); try { var g = $('stkGst'), m = $('stkMin'); if (g) g.value = String(p && p.gstRate != null ? p.gstRate : 18); if (m) m.value = p && p.minStock > 0 ? p.minStock : ''; } catch (e) {} return r; };
    var oSv = window.saveStockItemAction;
    if (typeof oSv === 'function') window.saveStockItemAction = function () {
      var editId = ($('editStockId') || {}).value, g = ($('stkGst') || {}).value, m = ($('stkMin') || {}).value, before = (sampleInventory || []).length;
      var r = oSv.apply(this, arguments);
      try {
        var closed = $('stockItemModal') && $('stockItemModal').style.display === 'none';
        if (closed) {
          var it = editId ? sampleInventory.find(function (x) { return String(x.id) === String(editId); }) : sampleInventory[0];
          if (it && g !== undefined) { it.gstRate = Number(g) || 0; if (Number(m) > 0) it.minStock = Number(m); else delete it.minStock; setStored('INVENTORY', sampleInventory); try { renderStockList(); } catch (e) {} }
        }
      } catch (e) { console.warn(e); }
      return r;
    };
  })();

  /* ================= registration / login guards, secure mode ================= */
  function secureOn() { return !!F('secureMode') && !!baseUrl(); }
  function baseUrl() { return String(F('secureUrl') || '').trim().replace(/\/+$/, ''); }
  window.ttV41.secureOn = secureOn; window.ttV41.baseUrl = baseUrl;
  function whenCloud(ms) { return new Promise(function (res, rej) { var t0 = Date.now(); (function w() { if (window.cloudSync && window.cloudSync.secureSignIn) return res(); if (Date.now() - t0 > (ms || 8000)) return rej(new Error('cloud not ready')); setTimeout(w, 200); })(); }); }
  function applyFlags() {
    var hide = !F('openRegister') || secureOn();
    document.querySelectorAll('[onclick*="showAuthMode(\'register\'"],[onclick*="showAuthMode(\\"register\\""]').forEach(function (e) { e.style.display = hide ? 'none' : ''; });
  }
  (function () {
    var oReg = window.processRegister; if (typeof oReg !== 'function') return;
    window.processRegister = function () {
      if (secureOn()) { alert('Self sign-up is switched off (secure mode). Ask the Admin to create your account in Staff Manager.'); return; }
      if (!F('openRegister') && (registeredEmployees || []).length > 0) { alert('Self sign-up is switched off. Ask the Admin to create your account.'); return; }
      var role = ($('regRole') || {}).value;
      if (F('blockAdminRace') && role === 'Admin' && (registeredEmployees || []).length === 0 && !(window.ttCloudInitialLoadDone && online())) { alert('Please wait until the app shows "Live Cloud" (internet needed), then try again.\nThis stops a second Admin account being created by mistake.'); return; }
      return oReg.apply(this, arguments);
    };
  })();
  function post(path, body, token) {
    var h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
    return fetch(baseUrl() + path, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ('Server error ' + r.status)); return j; }); });
  }
  window.ttV41.post = post;
  (function () {
    var oLogin = window.processLogin; if (typeof oLogin !== 'function') return;
    window.processLogin = async function () {
      if (!secureOn()) return oLogin.apply(this, arguments);
      var p = ($('loginPhone') || {}).value.trim(), pass = ($('loginPass') || {}).value.trim();
      if (!p || !pass) { alert('Enter mobile number and password.'); return; }
      try {
        await whenCloud(9000);
        var j = await post('/login', { mobile: p, pass: pass });
        await cloud().secureSignIn(j.token);
        currentUser = ttPublicUser(j.user); setStored('SESSION_USER', currentUser);
        checkAuthSession(); try { requestAppSystemPermissions(); } catch (e) {}
      } catch (e) { alert(e && e.message ? e.message : 'Cannot reach the secure login server.'); }
    };
    var oRes = window.processPasswordReset;
    if (typeof oRes === 'function') window.processPasswordReset = async function () {
      if (!secureOn()) return oRes.apply(this, arguments);
      try { await post('/reset', { mobile: $('recPhone').value.trim(), pin: $('recPin').value.trim(), newPass: $('recNewPass').value.trim() }); alert('Password updated successfully! Please login now.'); try { showAuthMode('login'); } catch (e) {} }
      catch (e) { alert(e.message || 'Reset failed'); }
    };
    var oOut = window.performFullLogout;
    if (typeof oOut === 'function') window.performFullLogout = function () { var was = currentUser; var r = oOut.apply(this, arguments); if (was && !currentUser && secureOn() && cloud() && cloud().secureSignOut) cloud().secureSignOut(); return r; };
  })();
  (function () {   // in secure mode the password hashes never go inside the staff document: send them to the server instead
    var oSet = window.setStored; if (typeof oSet !== 'function') return;
    window.setStored = function (key, val) {
      if (key === 'STAFF' && secureOn() && Array.isArray(val)) {
        var sec = [];
        val = val.map(function (e) {
          if (!e || (!e.passHash && !e.pinHash && !e.pass && !e.pin)) return e;
          var c = Object.assign({}, e); sec.push({ staffId: String(e.id), passHash: e.passHash, pinHash: e.pinHash, pass: e.pass, pin: e.pin });
          delete c.passHash; delete c.pinHash; delete c.pass; delete c.pin; return c;
        });
        registeredEmployees = val;
        cloud().secureIdToken().then(function (t) { sec.forEach(function (s) { post('/staff-secret', s, t).catch(function (e) { toast('Could not save a password on the server: ' + e.message, true); }); }); });
      }
      return oSet.call(this, key, val);
    };
    try { (0, eval)('setStored = window.setStored;'); } catch (e) {}
  })();
  window.ttSecureTest = async function () {
    if (!isAdm()) return toast('Admin only', true);
    var u = baseUrl(); if (!/^https:\/\//.test(u)) return alert('First type the secure login server URL (https://…) above.');
    var pass = await ttAskSecret('Type YOUR (Admin) password to test the secure server');
    if (!pass) return;
    try {
      var j = await post('/login', { mobile: String(currentUser.mobile || ''), pass: pass });
      await whenCloud(9000); await cloud().secureSignIn(j.token);
      var t = await cloud().secureIdToken(), m = await post('/migrate', {}, t);
      if (!F('secureMode')) { FEAT.set('secureMode', 1); }
      alert('✅ Secure server works. ' + (m.moved || 0) + ' staff password(s) moved to the safe place.\n\nSecure mode is ON. Next steps:\n1) Close and open the app on every phone and sign in again.\n2) Then publish firestore.rules.secure in the Firebase console (see README).');
      try { ttOpenSettings(); } catch (e) {}
    } catch (e) { alert('Secure mode NOT switched on: ' + (e.message || e) + '\nCheck: functions deployed, URL correct, your password right.'); }
  };
  /* in secure mode a phone that is not signed in to Firebase must log in again */
  setTimeout(function () {
    if (!secureOn() || typeof currentUser === 'undefined' || !currentUser || !cloud() || !cloud().secureIdToken) return;
    cloud().secureIdToken().then(function (t) { if (!t) { currentUser = null; try { localStorage.removeItem(DB_PREFIX + 'SESSION_USER'); } catch (e) {} checkAuthSession(); alert('Please sign in again (secure mode).'); } });
  }, 6000);

  /* ================= session: verify against staff list, idle logout ================= */
  var misses = 0;
  function verifyNow() {
    if (!F('verifySession') || typeof currentUser === 'undefined' || !currentUser || !window.ttCloudInitialLoadDone) return;
    var list = registeredEmployees || []; if (!list.length) return;
    var e = list.find(function (x) { return String(x.id) === String(currentUser.id); });
    if (!e) { if (++misses >= 2) { misses = 0; currentUser = null; try { localStorage.removeItem(DB_PREFIX + 'SESSION_USER'); } catch (x) {} checkAuthSession(); alert('Your account is no longer in the staff list. Please contact the Admin.'); } return; }
    misses = 0;
    if (String(e.role) !== String(currentUser.role) || e.name !== currentUser.name) { currentUser = ttPublicUser(e); try { localStorage.setItem(DB_PREFIX + 'SESSION_USER', JSON.stringify(currentUser)); } catch (x) {} checkAuthSession(); }
  }
  setInterval(verifyNow, 60000); setTimeout(verifyNow, 12000);
  var lastTouch = Date.now();
  ['click', 'touchstart', 'keydown', 'scroll'].forEach(function (ev) { document.addEventListener(ev, function () { lastTouch = Date.now(); }, { passive: true, capture: true }); });
  setInterval(function () {
    if (!F('idleLogout') || typeof currentUser === 'undefined' || !currentUser) return;
    if (Date.now() - lastTouch > Math.max(1, Number(F('idleMinutes')) || 30) * 60000) {
      currentUser = null; try { localStorage.removeItem(DB_PREFIX + 'SESSION_USER'); } catch (e) {}
      if (secureOn() && cloud() && cloud().secureSignOut) cloud().secureSignOut();
      checkAuthSession(); alert('You were logged out because the app was idle.');
    }
  }, 20000);

  /* ================= offline app (service worker) ================= */
  function applyOffline() {
    if (!('serviceWorker' in navigator) || !window.caches) return;
    var secureCtx = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!secureCtx) return;
    if (F('offlineApp')) { caches.delete('ttespl-nocache').catch(function () {}); navigator.serviceWorker.register('firebase-messaging-sw.js').catch(function (e) { console.warn('SW', e && e.message); }); }
    else { caches.open('ttespl-nocache').catch(function () {}); caches.delete('ttespl-shell-v424').catch(function () {}); }
  }
  window.addEventListener('load', function () { setTimeout(applyOffline, 1500); });

  document.addEventListener('DOMContentLoaded', function () { applyFlags(); injectStockFields(); setTimeout(applyFlags, 1500); });
  if (document.readyState !== 'loading') { applyFlags(); injectStockFields(); }
  window.ttV41.giveBackStock = giveBackStock; window.ttV41.assignPending = assignPending; window.ttV41.me = me; window.ttV41.isAdm = isAdm; window.ttV41.toast = toast;
})();
