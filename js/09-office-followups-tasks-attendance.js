/* TTESPL ERP module: 09-office-followups-tasks-attendance.js */
/* ===== v29 office modules ===== */
/* ===== v29 core: shared helpers for the new office modules (every module has its own on/off switch in Settings) ===== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEYS = ['TASKS', 'SUPPLIERS', 'PURCHASES', 'ATTENDANCE', 'LEAVES', 'EVENTS', 'NOTICES', 'CLOSINGS', 'OFFICE_CFG'];
  window.TTX = window.TTX || {};
  var MODS = [
    ['mHub', '🧰', 'Office Hub menu', 'One menu in Profile that opens all the tools below'],
    ['mFollow', '📌', 'Follow-up Centre', 'Due / overdue / snoozed lead follow-ups with history'],
    ['mTasks', '✅', 'Employee Tasks', 'Assign work, track status and progress notes'],
    ['mPurch', '🛒', 'Purchase & Suppliers', 'Suppliers, purchase orders, goods receipt, supplier bills'],
    ['mAttend', '🕘', 'Attendance & Leave', 'Check-in / check-out, leave requests and approvals'],
    ['mCal', '📅', 'Calendar & Announcements', 'Shared office calendar and notices'],
    ['mRecon', '🏦', 'Cash / Bank Reconciliation', 'Reconcile and close each day with a saved snapshot'],
    ['mC360', '👤', 'Customer 360° timeline', 'Leads, orders, payments, services in one timeline'],
    ['mBoard', '🗂️', 'Lead pipeline board', 'Board view on the Leads page'],
    ['mSyncC', '🔄', 'Sync Recovery Centre', 'See and retry failed or pending cloud saves'],
    ['mBackup', '💾', 'Backup & Restore Centre', 'Checked backup, safe restore preview, integrity check'],
    ['mDashCard', '🧩', 'Dashboard work-queue card', 'Follow-ups / tasks / approvals summary on Home'],
    ['mFilters', '⭐', 'Saved filters', 'Save and re-use filters on Leads, Services, Orders, Tasks'],
    ['mBulk', '☑', 'Bulk actions', 'Select many leads / tasks, preview, then apply'],
    ['mPerf', '📊', 'Employee performance', 'Date-filtered numbers from existing records (own data for staff)'],
    ['mDup', '🧬', 'Duplicate review', 'Find possible duplicate customers, leads, stock, payments']
  ];
  function on(k) { try { var v = window.ttFeat && window.ttFeat.get(k); return v === undefined || v === null || v === '' ? true : !!v; } catch (e) { return true; } }
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowLocal() { var d = new Date(); return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function toast(m, bad) {
    try { (window.__ttxToasts = window.__ttxToasts || []).push((bad ? '!' : '') + m); if (window.__ttxToasts.length > 30) window.__ttxToasts.shift(); } catch (e) {}
    try {
      var host = $('ttxToastHost');
      if (!host) { host = document.createElement('div'); host.id = 'ttxToastHost'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
      var t = document.createElement('div'); t.className = 'ttx-toast' + (bad ? ' bad' : ''); t.setAttribute('role', bad ? 'alert' : 'status'); t.textContent = m; host.appendChild(t);
      setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, bad ? 6000 : 3200);
    } catch (e) { try { alert(m); } catch (e2) {} }
  }
  function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function r2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function user() { try { return (typeof currentUser !== 'undefined' && currentUser) || window.currentUser || null; } catch (e) { return window.currentUser || null; } }
  function me() { var u = user(); return (u && u.name) || 'Staff'; }
  function meId() { var u = user(); return u ? String(u.id != null ? u.id : u.name) : ''; }
  function isAdm() { try { return !!isAdminUser(); } catch (e) { return false; } }
  function emps() { try { return (typeof registeredEmployees !== 'undefined' ? registeredEmployees : window.registeredEmployees) || []; } catch (e) { return []; } }
  function empName(id) { var e = emps().filter(function (x) { return String(x.id) === String(id); })[0]; return e ? e.name : String(id || ''); }
  function empId(name) { var e = emps().filter(function (x) { return x.name === name; })[0]; return e ? String(e.id) : ''; }
  function uid(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function last10(p) { return String(p || '').replace(/\D/g, '').slice(-10); }
  function fmtDT(iso) { if (!iso) return ''; try { var d = new Date(iso); if (isNaN(d)) return String(iso); return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(iso); } }
  function fmtD(s) { if (!s) return ''; try { var d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return s; } }

  /* data: live cloud list if present, else local copy.  save(): local + cloud via the existing setStored (offline queue, retry, outbox) */
  function list(key) {
    var v = window.TTX[key];
    if (Array.isArray(v)) return v;
    var l = []; try { l = getStored(key, []); } catch (e) { l = []; }
    if (!Array.isArray(l)) l = [];
    window.TTX[key] = l; return l;
  }
  function save(key, arr) { window.TTX[key] = arr; try { setStored(key, arr); } catch (e) { console.warn('save', key, e); } }
  function upsert(key, rec) {
    var l = list(key).slice(), i = l.findIndex(function (x) { return x && String(x.id) === String(rec.id); });
    if (i >= 0) l[i] = rec; else l.unshift(rec); save(key, l); return rec;
  }
  function byId(key, id) { return list(key).filter(function (x) { return x && String(x.id) === String(id); })[0]; }
  function hist(rec, act, note, extra) { rec.hist = (rec.hist || []).concat([Object.assign({ at: new Date().toISOString(), by: me(), act: act, note: note || '' }, extra || {})]).slice(-60); return rec; }
  /* confirmed cloud write for the few places where we must not claim success early */
  function cloudConfirm(key, arr) {
    var cs = window.cloudSync;
    if (!cs || typeof cs.pushKey !== 'function') return Promise.reject(new Error('Cloud sync is not connected'));
    if (navigator.onLine === false) return Promise.reject(new Error('You are offline'));
    return Promise.race([cs.pushKey(key, arr), new Promise(function (_, rej) { setTimeout(function () { rej(new Error('Cloud did not confirm in time')); }, 20000); })]);
  }

  /* ----- full-screen sheets (class auth-overlay → handled by the central Back manager) ----- */
  var binders = {};
  function sheet(id, title, body, opts) {
    opts = opts || {};
    var o = $(id);
    if (!o) {
      o = document.createElement('div'); o.id = id; o.className = 'auth-overlay ttx-ov'; o.style.display = 'none'; o.style.zIndex = String(opts.z || 3500); o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
      o.innerHTML = '<div class="ttx-sh"><div class="ttx-hd"><b></b><button type="button" class="ttx-x" aria-label="Close" data-a="__close">✕</button></div><div class="ttx-bd"></div></div>';
      document.body.appendChild(o);
      o.addEventListener('click', function (e) {
        var b = e.target.closest('[data-a]'); if (!b || !o.contains(b)) return;
        var a = b.getAttribute('data-a'); if (a === '__close') { close(id); return; }
        var h = binders[id]; if (h && h.click && h.click[a]) { e.preventDefault(); h.click[a](b.getAttribute('data-p'), b, e); }
      });
      o.addEventListener('change', function (e) { var h = binders[id]; var el = e.target.closest('[data-c]'); if (el && h && h.change && h.change[el.getAttribute('data-c')]) h.change[el.getAttribute('data-c')](el.value, el, e); });
      o.addEventListener('input', function (e) { var h = binders[id]; var el = e.target.closest('[data-i]'); if (el && h && h.input && h.input[el.getAttribute('data-i')]) h.input[el.getAttribute('data-i')](el.value, el, e); });
    }
    if (title != null) o.querySelector('.ttx-hd b').textContent = title;
    if (body != null) o.querySelector('.ttx-bd').innerHTML = body;
    o.dataset.focus = '';
    o.style.display = 'flex';
    o.__prevFocus = document.activeElement;
    return o;
  }
  function body(id, html, keepScroll) { var o = $(id); if (!o) return; var b = o.querySelector('.ttx-bd'), y = b.scrollTop; b.innerHTML = html; if (keepScroll) b.scrollTop = y; }
  function close(id) { var o = $(id); if (!o) return; o.style.display = 'none'; try { o.__prevFocus && o.__prevFocus.isConnected && o.__prevFocus.focus({ preventScroll: true }); } catch (e) {} if (binders[id] && binders[id].onClose) binders[id].onClose(); }
  function isOpen(id) { var o = $(id); return !!o && o.style.display !== 'none'; }
  function bind(id, handlers) { binders[id] = handlers; }
  function field(label, html, cls) { return '<label class="ttx-f ' + (cls || '') + '"><span>' + label + '</span>' + html + '</label>'; }
  function sel(dc, opts, val, ph) { return '<select data-c="' + dc + '">' + (ph != null ? '<option value="">' + H(ph) + '</option>' : '') + opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + H(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + H(t) + '</option>'; }).join('') + '</select>'; }
  function empOpts() { return emps().map(function (e) { return [String(e.id), e.name]; }); }
  function chip(txt, cls) { return '<span class="ttx-chip ' + (cls || '') + '">' + H(txt) + '</span>'; }
  function empty(icon, msg) { return '<div class="ttx-empty"><span>' + icon + '</span>' + H(msg) + '</div>'; }
  function val(el, q) { var e = el.querySelector(q); return e ? e.value : ''; }

  /* ----- Settings integration ----- */
  window.ttModSettings = function (sw, group) {
    var rows = MODS.map(function (m) { return sw(m[0], m[1] + ' ' + m[2], m[3]); });
    rows.push('<div class="tt25-row"><div class="tt25-rt"><b>Purchase auto-approve limit (₹)</b><small>Non-admin purchase orders up to this total are approved automatically. 0 = only Admin approves</small></div><input class="tt25-num" type="number" min="0" inputmode="numeric" value="' + (window.ttFeat.get('purchLimit') || '') + '" placeholder="0" onchange="ttFeat.set(\'purchLimit\',Number(this.value)||0)"></div>');
    return group('🧩 Office modules (on / off)', rows);
  };
  window.ttModOn = on;

  window.ttx = {
    on: on, H: H, ymd: ymd, nowLocal: nowLocal, toast: toast, inr: inr, r2: r2, me: me, meId: meId, isAdm: isAdm, emps: emps, empName: empName, empId: empId, uid: uid, norm: norm, last10: last10,
    fmtDT: fmtDT, fmtD: fmtD, list: list, save: save, upsert: upsert, byId: byId, hist: hist, cloudConfirm: cloudConfirm,
    sheet: sheet, body: body, close: close, isOpen: isOpen, bind: bind, field: field, sel: sel, empOpts: empOpts, chip: chip, empty: empty, val: val, MODS: MODS, KEYS: KEYS, hubTiles: [], modules: {}
  };
})();

