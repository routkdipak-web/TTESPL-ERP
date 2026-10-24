/* Top-level helper functions that other modules call while loading (kept first so load order works). */


function openQuotationModal() {
  openQuotationModalBase();
  var e = document.getElementById('quotEditId');
  if (e) e.value = '';
  ttUpdateQuotSerialLabel();
}
