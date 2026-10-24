/* TTESPL ERP module: 17-v40-prevdue.js
   Ledger > Edit: ON/OFF "show customer's previous pending due on this bill".
   Only adds two fields to the bill (prevDueOn, prevDueAmt) used for the invoice note.
   Bill total / received / due, ledger totals, dashboard and all formulas are NOT touched. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function l10(p) { return String(p || '').replace(/\D/g, '').slice(-10); }
  function nm(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function dOf(o) { return String(o.orderDate || o.date || o.deliveryDate || '').slice(0, 10); }
  function cur() { var id = ($('editLedgerInvId') || {}).value; return (typeof ordersData !== 'undefined' ? ordersData : []).find(function (x) { return String(x.id) === String(id); }); }

  /* old pending due of the same customer = due of this customer's OTHER bills dated on/before this bill */
  function oldDue(o) {
    var sum = 0, n = 0, mine = dOf(o), p = l10(o.phone), nn = nm(o.customerName);
    (ordersData || []).forEach(function (x) {
      if (!x || x.id === o.id || x.status === 'Cancelled') return;
      var xp = l10(x.phone), same = (p && xp) ? (xp === p) : (nn && nm(x.customerName) === nn); if (!same) return;   /* v41: two different customers with the same name but different phones are no longer mixed */
      var d = dOf(x); if (mine && d && d > mine) return;
      var due = Number(x.dueAmount) || 0; if (due > 0) { sum += due; n++; }
    });
    return { sum: Math.round(sum * 100) / 100, n: n };
  }
  window.ttPrevDueTotal = function () {
    var o = cur(), note = $('editLedgerPrevDueNote'); if (!o || !note) return;
    var prev = parseFloat(($('editLedgerPrevDueAmt') || {}).value) || 0, due = parseFloat(($('editLedgerDueAmt') || {}).value) || 0;
    note.textContent = 'This bill due ₹' + due.toLocaleString('en-IN') + ' + previous ₹' + prev.toLocaleString('en-IN') + ' = total outstanding ₹' + (due + prev).toLocaleString('en-IN');
  };
  window.ttPrevDueToggle = function () {
    var on = $('editLedgerPrevDueOn').checked, row = $('editLedgerPrevDueRow'); if (row) row.style.display = on ? 'block' : 'none';
    var inp = $('editLedgerPrevDueAmt'), o = cur();
    if (on && inp && o && (inp.value === '' || inp.dataset.auto === '1')) { var r = oldDue(o); inp.value = r.sum; inp.dataset.auto = '1'; var nt = $('editLedgerPrevDueNote'); if (nt) nt.dataset.cnt = r.n; }
    ttPrevDueTotal();
    var nt2 = $('editLedgerPrevDueNote'); if (on && nt2 && o) { var r2 = oldDue(o); nt2.textContent += '  (' + r2.n + ' older bill' + (r2.n === 1 ? '' : 's') + ' with due found - you can edit the amount)'; }
  };

  var oOpen = window.openAdminEditLedgerModal;
  if (typeof oOpen === 'function') window.openAdminEditLedgerModal = function (id) {
    var r = oOpen.apply(this, arguments);
    var o = (ordersData || []).find(function (x) { return String(x.id) === String(id); });
    if (o && $('editLedgerPrevDueOn')) {
      var inp = $('editLedgerPrevDueAmt'); $('editLedgerPrevDueOn').checked = !!o.prevDueOn;
      inp.value = o.prevDueOn ? (Number(o.prevDueAmt) || 0) : ''; inp.dataset.auto = '';
      $('editLedgerPrevDueRow').style.display = o.prevDueOn ? 'block' : 'none'; ttPrevDueTotal();
    }
    return r;
  };
  var oSave = window.saveAdminLedgerInvoice;
  if (typeof oSave === 'function') window.saveAdminLedgerInvoice = function () {
    var o = cur();
    if (o && $('editLedgerPrevDueOn')) {
      var on = $('editLedgerPrevDueOn').checked, amt = Math.max(0, parseFloat($('editLedgerPrevDueAmt').value) || 0);
      var was = (o.prevDueOn ? 1 : 0) + '|' + (Number(o.prevDueAmt) || 0), now = (on ? 1 : 0) + '|' + (on ? amt : (Number(o.prevDueAmt) || 0));
      o.prevDueOn = on; if (on) o.prevDueAmt = amt;
      if (was !== now) { o.auditTrail = o.auditTrail || []; o.auditTrail.unshift({ by: (typeof currentUser !== 'undefined' && currentUser ? currentUser.name : '') + ' (Admin)', time: (typeof getNowStr === 'function' ? getNowStr() : ''), note: on ? 'Previous pending due ₹' + amt + ' shown on invoice' : 'Previous pending due removed from invoice' }); }
    }
    return oSave.apply(this, arguments);
  };
})();