/* ===== v29 · Follow-up Centre + Employee Tasks + Office Hub ===== */
(function () {
  'use strict';
  var X = window.ttx, H = X.H, on = X.on, ymd = X.ymd, me = X.me, isAdm = X.isAdm;
  function today() { return ymd(); }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function L() { try { return leadsData || []; } catch (e) { return []; } }
  function O() { try { return ordersData || []; } catch (e) { return []; } }
  function SV() { try { return serviceCallsData || []; } catch (e) { return []; } }
  function notify(title, body) { try { if (window.cloudSync && typeof window.cloudSync.pushLiveNotification === 'function') window.cloudSync.pushLiveNotification({ title: title, body: body, type: 'task' }); } catch (e) {} }

  /* ================= FOLLOW-UP CENTRE ================= */
  var FU = { tab: 'today', emp: 'ALL', note: null };
  function fuItems() {
    var admin = isAdm(), mine = me(), out = [];
    L().forEach(function (l) {
      if (!l || l.status === 'Installed' || !l.followupDate) return;
      if (!admin && l.handledBy !== mine) return;
      out.push({ kind: 'lead', id: l.id, name: l.customerName, phone: l.phone, date: l.followupDate, owner: l.handledBy, note: l.remarks, extra: l.machine, done: l.fuDoneFor === l.followupDate, snoozed: l.fuSnz === l.followupDate });
    });
    O().forEach(function (o) {
      if (!o || o.status === 'Cancelled' || !(o.dueAmount > 0) || !o.payFollowupDate) return;
      if (!admin && o.bookedBy !== mine) return;
      out.push({ kind: 'pay', id: o.id, name: o.customerName, phone: o.phone, date: o.payFollowupDate, owner: o.bookedBy, note: o.payFollowupNote, extra: 'Due ' + X.inr(o.dueAmount), done: o.payFollowupDone === o.payFollowupDate, snoozed: o.payFollowupSnz === o.payFollowupDate });
    });
    SV().forEach(function (s) {
      if (!s || s.status === 'Work Completed' || !s.targetDate) return;
      if (!admin && s.attendedBy !== mine) return;
      out.push({ kind: 'svc', id: s.id, name: s.customerName, phone: s.phone, date: s.targetDate, owner: s.attendedBy, note: s.problem, extra: s.machine, done: false, snoozed: false });
    });
    return out.filter(function (i) { return FU.emp === 'ALL' || i.owner === FU.emp; });
  }
  function bucket(i, t) {
    if (i.done) return 'done';
    if (i.snoozed && i.date > t) return 'snoozed';
    if (i.date < t) return 'overdue';
    if (i.date === t) return 'today';
    if (i.date <= addDays(t, 7)) return 'upcoming';
    return 'later';
  }
  function fuCounts() {
    var t = today(), c = { overdue: 0, today: 0, upcoming: 0, snoozed: 0, done: 0, later: 0 };
    fuItems().forEach(function (i) { c[bucket(i, t)]++; });
    return c;
  }
  var KIND = { lead: ['🎯', 'Lead'], pay: ['💰', 'Payment'], svc: ['🛠️', 'Service'] };
  function fuHtml() {
    var t = today(), items = fuItems(), c = {}, tabs = [['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Next 7 days'], ['snoozed', 'Snoozed'], ['later', 'Later'], ['done', 'Done']];
    items.forEach(function (i) { var b = bucket(i, t); c[b] = (c[b] || 0) + 1; });
    var h = '<div class="ttx-tabs">' + tabs.map(function (x) { return '<button class="' + (FU.tab === x[0] ? 'on' : '') + '" data-a="fuTab" data-p="' + x[0] + '">' + x[1] + (c[x[0]] ? ' <i>' + c[x[0]] + '</i>' : '') + '</button>'; }).join('') + '</div>';
    if (isAdm()) h += '<div class="ttx-row">' + X.sel('fuEmp', [['ALL', 'All employees']].concat(X.emps().map(function (e) { return [e.name, e.name]; })), FU.emp) + '</div>';
    var rows = items.filter(function (i) { return bucket(i, t) === FU.tab; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    if (!rows.length) return h + X.empty('🎉', FU.tab === 'overdue' ? 'Nothing overdue' : 'Nothing here');
    return h + rows.map(function (i) {
      var k = KIND[i.kind], key = i.kind + ':' + i.id, ph = X.last10(i.phone);
      var s = '<div class="ttx-card"><div class="ttx-ct"><div><b>' + H(i.name) + '</b><small>' + k[0] + ' ' + k[1] + ' · ' + H(i.extra || '') + ' · ' + H(i.owner || '') + '</small></div>' + X.chip(X.fmtD(i.date), bucket(i, t) === 'overdue' ? 'bad' : (bucket(i, t) === 'today' ? 'warn' : '')) + '</div>' +
        (i.note ? '<div class="ttx-note">' + H(String(i.note).slice(0, 160)) + '</div>' : '');
      if (FU.note === key) {
        s += '<div class="ttx-inl"><input data-i="fuNoteTxt" placeholder="What happened? (optional)" maxlength="200"><label>Next follow-up (optional)<input type="date" data-i="fuNextDt" min="' + t + '"></label><div class="ttx-btns"><button class="ttx-b pri" data-a="fuDoneGo" data-p="' + H(key) + '">Save as done</button><button class="ttx-b" data-a="fuCancel">Cancel</button></div></div>';
      } else if (i.kind === 'svc') {
        s += '<div class="ttx-btns">' + (ph ? '<a class="ttx-b" href="tel:' + ph + '">📞 Call</a>' : '') + '<button class="ttx-b pri" data-a="fuOpenSvc" data-p="' + H(i.id) + '">Open service</button></div>';
      } else if (!i.done) {
        s += '<div class="ttx-btns">' + (ph ? '<a class="ttx-b" href="tel:' + ph + '">📞</a><a class="ttx-b" target="_blank" rel="noopener" href="https://wa.me/91' + ph + '">💬</a>' : '') + '<button class="ttx-b pri" data-a="fuNote" data-p="' + H(key) + '">✓ Done</button>' + [1, 3, 7].map(function (n) { return '<button class="ttx-b" data-a="fuSnz" data-p="' + H(key + '|' + n) + '">+' + n + 'd</button>'; }).join('') + '<input type="date" class="ttx-dt" data-c="fuRes" data-key="' + H(key) + '" title="Reschedule" min="' + t + '"></div>';
      } else s += '<div class="ttx-note">✓ Completed</div>';
      return s + '</div>';
    }).join('');
  }
  function fuRender() { X.body('ttxFU', fuHtml(), true); }
  function findFU(key) { var p = key.split(':'), k = p.shift(), id = p.join(':'); return { k: k, id: id, rec: k === 'lead' ? L().find(function (x) { return x.id === id; }) : O().find(function (x) { return x.id === id; }) }; }
  function fuApply(key, mut, act, note) {
    var f = findFU(key); if (!f.rec) return X.toast('Record not found', 1);
    var before = f.rec.followupDate || f.rec.payFollowupDate, r = f.rec;
    mut(r);
    if (f.k === 'lead') { r.fuHist = (r.fuHist || []).concat([{ at: new Date().toISOString(), by: me(), act: act, note: note || '', from: before, to: r.followupDate }]).slice(-30); setStored('LEADS', leadsData); try { renderLeads(); } catch (e) {} }
    else { r.auditTrail = r.auditTrail || []; r.auditTrail.unshift({ by: me(), time: (typeof getNowStr === 'function' ? getNowStr() : ''), note: 'Payment follow-up ' + act + (note ? ': ' + note : '') }); setStored('ORDERS', ordersData); try { updateGlobalReminders(); } catch (e) {} }
    fuRender(); dashRefresh();
  }
  function setFU(r, k, d) { if (k === 'lead') r.followupDate = d; else r.payFollowupDate = d; }
  function fuOpen() {
    if (!on('mFollow')) return;
    X.sheet('ttxFU', '📌 Follow-up Centre', '');
    X.bind('ttxFU', {
      click: {
        fuTab: function (p) { FU.tab = p; FU.note = null; fuRender(); },
        fuNote: function (p) { FU.note = p; fuRender(); },
        fuCancel: function () { FU.note = null; fuRender(); },
        fuOpenSvc: function (p) { X.close('ttxFU'); try { editServicePrompt(p); } catch (e) {} },
        fuSnz: function (p) { var a = p.split('|'), key = a[0], n = Number(a[1]), f = findFU(key); if (!f.rec) return; var cur = f.k === 'lead' ? f.rec.followupDate : f.rec.payFollowupDate, base = cur > today() ? cur : today(), nd = addDays(base, n); fuApply(key, function (r) { setFU(r, f.k, nd); if (f.k === 'lead') r.fuSnz = nd; else r.payFollowupSnz = nd; }, 'snooze', '+' + n + 'd → ' + nd); X.toast('Follow-up moved to ' + X.fmtD(nd)); },
        fuDoneGo: function (p) {
          var root = document.getElementById('ttxFU'), note = X.val(root, '[data-i=fuNoteTxt]').trim(), nx = X.val(root, '[data-i=fuNextDt]'), f = findFU(p);
          if (nx && nx < today()) return X.toast('Next follow-up cannot be in the past', 1);
          fuApply(p, function (r) { if (nx) { setFU(r, f.k, nx); } else { if (f.k === 'lead') r.fuDoneFor = r.followupDate; else r.payFollowupDone = r.payFollowupDate; } }, 'done', note);
          FU.note = null; fuRender(); X.toast(nx ? 'Done · next follow-up ' + X.fmtD(nx) : 'Follow-up marked done');
        }
      },
      change: {
        fuEmp: function (v) { FU.emp = v; fuRender(); },
        fuRes: function (v, el) { if (!v) return; if (v < today()) return X.toast('Pick today or a later date', 1); var key = el.getAttribute('data-key'), f = findFU(key); fuApply(key, function (r) { setFU(r, f.k, v); if (f.k === 'lead') r.fuSnz = v; else r.payFollowupSnz = v; }, 'reschedule', '→ ' + v); X.toast('Rescheduled to ' + X.fmtD(v)); }
      }
    });
    FU.note = null; fuRender();
  }
  window.ttOpenFollowups = fuOpen;

  /* once a day (while the app is open) tell the user how many follow-ups need attention. No background push exists in this app. */
  function fuAlert() {
    if (!on('mFollow') || !X.me() || X.me() === 'Staff') return;
    var k = 'TTX_FU_ALERT_' + today() + '_' + X.meId(), seen = null; try { seen = localStorage.getItem(k); } catch (e) {}
    var c = fuCounts(), n = c.overdue + c.today; if (!n || seen) return;
    try { localStorage.setItem(k, '1'); } catch (e) {}
    X.toast('📌 ' + n + ' follow-up' + (n > 1 ? 's' : '') + ' need attention' + (c.overdue ? ' (' + c.overdue + ' overdue)' : ''));
  }

  /* ================= TASKS ================= */
  var ST = ['Open', 'In Progress', 'Blocked', 'Done', 'Cancelled'], PR = ['Low', 'Normal', 'High'];
  var TK = { f: 'mine', st: 'active', edit: null, q: '' };
  function tasks() { return X.list('TASKS'); }
  function canSee(t) { return isAdm() || String(t.assigneeId) === X.meId() || String(t.createdById) === X.meId(); }
  function overdue(t) { return t.due && t.due < today() && t.status !== 'Done' && t.status !== 'Cancelled'; }
  function taskCounts() {
    var mid = X.meId(), c = { open: 0, overdue: 0, dueToday: 0 };
    tasks().forEach(function (t) { if (!t || String(t.assigneeId) !== mid || t.status === 'Done' || t.status === 'Cancelled') return; c.open++; if (overdue(t)) c.overdue++; else if (t.due === today()) c.dueToday++; });
    return c;
  }
  function tkList() {
    var t0 = today(), q = X.norm(TK.q);
    return tasks().filter(function (t) { return t && canSee(t); }).filter(function (t) {
      if (TK.f === 'mine' && String(t.assigneeId) !== X.meId()) return false;
      if (TK.f === 'by' && String(t.createdById) !== X.meId()) return false;
      if (TK.f.indexOf('emp:') === 0 && String(t.assigneeId) !== TK.f.slice(4)) return false;
      if (TK.st === 'active' && (t.status === 'Done' || t.status === 'Cancelled')) return false;
      if (TK.st === 'overdue' && !overdue(t)) return false;
      if (TK.st === 'done' && t.status !== 'Done') return false;
      if (q && X.norm([t.title, t.desc, t.assigneeName, t.rel && t.rel.label].join(' ')).indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (overdue(b) ? 1 : 0) - (overdue(a) ? 1 : 0) || String(a.due || '9').localeCompare(String(b.due || '9')); });
  }
  function tkHtml() {
    var f = [['mine', 'Assigned to me'], ['by', 'Created by me']]; if (isAdm()) { f.push(['all', 'Everyone']); X.emps().forEach(function (e) { f.push(['emp:' + e.id, e.name]); }); }
    var h = '<div class="ttx-row"><input class="ttx-search" data-i="tkQ" placeholder="Search tasks…" value="' + H(TK.q) + '">' + '<button class="ttx-b pri" data-a="tkNew">＋ New task</button></div>' +
      '<div class="ttx-row">' + X.sel('tkF', f, TK.f) + X.sel('tkSt', [['active', 'Active'], ['overdue', 'Overdue'], ['done', 'Done'], ['all', 'All']], TK.st) + '</div>';
    var rows = tkList();
    if (!rows.length) return h + X.empty('✅', 'No tasks here');
    return h + rows.slice(0, 80).map(function (t) {
      var od = overdue(t);
      return '<div class="ttx-card" data-a="tkOpen" data-p="' + H(t.id) + '"><div class="ttx-ct"><div><b>' + H(t.title) + '</b><small>👤 ' + H(t.assigneeName || '') + (t.rel ? ' · 🔗 ' + H(t.rel.label || '') : '') + '</small></div>' + X.chip(t.status, t.status === 'Done' ? 'ok' : (od ? 'bad' : '')) + '</div>' +
        '<div class="ttx-meta">' + (t.due ? X.chip((od ? 'Overdue · ' : 'Due ') + X.fmtD(t.due), od ? 'bad' : '') : '') + X.chip(t.priority, t.priority === 'High' ? 'warn' : '') + '</div></div>';
    }).join('') + (rows.length > 80 ? '<div class="ttx-note">Showing 80 of ' + rows.length + ' — use search or filters to narrow.</div>' : '');
  }
  function tkRender() { X.body('ttxTK', tkHtml(), true); }
  function tkOpen() {
    if (!on('mTasks')) return;
    X.sheet('ttxTK', '✅ Tasks', '');
    X.bind('ttxTK', {
      click: { tkNew: function () { tkForm(null); }, tkOpen: function (p) { tkDetail(p); } },
      change: { tkF: function (v) { TK.f = v; tkRender(); }, tkSt: function (v) { TK.st = v; tkRender(); } },
      input: { tkQ: function (v) { TK.q = v; clearTimeout(TK._t); TK._t = setTimeout(function () { var el = document.querySelector('#ttxTK [data-i=tkQ]'), pos = el ? el.selectionStart : 0; tkRender(); el = document.querySelector('#ttxTK [data-i=tkQ]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } }, 250); } }
    });
    tkRender();
  }
  window.ttOpenTasks = tkOpen;
  window.ttxTaskFilter = function () { return { f: TK.f, st: TK.st, q: TK.q }; };
  window.ttxSetTaskFilter = function (p) { TK.f = p.f || 'mine'; TK.st = p.st || 'active'; TK.q = p.q || ''; tkOpen(); };
  function relOpts() {
    var o = [['', 'No link']];
    L().slice(0, 150).forEach(function (l) { if (l && l.status !== 'Installed') o.push(['lead:' + l.id, '🎯 ' + l.customerName + ' (' + l.id + ')']); });
    O().slice(0, 150).forEach(function (r) { if (r && r.status !== 'Cancelled' && r.dueAmount > 0) o.push(['order:' + r.id, '💰 ' + r.customerName + ' ' + r.id]); });
    SV().slice(0, 100).forEach(function (s) { if (s && s.status !== 'Work Completed') o.push(['svc:' + s.id, '🛠️ ' + s.customerName]); });
    return o;
  }
  var tkSubmit = false;
  function tkForm(t) {
    var admin = isAdm(), id = 'ttxTF';
    var h = '<input type="hidden" id="ttxTFid" value="' + H(t ? t.id : '') + '">' +
      X.field('Title *', '<input id="ttxTFtitle" maxlength="120" value="' + H(t ? t.title : '') + '" placeholder="e.g. Call Sharma for payment">') +
      X.field('Details', '<textarea id="ttxTFdesc" rows="3" maxlength="600">' + H(t ? t.desc : '') + '</textarea>') +
      X.field('Assign to', '<select id="ttxTFas"' + (admin ? '' : ' disabled') + '>' + X.empOpts().map(function (o) { return '<option value="' + H(o[0]) + '"' + (String(t ? t.assigneeId : X.meId()) === o[0] ? ' selected' : '') + '>' + H(o[1]) + '</option>'; }).join('') + '</select>' + (admin ? '' : '<small>Employees can create tasks for themselves. Admin assigns to others.</small>')) +
      '<div class="ttx-two">' + X.field('Due date', '<input type="date" id="ttxTFdue" value="' + H(t ? t.due || '' : '') + '">') + X.field('Priority', '<select id="ttxTFpr">' + PR.map(function (p) { return '<option' + ((t ? t.priority : 'Normal') === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select>') + '</div>' +
      X.field('Link to (optional)', '<select id="ttxTFrel">' + relOpts().map(function (o) { return '<option value="' + H(o[0]) + '"' + (t && t.rel && t.rel.type + ':' + t.rel.id === o[0] ? ' selected' : '') + '>' + H(o[1]) + '</option>'; }).join('') + '</select>') +
      '<div class="ttx-btns"><button class="ttx-b pri" data-a="tfSave">' + (t ? 'Save changes' : 'Create task') + '</button></div>';
    X.sheet(id, t ? 'Edit task' : 'New task', h, { z: 3600 });
    X.bind(id, { click: { tfSave: tfSave } });
  }
  function tfSave() {
    if (tkSubmit) return; var g = function (i) { return (document.getElementById(i) || {}).value || ''; };
    var title = g('ttxTFtitle').trim(); if (!title) return X.toast('Task title is required', 1);
    var due = g('ttxTFdue'); if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return X.toast('Invalid due date', 1);
    var eid = isAdm() ? g('ttxTFas') : X.meId(), id = g('ttxTFid'), rel = null, rv = g('ttxTFrel');
    if (rv) { var p = rv.split(':'), tp = p.shift(), rid = p.join(':'), lab = (document.getElementById('ttxTFrel').selectedOptions[0] || {}).textContent || ''; rel = { type: tp, id: rid, label: lab.replace(/^[^\s]+\s/, '') }; }
    tkSubmit = true; setTimeout(function () { tkSubmit = false; }, 800);
    var t = id ? X.byId('TASKS', id) : null;
    if (t) {
      if (!isAdm() && String(t.createdById) !== X.meId()) return X.toast('Only the creator or Admin can edit this task', 1);
      var oldAs = t.assigneeId; t = JSON.parse(JSON.stringify(t));
      Object.assign(t, { title: title, desc: g('ttxTFdesc').trim(), due: due, priority: g('ttxTFpr'), rel: rel, updatedAt: new Date().toISOString() });
      if (String(oldAs) !== String(eid)) { t.assigneeId = eid; t.assigneeName = X.empName(eid); X.hist(t, 'reassigned', 'to ' + t.assigneeName); notify('📋 Task assigned', t.title + ' → ' + t.assigneeName); }
      else X.hist(t, 'edited', '');
    } else {
      t = { id: X.uid('TSK'), title: title, desc: g('ttxTFdesc').trim(), assigneeId: eid, assigneeName: X.empName(eid), createdById: X.meId(), createdBy: me(), createdAt: new Date().toISOString(), due: due, priority: g('ttxTFpr'), status: 'Open', rel: rel, hist: [] };
      X.hist(t, 'created', 'assigned to ' + t.assigneeName);
      if (String(eid) !== X.meId()) notify('📋 New task for ' + t.assigneeName, title);
    }
    X.upsert('TASKS', t); X.close('ttxTF'); tkRender(); dashRefresh(); X.toast('Task saved');
    if (X.isOpen('ttxTD')) tkDetail(t.id);
  }
  function tkDetail(id) {
    var t = X.byId('TASKS', id); if (!t) return;
    var mine = String(t.assigneeId) === X.meId(), creator = String(t.createdById) === X.meId(), can = isAdm() || mine, locked = t.status === 'Done' || t.status === 'Cancelled';
    var h = '<div class="ttx-ct"><div><b>' + H(t.title) + '</b><small>👤 ' + H(t.assigneeName) + ' · by ' + H(t.createdBy) + '</small></div>' + X.chip(t.status, t.status === 'Done' ? 'ok' : '') + '</div>' +
      (t.desc ? '<div class="ttx-note">' + H(t.desc) + '</div>' : '') +
      '<div class="ttx-meta">' + (t.due ? X.chip('Due ' + X.fmtD(t.due), overdue(t) ? 'bad' : '') : '') + X.chip(t.priority) + (t.rel ? X.chip('🔗 ' + t.rel.label) : '') + (t.completedAt ? X.chip('Done ' + X.fmtDT(t.completedAt) + ' by ' + t.completedBy, 'ok') : '') + '</div>';
    if (can && !locked) h += '<div class="ttx-btns">' + ['In Progress', 'Blocked', 'Done'].filter(function (s) { return s !== t.status; }).map(function (s) { return '<button class="ttx-b ' + (s === 'Done' ? 'pri' : '') + '" data-a="tdSt" data-p="' + H(t.id + '|' + s) + '">' + (s === 'Done' ? '✓ Mark done' : s) + '</button>'; }).join('') + '</div>' +
      '<div class="ttx-row"><input data-i="tdNote" id="ttxTDnote" maxlength="200" placeholder="Add a progress note…"><button class="ttx-b" data-a="tdAddNote" data-p="' + H(t.id) + '">Add</button></div>';
    if (locked && (isAdm())) h += '<div class="ttx-btns"><button class="ttx-b" data-a="tdSt" data-p="' + H(t.id + '|Open') + '">Re-open</button></div>';
    if (isAdm() || (creator && !locked)) h += '<div class="ttx-btns"><button class="ttx-b" data-a="tdEdit" data-p="' + H(t.id) + '">✏️ Edit / reassign</button>' + (!locked ? '<button class="ttx-b dng" data-a="tdCancel" data-p="' + H(t.id) + '">Cancel task</button>' : '') + '</div>';
    h += '<div class="ttx-sec">History</div>' + (t.hist || []).slice().reverse().map(function (x) { return '<div class="ttx-hi"><b>' + H(x.act) + '</b> ' + H(x.note) + '<small>' + H(x.by) + ' · ' + X.fmtDT(x.at) + '</small></div>'; }).join('');
    X.sheet('ttxTD', 'Task', h, { z: 3550 });
    X.bind('ttxTD', {
      click: {
        tdSt: function (p) { tdStatus(p); }, tdEdit: function (p) { tkForm(X.byId('TASKS', p)); },
        tdCancel: function (p) { if (!confirm('Cancel this task?')) return; tdStatus(p + '|Cancelled'); },
        tdAddNote: function (p) { var v = (document.getElementById('ttxTDnote') || {}).value || ''; v = v.trim(); if (!v) return; var t = JSON.parse(JSON.stringify(X.byId('TASKS', p))); X.hist(t, 'note', v); X.upsert('TASKS', t); tkDetail(p); }
      }
    });
  }
  function tdStatus(p) {
    var a = p.split('|'), t0 = X.byId('TASKS', a[0]), s = a[1]; if (!t0) return;
    var mine = String(t0.assigneeId) === X.meId();
    if (!isAdm() && !mine) return X.toast('Not allowed', 1);
    if (s === 'Cancelled' && !isAdm() && String(t0.createdById) !== X.meId()) return X.toast('Not allowed', 1);
    if (t0.status === s) return; /* idempotent: double tap changes nothing */
    var t = JSON.parse(JSON.stringify(t0)); t.status = s;
    if (s === 'Done') { t.completedAt = new Date().toISOString(); t.completedBy = me(); } else { delete t.completedAt; delete t.completedBy; }
    X.hist(t, 'status', s); X.upsert('TASKS', t);
    if (s === 'Done' && String(t.createdById) !== X.meId()) notify('✅ Task done', t.title + ' · ' + me());
    tkDetail(t.id); tkRender(); dashRefresh();
  }

  /* ================= OFFICE HUB ================= */
  X.hubTiles.push({ mod: 'mFollow', icon: '📌', label: 'Follow-ups', sub: function () { var c = fuCounts(); return (c.overdue + c.today) ? (c.overdue + c.today) + ' need attention' : 'All clear'; }, fn: fuOpen });
  X.hubTiles.push({ mod: 'mTasks', icon: '✅', label: 'Tasks', sub: function () { var c = taskCounts(); return c.open ? c.open + ' open' + (c.overdue ? ' · ' + c.overdue + ' overdue' : '') : 'No open tasks'; }, fn: tkOpen });
  function hubOpen() {
    if (!on('mHub')) return;
    var admin = isAdm();
    var tiles = X.hubTiles.filter(function (t) { return on(t.mod) && (!t.admin || admin); });
    var h = tiles.length ? '<div class="ttx-grid">' + tiles.map(function (t, i) { var s = typeof t.sub === 'function' ? (function () { try { return t.sub(); } catch (e) { return ''; } })() : (t.sub || ''); return '<button class="ttx-tile" data-a="hub" data-p="' + i + '"><span>' + t.icon + '</span><b>' + H(t.label) + '</b><small>' + H(s) + '</small></button>'; }).join('') + '</div>' : X.empty('🧰', 'All office modules are switched off. Turn them on in Settings.');
    h += '<div class="ttx-note">Modules can be switched on or off in Settings → Office modules (this device).</div>';
    X.sheet('ttxHub', '🧰 Office Hub', h);
    X.bind('ttxHub', { click: { hub: function (p) { var t = tiles[Number(p)]; if (t) { X.close('ttxHub'); setTimeout(t.fn, 60); } } } });
  }
  window.ttOpenHub = hubOpen;

  /* ================= DASHBOARD WORK-QUEUE CARD ================= */
  function dashRefresh() {
    var host = document.getElementById('view-dashboard'); if (!host) return;
    var card = document.getElementById('ttxDashCard');
    if (!on('mDashCard') || (!on('mFollow') && !on('mTasks'))) { if (card) card.style.display = 'none'; return; }
    if (!card) {
      card = document.createElement('div'); card.id = 'ttxDashCard'; card.className = 'card ttx-dash';
      var grid = host.querySelector('.grid-4'), anchor = document.getElementById('tt25Spark') || grid;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling); else host.appendChild(card);
      card.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (!b) return; var g = b.getAttribute('data-go'); if (g === 'fu') fuOpen(); else if (g === 'tk') tkOpen(); else if (g === 'lv' && window.ttOpenLeaves) window.ttOpenLeaves(); else if (g === 'hub') hubOpen(); });
    }
    var f = on('mFollow') ? fuCounts() : null, t = on('mTasks') ? taskCounts() : null, lv = window.ttPendingLeaveCount && on('mAttend') ? window.ttPendingLeaveCount() : 0;
    var cells = [];
    if (f) cells.push('<button data-go="fu"><b class="' + (f.overdue ? 'bad' : '') + '">' + (f.overdue + f.today) + '</b><span>Follow-ups due' + (f.overdue ? ' · ' + f.overdue + ' overdue' : '') + '</span></button>');
    if (t) cells.push('<button data-go="tk"><b class="' + (t.overdue ? 'bad' : '') + '">' + t.open + '</b><span>My open tasks' + (t.overdue ? ' · ' + t.overdue + ' overdue' : '') + '</span></button>');
    if (lv) cells.push('<button data-go="lv"><b>' + lv + '</b><span>Leave to approve</span></button>');
    card.style.display = '';
    card.innerHTML = '<div class="ttx-dh"><b>🧩 My work queue</b>' + (on('mHub') ? '<button data-go="hub">Office Hub ›</button>' : '') + '</div><div class="ttx-dg">' + cells.join('') + '</div>';
  }
  window.ttxDashRefresh = dashRefresh;

  /* cloud change → redraw whatever is open */
  var prevCloud = window.ttxOnCloud;
  window.ttxOnCloud = function (pend) {
    if (prevCloud) try { prevCloud(pend); } catch (e) {}
    if (pend && pend.TASKS && X.isOpen('ttxTK')) tkRender();
    if (pend && pend.TASKS && X.isOpen('ttxTD')) { var d = document.querySelector('#ttxTD'); }
    if (pend && (pend.LEADS || pend.ORDERS) && X.isOpen('ttxFU')) fuRender();
    dashRefresh();
  };
  window.ttxFollowCounts = fuCounts; window.ttxTaskCounts = taskCounts;
  setTimeout(function () { dashRefresh(); fuAlert(); }, 2500);
  setInterval(function () { try { dashRefresh(); } catch (e) {} }, 120000);
  var origRD = window.renderDashboard;
  if (typeof origRD === 'function') { window.renderDashboard = function () { var r = origRD.apply(this, arguments); try { dashRefresh(); } catch (e) {} return r; }; try { (0, eval)('renderDashboard = window.renderDashboard;'); } catch (e) {} }
})();

/* ===== v29 · Lead pipeline board + Customer 360° extension + Sync Recovery Centre ===== */
(function () {
  'use strict';
  var X = window.ttx, H = X.H, on = X.on, me = X.me, isAdm = X.isAdm;
  function L() { try { return leadsData || []; } catch (e) { return []; } }
  function O() { try { return ordersData || []; } catch (e) { return []; } }
  function SV() { try { return serviceCallsData || []; } catch (e) { return []; } }
  function C() { try { return customerDatabase || []; } catch (e) { return []; } }

  /* ================= LEAD PIPELINE BOARD ================= */
  var STAGES = ['New', 'Contacted', 'Quoted', 'Negotiation', 'Installed', 'Lost'];
  var SIC = { New: '🆕', Contacted: '📞', Quoted: '📝', Negotiation: '🤝', Installed: '✅', Lost: '✖️' };
  function stageOf(l) { if (l.status === 'Installed') return 'Installed'; return STAGES.indexOf(l.stage) >= 0 && l.stage !== 'Installed' ? l.stage : 'New'; }
  function mode() { try { return localStorage.getItem('TTX_LEAD_VIEW') || 'list'; } catch (e) { return 'list'; } }
  function setMode(m) { try { localStorage.setItem('TTX_LEAD_VIEW', m); } catch (e) {} }
  function leadsFiltered() {
    var f; try { f = leadsFilterState; } catch (e) { f = { staff: 'ALL' }; }
    var l = L(); if (f.staff !== 'ALL') l = l.filter(function (x) { return x.handledBy === f.staff; });
    if (f.from) l = l.filter(function (x) { return x.inquiryDate >= f.from; }); if (f.to) l = l.filter(function (x) { return x.inquiryDate <= f.to; });
    return l;
  }
  function drawBar() {
    var v = document.getElementById('view-leads'), list = document.getElementById('leadsListContainer'); if (!v || !list) return;
    var bar = document.getElementById('ttxLeadBar');
    if (!on('mBoard') && !on('mFilters') && !on('mBulk')) { if (bar) bar.style.display = 'none'; var b0 = document.getElementById('ttxBoard'); if (b0) b0.style.display = 'none'; list.style.display = ''; return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'ttxLeadBar'; bar.className = 'ttx-bar'; list.parentNode.insertBefore(bar, list); bar.addEventListener('click', barClick); }
    bar.style.display = '';
    var m = on('mBoard') ? mode() : 'list';
    bar.innerHTML = (on('mBoard') ? '<div class="ttx-seg"><button class="' + (m === 'list' ? 'on' : '') + '" data-v="list">☰ List</button><button class="' + (m === 'board' ? 'on' : '') + '" data-v="board">🗂️ Board</button></div>' : '') +
      (on('mFilters') ? '<button class="ttx-b" data-v="filters">⭐ Saved filters</button>' : '') + (on('mBulk') ? '<button class="ttx-b" data-v="bulk">☑ Bulk</button>' : '');
    drawBoard();
  }
  function barClick(e) {
    var b = e.target.closest('[data-v]'); if (!b) return; var v = b.getAttribute('data-v');
    if (v === 'list' || v === 'board') { setMode(v); drawBar(); }
    else if (v === 'filters' && window.ttOpenSavedFilters) window.ttOpenSavedFilters('leads');
    else if (v === 'bulk' && window.ttOpenBulk) window.ttOpenBulk('leads');
  }
  function drawBoard() {
    var list = document.getElementById('leadsListContainer'), bd = document.getElementById('ttxBoard');
    var m = on('mBoard') ? mode() : 'list';
    if (m !== 'board') { if (bd) bd.style.display = 'none'; list.style.display = ''; return; }
    if (!bd) { bd = document.createElement('div'); bd.id = 'ttxBoard'; bd.className = 'ttx-board'; list.parentNode.insertBefore(bd, list.nextSibling); bd.addEventListener('change', boardChange); bd.addEventListener('click', boardClick); }
    list.style.display = 'none'; bd.style.display = '';
    var t = X.ymd(), ls = leadsFiltered(), cols = {}; STAGES.forEach(function (s) { cols[s] = []; });
    ls.forEach(function (l) { cols[stageOf(l)].push(l); });
    bd.innerHTML = STAGES.map(function (s) {
      var arr = cols[s], sum = arr.reduce(function (a, l) { return a + (Number(l.quotedPrice) || 0); }, 0);
      return '<section class="ttx-col"><header><b>' + SIC[s] + ' ' + s + '</b><i>' + arr.length + '</i></header><small>' + (sum ? X.inr(sum) + ' quoted' : '&nbsp;') + '</small>' +
        (arr.length ? arr.slice(0, 40).map(function (l) {
          var od = l.followupDate && l.followupDate < t && s !== 'Installed' && s !== 'Lost';
          return '<div class="ttx-lc"><b>' + H(l.customerName) + '</b><small>' + H(l.machine || '') + ' · ' + H(l.handledBy || '') + '</small>' +
            (l.quotedPrice ? '<small>' + X.inr(l.quotedPrice) + '</small>' : '') + (l.followupDate && s !== 'Installed' ? '<span class="ttx-chip ' + (od ? 'bad' : '') + '">📅 ' + X.fmtD(l.followupDate) + '</span>' : '') +
            (l.lostReason && s === 'Lost' ? '<small>' + H(l.lostReason) + '</small>' : '') +
            '<div class="ttx-lcb">' + (s === 'Installed' ? '<button class="ttx-b" data-open="' + H(l.id) + '">Report</button>' : '<select data-mv="' + H(l.id) + '" aria-label="Move lead"><option value="">Move to…</option>' + STAGES.filter(function (x) { return x !== 'Installed' && x !== s; }).map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select><button class="ttx-b" data-edit="' + H(l.id) + '">✏️</button>' + (s !== 'Lost' ? '<button class="ttx-b pri" data-inst="' + H(l.id) + '" title="Confirm installation">✅</button>' : '')) + '</div></div>';
        }).join('') : '<div class="ttx-colempty">—</div>') + (arr.length > 40 ? '<small>+' + (arr.length - 40) + ' more — use filters</small>' : '') + '</section>';
    }).join('');
  }
  function boardChange(e) {
    var s = e.target.closest('[data-mv]'); if (!s || !s.value) return;
    var l = L().find(function (x) { return x.id === s.getAttribute('data-mv'); }); if (!l) return;
    var to = s.value, reason = '';
    if (l.status === 'Installed') { X.toast('Installed leads cannot be moved', 1); return drawBoard(); }
    if (to === 'Lost') { reason = (prompt('Why was this lead lost? (required)') || '').trim(); if (!reason) { X.toast('Reason is required to mark a lead as lost', 1); return drawBoard(); } }
    var from = stageOf(l); if (from === to) return;
    l.stage = to; l.stageAt = new Date().toISOString(); l.stageBy = me();
    if (to === 'Lost') l.lostReason = reason; else delete l.lostReason;
    l.stageHist = (l.stageHist || []).concat([{ at: l.stageAt, by: me(), from: from, to: to, note: reason }]).slice(-30);
    try { setStored('LEADS', leadsData); } catch (er) { X.toast('Could not save: ' + er.message, 1); return; }
    drawBoard(); X.toast('Moved to ' + to);
  }
  function boardClick(e) {
    var ed = e.target.closest('[data-edit]'); if (ed) { try { editLeadPrompt(ed.getAttribute('data-edit')); } catch (er) {} return; }
    var inst = e.target.closest('[data-inst]'); if (inst) { try { openInstallationReportModal(inst.getAttribute('data-inst')); } catch (er) {} return; }
    var op = e.target.closest('[data-open]'); if (op) { try { openInstallationReportView(op.getAttribute('data-open')); } catch (er) {} }
  }
  (function wrapLeads() {
    var f = window.renderLeads; if (typeof f !== 'function' || f.__ttx) return;
    var w = function () { var r = f.apply(this, arguments); try { drawBar(); } catch (e) { console.warn('board', e); } return r; }; w.__ttx = true;
    window.renderLeads = w; try { (0, eval)('renderLeads = window.renderLeads;'); } catch (e) {}
  })();
  window.ttxDrawLeadBar = drawBar;
  setTimeout(drawBar, 1800);

  /* ================= CUSTOMER 360° (extends the existing customer dashboard) ================= */
  function same(c, name, phone) {
    var p = X.last10(c.phone), q = X.last10(phone);
    if (p && q) return p === q;
    return !!c.name && X.norm(c.name) === X.norm(name);
  }
  window.ttxC360 = function (c) {
    var T = X.ymd(), out = [];
    var leads = L().filter(function (l) { return l && same(c, l.customerName, l.phone); });
    var svcs = SV().filter(function (s) { return s && same(c, s.customerName, s.phone); });
    var ids = {}; leads.forEach(function (l) { ids['lead:' + l.id] = 1; }); svcs.forEach(function (s) { ids['svc:' + s.id] = 1; });
    O().forEach(function (o) { if (o && same(c, o.customerName, o.phone)) ids['order:' + o.id] = 1; });
    var tasks = X.list('TASKS').filter(function (t) { return t && t.rel && ids[t.rel.type + ':' + t.rel.id]; });
    var h = '';
    if (on('mC360')) {
      h += '<div class="tt14-sec">🎯 Leads (' + leads.length + ')</div>' + (leads.length ? leads.slice(0, 15).map(function (l) {
        return '<div class="tt14-row"><div style="display:flex;justify-content:space-between;gap:8px;"><div><b>' + H(l.inquiryDate || '') + '</b> • ' + H(l.machine || '') + '</div><span class="badge ' + (l.status === 'Installed' ? 'badge-delivered' : 'badge-pending') + '">' + H(l.status === 'Installed' ? 'Installed' : stageOf(l)) + '</span></div>' +
          '<div class="tt14-sub">Quoted ' + X.inr(l.quotedPrice) + ' • Handled by ' + H(l.handledBy || '-') + (l.status !== 'Installed' && l.followupDate ? ' • Next follow-up <b>' + X.fmtD(l.followupDate) + '</b>' : '') + '</div></div>';
      }).join('') : '<div class="tt14-empty">No leads linked.</div>');
      h += '<div class="tt14-sec">🛠️ Service calls (' + svcs.length + ')</div>' + (svcs.length ? svcs.slice(0, 15).map(function (s) {
        return '<div class="tt14-row"><div style="display:flex;justify-content:space-between;gap:8px;"><div><b>' + H(s.recvDate || '') + '</b> • ' + H(s.machine || '') + '</div><span class="badge ' + (s.status === 'Work Completed' ? 'badge-delivered' : 'badge-pending') + '">' + H(s.status || '') + '</span></div><div class="tt14-sub">' + H(String(s.problem || '').slice(0, 100)) + ' • Tech ' + H(s.attendedBy || '-') + '</div></div>';
      }).join('') : '<div class="tt14-empty">No service calls linked.</div>');
      if (on('mTasks')) h += '<div class="tt14-sec">✅ Tasks linked to this customer (' + tasks.length + ')</div>' + (tasks.length ? tasks.slice(0, 10).map(function (t) { return '<div class="tt14-row"><b>' + H(t.title) + '</b><div class="tt14-sub">' + H(t.assigneeName) + ' • ' + H(t.status) + (t.due ? ' • due ' + X.fmtD(t.due) : '') + '</div></div>'; }).join('') : '<div class="tt14-empty">No linked tasks.</div>');
      var nxt = []; leads.forEach(function (l) { if (l.status !== 'Installed' && l.followupDate && l.fuDoneFor !== l.followupDate) nxt.push(['Lead follow-up', l.followupDate]); });
      O().forEach(function (o) { if (o && o.status !== 'Cancelled' && o.dueAmount > 0 && o.payFollowupDate && o.payFollowupDone !== o.payFollowupDate && same(c, o.customerName, o.phone)) nxt.push(['Payment follow-up (' + o.id + ')', o.payFollowupDate]); });
      if (nxt.length) h += '<div class="tt14-sec">📌 Upcoming follow-ups</div>' + nxt.sort(function (a, b) { return a[1].localeCompare(b[1]); }).map(function (n) { return '<div class="tt14-row" style="display:flex;justify-content:space-between;"><span>' + H(n[0]) + '</span><b style="color:' + (n[1] < T ? 'var(--danger,#e11d48)' : 'inherit') + '">' + X.fmtD(n[1]) + '</b></div>'; }).join('');
      h += '<div class="tt14-sub" style="margin-top:8px;">Records are linked by phone number (last 10 digits) when both sides have one, otherwise by exact name. Orders created without a phone can only be matched by name.</div>';
    }
    return h;
  };
  (function wrapCust() {
    var f = window.ttCustDash; if (typeof f !== 'function' || f.__ttx) return;
    var w = function (id) {
      var r = f.apply(this, arguments);
      try {
        if (!on('mC360')) return r;
        var c = C().find(function (x) { return String(x.id) === String(id); }); var m = document.getElementById('tt14CustModal'); if (!c || !m) return r;
        var card = m.firstChild; if (!card || card.querySelector('.ttx-c360')) return r;
        var d = document.createElement('div'); d.className = 'ttx-c360'; d.innerHTML = '<div class="tt14-sec" style="color:var(--brand-red)">🔭 360° view</div>' + window.ttxC360(c); card.appendChild(d);
      } catch (e) { console.warn('c360', e); }
      return r;
    };
    w.__ttx = true; window.ttCustDash = w;
  })();
  function c360Pick() {
    var h = '<input class="ttx-search" data-i="cq" placeholder="Search customer name or phone…" autocomplete="off"><div id="ttxCQres"></div>';
    X.sheet('ttxC360', '👤 Customer 360°', h);
    var draw = function (q) {
      q = X.norm(q); var box = document.getElementById('ttxCQres'); if (!box) return;
      if (q.length < 2) { box.innerHTML = X.empty('🔎', 'Type at least 2 letters or 4 digits'); return; }
      var res = C().filter(function (c) { return c && (X.norm(c.name).indexOf(q) >= 0 || (c.phone || '').replace(/\D/g, '').indexOf(q.replace(/\D/g, '') || '§') >= 0); }).slice(0, 25);
      box.innerHTML = res.length ? res.map(function (c) { return '<div class="ttx-card" data-a="cOpen" data-p="' + H(c.id) + '"><b>' + H(c.name) + '</b><small>' + H(c.phone || '') + (c.address ? ' · ' + H(c.address) : '') + '</small></div>'; }).join('') : X.empty('🤷', 'No saved customer found');
    };
    X.bind('ttxC360', { click: { cOpen: function (p) { if (typeof ttCustDash === 'function') ttCustDash(p); } }, input: { cq: draw } });
    draw('');
  }
  window.ttOpenC360 = c360Pick;
  X.hubTiles.push({ mod: 'mC360', icon: '👤', label: 'Customer 360°', sub: 'Everything about one customer', fn: c360Pick });

  /* ================= SYNC RECOVERY CENTRE ================= */
  var LOGK = 'TTESPL_ERP_SYNC_LOG', syncLog = [];
  try { syncLog = JSON.parse(localStorage.getItem(LOGK) || '[]') || []; } catch (e) { syncLog = []; }
  function logSync(key, ok, err) {
    syncLog.unshift({ at: new Date().toISOString(), key: key, ok: !!ok, err: ok ? '' : String((err && (err.code || err.message)) || err || 'error').slice(0, 120) });
    syncLog = syncLog.slice(0, 40); try { localStorage.setItem(LOGK, JSON.stringify(syncLog)); } catch (e) {}
    if (X.isOpen('ttxSY')) syRender();
  }
  function hookPush() {
    var cs = window.cloudSync; if (!cs || typeof cs.pushKey !== 'function' || cs.pushKey.__ttx) return !!(cs && cs.pushKey && cs.pushKey.__ttx);
    var o = cs.pushKey, w = function (key) { var p; try { p = o.apply(this, arguments); } catch (e) { logSync(key, false, e); throw e; } if (p && typeof p.then === 'function') p.then(function () { logSync(key, true); }, function (e) { logSync(key, false, e); }); return p; };
    w.__ttx = true; cs.pushKey = w; return true;
  }
  var hi = 0, hv = setInterval(function () { if (hookPush() || ++hi > 60) clearInterval(hv); }, 1000);
  function queue() { try { return JSON.parse(localStorage.getItem((typeof DB_PREFIX !== 'undefined' ? DB_PREFIX : 'TTESPL_ERP_') + 'OFFLINE_QUEUE') || '{}') || {}; } catch (e) { return {}; } }
  function syHtml() {
    var q = queue(), keys = Object.keys(q), on_ = navigator.onLine !== false, fails = syncLog.filter(function (x) { return !x.ok; });
    var lastOk = syncLog.filter(function (x) { return x.ok; })[0];
    var h = '<div class="ttx-kp"><div><small>Internet</small><b style="color:' + (on_ ? '#16a34a' : '#e11d48') + '">' + (on_ ? 'Online' : 'Offline') + '</b></div><div><small>Waiting to sync</small><b>' + keys.length + '</b></div><div><small>Recent failures</small><b>' + fails.length + '</b></div></div>';
    h += '<div class="ttx-note">' + (lastOk ? 'Last confirmed cloud save: ' + X.fmtDT(lastOk.at) + ' (' + H(lastOk.key) + ')' : 'No cloud save confirmed in this session yet.') + ' Your data stays on this phone until the cloud confirms it.</div>';
    h += '<div class="ttx-btns"><button class="ttx-b pri" data-a="syAll"' + (keys.length ? '' : ' disabled') + '>🔄 Retry all</button><button class="ttx-b" data-a="syExport"' + (keys.length ? '' : ' disabled') + '>⬇ Export waiting data</button></div>';
    h += '<div class="ttx-sec">Waiting for the cloud</div>' + (keys.length ? keys.map(function (k) { var n = Array.isArray(q[k]) ? q[k].length : 1, kb = Math.round(JSON.stringify(q[k] || '').length / 1024); return '<div class="ttx-card"><div class="ttx-ct"><div><b>' + H(k) + '</b><small>' + n + ' records · ' + kb + ' KB</small></div><button class="ttx-b" data-a="syOne" data-p="' + H(k) + '">Retry</button></div></div>'; }).join('') : X.empty('✅', 'Nothing is waiting — everything is synced'));
    h += '<div class="ttx-sec">Recent save results</div>' + (syncLog.length ? syncLog.slice(0, 15).map(function (x) { return '<div class="ttx-hi"><b style="color:' + (x.ok ? '#16a34a' : '#e11d48') + '">' + (x.ok ? '✓ saved' : '✗ failed') + '</b> ' + H(x.key) + (x.err ? ' — ' + H(x.err) : '') + '<small>' + X.fmtDT(x.at) + '</small></div>'; }).join('') : '<div class="ttx-note">No save attempts recorded since this feature started.</div>');
    h += '<div class="ttx-note">Retrying re-sends the full latest copy of a list (safe to repeat; the same record id is simply overwritten with the same data, so nothing is duplicated). Conflicts between two phones editing the same record are not detected — the last save wins.</div>';
    return h;
  }
  function syRender() { X.body('ttxSY', syHtml(), true); }
  function syOpen() {
    if (!on('mSyncC')) return;
    X.sheet('ttxSY', '🔄 Sync Recovery', syHtml());
    X.bind('ttxSY', {
      click: {
        syAll: function () { if (navigator.onLine === false) return X.toast('Still offline — nothing was sent', 1); try { ttFlushOfflineQueue(); X.toast('Retrying… check status in a few seconds'); } catch (e) { X.toast('Retry could not start: ' + e.message, 1); } setTimeout(syRender, 4000); },
        syOne: function (k) { var q = queue(); if (!(k in q)) return syRender(); if (navigator.onLine === false) return X.toast('Still offline — nothing was sent', 1); var v = q[k], cs = window.cloudSync; if (!cs || !cs.pushKey) return X.toast('Cloud is not connected yet', 1);
          Promise.race([cs.pushKey(k, v), new Promise(function (_, r) { setTimeout(function () { r(new Error('timeout')); }, 15000); })]).then(function () {
            var q2 = queue(); if (q2[k] === undefined || JSON.stringify(q2[k]) === JSON.stringify(v)) { delete q2[k]; try { localStorage.setItem((typeof DB_PREFIX !== 'undefined' ? DB_PREFIX : 'TTESPL_ERP_') + 'OFFLINE_QUEUE', JSON.stringify(q2)); } catch (e) {} }
            try { updateOfflineQueueBadge(); } catch (e) {} X.toast(k + ' synced'); syRender();
          }, function (e) { X.toast('Not synced: ' + (e.message || e), 1); syRender(); }); },
        syExport: function () { var q = queue(); try { downloadFile(JSON.stringify({ app: 'TTESPL-ERP', type: 'unsynced-queue', exportedAt: new Date().toISOString(), data: q }), 'TTESPL_unsynced_' + X.ymd() + '.json', 'application/json'); } catch (e) { X.toast('Export failed', 1); } }
      }
    });
  }
  window.ttOpenSyncCentre = syOpen;
  window.addEventListener('online', function () { if (X.isOpen('ttxSY')) syRender(); }); window.addEventListener('offline', function () { if (X.isOpen('ttxSY')) syRender(); });
  X.hubTiles.push({ mod: 'mSyncC', icon: '🔄', label: 'Sync Recovery', sub: function () { var n = Object.keys(queue()).length; return n ? n + ' waiting' : 'All synced'; }, fn: syOpen });
  /* add a shortcut inside the existing "Sync Status" sheet */
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.tt-live-pill') || !on('mSyncC')) return;
    setTimeout(function () { var m = document.getElementById('tt25SyncModal'); if (!m || m.querySelector('.ttx-syb')) return; var b = document.createElement('button'); b.className = 'btn btn-outline btn-block ttx-syb'; b.style.marginTop = '10px'; b.textContent = '🔄 Open Sync Recovery Centre'; b.onclick = function () { m.style.display = 'none'; syOpen(); }; m.firstChild.appendChild(b); }, 120);
  }, true);
  var prev = window.ttxOnCloud;
  window.ttxOnCloud = function (p) { if (prev) try { prev(p); } catch (e) {} if (p && p.LEADS) { try { drawBoard(); } catch (e) {} } };
})();

/* ===== v29 · Attendance & Leave + Calendar & Announcements ===== */
(function () {
  'use strict';
  var X = window.ttx, H = X.H, on = X.on, me = X.me, isAdm = X.isAdm, ymd = X.ymd;
  function pad(n) { return String(n).padStart(2, '0'); }
  function hm(d) { d = d || new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5) + 1; }
  function admins() { return X.emps().filter(function (e) { return /admin/i.test(e.role || ''); }); }

  /* acknowledged save: toast only after the cloud really confirms; otherwise say what is true */
  X.saveConfirmed = function (key, arr, okMsg, done) {
    X.save(key, arr);
    X.cloudConfirm(key, arr).then(function () { X.toast(okMsg + ' · saved to cloud'); done && done(true); }, function (e) {
      X.toast('Saved on this phone but the cloud has not confirmed (' + (e.message || e) + '). It will keep retrying — see Sync Recovery.', 1); done && done(false);
    });
  };

  /* ================= ATTENDANCE ================= */
  var AT = { tab: 'today', month: ymd().slice(0, 7), emp: '' };
  function att() { return X.list('ATTENDANCE'); }
  function attId(eid, d) { return 'ATT-' + eid + '-' + d; }
  function myAtt(d) { return X.byId('ATTENDANCE', attId(X.meId(), d)); }
  var busyK = {};
  function lock(k) { if (busyK[k]) return true; busyK[k] = 1; setTimeout(function () { busyK[k] = 0; }, 1200); return false; }
  function checkIn() {
    if (lock('in')) return; var d = ymd(), r = myAtt(d);
    if (r && r.in) return X.toast('You already checked in today at ' + r.in, 1);
    var onLeave = leaves().some(function (l) { return String(l.empId) === X.meId() && l.status === 'Approved' && l.from <= d && d <= l.to; });
    if (onLeave && !confirm('You have approved leave today. Check in anyway?')) return;
    var rec = { id: attId(X.meId(), d), empId: X.meId(), name: me(), date: d, in: hm(), inAt: new Date().toISOString(), out: '', corr: [] };
    var l = att().filter(function (x) { return x.id !== rec.id; }); l.unshift(rec);
    X.saveConfirmed('ATTENDANCE', l, 'Checked in at ' + rec.in, function () { atRender(); });
    atRender();
  }
  function checkOut() {
    if (lock('out')) return; var d = ymd(), r = myAtt(d);
    if (!r || !r.in) return X.toast('Check in first', 1);
    if (r.out) return X.toast('You already checked out at ' + r.out, 1);
    var t = hm(); if (t < r.in) return X.toast('Check-out time cannot be before check-in', 1);
    var n = JSON.parse(JSON.stringify(r)); n.out = t; n.outAt = new Date().toISOString();
    var l = att().map(function (x) { return x.id === n.id ? n : x; });
    X.saveConfirmed('ATTENDANCE', l, 'Checked out at ' + t, function () { atRender(); });
    atRender();
  }
  function mins(r) { if (!r || !r.in || !r.out) return 0; var a = r.in.split(':'), b = r.out.split(':'); return (b[0] * 60 + +b[1]) - (a[0] * 60 + +a[1]); }
  function dur(m) { return m > 0 ? Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm' : '—'; }
  function atHtml() {
    var tabs = [['today', 'Today'], ['month', 'My month'], ['leave', 'Leave']]; if (isAdm()) tabs.push(['team', 'Team'], ['approve', 'Approvals' + (pendingLeaves() ? ' (' + pendingLeaves() + ')' : '')]);
    var h = '<div class="ttx-tabs">' + tabs.map(function (t) { return '<button class="' + (AT.tab === t[0] ? 'on' : '') + '" data-a="atTab" data-p="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (AT.tab === 'today') {
      var d = ymd(), r = myAtt(d);
      h += '<div class="ttx-big"><small>' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' }) + '</small><b>' + (r && r.in ? 'In ' + r.in + (r.out ? ' · Out ' + r.out : '') : 'Not checked in') + '</b>' + (r && r.out ? '<small>Worked ' + dur(mins(r)) + '</small>' : '') + '</div>' +
        '<div class="ttx-btns"><button class="ttx-b pri" data-a="atIn"' + (r && r.in ? ' disabled' : '') + '>🟢 Check in</button><button class="ttx-b" data-a="atOut"' + (!r || !r.in || r.out ? ' disabled' : '') + '>🔴 Check out</button></div>' +
        '<div class="ttx-note">Time is taken from this phone’s clock. Wrong entries can only be corrected by Admin, with a reason, and every correction is kept in the record.</div>';
    } else if (AT.tab === 'month') {
      h += monthPicker() + monthTable(X.meId(), false);
    } else if (AT.tab === 'leave') {
      h += '<div class="ttx-btns"><button class="ttx-b pri" data-a="lvNew">＋ Request leave</button></div>' + leaveList(function (l) { return String(l.empId) === X.meId(); }, false);
    } else if (AT.tab === 'team' && isAdm()) {
      var d2 = ymd(), rows = X.emps().map(function (e) { var r = X.byId('ATTENDANCE', attId(e.id, d2)), lv = leaves().some(function (l) { return String(l.empId) === String(e.id) && l.status === 'Approved' && l.from <= d2 && d2 <= l.to; }); return '<div class="ttx-card"><div class="ttx-ct"><div><b>' + H(e.name) + '</b><small>' + (r && r.in ? 'In ' + r.in + (r.out ? ' · Out ' + r.out : ' · still in') : (lv ? 'On approved leave' : 'No check-in yet')) + '</small></div>' + (r && r.in ? X.chip('Present', 'ok') : (lv ? X.chip('Leave') : X.chip('—'))) + '</div></div>'; }).join('');
      h += '<div class="ttx-sec">Today · ' + X.fmtD(d2) + '</div>' + rows + '<div class="ttx-sec">Monthly view</div>' + monthPicker() + X.sel('atEmp', X.empOpts(), AT.emp || (X.emps()[0] ? String(X.emps()[0].id) : '')) + monthTable(AT.emp || (X.emps()[0] ? String(X.emps()[0].id) : ''), true);
    } else if (AT.tab === 'approve' && isAdm()) {
      h += leaveList(function (l) { return l.status === 'Pending'; }, true) + '<div class="ttx-sec">Recently decided</div>' + leaveList(function (l) { return l.status === 'Approved' || l.status === 'Rejected'; }, true, 10);
    }
    return h;
  }
  function monthPicker() { return '<div class="ttx-row"><button class="ttx-b" data-a="atPrev">‹</button><b style="flex:1;text-align:center">' + new Date(AT.month + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + '</b><button class="ttx-b" data-a="atNext">›</button></div>'; }
  function monthTable(eid, adminView) {
    var rows = att().filter(function (r) { return r && String(r.empId) === String(eid) && String(r.date).slice(0, 7) === AT.month; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var open = rows.filter(function (r) { return r.in && !r.out && r.date < ymd(); }).length, lvDays = 0;
    leaves().forEach(function (l) { if (String(l.empId) === String(eid) && l.status === 'Approved') for (var d = l.from; d <= l.to; d = addDays(d, 1)) if (d.slice(0, 7) === AT.month) lvDays++; });
    var h = '<div class="ttx-kp"><div><small>Days present</small><b>' + rows.filter(function (r) { return r.in; }).length + '</b></div><div><small>Leave days</small><b>' + lvDays + '</b></div><div><small>No check-out</small><b>' + open + '</b></div></div>';
    if (!rows.length) return h + X.empty('🕘', 'No attendance recorded this month');
    return h + rows.map(function (r) {
      return '<div class="ttx-card"><div class="ttx-ct"><div><b>' + X.fmtD(r.date) + '</b><small>In ' + (r.in || '—') + ' · Out ' + (r.out || '—') + ' · ' + dur(mins(r)) + (r.corr && r.corr.length ? ' · ✎ corrected' : '') + '</small></div>' + (adminView ? '<button class="ttx-b" data-a="atFix" data-p="' + H(r.id) + '">Correct</button>' : '') + '</div></div>';
    }).join('');
  }
  function atRender() { X.body('ttxAT', atHtml(), true); }
  function atFix(id) {
    var r = X.byId('ATTENDANCE', id); if (!r || !isAdm()) return;
    var h = '<div class="ttx-note">' + H(r.name) + ' · ' + X.fmtD(r.date) + '</div><div class="ttx-two">' + X.field('Check-in', '<input type="time" id="ttxAFin" value="' + H(r.in || '') + '">') + X.field('Check-out', '<input type="time" id="ttxAFout" value="' + H(r.out || '') + '">') + '</div>' + X.field('Reason (required)', '<input id="ttxAFwhy" maxlength="160" placeholder="e.g. forgot to check out">') +
      '<div class="ttx-btns"><button class="ttx-b pri" data-a="afSave" data-p="' + H(id) + '">Save correction</button></div>' + (r.corr && r.corr.length ? '<div class="ttx-sec">Earlier corrections</div>' + r.corr.map(function (c) { return '<div class="ttx-hi">' + H(c.fromIn || '—') + '/' + H(c.fromOut || '—') + ' → ' + H(c.toIn || '—') + '/' + H(c.toOut || '—') + ' — ' + H(c.why) + '<small>' + H(c.by) + ' · ' + X.fmtDT(c.at) + '</small></div>'; }).join('') : '');
    X.sheet('ttxAF', 'Correct attendance', h, { z: 3600 });
    X.bind('ttxAF', { click: { afSave: function (p) {
      var g = function (i) { return (document.getElementById(i) || {}).value || ''; }, why = g('ttxAFwhy').trim(), ni = g('ttxAFin'), no = g('ttxAFout');
      if (!why) return X.toast('A reason is required', 1); if (!ni) return X.toast('Check-in time is required', 1); if (no && no < ni) return X.toast('Check-out cannot be before check-in', 1);
      var cur = JSON.parse(JSON.stringify(X.byId('ATTENDANCE', p))); cur.corr = (cur.corr || []).concat([{ at: new Date().toISOString(), by: me(), why: why, fromIn: cur.in, fromOut: cur.out, toIn: ni, toOut: no }]); cur.in = ni; cur.out = no;
      X.saveConfirmed('ATTENDANCE', att().map(function (x) { return x.id === p ? cur : x; }), 'Attendance corrected'); X.close('ttxAF'); atRender();
    } } });
  }
  function atOpen() {
    if (!on('mAttend')) return;
    X.sheet('ttxAT', '🕘 Attendance & Leave', ''); 
    X.bind('ttxAT', {
      click: {
        atTab: function (p) { AT.tab = p; atRender(); }, atIn: checkIn, atOut: checkOut, atFix: atFix, lvNew: lvForm,
        atPrev: function () { AT.month = shiftMonth(AT.month, -1); atRender(); }, atNext: function () { AT.month = shiftMonth(AT.month, 1); atRender(); },
        lvCancel: function (p) { lvStatus(p, 'Cancelled'); }, lvApprove: function (p) { lvDecide(p, 'Approved'); }, lvReject: function (p) { lvDecide(p, 'Rejected'); }
      },
      change: { atEmp: function (v) { AT.emp = v; atRender(); } }
    });
    atRender();
  }
  function shiftMonth(m, n) { var d = new Date(m + '-01T00:00:00'); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  window.ttOpenAttendance = atOpen; window.ttOpenLeaves = function () { AT.tab = isAdm() ? 'approve' : 'leave'; atOpen(); };

  /* ----- leave ----- */
  function leaves() { return X.list('LEAVES'); }
  function pendingLeaves() { return isAdm() ? leaves().filter(function (l) { return l && l.status === 'Pending' && !(String(l.empId) === X.meId() && admins().length > 1); }).length : 0; }
  window.ttPendingLeaveCount = pendingLeaves;
  function leaveList(pred, adminView, lim) {
    var rows = leaves().filter(function (l) { return l && pred(l); }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, lim || 50);
    if (!rows.length) return X.empty('🏖️', 'No leave requests');
    return rows.map(function (l) {
      var own = String(l.empId) === X.meId(), cls = l.status === 'Approved' ? 'ok' : (l.status === 'Pending' ? 'warn' : (l.status === 'Rejected' ? 'bad' : ''));
      var canDecide = adminView && l.status === 'Pending' && (!own || admins().length <= 1);
      return '<div class="ttx-card"><div class="ttx-ct"><div><b>' + (adminView ? H(l.empName) + ' · ' : '') + H(l.type) + ' · ' + daysBetween(l.from, l.to) + ' day(s)</b><small>' + X.fmtD(l.from) + (l.to !== l.from ? ' → ' + X.fmtD(l.to) : '') + '</small></div>' + X.chip(l.status, cls) + '</div>' + (l.reason ? '<div class="ttx-note">' + H(l.reason) + '</div>' : '') + (l.decidedBy ? '<small>' + H(l.status) + ' by ' + H(l.decidedBy) + (l.decisionNote ? ' — ' + H(l.decisionNote) : '') + '</small>' : '') +
        '<div class="ttx-btns">' + (canDecide ? '<button class="ttx-b pri" data-a="lvApprove" data-p="' + H(l.id) + '">Approve</button><button class="ttx-b dng" data-a="lvReject" data-p="' + H(l.id) + '">Reject</button>' : '') + (own && (l.status === 'Pending' || (l.status === 'Approved' && l.to >= ymd())) ? '<button class="ttx-b" data-a="lvCancel" data-p="' + H(l.id) + '">Cancel request</button>' : '') + (adminView && l.status === 'Pending' && own && admins().length > 1 ? '<small>Another Admin must decide your own request.</small>' : '') + '</div></div>';
    }).join('');
  }
  function lvForm() {
    var h = '<div class="ttx-two">' + X.field('From *', '<input type="date" id="ttxLVf" value="' + ymd() + '">') + X.field('To *', '<input type="date" id="ttxLVt" value="' + ymd() + '">') + '</div>' + X.field('Type', '<select id="ttxLVty">' + ['Casual', 'Sick', 'Earned', 'Unpaid', 'Other'].map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select>') + X.field('Reason', '<textarea id="ttxLVr" rows="2" maxlength="300"></textarea>') + '<div class="ttx-btns"><button class="ttx-b pri" data-a="lvSend">Send request</button></div><div class="ttx-note">No leave balance is calculated — your office policy is not configured in the app.</div>';
    X.sheet('ttxLV', 'Request leave', h, { z: 3600 });
    X.bind('ttxLV', { click: { lvSend: function () {
      if (lock('lv')) return; var g = function (i) { return (document.getElementById(i) || {}).value || ''; }, f = g('ttxLVf'), t = g('ttxLVt');
      if (!f || !t) return X.toast('Select both dates', 1); if (t < f) return X.toast('“To” date cannot be before “From”', 1);
      if (f < addDays(ymd(), -31)) return X.toast('Back-dated by more than 31 days — ask Admin to record it', 1); if (daysBetween(f, t) > 60) return X.toast('Maximum 60 days per request', 1);
      var clash = leaves().find(function (l) { return String(l.empId) === X.meId() && (l.status === 'Pending' || l.status === 'Approved') && !(t < l.from || f > l.to); });
      if (clash) return X.toast('Overlaps your ' + clash.status.toLowerCase() + ' leave ' + X.fmtD(clash.from) + ' – ' + X.fmtD(clash.to), 1);
      var rec = { id: X.uid('LV'), empId: X.meId(), empName: me(), from: f, to: t, type: g('ttxLVty'), reason: g('ttxLVr').trim(), status: 'Pending', createdAt: new Date().toISOString(), hist: [] }; X.hist(rec, 'requested', '');
      var l = leaves().slice(); l.unshift(rec); X.saveConfirmed('LEAVES', l, 'Leave request sent'); X.close('ttxLV'); atRender();
      try { if (window.cloudSync && window.cloudSync.pushLiveNotification) window.cloudSync.pushLiveNotification({ title: '🏖️ Leave request', body: me() + ' · ' + X.fmtD(f) + (t !== f ? ' → ' + X.fmtD(t) : ''), type: 'leave' }); } catch (e) {}
    } } });
  }
  function lvDecide(id, st) {
    var l0 = X.byId('LEAVES', id); if (!l0 || !isAdm()) return X.toast('Only Admin can decide', 1);
    if (l0.status !== 'Pending') return X.toast('Already ' + l0.status.toLowerCase(), 1);
    if (String(l0.empId) === X.meId() && admins().length > 1) return X.toast('Another Admin must decide your own leave', 1);
    var note = st === 'Rejected' ? (prompt('Reason for rejecting (shown to employee)') || '').trim() : ''; if (st === 'Rejected' && !note) return X.toast('A reason is required to reject', 1);
    var l = JSON.parse(JSON.stringify(l0)); l.status = st; l.decidedBy = me(); l.decidedAt = new Date().toISOString(); l.decisionNote = note; X.hist(l, st.toLowerCase(), note);
    X.saveConfirmed('LEAVES', leaves().map(function (x) { return x.id === id ? l : x; }), 'Leave ' + st.toLowerCase()); atRender(); X.ttxDash && X.ttxDash();
    try { if (window.ttxDashRefresh) window.ttxDashRefresh(); } catch (e) {}
  }
  function lvStatus(id, st) {
    var l0 = X.byId('LEAVES', id); if (!l0) return; if (String(l0.empId) !== X.meId() && !isAdm()) return X.toast('Not allowed', 1);
    if (l0.status === st) return; if (!confirm('Cancel this leave request?')) return;
    var l = JSON.parse(JSON.stringify(l0)); l.status = st; X.hist(l, st.toLowerCase(), ''); X.saveConfirmed('LEAVES', leaves().map(function (x) { return x.id === id ? l : x; }), 'Leave cancelled'); atRender();
  }
  X.hubTiles.push({ mod: 'mAttend', icon: '🕘', label: 'Attendance & Leave', sub: function () { var r = myAtt(ymd()), p = pendingLeaves(); return (r && r.in ? (r.out ? 'Done for today' : 'Checked in ' + r.in) : 'Not checked in') + (p ? ' · ' + p + ' to approve' : ''); }, fn: atOpen });

  /* ================= CALENDAR ================= */
  var CAL = { m: ymd().slice(0, 7), d: ymd(), layers: { ev: 1, fu: 1, tk: 1, lv: 1 } };
  var EVT = ['Meeting', 'Holiday', 'Deadline', 'Service visit', 'Other'];
  function events() { return X.list('EVENTS'); }
  function evVisible(e) {
    if (!e) return false; var v = e.vis || 'all', mid = X.meId();
    if (String(e.createdById) === mid) return true;
    if (v === 'all') return true; if (v === 'admin') return isAdm(); if (v === 'people') return (e.audience || []).map(String).indexOf(mid) >= 0 || false; return false; /* 'private' */
  }
  function dayItems(d) {
    var out = [], mid = X.meId(), mine = me();
    if (CAL.layers.ev) events().filter(evVisible).forEach(function (e) { if (e.date <= d && (e.endDate || e.date) >= d) out.push({ t: 'ev', icon: e.type === 'Holiday' ? '🎉' : '📅', title: e.title, sub: (e.time ? e.time + ' · ' : '') + e.type + (e.vis && e.vis !== 'all' ? ' · ' + e.vis : ''), id: e.id, time: e.time || '' }); });
    if (CAL.layers.lv) leaves().forEach(function (l) { if (l && l.status === 'Approved' && l.from <= d && l.to >= d && (isAdm() || String(l.empId) === mid)) out.push({ t: 'lv', icon: '🏖️', title: l.empName + ' on leave', sub: l.type, time: '' }); });
    if (CAL.layers.tk && on('mTasks')) X.list('TASKS').forEach(function (t) { if (t && t.due === d && t.status !== 'Done' && t.status !== 'Cancelled' && (isAdm() || String(t.assigneeId) === mid)) out.push({ t: 'tk', icon: '✅', title: t.title, sub: 'Task · ' + t.assigneeName, time: '' }); });
    if (CAL.layers.fu) {
      try { leadsData.forEach(function (l) { if (l && l.status !== 'Installed' && l.followupDate === d && (isAdm() || l.handledBy === mine)) out.push({ t: 'fu', icon: '🎯', title: 'Follow up: ' + l.customerName, sub: l.machine || 'Lead', time: '' }); }); } catch (e) {}
      try { ordersData.forEach(function (o) { if (o && o.status !== 'Cancelled' && o.dueAmount > 0 && o.payFollowupDate === d && (isAdm() || o.bookedBy === mine)) out.push({ t: 'fu', icon: '💰', title: 'Collect: ' + o.customerName, sub: X.inr(o.dueAmount), time: '' }); }); } catch (e) {}
      try { serviceCallsData.forEach(function (s) { if (s && s.status !== 'Work Completed' && s.targetDate === d && (isAdm() || s.attendedBy === mine)) out.push({ t: 'fu', icon: '🛠️', title: 'Service: ' + s.customerName, sub: s.machine || '', time: '' }); }); } catch (e) {}
    }
    return out.sort(function (a, b) { return String(a.time || '99').localeCompare(String(b.time || '99')); });
  }
  function calHtml() {
    var first = new Date(CAL.m + '-01T00:00:00'), start = first.getDay(), dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), t = ymd();
    var h = '<div class="ttx-row"><button class="ttx-b" data-a="calPrev">‹</button><b style="flex:1;text-align:center">' + first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + '</b><button class="ttx-b" data-a="calNext">›</button><button class="ttx-b" data-a="calToday">Today</button></div>';
    h += '<div class="ttx-layers">' + [['ev', 'Events'], ['fu', 'Follow-ups'], ['tk', 'Tasks'], ['lv', 'Leave']].map(function (l) { return '<label><input type="checkbox" data-c="calLy" data-k="' + l[0] + '"' + (CAL.layers[l[0]] ? ' checked' : '') + '> ' + l[1] + '</label>'; }).join('') + '</div>';
    h += '<div class="ttx-cal">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (d) { return '<i>' + d + '</i>'; }).join('');
    for (var i = 0; i < start; i++) h += '<span></span>';
    for (var d = 1; d <= dim; d++) { var ds = CAL.m + '-' + pad(d), n = dayItems(ds).length; h += '<button class="' + (ds === CAL.d ? 'sel ' : '') + (ds === t ? 'tod ' : '') + '" data-a="calDay" data-p="' + ds + '">' + d + (n ? '<u>' + Math.min(n, 9) + '</u>' : '') + '</button>'; }
    h += '</div><div class="ttx-sec">' + X.fmtD(CAL.d) + '</div>';
    var it = dayItems(CAL.d);
    h += it.length ? it.map(function (x) { return '<div class="ttx-card"' + (x.t === 'ev' ? ' data-a="evOpen" data-p="' + H(x.id) + '"' : '') + '><div class="ttx-ct"><div><b>' + x.icon + ' ' + H(x.title) + '</b><small>' + H(x.sub) + '</small></div></div></div>'; }).join('') : X.empty('📭', 'Nothing scheduled');
    return h + '<div class="ttx-btns"><button class="ttx-b pri" data-a="evNew">＋ Add event</button></div><div class="ttx-note">Event visibility is applied inside the app. It is not a database-level restriction — see the security notes delivered with this version.</div>';
  }
  function calRender() { X.body('ttxCAL', calHtml(), true); }
  function calOpen() {
    if (!on('mCal')) return; X.sheet('ttxCAL', '📅 Office Calendar', '');
    X.bind('ttxCAL', { click: {
      calPrev: function () { CAL.m = shiftMonth(CAL.m, -1); CAL.d = CAL.m + '-01'; calRender(); }, calNext: function () { CAL.m = shiftMonth(CAL.m, 1); CAL.d = CAL.m + '-01'; calRender(); },
      calToday: function () { CAL.m = ymd().slice(0, 7); CAL.d = ymd(); calRender(); }, calDay: function (p) { CAL.d = p; calRender(); }, evNew: function () { evForm(null); }, evOpen: function (p) { evForm(X.byId('EVENTS', p)); }
    }, change: { calLy: function (v, el) { CAL.layers[el.getAttribute('data-k')] = el.checked ? 1 : 0; calRender(); } } });
    calRender();
  }
  window.ttOpenCalendar = calOpen;
  function evForm(e) {
    var can = !e || isAdm() || String(e.createdById) === X.meId(), dis = can ? '' : ' disabled';
    var h = X.field('Title *', '<input id="ttxEVt" maxlength="100" value="' + H(e ? e.title : '') + '"' + dis + '>') + '<div class="ttx-two">' + X.field('Date *', '<input type="date" id="ttxEVd" value="' + H(e ? e.date : CAL.d) + '"' + dis + '>') + X.field('Time', '<input type="time" id="ttxEVtm" value="' + H(e ? e.time || '' : '') + '"' + dis + '>') + '</div>' +
      '<div class="ttx-two">' + X.field('Ends (optional)', '<input type="date" id="ttxEVe" value="' + H(e ? e.endDate || '' : '') + '"' + dis + '>') + X.field('Type', '<select id="ttxEVty"' + dis + '>' + EVT.map(function (t) { return '<option' + (e && e.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>') + '</div>' +
      X.field('Who can see it', '<select id="ttxEVv"' + dis + '><option value="all"' + ((!e || e.vis === 'all') ? ' selected' : '') + '>Everyone</option>' + (isAdm() ? '<option value="admin"' + (e && e.vis === 'admin' ? ' selected' : '') + '>Admins only</option>' : '') + '<option value="people"' + (e && e.vis === 'people' ? ' selected' : '') + '>Selected people</option><option value="private"' + (e && e.vis === 'private' ? ' selected' : '') + '>Only me</option></select>') +
      '<div id="ttxEVp" class="ttx-layers">' + X.emps().map(function (m) { return '<label><input type="checkbox" value="' + H(m.id) + '"' + (e && (e.audience || []).map(String).indexOf(String(m.id)) >= 0 ? ' checked' : '') + dis + '> ' + H(m.name) + '</label>'; }).join('') + '</div>' +
      X.field('Notes', '<textarea id="ttxEVn" rows="2" maxlength="300"' + dis + '>' + H(e ? e.notes || '' : '') + '</textarea>') +
      (can ? '<div class="ttx-btns"><button class="ttx-b pri" data-a="evSave">Save</button>' + (e ? '<button class="ttx-b dng" data-a="evDel">Delete</button>' : '') + '</div>' : '<div class="ttx-note">Created by ' + H(e.createdBy) + ' — only they or an Admin can change it.</div>');
    X.sheet('ttxEV', e ? 'Event' : 'New event', h, { z: 3600 });
    X.bind('ttxEV', { click: {
      evSave: function () {
        if (lock('ev')) return; var g = function (i) { return (document.getElementById(i) || {}).value || ''; }, t = g('ttxEVt').trim(), d = g('ttxEVd'), en = g('ttxEVe'), v = g('ttxEVv');
        if (!t || !d) return X.toast('Title and date are required', 1); if (en && en < d) return X.toast('End date is before start date', 1);
        var aud = Array.prototype.map.call(document.querySelectorAll('#ttxEVp input:checked'), function (c) { return c.value; }); if (v === 'people' && !aud.length) return X.toast('Pick at least one person', 1);
        var rec = e ? JSON.parse(JSON.stringify(e)) : { id: X.uid('EVT'), createdById: X.meId(), createdBy: me(), createdAt: new Date().toISOString() };
        Object.assign(rec, { title: t, date: d, endDate: en, time: g('ttxEVtm'), type: g('ttxEVty'), vis: v, audience: v === 'people' ? aud : [], notes: g('ttxEVn').trim(), updatedAt: new Date().toISOString() });
        X.saveConfirmed('EVENTS', events().filter(function (x) { return x.id !== rec.id; }).concat([rec]), 'Event saved'); X.close('ttxEV'); calRender();
      },
      evDel: function () { if (!confirm('Delete this event?')) return; var id = e.id; X.saveConfirmed('EVENTS', events().filter(function (x) { return x.id !== id; }), 'Event deleted'); try { if (window.cloudSync && window.cloudSync.deleteItem) window.cloudSync.deleteItem('EVENTS', id); } catch (er) {} X.close('ttxEV'); calRender(); }
    } });
  }

  /* ================= ANNOUNCEMENTS ================= */
  var SEEN = 'TTX_NOTICE_SEEN_' + 'u';
  function seen() { try { return JSON.parse(localStorage.getItem(SEEN + X.meId()) || '{}') || {}; } catch (e) { return {}; } }
  function markSeen(id) { var s = seen(); s[id] = 1; try { localStorage.setItem(SEEN + X.meId(), JSON.stringify(s)); } catch (e) {} }
  function noticeVisible(n) { if (!n) return false; if (n.expires && n.expires < ymd()) return isAdm(); if (isAdm() || String(n.createdById) === X.meId()) return true; return !n.audience || !n.audience.length || n.audience.map(String).indexOf(X.meId()) >= 0; }
  function notices() { return X.list('NOTICES').filter(noticeVisible).sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.createdAt).localeCompare(String(a.createdAt)); }); }
  function unread() { var s = seen(); return notices().filter(function (n) { return !s[n.id] && !(n.expires && n.expires < ymd()); }).length; }
  function nHtml() {
    var s = seen(), rows = notices();
    var h = (isAdm() ? '<div class="ttx-btns"><button class="ttx-b pri" data-a="nNew">＋ New announcement</button></div>' : '') + (rows.length ? '' : X.empty('📣', 'No announcements'));
    return h + rows.map(function (n) {
      var exp = n.expires && n.expires < ymd();
      return '<div class="ttx-card' + (n.priority === 'Urgent' ? ' urg' : '') + '"><div class="ttx-ct"><div><b>' + (n.pinned ? '📌 ' : '') + H(n.title) + '</b><small>' + H(n.createdBy) + ' · ' + X.fmtDT(n.createdAt) + (n.audience && n.audience.length ? ' · selected people' : '') + (exp ? ' · expired' : '') + '</small></div>' + (n.priority !== 'Normal' ? X.chip(n.priority, n.priority === 'Urgent' ? 'bad' : 'warn') : '') + (!s[n.id] && !exp ? X.chip('NEW', 'ok') : '') + '</div><div class="ttx-note" style="white-space:pre-wrap">' + H(n.body) + '</div>' + (isAdm() ? '<div class="ttx-btns"><button class="ttx-b" data-a="nPin" data-p="' + H(n.id) + '">' + (n.pinned ? 'Unpin' : 'Pin') + '</button><button class="ttx-b" data-a="nEdit" data-p="' + H(n.id) + '">Edit</button><button class="ttx-b dng" data-a="nDel" data-p="' + H(n.id) + '">Delete</button></div>' : '') + '</div>';
    }).join('') + '<div class="ttx-note">“NEW” is tracked on this phone only. Visibility is applied inside the app, not enforced by the database.</div>';
  }
  function nRender() { X.body('ttxNT', nHtml(), true); }
  function nOpen() {
    if (!on('mCal')) return; X.sheet('ttxNT', '📣 Announcements', '');
    X.bind('ttxNT', { click: { nNew: function () { nForm(null); }, nEdit: function (p) { nForm(X.byId('NOTICES', p)); }, nPin: function (p) { var n = JSON.parse(JSON.stringify(X.byId('NOTICES', p))); n.pinned = !n.pinned; X.saveConfirmed('NOTICES', X.list('NOTICES').map(function (x) { return x.id === p ? n : x; }), n.pinned ? 'Pinned' : 'Unpinned'); nRender(); },
      nDel: function (p) { if (!confirm('Delete this announcement for everyone?')) return; X.saveConfirmed('NOTICES', X.list('NOTICES').filter(function (x) { return x.id !== p; }), 'Announcement deleted'); try { if (window.cloudSync && window.cloudSync.deleteItem) window.cloudSync.deleteItem('NOTICES', p); } catch (e) {} nRender(); } } });
    nRender(); notices().forEach(function (n) { markSeen(n.id); });
  }
  window.ttOpenNotices = nOpen;
  function nForm(n) {
    if (!isAdm()) return;
    var h = X.field('Title *', '<input id="ttxNTt" maxlength="100" value="' + H(n ? n.title : '') + '">') + X.field('Message *', '<textarea id="ttxNTb" rows="4" maxlength="800">' + H(n ? n.body : '') + '</textarea>') + '<div class="ttx-two">' + X.field('Priority', '<select id="ttxNTp">' + ['Normal', 'Important', 'Urgent'].map(function (p) { return '<option' + (n && n.priority === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select>') + X.field('Expires (optional)', '<input type="date" id="ttxNTe" value="' + H(n ? n.expires || '' : '') + '">') + '</div>' +
      '<div class="ttx-sec">Send to (none ticked = everyone)</div><div id="ttxNTa" class="ttx-layers">' + X.emps().map(function (m) { return '<label><input type="checkbox" value="' + H(m.id) + '"' + (n && (n.audience || []).map(String).indexOf(String(m.id)) >= 0 ? ' checked' : '') + '> ' + H(m.name) + '</label>'; }).join('') + '</div><div class="ttx-btns"><button class="ttx-b pri" data-a="ntSave">Publish</button></div>';
    X.sheet('ttxNF', n ? 'Edit announcement' : 'New announcement', h, { z: 3600 });
    X.bind('ttxNF', { click: { ntSave: function () {
      if (lock('nt')) return; var g = function (i) { return (document.getElementById(i) || {}).value || ''; }, t = g('ttxNTt').trim(), b = g('ttxNTb').trim(); if (!t || !b) return X.toast('Title and message are required', 1);
      var rec = n ? JSON.parse(JSON.stringify(n)) : { id: X.uid('NTC'), createdById: X.meId(), createdBy: me(), createdAt: new Date().toISOString() };
      Object.assign(rec, { title: t, body: b, priority: g('ttxNTp'), expires: g('ttxNTe'), audience: Array.prototype.map.call(document.querySelectorAll('#ttxNTa input:checked'), function (c) { return c.value; }), updatedAt: new Date().toISOString() });
      X.saveConfirmed('NOTICES', X.list('NOTICES').filter(function (x) { return x.id !== rec.id; }).concat([rec]), 'Announcement published'); X.close('ttxNF'); nRender(); markSeen(rec.id);
      if (!n) try { if (window.cloudSync && window.cloudSync.pushLiveNotification) window.cloudSync.pushLiveNotification({ title: '📣 ' + t, body: b.slice(0, 120), type: 'notice' }); } catch (e) {}
    } } });
  }
  X.hubTiles.push({ mod: 'mCal', icon: '📅', label: 'Calendar', sub: 'Events, follow-ups, leave', fn: calOpen });
  X.hubTiles.push({ mod: 'mCal', icon: '📣', label: 'Announcements', sub: function () { var u = unread(); return u ? u + ' new' : 'No new notices'; }, fn: nOpen });

  var prev = window.ttxOnCloud;
  window.ttxOnCloud = function (p) {
    if (prev) try { prev(p); } catch (e) {}
    if (p) { if ((p.ATTENDANCE || p.LEAVES) && X.isOpen('ttxAT')) atRender(); if ((p.EVENTS || p.LEAVES || p.TASKS) && X.isOpen('ttxCAL')) calRender(); if (p.NOTICES && X.isOpen('ttxNT')) nRender(); }
  };
  setTimeout(function () { if (on('mCal') && unread() && X.me() !== 'Staff') X.toast('📣 ' + unread() + ' new announcement' + (unread() > 1 ? 's' : '') + ' — Profile ▸ Office Hub'); }, 4000);
})();
