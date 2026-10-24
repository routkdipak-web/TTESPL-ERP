/* TTESPL ERP module: 08-customer-card-back-manager-import.js */
/* ===== v25.2: customer card in order form + GSTIN check / auto-fetch in customer form ===== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var H = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var feat = function (k) { try { return window.ttFeat ? window.ttFeat.get(k) : 1; } catch (e) { return 1; } };

  /* ---- 1) small customer card in the order form ---- */
  function findCust(txt) {
    try { var c = resolveCustomerFromSearch(txt); if (c) return c; } catch (e) {}
    return null;
  }
  function updateCard() {
    var inp = $('ordCustSearchInput'); if (!inp) return;
    var card = $('tt26CustCard');
    if (!card) { card = document.createElement('div'); card.id = 'tt26CustCard'; card.className = 'tt26-card'; inp.parentElement.appendChild(card); }
    var txt = (inp.value || '').trim(), c = (feat('custCard') && txt) ? findCust(txt) : null;
    if (!c) { card.style.display = 'none'; return; }
    var gst = c.gst && c.gst !== 'Unregistered' ? c.gst : '';
    card.style.display = 'block';
    card.innerHTML = '<div class="tt26-r"><span>GSTIN</span><b>' + (gst ? H(gst) : '<em>Unregistered</em>') + '</b></div>' +
      '<div class="tt26-r"><span>Address</span><b>' + H(c.address || '—') + '</b></div>' + (c.phone ? '<div class="tt26-r"><span>Phone</span><b>' + H(c.phone) + '</b></div>' : '');
  }
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'ordCustSearchInput') setTimeout(updateCard, 0); });
  ['selectCustomerSuggestion', 'openOrderModal'].forEach(function (n) {
    var f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { var r = f.apply(this, arguments); setTimeout(updateCard, 30); return r; };
    try { (0, eval)(n + ' = window.' + n + ';'); } catch (e) {}
  });

  /* ---- 2) GSTIN validation (offline) + optional online fetch ---- */
  var STATES = { '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory' };
  function gstCheck(g) {
    g = String(g || '').trim().toUpperCase();
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { ok: false, why: 'format' };
    var cs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', sum = 0;
    for (var i = 0; i < 14; i++) { var v = cs.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2); sum += Math.floor(v / 36) + (v % 36); }
    var chk = cs[(36 - (sum % 36)) % 36];
    return { ok: chk === g[14], why: chk === g[14] ? '' : 'checksum', g: g, state: STATES[g.slice(0, 2)] || '', pan: g.slice(2, 12) };
  }
  window.ttGstCheck = gstCheck;
  function setStatus(html, cls) { var s = $('tt26GstStatus'); if (s) { s.className = 'tt26-gs ' + (cls || ''); s.innerHTML = html; } }
  function addrOf(info) {
    var p = info.pradr || info.principalAddress || {}, a = p.addr || p.adr || p;
    if (typeof a === 'string') return a;
    var parts = [a.bno, a.flno, a.bnm, a.st, a.loc, a.locality, a.dst, a.city, a.stcd, a.pncd].filter(Boolean);
    return parts.join(', ') || info.adr || info.address || '';
  }
  /* v37: Tally-style GST lookup. Order: (1) customer already saved in this ERP (free) -> (2) device cache (free)
     -> (3) your secure gateway /gst route (key stays on the server) -> (4) device key straight to AppyFlow.
     Every answer is verified against the GSTIN typed; a wrong/demo answer is rejected instead of being filled in. */
  var CK = 'TTESPL_GST_CACHE';
  function cacheGet(g) { try { var m = JSON.parse(localStorage.getItem(CK) || '{}'); return m[g] || null; } catch (e) { return null; } }
  function cachePut(g, d) { try { var m = JSON.parse(localStorage.getItem(CK) || '{}'); m[g] = d; localStorage.setItem(CK, JSON.stringify(m)); } catch (e) {} }
  function proxyCfg() {
    var u = '', pw = '';
    try { var c = window.ttai && ttai.cfg(); if (c) { u = c.gstProxy || ''; pw = c.gstPass || ''; } } catch (e) {}
    try { u = u || localStorage.getItem('TTESPL_GST_PROXY') || ''; pw = pw || localStorage.getItem('TTESPL_GST_PASS') || ''; } catch (e) {}
    return u ? { url: u.replace(/\/$/, ''), pass: pw } : null;
  }
  function viaProxy(g) {
    var pc = proxyCfg();
    return fetch(pc.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tt-pass': pc.pass }, body: JSON.stringify({ gstin: g }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j || j.error) throw new Error((j && j.error) || ('Server HTTP ' + r.status));
        var d = { name: j.name || '', person: j.person || '', address: j.address || '', status: j.status || '' };
        if (!d.name && !d.person && !d.address) throw new Error('No details returned for this GSTIN');
        return verify(g, d, j.gstin);
      }); });
  }
  function gwOn() { try { return !!(window.ttai && ttai.cfg().gatewayUrl && ttai.gatewayPost); } catch (e) { return false; } }
  function keyOn() { try { return !!localStorage.getItem('TTESPL_ERP_GST_API_KEY'); } catch (e) { return false; } }
  function savedCust(g) {
    try {
      var ed = ($('editCustId') || {}).value || '';
      var list = (typeof customerDatabase !== 'undefined' && customerDatabase) || [];
      for (var i = 0; i < list.length; i++) { var c = list[i]; if (c && String(c.gst || '').trim().toUpperCase() === g && String(c.id) !== String(ed)) return c; }
    } catch (e) {}
    return null;
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' '); }
  function verify(g, d, rawGstin) {
    if (rawGstin && String(rawGstin).trim().toUpperCase() !== g) throw new Error('The service returned a different GSTIN (' + rawGstin + ')');
    if (/appyflow/i.test(d.name + ' ' + d.person)) throw new Error('The service sent its own demo company (test key / demo plan), not this GSTIN');
    var st = STATES[g.slice(0, 2)] || '', adr = norm(d.address);
    if (st && adr) {
      var ownHit = adr.indexOf(norm(st)) >= 0 || (st === 'Odisha' && adr.indexOf('orissa') >= 0);
      if (!ownHit) {
        var other = Object.keys(STATES).map(function (k) { return STATES[k]; }).filter(function (n) { return n !== st && adr.indexOf(norm(n)) >= 0; });
        if (other.length) throw new Error('Address is of ' + other[0] + ' but this GSTIN is of ' + st);
      }
    }
    return d;
  }
  function pick(info) {
    var legal = info.lgnm || info.legalName || '', trade = info.tradeNam || info.tradeName || '';
    return { name: trade || legal, person: legal, address: addrOf(info), status: info.sts || info.status || '' };
  }
  function viaGateway(g) {
    return ttai.gatewayPost('/gst', { gstin: g }, 25000).then(function (j) {
      if (!j || j.error) throw new Error((j && j.error) || 'GST lookup failed');
      var d = { name: j.name || '', person: j.person || '', address: j.address || '', status: j.status || '' };
      if (!d.name && !d.person && !d.address) throw new Error('No details returned for this GSTIN');
      return verify(g, d, j.gstin);
    });
  }
  function viaKey(g) {
    var key = ''; try { key = localStorage.getItem('TTESPL_ERP_GST_API_KEY') || ''; } catch (e) {}
    if (/^gak_/.test(key)) {   /* gstinapi.in (free 75 credits, no card) */
      return fetch('https://www.gstinapi.in/v1/gstin/' + encodeURIComponent(g), { headers: { 'x-api-key': key } })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 402) throw new Error('Free credits finished on this key - add credits or use another key');
          if (r.status === 401 || r.status === 403) throw new Error('API key not accepted');
          if (!r.ok || !j || j.success === false) throw new Error((j && (j.error || j.message)) || 'GST lookup failed');
          var x = j.data || {}, ad = x.address || '';
          if (x.pincode && ad.indexOf(x.pincode) < 0) ad += (ad ? ', ' : '') + x.pincode;
          var d = { name: x.trade_name || x.legal_name || '', person: x.legal_name || '', address: ad, status: x.status || '' };
          if (!d.name && !d.address) throw new Error('No details returned for this GSTIN');
          return verify(g, d, x.gstin || j.gstin);
        }); });
    }
    return fetch('https://appyflow.in/api/verifyGST?gstNo=' + encodeURIComponent(g) + '&key_secret=' + encodeURIComponent(key))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.error) throw new Error(j.message || 'GST lookup failed');
        var info = (j && (j.taxpayerInfo || j.data)) || j || {};
        var d = pick(info);
        if (!d.name && !d.person && !d.address) throw new Error('No details returned for this GSTIN');
        return verify(g, d, info.gstin || info.gstIn || j.gstin);
      });
  }
  function fetchGst(g) {
    var sc = savedCust(g);
    if (sc) return Promise.resolve({ name: sc.name || '', person: sc.person || '', address: sc.address || '', status: '', phone: sc.phone || '', email: sc.email || '', src: 'saved' });
    var ch = cacheGet(g); if (ch) return Promise.resolve(Object.assign({ src: 'cache' }, ch));
    if (!proxyCfg() && !gwOn() && !keyOn()) return Promise.reject(new Error('nokey'));
    setStatus('⏳ Fetching details from GST portal…', 'wait');
    if (proxyCfg()) return viaProxy(g).then(function (d) { cachePut(g, d); return d; });
    return (gwOn() ? viaGateway(g).catch(function (e) { if (keyOn() && /gateway|HTTP|network|Failed to fetch/i.test(e.message || '')) return viaKey(g); throw e; }) : viaKey(g))
      .then(function (d) { cachePut(g, d); return d; });
  }
  function onGstInput() {
    var el = $('cGst'); if (!el) return; var v = el.value.trim().toUpperCase(); if (el.value !== v && v) el.value = v;
    if (!v) return setStatus('', '');
    if (v.length < 15) return setStatus('GSTIN has ' + v.length + '/15 characters', 'wait');
    var r = gstCheck(v);
    if (!r.ok) return setStatus(r.why === 'checksum' ? '❌ Check digit does not match — one character is wrong. Please re-check.' : '❌ This is not a valid GSTIN format.', 'bad');
    setStatus('✅ Valid GSTIN · State: <b>' + H(r.state) + '</b> · PAN: <b>' + H(r.pan) + '</b>', 'ok');
    fillBasic(r);
    var can = proxyCfg() || gwOn() || keyOn() || savedCust(v) || cacheGet(v);
    if (can) { clearTimeout(onGstInput.t); onGstInput.t = setTimeout(function () { var el2 = $('cGst'); if (el2 && el2.value.trim().toUpperCase() === v) doFetch(v, true); }, 250); }
    else setStatus($('tt26GstStatus').innerHTML + '<br><small>Name &amp; address auto-fetch needs a GST lookup (Settings → Customers &amp; Service). Until then type them in.</small>', 'ok');
  }
  function fillBasic(r) {
    var ad = $('cAddress'); if (ad && !ad.value.trim() && r.state) ad.dataset.stateHint = r.state;
  }
  var fetched = {};
  function doFetch(v, auto) {
    (fetched[v] ? Promise.resolve(fetched[v]) : fetchGst(v)).then(function (d) {
      fetched[v] = d;
      if ($('cGst') && $('cGst').value.trim().toUpperCase() !== v) return;
      var n = $('cName'), p = $('cPerson'), a = $('cAddress'), ph = $('cPhone'), em = $('cEmail');
      if (d.src === 'saved') { if (ph && !ph.value.trim() && d.phone) ph.value = d.phone; if (em && !em.value.trim() && d.email) em.value = d.email; }
      if (n && (!n.value.trim() || n.dataset.tt26 === '1')) { n.value = d.name; n.dataset.tt26 = '1'; }
      if (p && !p.value.trim()) p.value = d.person;
      if (a && (!a.value.trim() || a.dataset.tt26 === '1')) { a.value = d.address; a.dataset.tt26 = '1'; }
      setStatus('✅ ' + (d.src === 'saved' ? 'Already in your customer list' : 'Details fetched') + (d.status ? ' · Status: <b>' + H(d.status) + '</b>' : '') + '. Please review before saving.', 'ok');
    }).catch(function (e) {
      if (e.message === 'nokey') return;
      setStatus('⚠️ Could not fetch details (' + H(e.message || 'network') + '). GSTIN itself is valid — type name/address manually.', 'warn');
    });
  }
  function ensureUi() {
    var g = $('cGst'); if (!g || $('tt26GstStatus')) return;
    g.setAttribute('maxlength', '15'); g.setAttribute('autocapitalize', 'characters'); g.setAttribute('autocomplete', 'off');
    g.insertAdjacentHTML('afterend', '<div id="tt26GstStatus" class="tt26-gs"></div><button type="button" class="btn btn-outline btn-sm" id="tt26GstBtn" style="margin-top:6px;" onclick="ttGstFetchNow()">🔍 Fetch details from GSTIN</button>');
    g.addEventListener('input', onGstInput);
  }
  window.ttGstFetchNow = function () {
    var v = ($('cGst').value || '').trim().toUpperCase(), r = gstCheck(v);
    if (!r.ok) return setStatus('❌ Enter a valid 15-character GSTIN first.', 'bad');
    if (!proxyCfg() && !gwOn() && !keyOn() && !savedCust(v) && !cacheGet(v)) return setStatus('ℹ️ Add your GST lookup (gateway or key) in Settings → Customers & Service to fetch name/address.', 'warn');
    delete fetched[v]; doFetch(v);
  };
  window.ttSetGstProxy = function () {
    var cur = proxyCfg() || { url: '', pass: '' };
    var u = prompt('GST lookup server URL (your Cloudflare Worker, https://....workers.dev). Leave empty to remove.', cur.url); if (u === null) return;
    var pw = u.trim() ? prompt('Server password (the APP_PASS you set in Cloudflare):', cur.pass) : ''; if (pw === null) return;
    u = u.trim(); pw = (pw || '').trim();
    try { if (u) { localStorage.setItem('TTESPL_GST_PROXY', u); localStorage.setItem('TTESPL_GST_PASS', pw); } else { localStorage.removeItem('TTESPL_GST_PROXY'); localStorage.removeItem('TTESPL_GST_PASS'); } } catch (e) {}
    try { if (window.ttai && ttai.saveCfg) ttai.saveCfg({ gstProxy: u, gstPass: pw }); } catch (e) {}
    if (window.ttShowSuccessToast) ttShowSuccessToast(u ? 'GST lookup server saved' : 'GST lookup server removed');
  };
  window.ttSetGstKey = function () {
    var cur = ''; try { cur = localStorage.getItem('TTESPL_ERP_GST_API_KEY') || ''; } catch (e) {}
    var v = prompt('Paste your GST lookup API key (gstinapi.in key starting with gak_, or AppyFlow key_secret). Leave empty to remove.', cur); if (v === null) return;
    try { if (v.trim()) localStorage.setItem('TTESPL_ERP_GST_API_KEY', v.trim()); else localStorage.removeItem('TTESPL_ERP_GST_API_KEY'); } catch (e) {}
    if (window.ttShowSuccessToast) ttShowSuccessToast(v.trim() ? 'GST lookup key saved on this device' : 'GST lookup key removed');
  };
  var oo = window.openAddCustomerModal;
  if (typeof oo === 'function') {
    window.openAddCustomerModal = function () {
      var r = oo.apply(this, arguments); ensureUi();
      var s = $('tt26GstStatus'); if (s) { s.innerHTML = ''; s.className = 'tt26-gs'; }
      ['cName', 'cAddress'].forEach(function (i) { var e = $(i); if (e) delete e.dataset.tt26; });
      // new customer opened from the order form: carry the typed name over
      try { var oi = $('ordCustSearchInput'); if (arguments[0] == null && oi && $('cName') && !$('cName').value) { var t = oi.value.split('(')[0].trim(); if (t && !/^\d+$/.test(t)) $('cName').value = t; } } catch (e) {}
      return r;
    };
    try { (0, eval)('openAddCustomerModal = window.openAddCustomerModal;'); } catch (e) {}
  }
})();

/* ===== BACK BUTTON FIX ===== */
/* Android/browser ka back button ab poora app band karne ki jagah - pehle khula
   modal band karta hai, fir pichle tab par le jaata hai, tabhi app close hota hai */
