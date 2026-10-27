/* TTESPL ERP v43.3 - CUSTOMER PAYMENT CLAIMS
   A customer pays by UPI, then taps "I have paid" on the bill / account page and sends amount + UTR.
   Every staff phone gets a notification; only the ADMIN can verify (records the payment in the bill) or reject.
   Nothing is recorded as paid until the Admin verifies it in the bank. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var H = X.H, ID = 'ttClaims', DET = 'ttClaimOne', SEEN = 'TTESPL_CLAIMS_SEEN';
  function $(i) { return document.getElementById(i); }
  function N(x) { var v = parseFloat(x); return isNaN(v) ? 0 : v; }
  function R2(x) { return Math.round((N(x) + Number.EPSILON) * 100) / 100; }
  function rs(n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function orders() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function custs() { return (typeof customerDatabase !== 'undefined' && customerDatabase) || []; }
  function claims() { return X.list('PAYMENT_CLAIMS') || []; }
  function inv(o) { try { return window.ttInvNo ? ttInvNo(o) : o.id; } catch (e) { return o.id; } }
  function p10(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
  function low(s) { return String(s || '').trim().toLowerCase(); }
  function due(o) { return Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount))); }
  function dOf(o) { return String(o.deliveredDate || o.orderDate || '').slice(0, 10); }
  function pending() { return claims().filter(function (c) { return c && c.status === 'new'; }); }
  window.ttClaimsPending = function () { return pending().length; };
  function when(c) { try { return new Date(c.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(c.at || '').slice(0, 16); } }

  /* the customer / order a claim belongs to */
  function resolve(c) {
    var cust = null, ord = null, list = [];
    if (c.kind === 'bill') { ord = orders().filter(function (o) { return o && o.pubToken === c.tk; })[0] || null; if (ord) cust = custOfOrder(ord); }
    else { cust = custs().filter(function (x) { return x && x.pubToken === c.tk; })[0] || null; }
    if (cust) list = custOrders(cust); else if (ord) list = [ord];
    var pick = c.ord ? orders().filter(function (o) { return String(o.id) === String(c.ord); })[0] : null; if (pick) ord = pick;
    return { cust: cust, ord: ord, orders: list };
  }
  function custOfOrder(o) { var ph = p10(o.phone), nm = low(o.customerName); return custs().filter(function (c) { return c && ((ph && p10(c.phone) === ph) || (nm && low(c.name) === nm)); })[0] || null; }
  function custOrders(c) {
    var ph = {}, nm = {}; if (c.phone) ph[p10(c.phone)] = 1; if (c.name) nm[low(c.name)] = 1;
    (c.contacts || []).forEach(function (k) { if (k && k.phone) ph[p10(k.phone)] = 1; }); (c.aliases || []).forEach(function (a) { if (a) nm[low(a)] = 1; });
    return orders().filter(function (o) { return o && o.status !== 'Cancelled' && (nm[low(o.customerName)] || (p10(o.phone) && ph[p10(o.phone)])); });
  }
  function nameOf(c, r) { return (r.cust && r.cust.name) || (r.ord && r.ord.customerName) || c.name || c.by || 'Customer'; }
  function utrUsed(utr, exceptId) {
    var u = String(utr || '').toUpperCase(); if (!u) return '';
    var hit = ''; orders().forEach(function (o) { (o.payments || []).forEach(function (p) { if (p && p.utr && String(p.utr).toUpperCase() === u) hit = 'bill ' + inv(o); }); });
    claims().forEach(function (c) { if (c && c.id !== exceptId && c.status === 'verified' && String(c.utr).toUpperCase() === u) hit = hit || 'an earlier claim'; });
    return hit;
  }
  /* oldest-first allocation: the picked bill first, then the other dues */
  function allocate(r, amount, firstId) {
    var list = r.orders.filter(function (o) { return o.status !== 'Cancelled' && due(o) > 0.009; }).sort(function (a, b) { return dOf(a).localeCompare(dOf(b)); });
    if (firstId) list.sort(function (a, b) { return (String(a.id) === String(firstId) ? -1 : 0) - (String(b.id) === String(firstId) ? -1 : 0); });
    var left = R2(amount), out = [];
    list.forEach(function (o) { if (left <= 0.009) return; var a = Math.min(left, due(o)); if (a > 0.009) { out.push({ o: o, a: R2(a) }); left = R2(left - a); } });
    return { rows: out, extra: left };
  }

  /* ---------- notification when a new claim arrives ---------- */
  function seen() { try { return JSON.parse(localStorage.getItem(SEEN) || 'null'); } catch (e) { return null; } }
  function mark(ids) { try { localStorage.setItem(SEEN, JSON.stringify(ids.slice(-400))); } catch (e) {} }
  function watch() {
    if (!window.ttCloudInitialLoadDone) return;
    var ids = claims().map(function (c) { return c && c.id; }).filter(Boolean), s = seen();
    if (!s) { mark(ids); return; }
    var fresh = pending().filter(function (c) { return s.indexOf(c.id) < 0; });
    if (fresh.length) {
      mark(ids);
      fresh.slice(0, 3).forEach(function (c) { var r = resolve(c); X.toast('💳 ' + nameOf(c, r) + ' says ' + rs(c.amt) + ' paid (UTR ' + String(c.utr).slice(-6) + ')'); });
      try { if (window.playCoinSound) playCoinSound(); } catch (e) {}
      try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) {}
    }
    refreshBadge(); try { if (window.ttRenderHome) ttRenderHome(); } catch (e) {}
    var o = $(ID); if (o && o.style.display !== 'none') draw();
  }
  setInterval(watch, 5000); setTimeout(watch, 3000);

  /* ---------- list ---------- */
  function row(c) {
    var r = resolve(c), st = c.status === 'verified' ? '<span style="color:var(--success)">✅ verified</span>' : c.status === 'rejected' ? '<span style="color:var(--danger)">✖ rejected</span>' : '<span style="color:#d97706">⏳ to verify</span>';
    return '<div class="ttx-row" data-a="open" data-p="' + H(c.id) + '" style="cursor:pointer;display:flex;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(128,128,128,.22)"><div style="flex:1;min-width:0"><b>' + H(nameOf(c, r)) + '</b><br><small style="opacity:.75">UTR ' + H(c.utr) + ' · ' + H(when(c)) + (r.ord ? ' · ' + H(inv(r.ord)) : '') + '</small></div><div style="text-align:right"><b>' + rs(c.amt) + '</b><br><small>' + st + '</small></div></div>';
  }
  function draw() {
    var all = claims().slice().sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); }), p = all.filter(function (c) { return c.status === 'new'; }), done = all.filter(function (c) { return c.status !== 'new'; }).slice(0, 25);
    var h = (X.isAdm() ? '' : '<div class="ttx-note">Only the Admin can verify a payment. You can see the claims here.</div>') +
      '<div class="ttx-note"><b>' + p.length + '</b> waiting for verification</div>' + (p.map(row).join('') || '<div class="ttx-note" style="opacity:.8">No pending claims.</div>') +
      (done.length ? '<div class="ttx-note" style="margin-top:12px"><b>Earlier</b></div>' + done.map(row).join('') : '');
    X.sheet(ID, '💳 Payment claims', h, { z: 3900 });
    X.bind(ID, { click: { open: function (id) { one(id); } } });
  }
  window.ttOpenClaims = draw;

  /* ---------- one claim ---------- */
  function one(id) {
    var c = claims().filter(function (x) { return x && x.id === id; })[0]; if (!c) return;
    var r = resolve(c), adm = X.isAdm(), nm = nameOf(c, r), isNew = c.status === 'new';
    var dues = r.orders.filter(function (o) { return o.status !== 'Cancelled' && due(o) > 0.009; });
    var sel = '<select id="clmBill" style="width:100%">' + (dues.map(function (o) { return '<option value="' + H(o.id) + '"' + (r.ord && String(r.ord.id) === String(o.id) ? ' selected' : '') + '>' + H(inv(o)) + ' · pending ' + rs(due(o)) + '</option>'; }).join('') || '<option value="">No pending bill found</option>') + '</select>';
    var used = utrUsed(c.utr, c.id);
    var h = '<div class="ttx-note"><b>' + H(nm) + '</b> says they paid <b>' + rs(c.amt) + '</b><br>UTR / ref: <b>' + H(c.utr) + '</b>' + (c.by ? '<br>Sent by: ' + H(c.by) : '') + '<br><small>' + H(when(c)) + (c.kind === 'portal' ? ' · from the account page' : ' · from the bill page') + '</small></div>' +
      (used && isNew ? '<div class="ttx-note" style="color:#dc2626"><b>⚠ This UTR is already recorded in ' + H(used) + '.</b> Do not record it again.</div>' : '');
    if (isNew && adm) {
      h += '<div class="ttx-note" style="margin-top:8px"><b>Step 1.</b> Open your bank / UPI app and check this UTR and amount really came in.</div>' +
        '<label style="font-size:12.5px">Amount received in bank (₹)</label><input id="clmAmt" type="number" step="0.01" value="' + N(c.amt) + '" style="width:100%">' +
        '<label style="font-size:12.5px;display:block;margin-top:6px">Apply to bill (extra goes to the next oldest dues)</label>' + sel + '<div id="clmPlan" class="ttx-note" style="margin-top:8px;font-size:12.5px"></div>' +
        '<div class="ttx-btns" style="flex-wrap:wrap"><button class="ttx-b pri" data-a="ok" style="flex:1 1 100%">✅ Verified – record payment</button><button class="ttx-b" data-a="no" style="flex:1 1 48%;color:#dc2626">✖ Not received</button><button class="ttx-b" data-a="back" style="flex:1 1 48%">‹ Back</button></div>';
    } else if (isNew) {
      h += '<div class="ttx-note">Waiting for the Admin to verify.</div><div class="ttx-btns"><button class="ttx-b" data-a="back">‹ Back</button></div>';
    } else {
      h += '<div class="ttx-note">' + (c.status === 'verified' ? '✅ Verified by ' + H(c.vby || '') + ' · applied ' + (c.applied || []).map(function (a) { return H(a.no) + ' ' + rs(a.a); }).join(', ') : '✖ Rejected by ' + H(c.vby || '') + (c.reason ? ' – ' + H(c.reason) : '')) + '</div><div class="ttx-btns"><button class="ttx-b" data-a="back">‹ Back</button></div>';
    }
    X.sheet(DET, '💳 ' + (isNew ? 'Verify payment' : 'Claim'), h, { z: 4000 });
    function plan() {
      var el = $('clmPlan'); if (!el) return; var a = N(($('clmAmt') || {}).value), first = ($('clmBill') || {}).value, p = allocate(r, a, first);
      el.innerHTML = a > 0 ? (p.rows.length ? '<b>Will be recorded:</b><br>' + p.rows.map(function (x) { return '• ' + H(inv(x.o)) + ' ← ' + rs(x.a); }).join('<br>') + (p.extra > 0.009 ? '<br><span style="color:#d97706">' + rs(p.extra) + ' is more than all dues - it will NOT be recorded.</span>' : '') : '<span style="color:#dc2626">No pending bill to apply this to.</span>') : '';
    }
    var root = $(DET); if (root) { root.oninput = plan; root.onchange = plan; } plan();
    X.bind(DET, { click: {
      back: function () { X.close(DET); draw(); },
      no: function () { var why = prompt('Reason (optional) – e.g. "amount not received"', '') || ''; save(c, { status: 'rejected', reason: why.slice(0, 120), vby: X.me(), vat: new Date().toISOString() }); X.toast('Claim rejected'); X.close(DET); draw(); },
      ok: function () {
        if (!X.isAdm()) return X.toast('Only the Admin can verify', 1);
        var amt = R2(N(($('clmAmt') || {}).value)), first = ($('clmBill') || {}).value, u2 = utrUsed(c.utr, c.id);
        if (!(amt > 0)) return X.toast('Enter the amount received', 1);
        if (u2 && !confirm('This UTR is already recorded in ' + u2 + '. Record it AGAIN?')) return;
        var p = allocate(r, amt, first); if (!p.rows.length) return X.toast('No pending bill to apply this to', 1);
        if (!confirm('Record ' + rs(amt - p.extra) + ' as UPI payment received from ' + nm + '?\nUTR ' + c.utr)) return;
        var applied = [];
        p.rows.forEach(function (x) {
          var o = x.o; o.payments = Array.isArray(o.payments) ? o.payments : [];
          var pay = { amount: x.a, mode: 'UPI', at: (window.getNowStr ? getNowStr() : new Date().toISOString().slice(0, 16).replace('T', ' ')), by: X.me(), utr: String(c.utr), claimId: c.id, note: 'Verified customer claim' };
          o.payments.push(pay); o.recvAmount = R2(N(o.recvAmount) + x.a); o.dueAmount = Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount)));
          o.lastPaymentDate = new Date().toISOString().slice(0, 10); o.payMode = 'UPI';
          o.auditTrail = o.auditTrail || []; o.auditTrail.unshift({ by: X.me(), time: pay.at, note: 'UPI ₹' + x.a + ' verified (customer claim, UTR ' + c.utr + ')' });
          if (window.ttV41 && ttV41.assignPending) pay.needRno = true;
          applied.push({ ord: o.id, no: inv(o), a: x.a });
        });
        setStored('ORDERS', ordersData);
        try { if (window.ttV41 && ttV41.assignPending) setTimeout(ttV41.assignPending, 400); } catch (e) {}
        save(c, { status: 'verified', vby: X.me(), vat: new Date().toISOString(), applied: applied, amtOk: amt });
        try { renderBilling && renderBilling('all'); renderDashboard && renderDashboard(); } catch (e) {}
        try { if (window.cloudSync && cloudSync.pushLiveNotification) cloudSync.pushLiveNotification({ title: '💰 Payment verified', body: rs(amt - p.extra) + ' UPI received from ' + nm, type: 'payment' }); } catch (e) {}
        X.toast('Payment recorded'); X.close(DET);
        var first0 = p.rows[0].o;
        if (window.ttOpenCustomerWA && confirm('Payment recorded.\nSend the “Payment received” WhatsApp message to the customer now?')) ttOpenCustomerWA(first0.id, 'payment', { amt: p.rows[0].a, mode: 'UPI' });
        else draw();
      }
    } });
  }
  function save(c, patch) { var n = Object.assign({}, c, patch); X.upsert('PAYMENT_CLAIMS', n); if (window.ttPubRefresh) ttPubRefresh(); refreshBadge(); }

  /* ---------- menu badge ---------- */
  function refreshBadge() { var b = document.querySelector('.tt43-cm .tt43-cb'); var n = pending().length; if (b) { b.textContent = n ? n + ' new' : ''; b.style.display = n ? '' : 'none'; } }
  function inject() {
    try {
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt43-cm')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt43-cm'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenClaims(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>💳</span><span>Payment Claims</span></div><span class="tt43-cb" style="font-size:10px;font-weight:800;color:#fff;background:#dc2626;border-radius:999px;padding:2px 8px;display:none"></span>';
        list.appendChild(d); refreshBadge();
      }
    } catch (e) {}
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);
})();
