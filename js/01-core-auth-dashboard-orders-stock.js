/* TTESPL ERP module: 01-core-auth-dashboard-orders-stock.js */
    
let crmRecordsData = getStored("CRM_RECORDS", []);
window.crmRecordsData = crmRecordsData;

let tempShopPhoto = "", tempCardPhoto = "";

function openNotionCrm() {
  renderCrmRecords();
  document.getElementById('notionCrmModal').style.display = 'flex';
}
function closeNotionCrmModal() {
  document.getElementById('notionCrmModal').style.display = 'none';
}
window.openNotionCrm = openNotionCrm;

function openCrmEditModal(rec = null) {
  const today = ttYmd(new Date());
  tempShopPhoto = ""; tempCardPhoto = "";
  document.getElementById('crmShopPhotoPrev').style.display = 'none';
  document.getElementById('crmCardPhotoPrev').style.display = 'none';
  // Matched existing customer ka id yahan track hota hai - taaki Save par wahi
  // customer dobara duplicate na ho jaaye (naya tabhi add hoga jab match na mile).
  window._ttCrmMatchedCustomerId = rec && rec.custId ? rec.custId : null;

  if (rec) {
    document.getElementById('crmEditTitle').textContent = "Edit CRM Record";
    document.getElementById('crmEditId').value = rec.id;
    document.getElementById('crmShopName').value = rec.shopName || "";
    document.getElementById('crmOwnerName').value = rec.ownerName || "";
    document.getElementById('crmPhone').value = rec.phone || "";
    document.getElementById('crmStage').value = rec.stage || "New Lead";
    document.getElementById('crmVisitDate').value = rec.visitDate || today;
    document.getElementById('crmAddress').value = rec.address || "";
    document.getElementById('crmNotes').value = rec.notes || "";
    if (rec.shopPhoto) { tempShopPhoto = rec.shopPhoto; const p = document.getElementById('crmShopPhotoPrev'); p.src = tempShopPhoto; p.style.display = 'block'; }
    if (rec.cardPhoto) { tempCardPhoto = rec.cardPhoto; const p = document.getElementById('crmCardPhotoPrev'); p.src = tempCardPhoto; p.style.display = 'block'; }
  } else {
    document.getElementById('crmEditTitle').textContent = "New CRM Visit Entry";
    document.getElementById('crmEditId').value = "";
    document.getElementById('crmShopName').value = "";
    document.getElementById('crmOwnerName').value = "";
    document.getElementById('crmPhone').value = "";
    document.getElementById('crmStage').value = "Visited / Contacted";
    document.getElementById('crmVisitDate').value = today;
    document.getElementById('crmAddress').value = "";
    document.getElementById('crmNotes').value = "";
  }
  document.getElementById('crmEditModal').style.display = 'flex';
}
window.openCrmEditModal = openCrmEditModal;

// SEARCHABLE CRM CUSTOMER DROPDOWN: Shop Name me type karte hi agar wo
// customer pehle se CUSTOMERS list me hai to suggestion aata hai - select
// karne par Owner/Phone/Address khud bhar jaate hain, aur duplicate customer
// nahi banta. Naya naam ho to bilkul normal type hota rehta hai.
function handleCrmCustomerAutocomplete(inputEl) {
  const val = (inputEl.value || '').toLowerCase().trim();
  const box = document.getElementById('crmShopSuggestBox');
  if (!box) return;
  window._ttCrmMatchedCustomerId = null; // naya type ho raha hai, match tab tak clear
  if (!val) { box.style.display = 'none'; return; }
  const matches = (customerDatabase || []).filter(c =>
    (c.name && c.name.toLowerCase().includes(val)) ||
    (c.phone && String(c.phone).includes(val)) ||
    (c.person && c.person.toLowerCase().includes(val))
  ).slice(0, 8);
  if (matches.length === 0) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(c => `
    <div class="suggestion-item" onmousedown="selectCrmCustomerSuggestion(${c.id})">
      <div style="flex:1;">
        <strong style="font-size:13px; color:var(--text-main);">${esc(c.name || '')}</strong>
        <div class="suggestion-sub">${c.person ? esc(c.person) + ' | ' : ''}📍 ${esc(c.address || '')}</div>
      </div>
      <span class="badge badge-info" style="font-size:10px;">${esc(c.phone || '')}</span>
    </div>
  `).join('');
  box.style.display = 'block';
}
window.handleCrmCustomerAutocomplete = handleCrmCustomerAutocomplete;

function selectCrmCustomerSuggestion(custId) {
  const c = (customerDatabase || []).find(x => x.id === custId);
  if (!c) return;
  document.getElementById('crmShopName').value = c.name || '';
  document.getElementById('crmOwnerName').value = c.person || '';
  document.getElementById('crmPhone').value = c.phone || '';
  document.getElementById('crmAddress').value = c.address || '';
  window._ttCrmMatchedCustomerId = c.id;
  const box = document.getElementById('crmShopSuggestBox');
  if (box) box.style.display = 'none';
}
window.selectCrmCustomerSuggestion = selectCrmCustomerSuggestion;

function handleCrmPhoto(event, type) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    ttCompressImageSafe(e.target.result, 800, 0.6).then(function(cd) {
      if (type === 'shop') {
        tempShopPhoto = cd;
        const p = document.getElementById('crmShopPhotoPrev'); p.src = cd; p.style.display = 'block';
      } else {
        tempCardPhoto = cd;
        const p = document.getElementById('crmCardPhotoPrev'); p.src = cd; p.style.display = 'block';
      }
    });
  };
  reader.readAsDataURL(file);
}

function saveCrmRecord() {
  const editId = document.getElementById('crmEditId').value;
  const shopName = document.getElementById('crmShopName').value.trim();
  const ownerName = document.getElementById('crmOwnerName').value.trim();
  const phone = document.getElementById('crmPhone').value.trim();
  const stage = document.getElementById('crmStage').value;
  const visitDate = document.getElementById('crmVisitDate').value;
  const address = document.getElementById('crmAddress').value.trim();
  const notes = document.getElementById('crmNotes').value.trim();

  if (!shopName) { alert("Shop / Business name is required!"); return; }

  // CRM list ke saath-saath customer bhi sync rahe: agar ye shop pehle se
  // CUSTOMERS me match nahi hui (phone ya exact naam se), to ek naya customer
  // record bhi add ho jata hai - jo pehle se match hai usko dobara nahi banate.
  let custId = window._ttCrmMatchedCustomerId || null;
  if (!custId) {
    const existing = (customerDatabase || []).find(c =>
      (phone && c.phone && String(c.phone) === String(phone)) ||
      (c.name && c.name.toLowerCase() === shopName.toLowerCase())
    );
    if (existing) {
      custId = existing.id;
    } else {
      const newCust = { id: Date.now(), name: shopName, phone: phone || '', address: address || '', gst: 'Unregistered', person: ownerName || '' };
      customerDatabase.unshift(newCust);
      setStored("CUSTOMERS", customerDatabase);
      custId = newCust.id;
      if (typeof renderCustomerList === 'function') renderCustomerList();
    }
  }

  if (editId) {
    const r = crmRecordsData.find(x => x.id === editId);
    if (r) {
      r.shopName = shopName; r.ownerName = ownerName; r.phone = phone; r.stage = stage;
      r.visitDate = visitDate; r.address = address; r.notes = notes; r.custId = custId;
      if (tempShopPhoto) r.shopPhoto = tempShopPhoto;
      if (tempCardPhoto) r.cardPhoto = tempCardPhoto;
    }
  } else {
    const newRec = {
      id: 'CRM-' + Date.now(),
      shopName, ownerName, phone, stage, visitDate, address, notes, custId,
      shopPhoto: tempShopPhoto, cardPhoto: tempCardPhoto,
      addedBy: currentUser ? currentUser.name : 'Staff',
      empId: currentUser ? String(currentUser.id != null ? currentUser.id : currentUser.mobile) : ''
    };
    crmRecordsData.unshift(newRec);
  }

  setStored("CRM_RECORDS", crmRecordsData);
  document.getElementById('crmEditModal').style.display = 'none';
  renderCrmRecords();
  alert("CRM Record successfully saved!");
}
window.saveCrmRecord = saveCrmRecord;

