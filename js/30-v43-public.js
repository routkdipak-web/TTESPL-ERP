/* TTESPL ERP v43 - ONLINE BILL LINK (11) + CUSTOMER PORTAL (32)
   A staff member publishes a read-only SNAPSHOT of one bill (public_bills/<token>) or of one customer's account (public_portals/<token>).
   The customer opens  view.html?b=<token>  or  view.html?c=<token>  - no login, no app. The token is long and random (cannot be guessed),
   the snapshot never holds cost price / profit / phone numbers, and "Stop sharing" deletes it at once.
   Snapshots refresh by themselves when orders / payments change on a phone that has the app open. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var H = X.H, SHEET = 'ttPub', SIGN = 'Thank you!\n*TTESPL, Bhubaneswar*';
  var COL = { bill: 'public_bills', portal: 'public_portals' };
  function $(i) { return document.getElementById(i); }
  function N(x) { var v = parseFloat(x); return isNaN(v) ? 0 : v; }
  function R2(x) { return Math.round((N(x) + Number.EPSILON) * 100) / 100; }
  function rs(n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function orders() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function custs() { return (typeof customerDatabase !== 'undefined' && customerDatabase) || []; }
  function ord(id) { return orders().filter(function (o) { return String(o.id) === String(id); })[0]; }
  function inv(o) { try { return window.ttInvNo ? ttInvNo(o) : o.id; } catch (e) { return o.id; } }
  function p10(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
  function low(s) { return String(s || '').trim().toLowerCase(); }
  function ymdOf(o) { return String(o.deliveredDate || o.orderDate || '').slice(0, 10); }
  function co() {
    var d = window.companyDetailsData || {};
    return { n: 'TWINTOWN EXPRESS SERVICES PVT LTD', addr: d.address || 'Plot 1270/8566, Satya Vihar, Rasulgarh, Bhubaneswar - 751010', gstin: d.gstin || '21AAICT6014E1ZT', contact: d.contact || '+91 8917465040 / 6743175599' };
  }
  var UPI = { pa: 'eazypay.574099310@icici', pn: 'TWINTOWN EXPRESS SERVICES' };

  /* ---------- GST split: same rules as the printed invoice (shared with the Tally export) ---------- */
  function gstSplit(o) {
    var intra = (o.taxType || 'INTRA') !== 'INTER';
    var items = (o.items || []).map(function (it) {
      var incl = N(it.total), rt = window.ttItemGstRate ? ttItemGstRate(it) : 18, qty = N(it.qty) || 1;
      var taxable = R2(incl / (1 + rt / 100));
      return { name: it.name, hsn: window.ttItemHsn ? ttItemHsn(it) : (it.hsn || ''), gr: rt, qty: qty, incl: incl, taxable: taxable, rate: qty ? incl / qty : incl, disc: N(it.disc) };
    });
    var sumT = R2(items.reduce(function (s, i) { return s + i.taxable; }, 0));
    var total = N(o.totalAmount), cc = N(o.courierCharge);
    var courTax = !!(window.ttCourierTaxable && ttCourierTaxable() && cc > 0);
    var cT = courTax ? R2(cc / 1.18) : 0, forTax = courTax ? total : R2(total - cc);
    var tax = R2(forTax - sumT - cT), half = R2(tax / 2);
    var round = R2(forTax - (sumT + cT + (intra ? half * 2 : tax)));
    return { items: items, intra: intra, sumTaxable: sumT, courTaxable: cT, courierFree: courTax ? 0 : cc, tax: tax, half: half, round: round, total: total, taxable: R2(sumT + cT) };
  }
  window.ttGstSplit = gstSplit; window.ttPubRefresh = function () { sched(); };

  /* ---------- customer payment claims (shown back on the page with their status) ---------- */
  function claimRows(match) {
    var l = (window.ttx && X.list('PAYMENT_CLAIMS')) || [];
    return l.filter(function (c) { return c && match(c); }).sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); }).slice(0, 8)
      .map(function (c) { return { a: N(c.amt), u: String(c.utr || '').slice(-4), s: c.status === 'verified' ? 'v' : c.status === 'rejected' ? 'r' : 'n', d: String(c.at || '').slice(0, 10) }; });
  }
  /* ---------- snapshots ---------- */
  function custOf(o) {
    var ph = p10(o.phone), nm = low(o.customerName);
    return custs().filter(function (c) { return c && ((ph && p10(c.phone) === ph) || (nm && low(c.name) === nm)); })[0] || null;
  }
  function billSnap(o) {
    var g = gstSplit(o), c = custOf(o) || {};
    return {
      k: 'bill', v: 1, co: co(), no: inv(o), ord: o.id, date: ymdOf(o), st: o.status || '', up: Date.now(),
      cust: { n: o.customerName || '', gstin: c.gst || '', addr: c.address || '' },
      it: g.items.map(function (i) { return { n: i.name, q: i.qty, h: i.hsn, g: i.gr, r: R2(i.rate), d: i.disc, t: R2(i.incl) }; }),
      courier: N(o.courierCharge),
      tax: { taxable: g.taxable, cgst: g.intra ? g.half : 0, sgst: g.intra ? g.half : 0, igst: g.intra ? 0 : g.tax, intra: g.intra, round: g.round },
      tot: N(o.totalAmount), recv: N(o.recvAmount), due: Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount))),
      pays: (o.payments || []).filter(function (p) { return p && !p.refund && N(p.amount) > 0; }).map(function (p) { return { d: String(p.at || '').slice(0, 10), a: N(p.amount), m: p.mode || '' }; }),
      upi: UPI, cl: claimRows(function (c) { return c.kind === 'bill' && c.tk === o.pubToken; })
    };
  }
  function ordersOfCustomer(c) {
    var ph = {}, nm = {}; if (c.phone) ph[p10(c.phone)] = 1; if (c.name) nm[low(c.name)] = 1;
    (c.contacts || []).forEach(function (k) { if (k && k.phone) ph[p10(k.phone)] = 1; });
    (c.aliases || []).forEach(function (a) { if (a) nm[low(a)] = 1; });
    return orders().filter(function (o) { return o && o.status !== 'Cancelled' && (nm[low(o.customerName)] || (p10(o.phone) && ph[p10(o.phone)])); });
  }
  function portalSnap(c) {
    var list = ordersOfCustomer(c).sort(function (a, b) { return ymdOf(b).localeCompare(ymdOf(a)); }), t = 0, r = 0;
    list.forEach(function (o) { t += N(o.totalAmount); r += N(o.recvAmount); });
    return {
      k: 'portal', v: 1, co: co(), name: c.name || '', up: Date.now(), tot: R2(t), recv: R2(r), due: Math.max(0, R2(t - r)),
      bills: list.slice(0, 80).map(function (o) {
        return { no: inv(o), ord: o.id, date: ymdOf(o), st: o.status || '', tot: N(o.totalAmount), recv: N(o.recvAmount), due: Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount))), bt: o.pubToken || '',
          it: (o.items || []).map(function (i) { return { n: i.name, q: N(i.qty), t: N(i.total) }; }) };
      }),
      upi: UPI, cl: claimRows(function (x) { return x.kind === 'portal' && x.tk === c.pubToken; })
    };
  }

  /* ---------- publish / revoke ---------- */
  function token() {
    var a = new Uint8Array(24), al = 'abcdefghijklmnopqrstuvwxyz234567', s = '';
    (window.crypto || window.msCrypto).getRandomValues(a); for (var i = 0; i < a.length; i++) s += al[a[i] & 31];
    return s;
  }
  var SENT = {};   // token -> last JSON written (skip identical writes)
  function put(kind, tk, snap, force) {
    var cs = window.cloudSync; if (!cs || !cs.putPublic) return Promise.reject(new Error('Cloud is not ready'));
    var j = JSON.stringify(snap, function (k, v) { return k === 'up' ? undefined : v; });
    if (!force && SENT[tk] === j) return Promise.resolve('same');
    return cs.putPublic(COL[kind], tk, { j: JSON.stringify(snap), up: Date.now(), kind: kind }).then(function () { SENT[tk] = j; return 'ok'; });
  }
  function base() { return location.href.replace(/[#?].*$/, '').replace(/[^\/]*$/, ''); }
  function urlOf(kind, tk) { return base() + 'view.html?' + (kind === 'bill' ? 'b' : 'c') + '=' + tk; }
  function ensure(kind, id) {
    if (kind === 'bill') {
      var o = ord(id); if (!o) return Promise.reject(new Error('Order not found'));
      var fresh = !o.pubToken; if (fresh) o.pubToken = token();
      return put('bill', o.pubToken, billSnap(o), true).then(function () { if (fresh) setStored('ORDERS', ordersData); return { tk: o.pubToken, name: o.customerName, phone: o.phone, ref: inv(o), o: o }; })
        .catch(function (e) { if (fresh) delete o.pubToken; throw e; });
    }
    var c = custs().filter(function (x) { return String(x.id) === String(id); })[0]; if (!c) return Promise.reject(new Error('Customer not found'));
    var fr = !c.pubToken; if (fr) c.pubToken = token();
    ordersOfCustomer(c).forEach(function (o) { if (!o.pubToken) { /* portal links to bills only if they were shared */ } });
    return put('portal', c.pubToken, portalSnap(c), true).then(function () { if (fr) setStored('CUSTOMERS', customerDatabase); return { tk: c.pubToken, name: c.name, phone: c.phone, ref: c.name, c: c }; })
      .catch(function (e) { if (fr) delete c.pubToken; throw e; });
  }
  function revoke(kind, id) {
    var holder = kind === 'bill' ? ord(id) : custs().filter(function (x) { return String(x.id) === String(id); })[0];
    if (!holder || !holder.pubToken) return Promise.resolve();
    var tk = holder.pubToken, cs = window.cloudSync;
    return (cs && cs.delPublic ? cs.delPublic(COL[kind], tk) : Promise.resolve()).then(function () {
      delete holder.pubToken; delete SENT[tk]; setStored(kind === 'bill' ? 'ORDERS' : 'CUSTOMERS', kind === 'bill' ? ordersData : customerDatabase); X.toast('Link stopped');
    });
  }
  /* keep every published snapshot fresh (only phones with the app open write; identical snapshots are skipped) */
  var tmr = 0;
  function refreshAll() {
    if (!navigator.onLine || !window.ttCloudInitialLoadDone || !window.cloudSync || !cloudSync.putPublic) return;
    orders().forEach(function (o) { if (o && o.pubToken) put('bill', o.pubToken, billSnap(o)).catch(function () {}); });
    custs().forEach(function (c) { if (c && c.pubToken) put('portal', c.pubToken, portalSnap(c)).catch(function () {}); });
  }
  function sched() { clearTimeout(tmr); tmr = setTimeout(refreshAll, 4000); }
  function wrapStore() {
    var f = window.setStored; if (typeof f !== 'function' || f.__pub) return;
    var w = function (k) { var r = f.apply(this, arguments); if (k === 'ORDERS' || k === 'CUSTOMERS' || k === 'PAYMENT_CLAIMS') sched(); return r; }; w.__pub = 1;
    window.setStored = w; try { setStored = w; } catch (e) {}
  }
  wrapStore(); setTimeout(wrapStore, 1500); setTimeout(refreshAll, 25000);

  /* ---------- sheet: link ready ---------- */
  function msgFor(kind, r) {
    var u = urlOf(kind, r.tk), nm = r.name || 'Customer';
    if (kind === 'bill') {
      return 'Hello ' + nm + ',\nYour bill *' + r.ref + '* is ready. You can view it, check the payment status, pay by UPI and download it here:\n' + u +
        '\n\n_Note: This is not the original GST bill. It is only an app-generated sample bill. For the original bill, please call or message the Authorized person._\n\n' + SIGN;
    }
    return 'Hello ' + nm + ',\nYou can see all your bills, payments and pending amount with *TTESPL* here:\n' + u + '\n\n_Note: This is an app-generated summary, not an original GST bill. For original bills please call or message the Authorized person._\n\n' + SIGN;
  }
  function show(kind, r, id) {
    var u = urlOf(kind, r.tk);
    var h = '<div class="ttx-note"><b>' + H(r.name || '') + '</b> · ' + (kind === 'bill' ? 'Bill ' + H(r.ref) : 'Account page') + '</div>' +
      '<input readonly id="pubUrl" value="' + H(u) + '" style="width:100%;font-size:12px" onclick="this.select()">' +
      '<div class="ttx-btns" style="flex-wrap:wrap;margin-top:8px"><button class="ttx-b pri" data-a="wa" style="flex:1 1 100%">📲 Send link on WhatsApp</button>' +
      '<button class="ttx-b" data-a="copy">📋 Copy link</button><button class="ttx-b" data-a="prev">👁 Preview</button><button class="ttx-b" data-a="stop" style="color:#dc2626">⛔ Stop sharing</button></div>' +
      '<div class="ttx-note" style="font-size:11.5px;opacity:.8;margin-top:8px">Anyone who has this link can view ' + (kind === 'bill' ? 'this bill' : 'this customer\'s bills and dues') + ' (no cost price or profit is shown). It updates by itself when payments change. “Stop sharing” switches it off immediately.</div>';
    X.sheet(SHEET, kind === 'bill' ? '🔗 Online bill link' : '🌐 Customer account link', h, { z: 4000 });
    X.bind(SHEET, { click: {
      wa: function () { var p = p10(r.phone); window.open((p ? 'https://wa.me/91' + p : 'https://wa.me/') + '?text=' + encodeURIComponent(msgFor(kind, r)), '_blank'); },
      copy: function () { var el = $('pubUrl'); try { navigator.clipboard.writeText(u).then(function () { X.toast('Link copied'); }); } catch (e) { el.select(); document.execCommand('copy'); X.toast('Link copied'); } },
      prev: function () { window.open(u, '_blank'); },
      stop: function () { if (!confirm('Stop sharing? The customer will no longer be able to open this link.')) return; revoke(kind, id).then(function () { X.close(SHEET); }).catch(function (e) { X.toast('Could not stop: ' + e.message, 1); }); }
    } });
  }
  function go(kind, id) {
    X.toast('Preparing link…');
    ensure(kind, id).then(function (r) { show(kind, r, kind === 'bill' ? id : r.c.id); }).catch(function (e) { console.warn('pub', e); X.toast('Could not create the link: ' + (e && e.message || e) + ' (internet needed)', 1); });
  }
  window.ttShareBillLink = function (orderId) { go('bill', orderId); };
  window.ttSharePortalLink = function (orderId) {
    var o = ord(orderId), c = o && custOf(o);
    if (!c) return X.toast('Save this customer in Customers first', 1);
    go('portal', c.id);
  };

  /* ---------- manager: all shared links ---------- */
  window.ttOpenPublicLinks = function () {
    var rows = [];
    orders().forEach(function (o) { if (o && o.pubToken) rows.push({ kind: 'bill', id: o.id, t: o.pubToken, n: (o.customerName || '') + ' · Bill ' + inv(o) }); });
    custs().forEach(function (c) { if (c && c.pubToken) rows.push({ kind: 'portal', id: c.id, t: c.pubToken, n: (c.name || '') + ' · Account page' }); });
    var h = rows.length ? rows.map(function (r, i) { return '<div class="ttx-row" style="display:flex;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(128,128,128,.2)"><div style="flex:1;min-width:0;font-size:13px">' + (r.kind === 'bill' ? '🔗 ' : '🌐 ') + H(r.n) + '</div>' +
      '<button class="ttx-b" data-a="copy" data-p="' + i + '">Copy</button><button class="ttx-b" data-a="stop" data-p="' + i + '" style="color:#dc2626">Stop</button></div>'; }).join('') :
      '<div class="ttx-note">No link is being shared right now. Open any order → “Message customer” → 🔗 Send Bill Link / 🌐 Send Account Link.</div>';
    X.sheet('ttPubList', '🔗 Shared links (' + rows.length + ')', h, { z: 3900 });
    X.bind('ttPubList', { click: {
      copy: function (i) { var r = rows[+i]; try { navigator.clipboard.writeText(urlOf(r.kind, r.t)).then(function () { X.toast('Link copied'); }); } catch (e) {} },
      stop: function (i) { var r = rows[+i]; if (!confirm('Stop sharing this link?')) return; revoke(r.kind, r.id).then(function () { window.ttOpenPublicLinks(); }).catch(function (e) { X.toast('Could not stop: ' + e.message, 1); }); }
    } });
  };

  function inject() {
    try {
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt43-pl')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt43-pl'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenPublicLinks(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>🔗</span><span>Shared Links</span></div><span style="font-size:10px;color:#38bdf8;">Bill / Account</span>';
        list.appendChild(d);
      }
    } catch (e) {}
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);
})();