function ttCurrentTabName() {
  const active = document.querySelector('.view-panel.active');
  return active ? active.id.replace('view-', '') : 'dashboard';
}
function ttPushNavState(tab) {
  try { history.pushState({ ttTab: tab }, '', '#' + tab); } catch (e) {}
}
function ttSeedNavHistory() {
  try { history.replaceState({ ttTab: ttCurrentTabName() }, '', '#' + ttCurrentTabName()); } catch (e) {}
}
/* ===== v26: centralised Android / browser Back manager =====
   - Every dismissible overlay (modal, bottom-sheet, profile menu, quick-action menu) registers ONE guard entry in
     history while it is open, so Back closes the topmost overlay first and never leaves the page underneath.
   - Closing an overlay with its own button removes its guard (no dead history entries, no loops).
   - Main-tab changes push one history entry per real change (re-tapping the same tab adds nothing).
   - At the root (Home, nothing open) Back falls through to the normal browser / Android behaviour. */
(function () {
  'use strict';
  var NO_BACK = { authScreen: 1, ttSplash: 1 };
  var tracked = [], guards = 0, ignorePop = 0, queued = false;
  var curTab = function () { try { return ttCurrentTabName(); } catch (e) { return 'dashboard'; } };

  function isOpen(el) {
    if (!el || !el.isConnected) return false;
    if (el.id && NO_BACK[el.id]) return false;
    if (el.hasAttribute && el.hasAttribute('data-no-back')) return false;
    if (el.id === 'profileDropdownCard' || el.id === 'fabMenu') return el.classList.contains('show');
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && !el.classList.contains('tt-sheet-closing');
  }
  function candidates() {
    var list = Array.prototype.slice.call(document.querySelectorAll('.auth-overlay, #globalFilterModal, #profileDropdownCard, #fabMenu'));
    return list.filter(isOpen);
  }
  function zOf(el) { var z = parseInt(getComputedStyle(el).zIndex, 10); return isNaN(z) ? 0 : z; }
  function topmost(list) {
    return list.slice().sort(function (a, b) {
      var d = zOf(a) - zOf(b); if (d) return d;
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    }).pop();
  }
  function pushGuard() { try { history.pushState({ ttGuard: 1, ttTab: curTab() }, '', location.href); guards++; } catch (e) {} }
  function sync() {
    queued = false;
    var now = candidates(), n;
    now.forEach(function (el) { if (tracked.indexOf(el) < 0) { tracked.push(el); pushGuard(); } });
    var before = tracked.length;
    tracked = tracked.filter(function (el) { return now.indexOf(el) >= 0; });
    n = Math.min(before - tracked.length, guards);
    if (n > 0) { guards -= n; ignorePop++; try { history.go(-n); } catch (e) { ignorePop--; } }
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(sync); } }

  function closeOverlay(el) {
    try {
      if (el.id === 'profileDropdownCard') { closeProfileDrawer(); return; }
      if (el.id === 'fabMenu') { toggleFabMenu(); return; }
      if (el.id === 'globalFilterModal' && typeof closeFilterModal === 'function') { closeFilterModal(); if (!isOpen(el)) return; }
      var btns = Array.prototype.slice.call(el.querySelectorAll('button, .btn, [role=button]'));
      var x = btns.filter(function (b) { return /^[\s✕×xX]+$/.test((b.textContent || '').trim()) && (b.textContent || '').trim().length <= 2; })[0] ||
              btns.filter(function (b) { return /(^|[^a-zA-Z])close[A-Z_]?\w*\s*\(/.test(b.getAttribute('onclick') || ''); })[0];
      if (x) x.click();
      else if (typeof ttCloseSheetModal === 'function' && el.id && el.querySelector('.tt-sheet-card')) ttCloseSheetModal(el.id);
    } catch (e) { console.warn('Back: close handler failed', e); }
    if (isOpen(el) && !el.classList.contains('tt-sheet-closing')) {
      el.style.display = 'none';
    }
  }

  var mo = new MutationObserver(schedule);
  function start() {
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style', 'class'], childList: true });
    schedule();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  /* main tabs: one history entry per real change */
  if (typeof switchTab === 'function' && !switchTab.__ttNavWrapped) {
    var orig = switchTab;
    window.switchTab = function (tab, el, fromPop) {
      var changed = curTab() !== tab;
      orig(tab, el);
      if (!fromPop && changed) { try { history.pushState({ ttTab: tab }, '', '#' + tab); } catch (e) {} }
    };
    window.switchTab.__ttNavWrapped = true;
    try { switchTab = window.switchTab; } catch (e) {}
  }

  window.addEventListener('popstate', function (e) {
    if (ignorePop > 0) { ignorePop--; return; }
    if (guards > 0 && tracked.length) {          // Back consumed an overlay's guard entry
      guards--;
      var top = topmost(tracked);
      tracked.splice(tracked.indexOf(top), 1);
      closeOverlay(top);
      schedule();
      return;
    }
    var st = e.state || {};
    if (st.ttGuard && !tracked.length) { guards = 0; ignorePop++; try { history.back(); } catch (x) { ignorePop--; } return; } // stray guard (Forward button)
    var tab = st.ttTab || 'dashboard';
    if (document.getElementById('view-' + tab) && curTab() !== tab) {
      var order = ['dashboard', 'leads', 'orders', 'services', 'inventory', 'billing', 'chat'];
      window.switchTab(tab, document.querySelectorAll('.nav-item')[order.indexOf(tab)] || null, true);
    }
  });
  window.__ttBack = { open: function () { return tracked.length; }, guards: function () { return guards; }, sync: sync };
})();

/* ===== v26: accordion toggle (Financial Tools + Sales Report Filter) ===== */
window.ttAccToggle = function (id) {
  var acc = document.getElementById(id); if (!acc) return;
  var open = !acc.classList.contains('open');
  acc.classList.toggle('open', open);
  var h = acc.querySelector('.tt-acc-h'); if (h) h.setAttribute('aria-expanded', open ? 'true' : 'false');
  try { if (typeof triggerAppHaptic === 'function') triggerAppHaptic(10); } catch (e) {}
  if (open) {
    setTimeout(function () {
      try {
        var r = acc.getBoundingClientRect(), navTop = window.innerHeight - 96;
        if (r.top < 60) window.scrollBy({ top: r.top - 70, behavior: 'smooth' });
        else if (r.bottom > navTop && r.top > 140) window.scrollBy({ top: Math.min(r.bottom - navTop + 12, r.top - 100), behavior: 'smooth' });
      } catch (e) {}
    }, 300);
  }
};


/* ===== v27: Bulk Ledger Import (Financial Tools) =====
   Creates historical *Delivered* invoices in the SAME structure as manually delivered orders
   (so they appear in Ledger, reports, P&L, GST, statements and sync like any other invoice).
   - Admin only.  Stock is NOT touched (imports are historical bills, not new deliveries).
   - Customer / staff / payment-mode values come from the live database; nothing is auto-converted by fuzzy match.
   - Save = confirmed cloud write per chunk (cloudSync.pushKey promise). Local list is updated ONLY after the cloud confirms.
   - Idempotent: blank invoice numbers become a deterministic id (hash of the row content) so a retry is skipped as duplicate. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CHUNK = 25, CLOUD_TIMEOUT = 20000;
  var FIELDS = [
    { k: 'inv', label: 'Invoice No', al: ['invoice no', 'invoice number', 'invoice', 'inv no', 'inv', 'bill no', 'bill number', 'bill', 'voucher no', 'ref', 'reference'] },
    { k: 'date', label: 'Invoice Date', al: ['invoice date', 'date', 'bill date', 'voucher date', 'delivered date'] },
    { k: 'party', label: 'Customer / Party', al: ['customer', 'customer name', 'party', 'party name', 'name', 'client', 'ledger', 'ledger name', 'account'] },
    { k: 'phone', label: 'Phone', al: ['phone', 'mobile', 'mobile no', 'contact', 'phone no'] },
    { k: 'staff', label: 'Staff', al: ['staff', 'employee', 'booked by', 'sales person', 'salesman', 'handled by'] },
    { k: 'desc', label: 'Description', al: ['description', 'particulars', 'details', 'item', 'product', 'narration'] },
    { k: 'hsn', label: 'HSN', al: ['hsn', 'hsn code', 'sac', 'hsn/sac'] },
    { k: 'taxType', label: 'Tax Type', al: ['tax type', 'supply type', 'gst type', 'tax'] },
    { k: 'gst', label: 'GST Rate %', al: ['gst rate', 'gst %', 'gst', 'tax rate', 'rate %'] },
    { k: 'total', label: 'Total Amount', al: ['total', 'total amount', 'bill amount', 'invoice amount', 'amount', 'gross', 'net amount'] },
    { k: 'received', label: 'Amount Received', al: ['received', 'amount received', 'paid', 'paid amount', 'receipt', 'collected'] },
    { k: 'due', label: 'Due Amount', al: ['due', 'due amount', 'balance', 'outstanding', 'pending'] },
    { k: 'status', label: 'Payment Status', al: ['status', 'payment status'] },
    { k: 'mode', label: 'Payment Mode', al: ['payment mode', 'mode', 'pay mode', 'mode of payment'] },
    { k: 'payDate', label: 'Payment Date', al: ['payment date', 'paid on', 'receipt date', 'received date'] },
    { k: 'notes', label: 'Notes', al: ['notes', 'note', 'remarks', 'remark', 'comment'] }
  ];
  var S = null, uid = 0, pop = null, popFor = null, saving = false;

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function r2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function toast(m, bad) { try { if (bad && window.ttShowErrorToast) return ttShowErrorToast(m); if (window.ttShowSuccessToast) return ttShowSuccessToast(m); } catch (e) {} try { alert(m); } catch (e) {} }
  function me() { try { if (typeof currentUser !== 'undefined' && currentUser && currentUser.name) return currentUser.name; } catch (e) {} return (window.currentUser && window.currentUser.name) || 'Admin'; }
  function isAdm() { try { return !!isAdminUser(); } catch (e) { return false; } }

  /* ---------- live reference data (never hard-coded) ---------- */
  function customers() { return Array.isArray(window.customerDatabase) ? window.customerDatabase : (typeof customerDatabase !== 'undefined' ? customerDatabase : []); }
  function staffList() { var l = (typeof registeredEmployees !== 'undefined' ? registeredEmployees : window.registeredEmployees) || []; return l.map(function (e) { return e && e.name; }).filter(Boolean); }
  function modeList() {
    var sel = $('ordPayMode'), out = [];
    if (sel) Array.prototype.forEach.call(sel.options, function (o) { out.push(o.value); });
    return out.length ? out : ['Cash', 'UPI / QR Code', 'Net Banking / NEFT', 'Cheque', 'Not Paid / Full Due'];
  }
  function unpaidMode() { var m = modeList().filter(function (x) { return /not paid|full due/i.test(x); })[0]; return m || 'Not Paid / Full Due'; }
  function orders() { return typeof ordersData !== 'undefined' ? ordersData : (window.ordersData || []); }

  /* ---------- parsing helpers ---------- */
  function parseDate(s) {
    s = clean(s); if (!s) return null;
    var y, m, d, a;
    if ((a = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/.exec(s))) { y = +a[1]; m = +a[2]; d = +a[3]; }
    else if ((a = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(s))) { d = +a[1]; m = +a[2]; y = +a[3]; }          // Indian day-first
    else if ((a = /^(\d{1,2})[-\/ ]([A-Za-z]{3,9})[-\/ ,]+(\d{4})$/.exec(s))) {
      d = +a[1]; y = +a[3]; m = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(a[2].slice(0, 3).toLowerCase()) + 1;
    } else return null;
    if (!m || m < 1 || m > 12 || d < 1 || y < 2000 || y > 2100) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
  }
  function parseMoney(s) {
    var t = clean(s); if (t === '') return { empty: true };
    t = t.replace(/[₹₹]|rs\.?|inr/ig, '').replace(/,/g, '').replace(/\s+/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(t)) return { bad: true };
    var v = parseFloat(t), dec = (t.split('.')[1] || '').length;
    return { val: v, dec: dec };
  }
  function modeFrom(s) {
    var t = norm(s); if (!t) return '';
    var list = modeList(), i;
    for (i = 0; i < list.length; i++) if (norm(list[i]) === t) return list[i];
    var pick = function (re) { return list.filter(function (x) { return re.test(x); })[0] || ''; };
    if (/^(cash)$/.test(t)) return pick(/cash/i);
    if (/(upi|qr|gpay|google pay|phonepe|paytm|bhim)/.test(t)) return pick(/upi/i);
    if (/(neft|rtgs|imps|net ?bank|bank|transfer)/.test(t)) return pick(/net bank|neft/i);
    if (/(cheque|check|chq)/.test(t)) return pick(/cheque/i);
    if (/(not paid|unpaid|due|credit|pending)/.test(t)) return pick(/not paid|due/i);
    return '';
  }
  function taxFrom(s) {
    var t = norm(s); if (!t) return 'INTRA';
    if (/inter|igst/.test(t)) return 'INTER';
    if (/intra|cgst|sgst|local/.test(t)) return 'INTRA';
    return null;
  }
  function hash(str) { var h = 0x811c9dc5, i; for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return h.toString(36).toUpperCase().padStart(7, '0'); }
  function dice(a, b) {
    a = norm(a); b = norm(b); if (a.length < 2 || b.length < 2) return 0;
    var bg = function (s) { var m = {}, i; for (i = 0; i < s.length - 1; i++) { var k = s.substr(i, 2); m[k] = (m[k] || 0) + 1; } return m; }, A = bg(a), B = bg(b), inter = 0, k;
    for (k in A) if (B[k]) inter += Math.min(A[k], B[k]);
    return (2 * inter) / (a.length + b.length - 2);
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    var first = text.split(/\r?\n/, 1)[0] || '', d = ',', best = -1;
    [',', ';', '\t', '|'].forEach(function (c) { var n = first.split(c).length; if (n > best) { best = n; d = c; } });
    var rows = [], row = [], cur = '', q = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === d) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return clean(c) !== ''; }); });
  }
  function csvEsc(v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  /* ---------- state ---------- */
  function newRow(v) {
    var r = { k: ++uid, v: Object.assign({ inv: '', date: '', party: '', phone: '', staff: '', desc: '', hsn: '', taxType: '', gst: '', total: '', received: '', due: '', status: '', mode: '', payDate: '', notes: '' }, v || {}), custId: null, createNew: false, src: null, sel: true, res: null };
    return r;
  }
  function fresh() { S = { step: 'edit', rows: [newRow()], file: null, map: null, header: null, rawRows: null, dirty: false, result: null }; }

  /* ---------- customer resolution (exact, normalised; NO fuzzy auto-pick) ---------- */
  function matchCustomer(r) {
    var name = norm(r.v.party), ph = String(r.v.phone || '').replace(/\D/g, '').slice(-10);
    if (r.custId != null) { var c0 = customers().filter(function (c) { return c.id === r.custId; })[0]; if (c0) return { c: c0 }; r.custId = null; }
    if (!name) return { none: true };
    var hits = customers().filter(function (c) { return norm(c.name) === name; });
    if (hits.length > 1 && ph) { var h2 = hits.filter(function (c) { return String(c.phone || '').replace(/\D/g, '').slice(-10) === ph; }); if (h2.length) hits = h2; }
    if (hits.length === 1) return { c: hits[0] };
    if (hits.length > 1) return { many: hits };
    return { none: true };
  }

  /* ---------- validation ---------- */
  function validateAll() {
    var existing = {}, cand = {}, seen = {}, occ = {}, modes = modeList(), staff = staffList();
    orders().forEach(function (o) {
      if (!o) return; existing[norm(o.id)] = o;
      if (o.status !== 'Cancelled') cand[[norm(o.customerName), o.orderDate || '', Number(o.totalAmount) || 0].join('|')] = o;
    });
    var today = ttYmd(new Date());
    S.rows.forEach(function (r) {
      var v = r.v, E = [], W = [], res = { E: E, W: W, dup: null, rec: null, due: 0, status: '', cust: null }, d = parseDate(v.date), t = parseMoney(v.total), rc = parseMoney(v.received);
      var blank = !clean(v.inv + v.date + v.party + v.desc + v.total + v.received);
      if (blank) { res.blank = true; r.res = res; return; }
      // date
      if (!clean(v.date)) E.push('Invoice date is required'); else if (!d) E.push('Date "' + clean(v.date) + '" is not valid (use DD-MM-YYYY or YYYY-MM-DD)'); else if (d > today) W.push('Date is in the future');
      // party
      var m = matchCustomer(r);
      if (m.c) { res.cust = m.c; }
      else if (r.createNew) {
        var ph = String(v.phone || '').replace(/\D/g, '').slice(-10);
        if (!clean(v.party)) E.push('Customer name is required'); else if (ph.length !== 10) E.push('New customer needs a 10-digit phone');
        else if (customers().some(function (c) { return String(c.phone || '').replace(/\D/g, '').slice(-10) === ph; })) E.push('That phone already belongs to an existing customer — select them instead');
        else W.push('New customer "' + clean(v.party) + '" will be created');
      } else if (m.many) E.push('Several customers share this name — pick one from the list');
      else if (!clean(v.party)) E.push('Customer is required');
      else E.push('"' + clean(v.party) + '" is not an existing customer — pick one from the list or choose “Create new”');
      // amounts
      var total = 0, recv = 0;
      if (t.empty) E.push('Total amount is required'); else if (t.bad) E.push('Total "' + clean(v.total) + '" is not a number'); else if (t.val <= 0) E.push('Total must be above 0'); else { total = t.val; if (t.dec > 2) W.push('More than 2 decimals — will be rounded'); if (Math.abs(total - Math.round(total)) > 0.004) W.push('Existing invoices use whole rupees; this one has paise'); }
      if (rc.empty) recv = 0; else if (rc.bad) E.push('Received "' + clean(v.received) + '" is not a number'); else if (rc.val < 0) E.push('Received cannot be negative'); else recv = rc.val;
      total = r2(total); recv = r2(recv);
      if (!E.length || (total > 0)) {
        if (recv > total && total > 0) E.push('Received (' + inr(recv) + ') is more than Total (' + inr(total) + ')');
        res.due = r2(Math.max(0, total - recv));
        res.status = recv >= total && total > 0 ? 'Paid' : (recv > 0 ? 'Partial' : 'Due');
      }
      var dd = parseMoney(v.due);
      if (!dd.empty) { if (dd.bad) E.push('Due "' + clean(v.due) + '" is not a number'); else if (total > 0 && Math.abs(dd.val - res.due) > 0.005) E.push('Due ' + inr(dd.val) + ' ≠ Total − Received (' + inr(res.due) + ')'); }
      var st = norm(v.status);
      if (st) { var want = /^(paid|received|settled|full)/.test(st) ? 'Paid' : (/^(part)/.test(st) ? 'Partial' : (/^(due|unpaid|pending|not)/.test(st) ? 'Due' : null)); if (!want) E.push('Payment status "' + clean(v.status) + '" not understood (Paid / Partial / Due)'); else if (res.status && want !== res.status) E.push('Status says ' + want + ' but amounts give ' + res.status); }
      // payment mode
      var mode = modeFrom(v.mode); res.mode = mode;
      if (recv > 0) { if (!clean(v.mode)) E.push('Payment mode is required when money is received'); else if (!mode) E.push('Payment mode "' + clean(v.mode) + '" not recognised — pick from the list'); else if (/not paid/i.test(mode)) E.push('Mode says “Not paid” but an amount is received'); }
      else { res.mode = unpaidMode(); if (clean(v.mode) && mode && !/not paid/i.test(mode)) W.push('Mode ignored — nothing received'); }
      var pd = null; if (clean(v.payDate)) { pd = parseDate(v.payDate); if (!pd) E.push('Payment date "' + clean(v.payDate) + '" is not valid'); else if (d && pd < d) W.push('Payment date is before invoice date'); } res.payDate = pd || d;
      // staff
      if (clean(v.staff)) { var sm = staff.filter(function (s) { return norm(s) === norm(v.staff); })[0]; if (!sm) E.push('Staff "' + clean(v.staff) + '" is not a registered employee'); else res.staff = sm; } else { res.staff = me(); W.push('No staff chosen — will use ' + me()); }
      // tax
      var tx = taxFrom(v.taxType); if (tx == null) E.push('Tax type "' + clean(v.taxType) + '" not understood (Intra / Inter)'); res.taxType = tx || 'INTRA';
      if (clean(v.gst)) { var g = parseMoney(v.gst); if (g.bad || (g.val != null && Math.abs(g.val - 18) > 0.001)) W.push('This app bills GST at 18%; the GST rate "' + clean(v.gst) + '" is kept in notes only'); }
      var inv = clean(v.inv);
      if (inv && !/^[A-Za-z0-9 _.\-#]{1,40}$/.test(inv)) E.push('Invoice no may use letters, digits, space, - _ . # only (max 40)');
      // identity + duplicates
      var key = [d || '', norm(v.party), total, norm(v.desc), recv].join('|'), id;
      if (inv) id = inv; else { occ[key] = (occ[key] || 0) + 1; id = 'IMP-' + hash(key) + (occ[key] > 1 ? '-' + occ[key] : ''); }
      res.id = id;
      if (existing[norm(id)]) res.dup = 'exists';
      else if (seen[norm(id)]) res.dup = 'file';
      else if (d && total > 0 && cand[[norm(res.cust ? res.cust.name : v.party), d, total].join('|')]) { res.dup = 'candidate'; res.candId = cand[[norm(res.cust ? res.cust.name : v.party), d, total].join('|')].id; }
      seen[norm(id)] = 1;
      if (res.dup === 'exists') W.push('Invoice ' + id + ' already exists — will be skipped (never overwritten)');
      else if (res.dup === 'file') E.push('Invoice no repeated inside this import');
      else if (res.dup === 'candidate') W.push('Looks like existing invoice ' + res.candId + ' (same customer, date, total) — tick to import anyway');
      res.total = total; res.recv = recv; res.date = d;
      res.state = E.length ? 'error' : (res.dup === 'exists' ? 'dup' : (res.dup === 'candidate' ? 'dup' : (W.length ? 'warn' : 'ok')));
      r.res = res;
    });
  }
  function buildRecord(r, batchId) {
    var res = r.res, v = r.v, c = res.cust, at = new Date().toISOString(), recv = res.recv, total = res.total;
    var phone = c ? c.phone : String(v.phone || '').replace(/\D/g, '').slice(-10), name = c ? c.name : clean(v.party);
    var note = clean(v.notes); if (clean(v.gst) && Math.abs(parseFloat(v.gst) - 18) > 0.001) note = (note ? note + ' | ' : '') + 'GST rate in file: ' + clean(v.gst) + '%';
    var rec = {
      id: res.id, customerName: name, phone: phone || '', orderDate: res.date, deliveryDate: res.date, deliveredDate: res.date,
      items: [{ id: Date.now() + r.k, name: clean(v.desc) || 'Imported invoice', hsn: clean(v.hsn) || '84139190', qty: 1, mrp: total, disc: 0, rate: total, total: total }],
      totalAmount: total, recvAmount: recv, dueAmount: res.due, payMode: res.mode, taxType: res.taxType, courierCharge: 0,
      status: 'Delivered', bookedBy: res.staff, payProofs: [], deliveredAt: at, deliveredBy: me(),
      imported: true, importBatch: batchId, importedBy: me(), importedAt: at
    };
    if (note) rec.notes = note;
    if (recv > 0) { rec.payments = [{ amount: recv, mode: res.mode, at: res.payDate, by: me(), photo: '' }]; rec.lastPaymentDate = res.payDate; }
    return rec;
  }

  /* ---------- UI ---------- */
  function panel() {
    var p = $('ttBulkPanel');
    if (!p) {
      p = document.createElement('div'); p.id = 'ttBulkPanel'; p.className = 'auth-overlay tt-bulk-ov'; p.style.display = 'none'; p.style.zIndex = '3600';
      p.innerHTML = '<div class="tt-bulk" role="dialog" aria-modal="true" aria-labelledby="ttBulkTitle"></div>';
      document.body.appendChild(p);
      p.addEventListener('input', onInput); p.addEventListener('change', onChange); p.addEventListener('click', onClick);
      p.addEventListener('focusin', onFocusIn); p.addEventListener('keydown', onKey);
      p.addEventListener('scroll', hidePop, true);
    }
    return p;
  }
  function box() { return panel().firstChild; }
  function head(sub) {
    return '<div class="tt-bk-h"><div class="tt-bk-ht"><b id="ttBulkTitle">Bulk Ledger Import</b><small>' + sub + '</small></div><button type="button" class="tt-bk-x" data-act="close" aria-label="Close">✕</button></div>';
  }
  function steps(n) { return '<div class="tt-bk-steps">' + ['Enter', 'Review', 'Result'].map(function (t, i) { return '<span class="' + (i === n ? 'on' : (i < n ? 'done' : '')) + '">' + (i + 1) + ' ' + t + '</span>'; }).join('') + '</div>'; }

  function selectHtml(f, val, opts, ph) {
    return '<select data-f="' + f + '"><option value="">' + H(ph || '— select —') + '</option>' + opts.map(function (o) { return '<option value="' + H(o) + '"' + (norm(o) === norm(val) ? ' selected' : '') + '>' + H(o) + '</option>'; }).join('') + '</select>';
  }
  function rowHtml(r, i) {
    var v = r.v, stf = staffList(), md = modeList(), curMode = modeFrom(v.mode) || v.mode;
    var m = matchCustomer(r), partyNote = m.c ? '<span class="tt-bk-ok">✔ ' + H(m.c.name) + (m.c.phone ? ' · ' + H(m.c.phone) : '') + '</span>' : (r.createNew ? '<span class="tt-bk-new">＋ New customer</span>' : '');
    return '<div class="tt-bk-row" data-k="' + r.k + '"><div class="tt-bk-rh"><b>#' + (i + 1) + '</b><span class="tt-bk-chip" data-chip></span><button type="button" class="tt-bk-del" data-act="del" aria-label="Remove row ' + (i + 1) + '">🗑</button></div>' +
      '<div class="tt-bk-g">' +
      '<label>Invoice No<input data-f="inv" value="' + H(v.inv) + '" placeholder="auto if blank" autocomplete="off"></label>' +
      '<label>Invoice Date<input data-f="date" type="date" value="' + H(parseDate(v.date) || '') + '"></label>' +
      '<label class="full">Customer / Party<input data-f="party" class="tt-bk-cb" value="' + H(v.party) + '" placeholder="Type to search customers…" autocomplete="off" role="combobox" aria-expanded="false"></label>' +
      '<div class="full tt-bk-pn" data-pn>' + partyNote + '</div>' +
      (r.createNew ? '<label class="full">Phone of new customer<input data-f="phone" inputmode="numeric" maxlength="14" value="' + H(v.phone) + '" placeholder="10-digit mobile"></label>' : '') +
      '<label class="full">Description<input data-f="desc" value="' + H(v.desc) + '" placeholder="Particulars (optional)"></label>' +
      '<label>Total (₹ incl. GST)<input data-f="total" inputmode="decimal" value="' + H(v.total) + '" placeholder="0"></label>' +
      '<label>Received (₹)<input data-f="received" inputmode="decimal" value="' + H(v.received) + '" placeholder="0"></label>' +
      '<label>Due (auto)<input data-due readonly tabindex="-1" value=""></label>' +
      '<label>Payment mode' + selectHtml('mode', curMode, md, '— none —') + '</label>' +
      '<label class="full">Staff' + selectHtml('staff', v.staff, stf, '— me (' + me() + ') —') + '</label>' +
      '</div><details class="tt-bk-more"' + ((v.hsn || v.taxType || v.payDate || v.notes || v.due || v.status || v.gst) ? ' open' : '') + '><summary>More fields</summary><div class="tt-bk-g">' +
      '<label>HSN<input data-f="hsn" value="' + H(v.hsn) + '" placeholder="84139190"></label>' +
      '<label>Tax type' + selectHtml('taxType', v.taxType, ['INTRA', 'INTER'], 'Intra (default)') + '</label>' +
      '<label>Payment date<input data-f="payDate" type="date" value="' + H(parseDate(v.payDate) || '') + '"></label>' +
      '<label>GST % (info)<input data-f="gst" inputmode="decimal" value="' + H(v.gst) + '" placeholder="18"></label>' +
      '<label>Due in file<input data-f="due" inputmode="decimal" value="' + H(v.due) + '" placeholder="check only"></label>' +
      '<label>Status in file<input data-f="status" value="' + H(v.status) + '" placeholder="Paid / Partial / Due"></label>' +
      '<label class="full">Notes<input data-f="notes" value="' + H(v.notes) + '"></label>' +
      '</div></details><div class="tt-bk-msg" data-msg></div></div>';
  }
  function mapHtml() {
    var M = S.map, hdr = S.header, used = {};
    Object.keys(M).forEach(function (k) { if (M[k] >= 0) used[M[k]] = 1; });
    var unused = hdr.map(function (h, i) { return used[i] ? null : h; }).filter(function (x) { return x && clean(x); });
    return '<div class="tt-bk-map"><div class="tt-bk-mh"><b>Match columns</b><small>' + H(S.file) + ' · ' + S.rawRows.length + ' data rows</small></div><div class="tt-bk-g">' +
      FIELDS.map(function (f) { return '<label>' + f.label + '<select data-map="' + f.k + '"><option value="-1">— not in file —</option>' + hdr.map(function (h, i) { return '<option value="' + i + '"' + (M[f.k] === i ? ' selected' : '') + '>' + H(h || ('Column ' + (i + 1))) + '</option>'; }).join('') + '</select></label>'; }).join('') + '</div>' +
      (unused.length ? '<div class="tt-bk-warn">Not imported (no matching field): <b>' + unused.map(H).join(', ') + '</b></div>' : '') +
      '<div class="tt-bk-acts"><button type="button" class="btn btn-primary btn-sm" data-act="applymap">Load rows from file</button><button type="button" class="btn btn-outline btn-sm" data-act="dropfile">Discard file</button></div></div>';
  }
  function renderEdit() {
    var b = box(), n = S.rows.length;
    b.innerHTML = head('Add many invoices at once') + steps(0) +
      '<div class="tt-bk-body" id="ttBkBody">' +
      '<div class="tt-bk-note">Each row becomes a <b>Delivered invoice</b> in the Ledger (same format as a normal order). Customers, staff and payment modes are chosen from your live data. Stock is not changed. Excel (.xlsx) is not read — save it as <b>CSV</b> first.</div>' +
      '<div class="tt-bk-tools"><button type="button" class="btn btn-outline btn-sm" data-act="add">＋ Add row</button><button type="button" class="btn btn-outline btn-sm" data-act="add5">＋5 rows</button><button type="button" class="btn btn-outline btn-sm" data-act="copylast">⧉ Copy last row</button><button type="button" class="btn btn-outline btn-sm" data-act="pastebox">📋 Paste from Excel</button><button type="button" class="btn btn-outline btn-sm" data-act="csv">📂 Import CSV</button><button type="button" class="btn btn-outline btn-sm" data-act="tpl">⬇ CSV template</button><input type="file" id="ttBkFile" accept=".csv,text/csv,text/plain" hidden></div>' +
      '<div class="tt-bk-paste" id="ttBkPaste" style="display:none;"><textarea id="ttBkPasteTa" rows="5" placeholder="Copy rows in Excel and paste here. Optional first row = column headings (Invoice No, Date, Customer, Total, Received …). Without headings the column order is: Invoice No, Date, Customer, Phone, Staff, Description, HSN, Tax Type, GST %, Total, Received, Due, Status, Mode, Payment Date, Notes"></textarea><div class="tt-bk-acts"><button type="button" class="btn btn-primary btn-sm" data-act="pasteapply">Add these rows</button><button type="button" class="btn btn-outline btn-sm" data-act="pastebox">Cancel</button></div></div>' +
      (S.map ? mapHtml() : '') +
      '<div id="ttBkRows">' + S.rows.map(rowHtml).join('') + '</div></div>' +
      '<div class="tt-bk-f"><span class="tt-bk-sum" id="ttBkSum"></span><button type="button" class="btn btn-primary" data-act="review">Review ›</button></div>';
    S.rows.forEach(function (r) { paintRow(r); });
    paintSum();
  }
  function paintRow(r) {
    var el = panel().querySelector('.tt-bk-row[data-k="' + r.k + '"]'); if (!el || !r.res) return;
    var res = r.res, chip = el.querySelector('[data-chip]'), msg = el.querySelector('[data-msg]'), dueEl = el.querySelector('[data-due]');
    var lab = res.blank ? ['', 'Empty'] : { error: ['err', 'Error'], dup: ['dup', 'Possible duplicate'], warn: ['warn', 'Warning'], ok: ['ok', 'Valid'] }[res.state];
    chip.className = 'tt-bk-chip ' + lab[0]; chip.textContent = lab[1];
    msg.innerHTML = res.blank ? '' : res.E.map(function (e) { return '<div class="e">✖ ' + H(e) + '</div>'; }).join('') + res.W.map(function (w) { return '<div class="w">⚠ ' + H(w) + '</div>'; }).join('');
    if (dueEl) dueEl.value = res.total > 0 ? inr(res.due) : '';
    el.classList.toggle('bad', res.state === 'error');
  }
  function paintSum() {
    var c = { ok: 0, warn: 0, error: 0, dup: 0 }, tot = 0;
    S.rows.forEach(function (r) { if (r.res && !r.res.blank) { c[r.res.state]++; } });
    var s = $('ttBkSum'); if (s) s.innerHTML = '<b>' + (c.ok + c.warn + c.dup + c.error) + '</b> rows · <span class="g">' + (c.ok + c.warn) + ' ok</span> · <span class="r">' + c.error + ' error</span>' + (c.dup ? ' · <span class="a">' + c.dup + ' dup</span>' : '');
  }
  var vt = null;
  function revalidate(r) {
    clearTimeout(vt);
    vt = setTimeout(function () { validateAll(); S.rows.forEach(paintRow); paintSum(); }, 160);
  }

  /* ----- combobox popup (rendered on <body>, fixed, so scrolling containers never clip it) ----- */
  function ensurePop() { if (!pop) { pop = document.createElement('div'); pop.id = 'ttBulkPop'; pop.setAttribute('role', 'listbox'); pop.style.display = 'none'; document.body.appendChild(pop); pop.addEventListener('pointerdown', function (e) { e.preventDefault(); }); pop.addEventListener('click', onPopClick); } return pop; }
  function hidePop() { if (pop) pop.style.display = 'none'; if (popFor) popFor.setAttribute('aria-expanded', 'false'); popFor = null; }
  function showPop(inp) {
    var r = rowOf(inp); if (!r) return;
    var q = norm(inp.value), p = ensurePop(), list = customers(), out = [], qd = q.replace(/\D/g, '');
    list.forEach(function (c) { var n = norm(c.name), ph = String(c.phone || ''); if (!q || n.indexOf(q) >= 0 || (qd.length >= 3 && ph.replace(/\D/g, '').indexOf(qd) >= 0)) out.push({ c: c, s: n.indexOf(q) === 0 ? 0 : 1 }); });
    out.sort(function (a, b) { return a.s - b.s || String(a.c.name).localeCompare(String(b.c.name)); });
    var html = out.slice(0, 40).map(function (o) { return '<div class="po" role="option" data-cid="' + H(o.c.id) + '"><b>' + H(o.c.name) + '</b><small>' + H(o.c.phone || '') + (o.c.gst && o.c.gst !== 'Unregistered' ? ' · ' + H(o.c.gst) : '') + '</small></div>'; }).join('');
    if (!out.length && q.length >= 2) {
      var sim = list.map(function (c) { return { c: c, d: dice(c.name, q) }; }).filter(function (x) { return x.d >= 0.5; }).sort(function (a, b) { return b.d - a.d; }).slice(0, 3);
      if (sim.length) html += '<div class="ph">Similar names — tap to choose, nothing is auto-picked</div>' + sim.map(function (o) { return '<div class="po" role="option" data-cid="' + H(o.c.id) + '"><b>' + H(o.c.name) + '</b><small>' + H(o.c.phone || '') + '</small></div>'; }).join('');
      else html += '<div class="ph">No customer matches “' + H(inp.value) + '”</div>';
    }
    if (clean(inp.value)) html += '<div class="po new" role="option" data-new="1"><b>＋ Create new customer “' + H(clean(inp.value)) + '”</b><small>needs a phone number</small></div>';
    if (!html) html = '<div class="ph">Type a customer name or phone</div>';
    p.innerHTML = html; popFor = inp; inp.setAttribute('aria-expanded', 'true'); p.style.display = 'block';
    var rc = inp.getBoundingClientRect(), vv = window.visualViewport, vh = vv ? vv.height : innerHeight, vo = vv ? vv.offsetTop : 0, below = vh - (rc.bottom - vo) - 8, above = rc.top - vo - 8, up = below < 170 && above > below;
    p.style.left = Math.max(8, rc.left) + 'px'; p.style.width = Math.min(rc.width, innerWidth - 16) + 'px';
    p.style.maxHeight = Math.max(110, Math.min(260, up ? above : below)) + 'px';
    if (up) { p.style.top = 'auto'; p.style.bottom = (innerHeight - rc.top + 4) + 'px'; } else { p.style.bottom = 'auto'; p.style.top = (rc.bottom + 4) + 'px'; }
  }
  function onPopClick(e) {
    var o = e.target.closest('.po'); if (!o || !popFor) return;
    var r = rowOf(popFor); if (!r) return;
    if (o.dataset.new) { r.createNew = true; r.custId = null; r.v.party = clean(popFor.value); }
    else { var c = customers().filter(function (x) { return String(x.id) === o.dataset.cid; })[0]; if (!c) return; r.custId = c.id; r.createNew = false; r.v.party = c.name; r.v.phone = c.phone || ''; }
    S.dirty = true; var inp = popFor; hidePop();
    var keep = panel().querySelector('.tt-bk-body') ? panel().querySelector('.tt-bk-body').scrollTop : 0;
    var el = inp.closest('.tt-bk-row'), idx = S.rows.indexOf(r); el.outerHTML = rowHtml(r, idx);
    validateAll(); S.rows.forEach(paintRow); paintSum();
    var nb = panel().querySelector('.tt-bk-body'); if (nb) nb.scrollTop = keep;
    if (r.createNew) { var ph = panel().querySelector('.tt-bk-row[data-k="' + r.k + '"] [data-f="phone"]'); if (ph) ph.focus(); }
  }
  function rowOf(el) { var row = el.closest && el.closest('.tt-bk-row'); if (!row) return null; var k = +row.dataset.k; return S.rows.filter(function (x) { return x.k === k; })[0] || null; }

  /* ----- delegated handlers (ONE set, attached when the panel is first created) ----- */
  function onFocusIn(e) { var t = e.target; if (t.matches && t.matches('input.tt-bk-cb')) showPop(t); else hidePop(); }
  function onKey(e) { if (e.key === 'Escape' && pop && pop.style.display === 'block') { hidePop(); e.stopPropagation(); } }
  function onInput(e) {
    var t = e.target, f = t.dataset && t.dataset.f; if (!f) return;
    var r = rowOf(t); if (!r) return;
    r.v[f] = t.value; S.dirty = true;
    if (f === 'party') { r.custId = null; r.createNew = false; var pn = t.closest('.tt-bk-row').querySelector('[data-pn]'); if (pn) pn.innerHTML = ''; showPop(t); var ph = t.closest('.tt-bk-row').querySelector('[data-f="phone"]'); }
    revalidate(r);
  }
  function onChange(e) {
    var t = e.target;
    if (t.id === 'ttBkFile') { loadFile(t.files && t.files[0]); t.value = ''; return; }
    if (t.dataset && t.dataset.map) { S.map[t.dataset.map] = parseInt(t.value, 10); return; }
    var f = t.dataset && t.dataset.f; if (!f) return; var r = rowOf(t); if (!r) return;
    r.v[f] = t.value; S.dirty = true; revalidate(r);
  }
  function onClick(e) {
    var a = e.target.closest('[data-act]'); if (!a) return; var act = a.dataset.act;
    if (act === 'close') return closePanel();
    if (act === 'add') { var nr = newRow(); S.rows.push(nr); S.dirty = true; var host = $('ttBkRows'); host.insertAdjacentHTML('beforeend', rowHtml(nr, S.rows.length - 1)); validateAll(); S.rows.forEach(paintRow); paintSum(); var el = host.lastElementChild; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (act === 'add5' || act === 'copylast') {
      var base = S.rows[S.rows.length - 1] && S.rows[S.rows.length - 1].v, made = [], n = act === 'add5' ? 5 : 1;
      for (var q = 0; q < n; q++) {
        var seed = {};
        if (act === 'copylast' && base) {
          seed = { date: base.date, staff: base.staff, mode: base.mode, taxType: base.taxType, hsn: base.hsn, gst: base.gst };
          var mm = /^(.*?)(\d+)$/.exec(clean(base.inv));
          if (mm) { var nx = String(parseInt(mm[2], 10) + 1); while (nx.length < mm[2].length) nx = '0' + nx; seed.inv = mm[1] + nx; }
        }
        made.push(newRow(seed));
      }
      appendRows(made); return;
    }
    if (act === 'pastebox') { var pb = $('ttBkPaste'); if (pb) { pb.style.display = pb.style.display === 'none' ? 'block' : 'none'; var ta = $('ttBkPasteTa'); if (ta && pb.style.display === 'block') ta.focus(); } return; }
    if (act === 'pasteapply') return applyPaste();
    if (act === 'del') { var r = rowOf(a); if (!r) return; if (S.rows.length === 1) { S.rows = [newRow()]; } else S.rows = S.rows.filter(function (x) { return x !== r; }); S.dirty = true; renderEdit(); validateAll(); S.rows.forEach(paintRow); paintSum(); return; }
    if (act === 'csv') return $('ttBkFile').click();
    if (act === 'tpl') return template();
    if (act === 'applymap') return applyMap();
    if (act === 'dropfile') { S.map = null; S.file = null; S.rawRows = null; return renderEdit(); }
    if (act === 'review') return toReview();
    if (act === 'back') return backToEdit();
    if (act === 'confirm') return doSave();
    if (act === 'retry') return doSave(true);
    if (act === 'finish') { S.dirty = false; return closePanel(true); }
    if (act === 'newbatch') { fresh(); renderEdit(); validateAll(); S.rows.forEach(paintRow); paintSum(); return; }
    if (act === 'toggleall') { var on = a.dataset.on === '1'; S.rows.forEach(function (x) { if (x.res && (x.res.state === 'ok' || x.res.state === 'warn')) x.sel = on; }); renderReview(); return; }
  }

  /* ----- v35: faster manual entry (add several rows, copy last row, paste from Excel) ----- */
  function appendRows(made) {
    var host = $('ttBkRows'); if (!host) return;
    made.forEach(function (nr) { S.rows.push(nr); host.insertAdjacentHTML('beforeend', rowHtml(nr, S.rows.length - 1)); });
    S.dirty = true; validateAll(); S.rows.forEach(paintRow); paintSum();
    var first = host.querySelector('.tt-bk-row[data-k="' + made[0].k + '"]'); if (first) { try { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { first.scrollIntoView(); } var pi = first.querySelector('[data-f="party"]'); if (pi) { try { pi.focus({ preventScroll: true }); } catch (e) {} } }
  }
  function applyPaste() {
    var ta = $('ttBkPasteTa'), txt = ta ? ta.value : '';
    var lines = txt.replace(/\r/g, '').split('\n').filter(function (l) { return clean(l) !== ''; });
    if (!lines.length) { toast('Paste some rows first.', true); return; }
    if (lines.length > 1000) { toast('Maximum 1000 rows at a time.', true); return; }
    var grid = lines.map(function (l) { return (l.indexOf('\t') >= 0 ? l.split('\t') : parseCSV(l)[0] || []).map(clean); });
    var order = FIELDS.map(function (f) { return f.k; }), start = 0, nh = grid[0].map(norm), hit = 0, map = {};
    FIELDS.forEach(function (fd) {
      var idx = nh.indexOf(norm(fd.label)); if (idx < 0) idx = nh.indexOf(fd.k.toLowerCase());
      if (idx < 0) for (var i = 0; i < fd.al.length && idx < 0; i++) { var j = nh.indexOf(fd.al[i]); if (j >= 0) idx = j; }
      if (idx >= 0) { map[fd.k] = idx; hit++; }
    });
    var useHeader = hit >= 2;
    if (useHeader) start = 1;
    var made = [];
    for (var r = start; r < grid.length; r++) {
      var v = {};
      if (useHeader) Object.keys(map).forEach(function (k) { v[k] = grid[r][map[k]] || ''; });
      else order.forEach(function (k, i) { v[k] = grid[r][i] || ''; });
      var nr = newRow(v); nr.src = {}; made.push(nr);
    }
    if (!made.length) { toast('No data rows found.', true); return; }
    made.forEach(function (nr) { var m = matchCustomer(nr); if (m.c) { nr.custId = m.c.id; if (!nr.v.phone) nr.v.phone = m.c.phone || ''; } });
    // replace the single untouched empty row, otherwise append
    if (S.rows.length === 1 && !S.rows.some(function (x) { return Object.keys(x.v).some(function (k) { return clean(x.v[k]) !== ''; }); })) S.rows = [];
    S.rows = S.rows.concat(made); S.dirty = true;
    renderEdit(); validateAll(); S.rows.forEach(paintRow); paintSum();
    toast(made.length + ' row(s) added. Check customers, then Review.');
  }

  /* ----- CSV load + mapping ----- */
  function loadFile(f) {
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) { toast('Excel files (.xlsx) are not supported. In Excel choose File → Save As → CSV (Comma delimited), then import that file.', true); return; }
    if (f.size > 2 * 1024 * 1024) { toast('File is larger than 2 MB. Split it into smaller CSV files.', true); return; }
    var fr = new FileReader();
    fr.onerror = function () { toast('Could not read the file.', true); };
    fr.onload = function () {
      var rows; try { rows = parseCSV(fr.result); } catch (e) { toast('This file could not be parsed as CSV.', true); return; }
      if (rows.length < 2) { toast('The file needs a header row and at least one data row.', true); return; }
      if (rows.length - 1 > 1000) { toast('Maximum 1000 rows per import. This file has ' + (rows.length - 1) + '.', true); return; }
      var hdr = rows[0].map(clean), map = {}, taken = {};
      FIELDS.forEach(function (fd) {
        var idx = -1, nh = hdr.map(norm);
        idx = nh.indexOf(norm(fd.label)); if (idx < 0) idx = nh.indexOf(fd.k.toLowerCase());
        if (idx < 0) for (var i = 0; i < fd.al.length && idx < 0; i++) { var j = nh.indexOf(fd.al[i]); if (j >= 0 && !taken[j]) idx = j; }
        if (idx >= 0) taken[idx] = 1; map[fd.k] = idx;
      });
      S.file = f.name; S.header = hdr; S.rawRows = rows.slice(1); S.map = map; S.dirty = true;
      renderEdit(); validateAll(); S.rows.forEach(paintRow); paintSum();
      var m = panel().querySelector('.tt-bk-map'); if (m) m.scrollIntoView({ block: 'start' });
    };
    fr.readAsText(f);
  }
  function applyMap() {
    var M = S.map, raw = S.rawRows, out = [], i = 0;
    if (M.total < 0 && M.received < 0 && M.party < 0) { toast('Match at least Customer and Total columns first.', true); return; }
    var btn = panel().querySelector('[data-act="applymap"]'); if (btn) btn.disabled = true;
    (function chunk() {  // async chunks keep the UI responsive on large files
      var end = Math.min(i + 200, raw.length);
      for (; i < end; i++) {
        var r = newRow(), src = {};
        FIELDS.forEach(function (fd) { var c = M[fd.k]; var val = c >= 0 ? clean(raw[i][c]) : ''; r.v[fd.k] = val; if (c >= 0) src[fd.k] = val; });
        var d = parseDate(r.v.date); r.src = src; out.push(r);
      }
      if (i < raw.length) return setTimeout(chunk, 0);
      S.rows = out; S.map = null; S.rawRows = null; S.dirty = true;
      // pre-select customers only on an exact normalised match
      S.rows.forEach(function (r) { var m = matchCustomer(r); if (m.c) { r.custId = m.c.id; if (!r.v.phone) r.v.phone = m.c.phone || ''; } });
      renderEdit(); validateAll(); S.rows.forEach(paintRow); paintSum();
    })();
  }
  function template() {
    var head = FIELDS.map(function (f) { return f.label; }), ex = ['SAMPLE-001', '15-10-2026', 'SAMPLE CUSTOMER (use a real customer name)', '', '', 'Sample description — DELETE THIS ROW', '84139190', 'INTRA', '18', '11800', '5000', '6800', 'Partial', 'Cash', '15-10-2026', 'Sample row. Never imported automatically.'];
    var csv = '﻿' + head.map(csvEsc).join(',') + '\r\n' + ex.map(csvEsc).join(',') + '\r\n';
    try { var b = new Blob([csv], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'TTESPL_Ledger_Import_Template.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); toast('Template downloaded (the example row is sample data — delete it).'); }
    catch (e) { toast('Could not create the template: ' + e.message, true); }
  }

  /* ----- review ----- */
  function toReview() {
    validateAll(); S.rows.forEach(paintRow); paintSum();
    var live = S.rows.filter(function (r) { return r.res && !r.res.blank; });
    if (!live.length) { toast('Add at least one invoice row.', true); return; }
    S.rows.forEach(function (r) { if (r.res && !r.res.blank) r.sel = (r.res.state === 'ok' || r.res.state === 'warn'); });
    S.step = 'review'; renderReview();
  }
  function backToEdit() { S.step = 'edit'; renderEdit(); validateAll(); S.rows.forEach(paintRow); paintSum(); }
  function importable(r) { return r.res && !r.res.blank && r.res.state !== 'error' && r.res.dup !== 'exists' && r.res.dup !== 'file'; }
  function renderReview() {
    var live = S.rows.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return x.r.res && !x.r.res.blank; });
    var pick = live.filter(function (x) { return importable(x.r) && x.r.sel; }), sum = pick.reduce(function (a, x) { a.t += x.r.res.total; a.rc += x.r.res.recv; a.d += x.r.res.due; return a; }, { t: 0, rc: 0, d: 0 });
    var newCust = {}; pick.forEach(function (x) { if (x.r.createNew && !x.r.res.cust) newCust[norm(x.r.v.party)] = 1; });
    var lab = { error: 'Error', dup: 'Possible duplicate', warn: 'Warning', ok: 'Valid' };
    box().innerHTML = head('Check everything before saving') + steps(1) + '<div class="tt-bk-body" id="ttBkBody">' +
      '<div class="tt-bk-tools"><button type="button" class="btn btn-outline btn-sm" data-act="toggleall" data-on="1">Select all valid</button><button type="button" class="btn btn-outline btn-sm" data-act="toggleall" data-on="0">Clear</button></div>' +
      live.map(function (x) {
        var r = x.r, s = r.res, can = importable(r), msgs = s.E.map(function (e) { return '<div class="e">✖ ' + H(e) + '</div>'; }).join('') + s.W.map(function (w) { return '<div class="w">⚠ ' + H(w) + '</div>'; }).join('');
        var srcLine = r.src ? '<div class="tt-bk-src">File: ' + Object.keys(r.src).filter(function (k) { return r.src[k] !== ''; }).map(function (k) { return H(FIELDS.filter(function (f) { return f.k === k; })[0].label) + ' = ' + H(r.src[k]); }).join(' · ') + '</div>' : '';
        return '<div class="tt-bk-rv ' + s.state + '"><label class="tt-bk-pick"><input type="checkbox" data-pick="' + r.k + '"' + (r.sel && can ? ' checked' : '') + (can ? '' : ' disabled') + '><span class="tt-bk-chip ' + (s.state === 'error' ? 'err' : s.state === 'dup' ? 'dup' : s.state === 'warn' ? 'warn' : 'ok') + '">' + lab[s.state] + '</span></label>' +
          '<div class="tt-bk-rt"><b>#' + (x.i + 1) + ' · ' + H(s.id || r.v.inv || '—') + '</b><span>' + H(s.date || clean(r.v.date)) + '</span></div>' +
          '<div class="tt-bk-rn">' + H(s.cust ? s.cust.name : clean(r.v.party)) + (r.createNew && !s.cust ? ' <i>(new)</i>' : '') + '</div>' +
          '<div class="tt-bk-ra"><span>Total <b>' + inr(s.total) + '</b></span><span>Recd <b>' + inr(s.recv) + '</b></span><span>Due <b>' + inr(s.due) + '</b></span><span>' + H(s.status || '') + '</span></div>' + srcLine + msgs + '</div>';
      }).join('') + '</div>' +
      '<div class="tt-bk-f col"><div class="tt-bk-sum"><b>' + pick.length + '</b> invoice(s) · Total <b>' + inr(sum.t) + '</b> · Received <b>' + inr(sum.rc) + '</b> · Due <b>' + inr(sum.d) + '</b>' + (Object.keys(newCust).length ? ' · ' + Object.keys(newCust).length + ' new customer(s)' : '') + '</div>' +
      '<div class="tt-bk-fb"><button type="button" class="btn btn-outline" data-act="back">‹ Edit rows</button><button type="button" class="btn btn-primary" data-act="confirm"' + (pick.length ? '' : ' disabled') + '>Confirm &amp; save</button></div></div>';
    var cbs = box().querySelectorAll('[data-pick]'); Array.prototype.forEach.call(cbs, function (cb) { cb.addEventListener('change', function () { var k = +cb.dataset.pick, r = S.rows.filter(function (x) { return x.k === k; })[0]; if (r) { r.sel = cb.checked; var y = box().querySelector('.tt-bk-body').scrollTop; renderReview(); box().querySelector('.tt-bk-body').scrollTop = y; } }); });
  }

  /* ----- save: confirmed cloud writes, chunked, per-record status ----- */
  function cloudWrite(key, arr) {
    if (!window.cloudSync || typeof window.cloudSync.pushKey !== 'function') return Promise.reject(new Error('Cloud sync is not connected right now'));
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.reject(new Error('You are offline'));
    return Promise.race([window.cloudSync.pushKey(key, arr), new Promise(function (_, rej) { setTimeout(function () { rej(new Error('Cloud did not confirm in time')); }, CLOUD_TIMEOUT); })]);
  }
  function doSave(retry) {
    if (saving) return; if (!isAdm()) { toast('Only Admin can import ledger records.', true); return; }
    var items = S.rows.filter(function (r) { return importable(r) && r.sel; });
    if (retry && S.result) items = S.result.failedRows.slice();
    if (!items.length) { toast('Nothing selected to import.', true); return; }
    // re-check duplicates against the CURRENT live ledger right before writing (another device may have added some)
    validateAll(); var skipped = [], todo = [];
    items.forEach(function (r) { if (r.res.dup === 'exists' || r.res.dup === 'file' || r.res.state === 'error') skipped.push(r); else todo.push(r); });
    if (!todo.length) { S.result = { ok: [], dup: skipped, bad: [], failed: [], failedRows: [], batch: '' }; return renderResult(); }
    saving = true; S.step = 'saving'; hidePop();
    var batchId = 'IMPB-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.floor(Math.random() * 900 + 100);
    var box0 = box(); box0.innerHTML = head('Saving…') + steps(1) + '<div class="tt-bk-body"><div class="tt-bk-prog"><div class="tt-bk-bar"><i id="ttBkBar"></i></div><div id="ttBkPt">Saving 0 of ' + todo.length + '…</div><small>Please keep this screen open until the cloud confirms.</small></div></div>';
    var recs = todo.map(function (r) { return { r: r, rec: buildRecord(r, batchId) }; }), ok = [], failed = [], done = 0;
    // 1) new customers first (so invoices never point at a customer that failed to save)
    var created = {}, newC = [];
    recs.forEach(function (x) { if (x.r.createNew && !x.r.res.cust) { var key = norm(x.r.v.party) + '|' + String(x.r.v.phone).replace(/\D/g, '').slice(-10); if (!created[key]) { var c = { id: Date.now() + newC.length, name: clean(x.r.v.party), phone: String(x.r.v.phone).replace(/\D/g, '').slice(-10), address: '', gst: 'Unregistered' }; created[key] = c; newC.push(c); } x.cust = created[key]; } });
    var step0 = newC.length ? cloudWrite('CUSTOMERS', newC).then(function () { newC.forEach(function (c) { customers().unshift(c); }); try { setStored('CUSTOMERS', customers()); } catch (e) {} return true; }).catch(function (e) { newC.failed = e; return false; }) : Promise.resolve(true);
    step0.then(function (custOk) {
      var queue = recs.slice(), failC = [];
      if (!custOk) { queue = queue.filter(function (x) { if (x.cust) { failed.push({ r: x.r, why: 'New customer could not be saved: ' + (newC.failed && newC.failed.message || 'cloud error') }); return false; } return true; }); }
      var idx = 0;
      (function next() {
        if (idx >= queue.length) return finish();
        var part = queue.slice(idx, idx + CHUNK); idx += CHUNK;
        part.forEach(function (x) { if (x.cust) { x.rec.customerName = x.cust.name; x.rec.phone = x.cust.phone; } });
        cloudWrite('ORDERS', part.map(function (x) { return x.rec; })).then(function () {
          // cloud confirmed → NOW the records may appear locally
          part.forEach(function (x) { orders().unshift(x.rec); ok.push(x.r); }); try { setStored('ORDERS', orders()); } catch (e) {}
        }).catch(function (e) { part.forEach(function (x) { failed.push({ r: x.r, why: (e && e.message) || 'cloud write failed' }); }); })
          .then(function () { done = Math.min(idx, queue.length); var b = $('ttBkBar'), t = $('ttBkPt'); if (b) b.style.width = Math.round(done / queue.length * 100) + '%'; if (t) t.textContent = 'Saved ' + ok.length + ' of ' + queue.length + '…'; setTimeout(next, 0); });
      })();
      function finish() {
        saving = false;
        S.result = { ok: ok, dup: skipped, bad: S.rows.filter(function (r) { return r.res && !r.res.blank && r.res.state === 'error'; }), failed: failed, failedRows: failed.map(function (f) { return f.r; }), batch: batchId };
        if (ok.length) {
          try { window.ttActAdd && window.ttActAdd('Ledger import', 'imported', batchId, ok.length + ' invoice(s), ' + inr(ok.reduce(function (a, r) { return a + r.res.total; }, 0))); } catch (e) {}
          try { renderBilling('all'); renderDashboard(); renderOrders(); } catch (e) {}
          try { if (window.cloudSync && window.cloudSync.pushLiveNotification) window.cloudSync.pushLiveNotification({ title: '📥 Ledger import', body: ok.length + ' invoice(s) imported by ' + me(), type: 'order' }); } catch (e) {}
        }
        S.dirty = failed.length > 0; S.step = 'result'; renderResult();
      }
    });
  }
  function renderResult() {
    var R = S.result, nOk = R.ok.length, nDup = R.dup.length, nBad = R.bad.length, nF = R.failed.length;
    var list = function (arr, f) { return arr.slice(0, 60).map(f).join('') + (arr.length > 60 ? '<div class="w">…and ' + (arr.length - 60) + ' more</div>' : ''); };
    box().innerHTML = head('Import result') + steps(2) + '<div class="tt-bk-body" id="ttBkBody">' +
      '<div class="tt-bk-kpi"><div class="k ok"><b>' + nOk + '</b><small>Imported</small></div><div class="k dup"><b>' + nDup + '</b><small>Skipped duplicates</small></div><div class="k err"><b>' + nBad + '</b><small>Invalid (not imported)</small></div><div class="k fail"><b>' + nF + '</b><small>Failed to save</small></div></div>' +
      (nOk ? '<div class="tt-bk-ok2">✔ ' + nOk + ' invoice(s) were confirmed by the cloud and now appear in the Ledger.' + (R.batch ? ' Batch <b>' + H(R.batch) + '</b>.' : '') + '</div>' : '') +
      (nF ? '<div class="tt-bk-sec">Failed to save (nothing was lost — retry is safe, saved ones are skipped)</div>' + list(R.failed, function (f) { return '<div class="tt-bk-li e">✖ ' + H(f.r.res.id) + ' · ' + H(f.r.v.party) + ' — ' + H(f.why) + '</div>'; }) : '') +
      (nDup ? '<div class="tt-bk-sec">Skipped (already exist)</div>' + list(R.dup, function (r) { return '<div class="tt-bk-li w">⚠ ' + H(r.res.id) + ' · ' + H(r.v.party) + '</div>'; }) : '') +
      (nBad ? '<div class="tt-bk-sec">Invalid rows (not imported)</div>' + list(R.bad, function (r) { return '<div class="tt-bk-li e">✖ ' + H(r.res.id || r.v.inv || '—') + ' · ' + H(r.v.party) + ' — ' + H(r.res.E[0] || '') + '</div>'; }) : '') +
      '</div><div class="tt-bk-f"><span></span>' + (nF ? '<button type="button" class="btn btn-primary" data-act="retry">Retry failed (' + nF + ')</button>' : '<button type="button" class="btn btn-outline" data-act="newbatch">Import more</button>') + '<button type="button" class="btn ' + (nF ? 'btn-outline' : 'btn-primary') + '" data-act="finish">Done</button></div>';
  }

  /* ----- open / close ----- */
  function openPanel() {
    if (!isAdm()) { toast('Only Admin can import ledger records.', true); return; }
    if (window.ttAccToggle && false) {}
    var p = panel(); if (!S || S.step === 'result' || !S.dirty) fresh();
    S.restoreFocus = document.activeElement;
    S.step === 'review' ? renderReview() : renderEdit();
    if (S.step === 'edit') { validateAll(); S.rows.forEach(paintRow); paintSum(); }
    p.style.display = 'flex';
    requestAnimationFrame(function () { p.classList.add('tt-open'); });
    try { var x = p.querySelector('.tt-bk-x'); x && x.focus({ preventScroll: true }); } catch (e) {}
  }
  function closePanel(force) {
    if (saving) { toast('Saving is in progress — please wait for the cloud to confirm.', true); return; }
    if (!force && S && S.dirty && S.step !== 'result') { if (!confirm('Discard the rows you entered?\n\nNothing has been saved yet.')) return; S.dirty = false; }
    var p = $('ttBulkPanel'); if (!p) return; hidePop();
    p.classList.remove('tt-open'); p.style.display = 'none'; if (S && S.step !== 'result') S = null; else S = null;
    try { S0 && S0.focus && S0.focus(); } catch (e) {}
  }
  var S0 = null;
  window.ttBulkOpen = function () { S0 = document.activeElement; openPanel(); };
  window.ttBulkClose = closePanel;
  window.ttBulkSelfTest = { parseDate: parseDate, parseMoney: parseMoney, parseCSV: parseCSV, modeFrom: modeFrom, hash: hash };

  /* admin-only button visibility */
  function vis() { var b = $('ttBulkLedBtn'); if (b) b.style.display = isAdm() ? '' : 'none'; }
  function wrap() { if (typeof window.renderBilling !== 'function' || window.renderBilling.__ttBulk) return; var o = window.renderBilling; window.renderBilling = function () { var r = o.apply(this, arguments); try { vis(); } catch (e) {} return r; }; window.renderBilling.__ttBulk = true; try { renderBilling = window.renderBilling; } catch (e) {} }
  wrap(); setTimeout(wrap, 1600); setTimeout(vis, 2600);
})();


/* ===== v28: Premium team chat (WhatsApp-style) =====
   Same data store as before: Firestore `team_messages` (one doc per message, id = cid).  New fields are OPTIONAL and additive:
   senderId, replyTo{cid,sender,text}, mentions[], reactions{thumb|heart|laugh|wow|pray:[userId]}, edited/editedAt, deleted/deletedBy,
   hiddenFor[userId], pinned/pinnedBy/pinnedAt, sAt (server time).  Read cursors / presence / typing live in `chat_status`. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var RX = { thumb: '👍', heart: '❤️', laugh: '😂', wow: '😮', pray: '🙏' };
  var EMOJIS = '😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😅 😢 😡 👍 👎 👏 🙏 🙌 💪 🔥 ✅ ❌ ⚠️ ❤️ 🎉 🚀 📦 🚚 💰 📞 🛠️ 📌 👀'.split(' ');
  var GROUP_MS = 5 * 60 * 1000, PRES_FRESH = 60000, TYPE_FRESH = 7000, HB_MS = 25000, OLD_N = 50, MAXB64 = 900000;
  var S = { older: [], q: '', matches: [], mi: -1, reply: null, edit: null, read: {}, pres: {}, typing: {}, statusOk: null, active: false, first: true,
    known: {}, newCount: 0, hb: null, typingOn: false, typingT: null, readT: null, subT: null, loadingOld: false, noMoreOld: false, lastRender: 0, menuCid: null, pinIdx: 0, stick: true, rafR: 0, pendR: false };
  var G = null, wired = false, lastRows = 0;

  /* ---------------- helpers ---------------- */
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m, bad) { try { if (bad && window.ttShowErrorToast) return ttShowErrorToast(m); if (window.ttShowSuccessToast) return ttShowSuccessToast(m); } catch (e) {} }
  function user() { try { return (typeof currentUser !== 'undefined' && currentUser) || window.currentUser || null; } catch (e) { return window.currentUser || null; } }
  function meName() { var u = user(); return (u && u.name) || ''; }
  function emps() { try { return (typeof registeredEmployees !== 'undefined' ? registeredEmployees : window.registeredEmployees) || []; } catch (e) { return []; } }
  function idOfName(n) { var e = emps().filter(function (x) { return x && x.name === n; })[0]; return e && e.id != null ? String(e.id) : String(n || ''); }
  function meId() { var u = user(); return u ? (u.id != null ? String(u.id) : String(u.name || '')) : ''; }
  function nameOfId(id) { var e = emps().filter(function (x) { return x && String(x.id) === String(id); })[0]; return e ? e.name : String(id); }
  function uidOf(m) { return m.senderId != null ? String(m.senderId) : idOfName(m.sender); }
  function isMine(m) { return m.senderId != null ? String(m.senderId) === meId() : (!!meName() && m.sender === meName()); }
  function isAdm() { try { return !!isAdminUser(); } catch (e) { return false; } }
  function cs() { return window.cloudSync || null; }
  function tsOf(m) { return Number(m.timestamp) || 0; }
  function timeStr(ts) { try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayLabel(ts) {
    var d = new Date(ts), n = new Date(), y = new Date(); y.setDate(n.getDate() - 1);
    if (dayKey(ts) === dayKey(n.getTime())) return 'Today'; if (dayKey(ts) === dayKey(y.getTime())) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function hue(s) { var h = 0, i; for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem('TTESPL_ERP_' + k); localStorage.setItem('TTESPL_ERP_' + k, v); } catch (e) {} }
  function near(host) { return host.scrollHeight - host.scrollTop - host.clientHeight < 140; }

  /* ---------------- message list ---------------- */
  function allMsgs() {
    var seen = {}, out = [], me = meId(), idx = 0;
    var cloud = (typeof teamChatData !== 'undefined' ? teamChatData : window.teamChatData) || [];
    cloud.concat(S.older).forEach(function (m) { if (!m) return; var k = m.cid || ('o' + (idx++)); if (m.cid) { if (seen[m.cid]) return; seen[m.cid] = 1; } out.push(m); });
    try { pendingChat = (pendingChat || []).filter(function (p) { return !seen[p.cid]; }); window.pendingChat = pendingChat; } catch (e) {}
    ((typeof pendingChat !== 'undefined' ? pendingChat : window.pendingChat) || []).forEach(function (p) { out.push(p); });
    out = out.filter(function (m) { return !(m.hiddenFor && m.hiddenFor.indexOf(me) >= 0); });
    var order = new Map(); out.forEach(function (m, i) { order.set(m, i); });
    out.sort(function (a, b) { return (tsOf(a) - tsOf(b)) || (order.get(a) - order.get(b)); });
    return out;
  }
  function findMsg(cid) {
    var all = ((typeof teamChatData !== 'undefined' ? teamChatData : window.teamChatData) || []).concat(S.older, (typeof pendingChat !== 'undefined' ? pendingChat : []) || []);
    return all.filter(function (m) { return m && m.cid === cid; })[0] || null;
  }
  function myRead() { var r = S.read[meId()]; var l = ls('CHAT_READ_' + meId()); return Math.max(r ? Number(r.lastRead) || 0 : 0, Number(l) || 0); }
  function othersRead(ts) { var me = meId(), k; for (k in S.read) if (k !== me && Number(S.read[k].lastRead) >= ts) return true; return false; }
  function unread() {
    var cur = myRead(), n = 0; if (!cur && S.statusOk !== true && !ls('CHAT_READ_' + meId())) return 0;
    var cloud = (typeof teamChatData !== 'undefined' ? teamChatData : window.teamChatData) || [];
    cloud.forEach(function (m) { if (m && m.cid && !isMine(m) && !m.deleted && tsOf(m) > cur && !(m.hiddenFor && m.hiddenFor.indexOf(meId()) >= 0)) n++; });
    return n;
  }

  /* ---------------- text formatting (escape → links / mentions / search highlight) ---------------- */
  function fmt(raw) {
    raw = String(raw == null ? '' : raw);
    var names = emps().map(function (e) { return e && e.name; }).filter(Boolean).sort(function (a, b) { return b.length - a.length; });
    var parts = [], re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g, last = 0, m;
    var pushText = function (t) {
      if (!t) return;
      var i = 0;
      while (i < t.length) {
        var at = t.indexOf('@', i), hit = null, nm;
        while (at >= 0 && !hit) {
          for (nm = 0; nm < names.length; nm++) if (t.substr(at + 1, names[nm].length) === names[nm]) { hit = names[nm]; break; }
          if (!hit) at = t.indexOf('@', at + 1);
        }
        if (hit) { parts.push(hl(t.slice(i, at))); parts.push('<span class="ttc-men' + (hit === meName() ? ' me' : '') + '">@' + hl(hit) + '</span>'); i = at + 1 + hit.length; }
        else { parts.push(hl(t.slice(i))); break; }
      }
    };
    while ((m = re.exec(raw))) { pushText(raw.slice(last, m.index)); parts.push('<a href="' + H(m[1]) + '" target="_blank" rel="noopener noreferrer">' + hl(m[1]) + '</a>'); last = m.index + m[1].length; }
    pushText(raw.slice(last));
    return parts.join('');
  }
  function hl(t) {
    var e = H(t); if (!S.q) return e;
    var q = H(S.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); try { return e.replace(new RegExp(q, 'ig'), function (x) { return '<mark>' + x + '</mark>'; }); } catch (er) { return e; }
  }

  /* ---------------- rendering (keyed reconcile; only changed bubbles are rebuilt) ---------------- */
  function tickHtml(m) {
    if (!isMine(m) || m.deleted) return '';
    if (m._state === 'sending') return '<span class="ttc-tk sending" title="Sending" aria-label="Sending">🕓</span>';
    if (m._state === 'failed') return '<span class="ttc-tk failed" title="Not sent" aria-label="Not sent">⚠</span>';
    if (!m.cid) return '';
    if (othersRead(tsOf(m))) return '<span class="ttc-tk read" title="Read" aria-label="Read">✓✓</span>';
    return '<span class="ttc-tk sent" title="Sent" aria-label="Sent">✓</span>';
  }
  function quoteHtml(m) {
    var r = m.replyTo; if (!r) return '';
    var o = r.cid ? findMsg(r.cid) : null, del = o && o.deleted, who = (o && o.sender) || r.sender || '', txt = del ? '🚫 Message deleted' : ((o && (o.text || (o.fileName ? '📎 ' + o.fileName : ''))) || r.text || '');
    return '<div class="ttc-quote" data-q="' + H(r.cid || '') + '" style="--qc:hsl(' + hue(who) + ',62%,46%)"><b>' + H(who === meName() ? 'You' : who) + '</b><span>' + H(String(txt).slice(0, 120)) + '</span></div>';
  }
  function attachHtml(m) {
    if (!m.fileData) return '';
    if ((m.fileType || '').indexOf('image/') === 0) return '<img class="ttc-img" src="' + H(m.fileData) + '" alt="' + H(m.fileName || 'Photo') + '" loading="lazy" data-ph="' + H(m.cid) + '">';
    return '<div class="ttc-file" data-fl="' + H(m.cid) + '"><span>📄</span><b>' + H(m.fileName || 'File') + '</b></div>';
  }
  function rxHtml(m) {
    var r = m.reactions || {}, out = '', me = meId(), k;
    for (k in RX) { var a = r[k]; if (a && a.length) out += '<button type="button" class="ttc-rx' + (a.indexOf(me) >= 0 ? ' mine' : '') + '" data-rx="' + k + '" aria-label="' + RX[k] + ' ' + a.length + '">' + RX[k] + (a.length > 1 ? '<i>' + a.length + '</i>' : '') + '</button>'; }
    return out ? '<div class="ttc-rxs">' + out + '</div>' : '';
  }
  function buildRow(m, flags) {
    var mine = isMine(m), el = document.createElement('div');
    el.className = 'ttc-row ' + (mine ? 'out' : 'in') + (flags.cont ? ' cont' : '') + (flags.isNew ? ' fresh' : '') + (m.deleted ? ' del' : '') + (m.pinned ? ' pinned' : '') + (m.mentions && m.mentions.indexOf(meId()) >= 0 && !mine ? ' ment' : '');
    if (m.cid) el.dataset.cid = m.cid; el.tabIndex = -1;
    var body = m.deleted ? '<div class="ttc-t del">🚫 This message was deleted</div>' : (m.text && !(m.fileData && /^📎 /.test(m.text)) ? '<div class="ttc-t">' + fmt(m.text) + '</div>' : '');
    var author = (!mine && !flags.cont) ? '<div class="ttc-au" style="color:hsl(' + hue(m.sender || '') + ',62%,46%)">' + H(m.sender) + '</div>' : '';
    var meta = '<span class="ttc-meta">' + (m.pinned ? '📌 ' : '') + (m.edited && !m.deleted ? 'edited · ' : '') + (tsOf(m) ? timeStr(tsOf(m)) : H(m.time || '')) + tickHtml(m) + '</span>';
    el.innerHTML = '<div class="ttc-ri" aria-hidden="true">↩</div><div class="ttc-bw"><div class="ttc-b">' + author + (m.deleted ? '' : quoteHtml(m)) + (m.deleted ? '' : attachHtml(m)) + body + meta +
      (m._state === 'failed' ? '<div class="ttc-fail"><button type="button" data-retry="' + H(m.cid) + '">Retry</button><button type="button" data-discard="' + H(m.cid) + '">Discard</button></div>' : '') + '</div>' + (m.deleted ? '' : rxHtml(m)) + '</div>';
    return el;
  }
  function sigOf(m, f) {
    return [m.text, m.edited ? 1 : 0, m.editedAt, m.deleted ? 1 : 0, m.pinned ? 1 : 0, m._state || '', (m.fileData || '').length, JSON.stringify(m.reactions || {}), m.replyTo ? m.replyTo.cid : '', f.cont ? 1 : 0, f.tick, S.q, isMine(m) ? 1 : 0].join('\u0001') + (m.replyTo && m.replyTo.cid ? (function () { var o = findMsg(m.replyTo.cid); return o ? (o.deleted ? 'D' : (o.text || '').length) : '?'; })() : '');
  }
  function render() {
    updateBadge();
    var view = $('view-chat'), host = $('chatMessagesContainer');
    if (!host || !view || !view.classList.contains('active')) { S.pendR = true; return; }
    S.pendR = false;
    var msgs = allMsgs(), wasNear = near(host), prevH = host.scrollHeight, prevTop = host.scrollTop, me = meId();
    var els = [], map = {}, prevM = null, firstLoad = S.first, newIn = 0, lastMine = false, addedAny = false;
    Array.prototype.forEach.call(host.children, function (c) { if (c.dataset && c.dataset.key) map[c.dataset.key] = c; });
    S.matches = [];
    var q = S.q.toLowerCase();
    msgs.forEach(function (m) {
      var ts = tsOf(m), key = 'm:' + (m.cid || ('t' + ts + (m.sender || '') + String(m.text || '').slice(0, 12)));
      if (!prevM || (ts && tsOf(prevM) && dayKey(ts) !== dayKey(tsOf(prevM)))) {
        if (ts) { var dk = 'd:' + dayKey(ts), de = map[dk]; if (!de) { de = document.createElement('div'); de.className = 'ttc-day'; de.dataset.key = dk; de.innerHTML = '<span>' + H(dayLabel(ts)) + '</span>'; } else if (de.__lab !== dayLabel(ts)) { de.innerHTML = '<span>' + H(dayLabel(ts)) + '</span>'; } de.__lab = dayLabel(ts); els.push(de); prevM = null; }
      }
      var cont = !!(prevM && !m.deleted && !prevM.deleted && uidOf(prevM) === uidOf(m) && Math.abs(ts - tsOf(prevM)) < GROUP_MS);
      var f = { cont: cont, tick: isMine(m) ? (m._state || (othersRead(ts) ? 'r' : 's')) : '' };
      var sig = sigOf(m, f), el = map[key];
      if (!el || el.__sig !== sig) {
        var isNew = !el && !firstLoad && m.cid && !S.known[m.cid];
        f.isNew = isNew; el = buildRow(m, f); el.dataset.key = key; el.__sig = sig; if (isNew) addedAny = true;
      }
      if (m.cid && !S.known[m.cid]) { S.known[m.cid] = 1; if (!firstLoad && !isMine(m)) newIn++; }
      if (q && !m.deleted && String(m.text || '').toLowerCase().indexOf(q) >= 0) S.matches.push(m.cid);
      lastMine = isMine(m); els.push(el); prevM = m;
    });
    var top = $('ttcOlder'); if (!top) { top = document.createElement('button'); top.id = 'ttcOlder'; top.type = 'button'; top.className = 'ttc-older'; top.textContent = 'Load older messages'; }
    var cloudN = ((typeof teamChatData !== 'undefined' ? teamChatData : window.teamChatData) || []).length;
    top.hidden = !(cloudN >= 150 && !S.noMoreOld); top.disabled = S.loadingOld; top.textContent = S.loadingOld ? 'Loading…' : 'Load older messages';
    var empty = $('ttcEmpty'); if (!msgs.length) { if (!empty) { empty = document.createElement('div'); empty.id = 'ttcEmpty'; empty.className = 'ttc-empty'; empty.innerHTML = '<span>💬</span><b>No messages yet</b><small>Say hello to the team</small>'; } els.push(empty); } else if (empty) empty.remove();
    if (top.parentNode !== host || host.firstChild !== top) host.insertBefore(top, host.firstChild);
    var cur = top.nextSibling, i;
    for (i = 0; i < els.length; i++) { if (cur === els[i]) cur = cur.nextSibling; else host.insertBefore(els[i], cur); }
    while (cur) { var nx = cur.nextSibling; cur.remove(); cur = nx; }
    lastRows = els.length;
    var older = S._olderPending; S._olderPending = false;
    if (firstLoad) { host.scrollTop = host.scrollHeight; S.first = !msgs.length ? true : false; S.stick = true; }
    else if (older) { host.scrollTop = prevTop + (host.scrollHeight - prevH); }
    else if (wasNear || (addedAny && lastMine)) { host.scrollTop = host.scrollHeight; S.newCount = 0; }
    else if (newIn) S.newCount += newIn;
    paintPill(host); paintMatches(); paintPin(); paintHeader(); scheduleRead();
  }
  function paintPill(host) {
    var b = $('ttcNew'); if (!b) return; host = host || $('chatMessagesContainer');
    var far = host.scrollHeight - host.scrollTop - host.clientHeight > 320;
    if (near(host)) S.newCount = 0;
    b.hidden = !(S.newCount > 0 || far);
    b.innerHTML = S.newCount > 0 ? '↓ <b>' + S.newCount + '</b> new' : '↓';
    b.setAttribute('aria-label', S.newCount > 0 ? S.newCount + ' new messages, scroll to latest' : 'Scroll to latest');
  }
  function paintMatches() {
    var c = $('ttcSCount'); if (!c) return;
    if (!S.q) { c.textContent = ''; return; }
    if (!S.matches.length) { c.textContent = '0'; S.mi = -1; return; }
    if (S.mi < 0 || S.mi >= S.matches.length) S.mi = S.matches.length - 1;
    c.textContent = (S.mi + 1) + '/' + S.matches.length;
  }
  function paintPin() {
    var b = $('ttcPin'); if (!b) return;
    var pins = allMsgs().filter(function (m) { return m.pinned && !m.deleted && m.cid; }).sort(function (a, c) { return (c.pinnedAt || 0) - (a.pinnedAt || 0); });
    if (!pins.length) { b.hidden = true; b.dataset.cid = ''; return; }
    S.pinIdx = S.pinIdx % pins.length; var p = pins[S.pinIdx];
    b.hidden = false; b.dataset.cid = p.cid; b.innerHTML = '<span>📌</span><div><b>Pinned' + (pins.length > 1 ? ' ' + (S.pinIdx + 1) + '/' + pins.length : '') + '</b><small>' + H(String(p.text || (p.fileName ? '📎 ' + p.fileName : '')).slice(0, 90)) + '</small></div>';
  }
  function paintHeader() {
    var s = $('ttcSub'); if (!s) return; var now = Date.now(), me = meId(), k, typers = [], online = [];
    for (k in S.typing) { var t = S.typing[k]; if (t && t.isTyping && now - (t.updatedAt || 0) < TYPE_FRESH && t.user !== meName()) typers.push(t.user); }
    for (k in S.pres) if (k !== me && now - (S.pres[k].lastActive || 0) < PRES_FRESH) online.push(S.pres[k].user || nameOfId(k));
    var txt, cls = '';
    if (typers.length) { txt = (typers.length > 2 ? typers.length + ' people' : typers.join(', ')) + ' typing…'; cls = 'typing'; }
    else if (online.length) { txt = online.slice(0, 2).join(', ') + (online.length > 2 ? ' +' + (online.length - 2) : '') + ' online'; cls = 'online'; }
    else txt = (emps().length || '') + (emps().length ? ' members' : 'Team chat');
    s.textContent = txt; s.className = cls;
    clearTimeout(S.subT); if (typers.length || online.length) S.subT = setTimeout(paintHeader, 5000);
  }
  function updateBadge() {
    var n = unread(), b = $('ttcDockBadge');
    if (!b) {
      var nav = Array.prototype.filter.call(document.querySelectorAll('.nav-item'), function (x) { return /switchTab\('chat'/.test(x.getAttribute('onclick') || ''); })[0];
      if (!nav) return; b = document.createElement('i'); b.id = 'ttcDockBadge'; b.className = 'ttc-dockbadge'; b.hidden = true; nav.appendChild(b);
    }
    var shown = S.active ? 0 : n;
    b.hidden = !shown; b.textContent = shown > 99 ? '99+' : String(shown);
  }

  /* ---------------- read receipts / presence / typing ---------------- */
  function scheduleRead() {
    if (!S.active || document.hidden) return; var host = $('chatMessagesContainer'); if (!host || !near(host)) return;
    clearTimeout(S.readT); S.readT = setTimeout(markRead, 1200);
  }
  function markRead() {
    if (!S.active || document.hidden) return; var host = $('chatMessagesContainer'); if (!host || !near(host)) return;
    var latest = 0; ((typeof teamChatData !== 'undefined' ? teamChatData : window.teamChatData) || []).forEach(function (m) { if (m && m.cid && tsOf(m) > latest) latest = tsOf(m); });
    if (!latest || latest <= myRead()) { updateBadge(); return; }
    ls('CHAT_READ_' + meId(), String(latest)); S.read[meId()] = Object.assign({}, S.read[meId()] || {}, { lastRead: latest });   // one write per advance, never per render
    updateBadge();
    try { if (cs() && cs().chatMarkRead && S.statusOk !== false) cs().chatMarkRead(meId(), meName(), latest).catch(function () { S.statusOk = false; }); } catch (e) {}
  }
  function heartbeat() { try { if (cs() && cs().chatPresence && S.active && !document.hidden && S.statusOk !== false) cs().chatPresence(meId(), meName()).catch(function () { S.statusOk = false; }); } catch (e) {} }
  function startHB() { if (S.hb) return; heartbeat(); S.hb = setInterval(heartbeat, HB_MS); }
  function stopHB() { if (S.hb) { clearInterval(S.hb); S.hb = null; } }
  function typingSet(on) {
    if (S.typingOn === on) return; S.typingOn = on; if (on) S._tRe = Date.now();
    try { if (cs() && cs().setTypingStatus && S.statusOk !== false) cs().setTypingStatus(meName(), on).catch(function () {}); } catch (e) {}
  }
  function onTypingInput() {
    var v = $('chatInputMessage').value; clearTimeout(S.typingT);
    if (!v.trim()) { typingSet(false); return; }
    if (!S.typingOn) typingSet(true);
    else if (!S._tRe || Date.now() - S._tRe > 4000) { S._tRe = Date.now(); try { cs() && cs().setTypingStatus && S.statusOk !== false && cs().setTypingStatus(meName(), true).catch(function () {}); } catch (e) {} }
    S.typingT = setTimeout(function () { typingSet(false); }, 4500);
  }
  var watching = false;
  function watch() {
    if (watching) return; if (!cs() || typeof cs().watchChatStatus !== 'function') return; watching = true;
    try {
      cs().watchChatStatus(function (list, err) {
        if (!list) { S.statusOk = false; return; } S.statusOk = true;
        var r = {}, p = {}, t = {};
        list.forEach(function (d) {
          var id = d._id || '';
          if (id.indexOf('read_') === 0) r[String(d.uid)] = d; else if (id.indexOf('presence_') === 0) p[String(d.uid)] = d; else if (id.indexOf('typing_') === 0) t[d.user] = d;
        });
        var changed = JSON.stringify(Object.keys(r).map(function (k) { return k + ':' + r[k].lastRead; })) !== JSON.stringify(Object.keys(S.read).map(function (k) { return k + ':' + S.read[k].lastRead; }));
        S.read = r; S.pres = p; S.typing = t;
        if (!r[meId()] && !ls('CHAT_READ_' + meId())) { /* first ever run on this account: start from "everything so far is read" */
          var latest = 0; ((typeof teamChatData !== 'undefined' ? teamChatData : []) || []).forEach(function (m) { if (m && tsOf(m) > latest) latest = tsOf(m); }); if (latest) ls('CHAT_READ_' + meId(), String(latest));
        }
        paintHeader(); updateBadge(); if (changed && S.active) render();
      });
    } catch (e) { watching = false; }
  }

  /* ---------------- composer ---------------- */
  function input() { return $('chatInputMessage'); }
  function autosize() { var t = input(); if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }
  function send(fileObj) {
    var t = input(); if (!t) return; var txt = t.value.trim();
    if (S.edit && !fileObj) return doEdit(txt);
    if (!txt && !fileObj) return;
    if (!txt && fileObj) txt = '📎 ' + (fileObj.name || 'File');
    var now = Date.now(), m = {
      sender: meName() || 'Staff', senderId: meId(), text: txt, time: timeStr(now), timestamp: now,
      cid: 'c' + now + '_' + Math.random().toString(36).slice(2, 8), _state: 'sending'
    };
    if (S.reply) { var o = findMsg(S.reply.cid); m.replyTo = { cid: S.reply.cid, sender: S.reply.sender, text: String(S.reply.text || '').slice(0, 120) }; }
    var ment = emps().filter(function (e) { return e && e.id != null && txt.indexOf('@' + e.name) >= 0; }).map(function (e) { return String(e.id); }); if (ment.length) m.mentions = ment;
    if (fileObj && fileObj.data) { m.fileData = fileObj.data; m.fileType = fileObj.type || ''; m.fileName = fileObj.name || 'File'; }
    t.value = ''; autosize(); clearReply(); typingSet(false); hideMention(); showEmoji(false);
    pendingChat.push(m); S.stick = true; S.newCount = 0; render(); var host = $('chatMessagesContainer'); if (host) host.scrollTop = host.scrollHeight;
    pushChatToCloud(m);
  }
  function clearReply() { S.reply = null; var b = $('ttcReplyBar'); if (b) b.hidden = true; fit(); }
  function setReply(m) {
    if (!m || !m.cid || m.deleted) return; S.edit && cancelEdit();
    S.reply = { cid: m.cid, sender: m.sender, text: m.text || (m.fileName ? '📎 ' + m.fileName : '') };
    var b = $('ttcReplyBar'); b.hidden = false; b.innerHTML = '<div class="ttc-rq" style="--qc:hsl(' + hue(m.sender || '') + ',62%,46%)"><b>' + H(isMine(m) ? 'You' : m.sender) + '</b><span>' + H(String(S.reply.text).slice(0, 100)) + '</span></div><button type="button" id="ttcReplyX" aria-label="Cancel reply">✕</button>';
    fit(); try { input().focus({ preventScroll: true }); } catch (e) {}
  }
  function startEdit(m) {
    if (!m || !isMine(m) || m.deleted || !m.cid || m.fileData) return; clearReply(); S.edit = { cid: m.cid, prev: m.editedAt || 0, orig: m.text };
    var b = $('ttcReplyBar'); b.hidden = false; b.innerHTML = '<div class="ttc-rq edit"><b>✏️ Editing message</b><span>' + H(String(m.text).slice(0, 100)) + '</span></div><button type="button" id="ttcReplyX" aria-label="Cancel edit">✕</button>';
    input().value = m.text; autosize(); fit(); try { input().focus(); } catch (e) {}
  }
  function cancelEdit() { S.edit = null; var t = input(); if (t) { t.value = ''; autosize(); } var b = $('ttcReplyBar'); if (b) b.hidden = true; fit(); }
  var editing = false;
  function doEdit(txt) {
    if (editing) return; var e = S.edit; if (!e) return;
    if (!txt) { toast('A message cannot be empty. Use Delete instead.', true); return; }
    if (txt === e.orig) { cancelEdit(); return; }
    if (!cs() || !cs().chatEditSafe) { toast('Cloud chat is not connected — cannot edit now.', true); return; }
    editing = true; var btn = $('ttcSend'); if (btn) btn.disabled = true;
    cs().chatEditSafe(e.cid, txt, e.prev).then(function () {
      var m = findMsg(e.cid); if (m) { m.text = txt; m.edited = true; m.editedAt = Date.now(); }
      cancelEdit(); render(); toast('Message edited');
    }).catch(function (er) { toast('Edit failed: ' + ((er && er.message) || 'cloud error') + (navigator.onLine === false ? ' (you are offline)' : ''), true); })
      .then(function () { editing = false; if (btn) btn.disabled = false; });
  }

  /* ---------------- message actions ---------------- */
  function react(cid, key) {
    var m = findMsg(cid); if (!m || m.deleted || !cs() || !cs().chatReact) return; var me = meId(); m.reactions = m.reactions || {}; var a = (m.reactions[key] = (m.reactions[key] || []).slice());
    var on = a.indexOf(me) < 0; if (on) a.push(me); else a.splice(a.indexOf(me), 1);
    render();
    cs().chatReact(cid, key, me, on).catch(function (e) { var b = m.reactions[key] || []; if (on) b.splice(b.indexOf(me), 1); else b.push(me); render(); toast('Reaction not saved: ' + ((e && e.code) || 'error'), true); });
  }
  function togglePin(m) {
    if (!m || !m.cid || !cs() || !cs().chatPin) return; var on = !m.pinned; m.pinned = on; m.pinnedAt = on ? Date.now() : 0; render();
    cs().chatPin(m.cid, on, meName()).catch(function (e) { m.pinned = !on; render(); toast('Could not ' + (on ? 'pin' : 'unpin') + ': ' + ((e && e.code) || 'error'), true); });
  }
  function copyText(m) {
    var t = m.text || ''; if (!t) return;
    var ok = function () { toast('Copied'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok, fb); return; } } catch (e) {}
    fb();
    function fb() { try { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); ok(); } catch (e) { toast('Copy not supported on this device', true); } }
  }
  function discard(cid) { pendingChat = pendingChat.filter(function (p) { return p.cid !== cid; }); window.pendingChat = pendingChat; render(); }
  function doDelete(m, everyone) {
    closeSheet();
    if (!m.cid) return;
    if (!cs()) { toast('Cloud chat is not connected.', true); return; }
    if (everyone) {
      var snap = { text: m.text, fileData: m.fileData, fileName: m.fileName, fileType: m.fileType, reactions: m.reactions };
      m.deleted = true; m.text = ''; m.fileData = ''; m.reactions = {}; render();
      cs().chatTombstone(m.cid, meName()).then(function () { toast('Message deleted for everyone'); }).catch(function (e) { m.deleted = false; Object.assign(m, snap); render(); toast('Delete failed: ' + ((e && e.code) || 'error'), true); });
    } else {
      var prev = m.hiddenFor; m.hiddenFor = (m.hiddenFor || []).concat(meId()); render();
      cs().chatHideForMe(m.cid, meId()).then(function () { toast('Deleted for you'); }).catch(function (e) { m.hiddenFor = prev; render(); toast('Delete failed: ' + ((e && e.code) || 'error'), true); });
    }
  }

  /* ---------------- context menu / sheets (both are .auth-overlay → handled by the central Back manager) ---------------- */
  function ensureOv(id, z) {
    var o = $(id); if (o) return o;
    o = document.createElement('div'); o.id = id; o.className = 'auth-overlay ttc-ov'; o.style.display = 'none'; o.style.zIndex = z; o.setAttribute('role', 'dialog');
    document.body.appendChild(o); o.addEventListener('click', function (e) { if (e.target === o) { if (id === 'ttcMenu') closeMenu(); else closeSheet(); } }); return o;
  }
  var lastFocus = null;
  function openMenu(row) {
    var cid = row.dataset.cid, m = cid ? findMsg(cid) : null; if (!m) return;
    var ov = ensureOv('ttcMenu', 3450), mine = isMine(m), conf = !!(m.cid && m._state !== 'sending' && m._state !== 'failed'), items = [];
    S.menuCid = cid; lastFocus = row;
    if (m._state === 'failed') { items.push(['retry', '🔁', 'Retry send']); items.push(['discard', '🗑', 'Discard', 'danger']); }
    else if (!m.deleted) {
      items.push(['reply', '↩️', 'Reply']);
      if (m.text && !m.fileData) items.push(['copy', '📋', 'Copy']);
      if (mine && conf && !m.fileData) items.push(['edit', '✏️', 'Edit']);
      items.push(['forward', '📤', 'Forward / Share']);
      if (conf) items.push(['pin', '📌', m.pinned ? 'Unpin' : 'Pin']);
      items.push(['info', 'ℹ️', 'Message details']);
      if (conf) items.push(['del', '🗑', 'Delete…', 'danger']);
    } else { items.push(['del', '🗑', 'Delete for me', 'danger']); }
    var rxRow = (!m.deleted && conf) ? '<div class="ttc-mrx">' + Object.keys(RX).map(function (k) { var on = (m.reactions && m.reactions[k] || []).indexOf(meId()) >= 0; return '<button type="button" data-mrx="' + k + '" class="' + (on ? 'on' : '') + '" aria-label="React ' + RX[k] + '">' + RX[k] + '</button>'; }).join('') + '</div>' : '';
    ov.innerHTML = '<button type="button" class="ttc-hidden-x" onclick="ttChat.closeMenu()">✕</button><div class="ttc-menu" role="menu">' + rxRow + items.map(function (i) { return '<button type="button" role="menuitem" class="' + (i[3] || '') + '" data-act="' + i[0] + '"><span>' + i[1] + '</span>' + i[2] + '</button>'; }).join('') + '</div>';
    ov.style.display = 'block'; var menu = ov.querySelector('.ttc-menu'), bb = row.querySelector('.ttc-b').getBoundingClientRect(), vh = innerHeight, mh = menu.offsetHeight, mw = menu.offsetWidth;
    var top = bb.bottom + 8; if (top + mh > vh - 12) top = Math.max(12, bb.top - mh - 8); if (top + mh > vh - 12) top = Math.max(12, vh - mh - 12);
    var left = mine ? Math.min(bb.right, innerWidth - 12) - mw : Math.max(12, bb.left); left = Math.max(12, Math.min(left, innerWidth - mw - 12));
    menu.style.top = top + 'px'; menu.style.left = left + 'px'; menu.style.transformOrigin = (mine ? 'right ' : 'left ') + (top > bb.top ? 'top' : 'bottom');
    row.classList.add('sel'); try { (menu.querySelector('button')).focus({ preventScroll: true }); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  }
  function closeMenu() {
    var ov = $('ttcMenu'); if (ov) ov.style.display = 'none'; S.menuCid = null;
    Array.prototype.forEach.call(document.querySelectorAll('.ttc-row.sel'), function (r) { r.classList.remove('sel'); });
    try { lastFocus && lastFocus.isConnected && lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  function openSheet(html) {
    var ov = ensureOv('ttcSheet', 3460); ov.innerHTML = '<button type="button" class="ttc-hidden-x" onclick="ttChat.closeSheet()">✕</button><div class="ttc-sheet">' + html + '</div>'; ov.style.display = 'block';
    try { var b = ov.querySelector('.ttc-sheet button:not(.ttc-hidden-x)'); b && b.focus({ preventScroll: true }); } catch (e) {}
  }
  function closeSheet() { var ov = $('ttcSheet'); if (ov) ov.style.display = 'none'; }
  function sheetDelete(m) {
    var prev = H(String(m.text || (m.fileName ? '📎 ' + m.fileName : '')).slice(0, 100)), can = isMine(m) || isAdm();
    openSheet('<h4>Delete message?</h4><div class="ttc-sp">' + prev + '</div>' +
      '<button type="button" class="ttc-sbtn" data-del="me">Delete for me<small>Only removes it from your view</small></button>' +
      (can && !m.deleted ? '<button type="button" class="ttc-sbtn danger" data-del="all">Delete for everyone<small>' + (isMine(m) ? 'Everyone sees “This message was deleted”' : 'Admin action — removes it for the whole team') + '</small></button>' : '') +
      '<button type="button" class="ttc-sbtn plain" data-sh="close">Cancel</button>');
    $('ttcSheet').dataset.cid = m.cid;
  }
  function sheetForward(m) {
    var txt = 'Forwarded from ' + m.sender + ' (TTESPL team chat):\n' + (m.text || (m.fileName ? '📎 ' + m.fileName : ''));
    openSheet('<h4>Forward message</h4><div class="ttc-sp fwd"><b>' + H(m.sender) + '</b><span>' + H(m.text || (m.fileName ? '📎 ' + m.fileName : '')) + '</span></div><div class="ttc-warn">This leaves the TTESPL app. Check it contains no confidential business or financial details before sharing.</div>' +
      '<button type="button" class="ttc-sbtn" data-fw="share">Share via another app…</button><button type="button" class="ttc-sbtn plain" data-sh="close">Cancel</button>');
    $('ttcSheet').dataset.fw = txt;
  }
  function sheetInfo(m) {
    var me = meId(), readers = Object.keys(S.read).filter(function (k) { return k !== uidOf(m) && Number(S.read[k].lastRead) >= tsOf(m); }).map(function (k) { return S.read[k].user || nameOfId(k); });
    var rx = Object.keys(RX).filter(function (k) { return m.reactions && m.reactions[k] && m.reactions[k].length; }).map(function (k) { return RX[k] + ' ' + m.reactions[k].map(nameOfId).join(', '); });
    var full = function (ts) { try { return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
    openSheet('<h4>Message details</h4><div class="ttc-sp">' + H(String(m.text || (m.fileName ? '📎 ' + m.fileName : '')).slice(0, 140)) + '</div><div class="ttc-kv"><span>From</span><b>' + H(m.sender) + '</b><span>Sent</span><b>' + full(tsOf(m)) + '</b>' +
      (m.edited ? '<span>Edited</span><b>' + full(m.editedAt) + '</b>' : '') + '<span>Read by</span><b>' + (S.statusOk === false ? 'Read receipts unavailable' : (readers.length ? H(readers.join(', ')) : 'Nobody yet')) + '</b><span>Delivered</span><b>Not tracked</b>' +
      (rx.length ? '<span>Reactions</span><b>' + H(rx.join(' · ')) + '</b>' : '') + '</div><button type="button" class="ttc-sbtn plain" data-sh="close">Close</button>');
  }
  function sheetTeam() {
    var now = Date.now(), list = emps().map(function (e) {
      var p = S.pres[String(e.id)], on = p && now - (p.lastActive || 0) < PRES_FRESH, seen = p && p.lastActive ? new Date(p.lastActive).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      return '<div class="ttc-mem"><i style="background:hsl(' + hue(e.name) + ',55%,45%)">' + H((e.name || '?').trim().slice(0, 1).toUpperCase()) + '</i><div><b>' + H(e.name) + (String(e.id) === meId() ? ' (you)' : '') + '</b><small>' + H(e.role || '') + '</small></div><em class="' + (on ? 'on' : '') + '">' + (on ? 'in chat now' : (seen ? 'seen ' + seen : '')) + '</em></div>';
    }).join('');
    var pins = allMsgs().filter(function (m) { return m.pinned && !m.deleted; }).length;
    openSheet('<h4>TTESPL Team</h4><div class="ttc-sp">' + emps().length + ' members · ' + pins + ' pinned message' + (pins === 1 ? '' : 's') + '</div><div class="ttc-mems">' + list + '</div><div class="ttc-note">“in chat now” and “seen” come from real activity records written while a member has the chat open. ' + (S.statusOk === false ? 'Presence is unavailable right now.' : '') + '</div><button type="button" class="ttc-sbtn plain" data-sh="close">Close</button>');
  }

  /* ---------------- navigation inside the list ---------------- */
  function jump(cid, tries) {
    var host = $('chatMessagesContainer'), el = host && host.querySelector('.ttc-row[data-cid="' + (window.CSS && CSS.escape ? CSS.escape(cid) : cid) + '"]');
    if (el) { el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1600); return; }
    if ((tries || 0) < 3 && !S.noMoreOld) { loadOlder().then(function () { jump(cid, (tries || 0) + 1); }); return; }
    toast('That message is older than the loaded history.', true);
  }
  function loadOlder() {
    if (S.loadingOld || S.noMoreOld || !cs() || !cs().chatOlder) return Promise.resolve();
    var all = allMsgs(), first = all.filter(function (m) { return tsOf(m) > 0; })[0]; if (!first) return Promise.resolve();
    S.loadingOld = true; render();
    return cs().chatOlder(tsOf(first), OLD_N).then(function (arr) {
      var have = {}; allMsgs().forEach(function (m) { if (m.cid) have[m.cid] = 1; });
      var add = arr.filter(function (m) { return m && (!m.cid || !have[m.cid]); }); S.older = add.concat(S.older); if (arr.length < OLD_N) S.noMoreOld = true; S._olderPending = true;
    }).catch(function (e) { toast('Could not load older messages: ' + ((e && e.code) || 'error'), true); })
      .then(function () { S.loadingOld = false; render(); });
  }

  /* ---------------- mention + emoji ---------------- */
  function hideMention() { var d = $('ttcMention'); if (d) d.hidden = true; }
  function mentionCheck() {
    var t = input(), pos = t.selectionStart, before = t.value.slice(0, pos), m = /(^|\s)@([^\s@]*)$/.exec(before), d = $('ttcMention');
    if (!m) { d.hidden = true; return; }
    var q = m[2].toLowerCase(), list = emps().filter(function (e) { return e && e.name && String(e.id) !== meId() && e.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
    if (!list.length) { d.hidden = true; return; }
    d.innerHTML = list.map(function (e) { return '<button type="button" data-men="' + H(e.name) + '"><i style="background:hsl(' + hue(e.name) + ',55%,45%)">' + H(e.name.slice(0, 1).toUpperCase()) + '</i><span>' + H(e.name) + '</span><small>' + H(e.role || '') + '</small></button>'; }).join(''); d.hidden = false;
  }
  function insertMention(name) {
    var t = input(), pos = t.selectionStart, before = t.value.slice(0, pos).replace(/@[^\s@]*$/, '@' + name + ' '), after = t.value.slice(pos);
    t.value = before + after; t.selectionStart = t.selectionEnd = before.length; hideMention(); autosize(); t.focus();
  }
  function showEmoji(on) {
    var tray = $('ttcEmoji'); if (!tray) return;
    if (on === undefined) on = tray.hidden;
    if (on && !tray.firstChild) tray.innerHTML = EMOJIS.map(function (e) { return '<button type="button" data-em="' + e + '">' + e + '</button>'; }).join('');
    tray.hidden = !on; $('ttcEmojiBtn') && $('ttcEmojiBtn').setAttribute('aria-expanded', on ? 'true' : 'false'); fit();
  }

  /* ---------------- layout: keep composer above the dock / Android keyboard ---------------- */
  function fit() {
    var el = $('ttChat'); if (!el || !S.active) return;
    var vv = window.visualViewport, vh = vv ? vv.height : innerHeight, off = vv ? vv.offsetTop : 0, kb = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0, kbOpen = kb > 120;
    var nav = document.querySelector('.nav-item'); nav = nav && nav.parentElement; if (nav) nav.classList.toggle('ttc-hide', kbOpen);
    var top = el.getBoundingClientRect().top, bottom = kbOpen ? off + vh : (nav ? nav.getBoundingClientRect().top : off + vh);
    el.style.height = Math.max(280, bottom - top - 8) + 'px';
    if (kbOpen) { var host = $('chatMessagesContainer'); if (host && S.stick) host.scrollTop = host.scrollHeight; }
  }

  /* ---------------- gestures: swipe-to-reply + long-press (Pointer Events) ---------------- */
  function wire() {
    if (wired) return; var host = $('chatMessagesContainer'); if (!host) return; wired = true;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)');
    host.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var row = e.target.closest('.ttc-row'); if (!row || !row.dataset.cid || e.target.closest('button,a,.ttc-rx')) { G = null; return; }
      G = { row: row, x: e.clientX, y: e.clientY, id: e.pointerId, mode: null, hit: false, lp: setTimeout(function () { if (G && !G.mode) { G.mode = 'lp'; openMenu(G.row); } }, 460) };
    }, { passive: true });
    host.addEventListener('pointermove', function (e) {
      if (!G || e.pointerId !== G.id) return; var dx = e.clientX - G.x, dy = e.clientY - G.y;
      if (!G.mode) {
        if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(G.lp); G.mode = 'scroll'; }
        else if (dx > 12 && dx > Math.abs(dy) * 1.6) { clearTimeout(G.lp); G.mode = 'swipe'; try { host.setPointerCapture(e.pointerId); } catch (er) {} G.row.classList.add('swiping'); }
        else if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clearTimeout(G.lp);
      }
      if (G.mode === 'swipe') {
        var tx = Math.min(dx, 90) * (dx > 56 ? 0.6 + 0.4 * (56 / dx) : 1); tx = Math.max(0, Math.min(dx > 56 ? 56 + (dx - 56) * 0.25 : dx, 80));
        var bw = G.row.querySelector('.ttc-bw'), ic = G.row.querySelector('.ttc-ri'); bw.style.transform = 'translate3d(' + tx + 'px,0,0)'; var pr = Math.min(1, tx / 56); ic.style.opacity = pr; ic.style.transform = 'scale(' + (0.6 + 0.4 * pr) + ')';
        if (tx >= 56 && !G.hit) { G.hit = true; ic.classList.add('hit'); try { navigator.vibrate && navigator.vibrate(10); } catch (er) {} } else if (tx < 56 && G.hit) { G.hit = false; ic.classList.remove('hit'); }
      }
    }, { passive: true });
    var end = function (e, cancel) {
      if (!G || (e && e.pointerId !== G.id)) return; clearTimeout(G.lp); var g = G; G = null;
      if (g.mode === 'swipe') {
        var bw = g.row.querySelector('.ttc-bw'), ic = g.row.querySelector('.ttc-ri'); g.row.classList.remove('swiping'); bw.style.transform = ''; ic.style.opacity = ''; ic.style.transform = ''; ic.classList.remove('hit');
        host.__sup = Date.now();
        if (!cancel && g.hit) { var m = findMsg(g.row.dataset.cid); if (m) setReply(m); }
      } else if (g.mode === 'lp') host.__sup = Date.now();
    };
    host.addEventListener('pointerup', function (e) { end(e, false); }, { passive: true });
    host.addEventListener('pointercancel', function (e) { end(e, true); }, { passive: true });
    host.addEventListener('contextmenu', function (e) { var row = e.target.closest('.ttc-row'); if (row && row.dataset.cid) { e.preventDefault(); if (!G || G.mode !== 'lp') openMenu(row); } });
    host.addEventListener('click', function (e) {
      if (host.__sup && Date.now() - host.__sup < 350) { e.preventDefault(); e.stopPropagation(); return; }
      var t = e.target, el;
      if ((el = t.closest('.ttc-quote'))) { var q = el.dataset.q; if (q) jump(q); return; }
      if ((el = t.closest('.ttc-rx'))) { var r = el.closest('.ttc-row'); react(r.dataset.cid, el.dataset.rx); return; }
      if ((el = t.closest('[data-retry]'))) { retryChatMessage(el.dataset.retry); return; }
      if ((el = t.closest('[data-discard]'))) { discard(el.dataset.discard); return; }
      if ((el = t.closest('[data-ph]'))) { ttOpenChatPhoto(el.dataset.ph); return; }
      if ((el = t.closest('[data-fl]'))) { ttOpenChatFile(el.dataset.fl); return; }
      if (t.closest('#ttcOlder')) { loadOlder(); return; }
    });
    host.addEventListener('load', function (e) { if (e.target.tagName === 'IMG' && S.stick) host.scrollTop = host.scrollHeight; }, true);
    var sT = 0; host.addEventListener('scroll', function () {
      var now = Date.now(); if (now - sT < 90) return; sT = now;
      S.stick = near(host); paintPill(host); if (S.stick) scheduleRead(); if (host.scrollTop < 30 && !S.loadingOld && !S.noMoreOld && lastRows > 8 && !$('ttcOlder').hidden) loadOlder();
      updateBadge();
    }, { passive: true });
    // menu / sheet / composer: ONE delegated listener each
    document.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('#ttcMenu [data-mrx]'))) { var cid = S.menuCid; closeMenu(); if (cid) react(cid, b.dataset.mrx); return; }
      if ((b = t.closest('#ttcMenu [data-act]'))) {
        var cid2 = S.menuCid, m = cid2 ? findMsg(cid2) : null, a = b.dataset.act; closeMenu(); if (!m) return;
        if (a === 'reply') setReply(m); else if (a === 'copy') copyText(m); else if (a === 'edit') startEdit(m); else if (a === 'forward') sheetForward(m); else if (a === 'pin') togglePin(m);
        else if (a === 'info') sheetInfo(m); else if (a === 'del') sheetDelete(m); else if (a === 'retry') retryChatMessage(m.cid); else if (a === 'discard') discard(m.cid);
        return;
      }
      if ((b = t.closest('#ttcSheet [data-del]'))) { var sh = $('ttcSheet'), mm = findMsg(sh.dataset.cid); if (mm) doDelete(mm, b.dataset.del === 'all'); return; }
      if ((b = t.closest('#ttcSheet [data-fw]'))) {
        var txt = $('ttcSheet').dataset.fw; closeSheet();
        if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); return;
      }
      if (t.closest('#ttcSheet [data-sh="close"]')) { closeSheet(); return; }
      if (t.closest('#ttcReplyX')) { S.edit ? cancelEdit() : clearReply(); return; }
      if ((b = t.closest('#ttcMention [data-men]'))) { insertMention(b.dataset.men); return; }
      if ((b = t.closest('#ttcEmoji [data-em]'))) { var ta = input(), p = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p) + b.dataset.em + ta.value.slice(p); ta.selectionStart = ta.selectionEnd = p + b.dataset.em.length; autosize(); onTypingInput(); return; }
      if (t.closest('#ttcNew')) { var h = $('chatMessagesContainer'); h.scrollTo ? h.scrollTo({ top: h.scrollHeight, behavior: reduce.matches ? 'auto' : 'smooth' }) : (h.scrollTop = h.scrollHeight); S.newCount = 0; return; }
      if (t.closest('#ttcPin')) { var pb = $('ttcPin'); if (pb.dataset.cid) { jump(pb.dataset.cid); S.pinIdx++; setTimeout(paintPin, 300); } return; }
    });
    var ti = input();
    ti.addEventListener('input', function () { autosize(); onTypingInput(); mentionCheck(); });
    ti.addEventListener('blur', function () { typingSet(false); });
    ti.addEventListener('focus', function () { setTimeout(fit, 60); setTimeout(fit, 350); });
    ti.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); send(); }
      else if (e.key === 'Escape') { if (S.edit) cancelEdit(); else if (S.reply) clearReply(); }
    });
    var si = $('ttcSInput'); si.addEventListener('input', function () { clearTimeout(si.__t); si.__t = setTimeout(function () { S.q = si.value.trim(); S.mi = -1; render(); if (S.matches.length) gotoMatch(S.matches.length - 1); }, 160); });
    si.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); stepMatch(e.shiftKey ? -1 : 1); } });
    if (window.visualViewport) { visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', fit); }
    window.addEventListener('resize', fit); window.addEventListener('orientationchange', function () { setTimeout(fit, 250); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { stopHB(); typingSet(false); } else if (S.active) { startHB(); scheduleRead(); } });
  }
  function gotoMatch(i) { if (!S.matches.length) return; S.mi = (i + S.matches.length) % S.matches.length; paintMatches(); jump(S.matches[S.mi]); }
  function stepMatch(d) { if (S.matches.length) gotoMatch(S.mi + d); }
  function toggleSearch(on) {
    var bar = $('ttcSearch'); if (on === undefined) on = bar.hidden; bar.hidden = !on;
    if (on) { setTimeout(function () { $('ttcSInput').focus(); }, 30); } else { S.q = ''; S.matches = []; $('ttcSInput').value = ''; paintMatches(); render(); }
    fit();
  }

  /* ---------------- lifecycle ---------------- */
  function enter() {
    if (S.active) return; S.active = true; document.body.classList.add('tt-in-chat'); wire(); watch(); fit(); S.first = true; S.known = S.known || {}; render(); S.first = false;
    var host = $('chatMessagesContainer'); if (host) { host.scrollTop = host.scrollHeight; S.stick = true; }
    startHB(); paintHeader(); scheduleRead(); setTimeout(fit, 120);
  }
  function leave() {
    if (!S.active) return; S.active = false; document.body.classList.remove('tt-in-chat'); stopHB(); clearTimeout(S.readT); clearTimeout(S.typingT); clearTimeout(S.subT); typingSet(false); closeMenu(); closeSheet(); showEmoji(false); hideMention();
    var nav = document.querySelector('.nav-item'); nav = nav && nav.parentElement; if (nav) nav.classList.remove('ttc-hide'); updateBadge();
  }
  function hookTabs() {
    var o = window.switchTab; if (typeof o !== 'function' || o.__ttcHook) return;
    var w = function (tab) { var r = o.apply(this, arguments); try { if (tab === 'chat') enter(); else leave(); } catch (e) { console.warn('chat tab hook', e); } return r; };
    w.__ttcHook = true; w.__ttNavWrapped = o.__ttNavWrapped; window.switchTab = w; try { switchTab = w; } catch (e) {}
  }

  window.ttChat = {
    render: render, send: send, closeMenu: closeMenu, closeSheet: closeSheet, info: sheetTeam, toggleSearch: toggleSearch, step: stepMatch, toggleEmoji: function () { showEmoji(); },
    _S: S, _fmt: fmt, _unread: unread
  };
  function boot() { hookTabs(); wire(); watch(); updateBadge(); var n = 0, iv = setInterval(function () { watch(); updateBadge(); if (watching || ++n > 40) clearInterval(iv); }, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(hookTabs, 1800);
})();