function ttCrmVisible(r) {
  if (isAdminUser()) return true;
  if (!currentUser) return false;
  const mine = String(currentUser.id != null ? currentUser.id : currentUser.mobile);
  if (r.empId != null && r.empId !== '') return String(r.empId) === mine;
  return r.addedBy === currentUser.name; // purane records (empId nahi) naam se match
}
function renderCrmRecords() {
  const box = document.getElementById('crmRecordsContainer');
  const q = (document.getElementById('crmSearchInput').value || "").toLowerCase().trim();
  // Employee-wise: staff sirf apne records dekhta hai, admin sabke (employee filter ke saath)
  if (isAdminUser() && box && !document.getElementById('crmEmpFilter')) {
    box.insertAdjacentHTML('beforebegin', '<select id="crmEmpFilter" onchange="renderCrmRecords()" style="width:100%;margin-bottom:8px;font-size:13px;padding:8px 12px;"></select>');
  }
  const empSel = document.getElementById('crmEmpFilter');
  if (empSel) {
    const names = Array.from(new Set(crmRecordsData.map(x => x.addedBy).filter(Boolean))).sort();
    const cur = empSel.value;
    empSel.innerHTML = '<option value="">👥 All Employees</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    empSel.value = names.indexOf(cur) >= 0 ? cur : '';
  }
  let list = crmRecordsData.filter(ttCrmVisible);
  if (empSel && empSel.value) list = list.filter(x => x.addedBy === empSel.value);
  if (q) list = list.filter(x => (x.shopName && x.shopName.toLowerCase().includes(q)) || (x.ownerName && x.ownerName.toLowerCase().includes(q)) || (x.phone && x.phone.includes(q)));

  if (list.length === 0) {
    box.innerHTML = `<div class="empty-state"><span class="empty-icon">🗂️</span><div class="empty-sub">No CRM visit records found.</div></div>`;
    return;
  }

  box.innerHTML = list.map(r => `
    <div class="card" style="margin-bottom:10px; padding:12px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <span class="badge badge-info" style="font-size:9.5px; margin-bottom:3px;">${esc(r.stage)}</span>
          <strong style="font-size:14px; display:block; color:var(--text-main);">${esc(r.shopName)}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">${esc(r.ownerName || '')} ${r.phone ? '• ' + esc(r.phone) : ''}</div>
        </div>
        <div style="display:flex; gap:6px;">
          ${r.phone ? `<a href="tel:${esc(r.phone)}" class="btn btn-accent btn-sm" onclick="triggerAppHaptic()" style="text-decoration:none;">📱</a>` : ''}
          <button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); openCrmEditModal(crmRecordsData.find(x=>x.id==='${r.id}'))">✏️</button>
          <button class="btn btn-danger-sm btn-sm" onclick="triggerAppHaptic(); deleteCrmRecord('${r.id}')">🗑️</button>
        </div>
      </div>
      <div style="font-size:12px; margin-top:6px; background:var(--bg); padding:8px; border-radius:8px;">
        📍 <strong>Address:</strong> ${esc(r.address || 'N/A')}<br>
        💬 <strong>Notes:</strong> ${esc(r.notes || 'No notes')}<br>
        🕒 <strong>Date:</strong> ${esc(r.visitDate)} | 👤 <strong>By:</strong> ${esc(r.addedBy)}
      </div>
      <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
        ${r.shopPhoto ? `<button class="btn btn-accent btn-sm" onclick="ttViewPhoto('${r.shopPhoto}')">🏪 Shop Photo</button>` : ''}
        ${r.cardPhoto ? `<button class="btn btn-accent btn-sm" onclick="ttViewPhoto('${r.cardPhoto}')">📇 Visiting Card</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="triggerAppHaptic(); crmCreatePhoneOrder('${r.id}')">📞 Phone Order Entry</button>
      </div>
    </div>
  `).join('');
}
window.renderCrmRecords = renderCrmRecords;

// PHONE ORDER ENTRY: koi existing CRM contact call karke order de de to ek
// tap me naya order form khul jata hai, customer already pre-filled (naam +
// phone) - seedha items add karke save kar sakte hain.
function crmCreatePhoneOrder(crmId) {
  const r = crmRecordsData.find(x => x.id === crmId);
  if (!r) return;
  if (typeof openOrderModal === 'function') {
    openOrderModal();
    const input = document.getElementById('ordCustSearchInput');
    if (input) input.value = r.phone ? `${r.shopName} (${r.phone})` : r.shopName;
  }
  if (typeof closeNotionCrmModal === 'function') closeNotionCrmModal();
}
window.crmCreatePhoneOrder = crmCreatePhoneOrder;

function deleteCrmRecord(id) {
  if (confirm("Confirm delete this CRM record?")) {
    crmRecordsData = crmRecordsData.filter(x => x.id !== id);
    setStored("CRM_RECORDS", crmRecordsData);
    try { if (window.cloudSync) window.cloudSync.deleteItem('CRM_RECORDS', id); } catch (e) {}
    renderCrmRecords();
  }
}
window.deleteCrmRecord = deleteCrmRecord;

function printDailyCrmReport() {
  const today = ttYmd(new Date());
  const myCrm = crmRecordsData.filter(ttCrmVisible);
  const todayList = myCrm.filter(x => x.visitDate === today);
  const targetList = todayList.length ? todayList : myCrm.slice(0, 20);

  const th = 'style="padding:6px 8px; border:1px solid #000; background:#0a2540; color:#fff; font-size:11px;"';
  const td = 'style="padding:6px 8px; border:1px solid #000; font-size:11px; vertical-align:top;"';

  const rows = targetList.map((r, i) => `
    <tr>
      <td ${td} style="text-align:center;">${i+1}</td>
      <td ${td}><strong>${esc(r.shopName)}</strong><br>${esc(r.ownerName || '')} (${esc(r.phone || '-')})</td>
      <td ${td}>${esc(r.stage)}</td>
      <td ${td}>${esc(r.address)}<br><em>Notes:</em> ${esc(r.notes)}</td>
      <td ${td} style="text-align:center;">${r.cardPhoto ? 'Yes (Card)' : 'No'}<br>${r.shopPhoto ? 'Yes (Shop)' : 'No'}</td>
    </tr>
  `).join('');

  const html = `
    <h2 style="margin:0 0 4px; text-align:center;">TTESPL - Daily Field CRM Report</h2>
    <div style="font-size:12px; text-align:center; color:#555; margin-bottom:14px;">Date: ${today} | Total Visits: ${targetList.length}</div>
    <table>
      <thead>
        <tr>
          <th ${th} style="width:30px;">#</th>
          <th ${th}>Shop & Owner / Phone</th>
          <th ${th}>Stage</th>
          <th ${th}>Address & Notes</th>
          <th ${th} style="width:70px;">Photos</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5" style="padding:10px; text-align:center; border:1px solid #000;">No records found</td></tr>'}</tbody>
    </table>
    <div style="margin-top:20px; display:flex; justify-content:space-between; font-size:11px;">
      <div>Verified By: ___________________</div>
      <div>Authorized Signatory: TWINTOWN EXPRESS SERVICES PVT LTD</div>
    </div>
  `;
  if (typeof ttPrintHtml === 'function') ttPrintHtml('Daily CRM Report', html);
}
window.printDailyCrmReport = printDailyCrmReport;

/* ==========================================================================
   HAPTIC & SOUND SYNTHESIS
   ========================================================================== */
function triggerAppHaptic(intensity = 18) {
  try {
    if (navigator.vibrate) navigator.vibrate(intensity);
  } catch(e) {}
}
window.triggerAppHaptic = triggerAppHaptic;

/* ===== BOTTOM-SHEET MODAL OPEN/CLOSE HELPER (New Order / Lead / Service) =====
   Modal ko dikhane se pehle .tt-sheet-card animation ko dobara (fresh) trigger
   karne ke liye class remove -> reflow -> add karte hain; close karte waqt
   pehle "ttSheetDown" exit animation play hoti hai, uske baad hi display:none
   hota hai - taaki card smoothly neeche button me "sama" jaaye, dhadam se
   gayab na ho. */
function ttOpenSheetModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const card = modal.querySelector('.tt-sheet-card');
  modal.style.display = 'flex';
  if (card) {
    card.classList.remove('tt-sheet-closing', 'tt-sheet-card');
    void card.offsetWidth; // reflow taaki animation dobara trigger ho
    card.classList.add('tt-sheet-card');
  }
}
function ttCloseSheetModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const card = modal.querySelector('.tt-sheet-card');
  if (!card) { modal.style.display = 'none'; return; }
  card.classList.add('tt-sheet-closing');
  setTimeout(function () {
    modal.style.display = 'none';
    card.classList.remove('tt-sheet-closing');
  }, 240);
}
window.ttOpenSheetModal = ttOpenSheetModal;
window.ttCloseSheetModal = ttCloseSheetModal;

let audioCtxInstance = null;
function getAudioContext() {
  if (!audioCtxInstance) audioCtxInstance = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtxInstance.state === 'suspended') audioCtxInstance.resume();
  return audioCtxInstance;
}

function playOrderPlacedSound() {
  try {
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + (idx * 0.08));
      gain.gain.setValueAtTime(0, ctx.currentTime + (idx * 0.08));
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + (idx * 0.08) + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (idx * 0.08) + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + (idx * 0.08));
      osc.stop(ctx.currentTime + (idx * 0.08) + 0.35);
    });
  } catch(e) {}
}

function playDeliverySound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch(e) {}
}

function playAtmCashSound() {
  try {
    const ctx = getAudioContext();
    const motor = ctx.createOscillator();
    const motorGain = ctx.createGain();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(110, ctx.currentTime);
    motor.frequency.linearRampToValueAtTime(240, ctx.currentTime + 0.4);
    motor.frequency.linearRampToValueAtTime(90, ctx.currentTime + 1.2);
    motorGain.gain.setValueAtTime(0.08, ctx.currentTime);
    motorGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    motor.connect(motorGain);
    motorGain.connect(ctx.destination);
    motor.start(ctx.currentTime);
    motor.stop(ctx.currentTime + 1.2);

    for (let i = 0; i < 9; i++) {
      const startTime = ctx.currentTime + 0.2 + (i * 0.09);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + (i * 20), startTime);
      gain.gain.setValueAtTime(0.14, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.06);
    }
  } catch(e) {}
}

function playCoinSound() {
  try {
    const ctx = getAudioContext();
    const coinPitches = [1864.66, 2349.32, 2793.83, 3135.96];
    coinPitches.forEach((freq, idx) => {
      const startTime = ctx.currentTime + (idx * 0.06);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  } catch(e) {}
}

function triggerMoneyRainEffect() {
  const container = document.getElementById('moneyRainOverlay');
  if (!container) return;
  container.innerHTML = '';
  container.style.display = 'block';

  const notesList = ['₹500', '₹200', '💵', '₹500', '₹200'];
  const count = 42;

  for (let i = 0; i < count; i++) {
    const isCoin = Math.random() > 0.45;
    const elem = document.createElement('div');
    const leftPos = Math.random() * 95;
    const duration = 1.4 + Math.random() * 1.5;
    const delay = Math.random() * 0.8;

    if (isCoin) {
      elem.className = 'rain-coin';
      elem.textContent = '₹';
    } else {
      elem.className = 'rain-note';
      elem.textContent = notesList[Math.floor(Math.random() * notesList.length)];
      elem.style.color = (elem.textContent === '₹500') ? '#67e8f9' : '#f97316';
    }

    elem.style.left = leftPos + '%';
    elem.style.animationDuration = duration + 's';
    elem.style.animationDelay = delay + 's';
    container.appendChild(elem);
  }

  setTimeout(() => {
    container.style.display = 'none';
    container.innerHTML = '';
  }, 3000);
}

/* ==========================================================================
   APP ENGINE & COMPANY DETAILS MODAL
   ========================================================================== */
const DB_PREFIX = "TTESPL_ERP_";
window.DB_PREFIX = DB_PREFIX;

/* COMPANY DETAILS: admin ab saari details (address, contact, GST, bank, UPI
   etc.) edit kar sakta hai - localStorage me persist hota hai, non-admin ko
   sirf read-only view dikhta hai, koi extra field nahi add kiya gaya hai. */
const COMPANY_DETAILS_DEFAULTS = {
  address: "Plot No-1270/8586, Satya Vihar, Rasulgarh, Bhubaneswar, Khordha, Odisha - 751010",
  branch: "Cuttack Road & Rasulgarh, BBSR",
  contact: "+91 8917465040 / 0674-2580123",
  email: "info@ttespl.com / support@twintown.in",
  gstin: "21AAICT0014E1ZT",
  cin: "U50200OR2022PTC039210",
  brand: "Ma-Fra, MaxShine, Annovi Reverberi, Airtek",
  bankName: "ICICI Bank (Cuttack Road Branch, BBSR)",
  accountNo: "150005501249",
  ifsc: "ICIC0001500",
  upi: "eazypay.574099310@icici"
};
let companyDetailsData = Object.assign({}, COMPANY_DETAILS_DEFAULTS, getStored("COMPANY_DETAILS", {}));
window.companyDetailsData = companyDetailsData;

function renderCompanyDetailsView() {
  const d = companyDetailsData;
  document.getElementById('cdvAddress').textContent = d.address;
  document.getElementById('cdvBranch').textContent = d.branch;
  document.getElementById('cdvContact').textContent = d.contact;
  document.getElementById('cdvEmail').textContent = d.email;
  document.getElementById('cdvGstin').textContent = d.gstin;
  document.getElementById('cdvCin').textContent = d.cin;
  document.getElementById('cdvBrand').textContent = d.brand;
  document.getElementById('cdvBankName').textContent = d.bankName;
  document.getElementById('cdvAccountNo').textContent = d.accountNo;
  document.getElementById('cdvIfsc').textContent = d.ifsc;
  document.getElementById('cdvUpi').textContent = d.upi;
}

function openCompanyDetailsModal() {
  renderCompanyDetailsView();
  toggleCompanyDetailsEdit(false);
  document.getElementById('companyDetailsAdminBtns').style.display = isAdminUser() ? 'flex' : 'none';
  document.getElementById('companyDetailsModal').style.display = 'flex';
}
function closeCompanyDetailsModal() {
  toggleCompanyDetailsEdit(false);
  document.getElementById('companyDetailsModal').style.display = 'none';
}
function toggleCompanyDetailsEdit(editing) {
  if (editing && !isAdminUser()) { alert("Admin only!"); return; }
  const d = companyDetailsData;
  if (editing) {
    document.getElementById('cdeAddress').value = d.address;
    document.getElementById('cdeBranch').value = d.branch;
    document.getElementById('cdeContact').value = d.contact;
    document.getElementById('cdeEmail').value = d.email;
    document.getElementById('cdeGstin').value = d.gstin;
    document.getElementById('cdeCin').value = d.cin;
    document.getElementById('cdeBrand').value = d.brand;
    document.getElementById('cdeBankName').value = d.bankName;
    document.getElementById('cdeAccountNo').value = d.accountNo;
    document.getElementById('cdeIfsc').value = d.ifsc;
    document.getElementById('cdeUpi').value = d.upi;
  }
  document.getElementById('companyDetailsViewBox').style.display = editing ? 'none' : 'block';
  document.getElementById('companyDetailsEditBox').style.display = editing ? 'block' : 'none';
  document.getElementById('companyDetailsSaveBtns').style.display = editing ? 'flex' : 'none';
  document.getElementById('companyDetailsAdminBtns').style.display = (!editing && isAdminUser()) ? 'flex' : 'none';
  document.getElementById('companyDetailsCloseBtn').style.display = editing ? 'none' : 'block';
}
function saveCompanyDetailsAction() {
  if (!isAdminUser()) { alert("Admin only!"); return; }
  companyDetailsData = {
    address: document.getElementById('cdeAddress').value.trim(),
    branch: document.getElementById('cdeBranch').value.trim(),
    contact: document.getElementById('cdeContact').value.trim(),
    email: document.getElementById('cdeEmail').value.trim(),
    gstin: document.getElementById('cdeGstin').value.trim(),
    cin: document.getElementById('cdeCin').value.trim(),
    brand: document.getElementById('cdeBrand').value.trim(),
    bankName: document.getElementById('cdeBankName').value.trim(),
    accountNo: document.getElementById('cdeAccountNo').value.trim(),
    ifsc: document.getElementById('cdeIfsc').value.trim(),
    upi: document.getElementById('cdeUpi').value.trim()
  };
  window.companyDetailsData = companyDetailsData;
  setStored("COMPANY_DETAILS", companyDetailsData);
  renderCompanyDetailsView();
  toggleCompanyDetailsEdit(false);
  triggerAppHaptic();
  alert("Company details updated!");
}
window.openCompanyDetailsModal = openCompanyDetailsModal;
window.closeCompanyDetailsModal = closeCompanyDetailsModal;
window.toggleCompanyDetailsEdit = toggleCompanyDetailsEdit;
window.saveCompanyDetailsAction = saveCompanyDetailsAction;

function esc(str) {
  if (!str) return '';
  // HTML-safe + onclick('...') safe: & < > escape, backslash/quote JS-escape, " -> &quot;
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function getStored(key, defaultVal) {
  try {
    const val = localStorage.getItem(DB_PREFIX + key);
    return val ? JSON.parse(val) : defaultVal;
  } catch(e) {
    return defaultVal;
  }
}
window.getStored = getStored;

/* ===== OFFLINE DATA QUEUE ===== */
/* Internet na ho to changes yahi save rehte hain, aur net wapas aate hi khud-ba-khud cloud me chale jaate hain */
function ttQueueOffline(key, val) {
  try {
    const raw = localStorage.getItem(DB_PREFIX + 'OFFLINE_QUEUE');
    const q = raw ? JSON.parse(raw) : {};
    q[key] = val; // us key ka sabse latest data hi kaafi hai, poora dobara push ho jayega
    localStorage.setItem(DB_PREFIX + 'OFFLINE_QUEUE', JSON.stringify(q));
  } catch (e) { console.warn('Offline queue save failed', e); }
  updateOfflineQueueBadge();
}
function updateOfflineQueueBadge() {
  const el = document.getElementById('offlineQueueBadge');
  let n = 0;
  try {
    const raw = localStorage.getItem(DB_PREFIX + 'OFFLINE_QUEUE');
    n = raw ? Object.keys(JSON.parse(raw)).length : 0;
  } catch (e) {}
  if (el) { el.style.display = n > 0 ? 'inline-block' : 'none'; el.textContent = '⏳ ' + n + ' pending sync'; }
}
function ttFlushOfflineQueue() {
  if (!navigator.onLine) return;
  let raw;
  try { raw = localStorage.getItem(DB_PREFIX + 'OFFLINE_QUEUE'); } catch (e) { return; }
  if (!raw) return;
  let q;
  try { q = JSON.parse(raw); } catch (e) { return; }
  const keys = Object.keys(q);
  if (!keys.length) return;
  try { localStorage.removeItem(DB_PREFIX + 'OFFLINE_QUEUE'); } catch (e) {}
  updateOfflineQueueBadge();
  // AUTO-SYNC NOTIFICATION: net wapas aane par pending changes background me khud
  // cloud par chale jate hain - sab safal ho jaye to ek chhota "Synced" toast
  // dikhta hai (bina kisi manual click ke), taaki engineer ko pata chal jaye.
  const pending = keys.length;
  let settled = 0, failed = 0;
  function noteDone(ok) {
    settled++; if (!ok) failed++;
    if (settled >= pending) {
      if (failed === 0) ttShowSuccessToast(pending + ' change' + (pending > 1 ? 's' : '') + ' synced to the cloud.');
    }
  }
  keys.forEach(function (k) {
    const val = q[k];
    if (window.cloudSync && typeof window.cloudSync.pushKey === 'function') {
      ttWithTimeout(window.cloudSync.pushKey(k, val), 10000)
        .then(function () { noteDone(true); })
        .catch(function () { ttCloudPush(k, val); noteDone(false); });
    } else {
      ttCloudPush(k, val);
      noteDone(false);
    }
  });
}
window.addEventListener('online', ttFlushOfflineQueue);
window.addEventListener('offline', updateOfflineQueueBadge);
setInterval(ttFlushOfflineQueue, 20000);

/* ===== OFFLINE MODE BANNER ===== */
/* Net disconnect hote hi ek clear banner dikhta hai, taaki engineer ko pata rahe
   ki unka kaam save ho raha hai - bas cloud tak abhi nahi pahuncha. */
function ttUpdateOfflineBanner() {
  const b = document.getElementById('ttOfflineBanner');
  if (!b) return;
  const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
  b.classList[offline ? 'add' : 'remove']('show');
}
window.addEventListener('online', ttUpdateOfflineBanner);
window.addEventListener('offline', ttUpdateOfflineBanner);
document.addEventListener('DOMContentLoaded', ttUpdateOfflineBanner);

function ttWithTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) { setTimeout(function () { reject(new Error('cloud-timeout')); }, ms); })
  ]);
}

function ttCloudPush(key, val, attemptsLeft) {
  attemptsLeft = (attemptsLeft == null) ? 25 : attemptsLeft;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    ttQueueOffline(key, val);
    return;
  }
  if (window.cloudSync && typeof window.cloudSync.pushKey === 'function') {
    // Agar cloud write "latak" jaye (na safal ho na fail) to bhi 10 second baad
    // ise fail maan kar retry/offline-queue chalu ho jayega - warna pehle aisi
    // situation me app chup-chaap kuch nahi karta tha aur data kahin nahi jaata tha
    ttWithTimeout(window.cloudSync.pushKey(key, val), 10000).catch(function (e) {
      console.error('Cloud push failed, retrying', key, e);
      if (attemptsLeft === 25 && e && e.code && e.code !== 'unavailable') {
        ttShowErrorToast('Cloud save error (' + key + '): ' + e.code, null);
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { ttQueueOffline(key, val); return; }
      if (attemptsLeft > 0) setTimeout(function () { ttCloudPush(key, val, attemptsLeft - 1); }, 2000);
      else {
        ttQueueOffline(key, val);
        // SOFT ERROR TOAST: pehle ye sirf console me chhup jata tha, user ko pata
        // hi nahi chalta tha ki save fail hua. Ab chhota sa toast dikhta hai jisme
        // 1-tap "Retry" button hota hai.
        ttShowErrorToast('Cloud save failed. Your data is safe - please try again.', function () {
          ttCloudPush(key, val);
        });
      }
    });
  } else if (attemptsLeft > 0) {
    // Cloud abhi connect ho raha hai (app abhi khula hai) - taiyar hote hi dobara try karega
    setTimeout(function () { ttCloudPush(key, val, attemptsLeft - 1); }, 1000);
  } else {
    console.warn('Cloud sync was not ready; added to the offline queue:', key);
    ttQueueOffline(key, val);
    ttShowErrorToast('Could not connect to the cloud. Your data is safe - please try again.', function () {
      ttCloudPush(key, val);
    });
  }
}
window.ttCloudPush = ttCloudPush;
document.addEventListener('DOMContentLoaded', updateOfflineQueueBadge);

// BUTTON RIPPLE + UNIVERSAL HAPTIC: har button/.btn/.tab-btn/.sub-tab-btn/
// .quick-action/.nav-item/.cat-chip par tap karte waqt ek subtle material-style
// ripple + halka sa vibrate hota hai - ye sirf EXTRA feedback hai (koi click
// logic yahan change nahi hoti). Jin buttons par pehle se apna onclick me
// triggerAppHaptic() likha hai unke liye ye dusra (harmless) vibrate hai; jin
// par nahi tha unke liye ab bhi universal haptic mil jata hai.
document.addEventListener('pointerdown', function (e) {
  const target = e.target.closest('.btn,.tab-btn,.sub-tab-btn,.quick-action,.nav-item,.cat-chip');
  if (!target) return;
  try {
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const span = document.createElement('span');
    span.className = 'tt-ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (e.clientX - rect.left - size / 2) + 'px';
    span.style.top = (e.clientY - rect.top - size / 2) + 'px';
    target.appendChild(span);
    setTimeout(function () { span.remove(); }, 520);
  } catch (err) {}
}, { passive: true });

// PROFESSIONAL ICON SET: bottom nav ke emoji ki jagah clean Lucide vector icons.
// Agar kisi wajah se icon library CDN load na ho (jaise net slow/blocked), to
// turant purana emoji wapas dikh jata hai - app kabhi icon-less nahi dikhega.
function ttInitLucideIcons() {
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    } else {
      throw new Error('lucide not loaded');
    }
  } catch (e) {
    document.querySelectorAll('.nav-icon[data-fallback]').forEach(function (el) {
      if (!el.querySelector('svg')) el.textContent = el.getAttribute('data-fallback');
    });
  }
}
document.addEventListener('DOMContentLoaded', function () { setTimeout(ttInitLucideIcons, 50); });
// CDN dheere load ho to window 'load' par ek baar aur try (fail ho to emoji fallback rehta hai)
window.addEventListener('load', function () { setTimeout(ttInitLucideIcons, 0); });

// ACTIVE TAB FLOATING PILL: bottom nav ke active item ke neeche ek glowing pill
// hoti hai jo spring-physics (bouncy) animation ke sath doosre tab tak slide
// karti hai - jaisa premium native apps me hota hai.
function ttUpdateNavPill(el) {
  try {
    const pill = document.getElementById('navActivePill');
    const navBar = document.querySelector('.nav-bar');
    if (!pill || !navBar) return;
    if (!el) el = document.querySelector('.nav-item.active');
    if (!el) return;
    const navRect = navBar.getBoundingClientRect();
    const itemRect = el.getBoundingClientRect();
    const x = (itemRect.left - navRect.left) + (itemRect.width - pill.offsetWidth) / 2;
    pill.style.transform = 'translateX(' + Math.round(x) + 'px)';
    pill.classList.add('ready');
  } catch (e) {}
}
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () { ttUpdateNavPill(); }, 150);
});
window.addEventListener('resize', function () { ttUpdateNavPill(); });

/* ===== PULL-TO-REFRESH (mobile gesture) ===== */
/* Screen ko sabse top se neeche kheenchne par saara data dobara render ho jata
   hai + pending offline changes bhi push ho jate hain - koi existing listener
   ya onclick handler isse nahi chhua jata, sirf touch gesture upar add hua hai. */
(function () {
  let startY = 0, pulling = false, triggered = false;
  const THRESHOLD = 68;
  // SETTLE GUARD: iOS/Android par upar scroll karte waqt momentum se scrollTop
  // 0 pe aakar thoda "rubber-band" bounce karta hai - agar hum turant usi pal
  // ek naya touch start maan kar pulling arm kar de, to beech scroll mein hi
  // (jabhi scrollTop 0 pe settle hua) refresh trigger ho jata tha. Ab hum
  // scrollTop 0 hue ko kam se kam SETTLE_MS tak stable rehna padta hai, tabhi
  // naya pull-to-refresh gesture arm hota hai - sirf poora top pe aa kar,
  // rukkar, phir neeche kheenchne par hi refresh hoga, beech mein kabhi nahi.
  const SETTLE_MS = 150;
  let lastScrollAt = 0;
  let lastScrollTop = 0;

  function scrollParent(el) {
    const root = document.scrollingElement || document.documentElement;
    while (el && el !== document.body && el !== document.documentElement) {
      let cs;
      try { cs = window.getComputedStyle(el); } catch (e) { break; }
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) return el;
      el = el.parentElement;
    }
    return root;
  }

  window.addEventListener('scroll', function () {
    const root = document.scrollingElement || document.documentElement;
    if (root.scrollTop !== lastScrollTop) { lastScrollTop = root.scrollTop; lastScrollAt = Date.now(); }
  }, { passive: true, capture: true });

  document.addEventListener('touchstart', function (e) {
    if (window.TT_DISABLE_PTR) { pulling = false; return; }
    if (!e.touches || e.touches.length !== 1) return;
    const sp = scrollParent(e.target);
    const root = document.scrollingElement || document.documentElement;
    const atTop = root.scrollTop <= 0;
    const settled = (Date.now() - lastScrollAt) > SETTLE_MS;
    if (sp !== root || !atTop || !settled) { pulling = false; return; }
    startY = e.touches[0].clientY;
    pulling = true;
    triggered = false;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!pulling || !e.touches || e.touches.length !== 1) return;
    // Beech mein agar page thoda bhi scroll ho gaya (scrollTop > 0), to yeh
    // ek genuine pull-to-refresh gesture nahi raha - cancel kar do.
    const root = document.scrollingElement || document.documentElement;
    if (root.scrollTop > 0) { pulling = false; hidePullIndicator(); return; }
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { hidePullIndicator(); return; }
    const ind = document.getElementById('ttPullRefreshIndicator');
    const icon = document.getElementById('ttPullRefreshIcon');
    const label = document.getElementById('ttPullRefreshLabel');
    if (!ind) return;
    const dist = Math.min(dy, 110);
    ind.classList.add('visible');
    ind.style.transform = 'translate(-50%,' + (-70 + dist) + 'px)';
    if (dy > THRESHOLD) {
      if (!triggered) { triggered = true; if (icon) icon.style.transform = 'rotate(180deg)'; if (label) label.textContent = 'Release to refresh'; }
    } else {
      if (triggered) { triggered = false; if (icon) icon.style.transform = 'rotate(0deg)'; if (label) label.textContent = 'Pull to refresh'; }
    }
  }, { passive: true });

  document.addEventListener('touchend', function () {
    if (!pulling) return;
    pulling = false;
    if (triggered) { doPullRefresh(); } else { hidePullIndicator(); }
  }, { passive: true });

  function hidePullIndicator() {
    const ind = document.getElementById('ttPullRefreshIndicator');
    if (ind) { ind.classList.remove('visible'); ind.style.transform = 'translate(-50%,-70px)'; }
  }

  function doPullRefresh() {
    const ind = document.getElementById('ttPullRefreshIndicator');
    const label = document.getElementById('ttPullRefreshLabel');
    if (ind) { ind.classList.add('spinning'); ind.style.transform = 'translate(-50%,10px)'; }
    if (label) label.textContent = 'Refreshing...';
    try { triggerAppHaptic(); } catch (e) {}
    try { ttFlushOfflineQueue(); } catch (e) {}
    setTimeout(function () {
      try { if (typeof refreshAllData === 'function') refreshAllData(); } catch (e) { console.error('Pull-to-refresh failed', e); }
      if (ind) ind.classList.remove('spinning');
      if (label) label.textContent = 'Updated';
      setTimeout(hidePullIndicator, 650);
    }, 500);
  }
})();
// Safety fallback: agar kisi wajah se dashboard render kabhi na chale, to bhi
// skeleton hamesha ke liye atka na rahe
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    const skel = document.getElementById('ttDashSkeleton');
    if (skel) skel.style.display = 'none';
  }, 6000);
});

/* ===== Soft Toast helper (error + retry / success) - reuses existing broadcast toast container ===== */
function ttShowSoftToast(message, variant, retryFn) {
  const container = document.getElementById('broadcastToastContainer');
  if (!container) { if (variant === 'error') alert(message); return; }
  const toast = document.createElement('div');
  toast.className = 'broadcast-toast ' + (variant === 'error' ? 'tt-toast-error' : 'tt-toast-success');
  const icon = variant === 'error' ? '⚠️' : '✅';
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-icon">${icon}</div>
      <div style="flex:1;">
        <div class="toast-title">${variant === 'error' ? 'Sync Problem' : 'Synced'}</div>
        <div class="toast-body">${message}</div>
        ${retryFn ? '<div class="tt-toast-actions"><button class="tt-toast-retry-btn" type="button">🔄 Retry</button></div>' : ''}
      </div>
      <button class="toast-close" onclick="this.closest('.broadcast-toast').remove()">✕</button>
    </div>`;
  if (retryFn) {
    const btn = toast.querySelector('.tt-toast-retry-btn');
    if (btn) btn.onclick = function () { toast.remove(); try { retryFn(); } catch (e) { console.error(e); } };
  }
  container.prepend(toast);
  setTimeout(function () { if (toast.parentElement) toast.remove(); }, variant === 'error' ? 15000 : 5000);
}
// Chhota sa throttle: ek hi error type ki toast baar-baar (loop me) na dikhe
var _ttLastErrorToastAt = 0;
function ttShowErrorToast(message, retryFn) {
  const now = Date.now();
  if (now - _ttLastErrorToastAt < 4000) return; // 4s ke andar dusri error toast skip
  _ttLastErrorToastAt = now;
  ttShowSoftToast(message, 'error', retryFn);
}
function ttShowSuccessToast(message) { ttShowSoftToast(message, 'success', null); }
window.ttShowErrorToast = ttShowErrorToast;
window.ttShowSuccessToast = ttShowSuccessToast;

function setStored(key, val) {
  try {
    try {
      localStorage.setItem(DB_PREFIX + key, JSON.stringify(val));
    } catch (qe) {
      // Phone ki local storage (≈5MB) photos se bhar jaye to pehle yahin error aakar
      // CLOUD PUSH bhi ruk jata tha (delivery cloud tak nahi jati thi). Ab cloud push
      // hamesha hota hai; local me photo-rahit halki copy rakhte hain.
      console.warn('Local storage full, light copy save', key, qe);
      try {
        const light = JSON.stringify(val, function (k, v) { return (typeof v === 'string' && v.length > 5000 && v.indexOf('data:') === 0) ? '' : v; });
        localStorage.setItem(DB_PREFIX + key, light);
      } catch (qe2) { console.warn('The lightweight copy could not be saved either', key); }
    }
    // NOTE: yaha se koi bhi record automatically cloud se delete nahi kiya jata -
    // data hamesha cloud me surakshit rehta hai. Delete sirf kisi explicit delete button se hi hoga.
    ttCloudPush(key, val);
  } catch(e) {
    console.error("Storage error:", e);
  }
}
window.setStored = setStored;

function toggleThemeMode() {
  const body = document.body;
  const current = body.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  body.setAttribute('data-theme', next);
  setStored("THEME_MODE", next);
  updateThemeMenuLabel(next);
}

function updateThemeMenuLabel(mode) {
  const el = document.getElementById('currentThemeTag');
  if (el) el.textContent = (mode === 'dark') ? 'Dark 🌙' : 'Light ☀️';
}

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = getStored("THEME_MODE", "light");
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeMenuLabel(savedTheme);
});

