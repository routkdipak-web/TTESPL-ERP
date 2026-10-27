/* TTESPL ERP v43 - DAILY CLOSING REPORT (21)
   One tap at the end of the day: sales, money collected (cash / UPI / bank), expenses, cash in hand movement, new orders, deliveries,
   pending deliveries, dues, low stock - ready as a WhatsApp message for the owner. Read-only: nothing in the app is changed. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var H = X.H, ID = 'ttClose', OK = 'TTESPL_OWNER_WA';
  function $(i) { return document.getElementById(i); }
  function N(x) { var v = parseFloat(x); return isNaN(v) ? 0 : v; }
  function R2(x) { return Math.round((N(x) + Number.EPSILON) * 100) / 100; }
  function inr(n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function iso(d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  function toIso(s) { s = String(s || '').trim(); var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2); m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(s); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; }
  function orders() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function mode(m) { m = String(m || 'Cash').toLowerCase(); return /cash/.test(m) ? 'Cash' : /upi|gpay|phonepe|paytm|qr/.test(m) ? 'UPI' : 'Bank / other'; }
  function inv(o) { try { return window.ttInvNo ? ttInvNo(o) : o.id; } catch (e) { return o.id; } }
  function dOf(o) { return toIso(o.deliveredDate || o.orderDate); }
  function daysAgo(d) { var t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((t - new Date(d + 'T00:00:00')) / 864e5); }

  function calc(d) {
    var s = { d: d, sales: 0, bills: 0, coll: 0, by: { Cash: 0, UPI: 0, 'Bank / other': 0 }, who: {}, booked: 0, bookedVal: 0, pend: 0, pendVal: 0, dueAll: 0, due30: 0, exp: 0, expCash: 0, expN: 0, low: 0, svc: 0, svcDone: 0, top: [] };
    var top = [];
    orders().forEach(function (o) {
      if (!o || o.status === 'Cancelled') return;
      if (toIso(o.orderDate) === d) { s.booked++; s.bookedVal += N(o.totalAmount); }
      if (o.status === 'Delivered' && dOf(o) === d) { s.bills++; s.sales += N(o.totalAmount); top.push([o.customerName || '', N(o.totalAmount), inv(o)]); }
      (o.payments || []).forEach(function (p) {
        if (!p || p.refund || N(p.amount) <= 0 || toIso(p.at || p.date) !== d) return;
        var a = N(p.amount); s.coll += a; s.by[mode(p.mode)] += a; var w = String(p.by || o.bookedBy || '-').trim() || '-'; s.who[w] = (s.who[w] || 0) + a;
      });
      var due = Math.max(0, R2(N(o.totalAmount) - N(o.recvAmount)));
      if (o.status === 'Pending') { s.pend++; s.pendVal += N(o.totalAmount); }
      if (o.status === 'Delivered' && due > 0.009) { s.dueAll += due; var d0 = dOf(o); if (d0 && daysAgo(d0) >= 30) s.due30 += due; }
    });
    ((typeof expensesData !== 'undefined' && expensesData) || []).forEach(function (e) {
      if (!e || toIso(e.date) !== d) return; var a = N(e.amount); s.exp += a; s.expN++; if (/cash/i.test(String(e.payMode || 'cash'))) s.expCash += a;
    });
    try { s.low = ((typeof sampleInventory !== 'undefined' && sampleInventory) || []).filter(function (p) { return p && p.category !== 'Catalog Equipment' && N(p.stock) <= (window.ttLowLimit ? ttLowLimit(p) : 2); }).length; } catch (e) {}
    ((typeof serviceCallsData !== 'undefined' && serviceCallsData) || []).forEach(function (x) { if (!x) return; if (!/completed/i.test(String(x.status || ''))) s.svc++; });
    s.top = top.sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
    ['sales', 'coll', 'bookedVal', 'pendVal', 'dueAll', 'due30', 'exp', 'expCash'].forEach(function (k) { s[k] = R2(s[k]); });
    Object.keys(s.by).forEach(function (k) { s.by[k] = R2(s.by[k]); });
    s.cashMove = R2(s.by.Cash - s.expCash);
    return s;
  }
  function dmy(d) { return d.slice(8) + '-' + d.slice(5, 7) + '-' + d.slice(0, 4); }
  function text(s) {
    var who = Object.keys(s.who).sort(function (a, b) { return s.who[b] - s.who[a]; }).map(function (k) { return '   • ' + k + ': ' + inr(s.who[k]); }).join('\n');
    return '🌙 *TTESPL – Day Closing ' + dmy(s.d) + '*\n\n' +
      '🧾 *Sales (delivered):* ' + inr(s.sales) + ' (' + s.bills + ' bill' + (s.bills === 1 ? '' : 's') + ')\n' +
      '💰 *Collected:* ' + inr(s.coll) + '\n   Cash ' + inr(s.by.Cash) + ' · UPI ' + inr(s.by.UPI) + ' · Bank/other ' + inr(s.by['Bank / other']) + '\n' + (who ? who + '\n' : '') +
      '💸 *Expenses:* ' + inr(s.exp) + (s.expN ? ' (' + s.expN + ')' : '') + '\n' +
      '💵 *Cash in hand movement:* ' + (s.cashMove >= 0 ? '+' : '−') + inr(Math.abs(s.cashMove)) + ' (cash collected − cash expenses)\n\n' +
      '📦 *New orders:* ' + s.booked + ' (' + inr(s.bookedVal) + ')\n🚚 *Pending deliveries:* ' + s.pend + ' (' + inr(s.pendVal) + ')\n' +
      '⏳ *Total dues:* ' + inr(s.dueAll) + ' · 30+ days: ' + inr(s.due30) + '\n📉 *Low stock items:* ' + s.low + ' · 🛠 *Open service calls:* ' + s.svc +
      (s.top.length ? '\n\n⭐ *Top bills today*\n' + s.top.map(function (t) { return '   • ' + t[0] + ' – ' + inr(t[1]); }).join('\n') : '') + '\n\n_TTESPL, Bhubaneswar_';
  }
  function kp(l, v, c, sub) { return '<div style="flex:1 1 46%;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:9px 11px"><small style="color:var(--text-muted)">' + l + '</small><div style="font-weight:900;font-size:17px;color:' + (c || 'inherit') + '">' + v + '</div>' + (sub ? '<small style="color:var(--text-muted)">' + sub + '</small>' : '') + '</div>'; }
  function open(d) {
    d = d || iso(new Date()); var s = calc(d), owner = ''; try { owner = localStorage.getItem(OK) || ''; } catch (e) {}
    var h = '<input type="date" data-c="date" value="' + d + '" max="' + iso(new Date()) + '" style="width:100%;margin-bottom:8px">' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' + kp('Sales', inr(s.sales), '', s.bills + ' bills') + kp('Collected', inr(s.coll), 'var(--success)', 'Cash ' + inr(s.by.Cash) + ' · UPI ' + inr(s.by.UPI)) +
      kp('Expenses', inr(s.exp), 'var(--danger)', s.expN + ' entries') + kp('Cash movement', (s.cashMove >= 0 ? '+' : '−') + inr(Math.abs(s.cashMove)), s.cashMove >= 0 ? 'var(--success)' : 'var(--danger)', 'cash in − cash out') +
      kp('New orders', s.booked, '', inr(s.bookedVal)) + kp('Pending delivery', s.pend, '', inr(s.pendVal)) + kp('Total dues', inr(s.dueAll), 'var(--danger)', '30+ days ' + inr(s.due30)) + kp('Low stock', s.low, '', s.svc + ' open service calls') + '</div>' +
      '<div class="ttx-note" style="margin-top:10px"><b>Owner WhatsApp number</b> <small>(saved on this phone)</small></div><input type="tel" id="clOwner" inputmode="numeric" placeholder="10-digit mobile" value="' + H(owner) + '" style="width:100%">' +
      '<textarea id="clText" rows="11" style="width:100%;margin-top:8px;font-size:13px"></textarea>' +
      '<div class="ttx-btns" style="flex-wrap:wrap"><button class="ttx-b pri" data-a="wa" style="flex:1 1 100%">📲 Send to owner on WhatsApp</button><button class="ttx-b" data-a="share" style="flex:1 1 48%">📤 Share…</button><button class="ttx-b" data-a="copy" style="flex:1 1 48%">📋 Copy</button></div>' +
      '<div class="ttx-note" style="font-size:11.5px;opacity:.8">Read-only report. Sending is manual (nothing goes out by itself).</div>';
    X.sheet(ID, '🌙 Day closing', h, { z: 3900 });
    var tx = function () { return ($('clText') || {}).value || ''; };
    X.bind(ID, {
      click: {
        wa: function () { var n = (($('clOwner') || {}).value || '').replace(/\D/g, '').slice(-10); if (n.length === 10) { try { localStorage.setItem(OK, n); } catch (e) {} } window.open((n.length === 10 ? 'https://wa.me/91' + n : 'https://wa.me/') + '?text=' + encodeURIComponent(tx()), '_blank'); },
        share: function () { if (navigator.share) navigator.share({ text: tx() }).catch(function () {}); else X.toast('Share is not supported here - use Copy'); },
        copy: function () { var el = $('clText'); try { navigator.clipboard.writeText(el.value).then(function () { X.toast('Copied'); }); } catch (e) { el.select(); document.execCommand('copy'); X.toast('Copied'); } }
      },
      change: { date: function (v) { if (v) open(v); } }
    });
    $('clText').value = text(s);
  }
  window.ttOpenClosing = open; window.ttClosingText = function (d) { return text(calc(d || iso(new Date()))); };

  function inject() {
    try {
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt43-cl')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt43-cl'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenClosing(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>🌙</span><span>Day Closing Report</span></div><span style="font-size:10px;color:#38bdf8;">WhatsApp</span>';
        list.appendChild(d);
      }
    } catch (e) {}
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);
})();
