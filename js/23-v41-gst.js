/* TTESPL ERP v41 - GST % PER ITEM + TAX TABLE (new order)
   Every item row in a new order has a GST % box (18 by default). Change it for an item that has another rate (cloth 5%, etc.).
   Under the items a small tax table shows taxable value, CGST+SGST (or IGST) for every rate. Prices stay GST-inclusive like before.
   Switch: Settings > Invoice & GST > "GST % for every item in an order". */
(function () {
  'use strict';
  var V = window.ttV41; if (!V) return;
  var $ = function (id) { return document.getElementById(id); };
  var F = V.F, N = function (x) { return Number(x) || 0; };
  var inr = function (n) { return N(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function applyFlag() { document.documentElement.classList.toggle('tt41-nogst', !F('gstRowTax')); }
  applyFlag();
  var oSet = window.ttSetOpt;
  window.ttSetOpt = function (k, v) { var r = oSet ? oSet.apply(this, arguments) : undefined; if (k === 'gstRowTax') { applyFlag(); taxTable(); } return r; };

  function inject() {
    var btn = document.querySelector('#orderModal button[onclick*="addOrderItemRow()"]'); if (!btn || $('tt41TaxBox')) return;
    var box = document.createElement('div'); box.id = 'tt41TaxBox'; box.className = 'tt41-tax';
    btn.parentNode.insertBefore(box, btn.nextSibling);
  }
  function rows() {
    var out = [];
    document.querySelectorAll('#orderItemsTbody tr').forEach(function (r) {
      var t = parseFloat(String((r.querySelector('.item-row-total') || {}).textContent || '').replace(/[^\d.]/g, '')) || 0, g = parseFloat((r.querySelector('.item-gst') || {}).value);
      if (t > 0) out.push({ t: t, g: isNaN(g) ? 18 : Math.min(40, Math.max(0, g)) });
    });
    return out;
  }
  function taxTable() {
    inject(); var box = $('tt41TaxBox'); if (!box) return;
    if (!F('gstRowTax')) { box.innerHTML = ''; return; }
    var rs = rows(); if (!rs.length) { box.innerHTML = ''; return; }
    var inter = (($('ordTaxType') || {}).value) === 'INTER', by = {}, T = { tv: 0, tax: 0, tot: 0 };
    rs.forEach(function (x) { var k = String(x.g), tv = x.t / (1 + x.g / 100), tx = x.t - tv; by[k] = by[k] || { g: x.g, tv: 0, tax: 0, tot: 0 }; by[k].tv += tv; by[k].tax += tx; by[k].tot += x.t; T.tv += tv; T.tax += tx; T.tot += x.t; });
    var keys = Object.keys(by).sort(function (a, b) { return a - b; });
    box.innerHTML = '<div class="tt41-tax-h"><b>🧾 GST table</b><span>prices include GST</span></div>' +
      '<div class="tt41-tax-all"><label>Set GST % for all items</label><div><input type="number" id="tt41TaxAll" list="tt41GstList" min="0" max="40" step="any" inputmode="decimal" placeholder="18"><button type="button" class="btn btn-outline btn-sm" onclick="ttTaxApplyAll()">Apply</button></div></div>' +
      '<div class="tt41-tax-w"><table><tr><th>GST</th><th>Taxable ₹</th>' + (inter ? '<th>IGST ₹</th>' : '<th>CGST ₹</th><th>SGST ₹</th>') + '<th>Total ₹</th></tr>' +
      keys.map(function (k) { var b = by[k]; return '<tr><td>' + b.g + '%</td><td>' + inr(b.tv) + '</td>' + (inter ? '<td>' + inr(b.tax) + '</td>' : '<td>' + inr(b.tax / 2) + '</td><td>' + inr(b.tax / 2) + '</td>') + '<td>' + inr(b.tot) + '</td></tr>'; }).join('') +
      '<tr class="t"><td>Total</td><td>' + inr(T.tv) + '</td>' + (inter ? '<td>' + inr(T.tax) + '</td>' : '<td>' + inr(T.tax / 2) + '</td><td>' + inr(T.tax / 2) + '</td>') + '<td>' + inr(T.tot) + '</td></tr></table></div>';
  }
  window.ttTaxApplyAll = function () {
    var v = parseFloat(($('tt41TaxAll') || {}).value); if (isNaN(v) || v < 0 || v > 40) { alert('Enter a GST % between 0 and 40.'); return; }
    document.querySelectorAll('#orderItemsTbody .item-gst').forEach(function (i) { i.value = v; i.closest('tr').dataset.gst = '1'; });
    calcOrderTotals();
  };
  (function () {
    var o = window.calcOrderTotals; if (typeof o !== 'function') return;
    window.calcOrderTotals = function () { var r = o.apply(this, arguments); try { taxTable(); } catch (e) { console.warn('tax table', e); } return r; };
  })();
  (function () {   // picking a product from the list: use that stock item's GST % (18 if none), unless you already typed one for this line
    var o = window.selectOrderItemSuggestion; if (typeof o !== 'function') return;
    window.selectOrderItemSuggestion = function (el) {
      var row = el && el.closest ? el.closest('tr') : null, r = o.apply(this, arguments);
      try {
        if (row && row.dataset.gst !== '1' && F('gstRowTax')) {
          var nm = (row.querySelector('.item-product-input') || {}).value, p = nm && window.resolvePartFromSearch && resolvePartFromSearch(nm), g = row.querySelector('.item-gst');
          if (g) { g.value = (p && p.gstRate != null && p.gstRate !== '') ? Number(p.gstRate) : 18; }
          calcOrderTotals();
        }
      } catch (e) { console.warn(e); }
      return r;
    };
  })();
  var oOpen = window.openOrderModal;
  if (typeof oOpen === 'function') window.openOrderModal = function () { var r = oOpen.apply(this, arguments); try { inject(); taxTable(); } catch (e) {} return r; };
  var oTax = document.addEventListener('change', function (e) { if (e.target && e.target.id === 'ordTaxType') taxTable(); });
  document.addEventListener('DOMContentLoaded', inject);
  if (document.readyState !== 'loading') inject();
})();