function toggleProfileDrawer(e) {
  // SMOOTH OPEN/CLOSE: purana code seedha display='block'/'none' karta tha
  // (achanak "dhadam se" jump). Ab '.show' + '.profile-open' class add/remove
  // hoti hai - CSS transition khud panel ko bubble ke andar se smoothly
  // expand/collapse karta hai, aur bubble par sonar-pulse glow chalata hai.
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const card = document.getElementById('profileDropdownCard');
  const btn = document.getElementById('profileHeaderTriggerBtn');
  if (!card) return;
  const isOpen = card.classList.contains('show');
  if (isOpen) {
    card.classList.remove('show');
    if (btn) btn.classList.remove('profile-open');
  } else {
    card.classList.add('show');
    if (btn) btn.classList.add('profile-open');
  }
}
window.toggleProfileDrawer = toggleProfileDrawer;

function closeProfileDrawer() {
  const card = document.getElementById('profileDropdownCard');
  const btn = document.getElementById('profileHeaderTriggerBtn');
  if (card) card.classList.remove('show');
  if (btn) btn.classList.remove('profile-open');
}
window.closeProfileDrawer = closeProfileDrawer;

document.addEventListener('click', function(e) {
  const card = document.getElementById('profileDropdownCard');
  const btn = document.getElementById('profileHeaderTriggerBtn');
  if (card && card.classList.contains('show')) {
    if (!card.contains(e.target) && !btn.contains(e.target)) {
      card.classList.remove('show');
      if (btn) btn.classList.remove('profile-open');
    }
  }
});

let registeredEmployees = getStored("STAFF", []);
window.registeredEmployees = registeredEmployees;

let currentUser = (function () {
  const u = getStored("SESSION_USER", null);
  if (!u) return null;
  const c = Object.assign({}, u); delete c.pass; delete c.pin; delete c.passHash; delete c.pinHash;
  return c;
})();
// Admin check ko case/whitespace ki galti se surakshit banaya (jaise 'admin' ya ' Admin ' register ho gaya ho)
function isAdminUser() { return !!(currentUser && String(currentUser.role || '').trim().toLowerCase() === 'admin'); }
window.isAdminUser = isAdminUser;

let customerDatabase = getStored("CUSTOMERS", (window.TTESPL_MASTER_DATA && window.TTESPL_MASTER_DATA.customers) || [
  { id: 1, name: "Trinity Techno Solution", person: "Trinity Techno Solution", phone: "6371256123", email: "", address: "Plot No-1159/2782, Behind Debaki Tower, Bomikhal, Khordha", gst: "21DDTPM0058K1ZC" }
]);
window.customerDatabase = customerDatabase;

let sampleInventory = getStored("INVENTORY", (window.TTESPL_MASTER_DATA && window.TTESPL_MASTER_DATA.inventory) || [
  { id: 1001, name: "valve kit -A,", code: "2186", category: "Machine Spares", machine: "HRC", stock: 10, dealerPrice: 1205.96, rate: 1608.34, hsn: "84139190", desc: "Spare part for HRC. Code: 2186", specs: "Machine Model: HRC | Part Code: 2186" }
]);
window.sampleInventory = sampleInventory;

let machineryDatabase = getStored("MACHINERY", [
  { id: 201, name: "AR Triplex 200 Bar Commercial Washer", pump: "AR 15.20", motor: "5 HP 3-Phase", bar: 200, price: 85000 },
  { id: 202, name: "AR 680 (1Φ) Compact Washer", pump: "AR Triplex", motor: "3 HP Single-Phase", bar: 150, price: 64834 },
  { id: 203, name: "HRC PRO 11.11 ET (1Φ)", pump: "AR Commercial", motor: "4 HP Single-Phase", bar: 110, price: 114263 },
  { id: 204, name: "HRR Pro Three-Phase Washer", pump: "AR 1450 RPM", motor: "5.5 HP 3-Phase", bar: 140, price: 132660 },
  { id: 205, name: "HRG Pro High-Flow LCV/HCV", pump: "AR Heavy Flow", motor: "7.5 HP 3-Phase", bar: 150, price: 150754 },
  { id: 206, name: "FX-1D Single Hose Steamjet", pump: "Kyong Dong Burner DC", motor: "CPU 200W + Burner", bar: 9, price: 509110 },
  { id: 207, name: "EXCEL M 77/2 Double Motor Vacuum", pump: "Dual By-pass Motor", motor: "2600W (2x 1300W)", bar: 0, price: 55213 }
]);
window.machineryDatabase = machineryDatabase;

let leadsData = getStored("LEADS", []);
window.leadsData = leadsData;

let ordersData = getStored("ORDERS", []);
let machinePartsData = getStored("MACHINE_PARTS", []);
window.machinePartsData = machinePartsData;
window.ordersData = ordersData;

let serviceCallsData = getStored("SERVICES", []);
window.serviceCallsData = serviceCallsData;

/* FLOATING FILTER MODAL LOGIC FOR LEADS, ORDERS, SERVICES */
let activeFilterSection = 'orders';
let ordersFilterState = { staff: "ALL", from: "", to: "" };
let leadsFilterState = { staff: "ALL", from: "", to: "" };
let servicesFilterState = { staff: "ALL", from: "", to: "" };

function openFilterModal(section) {
  activeFilterSection = section;
  const modal = document.getElementById('globalFilterModal');
  const title = document.getElementById('filterModalTitle');
  const st = (section === 'leads') ? leadsFilterState : (section === 'services' ? servicesFilterState : ordersFilterState);

  title.textContent = `🔍 Filter ${section.toUpperCase()} By Date & Staff`;
  document.getElementById('popFilterDateFrom').value = st.from;
  document.getElementById('popFilterDateTo').value = st.to;
  document.getElementById('popFilterStaff').value = st.staff;
  modal.style.display = 'block';
}

function closeFilterModal() {
  document.getElementById('globalFilterModal').style.display = 'none';
}

function applyModalFilter() {
  const from = document.getElementById('popFilterDateFrom').value;
  const to = document.getElementById('popFilterDateTo').value;
  const staff = document.getElementById('popFilterStaff').value;

  if (activeFilterSection === 'leads') {
    leadsFilterState = { from, to, staff };
    renderLeads();
  } else if (activeFilterSection === 'services') {
    servicesFilterState = { from, to, staff };
    renderServices();
  } else {
    ordersFilterState = { from, to, staff };
    renderOrders();
  }
  closeFilterModal();
}

function resetModalFilter() {
  document.getElementById('popFilterDateFrom').value = "";
  document.getElementById('popFilterDateTo').value = "";
  document.getElementById('popFilterStaff').value = "ALL";
  applyModalFilter();
}

function openGlobalSearchModal() {
  document.getElementById('globalSearchModal').style.display = 'flex';
  const inp = document.getElementById('globalSearchInput');
  inp.value = "";
  document.getElementById('globalSearchResults').innerHTML = `<div class="empty-state"><span class="empty-icon">🔎</span><div class="empty-sub">Type a customer, order ref, machine, item code or phone...</div></div>`;
  setTimeout(() => inp.focus(), 150);
}
function closeGlobalSearchModal() { document.getElementById('globalSearchModal').style.display = 'none'; }
window.openGlobalSearchModal = openGlobalSearchModal;
window.closeGlobalSearchModal = closeGlobalSearchModal;

function performGlobalSearch(qRaw) {
  const q = (qRaw || "").trim().toLowerCase();
  const box = document.getElementById('globalSearchResults');
  if (q.length < 2) {
    box.innerHTML = `<div class="empty-state"><span class="empty-icon">🔎</span><div class="empty-sub">Type at least 2 letters...</div></div>`;
    return;
  }

  const navItems = document.querySelectorAll('.nav-item');
  let results = [];

  ordersData.forEach(o => {
    if ((o.customerName || "").toLowerCase().includes(q) || (o.id || "").toLowerCase().includes(q) || (o.phone || "").includes(q)) {
      results.push({
        type: "📦 Order", title: o.customerName,
        sub: `${o.id} • ₹${Number(o.totalAmount || 0).toLocaleString('en-IN')} • ${o.status}`,
        action: () => { closeGlobalSearchModal(); switchTab('orders', navItems[2]); setTimeout(() => editOrderPrompt(o.id), 220); }
      });
    }
  });

  leadsData.forEach(l => {
    if ((l.customerName || "").toLowerCase().includes(q) || (l.machine || "").toLowerCase().includes(q)) {
      results.push({
        type: "🎯 Lead", title: l.customerName,
        sub: `${l.machine || ''} • ${l.status || ''}`,
        action: () => { closeGlobalSearchModal(); switchTab('leads', navItems[1]); setTimeout(() => editLeadPrompt(l.id), 220); }
      });
    }
  });

  serviceCallsData.forEach(s => {
    if ((s.customerName || "").toLowerCase().includes(q) || (s.machine || "").toLowerCase().includes(q) || (s.problem || "").toLowerCase().includes(q)) {
      results.push({
        type: "🛠️ Service", title: s.customerName,
        sub: `${s.machine || ''} • ${s.status || ''}`,
        action: () => { closeGlobalSearchModal(); switchTab('services', navItems[3]); setTimeout(() => editServicePrompt(s.id), 220); }
      });
    }
  });

  sampleInventory.forEach(it => {
    if ((it.name || "").toLowerCase().includes(q) || (it.code || "").toLowerCase().includes(q)) {
      results.push({
        type: "🏷️ Item", title: it.name,
        sub: `Code: ${it.code || '-'} • Stock: ${it.stock}`,
        action: () => { closeGlobalSearchModal(); switchTab('inventory', navItems[4]); setTimeout(() => editStockItemPrompt(it.id), 220); }
      });
    }
  });

  customerDatabase.forEach(c => {
    if ((c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)) {
      results.push({
        type: "👤 Customer", title: c.name,
        sub: c.phone || "",
        action: () => { closeGlobalSearchModal(); editCustomerPrompt(c.id); }
      });
    }
  });

  if (results.length === 0) {
    box.innerHTML = `<div class="empty-state"><span class="empty-icon">🚫</span><div class="empty-sub">No results for "${esc(qRaw)}".</div></div>`;
    return;
  }

  box.innerHTML = results.slice(0, 30).map((r, idx) => `
    <div class="search-result-row" data-idx="${idx}">
      <div>
        <span class="badge badge-info" style="margin-right:6px;">${r.type}</span>
        <strong style="font-size:13px;">${esc(r.title)}</strong>
        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${esc(r.sub)}</div>
      </div>
      <span style="font-size:16px; color:var(--text-muted);">→</span>
    </div>
  `).join('');

  results.slice(0, 30).forEach((r, idx) => {
    const row = box.querySelector(`[data-idx="${idx}"]`);
    if (row) row.onclick = r.action;
  });
}
window.performGlobalSearch = performGlobalSearch;

let teamChatData = [
  { sender: "Dipak Kumar Rout", text: "Welcome to TTESPL premium team messenger! 🚀", time: "10:00 AM" },
  { sender: "System Bot", text: "Live sync active across all ERP modules.", time: "10:01 AM" }
];
window.teamChatData = teamChatData;
let currentOrderSubTab = 'active';

/* AUTH & SESSION */
function checkAuthSession() {
  if(!currentUser) {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('mainAppWrapper').style.display = 'none';
  } else {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainAppWrapper').style.display = 'block';
    ttSeedNavHistory();
    
    const initial = (currentUser.name && currentUser.name.trim().length > 0) ? currentUser.name.trim().charAt(0).toUpperCase() : 'U';
    const avatarEl = document.getElementById('headerProfileAvatarInitial');
    if (avatarEl) avatarEl.textContent = initial;

    const dotEl = document.getElementById('headerProfileDot');
    if (dotEl) {
      if (isAdminUser()) dotEl.classList.add('admin');
      else dotEl.classList.remove('admin');
    }

    const mName = document.getElementById('menuStaffName');
    if (mName) mName.textContent = currentUser.name;

    const mRole = document.getElementById('menuStaffRole');
    if (mRole) {
      mRole.textContent = currentUser.role || 'STAFF';
      if (isAdminUser()) mRole.classList.add('admin');
      else mRole.classList.remove('admin');
    }

    const mPhone = document.getElementById('menuStaffPhone');
    if (mPhone) mPhone.textContent = `Mob: ${currentUser.mobile || 'Verified'}`;

    updateAdminDeleteVisibility();
    refreshAllData();
  }
}

function updateAdminDeleteVisibility() {
  const isAdmin = isAdminUser();
  document.querySelectorAll('.admin-only-btn').forEach(btn => {
    btn.style.display = isAdmin ? 'inline-flex' : 'none';
  });
  const staffMenuBtn = document.getElementById('menuAdminStaffBtn');
  if (staffMenuBtn) staffMenuBtn.style.display = isAdmin ? 'flex' : 'none';
}
window.updateAdminDeleteVisibility = updateAdminDeleteVisibility;

function showAuthMode(mode) {
  try {
    const ro = document.getElementById('regRole');
    if (ro) Array.from(ro.options).forEach(o => { if (o.value === 'Admin') { o.hidden = o.disabled = registeredEmployees.length > 0; if (o.disabled && ro.value === 'Admin') ro.selectedIndex = 0; } });
  } catch (e) {}
  document.getElementById('loginFormSection').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('registerFormSection').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('forgotFormSection').style.display = mode === 'forgot' ? 'block' : 'none';
}

/* ===== SECURE CREDENTIALS (hashed password + PIN, lockout, no self-made Admin) =====
   - Password / PIN ab plain text me kahin save nahi hote (cloud + device dono me sirf PBKDF2 hash).
   - Purane plain-text accounts pehli successful login par apne-aap hash me badal jate hain.
   - 5 galat try ke baad 5 minute ka lock.
   NOTE: Ye client-side suraksha hai. Asli suraksha ke liye Firestore Rules zaroori hain (firestore.rules dekho). */
const TT_ROLES = ['Machinery Specialist', 'Field Technician', 'Sales & Support', 'Store Manager', 'Admin'];
const TT_PBKDF2_ITER = 150000;

function ttSha256Fallback(str) {
  // chhota pure-JS SHA-256 (sirf tab jab browser me crypto.subtle na ho, jaise plain http)
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const b = new TextEncoder().encode(str), l = b.length, n = (((l + 9 + 63) >> 6) << 6), m = new Uint8Array(n);
  m.set(b); m[l] = 0x80; const dv = new DataView(m.buffer); dv.setUint32(n - 4, (l * 8) >>> 0); dv.setUint32(n - 8, Math.floor(l * 8 / 4294967296));
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Array(64), rr = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = rr(w[i-15],7) ^ rr(w[i-15],18) ^ (w[i-15] >>> 3), s1 = rr(w[i-2],17) ^ rr(w[i-2],19) ^ (w[i-2] >>> 10); w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0; }
    let [a, bb, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rr(e,6) ^ rr(e,11) ^ rr(e,25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((rr(a,2) ^ rr(a,13) ^ rr(a,22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    h = [h[0]+a|0, h[1]+bb|0, h[2]+c|0, h[3]+d|0, h[4]+e|0, h[5]+f|0, h[6]+g|0, h[7]+hh|0];
  }
  return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
function ttToHex(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''); }
function ttRandomSalt() { const a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.floor(Math.random() * 256)); return ttToHex(a); }
async function ttHashSecret(secret, salt) {
  salt = salt || ttRandomSalt();
  if (window.crypto && crypto.subtle) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secret)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: TT_PBKDF2_ITER, hash: 'SHA-256' }, key, 256);
    return 'pbkdf2$' + TT_PBKDF2_ITER + '$' + salt + '$' + ttToHex(bits);
  }
  let h = salt + ':' + secret; for (let i = 0; i < 2000; i++) h = ttSha256Fallback(h + salt);
  return 'sha256$2000$' + salt + '$' + h;
}
function ttSafeEqual(a, b) { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; }
async function ttVerifyHash(secret, stored) {
  const p = String(stored || '').split('$'); if (p.length !== 4) return false;
  if (p[0] === 'pbkdf2' && !(window.crypto && crypto.subtle)) return false;
  const again = await ttHashSecret(secret, p[2]); return ttSafeEqual(again.split('$')[3], p[3]) && again.split('$')[0] === p[0];
}
/* field = 'pass' | 'pin'. Hash ho to hash se, warna purane plain-text se match karke turant hash me migrate */
async function ttCheckSecret(user, field, secret) {
  if (!user) return false;
  const hk = field + 'Hash';
  if (user[hk]) return ttVerifyHash(secret, user[hk]);
  if (user[field] != null && user[field] !== '' && ttSafeEqual(user[field], secret)) {
    try { user[hk] = await ttHashSecret(secret); delete user[field]; setStored('STAFF', registeredEmployees); } catch (e) {}
    return true;
  }
  return false;
}
function ttPublicUser(u) { if (!u) return null; const c = Object.assign({}, u); delete c.pass; delete c.pin; delete c.passHash; delete c.pinHash; return c; }
function ttCleanText(s, max) { return String(s == null ? '' : s).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 60); }
function ttEscHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
window.ttEscHtml = ttEscHtml;

/* login lock (device par): 5 galat try -> 5 min */
const TT_LOGIN_GUARD_KEY = DB_PREFIX + 'LOGIN_GUARD';
function ttLoginGuardState(id) { try { const g = JSON.parse(localStorage.getItem(TT_LOGIN_GUARD_KEY) || '{}'); return g[id] || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } }
function ttLoginGuardSave(id, st) { try { const g = JSON.parse(localStorage.getItem(TT_LOGIN_GUARD_KEY) || '{}'); if (st) g[id] = st; else delete g[id]; localStorage.setItem(TT_LOGIN_GUARD_KEY, JSON.stringify(g)); } catch (e) {} }
function ttLoginGuardMsg(id) { const s = ttLoginGuardState(id); if (s.until > Date.now()) return 'Too many wrong attempts. Try again in ' + Math.ceil((s.until - Date.now()) / 60000) + ' minute(s).'; return ''; }
function ttLoginGuardFail(id) { const s = ttLoginGuardState(id); s.n = (s.n || 0) + 1; if (s.n >= 5) { s.until = Date.now() + 5 * 60000; s.n = 0; } ttLoginGuardSave(id, s); }
function ttLoginGuardClear(id) { ttLoginGuardSave(id, null); }

