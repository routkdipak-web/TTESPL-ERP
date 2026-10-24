/* TTESPL ERP module: 04-travel-lists-ambient-ui.js */
/* ================= TRAVEL EXPENSES (per employee) ================= */
var ttTravelState = { month: '', empKey: '' };

function ttTravelMyKey() {
  if (!currentUser) return '';
  return String(currentUser.id != null ? currentUser.id : currentUser.mobile);
}
function ttTravelViewKey() { return ttTravelState.empKey || ttTravelMyKey(); }
function ttTravelCanEdit(rec) { return isAdminUser() || String(rec.empId) === ttTravelMyKey(); }
function ttTravelEmpName(key) {
  var e = (registeredEmployees || []).find(function (x) { return String(x.id) === String(key); });
  if (e) return e.name;
  return (currentUser && ttTravelMyKey() === String(key)) ? currentUser.name : 'Employee';
}
function ttFmtKm(n) { return String(Math.round((Number(n) || 0) * 100) / 100); }
function ttTravelMonthLabel() {
  var p = String(ttTravelState.month || '').split('-');
  if (p.length < 2) return '';
  return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
function ttTravelDayLabel(d) {
  var dt = new Date(d + 'T00:00:00');
  return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}
function ttTravelMonthRecords() {
  var key = ttTravelViewKey(), mon = ttTravelState.month;
  return (travelData || []).filter(function (r) {
    return r && String(r.empId) === String(key) && String(r.date || '').slice(0, 7) === mon;
  }).sort(function (a, b) {
    if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
    return a.date < b.date ? -1 : 1;
  });
}

function ttEnsureTravelModal() {
  var m = document.getElementById('travelExpenseModal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'travelExpenseModal';
  m.className = 'auth-overlay';
  m.style.display = 'none';
  m.style.zIndex = '3100';
  m.innerHTML = '<div class="auth-card" style="max-width:560px;">' +
    '<div class="card-header"><span class="card-title">🧳 Travel Expenses</span>' +
    '<div style="display:flex;gap:6px;"><button class="btn btn-accent btn-sm" onclick="triggerAppHaptic(); ttTravelPrint()">💾 Save / Print</button>' +
    '<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'travelExpenseModal\').style.display=\'none\'">✕</button></div></div>' +
    '<div id="trvEmpRow" style="display:none;margin-bottom:8px;"><label class="form-label">👤 Employee (Admin view)</label><select id="trvEmpSelect" onchange="ttTravelSwitchEmp(this.value)"></select></div>' +
    '<div id="trvSummary" class="tt-trv-summary"></div>' +
    '<div class="form-group"><label class="form-label">📅 Month</label><input type="month" id="trvMonth" onchange="ttTravelSetMonth(this.value)"></div>' +
    '<div class="tt-trv-add">' +
    '<div class="grid-2"><div class="form-group"><label class="form-label">Date</label><input type="date" id="trvDate"></div>' +
    '<div class="form-group"><label class="form-label">Distance (Km)</label><input type="number" id="trvKm" min="0" step="0.1" inputmode="decimal" placeholder="e.g. 12.5"></div></div>' +
    '<div class="grid-2"><div class="form-group"><label class="form-label">From</label><input type="text" id="trvFrom" placeholder="e.g. Rasulgarh Office"></div>' +
    '<div class="form-group"><label class="form-label">To</label><input type="text" id="trvTo" placeholder="e.g. Cuttack Workshop"></div></div>' +
    '<button class="btn btn-primary btn-block" onclick="triggerAppHaptic(); ttTravelAdd()">➕ Add Visit (you can add several places on one date)</button></div>' +
    '<div style="font-size:13px;font-weight:800;margin:14px 0 8px;">📋 Monthly Log (editable)</div>' +
    '<div id="trvLog" style="max-height:44vh;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div></div>';
  document.body.appendChild(m);
  return m;
}

function openTravelExpenses() {
  if (!currentUser) { alert('Please log in first.'); return; }
  var m = ttEnsureTravelModal();
  if (!ttTravelState.month) {
    var now = new Date();
    ttTravelState.month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }
  ttTravelState.empKey = ttTravelMyKey();
  m.style.display = 'flex';
  ttRenderTravel(true);
}
window.openTravelExpenses = openTravelExpenses;

function ttTravelSetMonth(v) {
  if (!v) return;
  ttTravelState.month = v;
  ttRenderTravel();
}
function ttTravelSwitchEmp(v) {
  ttTravelState.empKey = v || ttTravelMyKey();
  ttRenderTravel();
}
window.ttTravelSetMonth = ttTravelSetMonth;
window.ttTravelSwitchEmp = ttTravelSwitchEmp;

function ttRenderTravel(full) {
  var m = document.getElementById('travelExpenseModal');
  if (!m) return;
  var isAdm = isAdminUser();
  var row = document.getElementById('trvEmpRow');
  row.style.display = isAdm ? 'block' : 'none';
  if (isAdm) {
    var sel = document.getElementById('trvEmpSelect');
    sel.innerHTML = (registeredEmployees || []).map(function (e) {
      return '<option value="' + ttH(String(e.id)) + '">' + ttH(e.name) + ' — ' + ttH(e.role || '') + '</option>';
    }).join('');
    sel.value = ttTravelViewKey();
  }
  document.getElementById('trvMonth').value = ttTravelState.month;
  var dEl = document.getElementById('trvDate');
  if ((full || !dEl.value) && !dEl.value) dEl.value = new Date().toISOString().split('T')[0];

  var recs = ttTravelMonthRecords();
  var total = recs.reduce(function (s, r) { return s + (Number(r.km) || 0); }, 0);
  document.getElementById('trvSummary').innerHTML =
    '<div><div style="font-size:11px;opacity:.85;">' + ttH(ttTravelEmpName(ttTravelViewKey())) + ' • ' + ttH(ttTravelMonthLabel()) + '</div>' +
    '<div style="font-size:24px;font-weight:900;"><span id="trvTotalKm">' + ttFmtKm(total) + '</span> Km</div></div>' +
    '<div style="text-align:right;font-size:11px;opacity:.9;">Visits<br><b id="trvVisitCount" style="font-size:18px;">' + recs.length + '</b></div>';

  var log = document.getElementById('trvLog');
  if (!recs.length) {
    log.innerHTML = '<div class="empty-state"><span class="empty-icon">🧳</span><div class="empty-sub">No travel entries this month.</div></div>';
    return;
  }
  var html = '', lastDate = '';
  recs.forEach(function (r) {
    if (r.date !== lastDate) {
      lastDate = r.date;
      var dayTotal = recs.filter(function (x) { return x.date === r.date; }).reduce(function (s, x) { return s + (Number(x.km) || 0); }, 0);
      html += '<div class="tt-trv-dayhead"><span>' + ttH(ttTravelDayLabel(r.date)) + '</span><b data-trv-day="' + ttH(r.date) + '">' + ttFmtKm(dayTotal) + ' km</b></div>';
    }
    var dis = ttTravelCanEdit(r) ? '' : ' disabled';
    html += '<div class="tt-trv-row"><div class="tt-trv-top">' +
      '<input type="date" value="' + ttH(r.date) + '" onchange="ttTravelUpdate(\'' + r.id + '\',\'date\',this.value)"' + dis + '>' +
      '<input type="number" step="0.1" min="0" inputmode="decimal" value="' + ttH(r.km) + '" onchange="ttTravelUpdate(\'' + r.id + '\',\'km\',this.value)"' + dis + '>' +
      '<button class="btn btn-danger-sm" onclick="triggerAppHaptic(); ttTravelDelete(\'' + r.id + '\')"' + dis + '>🗑️</button></div>' +
      '<div class="tt-trv-bottom"><input type="text" value="' + ttH(r.from) + '" placeholder="From" onchange="ttTravelUpdate(\'' + r.id + '\',\'from\',this.value)"' + dis + '>' +
      '<span>➜</span><input type="text" value="' + ttH(r.to) + '" placeholder="To" onchange="ttTravelUpdate(\'' + r.id + '\',\'to\',this.value)"' + dis + '></div></div>';
  });
  log.innerHTML = html;
}

function ttTravelRefreshTotals() {
  var recs = ttTravelMonthRecords();
  var total = recs.reduce(function (s, r) { return s + (Number(r.km) || 0); }, 0);
  var t = document.getElementById('trvTotalKm'); if (t) t.textContent = ttFmtKm(total);
  var c = document.getElementById('trvVisitCount'); if (c) c.textContent = recs.length;
  document.querySelectorAll('[data-trv-day]').forEach(function (el) {
    var d = el.getAttribute('data-trv-day');
    var s = recs.filter(function (r) { return r.date === d; }).reduce(function (a, r) { return a + (Number(r.km) || 0); }, 0);
    el.textContent = ttFmtKm(s) + ' km';
  });
}

function ttTravelAdd() {
  var date = document.getElementById('trvDate').value;
  var from = document.getElementById('trvFrom').value.trim();
  var to = document.getElementById('trvTo').value.trim();
  var km = parseFloat(document.getElementById('trvKm').value);
  if (!date || !from || !to || !(km > 0)) { alert('Date, From, To and Km (greater than 0) are required.'); return; }
  var key = ttTravelViewKey();
  var rec = {
    id: 'TRV' + Date.now() + Math.random().toString(36).slice(2, 6),
    empId: key, empName: ttTravelEmpName(key),
    date: date, from: from, to: to, km: km,
    createdAt: Date.now(), createdBy: currentUser ? currentUser.name : 'Staff'
  };
  if (!Array.isArray(travelData)) travelData = [];
  travelData.push(rec);
  setStored("TRAVEL", travelData);
  ttTravelState.month = date.slice(0, 7);
  document.getElementById('trvFrom').value = to; // agla visit usi jagah se shuru
  document.getElementById('trvTo').value = '';
  document.getElementById('trvKm').value = '';
  ttRenderTravel();
}
window.ttTravelAdd = ttTravelAdd;

function ttTravelUpdate(id, field, val) {
  var r = (travelData || []).find(function (x) { return x && x.id === id; });
  if (!r || !ttTravelCanEdit(r)) return;
  if (field === 'km') r.km = Math.max(0, parseFloat(val) || 0);
  else if (field === 'date') { if (!val) return; r.date = val; }
  else r[field] = String(val).trim();
  r.updatedAt = Date.now();
  setStored("TRAVEL", travelData);
  if (field === 'date') ttRenderTravel(); else ttTravelRefreshTotals();
}
window.ttTravelUpdate = ttTravelUpdate;

function ttTravelDelete(id) {
  var r = (travelData || []).find(function (x) { return x && x.id === id; });
  if (!r || !ttTravelCanEdit(r)) return;
  if (!confirm('Delete this travel entry?')) return;
  try { if (window.cloudSync && window.cloudSync.deleteItem) window.cloudSync.deleteItem('TRAVEL', id); } catch (e) {}
  travelData = (travelData || []).filter(function (x) { return x && x.id !== id; });
  setStored("TRAVEL", travelData);
  ttRenderTravel();
}
window.ttTravelDelete = ttTravelDelete;

function ttTravelPrint() {
  var recs = ttTravelMonthRecords();
  if (!recs.length) { alert('No travel entries this month.'); return; }
  var name = ttTravelEmpName(ttTravelViewKey());
  var monthLabel = ttTravelMonthLabel();
  var B = 'border:1px solid #000;padding:5px 7px;font-size:11.5px;';
  var rows = '', sl = 0, lastDate = '', total = 0;
  var dayTotals = {};
  recs.forEach(function (r) { dayTotals[r.date] = (dayTotals[r.date] || 0) + (Number(r.km) || 0); total += Number(r.km) || 0; });
  recs.forEach(function (r, idx) {
    sl++;
    var dateCell = r.date !== lastDate ? ttH(new Date(r.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })) : '';
    lastDate = r.date;
    rows += '<tr><td style="' + B + 'text-align:center;">' + sl + '</td><td style="' + B + '">' + dateCell + '</td><td style="' + B + '">' + ttH(r.from) + '</td><td style="' + B + '">' + ttH(r.to) + '</td><td style="' + B + 'text-align:right;">' + ttFmtKm(r.km) + '</td></tr>';
    var next = recs[idx + 1];
    if (!next || next.date !== r.date) {
      rows += '<tr style="background:#eef2f7;"><td colspan="4" style="' + B + 'text-align:right;font-weight:700;">Day Total</td><td style="' + B + 'text-align:right;font-weight:700;">' + ttFmtKm(dayTotals[r.date]) + '</td></tr>';
    }
  });
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#000;">' +
    '<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px;"><strong style="font-size:17px;">TWINTOWN EXPRESS SERVICES PVT LTD</strong><br><span style="font-size:13px;">Travel Expense Report</span></div>' +
    '<table style="width:100%;margin-bottom:12px;font-size:12.5px;"><tr><td><strong>Employee Name:</strong> ' + ttH(name) + '</td><td style="text-align:right;"><strong>Month:</strong> ' + ttH(monthLabel) + '</td></tr>' +
    '<tr><td><strong>Total Visits:</strong> ' + recs.length + '</td><td style="text-align:right;"><strong>Generated:</strong> ' + new Date().toLocaleDateString('en-GB') + '</td></tr></table>' +
    '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#0a2540;color:#fff;"><th style="' + B + 'width:34px;">Sl</th><th style="' + B + '">Date</th><th style="' + B + '">From</th><th style="' + B + '">To</th><th style="' + B + 'text-align:right;">Distance (Km)</th></tr></thead><tbody>' + rows +
    '<tr style="background:#dbeafe;"><td colspan="4" style="' + B + 'text-align:right;font-weight:800;font-size:13px;">TOTAL KILOMETERS</td><td style="' + B + 'text-align:right;font-weight:800;font-size:13px;">' + ttFmtKm(total) + ' Km</td></tr></tbody></table>' +
    '<div style="display:flex;justify-content:space-between;margin-top:36px;font-size:12px;"><div>Employee Signature: ______________</div><div>Authorised Signatory: ______________</div></div></div>';
  ttPrintHtml('Travel Expenses - ' + name + ' - ' + monthLabel, html);
}
window.ttTravelPrint = ttTravelPrint;

window.ttRenderTravelIfOpen = function () {
  var m = document.getElementById('travelExpenseModal');
  if (!m || m.style.display !== 'flex') return;
  var ae = document.activeElement;
  if (ae && m.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT')) return; // typing ke beech re-render nahi
  ttRenderTravel();
};


/* ===== v6: debounce helper (smooth typing in big lists) ===== */
var _ttDebT = {};
function ttDeb(k, fn, v) {
  clearTimeout(_ttDebT[k]);
  _ttDebT[k] = setTimeout(function () { fn(v); }, 160);
}
window.ttDeb = ttDeb;
window.ttRenderCrmIfOpen = function () { try { var m = document.getElementById('crmRecordsContainer'); if (m && m.offsetParent !== null) renderCrmRecords(); } catch (e) {} };
window.ttRenderCompanyIfOpen = function () { try { if (typeof renderCompanyDetailsView === 'function') renderCompanyDetailsView(); } catch (e) {} };

/* ===== v9: Product Catalog - Add/Edit Product + custom Categories (cloud synced) ===== */
var catalogCatsData = getStored("CATALOG_CATS", []);
window.ttRenderCatalogIfOpen = function () {
  try { var p = document.getElementById('view-catalog'); if (p && p.classList.contains('active')) renderCatalog(); } catch (e) {}
};
function ttCatCatName(i) {
  if (!i || !i.catalogCat) return '';
  var c = (catalogCatsData || []).filter(function (x) { return String(x.id) === String(i.catalogCat); })[0];
  return c ? c.name : '';
}
window.ttCatCatName = ttCatCatName;

function ttCatModal(id, z) {
  var m = document.getElementById(id);
  if (!m) { m = document.createElement('div'); m.id = id; m.className = 'auth-overlay'; m.style.display = 'none'; m.style.zIndex = z || '3200'; document.body.appendChild(m); }
  return m;
}

/* ---- Add / Edit product ---- */
function ttCatProdEdit(id) {
  var i = id ? (sampleInventory || []).filter(function (x) { return String(x.id) === String(id); })[0] : null;
  if (id && !i) return;
  var d = document.getElementById('catalogDetailModal'); if (d) d.style.display = 'none';
  var m = ttCatModal('catalogProdModal', '3200');
  var opts = '<option value="">— No category —</option>' + (catalogCatsData || []).map(function (c) {
    return '<option value="' + ttH(c.id) + '"' + (i && String(i.catalogCat) === String(c.id) ? ' selected' : '') + '>' + ttH(c.name) + '</option>';
  }).join('');
  var v = function (x) { return ttH(x == null ? '' : x); };
  m.innerHTML = '<div class="auth-card" style="max-width:480px;max-height:92dvh;overflow-y:auto;">' +
    '<div class="card-header"><span class="card-title">' + (i ? '✏️ Edit Product' : '➕ Add Product') + '</span><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'catalogProdModal\').style.display=\'none\'">✕</button></div>' +
    '<input type="hidden" id="cpeId" value="' + v(i ? i.id : '') + '">' +
    '<div class="form-group"><label class="form-label">Product Name *</label><input type="text" id="cpeName" value="' + v(i && i.name) + '" placeholder="e.g. AR-680 (1Φ)"></div>' +
    '<div class="form-group"><label class="form-label">Category</label><select id="cpeCat">' + opts + '</select></div>' +
    '<div class="form-group"><label class="form-label">Model / Code</label><input type="text" id="cpeCode" value="' + v(i && i.code) + '" placeholder="e.g. CAT-1040"></div>' +
    '<div class="form-group"><label class="form-label">HSN (for quotations)</label><input type="text" id="cpeHsn" value="' + v(i && i.hsn) + '" placeholder="e.g. 84243000"></div>' +
    '<div class="form-group"><label class="form-label">Description</label><textarea id="cpeDesc" rows="3" style="width:100%;">' + v(i && i.desc) + '</textarea></div>' +
    '<div class="form-group"><label class="form-label">Technical Data / Specs</label><textarea id="cpeSpecs" rows="4" style="width:100%;">' + v(i && i.specs) + '</textarea></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
      '<div class="form-group"><label class="form-label">👤 Customer Price (₹)</label><input type="number" id="cpeCust" min="0" step="any" value="' + (i ? (Number(i.rate) || 0) : '') + '"></div>' +
      '<div class="form-group"><label class="form-label">🏷️ Dealer Price (₹)</label><input type="number" id="cpeDeal" min="0" step="any" value="' + (i ? (Number(i.dealerPrice) || 0) : '') + '"></div></div>' +
    '<button class="btn btn-primary btn-block" onclick="triggerAppHaptic(); ttCatProdSave()">💾 Save Product</button>' +
    (i && isAdminUser() ? '<button class="btn btn-danger-sm btn-block" style="margin-top:8px;" onclick="ttCatProdDelete(\'' + v(i.id) + '\')">🗑️ Delete Product (Admin)</button>' : '') +
    '</div>';
  m.style.display = 'flex';
}
function ttCatProdSave() {
  var name = document.getElementById('cpeName').value.trim();
  if (!name) { alert('Please enter the product name'); return; }
  var id = document.getElementById('cpeId').value;
  var cust = parseFloat(document.getElementById('cpeCust').value) || 0;
  var deal = parseFloat(document.getElementById('cpeDeal').value) || 0;
  if (cust < 0 || deal < 0) { alert('Price cannot be negative.'); return; }
  var f = {
    name: name,
    code: document.getElementById('cpeCode').value.trim(),
    hsn: document.getElementById('cpeHsn').value.trim(),
    desc: document.getElementById('cpeDesc').value.trim(),
    specs: document.getElementById('cpeSpecs').value.trim(),
    catalogCat: document.getElementById('cpeCat').value || '',
    rate: cust, dealerPrice: deal
  };
  var item = id ? (sampleInventory || []).filter(function (x) { return String(x.id) === String(id); })[0] : null;
  if (item) {
    Object.keys(f).forEach(function (k) { item[k] = f[k]; });
  } else {
    var nid = Date.now();
    while ((sampleInventory || []).some(function (x) { return x.id === nid; })) nid++;
    sampleInventory.unshift(Object.assign({ id: nid, category: 'Catalog Equipment', subCategory: '' }, f));
  }
  setStored("INVENTORY", sampleInventory);
  document.getElementById('catalogProdModal').style.display = 'none';
  renderCatalog();
  try { updateCategoryCounts(); } catch (e) {}
  try { if (typeof ttShowSuccessToast === 'function') ttShowSuccessToast(item ? 'Product updated.' : 'Product added to the catalog.'); } catch (e) {}
}
function ttCatProdDelete(id) {
  if (!isAdminUser()) { alert('Admin only!'); return; }
  if (!confirm('Delete this product?')) return;
  sampleInventory = sampleInventory.filter(function (x) { return String(x.id) !== String(id); });
  setStored("INVENTORY", sampleInventory);
  try { if (window.cloudSync) window.cloudSync.deleteItem('INVENTORY', id); } catch (e) {}
  document.getElementById('catalogProdModal').style.display = 'none';
  renderCatalog();
}

/* ---- Categories ---- */
var ttCatSel = {};      // product id -> true (checked in modal)
var ttCatEditId = '';
function ttCatManage(catId) {
  ttCatEditId = catId || '';
  ttCatSel = {};
  var c = catId ? (catalogCatsData || []).filter(function (x) { return String(x.id) === String(catId); })[0] : null;
  if (catId && !c) return;
  getCatalogItems().forEach(function (i) { if (c && String(i.catalogCat) === String(c.id)) ttCatSel[String(i.id)] = true; });
  var m = ttCatModal('catalogCatModal', '3200');
  m.innerHTML = '<div class="auth-card" style="max-width:480px;max-height:92dvh;display:flex;flex-direction:column;">' +
    '<div class="card-header"><span class="card-title">' + (c ? '⚙️ Category Manage' : '➕ New Category') + '</span><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'catalogCatModal\').style.display=\'none\'">✕</button></div>' +
    '<div class="form-group"><label class="form-label">Category name *</label><input type="text" id="ccName" value="' + ttH(c ? c.name : '') + '" placeholder="e.g. High Pressure Washers"></div>' +
    '<div class="form-group" style="margin-bottom:6px;"><label class="form-label">Select products for this category (<span id="ccCount">0</span>)</label><input type="text" id="ccSearch" placeholder="🔍 Product search..." oninput="ttDeb(\'cc\', ttCatRenderPick)"></div>' +
    '<div id="ccList" style="flex:1;overflow-y:auto;min-height:120px;max-height:46dvh;border:1px solid var(--border);border-radius:12px;padding:6px;margin-bottom:10px;"></div>' +
    '<button class="btn btn-primary btn-block" onclick="triggerAppHaptic(); ttCatSave()">💾 Save Category</button>' +
    (c ? '<button class="btn btn-danger-sm btn-block" style="margin-top:8px;" onclick="ttCatDelete()">🗑️ Delete Category (products will not be deleted)</button>' : '') +
    '</div>';
  m.style.display = 'flex';
  ttCatRenderPick();
}
function ttCatRenderPick() {
  var box = document.getElementById('ccList'); if (!box) return;
  var q = (document.getElementById('ccSearch').value || '').toLowerCase().trim();
  var list = getCatalogItems().filter(function (i) { return !q || (i.name && i.name.toLowerCase().indexOf(q) >= 0) || (i.code && String(i.code).toLowerCase().indexOf(q) >= 0); });
  box.innerHTML = list.length ? list.map(function (i) {
    var other = ttCatCatName(i);
    var here = ttCatEditId && String(i.catalogCat) === String(ttCatEditId);
    return '<label style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid var(--border);cursor:pointer;">' +
      '<input type="checkbox" style="width:18px;height:18px;flex:none;" ' + (ttCatSel[String(i.id)] ? 'checked' : '') + ' onchange="ttCatTick(\'' + ttH(i.id) + '\', this.checked)">' +
      '<span style="flex:1;font-size:13px;color:var(--text-main);">' + ttH(i.name) + (other && !here ? '<span style="display:block;font-size:10.5px;color:var(--text-muted);">Currently: ' + ttH(other) + ' (it will move here when selected)</span>' : '') + '</span></label>';
  }).join('') : '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12.5px;">No products found.</div>';
  var n = Object.keys(ttCatSel).length; var el = document.getElementById('ccCount'); if (el) el.textContent = n;
}
function ttCatTick(id, on) {
  if (on) ttCatSel[String(id)] = true; else delete ttCatSel[String(id)];
  var el = document.getElementById('ccCount'); if (el) el.textContent = Object.keys(ttCatSel).length;
}
function ttCatSave() {
  var name = document.getElementById('ccName').value.trim();
  if (!name) { alert('Please enter the category name'); return; }
  var dup = (catalogCatsData || []).some(function (c) { return c.name.toLowerCase() === name.toLowerCase() && String(c.id) !== String(ttCatEditId); });
  if (dup) { alert('A category with this name already exists.'); return; }
  var cat = ttCatEditId ? catalogCatsData.filter(function (c) { return String(c.id) === String(ttCatEditId); })[0] : null;
  if (cat) { cat.name = name; }
  else { cat = { id: 'CC' + Date.now(), name: name, createdBy: currentUser ? currentUser.name : '' }; catalogCatsData.push(cat); }
  var changed = false;
  getCatalogItems().forEach(function (i) {
    var on = !!ttCatSel[String(i.id)];
    if (on && String(i.catalogCat) !== String(cat.id)) { i.catalogCat = cat.id; changed = true; }
    else if (!on && String(i.catalogCat) === String(cat.id)) { i.catalogCat = ''; changed = true; }
  });
  setStored("CATALOG_CATS", catalogCatsData);
  if (changed) setStored("INVENTORY", sampleInventory);
  document.getElementById('catalogCatModal').style.display = 'none';
  activeCatalogSub = cat.id;
  renderCatalog();
}
function ttCatDelete() {
  var c = catalogCatsData.filter(function (x) { return String(x.id) === String(ttCatEditId); })[0];
  if (!c || !confirm('Delete category "' + c.name + '"? Its products will stay in the catalog (shown under All only).')) return;
  var changed = false;
  getCatalogItems().forEach(function (i) { if (String(i.catalogCat) === String(c.id)) { i.catalogCat = ''; changed = true; } });
  catalogCatsData = catalogCatsData.filter(function (x) { return String(x.id) !== String(c.id); });
  setStored("CATALOG_CATS", catalogCatsData);
  try { if (window.cloudSync) window.cloudSync.deleteItem('CATALOG_CATS', c.id); } catch (e) {}
  if (changed) setStored("INVENTORY", sampleInventory);
  document.getElementById('catalogCatModal').style.display = 'none';
  activeCatalogSub = 'ALL';
  renderCatalog();
}
window.ttCatProdEdit = ttCatProdEdit; window.ttCatProdSave = ttCatProdSave; window.ttCatProdDelete = ttCatProdDelete;
window.ttCatManage = ttCatManage; window.ttCatSave = ttCatSave; window.ttCatDelete = ttCatDelete; window.ttCatTick = ttCatTick; window.ttCatRenderPick = ttCatRenderPick;

/* ttEach(container, list, buildFn): builds the first few cards immediately and the rest while the user scrolls
   (no 60-item cap, no up-front cost for 1500+ rows). buildFn must append its card to the container, like before. */
function ttEach(c, list, fn, first, step) {
  first = first || 30; step = step || 40;
  var tok = (c.__ttTok = (c.__ttTok || 0) + 1), i = 0, sent = null, io = null;
  if (c.__ttIO) { try { c.__ttIO.disconnect(); } catch (e) {} c.__ttIO = null; }
  function more(n) {
    if (c.__ttTok !== tok) return;
    if (sent && sent.parentNode) { try { io && io.unobserve(sent); } catch (e) {} sent.remove(); }
    var end = Math.min(list.length, i + n);
    for (; i < end; i++) fn(list[i], i);
    if (i < list.length && io) {
      if (!sent) { sent = document.createElement('div'); sent.className = 'tt-sentinel'; }
      c.appendChild(sent); io.observe(sent);
    } else if (io) { io.disconnect(); c.__ttIO = null; }
  }
  if (list.length > first && 'IntersectionObserver' in window) {
    io = c.__ttIO = new IntersectionObserver(function (es) {
      if (c.__ttTok !== tok) return;
      for (var k = 0; k < es.length; k++) if (es[k].isIntersecting) { more(step); break; }
    }, { rootMargin: '900px 0px' });
    more(first);
  } else more(list.length);
}
window.ttEach = ttEach;

/* ===== v10: Lazy list rendering (long lists smooth) ===== */
(function () {
  if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return;
  var IDS = ['ordersListContainer', 'leadsListContainer', 'serviceListContainer', 'billingListContainer']; /* stock list is built progressively by ttEach() */
  var FIRST = 24, STEP = 24;
  IDS.forEach(function (id) {
    var c = document.getElementById(id);
    if (!c) return;
    var mo, io;
    function reveal() {
      var hidden = c.querySelectorAll(':scope > .tt-lazy-hide');
      for (var i = 0; i < STEP && i < hidden.length; i++) hidden[i].classList.remove('tt-lazy-hide');
      var s = c.querySelector(':scope > .tt-lazy-sentinel');
      if (!s) return;
      if (c.querySelector(':scope > .tt-lazy-hide')) { io.unobserve(s); io.observe(s); }
      else { io.unobserve(s); s.remove(); }
      mo.takeRecords();
    }
    io = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) { if (es[i].isIntersecting) { reveal(); break; } }
    }, { rootMargin: '700px 0px' });
    function apply() {
      var old = c.querySelector(':scope > .tt-lazy-sentinel');
      if (old) { io.unobserve(old); old.remove(); }
      var kids = Array.prototype.filter.call(c.children, function (e) { return !e.classList.contains('tt-lazy-sentinel'); });
      if (kids.length > FIRST + 8) {
        for (var i = FIRST; i < kids.length; i++) kids[i].classList.add('tt-lazy-hide');
        var s = document.createElement('div');
        s.className = 'tt-lazy-sentinel';
        s.style.cssText = 'height:2px;';
        c.appendChild(s);
        io.observe(s);
      }
      mo.takeRecords();
    }
    mo = new MutationObserver(function () { apply(); });
    mo.observe(c, { childList: true });
    apply();
  });
})();

