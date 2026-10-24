/* TTESPL ERP module: 06-expenses-and-old-bills.js */
/* =====================================================================
   v16: Expenses (Zoho-style) | purane bills ka MRP/Disc/HSN backfill tool | perf helpers
   (purana koi function delete nahi - sirf add / wrap)
   ===================================================================== */
var expensesData = getStored("EXPENSES", []);
window.expensesData = expensesData;
window.ttRenderExpensesIfOpen = function () {
  var m = document.getElementById('tt15ExpModal');
  if (m && m.style.display === 'flex' && !document.getElementById('tt15FormOpen') && typeof window.tt15Render === 'function') window.tt15Render();
  if (typeof window.tt15Badge === 'function') window.tt15Badge();
};

(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var INR = function (n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
  var isAdm = function () { try { return typeof isAdminUser === 'function' && isAdminUser(); } catch (e) { return false; } };
  var meName = function () { try { return (currentUser && currentUser.name) || ''; } catch (e) { return ''; } };
  var meId = function () { try { return String(currentUser && currentUser.id != null ? currentUser.id : (currentUser && currentUser.mobile) || ''); } catch (e) { return ''; } };
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function notice(title, body, icon, onClick) {
    var c = $('broadcastToastContainer'); if (!c) return;
    var t = document.createElement('div'); t.className = 'broadcast-toast tt-toast-success';
    t.innerHTML = '<div class="toast-content"><div class="toast-icon">' + (icon || '✅') + '</div><div style="flex:1;"><div class="toast-title">' + H(title) + '</div><div class="toast-body">' + H(body) + '</div></div><button class="toast-close" onclick="this.closest(\'.broadcast-toast\').remove()">✕</button></div>';
    if (onClick) t.querySelector('.toast-content').addEventListener('click', function (e) { if (e.target.closest('.toast-close')) return; t.remove(); onClick(); });
    c.prepend(t); setTimeout(function () { if (t.parentElement) t.remove(); }, 8000);
  }
  function ensureModal(id, z, maxW) {
    var m = $(id);
    if (!m) { m = document.createElement('div'); m.id = id; m.className = 'auth-overlay'; m.style.display = 'none'; m.style.zIndex = String(z || 3200); m.innerHTML = '<div class="auth-card tt14-card" style="max-width:' + (maxW || 560) + 'px;"></div>'; document.body.appendChild(m); }
    return m;
  }
  function setModal(m, html) { m.firstChild.innerHTML = html; }

  /* ---------------- EXPENSES ---------------- */
  var CATS = [
    { k: 'Hotel', ic: '🏨' }, { k: 'Food', ic: '🍽️', subs: ['Chai', 'Breakfast', 'Lunch', 'Dinner', 'Snacks'] },
    { k: 'Local Auto', ic: '🛺' }, { k: 'Bus', ic: '🚌' }, { k: 'Train', ic: '🚆' }, { k: 'Cab / Taxi', ic: '🚕' },
    { k: 'Fuel', ic: '⛽' }, { k: 'Toll / Parking', ic: '🅿️' }, { k: 'Misc', ic: '🧾' }
  ];
  var SUBIC = { Chai: '☕', Breakfast: '🥞', Lunch: '🍛', Dinner: '🍲', Snacks: '🍿' };
  var ST = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Reimbursed'];
  var STC = { Draft: '#64748b', Submitted: '#d97706', Approved: '#0891b2', Rejected: '#e11d48', Reimbursed: '#16a34a' };
  var MODES = ['Cash', 'UPI', 'Card', 'Company Card', 'Other'];
  var S = { month: today().slice(0, 7), emp: 'ALL', st: 'ALL', all: false };
  var F = { id: '', cat: 'Food', sub: 'Chai', receipt: '' };
  var catIc = function (e) { return e.cat === 'Food' && SUBIC[e.sub] ? SUBIC[e.sub] : ((CATS.filter(function (c) { return c.k === e.cat; })[0] || {}).ic || '🧾'); };
  var catName = function (e) { return e.cat + (e.sub ? ' · ' + e.sub : ''); };
  var fmtD = function (d) { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return d; } };
  var fmtDT = function (t) { try { return new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  var monthLabel = function (ym) { try { return new Date(ym + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); } catch (e) { return ym; } };

  function visible(r) {
    if (!r) return false; if (isAdm()) return true;
    if (r.empId != null && r.empId !== '') return String(r.empId) === meId();
    return r.emp === meName();
  }
  function mine(r) { return (r.empId != null && r.empId !== '') ? String(r.empId) === meId() : r.emp === meName(); }
  function byId(id) { return (expensesData || []).filter(function (r) { return r && r.id === id; })[0]; }
  function persist() { window.expensesData = expensesData; setStored("EXPENSES", expensesData); badge(); }
  function employees() {
    var n = {}; (expensesData || []).forEach(function (r) { if (r && r.emp) n[r.emp] = 1; });
    try { (registeredEmployees || []).forEach(function (e) { if (e && e.name) n[e.name] = 1; }); } catch (e) {}
    return Object.keys(n).sort();
  }
  function scoped() {
    return (expensesData || []).filter(function (r) {
      if (!visible(r)) return false;
      if (isAdm() && S.emp !== 'ALL' && r.emp !== S.emp) return false;
      if (!S.all && String(r.date || '').slice(0, 7) !== S.month) return false;
      return true;
    });
  }
  function sum(list, st) { return list.filter(function (r) { return !st || r.status === st; }).reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0); }

  /* --- main screen --- */
  window.ttExpOpen = function () {
    var m = ensureModal('tt15ExpModal', 3300, 660); tt15Render(); m.style.display = 'flex';
  };
  window.tt15Render = function render() {
    var m = $('tt15ExpModal'); if (!m) return;
    var list = scoped(), counts = { ALL: list.length }; ST.forEach(function (s) { counts[s] = list.filter(function (r) { return r.status === s; }).length; });
    var shown = list.filter(function (r) { return S.st === 'ALL' || r.status === S.st; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0); });
    var total = sum(list.filter(function (r) { return r.status !== 'Rejected'; })), adm = isAdm();
    var h = [];
    h.push('<div class="card-header"><span class="card-title">💼 Expenses</span><div style="display:flex;gap:6px;">' +
      '<button class="btn btn-accent btn-sm" onclick="triggerAppHaptic(); tt15Form(\'\')">+ Add</button>' +
      '<button class="btn btn-outline btn-sm" onclick="tt14Close(\'tt15ExpModal\')">✕</button></div></div>');
    h.push('<div class="tt15-filters">' +
      '<input type="month" value="' + H(S.month) + '" ' + (S.all ? 'disabled' : '') + ' onchange="tt15Set(\'month\', this.value)">' +
      '<label class="tt15-chk"><input type="checkbox" ' + (S.all ? 'checked' : '') + ' onchange="tt15Set(\'all\', this.checked)"> All dates</label>' +
      (adm ? '<select onchange="tt15Set(\'emp\', this.value)"><option value="ALL">👥 All employees</option>' + employees().map(function (n) { return '<option ' + (S.emp === n ? 'selected' : '') + ' value="' + H(n) + '">' + H(n) + '</option>'; }).join('') + '</select>' : '') + '</div>');
    h.push('<div class="tt15-hero"><div><small>' + (S.all ? 'ALL DATES' : H(monthLabel(S.month)).toUpperCase()) + ' · TOTAL EXPENSES</small><b>' + INR(total) + '</b>' +
      '<span>' + list.filter(function (r) { return r.status !== 'Rejected'; }).length + ' entries' + (adm && S.emp === 'ALL' ? ' · ' + Object.keys(list.reduce(function (o, r) { o[r.emp] = 1; return o; }, {})).length + ' employees' : '') + '</span></div><div class="tt15-heroic">💼</div></div>');
    h.push('<div class="tt15-tiles">' + [['Submitted', '⏳ Awaiting approval'], ['Approved', '✅ Approved'], ['Reimbursed', '💰 Received'], ['Draft', '📝 Draft']].map(function (p) {
      return '<div style="border-color:' + STC[p[0]] + '55;"><small>' + p[1] + '</small><b style="color:' + STC[p[0]] + ';">' + INR(sum(list, p[0])) + '</b></div>'; }).join('') + '</div>');
    // category breakdown
    var cats = {}; list.filter(function (r) { return r.status !== 'Rejected'; }).forEach(function (r) { cats[r.cat] = (cats[r.cat] || 0) + (Number(r.amount) || 0); });
    var ck = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; });
    if (ck.length) {
      h.push('<div class="tt15-sec">📊 Category-wise</div><div class="tt15-bars">' + ck.map(function (k) {
        var c = CATS.filter(function (x) { return x.k === k; })[0] || { ic: '🧾' }, pc = total ? Math.round(cats[k] * 100 / total) : 0;
        return '<div class="tt15-bar"><span class="ic">' + c.ic + '</span><div style="flex:1;min-width:0;"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;"><span>' + H(k) + '</span><span>' + INR(cats[k]) + ' <i>' + pc + '%</i></span></div><div class="track"><div style="width:' + Math.max(3, pc) + '%;"></div></div></div></div>'; }).join('') + '</div>');
    }
    // admin: employee-wise
    if (adm && S.emp === 'ALL') {
      var em = {}; list.forEach(function (r) { var o = em[r.emp] = em[r.emp] || { t: 0, p: 0, a: 0, r: 0 }; if (r.status !== 'Rejected') o.t += +r.amount || 0; if (r.status === 'Submitted') o.p += +r.amount || 0; if (r.status === 'Approved') o.a += +r.amount || 0; if (r.status === 'Reimbursed') o.r += +r.amount || 0; });
      var ek = Object.keys(em).sort(function (a, b) { return em[b].t - em[a].t; });
      if (ek.length) h.push('<div class="tt15-sec">👥 Employee-wise</div>' + ek.map(function (n) { var o = em[n];
        return '<div class="tt15-row" onclick="triggerAppHaptic(); tt15Set(\'emp\', \'' + H(n).replace(/&#39;/g, "\\'") + '\')"><div class="ic">👤</div><div style="flex:1;min-width:0;"><b>' + H(n) + '</b><div class="sub">Pending ' + INR(o.p) + ' · Approved ' + INR(o.a) + ' · Received ' + INR(o.r) + '</div></div><b>' + INR(o.t) + '</b></div>'; }).join(''));
    }
    // status chips
    h.push('<div class="tt15-chips">' + ['ALL'].concat(ST).map(function (s) {
      return '<button class="' + (S.st === s ? 'on' : '') + '" onclick="tt15Set(\'st\', \'' + s + '\')">' + (s === 'ALL' ? 'Sab' : s) + ' <i>' + counts[s] + '</i></button>'; }).join('') + '</div>');
    // bulk actions
    var drafts = list.filter(function (r) { return r.status === 'Draft' && mine(r); }), subm = list.filter(function (r) { return r.status === 'Submitted'; }), appr = list.filter(function (r) { return r.status === 'Approved'; });
    var acts = [];
    if (drafts.length) acts.push('<button class="btn btn-primary btn-sm" style="flex:1;" onclick="triggerAppHaptic(); tt15SubmitDrafts()">📤 Submit ' + drafts.length + ' draft (' + INR(sum(drafts)) + ')</button>');
    if (adm && subm.length) acts.push('<button class="btn btn-accent btn-sm" style="flex:1;" onclick="triggerAppHaptic(); tt15Bulk(\'Approved\')">✅ Approve All (' + subm.length + ')</button>');
    if (adm && appr.length) acts.push('<button class="btn btn-wa btn-sm" style="flex:1;" onclick="triggerAppHaptic(); tt15Bulk(\'Reimbursed\')">💰 Mark All Paid (' + appr.length + ')</button>');
    acts.push('<button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); tt15Pdf()">📄 PDF</button><button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); tt15Csv()">⬇️ CSV</button>');
    h.push('<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;">' + acts.join('') + '</div>');
    // list grouped by date
    if (!shown.length) h.push('<div class="tt14-empty" style="padding:22px 8px;">No expenses.<br><button class="btn btn-accent btn-sm" style="margin-top:10px;" onclick="tt15Form(\'\')">+ Add your first expense</button></div>');
    var last = '';
    shown.slice(0, 150).forEach(function (r) {
      if (r.date !== last) { last = r.date; h.push('<div class="tt15-day">' + H(fmtD(r.date)) + '</div>'); }
      h.push('<div class="tt15-row" onclick="triggerAppHaptic(); tt15View(\'' + H(r.id) + '\')"><div class="ic">' + catIc(r) + '</div><div style="flex:1;min-width:0;"><b>' + H(catName(r)) + '</b>' +
        '<div class="sub">' + H([r.merchant, r.trip, adm && S.emp === 'ALL' ? r.emp : ''].filter(Boolean).join(' · ') || '—') + (r.receipt ? ' · 📎' : '') + '</div></div>' +
        '<div style="text-align:right;"><b>' + INR(r.amount) + '</b><div><span class="tt15-pill" style="background:' + STC[r.status] + '22;color:' + STC[r.status] + ';">' + H(r.status) + '</span></div></div></div>');
    });
    if (shown.length > 150) h.push('<div class="tt14-empty">…and ' + (shown.length - 150) + ' more entries (use a filter)</div>');
    setModal(m, h.join(''));
  };
  window.tt15Set = function (k, v) {
    S[k] = v; if (k === 'emp') S.st = 'ALL'; tt15Render();
  };

  /* --- add / edit form --- */
  window.tt15Form = function (id) {
    var r = id ? byId(id) : null;
    if (r && !canEdit(r)) { notice('Cannot edit', 'Submitted or approved entries cannot be edited', '🔒'); return; }
    F = { id: id || '', cat: r ? r.cat : 'Food', sub: r ? (r.sub || '') : 'Chai', receipt: r ? (r.receipt || '') : '' };
    var trips = {}; (expensesData || []).filter(visible).forEach(function (x) { if (x.trip) trips[x.trip] = 1; });
    var m = ensureModal('tt15FormModal', 3400, 520);
    setModal(m,
      '<div id="tt15FormOpen"></div><div class="card-header"><span class="card-title">' + (r ? '✏️ Expense Edit' : '➕ New Expense') + '</span><button class="btn btn-outline btn-sm" onclick="tt14Close(\'tt15FormModal\'); tt15Render()">✕</button></div>' +
      '<div class="tt15-amt"><span>₹</span><input type="number" inputmode="decimal" id="tt15Amt" placeholder="0.00" value="' + (r ? H(r.amount) : '') + '"></div>' +
      '<div class="tt15-lbl">Category</div><div class="tt15-cats" id="tt15Cats"></div><div id="tt15Subs" class="tt15-subs"></div>' +
      '<div class="grid-2"><div class="form-group"><label>Date</label><input type="date" id="tt15Date" value="' + H(r ? r.date : today()) + '"></div>' +
      '<div class="form-group"><label>Payment</label><select id="tt15Mode">' + MODES.map(function (x) { return '<option ' + (r && r.payMode === x ? 'selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="form-group"><label>Merchant / Jagah</label><input type="text" id="tt15Merch" placeholder="Hotel / restaurant / petrol pump…" value="' + H(r ? r.merchant : '') + '"></div>' +
      '<div class="form-group"><label>Trip / Purpose</label><input type="text" id="tt15Trip" list="tt15Trips" placeholder="e.g. Rourkela dealer visit" value="' + H(r ? r.trip : '') + '"><datalist id="tt15Trips">' + Object.keys(trips).map(function (t) { return '<option value="' + H(t) + '">'; }).join('') + '</datalist></div>' +
      '<div class="form-group"><label>Notes</label><textarea id="tt15Notes" rows="2" placeholder="Optional">' + H(r ? r.notes : '') + '</textarea></div>' +
      '<div class="tt15-lbl">Receipt / Bill photo</div><div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">' +
      '<label class="btn btn-outline btn-sm" style="margin:0;cursor:pointer;">📷 Photo<input type="file" accept="image/*" capture="environment" style="display:none;" onchange="tt15Pick(this)"></label>' +
      '<label class="btn btn-outline btn-sm" style="margin:0;cursor:pointer;">🖼️ Gallery<input type="file" accept="image/*" style="display:none;" onchange="tt15Pick(this)"></label><div id="tt15RecPrev"></div></div>' +
      '<div style="display:flex;gap:8px;"><button class="btn btn-outline btn-block" onclick="triggerAppHaptic(); tt15Save(false)">💾 Draft save</button><button class="btn btn-primary btn-block" onclick="triggerAppHaptic(); tt15Save(true)">📤 Save & Submit</button></div>');
    drawCats(); drawRec(); m.style.display = 'flex';
  };
  function drawCats() {
    var c = $('tt15Cats'); if (!c) return;
    c.innerHTML = CATS.map(function (x) { return '<button type="button" class="' + (F.cat === x.k ? 'on' : '') + '" onclick="tt15Cat(\'' + x.k.replace("'", "\\'") + '\')"><span>' + x.ic + '</span>' + H(x.k) + '</button>'; }).join('');
    var cat = CATS.filter(function (x) { return x.k === F.cat; })[0], s = $('tt15Subs');
    s.innerHTML = (cat && cat.subs) ? cat.subs.map(function (n) { return '<button type="button" class="' + (F.sub === n ? 'on' : '') + '" onclick="tt15Sub(\'' + n + '\')">' + SUBIC[n] + ' ' + n + '</button>'; }).join('') : '';
  }
  window.tt15Cat = function (k) { F.cat = k; var c = CATS.filter(function (x) { return x.k === k; })[0]; F.sub = (c && c.subs) ? (F.sub && c.subs.indexOf(F.sub) >= 0 ? F.sub : c.subs[0]) : ''; drawCats(); };
  window.tt15Sub = function (n) { F.sub = n; drawCats(); };
  function drawRec() { var p = $('tt15RecPrev'); if (!p) return; p.innerHTML = F.receipt ? '<img class="tt15-thumb" src="' + H(F.receipt) + '" onclick="tt15Img(this.src)"> <button class="tt14-lnk" onclick="tt15RecClear()">Hatao</button>' : '<span class="tt14-sub">No photo</span>'; }
  window.tt15RecClear = function () { F.receipt = ''; drawRec(); };
  window.tt15Pick = function (input) {
    var f = input.files && input.files[0]; input.value = ''; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var out = '', max = 1000, q = 0.68;
        for (var i = 0; i < 5; i++) {
          var s = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(im.width * s)); cv.height = Math.max(1, Math.round(im.height * s));
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
          out = cv.toDataURL('image/jpeg', q); if (out.length <= 105000) break; max = Math.round(max * 0.8); q = Math.max(0.4, q - 0.06);
        }
        if (out.length > 115000) { notice('Photo is too large', 'Dobara chhoti photo lo', '⚠️'); return; }
        F.receipt = out; drawRec();
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  };
  function canEdit(r) { if (r.status === 'Reimbursed') return false; if (isAdm()) return true; return mine(r) && (r.status === 'Draft' || r.status === 'Rejected'); }
  window.tt15Save = function (submit) {
    var amt = parseFloat(($('tt15Amt').value || '').replace(/,/g, '')), date = $('tt15Date').value;
    if (!(amt > 0)) { alert('Enter the amount'); return; } if (!date) { alert('Choose a date'); return; }
    var d = { date: date, cat: F.cat, sub: F.sub || '', amount: Math.round(amt * 100) / 100, merchant: $('tt15Merch').value.trim(), trip: $('tt15Trip').value.trim(), notes: $('tt15Notes').value.trim(), payMode: $('tt15Mode').value, receipt: F.receipt || '' };
    var r = F.id ? byId(F.id) : null;
    if (!r) {
      var dup = (expensesData || []).some(function (x) { return x && mine(x) && x.date === d.date && x.cat === d.cat && x.sub === d.sub && Number(x.amount) === d.amount; });
      if (dup && !confirm('An expense with the same date, category and amount already exists. Add it anyway?')) return;
      r = Object.assign({ id: 'EXP' + Date.now() + Math.floor(Math.random() * 900 + 100), emp: meName(), empId: meId(), status: 'Draft', createdAt: Date.now() }, d);
      if (!Array.isArray(expensesData)) expensesData = []; expensesData.unshift(r);
    } else { Object.assign(r, d, { updatedAt: Date.now() }); if (r.status === 'Rejected') { r.status = 'Draft'; } }
    if (submit) { r.status = 'Submitted'; r.submittedAt = Date.now(); r.reviewNote = ''; }
    persist(); tt14Close('tt15FormModal'); S.month = r.date.slice(0, 7); tt15Render();
    notice(submit ? 'Submitted' : 'Draft save', INR(r.amount) + ' · ' + catName(r), submit ? '📤' : '💾');
  };

  /* --- detail --- */
  window.tt15View = function (id) {
    var r = byId(id); if (!r) return;
    var adm = isAdm(), tl = [['📝 Created', r.createdAt, r.emp]];
    if (r.submittedAt) tl.push(['📤 Submitted', r.submittedAt, r.emp]);
    if (r.reviewedAt) tl.push([(r.status === 'Rejected' ? '❌ Rejected' : '✅ Approved'), r.reviewedAt, r.reviewedBy + (r.reviewNote ? ' — ' + r.reviewNote : '')]);
    if (r.paidAt) tl.push(['💰 Reimbursed', r.paidAt, (r.paidBy || '') + (r.paidRef ? ' — ' + r.paidRef : '')]);
    var btn = [];
    if (canEdit(r)) btn.push('<button class="btn btn-outline btn-sm" style="flex:1;" onclick="tt14Close(\'tt15ViewModal\'); tt15Form(\'' + H(r.id) + '\')">✏️ Edit</button>');
    if (mine(r) && (r.status === 'Draft' || r.status === 'Rejected')) btn.push('<button class="btn btn-primary btn-sm" style="flex:1;" onclick="tt15SubmitOne(\'' + H(r.id) + '\')">📤 Submit</button>');
    if (adm && r.status === 'Submitted') btn.push('<button class="btn btn-accent btn-sm" style="flex:1;" onclick="tt15Review(\'' + H(r.id) + '\', true)">✅ Approve</button><button class="btn btn-danger-sm btn-sm" style="flex:1;" onclick="tt15Review(\'' + H(r.id) + '\', false)">❌ Reject</button>');
    if (adm && r.status === 'Approved') btn.push('<button class="btn btn-wa btn-sm" style="flex:1;" onclick="tt15Pay(\'' + H(r.id) + '\')">💰 Mark Reimbursed</button>');
    if (adm && r.status === 'Submitted') btn.push('<button class="btn btn-outline btn-sm" style="flex:1;" onclick="tt15Reopen(\'' + H(r.id) + '\')">↩ Back to Draft</button>');
    if (adm || (mine(r) && r.status === 'Draft')) btn.push('<button class="btn btn-danger-sm btn-sm" onclick="tt15Del(\'' + H(r.id) + '\')">🗑️</button>');
    var m = ensureModal('tt15ViewModal', 3400, 520);
    setModal(m, '<div class="card-header"><span class="card-title">' + catIc(r) + ' ' + H(catName(r)) + '</span><button class="btn btn-outline btn-sm" onclick="tt14Close(\'tt15ViewModal\')">✕</button></div>' +
      '<div class="tt15-bigamt">' + INR(r.amount) + '<span class="tt15-pill" style="background:' + STC[r.status] + '22;color:' + STC[r.status] + ';">' + H(r.status) + '</span></div>' +
      [['👤 Employee', r.emp], ['📅 Date', fmtD(r.date)], ['📍 Merchant', r.merchant], ['🧳 Trip / Purpose', r.trip], ['💳 Payment', r.payMode], ['🗒️ Notes', r.notes]].filter(function (p) { return p[1]; }).map(function (p) {
        return '<div class="tt14-kv"><span style="min-width:112px;color:var(--text-muted);font-size:11.5px;">' + p[0] + '</span><div>' + H(p[1]) + '</div></div>'; }).join('') +
      (r.receipt ? '<div class="tt15-lbl" style="margin-top:10px;">Receipt</div><img class="tt15-receipt" src="' + H(r.receipt) + '" onclick="tt15Img(this.src)">' : '') +
      '<div class="tt15-lbl" style="margin-top:12px;">Timeline</div>' + tl.map(function (t) { return '<div class="tt15-tl"><b>' + t[0] + '</b><span>' + H(fmtDT(t[1])) + (t[2] ? ' · ' + H(t[2]) : '') + '</span></div>'; }).join('') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">' + btn.join('') + '</div>');
    m.style.display = 'flex';
  };
  window.tt15Img = function (src) {
    var m = ensureModal('tt15ImgModal', 3600, 760); setModal(m, '<div class="card-header"><span class="card-title">🧾 Receipt</span><button class="btn btn-outline btn-sm" onclick="tt14Close(\'tt15ImgModal\')">✕</button></div><img src="' + H(src) + '" style="width:100%;border-radius:12px;">'); m.style.display = 'flex';
  };

  /* --- workflow --- */
  function touch(r, st) { r.status = st; r.updatedAt = Date.now(); }
  window.tt15SubmitOne = function (id) { var r = byId(id); if (!r) return; touch(r, 'Submitted'); r.submittedAt = Date.now(); r.reviewNote = ''; persist(); tt14Close('tt15ViewModal'); tt15Render(); notice('Submitted', INR(r.amount), '📤'); };
  window.tt15SubmitDrafts = function () {
    var d = scoped().filter(function (r) { return r.status === 'Draft' && mine(r); }); if (!d.length) return;
    if (!confirm('Submit ' + d.length + ' draft expenses (' + INR(sum(d)) + ') for approval?')) return;
    var now = Date.now(); d.forEach(function (r) { touch(r, 'Submitted'); r.submittedAt = now; r.reviewNote = ''; });
    persist(); tt15Render(); notice('Submitted', d.length + ' expenses · ' + INR(sum(d)), '📤');
  };
  window.tt15Review = function (id, ok) {
    if (!isAdm()) return; var r = byId(id); if (!r) return; var note = '';
    if (!ok) { note = prompt('Enter the reason for rejection:', ''); if (note === null) return; }
    touch(r, ok ? 'Approved' : 'Rejected'); r.reviewedAt = Date.now(); r.reviewedBy = meName(); r.reviewNote = note || '';
    persist(); tt14Close('tt15ViewModal'); tt15Render();
  };
  window.tt15Reopen = function (id) { if (!isAdm()) return; var r = byId(id); if (!r) return; touch(r, 'Draft'); persist(); tt14Close('tt15ViewModal'); tt15Render(); };
  window.tt15Pay = function (id) {
    if (!isAdm()) return; var r = byId(id); if (!r) return; var ref = prompt('Payment ref / UTR / note (optional):', ''); if (ref === null) return;
    touch(r, 'Reimbursed'); r.paidAt = Date.now(); r.paidBy = meName(); r.paidRef = ref || ''; persist(); tt14Close('tt15ViewModal'); tt15Render();
  };
  window.tt15Bulk = function (to) {
    if (!isAdm()) return; var from = to === 'Approved' ? 'Submitted' : 'Approved', l = scoped().filter(function (r) { return r.status === from; }); if (!l.length) return;
    if (!confirm((to === 'Approved' ? 'Approve ' : 'Mark as reimbursed: ') + l.length + ' expenses (' + INR(sum(l)) + ')?')) return;
    var now = Date.now(); l.forEach(function (r) { touch(r, to); if (to === 'Approved') { r.reviewedAt = now; r.reviewedBy = meName(); } else { r.paidAt = now; r.paidBy = meName(); } });
    persist(); tt15Render();
  };
  window.tt15Del = function (id) {
    var r = byId(id); if (!r) return; if (!(isAdm() || (mine(r) && r.status === 'Draft'))) return;
    if (!confirm('Delete this expense? (' + INR(r.amount) + ')')) return;
    try { if (window.cloudSync && window.cloudSync.deleteItem) window.cloudSync.deleteItem('EXPENSES', id); } catch (e) {}
    expensesData = (expensesData || []).filter(function (x) { return x && x.id !== id; }); persist(); tt14Close('tt15ViewModal'); tt15Render();
  };

  /* --- export --- */
  function exportList() { return scoped().filter(function (r) { return S.st === 'ALL' || r.status === S.st; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }); }
  window.tt15Csv = function () {
    var l = exportList(); if (!l.length) { notice('Nothing here', 'No expenses to export', '⚠️'); return; }
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var rows = [['Date', 'Employee', 'Category', 'Sub', 'Merchant', 'Trip', 'Payment', 'Amount', 'Status', 'Notes', 'Reviewed By', 'Review Note', 'Paid Ref'].map(q).join(',')];
    l.forEach(function (r) { rows.push([r.date, r.emp, r.cat, r.sub, r.merchant, r.trip, r.payMode, r.amount, r.status, r.notes, r.reviewedBy, r.reviewNote, r.paidRef].map(q).join(',')); });
    downloadFile('﻿' + rows.join('\n'), 'TTESPL_Expenses_' + (S.all ? 'All' : S.month) + '.csv', 'text/csv');
  };
  window.tt15Pdf = function () {
    var l = exportList(); if (!l.length) { notice('Nothing here', 'No expenses for the report', '⚠️'); return; }
    var valid = l.filter(function (r) { return r.status !== 'Rejected'; }), tot = sum(valid), cats = {};
    valid.forEach(function (r) { cats[r.cat] = (cats[r.cat] || 0) + (+r.amount || 0); });
    var emp = isAdm() ? (S.emp === 'ALL' ? 'All Employees' : S.emp) : meName(), td = 'style="border:1px solid #000;padding:4px 6px;"';
    var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11px;"><div style="text-align:center;"><div style="font-size:15px;font-weight:800;">TWINTOWN EXPRESS SERVICES PVT LTD</div><div style="font-size:10px;">Satya Vihar, Rasulgarh, Bhubaneswar-751010</div><div style="font-size:14px;font-weight:800;margin:8px 0;border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;">EXPENSE REPORT</div></div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr><td ' + td + '><b>Employee:</b> ' + H(emp) + '</td><td ' + td + '><b>Period:</b> ' + H(S.all ? 'All dates' : monthLabel(S.month)) + '</td><td ' + td + '><b>Status:</b> ' + H(S.st === 'ALL' ? 'All' : S.st) + '</td><td ' + td + '><b>Generated:</b> ' + H(new Date().toLocaleDateString('en-GB')) + '</td></tr></table>' +
      '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#eee;">' + ['#', 'Date', 'Employee', 'Category', 'Merchant / Trip', 'Pay', 'Status', 'Amount (₹)'].map(function (x) { return '<th ' + td + '>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
      l.map(function (r, i) { return '<tr><td ' + td + '>' + (i + 1) + '</td><td ' + td + '>' + H(fmtD(r.date)) + '</td><td ' + td + '>' + H(r.emp) + '</td><td ' + td + '>' + H(catName(r)) + '</td><td ' + td + '>' + H([r.merchant, r.trip].filter(Boolean).join(' / ')) + '</td><td ' + td + '>' + H(r.payMode) + '</td><td ' + td + '>' + H(r.status) + '</td><td ' + td + ' align="right">' + (+r.amount).toFixed(2) + '</td></tr>'; }).join('') +
      '<tr><td ' + td + ' colspan="7" align="right"><b>Total (excluding Rejected)</b></td><td ' + td + ' align="right"><b>' + tot.toFixed(2) + '</b></td></tr></tbody></table>' +
      '<div style="display:flex;gap:16px;margin-top:10px;"><table style="border-collapse:collapse;flex:1;"><tr><th ' + td + ' colspan="2" style="background:#eee;">Category-wise</th></tr>' + Object.keys(cats).map(function (k) { return '<tr><td ' + td + '>' + H(k) + '</td><td ' + td + ' align="right">' + cats[k].toFixed(2) + '</td></tr>'; }).join('') + '</table>' +
      '<table style="border-collapse:collapse;flex:1;"><tr><th ' + td + ' colspan="2" style="background:#eee;">Status-wise</th></tr>' + ST.map(function (s) { return '<tr><td ' + td + '>' + s + '</td><td ' + td + ' align="right">' + sum(l, s).toFixed(2) + '</td></tr>'; }).join('') + '</table></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:46px;font-size:11px;"><div style="border-top:1px solid #000;padding-top:3px;width:30%;text-align:center;">Employee Signature</div><div style="border-top:1px solid #000;padding-top:3px;width:30%;text-align:center;">Approved By</div><div style="border-top:1px solid #000;padding-top:3px;width:30%;text-align:center;">Accounts</div></div>';
    var rec = l.filter(function (r) { return r.receipt; });
    if (rec.length) html += '<div style="page-break-before:always;font-weight:800;font-size:13px;margin-bottom:8px;">Receipts (' + rec.length + ')</div><div style="display:flex;flex-wrap:wrap;gap:10px;">' + rec.map(function (r) { return '<div style="width:31%;font-size:9px;"><img src="' + r.receipt + '" style="width:100%;border:1px solid #999;"><div>' + H(fmtD(r.date) + ' · ' + catName(r) + ' · ₹' + r.amount) + '</div></div>'; }).join('') + '</div>';
    ttPrintHtml('Expense Report', html + '</div>');
  };

  /* --- badge / reminders --- */
  window.tt15Badge = function badge() {
    try {
      var it = Array.prototype.find.call(document.querySelectorAll('.profile-menu-item'), function (e) { return (e.getAttribute('onclick') || '').indexOf('ttExpOpen') >= 0; });
      if (!it) return; var s = it.lastElementChild; if (!s) return;
      var l = (expensesData || []).filter(visible), txt = 'Claim & Track', col = '#34d399';
      if (isAdm()) { var n = l.filter(function (r) { return r.status === 'Submitted'; }).length; if (n) { txt = n + ' awaiting approval'; col = '#f59e0b'; } }
      else { var rj = l.filter(function (r) { return r.status === 'Rejected'; }).length, dr = l.filter(function (r) { return r.status === 'Draft'; }).length; if (rj) { txt = rj + ' reject'; col = '#f87171'; } else if (dr) { txt = dr + ' draft'; col = '#fbbf24'; } }
      s.textContent = txt; s.style.color = col; s.style.fontWeight = '800';
    } catch (e) {}
  };
  var badge = window.tt15Badge;
  setTimeout(function () { badge(); try {
    if (isAdm()) { var n = (expensesData || []).filter(function (r) { return r.status === 'Submitted'; }).length, key = 'TTESPL_ERP_EXP_TOAST_DAY', d = today();
      if (n && lsGet(key) !== d) { lsSet(key, d); notice('💼 Expense Approval', n + ' expense claim(s) awaiting approval', '💼', function () { ttExpOpen(); }); } }
  } catch (e) {} }, 9500);

  /* ================= PURANE BILLS: MRP / DISCOUNT / HSN BACKFILL ================= */
  window.ttBillsFixOpen = function () {
    if (!isAdm()) { alert('Only an Admin can do this.'); return; }
    var inv = Array.isArray(sampleInventory) ? sampleInventory : [], DEF = '84139190', plan = { bills: 0, items: 0, hsn: 0, disc: 0 }, changes = [];
    var find = function (it) { var nm = String(it.name || '').trim().toLowerCase(); return inv.filter(function (x) { return it.id != null && String(x.id) === String(it.id); })[0] || inv.filter(function (x) { return nm && String(x.name || '').trim().toLowerCase() === nm; })[0]; };
    (ordersData || []).forEach(function (o) {
      if (!o || o.status === 'Cancelled') return; var hit = false;
      (o.items || []).forEach(function (it) {
        var p = find(it); if (!p) return; var c = {};
        var h = String(it.hsn || '').trim(), ph = String(p.hsn || '').trim();
        if ((!h || h === DEF) && ph && ph !== DEF) c.hsn = ph;
        var qty = Number(it.qty) || 1, incl = (Number(it.total) || 0) / qty, mrp = Number(it.mrp) || 0, disc = Number(it.disc) || 0;
        if (!(mrp > 0) && !(disc > 0) && Number(p.rate) > incl + 0.5) { c.mrp = Number(p.rate); c.disc = Math.round((1 - incl / c.mrp) * 10000) / 100; }
        if (Object.keys(c).length) { changes.push([it, c]); plan.items++; hit = true; if (c.hsn) plan.hsn++; if (c.disc != null) plan.disc++; }
      });
      if (hit) plan.bills++;
    });
    if (!changes.length) { alert('MRP / Discount / HSN in all old bills are already correct (or their items were not found in Stock). Nothing to change.'); return; }
    if (!confirm('Fill the blank MRP / Discount / HSN in old bills?\n\n' + plan.bills + ' bills, ' + plan.items + ' items\n• HSN corrected: ' + plan.hsn + '\n• MRP + Discount will be filled: ' + plan.disc +
      '\n\nNote: MRP is taken from the current customer rate in Stock; discount = the difference between MRP and the bill rate. The bill total / amount / GST will not change at all.\nA backup file will be downloaded automatically first. Continue?')) return;
    try { downloadFullBackup(); } catch (e) {}
    changes.forEach(function (x) { Object.assign(x[0], x[1]); });
    setStored("ORDERS", ordersData);
    try { if (typeof renderBilling === 'function') renderBilling('all'); } catch (e) {}
    notice('Bills corrected', plan.bills + ' bills · ' + plan.items + ' items updated', '🧮');
  };
  var _ob = window.openBackupModal;
  window.openBackupModal = function () {
    var r = _ob.apply(this, arguments);
    try {
      var m = $('backupModal'); if (m && isAdm() && !$('ttBillsFixBtn')) {
        var card = m.querySelector('.auth-card'), b = document.createElement('button');
        b.id = 'ttBillsFixBtn'; b.className = 'btn btn-outline btn-block'; b.style.marginTop = '8px'; b.textContent = '🧮 Fix MRP / Discount / HSN of old bills';
        b.onclick = function () { triggerAppHaptic(); ttBillsFixOpen(); }; card.appendChild(b);
      }
    } catch (e) {}
    return r;
  };

  /* ================= PERFORMANCE HELPERS ================= */
  (function perf() {
    var tm = 0, on = false;
    window.addEventListener('scroll', function () {
      if (!on) { document.body.classList.add('tt-scrolling'); on = true; }
      clearTimeout(tm); tm = setTimeout(function () { document.body.classList.remove('tt-scrolling'); on = false; }, 160);
    }, { capture: true, passive: true });
    ['handleCustomerAutocomplete', 'handleMachineAutocomplete', 'handlePartAutocomplete', 'handleOrderItemInput', 'handleQuotCustomerAutocomplete', 'handleQuotItemInput', 'handleCrmCustomerAutocomplete'].forEach(function (n) {
      var f = window[n]; if (typeof f !== 'function' || f.__tt16) return; var last = 0, t = null;
      var w = function () {
        var a = arguments, c = this, now = Date.now(); clearTimeout(t);
        if (now - last >= 140) { last = now; return f.apply(c, a); }
        t = setTimeout(function () { last = Date.now(); f.apply(c, a); }, 140 - (now - last));
      };
      w.__tt16 = true; window[n] = w;
    });
  })();
})();


/* =====================================================================
   v17: Advance payment photo (Orders) | header logo runner (right->left)
   ===================================================================== */
var ttPayProofs = [];
(function () {
  var MAXP = 3;
  function $(i) { return document.getElementById(i); }
  function E(s) { return (typeof ttH === 'function') ? ttH(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function readC(file) {
    return new Promise(function (res) {
      var r = new FileReader();
      r.onload = function (e) { ttCompressImageSafe(e.target.result, 900, 0.6, 100000).then(res, function () { res(''); }); };
      r.onerror = function () { res(''); };
      r.readAsDataURL(file);
    });
  }
  window.ttPayDraw = function () {
    var box = $('ordPayProofList'); if (!box) return;
    box.innerHTML = ttPayProofs.length ? ttPayProofs.map(function (s, i) {
      return '<span style="position:relative;display:inline-block;"><img src="' + E(s) + '" onclick="ttPayView(ttPayProofs[' + i + '])" style="width:64px;height:64px;object-fit:cover;border-radius:12px;border:1px solid var(--border);cursor:pointer;">' +
        '<button type="button" onclick="ttPayRemove(' + i + ')" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:0;background:#ef4444;color:#fff;font-size:11px;line-height:20px;padding:0;">✕</button></span>';
    }).join('') : '<span style="font-size:11.5px;color:var(--text-muted);">No photo yet</span>';
    var add = $('ordPayAddBtn'); if (add) add.style.display = ttPayProofs.length >= MAXP ? 'none' : '';
  };
  window.ttPayToggle = function () {
    var w = $('ordPayProofBox'); if (!w) return;
    var recv = parseFloat(($('ordRecvAmt') || {}).value) || 0;
    w.style.display = (recv > 0 || ttPayProofs.length) ? 'block' : 'none';
  };
  window.ttPayPick = function (inp) {
    var fs = Array.prototype.slice.call(inp.files || []); inp.value = '';
    (function next() {
      if (!fs.length || ttPayProofs.length >= MAXP) { ttPayDraw(); return; }
      readC(fs.shift()).then(function (d) { if (d) ttPayProofs.push(d); next(); });
    })();
  };
  window.ttPayRemove = function (i) { ttPayProofs.splice(i, 1); ttPayDraw(); ttPayToggle(); };
  window.ttPayView = function (src) {
    var m = $('ttPayViewModal');
    if (!m) { m = document.createElement('div'); m.id = 'ttPayViewModal'; m.className = 'auth-overlay'; m.style.cssText = 'display:none;z-index:3700;'; document.body.appendChild(m); }
    m.innerHTML = '<div class="auth-card" style="max-width:520px;max-height:92vh;overflow:auto;"><div class="card-header"><span class="card-title">🧾 Payment Proof</span><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'ttPayViewModal\').style.display=\'none\'">✕</button></div><img src="' + E(src) + '" style="width:100%;border-radius:12px;"></div>';
    m.style.display = 'flex';
  };
  // order card se seedha photo add
  var quickId = '';
  window.ttPayQuick = function (id) {
    quickId = id; var f = $('ttPayQuickInput');
    if (!f) { f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.multiple = true; f.id = 'ttPayQuickInput'; f.style.display = 'none'; f.onchange = ttPayQuickDone; document.body.appendChild(f); }
    f.click();
  };
  function ttPayQuickDone() {
    var f = this, o = ordersData.find(function (x) { return x.id === quickId; });
    var fs = Array.prototype.slice.call(f.files || []); f.value = ''; if (!o) return;
    o.payProofs = o.payProofs || [];
    (function next() {
      if (!fs.length || o.payProofs.length >= MAXP) { setStored('ORDERS', ordersData); renderOrders(); return; }
      readC(fs.shift()).then(function (d) { if (d) o.payProofs.push(d); next(); });
    })();
  }
  window.ttPayRemoveQuick = function (id, i) {
    if (!confirm('Ye payment photo hatayein?')) return;
    var o = ordersData.find(function (x) { return x.id === id; }); if (!o || !o.payProofs) return;
    o.payProofs.splice(i, 1); setStored('ORDERS', ordersData); renderOrders();
  };
  window.ttPayCardHtml = function (o) {
    var recv = Number(o.recvAmount) || 0, ps = o.payProofs || [];
    if (!recv && !ps.length) return '';
    var th = ps.map(function (s, i) {
      return '<span style="position:relative;display:inline-block;"><img src="' + E(s) + '" data-i="' + i + '" style="width:52px;height:52px;object-fit:cover;border-radius:10px;border:1px solid var(--border);cursor:pointer;" class="tt-payth" data-o="' + E(o.id) + '">' +
        '<button type="button" onclick="ttPayRemoveQuick(\'' + E(o.id) + '\',' + i + ')" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:0;background:#ef4444;color:#fff;font-size:10px;line-height:18px;padding:0;">✕</button></span>';
    }).join('');
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px;padding:8px 10px;border-radius:10px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);">' +
      '<span style="font-size:12px;font-weight:800;color:var(--success,#10b981);">💰 Advance ₹' + recv.toLocaleString('en-IN') + (o.payMode ? ' · ' + E(o.payMode) : '') + '</span>' + th +
      (ps.length < MAXP ? '<button type="button" class="btn btn-outline btn-sm" style="margin-left:auto;" onclick="triggerAppHaptic(); ttPayQuick(\'' + E(o.id) + '\')">📷 Payment Photo</button>' : '') + '</div>';
  };
  // thumbnail tap (delegated) - order ke payProofs se full image
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.classList || !t.classList.contains('tt-payth')) return;
    var o = ordersData.find(function (x) { return x.id === t.getAttribute('data-o'); });
    var s = o && o.payProofs && o.payProofs[+t.getAttribute('data-i')]; if (s) ttPayView(s);
  });
  // header runner ko footer wale logo ka image de do (duplicate base64 nahi)
  try { var a = document.querySelector('.tt-runner-img'), b = document.querySelector('.tt-hdr-runimg'); if (a && b) b.src = a.src; } catch (e) {}
})();


/* =====================================================================
   v21: exact billing math | Ledger date-range report + PDF | employee-wise
   ledger summary with partial payments | staff report drill-down
   (old data / formulas untouched - only display + new helpers)
   ===================================================================== */
var ttR2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
function ttDueOf(o) { return Math.max(0, ttR2((Number(o.totalAmount) || 0) - (Number(o.recvAmount) || 0))); }
function ttDateOf(o) { return String(o.deliveredDate || o.orderDate || '').slice(0, 10); }
function ttStatusOf(o) {
  var due = ttDueOf(o), rcv = Number(o.recvAmount) || 0;
  return due <= 0.005 ? 'Paid' : (rcv > 0.005 ? 'Partial' : 'Unpaid');
}
window.ttR2 = ttR2; window.ttDueOf = ttDueOf; window.ttStatusOf = ttStatusOf;

(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var E = function (s) { return (typeof esc === 'function') ? esc(String(s == null ? '' : s)) : String(s == null ? '' : s); };
  var FM = function (n) { return '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  function preset(k) {
    var t = new Date(), a = new Date(t), b = new Date(t);
    if (k === 'today') { /* same */ }
    else if (k === '7d') { a.setDate(a.getDate() - 6); }
    else if (k === 'month') { a = new Date(t.getFullYear(), t.getMonth(), 1); }
    else if (k === 'lastmonth') { a = new Date(t.getFullYear(), t.getMonth() - 1, 1); b = new Date(t.getFullYear(), t.getMonth(), 0); }
    else if (k === 'fy') { a = new Date(t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1, 3, 1); }
    else return ['', ''];
    return [ymd(a), ymd(b)];
  }
  var PRESETS = [['today', 'Today'], ['7d', 'Last 7 Days'], ['month', 'This Month'], ['lastmonth', 'Last Month'], ['fy', 'This FY'], ['all', 'All Time']];

  /* ---- payment trail: advance + later part payments ---- */
  function payLines(o) {
    var arr = Array.isArray(o.payments) ? o.payments : [], sum = 0, out = [];
    arr.forEach(function (p) {
      var a = Number(p.amount) || 0; sum += a;
      out.push({ date: String(p.at || '').slice(0, 10) || ttDateOf(o), amt: a, mode: p.mode || '', by: p.by || '', kind: 'Part payment', o: o });
    });
    var adv = ttR2((Number(o.recvAmount) || 0) - sum);
    if (adv > 0.005) out.unshift({ date: String(o.orderDate || ttDateOf(o)).slice(0, 10), amt: adv, mode: o.payMode || '', by: o.bookedBy || '', kind: arr.length ? 'Advance' : 'Payment at billing', o: o });
    return out;
  }
  window.ttPayLines = payLines;

  /* ---- query ---- */
  function query(f) {
    var list = (ordersData || []).filter(function (o) { return o && o.status === 'Delivered'; });
    if (f.emp && f.emp !== 'ALL') list = list.filter(function (o) { return (o.bookedBy || 'Unassigned') === f.emp; });
    if (f.from) list = list.filter(function (o) { return ttDateOf(o) >= f.from; });
    if (f.to) list = list.filter(function (o) { return ttDateOf(o) <= f.to; });
    list = list.slice().sort(function (a, b) {
      var da = ttDateOf(a), db = ttDateOf(b);
      if (da !== db) return da < db ? 1 : -1;
      return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
    });
    return list;
  }
  function totals(list) {
    var T = { n: 0, billed: 0, recv: 0, due: 0, paid: 0, partial: 0, unpaid: 0 };
    list.forEach(function (o) {
      T.n++; T.billed += Number(o.totalAmount) || 0; T.recv += Number(o.recvAmount) || 0; T.due += ttDueOf(o);
      var s = ttStatusOf(o); if (s === 'Paid') T.paid++; else if (s === 'Partial') T.partial++; else T.unpaid++;
    });
    T.billed = ttR2(T.billed); T.recv = ttR2(T.recv); T.due = ttR2(T.due);
    return T;
  }
  function byType(list, type) {
    if (type === 'due') return list.filter(function (o) { return ttDueOf(o) > 0.005; });
    if (type === 'received') return list.filter(function (o) { return ttDueOf(o) <= 0.005; });
    if (type === 'partial') return list.filter(function (o) { return ttStatusOf(o) === 'Partial'; });
    return list;
  }
  function byStaff(list) {
    var m = {};
    list.forEach(function (o) {
      var k = o.bookedBy || 'Unassigned', x = m[k] = m[k] || { name: k, list: [] };
      x.list.push(o);
    });
    return Object.keys(m).map(function (k) { var x = m[k]; x.T = totals(x.list); return x; }).sort(function (a, b) { return b.T.billed - a.T.billed; });
  }
  function periodLabel(f) {
    if (!f.from && !f.to) return 'All dates';
    return (f.from || 'Start') + '  to  ' + (f.to || 'Today');
  }

  /* ---- report html (used for PDF) ---- */
  function reportHtml(title, f, list, withStaff) {
    var T = totals(list), B = 'border:1px solid #444;padding:3px 5px;', th = B + 'background:#e8eef5;font-weight:700;text-align:left;', num = B + 'text-align:right;';
    var h = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#000;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0a2540;padding-bottom:6px;margin-bottom:8px;">' +
      '<div><div style="font-size:16px;font-weight:800;">TWINTOWN EXPRESS SERVICES PVT LTD</div><div style="font-size:9.5px;">Plot 1270/8566, Satya Vihar, Rasulgarh, Bhubaneswar - 751010</div></div>' +
      '<div style="text-align:right;"><div style="font-size:14px;font-weight:800;">' + E(title) + '</div><div style="font-size:9.5px;">Generated: ' + E(new Date().toLocaleString('en-IN')) + '</div></div></div>' +
      '<div style="margin-bottom:8px;"><b>Period:</b> ' + E(periodLabel(f)) + ' &nbsp;|&nbsp; <b>Staff:</b> ' + E(f.emp && f.emp !== 'ALL' ? f.emp : 'All staff') +
      (f.type && f.type !== 'all' ? ' &nbsp;|&nbsp; <b>Filter:</b> ' + E({ due: 'Due only', received: 'Fully paid', partial: 'Partially paid' }[f.type] || f.type) : '') + '</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;"><tr>' +
      [['Invoices', T.n], ['Total Sales', FM(T.billed)], ['Collected', FM(T.recv)], ['Due', FM(T.due)], ['Paid / Partial / Unpaid', T.paid + ' / ' + T.partial + ' / ' + T.unpaid]].map(function (x) {
        return '<td style="' + B + 'text-align:center;"><div style="font-size:9px;">' + x[0] + '</div><div style="font-size:13px;font-weight:800;">' + x[1] + '</div></td>'; }).join('') + '</tr></table>';
    if (withStaff) {
      var st = byStaff(list);
      if (st.length > 1) {
        h += '<div style="font-weight:800;margin:6px 0 3px;">Staff-wise Summary</div><table style="width:100%;border-collapse:collapse;margin-bottom:10px;"><tr><th style="' + th + '">Staff</th><th style="' + th + '">Invoices</th><th style="' + th + '">Total Sales</th><th style="' + th + '">Collected</th><th style="' + th + '">Due</th></tr>' +
          st.map(function (x) { return '<tr><td style="' + B + '">' + E(x.name) + '</td><td style="' + num + '">' + x.T.n + '</td><td style="' + num + '">' + FM(x.T.billed) + '</td><td style="' + num + '">' + FM(x.T.recv) + '</td><td style="' + num + '">' + FM(x.T.due) + '</td></tr>'; }).join('') + '</table>';
      }
    }
    h += '<div style="font-weight:800;margin:6px 0 3px;">Sales Details</div><table style="width:100%;border-collapse:collapse;"><tr><th style="' + th + '">#</th><th style="' + th + '">Date</th><th style="' + th + '">Invoice</th><th style="' + th + '">Customer</th><th style="' + th + '">Staff</th><th style="' + th + '">Total</th><th style="' + th + '">Received</th><th style="' + th + '">Due</th><th style="' + th + '">Status</th></tr>' +
      (list.length ? list.map(function (o, i) {
        return '<tr><td style="' + B + '">' + (i + 1) + '</td><td style="' + B + '">' + E(ttDateOf(o)) + '</td><td style="' + B + '">' + E(o.id) + '</td><td style="' + B + '">' + E(o.customerName) + '</td><td style="' + B + '">' + E(o.bookedBy || '-') + '</td><td style="' + num + '">' + FM(o.totalAmount) + '</td><td style="' + num + '">' + FM(o.recvAmount) + '</td><td style="' + num + '">' + FM(ttDueOf(o)) + '</td><td style="' + B + '">' + ttStatusOf(o) + '</td></tr>'; }).join('')
        : '<tr><td colspan="9" style="' + B + 'text-align:center;">No sales found for this filter.</td></tr>') +
      '<tr style="font-weight:800;background:#f3f6fa;"><td colspan="5" style="' + num + '">TOTAL</td><td style="' + num + '">' + FM(T.billed) + '</td><td style="' + num + '">' + FM(T.recv) + '</td><td style="' + num + '">' + FM(T.due) + '</td><td style="' + B + '"></td></tr></table>';
    var pays = []; list.forEach(function (o) { payLines(o).forEach(function (p) { pays.push(p); }); });
    if (pays.length) {
      pays.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      h += '<div style="font-weight:800;margin:12px 0 3px;">Payment Details (advance &amp; part payments)</div><table style="width:100%;border-collapse:collapse;"><tr><th style="' + th + '">Date</th><th style="' + th + '">Invoice</th><th style="' + th + '">Customer</th><th style="' + th + '">Type</th><th style="' + th + '">Mode</th><th style="' + th + '">Received by</th><th style="' + th + '">Amount</th></tr>' +
        pays.map(function (p) { return '<tr><td style="' + B + '">' + E(p.date) + '</td><td style="' + B + '">' + E(p.o.id) + '</td><td style="' + B + '">' + E(p.o.customerName) + '</td><td style="' + B + '">' + p.kind + '</td><td style="' + B + '">' + E(p.mode) + '</td><td style="' + B + '">' + E(p.by) + '</td><td style="' + num + '">' + FM(p.amt) + '</td></tr>'; }).join('') + '</table>';
    }
    return h + '<div style="margin-top:14px;font-size:9px;text-align:center;">This is a computer generated report.</div></div>';
  }
  function csvOf(list) {
    var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    var rows = [['Date', 'Invoice', 'Customer', 'Staff', 'Total', 'Received', 'Due', 'Status', 'Payments (date: amount mode)'].map(q).join(',')];
    list.forEach(function (o) {
      rows.push([ttDateOf(o), o.id, o.customerName, o.bookedBy || '', ttR2(o.totalAmount), ttR2(o.recvAmount), ttDueOf(o), ttStatusOf(o),
        payLines(o).map(function (p) { return p.date + ': ' + p.amt + ' ' + p.mode; }).join(' | ')].map(q).join(','));
    });
    return '﻿' + rows.join('\r\n');
  }

  /* =================== LEDGER =================== */
  var L = { from: '', to: '', emp: 'ALL', type: 'all' };
  window.__ttLedState = L;
  function chips(cur, onclickFn) {
    return '<div class="tt21-chips">' + PRESETS.map(function (p) {
      var r = preset(p[0]), on = (r[0] === (cur.from || '') && r[1] === (cur.to || ''));
      return '<button type="button" class="' + (on ? 'on' : '') + '" onclick="triggerAppHaptic(); ' + onclickFn + '(\'' + p[0] + '\')">' + p[1] + '</button>'; }).join('') + '</div>';
  }
  function ledgerBar() {
    var bar = $('ttLedBar'); if (!bar) return;
    var statuses = [['all', 'All'], ['due', 'Due'], ['partial', 'Partial'], ['received', 'Paid']];
    var isOpen = bar.classList.contains('open');
    bar.classList.add('tt-acc'); if (isOpen) bar.classList.add('open');
    var accSub = ((L.from || L.to) ? periodLabel(L) : 'All dates') + (L.emp !== 'ALL' ? ' · ' + L.emp : '') + (L.type !== 'all' ? ' · ' + ({ due: 'Due', partial: 'Partial', received: 'Paid' }[L.type] || L.type) : '');
    bar.innerHTML = '<button type="button" class="tt-acc-h" id="ttLedBarH" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-controls="ttLedBarBody" onclick="ttAccToggle(\'ttLedBar\')"><span class="tt-acc-ic">📅</span><span class="tt-acc-t"><b>Sales Report Filter</b><small>' + E(accSub) + '</small></span><svg class="tt-acc-chev" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7.5l5 5 5-5"/></svg></button>' +
      '<div class="tt-acc-b" id="ttLedBarBody" role="region" aria-labelledby="ttLedBarH"><div class="tt-acc-in"><div class="tt-acc-pad">' +
      '<div class="grid-2" style="margin-top:10px;"><div class="form-group" style="margin-bottom:6px;"><label class="form-label">From date</label><input type="date" id="ttLedFrom" value="' + E(L.from) + '" onchange="ttLedSet()"></div>' +
      '<div class="form-group" style="margin-bottom:6px;"><label class="form-label">To date</label><input type="date" id="ttLedTo" value="' + E(L.to) + '" onchange="ttLedSet()"></div></div>' +
      chips(L, 'ttLedPreset') +
      '<div class="form-group" style="margin:8px 0 6px;"><label class="form-label">👤 Staff (booked by)</label><select id="billingEmployeeFilter" onchange="filterBillingByEmployee(this.value)"></select></div>' +
      '<div class="tt21-chips">' + statuses.map(function (s) { return '<button type="button" class="' + (L.type === s[0] ? 'on' : '') + '" onclick="triggerAppHaptic(); filterBilling(\'' + s[0] + '\')">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;"><button class="btn btn-primary btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttLedPdf()">📄 Download PDF Report</button><button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttLedCsv()">⬇️ CSV</button></div>' +
      '</div></div></div>';
    var sel = $('billingEmployeeFilter');
    sel.innerHTML = '<option value="ALL">All Staff Combined</option>' + (registeredEmployees || []).map(function (e) { return '<option value="' + E(e.name) + '">' + E(e.name) + ' — [' + E(e.role) + ']</option>'; }).join('');
    sel.value = L.emp;
    if (sel.value !== L.emp) { var op = document.createElement('option'); op.value = L.emp; op.textContent = L.emp; sel.appendChild(op); sel.value = L.emp; }
  }
  window.ttLedSet = function () { L.from = ($('ttLedFrom') || {}).value || ''; L.to = ($('ttLedTo') || {}).value || ''; renderBilling(); };
  window.ttLedPreset = function (k) { var r = preset(k); L.from = r[0]; L.to = r[1]; renderBilling(); };
  window.filterBilling = function (type) { L.type = type || 'all'; renderBilling(); };
  window.filterBillingByEmployee = function (name) { L.emp = name || 'ALL'; L.type = 'all'; renderBilling(); };
  window.ttLedPdf = function () {
    var list = byType(query(L), L.type);
    ttPrintHtml('Sales Report', reportHtml('SALES REPORT', L, list, L.emp === 'ALL'));
  };
  window.ttLedCsv = function () {
    var list = byType(query(L), L.type);
    downloadFile(csvOf(list), 'sales-report-' + (L.from || 'all') + '_to_' + (L.to || 'today') + '.csv', 'text/csv;charset=utf-8');
  };

  function empSummary(all) {
    var box = $('ttLedEmpSummary'); if (!box) return;
    var h = '';
    if (L.emp !== 'ALL') {
      var T = totals(all), pays = [];
      all.forEach(function (o) { payLines(o).forEach(function (p) { pays.push(p); }); });
      pays.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      var part = pays.filter(function (p) { return p.kind === 'Part payment'; });
      h = '<div class="card tt21-emp"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><strong style="font-size:14px;">👤 ' + E(L.emp) + '</strong>' +
        '<button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); ttStaffReport(\'' + E(L.emp).replace(/&#39;/g, "\\'") + '\')">Full Report ›</button></div>' +
        '<div class="grid-3" style="margin:10px 0 8px;"><div class="tt21-tile"><small>TOTAL SALES</small><b>' + FM(T.billed) + '</b></div><div class="tt21-tile ok"><small>COLLECTED</small><b>' + FM(T.recv) + '</b></div><div class="tt21-tile bad"><small>DUE</small><b>' + FM(T.due) + '</b></div></div>' +
        '<div style="font-size:12px;display:flex;gap:12px;flex-wrap:wrap;"><span>🧾 ' + T.n + ' invoices</span><span style="color:var(--success);">✅ Paid ' + T.paid + '</span><span style="color:#d97706;">🟡 Partial ' + T.partial + '</span><span style="color:var(--danger);">🔴 Unpaid ' + T.unpaid + '</span></div>' +
        (part.length ? '<div class="tt21-sec">💵 Partial payments received (' + part.length + ')</div>' + part.slice(0, 12).map(function (p) {
          return '<div class="tt21-pay"><span>' + E(p.date) + ' · ' + E(p.o.customerName) + ' <i>(' + E(p.o.id) + ')</i></span><b>' + FM(p.amt) + '</b></div>'; }).join('') + (part.length > 12 ? '<div style="font-size:11px;opacity:.7;">+' + (part.length - 12) + ' more in the PDF report</div>' : '') : '<div class="tt21-sec" style="opacity:.7;">No partial payments in this period.</div>') + '</div>';
    } else {
      var st = [];
      if (st.length) h = '<div class="card tt21-emp"><div class="tt21-sec" style="margin-top:0;">👥 Staff-wise Sales (tap a name)</div>' + st.map(function (x) {
        return '<div class="tt21-staff" onclick="triggerAppHaptic(); filterBillingByEmployee(\'' + E(x.name).replace(/&#39;/g, "\\'") + '\')"><div style="min-width:0;flex:1;"><b>' + E(x.name) + '</b><div style="font-size:11px;opacity:.75;">' + x.T.n + ' invoices · Collected ' + FM(x.T.recv) + '</div></div><div style="text-align:right;"><b>' + FM(x.T.billed) + '</b><div style="font-size:11px;color:' + (x.T.due > 0 ? 'var(--danger)' : 'var(--success)') + ';">Due ' + FM(x.T.due) + '</div></div></div>'; }).join('') + '</div>';
    }
    box.innerHTML = h;
  }

  window.renderBilling = function (filterType, empFilter) {
    if (filterType) L.type = filterType;
    if (empFilter) L.emp = empFilter;
    var container = $('billingListContainer'); if (!container) return;
    if (!$('ttLedBar')) {
      var old = $('billingEmployeeFilter'), oldCard = old ? old.closest('.card') : null;
      var bar = document.createElement('div'); bar.id = 'ttLedBar'; bar.className = 'card tt21-bar';
      var sum = document.createElement('div'); sum.id = 'ttLedEmpSummary';
      if (oldCard && oldCard.parentNode) { oldCard.parentNode.insertBefore(bar, oldCard); oldCard.parentNode.insertBefore(sum, oldCard); oldCard.remove(); }
      else container.parentNode.insertBefore(bar, container);
    }
    ledgerBar();
    var all = query(L), T = totals(byType(all, L.type)), list = byType(all, L.type);
    $('metricTotalBilled').textContent = FM(T.billed);
    $('metricTotalRecv').textContent = FM(T.recv);
    $('metricTotalDue').textContent = FM(T.due);
    empSummary(all);
    var label = { all: 'Delivered Tax Invoices', due: '🔴 Due Customers Only', partial: '🟡 Partially Paid', received: '🟢 Fully Paid' }[L.type] || 'Invoices';
    $('billingFilterTitle').textContent = label + ' (' + list.length + ')' + ((L.from || L.to) ? ' · ' + periodLabel(L) : '');
    container.innerHTML = '';
    if (!list.length) { container.innerHTML = '<div style="text-align:center;padding:25px;color:var(--text-muted);font-size:12.5px;">No invoices found for this filter.</div>'; return; }
    var today = ymd(new Date());
    list.slice(0, 120).forEach(function (o) {
      var due = ttDueOf(o), st = ttStatusOf(o), lines = payLines(o);
      var card = document.createElement('div'); card.className = 'card';
      var badge = st === 'Paid' ? '<span class="badge badge-delivered">Paid</span>' : (st === 'Partial' ? '<span class="badge badge-pending">Partial · Due ' + FM(due) + '</span>' : '<span class="badge badge-danger">Due: ' + FM(due) + '</span>');
      card.innerHTML =
        '<div class="card-header" style="cursor:pointer;" onclick="if(!event.target.closest(\'button\')){ triggerAppHaptic(); openLedgerDetail(\'' + E(o.id) + '\'); }">' +
        '<div><strong style="font-size:15px;color:var(--text-main);">' + E(o.customerName) + '</strong>' +
        '<div style="font-size:11.5px;color:var(--text-muted);">Invoice: ' + E(o.id) + ' | Delivered: ' + E(o.deliveredDate || o.orderDate) + ' | Staff: ' + E(o.bookedBy || '-') + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:6px;">' + badge + '<button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); openAdminEditLedgerModal(\'' + E(o.id) + '\')">✏️</button></div></div>' +
        '<div class="tt21-amts"><span>Total <b>' + FM(o.totalAmount) + '</b></span><span style="color:var(--success);">Received <b>' + FM(o.recvAmount) + '</b></span><span style="color:' + (due > 0 ? 'var(--danger)' : 'var(--success)') + ';">Due <b>' + FM(due) + '</b></span></div>' +
        (lines.length > 1 || (lines.length === 1 && st !== 'Paid') ? '<div class="tt21-trail">' + lines.map(function (p) { return '<span>' + E(p.date) + ' · ' + FM(p.amt) + (p.mode ? ' · ' + E(p.mode) : '') + '</span>'; }).join('') + '</div>' : '') +
        ((due > 0 && o.payFollowupDate) ? '<div style="margin-top:8px;font-size:12px;font-weight:800;color:' + (o.payFollowupDate <= today ? 'var(--danger)' : 'var(--warning,#d97706)') + ';">📅 Payment follow-up: ' + E(o.payFollowupDate) + (o.payFollowupNote ? ' — ' + E(o.payFollowupNote) : '') + '</div>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' +
        '<button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openLedgerDetail(\'' + E(o.id) + '\')">📄 Details</button>' +
        '<button class="btn btn-print btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openInvoicePrintModal(\'' + E(o.id) + '\')">🖨️ Tax Invoice</button>' +
        '<button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openUpiModal(\'' + E(o.customerName).replace(/&#39;/g, "\\'") + '\', ' + (due > 0 ? due : (Number(o.totalAmount) || 0)) + ')">📱 UPI QR</button>' +
        (due > 0 ? '<button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); collectDuePayment(\'' + E(o.id) + '\')">💵 Collect Due</button><button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openPayFollowupModal(\'' + E(o.id) + '\')">📅 Payment Follow-up</button>' : '') + '</div>';
      container.appendChild(card);
    });
    if (list.length > 120) { var more = document.createElement('div'); more.style.cssText = 'text-align:center;padding:12px;font-size:12px;color:var(--text-muted);'; more.textContent = (list.length - 120) + ' more invoices - narrow the date range or download the PDF report.'; container.appendChild(more); }
  };

  /* =================== STAFF REPORT =================== */
  var S = { name: '', from: '', to: '', type: 'all' };
  function modal(id, z) {
    var m = $(id);
    if (!m) { m = document.createElement('div'); m.id = id; m.className = 'auth-overlay'; m.style.cssText = 'display:none;z-index:' + z + ';'; document.body.appendChild(m); }
    return m;
  }
  window.ttStaffReport = function (name, from, to) {
    S.name = name; if (from !== undefined) S.from = from; if (to !== undefined) S.to = to; S.type = 'all';
    modal('ttStaffRepModal', 3600).style.display = 'flex';
    renderStaff();
  };
  window.ttStaffSet = function () { S.from = ($('ttStFrom') || {}).value || ''; S.to = ($('ttStTo') || {}).value || ''; renderStaff(); };
  window.ttStaffPreset = function (k) { var r = preset(k); S.from = r[0]; S.to = r[1]; renderStaff(); };
  window.ttStaffType = function (t) { S.type = t; renderStaff(); };
  function sf() { return { from: S.from, to: S.to, emp: S.name, type: S.type }; }
  window.ttStaffPdf = function () { ttPrintHtml('Sales Report - ' + S.name, reportHtml('STAFF SALES REPORT - ' + S.name.toUpperCase(), sf(), byType(query(sf()), S.type), false)); };
  window.ttStaffCsv = function () { downloadFile(csvOf(byType(query(sf()), S.type)), 'sales-' + S.name.replace(/\s+/g, '_') + '.csv', 'text/csv;charset=utf-8'); };
  function renderStaff() {
    var m = modal('ttStaffRepModal', 3600), all = query(sf()), T = totals(all), list = byType(all, S.type);
    var emp = (registeredEmployees || []).find(function (e) { return e.name === S.name; });
    var pays = []; all.forEach(function (o) { payLines(o).forEach(function (p) { pays.push(p); }); });
    pays.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var types = [['all', 'All'], ['due', 'Due'], ['partial', 'Partial'], ['received', 'Paid']];
    m.innerHTML = '<div class="auth-card" style="max-width:640px;">' +
      '<div class="card-header"><div><strong class="card-title">👤 ' + E(S.name) + '</strong><div style="font-size:11px;opacity:.7;">' + E(emp ? emp.role : 'Staff') + ' · Sales Report</div></div><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'ttStaffRepModal\').style.display=\'none\'">✕</button></div>' +
      '<div class="grid-2"><div class="form-group" style="margin-bottom:6px;"><label class="form-label">From date</label><input type="date" id="ttStFrom" value="' + E(S.from) + '" onchange="ttStaffSet()"></div>' +
      '<div class="form-group" style="margin-bottom:6px;"><label class="form-label">To date</label><input type="date" id="ttStTo" value="' + E(S.to) + '" onchange="ttStaffSet()"></div></div>' +
      chips(S, 'ttStaffPreset') +
      '<div class="grid-3" style="margin:10px 0 8px;"><div class="tt21-tile"><small>TOTAL SALES</small><b>' + FM(T.billed) + '</b></div><div class="tt21-tile ok"><small>COLLECTED</small><b>' + FM(T.recv) + '</b></div><div class="tt21-tile bad"><small>DUE</small><b>' + FM(T.due) + '</b></div></div>' +
      '<div style="font-size:12px;display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;"><span>🧾 ' + T.n + ' invoices</span><span style="color:var(--success);">✅ Paid ' + T.paid + '</span><span style="color:#d97706;">🟡 Partial ' + T.partial + '</span><span style="color:var(--danger);">🔴 Unpaid ' + T.unpaid + '</span></div>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px;"><button class="btn btn-primary btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttStaffPdf()">📄 Download PDF Report</button><button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttStaffCsv()">⬇️ CSV</button></div>' +
      '<div class="tt21-chips">' + types.map(function (t) { return '<button type="button" class="' + (S.type === t[0] ? 'on' : '') + '" onclick="triggerAppHaptic(); ttStaffType(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="tt21-sec">🧾 Sales (' + list.length + ')</div>' +
      (list.length ? list.slice(0, 80).map(function (o) {
        var st = ttStatusOf(o), col = st === 'Paid' ? 'var(--success)' : st === 'Partial' ? '#d97706' : 'var(--danger)';
        return '<div class="tt21-staff" onclick="triggerAppHaptic(); openLedgerDetail(\'' + E(o.id) + '\')"><div style="min-width:0;flex:1;"><b>' + E(o.customerName) + '</b><div style="font-size:11px;opacity:.75;">' + E(ttDateOf(o)) + ' · ' + E(o.id) + '</div></div><div style="text-align:right;"><b>' + FM(o.totalAmount) + '</b><div style="font-size:11px;color:' + col + ';">' + st + (st !== 'Paid' ? ' · Due ' + FM(ttDueOf(o)) : '') + '</div></div></div>'; }).join('') + (list.length > 80 ? '<div style="font-size:11px;opacity:.7;text-align:center;padding:6px;">+' + (list.length - 80) + ' more in the PDF</div>' : '')
        : '<div style="text-align:center;padding:16px;font-size:12.5px;opacity:.7;">No sales found for this period.</div>') +
      '<div class="tt21-sec">💵 Payments received (advance &amp; part payments) (' + pays.length + ')</div>' +
      (pays.length ? pays.slice(0, 40).map(function (p) { return '<div class="tt21-pay"><span>' + E(p.date) + ' · ' + E(p.o.customerName) + ' <i>(' + p.kind + (p.mode ? ', ' + E(p.mode) : '') + ')</i></span><b>' + FM(p.amt) + '</b></div>'; }).join('') : '<div style="font-size:12px;opacity:.7;">No payments recorded.</div>') +
      '</div>';
  }

  /* =================== STAFF PERFORMANCE (Quick Toggle > Sales Report / Staff Report) =================== */
  var P = { from: '', to: '' };
  function perfBar() {
    var c = $('performanceReportContainer'); if (!c) return null;
    var bar = $('ttPerfBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'ttPerfBar'; c.parentNode.insertBefore(bar, c); }
    bar.innerHTML = '<div class="grid-2"><div class="form-group" style="margin-bottom:6px;"><label class="form-label">From date</label><input type="date" id="ttPfFrom" value="' + E(P.from) + '" onchange="ttPerfSet()"></div>' +
      '<div class="form-group" style="margin-bottom:6px;"><label class="form-label">To date</label><input type="date" id="ttPfTo" value="' + E(P.to) + '" onchange="ttPerfSet()"></div></div>' + chips(P, 'ttPerfPreset') +
      '<div style="display:flex;gap:8px;margin:8px 0;"><button class="btn btn-primary btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttPerfPdf()">📄 PDF Report (all staff)</button><button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttPerfCsv()">⬇️ CSV</button></div>';
    return c;
  }
  window.ttPerfSet = function () { P.from = ($('ttPfFrom') || {}).value || ''; P.to = ($('ttPfTo') || {}).value || ''; renderPerf(); };
  window.ttPerfPreset = function (k) { var r = preset(k); P.from = r[0]; P.to = r[1]; renderPerf(); };
  window.ttPerfPdf = function () { var f = { from: P.from, to: P.to, emp: 'ALL', type: 'all' }; ttPrintHtml('Sales Report', reportHtml('SALES REPORT - ALL STAFF', f, query(f), true)); };
  window.ttPerfCsv = function () { var f = { from: P.from, to: P.to, emp: 'ALL', type: 'all' }; downloadFile(csvOf(query(f)), 'sales-all-staff.csv', 'text/csv;charset=utf-8'); };
  function renderPerf() {
    var c = perfBar(); if (!c) return;
    var all = query({ from: P.from, to: P.to, emp: 'ALL' }), map = {};
    (registeredEmployees || []).forEach(function (e) { map[e.name] = { role: e.role, list: [] }; });
    all.forEach(function (o) { var k = o.bookedBy || 'Unassigned'; (map[k] = map[k] || { role: 'Staff', list: [] }).list.push(o); });
    var names = Object.keys(map).sort(function (a, b) { return totals(map[b].list).billed - totals(map[a].list).billed; });
    var GT = totals(all);
    c.innerHTML = '<div class="tt21-grand"><div><small>TOTAL SALES</small><b>' + FM(GT.billed) + '</b></div><div><small>COLLECTED</small><b>' + FM(GT.recv) + '</b></div><div><small>DUE</small><b>' + FM(GT.due) + '</b></div></div>' +
      names.map(function (n) {
        var x = map[n], T = totals(x.list);
        return '<div class="tt21-person" onclick="triggerAppHaptic(); ttStaffReport(\'' + E(n).replace(/&#39;/g, "\\'") + '\', \'' + P.from + '\', \'' + P.to + '\')">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><strong>👤 ' + E(n) + '</strong><span class="badge badge-info">' + E(x.role) + '</span></div>' +
          '<div class="grid-3" style="font-size:11.5px;"><div>Invoices: <b>' + T.n + '</b></div><div>Sales: <b>' + FM(T.billed) + '</b></div><div>Collected: <b style="color:var(--success);">' + FM(T.recv) + '</b></div></div>' +
          '<div style="font-size:11.5px;margin-top:4px;display:flex;justify-content:space-between;"><span style="color:var(--danger);">Due: <b>' + FM(T.due) + '</b></span><span style="opacity:.75;">Paid ' + T.paid + ' · Partial ' + T.partial + ' · Unpaid ' + T.unpaid + ' &nbsp;›</span></div></div>'; }).join('');
  }
  window.openPerformanceReportModal = function () { renderPerf(); $('performanceReportModal').style.display = 'flex'; };
  window.closePerformanceReportModal = function () { $('performanceReportModal').style.display = 'none'; };
})();