async function processLogin() {
  const p = document.getElementById('loginPhone').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  const lk = ttLoginGuardMsg(p); if (lk) { alert(lk); return; }
  const user = registeredEmployees.find(u => u.mobile === p);
  if (user && await ttCheckSecret(user, 'pass', pass)) {
    ttLoginGuardClear(p);
    if (user.pin != null && user.pin !== '' && !user.pinHash) { try { user.pinHash = await ttHashSecret(String(user.pin)); delete user.pin; setStored('STAFF', registeredEmployees); } catch (e) {} }
    currentUser = ttPublicUser(user);
    setStored("SESSION_USER", currentUser);
    checkAuthSession();
    requestAppSystemPermissions();
  } else {
    ttLoginGuardFail(p);
    alert(ttLoginGuardMsg(p) || "Invalid Mobile Number or Password!");
  }
}

async function processRegister() {
  const name = ttCleanText(document.getElementById('regName').value, 50);
  const mobile = document.getElementById('regPhone').value.trim();
  const role = document.getElementById('regRole').value;
  const pass = document.getElementById('regPass').value.trim();
  const pin = document.getElementById('regPin').value.trim();

  if (!name || !/^\d{10}$/.test(mobile) || pass.length < 6 || !/^(\d{4}|\d{6})$/.test(pin)) {
    alert("Please fill all details correctly: name, 10-digit mobile, password (min 6 characters) and a 4 or 6-digit PIN.");
    return;
  }
  if (TT_ROLES.indexOf(role) < 0) { alert("Invalid role selected."); return; }
  if (registeredEmployees.some(u => u.mobile === mobile)) {
    alert("An account already exists with this mobile number!");
    return;
  }
  // Admin sirf sabse pehla account ban sakta hai; baad me sirf maujooda Admin (Staff Manager) hi Admin bana sakta hai
  const firstEver = registeredEmployees.length === 0;
  if (role === 'Admin' && !firstEver) { alert("Admin accounts can only be created by an existing Admin. Choose another role."); return; }

  const newEmp = { id: Date.now(), name, mobile, role, passHash: await ttHashSecret(pass), pinHash: await ttHashSecret(pin) };
  registeredEmployees.push(newEmp);
  setStored("STAFF", registeredEmployees);
  currentUser = ttPublicUser(newEmp);
  setStored("SESSION_USER", currentUser);
  alert(`Welcome ${name}! Registration successful as ${role}.`);
  checkAuthSession();
}

async function processPasswordReset() {
  const mobile = document.getElementById('recPhone').value.trim();
  const pin = document.getElementById('recPin').value.trim();
  const newPass = document.getElementById('recNewPass').value.trim();
  const lk = ttLoginGuardMsg('reset:' + mobile); if (lk) { alert(lk); return; }
  const user = registeredEmployees.find(u => u.mobile === mobile);
  if (user && await ttCheckSecret(user, 'pin', pin)) {
    if (newPass.length < 6) { alert("Password must be at least 6 characters!"); return; }
    ttLoginGuardClear('reset:' + mobile);
    user.passHash = await ttHashSecret(newPass); delete user.pass;
    setStored("STAFF", registeredEmployees);
    alert("Password updated successfully! Please login now.");
    showAuthMode('login');
  } else {
    ttLoginGuardFail('reset:' + mobile);
    alert(ttLoginGuardMsg('reset:' + mobile) || "Security PIN or Mobile Number did not match records!");
  }
}

function performFullLogout() {
  if(confirm("Confirm Logout from TTESPL ERP Portal?")) {
    currentUser = null;
    localStorage.removeItem(DB_PREFIX + "SESSION_USER");
    checkAuthSession();
  }
}

function getNowStr() {
  const d = new Date();
  return ttYmd(d) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function refreshAllData() {
  populateDropdownsAndDatalists();
  renderDashboard();
  renderLeads();
  renderOrders();
  renderServices();
  renderStockList();
  renderBilling('all');
  renderChatMessages();
  updateGlobalReminders();
  updateAdminDeleteVisibility();
}
window.refreshAllData = refreshAllData;

/* DISTINCT COLORS IN EMPLOYEE DROPDOWN (NAME & POSITION) */
function populateDropdownsAndDatalists() {
  const formatEmpOption = (e) => {
    return `<option value="${ttEscHtml(e.name)}" style="font-weight:700; color:#0a2540;">${ttEscHtml(e.name)} — [${e.role}]</option>`;
  };

  document.querySelectorAll('.emp-dropdown').forEach(sel => {
    const curVal = sel.value;
    sel.innerHTML = registeredEmployees.map(e => formatEmpOption(e)).join('');
    if(curVal) sel.value = curVal;
  });

  const bFilter = document.getElementById('billingEmployeeFilter');
  if(bFilter) {
    const curB = bFilter.value;
    bFilter.innerHTML = `<option value="ALL">All Staff Combined</option>` + registeredEmployees.map(e => formatEmpOption(e)).join('');
    if(curB) bFilter.value = curB;
  }

  document.querySelectorAll('.all-staff-filter').forEach(sel => {
    const curVal = sel.value;
    sel.innerHTML = `<option value="ALL">All Staff Combined</option>` + registeredEmployees.map(e => formatEmpOption(e)).join('');
    if(curVal) sel.value = curVal;
  });
}
window.populateDropdownsAndDatalists = populateDropdownsAndDatalists;

function openProfitCalculatorModal() {
  document.getElementById('calcCostPrice').value = "";
  document.getElementById('calcSellPrice').value = "";
  document.getElementById('calcProfitAmt').textContent = "₹0";
  document.getElementById('calcProfitMargin').textContent = "0%";
  document.getElementById('calcMarkupPct').textContent = "0%";
  document.getElementById('profitCalculatorModal').style.display = 'flex';
}
function closeProfitCalculatorModal() {
  document.getElementById('profitCalculatorModal').style.display = 'none';
}
function calculateProfitMargins() {
  const cost = parseFloat(document.getElementById('calcCostPrice').value) || 0;
  const sell = parseFloat(document.getElementById('calcSellPrice').value) || 0;
  if (cost <= 0 || sell <= 0) {
    document.getElementById('calcProfitAmt').textContent = "₹0";
    document.getElementById('calcProfitMargin').textContent = "0%";
    document.getElementById('calcMarkupPct').textContent = "0%";
    return;
  }
  const profit = sell - cost;
  const margin = (profit / sell) * 100;
  const markup = (profit / cost) * 100;

  document.getElementById('calcProfitAmt').textContent = '₹' + profit.toLocaleString('en-IN', {maximumFractionDigits: 2});
  document.getElementById('calcProfitMargin').textContent = margin.toFixed(2) + '%';
  document.getElementById('calcMarkupPct').textContent = markup.toFixed(2) + '%';
}

function openAgeingAnalysisModal() {
  const container = document.getElementById('ageingReportContainer');
  const today = new Date();
  let buckets = { '0-30 Days': 0, '31-60 Days': 0, '61-90 Days': 0, '90+ Days': 0 };
  let details = { '0-30 Days': [], '31-60 Days': [], '61-90 Days': [], '90+ Days': [] };

  ordersData.filter(o => o.status === 'Delivered' && o.dueAmount > 0).forEach(o => {
    const invDate = new Date(o.deliveredDate || o.orderDate);
    const diffDays = Math.floor((today - invDate) / (1000 * 60 * 60 * 24));
    let bucketKey = '90+ Days';
    if (diffDays <= 30) bucketKey = '0-30 Days';
    else if (diffDays <= 60) bucketKey = '31-60 Days';
    else if (diffDays <= 90) bucketKey = '61-90 Days';
    buckets[bucketKey] += o.dueAmount;
    details[bucketKey].push(o);
  });

  let html = '';
  Object.keys(buckets).forEach(bKey => {
    html += `
      <div style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong style="color:var(--primary); font-size:13.5px;">⏳ ${bKey}</strong>
          <span style="font-size:15px; font-weight:800; color:var(--danger);">₹${buckets[bKey].toLocaleString('en-IN')}</span>
        </div>
        <div style="font-size:11px; color:var(--text-muted);">Total Invoices: ${details[bKey].length}</div>
      </div>
    `;
  });
  container.innerHTML = html;
  document.getElementById('ageingAnalysisModal').style.display = 'flex';
}
function closeAgeingAnalysisModal() {
  document.getElementById('ageingAnalysisModal').style.display = 'none';
}

function openPerformanceReportModal() {
  const container = document.getElementById('performanceReportContainer');
  const reportMap = {};
  registeredEmployees.forEach(emp => {
    reportMap[emp.name] = { role: emp.role, totalBilled: 0, totalCollected: 0, orderCount: 0 };
  });
  ordersData.filter(o => o.status === 'Delivered').forEach(o => {
    const staffName = o.bookedBy || "Unassigned";
    if (!reportMap[staffName]) reportMap[staffName] = { role: "Staff", totalBilled: 0, totalCollected: 0, orderCount: 0 };
    reportMap[staffName].totalBilled += (o.totalAmount || 0);
    reportMap[staffName].totalCollected += (o.recvAmount || 0);
    reportMap[staffName].orderCount += 1;
  });

  let html = '';
  Object.keys(reportMap).forEach(staff => {
    const data = reportMap[staff];
    html += `
      <div style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong>👤 ${ttEscHtml(staff)}</strong>
          <span class="badge badge-info">${ttEscHtml(data.role)}</span>
        </div>
        <div class="grid-3" style="font-size:11.5px; margin-top:6px;">
          <div>Invoices: <strong>${data.orderCount}</strong></div>
          <div>Billed: <strong>₹${data.totalBilled.toLocaleString('en-IN')}</strong></div>
          <div>Collected: <strong style="color:var(--success);">₹${data.totalCollected.toLocaleString('en-IN')}</strong></div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  document.getElementById('performanceReportModal').style.display = 'flex';
}
function closePerformanceReportModal() {
  document.getElementById('performanceReportModal').style.display = 'none';
}

function openStaffManageModal() {
  if (!isAdminUser()) {
    alert("Permission Denied: Only Admin can manage staff.");
    return;
  }
  const box = document.getElementById('staffManageList');
  box.innerHTML = registeredEmployees.map(emp => `
    <div style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong>${ttEscHtml(emp.name)}</strong>
        <span class="badge ${emp.role === 'Admin' ? 'badge-delivered' : 'badge-info'}">${ttEscHtml(emp.role)}</span>
      </div>
      <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;">Mobile: <strong>${ttEscHtml(emp.mobile)}</strong></div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); editStaffDetailsPrompt(${emp.id})">✏️ Edit Name / Role / Pass</button>
        ${emp.id !== currentUser.id ? `<button class="btn btn-danger-sm btn-sm" onclick="triggerAppHaptic(); deleteStaffPrompt(${emp.id})">🗑️ Delete</button>` : ''}
      </div>
    </div>
  `).join('');
  document.getElementById('staffManageModal').style.display = 'flex';
}
function closeStaffManageModal() {
  document.getElementById('staffManageModal').style.display = 'none';
}

async function editStaffDetailsPrompt(empId) {
  if (!isAdminUser()) { alert("Permission Denied: Only Admin can edit staff."); return; }
  const emp = registeredEmployees.find(e => e.id === empId);
  if (!emp) return;
  const newName = ttCleanText(prompt("Update Staff Full Name:", emp.name) || '', 50);
  if (!newName) return;
  const newRole = (prompt("Update Role (" + TT_ROLES.join(' / ') + "):", emp.role) || '').trim();
  const newPass = String(await (window.ttAskSecret ? ttAskSecret("New password (leave blank to keep the current one, min 6 characters)") : Promise.resolve(prompt("New password (leave blank to keep the current one, min 6 characters):", "")))  || '').trim();
  if (newRole && TT_ROLES.indexOf(newRole) < 0) { alert("Invalid role. Nothing was changed."); return; }
  if (newPass && newPass.length < 6) { alert("Password must be at least 6 characters. Nothing was changed."); return; }
  const admins = registeredEmployees.filter(e => String(e.role).trim().toLowerCase() === 'admin');
  if (newRole && newRole !== 'Admin' && emp.role === 'Admin' && admins.length <= 1) { alert("You cannot remove the last Admin."); return; }

  emp.name = newName;
  if (newRole) emp.role = newRole;
  if (newPass) { emp.passHash = await ttHashSecret(newPass); delete emp.pass; }

  setStored("STAFF", registeredEmployees);
  if (currentUser && currentUser.id === emp.id) {
    currentUser = ttPublicUser(emp);
    setStored("SESSION_USER", currentUser);
  }
  openStaffManageModal();
  refreshAllData();
  alert("Staff profile successfully updated!");
}

function deleteStaffPrompt(empId) {
  if (!isAdminUser()) { alert("Permission Denied: Only Admin can delete staff."); return; }
  const emp = registeredEmployees.find(e => e.id === empId);
  if (!emp) return;
  if (currentUser && emp.id === currentUser.id) { alert("You cannot delete your own account."); return; }
  const admins = registeredEmployees.filter(e => String(e.role).trim().toLowerCase() === 'admin');
  if (String(emp.role).trim().toLowerCase() === 'admin' && admins.length <= 1) { alert("You cannot delete the last Admin."); return; }
  if (confirm("Confirm permanent removal of this staff account?")) {
    registeredEmployees = registeredEmployees.filter(e => e.id !== empId);
    setStored("STAFF", registeredEmployees);
    openStaffManageModal();
    refreshAllData();
    alert("Staff permanently deleted.");
  }
}

function openAdminEditLedgerModal(ordId) {
  if (!isAdminUser()) {
    alert("Permission denied: only an Admin can modify ledger invoices.");
    return;
  }
  const o = ordersData.find(x => x.id === ordId);
  if (!o) return;

  document.getElementById('editLedgerInvId').value = o.id;
  document.getElementById('editLedgerCustName').value = o.customerName;
  document.getElementById('editLedgerTotalAmt').value = o.totalAmount;
  document.getElementById('editLedgerRecvAmt').value = o.recvAmount;
  document.getElementById('editLedgerDueAmt').value = o.dueAmount;
  document.getElementById('editLedgerPayMode').value = o.payMode;
  document.getElementById('editLedgerStaffSelect').value = o.bookedBy;
  renderEditLedgerItemRows(o.items || []);
  document.getElementById('editLedgerModal').style.display = 'flex';
}
function closeEditLedgerModal() {
  document.getElementById('editLedgerModal').style.display = 'none';
}

function calcEditLedgerBalance() {
  const tot = parseFloat(document.getElementById('editLedgerTotalAmt').value) || 0;
  const recv = parseFloat(document.getElementById('editLedgerRecvAmt').value) || 0;
  document.getElementById('editLedgerDueAmt').value = Math.max(0, tot - recv);
}

/* ===== ADMIN: FULL EDIT OF LEDGER BILL ITEMS (name / qty / line total) ===== */
function renderEditLedgerItemRows(items) {
  const box = document.getElementById('editLedgerItemsRows');
  if (!box) return;
  box.innerHTML = '';
  if (!items || !items.length) { addEditLedgerItemRow(); return; }
  items.forEach(it => addEditLedgerItemRow(it));
}
function addEditLedgerItemRow(it) {
  const box = document.getElementById('editLedgerItemsRows');
  if (!box) return;
  it = it || { name: '', qty: 1, total: 0 };
  const row = document.createElement('div');
  row.className = 'tt-ledger-item-row';
  row.style.cssText = 'display:flex; gap:6px; align-items:center;';
  row.innerHTML = `
    <input type="text" class="tt-ledger-item-name" placeholder="Item / Service name" value="${esc(it.name || '')}" style="flex:2; min-width:0;">
    <input type="number" class="tt-ledger-item-qty" placeholder="Qty" value="${it.qty != null ? it.qty : 1}" style="flex:0.6; min-width:0;">
    <input type="number" class="tt-ledger-item-total" placeholder="₹ Total" value="${it.total != null ? it.total : 0}" style="flex:1; min-width:0;">
    <button type="button" class="btn btn-danger-sm" style="padding:6px 9px;" onclick="removeEditLedgerItemRow(this)">🗑️</button>
  `;
  box.appendChild(row);
}
function removeEditLedgerItemRow(btn) {
  const row = btn.closest('.tt-ledger-item-row');
  const box = document.getElementById('editLedgerItemsRows');
  if (row) row.remove();
  if (box && !box.children.length) addEditLedgerItemRow();
}
function recalcLedgerTotalFromItems() {
  const box = document.getElementById('editLedgerItemsRows');
  if (!box) return;
  let sum = 0;
  box.querySelectorAll('.tt-ledger-item-total').forEach(inp => { sum += parseFloat(inp.value) || 0; });
  document.getElementById('editLedgerTotalAmt').value = sum;
  calcEditLedgerBalance();
}

function saveAdminLedgerInvoice() {
  const invId = document.getElementById('editLedgerInvId').value;
  const o = ordersData.find(x => x.id === invId);
  if (!o) return;

  o.customerName = document.getElementById('editLedgerCustName').value.trim();
  o.totalAmount = parseFloat(document.getElementById('editLedgerTotalAmt').value) || 0;
  o.recvAmount = parseFloat(document.getElementById('editLedgerRecvAmt').value) || 0;
  o.dueAmount = parseFloat(document.getElementById('editLedgerDueAmt').value) || 0;
  o.payMode = document.getElementById('editLedgerPayMode').value;
  o.bookedBy = document.getElementById('editLedgerStaffSelect').value;

  const itemBox = document.getElementById('editLedgerItemsRows');
  if (itemBox) {
    const newItems = [];
    itemBox.querySelectorAll('.tt-ledger-item-row').forEach(row => {
      const name = (row.querySelector('.tt-ledger-item-name').value || '').trim();
      const qty = parseFloat(row.querySelector('.tt-ledger-item-qty').value) || 0;
      const total = parseFloat(row.querySelector('.tt-ledger-item-total').value) || 0;
      if (name) {
        const idx = newItems.length, old = (o.items || [])[idx];
        const keep = (old && String(old.name || '').trim().toLowerCase() === name.toLowerCase()) ? old : ((o.items || []).find(x => String(x.name || '').trim().toLowerCase() === name.toLowerCase() && !newItems.some(y => y.__src === x)) || null);
        const ni = Object.assign({}, keep || {}, { name, qty, total });   // v41: keep id / hsn / mrp / gstRate of the line (was dropped)
        if (keep && qty > 0) { ni.rate = ttR2(total / qty); if (keep.mrp > 0 && ni.rate < keep.mrp) ni.disc = ttR2((1 - ni.rate / keep.mrp) * 100); }
        Object.defineProperty(ni, '__src', { value: keep, enumerable: false });
        newItems.push(ni);
      }
    });
    o.items = newItems;
  }

  o.auditTrail = o.auditTrail || [];
  o.auditTrail.unshift({ by: currentUser.name + " (Admin)", time: getNowStr(), note: "Modified billing numbers / bill items in ledger" });

  setStored("ORDERS", ordersData);
  closeEditLedgerModal();
  renderBilling('all');
  renderDashboard();
  if (document.getElementById('ledgerDetailPage') && document.getElementById('ledgerDetailPage').style.display === 'block') openLedgerDetail(o.id);
  alert("Ledger invoice successfully updated!");
}

function deleteAdminLedgerInvoice(ordId) {
  if (!isAdminUser()) {
    alert("Permission denied: only an Admin can delete bills from the ledger.");
    return;
  }
  if (confirm(`Confirm permanent deletion of Invoice ${ordId} from ledger?`)) {
    ordersData = ordersData.filter(x => x.id !== ordId);
    setStored("ORDERS", ordersData);
    renderBilling('all');
    renderDashboard();
    renderOrders();
    alert(`Invoice ${ordId} deleted successfully.`);
  }
}

function renderDashboard() {
  // SKELETON LOADER: pehli baar real data aa jaye to shimmer placeholder hata do
  const skel = document.getElementById('ttDashSkeleton');
  if (skel) skel.style.display = 'none';
  const today = ttYmd(new Date());
  let todayRecv = 0;
  let totalDue = 0;

  ordersData.filter(o => o.status === 'Delivered').forEach(o => {
    if (o.orderDate === today) todayRecv += (o.recvAmount || 0);
    totalDue += (o.dueAmount || 0);
  });

  const activeServices = serviceCallsData.filter(s => s.status !== 'Work Completed').length;
  document.getElementById('dashTodayRecv').textContent = '₹' + todayRecv.toLocaleString('en-IN');
  document.getElementById('dashTotalDue').textContent = '₹' + totalDue.toLocaleString('en-IN');
  document.getElementById('dashActiveServices').textContent = `${activeServices} Active`;
  document.getElementById('dashTotalItems').textContent = `${sampleInventory.length} Items`;
  document.getElementById('dashTotalClients').textContent = `${customerDatabase.length} Clients`;

  const priorityBox = document.getElementById('dashPriorityContainer');
  priorityBox.innerHTML = '';
  let priorityItems = [];

  ordersData.filter(o => o.status === 'Pending' && o.deliveryDate <= today).forEach(o => {
    priorityItems.push({
      title: `📦 Order Due: ${o.customerName} (₹${o.totalAmount})`,
      sub: `Delivery Date: ${o.deliveryDate} | Staff: ${o.bookedBy}`,
      action: () => { switchTab('orders', document.querySelectorAll('.nav-item')[2]); }
    });
  });

  serviceCallsData.filter(s => s.status !== 'Work Completed' && s.targetDate <= today).forEach(s => {
    priorityItems.push({
      title: `🛠️ Machine Service: ${s.customerName}`,
      sub: `Target: ${s.targetDate} | Machine: ${s.machine}`,
      action: () => { switchTab('services', document.querySelectorAll('.nav-item')[3]); }
    });
  });

  document.getElementById('dashPriorityCount').textContent = `${priorityItems.length} Pending`;
  if (priorityItems.length === 0) {
    priorityBox.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span><div class="empty-title">All targets and deliveries are up to date!</div><div class="empty-sub">No pending alerts.</div></div>`;
  } else {
    priorityItems.slice(0, 5).forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = 'background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;';
      row.onclick = item.action;
      row.innerHTML = `
        <div>
          <strong style="color:var(--text-main); font-size:13px;">${ttEscHtml(item.title)}</strong>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${item.sub}</div>
        </div>
        <button class="btn btn-outline btn-sm">View →</button>
      `;
      priorityBox.appendChild(row);
    });
  }

}

