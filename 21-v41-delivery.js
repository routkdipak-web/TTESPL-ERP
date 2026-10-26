/* TTESPL ERP v41 - DELIVERY ADD-ON
   In the "Deliver & Upload Proof" screen (besides the photo) you can now:
     1) fill the invoice details that print on the right side of the bill (Delivery Note, Reference, Dispatch, Destination ...)
     2) enter a payment received at delivery (payment photo box appears by itself as soon as an amount is typed)
     3) get an automatic, never-repeating bill number:  GST customer -> TTESPL-101, 102 ...   non-GST customer -> TT-101, 102 ...
   The same invoice details can be corrected later in the Admin Edit Ledger screen. Saved data / formulas of old bills are not touched. */
(function () {
  'use strict';
  var V = window.ttV41; if (!V) return;
  var F = V.F, $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return window.ttEscHtml(s); };
  var N = function (x) { return Number(x) || 0; };
  var R2 = function (x) { return Math.round(N(x) * 100) / 100; };
  /* ---------- photo sets: first photo as before, then "Add another photo (optional)" ---------- */
  var SETS = {};
  function mkSet(name, o) {
    var s = { name: name, list: [], max: o.max, first: o.first, more: o.more, thumbs: o.thumbs, btn: o.btn, file: o.file, after: o.after };
    s.reset = function () { s.list = []; s.draw(); };
    s.draw = function () {
      var t = $(s.thumbs), b = $(s.btn); if (!t || !b) return;
      t.innerHTML = s.list.map(function (src, i) { return '<span class="tt41-th"><img alt="" src="' + H(src) + '" onclick="ttViewPhoto && ttViewPhoto(this.src)"><b onclick="ttPhDel(\'' + name + '\',' + i + ')" aria-label="Remove">✕</b></span>'; }).join('');
      b.textContent = s.list.length ? s.more : s.first;
      b.style.display = (s.list.length >= s.max || (s.after && !s.after())) ? 'none' : '';
      if (s.onDraw) s.onDraw(s);
    };
    SETS[name] = s; return s;
  }
  window.ttPhAdd = function (n) { var f = $(SETS[n].file); if (f) f.click(); };
  window.ttPhDel = function (n, i) { SETS[n].list.splice(i, 1); SETS[n].draw(); };
  window.ttPhPick = function (n, inp) {
    var s = SETS[n], fs = [].slice.call(inp.files || []); inp.value = '';
    (function next() {
      if (!fs.length || s.list.length >= s.max) { s.draw(); return; }
      var f = fs.shift(), r = new FileReader();
      r.onload = function (e) {
        var go = window.ttCompressImageSafe ? ttCompressImageSafe(e.target.result, 760, 0.55, 180000) : Promise.resolve(e.target.result);
        go.then(function (cd) { if (cd) s.list.push(cd); next(); });
      };
      r.readAsDataURL(f);
    })();
  };
  mkSet('dl', { max: 3, first: '📷 Add payment photo (required)', more: '➕ Add another photo (optional)', thumbs: 'tt41DlThumbs', btn: 'tt41DlAddBtn', file: 'tt41DlFile' });
  mkSet('dv', { max: 2, first: '➕ Add another photo (optional)', more: '➕ Add another photo (optional)', thumbs: 'tt41DvThumbs', btn: 'tt41DvAddBtn', file: 'tt41DvFile', after: function () { var b = $('confirmDeliveryBtn'); return b && !b.disabled; } });
  mkSet('co', { max: 2, first: '➕ Add another photo (optional)', more: '➕ Add another photo (optional)', thumbs: 'tt41CoThumbs', btn: 'tt41CoAddBtn', file: 'tt41CoFile', after: function () { var b = $('confirmCollectPayBtn'); return b && !b.disabled; } });
  function injectExtras() {
    var w = $('deliveryPhotoPreviewWrap');
    if (w && !$('tt41DvEx')) { var d = document.createElement('div'); d.id = 'tt41DvEx'; d.className = 'tt41-ph'; d.innerHTML = '<div class="tt41-thumbs" id="tt41DvThumbs"></div><button type="button" class="btn btn-outline btn-sm" id="tt41DvAddBtn" onclick="ttPhAdd(\'dv\')" style="display:none">➕ Add another photo (optional)</button><input type="file" id="tt41DvFile" accept="image/*" multiple style="display:none" onchange="ttPhPick(\'dv\',this)">'; w.parentNode.insertBefore(d, w.nextSibling); }
    var pw = $('payProofPreviewWrap');
    if (pw && !$('tt41CoEx')) { var e = document.createElement('div'); e.id = 'tt41CoEx'; e.className = 'tt41-ph'; e.innerHTML = '<div class="tt41-thumbs" id="tt41CoThumbs"></div><button type="button" class="btn btn-outline btn-sm" id="tt41CoAddBtn" onclick="ttPhAdd(\'co\')" style="display:none">➕ Add another photo (optional)</button><input type="file" id="tt41CoFile" accept="image/*" multiple style="display:none" onchange="ttPhPick(\'co\',this)">'; pw.parentNode.insertBefore(e, pw.nextSibling); }
    [['confirmDeliveryBtn', 'dv'], ['confirmCollectPayBtn', 'co']].forEach(function (x) {   // show "another photo" as soon as the first photo is chosen
      var b = $(x[0]); if (b && !b.__ph) { b.__ph = 1; new MutationObserver(function () { SETS[x[1]].draw(); }).observe(b, { attributes: true, attributeFilter: ['disabled'] }); }
    });
  }
  function cloud() { return window.cloudSync; }
  function orderById(id) { return (typeof ordersData !== 'undefined' ? ordersData : []).find(function (x) { return x.id === id; }); }
  function inr(n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

  var META = [['deliveryNote', 'Delivery Note'], ['refNo', 'Reference No. & Date'], ['otherRef', 'Other References'], ['buyerOrderNo', "Buyer's Order No."], ['buyerOrderDate', "Buyer's Order Date", 'date'],
    ['dispatchDoc', 'Dispatch Doc No.'], ['deliveryNoteDate', 'Delivery Note Date', 'date'], ['dispatchedThrough', 'Dispatched through'], ['destination', 'Destination'], ['termsOfDelivery', 'Terms of Delivery']];
  function metaHtml(p) {
    return '<div class="tt41-mg">' + META.map(function (m) { return '<div><label class="form-label">' + H(m[1]) + '</label><input type="' + (m[2] || 'text') + '" id="' + p + m[0] + '" maxlength="60" autocomplete="off"></div>'; }).join('') + '</div>';
  }
  function readMeta(p) { var o = {}; META.forEach(function (m) { var e = $(p + m[0]); var v = e ? String(e.value || '').trim() : ''; if (v) o[m[0]] = (window.ttCleanText ? ttCleanText(v, 60) : v.slice(0, 60)); }); return o; }
  function fillMeta(p, src) { META.forEach(function (m) { var e = $(p + m[0]); if (e) e.value = (src && src[m[0]]) || ''; }); }

  /* ---------- bill number (B2B / B2C) ---------- */
  function custOf(o) {
    var list = (typeof customerDatabase !== 'undefined' && customerDatabase) || [], ph = String(o.phone || '').replace(/\D/g, '').slice(-10), nm = String(o.customerName || '').trim().toLowerCase();
    return list.find(function (c) { return ph && String(c.phone || '').replace(/\D/g, '').slice(-10) === ph; }) || list.find(function (c) { return nm && String(c.name || '').trim().toLowerCase() === nm; }) || null;
  }
  function hasGst(o) { var c = custOf(o), g = String((c && c.gst) || o.customerGst || '').trim().toUpperCase(); return /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(g); }
  function typeFor(o, sel) { return (sel === 'b2b' || sel === 'b2c') ? sel : (hasGst(o) ? 'b2b' : 'b2c'); }
  function cfg(type) { return type === 'b2b' ? { pre: String(F('billPrefixB2B') || 'TTESPL-'), start: Math.max(1, N(F('billStartB2B')) || 101) } : { pre: String(F('billPrefixB2C') || 'TT-'), start: Math.max(1, N(F('billStartB2C')) || 101) }; }
  function fmt(type, n) { var c = cfg(type); return c.pre + (n + c.start - 1); }
  V.billType = typeFor; V.billFormat = fmt;
  var PEND = 'TTESPL_V41_PENDBILL';
  function pendGet() { try { return JSON.parse(localStorage.getItem(PEND) || '[]') || []; } catch (e) { return []; } }
  function pendSet(a) { try { localStorage.setItem(PEND, JSON.stringify(a)); } catch (e) {} }
  var working = false, lastErrToast = 0;
  function noteErr(e) {
    var code = (e && e.code) || '', msg = (e && e.message) || String(e || '');
    window.__billErr = (code ? code + ': ' : '') + msg;
    if (Date.now() - lastErrToast > 60000) {
      lastErrToast = Date.now();
      V.toast('Bill number not created yet (' + (code || msg).slice(0, 60) + '). It will retry by itself.' + (/permission/i.test(code + msg) ? ' Firebase rules block the counter: see README.' : ''), true);
    }
  }
  window.ttBillStatus = function () {
    var pend = pendGet(), noNo = (typeof ordersData !== 'undefined' ? ordersData : []).filter(function (o) { return o.status === 'Delivered' && !o.invoiceNo; }).length;
    var html = '<div class="tt41-sub">Pending (waiting for a number on this phone): <b>' + pend.length + '</b><br>Old delivered bills without a new number: <b>' + noNo + '</b> (they keep ORD-xxx, new deliveries get numbers)<br>Last problem: <b>' + H(window.__billErr || 'none') + '</b><br><span id="tt41BsCtr">Reading counters…</span></div><button class="btn btn-primary" style="width:100%;" onclick="ttV41.assignBills();setTimeout(ttBillStatus,2500)">Retry now</button>';
    V.modal('tt41Bs', '🧾 Bill number status', html);
    if (cloud() && cloud().peekNumber) Promise.all([cloud().peekNumber('bill_b2b'), cloud().peekNumber('bill_b2c')]).then(function (r) { var el = $('tt41BsCtr'); if (el) el.innerHTML = 'Counter now → GST: <b>' + (r[0] == null ? 'cannot read' : fmt('b2b', r[0] + 1) + ' (next)') + '</b> · Non-GST: <b>' + (r[1] == null ? 'cannot read' : fmt('b2c', r[1] + 1) + ' (next)') + '</b>'; });
  };
  function assignBills() {   // only the phone that delivered the bill numbers it, one at a time, through a cloud counter (no two bills can get the same number)
    if (working || !F('billSeries')) return;
    var ids = pendGet(); if (!ids.length) return;
    if (navigator.onLine === false || !cloud() || !cloud().nextNumber) return;
    working = true;
    var rest = ids.slice(), done = [];
    (function next() {
      if (!rest.length) { finish(); return; }
      var id = rest[0], o = orderById(id);
      if (!o || o.invoiceNo || o.status !== 'Delivered') { rest.shift(); return next(); }
      var type = o.billType || typeFor(o);
      (cloud().fetchDoc ? cloud().fetchDoc('ORDERS', id) : Promise.resolve(null)).then(function (fresh) {
        if (fresh && fresh.invoiceNo) { o.invoiceNo = fresh.invoiceNo; o.billType = fresh.billType || type; rest.shift(); done.push(o); return next(); }
        return cloud().nextNumber('bill_' + type).then(function (n) {
          o.invoiceNo = fmt(type, n); o.billType = type; delete o.needBillNo; rest.shift(); done.push(o);
          setStored('ORDERS', ordersData);   // save right away so the number is never lost
          next();
        });
      }).catch(function (e) { noteErr(e); finish(); });
    })();
    function finish() {
      pendSet(rest); working = false;
      if (done.length) { try { setStored('ORDERS', ordersData); renderBilling('all'); renderOrders(); renderDashboard(); } catch (e) {} V.toast('Bill No. ' + done.map(function (o) { return o.invoiceNo; }).join(', ')); }
    }
  }
  V.assignBills = assignBills;
  setInterval(assignBills, 30000); window.addEventListener('online', function () { setTimeout(assignBills, 1200); }); setTimeout(assignBills, 9000);

  /* ---------- delivery screen ---------- */
  function injectDelivery() {
    var card = $('deliveryProofModal') && $('deliveryProofModal').querySelector('.auth-card'); if (!card || $('tt41DlBox')) return;
    card.style.maxHeight = '92vh'; card.style.overflowY = 'auto';
    var anchor = $('deliveryManualDate') && $('deliveryManualDate').closest('.form-group'); if (!anchor) return;
    var box = document.createElement('div'); box.id = 'tt41DlBox';
    box.innerHTML =
      '<div class="tt41-bn"><div id="tt41DlBill">Bill number</div><select id="tt41DlType" onchange="ttDlBillPreview()"><option value="auto">Bill type: Auto (by customer GST)</option><option value="b2b">GST bill (B2B)</option><option value="b2c">Non-GST bill (B2C)</option></select></div>' +
      '<details class="tt41-dt"><summary>📋 Invoice details <small>(optional – prints on the bill)</small></summary>' + metaHtml('tt41Dm_') + '</details>' +
      '<div class="tt41-payb"><div class="tt41-payh"><b>💰 Payment received now?</b><span id="tt41DlDue"></span></div>' +
      '<div class="grid-2"><div><label class="form-label">Amount (₹)</label><input type="number" id="tt41DlAmt" min="0" step="any" inputmode="decimal" placeholder="0" oninput="ttDlPayToggle()"></div>' +
      '<div><label class="form-label">Mode</label><select id="tt41DlMode"><option value="Cash">💵 Cash</option><option value="UPI / QR Code">📱 UPI / QR Code</option><option value="Net Banking / NEFT">🏦 Net Banking / NEFT</option><option value="Cheque">📜 Cheque</option></select></div></div>' +
      '<button type="button" class="btn btn-outline btn-sm" style="margin-top:6px;" onclick="ttDlFull()">Full due amount</button>' +
      '<div id="tt41DlProof" style="display:none;margin-top:10px;"><div class="tt41-thumbs" id="tt41DlThumbs"></div><button type="button" class="btn btn-accent btn-block" id="tt41DlAddBtn" onclick="ttPhAdd(\'dl\')">📷 Add payment photo (required)</button>' +
      '<input type="file" id="tt41DlFile" accept="image/*" multiple style="display:none" onchange="ttPhPick(\'dl\',this)"></div></div>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }
  function resetDelivery(id) {
    injectDelivery(); injectExtras(); SETS.dl.reset(); SETS.dv.reset();
    var o = orderById(id); if (!o) return;
    var due = Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount)));
    if ($('tt41DlAmt')) $('tt41DlAmt').value = '';
    if ($('tt41DlMode')) $('tt41DlMode').value = 'Cash';
    if ($('tt41DlType')) $('tt41DlType').value = o.billType || 'auto';
    if ($('tt41DlProof')) $('tt41DlProof').style.display = 'none';
    if ($('tt41DlDue')) $('tt41DlDue').innerHTML = 'Bill ' + inr(o.totalAmount) + ' · Advance ' + inr(o.recvAmount) + ' · <b style="color:' + (due > 0 ? 'var(--danger)' : 'var(--success)') + '">Due ' + inr(due) + '</b>';
    fillMeta('tt41Dm_', o.invMeta);
    var d = document.querySelector('#tt41DlBox details'); if (d) d.open = false;
    ttDlBillPreview();
  }
  window.ttDlBillPreview = function () {
    var el = $('tt41DlBill'), id = ($('pendingDeliverOrderId') || {}).value, o = orderById(id); if (!el || !o) return;
    if (!F('billSeries')) { el.innerHTML = '🧾 Bill no.: <b>' + H(o.invoiceNo || o.id) + '</b>'; return; }
    if (o.invoiceNo) { el.innerHTML = '🧾 Bill no.: <b>' + H(o.invoiceNo) + '</b>'; return; }
    var t = typeFor(o, ($('tt41DlType') || {}).value), tag = t === 'b2b' ? 'GST bill' : 'Non-GST bill';
    el.innerHTML = '🧾 Bill no. will be given automatically <small>(' + tag + ')</small>';
    if (cloud() && cloud().peekNumber && navigator.onLine !== false) cloud().peekNumber('bill_' + t).then(function (n) { if (n == null) { var c0 = $('tt41DlBill'); if (c0) c0.innerHTML += '<br><small style="color:var(--danger)">⚠ Counter not reachable now – the number will be added automatically.</small>'; return; } var cur = $('tt41DlBill'); if (cur && ($('pendingDeliverOrderId') || {}).value === id) cur.innerHTML = '🧾 Bill no.: <b>' + H(fmt(t, n + 1)) + '</b> <small>(' + tag + ')</small>'; });
  };
  window.ttDlPayToggle = function () {
    var amt = N(($('tt41DlAmt') || {}).value), box = $('tt41DlProof'); if (box) box.style.display = amt > 0 ? 'block' : 'none';
    var o = orderById(($('pendingDeliverOrderId') || {}).value), due = o ? Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount))) : 0, inp = $('tt41DlAmt');
    if (inp) inp.style.borderColor = (amt > due + 0.009 && F('blockOverpay')) ? 'var(--danger)' : '';
  };
  window.ttDlFull = function () {
    var o = orderById(($('pendingDeliverOrderId') || {}).value); if (!o) return;
    $('tt41DlAmt').value = Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount))) || ''; ttDlPayToggle();
  };
  (function () {
    var o = window.openDeliveryProofModal; if (typeof o !== 'function') return;
    window.openDeliveryProofModal = function (id) { var r = o.apply(this, arguments); try { resetDelivery(id); } catch (e) { console.warn('delivery add-on', e); } return r; };
  })();

  (function () {
    var prev = window.executeConfirmedDelivery; if (typeof prev !== 'function') return;
    window.executeConfirmedDelivery = function () {
      var id = ($('pendingDeliverOrderId') || {}).value, o = orderById(id);
      if (!o || !$('tt41DlBox')) return prev.apply(this, arguments);
      var amt = R2(N(($('tt41DlAmt') || {}).value)), mode = ($('tt41DlMode') || {}).value || 'Cash', meta = readMeta('tt41Dm_'), sel = ($('tt41DlType') || {}).value, proofs = SETS.dl.list.slice(), proof = proofs[0] || '', extraDel = SETS.dv.list.slice();
      var due = Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount)));
      if (amt > 0) {
        if (!proof) { alert('Please attach the payment photo for the payment received.'); return; }
        if (F('blockOverpay') && amt > due + 0.009) { alert('Payment ' + inr(amt) + ' is more than the due ' + inr(due) + '.\nPlease enter ' + inr(due) + ' or less.'); return; }
      }
      window.__tt41Delivered = '';
      var self = this, args = arguments;
      return Promise.resolve(prev.apply(self, args)).then(function () {
        if (window.__tt41Delivered !== id) return;   // photo missing / already delivered: nothing was delivered by this tap
        window.__tt41Delivered = '';
        var changed = false;
        if (extraDel.length) { o.deliveryProofPhotos = extraDel; changed = true; }
        if (Object.keys(meta).length) { o.invMeta = Object.assign({}, o.invMeta || {}, meta); changed = true; }
        if (amt > 0) {
          o.recvAmount = R2(N(o.recvAmount) + amt); o.dueAmount = Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount)));
          o.lastPaymentProof = proof; o.lastPaymentDate = ttYmd(); o.payMode = mode;
          o.payments = Array.isArray(o.payments) ? o.payments : [];
          var p = { amount: amt, mode: mode, at: getNowStr(), by: V.me() || 'Staff', photo: proof, onDelivery: true }; if (proofs.length > 1) { p.photos = proofs.slice(1); o.lastPaymentProofs = p.photos; } else { delete o.lastPaymentProofs; } if (F('receipts')) p.needRno = true;
          o.payments.push(p); changed = true;
          try { if (mode === 'Cash') playAtmCashSound(); else playCoinSound(); triggerMoneyRainEffect(); } catch (e) {}
          try { if (cloud() && cloud().pushLiveNotification) cloud().pushLiveNotification({ title: '💰 Payment Received!', body: inr(amt) + ' received for ' + o.customerName + ' at delivery', type: 'payment' }); } catch (e) {}
        }
        if (F('billSeries') && !o.invoiceNo) { o.billType = typeFor(o, sel); o.needBillNo = true; var a = pendGet(); if (a.indexOf(id) < 0) { a.push(id); pendSet(a); } changed = true; }
        if (changed) setStored('ORDERS', ordersData);
        SETS.dl.reset(); SETS.dv.reset();
        try { renderBilling('all'); renderOrders(); renderDashboard(); } catch (e) {}
        if (F('receipts') && V.assignPending) setTimeout(V.assignPending, 500);
        assignBills();
        if (F('billSeries') && navigator.onLine === false) V.toast('Offline: the bill number will be added automatically when internet is back.');
      });
    };
  })();

  /* ---------- Admin Edit Ledger: same invoice details ---------- */
  function injectEdit() {
    var m = $('editLedgerModal'), card = m && m.querySelector('.auth-card'); if (!card || $('tt41EmBox')) return;
    var anchor = $('editLedgerPrevDueBox'); if (!anchor) return;
    card.style.maxHeight = '92vh'; card.style.overflowY = 'auto';
    var box = document.createElement('div'); box.id = 'tt41EmBox';
    box.innerHTML = '<div class="tt41-bn" style="margin-bottom:8px;"><div id="tt41EmNo"></div></div><details class="tt41-dt"><summary>📋 Invoice details <small>(prints on the bill)</small></summary>' + metaHtml('tt41Em_') + '</details>';
    anchor.parentNode.insertBefore(box, anchor);
  }
  (function () {
    var o = window.openAdminEditLedgerModal; if (typeof o !== 'function') return;
    window.openAdminEditLedgerModal = function (id) {
      var r = o.apply(this, arguments);
      try { injectEdit(); var ord = orderById(id); if (ord) { fillMeta('tt41Em_', ord.invMeta); $('tt41EmNo').innerHTML = '🧾 Bill no.: <b>' + H(ord.invoiceNo || ord.id) + '</b>' + (ord.invoiceNo ? '' : ' <small>(old bill – keeps its Ref number)</small>'); } } catch (e) { console.warn(e); }
      return r;
    };
    var s = window.saveAdminLedgerInvoice;
    if (typeof s === 'function') window.saveAdminLedgerInvoice = function () {
      var id = ($('editLedgerInvId') || {}).value, meta = $('tt41EmBox') ? readMeta('tt41Em_') : null, full = $('tt41EmBox') ? true : false;
      var r = s.apply(this, arguments);
      try {
        var ord = orderById(id);
        if (ord && full) {
          var cur = Object.assign({}, ord.invMeta || {}), nm = {}; META.forEach(function (m) { if (meta[m[0]]) nm[m[0]] = meta[m[0]]; });
          if (JSON.stringify(cur) !== JSON.stringify(nm)) { ord.invMeta = nm; setStored('ORDERS', ordersData); }
        }
      } catch (e) { console.warn(e); }
      return r;
    };
  })();
  /* ---------- Collect Due: extra payment photos ---------- */
  (function () {
    var oc = window.collectDuePayment;
    if (typeof oc === 'function') window.collectDuePayment = function () { var r = oc.apply(this, arguments); try { injectExtras(); SETS.co.reset(); } catch (e) { console.warn(e); } return r; };
    var ox = window.executeConfirmedPaymentCollection;
    if (typeof ox === 'function') window.executeConfirmedPaymentCollection = function () {
      var id = ($('pendingCollectOrderId') || {}).value, o = orderById(id), n0 = o && Array.isArray(o.payments) ? o.payments.length : 0, extra = SETS.co.list.slice();
      return Promise.resolve(ox.apply(this, arguments)).then(function (r) {
        try {
          if (o && Array.isArray(o.payments) && o.payments.length > n0) {
            if (extra.length) { var last = o.payments[o.payments.length - 1]; last.photos = extra; o.lastPaymentProofs = extra; setStored('ORDERS', ordersData); }
            else if (o.lastPaymentProofs) { delete o.lastPaymentProofs; }
            SETS.co.reset();
          }
        } catch (e) { console.warn(e); }
        return r;
      });
    };
  })();
  document.addEventListener('DOMContentLoaded', function () { injectDelivery(); injectEdit(); injectExtras(); });
  if (document.readyState !== 'loading') { injectDelivery(); injectEdit(); injectExtras(); }
})();
