/* TTESPL ERP v42.5 - CUSTOMER WHATSAPP UPDATES (manual push)
   After an order is placed / delivered / a payment is collected, a small sheet offers the ready message; one tap opens WhatsApp
   with the customer's number. The same sheet is also on every pending order ("📲 Update") and on the Ledger detail page, where
   "Out for delivery" is available as an optional message. Nothing is sent automatically - the message is only opened in WhatsApp
   and can be edited first. Later this can be made automatic. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var H = X.H, ID = 'ttWA', S = { id: '', type: 'placed', extra: {} };
  var SIGN = 'Thank you!\n*TTESPL, Bhubaneswar*';
  function $(i) { return document.getElementById(i); }
  function N(x) { var v = parseFloat(x); return isNaN(v) ? 0 : v; }
  function R2(x) { return Math.round((N(x) + Number.EPSILON) * 100) / 100; }
  function rs(n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function orders() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function ord(id) { return orders().filter(function (o) { return String(o.id) === String(id); })[0]; }
  function inv(o) { try { return window.ttInvNo ? ttInvNo(o) : o.id; } catch (e) { return o.id; } }
  function phone10(o) { return String(o.phone || '').replace(/\D/g, '').slice(-10); }
  function ymd(s) { return X.fmtD ? X.fmtD(s) : s; }

  /* ---------- message text ---------- */
  function payLine(o) {
    var total = N(o.totalAmount), recv = N(o.recvAmount), due = Math.max(0, R2(total - recv));
    if (total > 0 && due <= 0.009) return '✅ *Payment:* Received in full – cleared';
    if (recv > 0) return '💵 *Payment received:* ' + rs(recv) + '\n⏳ *Pending:* ' + rs(due);
    return '⏳ *Payment due:* ' + rs(due);
  }
  function itemsBlock(o, withAmt) {
    var it = (o.items || []).map(function (i, k) { return (k + 1) + '. ' + i.name + ' × ' + i.qty + (withAmt && N(i.total) ? ' – ' + rs(i.total) : ''); });
    return '*Items:*\n' + (it.join('\n') || '-');
  }
  function build(o, type, ex) {
    ex = ex || {}; var hi = 'Dear ' + (o.customerName || 'Customer') + ',\n\n', cc = N(o.courierCharge), due = Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount)));
    var ordLine = '*Order ID:* ' + o.id;
    if (type === 'placed') {
      return hi + '✅ *Your order has been placed!*\n\n' + ordLine + '\n' + itemsBlock(o, true) + '\n' + (cc > 0 ? '*Courier / Transport charges:* ' + rs(cc) + '\n' : '') +
        '*Total Amount:* ' + rs(o.totalAmount) + '\n' + payLine(o) + '\n\nYour order will be delivered soon. When it is out for delivery, we will inform you.\n\n' + SIGN;
    }
    if (type === 'dispatch') {
      return hi + '🚚 *Your order is out for delivery!*\n\n' + ordLine + '\n' + itemsBlock(o, false) + '\n*Total Amount:* ' + rs(o.totalAmount) + '\n' + payLine(o) +
        (due > 0 ? '\n\nPlease keep the pending amount ready at the time of delivery.' : '') + '\n\n' + SIGN;
    }
    if (type === 'delivered') {
      var invNo = inv(o);
      return hi + '📦 *Your order has been delivered!*\n\n' + ordLine + (invNo && invNo !== o.id ? '\n*Invoice No:* ' + invNo : '') + '\n' + itemsBlock(o, false) + '\n*Total Amount:* ' + rs(o.totalAmount) + '\n' +
        (N(ex.paidNow) > 0 ? '💰 *Payment received now:* ' + rs(ex.paidNow) + (ex.mode ? ' (' + ex.mode + ')' : '') + '\n' : '') + payLine(o) + '\n\nWe look forward to serving you again.\n\n' + SIGN;
    }
    /* payment */
    var amt = N(ex.amt), last = (o.payments || []).filter(function (p) { return p && !p.adjust && N(p.amount) > 0; }).slice(-1)[0];
    if (!(amt > 0) && last) { amt = N(last.amount); ex = Object.assign({}, ex, { mode: last.mode }); }
    if (!(amt > 0)) amt = N(o.recvAmount);
    return hi + '💰 *Payment received – thank you!*\n\n*Amount received:* ' + rs(amt) + (ex.mode ? ' (' + ex.mode + ')' : '') + '\n*For:* ' + (inv(o) !== o.id ? 'Invoice ' + inv(o) + ' / ' : '') + 'Order ' + o.id + '\n*Total Amount:* ' + rs(o.totalAmount) + '\n*Total paid so far:* ' + rs(o.recvAmount) + '\n' +
      (due > 0.009 ? '⏳ *Pending:* ' + rs(due) : '✅ *Balance:* Nil – fully cleared') + '\n\n' + SIGN;
  }

  /* ---------- sheet ---------- */
  var TYPES = [['placed', '✅ Order placed'], ['dispatch', '🚚 Out for delivery'], ['delivered', '📦 Delivered'], ['payment', '💰 Payment']];
  function draw() {
    var o = ord(S.id); if (!o) return;
    var ph = phone10(o), chips = TYPES.map(function (t) { return '<button type="button" class="ttx-b' + (t[0] === S.type ? ' pri' : '') + '" data-a="type" data-p="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    var h = '<div class="ttx-note"><b>' + H(o.customerName || '') + '</b> · ' + (ph ? '+91 ' + H(ph) : '<span style="color:#d97706">no mobile number saved – WhatsApp will ask you to pick the contact</span>') + '<br><small>Order ' + H(o.id) + ' · ' + H(o.status || '') + '</small></div>' +
      '<div class="ttx-btns wa-chips">' + chips + '</div>' +
      '<textarea id="waText" rows="14" style="width:100%;font-size:13.5px;line-height:1.45"></textarea>' +
      '<div class="ttx-btns"><button class="ttx-b pri" data-a="send" style="flex:1">📲 Send on WhatsApp</button><button class="ttx-b" data-a="copy">📋 Copy</button><button class="ttx-b" data-a="skip">Not now</button></div>' +
      '<div class="ttx-note" style="font-size:11.5px;opacity:.8">The message opens in WhatsApp – you can edit it there too. Nothing is sent by itself.</div>';
    X.sheet(ID, '📲 Message to customer', h, { z: 3900 });
    X.bind(ID, { click: {
      type: function (t) { S.type = t; draw(); },
      send: function () { var tx = ($('waText') || {}).value || ''; var p = phone10(o); window.open((p ? 'https://wa.me/91' + p : 'https://wa.me/') + '?text=' + encodeURIComponent(tx), '_blank'); X.close(ID); },
      copy: function () { var el = $('waText'); try { navigator.clipboard.writeText(el.value).then(function () { X.toast('Copied'); }); } catch (e) { el.select(); document.execCommand('copy'); X.toast('Copied'); } },
      skip: function () { X.close(ID); }
    } });
    $('waText').value = build(o, S.type, S.extra);
  }
  function open(id, type, extra) { if (!ord(id)) return; S = { id: id, type: type || 'placed', extra: extra || {} }; draw(); }
  window.ttOpenCustomerWA = open;

  /* ---------- automatic offers after the events ---------- */
  function wrapSave() {
    var o = window.saveOrderAction; if (typeof o !== 'function' || o.__wa) return;
    var w = function () {
      var isNew = !(($('editOrderId') || {}).value), before = orders().length, r = o.apply(this, arguments);
      try { if (isNew && orders().length > before) { var id = orders()[0].id; setTimeout(function () { open(id, 'placed'); }, 450); } } catch (e) { console.warn('wa', e); }
      return r;
    }; w.__wa = 1; window.saveOrderAction = w;
  }
  function wrapDelivery() {
    var o = window.executeConfirmedDelivery; if (typeof o !== 'function' || o.__wa) return;
    var w = function () {
      var id = ($('pendingDeliverOrderId') || {}).value, ob = ord(id), was = ob && ob.status, n0 = ob && Array.isArray(ob.payments) ? ob.payments.length : 0, self = this, args = arguments;
      return Promise.resolve(o.apply(self, args)).then(function (res) {
        var chk = function (again) {
          var x = ord(id); if (!x) return;
          if (was !== 'Delivered' && x.status === 'Delivered') {
            var np = (x.payments || []).slice(n0).filter(function (p) { return p && !p.adjust; }), paid = np.reduce(function (a, p) { return a + N(p.amount); }, 0);
            open(id, 'delivered', { paidNow: paid, mode: np.length ? np[np.length - 1].mode : '' });
          } else if (again) setTimeout(function () { chk(false); }, 700);
        };
        setTimeout(function () { chk(true); }, 500); return res;
      });
    }; w.__wa = 1; window.executeConfirmedDelivery = w;
  }
  function wrapPay() {
    var o = window.executeConfirmedPaymentCollection; if (typeof o !== 'function' || o.__wa) return;
    var w = function () {
      var id = ($('pendingCollectOrderId') || {}).value, ob = ord(id), r0 = ob ? N(ob.recvAmount) : 0, mode = ($('payCollectModeSelect') || {}).value || '', self = this, args = arguments;
      return Promise.resolve(o.apply(self, args)).then(function (res) {
        var chk = function (again) {
          var x = ord(id);
          if (x && N(x.recvAmount) > r0 + 0.001) open(id, 'payment', { amt: R2(N(x.recvAmount) - r0), mode: mode });
          else if (again) setTimeout(function () { chk(false); }, 700);
        };
        setTimeout(function () { chk(true); }, 500); return res;
      });
    }; w.__wa = 1; window.executeConfirmedPaymentCollection = w;
  }

  /* ---------- manual buttons: pending order cards + ledger detail ---------- */
  function wrapRender() {
    var o = window.renderOrders; if (typeof o !== 'function' || o.__wa) return;
    var w = function () {
      var r = o.apply(this, arguments);
      try {
        document.querySelectorAll('#ordersListContainer button[onclick*="shareOrderWhatsApp("]').forEach(function (b) {
          if (b.parentNode.querySelector('.wa-upd')) return; var m = /shareOrderWhatsApp\('([^']+)'\)/.exec(b.getAttribute('onclick') || ''); if (!m) return;
          var n = document.createElement('button'); n.type = 'button'; n.className = 'btn btn-outline btn-sm wa-upd'; n.style.flex = '1 1 100%'; n.style.order = '9'; n.textContent = '📲 Update';
          n.setAttribute('onclick', "triggerAppHaptic(); ttOpenCustomerWA('" + m[1] + "','dispatch')"); b.parentNode.insertBefore(n, b.nextSibling);
        });
      } catch (e) { console.warn('wa render', e); }
      return r;
    }; w.__wa = 1; window.renderOrders = w;
  }
  function wrapLedger() {
    var o = window.openLedgerDetail; if (typeof o !== 'function' || o.__wa) return;
    var w = function (id) {
      var r = o.apply(this, arguments);
      try {
        var pg = $('ledgerDetailPage'), od = ord(id);
        if (pg && od && !pg.querySelector('.wa-upd')) {
          var d = document.createElement('div'); d.style.cssText = 'margin:10px 12px 0'; d.innerHTML = '<button type="button" class="btn btn-wa wa-upd" style="width:100%" onclick="triggerAppHaptic(); ttOpenCustomerWA(\'' + String(od.id).replace(/'/g, "\\'") + '\',\'' + (N(od.dueAmount) > 0 ? 'payment' : 'delivered') + '\')">📲 Send update to customer on WhatsApp</button>';
          var first = pg.firstElementChild; pg.insertBefore(d, first && first.nextSibling);
        }
      } catch (e) { console.warn('wa ledger', e); }
      return r;
    }; w.__wa = 1; window.openLedgerDetail = w;
  }
  function wrapAll() { wrapSave(); wrapDelivery(); wrapPay(); wrapRender(); wrapLedger(); }
  wrapAll(); document.addEventListener('DOMContentLoaded', wrapAll); setTimeout(wrapAll, 1500);
  try { renderOrders(); } catch (e) {}
})();
