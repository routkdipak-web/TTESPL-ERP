/* TTESPL ERP v42.2 - MERGE MOVES BILLS + LEDGER "UPDATE" WARNING + CUSTOMER DELETE
   - Customer > Edit > Merge another customer > Save: the merged customer's bills / leads / services are moved to the main customer's name + phone.
     Every moved bill gets a "Merged from ... - update" warning in Ledger. Admin clears it with "Updated" (or by saving the bill in Ledger edit).
   - Customer card: Admin gets a delete button (copy goes to Recycle bin, bills are never deleted).
   Nothing is deleted by merge itself; old bill numbers / amounts / items are untouched. */
(function () {
  'use strict';
  var V = window.ttV41;
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return window.ttEscHtml ? ttEscHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var l10 = function (p) { return String(p || '').replace(/\D/g, '').slice(-10); };
  var low = function (s) { return String(s || '').trim().toLowerCase(); };
  function toast(m) { try { if (V && V.toast) return V.toast(m); if (window.ttToast42) return ttToast42(m); } catch (e) {} alert(m); }
  function me() { try { return (currentUser && currentUser.name) || 'Admin'; } catch (e) { return 'Admin'; } }
  function isAdm() { try { return isAdminUser(); } catch (e) { return false; } }
  function now() { try { return getNowStr(); } catch (e) { return new Date().toISOString(); } }

  /* ---------- 1) move bills of merged customers to the main customer ---------- */
  function phonesOf(c) { var m = {}, p = l10(c.phone); if (p) m[p] = 1; (c.contacts || []).forEach(function (k) { p = l10(k.phone); if (p) m[p] = 1; }); return m; }
  function pick(list, main, other) {
    var ph = phonesOf(other), nm = low(other.name), mainNm = low(main.name), mainPh = l10(main.phone);
    return list.filter(function (x) {
      if (!x) return false;
      var xp = l10(x.phone), xn = low(x.customerName);
      if (xp && ph[xp] && xp !== mainPh) return true;                         // other customer's own number
      if (xp && ph[xp] && xp === mainPh) return false;                        // already on main number
      return xn === nm && nm !== mainNm && (!xp || ph[xp]);                   // same old name (no number or other's number)
    });
  }
  window.ttMfMoveBills = function (main, others) {
    if (!main || !others || !others.length) return;
    var O = (typeof ordersData !== 'undefined' && ordersData) || [], Ls = (typeof leadsData !== 'undefined' && leadsData) || [], Ss = (typeof serviceCallsData !== 'undefined' && serviceCallsData) || [];
    var jobs = others.map(function (o) { return { o: o, ord: pick(O, main, o), lead: pick(Ls, main, o), svc: pick(Ss, main, o) }; });
    var nO = 0, nL = 0, nS = 0; jobs.forEach(function (j) { nO += j.ord.length; nL += j.lead.length; nS += j.svc.length; });
    if (!nO && !nL && !nS) return;
    if (!confirm('Move old records of the merged customer(s) to "' + main.name + '"?\n\n' + nO + ' bill(s), ' + nL + ' lead(s), ' + nS + ' service call(s).\n\nMoved bills show a ⚠️ warning in Ledger until you update them (Ledger > ✏️ Save, or "Updated" button).\n(Printed bills keep the old name on paper.)')) return;
    var at = now();
    jobs.forEach(function (j) {
      j.ord.forEach(function (x) {
        if (!x.mergeFlag) x.mergeFlag = { from: x.customerName || j.o.name, phone: x.phone || '', at: at, by: me() };
        x.customerName = main.name; if (l10(main.phone)) x.phone = main.phone;
        x.auditTrail = x.auditTrail || []; x.auditTrail.unshift({ by: me(), time: at, note: 'Customer merged: "' + (x.mergeFlag.from || '') + '" → "' + main.name + '"' });
      });
      j.lead.forEach(function (x) { x.customerName = main.name; if (l10(main.phone)) x.phone = main.phone; });
      j.svc.forEach(function (x) { x.customerName = main.name; if (l10(main.phone)) x.phone = main.phone; });
    });
    main.aliases = Array.from(new Set((main.aliases || []).concat(others.map(function (o) { return o.name; }).filter(Boolean))));
    if (nO) setStored('ORDERS', ordersData); if (nL) setStored('LEADS', leadsData); if (nS) setStored('SERVICES', serviceCallsData); setStored('CUSTOMERS', customerDatabase);
    try { window.ttActAdd && ttActAdd('Customer', 'merged', main.name, nO + ' bill(s) moved from ' + others.map(function (o) { return o.name; }).join(', ')); } catch (e) {}
    try { renderOrders(); renderLeads(); renderServices(); renderBilling('all'); renderDashboard(); } catch (e) {}
    toast(nO + ' bill(s) moved - update them in Ledger');
  };

  /* ---------- 2) ledger warning ---------- */
  window.ttMfBadge = function (o) {
    if (!o || !o.mergeFlag) return '';
    var id = String(o.id).replace(/[^\w-]/g, '');
    return '<div class="tt42-mf" onclick="event.stopPropagation()">⚠️ Merged from “' + H(o.mergeFlag.from || '') + '” – update needed' +
      (isAdm() ? ' <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();ttMfClear(\'' + id + '\')">✔ Updated</button>' : '') + '</div>';
  };
  window.ttMfClear = function (id) {
    if (!isAdm()) return alert('Only Admin can clear this warning.');
    var o = ordersData.find(function (x) { return String(x.id) === String(id); }); if (!o || !o.mergeFlag) return;
    if (!confirm('Mark this bill as updated?\n(Merged from "' + o.mergeFlag.from + '")')) return;
    delete o.mergeFlag; o.auditTrail = o.auditTrail || []; o.auditTrail.unshift({ by: me(), time: now(), note: 'Merge warning cleared' });
    setStored('ORDERS', ordersData); try { renderBilling('all'); } catch (e) {} toast('Marked updated');
  };
  (function () {   // saving the bill in Ledger edit = updated
    var s = window.saveAdminLedgerInvoice; if (typeof s !== 'function') return;
    window.saveAdminLedgerInvoice = function () {
      var id = ($('editLedgerInvId') || {}).value, o = id && ordersData.find(function (x) { return x.id === id; }), had = !!(o && o.mergeFlag);
      var r = s.apply(this, arguments);
      try { if (had && o.mergeFlag) { delete o.mergeFlag; setStored('ORDERS', ordersData); try { renderBilling('all'); } catch (e) {} } } catch (e) { console.warn(e); }
      return r;
    };
  })();
  (function () { var st = document.createElement('style'); st.textContent = '.tt42-mf{margin-top:5px;padding:5px 8px;border-radius:9px;font-size:11.5px;font-weight:700;line-height:1.5;background:rgba(245,158,11,.16);color:#b45309;border:1px solid rgba(245,158,11,.45)}.tt42-mf .btn{margin-left:6px;padding:2px 8px;font-size:11px}'; document.head.appendChild(st); })();

  /* ---------- 3) delete customer (Admin) ---------- */
  window.ttDeleteCustomer = function (id) {
    if (!isAdm()) return alert('Only Admin can delete a customer.');
    var c = (customerDatabase || []).find(function (x) { return String(x.id) === String(id); }); if (!c) return;
    var nm = low(c.name), ph = phonesOf(c);
    var bills = (ordersData || []).filter(function (o) { var p = l10(o.phone); return low(o.customerName) === nm || (p && ph[p]); }).length;
    var msg = 'Delete customer "' + c.name + '"' + (c.phone ? ' (' + c.phone + ')' : '') + '?\n\n' +
      (bills ? '⚠️ ' + bills + ' bill(s) exist for this customer. The bills are NOT deleted (they stay in Ledger), only the customer record goes.\n\n' : '') +
      'A copy is kept in the Recycle bin.';
    if (!confirm(msg)) return;
    var before = customerDatabase.slice();
    customerDatabase = customerDatabase.filter(function (x) { return String(x.id) !== String(id); });
    window.customerDatabase = customerDatabase;
    setStored('CUSTOMERS', customerDatabase);
    try { V && V.afterDelete && V.afterDelete('CUSTOMERS', before, customerDatabase); } catch (e) { console.warn(e); }
    try { window.ttActAdd && ttActAdd('Customer', 'deleted', c.name, 'Customer removed'); } catch (e) {}
    try { renderStockList(); } catch (e) {}
    toast('Customer deleted');
  };
})();
