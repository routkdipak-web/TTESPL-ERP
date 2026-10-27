/* TTESPL ERP v43.4 - PULL TO REFRESH, the Chrome way
   - A LONG pull from the very top is needed (a small drag or normal scrolling never refreshes).
   - On a normal page (Leads, Orders, Services, Stock, Catalog, Ledger, Chat) only THAT page is refreshed.
   - On Home the whole app is refreshed (reloaded).
   - The browser's own pull-to-refresh is blocked while pulling, so the app can no longer reload by itself on a small drag. */
(function () {
  'use strict';
  window.TT_DISABLE_PTR = true;   /* switches the old gesture code off */
  var FULL = 150, startY = 0, startX = 0, pulling = false, ready = false, lastScroll = 0, busy = false, dragging = false;
  function $(i) { return document.getElementById(i); }
  function ind() { return $('ttPullRefreshIndicator'); }
  function root() { return document.scrollingElement || document.documentElement; }
  function activeView() { return document.querySelector('.view-panel.active'); }
  function blocked(el) {   /* touches inside sheets, menus, inputs, maps, horizontal strips never start a pull */
    return !!(el && el.closest && el.closest('.auth-overlay,.ttx-ov,.tt-sheet-card,.tt41-ov,.filter-floating-modal,.profile-dropdown-card,#ttPullRefreshIndicator,input,textarea,select,canvas,iframe,[contenteditable],.tt43-sc,#tt43Smart,.sub-tabs'));
  }
  function scrollerAt(el) {
    var v = activeView();
    while (el && el !== document.body && el !== document.documentElement) {
      var cs; try { cs = getComputedStyle(el); } catch (e) { break; }
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) return el;
      el = el.parentElement;
    }
    return v && v.scrollHeight > v.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(v).overflowY) ? v : root();
  }
  function atTop(sc) { var b = document.body; return (sc.scrollTop || 0) <= 0 && root().scrollTop <= 0 && (!b || (b.scrollTop || 0) <= 0) && (!activeView() || activeView().scrollTop <= 0); }
  window.addEventListener('scroll', function () { lastScroll = Date.now(); }, { passive: true, capture: true });

  function show(dist, over) {
    var el = ind(); if (!el) return;
    el.classList.add('visible'); el.style.transform = 'translate(-50%,' + (-70 + Math.min(dist, 110)) + 'px)';
    var i = $('ttPullRefreshIcon'), l = $('ttPullRefreshLabel');
    if (i) i.style.transform = over ? 'rotate(180deg)' : 'rotate(0deg)';
    if (l) { var home = isHome(); l.textContent = over ? (home ? 'Release to refresh the app' : 'Release to refresh this page') : (home ? 'Pull down to refresh the app' : 'Pull down to refresh this page'); }
  }
  function hide() { var el = ind(); if (el) { el.classList.remove('visible', 'spinning'); el.style.transform = 'translate(-50%,-70px)'; } }
  function isHome() { var v = activeView(); return !v || v.id === 'view-dashboard'; }

  document.addEventListener('touchstart', function (e) {
    pulling = false; ready = false; dragging = false;
    if (busy || !e.touches || e.touches.length !== 1 || blocked(e.target)) return;
    var sc = scrollerAt(e.target);
    if (!atTop(sc) || Date.now() - lastScroll < 250) return;   /* must be fully at the top and the scroll must have stopped */
    startY = e.touches[0].clientY; startX = e.touches[0].clientX; pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!pulling || !e.touches || e.touches.length !== 1) return;
    var dy = e.touches[0].clientY - startY, dx = e.touches[0].clientX - startX;
    if (!dragging) {
      if (dy < 0 || Math.abs(dx) > Math.abs(dy)) { pulling = false; return; }   /* upward or sideways: not a pull */
      if (dy < 12) return;   /* tiny movement: ignore */
      dragging = true;
    }
    if (!atTop(scrollerAt(e.target))) { pulling = false; dragging = false; hide(); return; }
    if (e.cancelable) e.preventDefault();   /* stops Chrome's own reload gesture */
    ready = dy >= FULL;
    show(dy * 0.55, ready);
  }, { passive: false });

  document.addEventListener('touchend', function () {
    if (!pulling) return; var go = ready && dragging; pulling = false; dragging = false; ready = false;
    if (go) run(); else hide();
  }, { passive: true });
  document.addEventListener('touchcancel', function () { pulling = false; dragging = false; ready = false; hide(); }, { passive: true });

  function call(n) { try { var f = window[n]; if (typeof f === 'function') { f(); return true; } } catch (e) { console.warn('refresh ' + n, e); } return false; }
  function refreshPage(id) {
    var ok = false;
    switch (id) {
      case 'view-leads': ok = call('renderLeads'); break;
      case 'view-orders': ok = call('renderOrders'); break;
      case 'view-services': ok = call('renderServices'); break;
      case 'view-inventory': ok = call('renderStockList'); break;
      case 'view-billing': try { renderBilling('all'); ok = true; } catch (e) {} break;
      case 'view-chat': ok = call('renderChatMessages'); break;
      case 'view-catalog': ok = call('ttRenderCatalogIfOpen') || call('renderCatalog') || call('renderProductCatalog'); break;
    }
    if (!ok) call('refreshAllData');
  }
  function run() {
    busy = true; var el = ind(), l = $('ttPullRefreshLabel'), home = isHome(), v = activeView();
    if (el) { el.classList.add('visible', 'spinning'); el.style.transform = 'translate(-50%,10px)'; }
    if (l) l.textContent = home ? 'Refreshing the app…' : 'Refreshing this page…';
    try { triggerAppHaptic(); } catch (e) {}
    try { ttFlushOfflineQueue(); } catch (e) {}
    setTimeout(function () {
      if (home) { try { location.reload(); } catch (e) { call('refreshAllData'); } return; }   /* Home: the whole app, like Chrome */
      refreshPage(v ? v.id : '');
      if (l) l.textContent = 'Updated';
      setTimeout(function () { hide(); busy = false; }, 700);
    }, 450);
    setTimeout(function () { busy = false; }, 6000);
  }
  window.ttPullRefreshNow = run;
})();
