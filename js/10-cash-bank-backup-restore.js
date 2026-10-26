/* TTESPL ERP module: 10-cash-bank-backup-restore.js */
/* ===== v29 · Cash / Bank Reconciliation (extends the existing daily Cash Closing) + Purchase & Supplier ===== */
(function () {
  'use strict';
  var X = window.ttx, H = X.H, on = X.on, me = X.me, isAdm = X.isAdm, ymd = X.ymd, r2 = X.r2;
  function O() { try { return ordersData || []; } catch (e) { return []; } }
  function N(v) { return Number(v) || 0; }
  var busyK = {}; function lock(k) { if (busyK[k]) return true; busyK[k] = 1; setTimeout(function () { busyK[k] = 0; }, 1200); return false; }

  /* ================= CASH / BANK RECONCILIATION ================= */
  var RC = { date: ymd() };
  function bucketOf(mode) { mode = String(mode || ''); if (/cash/i.test(mode)) return 'cash'; if (/upi|online|phonepe|gpay|paytm/i.test(mode)) return 'upi'; return 'bank'; }
  /* expected receipts for a calendar day, from the order book, by payment time.
     advance (taken at booking) = received − sum(later payments). Its mode is only knowable when no later payment overwrote payMode. */
  function expected(d) {
    var e = { cash: 0, upi: 0, bank: 0, unk: 0 }, refs = [];
    O().forEach(function (o) {
      if (!o || o.status === 'Cancelled') return;
      var pays = Array.isArray(o.payments) ? o.payments : [], sum = pays.reduce(function (a, p) { return a + N(p.amount); }, 0), hit = false;
      if (o.orderDate === d) { var adv = r2(N(o.recvAmount) - sum); if (adv > 0) { hit = true; if (!pays.length) e[bucketOf(o.payMode)] += adv; else e.unk += adv; } }
      pays.forEach(function (p) { if (p && p.adjust) return; /* v41: Admin adjustment lines are not cash movement */ if (String(p.at || '').slice(0, 10) === d && N(p.amount) > 0) { hit = true; e[bucketOf(p.mode)] += N(p.amount); } });
      if (hit) refs.push(o.id);
    });
    Object.keys(e).forEach(function (k) { e[k] = r2(e[k]); });
    return { e: e, refs: refs };
  }
  function closings() { return X.list('CLOSINGS'); }
  function closingOn(d) { return X.byId('CLOSINGS', 'CLS-' + d); }
  function prevClosing(d) { return closings().filter(function (c) { return c && c.status === 'Closed' && c.date < d; }).sort(function (a, b) { return b.date.localeCompare(a.date); })[0]; }
  function rcHtml() {
    var d = RC.date, c = closingOn(d), ex = expected(d), e = ex.e, closed = c && c.status === 'Closed', draft = (!closed && RC.draft) || {};
    var prev = prevClosing(d), opening = closed ? c.opening : (draft.opening != null ? draft.opening : (prev ? N(prev.actual.cash) : 0));
    var v = function (k, dflt) { return closed ? c[k] : (draft[k] != null ? draft[k] : dflt); }, act = closed ? c.actual : (draft.actual || {}), dis = closed ? ' disabled' : '';
    var out = N(v('out', 0)), dep = N(v('dep', 0));
    var expCash = r2(N(opening) + e.cash - out - dep);
    var h = '<div class="ttx-row"><input type="date" id="ttxRCd" data-c="rcDate" value="' + d + '" max="' + ymd() + '"><button class="ttx-b" data-a="rcHist">History</button></div>';
    if (closed) h += '<div class="ttx-note ok">🔒 Closed by <b>' + H(c.closedBy) + '</b> on ' + X.fmtDT(c.closedAt) + (c.version > 1 ? ' · version ' + c.version : '') + '. Closed records cannot be edited' + (isAdm() ? ' — Admin can reopen with a reason.' : ' — ask Admin to reopen.') + '</div>';
    h += '<div class="ttx-kp"><div><small>Cash in</small><b>' + X.inr(e.cash) + '</b></div><div><small>UPI / online</small><b>' + X.inr(e.upi) + '</b></div><div><small>Bank / cheque</small><b>' + X.inr(e.bank) + '</b></div></div>';
    if (e.unk) h += '<div class="ttx-note warn">⚠ ' + X.inr(e.unk) + ' was taken at booking on orders that later received more payments. The app only keeps the <i>last</i> pay-mode, so the mode of this amount is unknown — enter it in the matching field below yourself.</div>';
    h += '<div class="ttx-note">From ' + ex.refs.length + ' order(s), counted by the date money was recorded. This is more complete than the older closing summary, which counts only orders booked that day.</div>';
    h += '<div class="ttx-sec">Cash drawer</div><div class="ttx-two">' + X.field('Opening cash', '<input type="number" inputmode="decimal" data-i="rcF" data-k="opening" value="' + opening + '"' + dis + '>') + X.field('Cash paid out (expenses)', '<input type="number" inputmode="decimal" data-i="rcF" data-k="out" value="' + out + '"' + dis + '>') + '</div><div class="ttx-two">' + X.field('Deposited to bank', '<input type="number" inputmode="decimal" data-i="rcF" data-k="dep" value="' + dep + '"' + dis + '>') + X.field('Counted cash in drawer', '<input type="number" inputmode="decimal" data-i="rcA" data-k="cash" value="' + (act.cash != null ? act.cash : '') + '" placeholder="Count it"' + dis + '>') + '</div>' + (closed ? '' : '<div class="ttx-btns"><button class="ttx-b" data-a="rcUseDrawer">Use the denomination count</button></div>');
    h += '<div class="ttx-sec">UPI & bank (what actually arrived)</div><div class="ttx-two">' + X.field('UPI / online received', '<input type="number" inputmode="decimal" data-i="rcA" data-k="upi" value="' + (act.upi != null ? act.upi : '') + '" placeholder="Per app / statement"' + dis + '>') + X.field('Bank / cheque received', '<input type="number" inputmode="decimal" data-i="rcA" data-k="bank" value="' + (act.bank != null ? act.bank : '') + '"' + dis + '>') + '</div>';
    var diffs = { cash: act.cash === '' || act.cash == null ? null : r2(N(act.cash) - expCash), upi: act.upi === '' || act.upi == null ? null : r2(N(act.upi) - e.upi), bank: act.bank === '' || act.bank == null ? null : r2(N(act.bank) - e.bank) };
    var row = function (n, ex2, df) { return '<tr><td>' + n + '</td><td>' + X.inr(ex2) + '</td><td class="' + (df == null ? '' : (df === 0 ? 'ok' : 'bad')) + '">' + (df == null ? '—' : (df > 0 ? '+' : '') + X.inr(df)) + '</td></tr>'; };
    h += '<table class="ttx-tb"><tr><th></th><th>Expected</th><th>Difference</th></tr>' + row('Cash', expCash, diffs.cash) + row('UPI', e.upi, diffs.upi) + row('Bank', e.bank, diffs.bank) + '</table>';
    var anyDiff = Object.keys(diffs).some(function (k) { return diffs[k] != null && diffs[k] !== 0; });
    h += X.field('Notes' + (anyDiff ? ' (required — explain the difference)' : ''), '<textarea id="ttxRCn" rows="2" maxlength="300"' + dis + '>' + H(closed ? c.note || '' : (draft.note || '')) + '</textarea>');
    if (!closed) h += '<div class="ttx-btns"><button class="ttx-b pri" data-a="rcClose">🔒 Close this day</button></div>';
    else if (isAdm()) h += '<div class="ttx-btns"><button class="ttx-b dng" data-a="rcReopen">Reopen (Admin)</button></div>';
    return h;
  }
  function rcCollect() { var s = document.getElementById('ttxRC'); if (!s) return; var d = RC.draft = RC.draft || { actual: {} }; s.querySelectorAll('[data-i=rcF]').forEach(function (i) { d[i.getAttribute('data-k')] = i.value === '' ? 0 : Number(i.value); }); s.querySelectorAll('[data-i=rcA]').forEach(function (i) { d.actual[i.getAttribute('data-k')] = i.value === '' ? null : Number(i.value); }); var n = document.getElementById('ttxRCn'); if (n) d.note = n.value; }
  function rcRender() { X.body('ttxRC', rcHtml(), true); }
  function rcOpen(date) {
    if (!on('mRecon')) return; RC.date = date || ymd(); RC.draft = null;
    X.sheet('ttxRC', '🏦 Cash & Bank Reconciliation', rcHtml());
    X.bind('ttxRC', {
      click: {
        rcUseDrawer: function () { rcCollect(); var t = Number(String((document.getElementById('denomTotalDisplay') || {}).textContent || '0').replace(/[^\d.]/g, '')) || 0; if (!t) return X.toast('Enter the notes in the Cash Closing screen first', 1); RC.draft.actual.cash = t; rcRender(); },
        rcClose: rcClose, rcReopen: rcReopen, rcHist: rcHist
      },
      change: { rcDate: function (v) { if (!v || v > ymd()) return X.toast('Pick today or an earlier date', 1); RC.date = v; RC.draft = null; rcRender(); } },
      input: { rcA: function () { rcDeb(); }, rcF: function () { rcDeb(); } }
    });
    function rcDeb() { clearTimeout(RC._t); RC._t = setTimeout(function () { var a = document.activeElement, k = a && a.getAttribute && a.getAttribute('data-k'), t = a && a.getAttribute && a.getAttribute('data-i'); rcCollect(); rcRender(); if (k) { var el = document.querySelector('#ttxRC [data-i=' + t + '][data-k=' + k + ']'); if (el) { el.focus(); try { var l = el.value.length; el.setSelectionRange(l, l); } catch (e) {} } } }, 500); }
  }
  window.ttOpenRecon = rcOpen;
  function rcClose() {
    if (lock('41')) return; rcCollect(); var d = RC.date, dr = RC.draft || { actual: {} }, ex = expected(d), e = ex.e, existing = closingOn(d);
    if (existing && existing.status === 'Closed') return X.toast('This day is already closed', 1);
    var a = dr.actual || {}; if (a.cash == null || a.upi == null || a.bank == null) return X.toast('Enter counted cash, UPI and bank amounts (0 if none)', 1);
    var opening = N(dr.opening != null ? dr.opening : (prevClosing(d) ? prevClosing(d).actual.cash : 0)), out = N(dr.out), dep = N(dr.dep), expCash = r2(opening + e.cash - out - dep);
    [opening, out, dep, a.cash, a.upi, a.bank].forEach(function (x) { if (x < 0 || !isFinite(x)) { X.toast('Amounts cannot be negative', 1); throw new Error('neg'); } });
    var diff = { cash: r2(N(a.cash) - expCash), upi: r2(N(a.upi) - e.upi), bank: r2(N(a.bank) - e.bank) }, any = diff.cash || diff.upi || diff.bank;
    if (any && !(dr.note || '').trim()) return X.toast('Please explain the difference in Notes before closing', 1);
    if (!confirm('Close ' + X.fmtD(d) + '?\n\nCash difference: ' + X.inr(diff.cash) + '\nUPI difference: ' + X.inr(diff.upi) + '\nBank difference: ' + X.inr(diff.bank) + '\n\nA closed day cannot be edited without an Admin reopening it.')) return;
    var rec = { id: 'CLS-' + d, date: d, status: 'Closed', version: ((existing && existing.version) || 0) + 1, opening: opening, out: out, dep: dep, expected: { cash: expCash, upi: e.upi, bank: e.bank, unknown: e.unk, receiptsCash: e.cash }, actual: { cash: N(a.cash), upi: N(a.upi), bank: N(a.bank) }, diff: diff, note: (dr.note || '').trim(), orderRefs: ex.refs, closedBy: me(), closedById: X.meId(), closedAt: new Date().toISOString(), prev: existing ? (existing.prev || []).concat([{ version: existing.version, closedBy: existing.closedBy, closedAt: existing.closedAt, actual: existing.actual, diff: existing.diff, reopenedBy: existing.reopenedBy, reopenReason: existing.reopenReason }]) : [] };
    X.saveConfirmed('CLOSINGS', closings().filter(function (x) { return x.id !== rec.id; }).concat([rec]), 'Day closed'); RC.draft = null; rcRender();
    try { if (window.ttActAdd) window.ttActAdd('cash', 'closed', rec.id, 'diff ' + (diff.cash + diff.upi + diff.bank)); } catch (er) {}
  }
  function rcReopen() {
    if (!isAdm()) return X.toast('Only Admin can reopen', 1); var c = closingOn(RC.date); if (!c || c.status !== 'Closed') return;
    var why = (prompt('Reason for reopening ' + X.fmtD(c.date) + ' (required, kept in the record)') || '').trim(); if (!why) return X.toast('A reason is required', 1);
    var n = JSON.parse(JSON.stringify(c)); n.status = 'Reopened'; n.reopenedBy = me(); n.reopenedAt = new Date().toISOString(); n.reopenReason = why;
    RC.draft = { opening: c.opening, out: c.out, dep: c.dep, actual: c.actual, note: c.note };
    X.saveConfirmed('CLOSINGS', closings().map(function (x) { return x.id === n.id ? n : x; }), 'Day reopened'); rcRender();
    try { if (window.ttActAdd) window.ttActAdd('cash', 'reopened', n.id, why); } catch (er) {}
  }
  function rcHist() {
    var rows = closings().slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 40);
    var h = rows.length ? rows.map(function (c) { var df = N(c.diff && c.diff.cash) + N(c.diff && c.diff.upi) + N(c.diff && c.diff.bank); return '<div class="ttx-card" data-a="rcGo" data-p="' + c.date + '"><div class="ttx-ct"><div><b>' + X.fmtD(c.date) + '</b><small>' + H(c.closedBy) + (c.version > 1 ? ' · v' + c.version : '') + '</small></div>' + X.chip(c.status === 'Closed' ? (df === 0 ? 'Balanced' : 'Diff ' + X.inr(df)) : 'Reopened', c.status !== 'Closed' ? 'warn' : (df === 0 ? 'ok' : 'bad')) + '</div></div>'; }).join('') : X.empty('🏦', 'No closed days yet');
    X.sheet('ttxRH', 'Closing history', h, { z: 3600 }); X.bind('ttxRH', { click: { rcGo: function (p) { X.close('ttxRH'); RC.date = p; RC.draft = null; rcRender(); } } });
  }
  X.hubTiles.push({ mod: 'mRecon', icon: '🏦', label: 'Cash & Bank Closing', sub: function () { var c = closingOn(ymd()); return c && c.status === 'Closed' ? 'Today closed' : 'Today not closed'; }, fn: function () { rcOpen(); } });
  (function wrapClosing() {
    var f = window.openDailyCashClosingModal; if (typeof f !== 'function' || f.__ttx) return;
    var w = function () { var r = f.apply(this, arguments); try { if (on('mRecon')) { var m = document.getElementById('cashClosingModal'); if (m && !m.querySelector('.ttx-rcb')) { var b = document.createElement('button'); b.className = 'btn btn-primary btn-block ttx-rcb'; b.style.marginTop = '10px'; b.textContent = '🏦 Reconcile & close the day'; b.onclick = function () { closeDailyCashClosingModal(); rcOpen(); }; m.firstElementChild.appendChild(b); } } } catch (e) {} return r; };
    w.__ttx = true; window.openDailyCashClosingModal = w; try { (0, eval)('openDailyCashClosingModal = window.openDailyCashClosingModal;'); } catch (e) {}
  })();

  /* ================= PURCHASE & SUPPLIERS ================= */
  var PU = { tab: 'orders', sup: '' };
  function sups() { return X.list('SUPPLIERS'); }
  function pos() { return X.list('PURCHASES'); }
  function inv() { try { return sampleInventory || []; } catch (e) { return []; } }
  function limit() { return N(window.ttFeat && window.ttFeat.get('purchLimit')); }
  function poRecv(po) { return po.lines.reduce(function (a, l) { return a + N(l.received); }, 0); }
  function poOrd(po) { return po.lines.reduce(function (a, l) { return a + N(l.qty); }, 0); }
  function poTotals(lines) { var sub = 0, g = 0; lines.forEach(function (l) { var t = r2(N(l.qty) * N(l.rate)); sub += t; g += r2(t * N(l.gst) / 100); }); return { sub: r2(sub), gst: r2(g), total: r2(sub + g) }; }
  function lineAmt(l, q) { return r2(N(q) * N(l.rate) * (1 + N(l.gst) / 100)); }
  function paidOn(po, billId) { return r2((po.payments || []).filter(function (p) { return p.billId === billId; }).reduce(function (a, p) { return a + N(p.amount); }, 0)); }
  function supBalance(sid) {
    var billed = 0, paid = 0, unbilled = 0;
    pos().forEach(function (po) { if (!po || po.supplierId !== sid) return; (po.bills || []).forEach(function (b) { billed += N(b.amount); }); (po.payments || []).forEach(function (p) { paid += N(p.amount); });
      var rc = (po.receipts || []).reduce(function (x, r) { return x + N(r.amount); }, 0), bl = (po.bills || []).reduce(function (x, b) { return x + N(b.amount); }, 0); unbilled += Math.max(0, rc - bl); });
    return { billed: r2(billed), paid: r2(paid), due: r2(billed - paid), unbilled: r2(unbilled) };
  }
  function allPending() { var q = []; pos().forEach(function (po) { (po.receipts || []).forEach(function (r) { if (r.stockApplied === false) q.push({ po: po, r: r }); }); }); return q; }
  function puHtml() {
    var tabs = [['orders', 'Orders'], ['sups', 'Suppliers'], ['pay', 'Payables']], h = '<div class="ttx-tabs">' + tabs.map(function (t) { return '<button class="' + (PU.tab === t[0] ? 'on' : '') + '" data-a="puTab" data-p="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var pend = allPending(); if (pend.length) h += '<div class="ttx-note warn">⚠ ' + pend.length + ' goods receipt(s) are saved but the stock update has not been confirmed. ' + (isAdm() ? '<button class="ttx-b" data-a="puApply">Apply pending stock now</button>' : 'Ask Admin to apply.') + '</div>';
    if (PU.tab === 'orders') {
      h += '<div class="ttx-btns"><button class="ttx-b pri" data-a="poNew">＋ New purchase order</button></div>';
      var rows = pos().filter(Boolean).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 60);
      h += rows.length ? rows.map(function (po) { var cls = po.status === 'Received' ? 'ok' : (po.status === 'Cancelled' ? 'bad' : (/Pending/.test(po.status) ? 'warn' : '')); return '<div class="ttx-card" data-a="poOpen" data-p="' + H(po.id) + '"><div class="ttx-ct"><div><b>' + H(po.supplierName) + '</b><small>' + H(po.id) + ' · ' + X.fmtD(po.date) + ' · ' + X.inr(po.total) + '</small></div>' + X.chip(po.status, cls) + '</div><small>Received ' + poRecv(po) + ' / ' + poOrd(po) + ' units</small></div>'; }).join('') : X.empty('🛒', 'No purchase orders yet');
    } else if (PU.tab === 'sups') {
      h += '<div class="ttx-btns"><button class="ttx-b pri" data-a="suNew">＋ New supplier</button></div>';
      h += sups().length ? sups().filter(function (s) { return s; }).map(function (s) { var b = supBalance(s.id); return '<div class="ttx-card" data-a="suOpen" data-p="' + H(s.id) + '"><div class="ttx-ct"><div><b>' + H(s.name) + '</b><small>' + H(s.phone || '') + (s.gstin ? ' · ' + H(s.gstin) : '') + '</small></div>' + (s.active === false ? X.chip('Inactive') : (b.due > 0 ? X.chip('Due ' + X.inr(b.due), 'warn') : '')) + '</div></div>'; }).join('') : X.empty('🏭', 'No suppliers yet');
    } else {
      var tot = 0; var cards = sups().filter(Boolean).map(function (s) { var b = supBalance(s.id); tot += b.due; return b.due || b.unbilled ? '<div class="ttx-card" data-a="suOpen" data-p="' + H(s.id) + '"><div class="ttx-ct"><div><b>' + H(s.name) + '</b><small>Billed ' + X.inr(b.billed) + ' · Paid ' + X.inr(b.paid) + (b.unbilled ? ' · Received, not billed ' + X.inr(b.unbilled) : '') + '</small></div><b>' + X.inr(b.due) + '</b></div></div>' : ''; }).join('');
      h += '<div class="ttx-kp"><div><small>Total payable</small><b>' + X.inr(tot) + '</b></div></div>' + (cards || X.empty('✅', 'Nothing payable'));
    }
    return h;
  }
  function puRender() { X.body('ttxPU', puHtml(), true); }
  function puOpen() {
    if (!on('mPurch')) return; X.sheet('ttxPU', '🛒 Purchase & Suppliers', ''); 
    X.bind('ttxPU', { click: { puTab: function (p) { PU.tab = p; puRender(); }, poNew: function () { poForm(); }, poOpen: poDetail, suNew: function () { suForm(null); }, suOpen: suDetail, puApply: function () { applyPending(true); } } });
    puRender();
  }
  window.ttOpenPurchase = puOpen;
  X.hubTiles.push({ mod: 'mPurch', icon: '🛒', label: 'Purchase & Suppliers', sub: function () { var n = pos().filter(function (p) { return p && /Approved|Partially|Pending/.test(p.status); }).length; return n ? n + ' open order(s)' : 'Suppliers, POs, bills'; }, fn: puOpen });

  /* ----- suppliers ----- */
  function suForm(s) {
    var h = X.field('Supplier name *', '<input id="ttxSUn" maxlength="100" value="' + H(s ? s.name : '') + '">') + '<div class="ttx-two">' + X.field('Phone', '<input id="ttxSUp" type="tel" maxlength="14" value="' + H(s ? s.phone || '' : '') + '">') + X.field('GSTIN', '<input id="ttxSUg" maxlength="15" style="text-transform:uppercase" value="' + H(s ? s.gstin || '' : '') + '">') + '</div>' + X.field('Contact person', '<input id="ttxSUc" maxlength="60" value="' + H(s ? s.contact || '' : '') + '">') + X.field('Address', '<textarea id="ttxSUa" rows="2" maxlength="200">' + H(s ? s.address || '' : '') + '</textarea>') + X.field('Payment terms', '<input id="ttxSUt" maxlength="60" placeholder="e.g. 30 days" value="' + H(s ? s.terms || '' : '') + '">') +
      '<label class="ttx-chk"><input type="checkbox" id="ttxSUact"' + (!s || s.active !== false ? ' checked' : '') + '> Active</label><div class="ttx-btns"><button class="ttx-b pri" data-a="suSave">Save supplier</button></div>';
    X.sheet('ttxSU', s ? 'Edit supplier' : 'New supplier', h, { z: 3600 });
    X.bind('ttxSU', { click: { suSave: function () {
      if (lock('42')) return; var g = function (i) { return (document.getElementById(i) || {}).value || ''; }, name = g('ttxSUn').trim(), gst = g('ttxSUg').trim().toUpperCase(), ph = X.last10(g('ttxSUp'));
      if (!name) return X.toast('Supplier name is required', 1); if (gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gst)) return X.toast('GSTIN format looks wrong', 1);
      var dup = sups().find(function (x) { return x && (!s || x.id !== s.id) && ((gst && x.gstin === gst) || (ph && X.last10(x.phone) === ph) || X.norm(x.name) === X.norm(name)); });
      if (dup && !confirm('A supplier “' + dup.name + '” with the same ' + ((gst && dup.gstin === gst) ? 'GSTIN' : (ph && X.last10(dup.phone) === ph ? 'phone' : 'name')) + ' already exists. Save anyway?')) return;
      var rec = s ? JSON.parse(JSON.stringify(s)) : { id: X.uid('SUP'), createdBy: me(), createdAt: new Date().toISOString() };
      Object.assign(rec, { name: name, phone: g('ttxSUp').trim(), gstin: gst, contact: g('ttxSUc').trim(), address: g('ttxSUa').trim(), terms: g('ttxSUt').trim(), active: document.getElementById('ttxSUact').checked, updatedAt: new Date().toISOString() });
      X.saveConfirmed('SUPPLIERS', sups().filter(function (x) { return x.id !== rec.id; }).concat([rec]), 'Supplier saved'); X.close('ttxSU'); puRender(); if (X.isOpen('ttxSD')) suDetail(rec.id);
    } } });
  }
  function suDetail(id) {
    var s = X.byId('SUPPLIERS', id); if (!s) return; var b = supBalance(id);
    var h = '<div class="ttx-ct"><div><b>' + H(s.name) + '</b><small>' + H(s.phone || '') + (s.gstin ? ' · ' + H(s.gstin) : '') + (s.terms ? ' · ' + H(s.terms) : '') + '</small></div><button class="ttx-b" data-a="suEdit" data-p="' + H(id) + '">Edit</button></div>' + (s.address ? '<div class="ttx-note">' + H(s.address) + '</div>' : '') +
      '<div class="ttx-kp"><div><small>Billed</small><b>' + X.inr(b.billed) + '</b></div><div><small>Paid</small><b>' + X.inr(b.paid) + '</b></div><div><small>Outstanding</small><b>' + X.inr(b.due) + '</b></div></div>' + (b.unbilled ? '<div class="ttx-note warn">Goods worth ' + X.inr(b.unbilled) + ' received but no supplier bill recorded yet.</div>' : '') +
      '<div class="ttx-note">Reconciliation: billed ' + X.inr(b.billed) + ' − paid ' + X.inr(b.paid) + ' = ' + X.inr(b.due) + '</div><div class="ttx-sec">Bills & payments</div>';
    var ev = []; pos().forEach(function (po) { if (po && po.supplierId === id) { (po.bills || []).forEach(function (bl) { ev.push({ d: bl.date, t: 'bill', x: bl, po: po }); }); (po.payments || []).forEach(function (p) { ev.push({ d: String(p.at).slice(0, 10), t: 'pay', x: p, po: po }); }); } });
    ev.sort(function (a, b) { return String(b.d).localeCompare(String(a.d)); });
    h += ev.length ? ev.slice(0, 60).map(function (e) { return e.t === 'bill' ? '<div class="ttx-hi"><b>Bill ' + H(e.x.no) + '</b> ' + X.inr(e.x.amount) + ' <small>' + X.fmtD(e.x.date) + ' · PO ' + H(e.po.id) + (e.x.due ? ' · due ' + X.fmtD(e.x.due) : '') + '</small></div>' : '<div class="ttx-hi"><b style="color:#16a34a">Paid</b> ' + X.inr(e.x.amount) + ' <small>' + H(e.x.mode) + (e.x.ref ? ' · ' + H(e.x.ref) : '') + ' · ' + X.fmtDT(e.x.at) + ' · ' + H(e.x.by) + '</small></div>'; }).join('') : '<div class="ttx-note">No bills yet.</div>';
    X.sheet('ttxSD', 'Supplier', h, { z: 3550 }); X.bind('ttxSD', { click: { suEdit: function (p) { suForm(X.byId('SUPPLIERS', p)); } } });
  }

  /* ----- purchase orders ----- */
  var DR = null; /* draft lines while the form is open */
  function poForm() {
    var act = sups().filter(function (s) { return s && s.active !== false; });
    if (!act.length) return X.toast('Add a supplier first (Suppliers tab)', 1);
    DR = { lines: [] };
    var h = X.field('Supplier *', '<select id="ttxPOs">' + act.map(function (s) { return '<option value="' + H(s.id) + '">' + H(s.name) + '</option>'; }).join('') + '</select>') + '<div class="ttx-two">' + X.field('Order date', '<input type="date" id="ttxPOd" value="' + ymd() + '">') + X.field('Expected by', '<input type="date" id="ttxPOe">') + '</div>' +
      '<div class="ttx-sec">Items</div><div id="ttxPOl"></div><div class="ttx-row"><select id="ttxPOi"><option value="">＋ Pick a stock item…</option>' + inv().slice(0, 600).map(function (i) { return '<option value="' + H(i.id) + '">' + H(i.name) + (i.code ? ' (' + H(i.code) + ')' : '') + '</option>'; }).join('') + '</select><button class="ttx-b" data-a="poAddI">Add</button></div>' +
      '<div class="ttx-row"><input id="ttxPOx" placeholder="Or a non-stock item name"><button class="ttx-b" data-a="poAddX">Add</button></div>' + X.field('Notes', '<input id="ttxPOn" maxlength="200">') + '<div id="ttxPOt" class="ttx-note"></div><div class="ttx-btns"><button class="ttx-b pri" data-a="poSave">Create purchase order</button></div>';
    X.sheet('ttxPF', 'New purchase order', h, { z: 3600 });
    X.bind('ttxPF', { click: {
      poAddI: function () { var id = document.getElementById('ttxPOi').value; if (!id) return; var it = inv().find(function (i) { return String(i.id) === id; }); if (!it) return; if (DR.lines.some(function (l) { return String(l.itemId) === id; })) return X.toast('Item already added', 1); DR.lines.push({ itemId: it.id, name: it.name, hsn: it.hsn || '', qty: 1, rate: N(it.dealerPrice), gst: 18, received: 0 }); drawLines(); },
      poAddX: function () { var el = document.getElementById('ttxPOx'), v = el.value.trim(); if (!v) return; DR.lines.push({ itemId: null, name: v, hsn: '', qty: 1, rate: 0, gst: 18, received: 0 }); el.value = ''; drawLines(); },
      poDel: function (p) { DR.lines.splice(Number(p), 1); drawLines(); },
      poSave: poSave
    }, input: { poLn: function (v, el) { var i = Number(el.getAttribute('data-n')), k = el.getAttribute('data-k'); DR.lines[i][k] = Number(v) || 0; totalLine(); } } });
    drawLines();
  }
  function drawLines() {
    var el = document.getElementById('ttxPOl'); if (!el) return;
    el.innerHTML = DR.lines.length ? DR.lines.map(function (l, i) { return '<div class="ttx-card"><div class="ttx-ct"><b>' + H(l.name) + (l.itemId == null ? ' <small>(non-stock)</small>' : '') + '</b><button class="ttx-b" data-a="poDel" data-p="' + i + '">✕</button></div><div class="ttx-three"><label>Qty<input type="number" min="1" step="1" inputmode="numeric" data-i="poLn" data-n="' + i + '" data-k="qty" value="' + l.qty + '"></label><label>Rate ₹<input type="number" min="0" step="0.01" inputmode="decimal" data-i="poLn" data-n="' + i + '" data-k="rate" value="' + l.rate + '"></label><label>GST %<input type="number" min="0" max="28" step="0.01" inputmode="decimal" data-i="poLn" data-n="' + i + '" data-k="gst" value="' + l.gst + '"></label></div></div>'; }).join('') : '<div class="ttx-note">No items yet.</div>';
    totalLine();
  }
  function totalLine() { var t = poTotals(DR.lines), el = document.getElementById('ttxPOt'); if (el) el.innerHTML = 'Subtotal ' + X.inr(t.sub) + ' · GST ' + X.inr(t.gst) + ' · <b>Total ' + X.inr(t.total) + '</b>'; }
  function poSave() {
    if (lock('43')) return; var g = function (i) { return (document.getElementById(i) || {}).value || ''; }, sid = g('ttxPOs'), s = X.byId('SUPPLIERS', sid);
    if (!s) return X.toast('Pick a supplier', 1); if (!DR.lines.length) return X.toast('Add at least one item', 1);
    for (var i = 0; i < DR.lines.length; i++) { var l = DR.lines[i]; if (!(l.qty > 0) || Math.floor(l.qty) !== l.qty) return X.toast('Quantity of “' + l.name + '” must be a whole number above 0', 1); if (!(l.rate >= 0) || !isFinite(l.rate)) return X.toast('Check the rate of “' + l.name + '”', 1); if (l.gst < 0 || l.gst > 28) return X.toast('GST % must be 0–28', 1); }
    var t = poTotals(DR.lines), admin = isAdm(), auto = admin || (limit() > 0 && t.total <= limit());
    var po = { id: X.uid('PO'), supplierId: sid, supplierName: s.name, date: g('ttxPOd') || ymd(), expected: g('ttxPOe'), lines: JSON.parse(JSON.stringify(DR.lines)), notes: g('ttxPOn').trim(), subtotal: t.sub, gstAmt: t.gst, total: t.total, status: auto ? 'Approved' : 'Pending Approval', approval: auto ? { by: admin ? me() : 'Auto (within limit)', at: new Date().toISOString() } : null, receipts: [], bills: [], payments: [], createdBy: me(), createdById: X.meId(), createdAt: new Date().toISOString(), hist: [] };
    X.hist(po, 'created', X.inr(t.total) + (auto ? ' · approved' : ' · waiting for Admin'));
    X.saveConfirmed('PURCHASES', pos().concat([po]).filter(Boolean), 'Purchase order created'); DR = null; X.close('ttxPF'); puRender();
    if (!auto) try { if (window.cloudSync && window.cloudSync.pushLiveNotification) window.cloudSync.pushLiveNotification({ title: '🛒 PO needs approval', body: s.name + ' · ' + X.inr(t.total), type: 'purchase' }); } catch (e) {}
  }
  function poDetail(id) {
    var po = X.byId('PURCHASES', id); if (!po) return; var admin = isAdm(), canRecv = /Approved|Partially/.test(po.status), billedTotal = (po.bills || []).reduce(function (a, b) { return a + N(b.amount); }, 0), paid = (po.payments || []).reduce(function (a, p) { return a + N(p.amount); }, 0);
    var h = '<div class="ttx-ct"><div><b>' + H(po.supplierName) + '</b><small>' + H(po.id) + ' · ' + X.fmtD(po.date) + ' · by ' + H(po.createdBy) + '</small></div>' + X.chip(po.status, po.status === 'Received' ? 'ok' : (po.status === 'Cancelled' ? 'bad' : '')) + '</div>' +
      '<table class="ttx-tb"><tr><th>Item</th><th>Ordered</th><th>Got</th><th>Rate</th></tr>' + po.lines.map(function (l) { return '<tr><td>' + H(l.name) + '</td><td>' + l.qty + '</td><td>' + N(l.received) + '</td><td>' + X.inr(l.rate) + '</td></tr>'; }).join('') + '</table><div class="ttx-note">Subtotal ' + X.inr(po.subtotal) + ' · GST ' + X.inr(po.gstAmt) + ' · <b>Total ' + X.inr(po.total) + '</b></div>';
    h += '<div class="ttx-btns">' + (po.status === 'Pending Approval' && admin ? '<button class="ttx-b pri" data-a="poApprove" data-p="' + H(id) + '">✓ Approve</button><button class="ttx-b dng" data-a="poCancel" data-p="' + H(id) + '">Reject</button>' : '') + (canRecv ? '<button class="ttx-b pri" data-a="grNew" data-p="' + H(id) + '">📦 Receive goods</button>' : '') + (po.status !== 'Cancelled' && po.status !== 'Pending Approval' ? '<button class="ttx-b" data-a="blNew" data-p="' + H(id) + '">🧾 Add supplier bill</button>' : '') + (admin && po.status !== 'Cancelled' && !(po.receipts || []).length ? '<button class="ttx-b dng" data-a="poCancel" data-p="' + H(id) + '">Cancel PO</button>' : '') + '</div>';
    if ((po.receipts || []).length) h += '<div class="ttx-sec">Goods receipts</div>' + po.receipts.map(function (r) { return '<div class="ttx-hi"><b>' + H(r.id) + '</b> ' + r.lines.map(function (l) { return H(po.lines[l.n].name) + ' ×' + l.qty; }).join(', ') + ' <small>' + X.fmtDT(r.at) + ' · ' + H(r.by) + (r.billNo ? ' · bill ' + H(r.billNo) : '') + ' · ' + (r.stockApplied === false ? '<b style="color:#d97706">stock update pending</b>' : (r.stockApplied === 'n/a' ? 'no stock items' : 'stock updated')) + '</small></div>'; }).join('');
    if ((po.bills || []).length) h += '<div class="ttx-sec">Supplier bills</div>' + po.bills.map(function (b) { var pd = paidOn(po, b.id), out = r2(N(b.amount) - pd); return '<div class="ttx-card"><div class="ttx-ct"><div><b>' + H(b.no) + '</b><small>' + X.fmtD(b.date) + (b.due ? ' · due ' + X.fmtD(b.due) : '') + ' · ' + X.inr(b.amount) + ' · paid ' + X.inr(pd) + '</small></div>' + (out > 0 ? (admin ? '<button class="ttx-b pri" data-a="pyNew" data-p="' + H(id + '|' + b.id) + '">Pay ' + X.inr(out) + '</button>' : X.chip('Due ' + X.inr(out), 'warn')) : X.chip('Paid', 'ok')) + '</div></div>'; }).join('') + '<div class="ttx-note">Billed ' + X.inr(billedTotal) + ' · Paid ' + X.inr(paid) + ' · Outstanding ' + X.inr(billedTotal - paid) + (admin ? '' : ' · Only Admin records supplier payments') + '</div>';
    h += '<div class="ttx-sec">History</div>' + (po.hist || []).slice().reverse().map(function (x) { return '<div class="ttx-hi"><b>' + H(x.act) + '</b> ' + H(x.note) + '<small>' + H(x.by) + ' · ' + X.fmtDT(x.at) + '</small></div>'; }).join('');
    X.sheet('ttxPD', 'Purchase order', h, { z: 3550 });
    X.bind('ttxPD', { click: { poApprove: function (p) { poStatus(p, 'Approved'); }, poCancel: function (p) { if (!confirm('Cancel this purchase order?')) return; poStatus(p, 'Cancelled'); }, grNew: grForm, blNew: blForm, pyNew: pyForm } });
  }
  function putPO(po, msg) { X.saveConfirmed('PURCHASES', pos().map(function (x) { return x.id === po.id ? po : x; }), msg, function () { }); poDetail(po.id); puRender(); }
  function poStatus(id, st) {
    if (!isAdm()) return X.toast('Only Admin can do this', 1); var p0 = X.byId('PURCHASES', id); if (!p0 || p0.status === st) return;
    if (st === 'Cancelled' && (p0.receipts || []).length) return X.toast('Goods were already received — cannot cancel', 1);
    var po = JSON.parse(JSON.stringify(p0)); po.status = st; if (st === 'Approved') po.approval = { by: me(), at: new Date().toISOString() }; X.hist(po, st.toLowerCase(), ''); putPO(po, 'Purchase order ' + st.toLowerCase());
  }

  /* ----- goods receipt (idempotent; stock only for confirmed received qty) ----- */
  var TOK = null;
  function grForm(id) {
    var po = X.byId('PURCHASES', id); if (!po) return; TOK = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    var h = '<div class="ttx-note">Enter only what physically arrived. Stock is increased by exactly these quantities.</div>' + po.lines.map(function (l, i) { var pend = N(l.qty) - N(l.received); return '<div class="ttx-card"><div class="ttx-ct"><div><b>' + H(l.name) + '</b><small>Ordered ' + l.qty + ' · received ' + N(l.received) + ' · pending ' + pend + (l.itemId == null ? ' · non-stock' : '') + '</small></div><input type="number" min="0" max="' + pend + '" step="1" inputmode="numeric" class="ttx-qty" data-n="' + i + '" value="0"' + (pend <= 0 ? ' disabled' : '') + '></div></div>'; }).join('') +
      '<div class="ttx-two">' + X.field('Supplier bill / challan no', '<input id="ttxGRb" maxlength="40">') + X.field('Received date', '<input type="date" id="ttxGRd" value="' + ymd() + '" max="' + ymd() + '">') + '</div><div class="ttx-btns"><button class="ttx-b pri" data-a="grSave" data-p="' + H(id) + '">Confirm receipt</button></div>';
    X.sheet('ttxGR', 'Receive goods', h, { z: 3600 }); X.bind('ttxGR', { click: { grSave: grSave } });
  }
  function grSave(id) {
    if (lock('44')) return; var p0 = X.byId('PURCHASES', id); if (!p0 || !/Approved|Partially/.test(p0.status)) return X.toast('This order cannot receive goods now', 1);
    var rid = 'GRN-' + TOK; if ((p0.receipts || []).some(function (r) { return r.id === rid; })) { X.close('ttxGR'); return X.toast('This receipt was already recorded — nothing changed', 1); }
    var lines = []; document.querySelectorAll('#ttxGR .ttx-qty').forEach(function (el) { var n = Number(el.getAttribute('data-n')), q = Number(el.value); if (!q) return; lines.push({ n: n, qty: q }); });
    if (!lines.length) return X.toast('Enter at least one received quantity', 1);
    for (var i = 0; i < lines.length; i++) { var l = p0.lines[lines[i].n], pend = N(l.qty) - N(l.received); if (!(lines[i].qty > 0) || Math.floor(lines[i].qty) !== lines[i].qty) return X.toast('Quantities must be whole numbers', 1); if (lines[i].qty > pend) return X.toast('“' + l.name + '”: only ' + pend + ' pending', 1); }
    var hasStock = lines.some(function (x) { return p0.lines[x.n].itemId != null; });
    var po = JSON.parse(JSON.stringify(p0)), amount = 0;
    lines.forEach(function (x) { po.lines[x.n].received = N(po.lines[x.n].received) + x.qty; amount += lineAmt(po.lines[x.n], x.qty); });
    var g = function (i) { return (document.getElementById(i) || {}).value || ''; };
    po.receipts = (po.receipts || []).concat([{ id: rid, at: new Date().toISOString(), date: g('ttxGRd') || ymd(), by: me(), byId: X.meId(), billNo: g('ttxGRb').trim(), lines: lines, amount: r2(amount), stockApplied: hasStock ? false : 'n/a' }]);
    po.status = po.lines.every(function (l) { return N(l.received) >= N(l.qty); }) ? 'Received' : 'Partially Received';
    X.hist(po, 'goods received', lines.length + ' line(s) · ' + X.inr(amount));
    X.close('ttxGR');
    /* step 1: record the receipt (flagged "stock pending"). step 2: apply stock once. step 3: flip the flag. Each step is confirmed before the next. */
    X.cloudConfirm('PURCHASES', pos().map(function (x) { return x.id === po.id ? po : x; })).then(function () {
      X.save('PURCHASES', pos().map(function (x) { return x.id === po.id ? po : x; }));
      return hasStock ? applyReceipt(po.id, rid) : true;
    }).then(function () { X.toast('Goods received' + (hasStock ? ' · stock updated' : '')); poDetail(po.id); puRender(); }, function (e) {
      X.save('PURCHASES', pos().map(function (x) { return x.id === po.id ? po : x; }));
      X.toast('Receipt kept on this phone; cloud/stock step not confirmed (' + (e.message || e) + '). Nothing is counted twice — use “Apply pending stock” once online.', 1); poDetail(po.id); puRender();
    });
  }
  /* idempotent: an inventory item remembers every receipt id it has absorbed */
  function applyReceipt(poId, rid) {
    var po0 = X.byId('PURCHASES', poId), r = po0 && (po0.receipts || []).find(function (x) { return x.id === rid; }); if (!r) return Promise.resolve(false);
    if (r.stockApplied === true || r.stockApplied === 'n/a') return Promise.resolve(true);
    var changed = false;
    r.lines.forEach(function (x) { var l = po0.lines[x.n]; if (l.itemId == null) return; var it = inv().find(function (i) { return String(i.id) === String(l.itemId); }); if (!it) throw new Error('Stock item “' + l.name + '” no longer exists'); it.appliedReceipts = it.appliedReceipts || []; if (it.appliedReceipts.indexOf(rid) >= 0) return; it.stock = N(it.stock) + x.qty; it.appliedReceipts.push(rid); changed = true; });
    var finish = function () { var po = JSON.parse(JSON.stringify(X.byId('PURCHASES', poId))); po.receipts.forEach(function (x) { if (x.id === rid) x.stockApplied = true; }); X.hist(po, 'stock updated', rid); var arr = pos().map(function (x) { return x.id === po.id ? po : x; }); X.save('PURCHASES', arr); return X.cloudConfirm('PURCHASES', arr); };
    if (!changed) return finish();
    try { setStored('INVENTORY', sampleInventory); } catch (e) { return Promise.reject(e); }
    return X.cloudConfirm('INVENTORY', sampleInventory).then(finish);
  }
  function applyPending(manual) {
    if (!isAdm()) return; var q = allPending(); if (!q.length) return; var p = Promise.resolve(), ok = 0;
    q.forEach(function (x) { p = p.then(function () { return applyReceipt(x.po.id, x.r.id).then(function () { ok++; }); }); });
    p.then(function () { X.toast(ok + ' pending stock update(s) applied'); puRender(); }, function (e) { X.toast('Could not finish: ' + (e.message || e), 1); });
  }

  /* ----- supplier bill & payment ----- */
  function blForm(id) {
    var po = X.byId('PURCHASES', id); if (!po) return; TOK = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    var billed = {}; (po.bills || []).forEach(function (b) { if (b.receiptId) billed[b.receiptId] = 1; });
    var h = X.field('Supplier invoice no *', '<input id="ttxBLn" maxlength="40">') + '<div class="ttx-two">' + X.field('Invoice date', '<input type="date" id="ttxBLd" value="' + ymd() + '">') + X.field('Due date', '<input type="date" id="ttxBLu">') + '</div>' + X.field('Covers goods receipt', '<select id="ttxBLr"><option value="">Not linked to a receipt</option>' + (po.receipts || []).filter(function (r) { return !billed[r.id]; }).map(function (r) { return '<option value="' + H(r.id) + '" data-amt="' + r.amount + '">' + H(r.id) + ' · ' + X.inr(r.amount) + '</option>'; }).join('') + '</select>') + X.field('Bill amount ₹ *', '<input type="number" step="0.01" min="0.01" inputmode="decimal" id="ttxBLa">') + '<div class="ttx-btns"><button class="ttx-b pri" data-a="blSave" data-p="' + H(id) + '">Save bill</button></div>';
    X.sheet('ttxBL', 'Supplier bill', h, { z: 3600 });
    X.bind('ttxBL', { change: { }, click: { blSave: function (p) {
      if (lock('45')) return; var g = function (i) { return (document.getElementById(i) || {}).value || ''; }, no = g('ttxBLn').trim(), amt = r2(Number(g('ttxBLa'))), p0 = X.byId('PURCHASES', p);
      if (!no) return X.toast('Invoice number is required', 1); if (!(amt > 0)) return X.toast('Enter a valid amount', 1);
      var dupe = pos().some(function (q) { return q && q.supplierId === p0.supplierId && (q.bills || []).some(function (b) { return X.norm(b.no) === X.norm(no); }); });
      if (dupe) return X.toast('Invoice ' + no + ' is already recorded for this supplier', 1);
      var po = JSON.parse(JSON.stringify(p0)); po.bills = (po.bills || []).concat([{ id: 'BILL-' + TOK, no: no, date: g('ttxBLd') || ymd(), due: g('ttxBLu'), amount: amt, receiptId: g('ttxBLr'), by: me(), at: new Date().toISOString() }]); X.hist(po, 'bill added', no + ' · ' + X.inr(amt));
      X.close('ttxBL'); putPO(po, 'Bill saved');
    } } });
    var sel = document.getElementById('ttxBLr'); sel.onchange = function () { var o = sel.selectedOptions[0]; if (o && o.getAttribute('data-amt')) document.getElementById('ttxBLa').value = o.getAttribute('data-amt'); };
  }
  function pyForm(p) {
    if (!isAdm()) return X.toast('Only Admin can record supplier payments', 1); var a = p.split('|'), po = X.byId('PURCHASES', a[0]), b = po && (po.bills || []).find(function (x) { return x.id === a[1]; }); if (!b) return;
    TOK = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); var out = r2(N(b.amount) - paidOn(po, b.id));
    var h = '<div class="ttx-note">Bill ' + H(b.no) + ' · outstanding <b>' + X.inr(out) + '</b></div>' + X.field('Amount ₹ *', '<input type="number" step="0.01" min="0.01" max="' + out + '" id="ttxPYa" value="' + out + '" inputmode="decimal">') + X.field('Mode', '<select id="ttxPYm">' + ['Bank transfer', 'UPI', 'Cash', 'Cheque'].map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select>') + X.field('Reference / UTR', '<input id="ttxPYr" maxlength="40">') + '<div class="ttx-btns"><button class="ttx-b pri" data-a="pySave" data-p="' + H(p) + '">Record payment</button></div>';
    X.sheet('ttxPY', 'Supplier payment', h, { z: 3600 });
    X.bind('ttxPY', { click: { pySave: function (pp) {
      if (lock('46')) return; var q = pp.split('|'), p0 = X.byId('PURCHASES', q[0]), bl = p0 && p0.bills.find(function (x) { return x.id === q[1]; }); if (!bl) return;
      var pid = 'PAY-' + TOK; if ((p0.payments || []).some(function (x) { return x.id === pid; })) { X.close('ttxPY'); return X.toast('Already recorded — nothing changed', 1); }
      var amt = r2(Number((document.getElementById('ttxPYa') || {}).value)), left = r2(N(bl.amount) - paidOn(p0, bl.id)); if (!(amt > 0)) return X.toast('Enter a valid amount', 1); if (amt > left) return X.toast('Payment is more than the outstanding ' + X.inr(left), 1);
      var ref = (document.getElementById('ttxPYr') || {}).value.trim(), mode = document.getElementById('ttxPYm').value;
      if (ref && pos().some(function (z) { return (z.payments || []).some(function (y) { return y.ref && X.norm(y.ref) === X.norm(ref) && y.mode === mode; }); }) && !confirm('The reference “' + ref + '” was already used for another payment. Record this one too?')) return;
      var po = JSON.parse(JSON.stringify(p0)); po.payments = (po.payments || []).concat([{ id: pid, billId: bl.id, amount: amt, mode: mode, ref: ref, by: me(), byId: X.meId(), at: new Date().toISOString() }]); X.hist(po, 'payment', X.inr(amt) + ' · ' + mode);
      X.close('ttxPY'); putPO(po, 'Payment recorded'); try { if (window.ttActAdd) window.ttActAdd('purchase', 'paid', po.id, X.inr(amt)); } catch (e) {}
    } } });
  }
  var prev = window.ttxOnCloud;
  window.ttxOnCloud = function (p) { if (prev) try { prev(p); } catch (e) {} if (p) { if ((p.PURCHASES || p.SUPPLIERS) && X.isOpen('ttxPU')) puRender(); if (p.CLOSINGS && X.isOpen('ttxRC')) rcRender(); } };
  window.ttxPurchaseInfo = { supBalance: supBalance, poTotals: poTotals, expectedReceipts: expected };
})();

