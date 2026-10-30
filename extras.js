/* TTESPL v44.7 - (1) Google Analytics for Firebase  (2) "Install app" button. Shared by the ERP (index.html) and the customer store (shop.html).
   Analytics never receives names, phone numbers or addresses - only anonymous events (page seen, product viewed, order placed with its total).
   Turn analytics off on a device: add  ?noga=1  to the address once (turn on again: ?noga=0). */
(function (g) {
  'use strict';
  var MID = 'G-HGJFN4G1MV', isShop = /shop\.html/i.test(location.pathname) || /[?&]shop/.test(location.search);
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  try { var m = /[?&]noga=(\d)/.exec(location.search); if (m) ls('TTESPL_NOGA', m[1] === '1' ? '1' : '0'); } catch (e) {}
  var gaOn = ls('TTESPL_NOGA') !== '1' && location.protocol.indexOf('http') === 0;

  /* ---------- analytics ---------- */
  g.dataLayer = g.dataLayer || [];
  function gtag() { g.dataLayer.push(arguments); }
  if (gaOn) {
    gtag('js', new Date()); gtag('config', MID, { app_name: isShop ? 'TTESPL Shop' : 'TTESPL ERP', anonymize_ip: true, send_page_view: true });
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MID; s.onerror = function () {}; document.head.appendChild(s);
  }
  g.ttTrack = function (name, params) { if (!gaOn) return; try { gtag('event', name, params || {}); } catch (e) {} };

  /* ERP: which screens are used (anonymous) */
  if (!isShop) { var wt = function () { var f = g.switchTab; if (typeof f !== 'function' || f.__ga) return; var w = function (t) { try { g.ttTrack('screen_view', { screen_name: String(t || '').slice(0, 30) }); } catch (e) {} return f.apply(this, arguments); }; w.__ga = 1; g.switchTab = w; try { switchTab = w; } catch (e) {} }; setTimeout(wt, 1500); }

  /* ---------- install app ---------- */
  var dp = null, pill = null, SNZ = 'TTESPL_INSTALL_SNOOZE';
  function standalone() { try { return (g.matchMedia && g.matchMedia('(display-mode: standalone)').matches) || g.navigator.standalone === true; } catch (e) { return false; } }
  function snoozed() { var t = Number(ls(SNZ) || 0); return t && Date.now() - t < 7 * 86400000; }
  function iOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent); }
  function hide() { if (pill) { pill.remove(); pill = null; } }
  function show() {
    if (pill || standalone() || snoozed() || !document.body) return;
    pill = document.createElement('div'); pill.setAttribute('role', 'dialog');
    pill.style.cssText = 'position:fixed;left:12px;bottom:' + (isShop ? '86' : '92') + 'px;z-index:2147483000;display:flex;align-items:center;gap:6px;background:#0b2a4a;color:#fff;border-radius:999px;padding:6px 6px 6px 14px;box-shadow:0 8px 24px rgba(0,0,0,.35);font:700 13.5px system-ui,sans-serif;max-width:calc(100vw - 90px)';
    pill.innerHTML = '<span id="ttInst" style="cursor:pointer;white-space:nowrap">📲 Install app</span><button aria-label="Not now" style="border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:50%;width:26px;height:26px;font-size:13px;cursor:pointer">✕</button>';
    pill.firstChild.onclick = function () { g.ttInstallApp(); };
    pill.lastChild.onclick = function () { ls(SNZ, String(Date.now())); hide(); };
    document.body.appendChild(pill);
  }
  g.ttInstallApp = function () {
    if (dp) { var p = dp; dp = null; p.prompt(); (p.userChoice || Promise.resolve({})).then(function (c) { g.ttTrack('install_prompt', { outcome: (c && c.outcome) || '' }); if (c && c.outcome === 'accepted') hide(); }); return; }
    var msg = iOS() ? 'To install: tap the Share button (square with an arrow) in Safari, then “Add to Home Screen”.' : 'To install: open the browser menu (⋮) and tap “Install app” or “Add to Home screen”.';
    alert(msg);
  };
  g.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); dp = e; show(); });
  g.addEventListener('appinstalled', function () { hide(); g.ttTrack('app_installed'); });
  /* iPhone Safari never fires the event: show the how-to pill once a week */
  setTimeout(function () { if (iOS() && !standalone()) show(); }, 6000);
})(window);
