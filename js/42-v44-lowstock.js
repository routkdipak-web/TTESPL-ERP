/* TTESPL ERP v44.7 - LOW-STOCK ALERTS
   When an item's stock FALLS to its low level (or 0) the phone shows a warning and every staff phone gets a push notification.
   Only the moment of crossing alerts (no spam for items that were already low). Machines / catalog items are ignored.
   Turn off: Settings > Stock & Orders > Low-stock list switch (the same switch). The daily 9 am summary comes from the cloud function lowStockDaily. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var KEY = 'TTESPL_LOW_SEEN', tmr = null;
  function inv() { return (typeof sampleInventory !== 'undefined' && sampleInventory) || []; }
  function cs() { return window.cloudSync; }
  function flagOn() { try { var v = window.ttFeat && ttFeat.get('lowStock'); return !(v === 0 || v === false || v === '0'); } catch (e) { return true; } }
  function seenGet() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function seenSet(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }
  function state(i) {
    var s = Number(i.stock); if (!isFinite(s) || i.stock === '' || i.stock == null) return null;
    if (i.category === 'Catalog Equipment' || i.category === 'Machines & Equipment') return null;
    var lim = window.ttLowLimit ? ttLowLimit(i) : 5;
    return s <= 0 ? 'out' : (s <= lim ? 'low' : 'ok');
  }
  function hs(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(Math.abs(h)); }
  function check() {
    if (!flagOn() || !window.ttCloudInitialLoadDone) return;
    var now = {}, prev = seenGet(), fresh = [];
    inv().forEach(function (i) { if (!i || i.id == null) return; var st = state(i); if (st) now[i.id] = st; });
    if (prev) Object.keys(now).forEach(function (id) { if (now[id] !== 'ok' && prev[id] === 'ok') { var it = inv().filter(function (x) { return String(x.id) === String(id); })[0]; if (it) fresh.push({ id: id, st: now[id], it: it }); } });
    seenSet(now);
    if (!fresh.length) return;
    var line = fresh.slice(0, 6).map(function (f) { return f.it.name + (f.st === 'out' ? ' (OUT OF STOCK)' : ' (' + Number(f.it.stock) + ' left)'); }).join(', ') + (fresh.length > 6 ? ' +' + (fresh.length - 6) + ' more' : '');
    try { X.toast('⚠️ Low stock: ' + line, 1); } catch (e) {}
    try { if (typeof playAlertSound === 'function') playAlertSound(); } catch (e) {}
    var id = 'LOW-' + X.ymd() + '-' + hs(fresh.map(function (f) { return f.id + f.st; }).sort().join(','));
    try { if (cs() && cs().putPublic) cs().putPublic('app_notifications', id, { id: id, title: '⚠️ Low stock alert', body: line, type: 'stock', by: 'Stock alert', timestamp: Date.now() }); } catch (e) { console.warn('low alert', e); }
  }
  function sched() { clearTimeout(tmr); tmr = setTimeout(check, 3000); }
  function wrap() {
    var f = window.setStored; if (typeof f !== 'function' || f.__low) return;
    var w = function (k) { var r = f.apply(this, arguments); if (k === 'INVENTORY') sched(); return r; }; w.__low = 1;
    window.setStored = w; try { setStored = w; } catch (e) {}
  }
  wrap(); setTimeout(wrap, 1800); setTimeout(check, 26000);
  window.ttLowStockCheck = check;
})();