/* ===== v29 · Backup & Restore Centre (validated, previewed, staged) + Duplicate review & safe lead merge ===== */
(function () {
  'use strict';
  var X = window.ttx, H = X.H, on = X.on, me = X.me, isAdm = X.isAdm;
  var busyK = {}; function lock(k) { if (busyK[k]) return true; busyK[k] = 1; setTimeout(function () { busyK[k] = 0; }, 1200); return false; }
  function cyrb(str) { var h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (var i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16); }

  /* ================= BACKUP ================= */
  function A(f) { try { var v = f(); return Array.isArray(v) ? v : null; } catch (e) { return null; } }
  var SETS = [
    ['ORDERS', 'Orders & ledger', function () { return ordersData; }, function (v) { ordersData = v; }],
    ['CUSTOMERS', 'Customers', function () { return customerDatabase; }, function (v) { customerDatabase = v; }],
    ['INVENTORY', 'Stock items', function () { return sampleInventory; }, function (v) { sampleInventory = v; }],
    ['LEADS', 'Leads', function () { return leadsData; }, function (v) { leadsData = v; }],
    ['SERVICES', 'Service calls', function () { return serviceCallsData; }, function (v) { serviceCallsData = v; }],
    ['MACHINERY', 'Machinery list', function () { return machineryDatabase; }, function (v) { machineryDatabase = v; }],
    ['QUOTATIONS', 'Quotations', function () { return quotationsData; }, function (v) { quotationsData = v; }],
    ['TRAVEL', 'Travel log', function () { return travelData; }, function (v) { travelData = v; }],
    ['EXPENSES', 'Expenses', function () { return expensesData; }, function (v) { expensesData = v; window.expensesData = v; }],
    ['OVERHEADS', 'Overheads', function () { return overheadsData; }, function (v) { overheadsData = v; window.overheadsData = v; }],
    ['TASKS', 'Tasks', function () { return X.list('TASKS'); }, function (v) { window.TTX.TASKS = v; }],
    ['SUPPLIERS', 'Suppliers', function () { return X.list('SUPPLIERS'); }, function (v) { window.TTX.SUPPLIERS = v; }],
    ['PURCHASES', 'Purchase orders & bills', function () { return X.list('PURCHASES'); }, function (v) { window.TTX.PURCHASES = v; }],
    ['PURCHASE_BILLS', 'Purchase bills (stock entry)', function () { return X.list('PURCHASE_BILLS'); }, function (v) { window.TTX.PURCHASE_BILLS = v; }],
    ['ATTENDANCE', 'Attendance', function () { return X.list('ATTENDANCE'); }, function (v) { window.TTX.ATTENDANCE = v; }],
    ['LEAVES', 'Leave requests', function () { return X.list('LEAVES'); }, function (v) { window.TTX.LEAVES = v; }],
    ['EVENTS', 'Calendar events', function () { return X.list('EVENTS'); }, function (v) { window.TTX.EVENTS = v; }],
    ['NOTICES', 'Announcements', function () { return X.list('NOTICES'); }, function (v) { window.TTX.NOTICES = v; }],
    ['CLOSINGS', 'Cash closings', function () { return X.list('CLOSINGS'); }, function (v) { window.TTX.CLOSINGS = v; }]
  ];
  var SCHEMA = 2, APPV = 'v29';
  var EXCLUDED = ['Staff accounts (contain passwords / PINs)', 'Chat messages', 'Activity log', 'Company profile & Firebase configuration', 'Per-device settings and PIN lock'];
  function cur(key) { var s = SETS.find(function (x) { return x[0] === key; }); return s ? A(s[2]) : null; }
  function strip(v) { return JSON.parse(JSON.stringify(v, function (k, x) { return (typeof x === 'string' && x.length > 5000 && x.indexOf('data:') === 0) ? '' : x; })); }
  function lastBk() { try { return localStorage.getItem('TTX_LAST_FULL_BACKUP') || ''; } catch (e) { return ''; } }
  function makeBackup(noPhotos) {
    var data = {}, counts = {}, skipped = [];
    SETS.forEach(function (s) { var v = A(s[2]); if (!v) { skipped.push(s[1]); return; } data[s[0]] = noPhotos ? strip(v) : v; counts[s[0]] = v.length; });
    var json = JSON.stringify(data);
    return { out: { app: 'TTESPL-ERP', kind: 'full-backup', schemaVersion: SCHEMA, appVersion: APPV, exportedAt: new Date().toISOString(), exportedBy: { id: X.meId(), name: me() }, host: location.host, scope: 'Admin export: all records the app holds on this device', photosIncluded: !noPhotos, excluded: EXCLUDED, counts: counts, checksum: cyrb(json), data: data }, skipped: skipped, size: json.length };
  }
  function bkHtml() {
    var mk = isAdm() ? makeBackup(false) : null, last = lastBk();
    var h = '<div class="ttx-note"><b>Full backup</b> = restorable copy of your records. <b>Reports</b> (GST, P&amp;L, CSV, PDF) are for reading only and cannot be restored.</div>';
    h += '<div class="ttx-kp"><div><small>Last full backup</small><b style="font-size:13px">' + (last ? X.fmtDT(last) : 'Never on this phone') + '</b></div><div><small>Records now</small><b>' + (mk ? Object.keys(mk.out.counts).reduce(function (a, k) { return a + mk.out.counts[k]; }, 0) : '—') + '</b></div><div><small>Approx size</small><b>' + (mk ? (mk.size / 1048576 < 1 ? Math.round(mk.size / 1024) + ' KB' : (mk.size / 1048576).toFixed(1) + ' MB') : '—') + '</b></div></div>';
    if (!isAdm()) return h + '<div class="ttx-note warn">Only an Admin can create or restore a full backup, so staff cannot copy data they are not meant to hold. Your normal report exports are unchanged.</div>';
    h += '<div class="ttx-sec">Included</div><div class="ttx-chips">' + SETS.map(function (s) { var n = mk.out.counts[s[0]]; return n == null ? '' : X.chip(s[1] + ' · ' + n); }).join('') + '</div>';
    if (mk.skipped.length) h += '<div class="ttx-note warn">Not available on this phone right now: ' + H(mk.skipped.join(', ')) + '</div>';
    h += '<div class="ttx-sec">Not included</div><ul class="ttx-ul">' + EXCLUDED.map(function (x) { return '<li>' + H(x) + '</li>'; }).join('') + '</ul>';
    h += '<label class="ttx-chk"><input type="checkbox" id="ttxBKnp"> Leave out photos &amp; signatures (smaller file — those images cannot be restored)</label>';
    h += '<div class="ttx-btns"><button class="ttx-b pri" data-a="bkMake">⬇ Download full backup</button><button class="ttx-b" data-a="bkShare">📤 Share</button></div>';
    h += '<div class="ttx-sec">Restore from a backup file</div><div class="ttx-note">Nothing is changed until you have seen a preview. Restore never deletes records that are missing from the file.</div><div class="ttx-btns"><button class="ttx-b" data-a="bkPick">📂 Choose backup file…</button></div><input type="file" id="ttxBKf" accept=".json,application/json" style="display:none">';
    h += '<div class="ttx-sec">Data check</div><div class="ttx-btns"><button class="ttx-b" data-a="bkCheck">🔎 Run integrity check</button></div><div id="ttxBKc"></div>';
    return h;
  }
  function bkOpen() {
    if (!on('mBackup')) return; X.sheet('ttxBK', '💾 Backup & Restore', bkHtml());
    var inp = function () { return document.getElementById('ttxBKf'); };
    X.bind('ttxBK', { click: {
      bkMake: function () { if (!isAdm()) return; var mk = makeBackup((document.getElementById('ttxBKnp') || {}).checked); var name = 'TTESPL_FullBackup_' + X.ymd() + '.json'; try { downloadFile(JSON.stringify(mk.out), name, 'application/json'); try { localStorage.setItem('TTX_LAST_FULL_BACKUP', new Date().toISOString()); } catch (e) {} X.toast('Backup file created (' + Object.keys(mk.out.counts).length + ' lists). Check your Downloads and keep it safe.'); X.body('ttxBK', bkHtml(), true); } catch (e) { X.toast('Backup failed: ' + e.message, 1); } },
      bkShare: function () { if (!isAdm()) return; var mk = makeBackup((document.getElementById('ttxBKnp') || {}).checked), name = 'TTESPL_FullBackup_' + X.ymd() + '.json'; try { var f = new File([JSON.stringify(mk.out)], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'TTESPL backup' }).then(function () { try { localStorage.setItem('TTX_LAST_FULL_BACKUP', new Date().toISOString()); } catch (e) {} }, function () { }); else X.toast('Sharing is not supported here — use Download', 1); } catch (e) { X.toast('Share failed', 1); } },
      bkPick: function () { var i = inp(); if (i) { i.value = ''; i.click(); } }, bkCheck: runIntegrity
    } });
    var fi = document.getElementById('ttxBKf'); if (fi && !fi.__b) { fi.__b = 1; fi.addEventListener('change', function () { var f = fi.files && fi.files[0]; if (f) readFile(f); }); }
  }
  window.ttOpenBackupCentre = bkOpen;
  X.hubTiles.push({ mod: 'mBackup', admin: true, icon: '💾', label: 'Backup & Restore', sub: function () { var l = lastBk(); return l ? 'Last ' + X.fmtD(l.slice(0, 10)) : 'No backup yet'; }, fn: bkOpen });

  /* ----- validation ----- */
  var REQ_ID = { ORDERS: 1, CUSTOMERS: 1, INVENTORY: 1, LEADS: 1, SERVICES: 1, QUOTATIONS: 1, TASKS: 1, SUPPLIERS: 1, PURCHASES: 1, ATTENDANCE: 1, LEAVES: 1, EVENTS: 1, NOTICES: 1, CLOSINGS: 1, EXPENSES: 1, TRAVEL: 1, MACHINERY: 0, OVERHEADS: 0 };
  function sig(x) { try { return JSON.stringify(x, function (k, v) { return (typeof v === 'string' && v.length > 300) ? v.length + ':' + v.slice(0, 40) : v; }); } catch (e) { return ''; } }
  function dateOk(s) { return !s || /^\d{4}-\d{2}-\d{2}/.test(String(s)); }
  function validate(obj) {
    var R = { fatal: [], warn: [], sets: {}, legacy: false, hostMismatch: false };
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { R.fatal.push('This file is not a TTESPL backup (the content is not a data object).'); return R; }
    if (obj.app !== 'TTESPL-ERP') R.fatal.push('This file was not created by TTESPL ERP (app marker is “' + H(obj.app || 'missing') + '”).');
    if (!obj.data || typeof obj.data !== 'object') R.fatal.push('The file has no data section.');
    if (R.fatal.length) return R;
    var sv = obj.schemaVersion != null ? obj.schemaVersion : (obj.version === 1 ? 1 : null);
    if (sv == null) R.fatal.push('The file has no schema/version number.'); else if (sv > SCHEMA) R.fatal.push('This backup was made by a newer app version (schema ' + sv + '). This app understands up to schema ' + SCHEMA + '.');
    if (sv === 1) { R.legacy = true; R.warn.push('Older backup format (schema 1): only orders, customers, stock, leads, services and machinery are inside. No checksum is available, so the file cannot be checked for damage.'); }
    if (R.fatal.length) return R;
    if (obj.checksum) { var calc = cyrb(JSON.stringify(obj.data)); if (calc !== obj.checksum) { R.fatal.push('Checksum does not match — the file is damaged or was edited after it was created. Restore refused.'); return R; } }
    else if (!R.legacy) R.warn.push('No checksum in the file, so damage cannot be detected.');
    if (obj.host && obj.host !== location.host) { R.hostMismatch = true; R.warn.push('This backup came from a different address (' + H(obj.host) + ', this is ' + H(location.host) + '). Make sure it belongs to this business before continuing.'); }
    var supIds = {}; (Array.isArray(obj.data.SUPPLIERS) ? obj.data.SUPPLIERS : (X.list('SUPPLIERS'))).forEach(function (s) { if (s && s.id != null) supIds[s.id] = 1; });
    Object.keys(obj.data).forEach(function (k) {
      var def = SETS.find(function (s) { return s[0] === k; }); var arr = obj.data[k];
      var S = R.sets[k] = { key: k, label: def ? def[1] : k, errs: [], warns: [], recs: [], known: !!def };
      if (!def) { S.errs.push('Unknown list — ignored'); return; }
      if (!Array.isArray(arr)) { S.errs.push('Not a list'); return; }
      var seen = {}, dupIds = 0, noId = 0, bad = 0;
      arr.forEach(function (r, i) {
        if (!r || typeof r !== 'object' || Array.isArray(r)) { bad++; return; }
        if (r.id == null || r.id === '') { if (REQ_ID[k]) { noId++; return; } }
        if (r.id != null) { if (seen[r.id]) { dupIds++; return; } seen[r.id] = 1; }
        if (k === 'ORDERS') {
          var nums = ['totalAmount', 'recvAmount', 'dueAmount']; for (var j = 0; j < nums.length; j++) { var v = r[nums[j]]; if (v != null && (typeof v !== 'number' || !isFinite(v) || v < 0)) { S.warns.push(r.id + ': ' + nums[j] + ' is not a valid amount'); bad++; return; } }
          if (Math.abs(Number(r.totalAmount || 0) - Number(r.recvAmount || 0) - Number(r.dueAmount || 0)) > 1 && r.status !== 'Cancelled') S.warns.push(r.id + ': total ≠ received + due');
          if (r.payments != null && (!Array.isArray(r.payments) || r.payments.some(function (p) { return !p || typeof p.amount !== 'number' || !isFinite(p.amount) || p.amount < 0; }))) { S.warns.push(r.id + ': payment list is invalid'); bad++; return; }
          if (!dateOk(r.orderDate)) S.warns.push(r.id + ': odd order date');
        }
        if (k === 'PURCHASES' && r.supplierId && !supIds[r.supplierId]) S.warns.push(r.id + ': supplier ' + r.supplierId + ' not found in this file or on this phone');
        if (k === 'LEADS' && !dateOk(r.inquiryDate)) S.warns.push(r.id + ': odd inquiry date');
        if (k === 'ATTENDANCE' && r.date && !dateOk(r.date)) S.warns.push(r.id + ': odd date');
        S.recs.push(r);
      });
      if (dupIds) S.errs.push(dupIds + ' record(s) share an id with another record in the file (kept the first, ignored the rest)'); if (noId) S.errs.push(noId + ' record(s) have no id and cannot be matched safely (ignored)'); if (bad) S.errs.push(bad + ' record(s) are malformed or have invalid amounts (ignored)');
      if (!S.recs.length && arr.length) S.fatal = true;
    });
    if (!Object.keys(R.sets).length) R.fatal.push('The file contains no lists.');
    return R;
  }
  function diffSet(S) {
    var now = cur(S.key) || [], map = {}; now.forEach(function (r) { if (r && r.id != null) map[r.id] = r; });
    var D = { add: [], chg: [], same: 0, flagged: [], currentOnly: 0, ids: {} };
    S.recs.forEach(function (r) { D.ids[r.id] = 1; var c = map[r.id]; if (!c) { D.add.push(r); } else if (sig(c) === sig(r)) D.same++; else D.chg.push(r); });
    now.forEach(function (r) { if (r && r.id != null && !D.ids[r.id]) D.currentOnly++; });
    if (S.key === 'ORDERS') { var cand = {}; now.forEach(function (o) { if (o && o.status !== 'Cancelled') cand[[X.norm(o.customerName), o.orderDate || '', Number(o.totalAmount) || 0].join('|')] = o.id; }); D.add = D.add.filter(function (o) { var k2 = [X.norm(o.customerName), o.orderDate || '', Number(o.totalAmount) || 0].join('|'); if (o.status !== 'Cancelled' && cand[k2]) { D.flagged.push({ rec: o, of: cand[k2] }); return false; } return true; }); }
    if (S.key === 'CUSTOMERS') { var ph = {}; now.forEach(function (c) { var p = X.last10(c.phone); if (p) ph[p] = c.id; }); D.add = D.add.filter(function (c) { var p = X.last10(c.phone); if (p && ph[p]) { D.flagged.push({ rec: c, of: ph[p] }); return false; } return true; }); }
    return D;
  }
  var RS = null; /* restore session */
  function readFile(f) {
    if (!isAdm()) return X.toast('Only Admin can restore', 1);
    if (f.size > 60 * 1048576) return X.toast('File is larger than 60 MB — too big to check safely on a phone', 1);
    var fr = new FileReader(); fr.onerror = function () { X.toast('Could not read that file', 1); };
    fr.onload = function () {
      var obj; try { obj = JSON.parse(fr.result); } catch (e) { return showRestore({ fatal: ['This is not valid JSON — the file is damaged or is not a backup. (' + H(e.message) + ')'], warn: [], sets: {} }, null, f.name); }
      var R = validate(obj); if (R.fatal.length) return showRestore(R, null, f.name);
      RS = { R: R, obj: obj, name: f.name, D: {}, pick: {}, mode: 'add' };
      Object.keys(R.sets).forEach(function (k) { var S = R.sets[k]; if (!S.known || S.fatal) return; RS.D[k] = diffSet(S); RS.pick[k] = RS.D[k].add.length > 0; });
      showRestore(R, RS, f.name);
    };
    fr.readAsText(f);
  }
  function showRestore(R, S, name) {
    var h = '<div class="ttx-note">File: <b>' + H(name) + '</b></div>';
    if (R.fatal.length) h += '<div class="ttx-note bad">❌ <b>Cannot restore this file.</b><ul class="ttx-ul">' + R.fatal.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
    else {
      if (R.warn.length) h += '<div class="ttx-note warn">⚠<ul class="ttx-ul">' + R.warn.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
      h += '<table class="ttx-tb"><tr><th>List</th><th>New</th><th>Changed</th><th>Same</th><th>Skipped</th><th></th></tr>' + Object.keys(S.D).map(function (k) { var D = S.D[k], Q = R.sets[k]; return '<tr><td>' + H(Q.label) + (Q.errs.length ? '<br><small class="bad">' + Q.errs.map(H).join('; ') + '</small>' : '') + (Q.warns.length ? '<br><small>' + Q.warns.length + ' warning(s)</small>' : '') + '</td><td>' + D.add.length + '</td><td>' + D.chg.length + '</td><td>' + D.same + '</td><td>' + D.flagged.length + '</td><td><input type="checkbox" data-c="rsPick" data-k="' + k + '"' + (S.pick[k] ? ' checked' : '') + ' aria-label="Restore ' + H(Q.label) + '"></td></tr>'; }).join('') + '</table>';
      Object.keys(S.D).forEach(function (k) { var D = S.D[k]; if (D.flagged.length) h += '<div class="ttx-note warn">' + D.flagged.length + ' ' + H(R.sets[k].label) + ' record(s) look like duplicates of ones you already have (same ' + (k === 'ORDERS' ? 'customer, date and total' : 'phone number') + ') and are <b>skipped</b> to avoid double entries: ' + D.flagged.slice(0, 5).map(function (f) { return H(f.rec.id) + ' ≈ ' + H(f.of); }).join(', ') + (D.flagged.length > 5 ? '…' : '') + '</div>'; });
      var curOnly = Object.keys(S.D).reduce(function (a, k) { return a + S.D[k].currentOnly; }, 0);
      h += '<div class="ttx-note">' + curOnly + ' record(s) exist on this phone but not in the file — they are <b>left untouched</b>.</div>';
      h += '<div class="ttx-sec">How to restore</div><label class="ttx-chk"><input type="radio" name="rsm" data-c="rsMode" value="add"' + (S.mode === 'add' ? ' checked' : '') + '> <span><b>Add missing records only</b> (safe, recommended)</span></label><label class="ttx-chk"><input type="radio" name="rsm" data-c="rsMode" value="over"' + (S.mode === 'over' ? ' checked' : '') + '> <span><b>Add missing + replace changed records</b> with the file’s version (changes order payment history of those records)</span></label>';
      h += '<div class="ttx-note">Before anything is written, a safety copy of the current data is downloaded to this phone. Each list is then saved and confirmed by the cloud one at a time.</div><div class="ttx-btns"><button class="ttx-b pri" data-a="rsGo">Continue to confirm…</button></div>';
    }
    X.sheet('ttxRS', 'Restore preview', h, { z: 3700 });
    X.bind('ttxRS', { click: { rsGo: confirmRestore, rsRetry: retryFailed, rsUndo: undoRestore }, change: { rsPick: function (v, el) { RS.pick[el.getAttribute('data-k')] = el.checked; }, rsMode: function (v) { RS.mode = v; } } });
  }
  function confirmRestore() {
    var keys = Object.keys(RS.pick).filter(function (k) { return RS.pick[k]; }); if (!keys.length) return X.toast('Select at least one list', 1);
    var nAdd = 0, nChg = 0; keys.forEach(function (k) { nAdd += RS.D[k].add.length; nChg += RS.mode === 'over' ? RS.D[k].chg.length : 0; }); if (!nAdd && !nChg) return X.toast('Nothing to restore for the selected lists', 1);
    var msg = 'Restore ' + nAdd + ' new' + (nChg ? ' and replace ' + nChg + ' changed' : '') + ' record(s) in: ' + keys.join(', ') + '.\n\n';
    if (RS.mode === 'over' && keys.indexOf('ORDERS') >= 0 && RS.D.ORDERS.chg.length) { var t = prompt(msg + 'This REPLACES ' + RS.D.ORDERS.chg.length + ' existing order(s), including their payment history.\nType RESTORE to continue.'); if ((t || '').trim() !== 'RESTORE') return X.toast('Restore cancelled — nothing changed'); }
    else if (!confirm(msg + 'A safety copy of current data will be downloaded first. Continue?')) return;
    runRestore(keys);
  }
  function runRestore(keys) {
    if (lock('51')) return; var snap = {}, before = {};
    keys.forEach(function (k) { snap[k] = JSON.parse(JSON.stringify(cur(k) || [])); before[k] = (cur(k) || []).map(function (r) { return r && r.id; }); });
    try { downloadFile(JSON.stringify({ app: 'TTESPL-ERP', kind: 'pre-restore-snapshot', schemaVersion: SCHEMA, appVersion: APPV, exportedAt: new Date().toISOString(), exportedBy: { id: X.meId(), name: me() }, host: location.host, counts: Object.keys(snap).reduce(function (o, k) { o[k] = snap[k].length; return o; }, {}), checksum: cyrb(JSON.stringify(snap)), data: snap }), 'TTESPL_PreRestore_Snapshot_' + X.ymd() + '_' + Date.now().toString(36) + '.json', 'application/json'); } catch (e) { return X.toast('Could not create the safety copy — restore stopped, nothing changed.', 1); }
    RS.snap = snap; RS.res = {}; RS.keys = keys; RS.added = {};
    var p = Promise.resolve();
    keys.forEach(function (k) { p = p.then(function () { return restoreOne(k); }); });
    p.then(function () { finishRestore(); });
  }
  function restoreOne(k) {
    var D = RS.D[k], def = SETS.find(function (s) { return s[0] === k; }), now = (cur(k) || []).slice(), chgMap = {};
    if (RS.mode === 'over') D.chg.forEach(function (r) { chgMap[r.id] = r; });
    var merged = now.map(function (r) { return r && chgMap[r.id] ? chgMap[r.id] : r; }).concat(D.add);
    RS.added[k] = D.add.map(function (r) { return r.id; });
    try { def[3](merged); if (k.match(/^(TASKS|SUPPLIERS|PURCHASES|PURCHASE_BILLS|ATTENDANCE|LEAVES|EVENTS|NOTICES|CLOSINGS)$/)) X.save(k, merged); else setStored(k, merged); } catch (e) { RS.res[k] = { ok: false, err: 'Local save failed: ' + e.message }; return Promise.resolve(); }
    return X.cloudConfirm(k, merged).then(function () { RS.res[k] = { ok: true, add: D.add.length, chg: RS.mode === 'over' ? D.chg.length : 0 }; }, function (e) { RS.res[k] = { ok: false, err: 'Cloud did not confirm: ' + (e.message || e), add: D.add.length, chg: RS.mode === 'over' ? D.chg.length : 0 }; });
  }
  function finishRestore() {
    var ok = RS.keys.filter(function (k) { return RS.res[k] && RS.res[k].ok; }), bad = RS.keys.filter(function (k) { return !(RS.res[k] && RS.res[k].ok); });
    try { if (window.ttActAdd) window.ttActAdd('backup', 'restore', RS.name, ok.join(',') + (bad.length ? ' | failed: ' + bad.join(',') : '')); } catch (e) {}
    try { var lg = JSON.parse(localStorage.getItem('TTX_RESTORE_LOG') || '[]'); lg.unshift({ at: new Date().toISOString(), by: me(), file: RS.name, ok: ok, failed: bad, mode: RS.mode }); localStorage.setItem('TTX_RESTORE_LOG', JSON.stringify(lg.slice(0, 20))); } catch (e) {}
    var h = '<div class="ttx-note ' + (bad.length ? 'warn' : 'ok') + '">' + (bad.length ? '⚠ Restore finished with problems.' : '✅ Restore finished — every selected list was confirmed by the cloud.') + '</div><table class="ttx-tb"><tr><th>List</th><th>Result</th></tr>' + RS.keys.map(function (k) { var r = RS.res[k] || {}; return '<tr><td>' + H(RS.R.sets[k].label) + '</td><td class="' + (r.ok ? 'ok' : 'bad') + '">' + (r.ok ? '✓ +' + r.add + (r.chg ? ' / ' + r.chg + ' replaced' : '') : '✗ ' + H(r.err || 'failed')) + '</td></tr>'; }).join('') + '</table>';
    if (bad.length) h += '<div class="ttx-note">Failed lists are already applied on this phone. “Retry” re-sends exactly the same data (safe to repeat, nothing is added twice).</div><div class="ttx-btns"><button class="ttx-b pri" data-a="rsRetry">🔄 Retry failed lists</button></div>';
    h += '<div class="ttx-btns"><button class="ttx-b dng" data-a="rsUndo">↩ Undo this restore (this session only)</button></div><div class="ttx-note">The safety copy file in your Downloads can also be restored later through this same screen (choose “replace changed records”).</div>';
    X.sheet('ttxRS', 'Restore result', h, { z: 3700 }); try { if (typeof renderOrders === 'function') renderOrders(); if (typeof renderLeads === 'function') renderLeads(); } catch (e) {}
  }
  function retryFailed() { var bad = RS.keys.filter(function (k) { return !(RS.res[k] && RS.res[k].ok); }), p = Promise.resolve(); bad.forEach(function (k) { p = p.then(function () { return X.cloudConfirm(k, cur(k)).then(function () { RS.res[k].ok = true; RS.res[k].err = ''; }, function (e) { RS.res[k].err = 'Cloud did not confirm: ' + (e.message || e); }); }); }); p.then(finishRestore); }
  function undoRestore() {
    if (!RS || !RS.snap) return; if (!confirm('Undo this restore?\n\nChanged records go back to what they were. Records that this restore ADDED will be removed again.')) return;
    var p = Promise.resolve(); RS.keys.forEach(function (k) {
      p = p.then(function () { var def = SETS.find(function (s) { return s[0] === k; }), snap = RS.snap[k]; def[3](snap); if (k.match(/^(TASKS|SUPPLIERS|PURCHASES|PURCHASE_BILLS|ATTENDANCE|LEAVES|EVENTS|NOTICES|CLOSINGS)$/)) X.save(k, snap); else setStored(k, snap);
        (RS.added[k] || []).forEach(function (id) { try { if (window.cloudSync && window.cloudSync.deleteItem) window.cloudSync.deleteItem(k, id); } catch (e) {} });
        return X.cloudConfirm(k, snap).then(function () { return true; }, function () { return false; }); });
    });
    p.then(function () { X.toast('Restore undone on this phone. Confirm everything in Sync Recovery if you were offline.'); X.close('ttxRS'); try { renderOrders(); renderLeads(); } catch (e) {} });
  }

  /* ----- integrity check (read only) ----- */
  function runIntegrity() {
    var out = [], O = cur('ORDERS') || [], C = cur('CUSTOMERS') || [], L = cur('LEADS') || [], inv = cur('INVENTORY') || [];
    function dup(arr, label) { var s = {}, d = 0; arr.forEach(function (r) { if (r && r.id != null) { if (s[r.id]) d++; s[r.id] = 1; } }); if (d) out.push(['bad', label + ': ' + d + ' duplicate id(s)']); }
    dup(O, 'Orders'); dup(C, 'Customers'); dup(L, 'Leads'); dup(inv, 'Stock');
    var badAmt = O.filter(function (o) { return o && o.status !== 'Cancelled' && (!isFinite(Number(o.totalAmount)) || Math.abs(Number(o.totalAmount || 0) - Number(o.recvAmount || 0) - Number(o.dueAmount || 0)) > 1); }); if (badAmt.length) out.push(['warn', 'Orders where total ≠ received + due: ' + badAmt.length + ' (' + badAmt.slice(0, 5).map(function (o) { return o.id; }).join(', ') + ')']);
    var negStock = inv.filter(function (i) { return Number(i.stock) < 0; }); if (negStock.length) out.push(['warn', 'Stock items with negative quantity: ' + negStock.length]);
    var pays = 0; O.forEach(function (o) { if (o && Array.isArray(o.payments)) { var s = o.payments.reduce(function (a, p) { return a + (Number(p.amount) || 0); }, 0); if (s - Number(o.recvAmount || 0) > 1) { pays++; } } }); if (pays) out.push(['bad', 'Orders whose payment entries add up to more than the amount received: ' + pays]);
    var po = cur('PURCHASES') || [], sp = {}; (cur('SUPPLIERS') || []).forEach(function (s) { sp[s.id] = 1; }); var orphan = po.filter(function (p) { return p && !sp[p.supplierId]; }); if (orphan.length) out.push(['warn', 'Purchase orders pointing to a missing supplier: ' + orphan.length]);
    var pend = 0; po.forEach(function (p) { (p.receipts || []).forEach(function (r) { if (r.stockApplied === false) pend++; }); }); if (pend) out.push(['warn', 'Goods receipts waiting for a stock update: ' + pend]);
    var q = {}; try { q = JSON.parse(localStorage.getItem('TTESPL_ERP_OFFLINE_QUEUE') || '{}'); } catch (e) {} if (Object.keys(q).length) out.push(['warn', 'Changes still waiting to reach the cloud: ' + Object.keys(q).join(', ')]);
    var el = document.getElementById('ttxBKc'); if (el) el.innerHTML = out.length ? out.map(function (x) { return '<div class="ttx-note ' + x[0] + '">' + H(x[1]) + '</div>'; }).join('') + '<div class="ttx-note">The check only reads data. It changes nothing.</div>' : '<div class="ttx-note ok">✅ No problems found in orders, customers, leads, stock, purchases or the sync queue.</div>';
  }
  window.ttxBackupValidate = validate; window.ttxBackupDiff = function (S) { return diffSet(S); };

  /* ================= DUPLICATE REVIEW ================= */
  var DUP = { tab: 'customers' };
  function dismissed() { var d = X.byId('OFFICE_CFG', 'dupdismiss'); return (d && d.keys) || []; }
  function gkey(type, ids) { return type + ':' + ids.map(String).sort().join('|'); }
  function groupBy(arr, fn) { var m = {}; arr.forEach(function (r) { var k = fn(r); if (k) (m[k] = m[k] || []).push(r); }); return Object.keys(m).filter(function (k) { return m[k].length > 1; }).map(function (k) { return { key: k, recs: m[k] }; }); }
  function scan() {
    var dis = {}; dismissed().forEach(function (k) { dis[k] = 1; });
    var out = { customers: [], leads: [], stock: [], payments: [] }, seen = {};
    function push(t, reason, recs) { var k = gkey(t, recs.map(function (r) { return r.id; })); if (seen[k] || dis[k]) return; seen[k] = 1; out[t === 'cust' ? 'customers' : t === 'lead' ? 'leads' : t === 'stock' ? 'stock' : 'payments'].push({ key: k, reason: reason, recs: recs }); }
    var C = cur('CUSTOMERS') || []; groupBy(C, function (c) { var p = X.last10(c.phone); return p.length === 10 ? p : ''; }).forEach(function (g) { push('cust', ['Same phone number'], g.recs); });
    groupBy(C, function (c) { var g = String(c.gst || '').trim().toUpperCase(); return g && g !== 'UNREGISTERED' && g.length >= 10 ? g : ''; }).forEach(function (g) { push('cust', ['Same GSTIN'], g.recs); });
    groupBy(C, function (c) { var e = String(c.email || '').trim().toLowerCase(); return e; }).forEach(function (g) { push('cust', ['Same email'], g.recs); });
    var L = (cur('LEADS') || []).filter(function (l) { return l && l.status !== 'Installed'; });
    function lph(l) { var p = X.last10(l.phone); if (p.length === 10) return p; var c = (C || []).find(function (x) { return X.norm(x.name) === X.norm(l.customerName); }); return c ? X.last10(c.phone) : ''; }
    groupBy(L, function (l) { var p = lph(l); return p.length === 10 ? p + '|' + X.norm(l.machine) : ''; }).forEach(function (g) { push('lead', ['Same contact and same machine, both still open'], g.recs); });
    var I = cur('INVENTORY') || []; groupBy(I, function (i) { return X.norm(i.code) ? 'c:' + X.norm(i.code) : ''; }).forEach(function (g) { push('stock', ['Same item code'], g.recs); });
    groupBy(I, function (i) { return X.norm(i.name) ? 'n:' + X.norm(i.name) + '|' + X.norm(i.machine) : ''; }).forEach(function (g) { push('stock', ['Same name and machine'], g.recs); });
    (cur('ORDERS') || []).forEach(function (o) { if (!o || o.status === 'Cancelled' || !Array.isArray(o.payments)) return; groupBy(o.payments.map(function (p, i) { return Object.assign({ id: o.id + '#' + i }, p); }), function (p) { return p.amount > 0 ? [p.amount, p.mode, p.at].join('|') : ''; }).forEach(function (g) { push('pay', ['Same amount, mode and minute on ' + o.id + ' (possible double tap)'], g.recs.map(function (r) { return Object.assign({}, r, { _order: o.id }); })); }); });
    return out;
  }
  function dupCount() { try { var s = scan(); return s.customers.length + s.leads.length + s.stock.length + s.payments.length; } catch (e) { return 0; } }
  var FIELDS = { cust: [['name', 'Name'], ['phone', 'Phone'], ['address', 'Address'], ['gst', 'GSTIN']], lead: [['customerName', 'Customer'], ['phone', 'Phone'], ['machine', 'Machine'], ['quotedPrice', 'Quoted'], ['handledBy', 'Handled by'], ['inquiryDate', 'Inquiry'], ['followupDate', 'Follow-up'], ['remarks', 'Remarks']], stock: [['name', 'Name'], ['code', 'Code'], ['machine', 'Machine'], ['stock', 'Stock'], ['rate', 'Rate'], ['hsn', 'HSN']], pay: [['amount', 'Amount'], ['mode', 'Mode'], ['at', 'Time'], ['by', 'By'], ['_order', 'Order']] };
  var GROUPS = [];
  function dupHtml() {
    var s = scan(); GROUPS = s[DUP.tab === 'stock' ? 'stock' : DUP.tab] || [];
    var tabs = [['customers', 'Customers'], ['leads', 'Leads'], ['stock', 'Stock'], ['payments', 'Payments']];
    var h = '<div class="ttx-tabs">' + tabs.map(function (t) { return '<button class="' + (DUP.tab === t[0] ? 'on' : '') + '" data-a="dpTab" data-p="' + t[0] + '">' + t[1] + (s[t[0]].length ? ' <i>' + s[t[0]].length + '</i>' : '') + '</button>'; }).join('') + '</div>';
    h += '<div class="ttx-btns"><button class="ttx-b" data-a="dpLog">📜 Merge log</button></div>';
    h += '<div class="ttx-note">Matches are suggestions only. Nothing is merged or deleted automatically. A similar name or an identical amount alone is never treated as proof.</div>';
    if (!GROUPS.length) return h + X.empty('✅', 'No unresolved matches');
    var type = DUP.tab === 'customers' ? 'cust' : DUP.tab === 'leads' ? 'lead' : DUP.tab === 'stock' ? 'stock' : 'pay';
    return h + GROUPS.slice(0, 40).map(function (g, gi) {
      var f = FIELDS[type];
      return '<div class="ttx-card"><div class="ttx-ct"><div><b>' + g.recs.length + ' records</b><small>' + H(g.reason.join(' · ')) + '</small></div></div><div class="ttx-cmp"><table class="ttx-tb"><tr><th></th>' + g.recs.map(function (r, i) { return '<th>' + String.fromCharCode(65 + i) + '</th>'; }).join('') + '</tr>' + f.map(function (fl) { var vals = g.recs.map(function (r) { return r[fl[0]] == null ? '' : String(r[fl[0]]); }), diff = vals.some(function (v) { return v !== vals[0]; }); return '<tr class="' + (diff ? 'dif' : '') + '"><td>' + fl[1] + '</td>' + vals.map(function (v) { return '<td>' + H(v.slice(0, 60)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>' +
        '<div class="ttx-btns">' + (type === 'cust' ? '<button class="ttx-b" data-a="dpOpen" data-p="c|' + H(g.recs[0].id) + '">Open A</button><button class="ttx-b" data-a="dpOpen" data-p="c|' + H(g.recs[1].id) + '">Open B</button>' : '') + (type === 'lead' ? '<button class="ttx-b" data-a="dpOpen" data-p="l|' + H(g.recs[0].id) + '">Open A</button><button class="ttx-b" data-a="dpOpen" data-p="l|' + H(g.recs[1].id) + '">Open B</button>' + (isAdm() ? '<button class="ttx-b pri" data-a="dpMerge" data-p="' + gi + '">Merge…</button>' : '') : '') + '' + ((type === 'stock' || type === 'cust') && isAdm() ? '<button class="ttx-b pri" data-a="dpMerge" data-p="' + gi + '">Merge…</button>' : '') + '<button class="ttx-b" data-a="dpNo" data-p="' + gi + '">Not a duplicate</button></div>' +
        (type === 'cust' ? '<div class="ttx-note">Use Merge… to combine these into one customer. Old invoices keep the name they were billed with.</div>' : '') + (type === 'pay' ? '<div class="ttx-note">Payments are financial history and are never changed here. If one is truly doubled, correct it from the order’s Edit Ledger screen.</div>' : '') + (type === 'stock' ? '<div class="ttx-note">Use Merge… to combine duplicate stock rows. You choose the surviving values and the quantity.</div>' : '') + '</div>';
    }).join('') + (GROUPS.length > 40 ? '<div class="ttx-note">Showing 40 of ' + GROUPS.length + '.</div>' : '');
  }
  function dupOpen(tab) {
    if (!on('mDup')) return; if (!isAdm()) return X.toast('Duplicate review is for Admin', 1); if (tab) DUP.tab = tab;
    X.sheet('ttxDP', '🧬 Duplicate review', dupHtml());
    X.bind('ttxDP', { click: {
      dpTab: function (p) { DUP.tab = p; X.body('ttxDP', dupHtml(), true); },
      dpOpen: function (p) { var a = p.split('|'); X.close('ttxDP'); try { if (a[0] === 'c') editCustomerPrompt(a[1]); else editLeadPrompt(a[1]); } catch (e) { } },
      dpNo: function (p) { var g = GROUPS[Number(p)]; if (!g) return; var d = X.byId('OFFICE_CFG', 'dupdismiss') || { id: 'dupdismiss', keys: [] }; d = JSON.parse(JSON.stringify(d)); if (d.keys.indexOf(g.key) < 0) d.keys.push(g.key); d.log = (d.log || []).concat([{ key: g.key, by: me(), at: new Date().toISOString() }]).slice(-100); X.saveConfirmed('OFFICE_CFG', X.list('OFFICE_CFG').filter(function (x) { return x.id !== 'dupdismiss'; }).concat([d]), 'Marked as not a duplicate'); X.body('ttxDP', dupHtml(), true); },
      dpMerge: function (p) { var g = GROUPS[Number(p)]; if (DUP.tab === 'leads') mergeForm(g); else mergeData(g, DUP.tab === 'stock' ? 'stock' : 'cust'); },
      dpLog: function () { if (DUP.tab === 'leads') window.ttOpenMergeLog(); else window.ttOpenDataMergeLog(); }
    } });
  }
  window.ttOpenDuplicates = dupOpen; window.ttxScanDuplicates = scan;
  X.hubTiles.push({ mod: 'mDup', admin: true, icon: '🧬', label: 'Duplicate review', sub: function () { var n = dupCount(); return n ? n + ' to review' : 'No matches'; }, fn: function () { dupOpen(); } });

  /* ----- safe lead merge (leads only: no invoices hang off a lead) ----- */
  function mergeForm(g) {
    if (!g || !isAdm()) return; var a = g.recs[0], b = g.recs[1];
    var blocked = g.recs.some(function (r) { return r.status === 'Installed'; }) ? 'One of these leads is already installed (it owns an installation report), so it is not merged.' : (g.recs.length > 2 ? 'Merge two leads at a time. Mark the extra ones as “not a duplicate” or merge in pairs.' : '');
    var mid = 'MRG-' + [a.id, b.id].sort().join('+'); if ((X.byId('OFFICE_CFG', 'mergelog') || { items: [] }).items.some(function (m) { return m.id === mid && !m.undone; })) blocked = 'These two leads were already merged.';
    var fl = FIELDS.lead.filter(function (f) { return f[0] !== 'remarks'; });
    var h = '<div class="ttx-note">Pick which record survives. Conflicting values can be chosen field by field. The removed lead is stored in the merge log so it can be restored.</div>' + (blocked ? '<div class="ttx-note bad">' + H(blocked) + '</div>' : '') +
      '<div class="ttx-two"><label class="ttx-chk"><input type="radio" name="mgp" value="0" checked> Keep A (' + H(a.customerName) + ')</label><label class="ttx-chk"><input type="radio" name="mgp" value="1"> Keep B (' + H(b.customerName) + ')</label></div>' +
      '<table class="ttx-tb"><tr><th>Field</th><th>A</th><th>B</th><th>Use</th></tr>' + fl.map(function (f) { var va = a[f[0]] == null ? '' : a[f[0]], vb = b[f[0]] == null ? '' : b[f[0]], dif = String(va) !== String(vb); return '<tr class="' + (dif ? 'dif' : '') + '"><td>' + f[1] + '</td><td>' + H(String(va).slice(0, 40)) + '</td><td>' + H(String(vb).slice(0, 40)) + '</td><td>' + (dif ? '<select data-f="' + f[0] + '"><option value="p">Kept lead</option><option value="o">Other lead</option></select>' : '—') + '</td></tr>'; }).join('') + '</table>' +
      '<div class="ttx-note">Remarks of both leads are kept together. Tasks linked to the removed lead are moved to the kept lead.</div>' + X.field('Reason for merging (required)', '<input id="ttxMGr" maxlength="160">') + '<div class="ttx-btns"><button class="ttx-b pri" data-a="mgGo"' + (blocked ? ' disabled' : '') + '>Merge these leads</button></div>';
    X.sheet('ttxMG', 'Merge leads', h, { z: 3700 });
    X.bind('ttxMG', { click: { mgGo: function () {
      if (lock('52')) return; var why = (document.getElementById('ttxMGr').value || '').trim(); if (!why) return X.toast('Please write the reason', 1);
      var keepIdx = Number((document.querySelector('#ttxMG input[name=mgp]:checked') || {}).value || 0), P = g.recs[keepIdx], S = g.recs[1 - keepIdx];
      var cur0 = cur('LEADS') || [], Pn = cur0.find(function (x) { return x.id === P.id; }), Sn = cur0.find(function (x) { return x.id === S.id; }); if (!Pn || !Sn) return X.toast('One of the leads no longer exists — refresh and review again', 1);
      if (Pn.status === 'Installed' || Sn.status === 'Installed') return X.toast('Installed leads cannot be merged', 1);
      var log = JSON.parse(JSON.stringify(X.byId('OFFICE_CFG', 'mergelog') || { id: 'mergelog', items: [] })); if (log.items.some(function (m) { return m.id === mid && !m.undone; })) return X.toast('Already merged — nothing changed', 1);
      var merged = JSON.parse(JSON.stringify(Pn)); document.querySelectorAll('#ttxMG select[data-f]').forEach(function (sl) { if (sl.value === 'o') merged[sl.getAttribute('data-f')] = Sn[sl.getAttribute('data-f')]; });
      merged.remarks = [Pn.remarks, Sn.remarks && Sn.remarks !== Pn.remarks ? '[merged from ' + Sn.id + '] ' + Sn.remarks : ''].filter(Boolean).join(' | '); merged.mergedFrom = (Pn.mergedFrom || []).concat([Sn.id]);
      log.items.unshift({ id: mid, at: new Date().toISOString(), by: me(), reason: why, kept: Pn.id, removed: Sn.id, removedSnapshot: JSON.parse(JSON.stringify(Sn)), keptBefore: JSON.parse(JSON.stringify(Pn)), undone: false }); log.items = log.items.slice(0, 100);
      var logArr = X.list('OFFICE_CFG').filter(function (x) { return x.id !== 'mergelog'; }).concat([log]);
      /* 1 audit record first (confirmed), 2 then the lead list, 3 then re-point tasks */
      X.cloudConfirm('OFFICE_CFG', logArr).then(function () {
        X.save('OFFICE_CFG', logArr);
        var next = (cur('LEADS') || []).filter(function (x) { return x.id !== Sn.id; }).map(function (x) { return x.id === Pn.id ? merged : x; }); leadsData = next; setStored('LEADS', next);
        try { if (window.cloudSync && window.cloudSync.deleteItem) window.cloudSync.deleteItem('LEADS', Sn.id); } catch (e) {}
        var tk = X.list('TASKS'), moved = 0; var tk2 = tk.map(function (t) { if (t && t.rel && t.rel.type === 'lead' && t.rel.id === Sn.id) { moved++; var n = JSON.parse(JSON.stringify(t)); n.rel.id = Pn.id; X.hist(n, 'relinked', 'lead merged'); return n; } return t; }); if (moved) X.save('TASKS', tk2);
        return X.cloudConfirm('LEADS', next);
      }).then(function () { X.toast('Leads merged (' + Sn.id + ' → ' + Pn.id + ')'); X.close('ttxMG'); try { renderLeads(); } catch (e) {} X.body('ttxDP', dupHtml(), true); try { if (window.ttActAdd) window.ttActAdd('lead', 'merged', Pn.id, Sn.id + ' · ' + why); } catch (e) {} },
        function (e) { X.toast('Merge not confirmed by the cloud: ' + (e.message || e) + '. The merge log was saved first; check Sync Recovery before retrying.', 1); });
    } } });
  }
  window.ttOpenMergeLog = function () {
    var log = X.byId('OFFICE_CFG', 'mergelog'), items = (log && log.items) || [];
    var h = items.length ? items.map(function (m) { return '<div class="ttx-card"><div class="ttx-ct"><div><b>' + H(m.kept) + ' ← ' + H(m.removed) + '</b><small>' + H(m.by) + ' · ' + X.fmtDT(m.at) + ' · ' + H(m.reason) + '</small></div>' + (m.undone ? X.chip('Undone') : '<button class="ttx-b" data-a="mlUndo" data-p="' + H(m.id) + '">Undo</button>') + '</div></div>'; }).join('') : X.empty('📜', 'No merges yet');
    X.sheet('ttxML', 'Merge log', h, { z: 3700 });
    X.bind('ttxML', { click: { mlUndo: function (p) {
      if (!isAdm()) return; var lg = JSON.parse(JSON.stringify(X.byId('OFFICE_CFG', 'mergelog'))), m = lg.items.find(function (x) { return x.id === p; }); if (!m || m.undone) return;
      if ((cur('LEADS') || []).some(function (x) { return x.id === m.removed; })) return X.toast('That lead id already exists again — nothing restored', 1); if (!confirm('Restore lead ' + m.removed + ' and put ' + m.kept + ' back as it was before the merge?')) return;
      var next = (cur('LEADS') || []).map(function (x) { return x.id === m.kept ? m.keptBefore : x; }).concat([m.removedSnapshot]); leadsData = next; setStored('LEADS', next); m.undone = true; m.undoneBy = me(); m.undoneAt = new Date().toISOString();
      var arr = X.list('OFFICE_CFG').filter(function (x) { return x.id !== 'mergelog'; }).concat([lg]); X.saveConfirmed('OFFICE_CFG', arr, 'Merge undone'); try { renderLeads(); } catch (e) {} window.ttOpenMergeLog();
    } } });
  };

  /* ----- merge for STOCK items and CUSTOMERS (Admin only, logged first, undoable) ----- */
  var DM = {
    stock: { key: 'INVENTORY', noun: 'stock item', fields: [['name', 'Name'], ['code', 'Code'], ['machine', 'Machine'], ['category', 'Category'], ['rate', 'Rate'], ['dealerPrice', 'Dealer price'], ['hsn', 'HSN']], label: function (r) { return (r.name || '?') + (r.code ? ' (' + r.code + ')' : ''); }, set: function (v) { sampleInventory = v; window.sampleInventory = v; } },
    cust: { key: 'CUSTOMERS', noun: 'customer', fields: [['name', 'Name'], ['person', 'Contact person'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'], ['gst', 'GSTIN']], label: function (r) { return r.name || '?'; }, set: function (v) { customerDatabase = v; window.customerDatabase = v; } }
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dmLog() { return clone(X.byId('OFFICE_CFG', 'mergelog_data') || { id: 'mergelog_data', items: [] }); }
  function dmPutLog(log) { return X.list('OFFICE_CFG').filter(function (x) { return x.id !== 'mergelog_data'; }).concat([log]); }
  function mergeData(g, type) {
    var D = DM[type]; if (!g || !D || !isAdm()) return;
    var recs = g.recs, h = '<div class="ttx-note">Pick the record to <b>keep</b>. The others are removed from the list. For every field that differs you choose which value to use. A copy of each removed record is saved in the merge log so you can undo.</div>' +
      '<div class="ttx-two">' + recs.map(function (r, i) { return '<label class="ttx-chk"><input type="radio" name="dmk" value="' + i + '"' + (i === 0 ? ' checked' : '') + '> Keep ' + String.fromCharCode(65 + i) + ' · ' + H(String(D.label(r)).slice(0, 28)) + '</label>'; }).join('') + '</div>' +
      '<table class="ttx-tb"><tr><th>Field</th>' + recs.map(function (r, i) { return '<th>' + String.fromCharCode(65 + i) + '</th>'; }).join('') + '<th>Use</th></tr>' + D.fields.map(function (f) {
        var vals = recs.map(function (r) { return r[f[0]] == null ? '' : String(r[f[0]]); }), dif = vals.some(function (v) { return v !== vals[0]; });
        return '<tr class="' + (dif ? 'dif' : '') + '"><td>' + f[1] + '</td>' + vals.map(function (v) { return '<td>' + H(v.slice(0, 32)) + '</td>'; }).join('') + '<td>' + (dif ? '<select data-f="' + f[0] + '"><option value="k">Kept record</option>' + vals.map(function (v, i) { return '<option value="' + i + '">' + String.fromCharCode(65 + i) + ': ' + H(v.slice(0, 18) || '—') + '</option>'; }).join('') + '</select>' : '—') + '</td></tr>';
      }).join('') + '</table>' +
      (type === 'stock' ? '<div class="ttx-note warn">Quantities in stock: ' + recs.map(function (r, i) { return String.fromCharCode(65 + i) + '=' + (Number(r.stock) || 0); }).join(', ') + '.</div>' + X.field('Stock quantity after merge', '<select id="ttxDMq"><option value="keep">Keep the kept item’s quantity</option><option value="sum">Add all quantities together</option></select>') : '<div class="ttx-note">Old invoices keep the name and details they were billed with. Nothing in the ledger changes. Removed names are saved as aliases on the kept customer.</div>') +
      X.field('Reason for merging (required)', '<input id="ttxDMr" maxlength="160">') + '<div class="ttx-btns"><button class="ttx-b pri" data-a="dmGo">Merge into one</button></div>';
    X.sheet('ttxDM', 'Merge ' + D.noun + 's', h, { z: 3700 });
    X.bind('ttxDM', { click: { dmGo: function () {
      if (lock('53')) return; var why = (document.getElementById('ttxDMr').value || '').trim(); if (!why) return X.toast('Please write the reason', 1);
      var list = cur(D.key) || [], live = recs.map(function (r) { return list.find(function (x) { return String(x.id) === String(r.id); }); });
      if (live.some(function (x) { return !x; })) return X.toast('One of these records no longer exists — refresh and review again', 1);
      var ki = Number((document.querySelector('#ttxDM input[name=dmk]:checked') || {}).value || 0), kept = live[ki], others = live.filter(function (x, i) { return i !== ki; });
      var merged = clone(kept);
      document.querySelectorAll('#ttxDM select[data-f]').forEach(function (sl) { if (sl.value !== 'k') { var src = live[Number(sl.value)]; if (src) merged[sl.getAttribute('data-f')] = src[sl.getAttribute('data-f')]; } });
      if (type === 'stock' && (document.getElementById('ttxDMq') || {}).value === 'sum') merged.stock = live.reduce(function (s, x) { return s + (Number(x.stock) || 0); }, 0);
      if (type === 'cust') { var al = (merged.aliases || []).slice(); others.forEach(function (o) { al.push({ name: o.name, phone: o.phone, gst: o.gst, id: o.id }); }); merged.aliases = al.slice(-20); }
      merged.mergedFrom = (kept.mergedFrom || []).concat(others.map(function (o) { return o.id; }));
      var log = dmLog(), mid = 'MRG-' + type + '-' + Date.now();
      log.items.unshift({ id: mid, type: type, at: new Date().toISOString(), by: me(), reason: why, kept: kept.id, keptBefore: clone(kept), removed: others.map(function (o) { return o.id; }), removedSnapshots: clone(others), undone: false }); log.items = log.items.slice(0, 100);
      var logArr = dmPutLog(log), gone = {}; others.forEach(function (o) { gone[String(o.id)] = 1; });
      /* 1 audit record first (confirmed) 2 then the list 3 then cloud delete of the removed rows */
      X.cloudConfirm('OFFICE_CFG', logArr).then(function () {
        X.save('OFFICE_CFG', logArr);
        var next = (cur(D.key) || []).filter(function (x) { return !gone[String(x.id)]; }).map(function (x) { return String(x.id) === String(kept.id) ? merged : x; });
        D.set(next); setStored(D.key, next);
        try { if (window.cloudSync && window.cloudSync.deleteItem) others.forEach(function (o) { window.cloudSync.deleteItem(D.key, o.id); }); } catch (e) {}
        return X.cloudConfirm(D.key, next);
      }).then(function () { X.toast('Merged ' + others.length + ' duplicate(s) into ' + String(D.label(merged)).slice(0, 30)); X.close('ttxDM'); try { refreshAllData(); } catch (e) {} X.body('ttxDP', dupHtml(), true); try { if (window.ttActAdd) window.ttActAdd(type === 'stock' ? 'stock' : 'customer', 'merged', kept.id, others.map(function (o) { return o.id; }).join(',') + ' · ' + why); } catch (e) {} },
        function (e) { X.toast('Merge not confirmed by the cloud: ' + (e.message || e) + '. The merge log was saved first; check Sync Recovery before retrying.', 1); });
    } } });
  }
  window.ttOpenDataMergeLog = function () {
    var items = (X.byId('OFFICE_CFG', 'mergelog_data') || { items: [] }).items || [];
    var h = items.length ? items.map(function (m) { var D = DM[m.type]; return '<div class="ttx-card"><div class="ttx-ct"><div><b>' + H(D ? D.noun : m.type) + ' · ' + H(m.kept) + ' ← ' + H((m.removed || []).join(', ')) + '</b><small>' + H(m.by) + ' · ' + X.fmtDT(m.at) + ' · ' + H(m.reason) + '</small></div>' + (m.undone ? X.chip('Undone') : '<button class="ttx-b" data-a="dmUndo" data-p="' + H(m.id) + '">Undo</button>') + '</div></div>'; }).join('') : X.empty('📜', 'No merges yet');
    X.sheet('ttxDL', 'Merge log (stock & customers)', h, { z: 3700 });
    X.bind('ttxDL', { click: { dmUndo: function (p) {
      if (!isAdm() || lock('54')) return; var lg = dmLog(), m = lg.items.find(function (x) { return x.id === p; }); if (!m || m.undone) return; var D = DM[m.type]; if (!D) return;
      var list = cur(D.key) || [];
      if (m.removed.some(function (id) { return list.some(function (x) { return String(x.id) === String(id); }); })) return X.toast('One of the removed ids exists again — nothing restored', 1);
      if (!list.some(function (x) { return String(x.id) === String(m.kept); })) return X.toast('The kept record no longer exists — nothing restored', 1);
      if (!confirm('Restore the removed ' + D.noun + '(s) and put the kept one back as it was before the merge?')) return;
      var next = list.map(function (x) { return String(x.id) === String(m.kept) ? m.keptBefore : x; }).concat(m.removedSnapshots); D.set(next); setStored(D.key, next);
      m.undone = true; m.undoneBy = me(); m.undoneAt = new Date().toISOString();
      X.saveConfirmed('OFFICE_CFG', dmPutLog(lg), 'Merge undone'); X.cloudConfirm(D.key, next).catch(function () {}); try { refreshAllData(); } catch (e) {} window.ttOpenDataMergeLog();
    } } });
  };

  /* ----- Sync master catalog -> live cloud (Admin). ADD MISSING ONLY: never overwrites stock, prices or edits ----- */
  function nk(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  window.ttSyncMasterToCloud = function () {
    if (!isAdm()) return X.toast('Only Admin can sync the master catalog', 1);
    var M = window.TTESPL_MASTER_DATA; if (!M || !Array.isArray(M.inventory)) return X.toast('Master catalog file not found', 1);
    if (navigator.onLine === false) return X.toast('You are offline - connect to the internet first', 1);
    if (lock('55')) return;
    var inv = (cur('INVENTORY') || []).slice(), cu = (cur('CUSTOMERS') || []).slice();
    var have = {}; inv.forEach(function (x) { have[nk(x.code) + '|' + nk(x.name)] = 1; });
    var ids = {}, maxId = 0; inv.forEach(function (x) { ids[String(x.id)] = 1; if (typeof x.id === 'number' && x.id > maxId) maxId = x.id; });
    var addInv = (M.inventory || []).filter(function (x) { return x && x.name && !have[nk(x.code) + '|' + nk(x.name)]; });
    var phones = {}, names = {}, cids = {}; cu.forEach(function (c) { var p = String(c.phone || '').replace(/\D/g, ''); if (p) phones[p] = 1; names[nk(c.name)] = 1; cids[String(c.id)] = 1; });
    var addCu = (M.customers || []).filter(function (c) { var p = String(c.phone || '').replace(/\D/g, ''); return c && c.name && !(p && phones[p]) && !names[nk(c.name)]; });
    var grp = {}; inv.forEach(function (x) { var k = nk(x.code) + '|' + nk(x.name) + '|' + nk(x.machine); grp[k] = (grp[k] || 0) + 1; });
    var dupG = Object.keys(grp).filter(function (k) { return grp[k] > 1; }).length;
    var msg = 'LIVE CLOUD now: ' + inv.length + ' items, ' + cu.length + ' customers.\nMASTER file: ' + M.inventory.length + ' items, ' + (M.customers || []).length + ' customers.\n\nWill be ADDED: ' + addInv.length + ' items, ' + addCu.length + ' customers.\nNothing existing is changed or deleted (stock, prices, edits stay as they are).' + (dupG ? '\n\nNote: ' + dupG + ' duplicate item group(s) exist in live data - use Duplicate review to merge them.' : '') + '\n\nContinue?';
    if (!addInv.length && !addCu.length) { alert('Live cloud already has everything from the master catalog. Nothing to add.' + (dupG ? '\n\n' + dupG + ' duplicate item group(s) exist - use Duplicate review to merge them.' : '')); return; }
    if (!confirm(msg)) return;
    addInv = addInv.map(function (x) { var n = Object.assign({}, x); if (n.id == null || ids[String(n.id)]) { n.id = ++maxId; while (ids[String(n.id)]) n.id = ++maxId; } ids[String(n.id)] = 1; return n; });
    addCu = addCu.map(function (c, k) { var n = Object.assign({}, c); if (n.id == null || cids[String(n.id)]) n.id = 'MC' + Date.now() + '_' + k; cids[String(n.id)] = 1; return n; });
    var nextInv = inv.concat(addInv), nextCu = cu.concat(addCu);
    sampleInventory = nextInv; window.sampleInventory = nextInv; setStored('INVENTORY', nextInv);
    customerDatabase = nextCu; window.customerDatabase = nextCu; setStored('CUSTOMERS', nextCu);
    Promise.all([X.cloudConfirm('INVENTORY', nextInv), X.cloudConfirm('CUSTOMERS', nextCu)]).then(function () {
      X.toast('Cloud updated: +' + addInv.length + ' items, +' + addCu.length + ' customers');
      try { refreshAllData(); } catch (e) {} try { if (window.ttActAdd) window.ttActAdd('master', 'synced', 'master', '+' + addInv.length + ' items, +' + addCu.length + ' customers'); } catch (e) {}
    }, function (e) { X.toast('Saved on this device, but the cloud did not confirm: ' + (e && e.message ? e.message : e) + '. Check the Live Cloud pill and retry.', 1); });
  };

  /* ----- warn at entry time (extends, never blocks) ----- */
  function entryWarn() {
    if (!on('mDup')) return;
    var ph = document.getElementById('cPhone');
    if (ph && !ph.__ttx) { ph.__ttx = 1; var note = document.createElement('div'); note.className = 'ttx-inl-warn'; note.style.display = 'none'; ph.parentNode.appendChild(note);
      ph.addEventListener('input', function () { var p = X.last10(ph.value), eid = (document.getElementById('editCustId') || {}).value || ''; if (p.length < 10 || !on('mDup')) { note.style.display = 'none'; return; } var hit = (cur('CUSTOMERS') || []).find(function (c) { return X.last10(c.phone) === p && String(c.id) !== String(eid); }); if (hit) { note.innerHTML = '⚠ This number is already saved for <b>' + H(hit.name) + '</b>. Repeat customers are fine — but check you are not adding the same person twice.'; note.style.display = ''; } else note.style.display = 'none'; }); }
    var mc = document.getElementById('leadMachine');
    if (mc && !mc.__ttx) { mc.__ttx = 1; var n2 = document.createElement('div'); n2.className = 'ttx-inl-warn'; n2.style.display = 'none'; mc.parentNode.appendChild(n2);
      var chk = function () { var nm = X.norm((document.getElementById('leadCustSearchInput') || {}).value || '').replace(/\(.*$/, '').trim(), m = X.norm(mc.value), eid = (document.getElementById('editLeadId') || {}).value || ''; if (!nm || !m || !on('mDup')) { n2.style.display = 'none'; return; } var hit = (cur('LEADS') || []).find(function (l) { return l.status !== 'Installed' && l.id !== eid && X.norm(l.customerName) === nm && X.norm(l.machine) === m; }); if (hit) { n2.innerHTML = '⚠ An open lead for this customer and machine already exists (' + H(hit.id) + ', follow-up ' + H(hit.followupDate || '-') + '). Continue only if this is a separate enquiry.'; n2.style.display = ''; } else n2.style.display = 'none'; };
      mc.addEventListener('input', chk); mc.addEventListener('change', chk); mc.addEventListener('blur', chk); }
  }
  setInterval(entryWarn, 2500); setTimeout(entryWarn, 1500);
})();
