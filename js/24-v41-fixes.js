/* TTESPL ERP v41 - FIX TOOLS
   A2 customer rename -> old bills follow   A3 missing price list + bulk edit   A6 ledger edit leaves a trace in payments
   A7 edit of a delivered bill corrects stock   A9 security status   A11 storage health   A12 customer data check
   Every part has a switch / button in Settings. */
(function () {
  'use strict';
  var V = window.ttV41; if (!V) return;
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return window.ttEscHtml(s); };
  var N = function (x) { return Number(x) || 0; };
  var R2 = function (x) { return Math.round(N(x) * 100) / 100; };
  var l10 = function (p) { return String(p || '').replace(/\D/g, '').slice(-10); };
  var D = { editStockSync: 1, ledgerAdjust: 1, custRenameSync: 1, storageWatch: 1 };
  Object.keys(D).forEach(function (k) { V.DEFAULTS[k] = D[k]; if (window.ttFeat && ttFeat.get(k) === undefined) ttFeat.set(k, D[k]); });
  var F = V.F;
  function ord() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function inv() { return (typeof sampleInventory !== 'undefined' && sampleInventory) || []; }

  /* ---------- settings ---------- */
  var prev = window.ttModSettings;
  window.ttModSettings = function (sw, group) {
    var r; try { r = prev ? prev(sw, group) : ''; } catch (e) { console.warn(e); }
    function act(t, s, fn, l) { return '<div class="tt25-row"><div class="tt25-rt"><b>' + t + '</b><small>' + s + '</small></div><button class="btn btn-outline btn-sm" onclick="' + fn + '">' + l + '</button></div>'; }
    var rows = [sw('custRenameSync', 'Customer rename updates old bills', 'When you change a customer name, you are asked to update its old bills, leads and services too'),
      sw('editStockSync', 'Edit of a delivered bill corrects stock', 'Quantity changed on a delivered bill → the stock difference is added / removed (asks first)'),
      sw('ledgerAdjust', 'Ledger edit leaves a payment trace', 'When Admin changes the received amount in Ledger, an “Admin adjustment” line is added to the payments list (not counted as cash)'),
      sw('storageWatch', 'Phone storage warning', 'Warns when this phone’s app storage is nearly full'),
      act('Missing prices', 'Items with no rate or no dealer (cost) price – fix many at once', 'ttOpenMissingPrices()', 'Open'),
      act('Customer data check', 'Customers without phone, same phone, same name', 'ttOpenCustCheck()', 'Open'),
      act('Storage health', 'How full this phone’s storage is', 'ttStorageHealth()', 'Open'),
      act('Security status', 'A short checklist of what protects your data', 'ttSecurityStatus()', 'Open')];
    group('🩺 Fixes & Health (on / off)', rows);
    return r;
  };
  window.ttGroupStyles = Object.assign(window.ttGroupStyles || {}, { 'Fixes & Health': ['🩺', '#ff375f', '#d70f3f'] });
  window.ttGroupSubs = Object.assign(window.ttGroupSubs || {}, { 'Fixes & Health': 'Missing prices, data check, storage' });

  /* ---------- A3: missing prices ---------- */
  var MP = { mode: 'rate', q: '', page: 0 };
  function mpList() {
    var q = MP.q.toLowerCase();
    return inv().filter(function (p) { var miss = MP.mode === 'rate' ? !(N(p.rate) > 0) : !(N(p.dealerPrice) > 0); return miss && (!q || (String(p.name || '') + ' ' + String(p.code || '')).toLowerCase().indexOf(q) >= 0); });
  }
  window.ttOpenMissingPrices = function () { MP.page = 0; mpDraw(); };
  function mpDraw() {
    var all = mpList(), per = 25, pages = Math.max(1, Math.ceil(all.length / per)); MP.page = Math.min(MP.page, pages - 1);
    var cntRate = inv().filter(function (p) { return !(N(p.rate) > 0); }).length, cntDeal = inv().filter(function (p) { return !(N(p.dealerPrice) > 0); }).length;
    var h = '<div class="tt41-row2"><button class="btn ' + (MP.mode === 'rate' ? 'btn-primary' : 'btn-outline') + ' btn-sm" onclick="ttMpMode(\'rate\')">No rate (' + cntRate + ')</button><button class="btn ' + (MP.mode === 'dealer' ? 'btn-primary' : 'btn-outline') + ' btn-sm" onclick="ttMpMode(\'dealer\')">No cost price (' + cntDeal + ')</button></div>' +
      '<input class="tt41-in" placeholder="Search item" value="' + H(MP.q) + '" oninput="ttMpQ(this.value)"><div class="tt41-sub">Fill the price and press Save. “Rate” is what you sell at (incl. GST); “Cost” is the dealer / purchase price (incl. GST) used for profit.</div>' +
      all.slice(MP.page * per, MP.page * per + per).map(function (p) { return '<div class="tt41-mpr" data-id="' + H(p.id) + '"><div class="tt41-mpn">' + H(p.name) + '<small>' + H(p.category || '') + ' · stock ' + H(p.stock) + '</small></div><input type="number" class="tt41-in" data-f="rate" step="any" inputmode="decimal" placeholder="Rate" value="' + (N(p.rate) > 0 ? p.rate : '') + '"><input type="number" class="tt41-in" data-f="dealerPrice" step="any" inputmode="decimal" placeholder="Cost" value="' + (N(p.dealerPrice) > 0 ? p.dealerPrice : '') + '"></div>'; }).join('') +
      (all.length ? '' : '<div class="tt41-empty">Nothing missing here 🎉</div>') +
      '<div class="tt41-row2" style="margin-top:8px;"><button class="btn btn-outline btn-sm" onclick="ttMpPage(-1)"' + (MP.page ? '' : ' disabled') + '>‹ Prev</button><button class="btn btn-primary btn-sm" onclick="ttMpSave()">💾 Save this page</button><button class="btn btn-outline btn-sm" onclick="ttMpPage(1)"' + (MP.page < pages - 1 ? '' : ' disabled') + '>Next ›</button></div><div class="tt41-sub" style="text-align:center;">Page ' + (MP.page + 1) + ' / ' + pages + '</div>';
    V.modal('tt41Mp', '💲 Missing prices', h, true);
  }
  window.ttMpMode = function (m) { MP.mode = m; MP.page = 0; mpDraw(); };
  window.ttMpPage = function (d) { MP.page = Math.max(0, MP.page + d); mpDraw(); };
  window.ttMpQ = function (v) { MP.q = v; MP.page = 0; var el = document.querySelector('#tt41Mp .tt41-in'), pos = el && el.selectionStart; mpDraw(); el = document.querySelector('#tt41Mp .tt41-in'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } };
  window.ttMpSave = function () {
    var n = 0;
    document.querySelectorAll('#tt41Mp .tt41-mpr').forEach(function (r) {
      var id = r.getAttribute('data-id'), p = inv().find(function (x) { return String(x.id) === String(id); }); if (!p) return;
      r.querySelectorAll('input').forEach(function (i) { var v = R2(i.value), f = i.getAttribute('data-f'); if (v > 0 && N(p[f]) !== v) { p[f] = v; n++; } });
    });
    if (n) { setStored('INVENTORY', sampleInventory); try { renderStockList(); } catch (e) {} try { window.ttActAdd && ttActAdd('Stock', 'prices updated', '', n + ' price(s) via Missing prices'); } catch (e) {} }
    V.toast(n ? n + ' price(s) saved' : 'Nothing changed'); mpDraw();
  };

  /* ---------- A12: customer data check ---------- */
  var CC = { tab: 'nophone' };
  window.ttOpenCustCheck = function () { ccDraw(); };
  function ccGroups() {
    var cs = (typeof customerDatabase !== 'undefined' && customerDatabase) || [], ph = {}, nm = {}, none = [];
    cs.forEach(function (c) { var p = l10(c.phone), n = String(c.name || '').trim().toLowerCase(); if (!p) none.push(c); else (ph[p] = ph[p] || []).push(c); if (n) (nm[n] = nm[n] || []).push(c); });
    return { none: none, ph: Object.keys(ph).filter(function (k) { return ph[k].length > 1; }).map(function (k) { return ph[k]; }), nm: Object.keys(nm).filter(function (k) { return nm[k].length > 1; }).map(function (k) { return nm[k]; }) };
  }
  function ccDraw() {
    var g = ccGroups(), h = '<div class="tt41-row2"><button class="btn ' + (CC.tab === 'nophone' ? 'btn-primary' : 'btn-outline') + ' btn-sm" onclick="ttCcTab(\'nophone\')">No phone (' + g.none.length + ')</button><button class="btn ' + (CC.tab === 'ph' ? 'btn-primary' : 'btn-outline') + ' btn-sm" onclick="ttCcTab(\'ph\')">Same phone (' + g.ph.length + ')</button><button class="btn ' + (CC.tab === 'nm' ? 'btn-primary' : 'btn-outline') + ' btn-sm" onclick="ttCcTab(\'nm\')">Same name (' + g.nm.length + ')</button></div>';
    function row(c) { return '<div class="tt41-row"><div style="flex:1;min-width:0;"><b>' + H(c.name) + '</b><small>' + H(c.phone || 'no phone') + (c.address ? ' · ' + H(String(c.address).slice(0, 40)) : '') + '</small></div><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'tt41Cc\').remove();editCustomerPrompt(' + (typeof c.id === 'number' ? c.id : "'" + String(c.id).replace(/[^\w-]/g, '') + "'") + ')">✏️ Edit</button></div>'; }
    if (CC.tab === 'nophone') h += (g.none.length ? g.none.slice(0, 80).map(row).join('') : '<div class="tt41-empty">Every customer has a phone 🎉</div>');
    else { var arr = CC.tab === 'ph' ? g.ph : g.nm; h += '<div class="tt41-sub">Open one of them and use <b>🔗 Merge another customer</b> to keep them as one. (The old “Data cleanup” tool can merge many at once.)</div>' + (arr.length ? arr.slice(0, 40).map(function (grp) { return '<div class="tt41-grp">' + grp.map(row).join('') + '</div>'; }).join('') : '<div class="tt41-empty">None 🎉</div>'); }
    h += '<button class="btn btn-outline btn-sm" style="width:100%;margin-top:10px;" onclick="document.getElementById(\'tt41Cc\').remove();ttOpenDuplicates&&ttOpenDuplicates()">Open Data cleanup (bulk merge)</button>';
    V.modal('tt41Cc', '🧹 Customer data check', h);
  }
  window.ttCcTab = function (t) { CC.tab = t; ccDraw(); };

  /* ---------- A2: customer rename follows old bills ---------- */
  (function () {
    var o = window.saveCustomerAction; if (typeof o !== 'function') return;
    window.saveCustomerAction = function () {
      var id = ($('editCustId') || {}).value, cur = id && (customerDatabase || []).find(function (c) { return String(c.id) === String(id); }), oldName = cur ? cur.name : '', oldPhone = cur ? l10(cur.phone) : '';
      var r = o.apply(this, arguments);
      try {
        if (!cur || !F('custRenameSync') || $('customerModal').style.display !== 'none') return r;
        var nw = cur.name; if (!oldName || !nw || oldName.trim().toLowerCase() === nw.trim().toLowerCase()) return r;
        var lo = oldName.trim().toLowerCase(), match = function (x, key) { return String(x[key] || '').trim().toLowerCase() === lo && (!oldPhone || !l10(x.phone) || l10(x.phone) === oldPhone); };
        var os = ord().filter(function (x) { return match(x, 'customerName'); }), ls = ((typeof leadsData !== 'undefined' && leadsData) || []).filter(function (x) { return match(x, 'customerName'); }), ss = ((typeof serviceCallsData !== 'undefined' && serviceCallsData) || []).filter(function (x) { return match(x, 'customerName'); });
        var n = os.length + ls.length + ss.length; if (!n) return r;
        if (!confirm('You renamed "' + oldName + '" to "' + nw + '".\n\nAlso change the name on ' + os.length + ' bill(s), ' + ls.length + ' lead(s) and ' + ss.length + ' service call(s)?\n(Bills already printed keep their old name on paper.)')) return r;
        os.forEach(function (x) { x.customerName = nw; }); ls.forEach(function (x) { x.customerName = nw; }); ss.forEach(function (x) { x.customerName = nw; });
        cur.aliases = Array.from(new Set((cur.aliases || []).concat([oldName])));
        if (os.length) setStored('ORDERS', ordersData); if (ls.length) setStored('LEADS', leadsData); if (ss.length) setStored('SERVICES', serviceCallsData); setStored('CUSTOMERS', customerDatabase);
        try { renderOrders(); renderLeads(); renderServices(); renderBilling('all'); renderDashboard(); } catch (e) {}
        V.toast('Name updated on ' + n + ' record(s)');
      } catch (e) { console.warn('rename sync', e); }
      return r;
    };
  })();

  /* ---------- A6: ledger edit leaves a trace ---------- */
  (function () {
    var s = window.saveAdminLedgerInvoice; if (typeof s !== 'function') return;
    window.saveAdminLedgerInvoice = function () {
      var id = ($('editLedgerInvId') || {}).value, o = ord().find(function (x) { return x.id === id; }), before = o ? N(o.recvAmount) : 0, had = o && Array.isArray(o.payments) && o.payments.length > 0;
      var r = s.apply(this, arguments);
      try {
        if (o && F('ledgerAdjust') && had) {
          var d = R2(N(o.recvAmount) - before);
          if (d !== 0) { o.payments.push({ amount: d, mode: 'Admin adjustment', adjust: true, at: getNowStr(), by: V.me() || 'Admin', note: 'Received amount changed in Ledger edit' }); setStored('ORDERS', ordersData); }
        }
      } catch (e) { console.warn('ledger adjust', e); }
      return r;
    };
  })();

  /* ---------- A7: editing a delivered bill corrects stock ---------- */
  (function () {
    var s = window.saveOrderAction; if (typeof s !== 'function') return;
    function qtyMap(items) { var m = {}; (items || []).forEach(function (it) { var p = ttFindStock(it); if (p) m[String(p.id)] = (m[String(p.id)] || 0) + N(it.qty); }); return m; }
    window.saveOrderAction = function () {
      var editId = ($('editOrderId') || {}).value, ex = editId && ord().find(function (x) { return x.id === editId; }), snap = (ex && ex.status === 'Delivered') ? qtyMap(ex.items) : null;
      var r = s.apply(this, arguments);
      try {
        if (snap && F('editStockSync') && !ex.stockRestored) {
          var now = qtyMap(ex.items), ids = Object.keys(Object.assign({}, snap, now)), diffs = [];
          ids.forEach(function (k) { var d = R2((now[k] || 0) - (snap[k] || 0)); if (d) diffs.push([k, d]); });
          if (diffs.length) {
            var lines = diffs.map(function (x) { var p = inv().find(function (i) { return String(i.id) === x[0]; }); return '• ' + (p ? p.name : x[0]) + ': stock ' + (x[1] > 0 ? '−' : '+') + Math.abs(x[1]); }).join('\n');
            if (confirm('This bill was already delivered and the quantities changed.\n\nCorrect the stock?\n' + lines)) {
              diffs.forEach(function (x) { var p = inv().find(function (i) { return String(i.id) === x[0]; }); if (p) p.stock = Math.max(0, R2(N(p.stock) - x[1])); });
              setStored('INVENTORY', sampleInventory); try { renderStockList(); } catch (e) {}
              try { window.ttActAdd && ttActAdd('Stock', 'edit sync', ex.id, diffs.length + ' item(s) corrected after bill edit'); } catch (e) {}
            }
          }
        }
      } catch (e) { console.warn('edit stock sync', e); }
      return r;
    };
  })();

  /* ---------- A11: storage health ---------- */
  var QUOTA = 5 * 1024 * 1024;
  function usage() { var tot = 0, per = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i), l = (localStorage.getItem(k) || '').length + k.length; tot += l; per.push([k, l]); } } catch (e) {} per.sort(function (a, b) { return b[1] - a[1]; }); return { tot: tot, per: per, pct: Math.round(tot / QUOTA * 100) }; }
  window.ttStorageHealth = function () {
    var u = usage(), col = u.pct >= 85 ? '#dc2626' : u.pct >= 65 ? '#d97706' : '#16a34a';
    V.modal('tt41Sh', '💾 Storage health', '<div class="tt41-kpis"><div><small>Used</small><b style="color:' + col + '">' + u.pct + '%</b></div><div><small>Size</small><b>' + (u.tot / 1024 / 1024).toFixed(2) + ' MB</b></div><div><small>Limit</small><b>~5 MB</b></div></div><div class="tt41-bar" style="margin:10px 0;"><i style="width:' + Math.min(100, u.pct) + '%;background:' + col + '"></i></div>' +
      '<div class="tt41-sub">Biggest items on this phone:</div>' + u.per.slice(0, 6).map(function (x) { return '<div class="tt41-ins"><span>' + H(x[0].replace(/^TTESPL_ERP_/, '')) + '</span><b>' + Math.round(x[1] / 1024) + ' KB</b></div>'; }).join('') +
      '<div class="tt41-sub" style="margin-top:10px;">' + (u.pct >= 65 ? 'Getting full. Best fix: Settings → Speed &amp; Offline → <b>Keep photos in Cloud Storage</b>. Your data is safe in the cloud; the phone only keeps a working copy.' : 'All good. Nothing to do.') + '</div>');
  };
  setTimeout(function () {
    try {
      if (!F('storageWatch')) return; var u = usage(), last = Number(localStorage.getItem('TTESPL_V41_STNAG') || 0);
      if (u.pct >= 75 && Date.now() - last > 86400000) { localStorage.setItem('TTESPL_V41_STNAG', String(Date.now())); V.toast('Phone storage is ' + u.pct + '% full. Open Settings → Fixes & Health → Storage health.', true); }
    } catch (e) {}
  }, 20000);

  /* ---------- A9: security status ---------- */
  window.ttSecurityStatus = function () {
    var secure = V.secureOn && V.secureOn(), staff = (registeredEmployees || []).length;
    function line(ok, t, s) { return '<div class="tt41-row"><span style="font-size:18px;">' + (ok ? '✅' : '⚠️') + '</span><div style="flex:1;"><b>' + t + '</b><small>' + s + '</small></div></div>'; }
    V.modal('tt41Sc', '🛡️ Security status',
      line(secure, 'Secure mode (server login)', secure ? 'ON – staff sign in through your server and the database needs a signed-in staff token.' : 'OFF – anyone who knows your Firebase project could read data. Turn it on in Safety &amp; Login after deploying functions (see README).') +
      line(!!F('idleLogout'), 'Auto-logout when idle', F('idleLogout') ? 'ON (' + F('idleMinutes') + ' min).' : 'OFF – turn it on for phones that are shared.') +
      line(!!F('verifySession'), 'Login re-check', F('verifySession') ? 'ON – removed staff are logged out.' : 'OFF.') +
      line(!F('openRegister') || secure, 'Staff self sign-up', (!F('openRegister') || secure) ? 'Closed – only Admin adds staff.' : 'Open – anyone with the app link can register. Turn it off once your staff are added.') +
      line(!!F('recycleBin'), 'Recycle bin', F('recycleBin') ? 'ON – deleted records can be restored.' : 'OFF.') +
      '<div class="tt41-sub">' + staff + ' staff account(s). Keep the app link private; use Secure mode for real protection.</div>');
  };
})();