function toggleFabMenu() {
  // SMOOTH OPEN/CLOSE: purana code seedha menu.style.display = 'none'/'flex'
  // kar deta tha jo CSS transition ko bypass kar ke "dhadam se" jump deta tha.
  // Ab sirf '.show' / 'fab-open' class add/remove hoti hai - CSS transform/opacity
  // transition khud panel ko toggle button ke andar smoothly collapse/expand
  // karta hai, aur 'fab-open' class button par sonar-pulse glow + ring-spin
  // speed-up + TTESPL glow animation chalati hai (45deg tilt ke badle).
  const menu = document.getElementById('fabMenu');
  const btn = document.getElementById('fabMainBtn');
  const isOpen = menu.classList.contains('show');
  if (isOpen) {
    menu.classList.remove('show');
    if (btn) btn.classList.remove('fab-open');
  } else {
    menu.classList.add('show');
    if (btn) btn.classList.add('fab-open');
  }
}

function openUpiModal(customerName, amount) {
  if (!amount || amount <= 0) {
    alert("Please enter a valid amount.");
    return;
  }
  document.getElementById('upiCustName').textContent = customerName || "Customer";
  document.getElementById('upiAmountText').textContent = '₹' + Number(amount).toLocaleString('en-IN');
  const merchantUpi = "eazypay.574099310@icici";
  const merchantName = "TWINTOWN EXPRESS SERVICES PVT LTD";
  const formattedAmt = parseFloat(amount).toFixed(2);
  // UPI standard: pa me '@' encode nahi hota (PhonePe %40 ko invalid maanta hai), spaces %20 hote hain
  const txnRef = 'TT' + Date.now();
  const upiPayload = `upi://pay?pa=${merchantUpi}&pn=${encodeURIComponent("TWINTOWN EXPRESS SERVICES")}&am=${formattedAmt}&cu=INR`;
  renderUpiQr(upiPayload);
  document.getElementById('upiModal').style.display = 'flex';
}
function closeUpiModal() { document.getElementById('upiModal').style.display = 'none'; }
function renderUpiQr(payload) {
  const box = document.getElementById('upiQrImage');
  box.innerHTML = '';
  try {
    if (typeof qrcode === 'function') {
      // Vector QR (koi network/internet ki zaroorat nahi, hamesha sharp aur scan-friendly)
      const qr = qrcode(0, 'M');
      qr.addData(payload);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
      const svg = box.querySelector('svg');
      if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block'; }
      return;
    }
  } catch (e) { console.warn('Vector QR failed, falling back', e); }
  // Fallback: agar QR library load na ho paye (jaise internet band ho jaye)
  const img = document.createElement('img');
  img.alt = 'UPI QR'; img.style.cssText = 'width:100%; height:100%; display:block;';
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&ecc=M&data=${encodeURIComponent(payload)}`;
  box.appendChild(img);
}


let signatureCanvas, sigCtx, isDrawing = false;
function initSignatureCanvas() {
  signatureCanvas = document.getElementById('signCanvas');
  if (!signatureCanvas) return;
  sigCtx = signatureCanvas.getContext('2d');
  sigCtx.strokeStyle = "#0a2540";
  sigCtx.lineWidth = 2.5;
  sigCtx.lineCap = "round";
  const getPos = (e) => {
    const rect = signatureCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const startDraw = (e) => { isDrawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
  const draw = (e) => { if (!isDrawing) return; const p = getPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); };
  const stopDraw = () => { isDrawing = false; };

  signatureCanvas.addEventListener('mousedown', startDraw);
  signatureCanvas.addEventListener('mousemove', draw);
  signatureCanvas.addEventListener('mouseup', stopDraw);
  signatureCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); }, { passive: false });
  signatureCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
  signatureCanvas.addEventListener('touchend', stopDraw);
}
function openSignatureModal() {
  document.getElementById('signatureModal').style.display = 'flex';
  setTimeout(initSignatureCanvas, 100);
}
function closeSignModal() { document.getElementById('signatureModal').style.display = 'none'; }
function clearSignCanvas() { if (sigCtx) sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height); }
function saveCustomerSignature() {
  // Signature ki image khud bhi yaad rakhte hain (reports me use karne ke liye) -
  // purana status-text wala kaam bilkul waisa hi chalta rehta hai.
  try { if (signatureCanvas) window._ttLastSignatureData = signatureCanvas.toDataURL('image/png'); } catch (e) {}
  ['srvSignStatus', 'instSignStatus', 'srvReportSignStatus'].forEach(function (id) {
    const statusEl = document.getElementById(id);
    if (statusEl) {
      statusEl.textContent = "Customer Sign: ✓ Attached";
      statusEl.style.color = "var(--success)";
    }
  });
  closeSignModal();
  alert("Customer signature verified!");
}

/* WIDE HORIZONTAL AUTOCOMPLETE HANDLER FOR CUSTOMERS */
// AUTOCOMPLETE OVERFLOW FIX: suggestion box ko ab fixed viewport coordinates
// par rakha jata hai (parent ke scroll/overflow se bilkul independent),
// taaki scrolled modal ke andar wo kabhi clip/cut na ho. Dropdown ki chaudai
// input jitni hi rakhi jati hai, aur agar neeche jagah kam ho (keyboard khula
// ho ya modal ke bottom ke paas input ho) to wo khud input ke UPAR khul jata
// hai - kahin bhi hidden/clipped nahi hota.
function ttPositionSuggestionBox(box, inputEl) {
  if (!box || !inputEl) return;
  try {
    box._ttAnchorInput = inputEl;
    const r = inputEl.getBoundingClientRect();
    box.style.position = 'fixed';
    box.style.left = Math.max(8, r.left) + 'px';
    box.style.width = Math.max(220, r.width) + 'px';
    box.style.minWidth = '0';
    box.style.maxWidth = (window.innerWidth - 16) + 'px';
    box.style.top = (r.bottom + 4) + 'px';
    box.style.bottom = 'auto';
    const estHeight = Math.min(250, box.scrollHeight || 250);
    if (r.bottom + estHeight + 12 > window.innerHeight) {
      box.style.top = Math.max(8, r.top - estHeight - 4) + 'px';
    }
  } catch (e) {}
}
window.ttPositionSuggestionBox = ttPositionSuggestionBox;
function ttRepositionVisibleSuggestionBoxes() {
  document.querySelectorAll('.solid-suggestion-box').forEach(function (box) {
    if (box.style.display === 'block' && box._ttAnchorInput) {
      ttPositionSuggestionBox(box, box._ttAnchorInput);
    }
  });
}
var _ttRepoRaf = 0;
window.addEventListener('scroll', function () { if (_ttRepoRaf) return; _ttRepoRaf = requestAnimationFrame(function () { _ttRepoRaf = 0; ttRepositionVisibleSuggestionBoxes(); }); }, { capture: true, passive: true });
window.addEventListener('resize', ttRepositionVisibleSuggestionBoxes);

function handleCustomerAutocomplete(inputEl, targetInputId) {
  const val = (inputEl.value || '').toLowerCase().trim();
  const box = inputEl.parentElement.querySelector('.solid-suggestion-box');
  if (!box) return;
  if (!val || val.length < 1) { box.style.display = 'none'; return; }

  const matches = (customerDatabase || []).filter(c => {
    const nameMatch = c.name && c.name.toLowerCase().includes(val);
    const phoneMatch = c.phone && String(c.phone).includes(val);
    const personMatch = c.person && c.person.toLowerCase().includes(val);
    return nameMatch || phoneMatch || personMatch;
  }).slice(0, 10);

  let html = matches.map(c => `
    <div class="suggestion-item" onmousedown="selectCustomerSuggestion('${targetInputId}', '${encodeURIComponent(c.name || '')}', '${c.phone || ''}')">
      <div style="flex:1;">
        <strong style="font-size:13px; color:var(--text-main);">${c.name || ''}</strong>
        <div class="suggestion-sub">${(c.person && c.person !== c.name) ? c.person + ' | ' : ''}📍 ${c.address || ''}</div>
      </div>
      <span class="badge badge-info" style="font-size:10px;">${c.phone || ''}</span>
    </div>
  `).join('');

  html += `
    <div class="suggestion-item" onmousedown="openAddCustomerModal(); document.querySelectorAll('.solid-suggestion-box').forEach(b => b.style.display='none');" style="background:var(--success-bg) !important; color:var(--success); font-weight:800; border-top:1px solid var(--border);">
      <div>➕ Register New Customer: "${esc(val)}"</div>
      <span class="badge badge-delivered" style="font-size:9.5px;">Add New</span>
    </div>
  `;
  box.innerHTML = html;
  ttPositionSuggestionBox(box, inputEl);
  box.style.display = 'block';
}

function selectCustomerSuggestion(targetInputId, encName, phone) {
  const name = decodeURIComponent(encName);
  const input = document.getElementById(targetInputId);
  if (input) {
    input.value = phone ? `${name} (${phone})` : name;
    const box = input.parentElement.querySelector('.solid-suggestion-box');
    if (box) box.style.display = 'none';
  }
}

function handleMachineAutocomplete(inputEl, targetInputId) {
  const val = (inputEl.value || '').toLowerCase().trim();
  const box = inputEl.parentElement.querySelector('.solid-suggestion-box');
  if (!box) return;
  if (!val) { box.style.display = 'none'; return; }

  const inventoryMachines = (sampleInventory || []).filter(item => 
    item.category === 'Machines & Equipment' &&
    ((item.name && item.name.toLowerCase().includes(val)) || (item.code && item.code.toLowerCase().includes(val)))
  ).map(item => ({ name: item.name, sub: `Code: ${item.code || 'N/A'}`, price: item.rate || 0 }));

  const catalogMachines = (machineryDatabase || []).filter(m =>
    (m.name && m.name.toLowerCase().includes(val)) || (m.pump && m.pump.toLowerCase().includes(val))
  ).map(m => ({ name: m.name, sub: `${m.pump || ''} | ${m.bar || 0} Bar`, price: m.price || 0 }));

  const combined = [...inventoryMachines, ...catalogMachines].slice(0, 10);
  if (combined.length === 0) { box.style.display = 'none'; return; }

  box.innerHTML = combined.map(m => `
    <div class="suggestion-item" onmousedown="selectMachineSuggestion('${targetInputId}', '${encodeURIComponent(m.name || '')}', ${m.price || 0})">
      <div style="flex:1;">
        <strong style="color:var(--text-main);">🚜 ${ttEscHtml(m.name)}</strong>
        <div class="suggestion-sub">${m.sub}</div>
      </div>
      <strong style="color:var(--primary); font-size:12.5px;">₹${Number(m.price || 0).toLocaleString('en-IN')}</strong>
    </div>
  `).join('');
  box.style.display = 'block';
}

function selectMachineSuggestion(targetInputId, encName, price) {
  const name = decodeURIComponent(encName);
  const input = document.getElementById(targetInputId);
  if (input) {
    input.value = name;
    const box = input.parentElement.querySelector('.solid-suggestion-box');
    if (box) box.style.display = 'none';
  }
  const pInput = document.getElementById('leadPrice');
  if (pInput && !pInput.value) pInput.value = price;
}

/* WIDE HORIZONTAL DROPDOWN PRODUCT ITEM FIX */
function handleOrderItemInput(inputEl) {
  const val = (inputEl.value || '').toLowerCase().trim();
  const row = inputEl.closest('tr');
  if (!row) return;
  const box = row.querySelector('.solid-suggestion-box');
  if(!box) return;
  if(!val) { box.style.display = 'none'; return; }

  const matches = (sampleInventory || []).filter(p =>
    p.category !== 'Catalog Equipment' &&
    ((p.name && p.name.toLowerCase().includes(val)) || (p.code && p.code.toLowerCase().includes(val)))
  ).slice(0, 8);

  let html = matches.map(p => `
    <div class="suggestion-item" onmousedown="selectOrderItemSuggestion(this, '${encodeURIComponent(p.name || '')}', '${p.code || ''}', ${p.rate || 0}, ${p.stock || 0})">
      <div style="flex:1;">
        <strong style="font-size:12.5px; color:var(--text-main);">${ttEscHtml(p.name)}</strong>
        <div class="suggestion-sub">SKU: ${p.code || 'N/A'} • <span style="color:${p.stock>0?'var(--success)':'var(--danger)'}">Stock: ${p.stock || 0}</span></div>
      </div>
      <strong style="color:var(--accent); font-size:13px; white-space:nowrap;">MRP: ₹${p.rate || 0}</strong>
    </div>
  `).join('');

  box.innerHTML = html;
  box.style.display = matches.length ? 'block' : 'none';
}

function selectOrderItemSuggestion(el, encName, code, rate, stock) {
  const name = decodeURIComponent(encName);
  const row = el.closest('tr');
  if (!row) return;
  const input = row.querySelector('.item-product-input');
  input.value = code ? `${name} [${code}]` : name;
  row.querySelector('.item-mrp').value = rate || 0;
  row.querySelector('.item-disc').value = 0;
  row.dataset.src = 'disc';
  row.querySelector('.item-rate').value = rate || 0;
  row.querySelector('.item-stock-warning').innerHTML = `<span style="color:${(stock > 0) ? 'var(--success)' : 'var(--danger)'}">Stock: ${stock}</span>`;
  const box = row.querySelector('.solid-suggestion-box');
  if (box) box.style.display = 'none';
  calcOrderTotals();
}

function handlePartAutocomplete(inputEl, targetInputId) {
  const val = (inputEl.value || '').toLowerCase().trim();
  const box = inputEl.parentElement.querySelector('.solid-suggestion-box');
  if (!box) return;
  if (!val) { box.style.display = 'none'; return; }

  const matches = (sampleInventory || []).filter(p =>
    (p.name && p.name.toLowerCase().includes(val)) || (p.code && p.code.toLowerCase().includes(val))
  ).slice(0, 10);

  if (matches.length === 0) { box.style.display = 'none'; return; }

  box.innerHTML = matches.map(p => `
    <div class="suggestion-item" onmousedown="selectPartSuggestion('${targetInputId}', '${encodeURIComponent(p.name || '')}', '${p.code || ''}')">
      <div style="flex:1;">
        <strong style="color:var(--text-main);">${ttEscHtml(p.name)}</strong>
        <div class="suggestion-sub">Code: ${p.code || 'N/A'} | Stock: ${p.stock || 0}</div>
      </div>
      <strong style="color:var(--accent);">₹${p.rate || 0}</strong>
    </div>
  `).join('');
  box.style.display = 'block';
}

function selectPartSuggestion(targetInputId, encName, code) {
  const name = decodeURIComponent(encName);
  const input = document.getElementById(targetInputId);
  if (input) {
    input.value = code ? `${name} [${code}]` : name;
    const box = input.parentElement.querySelector('.solid-suggestion-box');
    if (box) box.style.display = 'none';
  }
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.autocomplete-wrapper')) {
    document.querySelectorAll('.solid-suggestion-box').forEach(b => b.style.display = 'none');
  }
});

function resolveCustomerFromSearch(text) {
  if(!text) return null;
  const match = text.match(/\((\d{10})\)/);
  if(match) return customerDatabase.find(c => c.phone === match[1]);
  const t = text.toLowerCase().trim();
  return customerDatabase.find(c => (c.name && c.name.toLowerCase() === t) || (c.phone && String(c.phone) === t));
}

function resolvePartFromSearch(text) {
  if(!text) return null;
  const match = text.match(/\[(.*?)\]/);
  if(match) return sampleInventory.find(p => p.code === match[1]);
  const t = text.toLowerCase().trim();
  return sampleInventory.find(p => (p.name && p.name.toLowerCase().includes(t)));
}

async function getMasterDataPayload() {
  if (window.TTESPL_MASTER_DATA && window.TTESPL_MASTER_DATA.inventory && window.TTESPL_MASTER_DATA.inventory.length > 0) {
    return window.TTESPL_MASTER_DATA;
  }
  try {
    const res = await fetch('ttespl_master_data.json?v=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      window.TTESPL_MASTER_DATA = data;
      return data;
    }
  } catch (err) {}
  return null;
}

async function loadMasterCatalogAction() {
  const payload = await getMasterDataPayload();
  const invList = (payload && Array.isArray(payload.inventory)) ? payload.inventory : [];
  const custList = (payload && Array.isArray(payload.customers)) ? payload.customers : [];
  if (invList.length > 0 || custList.length > 0) {
    if (confirm(`WARNING: this REPLACES all ${Array.isArray(sampleInventory) ? sampleInventory.length : 0} current stock items with ${invList.length} from the master file (stock quantities and price edits will be lost). Customers are only added, never replaced.\n\nTo only ADD missing items safely use Settings > Data cleanup > Sync master catalog.\n\nReplace anyway?`)) {
      if (invList.length > 0) {
        sampleInventory = invList;
        setStored("INVENTORY", sampleInventory);
      }
      let addedCust = 0;
      if (custList.length > 0) {
        // Purane/naye customers safe rahenge - sirf missing customers add honge (phone ya naam se match)
        const existing = Array.isArray(customerDatabase) ? customerDatabase.slice() : [];
        const seenPhone = new Set(existing.map(c => c && c.phone ? String(c.phone).trim() : '').filter(Boolean));
        const seenName = new Set(existing.map(c => c && c.name ? String(c.name).trim().toLowerCase() : '').filter(Boolean));
        const usedIds = new Set(existing.map(c => c && c.id != null ? String(c.id) : ''));
        custList.forEach(c => {
          if (!c || !c.name) return;
          const ph = c.phone ? String(c.phone).trim() : '';
          const nm = String(c.name).trim().toLowerCase();
          if ((ph && seenPhone.has(ph)) || seenName.has(nm)) return;
          let cid = c.id;
          if (cid == null || usedIds.has(String(cid))) cid = 'MC' + Date.now() + '_' + addedCust;
          existing.push(Object.assign({}, c, { id: cid }));
          usedIds.add(String(cid));
          if (ph) seenPhone.add(ph);
          seenName.add(nm);
          addedCust++;
        });
        customerDatabase = existing;
        window.customerDatabase = customerDatabase;
        setStored("CUSTOMERS", customerDatabase);
      }
      renderStockList();
      if (typeof populateDropdownsAndDatalists === 'function') { try { populateDropdownsAndDatalists(); } catch(e) {} }
      alert(`Success: ${invList.length > 0 ? sampleInventory.length : 0} items loaded, ${addedCust} naye customers add hue (total ${Array.isArray(customerDatabase) ? customerDatabase.length : 0})!`);
    }
  } else {
    alert("Error: Master catalog file not found.");
  }
}

/* TAB 1: LEADS */
function renderLeads() {
  const c = document.getElementById('leadsListContainer');
  c.innerHTML = '';
  const isAdmin = isAdminUser();

  if (leadsData.length === 0) {
    if (ttMaybeSkeleton(c, 3)) return;
    c.innerHTML = `<div style="text-align:center; padding:25px; color:var(--text-muted); font-size:12.5px;">No active inquiries right now.</div>`;
    return;
  }

  let displayLeads = leadsData;
  const leadsFiltersActive = leadsFilterState.staff !== "ALL" || leadsFilterState.from || leadsFilterState.to;
  if (leadsFilterState.staff !== "ALL") displayLeads = displayLeads.filter(l => l.handledBy === leadsFilterState.staff);
  if (leadsFilterState.from) displayLeads = displayLeads.filter(l => l.inquiryDate >= leadsFilterState.from);
  if (leadsFilterState.to) displayLeads = displayLeads.filter(l => l.inquiryDate <= leadsFilterState.to);

  if (displayLeads.length === 0 && leadsFiltersActive) {
    c.innerHTML = `<div class="empty-state"><span class="empty-icon">🔎</span><div class="empty-sub">No inquiries match this filter.</div></div>`;
    return;
  }

  displayLeads.forEach(lead => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header">
        <div>
          <strong style="font-size:15px; color:var(--text-main);">${ttEscHtml(lead.customerName)}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">Inquiry: ${lead.inquiryDate} | Lead Eng: <strong>${lead.handledBy}</strong></div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <span class="badge ${lead.status === 'Installed' ? 'badge-delivered' : 'badge-pending'}">${lead.status}</span>
          <button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); editLeadPrompt('${lead.id}')">✏️ Edit</button>
          ${isAdmin ? `<button class="btn btn-danger-sm admin-only-btn" onclick="triggerAppHaptic(); deleteLeadAction('${lead.id}')">🗑️</button>` : ''}
        </div>
      </div>
      <div style="font-size:12.5px; margin-bottom:6px;">Machine: <strong>${ttEscHtml(lead.machine)}</strong> | Quoted: <strong>₹${Number(lead.quotedPrice || 0).toLocaleString('en-IN')}</strong></div>
      <div style="background:var(--bg); padding:10px; border-radius:8px; font-size:12px;">
        💬 <strong>Remarks:</strong> ${ttEscHtml(lead.remarks)} <br>
        <span style="color:var(--danger); font-weight:800;">Next Followup: ${lead.followupDate}</span>
      </div>
      ${lead.status === 'Installed' ? `
      <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); openInstallationReportView('${lead.id}')">📄 Open Installation Report</button>
        ${ttNextDueBadge(lead)}
      </div>` : `
      <button class="btn btn-primary btn-sm btn-block" style="margin-top:8px;" onclick="triggerAppHaptic(); openInstallationReportModal('${lead.id}')">✅ Confirm Installation &amp; Create Report</button>`}
    `;
    c.appendChild(card);
  });
}
window.renderLeads = renderLeads;

