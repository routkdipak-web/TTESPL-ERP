/* Top-level helper functions that other modules call while loading (kept first so load order works). */

/* v41: LOCAL calendar date (YYYY-MM-DD). Old code used toISOString() which is UTC, so between 12:00am and 5:30am IST the date was yesterday. */
function ttYmd(d) {
  d = d ? new Date(d) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}
window.ttYmd = ttYmd;


function openQuotationModal() {
  openQuotationModalBase();
  var e = document.getElementById('quotEditId');
  if (e) e.value = '';
  ttUpdateQuotSerialLabel();
}

/* v41: low-stock limit of ONE item = its own "Minimum stock" if set, else the global Low-stock level from Settings (the Stock cards used a fixed 5 before). */
function ttLowLimit(item) {
  var own = item && Number(item.minStock); if (own > 0) return own;
  var g = 5; try { g = Number(window.ttFeat && ttFeat.get('lowThreshold')) || 5; } catch (e) {}
  return g;
}
window.ttLowLimit = ttLowLimit;

/* v41: find the stock item of a bill line: by id first, then by exact name (the old code matched "id OR name", which could pick another item that has the same name) */
function ttFindStock(it) {
  var inv = (typeof sampleInventory !== 'undefined' && Array.isArray(sampleInventory)) ? sampleInventory : [];
  if (!it) return null;
  if (it.id != null) { for (var i = 0; i < inv.length; i++) if (String(inv[i].id) === String(it.id)) return inv[i]; }
  var nm = String(it.name || '').trim().toLowerCase(); if (!nm) return null;
  for (var j = 0; j < inv.length; j++) if (String(inv[j].name || '').trim().toLowerCase() === nm) return inv[j];
  return null;
}
window.ttFindStock = ttFindStock;

/* v42.2: encodeURIComponent leaves ' ! ( ) * untouched, which breaks inline onclick strings (e.g. customer "Gugu's Auto"). Use this inside inline handlers. */
function ttEnc(s) { return encodeURIComponent(s).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); }
window.ttEnc = ttEnc;