/* ===== v11: Ambient light orbs + haptic-synced micro-border pulse ===== */
(function () {
  var reduce = false;
  try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // Ambient orbs
  try {
    if (!document.getElementById('ttAmbient')) {
      var amb = document.createElement('div');
      amb.id = 'ttAmbient'; amb.setAttribute('aria-hidden', 'true');
      amb.innerHTML = '<i class="o1"></i><i class="o2"></i><i class="o3"></i>';
      document.body.insertBefore(amb, document.body.firstChild);
      document.addEventListener('visibilitychange', function () { amb.classList.toggle('paused', document.hidden); });
      var raf = 0, px = 0, py = 0;
      function move(x, y) {
        px = (x / window.innerWidth - 0.5) * 2; py = (y / window.innerHeight - 0.5) * 2;
        if (raf) return;
        raf = requestAnimationFrame(function () { raf = 0; amb.style.setProperty('--tx', px.toFixed(3)); amb.style.setProperty('--ty', py.toFixed(3)); });
      }
      window.addEventListener('pointerdown', function (e) { move(e.clientX, e.clientY); }, { passive: true });
      window.addEventListener('pointermove', function (e) { if (e.pressure > 0 || e.pointerType === 'mouse') move(e.clientX, e.clientY); }, { passive: true });
    }
  } catch (e) {}

  // Micro-border pulse (cyan -> gold) on tap / save
  var lastTap = null, lastTapAt = 0;
  document.addEventListener('pointerdown', function (e) { lastTap = e.target; lastTapAt = Date.now(); }, { passive: true, capture: true });
  function pulse(el) {
    if (reduce || !el || !el.animate || el._ttPulsing) return;
    el._ttPulsing = true;
    try {
      var a = el.animate([
        { outline: '2px solid rgba(0,229,255,.95)', outlineOffset: '0px' },
        { outline: '2px solid rgba(255,196,0,.9)', outlineOffset: '3px', offset: .45 },
        { outline: '2px solid rgba(255,196,0,0)', outlineOffset: '8px' }
      ], { duration: 950, easing: 'ease-out' });
      a.onfinish = a.oncancel = function () { el._ttPulsing = false; };
    } catch (e) { el._ttPulsing = false; }
  }
  window.ttPulse = pulse;
  function tappedTarget() {
    if (!lastTap || Date.now() - lastTapAt > 1200 || !lastTap.closest) return null;
    return lastTap.closest('.card, .auth-card') || lastTap.closest('.btn, .nav-item, .sub-tab-btn, .profile-menu-item');
  }
  var _h = window.triggerAppHaptic;
  if (typeof _h === 'function') {
    window.triggerAppHaptic = function () { try { pulse(tappedTarget()); } catch (e) {} return _h.apply(this, arguments); };
  }
  // Save / submit hone par khula hua form-card chamakta hai
  var _ok = window.ttShowSuccessToast;
  if (typeof _ok === 'function') {
    window.ttShowSuccessToast = function () {
      try { document.querySelectorAll('.auth-overlay').forEach(function (o) { if (o.style.display === 'flex') { var c = o.querySelector('.auth-card'); if (c) pulse(c); } }); } catch (e) {}
      return _ok.apply(this, arguments);
    };
  }
  document.addEventListener('submit', function (e) { try { pulse(e.target.closest('.card, .auth-card') || e.target); } catch (x) {} }, true);
})();

