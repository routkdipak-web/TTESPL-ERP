/* TTESPL ERP v43 - APPEARANCE (22): Auto / Light / Dark, dark style (Soft or True-black), accent colour.
   Only changes colours on this phone (saved in this phone's storage). No data or formulas are touched. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var K = 'TTESPL_APPEAR', ID = 'ttAppear';
  var DEF = { mode: 'manual', dark: 'std', accent: 'default', anim: true, smart: true };
  var ACC = { default: null, blue: '#2563EB', teal: '#0D9488', green: '#16A34A', orange: '#EA580C', purple: '#7C3AED', pink: '#DB2777', gold: '#CA8A04' };
  var NAMES = { default: 'Brand red', blue: 'Blue', teal: 'Teal', green: 'Green', orange: 'Orange', purple: 'Purple', pink: 'Pink', gold: 'Gold' };
  function get() { var c = {}; try { c = JSON.parse(localStorage.getItem(K) || '{}') || {}; } catch (e) {} return Object.assign({}, DEF, c); }
  function put(c) { try { localStorage.setItem(K, JSON.stringify(c)); } catch (e) {} window.TT_APPEAR = c; }
  window.ttAppear = get;
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hex(a) { return '#' + a.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function mix(h, to, w) { var a = rgb(h), b = rgb(to); return hex([a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w]); }
  var TABS = '#view-dashboard,#view-leads,#view-orders,#view-services,#view-inventory,#view-catalog,#view-billing,#view-chat';

  function css(c) {
    var s = '', X0 = ACC[c.accent];
    if (X0) {
      var r = rgb(X0).join(','), dk = mix(X0, '#000000', .22), lt = mix(X0, '#ffffff', .28), lt2 = mix(X0, '#ffffff', .5);
      s += 'html body[data-theme]{--accent:' + X0 + ';--accent-hover:' + dk + ';--cyan:' + X0 + ';--brand-red:' + X0 + ';--brand-red-dark:' + dk + ';--border-focus:' + X0 + ';--tt-red-soft:rgba(' + r + ',.09);--tt-red-ring:rgba(' + r + ',.28)}' +
        'html body[data-theme="dark"]{--accent:' + lt + ';--cyan:' + lt + ';--primary:' + lt + ';--primary-light:' + lt2 + ';--primary-dark:' + dk + ';--border-focus:' + lt + ';--tt-red-soft:rgba(' + r + ',.18);--tt-red-ring:rgba(' + r + ',.45)}' +
        'html body ' + TABS.split(',').join(',html body ') + '{--g-tint:' + r + '!important}';
    }
    /* dark styles */
    s += 'html body.tt-soft[data-theme="dark"]{--bg:#12151b;--pearl:#12151b;--card:#1b1f27;--surface:#1b1f27;--card-glass:#1b1f27;--card-glass-border:#2c323d;--border:#2c323d;--text-main:#dfe4ec;--text-primary:#dfe4ec;--text-muted:#a2adbd;--text-secondary:#a2adbd}' +
      'html body.tt-soft[data-theme="dark"] .card:not(.stat-card),html body.tt-soft[data-theme="dark"] .view-panel .card:not(.stat-card){background:#1b1f27!important;border-color:#2c323d!important;box-shadow:0 1px 2px rgba(0,0,0,.35)!important}' +
      'html body.tt-amoled[data-theme="dark"]{--bg:#000;--pearl:#000;--card:#0b0b0e;--surface:#0b0b0e;--card-glass:#0b0b0e;--card-glass-border:#1c1c22;--border:#1c1c22;--text-main:#eceff4;--text-primary:#eceff4}' +
      'html body.tt-amoled[data-theme="dark"],html body.tt-amoled[data-theme="dark"] .view-panel{background:#000!important}' +
      'html body.tt-amoled[data-theme="dark"] .card:not(.stat-card),html body.tt-amoled[data-theme="dark"] .view-panel .card:not(.stat-card){background:#0b0b0e!important;border-color:#1c1c22!important;box-shadow:none!important}';
    return s;
  }
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function setTheme(t) {
    var b = document.body; if (!b || b.getAttribute('data-theme') === t) return;
    b.setAttribute('data-theme', t); try { setStored('THEME_MODE', t); } catch (e) {} try { updateThemeMenuLabel(t); } catch (e) {}
  }
  function apply() {
    var c = get(); window.TT_APPEAR = c; var b = document.body; if (!b) return;
    if (c.mode === 'auto' && mq) setTheme(mq.matches ? 'dark' : 'light');
    b.classList.toggle('tt-soft', c.dark === 'soft'); b.classList.toggle('tt-amoled', c.dark === 'amoled');
    var st = document.getElementById('ttAppearCss'); if (!st) { st = document.createElement('style'); st.id = 'ttAppearCss'; document.head.appendChild(st); }
    st.textContent = css(c);
    try { var m = document.querySelector('meta[name=theme-color]'); if (m && ACC[c.accent] && b.getAttribute('data-theme') !== 'dark') m.setAttribute('content', ACC[c.accent]); } catch (e) {}
    document.dispatchEvent(new CustomEvent('tt-appear'));
  }
  window.ttApplyAppearance = apply;
  if (mq) (mq.addEventListener ? mq.addEventListener('change', function () { if (get().mode === 'auto') apply(); }) : mq.addListener(function () { if (get().mode === 'auto') apply(); }));
  var _tg = window.toggleThemeMode;
  if (typeof _tg === 'function' && !_tg.__ap) {
    var w = function () { var c = get(); if (c.mode === 'auto') { c.mode = 'manual'; put(c); } var r = _tg.apply(this, arguments); apply(); return r; }; w.__ap = 1; window.toggleThemeMode = w; try { toggleThemeMode = w; } catch (e) {}
  }
  function boot() { apply(); } document.addEventListener('DOMContentLoaded', boot); boot(); setTimeout(boot, 800); setTimeout(boot, 2500);

  function seg(key, val, items) { return '<div class="ttx-btns" style="flex-wrap:wrap">' + items.map(function (i) { return '<button type="button" class="ttx-b' + (i[0] === val ? ' pri' : '') + '" data-a="set" data-p="' + key + ':' + i[0] + '" style="flex:1 1 30%">' + i[1] + '</button>'; }).join('') + '</div>'; }
  function draw() {
    var c = get(), cur = document.body.getAttribute('data-theme') === 'dark';
    var sw = Object.keys(ACC).map(function (k) { var col = ACC[k] || '#E8212B'; return '<button type="button" data-a="set" data-p="accent:' + k + '" title="' + NAMES[k] + '" style="width:42px;height:42px;border-radius:50%;border:3px solid ' + (c.accent === k ? 'currentColor' : 'transparent') + ';background:' + col + ';cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)"></button>'; }).join('');
    var h = '<div class="ttx-note"><b>Theme</b></div>' + seg('mode', c.mode === 'auto' ? 'auto' : (cur ? 'dark' : 'light'), [['auto', '🌗 Auto (phone)'], ['light', '☀️ Light'], ['dark', '🌙 Dark']]) +
      '<div class="ttx-note" style="margin-top:12px"><b>Dark style</b> <small>(when dark)</small></div>' + seg('dark', c.dark, [['std', 'Standard'], ['soft', '😌 Soft'], ['amoled', '⚫ True black']]) +
      '<div class="ttx-note" style="margin-top:12px"><b>Accent colour</b> <small>· ' + NAMES[c.accent] + '</small></div><div style="display:flex;flex-wrap:wrap;gap:10px;padding:4px 2px">' + sw + '</div>' +
      '<div class="ttx-note" style="margin-top:12px"><b>Home screen</b></div>' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin:6px 0"><input type="checkbox" data-c="smart" ' + (c.smart ? 'checked' : '') + ' style="width:auto"> Show “Today” smart cards &amp; sparkline</label>' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;margin:6px 0"><input type="checkbox" data-c="anim" ' + (c.anim ? 'checked' : '') + ' style="width:auto"> Animated numbers (count-up)</label>' +
      '<div class="ttx-note" style="font-size:11.5px;opacity:.8;margin-top:10px">Saved on this phone only. Some small details may keep the brand colour.</div>' +
      '<div class="ttx-btns"><button class="ttx-b" data-a="reset">↺ Reset to default</button></div>';
    X.sheet(ID, '🎨 Appearance', h, { z: 3900 });
    X.bind(ID, {
      click: {
        set: function (p) {
          var a = p.split(':'), k = a[0], v = a[1], c = get();
          if (k === 'mode') { if (v === 'auto') c.mode = 'auto'; else { c.mode = 'manual'; put(c); setTheme(v); } }
          else c[k] = v;
          put(c); apply(); draw();
        },
        reset: function () { put(Object.assign({}, DEF)); apply(); draw(); }
      },
      change: { smart: function (v, el) { var c = get(); c.smart = !!el.checked; put(c); apply(); }, anim: function (v, el) { var c = get(); c.anim = !!el.checked; put(c); apply(); } }
    });
  }
  window.ttOpenAppearance = draw;

  function inject() {
    try {
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt43-ap')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt43-ap'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenAppearance(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>🎨</span><span>Appearance</span></div><span style="font-size:10px;color:#38bdf8;">Theme · Accent</span>';
        list.appendChild(d);
      }
    } catch (e) {}
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);
})();