function openLeadModal(leadObj = null) {
  const title = document.getElementById('leadModalTitle');
  const editId = document.getElementById('editLeadId');

  if(leadObj) {
    title.textContent = "Edit Machine Lead & Followup";
    editId.value = leadObj.id;
    document.getElementById('leadCustSearchInput').value = `${leadObj.customerName} (${leadObj.phone || ''})`;
    document.getElementById('leadInqDate').value = leadObj.inquiryDate;
    document.getElementById('leadStaffSelect').value = leadObj.handledBy;
    document.getElementById('leadMachine').value = leadObj.machine;
    document.getElementById('leadPrice').value = leadObj.quotedPrice;
    document.getElementById('leadFollowupDate').value = leadObj.followupDate;
    document.getElementById('leadRemarks').value = leadObj.remarks;
  } else {
    title.textContent = "New Machine Inquiry Entry";
    editId.value = "";
    const today = ttYmd(new Date());
    document.getElementById('leadCustSearchInput').value = "";
    document.getElementById('leadInqDate').value = today;
    document.getElementById('leadFollowupDate').value = today;
    document.getElementById('leadMachine').value = "";
    document.getElementById('leadPrice').value = "";
    document.getElementById('leadRemarks').value = "";
  }
  ttOpenSheetModal('leadModal');
}
function closeLeadModal() { ttCloseSheetModal('leadModal'); }

function saveLeadAction() {
  const editId = document.getElementById('editLeadId').value;
  const custSearch = document.getElementById('leadCustSearchInput').value.trim();
  const cust = resolveCustomerFromSearch(custSearch);
  const inqDate = document.getElementById('leadInqDate').value;
  const staff = document.getElementById('leadStaffSelect').value;
  const mach = document.getElementById('leadMachine').value.trim();
  const price = parseFloat(document.getElementById('leadPrice').value) || 0;
  const followup = document.getElementById('leadFollowupDate').value;
  const rem = document.getElementById('leadRemarks').value.trim();

  if(!custSearch || !mach) { alert("Please select a Customer and Machine Model!"); return; }

  const custName = cust ? cust.name : custSearch.split('(')[0].trim();
  const phone = cust ? cust.phone : "";

  if(editId) {
    const l = leadsData.find(x => x.id === editId);
    if(l) {
      l.customerName = custName; l.phone = phone; l.inquiryDate = inqDate; l.handledBy = staff;
      l.machine = mach; l.quotedPrice = price; l.followupDate = followup; l.remarks = rem;
    }
  } else {
    const newL = {
      id: "LEAD-" + Math.floor(100 + Math.random() * 900),
      customerName: custName, phone, inquiryDate: inqDate, handledBy: staff, machine: mach,
      quotedPrice: price, status: "Active Inquiry", followupDate: followup, remarks: rem || "Lead registered"
    };
    leadsData.unshift(newL);
  }

  setStored("LEADS", leadsData);
  closeLeadModal();
  renderLeads();
  renderDashboard();
  alert("Lead saved successfully!");
}

function deleteLeadAction(id) {
  if (!isAdminUser()) { alert("Admin only!"); return; }
  if(confirm("Confirm DELETE this Lead?")) {
    leadsData = leadsData.filter(x => x.id !== id);
    setStored("LEADS", leadsData);
    renderLeads();
    renderDashboard();
  }
}
function editLeadPrompt(leadId) {
  const l = leadsData.find(x => x.id === leadId);
  if(l) openLeadModal(l);
}

/* TAB 2: ORDERS */
function switchOrderSubTab(sub) {
  currentOrderSubTab = sub;
  const btnAct = document.getElementById('btnSubTabActiveOrders');
  const btnCan = document.getElementById('btnSubTabCancelledOrders');
  if (sub === 'active') { btnAct.classList.add('active'); btnCan.classList.remove('active'); }
  else { btnCan.classList.add('active'); btnAct.classList.remove('active'); }
  renderOrders();
}

function renderOrders() {
  const c = document.getElementById('ordersListContainer');
  c.innerHTML = '';
  const today = ttYmd(new Date());
  const isAdmin = isAdminUser();

  const pendingList = ordersData.filter(o => o.status === 'Pending');
  const cancelledList = ordersData.filter(o => o.status === 'Cancelled');

  document.getElementById('countActiveOrders').textContent = pendingList.length;
  document.getElementById('countCancelledOrders').textContent = cancelledList.length;

  const targetList = (currentOrderSubTab === 'active') ? pendingList : cancelledList;

  let displayList = targetList;
  const filtersActive = ordersFilterState.staff !== "ALL" || ordersFilterState.from || ordersFilterState.to;
  if (ordersFilterState.staff !== "ALL") displayList = displayList.filter(o => o.bookedBy === ordersFilterState.staff);
  if (ordersFilterState.from) displayList = displayList.filter(o => o.orderDate >= ordersFilterState.from);
  if (ordersFilterState.to) displayList = displayList.filter(o => o.orderDate <= ordersFilterState.to);

  if (displayList.length === 0) {
    if (!filtersActive && ttMaybeSkeleton(c, 3)) return;
    c.innerHTML = filtersActive
      ? `<div class="empty-state"><span class="empty-icon">🔎</span><div class="empty-sub">No orders match this filter.</div></div>`
      : `<div style="text-align:center; padding:25px; color:var(--text-muted); font-size:12.5px;">No active pending orders.</div>`;
    return;
  }

  displayList.forEach(o => {
    let statusBadge = o.deliveryDate < today ? 'badge-danger' : 'badge-pending';
    let statusText = o.status === 'Pending' ? (o.deliveryDate < today ? '⚠️ Delayed' : '⏳ Pending Dispatch') : '🚫 Cancelled';

    let itemsHtml = o.items.map(i => `<div>• ${ttEscHtml(i.name)} (Qty: ${i.qty}, Disc: ${i.disc || 0}%) = ₹${i.total}</div>`).join('');

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header">
        <div>
          <strong style="font-size:15px; color:var(--text-main);">${ttEscHtml(o.customerName)}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">Ref: ${o.id} | Date: ${o.orderDate} | Staff: <strong>${ttEscHtml(o.bookedBy)}</strong></div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <span class="badge ${statusBadge}">${statusText}</span>
          ${o.status === 'Pending' ? `<button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); editOrderPrompt('${o.id}')">✏️ Edit</button>` : ''}
          ${isAdmin ? `<button class="btn btn-danger-sm admin-only-btn" onclick="triggerAppHaptic(); deleteOrderAction('${o.id}')">🗑️</button>` : ''}
        </div>
      </div>
      <div style="background:var(--bg); padding:10px; border-radius:8px; font-size:12px; margin-bottom:8px;">
        ${itemsHtml}
        <div style="border-top:1px dashed var(--border); margin-top:6px; padding-top:6px; display:flex; justify-content:space-between; font-weight:800;">
          <span>Total: ₹${Number(o.totalAmount || 0).toLocaleString('en-IN')}</span>
          <span style="color:${o.dueAmount > 0 ? 'var(--danger)' : 'var(--success)'};">Due: ₹${Number(o.dueAmount || 0).toLocaleString('en-IN')}</span>
        </div>
      </div>
      ${typeof ttPayCardHtml === 'function' ? ttPayCardHtml(o) : ''}
      ${o.status === 'Pending' ? `
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openDeliveryProofModal('${o.id}')">📸 Deliver & Upload Proof</button>
          <button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openUpiModal('${esc(o.customerName)}', ${o.dueAmount > 0 ? o.dueAmount : o.totalAmount})">📱 UPI QR</button>
          <button class="btn btn-wa btn-sm" style="flex:1;" onclick="triggerAppHaptic(); shareOrderWhatsApp('${o.id}')">💬 WhatsApp</button>
          <button class="btn btn-danger-sm btn-sm" style="flex:1;" onclick="triggerAppHaptic(); cancelOrderAction('${o.id}')">🚫 Cancel</button>
        </div>
      ` : ''}
    `;
    c.appendChild(card);
  });
}
window.renderOrders = renderOrders;

function cancelOrderAction(ordId) {
  const o = ordersData.find(x => x.id === ordId);
  if (!o) return;
  const reason = prompt("Reason for cancellation:", "Customer cancelled");
  if (reason === null) return;
  o.status = "Cancelled";
  o.cancelReason = reason;
  setStored("ORDERS", ordersData);
  renderOrders();
  renderDashboard();
}

function openOrderModal(orderObj = null) {
  const tbody = document.getElementById('orderItemsTbody');
  tbody.innerHTML = '';
  const title = document.getElementById('orderModalTitle');
  const editId = document.getElementById('editOrderId');

  if(orderObj) {
    title.textContent = "Edit Order & Items";
    editId.value = orderObj.id;
    document.getElementById('ordCustSearchInput').value = `${orderObj.customerName} (${orderObj.phone || ''})`;
    document.getElementById('ordStaffSelect').value = orderObj.bookedBy;
    document.getElementById('ordDate').value = orderObj.orderDate;
    document.getElementById('ordDelDate').value = orderObj.deliveryDate;
    document.getElementById('ordRecvAmt').value = orderObj.recvAmount;
    document.getElementById('ordPayMode').value = orderObj.payMode;
    document.getElementById('ordTaxType').value = orderObj.taxType || 'INTRA';
    document.getElementById('ordCourierCharge').value = orderObj.courierCharge || 0;
    ttPayProofs = (orderObj.payProofs || []).slice();
    orderObj.items.forEach(it => addOrderItemRow(it.name, it.qty, it.mrp || it.rate, it.disc || 0, it.rate));
  } else {
    title.textContent = "New Multi-Item Product Order";
    editId.value = "";
    const today = ttYmd(new Date());
    document.getElementById('ordCustSearchInput').value = "";
    document.getElementById('ordDate').value = today;
    document.getElementById('ordDelDate').value = today;
    document.getElementById('ordRecvAmt').value = "0";
    document.getElementById('ordPayMode').value = "Cash";
    document.getElementById('ordTaxType').value = "INTRA";
    document.getElementById('ordCourierCharge').value = "0";
    ttPayProofs = [];
    addOrderItemRow();
  }
  calcOrderTotals();
  ttPayDraw(); ttPayToggle();
  ttOpenSheetModal('orderModal');
}
function closeOrderModal() { ttCloseSheetModal('orderModal'); }

function addOrderItemRow(itemName = "", qty = 1, mrp = 0, disc = 0, rate = null) {
  const tbody = document.getElementById('orderItemsTbody');
  const tr = document.createElement('tr');

  tr.innerHTML = `
    <td class="autocomplete-wrapper">
      <input type="text" class="item-product-input" value="${ttEscHtml(itemName)}" placeholder="Type product name..." oninput="handleOrderItemInput(this)">
      <div class="solid-suggestion-box"></div>
      <div class="item-stock-warning" style="font-size:10px; color:var(--text-muted); margin-top:2px;"></div>
    </td>
    <td><input type="number" class="item-qty" value="${qty}" min="0" step="any" inputmode="decimal" oninput="calcOrderTotals()" style="width:60px; font-size:13px; font-weight:700;"></td>
    <td><input type="number" class="item-mrp" value="${mrp}" step="any" oninput="calcOrderTotals()" style="width:75px; font-size:13px; font-weight:700;"></td>
    <td><input type="number" class="item-disc" value="${disc}" min="0" max="100" step="any" oninput="this.closest('tr').dataset.src='disc'; calcOrderTotals()" style="width:65px; font-size:13px; font-weight:700;"></td>
    <td><input type="number" class="item-rate" step="any" oninput="this.closest('tr').dataset.src='rate'; calcOrderTotals()" style="width:80px; font-size:13px; font-weight:700;"></td>
    <td class="item-row-total" style="font-weight:bold; font-size:12.5px;">₹0</td>
    <td><button class="btn btn-danger-sm" onclick="triggerAppHaptic(); this.closest('tr').remove(); calcOrderTotals();">✕</button></td>
  `;

  tbody.appendChild(tr);
  // Saved rate (edit mode) is kept exactly; discount % is derived from MRP vs rate when it was not entered.
  if (rate !== null && rate !== undefined && !isNaN(parseFloat(rate))) {
    tr.dataset.src = 'rate';
    tr.querySelector('.item-rate').value = ttR2(parseFloat(rate));
  }
  calcOrderTotals();
}

function calcOrderTotals() {
  let total = 0;
  document.querySelectorAll('#orderItemsTbody tr').forEach(r => {
    const q = parseFloat(r.querySelector('.item-qty').value) || 0;
    const mrp = parseFloat(r.querySelector('.item-mrp').value) || 0;
    const discEl = r.querySelector('.item-disc'), rateEl = r.querySelector('.item-rate');
    let rate;
    if (r.dataset.src === 'rate') {
      // Rate typed directly: discount % is calculated automatically from MRP
      rate = ttR2(parseFloat(rateEl.value) || 0);
      const d = (mrp > 0 && rate < mrp) ? ttR2((1 - rate / mrp) * 100) : 0;
      if (document.activeElement !== discEl) discEl.value = d;
    } else {
      const disc = parseFloat(discEl.value) || 0;
      rate = ttR2(mrp * (1 - (disc / 100)));
      if (document.activeElement !== rateEl) rateEl.value = rate.toFixed(2);
    }
    // line total = qty x (2-decimal rate): the same number is shown, saved and printed
    const sub = ttR2(q * rate);
    r.querySelector('.item-row-total').textContent = '₹' + sub.toLocaleString('en-IN', {maximumFractionDigits: 2});
    total += sub;
  });
  // COURIER/TRANSPORT CHARGE: products ke upar ek flat add-on charge, jo
  // taxable product total me nahi jodte (tax calc par asar nahi) par
  // final payable total aur invoice me alag se dikhta hai.
  const courierEl = document.getElementById('ordCourierCharge');
  const courierCharge = courierEl ? (parseFloat(courierEl.value) || 0) : 0;
  // AUTO ROUND-OFF: bill/order ka final amount (products + courier) hamesha
  // nearest rupee (poora integer) me round hota hai - exact round-off
  // difference chhote note me dikh jata hai, taaki paisa-level mismatch kahin na ho.
  const rawTotal = Math.round((total + courierCharge) * 100) / 100;
  const roundedTotal = Math.round(rawTotal);
  const roundOff = Math.round((roundedTotal - rawTotal) * 100) / 100;
  document.getElementById('ordTotalAmt').value = roundedTotal;
  const rawEl = document.getElementById('ordTotalRaw'); if (rawEl) rawEl.value = rawTotal;
  const noteEl = document.getElementById('ordRoundOffNote');
  let noteTxt = '';
  if (courierCharge > 0) noteTxt += `Incl. Courier ₹${courierCharge.toFixed(2)}. `;
  if (Math.abs(roundOff) >= 0.005) noteTxt += `Round Off: ${roundOff >= 0 ? '+' : ''}₹${roundOff.toFixed(2)} (Sub-total ₹${rawTotal.toFixed(2)})`;
  if (noteEl) noteEl.textContent = noteTxt;
  calcOrderBalance();
}

function calcOrderBalance() {
  const total = parseFloat(document.getElementById('ordTotalAmt').value) || 0;
  const recv = parseFloat(document.getElementById('ordRecvAmt').value) || 0;
  document.getElementById('ordDueAmt').value = Math.max(0, total - recv);
  if (typeof ttPayToggle === 'function') ttPayToggle();
}

/* BUG FIX (v27): order ids were ORD-100..999 picked at random with no check, so with enough orders (or after a bulk
   import) two orders could get the SAME id and one would overwrite the other in the cloud. Keep the same ORD-nnn
   format, but retry until the id is unused (and widen to 4+ digits only if all 900 short ids are taken). */
function ttNewOrderId() {
  var used = {}; (ordersData || []).forEach(function (o) { if (o && o.id != null) used[String(o.id).toLowerCase()] = 1; });
  /* v41: 6-digit random id (was 3-digit: two phones could pick the same id and one bill overwrote the other) */
  for (var i = 0; i < 80; i++) { var id = 'ORD-' + Math.floor(100000 + Math.random() * 900000); if (!used[id.toLowerCase()]) return id; }
  return 'ORD-' + Date.now();
}
function saveOrderAction() {
  const editId = document.getElementById('editOrderId').value;
  const custSearch = document.getElementById('ordCustSearchInput').value.trim();
  const cust = resolveCustomerFromSearch(custSearch);
  const staff = document.getElementById('ordStaffSelect').value;
  const ordDate = document.getElementById('ordDate').value;
  const delDate = document.getElementById('ordDelDate').value;
  const total = parseFloat(document.getElementById('ordTotalAmt').value) || 0;
  const recv = parseFloat(document.getElementById('ordRecvAmt').value) || 0;
  const due = parseFloat(document.getElementById('ordDueAmt').value) || 0;
  const payMode = document.getElementById('ordPayMode').value;
  const taxType = document.getElementById('ordTaxType').value;
  const courierChargeEl = document.getElementById('ordCourierCharge');
  const courierCharge = courierChargeEl ? (parseFloat(courierChargeEl.value) || 0) : 0;

  let items = [];
  document.querySelectorAll('#orderItemsTbody tr').forEach(r => {
    const pName = r.querySelector('.item-product-input').value.trim();
    const qty = parseFloat(r.querySelector('.item-qty').value) || 0;   // v41: was parseInt (1.5 became 1 but the total used 1.5)
    const mrp = parseFloat(r.querySelector('.item-mrp').value) || 0;
    const disc = parseFloat(r.querySelector('.item-disc').value) || 0;
    const rate = parseFloat(r.querySelector('.item-rate').value) || 0;
    const part = resolvePartFromSearch(pName);

    if(pName && qty > 0) {
      items.push({
        id: part ? part.id : Date.now(),
        name: part ? part.name : pName,
        hsn: part ? (part.hsn || "84139190") : "84139190",
        qty, mrp, disc, rate, total: ttR2(qty * rate)
      });
    }
  });

  if(!custSearch || items.length === 0) { alert("Please select a Customer and add at least one item!"); return; }

  const custName = cust ? cust.name : custSearch.split('(')[0].trim();
  const phone = cust ? cust.phone : "";

  if(editId) {
    const o = ordersData.find(x => x.id === editId);
    if(o) {
      o.customerName = custName; o.phone = phone; o.bookedBy = staff; o.orderDate = ordDate;
      o.deliveryDate = delDate; o.items = items; o.totalAmount = total; o.recvAmount = recv;
      o.dueAmount = due; o.payMode = payMode; o.taxType = taxType; o.courierCharge = courierCharge;
      o.payProofs = (typeof ttPayProofs !== 'undefined' ? ttPayProofs.slice() : (o.payProofs || []));
    }
  } else {
    const newO = {
      id: ttNewOrderId(),
      customerName: custName, phone, orderDate: ordDate, deliveryDate: delDate,
      items, totalAmount: total, recvAmount: recv, dueAmount: due, payMode, taxType,
      courierCharge, status: "Pending", bookedBy: staff,
      payProofs: (typeof ttPayProofs !== 'undefined' ? ttPayProofs.slice() : [])
    };
    ordersData.unshift(newO);

    playOrderPlacedSound();

    if (window.cloudSync && typeof window.cloudSync.pushLiveNotification === 'function') {
      window.cloudSync.pushLiveNotification({
        title: "📦 New Order Placed!",
        body: `${custName} - ₹${total.toLocaleString('en-IN')} (Booked by ${staff})`,
        type: "order"
      });
    }
  }

  setStored("ORDERS", ordersData);
  closeOrderModal();
  renderOrders();
  renderBilling('all');
  renderDashboard();
  alert("Order saved successfully!");
}

let currentDeliveryPhotoBase64 = "";
function openDeliveryProofModal(ordId) {
  document.getElementById('pendingDeliverOrderId').value = ordId;
  currentDeliveryPhotoBase64 = "";
  const preview = document.getElementById('deliveryPhotoPreview');
  preview.src = "";
  preview.style.display = 'none';
  document.getElementById('confirmDeliveryBtn').disabled = true;
  document.getElementById('deliveryManualDate').value = ttYmd(new Date());
  document.getElementById('deliveryProofModal').style.display = 'flex';
}
function closeDeliveryProofModal() {
  document.getElementById('deliveryProofModal').style.display = 'none';
}

function handleDeliveryPhotoCaptured(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    ttCompressImageSafe(e.target.result, 760, 0.55, 220000).then(function(cd) {
      currentDeliveryPhotoBase64 = cd;
      const preview = document.getElementById('deliveryPhotoPreview');
      preview.src = currentDeliveryPhotoBase64;
      preview.style.display = 'block';
      document.getElementById('confirmDeliveryBtn').disabled = false;
    });
  };
  reader.readAsDataURL(file);
}

function executeConfirmedDelivery() {
  const ordId = document.getElementById('pendingDeliverOrderId').value;
  if (!currentDeliveryPhotoBase64) {
    alert("Please attach the delivery proof photo!");
    return;
  }
  const o = ordersData.find(x => x.id === ordId);
  if(!o) return;

  o.items.forEach(it => {
    const p = sampleInventory.find(x => x.id === it.id || x.name === it.name);
    if(p) { p.stock = Math.max(0, p.stock - it.qty); }
  });

  const chosenDate = document.getElementById('deliveryManualDate').value;
  o.status = "Delivered";
  o.deliveredDate = chosenDate || ttYmd(new Date());
  o.deliveryProofPhoto = currentDeliveryPhotoBase64;
  o.deliveredAt = getNowStr();
  o.deliveredBy = currentUser ? currentUser.name : 'Staff';

  playDeliverySound();

  setStored("ORDERS", ordersData);
  setStored("INVENTORY", sampleInventory);
  closeDeliveryProofModal();
  renderOrders();
  renderStockList();
  renderBilling('all');
  renderDashboard();

  if (window.cloudSync && typeof window.cloudSync.pushLiveNotification === 'function') {
    window.cloudSync.pushLiveNotification({
      title: "✅ Order Delivered!",
      body: `${o.customerName} - Ref ${o.id} marked Delivered.`,
      type: "delivery"
    });
  }

  alert("Order successfully delivered!");
}

let currentPaymentProofBase64 = "";
function collectDuePayment(ordId) {
  const o = ordersData.find(x => x.id === ordId);
  if (!o) return;
  document.getElementById('pendingCollectOrderId').value = ordId;
  document.getElementById('payCollectInputAmt').value = o.dueAmount;
  currentPaymentProofBase64 = "";
  const preview = document.getElementById('payProofPreview');
  preview.src = "";
  preview.style.display = 'none';
  document.getElementById('confirmCollectPayBtn').disabled = true;
  document.getElementById('paymentProofModal').style.display = 'flex';
}
function closePaymentProofModal() {
  document.getElementById('paymentProofModal').style.display = 'none';
}

function handlePaymentProofCaptured(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    ttCompressImageSafe(e.target.result, 760, 0.55, 220000).then(function(cd) {
      currentPaymentProofBase64 = cd;
      const preview = document.getElementById('payProofPreview');
      preview.src = currentPaymentProofBase64;
      preview.style.display = 'block';
      document.getElementById('confirmCollectPayBtn').disabled = false;
    });
  };
  reader.readAsDataURL(file);
}

function executeConfirmedPaymentCollection() {
  const ordId = document.getElementById('pendingCollectOrderId').value;
  const amt = parseFloat(document.getElementById('payCollectInputAmt').value) || 0;
  const payModeChosen = document.getElementById('payCollectModeSelect').value;

  if (amt <= 0) { alert("Please enter a valid amount!"); return; }
  if (!currentPaymentProofBase64) { alert("Please attach the payment receipt photo!"); return; }

  const o = ordersData.find(x => x.id === ordId);
  if (!o) return;

  o.recvAmount = (o.recvAmount || 0) + amt;
  o.dueAmount = Math.max(0, o.totalAmount - o.recvAmount);
  o.lastPaymentProof = currentPaymentProofBase64;
  o.lastPaymentDate = ttYmd(new Date());
  o.payMode = payModeChosen;
  o.payments = Array.isArray(o.payments) ? o.payments : [];
  o.payments.push({ amount: amt, mode: payModeChosen, at: getNowStr(), by: currentUser ? currentUser.name : 'Staff', photo: currentPaymentProofBase64 });

  if (payModeChosen === 'Cash') {
    playAtmCashSound();
  } else {
    playCoinSound();
  }

  triggerMoneyRainEffect();

  setStored("ORDERS", ordersData);
  closePaymentProofModal();
  renderBilling('all');
  renderDashboard();

  if (window.cloudSync && typeof window.cloudSync.pushLiveNotification === 'function') {
    window.cloudSync.pushLiveNotification({
      title: "💰 Payment Received!",
      body: `₹${amt.toLocaleString('en-IN')} received for ${o.customerName}`,
      type: "payment"
    });
  }

  setTimeout(() => {
    alert("Payment recorded successfully with receipt proof!");
  }, 400);
}

function deleteOrderAction(id) {
  if (!isAdminUser()) { alert("Admin only!"); return; }
  if(confirm("Confirm DELETE order?")) {
    ordersData = ordersData.filter(x => x.id !== id);
    setStored("ORDERS", ordersData);
    renderOrders();
    renderBilling('all');
  }
}
function editOrderPrompt(ordId) {
  const o = ordersData.find(x => x.id === ordId);
  if(o) openOrderModal(o);
}

// NATIVE SHARE SHEET: mobile par navigator.share() browser/OS ka apna native
// share sheet khol deta hai (WhatsApp, Telegram, Email, SMS - jo bhi app
// installed ho use dikhta hai), seedha wa.me link kholne se zyada flexible.
// Agar yeh available/supported nahi hai (desktop browser) ya fail ho jaye
// (user cancel kare to AbortError - wahan kuch nahi karte), to purana clean
// plain-text fallback (wa.me / print) chalta hai - functionality kahin nahi tuti.
async function ttNativeShareOrFallback(shareData, fallbackFn) {
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false; // user ne share sheet cancel ki
  }
  if (typeof fallbackFn === 'function') fallbackFn();
  return false;
}
window.ttNativeShareOrFallback = ttNativeShareOrFallback;

function shareOrderWhatsApp(ordId) {
  const o = ordersData.find(x => x.id === ordId);
  if(!o) return;
  const itemsTextPlain = o.items.map(i => `${i.name} (x${i.qty}, Disc:${i.disc || 0}%) - Rs.${i.total}`).join('\n');
  const plainMsg = `TWIN TOWN EXPRESS SERVICES PVT LTD\nInvoice: ${o.id}\nCustomer: ${o.customerName}\n-----------------------\nItems:\n${itemsTextPlain}\n-----------------------\nTotal Bill: Rs.${o.totalAmount}\nPaid: Rs.${o.recvAmount}\nDue: Rs.${o.dueAmount}\n\nRasulgarh, Bhubaneswar`;
  ttNativeShareOrFallback(
    { title: `TTESPL Invoice ${o.id}`, text: plainMsg },
    function () {
      const itemsText = o.items.map(i => `${i.name} (x${i.qty}, Disc:${i.disc || 0}%) - Rs.${i.total}`).join('%0A');
      const msg = `*TWIN TOWN EXPRESS SERVICES PVT LTD*%0A*Invoice:* ${o.id}%0A*Customer:* ${o.customerName}%0A-----------------------%0A*Items:*%0A${itemsText}%0A-----------------------%0A*Total Bill:* Rs.${o.totalAmount}%0A*Paid:* Rs.${o.recvAmount}%0A*Due:* Rs.${o.dueAmount}%0A%0A_Rasulgarh, Bhubaneswar_`;
      window.open(o.phone ? `https://wa.me/91${o.phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
    }
  );
}

