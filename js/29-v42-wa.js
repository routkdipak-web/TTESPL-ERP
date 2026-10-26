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


  /* ---------- UPI QR as a shareable PNG ---------- */
  var UPI_ID = 'eazypay.574099310@icici';
  function upiPayload(amount) { return 'upi://pay?pa=' + UPI_ID + '&pn=' + encodeURIComponent('TWINTOWN EXPRESS SERVICES') + '&am=' + N(amount).toFixed(2) + '&cu=INR'; }
  function qrBlob(amount, name) {
    return new Promise(function (res, rej) {
      try {
        var qr = qrcode(0, 'M'); qr.addData(upiPayload(amount)); qr.make();
        var svg = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: false });
        var img = new Image();
        img.onload = function () {
          var W = 640, Q = 520, c = document.createElement('canvas'); c.width = W; c.height = 860;
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, 860);
          g.textAlign = 'center'; g.fillStyle = '#0a2540'; g.font = '800 30px Arial,sans-serif'; g.fillText('TWINTOWN EXPRESS SERVICES PVT LTD', W / 2, 52);
          g.fillStyle = '#475569'; g.font = '600 24px Arial,sans-serif'; g.fillText('Scan & Pay via UPI', W / 2, 90);
          g.imageSmoothingEnabled = false; g.drawImage(img, (W - Q) / 2, 115, Q, Q);
          g.fillStyle = '#0a2540'; g.font = '900 52px Arial,sans-serif'; g.fillText('₹' + N(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 }), W / 2, 710);
          if (name) { g.fillStyle = '#475569'; g.font = '600 26px Arial,sans-serif'; g.fillText(String(name).slice(0, 38), W / 2, 755); }
          g.fillStyle = '#0284c7'; g.font = '700 24px Arial,sans-serif'; g.fillText('UPI ID: ' + UPI_ID, W / 2, 810);
          c.toBlob(function (b) { b ? res(b) : rej(new Error('png')); }, 'image/png');
        };
        img.onerror = function () { rej(new Error('svg')); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      } catch (e) { rej(e); }
    });
  }
  function qrFile(amount, name) { return qrBlob(amount, name).then(function (b) { return new File([b], 'TTESPL-UPI-QR-' + Math.round(N(amount)) + '.png', { type: 'image/png' }); }); }
  function saveFile(f) { var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  /* share image (+ optional text); returns a Promise; falls back to download when the phone cannot share files */
  function shareQr(amount, name, text) {
    return qrFile(amount, name).then(function (f) {
      var d = { files: [f] }; if (text) d.text = text;
      if (navigator.canShare && navigator.canShare(d) && navigator.share) {
        return navigator.share(d).then(function () { return 'shared'; }, function (e) { if (e && e.name === 'AbortError') return 'cancelled'; throw e; });
      }
      saveFile(f); X.toast('QR image saved - attach it in WhatsApp'); return 'saved';
    }).catch(function (e) { console.warn('qr share', e && (e.message||e)); X.toast('Could not create the QR image'); return 'error'; });
  }
  window.ttShareUpiQr = shareQr;
  /* Share button inside the QR dialog */
  var LASTQ = { name: '', amt: 0 };
  function wrapUpi() {
    var f = window.openUpiModal; if (typeof f !== 'function' || f.__wa) return;
    var w = function (name, amount) { LASTQ = { name: name || '', amt: N(amount) }; return f.apply(this, arguments); }; w.__wa = 1; window.openUpiModal = w;
    try { openUpiModal = w; } catch (e) {}
    var card = document.querySelector('#upiModal .auth-card'); if (!card || card.querySelector('.wa-qrshare')) return;
    var done = card.querySelector('button.btn-primary'); if (!done) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline btn-block wa-qrshare'; b.style.marginBottom = '8px'; b.textContent = '📤 Share QR';
    b.onclick = function () { if (LASTQ.amt > 0) shareQr(LASTQ.amt, LASTQ.name, 'Please pay ' + rs(LASTQ.amt) + ' via UPI.\n*TTESPL, Bhubaneswar*'); };
    done.parentNode.insertBefore(b, done);
  }

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
    var amt = N(ex.amt) || N(ex.paidNow), last = (o.payments || []).filter(function (p) { return p && !p.adjust && N(p.amount) > 0; }).slice(-1)[0];
    if (!(amt > 0) && last) { amt = N(last.amount); ex = Object.assign({}, ex, { mode: last.mode }); }
    if (!(amt > 0)) amt = N(o.recvAmount);
    var forLine = '*For:* ' + (inv(o) !== o.id ? 'Invoice ' + inv(o) + ' / ' : '') + 'Order ' + o.id;
    if (!(amt > 0) && due > 0.009) {   /* nothing paid yet -> reminder, never a thank-you */
      return hi + '⏳ *Payment reminder*\n\n' + forLine + '\n*Total Amount:* ' + rs(o.totalAmount) + '\n⏳ *Pending:* ' + rs(due) + '\n\nKindly arrange the pending payment at the earliest. You can pay by UPI using the QR code.\n\n' + SIGN;
    }
    return hi + '💰 *Payment received – thank you!*\n\n*Amount received:* ' + rs(amt) + (ex.mode ? ' (' + ex.mode + ')' : '') + '\n*For:* ' + (inv(o) !== o.id ? 'Invoice ' + inv(o) + ' / ' : '') + 'Order ' + o.id + '\n*Total Amount:* ' + rs(o.totalAmount) + '\n*Total paid so far:* ' + rs(o.recvAmount) + '\n' +
      (due > 0.009 ? '⏳ *Pending:* ' + rs(due) : '✅ *Balance:* Nil – fully cleared') + '\n\n' + SIGN;
  }

  /* ---------- sheet ---------- */
  var TYPES = [['placed', '✅ Order placed'], ['dispatch', '🚚 Out for delivery'], ['delivered', '📦 Delivered'], ['payment', '💰 Payment / Due']];

  /* ---------- Bill (sample copy) + Money receipt as shareable PDF ---------- */
  var BILL_NOTE = 'NOTE: This is NOT the original GST invoice. It is only an app-generated sample bill. For the original bill, please call or message the Authorized person.';
  function company() { return window.companyDetailsData || {}; }
  function billHtml(o) {
    var box = document.createElement('div'); box.innerHTML = window.buildTallyInvoiceHtml(o);
    [].forEach.call(box.querySelectorAll('.tt-sheet'), function (sh) {
      sh.style.position = 'relative';
      var b = document.createElement('div');
      b.style.cssText = 'position:absolute;left:8mm;right:8mm;top:1.2mm;height:5.6mm;line-height:2.8mm;box-sizing:border-box;border:0.3mm solid #b91c1c;background:#fef2f2;color:#b91c1c;font:700 7.6px Arial,sans-serif;text-align:center;padding:0.4mm 1mm;overflow:hidden';
      b.textContent = BILL_NOTE; sh.insertBefore(b, sh.firstChild);
    });
    return box.innerHTML;
  }
  function pays(o) { return (o.payments || []).map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p && !x.p.refund && N(x.p.amount) > 0; }); }
  function receiptHtml(o, p) {
    var d = company(), amt = N(p.amount), due = dueOf(o);
    return '<div class="tt-sheet" style="width:210mm;padding:12mm;box-sizing:border-box;background:#fff;font-family:Arial,sans-serif;color:#000;font-size:13px;">' +
      '<div style="border:1px solid #000;padding:16px;"><div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;"><b style="font-size:18px;">TWINTOWN EXPRESS SERVICES PVT LTD</b><br>' + H(d.address || '') + '<br>GSTIN: ' + H(d.gstin || '') + ' · ' + H(d.contact || '') + '</div>' +
      '<h2 style="text-align:center;margin:12px 0;">PAYMENT RECEIPT</h2>' +
      '<table style="width:100%;font-size:13px;line-height:1.8"><tr><td><b>Receipt No.:</b> ' + H(p.rno || '—') + '</td><td style="text-align:right"><b>Date:</b> ' + H(String(p.at || '').slice(0, 10)) + '</td></tr>' +
      '<tr><td colspan="2"><b>Received from:</b> ' + H(o.customerName || '') + (o.phone ? ' (' + H(o.phone) + ')' : '') + '</td></tr>' +
      '<tr><td colspan="2"><b>Against bill / order:</b> ' + H(inv(o)) + '</td></tr><tr><td colspan="2"><b>Mode:</b> ' + H(p.mode || '-') + '</td></tr></table>' +
      '<div style="margin:16px 0;padding:12px;border:1px solid #000;font-size:18px;"><b>Amount received: ₹ ' + N(amt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</b>' + (window.ttWords ? '<br><small style="font-size:12px">' + H(ttWords(amt)) + '</small>' : '') + '</div>' +
      '<div style="font-size:13px;line-height:1.8">Bill total ₹' + N(o.totalAmount).toLocaleString('en-IN') + ' · Total received ₹' + N(o.recvAmount).toLocaleString('en-IN') + ' · ' + (due > 0.009 ? '<b>Balance due ₹' + due.toLocaleString('en-IN') + '</b>' : '<b>Fully paid</b>') + '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:46px;text-align:right">for TWINTOWN EXPRESS SERVICES PVT LTD<br><br>Authorised Signatory</div>' +
      '<div style="margin-top:18px;font-size:10.5px;color:#555;text-align:center">App-generated receipt copy. For the original receipt, please contact the Authorized person.</div></div></div>';
  }
  function shareBill(o) {
    if (typeof window.ttShareDoc !== 'function' || typeof window.buildTallyInvoiceHtml !== 'function') return X.toast('Bill share not available');
    var no = inv(o), due = dueOf(o), dl = String(o.status) === 'Delivered', W = dl ? 'bill' : 'order copy';
    ttShareDoc({
      title: (dl ? 'Bill ' : 'Order ') + no, fileName: 'TTESPL_' + (dl ? 'Bill_' : 'Order_') + String(no).replace(/[^\w-]+/g, '_') + '.pdf', phone: o.phone,
      msg: 'Hello ' + (o.customerName || '') + ',\nPlease find attached the ' + W + ' for your order *' + no + '* (Total ' + rs(o.totalAmount) + (due > 0.009 ? ', Pending ' + rs(due) : ', Paid in full') + ').\n\n_Note: This is not the original GST bill. It is only an app-generated sample ' + (dl ? 'bill' : 'copy') + '. For the original bill, please call or message the Authorized person._\n\n' + SIGN,
      html: function () { return billHtml(o); },
      textFn: function () { open(o.id, 'delivered'); },
      printFn: function () { ttPrintHtml('Bill ' + no, billHtml(o)); }
    });
  }
  function shareReceipt(o, p) {
    if (typeof window.ttShareDoc !== 'function') return X.toast('Receipt share not available');
    ttShareDoc({
      title: 'Receipt ' + (p.rno || inv(o)), fileName: 'TTESPL_Receipt_' + String(p.rno || inv(o)).replace(/[^\w-]+/g, '_') + '.pdf', phone: o.phone,
      msg: 'Hello ' + (o.customerName || '') + ',\nPlease find attached the payment receipt for *' + rs(p.amount) + '* received against order *' + inv(o) + '*.\n\n' + SIGN,
      html: function () { return receiptHtml(o, p); },
      textFn: function () { open(o.id, 'payment', { paidNow: p.amount, mode: p.mode }); },
      printFn: function () { ttPrintHtml('Receipt', receiptHtml(o, p)); }
    });
  }
  window.ttShareBillPdf = function (id) { var o = ord(id); if (o) shareBill(o); };
  window.ttShareReceiptPdf = function (id, i) { var o = ord(id), p = o && (o.payments || [])[i]; if (o && p) shareReceipt(o, p); };
  function docsOpt(o) {
    var h = '', ps = pays(o);
    if (String(o.status) !== 'Cancelled') h += '<button type="button" class="ttx-b" data-a="bill" style="flex:1 1 100%">' + (String(o.status) === 'Delivered' ? '📄 Send Bill (PDF)' : '📄 Send Order (PDF)') + '</button>';
    if (ps.length) {
      var sel = ps.length > 1 ? '<select id="waPay" style="flex:1 1 100%;font-size:12.5px">' + ps.map(function (x) { return '<option value="' + x.i + '"' + (x === ps[ps.length - 1] ? ' selected' : '') + '>' + H(rs(x.p.amount) + ' · ' + String(x.p.at || '').slice(0, 10) + (x.p.mode ? ' · ' + x.p.mode : '')) + '</option>'; }).join('') + '</select>' : '';
      h += sel + '<button type="button" class="ttx-b" data-a="rcpt" style="flex:1 1 100%">🧾 Send Money Receipt (PDF)</button>';
    }
    return h ? '<div class="ttx-btns" style="flex-wrap:wrap;margin:6px 0">' + h + '</div>' : '';
  }

  function dueOf(o) { return Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount))); }
  function qrOpt(o) {
    var d = dueOf(o); if (d <= 0.009) return '';
    return '<label class="ttx-note" style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="waQr"' + (S.qr === false ? '' : ' checked') + ' style="width:auto"> <span>Attach UPI QR for pending <b>' + rs(d) + '</b></span></label>';
  }
  function draw() {
    var o = ord(S.id); if (!o) return;
    var ph = phone10(o), chips = TYPES.map(function (t) { return '<button type="button" class="ttx-b' + (t[0] === S.type ? ' pri' : '') + '" data-a="type" data-p="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    var h = '<div class="ttx-note"><b>' + H(o.customerName || '') + '</b> · ' + (ph ? '+91 ' + H(ph) : '<span style="color:#d97706">no mobile number saved – WhatsApp will ask you to pick the contact</span>') + '<br><small>Order ' + H(o.id) + ' · ' + H(o.status || '') + '</small></div>' +
      '<div class="ttx-btns wa-chips">' + chips + '</div>' +
      qrOpt(o) + docsOpt(o) +
      '<textarea id="waText" rows="14" style="width:100%;font-size:13.5px;line-height:1.45"></textarea>' +
      '<div class="ttx-btns"><button class="ttx-b pri" data-a="send" style="flex:1">📲 Send on WhatsApp</button><button class="ttx-b" data-a="copy">📋 Copy</button><button class="ttx-b" data-a="skip">Not now</button></div>' +
      '<div class="ttx-note" style="font-size:11.5px;opacity:.8">Without QR the message opens directly in WhatsApp. With QR the phone share sheet opens - pick WhatsApp and the customer. Nothing is sent by itself.</div>';
    X.sheet(ID, '📲 Message to customer', h, { z: 3900 });
    X.bind(ID, { click: {
      type: function (t) { S.type = t; draw(); },
      send: function () {
        var tx = ($('waText') || {}).value || '', q = $('waQr'), d = dueOf(o); S.qr = q ? q.checked : S.qr;
        if (q && q.checked && d > 0.009) { X.close(ID); shareQr(d, o.customerName, tx); return; }
        var p = phone10(o); window.open((p ? 'https://wa.me/91' + p : 'https://wa.me/') + '?text=' + encodeURIComponent(tx), '_blank'); X.close(ID); },
      copy: function () { var el = $('waText'); try { navigator.clipboard.writeText(el.value).then(function () { X.toast('Copied'); }); } catch (e) { el.select(); document.execCommand('copy'); X.toast('Copied'); } },
      bill: function () { X.close(ID); shareBill(o); },
      rcpt: function () { var sl = $('waPay'), ps = pays(o), i = sl ? +sl.value : (ps.length ? ps[ps.length - 1].i : -1); var p = (o.payments || [])[i]; X.close(ID); if (p) shareReceipt(o, p); },
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
  /* pending order cards (Orders tab) and delivered bill cards (Ledger tab): add an "📲 Update" button; re-added whenever the list is redrawn */
  var CARDS = [
    { box: '#ordersListContainer', find: 'button[onclick*="shareOrderWhatsApp("]', re: /shareOrderWhatsApp\('([^']+)'\)/, type: 'dispatch' },
    { box: '#billingListContainer', find: 'button[onclick*="openInvoicePrintModal("]', re: /openInvoicePrintModal\('([^']+)'\)/, type: 'delivered' }
  ], raf = 0;
  function addButtons() {
    raf = 0;
    CARDS.forEach(function (c) {
      try {
        document.querySelectorAll(c.box + ' ' + c.find).forEach(function (b) {
          if (b.parentNode.querySelector('.wa-upd')) return; var m = c.re.exec(b.getAttribute('onclick') || ''); if (!m) return;
          var n = document.createElement('button'); n.type = 'button'; n.className = 'btn btn-outline btn-sm wa-upd'; n.style.flex = '1 1 100%'; n.style.order = '9'; n.textContent = '📲 WhatsApp update to customer';
          n.setAttribute('onclick', "triggerAppHaptic(); ttOpenCustomerWA('" + m[1] + "','" + c.type + "')"); b.parentNode.appendChild(n);
        });
      } catch (e) { console.warn('wa buttons', e); }
    });
  }
  function watchLists() {
    CARDS.forEach(function (c) {
      var el = document.querySelector(c.box); if (!el || el.__wa) return; el.__wa = 1;
      new MutationObserver(function () { if (!raf) raf = requestAnimationFrame(addButtons); }).observe(el, { childList: true, subtree: true });
    });
    addButtons();
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
  function wrapAll() { wrapSave(); wrapDelivery(); wrapPay(); watchLists(); wrapLedger(); wrapUpi(); }
  wrapAll(); document.addEventListener('DOMContentLoaded', wrapAll); setTimeout(wrapAll, 1500);
})();
