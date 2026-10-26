/* TTESPL ERP v43 - TALLY EXPORT (31)
   Makes two Tally-import XML files from the app data for a date range:
     1) TTESPL_Tally_Masters.xml   - party / sales / GST / purchase / bank ledgers
     2) TTESPL_Tally_Vouchers.xml  - Sales (delivered bills), Receipts (payments) and Purchase vouchers
   plus a CSV day-book. Accounting-level import (party, sales, CGST/SGST/IGST, round off). Nothing in the app is changed. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var H = X.H, ID = 'ttTally', CK = 'TTESPL_TALLY_CFG';
  function $(i) { return document.getElementById(i); }
  function N(x) { var v = parseFloat(x); return isNaN(v) ? 0 : v; }
  function R2(x) { return Math.round((N(x) + Number.EPSILON) * 100) / 100; }
  function orders() { return (typeof ordersData !== 'undefined' && ordersData) || []; }
  function custs() { return (typeof customerDatabase !== 'undefined' && customerDatabase) || []; }
  function inv(o) { try { return window.ttInvNo ? ttInvNo(o) : o.id; } catch (e) { return o.id; } }
  function iso(d) { var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  function toIso(s) {   /* accepts 2026-10-26..., 26/10/2026, 26-10-2026 */
    s = String(s || '').trim(); var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(s); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
  }
  function tdate(i) { return i.replace(/-/g, ''); }
  function xe(s) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
  function amt(n) { return (Math.round(N(n) * 100) / 100).toFixed(2); }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 90); }

  var DEF = { company: '', sales: 'Sales', purchase: 'Purchase', cgst: 'Output CGST', sgst: 'Output SGST', igst: 'Output IGST', icgst: 'Input CGST', isgst: 'Input SGST', iigst: 'Input IGST',
    round: 'Round Off', courier: 'Courier Charges', cash: 'Cash', bank: 'ICICI Bank', link: true };
  function cfg() { var c = {}; try { c = JSON.parse(localStorage.getItem(CK) || '{}') || {}; } catch (e) {} return Object.assign({}, DEF, c); }
  function saveCfg(c) { try { localStorage.setItem(CK, JSON.stringify(c)); } catch (e) {} }
  function bankOf(mode, c) { return /^cash/i.test(String(mode || 'cash')) ? c.cash : c.bank; }

  /* ---------- collect data in range ---------- */
  function collect(from, to, want) {
    var c = cfg(), V = [], warn = { refunds: 0, noDate: 0 };
    var inR = function (d) { return d && (!from || d >= from) && (!to || d <= to); };
    var parties = {}, sup = {};
    if (want.sales || want.rec) orders().forEach(function (o) {
      if (!o || o.status === 'Cancelled') return;
      var nm = clean(o.customerName); if (!nm) return;
      if (want.sales && o.status === 'Delivered') {
        var d = toIso(o.deliveredDate || o.orderDate); if (!d) warn.noDate++; else if (inR(d)) {
          var g = window.ttGstSplit(o), no = clean(inv(o));
          var lines = [{ led: nm, dr: true, amt: g.total, party: no }];
          lines.push({ led: c.sales, dr: false, amt: g.taxable });
          if (g.courierFree > 0) lines.push({ led: c.courier, dr: false, amt: g.courierFree });
          if (g.intra) { if (g.half) { lines.push({ led: c.cgst, dr: false, amt: g.half }); lines.push({ led: c.sgst, dr: false, amt: g.half }); } }
          else if (g.tax) lines.push({ led: c.igst, dr: false, amt: g.tax });
          var rest = R2(g.total - (g.taxable + g.courierFree + (g.intra ? g.half * 2 : g.tax)));
          if (Math.abs(rest) >= 0.005) lines.push({ led: c.round, dr: rest < 0, amt: Math.abs(rest) });
          V.push({ type: 'Sales', date: d, no: no, party: nm, lines: lines, narr: 'Order ' + o.id, taxable: g.taxable + g.courierFree, cgst: g.intra ? g.half : 0, sgst: g.intra ? g.half : 0, igst: g.intra ? 0 : g.tax, round: rest, total: g.total, mode: '' });
          parties[nm] = 1;
        }
      }
      if (want.rec) (o.payments || []).forEach(function (p) {
        if (!p) return; if (p.refund || N(p.amount) < 0) { warn.refunds++; return; }
        var a = N(p.amount); if (a <= 0) return;
        var d = toIso(p.at || p.date); if (!d) { warn.noDate++; return; } if (!inR(d)) return;
        var bank = bankOf(p.mode, c), sd = toIso(o.deliveredDate || o.orderDate), no = clean(inv(o));
        var bt = !c.link ? 'On Account' : (sd && d < sd ? 'Advance' : 'Agst Ref');
        V.push({ type: 'Receipt', date: d, no: (p.rno ? clean(p.rno) : 'RC-' + no + '-' + d.replace(/-/g, '')), party: nm, narr: 'Against ' + no + (p.mode ? ' (' + p.mode + ')' : ''),
          lines: [{ led: bank, dr: true, amt: a }, { led: nm, dr: false, amt: a, party: no, bt: bt }], total: a, mode: p.mode || '' });
        parties[nm] = 1;
      });
    });
    if (want.pur) (X.list('PURCHASE_BILLS') || []).forEach(function (b) {
      if (!b) return; var d = toIso(b.billDate); if (!d || !inR(d)) return; var sp = clean(b.supplier); if (!sp) return;
      var inter = /IGST/.test(b.taxType || '') && !/CGST/.test(b.taxType || ''), tax = R2(b.tax), half = R2(tax / 2), taxable = R2(b.taxable), total = R2(b.total), no = clean(b.billNo || b.id);
      var lines = [{ led: sp, dr: false, amt: total, party: no }, { led: c.purchase, dr: true, amt: taxable }];
      if (inter) { if (tax) lines.push({ led: c.iigst, dr: true, amt: tax }); } else if (half) { lines.push({ led: c.icgst, dr: true, amt: half }); lines.push({ led: c.isgst, dr: true, amt: half }); }
      var rest = R2(total - (taxable + (inter ? tax : half * 2)));   /* >0 means credit side is larger -> debit round off */
      if (Math.abs(rest) >= 0.005) lines.push({ led: c.round, dr: rest > 0, amt: Math.abs(rest) });
      V.push({ type: 'Purchase', date: d, no: no, party: sp, lines: lines, narr: 'Purchase bill ' + no, taxable: taxable, cgst: inter ? 0 : half, sgst: inter ? 0 : half, igst: inter ? tax : 0, round: -rest, total: total, mode: '' });
      sup[sp] = b.gstin || '';
      (b.payments || []).forEach(function (p) {
        var a = N(p.amount), pd = toIso(p.date || p.at); if (a <= 0 || !pd || !inR(pd)) return;
        V.push({ type: 'Payment', date: pd, no: 'PY-' + no + '-' + pd.replace(/-/g, ''), party: sp, narr: 'Paid against ' + no,
          lines: [{ led: sp, dr: true, amt: a, party: no, bt: c.link ? 'Agst Ref' : 'On Account' }, { led: bankOf(p.mode, c), dr: false, amt: a }], total: a, mode: p.mode || '' });
      });
    });
    V.sort(function (a, b) { return a.date.localeCompare(b.date) || (a.type === 'Sales' ? -1 : 1); });
    return { V: V, parties: parties, sup: sup, warn: warn, c: c };
  }

  /* ---------- XML ---------- */
  function wrap(report, company, body) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>\n <BODY><IMPORTDATA>\n  <REQUESTDESC><REPORTNAME>' + report + '</REPORTNAME>' +
      (company ? '<STATICVARIABLES><SVCURRENTCOMPANY>' + xe(company) + '</SVCURRENTCOMPANY></STATICVARIABLES>' : '') + '</REQUESTDESC>\n  <REQUESTDATA>\n' + body + '  </REQUESTDATA>\n </IMPORTDATA></BODY>\n</ENVELOPE>\n';
  }
  function ledger(name, parent, extra) {
    return '   <TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="' + xe(name) + '" ACTION="Create"><NAME.LIST><NAME>' + xe(name) + '</NAME></NAME.LIST><PARENT>' + xe(parent) + '</PARENT>' + (extra || '') + '</LEDGER></TALLYMESSAGE>\n';
  }
  function mastersXml(D) {
    var c = D.c, b = '', seen = {};
    function add(n, p, e) { n = clean(n); if (!n || seen[n.toLowerCase()]) return; seen[n.toLowerCase()] = 1; b += ledger(n, p, e); }
    var gstOf = {}; custs().forEach(function (k) { if (k && k.name && k.gst) gstOf[clean(k.name).toLowerCase()] = String(k.gst).trim().toUpperCase(); });
    var types = {}; D.V.forEach(function (v) { types[v.type] = 1; });
    Object.keys(D.parties).forEach(function (n) { var g = gstOf[n.toLowerCase()]; add(n, 'Sundry Debtors', '<ISBILLWISEON>Yes</ISBILLWISEON>' + (g && g.length === 15 ? '<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>' + xe(g) + '</PARTYGSTIN>' : '')); });
    Object.keys(D.sup).forEach(function (n) { var g = String(D.sup[n] || '').trim().toUpperCase(); add(n, 'Sundry Creditors', '<ISBILLWISEON>Yes</ISBILLWISEON>' + (g.length === 15 ? '<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><PARTYGSTIN>' + xe(g) + '</PARTYGSTIN>' : '')); });
    if (types.Sales) {
      add(c.sales, 'Sales Accounts', '<AFFECTSSTOCK>No</AFFECTSSTOCK>');
      add(c.cgst, 'Duties & Taxes', '<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>Central Tax</GSTDUTYHEAD>');
      add(c.sgst, 'Duties & Taxes', '<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>State Tax</GSTDUTYHEAD>');
      add(c.igst, 'Duties & Taxes', '<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>Integrated Tax</GSTDUTYHEAD>');
      add(c.courier, 'Indirect Incomes');
    }
    if (types.Purchase) {
      add(c.purchase, 'Purchase Accounts', '<AFFECTSSTOCK>No</AFFECTSSTOCK>');
      add(c.icgst, 'Duties & Taxes', '<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>Central Tax</GSTDUTYHEAD>');
      add(c.isgst, 'Duties & Taxes', '<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>State Tax</GSTDUTYHEAD>');
      add(c.iigst, 'Duties & Taxes', '<TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>Integrated Tax</GSTDUTYHEAD>');
    }
    add(c.round, 'Indirect Expenses');
    add(c.cash, 'Cash-in-Hand'); add(c.bank, 'Bank Accounts');
    return wrap('All Masters', c.company, b);
  }
  function vouchersXml(D) {
    var b = D.V.map(function (v) {
      var x = '   <TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="' + v.type + '" ACTION="Create" OBJVIEW="Accounting Voucher View"><DATE>' + tdate(v.date) + '</DATE><VOUCHERTYPENAME>' + v.type + '</VOUCHERTYPENAME><VOUCHERNUMBER>' + xe(v.no) + '</VOUCHERNUMBER><PARTYLEDGERNAME>' + xe(v.party) + '</PARTYLEDGERNAME><NARRATION>' + xe(v.narr) + '</NARRATION>\n';
      v.lines.forEach(function (l) {
        var signed = l.dr ? -Math.abs(l.amt) : Math.abs(l.amt), partyLine = l.party != null;
        x += '    <ALLLEDGERENTRIES.LIST><LEDGERNAME>' + xe(l.led) + '</LEDGERNAME><ISDEEMEDPOSITIVE>' + (l.dr ? 'Yes' : 'No') + '</ISDEEMEDPOSITIVE>' + (partyLine ? '<ISPARTYLEDGER>Yes</ISPARTYLEDGER>' : '') + '<AMOUNT>' + amt(signed) + '</AMOUNT>';
        if (partyLine) x += '<BILLALLOCATIONS.LIST><NAME>' + xe(l.party) + '</NAME><BILLTYPE>' + (l.bt || 'New Ref') + '</BILLTYPE><AMOUNT>' + amt(signed) + '</AMOUNT></BILLALLOCATIONS.LIST>';
        x += '</ALLLEDGERENTRIES.LIST>\n';
      });
      return x + '   </VOUCHER></TALLYMESSAGE>\n';
    }).join('');
    return wrap('Vouchers', D.c.company, b);
  }
  function csv(D) {
    var q = function (s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var rows = [['Date', 'Type', 'Voucher no', 'Party', 'Taxable', 'CGST', 'SGST', 'IGST', 'Round off', 'Total', 'Mode', 'Narration']];
    D.V.forEach(function (v) { rows.push([v.date, v.type, v.no, v.party, amt(v.taxable || 0), amt(v.cgst || 0), amt(v.sgst || 0), amt(v.igst || 0), amt(v.round || 0), amt(v.total), v.mode, v.narr]); });
    return '﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n');
  }
  function check(D) {   /* every voucher must balance to zero */
    return D.V.filter(function (v) { var s = 0; v.lines.forEach(function (l) { s += l.dr ? -Math.abs(l.amt) : Math.abs(l.amt); }); return Math.abs(s) > 0.009; });
  }
  window.ttTallyBuild = function (from, to, want) { var D = collect(from, to, want || { sales: 1, rec: 1, pur: 1 }); return { D: D, masters: mastersXml(D), vouchers: vouchersXml(D), csv: csv(D), bad: check(D) }; };

  /* ---------- UI ---------- */
  function fileOf(txt, name, type) { return new File([txt], name, { type: type || 'application/xml' }); }
  function download(f) { var a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function cur() { return { from: ($('tlFrom') || {}).value || '', to: ($('tlTo') || {}).value || '', want: { sales: $('tlS').checked, rec: $('tlR').checked, pur: $('tlP').checked } }; }
  function readCfg() { var c = cfg(); ['company', 'sales', 'purchase', 'cgst', 'sgst', 'igst', 'icgst', 'isgst', 'iigst', 'round', 'courier', 'cash', 'bank'].forEach(function (k) { var e = $('tc_' + k); if (e) c[k] = e.value.trim() || DEF[k]; }); c.link = $('tlLink').checked; saveCfg(c); return c; }
  function summary() {
    var q = cur(), B = window.ttTallyBuild(q.from, q.to, q.want), n = { Sales: 0, Receipt: 0, Purchase: 0, Payment: 0 }; B.D.V.forEach(function (v) { n[v.type]++; });
    var el = $('tlSum'); if (!el) return B;
    el.innerHTML = '<b>' + B.D.V.length + '</b> vouchers: ' + n.Sales + ' sales · ' + n.Receipt + ' receipts · ' + n.Purchase + ' purchases · ' + n.Payment + ' supplier payments' +
      (B.D.warn.refunds ? '<br><span style="color:#d97706">' + B.D.warn.refunds + ' refund(s) are not exported - enter them in Tally as credit notes.</span>' : '') +
      (B.D.warn.noDate ? '<br><span style="color:#d97706">' + B.D.warn.noDate + ' entr' + (B.D.warn.noDate > 1 ? 'ies' : 'y') + ' skipped (no readable date).</span>' : '') +
      (B.bad.length ? '<br><span style="color:#dc2626">⚠ ' + B.bad.length + ' voucher(s) do not balance - ' + B.bad.slice(0, 3).map(function (v) { return H(v.no); }).join(', ') + '</span>' : '');
    return B;
  }
  function open() {
    var c = cfg(), t = new Date(), f = new Date(t.getFullYear(), t.getMonth(), 1);
    var fld = function (k, l) { return '<label style="font-size:11.5px;display:block">' + l + '<input id="tc_' + k + '" value="' + H(c[k]) + '" style="width:100%"></label>'; };
    var h = '<div class="ttx-note">Makes files you import into <b>Tally Prime / ERP 9</b>. Import <b>Masters first</b>, then <b>Vouchers</b>. Nothing is changed in this app.</div>' +
      '<div style="display:flex;gap:8px"><label style="flex:1;font-size:12px">From<input type="date" data-c="tlFrom" id="tlFrom" value="' + iso(f) + '" style="width:100%"></label><label style="flex:1;font-size:12px">To<input type="date" data-c="tlTo" id="tlTo" value="' + iso(t) + '" style="width:100%"></label></div>' +
      '<div style="margin:8px 0;font-size:13px;display:flex;flex-wrap:wrap;gap:12px"><label><input type="checkbox" data-c="tlS" id="tlS" checked> Sales (delivered)</label><label><input type="checkbox" data-c="tlR" id="tlR" checked> Receipts</label><label><input type="checkbox" data-c="tlP" id="tlP" checked> Purchases</label></div>' +
      '<div id="tlSum" class="ttx-note"></div>' +
      '<div class="ttx-btns" style="flex-wrap:wrap"><button class="ttx-b pri" data-a="dm" style="flex:1 1 48%">⬇️ 1. Masters XML</button><button class="ttx-b pri" data-a="dv" style="flex:1 1 48%">⬇️ 2. Vouchers XML</button>' +
      '<button class="ttx-b" data-a="sh" style="flex:1 1 100%">📤 Share both files (to CA / PC)</button><button class="ttx-b" data-a="dc" style="flex:1 1 100%">📊 CSV day-book</button></div>' +
      '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">⚙️ Ledger names (must match your Tally)</summary><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">' +
      fld('company', 'Tally company (blank = open company)') + fld('bank', 'Bank ledger (UPI/bank receipts)') + fld('cash', 'Cash ledger') + fld('sales', 'Sales ledger') + fld('cgst', 'Output CGST') + fld('sgst', 'Output SGST') + fld('igst', 'Output IGST') + fld('courier', 'Courier income') +
      fld('purchase', 'Purchase ledger') + fld('icgst', 'Input CGST') + fld('isgst', 'Input SGST') + fld('iigst', 'Input IGST') + fld('round', 'Round off') +
      '</div><label style="font-size:12.5px;display:block;margin-top:8px"><input type="checkbox" id="tlLink"' + (c.link ? ' checked' : '') + '> Link receipts to the invoice number (bill-wise)</label></details>' +
      '<div class="ttx-note" style="font-size:11.5px;opacity:.85;margin-top:8px">First time: import into a <b>test company</b> and check totals with your CA. Imports at accounting level (party, sales, GST ledgers, receipts, round-off); item-wise stock and HSN detail are not carried.</div>';
    X.sheet(ID, '📒 Export to Tally', h, { z: 3900 });
    var go = function () { readCfg(); summary(); };
    X.bind(ID, { click: {
      dm: function () { readCfg(); var q = cur(), B = window.ttTallyBuild(q.from, q.to, q.want); download(fileOf(B.masters, 'TTESPL_Tally_Masters.xml')); X.toast('Masters file saved - import this first'); },
      dv: function () { readCfg(); var q = cur(), B = window.ttTallyBuild(q.from, q.to, q.want); if (B.bad.length && !confirm(B.bad.length + ' voucher(s) do not balance. Export anyway?')) return; download(fileOf(B.vouchers, 'TTESPL_Tally_Vouchers.xml')); X.toast('Vouchers file saved'); },
      dc: function () { readCfg(); var q = cur(), B = window.ttTallyBuild(q.from, q.to, q.want); download(fileOf(B.csv, 'TTESPL_Daybook.csv', 'text/csv')); X.toast('CSV saved'); },
      sh: function () { readCfg(); var q = cur(), B = window.ttTallyBuild(q.from, q.to, q.want), fs = [fileOf(B.masters, 'TTESPL_Tally_Masters.xml'), fileOf(B.vouchers, 'TTESPL_Tally_Vouchers.xml')];
        if (navigator.canShare && navigator.canShare({ files: fs })) navigator.share({ files: fs, title: 'TTESPL Tally export' }).catch(function () {}); else { fs.forEach(download); X.toast('Both files saved'); } }
    }, change: { tlFrom: go, tlTo: go, tlS: go, tlR: go, tlP: go } });
    var el = $(ID); if (el) el.addEventListener('input', function (e) { if (e.target && /^tc_/.test(e.target.id)) { clearTimeout(open._t); open._t = setTimeout(go, 350); } });
    summary();
  }
  window.ttOpenTally = open;

  function inject() {
    try {
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt43-tl')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt43-tl'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenTally(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>📒</span><span>Export to Tally</span></div><span style="font-size:10px;color:#38bdf8;">XML / CSV</span>';
        list.appendChild(d);
      }
    } catch (e) {}
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);
})();
