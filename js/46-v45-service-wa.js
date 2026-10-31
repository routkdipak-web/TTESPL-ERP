/* TTESPL ERP v45.3 - SERVICE CUSTOMER MESSAGES + PDF (like the order ledger)
   1. "Your service request is raised"  -> engineer name + mobile + visit date
   2. "Visit report"                    -> problem found, products / parts estimate, visit charge, estimate total
   3. "Service completed"               -> everything installed / used, service charge, total, received, balance
   Each one can be sent as a WhatsApp text or as a PDF (Visit Report / Service Bill) - same sharing sheet as invoices.
   Nothing is sent by itself: the message opens in WhatsApp and can be edited first. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var H = X.H, ID = 'ttSvWA', EID = 'ttSvEd', S = { id: '', type: 'raised' }, ED = null;
  var SIGN = 'Thank you!\n*TTESPL, Bhubaneswar*';
  function $(i) { return document.getElementById(i); }
  function N(x) { var v = parseFloat(x); return isNaN(v) ? 0 : v; }
  function R2(x) { return Math.round((N(x) + Number.EPSILON) * 100) / 100; }
  function rs(n) { return '₹' + N(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function svcs() { return (typeof serviceCallsData !== 'undefined' && serviceCallsData) || []; }
  function svc(id) { return svcs().filter(function (s) { return String(s.id) === String(id); })[0]; }
  function p10(v) { return String(v || '').replace(/\D/g, '').slice(-10); }
  function dmy(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : (s || ''); }
  function eng(s) {
    var e = ((typeof registeredEmployees !== 'undefined' && registeredEmployees) || []).filter(function (x) { return x.name === s.attendedBy; })[0];
    return { name: s.attendedBy || 'Our service engineer', mob: p10(e && e.mobile) };
  }
  function cc() { return window.companyDetailsData || {}; }

  /* ---------- data helpers ---------- */
  function lines(a) { return (a || []).filter(function (r) { return r && String(r.n || '').trim(); }); }
  function tot(b) {
    b = b || {}; var it = lines(b.items), sub = 0; it.forEach(function (r) { sub += R2(N(r.q || 1) * N(r.r)); });
    var ch = N(b.charge), tr = N(b.transport), ds = N(b.disc), total = Math.max(0, R2(sub + ch + tr - ds));
    return { sub: R2(sub), charge: ch, transport: tr, disc: ds, total: total, recv: N(b.recv), due: Math.max(0, R2(total - N(b.recv))) };
  }
  function hasAmt(b) { return !!b && (lines(b.items).length || N(b.charge) || N(b.transport)); }
  function itemRows(b, withAmt) {
    return lines(b.items).map(function (r, i) {
      var q = N(r.q || 1), amt = R2(q * N(r.r));
      return (i + 1) + '. ' + r.n + ' × ' + q + (withAmt && amt ? ' – ' + rs(amt) : '');
    }).join('\n');
  }
  function costBlock(b, label) {
    var t = tot(b), o = '';
    if (lines(b.items).length) o += '*' + label + ':*\n' + itemRows(b, true) + '\n';
    if (t.charge) o += '*Service / Labour charge:* ' + rs(t.charge) + '\n';
    if (t.transport) o += '*Transport:* ' + rs(t.transport) + '\n';
    if (t.disc) o += '*Discount:* − ' + rs(t.disc) + '\n';
    return { text: o, t: t };
  }

  /* ---------- message text ---------- */
  function build(s, type) {
    var hi = 'Dear ' + (s.customerName || 'Customer') + ',\n\n', e = eng(s), est = s.est || {}, bill = s.bill || {};
    var head = '*Request ID:* ' + s.id + (s.machine ? '\n*Machine:* ' + s.machine : '');
    if (type === 'raised') {
      return hi + '✅ *Your service request has been raised!*\n\n' + head + (s.problem ? '\n*Issue reported:* ' + s.problem : '') + '\n*Request date:* ' + dmy(s.recvDate) +
        '\n\n👨‍🔧 Our service engineer *' + e.name + '*' + (e.mob ? ' (Mob: +91 ' + e.mob + ')' : '') + ' will visit you on *' + dmy(s.targetDate) + '*.' +
        '\n\nPlease keep the machine ready. For any help, call or WhatsApp us.\n\n' + SIGN;
    }
    if (type === 'visit') {
      var c = costBlock(est, 'Products / parts required (estimate)'), tt = c.t, vis = N(est.visit);
      return hi + '🔧 *Service visit report*\n\n' + head + '\n*Visited by:* ' + e.name + (e.mob ? ' (+91 ' + e.mob + ')' : '') + '\n*Visit date:* ' + dmy(est.date || s.targetDate) +
        '\n\n*Problem found:* ' + (est.problem || (s.report && s.report.cause) || s.problem || '-') + (est.advice ? '\n*Work advised:* ' + est.advice : '') + '\n\n' +
        (hasAmt(est) ? c.text + '*Estimated total:* ' + rs(tt.total) + '\n\nPlease confirm to proceed with the work.' : 'We will share the estimate shortly.') + '\n\n' + SIGN;
    }
    /* done */
    var c2 = costBlock(bill, 'Products / parts installed'), t2 = c2.t, used = (!lines(bill.items).length && s.partUsed) ? '*Part used:* ' + s.partUsed + ' × ' + (s.partQty || 1) + '\n' : '';
    return hi + '✅ *Your service is completed!*\n\n' + head + '\n*Serviced by:* ' + e.name + '\n*Completed on:* ' + dmy(bill.date || (s.report && s.report.date) || s.targetDate) +
      '\n\n*Work done:* ' + (s.actionDone || (s.report && s.report.actionTaken) || '-') + '\n' + used + (hasAmt(bill) ? '\n' + c2.text + '─────────────\n*Total amount:* ' + rs(t2.total) + '\n' +
        (t2.recv > 0 ? '💵 *Received:* ' + rs(t2.recv) + (bill.mode ? ' (' + bill.mode + ')' : '') + '\n' : '') + (t2.due > 0.009 ? '⏳ *Pending:* ' + rs(t2.due) : '✅ *Balance:* Nil – fully paid') + '\n' : '') +
      (bill.warranty ? '\n🛡️ *Warranty / note:* ' + bill.warranty + '\n' : '') + '\nThank you for choosing us. We are always at your service.\n\n' + SIGN;
  }

  /* ---------- PDF (Visit Report / Service Bill) ---------- */
  function pdfHtml(s, kind) {
    var d = cc(), e = eng(s), est = s.est || {}, bill = s.bill || {}, b = kind === 'bill' ? bill : est, t = tot(b), title = kind === 'bill' ? 'SERVICE BILL / JOB COMPLETION' : 'SERVICE VISIT REPORT & ESTIMATE';
    var rows = lines(b.items).map(function (r, i) { var q = N(r.q || 1); return '<tr><td>' + (i + 1) + '</td><td>' + H(r.n) + '</td><td style="text-align:right">' + q + '</td><td style="text-align:right">' + rs(r.r) + '</td><td style="text-align:right">' + rs(q * N(r.r)) + '</td></tr>'; }).join('');
    if (t.charge) rows += '<tr><td></td><td colspan="3">Service / Labour charge</td><td style="text-align:right">' + rs(t.charge) + '</td></tr>';
    if (t.transport) rows += '<tr><td></td><td colspan="3">Transport</td><td style="text-align:right">' + rs(t.transport) + '</td></tr>';
    if (t.disc) rows += '<tr><td></td><td colspan="3">Discount</td><td style="text-align:right">− ' + rs(t.disc) + '</td></tr>';
    var prob = kind === 'bill' ? (s.actionDone || (s.report && s.report.actionTaken) || '') : (est.problem || (s.report && s.report.cause) || s.problem || '');
    return '<div class="tt-sheet" style="width:210mm;padding:12mm;box-sizing:border-box;background:#fff;font-family:Arial,sans-serif;color:#000;font-size:13px;">' +
      '<div style="border:1px solid #000;padding:16px;"><div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;"><b style="font-size:18px;">TWINTOWN EXPRESS SERVICES PVT LTD</b><br>' + H(d.address || '') + '<br>GSTIN: ' + H(d.gstin || '') + ' · ' + H(d.contact || '') + '</div>' +
      '<h2 style="text-align:center;margin:12px 0;">' + title + '</h2>' +
      '<table style="width:100%;font-size:13px;line-height:1.7"><tr><td><b>Request ID:</b> ' + H(s.id) + '</td><td style="text-align:right"><b>Date:</b> ' + dmy(kind === 'bill' ? (bill.date || (s.report && s.report.date) || s.targetDate) : (est.date || s.targetDate)) + '</td></tr>' +
      '<tr><td colspan="2"><b>Customer:</b> ' + H(s.customerName || '') + (s.phone ? ' (' + H(s.phone) + ')' : '') + '</td></tr>' +
      '<tr><td colspan="2"><b>Machine:</b> ' + H(s.machine || '-') + '</td></tr>' +
      '<tr><td colspan="2"><b>Service engineer:</b> ' + H(e.name) + (e.mob ? ' (+91 ' + e.mob + ')' : '') + '</td></tr>' +
      '<tr><td colspan="2"><b>' + (kind === 'bill' ? 'Work done' : 'Problem found') + ':</b> ' + H(prob || '-') + '</td></tr>' +
      (kind !== 'bill' && est.advice ? '<tr><td colspan="2"><b>Work advised:</b> ' + H(est.advice) + '</td></tr>' : '') + '</table>' +
      '<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px" border="1" cellpadding="6"><tr style="background:#f1f5f9"><th>#</th><th style="text-align:left">Product / Part / Service</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>' + (rows || '<tr><td colspan="5" style="text-align:center;color:#666">—</td></tr>') + '</table>' +
      '<div style="margin:14px 0;padding:12px;border:1px solid #000;font-size:17px;text-align:right"><b>' + (kind === 'bill' ? 'Total amount' : 'Estimated total') + ': ' + rs(t.total) + '</b>' + (window.ttWords ? '<br><small style="font-size:11px;font-weight:400">' + H(ttWords(t.total)) + '</small>' : '') + '</div>' +
      (kind === 'bill' ? '<div style="font-size:13px;line-height:1.8">Received ' + rs(t.recv) + ' · ' + (t.due > 0.009 ? '<b>Balance due ' + rs(t.due) + '</b>' : '<b>Fully paid</b>') + '</div>' + (bill.warranty ? '<div style="margin-top:6px"><b>Warranty / note:</b> ' + H(bill.warranty) + '</div>' : '') : '<div style="font-size:12px;color:#444">This is an estimate. Final amount may change as per actual work. Please confirm to proceed.</div>') +
      '<div style="display:flex;justify-content:flex-end;margin-top:40px;text-align:right">for TWINTOWN EXPRESS SERVICES PVT LTD<br><br>Authorised Signatory</div>' +
      '<div style="margin-top:14px;font-size:10.5px;color:#555;text-align:center">App-generated service document. For the original GST invoice please contact the Authorized person.</div></div></div>';
  }
  function sharePdf(s, kind) {
    if (typeof window.ttShareDoc !== 'function') return X.toast('PDF share not available');
    var t = tot(kind === 'bill' ? s.bill : s.est), nm = kind === 'bill' ? 'Service_Bill_' : 'Visit_Report_';
    ttShareDoc({
      title: (kind === 'bill' ? 'Service Bill ' : 'Visit Report ') + s.id, fileName: 'TTESPL_' + nm + String(s.id).replace(/[^\w-]+/g, '_') + '.pdf', phone: s.phone,
      msg: 'Hello ' + (s.customerName || '') + ',\nPlease find attached the ' + (kind === 'bill' ? 'service bill' : 'service visit report & estimate') + ' for request *' + s.id + '* (' + (kind === 'bill' ? 'Total ' : 'Estimate ') + rs(t.total) + ').\n\n' + SIGN,
      html: function () { return pdfHtml(s, kind); },
      textFn: function () { open(s.id, kind === 'bill' ? 'done' : 'visit'); },
      printFn: function () { ttPrintHtml((kind === 'bill' ? 'Service Bill ' : 'Visit Report ') + s.id, pdfHtml(s, kind)); }
    });
  }

  /* ---------- message sheet ---------- */
  var TYPES = [['raised', '✅ Request raised'], ['visit', '🔧 Visit report'], ['done', '🏁 Completed']];
  function draw() {
    var s = svc(S.id); if (!s) return; var ph = p10(s.phone);
    var chips = TYPES.map(function (t) { return '<button type="button" class="ttx-b' + (t[0] === S.type ? ' pri' : '') + '" data-a="type" data-p="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    var doc = S.type === 'raised' ? '' : '<div class="ttx-btns" style="flex-wrap:wrap;margin:6px 0"><button type="button" class="ttx-b" data-a="edit" style="flex:1 1 48%">💰 ' + (S.type === 'visit' ? 'Edit estimate' : 'Edit charges') + '</button><button type="button" class="ttx-b" data-a="pdf" style="flex:1 1 48%">📄 Send PDF</button></div>';
    var warn = S.type === 'visit' && !hasAmt(s.est) ? '<div class="ttx-note" style="font-size:12px">No estimate added yet – tap <b>Edit estimate</b> to add problem, parts and charges.</div>' : (S.type === 'done' && !hasAmt(s.bill) ? '<div class="ttx-note" style="font-size:12px">No charges added yet – tap <b>Edit charges</b> to add installed items and service charge.</div>' : '');
    var h = '<div class="ttx-note"><b>' + H(s.customerName || '') + '</b> · ' + (ph ? '+91 ' + H(ph) : '<span style="color:#d97706">no mobile number saved – WhatsApp will ask you to pick the contact</span>') + '<br><small>' + H(s.id) + ' · ' + H(s.status || '') + '</small></div>' +
      '<div class="ttx-btns">' + chips + '</div>' + doc + warn +
      '<textarea id="svText" rows="14" style="width:100%;font-size:13.5px;line-height:1.45"></textarea>' +
      '<div class="ttx-btns"><button class="ttx-b pri" data-a="send" style="flex:1">📲 Send on WhatsApp</button><button class="ttx-b" data-a="copy">📋 Copy</button><button class="ttx-b" data-a="skip">Not now</button></div>';
    X.sheet(ID, '📲 Service message to customer', h, { z: 3900 });
    X.bind(ID, { click: {
      type: function (t) { S.type = t; draw(); },
      edit: function () { editor(s.id, S.type === 'visit' ? 'est' : 'bill'); },
      pdf: function () { X.close(ID); sharePdf(s, S.type === 'done' ? 'bill' : 'est'); },
      send: function () { var tx = ($('svText') || {}).value || '', p = p10(s.phone); window.open((p ? 'https://wa.me/91' + p : 'https://wa.me/') + '?text=' + encodeURIComponent(tx), '_blank'); X.close(ID); },
      copy: function () { var el = $('svText'); try { navigator.clipboard.writeText(el.value).then(function () { X.toast('Copied'); }); } catch (e) { el.select(); document.execCommand('copy'); X.toast('Copied'); } },
      skip: function () { X.close(ID); }
    } });
    $('svText').value = build(s, S.type);
  }
  function open(id, type) { if (!svc(id)) return; S = { id: id, type: type || 'raised' }; draw(); }
  window.ttOpenServiceWA = open;

  /* ---------- estimate / charges editor ---------- */
  function row(r, i) {
    return '<div class="sv-r" style="display:grid;grid-template-columns:1fr 54px 78px;gap:6px;margin-bottom:6px"><input data-k="n" data-i="' + i + '" placeholder="Product / part ' + (i + 1) + '" value="' + H(r.n || '') + '"><input data-k="q" data-i="' + i + '" inputmode="decimal" placeholder="Qty" value="' + H(r.q == null ? '' : r.q) + '"><input data-k="r" data-i="' + i + '" inputmode="decimal" placeholder="Rate ₹" value="' + H(r.r == null ? '' : r.r) + '"></div>';
  }
  function readEd() {
    var o = $(EID); if (!o) return;
    ED.items = ED.items || []; o.querySelectorAll('[data-k]').forEach(function (el) { var i = +el.getAttribute('data-i'), k = el.getAttribute('data-k'); ED.items[i] = ED.items[i] || {}; ED.items[i][k] = el.value; });
    ['problem', 'advice', 'visit', 'charge', 'transport', 'disc', 'recv', 'mode', 'warranty', 'date'].forEach(function (k) { var el = o.querySelector('[data-f="' + k + '"]'); if (el) ED[k] = el.value; });
  }
  function editor(id, mode) {
    var s = svc(id); if (!s) return;
    if (!ED || ED.__id !== id || ED.__mode !== mode) {
      var src = JSON.parse(JSON.stringify((mode === 'est' ? s.est : s.bill) || {}));
      if (mode === 'bill' && !hasAmt(src) && hasAmt(s.est)) { var e0 = JSON.parse(JSON.stringify(s.est)); src.items = e0.items; src.charge = e0.charge; src.transport = e0.transport; src.disc = e0.disc; }
      if (!src.date) src.date = X.ymd();
      if (mode === 'est' && src.problem == null) src.problem = (s.report && s.report.cause) || s.problem || '';
      ED = Object.assign({ items: [] }, src, { __id: id, __mode: mode });
    }
    while ((ED.items || []).length < 4) ED.items.push({});
    var est = mode === 'est';
    var h = '<div class="ttx-note"><b>' + H(s.customerName || '') + '</b> · ' + H(s.id) + ' · ' + H(s.machine || '') + '</div>' +
      (est ? '<label class="ttx-f"><span>Problem found (visit)</span><textarea data-f="problem" rows="2">' + H(ED.problem || '') + '</textarea></label><label class="ttx-f"><span>Work advised</span><textarea data-f="advice" rows="2">' + H(ED.advice || '') + '</textarea></label>' : '') +
      '<label class="ttx-f"><span>' + (est ? 'Visit date' : 'Completed on') + '</span><input type="date" data-f="date" value="' + H(ED.date || '') + '"></label>' +
      '<div style="font-size:12px;font-weight:700;margin:8px 0 4px">' + (est ? 'Products / parts required' : 'Products / parts installed') + '</div>' +
      '<div id="svRows">' + ED.items.map(row).join('') + '</div><button type="button" class="ttx-b" data-a="add" style="width:100%;margin-bottom:8px">＋ Add item</button>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><label class="ttx-f"><span>Service / labour charge ₹</span><input data-f="charge" inputmode="decimal" value="' + H(ED.charge == null ? '' : ED.charge) + '"></label>' +
      '<label class="ttx-f"><span>Transport ₹</span><input data-f="transport" inputmode="decimal" value="' + H(ED.transport == null ? '' : ED.transport) + '"></label>' +
      '<label class="ttx-f"><span>Discount ₹</span><input data-f="disc" inputmode="decimal" value="' + H(ED.disc == null ? '' : ED.disc) + '"></label>' +
      (est ? '' : '<label class="ttx-f"><span>Received ₹</span><input data-f="recv" inputmode="decimal" value="' + H(ED.recv == null ? '' : ED.recv) + '"></label><label class="ttx-f"><span>Payment mode</span><input data-f="mode" value="' + H(ED.mode || '') + '" placeholder="Cash / UPI"></label>') + '</div>' +
      (est ? '' : '<label class="ttx-f"><span>Warranty / note (optional)</span><input data-f="warranty" value="' + H(ED.warranty || '') + '" placeholder="e.g. 3 months warranty on replaced parts"></label>') +
      '<div class="ttx-note" id="svTot" style="font-weight:800"></div>' +
      '<div class="ttx-btns"><button class="ttx-b pri" data-a="save" style="flex:1">💾 Save &amp; preview message</button><button class="ttx-b" data-a="cancel">Cancel</button></div>';
    X.sheet(EID, est ? '🔧 Visit report & estimate' : '🏁 Final charges', h, { z: 3950 });
    var upd = function () { readEd(); var t = tot(ED), el = $('svTot'); if (el) el.textContent = (est ? 'Estimated total: ' : 'Total: ') + rs(t.total) + (est ? '' : '   ·   Pending: ' + rs(t.due)); };
    var box = $(EID); if (box) { box.__upd = upd; if (!box.__svIn) { box.__svIn = 1; box.addEventListener('input', function () { box.__upd && box.__upd(); }); } }
    X.bind(EID, { click: {
      add: function () { readEd(); ED.items.push({}); ED.items.push({}); editor(id, mode); },
      cancel: function () { X.close(EID); },
      save: function () {
        readEd(); var rec = svc(id); if (!rec) return;
        var o = { date: ED.date || X.ymd(), items: lines(ED.items).map(function (r) { return { n: String(r.n).trim(), q: N(r.q || 1) || 1, r: N(r.r) }; }), charge: N(ED.charge), transport: N(ED.transport), disc: N(ED.disc) };
        if (est) { o.problem = String(ED.problem || '').trim(); o.advice = String(ED.advice || '').trim(); rec.est = o; }
        else { o.recv = N(ED.recv); o.mode = String(ED.mode || '').trim(); o.warranty = String(ED.warranty || '').trim(); rec.bill = o; }
        try { setStored('SERVICES', serviceCallsData); } catch (e) {}
        ED = null; X.close(EID); try { renderServices(); } catch (e) {}
        open(id, est ? 'visit' : 'done');
      }
    } });
    upd();
  }
  window.ttOpenServiceCharges = function (id, mode) { ED = null; editor(id, mode || 'bill'); };

  /* ---------- buttons on service cards + auto offers ---------- */
  var raf = 0;
  function addBtns() {
    raf = 0;
    try {
      document.querySelectorAll('#serviceListContainer button[onclick*="editServicePrompt("]').forEach(function (b) {
        var card = b.closest('.card'); if (!card || card.querySelector('.sv-wa')) return;
        var m = /editServicePrompt\('([^']+)'\)/.exec(b.getAttribute('onclick') || ''); if (!m) return;
        var s = svc(m[1]); var done = s && s.status === 'Work Completed';
        var d = document.createElement('div'); d.className = 'sv-wa'; d.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap';
        d.innerHTML = '<button type="button" class="btn btn-outline btn-sm" style="flex:1 1 48%" onclick="triggerAppHaptic(); ttOpenServiceWA(\'' + m[1] + '\',\'' + (done ? 'done' : 'raised') + '\')">📲 WhatsApp update</button>' +
          '<button type="button" class="btn btn-outline btn-sm" style="flex:1 1 48%" onclick="triggerAppHaptic(); ttOpenServiceCharges(\'' + m[1] + '\',\'' + (done ? 'bill' : 'est') + '\')">💰 ' + (done ? 'Final charges' : 'Visit report / estimate') + '</button>';
        card.appendChild(d);
      });
    } catch (e) { console.warn('sv buttons', e); }
  }
  function watch() {
    var el = $('serviceListContainer'); if (el && !el.__sv) { el.__sv = 1; new MutationObserver(function () { if (!raf) raf = requestAnimationFrame(addBtns); }).observe(el, { childList: true, subtree: true }); }
    addBtns();
  }
  function wrapSave() {
    var o = window.saveServiceAction; if (typeof o !== 'function' || o.__sv) return;
    var w = function () {
      var editId = ($('editServiceId') || {}).value, was = editId && svc(editId) && svc(editId).status, st = ($('srvStatusSelect') || {}).value, n0 = svcs().length, r = o.apply(this, arguments);
      try {
        var rec = editId ? svc(editId) : svcs()[0], isNew = !editId && svcs().length > n0;
        if (rec) {
          if (isNew) setTimeout(function () { open(rec.id, 'raised'); }, 500);
          else if (st === 'Work Completed' && was !== 'Work Completed') setTimeout(function () { editor(rec.id, 'bill'); }, 900);
        }
      } catch (e) { console.warn('sv wa', e); }
      return r;
    }; w.__sv = 1; window.saveServiceAction = w; try { saveServiceAction = w; } catch (e) {}
  }
  function all() { wrapSave(); watch(); }
  all(); document.addEventListener('DOMContentLoaded', all); setTimeout(all, 1500);
  if (X.hubTiles) { /* no hub tile needed */ }
})();