// Shared PDF/print helper - ek alag hidden page me content bhejta hai (poore app se alag),
// isliye Android app ke "Save as PDF" me bhi hamesha sahi content aata hai, blank nahi.
function ttPrintHtml(title, bodyHtml) {
  let ifr = document.getElementById('ttPrintFrame');
  if (!ifr) {
    ifr = document.createElement('iframe');
    ifr.id = 'ttPrintFrame';
    ifr.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;';
    document.body.appendChild(ifr);
  }
  const doc = ifr.contentWindow.document;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title || 'TTESPL Report') + '</title>' +
    (bodyHtml.indexOf('tt-sheet') >= 0
      ? '<style>*{box-sizing:border-box;} html,body{margin:0;padding:0;background:#fff;} body{font-family:Arial,Helvetica,sans-serif;color:#000;} table{border-collapse:collapse;} @page{size:A4;margin:0;} .tt-sheet{margin:0 !important;box-shadow:none !important;}</style>'
      : '<style>*{box-sizing:border-box;} body{margin:0;padding:10px;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;} table{border-collapse:collapse;width:100%;} @page{margin:8mm;}</style>') +
    '</head><body>' + bodyHtml + '</body></html>'
  );
  doc.close();
  // Android app ke print bridge ko poora page render hone ka thoda time dete hain
  // (isi delay ki kami se "mobile app" me PDF blank aa raha tha)
  setTimeout(() => {
    try {
      ifr.contentWindow.focus();
      ifr.contentWindow.print();
    } catch (e) {
      console.error('Frame print failed, falling back', e);
      window.focus(); window.print();
    }
  }, 400);
}
window.ttPrintHtml = ttPrintHtml;

function executeInvoicePrint() {
  const src = document.getElementById('tallyInvoiceBody');
  if (!src || !src.innerHTML.trim()) { window.focus(); setTimeout(() => window.print(), 150); return; }
  ttPrintHtml('Tax Invoice', src.innerHTML);
}

function downloadBusinessSummaryReport() {
  const today = ttYmd(new Date());
  const delivered = ordersData.filter(o => o.status === 'Delivered');
  const totalBilled = delivered.reduce((s, o) => s + o.totalAmount, 0);
  const totalRecv = delivered.reduce((s, o) => s + o.recvAmount, 0);
  const totalDue = delivered.reduce((s, o) => s + o.dueAmount, 0);

  const byStaff = {};
  delivered.forEach(o => {
    const k = o.bookedBy || 'Unassigned';
    if (!byStaff[k]) byStaff[k] = { bills: 0, billed: 0, recv: 0, due: 0 };
    byStaff[k].bills++; byStaff[k].billed += o.totalAmount; byStaff[k].recv += o.recvAmount; byStaff[k].due += o.dueAmount;
  });

  const dueList = delivered.filter(o => o.dueAmount > 0).sort((a, b) => b.dueAmount - a.dueAmount).slice(0, 25);

  const rupee = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const th = 'style="padding:6px 8px; border:1px solid #ccc; background:#0a2540; color:#fff; text-align:left; font-size:12px;"';
  const td = 'style="padding:6px 8px; border:1px solid #ccc; font-size:12px;"';

  const staffRows = Object.keys(byStaff).sort((a, b) => byStaff[b].billed - byStaff[a].billed).map(k => {
    const s = byStaff[k];
    return `<tr><td ${td}>${esc(k)}</td><td ${td}>${s.bills}</td><td ${td}>${rupee(s.billed)}</td><td ${td}>${rupee(s.recv)}</td><td ${td}>${rupee(s.due)}</td></tr>`;
  }).join('');

  const dueRows = dueList.map(o => `<tr><td ${td}>${esc(o.customerName)}</td><td ${td}>${esc(o.id)}</td><td ${td}>${esc(o.bookedBy || '-')}</td><td ${td}>${rupee(o.dueAmount)}</td></tr>`).join('');

  const html = `
    <h2 style="margin:0 0 4px;">TTESPL - Business Summary Report</h2>
    <div style="font-size:12px; color:#555; margin-bottom:16px;">Generated: ${today}</div>
    <div style="display:flex; gap:14px; margin-bottom:18px;">
      <div style="flex:1; border:1px solid #ccc; border-radius:8px; padding:10px;"><div style="font-size:11px; color:#555;">TOTAL BILLED</div><div style="font-size:18px; font-weight:800;">${rupee(totalBilled)}</div></div>
      <div style="flex:1; border:1px solid #ccc; border-radius:8px; padding:10px;"><div style="font-size:11px; color:#555;">RECEIVED</div><div style="font-size:18px; font-weight:800;">${rupee(totalRecv)}</div></div>
      <div style="flex:1; border:1px solid #ccc; border-radius:8px; padding:10px;"><div style="font-size:11px; color:#555;">DUE REMAINING</div><div style="font-size:18px; font-weight:800;">${rupee(totalDue)}</div></div>
    </div>
    <h3 style="margin:0 0 8px;">Staff-wise Sales & Due</h3>
    <table style="margin-bottom:18px;"><tr><th ${th}>Staff</th><th ${th}>Bills</th><th ${th}>Billed</th><th ${th}>Received</th><th ${th}>Due</th></tr>${staffRows || `<tr><td ${td} colspan="5">No data</td></tr>`}</table>
    <h3 style="margin:0 0 8px;">Top Due Customers</h3>
    <table><tr><th ${th}>Customer</th><th ${th}>Invoice</th><th ${th}>Staff</th><th ${th}>Due</th></tr>${dueRows || `<tr><td ${td} colspan="4">No dues</td></tr>`}</table>
  `;
  ttPrintHtml('Business Summary Report', html);
}
window.downloadBusinessSummaryReport = downloadBusinessSummaryReport;

function openInvoicePrintModal(ordId) {
  const o = ordersData.find(x => String(x.id) === String(ordId));
  if(!o) return;
  document.getElementById("tallyInvoiceBody").innerHTML = buildTallyInvoiceHtml(o);
  document.getElementById("invoicePrintModal").style.display = "flex";
  try { ttFitPreview('tallyInvoiceBody'); } catch (e) {}
}
function closeInvoicePrintModal() { document.getElementById('invoicePrintModal').style.display = 'none'; }