var TT_TERMS_INVOICE = '<div style="padding:5px 8px;border-top:1px solid #000;font-size:8.5px;line-height:1.35;"><strong style="font-size:9.5px;"><u>Terms &amp; Conditions for Invoice / Bill</u></strong><ol style="margin:2px 0 0 14px;padding:0;"><li><b>Payment Due Date:</b> Full payment must be settled within 7–15 days from the invoice date.</li><li><b>Payment Mode:</b> For bill amounts exceeding ₹5,000, payment via Cheque is compulsory. Otherwise, payments can be made via Bank Transfer, UPI, or Cheque.</li><li><b>Late Fee:</b> A late interest charge of 1.5% per month will be applicable on payments delayed past the due date.</li><li><b>Goods Return Policy:</b> Goods once sold cannot be returned or exchanged.</li><li><b>Warranty / Guarantee:</b> Warranty or guarantee terms are subject strictly to the manufacturer\'s/company\'s standard policy.</li><li><b>Jurisdiction:</b> All legal disputes are subject to the exclusive jurisdiction of the courts in Bhubaneswar.</li></ol></div>';
var TT_TERMS_QUOTE = '<div style="padding:5px 8px;border-top:1px solid #000;font-size:8.5px;line-height:1.35;"><strong style="font-size:9.5px;"><u>Terms &amp; Conditions for Quotation</u></strong><ol style="margin:2px 0 0 14px;padding:0;"><li><b>Validity Period:</b> This quotation is valid for 30 days from the date of issue.</li><li><b>Payment Terms:</b> An advance payment of 50% is required to initiate the work. The remaining balance must be cleared prior to product delivery/installation.</li><li><b>Taxes:</b> All quoted prices are Exclusive of GST.</li><li><b>Scope of Work:</b> The quoted prices apply strictly to the items and services listed in this quotation. Any additional work or items requested later will incur extra charges.</li><li><b>Delivery &amp; Installation Time:</b> Delivery/installation will be completed within 15–30 days after receiving the advance payment.</li><li><b>Cancellation Policy:</b> The advance payment is non-refundable in the event of order cancellation after confirmation.</li></ol></div>';
/* ===== v12: Tally-style auto page split (Invoice + Quotation) + TTESPL logo ===== */
var TT_LOGO_DATA = 'data:image/png;base64,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';
var TT_SHEET_INNER_H = 1050;   // px: A4 (297mm) - 16mm margin ke andar surakshit height
var TT_FOOT_H = 18;

