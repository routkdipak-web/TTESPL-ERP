/* TTESPL ERP v44.9 - CONTROL CENTER + LIVE ACTIVITY PILL
   - Tap the green "Live" chip in the header -> glass Control Center (quick switches, shortcuts, recent activity).
   - A small pill appears under the header while something runs in the background (offline / saving to cloud / pending sync / backup / store update)
     and morphs open when tapped. Other code can use:  ttActivity.start(id,{icon,label,sub})  /  ttActivity.update(id,{...})  /  ttActivity.end(id)
   - Battery: no animation frames, no polling; a 1-second clock runs ONLY while the pill is visible and the screen is on.
   - Lite mode (auto on weak phones, or the switch in the panel) removes blur. */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function feat(k) { try { return window.ttFeat ? ttFeat.get(k) : 1; } catch (e) { return 1; } }
  function isAdm() { try { return !!(window.ttx && ttx.isAdm()); } catch (e) { return false; } }

  /* ---------- lite mode ---------- */
  function weak() { try { return (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4); } catch (e) { return false; } }
  function lite() { var v = ls('TTESPL_CP_LITE'); return v === '1' || (v == null && weak()); }
  function applyLite() { document.body.classList.toggle('cp-lite', lite()); }
  applyLite();

  /* ---------- activities ---------- */
  var ACT = {}, LOG = [], tick = null;
  function fmtT(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; }
  window.ttActivity = {
    start: function (id, o) { if (!ACT[id]) ACT[id] = Object.assign({ id: id, t0: Date.now(), icon: '⏳', label: id, sub: '' }, o || {}); else Object.assign(ACT[id], o || {}); renderIsl(); },
    update: function (id, o) { if (ACT[id]) { Object.assign(ACT[id], o || {}); renderIsl(); } },
    end: function (id, o) { var a = ACT[id]; if (!a) return; delete ACT[id]; LOG.unshift({ icon: a.icon, label: (o && o.label) || a.label, at: Date.now(), ms: Date.now() - a.t0 }); LOG.length = Math.min(LOG.length, 6); renderIsl(true); if (ST.open) renderPanel(); },
    list: function () { return Object.keys(ACT).map(function (k) { return ACT[k]; }); }
  };

  /* ---------- the pill ---------- */
  var isl = document.createElement('div'); isl.className = 'cpi'; isl.id = 'ttIsl'; isl.setAttribute('role', 'status'); isl.setAttribute('aria-live', 'polite');
  isl.innerHTML = '<div class="cpi-c"></div><div class="cpi-bar"><i></i></div><div class="cpi-x"></div>';
  var C = isl.children[0], X = isl.children[2];
  var ST = { open: false, x: false, hideT: 0 };
  function place() { try { var h = document.querySelector('header'); var b = h ? h.getBoundingClientRect().bottom : 70; isl.style.setProperty('--cpi-top', Math.round(b + 6) + 'px'); } catch (e) {} }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function startTick() { if (tick || document.hidden) return; tick = setInterval(function () { if (document.hidden) return stopTick(); drawX(); }, 1000); }
  function drawX() {
    var l = window.ttActivity.list(); if (!ST.x) return;
    X.innerHTML = '<h4><span>Running now</span><span style="opacity:.6;font-weight:600">' + l.length + '</span></h4>' +
      (l.length ? l.map(function (a) { return '<div class="r"><span style="font-size:18px">' + H(a.icon) + '</span><span><b>' + H(a.label) + '</b>' + (a.sub ? '<small>' + H(a.sub) + '</small>' : '') + '</span><span class="e">' + fmtT(Date.now() - a.t0) + '</span></div>'; }).join('') : '<div class="r"><span style="font-size:18px">✅</span><span><b>All done</b></span></div>') +
      '<div class="bt"><button class="p" data-a="panel">Open Control Center</button><button data-a="close">Close</button></div>';
    isl.style.height = X.scrollHeight + 'px';
  }
  function renderIsl(ended) {
    place(); var l = window.ttActivity.list(), n = l.length;
    clearTimeout(ST.hideT);
    if (n) {
      var a = l[l.length - 1]; isl.classList.remove('done');
      C.innerHTML = '<span style="font-size:15px">' + H(a.icon) + '</span><span class="t">' + H(a.label) + '</span>' + (n > 1 ? '<span class="n">+' + (n - 1) + '</span>' : '');
      isl.classList.add('on'); if (!ST.x) { isl.classList.add('c'); isl.style.height = ''; }
      if (ST.x) drawX(); startTick();
    } else if (ended && isl.classList.contains('on')) {
      isl.classList.add('done'); C.innerHTML = '<span style="font-size:15px">✅</span><span class="t">All done</span>'; stopTick();
      if (ST.x) drawX(); else ST.hideT = setTimeout(hideIsl, 1800);
    } else if (!ST.x) hideIsl();
  }
  function hideIsl() { isl.classList.remove('on', 'c', 'x', 'done'); isl.style.height = ''; ST.x = false; isl.setAttribute('aria-expanded', 'false'); stopTick(); }
  function toggleX(force) {
    ST.x = force != null ? force : !ST.x; clearTimeout(ST.hideT);
    isl.classList.toggle('x', ST.x); isl.classList.toggle('c', !ST.x && isl.classList.contains('on')); isl.setAttribute('aria-expanded', ST.x ? 'true' : 'false');
    if (ST.x) { drawX(); startTick(); try { navigator.vibrate && feat('haptic') && navigator.vibrate(8); } catch (e) {} } else { isl.style.height = ''; if (!window.ttActivity.list().length) ST.hideT = setTimeout(hideIsl, 600); }
  }
  isl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]');
    if (b) { var a = b.getAttribute('data-a'); if (a === 'panel') { toggleX(false); openPanel(); } else toggleX(false); return; }
    toggleX();
  });
  document.addEventListener('click', function (e) { if (ST.x && !isl.contains(e.target)) toggleX(false); }, true);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopTick(); else if (window.ttActivity.list().length) startTick(); });
  window.addEventListener('resize', place);

  /* ---------- the Control Center ---------- */
  var cp = document.createElement('div'); cp.className = 'cp'; cp.id = 'ttCP'; cp.setAttribute('aria-hidden', 'true');
  cp.innerHTML = '<div class="cp-scrim" data-a="close"></div><div class="cp-panel" role="dialog" aria-modal="true" aria-label="Control Center"></div>';
  var P = cp.children[1];
  function tile(id, icon, title, sub, on, badge) { return '<button class="cp-t' + (on ? ' on' : '') + '" data-t="' + id + '"><i>' + icon + '</i><span>' + H(title) + '<small>' + H(sub) + '</small></span>' + (badge ? '<span class="bd">' + badge + '</span>' : '') + '</button>'; }
  function quick(id, icon, title, badge) { return '<button class="cp-t" data-q="' + id + '"><i>' + icon + '</i><span>' + H(title) + '</span>' + (badge ? '<span class="bd">' + badge + '</span>' : '') + '</button>'; }
  function ago(ts) { var m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; }
  function renderPanel() {
    var u = (typeof currentUser !== 'undefined' && currentUser) || {}, dark = document.body.getAttribute('data-theme') === 'dark', online = navigator.onLine !== false, perm = (window.Notification && Notification.permission) || 'denied';
    var standalone = false; try { standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) {}
    var pend = 0; try { pend = window.ttShopPending ? ttShopPending() : 0; } catch (e) {}
    var lastBk = ls('TTESPL_AUTOBK_LAST'), now = new Date();
    var h = '<div class="cp-hd"><div class="cp-av">' + H(String(u.name || 'U').charAt(0).toUpperCase()) + '</div><div><b>' + H(u.name || 'Guest') + '</b><small>' + H(u.role || '') + ' · ' + (online ? '🟢 Online' : '🔴 Offline') + ' · ' + now.toLocaleDateString('en-GB') + '</small></div><button class="cp-x" data-a="close" aria-label="Close">✕</button></div>';
    h += '<div class="cp-sec">Quick switches</div><div class="cp-g">' +
      tile('dark', dark ? '🌙' : '☀️', 'Dark mode', dark ? 'On' : 'Off', dark) +
      tile('sound', '🔊', 'Sounds', feat('sound') ? 'On' : 'Off', !!feat('sound')) +
      tile('haptic', '📳', 'Vibration', feat('haptic') ? 'On' : 'Off', !!feat('haptic')) +
      tile('notif', '🔔', 'Notifications', perm === 'granted' ? 'On' : perm === 'denied' ? 'Blocked' : 'Tap to allow', perm === 'granted') +
      (isAdm() ? tile('autobk', '💾', 'Auto backup', ls('TTESPL_AUTOBK_ON') === '0' ? 'Off' : 'Daily', ls('TTESPL_AUTOBK_ON') !== '0') : '') +
      tile('low', '⚠️', 'Low-stock alerts', feat('lowStock') ? 'On' : 'Off', !!feat('lowStock')) +
      tile('lite', '⚡', 'Lite mode', lite() ? 'No blur · faster' : 'Glass effects', lite()) +
      (!standalone ? tile('install', '📲', 'Install app', 'Add to home screen', false) : '') +
      tile('refresh', '🔄', 'Refresh data', 'Reload app', false) + '</div>';
    h += '<div class="cp-sec">Shortcuts</div><div class="cp-q">' + quick('search', '🔍', 'Search') + quick('orders', '📦', 'Orders') + quick('leads', '🎯', 'Leads') + quick('stock', '🏷️', 'Stock') +
      quick('services', '🛠️', 'Services') + quick('ledger', '💲', 'Ledger') + quick('sync', '☁️', 'Sync') + quick('online', '🛒', 'Online', pend || '') + (isAdm() ? quick('backup', '💾', 'Backups') : '') + quick('acct', '🔑', 'My account') + '</div>';
    var rows = window.ttActivity.list().map(function (a) { return '<div><span>' + H(a.icon) + '</span><b>' + H(a.label) + '</b><span class="e">running · ' + fmtT(Date.now() - a.t0) + '</span></div>'; }).concat(LOG.slice(0, 4).map(function (a) { return '<div><span>' + H(a.icon) + '</span><span>' + H(a.label) + '</span><span class="e">✓ ' + ago(a.at) + '</span></div>'; }));
    h += '<div class="cp-sec">Activity</div><div class="cp-act">' + (rows.length ? rows.join('') : '<div><span>✨</span><span>Nothing running. All synced.</span></div>') + '</div>';
    h += '<div class="cp-ft"><span>' + (lastBk ? 'Last auto backup ' + ago(new Date(lastBk).getTime()) : 'No auto backup yet') + '</span><span>v44.9</span></div>';
    P.innerHTML = h;
  }
  function openPanel() {
    if (ST.open) return; ST.open = true; toggleX(false); renderPanel(); applyLite();
    cp.classList.add('on'); cp.setAttribute('aria-hidden', 'false'); try { window.triggerAppHaptic && triggerAppHaptic(); } catch (e) {}
    var f = P.querySelector('.cp-x'); try { f && f.focus({ preventScroll: true }); } catch (e) {}
  }
  function closePanel() { if (!ST.open) return; ST.open = false; cp.classList.remove('on'); cp.setAttribute('aria-hidden', 'true'); }
  window.ttOpenControlCenter = openPanel; window.ttCloseControlCenter = closePanel;
  function go(fn) { closePanel(); setTimeout(function () { try { fn(); } catch (e) { console.warn(e); } }, 120); }
  function tab(name, idx) { go(function () { switchTab(name, document.querySelectorAll('.nav-item')[idx]); }); }
  var TILE = {
    dark: function () { toggleThemeMode(); },
    sound: function () { ttFeat.set('sound', feat('sound') ? 0 : 1); },
    haptic: function () { ttFeat.set('haptic', feat('haptic') ? 0 : 1); },
    low: function () { ttFeat.set('lowStock', feat('lowStock') ? 0 : 1); },
    autobk: function () { ls('TTESPL_AUTOBK_ON', ls('TTESPL_AUTOBK_ON') === '0' ? '1' : '0'); },
    lite: function () { ls('TTESPL_CP_LITE', lite() ? '0' : '1'); applyLite(); },
    notif: function () { if (window.Notification && Notification.permission === 'default') requestAppSystemPermissions(); else if (window.Notification && Notification.permission === 'denied') alert('Notifications are blocked. Allow them in the phone browser / app settings.'); },
    install: function () { go(function () { window.ttInstallApp && ttInstallApp(); }); },
    refresh: function () { go(function () { location.reload(); }); }
  };
  var QUICK = {
    search: function () { go(function () { openGlobalSearchModal(); }); }, orders: function () { tab('orders', 2); }, leads: function () { tab('leads', 1); }, stock: function () { tab('inventory', 4); }, ledger: function () { tab('billing', 5); },
    online: function () { go(function () { ttOpenOnline(); }); }, sync: function () { go(openSyncStatus); }, services: function () { tab('services', 3); }, backup: function () { go(function () { ttOpenBackupCentre(); }); }, acct: function () { go(function () { ttOpenMyAccount(); }); }
  };
  cp.addEventListener('click', function (e) {
    var t = e.target.closest('[data-t],[data-q],[data-a]'); if (!t) return;
    if (t.hasAttribute('data-a')) return closePanel();
    try { window.triggerAppHaptic && triggerAppHaptic(); } catch (x) {}
    if (t.hasAttribute('data-t')) { var f = TILE[t.getAttribute('data-t')]; if (f) { f(); if (ST.open) renderPanel(); } }
    else { var q = QUICK[t.getAttribute('data-q')]; if (q) q(); }
  });
  /* swipe up on the panel to close */
  var y0 = null; P.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
  P.addEventListener('touchend', function (e) { if (y0 != null && P.scrollTop <= 0 && y0 - e.changedTouches[0].clientY > 70) closePanel(); y0 = null; }, { passive: true });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePanel(); toggleX(false); } });

  /* ---------- open from the header chip ---------- */
  /* window-level capture runs before the older "Sync Status" handler, so the chip now opens the Control Center; Sync Status stays available as a shortcut inside it */
  var bypass = false;
  window.addEventListener('click', function (e) {
    if (bypass || !e.target || !e.target.closest) return;
    var chip = e.target.closest('.tt-live-pill'); if (!chip) return;
    e.stopImmediatePropagation(); e.preventDefault(); openPanel();
  }, true);
  function openSyncStatus() { var chip = document.querySelector('.tt-live-pill'); if (!chip) return; bypass = true; try { chip.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } finally { bypass = false; } }
  function wireChip() { var chip = document.querySelector('.tt-live-pill'); if (chip && !chip.__cp) { chip.__cp = 1; chip.setAttribute('role', 'button'); chip.setAttribute('aria-label', 'Open Control Center'); } }

  /* ---------- built-in activities: connection / cloud saving / pending sync (event driven, no polling) ---------- */
  function syncState() {
    var t = $('syncText'), d = $('syncDot'), q = $('offlineQueueBadge');
    var dotOff = !!(d && d.classList.contains('offline'));
    if (dotOff && !offSince) { offSince = Date.now(); setTimeout(syncState, 6200); } if (!dotOff) offSince = 0;
    var off = navigator.onLine === false || (dotOff && Date.now() - offSince > 6000);   /* the cloud needs a few seconds to connect at start-up: not "offline" yet */
    var saving = t && /saving/i.test(t.textContent || '');
    var pend = q && q.style.display !== 'none' ? (parseInt(String(q.textContent).replace(/\D/g, ''), 10) || 0) : 0;
    var A = window.ttActivity;
    if (off) A.start('net', { icon: '📡', label: 'Offline – saved on phone', sub: 'Will sync when internet is back' }); else if (ACT.net) A.end('net');
    if (saving) A.start('sync', { icon: '☁️', label: 'Saving to cloud' }); else if (ACT.sync) A.end('sync');
    if (pend && !off) A.start('queue', { icon: '⏳', label: pend + ' change' + (pend > 1 ? 's' : '') + ' waiting to sync' }); else if (ACT.queue) A.end('queue');
    if (!pend && ACT.queue) A.end('queue');
  }
  var offSince = 0, syncT = null; function syncSoon() { clearTimeout(syncT); syncT = setTimeout(syncState, 250); }
  function boot() {
    document.body.appendChild(isl); document.body.appendChild(cp); wireChip(); place();
    try {
      var mo = new MutationObserver(syncSoon), t = $('syncText'), d = $('syncDot'), q = $('offlineQueueBadge');
      if (t) mo.observe(t, { childList: true, characterData: true, subtree: true }); if (d) mo.observe(d, { attributes: true, attributeFilter: ['class'] }); if (q) mo.observe(q, { attributes: true, attributeFilter: ['style'], childList: true, characterData: true, subtree: true });
    } catch (e) {}
    window.addEventListener('online', syncSoon); window.addEventListener('offline', syncSoon); setTimeout(syncState, 4000);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
  setTimeout(wireChip, 1500); setTimeout(wireChip, 5000);
})();
