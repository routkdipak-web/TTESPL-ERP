/* TTESPL ERP v41 - CUSTOMER CONTACTS
   In Customer > Edit you can now:
     - add MANY contacts under one customer (name, role, phone, email)  - owner, manager, accountant, workshop staff ...
     - "Merge another customer here": pulls the other customer's name / phone / email into this one as contacts (nothing is lost; you press Save to confirm)
   Search in the order form finds the customer by ANY of its contact numbers / names.
   Also fixed: Email and Contact Person typed in the customer form were never saved. */
(function () {
  'use strict';
  var V = window.ttV41; if (!V) return;
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return window.ttEscHtml(s); };
  var MAX = 25;
  var pendingMerge = [];   // ids of customers merged into the open form (offered for removal after Save)
  var l10 = function (p) { return String(p || '').replace(/\D/g, '').slice(-10); };
  function cust(id) { return (customerDatabase || []).find(function (c) { return String(c.id) === String(id); }); }

  /* ---------- form UI ---------- */
  function rowHtml(k) {
    k = k || {};
    return '<div class="tt41-ctr"><input class="tt41-in" data-f="name" placeholder="Name" maxlength="40" value="' + H(k.name) + '"><input class="tt41-in" data-f="role" placeholder="Role (Owner / Manager…)" maxlength="30" value="' + H(k.role) + '">' +
      '<input class="tt41-in" data-f="phone" type="tel" inputmode="numeric" placeholder="Phone (10 digits)" maxlength="12" value="' + H(k.phone) + '"><input class="tt41-in" data-f="email" type="email" placeholder="Email (optional)" maxlength="60" value="' + H(k.email) + '">' +
      '<button type="button" class="btn btn-danger-sm btn-sm tt41-ctx" onclick="this.closest(\'.tt41-ctr\').remove();ttCtCount()" aria-label="Remove contact">✕</button></div>';
  }
  function inject() {
    var card = $('customerModal') && $('customerModal').querySelector('.auth-card'); if (!card || $('tt41Ct')) return;
    card.style.maxHeight = '92vh'; card.style.overflowY = 'auto';
    var save = card.querySelector('button.btn-primary.btn-block');
    var box = document.createElement('div'); box.id = 'tt41Ct'; box.className = 'tt41-ct';
    box.innerHTML = '<div class="tt41-ct-h"><b>📇 More contacts <span id="tt41CtN"></span></b><small>owner, manager, accountant, workshop staff…</small></div><div id="tt41CtList"></div>' +
      '<div class="tt41-row2"><button type="button" class="btn btn-outline btn-sm" onclick="ttCtAdd()">➕ Add contact</button><button type="button" class="btn btn-outline btn-sm" id="tt41CtMergeBtn" onclick="ttCtMergeOpen()">🔗 Merge another customer</button></div><div id="tt41CtMergeNote" class="tt41-sub"></div>';
    card.insertBefore(box, save);
  }
  window.ttCtCount = function () { var n = document.querySelectorAll('#tt41CtList .tt41-ctr').length, e = $('tt41CtN'); if (e) e.textContent = n ? '(' + n + ')' : ''; };
  window.ttCtAdd = function (k) {
    var list = $('tt41CtList'); if (!list) return null;
    if (list.children.length >= MAX) { alert('Maximum ' + MAX + ' contacts per customer.'); return null; }
    var d = document.createElement('div'); d.innerHTML = rowHtml(k); var row = d.firstChild; list.appendChild(row); ttCtCount();
    if (!k) { var f = row.querySelector('input'); try { f.focus(); } catch (e) {} }
    return row;
  };
  function readContacts() {
    var out = [], seen = {};
    document.querySelectorAll('#tt41CtList .tt41-ctr').forEach(function (r) {
      var o = {}; r.querySelectorAll('input').forEach(function (i) { o[i.getAttribute('data-f')] = String(i.value || '').trim(); });
      o.phone = l10(o.phone);
      if (!o.name && !o.phone && !o.email) return;
      var key = o.phone || (o.name + '|' + o.email); if (seen[key]) return; seen[key] = 1;
      out.push({ id: 'k' + Date.now().toString(36) + out.length, name: window.ttCleanText ? ttCleanText(o.name, 40) : o.name.slice(0, 40), role: window.ttCleanText ? ttCleanText(o.role, 30) : o.role.slice(0, 30), phone: o.phone, email: o.email.slice(0, 60) });
    });
    return out;
  }
  (function () {
    var o = window.openAddCustomerModal; if (typeof o !== 'function') return;
    window.openAddCustomerModal = function (cObj) {
      var r = o.apply(this, arguments);
      try {
        inject(); pendingMerge = []; var list = $('tt41CtList'); if (list) list.innerHTML = '';
        if (cObj && Array.isArray(cObj.contacts)) cObj.contacts.forEach(function (k) { ttCtAdd(k); });
        ttCtCount(); if ($('tt41CtMergeNote')) $('tt41CtMergeNote').textContent = '';
        if ($('tt41CtMergeBtn')) $('tt41CtMergeBtn').style.display = cObj ? '' : 'none';   // merge needs a saved customer
        if (cObj && $('cEmail')) { $('cEmail').value = cObj.email || ''; $('cPerson').value = cObj.person || ''; }
      } catch (e) { console.warn('customer contacts', e); }
      return r;
    };
  })();

  /* ---------- save ---------- */
  (function () {
    var o = window.saveCustomerAction; if (typeof o !== 'function') return;
    window.saveCustomerAction = function () {
      var editId = ($('editCustId') || {}).value, phone = l10(($('cPhone') || {}).value), name = (($('cName') || {}).value || '').trim();
      var email = (($('cEmail') || {}).value || '').trim(), person = (($('cPerson') || {}).value || '').trim(), contacts = $('tt41CtList') ? readContacts() : null, merged = pendingMerge.slice();
      if (name && phone) {   // warn (not block) when this phone already belongs to another customer
        var cur = editId ? cust(editId) : null, twin = (customerDatabase || []).find(function (c) { return (!cur || c.id !== cur.id) && (l10(c.phone) === phone || (c.contacts || []).some(function (k) { return l10(k.phone) === phone; })); });
        if (twin && (!cur || l10(cur.phone) !== phone) && !confirm('The number ' + phone + ' already belongs to "' + twin.name + '".\n\nTip: use "Merge another customer" to keep them as one.\n\nSave anyway?')) return;
      }
      var r = o.apply(this, arguments);
      try {
        if ($('customerModal').style.display !== 'none') return r;   // validation failed, form still open
        var c = editId ? cust(editId) : customerDatabase[0];
        if (!c) return r;
        c.email = email; c.person = person;
        if (contacts) { if (contacts.length) c.contacts = contacts; else delete c.contacts; }
        if (merged.length) { c.aliases = Array.from(new Set((c.aliases || []).concat(merged.map(function (id) { var m = cust(id); return m ? m.name : ''; }).filter(Boolean)))); }
        setStored('CUSTOMERS', customerDatabase);
        try { renderStockList(); } catch (e) {}
        if (merged.length) offerRemoval(c, merged);
        pendingMerge = [];
      } catch (e) { console.warn('customer save hook', e); }
      return r;
    };
  })();
  function offerRemoval(main, ids) {
    var rest = ids.map(cust).filter(Boolean); if (!rest.length) return;
    if (!confirm('Merged: ' + rest.map(function (c) { return '"' + c.name + '"'; }).join(', ') + ' → "' + main.name + '".\n\nRemove the old customer record(s) now? (A copy stays in the Recycle bin. Old bills keep the name they were billed with.)')) return;
    var before = (customerDatabase || []).slice();
    customerDatabase = customerDatabase.filter(function (c) { return ids.indexOf(String(c.id)) < 0 && ids.indexOf(c.id) < 0; });
    setStored('CUSTOMERS', customerDatabase);
    try { V.afterDelete('CUSTOMERS', before, customerDatabase); } catch (e) { console.warn(e); }
    try { renderStockList(); } catch (e) {}
  }

  /* ---------- merge picker ---------- */
  window.ttCtMergeOpen = function () {
    var me = ($('editCustId') || {}).value; if (!me) return alert('Save the customer first, then merge.');
    V.modal('tt41Mg', '🔗 Merge another customer here', '<div class="tt41-sub">Pick the customer to bring in. Its name, phone and email are added as contacts here. You still press <b>Save</b> to confirm.</div><input class="tt41-in" id="tt41MgQ" placeholder="Search name or phone" oninput="ttCtMergeList()" autocomplete="off"><div id="tt41MgL"></div>');
    ttCtMergeList(); try { $('tt41MgQ').focus(); } catch (e) {}
  };
  window.ttCtMergeList = function () {
    var q = (($('tt41MgQ') || {}).value || '').toLowerCase().trim(), me = ($('editCustId') || {}).value, box = $('tt41MgL'); if (!box) return;
    var list = (customerDatabase || []).filter(function (c) { return String(c.id) !== String(me) && pendingMerge.indexOf(String(c.id)) < 0 && (!q || (String(c.name || '') + ' ' + String(c.phone || '') + ' ' + String(c.person || '')).toLowerCase().indexOf(q) >= 0); }).slice(0, 30);
    box.innerHTML = list.length ? list.map(function (c) { return '<div class="tt41-row" style="cursor:pointer" onclick="ttCtMergeDo(\'' + String(c.id).replace(/[^\w-]/g, '') + '\')"><div style="flex:1;min-width:0;"><b>' + H(c.name) + '</b><small>' + H(c.phone) + (c.person ? ' · ' + H(c.person) : '') + (c.gst && c.gst !== 'Unregistered' ? ' · ' + H(c.gst) : '') + '</small></div><span>＋</span></div>'; }).join('') : '<div class="tt41-empty">No customer found</div>';
  };
  window.ttCtMergeDo = function (id) {
    var other = cust(id); if (!other) return;
    var have = {}; document.querySelectorAll('#tt41CtList .tt41-ctr [data-f=phone]').forEach(function (i) { var p = l10(i.value); if (p) have[p] = 1; });
    var mainPhone = l10(($('cPhone') || {}).value); if (mainPhone) have[mainPhone] = 1;
    var added = 0;
    function addC(name, role, phone, email) { var p = l10(phone); if (p && have[p]) return; if (p) have[p] = 1; if (!name && !p && !email) return; if (ttCtAdd({ name: name, role: role, phone: p, email: email })) added++; }
    addC(other.person || other.name, other.person && other.person !== other.name ? 'Contact of ' + other.name : 'Merged: ' + other.name, other.phone, other.email);
    (other.contacts || []).forEach(function (k) { addC(k.name, k.role, k.phone, k.email); });
    // fill blanks of the main form from the other customer
    if ($('cAddress') && !$('cAddress').value.trim() && other.address) $('cAddress').value = other.address;
    if ($('cGst') && other.gst && other.gst !== 'Unregistered' && (!$('cGst').value.trim() || $('cGst').value.trim() === 'Unregistered')) $('cGst').value = other.gst;
    if ($('cEmail') && !$('cEmail').value.trim() && other.email) $('cEmail').value = other.email;
    if ($('cPerson') && !$('cPerson').value.trim() && other.person) $('cPerson').value = other.person;
    pendingMerge.push(String(other.id));
    var n = $('tt41CtMergeNote'); if (n) n.textContent = '✅ "' + other.name + '" merged into this form (' + added + ' contact' + (added === 1 ? '' : 's') + ' added). Press Save to confirm.';
    var m = $('tt41Mg'); if (m) m.remove();
  };

  /* ---------- show contacts on the customer card ---------- */
  window.ttContactsLine = function (c) {
    var ks = Array.isArray(c && c.contacts) ? c.contacts : []; if (!ks.length) return '';
    return '<div class="tt41-cchips" onclick="event.stopPropagation()">' + ks.slice(0, 6).map(function (k) {
      var p = l10(k.phone), label = H(k.name || p || 'Contact') + (k.role ? ' · ' + H(k.role) : '');
      return '<span class="tt41-cc"><span>' + label + '</span>' + (p ? '<a href="tel:+91' + p + '" onclick="event.stopPropagation()" aria-label="Call">📞</a><a href="https://wa.me/91' + p + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" aria-label="WhatsApp">💬</a>' : '') + '</span>';
    }).join('') + (ks.length > 6 ? '<span class="tt41-cc">+' + (ks.length - 6) + ' more</span>' : '') + '</div>';
  };
  document.addEventListener('DOMContentLoaded', inject);
  if (document.readyState !== 'loading') inject();
})();