function openDailyCashClosingModal() {
  const today = ttYmd(new Date());
  document.getElementById('closeSummaryDate').textContent = today;
  document.getElementById('closeSummaryStaff').textContent = currentUser ? currentUser.name : "Staff";

  let cashTotal = 0, upiTotal = 0, bankTotal = 0;
  ordersData.forEach(o => {
    if(o.orderDate === today && o.recvAmount > 0 && o.status !== 'Cancelled') {
      if(o.payMode === 'Cash') cashTotal += o.recvAmount;
      else if(o.payMode.includes('UPI')) upiTotal += o.recvAmount;
      else bankTotal += o.recvAmount;
    }
  });

  document.getElementById('closeCashAmt').textContent = '₹' + cashTotal.toLocaleString('en-IN');
  document.getElementById('closeUpiAmt').textContent = '₹' + upiTotal.toLocaleString('en-IN');
  document.getElementById('closeBankAmt').textContent = '₹' + bankTotal.toLocaleString('en-IN');
  document.getElementById('cashClosingModal').style.display = 'flex';
}
function closeDailyCashClosingModal() { document.getElementById('cashClosingModal').style.display = 'none'; }
function calcCashDenominations() {
  const total = (parseInt(document.getElementById('note500').value||0)*500) + (parseInt(document.getElementById('note200').value||0)*200) + (parseInt(document.getElementById('note100').value||0)*100) + (parseInt(document.getElementById('note50').value||0)*50) + (parseInt(document.getElementById('note20').value||0)*20) + (parseInt(document.getElementById('note10').value||0)*10);
  document.getElementById('denomTotalDisplay').textContent = '₹' + total.toLocaleString('en-IN');
}
function sendClosingSummaryWhatsApp() {
  const msg = `*DAILY CASH & SALES CLOSING REPORT*%0A*Company:* TTESPL Rasulgarh, BBSR%0A*Cash:* ${document.getElementById('closeCashAmt').textContent}%0A*UPI:* ${document.getElementById('closeUpiAmt').textContent}`;
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

/* TAB 3: SERVICES */
function renderServices() {
  const c = document.getElementById('serviceListContainer');
  c.innerHTML = '';
  const today = ttYmd(new Date());
  const isAdmin = isAdminUser();

  if (serviceCallsData.length === 0) {
    if (ttMaybeSkeleton(c, 3)) return;
    c.innerHTML = `<div style="text-align:center; padding:25px; color:var(--text-muted); font-size:12.5px;">No repair calls pending.</div>`;
    return;
  }

  let displayServices = serviceCallsData;
  const servicesFiltersActive = servicesFilterState.staff !== "ALL" || servicesFilterState.from || servicesFilterState.to;
  if (servicesFilterState.staff !== "ALL") displayServices = displayServices.filter(s => s.attendedBy === servicesFilterState.staff);
  if (servicesFilterState.from) displayServices = displayServices.filter(s => s.recvDate >= servicesFilterState.from);
  if (servicesFilterState.to) displayServices = displayServices.filter(s => s.recvDate <= servicesFilterState.to);

  if (displayServices.length === 0 && servicesFiltersActive) {
    c.innerHTML = `<div class="empty-state"><span class="empty-icon">🔎</span><div class="empty-sub">No service calls match this filter.</div></div>`;
    return;
  }

  displayServices.forEach(s => {
    let statusBadge = s.status === 'Work Completed' ? 'badge-delivered' : (s.targetDate === today ? 'badge-today' : 'badge-pending');
    let statusText = s.status === 'Work Completed' ? '✓ Completed' : (s.targetDate === today ? '🔔 DUE TODAY' : `Target: ${s.targetDate}`);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header">
        <div>
          <strong style="font-size:15px; color:var(--text-main);">${ttEscHtml(s.customerName)}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">Call: ${s.recvDate} | Tech: <strong>${s.attendedBy}</strong></div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <span class="badge ${statusBadge}">${statusText}</span>
          <button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); editServicePrompt('${s.id}')">✏️ Edit</button>
          ${isAdmin ? `<button class="btn btn-danger-sm admin-only-btn" onclick="triggerAppHaptic(); deleteServiceAction('${s.id}')">🗑️</button>` : ''}
        </div>
      </div>
      <div style="font-size:12.5px; margin-bottom:6px;"><strong>Machine:</strong> ${ttEscHtml(s.machine)}</div>
      <div style="font-size:12px; margin-bottom:10px;"><strong>Issue:</strong> ${ttEscHtml(s.problem)}</div>
      ${s.status === 'Work Completed' ? `<div style="background:var(--success-bg); padding:8px; border-radius:8px; font-size:11.5px; margin-bottom:6px;">✅ <strong>Done:</strong> ${s.actionDone}</div>
        ${s.stockDeducted ? `<div style="font-size:10.5px; color:var(--text-muted); margin-bottom:6px;">📦 <strong>Part used:</strong> ${esc(s.partUsed || '')} x${s.partQty || 1} <span class="badge badge-info" style="font-size:9px;">Stock Auto-Deducted</span></div>` : ''}
        <div style="display:flex; gap:6px;">
          <button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openServiceReportModal('${s.id}')">📄 ${s.report ? 'Edit/Print Report' : 'Create Report Card'}</button>
        </div>` : `<button class="btn btn-primary btn-sm btn-block" onclick="triggerAppHaptic(); openExecuteServiceModal('${s.id}')">🛠️ Attend & Complete</button>`}
    `;
    c.appendChild(card);
  });
}
window.renderServices = renderServices;

function openServiceCallModal(srvObj = null) {
  const title = document.getElementById('serviceModalTitle');
  const editId = document.getElementById('editServiceId');
  if(srvObj) {
    title.textContent = "Edit Service Call";
    editId.value = srvObj.id;
    document.getElementById('srvCustSearchInput').value = `${srvObj.customerName} (${srvObj.phone || ''})`;
    document.getElementById('srvStaffSelect').value = srvObj.attendedBy;
    document.getElementById('srvMachine').value = srvObj.machine;
    document.getElementById('srvRecvDate').value = srvObj.recvDate;
    document.getElementById('srvTargetDate').value = srvObj.targetDate;
    document.getElementById('srvStatusSelect').value = srvObj.status;
    document.getElementById('srvProblem').value = srvObj.problem;
    document.getElementById('srvPartSearchInput').value = srvObj.partUsed || "";
    document.getElementById('srvPartQty').value = srvObj.partQty || 1;
    toggleServiceCompletionFields(srvObj.status);
  } else {
    title.textContent = "New Service / Repair Call";
    editId.value = "";
    const today = ttYmd(new Date());
    document.getElementById('srvCustSearchInput').value = "";
    document.getElementById('srvRecvDate').value = today;
    document.getElementById('srvTargetDate').value = today;
    document.getElementById('srvMachine').value = "";
    document.getElementById('srvProblem').value = "";
    document.getElementById('srvPartSearchInput').value = "";
    document.getElementById('srvPartQty').value = 1;
    document.getElementById('srvStatusSelect').value = "Pending / Scheduled";
    toggleServiceCompletionFields("Pending / Scheduled");
  }
  ttOpenSheetModal('serviceModal');
}
function closeServiceModal() { ttCloseSheetModal('serviceModal'); }
function toggleServiceCompletionFields(statusVal) {
  document.getElementById('srvCompletedFields').style.display = (statusVal === 'Work Completed') ? 'block' : 'none';
}

function saveServiceAction() {
  const editId = document.getElementById('editServiceId').value;
  const custSearch = document.getElementById('srvCustSearchInput').value.trim();
  const cust = resolveCustomerFromSearch(custSearch);
  const staff = document.getElementById('srvStaffSelect').value;
  const mach = document.getElementById('srvMachine').value.trim();
  const rDate = document.getElementById('srvRecvDate').value;
  const tDate = document.getElementById('srvTargetDate').value;
  const status = document.getElementById('srvStatusSelect').value;
  const prob = document.getElementById('srvProblem').value.trim();

  let actDone = "";
  let partSearch = "", partQty = 0;
  if(status === 'Work Completed') {
    actDone = document.getElementById('srvActionDone').value.trim();
    partSearch = document.getElementById('srvPartSearchInput').value.trim();
    partQty = parseInt(document.getElementById('srvPartQty').value) || 1;
  }

  const custName = cust ? cust.name : custSearch.split('(')[0].trim();
  const phone = cust ? cust.phone : "";

  // PARTS AUTO-DEDUCTION: jab service call "Work Completed" mark ho aur ek
  // part link kiya gaya ho, to uska stock turant inventory se deduct hota hai
  // aur dono jagah (service record + inventory item) ek clear audit trail
  // entry likhi jaati hai - taaki baad me pata chale kab, kitna, kis service
  // call ke liye stock kata. Agar yeh part pehle hi ek baar deduct ho chuka
  // hai (edit karke dobara save kiya), to dobara deduct nahi hota.
  let stockDeductNote = "";
  let linkedPart = null;
  if (status === 'Work Completed' && partSearch) {
    linkedPart = resolvePartFromSearch(partSearch);
  }

  if(editId) {
    const s = serviceCallsData.find(x => x.id === editId);
    if(s) {
      const alreadyDeducted = !!s.stockDeducted;
      s.customerName = custName; s.phone = phone; s.attendedBy = staff; s.machine = mach;
      s.recvDate = rDate; s.targetDate = tDate; s.status = status; s.problem = prob; s.actionDone = actDone;
      s.partUsed = partSearch; s.partQty = partQty;
      if (linkedPart && !alreadyDeducted) {
        linkedPart.stock = Math.max(0, (linkedPart.stock || 0) - partQty);
        linkedPart.stockAudit = linkedPart.stockAudit || [];
        linkedPart.stockAudit.unshift({ by: staff || (currentUser ? currentUser.name : 'Staff'), time: getNowStr(), note: `-${partQty} used in Service Call ${s.id} (${custName})` });
        s.stockDeducted = true;
        stockDeductNote = ` Stock auto-deducted: ${linkedPart.name} x${partQty}.`;
        s.auditTrail = s.auditTrail || [];
        s.auditTrail.unshift({ by: staff || (currentUser ? currentUser.name : 'Staff'), time: getNowStr(), note: `Part "${linkedPart.name}" x${partQty} deducted from inventory` });
      }
    }
  } else {
    const newS = {
      id: "SRV-" + Math.floor(100 + Math.random() * 900),
      customerName: custName, phone, machine: mach || "HPW Pump", recvDate: rDate,
      targetDate: tDate, status, problem: prob, attendedBy: staff, actionDone: actDone,
      partUsed: partSearch, partQty: partQty
    };
    if (linkedPart) {
      linkedPart.stock = Math.max(0, (linkedPart.stock || 0) - partQty);
      linkedPart.stockAudit = linkedPart.stockAudit || [];
      linkedPart.stockAudit.unshift({ by: staff || (currentUser ? currentUser.name : 'Staff'), time: getNowStr(), note: `-${partQty} used in Service Call ${newS.id} (${custName})` });
      newS.stockDeducted = true;
      stockDeductNote = ` Stock auto-deducted: ${linkedPart.name} x${partQty}.`;
      newS.auditTrail = [{ by: staff || (currentUser ? currentUser.name : 'Staff'), time: getNowStr(), note: `Part "${linkedPart.name}" x${partQty} deducted from inventory` }];
    }
    serviceCallsData.unshift(newS);
  }

  if (linkedPart) { setStored("INVENTORY", sampleInventory); renderStockList(); }
  setStored("SERVICES", serviceCallsData);
  const savedId = editId || serviceCallsData[0].id;
  closeServiceModal();
  renderServices();
  renderDashboard();
  // Jab bhi call "Work Completed" mark ho, turant uska Service Report Card khol dete hain
  const savedRec = serviceCallsData.find(x => x.id === savedId);
  if (status === 'Work Completed' && savedRec && !savedRec.report) {
    setTimeout(function () { openServiceReportModal(savedId); }, 200);
  } else {
    alert("Service record saved!" + stockDeductNote);
  }
}

function deleteServiceAction(id) {
  if (!isAdminUser()) { alert("Admin only!"); return; }
  if(confirm("Confirm DELETE service?")) {
    serviceCallsData = serviceCallsData.filter(x => x.id !== id);
    setStored("SERVICES", serviceCallsData);
    renderServices();
  }
}
function openExecuteServiceModal(srvId) {
  const s = serviceCallsData.find(x => x.id === srvId);
  if(s) { openServiceCallModal(s); document.getElementById('srvStatusSelect').value = "Work Completed"; toggleServiceCompletionFields("Work Completed"); }
}
function editServicePrompt(srvId) {
  const s = serviceCallsData.find(x => x.id === srvId);
  if(s) openServiceCallModal(s);
}

/* TAB 4: INVENTORY */
let activeInventoryCategory = 'ALL';
const STOCK_RENDER_CAP = 60;

function updateCategoryCounts() {
  const byCat = {};
  sampleInventory.forEach(i => { byCat[i.category] = (byCat[i.category] || 0) + 1; });
  const setEl = (id, count) => { const el = document.getElementById(id); if(el) el.textContent = count.toLocaleString('en-IN'); };
  setEl('catCountAll', sampleInventory.length);
  setEl('catCountMach', byCat['Machines & Equipment'] || 0);
  setEl('catCountCat', byCat['Catalog Equipment'] || 0);
  setEl('catCountMafraChem', byCat['Ma-Fra Chemicals'] || 0);
  setEl('catCountMafraDet', byCat['Mafra Detailing'] || 0);
  setEl('catCountManiac', byCat['Maniac Line'] || 0);
  setEl('catCountMaxshine', byCat['Maxshine Gear & Tools'] || 0);
  setEl('catCountVista', byCat['Vista Car Care'] || 0);
  setEl('catCountSpares', byCat['Machine Spares'] || 0);
  setEl('catCountFireball', byCat['Fireball'] || 0);
  setEl('catCountCust', customerDatabase.length);
}

function selectInventoryCategory(categoryName, btnEl) {
  activeInventoryCategory = categoryName;
  document.querySelectorAll('#inventoryCategoryTabs .cat-chip').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  document.getElementById('currentCategoryTitle').textContent = categoryName === 'ALL' ? '• All Categories' : `• Category: ${categoryName}`;
  document.getElementById('dynamicRegisterClientBtn').style.display = (categoryName === 'CUSTOMERS') ? 'inline-flex' : 'none';
  renderStockList();
}

function renderStockList() {
  const c = document.getElementById('stockListContainer');
  if(!c) return;
  c.innerHTML = '';
  updateCategoryCounts();
  const isAdmin = isAdminUser();
  const onlyAvailable = document.getElementById('onlyAvailableStockCheck').checked;

  if (activeInventoryCategory === 'CUSTOMERS') {
    document.getElementById('totalPartsBadge').textContent = `${customerDatabase.length} Clients`;
    if (customerDatabase.length === 0 && ttMaybeSkeleton(c, 4)) return;
    ttEach(c, customerDatabase, cust => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cursor = 'pointer';
      card.onclick = () => { triggerAppHaptic(); ttCustDash(cust.id); };
      card.innerHTML = `
        <div class="card-header">
          <div><strong>${ttEscHtml(cust.name)}</strong><div style="font-size:11px; color:var(--text-muted);">${cust.phone}</div></div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); triggerAppHaptic(); ttCustDash(${cust.id})">📊 Dashboard</button>
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); triggerAppHaptic(); editCustomerPrompt(${cust.id})">✏️ Edit</button>
          </div>
        </div>
        <div style="font-size:11.5px; color:var(--text-muted);">📍 ${cust.address || 'Odisha'} | GSTIN: ${cust.gst || 'Unregistered'}</div>
      `;
      c.appendChild(card);
    });
    return;
  }

  let list = (activeInventoryCategory === 'ALL') ? sampleInventory : sampleInventory.filter(i => i.category === activeInventoryCategory);
  
  if (onlyAvailable) {
    list = list.filter(i => i.stock > 0);
  }

  document.getElementById('totalPartsBadge').textContent = `${list.length} Items`;

  if (list.length === 0 && sampleInventory.length === 0 && ttMaybeSkeleton(c, 4)) return;

  ttEach(c, list, item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cursor = 'pointer';
    card.onclick = () => { triggerAppHaptic(); openStockDetailModal(item.id); };
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <span style="font-size:11px; font-weight:700; color:var(--cyan);">${item.code || ''}</span>
          <strong style="font-size:14px; color:var(--text-main); display:block;">${ttEscHtml(item.name)}</strong>
          <div style="font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">${item.category}${ttBrandBadge(item.name)}</div>
        </div>
        <div style="text-align:right;">
          <span class="badge ${item.stock <= ttLowLimit(item) ? 'badge-danger low-stock-pulse' : 'badge-delivered'}">${item.stock} in stock</span>
          <div style="font-size:13.5px; font-weight:800; color:var(--text-main); margin-top:4px;">MRP: ₹${item.rate || 0}</div>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:8px; border-top:1px solid var(--border); padding-top:6px;">
        <button class="btn btn-wa btn-sm" onclick="event.stopPropagation(); triggerAppHaptic(); ttShareProduct('${item.id}')">📤 Share</button>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); triggerAppHaptic(); editStockItemPrompt(${item.id})">✏️ Edit</button>
        ${isAdmin ? `<button class="btn btn-danger-sm admin-only-btn" onclick="event.stopPropagation(); triggerAppHaptic(); deleteStockItem(${item.id})">🗑️</button>` : ''}
      </div>
    `;
    if (item.stock <= ttLowLimit(item)) card.classList.add('low-stock-card-pulse');
    c.appendChild(card);
  });
}
window.renderStockList = renderStockList;

function filterStockList(val) {
  const q = String(val || '').toLowerCase().trim();
  const c = document.getElementById('stockListContainer');
  if(!c) return;
  c.innerHTML = '';
  const onlyAvailable = document.getElementById('onlyAvailableStockCheck').checked;

  let list = (activeInventoryCategory === 'CUSTOMERS') ? customerDatabase : sampleInventory;
  if (activeInventoryCategory !== 'Catalog Equipment' && activeInventoryCategory !== 'CUSTOMERS') {
    list = list.filter(i => i.category !== 'Catalog Equipment');
  }

  if (onlyAvailable && activeInventoryCategory !== 'CUSTOMERS') {
    list = list.filter(i => i.stock > 0);
  }

  const results = q ? list.filter(i => (i.name && i.name.toLowerCase().includes(q)) || (i.code && i.code.toLowerCase().includes(q))) : list;

  document.getElementById('totalPartsBadge').textContent = `${results.length} Matches`;
  ttEach(c, results, item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cursor = 'pointer';
    card.onclick = () => {
      triggerAppHaptic();
      if (activeInventoryCategory === 'CUSTOMERS') editCustomerPrompt(item.id);
      else openStockDetailModal(item.id);
    };
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <span style="font-size:11px; font-weight:700; color:var(--cyan);">${item.code || ''}</span>
          <strong style="font-size:14px; color:var(--text-main); display:block;">${ttEscHtml(item.name)}</strong>
          <div style="font-size:11px; color:var(--text-muted);">${item.category || item.phone || ''}</div>
        </div>
        <div style="text-align:right;">
          ${item.stock !== undefined ? `<span class="badge ${item.stock <= ttLowLimit(item) ? 'badge-danger low-stock-pulse' : 'badge-delivered'}">${item.stock} in stock</span>` : ''}
          <div style="font-size:13.5px; font-weight:800; color:var(--text-main); margin-top:4px;">${item.rate ? 'MRP: ₹' + item.rate : (item.address || '')}</div>
        </div>
      </div>
    `;
    if (item.stock !== undefined && item.stock <= ttLowLimit(item)) card.classList.add('low-stock-card-pulse');
    c.appendChild(card);
  });
}
window.filterStockList = filterStockList;

let activeStockDetailId = null;
function openStockDetailModal(id) {
  const item = sampleInventory.find(x => x.id === id);
  if (!item) return;
  activeStockDetailId = id;
  document.getElementById('detName').textContent = item.name;
  document.getElementById('detMeta').textContent = `${item.category} • Code: ${item.code || 'N/A'}`;
  document.getElementById('detDealer').textContent = '₹' + Number(item.dealerPrice || 0).toLocaleString('en-IN');
  document.getElementById('detMrp').textContent = '₹' + Number(item.rate || 0).toLocaleString('en-IN');
  document.getElementById('detStock').textContent = item.stock;
  document.getElementById('stockDetailModal').style.display = 'flex';
}
function closeStockDetailModal() { document.getElementById('stockDetailModal').style.display = 'none'; }
function editFromDetailModal() {
  const item = sampleInventory.find(x => x.id === activeStockDetailId);
  closeStockDetailModal();
  if (item) openAddPartModal(item);
}

function openAddPartModal(partObj = null) {
  const title = document.getElementById('stockModalTitle');
  const editId = document.getElementById('editStockId');
  if(partObj) {
    title.textContent = "Edit Inventory Item";
    editId.value = partObj.id;
    document.getElementById('stkName').value = partObj.name;
    document.getElementById('stkCode').value = partObj.code;
    ttSetStockCategory(partObj.category);
    document.getElementById('stkMachine').value = partObj.machine || "";
    document.getElementById('stkHsn').value = partObj.hsn || "";
    document.getElementById('stkQty').value = partObj.stock;
    document.getElementById('stkDealerRate').value = partObj.dealerPrice || 0;
    document.getElementById('stkRate').value = partObj.rate;
    document.getElementById('stkDesc').value = partObj.desc || "";
  } else {
    title.textContent = "Add New Item";
    editId.value = "";
    document.getElementById('stkName').value = "";
    document.getElementById('stkCode').value = "";
    ttSetStockCategory('Machine Spares');
    document.getElementById('stkMachine').value = "";
    document.getElementById('stkHsn').value = "84139190";
    document.getElementById('stkQty').value = "0";
    document.getElementById('stkDealerRate').value = "";
    document.getElementById('stkRate').value = "";
    document.getElementById('stkDesc').value = "";
  }
  document.getElementById('stockItemModal').style.display = 'flex';
}
function closeStockModal() { document.getElementById('stockItemModal').style.display = 'none'; }

function saveStockItemAction() {
  const editId = document.getElementById('editStockId').value;
  const name = document.getElementById('stkName').value.trim();
  const code = document.getElementById('stkCode').value.trim();
  const cat = document.getElementById('stkCategory').value.trim() || "Spares";
  const stock = parseInt(document.getElementById('stkQty').value) || 0;
  const dealerPrice = parseFloat(document.getElementById('stkDealerRate').value) || 0;
  const rate = parseFloat(document.getElementById('stkRate').value) || 0;

  if(!name || !code) { alert("Please enter name and code!"); return; }

  if(editId) {
    const item = sampleInventory.find(x => x.id === parseInt(editId));
    if(item) { item.name = name; item.code = code; item.category = cat; item.stock = stock; item.dealerPrice = dealerPrice; item.rate = rate; item.machine = document.getElementById('stkMachine').value.trim(); item.hsn = document.getElementById('stkHsn').value.trim() || item.hsn || '84139190'; item.desc = document.getElementById('stkDesc').value.trim(); }
  } else {
    sampleInventory.unshift({ id: Date.now(), name, code, category: cat, stock, dealerPrice, rate, machine: document.getElementById('stkMachine').value.trim(), hsn: document.getElementById('stkHsn').value.trim() || '84139190', desc: document.getElementById('stkDesc').value.trim() });
  }

  setStored("INVENTORY", sampleInventory);
  closeStockModal();
  renderStockList();
  alert("Item saved!");
}
