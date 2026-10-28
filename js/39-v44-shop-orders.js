/* TTESPL ERP v44 - ONLINE ORDERS + MACHINE ENQUIRIES (from shop.html)
   Customer orders land in Firestore (shop_orders / shop_enquiries). Every staff phone gets a toast; staff confirm, pack, ship; Admin verifies the UPI UTR
   and one tap turns the order into a normal ERP bill (stock goes down when that bill is delivered, as always). Enquiries become Leads. */
(function () {
  'use strict';
  var X = window.ttx, T = window.TTSHOP; if (!X || !T) return;
  var H = X.H, N = T.N, R2 = T.R2, ID = 'ttShopOrders', DET = 'ttShopOrder', EQ = 'ttShopEnq', SEEN = 'TTESPL_SHOP_SEEN';
  function $(i) { return document.getElementById(i); }
  function rs(n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function orders() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function custs() { return (typeof customerDatabase !== 'undefined' && customerDatabase) || []; }
  function stock() { return (typeof sampleInventory !== 'undefined' && sampleInventory) || []; }
  function sos() { return X.list('SHOP_ORDERS') || []; }
  function enqs() { return X.list('SHOP_ENQ') || []; }
  function p10(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
  function inv(o) { try { return window.ttInvNo ? ttInvNo(o) : o.id; } catch (e) { return o.id; } }
  function items(so) { try { return JSON.parse(so.ij || '[]'); } catch (e) { return []; } }
  function when(s) { try { return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(s || '').slice(0, 16); } }
  function newO() { return sos().filter(function (o) { return o && o.status === 'new'; }); }
  function newE() { return enqs().filter(function (e) { return e && e.status === 'new'; }); }
  window.ttShopPending = function () { return newO().length + newE().length; };
  var STAT = { new: ['🆕', 'New'], confirmed: ['✅', 'Confirmed'], packed: ['📦', 'Packed'], shipped: ['🚚', 'Shipped'], delivered: ['🏁', 'Delivered'], cancelled: ['✖', 'Cancelled'] };
  var NEXT = { new: 'confirmed', confirmed: 'packed', packed: 'shipped', shipped: 'delivered' };
  var NEXTL = { confirmed: '✅ Confirm order', packed: '📦 Mark packed', shipped: '🚚 Mark shipped', delivered: '🏁 Mark delivered' };
  function linked(so) { return so.lnk ? orders().filter(function (o) { return String(o.id) === String(so.lnk); })[0] || null : null; }
  /* what the customer should see: the ERP bill status wins once a bill exists */
  function effStatus(so) { var b = linked(so); if (b && b.status === 'Delivered' && so.status !== 'cancelled') return 'delivered'; if (b && b.status === 'Cancelled') return 'cancelled'; return so.status || 'new'; }
  function isPaid(so) { var b = linked(so); return !!so.paidOk || !!(b && N(b.totalAmount) > 0 && N(b.recvAmount) >= N(b.totalAmount) - 0.5); }

  /* ---------- live price check against current ERP prices ---------- */
  function priceCheck(so) {
    var prods = {}, lines = [];
    items(so).forEach(function (it) { var i = stock().filter(function (x) { return String(x.id) === String(it.pid); })[0]; if (!i || !window.ttShopPubProd) return; prods[it.pid] = ttShopPubProd(i); lines.push({ pid: it.pid, q: it.q }); });
    if (lines.length !== items(so).length) return { missing: true };
    var cfg = window.ttShopCfg ? ttShopCfg() : {}, pc = { ship: { odisha: N(cfg.shipO), india: N(cfg.shipI) }, freeAbove: N(cfg.freeAbove), coupons: cfg.coupons || [] };
    var c = T.calc(lines, prods, pc, { coupon: so.coupon, area: so.area });
    return { total: c.total, diff: R2(N(so.total) - c.total) };
  }

  /* ---------- notification when a new order / enquiry arrives ---------- */
  function seen() { try { return JSON.parse(localStorage.getItem(SEEN) || 'null'); } catch (e) { return null; } }
  function mark(a) { try { localStorage.setItem(SEEN, JSON.stringify(a.slice(-500))); } catch (e) {} }
  function watch() {
    if (!window.ttCloudInitialLoadDone) return;
    var ids = sos().concat(enqs()).map(function (x) { return x && x.id; }).filter(Boolean), s = seen();
    if (!s) { mark(ids); }
    try { backfillOnline(); } catch (e) {}
    if (!s) return;
    var fo = newO().filter(function (o) { return s.indexOf(o.id) < 0; }), fe = newE().filter(function (e) { return s.indexOf(e.id) < 0; });
    if (fo.length || fe.length) {
      mark(ids);
      try { addOnlineCusts(fo.map(function (o) { return o.phone; }).concat(fe.map(function (e) { return e.phone; }))); } catch (e) {}
      fo.slice(0, 3).forEach(function (o) { X.toast('🛒 New online order ' + (o.no || '') + ' – ' + (o.name || '') + ' ' + rs(o.total)); });
      fe.slice(0, 3).forEach(function (e) { X.toast('📝 Machine enquiry – ' + (e.name || '') + ' for ' + (e.pn || '')); });
      try { if (window.playOrderPlacedSound) playOrderPlacedSound(); else if (window.playCoinSound) playCoinSound(); } catch (e) {}
      try { if (navigator.vibrate) navigator.vibrate([150, 70, 150]); } catch (e) {}
    }
    badge(); try { if (window.ttRenderHome) ttRenderHome(); } catch (e) {}
    var o = $(ID); if (o && o.style.display !== 'none') draw(true);
    publishTracks();
  }
  setInterval(watch, 5000); setTimeout(watch, 3000);

  /* ---------- tracking pages (public, one per order) ---------- */
  var TK = 'TTESPL_SHOP_TRK';
  function publishTracks() {
    if (!window.cloudSync || !cloudSync.putPublic) return; var h; try { h = JSON.parse(localStorage.getItem(TK) || '{}'); } catch (e) { h = {}; }
    var ch = false;
    sos().forEach(function (so) {
      if (!so || !so.id || !(window.ttShopCfg && ttShopCfg().pub)) return;
      var st = effStatus(so), snap = { no: so.no, st: st, at: so.at, name: String(so.name || '').split(' ')[0], it: items(so).map(function (i) { return { n: i.n, q: i.q, t: i.t }; }), cd: N(so.cdisc), sh: N(so.ship), total: N(so.total), pay: so.pay, paid: isPaid(so), note: so.pnote || '' };
      var j = JSON.stringify(snap), hh = String(j.length) + ':' + j.split('').reduce(function (a, c) { return (a * 31 + c.charCodeAt(0)) | 0; }, 7);
      if (h[so.id] === hh) return; h[so.id] = hh; ch = true;
      cloudSync.putPublic('shop_track', so.id, { j: j }).catch(function () { delete h[so.id]; });
    });
    if (ch) { try { localStorage.setItem(TK, JSON.stringify(h)); } catch (e) {} }
  }
  window.ttShopPubTracks = publishTracks;
  (function () { var f = window.setStored; if (typeof f !== 'function' || f.__shopo) return; var w = function (k) { var r = f.apply(this, arguments); if (k === 'SHOP_ORDERS' || k === 'ORDERS') setTimeout(publishTracks, 1500); return r; }; w.__shopo = 1; window.setStored = w; try { setStored = w; } catch (e) {} })();

  /* ---------- list ---------- */
  var TAB = 'orders';
  function orow(so) {
    var st = STAT[effStatus(so)] || STAT.new, pd = isPaid(so);
    return '<div class="ttx-row" data-a="open" data-p="' + H(so.id) + '" style="cursor:pointer;display:flex;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(128,128,128,.22)"><div style="flex:1;min-width:0"><b>' + H(so.name) + '</b> <small style="opacity:.7">' + H(so.no || '') + '</small><br><small style="opacity:.75">' + H(when(so.at)) + ' · ' + items(so).length + ' item(s) · ' + (pd ? '✅ paid' : (so.pay === 'upi' ? '⏳ UTR ' + H(String(so.utr || '').slice(-6)) : '📞 call to confirm')) + '</small></div><div style="text-align:right"><b>' + rs(so.total) + '</b><br><small>' + st[0] + ' ' + st[1] + '</small></div></div>';
  }
  function erow(e) {
    var d = { new: '🆕 New', contacted: '📞 Contacted', lead: '🎯 Lead made', closed: '✔ Closed' }[e.status] || e.status;
    return '<div class="ttx-row" data-a="eopen" data-p="' + H(e.id) + '" style="cursor:pointer;display:flex;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(128,128,128,.22)"><div style="flex:1;min-width:0"><b>' + H(e.name) + '</b> <small style="opacity:.7">' + H(e.city || '') + '</small><br><small style="opacity:.75">' + H(e.pn) + ' · ' + H(when(e.at)) + '</small></div><div style="text-align:right"><small>' + d + '</small></div></div>';
  }
  function draw(keep) {
    var all = sos().slice().sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); }), en = enqs().slice().sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    var act = all.filter(function (o) { var s = effStatus(o); return s !== 'delivered' && s !== 'cancelled'; }), done = all.filter(function (o) { var s = effStatus(o); return s === 'delivered' || s === 'cancelled'; }).slice(0, 25);
    var tabs = '<div class="ttx-btns" style="margin-bottom:8px"><button class="ttx-b ' + (TAB === 'orders' ? 'pri' : '') + '" data-a="tab" data-p="orders" style="flex:1">🛒 Orders (' + newO().length + ' new)</button><button class="ttx-b ' + (TAB === 'enq' ? 'pri' : '') + '" data-a="tab" data-p="enq" style="flex:1">📝 Enquiries (' + newE().length + ' new)</button></div>';
    var h = tabs;
    if (TAB === 'orders') {
      h += (act.map(orow).join('') || '<div class="ttx-note" style="opacity:.8">No open online orders.</div>') + (done.length ? '<div class="ttx-note" style="margin-top:12px"><b>Earlier</b></div>' + done.map(orow).join('') : '');
    } else {
      h += (en.slice(0, 60).map(erow).join('') || '<div class="ttx-note" style="opacity:.8">No machine enquiries yet.</div>');
    }
    h += '<div class="ttx-btns" style="margin-top:10px"><button class="ttx-b" data-a="store" style="flex:1">🏪 Store settings</button></div>';
    X.sheet(ID, '🛒 Online Orders', h, { z: 3900 });
    X.bind(ID, { click: { tab: function (t) { TAB = t; draw(); }, open: one, eopen: enq, store: function () { window.ttOpenShop && ttOpenShop(); } } });
  }
  window.ttOpenOnline = function () { draw(); };
  window.ttShopOpenOrder = function (id) { one(id); };

  /* ---------- one order ---------- */
  function utrUsed(utr, exceptId) {
    var u = String(utr || '').toUpperCase(); if (!u) return '';
    var hit = ''; orders().forEach(function (o) { (o.payments || []).forEach(function (p) { if (p && p.utr && String(p.utr).toUpperCase() === u) hit = 'bill ' + inv(o); }); });
    sos().forEach(function (s) { if (s && s.id !== exceptId && s.paidOk && String(s.utr || '').toUpperCase() === u) hit = hit || 'online order ' + (s.no || ''); });
    X.list('PAYMENT_CLAIMS').forEach(function (c) { if (c && c.status === 'verified' && String(c.utr).toUpperCase() === u) hit = hit || 'an earlier claim'; });
    return hit;
  }
  function save(so, patch, note) {
    var n = Object.assign({}, so, patch); n.hist = (n.hist || []).concat([{ at: new Date().toISOString(), by: X.me(), act: note || patch.status || 'edit' }]).slice(-40);
    X.upsert('SHOP_ORDERS', n); setTimeout(publishTracks, 800); badge(); return n;
  }
  function waLink(so, text) { var p = '91' + p10(so.phone); return 'https://wa.me/' + p + '?text=' + encodeURIComponent(text); }
  function msgFor(so, st) {
    var nm = String(so.name || '').split(' ')[0], base = (window.ttShopUrl ? ttShopUrl() : '') + '?t=' + so.id;
    var t = { confirmed: 'Hello ' + nm + ', your order ' + so.no + ' (' + rs(so.total) + ') is confirmed ✅', packed: 'Hello ' + nm + ', your order ' + so.no + ' is packed 📦 and will be dispatched soon.', shipped: 'Hello ' + nm + ', your order ' + so.no + ' has been shipped 🚚.' + (so.pnote ? '\n' + so.pnote : ''), delivered: 'Hello ' + nm + ', your order ' + so.no + ' is delivered 🏁. Thank you for shopping with TTESPL!', cancelled: 'Hello ' + nm + ', your order ' + so.no + ' has been cancelled.' + (so.pnote ? '\n' + so.pnote : ''), pay: 'Hello ' + nm + ', we received your payment ✅ for order ' + so.no + '. Thank you!' }[st] || 'Update on your order ' + so.no;
    return t + '\nTrack: ' + base + '\n*TTESPL, Bhubaneswar*';
  }
  function one(id) {
    var so = sos().filter(function (x) { return x && x.id === id; })[0]; if (!so) return;
    var adm = X.isAdm(), st = effStatus(so), b = linked(so), its = items(so), chk = priceCheck(so), used = so.utr ? utrUsed(so.utr, so.id) : '', pd = isPaid(so);
    var h = '<div class="ttx-note"><b>' + H(so.name) + '</b> · ' + H(so.no) + '<br><small>' + H(when(so.at)) + ' · ' + (STAT[st] || STAT.new).join(' ') + '</small><br>📞 <a href="tel:' + H(so.phone) + '">' + H(so.phone) + '</a>' + (so.email ? ' · ' + H(so.email) : '') + '<br>📍 ' + H(so.addr) + ', ' + H(so.city) + ' ' + H(so.pin) + ', ' + H(so.state) + (so.gst ? '<br>GSTIN <b>' + H(so.gst) + '</b>' : '') + (so.note ? '<br>📝 ' + H(so.note) : '') + '</div>';
    h += '<div class="ttx-note">' + its.map(function (i) { return '• ' + H(i.n) + ' × ' + H(i.q) + ' = ' + rs(i.t); }).join('<br>') + '<br>' + (N(so.cdisc) > 0 ? 'Coupon ' + H(so.coupon) + ': − ' + rs(so.cdisc) + '<br>' : '') + 'Delivery: ' + (N(so.ship) ? rs(so.ship) : 'FREE') + ' (' + (so.area === 'india' ? 'rest of India' : 'Odisha') + ')<br><b>Total ' + rs(so.total) + '</b></div>';
    if (chk.missing) h += '<div class="ttx-note" style="color:#d97706">⚠ One or more products are no longer in stock list – check before accepting.</div>';
    else if (Math.abs(chk.diff) > 1) h += '<div class="ttx-note" style="color:#dc2626"><b>⚠ Price differs from your current online price.</b><br>Customer total ' + rs(so.total) + ' vs current ' + rs(chk.total) + '. Prices may have changed after the customer opened the page – check before confirming.</div>';
    h += '<div class="ttx-note">' + (so.pay === 'upi' ? '💳 UPI · UTR <b>' + H(so.utr) + '</b> · ' + (pd ? '✅ verified' : '⏳ not verified yet') : '📞 Customer chose “confirm by call” – no payment yet.') + '</div>';
    if (used && !pd) h += '<div class="ttx-note" style="color:#dc2626"><b>⚠ This UTR is already recorded in ' + H(used) + '.</b></div>';
    if (b) h += '<div class="ttx-note">🧾 ERP bill: <b>' + H(inv(b)) + '</b> · ' + H(b.status || '') + ' · received ' + rs(b.recvAmount) + ' of ' + rs(b.totalAmount) + '</div>';
    h += '<label style="font-size:12.5px;display:block">Message shown to customer on tracking page (courier name / LR no. etc.)</label><input id="shopPN" value="' + H(so.pnote || '') + '" placeholder="e.g. Sent by DTDC, LR 123456" style="width:100%">';
    h += '<div class="ttx-btns" style="flex-wrap:wrap;margin-top:8px">';
    if (st !== 'cancelled' && st !== 'delivered' && NEXT[st]) h += '<button class="ttx-b pri" data-a="next" style="flex:1 1 100%">' + NEXTL[NEXT[st]] + '</button>';
    if (!b && st !== 'cancelled') h += '<button class="ttx-b" data-a="bill" style="flex:1 1 100%">🧾 Create ERP bill (so stock & GST invoice work)</button>';
    if (so.pay === 'upi' && !pd && adm && st !== 'cancelled') h += '<button class="ttx-b pri" data-a="verify" style="flex:1 1 100%">✅ UTR verified in bank – record payment</button>';
    if (so.pay === 'upi' && !pd && !adm) h += '<div class="ttx-note" style="flex:1 1 100%">Only the Admin can verify payment.</div>';
    h += '<a class="ttx-b" style="flex:1 1 48%;text-align:center;text-decoration:none" href="' + H(waLink(so, msgFor(so, st))) + '" target="_blank" rel="noopener">💬 WhatsApp update</a>';
    h += '<button class="ttx-b" data-a="savepn" style="flex:1 1 48%">💾 Save note</button>';
    if (st !== 'cancelled' && st !== 'delivered') h += '<button class="ttx-b" data-a="cancel" style="flex:1 1 48%;color:#dc2626">✖ Cancel order</button>';
    h += '<button class="ttx-b" data-a="back" style="flex:1 1 ' + (st !== 'cancelled' && st !== 'delivered' ? '48' : '100') + '%">‹ Back</button></div>';
    X.sheet(DET, '🛒 Online order', h, { z: 4000 });
    X.bind(DET, { click: {
      back: function () { X.close(DET); draw(); },
      savepn: function () { so = save(so, { pnote: ($('shopPN').value || '').slice(0, 200) }, 'note'); X.toast('Saved'); },
      next: function () {
        var ns = NEXT[st]; so = save(so, { status: ns, pnote: ($('shopPN').value || so.pnote || '').slice(0, 200) }, ns); X.toast('Marked ' + ns);
        if (confirm('Send WhatsApp update to ' + so.name + '?')) window.open(waLink(so, msgFor(so, ns)), '_blank');
        one(id);
      },
      cancel: function () { var why = prompt('Reason for the customer (optional)', '') || ''; if (!confirm('Cancel this order?')) return; var bb = linked(so); if (bb && bb.status !== 'Delivered' && bb.status !== 'Cancelled' && confirm('Also cancel the ERP bill ' + inv(bb) + '?')) { bb.status = 'Cancelled'; setStored('ORDERS', orders()); } so = save(so, { status: 'cancelled', pnote: why.slice(0, 200) }, 'cancelled'); X.toast('Order cancelled'); one(id); },
      bill: function () { var r = makeBill(so); if (r) { so = save(so, { lnk: r.id }, 'bill ' + inv(r)); X.toast('Bill ' + inv(r) + ' created'); one(id); } },
      verify: function () {
        if (!X.isAdm()) return X.toast('Only the Admin can verify', 1);
        var u2 = utrUsed(so.utr, so.id); if (u2 && !confirm('This UTR is already recorded in ' + u2 + '. Record it AGAIN?')) return;
        var amt = R2(N(prompt('Amount received in bank (₹)', so.total)));
        if (!(amt > 0)) return; if (!confirm('Record ' + rs(amt) + ' UPI received from ' + so.name + '?\nUTR ' + so.utr)) return;
        var bb = linked(so) || makeBill(so); if (!bb) return;
        bb.payments = Array.isArray(bb.payments) ? bb.payments : [];
        var now = window.getNowStr ? getNowStr() : new Date().toISOString().slice(0, 16).replace('T', ' ');
        var pay = { amount: amt, mode: 'UPI', at: now, by: X.me(), utr: String(so.utr), note: 'Online store order ' + so.no }; if (window.ttV41 && ttV41.assignPending) pay.needRno = true;
        bb.payments.push(pay); bb.recvAmount = R2(N(bb.recvAmount) + amt); bb.dueAmount = Math.max(0, R2(N(bb.totalAmount) - N(bb.recvAmount))); bb.lastPaymentDate = new Date().toISOString().slice(0, 10); bb.payMode = 'UPI / QR Code';
        bb.auditTrail = bb.auditTrail || []; bb.auditTrail.unshift({ by: X.me(), time: now, note: 'UPI ₹' + amt + ' verified (online order ' + so.no + ', UTR ' + so.utr + ')' });
        setStored('ORDERS', orders()); try { if (window.ttV41 && ttV41.assignPending) setTimeout(ttV41.assignPending, 400); } catch (e) {}
        so = save(so, { lnk: bb.id, paidOk: true, status: so.status === 'new' ? 'confirmed' : so.status }, 'payment verified');
        try { renderBilling && renderBilling('all'); renderDashboard && renderDashboard(); } catch (e) {}
        try { if (window.cloudSync && cloudSync.pushLiveNotification) cloudSync.pushLiveNotification({ title: '💰 Online payment verified', body: rs(amt) + ' UPI from ' + so.name, type: 'payment' }); } catch (e) {}
        X.toast('Payment recorded');
        if (confirm('Send “payment received” WhatsApp to the customer?')) window.open(waLink(so, msgFor(so, 'pay')), '_blank');
        one(id);
      }
    } });
  }

  /* ---------- online order -> normal ERP bill ---------- */
  function makeBill(so) {
    var its = items(so); if (!its.length) { X.toast('No items in this order', 1); return null; }
    var cust = custs().filter(function (c) { return c && p10(c.phone) === p10(so.phone); })[0];
    if (!cust) {
      cust = { id: Date.now(), name: so.name, phone: so.phone, address: [so.addr, so.city, so.pin, so.state].filter(Boolean).join(', '), gst: so.gst || 'Unregistered', person: so.name };
      cust.source = 'online'; customerDatabase.unshift(cust); setStored('CUSTOMERS', customerDatabase);
    } else if (!cust.online && cust.source !== 'online' && (cust.online = true)) { setStored('CUSTOMERS', customerDatabase); }
    if (so.gst && (!cust.gst || cust.gst === 'Unregistered')) { cust.gst = so.gst; setStored('CUSTOMERS', customerDatabase); }
    var sub = R2(its.reduce(function (s, i) { return s + N(i.t); }, 0)), f = sub > 0 ? (sub - N(so.cdisc)) / sub : 1, run = 0, lines = [];
    its.forEach(function (it, n) {
      var p = stock().filter(function (x) { return String(x.id) === String(it.pid); })[0], q = N(it.q) || 1;
      var t = n === its.length - 1 ? R2(sub - N(so.cdisc) - run) : R2(N(it.t) * f); run = R2(run + t);
      var rate = R2(t / q), mrp = Math.max(N(p && p.rate), rate), disc = mrp > rate ? R2((1 - rate / mrp) * 100) : 0;
      lines.push({ id: p ? p.id : Date.now() + n, name: p ? p.name : it.n, hsn: (p && p.hsn) || '84139190', qty: q, mrp: mrp, disc: disc, rate: rate, total: R2(rate * q) });
    });
    var itemsTotal = R2(lines.reduce(function (s, l) { return s + l.total; }, 0)), ship = N(so.ship), total = R2(itemsTotal + ship);
    var today = X.ymd(), dd = new Date(); dd.setDate(dd.getDate() + 3);
    var o = { id: window.ttNewOrderId ? ttNewOrderId() : 'ORD-' + Date.now(), customerName: cust.name, phone: cust.phone, orderDate: today, deliveryDate: X.ymd(dd), items: lines, totalAmount: total, recvAmount: 0, dueAmount: total, payMode: 'Not Paid / Full Due',
      taxType: /odisha|orissa/i.test(so.state || 'Odisha') ? 'INTRA' : 'INTER', courierCharge: ship, status: 'Pending', bookedBy: 'Online Store', payProofs: [], webOrder: so.id, webNo: so.no, shipTo: [so.addr, so.city, so.pin].filter(Boolean).join(', ') };
    orders().unshift(o); setStored('ORDERS', orders());
    try { renderBilling && renderBilling('all'); renderOrders && renderOrders(); renderDashboard && renderDashboard(); } catch (e) {}
    return o;
  }

  /* ---------- enquiries ---------- */
  function enq(id) {
    var e = enqs().filter(function (x) { return x && x.id === id; })[0]; if (!e) return;
    var wa = 'https://wa.me/91' + p10(e.phone) + '?text=' + encodeURIComponent('Hello ' + String(e.name).split(' ')[0] + ', thank you for your enquiry about ' + e.pn + ' at TTESPL. ');
    var h = '<div class="ttx-note"><b>' + H(e.name) + '</b> · ' + H(e.city || '') + '<br>📞 <a href="tel:' + H(e.phone) + '">' + H(e.phone) + '</a><br><small>' + H(when(e.at)) + '</small></div><div class="ttx-note">Product: <b>' + H(e.pn) + '</b>' + (e.msg ? '<br>“' + H(e.msg) + '”' : '') + '</div>' +
      '<div class="ttx-btns" style="flex-wrap:wrap"><a class="ttx-b" style="flex:1 1 48%;text-align:center;text-decoration:none" href="tel:' + H(e.phone) + '">📞 Call</a><a class="ttx-b" style="flex:1 1 48%;text-align:center;text-decoration:none" href="' + H(wa) + '" target="_blank" rel="noopener">💬 WhatsApp</a>' +
      (e.status !== 'lead' ? '<button class="ttx-b pri" data-a="lead" style="flex:1 1 100%">🎯 Make a Lead (follow-up)</button>' : '<div class="ttx-note" style="flex:1 1 100%">🎯 Lead created: ' + H(e.leadId || '') + '</div>') +
      (e.status === 'new' ? '<button class="ttx-b" data-a="contacted" style="flex:1 1 48%">📞 Mark contacted</button>' : '') + (e.status !== 'closed' ? '<button class="ttx-b" data-a="closed" style="flex:1 1 48%">✔ Close</button>' : '') + '<button class="ttx-b" data-a="back" style="flex:1 1 100%">‹ Back</button></div>';
    X.sheet(EQ, '📝 Machine enquiry', h, { z: 4000 });
    function set(p) { X.upsert('SHOP_ENQ', Object.assign({}, e, p)); badge(); X.close(EQ); draw(); }
    X.bind(EQ, { click: {
      back: function () { X.close(EQ); draw(); }, contacted: function () { set({ status: 'contacted' }); }, closed: function () { set({ status: 'closed' }); },
      lead: function () {
        var cust = custs().filter(function (c) { return c && p10(c.phone) === p10(e.phone); })[0];
        if (!cust) { cust = { id: Date.now(), name: e.name, phone: e.phone, address: e.city || '', gst: 'Unregistered', person: e.name, source: 'online' }; customerDatabase.unshift(cust); setStored('CUSTOMERS', customerDatabase); }
        var p = stock().filter(function (x) { return String(x.id) === String(e.pid); })[0], fu = new Date(); fu.setDate(fu.getDate() + 1);
        var lead = { id: 'LEAD-' + Math.floor(1000 + Math.random() * 9000), customerName: cust.name, phone: cust.phone, inquiryDate: X.ymd(), handledBy: X.me(), machine: e.pn, quotedPrice: N(p && p.rate), status: 'Active Inquiry', followupDate: X.ymd(fu), remarks: 'Online enquiry' + (e.msg ? ': ' + e.msg : '') };
        leadsData.unshift(lead); setStored('LEADS', leadsData); try { renderLeads && renderLeads(); } catch (er) {}
        X.toast('Lead ' + lead.id + ' created'); set({ status: 'lead', leadId: lead.id });
      }
    } });
  }



  /* every online customer also becomes a normal ERP customer (marked Online), so they appear in the order / lead / quotation customer search.
     The id is the mobile number itself, so two phones adding the same customer at once never create a duplicate. */
  function addOnlineCusts(phones) {
    if (!window.ttCloudInitialLoadDone || !Array.isArray(customerDatabase)) return 0;
    var all = onlineCusts(), want = {}; (phones || []).forEach(function (p) { want[p10(p)] = 1; });
    var made = 0;
    all.forEach(function (c) {
      if (!want[c.ph] || inErp(c) || !c.name) return;
      if (customerDatabase.some(function (x) { return x && (String(x.id) === String(Number(c.ph)) || (Array.isArray(x.contacts) && x.contacts.some(function (k) { return k && p10(k.phone) === c.ph; }))); })) return;
      customerDatabase.unshift({ id: Number(c.ph), name: c.name, phone: c.ph, address: c.addr || c.city || '', gst: c.gst || 'Unregistered', person: c.name, email: c.email || '', source: 'online' }); made++;
    });
    if (made) { setStored('CUSTOMERS', customerDatabase); try { renderCustomerList && renderCustomerList(); } catch (e) {} }
    return made;
  }
  function backfillOnline() {   // once, from the Admin phone: older online customers join the ERP list too
    if (!X.isAdm() || !window.ttCloudInitialLoadDone) return;
    var K = 'TTESPL_ONCUST_BACKFILL'; try { if (localStorage.getItem(K)) return; } catch (e) { return; }
    if (!sos().length && !enqs().length) return;
    addOnlineCusts(onlineCusts().map(function (c) { return c.ph; }));
    try { localStorage.setItem(K, '1'); } catch (e) {}
  }
  window.ttShopAddOnlineCusts = function () { return addOnlineCusts(onlineCusts().map(function (c) { return c.ph; })); };

  /* ---------- ONLINE CUSTOMERS (separate from normal ERP customers) ---------- */
  var OC = 'ttOnlineCust', OCD = 'ttOnlineCustOne', OQ = '';
  function onlineCusts() {
    var m = {};
    function get(ph, nm) { var k = p10(ph); if (!k) return null; return (m[k] = m[k] || { ph: k, phone: String(ph), name: nm || '', city: '', addr: '', email: '', gst: '', orders: [], enq: [], last: '', lastOrd: '' }); }
    sos().forEach(function (so) { var c = get(so.phone, so.name); if (!c) return; c.orders.push(so); if (String(so.at || '') >= c.lastOrd) { c.lastOrd = String(so.at || ''); c.name = so.name || c.name; c.addr = [so.addr, so.city, so.pin, so.state].filter(Boolean).join(', '); c.city = so.city || c.city; c.email = so.email || c.email; c.gst = so.gst || c.gst; } });
    enqs().forEach(function (e) { var c = get(e.phone, e.name); if (!c) return; c.enq.push(e); if (!c.lastOrd) { c.name = e.name || c.name; c.city = e.city || c.city; } });
    return Object.keys(m).map(function (k) { var c = m[k]; c.last = [c.lastOrd].concat(c.enq.map(function (e) { return String(e.at || ''); })).sort().pop() || ''; c.value = R2(c.orders.filter(function (o) { return effStatus(o) !== 'cancelled'; }).reduce(function (t, o) { return t + N(o.total); }, 0)); c.n = c.orders.filter(function (o) { return effStatus(o) !== 'cancelled'; }).length; return c; }).sort(function (a, b) { return b.last.localeCompare(a.last); });
  }
  function inErp(c) { return custs().filter(function (x) { return x && p10(x.phone) === c.ph; })[0] || null; }
  function ocRow(c) {
    var e = inErp(c);
    return '<div class="ttx-row" data-a="ocopen" data-p="' + H(c.ph) + '" style="cursor:pointer;display:flex;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(128,128,128,.22)"><div style="flex:1;min-width:0"><b>🌐 ' + H(c.name) + '</b><br><small style="opacity:.75">' + H(c.phone) + (c.city ? ' · ' + H(c.city) : '') + '<br>' + c.n + ' order' + (c.n === 1 ? '' : 's') + (c.enq.length ? ' · ' + c.enq.length + ' enquiry' : '') + ' · last ' + H(String(c.last).slice(0, 10)) + '</small></div><div style="text-align:right"><b>' + rs(c.value) + '</b><br><small>' + (e ? 'in ERP ✔' : 'not in ERP') + (c.n > 1 ? ' · 🔁 repeat' : '') + '</small></div></div>';
  }
  function drawOC(keep) {
    var all = onlineCusts(), q = OQ.toLowerCase().trim();
    var l = all.filter(function (c) { return !q || (c.name + ' ' + c.phone + ' ' + c.city).toLowerCase().indexOf(q) >= 0; });
    var tot = R2(all.reduce(function (t, c) { return t + c.value; }, 0)), rep = all.filter(function (c) { return c.n > 1; }).length;
    var body = l.slice(0, 100).map(ocRow).join('') || '<div class="ttx-note" style="opacity:.8">No online customers yet. They appear here when someone orders or sends an enquiry from the store.</div>';
    if (keep && $('ocList')) { $('ocList').innerHTML = body; return; }
    var h = '<div class="ttx-note"><b>' + all.length + '</b> online customers · <b>' + rep + '</b> repeat · online sales <b>' + rs(tot) + '</b><br><small>These are people who ordered or enquired on the online store. Normal ERP customers stay in the Customers list (online ones are marked 🌐).</small></div>' +
      '<input data-i="q" placeholder="Search name / phone / city…" value="' + H(OQ) + '" style="width:100%;margin-bottom:6px"><div id="ocList">' + body + '</div>';
    X.sheet(OC, '🌐 Online Customers', h, { z: 3900 });
    X.bind(OC, { input: { q: function (v) { OQ = v; drawOC(true); } }, click: { ocopen: ocOne } });
  }
  window.ttOpenOnlineCust = function () { drawOC(); };
  function ocOne(ph) {
    var c = onlineCusts().filter(function (x) { return x.ph === ph; })[0]; if (!c) return; var e = inErp(c);
    var h = '<div class="ttx-note"><b>🌐 ' + H(c.name) + '</b><br>📞 <a href="tel:' + H(c.phone) + '">' + H(c.phone) + '</a>' + (c.email ? ' · ' + H(c.email) : '') + (c.addr ? '<br>📍 ' + H(c.addr) : (c.city ? '<br>📍 ' + H(c.city) : '')) + (c.gst ? '<br>GSTIN <b>' + H(c.gst) + '</b>' : '') + '<br><small>' + c.n + ' order(s) · ' + rs(c.value) + (e ? ' · in ERP Customers' : ' · not yet in ERP Customers') + '</small></div>';
    h += '<div class="ttx-btns" style="flex-wrap:wrap"><a class="ttx-b" style="flex:1 1 48%;text-align:center;text-decoration:none" href="tel:' + H(c.phone) + '">📞 Call</a><a class="ttx-b" style="flex:1 1 48%;text-align:center;text-decoration:none" href="https://wa.me/91' + H(c.ph) + '" target="_blank" rel="noopener">💬 WhatsApp</a>' +
      (e ? '' : '<button class="ttx-b pri" data-a="addcust" style="flex:1 1 100%">➕ Add to ERP Customers (🌐 Online)</button>') + '</div>';
    var os = c.orders.slice().sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
    h += '<div class="ttx-note" style="margin-top:10px"><b>Orders</b></div>' + (os.map(function (o) { var st = STAT[effStatus(o)] || STAT.new; return '<div class="ttx-row" data-a="oo" data-p="' + H(o.id) + '" style="cursor:pointer;display:flex;gap:8px;padding:8px 0;border-bottom:1px solid rgba(128,128,128,.22)"><div style="flex:1"><b>' + H(o.no) + '</b><br><small style="opacity:.75">' + H(when(o.at)) + ' · ' + items(o).length + ' item(s)</small></div><div style="text-align:right"><b>' + rs(o.total) + '</b><br><small>' + st[0] + ' ' + st[1] + '</small></div></div>'; }).join('') || '<div class="ttx-note" style="opacity:.8">No orders – enquiry only.</div>');
    if (c.enq.length) h += '<div class="ttx-note" style="margin-top:10px"><b>Machine enquiries</b></div>' + c.enq.map(function (q) { return '<div class="ttx-note">' + H(q.pn) + '<br><small>' + H(when(q.at)) + ' · ' + H(q.status || 'new') + '</small></div>'; }).join('');
    h += '<div class="ttx-btns"><button class="ttx-b" data-a="back" style="flex:1">‹ Back</button></div>';
    X.sheet(OCD, '🌐 Online customer', h, { z: 4000 });
    X.bind(OCD, { click: {
      back: function () { X.close(OCD); drawOC(); },
      oo: function (id) { one(id); },
      addcust: function () {
        if (inErp(c)) return;
        customerDatabase.unshift({ id: Number(c.ph) || Date.now(), name: c.name, phone: c.ph, address: c.addr || c.city || '', gst: c.gst || 'Unregistered', person: c.name, email: c.email || '', source: 'online' });
        setStored('CUSTOMERS', customerDatabase); try { renderCustomerList && renderCustomerList(); } catch (er) {} X.toast('Added to ERP Customers'); ocOne(ph);
      }
    } });
  }

  /* ---------- menu entry + badge ---------- */
  function badge() { var b = document.querySelector('.tt44-om .tt44-ob'); var n = window.ttShopPending(); if (b) { b.textContent = n ? n + ' new' : ''; b.style.display = n ? '' : 'none'; } }
  function inject() {
    try {
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt44-om')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt44-om'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenOnline(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>🛒</span><span>Online Orders</span></div><span class="tt44-ob" style="font-size:10px;font-weight:800;color:#fff;background:#dc2626;border-radius:999px;padding:2px 8px;display:none"></span>';
        list.appendChild(d); badge();
      }
      if (list && !list.querySelector('.tt44-oc')) {
        var e = document.createElement('div'); e.className = 'profile-menu-item tt44-oc'; e.setAttribute('onclick', 'triggerAppHaptic(); ttOpenOnlineCust(); closeProfileDrawer();');
        e.innerHTML = '<div class="profile-menu-item-left"><span>🌐</span><span>Online Customers</span></div>'; list.appendChild(e);
      }
    } catch (e) {}
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);
})();