function ttPaginate(cfg) {
  var host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:731px;visibility:hidden;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11px;line-height:1.35;';
  document.body.appendChild(host);
  var pagesHtml = [];
  try {
    var tbl = function (inner) { return '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;">' + cfg.colgroup + inner + '</table>'; };
    host.innerHTML = '<div id="mh">' + cfg.head(2) + '</div><div id="mt">' + tbl(cfg.thead) + '</div>' +
      '<div id="mr">' + tbl('<tbody>' + cfg.rows.join('') + '</tbody>') + '</div>' +
      '<div id="mc">' + tbl('<tbody>' + cfg.cont(0, 2) + '</tbody>') + '</div>' +
      '<div id="mf">' + tbl('<tbody>' + cfg.finalTrs + '</tbody>') + '</div><div id="mb">' + cfg.finalBlocks + '</div>';
    var H = function (id) { return host.querySelector(id).getBoundingClientRect().height; };
    var headH = H('#mh'), theadH = H('#mt'), contH = H('#mc'), finTrH = cfg.finalTrs ? H('#mf') : 0, finBlkH = H('#mb');
    var hts = Array.prototype.map.call(host.querySelectorAll('#mr tbody > tr'), function (tr) { return tr.getBoundingClientRect().height; });
    var boxH = TT_SHEET_INNER_H - TT_FOOT_H;          // box ki bahar ki height
    var inner = boxH - 2;
    var capNon = Math.floor(inner - headH - theadH - contH - 6);
    var capFin = Math.floor(inner - headH - theadH - finTrH - finBlkH - 6);

    // Tally jaisa: pehle pages rows se bhar do (jab tak fill na ho), akhri page par kam se kam ek row +
    // niche tax/total block. Agar bhare hue akhri page par block nahi baithta to uski sirf akhri row akhri page par jati hai.
    var n = cfg.rows.length, pages = [], cur = [], sum = 0;
    for (var i = 0; i < n; i++) {
      if (cur.length && sum + hts[i] > capNon) { pages.push(cur); cur = []; sum = 0; }
      cur.push(i); sum += hts[i];
    }
    if (cur.length) pages.push(cur);
    if (!pages.length) pages.push([]);
    var lastP = pages[pages.length - 1], lsum = 0;
    lastP.forEach(function (r) { lsum += hts[r]; });
    if (lsum > capFin) {
      if (lastP.length > 1) pages.push([lastP.pop()]); else pages.push([]);
    }

    var cum = 0;
    pages.forEach(function (idx, p) {
      var last = (p === pages.length - 1);
      var used = 0, rowsHtml = '';
      idx.forEach(function (r) { used += hts[r]; rowsHtml += cfg.rows[r]; cum += (cfg.amounts[r] || 0); });
      var fillH = Math.max(0, Math.floor((last ? capFin : capNon) - used));
      var tds = '';
      for (var c = 0; c < cfg.ncols; c++) tds += '<td style="border-left:1px solid #000;' + (c === cfg.ncols - 1 ? 'border-right:1px solid #000;' : '') + 'padding:0;line-height:0;font-size:0;"></td>';
      var filler = '<tr style="height:' + fillH + 'px;">' + tds + '</tr>';
      var tail = last ? cfg.finalTrs : cfg.cont(Math.round(cum * 100) / 100, p + 2);
      pagesHtml.push(
        '<div class="tt-sheet" style="width:210mm;height:296.5mm;padding:8mm;box-sizing:border-box;overflow:hidden;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11px;line-height:1.35;' + (last ? '' : 'page-break-after:always;break-after:page;') + '">' +
        '<div style="height:' + boxH + 'px;border:1px solid #000;overflow:hidden;box-sizing:border-box;">' +
        cfg.head(p + 1) +
        '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;">' + cfg.colgroup + cfg.thead + '<tbody>' + rowsHtml + filler + tail + '</tbody></table>' +
        (last ? cfg.finalBlocks : '') +
        '</div><div style="text-align:center;font-size:10px;margin-top:4px;">' + cfg.footnote + '</div></div>');
    });
  } finally {
    document.body.removeChild(host);
  }
  return '<div class="tt-sheets">' + pagesHtml.join('') + '</div>';
}
window.ttPaginate = ttPaginate;

// Preview modal me page ko screen ki width me fit karo (print ko asar nahi padta)
function ttFitPreview(id) {
  try {
    var el = document.getElementById(id); if (!el) return;
    var w = (el.parentElement ? el.parentElement.clientWidth : window.innerWidth) - 8;
    el.style.zoom = w > 0 ? Math.min(1, w / 794) : 1;
    el.querySelectorAll('.tt-sheet').forEach(function (s) { s.style.marginBottom = '12px'; s.style.boxShadow = '0 4px 18px rgba(0,0,0,.25)'; });
  } catch (e) {}
}
window.ttFitPreview = ttFitPreview;

function ttDocHead(title, pageNo, sub) {
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-bottom:1px solid #000;">' +
    '<img src="' + TT_LOGO_DATA + '" alt="TTESPL" style="height:40px;width:auto;display:block;">' +
    '<div style="flex:1;text-align:center;font-weight:800;font-size:16px;">' + title + (pageNo > 1 ? ' (Page ' + pageNo + ')' : '') + '</div>' +
    '<div style="min-width:100px;text-align:right;font-size:8.5px;">' + (sub || '') + '</div></div>';
}
