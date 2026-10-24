/* TTESPL ERP module: 03-reports-ledger-quotation-catalog.js */
/* ===== DIGITAL REPORT CARDS: Installation Report (Leads) + Service Call Report (Service) ===== */
function ttAddDays(dateStr, n) { const d = new Date(dateStr); d.setDate(d.getDate() + n); return ttYmd(d); }
function ttAddMonths(dateStr, n) { const d = new Date(dateStr); d.setMonth(d.getMonth() + n); return ttYmd(d); }

// MAINTENANCE SCHDULE OF PUMP HRC (dinon me, installation date se)
const TT_MAINT_SCHEDULE = [
  { part: 'Oil Change', days: 100, code: '0,260 Kg Oil MOBIL DELVAC' },
  { part: 'Valve Change', days: 525, code: '2186' },
  { part: 'Piston Change', days: 365, code: '42467' },
  { part: 'Gasket Change', days: 150, code: '42469' },
  { part: 'Oil Seal Change', days: 365, code: '42468' },
  { part: 'Unloader O-Ring Kit', days: 120, code: '2812' },
  { part: 'Unloader Piston', days: 160, code: '1271160' },
  { part: 'Unloader Seat', days: 160, code: '1980200' },
  { part: 'Unloader Spring', days: 160, code: '1271070' },
  { part: 'Piston Guide', days: 720, code: '3200120 & 3200130' }
];

function ttNextDueBadge(lead) {
  const items = [];
  (lead.freeServiceSchedule || []).forEach(f => { if (!f.done) items.push({ label: f.label, date: f.date }); });
  (lead.maintenanceSchedule || []).forEach(m => { if (!m.done) items.push({ label: m.part, date: m.dueDate }); });
  if (items.length === 0) return '';
  items.sort((a, b) => a.date.localeCompare(b.date));
  const n = items[0];
  const today = ttYmd(new Date());
  const overdue = n.date <= today;
  return `<span class="badge ${overdue ? 'badge-pending' : 'badge-info'}" style="font-size:10.5px;">⏰ Next: ${ttEscHtml(n.label)} (${n.date})</span>`;
}

// ---- Shared photo uploader (Installation + Service Report dono isi ko use karte hain) ----
var ttReportPhotos = [];
function ttHandleReportPhotoInput(event, previewContainerId) {
  const files = Array.from(event.target.files || []);
  const remaining = 5 - ttReportPhotos.length;
  files.slice(0, Math.max(0, remaining)).forEach(file => {
    const reader = new FileReader();
    reader.onload = function (e) {
      ttCompressImageSafe(e.target.result, 900, 0.6).then(function (cd) {
        ttReportPhotos.push(cd);
        ttRenderReportPhotoPreview(previewContainerId);
      });
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}
function ttRenderReportPhotoPreview(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  let html = ttReportPhotos.map((p, i) => `
    <div style="position:relative; display:inline-block; margin:3px;">
      <img src="${p}" style="width:60px; height:60px; object-fit:cover; border-radius:8px; border:1px solid var(--border);">
      <span onclick="ttReportPhotos.splice(${i},1); ttRenderReportPhotoPreview('${containerId}')" style="position:absolute; top:-6px; right:-6px; background:var(--danger); color:#fff; border-radius:50%; width:18px; height:18px; font-size:11px; display:flex; align-items:center; justify-content:center; cursor:pointer;">✕</span>
    </div>`).join('');
  if (ttReportPhotos.length < 5) {
    html += `<label style="display:inline-flex; align-items:center; justify-content:center; width:60px; height:60px; border:2px dashed var(--border); border-radius:8px; cursor:pointer; margin:3px; font-size:22px; color:var(--text-muted);">+<input type="file" accept="image/*" multiple style="display:none;" onchange="ttHandleReportPhotoInput(event,'${containerId}')"></label>`;
  }
  c.innerHTML = html;
}

/* -------- INSTALLATION REPORT -------- */
function openInstallationReportModal(leadId) {
  const lead = leadsData.find(x => x.id === leadId);
  if (!lead) return;
  let m = document.getElementById('installReportModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'installReportModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    m.innerHTML = `<div class="auth-card" style="max-width:520px;">
      <div class="card-header"><span class="card-title">✅ Installation Report</span><button class="btn btn-outline btn-sm" onclick="document.getElementById('installReportModal').style.display='none'">✕</button></div>
      <input type="hidden" id="instLeadId">
      <div style="font-size:12.5px; margin-bottom:10px; color:var(--text-muted);" id="instCustInfo"></div>
      <label class="form-label">Product Description</label>
      <input type="text" id="instProductDesc" style="width:100%; margin-bottom:10px;">
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <div style="flex:1;"><label class="form-label">Model No.</label><input type="text" id="instModel" style="width:100%;"></div>
        <div style="flex:1;"><label class="form-label">Serial No.</label><input type="text" id="instSerial" style="width:100%;"></div>
      </div>
      <label class="form-label">Type of Call</label>
      <select id="instCallType" style="width:100%; margin-bottom:10px;">
        <option>New Installation</option><option>Demo Installation</option><option>Reinstallation</option>
      </select>
      <label class="form-label">Engineer Remarks</label>
      <textarea id="instEngRemarks" rows="2" style="width:100%; margin-bottom:10px;"></textarea>
      <label class="form-label">Customer Remarks</label>
      <textarea id="instCustRemarks" rows="2" style="width:100%; margin-bottom:10px;"></textarea>
      <label class="form-label">Photos (Installation site, serial plate, setup - max 5)</label>
      <div id="instPhotoPreview" style="margin-bottom:10px;"></div>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <button class="btn btn-outline btn-sm" onclick="openSignatureModal()">✍️ Customer Signature</button>
        <span id="instSignStatus" style="font-size:11.5px; color:var(--text-muted);">Customer Sign: Not attached</span>
      </div>
      <button class="btn btn-primary btn-block" onclick="saveInstallationReport()">💾 Save &amp; Schedule Free Services</button>
    </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('instLeadId').value = leadId;
  document.getElementById('instCustInfo').textContent = `Customer: ${lead.customerName} | Phone: ${lead.phone || '-'}`;
  document.getElementById('instProductDesc').value = lead.machine || '';
  document.getElementById('instModel').value = '';
  document.getElementById('instSerial').value = '';
  document.getElementById('instCallType').value = 'New Installation';
  document.getElementById('instEngRemarks').value = '';
  document.getElementById('instCustRemarks').value = '';
  window._ttLastSignatureData = null;
  document.getElementById('instSignStatus').textContent = 'Customer Sign: Not attached';
  document.getElementById('instSignStatus').style.color = 'var(--text-muted)';
  ttReportPhotos = [];
  ttRenderReportPhotoPreview('instPhotoPreview');
  m.style.display = 'flex';
}
window.openInstallationReportModal = openInstallationReportModal;

function saveInstallationReport() {
  const leadId = document.getElementById('instLeadId').value;
  const lead = leadsData.find(x => x.id === leadId);
  if (!lead) return;
  const installDate = ttYmd(new Date());
  const d2 = ttAddMonths(installDate, 3);
  const d3 = ttAddMonths(d2, 3);
  const d4 = ttAddMonths(d3, 3);
  lead.installReport = {
    installDate,
    productDesc: document.getElementById('instProductDesc').value.trim(),
    model: document.getElementById('instModel').value.trim(),
    serial: document.getElementById('instSerial').value.trim(),
    callType: document.getElementById('instCallType').value,
    engRemarks: document.getElementById('instEngRemarks').value.trim(),
    custRemarks: document.getElementById('instCustRemarks').value.trim(),
    photos: ttReportPhotos.slice(),
    signature: window._ttLastSignatureData || null
  };
  lead.status = 'Installed';
  lead.freeServiceSchedule = [
    { n: 1, label: '1st Free Service (Reassurance Test)', date: ttAddDays(installDate, 10), done: false },
    { n: 2, label: '2nd Free Service', date: d2, done: false },
    { n: 3, label: '3rd Free Service', date: d3, done: false },
    { n: 4, label: '4th Free Service', date: d4, done: false }
  ];
  lead.maintenanceSchedule = TT_MAINT_SCHEDULE.map(ms => ({
    part: ms.part, code: ms.code, days: ms.days, dueDate: ttAddDays(installDate, ms.days), lastChangedDate: null
  }));

  setStored("LEADS", leadsData);
  document.getElementById('installReportModal').style.display = 'none';
  renderLeads();
  renderDashboard();
  openInstallationReportView(leadId);
}
window.saveInstallationReport = saveInstallationReport;

/* -------- INSTALLATION REPORT: VIEW (print yahan se, + free-service/maintenance tracking) -------- */
function openInstallationReportView(leadId) {
  const lead = leadsData.find(x => x.id === leadId);
  if (!lead || !lead.installReport) { alert('Please create the Installation Report first.'); return; }
  let m = document.getElementById('installReportViewModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'installReportViewModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    document.body.appendChild(m);
  }
  renderInstallationReportView(leadId);
  m.style.display = 'flex';
}
window.openInstallationReportView = openInstallationReportView;

function renderInstallationReportView(leadId) {
  const lead = leadsData.find(x => x.id === leadId);
  const m = document.getElementById('installReportViewModal');
  if (!lead || !m) return;
  const fsHtml = (lead.freeServiceSchedule || []).map((f, i) => `
    <div style="display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border); border-radius:8px; padding:8px 10px; margin-bottom:6px;">
      <div>
        <strong style="font-size:12.5px;">${esc(f.label)}</strong><br>
        <span style="font-size:11.5px; color:var(--text-muted);">Due: ${f.date} ${f.done ? `| ✅ Done on ${f.report ? f.report.date : ''}` : ''}</span>
      </div>
      <button class="btn btn-outline btn-sm" onclick="openFreeServiceReportModal('${leadId}', ${i})">${f.done ? '📋 Edit Report' : '📋 Fill Report'}</button>
    </div>`).join('');
  const msHtml = (lead.maintenanceSchedule || []).map((ms, i) => `
    <div style="border:1px solid var(--border); border-radius:8px; padding:8px 10px; margin-bottom:6px;">
      <div style="display:flex; justify-content:space-between;">
        <strong style="font-size:12.5px;">${esc(ms.part)}</strong>
        <span style="font-size:11.5px; color:${ms.dueDate <= ttYmd(new Date()) ? 'var(--danger)' : 'var(--text-muted)'};">Due: ${ms.dueDate}</span>
      </div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">Kit Code: ${esc(ms.code)}${ms.lastChangedDate ? ` | Last Changed: ${ms.lastChangedDate}` : ''}</div>
      <div style="display:flex; gap:6px; align-items:center;">
        <input type="date" id="msDate_${leadId}_${i}" style="flex:1; font-size:12px; padding:6px;" value="${ttYmd(new Date())}">
        <button class="btn btn-primary btn-sm" onclick="markMaintenancePartChanged('${leadId}', ${i})">✔️ Mark Changed</button>
      </div>
    </div>`).join('');
  m.innerHTML = `<div class="auth-card" style="max-width:560px;">
    <div class="card-header"><span class="card-title">📄 Installation Report</span><button class="btn btn-outline btn-sm" onclick="document.getElementById('installReportViewModal').style.display='none'">✕</button></div>
    <button class="btn btn-primary btn-block" style="margin-bottom:14px;" onclick="printInstallationReport('${leadId}')">🖨️ Print / Save as PDF</button>
    <div style="border:1px solid var(--border); border-radius:10px; padding:10px; margin-bottom:16px; max-height:280px; overflow-y:auto;">${buildInstallationReportHtml(lead)}</div>
    <strong style="font-size:14px;">🗓️ Free Service Schedule</strong>
    <div style="margin:8px 0 16px;">${fsHtml}</div>
    <strong style="font-size:14px;">🔩 Spare Parts / Maintenance Due</strong>
    <div style="margin:8px 0 4px;">${msHtml}</div>
  </div>`;
}
window.renderInstallationReportView = renderInstallationReportView;

function markMaintenancePartChanged(leadId, idx) {
  const lead = leadsData.find(x => x.id === leadId);
  if (!lead || !lead.maintenanceSchedule || !lead.maintenanceSchedule[idx]) return;
  const dateInput = document.getElementById('msDate_' + leadId + '_' + idx);
  const changedDate = dateInput ? dateInput.value : ttYmd(new Date());
  const ms = lead.maintenanceSchedule[idx];
  ms.lastChangedDate = changedDate;
  ms.dueDate = ttAddDays(changedDate, ms.days); // agla due date khud ban jata hai
  setStored("LEADS", leadsData);
  renderInstallationReportView(leadId);
  renderLeads();
  alert(`${ms.part} change date saved. Next due date: ${ms.dueDate}`);
}
window.markMaintenancePartChanged = markMaintenancePartChanged;

/* -------- FREE SERVICE REPORT (per visit) -------- */
function openFreeServiceReportModal(leadId, idx) {
  const lead = leadsData.find(x => x.id === leadId);
  if (!lead || !lead.freeServiceSchedule || !lead.freeServiceSchedule[idx]) return;
  const f = lead.freeServiceSchedule[idx];
  let m = document.getElementById('freeServiceReportModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'freeServiceReportModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    m.innerHTML = `<div class="auth-card" style="max-width:480px;">
      <div class="card-header"><span class="card-title" id="fsReportTitle">📋 Free Service Report</span><button class="btn btn-outline btn-sm" onclick="document.getElementById('freeServiceReportModal').style.display='none'">✕</button></div>
      <input type="hidden" id="fsLeadId"><input type="hidden" id="fsIdx">
      <label class="form-label">Date of Service</label>
      <input type="date" id="fsServiceDate" style="width:100%; margin-bottom:10px;">
      <label class="form-label">Technician Name</label>
      <input type="text" id="fsTechName" style="width:100%; margin-bottom:10px;">
      <label class="form-label">Service Notes / Remarks</label>
      <textarea id="fsNotes" rows="3" style="width:100%; margin-bottom:10px;"></textarea>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <button class="btn btn-outline btn-sm" onclick="openSignatureModal()">✍️ Customer Signature</button>
        <span id="fsSignStatus" style="font-size:11.5px; color:var(--text-muted);">Customer Sign: Not attached</span>
      </div>
      <button class="btn btn-primary btn-block" onclick="saveFreeServiceReport()">💾 Save Service Report</button>
    </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('fsReportTitle').textContent = '📋 ' + f.label;
  document.getElementById('fsLeadId').value = leadId;
  document.getElementById('fsIdx').value = idx;
  const r = f.report || {};
  document.getElementById('fsServiceDate').value = r.date || ttYmd(new Date());
  document.getElementById('fsTechName').value = r.technician || '';
  document.getElementById('fsNotes').value = r.notes || '';
  window._ttLastSignatureData = r.signature || null;
  document.getElementById('fsSignStatus').textContent = r.signature ? 'Customer Sign: ✓ Attached' : 'Customer Sign: Not attached';
  document.getElementById('fsSignStatus').style.color = r.signature ? 'var(--success)' : 'var(--text-muted)';
  m.style.display = 'flex';
}
window.openFreeServiceReportModal = openFreeServiceReportModal;

function saveFreeServiceReport() {
  const leadId = document.getElementById('fsLeadId').value;
  const idx = Number(document.getElementById('fsIdx').value);
  const lead = leadsData.find(x => x.id === leadId);
  if (!lead || !lead.freeServiceSchedule[idx]) return;
  const f = lead.freeServiceSchedule[idx];
  f.report = {
    date: document.getElementById('fsServiceDate').value,
    technician: document.getElementById('fsTechName').value.trim(),
    notes: document.getElementById('fsNotes').value.trim(),
    signature: window._ttLastSignatureData || null
  };
  f.done = true;
  setStored("LEADS", leadsData);
  document.getElementById('freeServiceReportModal').style.display = 'none';
  renderInstallationReportView(leadId);
  renderLeads();
  alert('Free service report saved!');
}
window.saveFreeServiceReport = saveFreeServiceReport;

function buildInstallationReportHtml(lead) {
  const r = lead.installReport || {};
  const photosHtml = (r.photos || []).map(p => `<img src="${p}" style="width:110px; height:110px; object-fit:cover; border-radius:6px; margin:4px; border:1px solid #ccc;">`).join('');
  const fsRows = (lead.freeServiceSchedule || []).map(f => `<tr><td style="border:1px solid #000;padding:4px 6px;">${esc(f.label)}</td><td style="border:1px solid #000;padding:4px 6px;text-align:center;">${f.date}</td></tr>`).join('');
  const msRows = (lead.maintenanceSchedule || []).map(m => `<tr><td style="border:1px solid #000;padding:3px 6px;">${esc(m.part)}</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;">${m.dueDate}</td><td style="border:1px solid #000;padding:3px 6px;text-align:center;">${esc(m.code)}</td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#000;font-size:12px;line-height:1.4;">
    <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;">
      <strong style="font-size:17px;">TWINTOWN EXPRESS SERVICES PVT LTD</strong><br>
      <span style="font-size:13px;">Installation Report</span>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr><td style="padding:3px;"><strong>Customer:</strong> ${esc(lead.customerName)}</td><td style="padding:3px;"><strong>Phone:</strong> ${esc(lead.phone || '-')}</td></tr>
      <tr><td style="padding:3px;"><strong>Product:</strong> ${esc(r.productDesc)}</td><td style="padding:3px;"><strong>Type of Call:</strong> ${esc(r.callType)}</td></tr>
      <tr><td style="padding:3px;"><strong>Model No.:</strong> ${esc(r.model)}</td><td style="padding:3px;"><strong>Serial No.:</strong> ${esc(r.serial)}</td></tr>
      <tr><td style="padding:3px;" colspan="2"><strong>Installation Date:</strong> ${r.installDate}</td></tr>
    </table>
    <div style="margin-bottom:8px;"><strong>Engineer Remarks:</strong> ${esc(r.engRemarks || '-')}</div>
    <div style="margin-bottom:10px;"><strong>Customer Remarks:</strong> ${esc(r.custRemarks || '-')}</div>
    ${photosHtml ? `<div style="margin-bottom:10px;"><strong>Photos:</strong><br>${photosHtml}</div>` : ''}
    <strong style="font-size:13px;">Free Service Schedule</strong>
    <table style="width:100%;border-collapse:collapse;margin:6px 0 12px;"><tr><th style="border:1px solid #000;padding:4px;">Service</th><th style="border:1px solid #000;padding:4px;">Due Date</th></tr>${fsRows}</table>
    <strong style="font-size:13px;">Maintenance / Spare Replacement Schedule</strong>
    <table style="width:100%;border-collapse:collapse;margin:6px 0 12px;"><tr><th style="border:1px solid #000;padding:4px;">Part</th><th style="border:1px solid #000;padding:4px;">Due Date</th><th style="border:1px solid #000;padding:4px;">Kit Code</th></tr>${msRows}</table>
    <div style="display:flex;justify-content:space-between;margin-top:24px;">
      <div>Engineer Signature: _______________</div>
      ${r.signature ? `<div>Customer Signature:<br><img src="${r.signature}" style="width:140px;border-bottom:1px solid #000;"></div>` : `<div>Customer Signature: _______________</div>`}
    </div>
  </div>`;
}
function printInstallationReport(leadId) {
  const lead = leadsData.find(x => x.id === leadId);
  if (!lead || !lead.installReport) { alert('Please create the Installation Report first.'); return; }
  ttPrintHtml('Installation Report - ' + lead.customerName, buildInstallationReportHtml(lead));
}
window.printInstallationReport = printInstallationReport;

/* -------- SERVICE CALL REPORT CARD -------- */
function openServiceReportModal(srvId) {
  const s = serviceCallsData.find(x => x.id === srvId);
  if (!s) return;
  let m = document.getElementById('srvReportModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'srvReportModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    m.innerHTML = `<div class="auth-card" style="max-width:520px;">
      <div class="card-header"><span class="card-title">📄 Service Call Report Card</span><button class="btn btn-outline btn-sm" onclick="document.getElementById('srvReportModal').style.display='none'">✕</button></div>
      <input type="hidden" id="srvRepId">
      <div style="font-size:12.5px; margin-bottom:10px; color:var(--text-muted);" id="srvRepCustInfo"></div>
      <label class="form-label">Cause of Problem</label>
      <input type="text" id="srvRepCause" style="width:100%; margin-bottom:10px;">
      <label class="form-label">Action Taken</label>
      <textarea id="srvRepAction" rows="2" style="width:100%; margin-bottom:10px;"></textarea>
      <label class="form-label">Spare Parts Used / Estimated</label>
      <textarea id="srvRepParts" rows="2" style="width:100%; margin-bottom:10px;" placeholder="e.g. Valve Kit x1, Oil Seal x2"></textarea>
      <label class="form-label">Engineer Remarks</label>
      <textarea id="srvRepEngRemarks" rows="2" style="width:100%; margin-bottom:10px;"></textarea>
      <label class="form-label">Customer Remarks</label>
      <textarea id="srvRepCustRemarks" rows="2" style="width:100%; margin-bottom:10px;"></textarea>
      <label class="form-label">Photos (Before/After repair, replaced parts - max 5)</label>
      <div id="srvRepPhotoPreview" style="margin-bottom:10px;"></div>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <button class="btn btn-outline btn-sm" onclick="openSignatureModal()">✍️ Customer Signature</button>
        <span id="srvReportSignStatus" style="font-size:11.5px; color:var(--text-muted);">Customer Sign: Not attached</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" style="flex:2;" onclick="saveServiceReport()">💾 Save &amp; Print</button>
        <button class="btn btn-outline" style="flex:1;" onclick="document.getElementById('srvReportModal').style.display='none'">Close</button>
      </div>
    </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('srvRepId').value = srvId;
  document.getElementById('srvRepCustInfo').textContent = `Customer: ${s.customerName} | Machine: ${s.machine} | Problem: ${s.problem}`;
  const r = s.report || {};
  document.getElementById('srvRepCause').value = r.cause || '';
  document.getElementById('srvRepAction').value = r.actionTaken || s.actionDone || '';
  document.getElementById('srvRepParts').value = r.parts || '';
  document.getElementById('srvRepEngRemarks').value = r.engRemarks || '';
  document.getElementById('srvRepCustRemarks').value = r.custRemarks || '';
  window._ttLastSignatureData = r.signature || null;
  document.getElementById('srvReportSignStatus').textContent = r.signature ? 'Customer Sign: ✓ Attached' : 'Customer Sign: Not attached';
  document.getElementById('srvReportSignStatus').style.color = r.signature ? 'var(--success)' : 'var(--text-muted)';
  ttReportPhotos = (r.photos || []).slice();
  ttRenderReportPhotoPreview('srvRepPhotoPreview');
  m.style.display = 'flex';
}
window.openServiceReportModal = openServiceReportModal;

function saveServiceReport() {
  const srvId = document.getElementById('srvRepId').value;
  const s = serviceCallsData.find(x => x.id === srvId);
  if (!s) return;
  s.report = {
    date: ttYmd(new Date()),
    cause: document.getElementById('srvRepCause').value.trim(),
    actionTaken: document.getElementById('srvRepAction').value.trim(),
    parts: document.getElementById('srvRepParts').value.trim(),
    engRemarks: document.getElementById('srvRepEngRemarks').value.trim(),
    custRemarks: document.getElementById('srvRepCustRemarks').value.trim(),
    photos: ttReportPhotos.slice(),
    signature: window._ttLastSignatureData || null
  };
  setStored("SERVICES", serviceCallsData);
  document.getElementById('srvReportModal').style.display = 'none';
  renderServices();
  printServiceReport(srvId);
}
window.saveServiceReport = saveServiceReport;

function buildServiceReportHtml(s) {
  const r = s.report || {};
  const photosHtml = (r.photos || []).map(p => `<img src="${p}" style="width:110px; height:110px; object-fit:cover; border-radius:6px; margin:4px; border:1px solid #ccc;">`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#000;font-size:12px;line-height:1.4;">
    <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;">
      <strong style="font-size:17px;">TWINTOWN EXPRESS SERVICES PVT LTD</strong><br>
      <span style="font-size:13px;">Service Call Report Card</span>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
      <tr><td style="padding:3px;"><strong>Customer:</strong> ${esc(s.customerName)}</td><td style="padding:3px;"><strong>Phone:</strong> ${esc(s.phone || '-')}</td></tr>
      <tr><td style="padding:3px;"><strong>Machine/Model:</strong> ${esc(s.machine)}</td><td style="padding:3px;"><strong>Date:</strong> ${r.date || ''}</td></tr>
      <tr><td style="padding:3px;" colspan="2"><strong>Problem Reported:</strong> ${esc(s.problem)}</td></tr>
      <tr><td style="padding:3px;" colspan="2"><strong>Cause:</strong> ${esc(r.cause || '-')}</td></tr>
    </table>
    <div style="margin-bottom:8px;"><strong>Action Taken:</strong> ${esc(r.actionTaken || '-')}</div>
    <div style="margin-bottom:8px;"><strong>Spare Parts Used/Estimated:</strong> ${esc(r.parts || '-')}</div>
    <div style="margin-bottom:8px;"><strong>Engineer Remarks:</strong> ${esc(r.engRemarks || '-')}</div>
    <div style="margin-bottom:10px;"><strong>Customer Remarks:</strong> ${esc(r.custRemarks || '-')}</div>
    ${photosHtml ? `<div style="margin-bottom:10px;"><strong>Photos:</strong><br>${photosHtml}</div>` : ''}
    <div style="display:flex;justify-content:space-between;margin-top:24px;">
      <div>Engineer Signature: _______________</div>
      ${r.signature ? `<div>Customer Signature:<br><img src="${r.signature}" style="width:140px;border-bottom:1px solid #000;"></div>` : `<div>Customer Signature: _______________</div>`}
    </div>
  </div>`;
}
function printServiceReport(srvId) {
  const s = serviceCallsData.find(x => x.id === srvId);
  if (!s || !s.report) { alert('Please save the report first.'); return; }
  ttPrintHtml('Service Report - ' + s.customerName, buildServiceReportHtml(s));
}
window.printServiceReport = printServiceReport;

/* ---- Ledger detail page ---- */
// PREMIUM FULL-SCREEN LIGHTBOX: photo (delivery/payment/CRM/chat) ab ek smooth
// fade+scale-in animation ke saath full-screen khulti hai, image par tap se
// zoom-toggle hota hai, aur neeche ek seedha "Download" button hai jo photo
// ko device me save kar deta hai - bina koi purana ttViewPhoto(src) call
// tootay (signature wahi hai, sirf andar ka UI premium hua hai).
function ttViewPhoto(src) {
  if (!src) { alert('Photo not available.'); return; }
  let m = document.getElementById('ttPhotoViewer');
  if (!m) {
    m = document.createElement('div'); m.id = 'ttPhotoViewer';
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(5,10,20,.94);display:none;align-items:center;justify-content:center;padding:14px;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);';
    m.onclick = (e) => { if (e.target === m) ttCloseLightbox(); };
    m.innerHTML = `
      <img id="ttPhotoViewerImg" style="max-width:100%;max-height:82vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);cursor:zoom-in;transition:transform 0.28s cubic-bezier(0.34,1.56,0.64,1);transform:scale(1);">
      <div style="position:absolute;top:16px;right:18px;color:#fff;font-size:26px;cursor:pointer;background:rgba(255,255,255,0.12);width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;" onclick="ttCloseLightbox()">✕</div>
      <div style="position:absolute;bottom:26px;left:0;right:0;display:flex;justify-content:center;">
        <button class="btn btn-primary" style="box-shadow:0 10px 26px rgba(0,0,0,.4);" onclick="event.stopPropagation(); ttDownloadLightboxPhoto()">⬇️ Download</button>
      </div>`;
    document.body.appendChild(m);
  }
  const img = document.getElementById('ttPhotoViewerImg');
  img.src = src;
  img.style.transform = 'scale(1)';
  img._ttZoomed = false;
  img.onclick = (e) => {
    e.stopPropagation();
    img._ttZoomed = !img._ttZoomed;
    img.style.transform = img._ttZoomed ? 'scale(1.9)' : 'scale(1)';
    img.style.cursor = img._ttZoomed ? 'zoom-out' : 'zoom-in';
  };
  m.style.display = 'flex';
  m.style.animation = 'ttLightboxFadeIn 0.22s ease both';
}
function ttCloseLightbox() {
  const m = document.getElementById('ttPhotoViewer');
  if (m) m.style.display = 'none';
}
function ttDownloadLightboxPhoto() {
  const img = document.getElementById('ttPhotoViewerImg');
  if (!img || !img.src) return;
  const a = document.createElement('a');
  a.href = img.src;
  a.download = 'TTESPL_Photo_' + Date.now() + '.jpg';
  document.body.appendChild(a); a.click(); a.remove();
}
window.ttViewPhoto = ttViewPhoto;
window.ttCloseLightbox = ttCloseLightbox;
window.ttDownloadLightboxPhoto = ttDownloadLightboxPhoto;

// Chat attachments ko cid se dhoondh kar kholna - photo full-screen viewer me,
// file (PDF/doc) naye tab me (ya agar popup block ho to seedha download).
function ttFindChatMsgByCid(cid) {
  return (teamChatData || []).find(m => m && m.cid === cid) || (pendingChat || []).find(m => m && m.cid === cid);
}
function ttOpenChatPhoto(cid) {
  const m = ttFindChatMsgByCid(cid);
  if (m && m.fileData) ttViewPhoto(m.fileData); else alert('The photo has not loaded yet.');
}
function ttOpenChatFile(cid) {
  const m = ttFindChatMsgByCid(cid);
  if (!m || !m.fileData) { alert('The file has not loaded yet.'); return; }
  try {
    const w = window.open('', '_blank');
    if (w && w.document) {
      w.document.write('<title>' + esc(m.fileName || 'File') + '</title><body style="margin:0;background:#525659;"><iframe src="' + m.fileData + '" style="width:100%;height:100vh;border:0;"></iframe></body>');
      return;
    }
  } catch (e) {}
  const a = document.createElement('a'); a.href = m.fileData; a.download = m.fileName || 'file'; document.body.appendChild(a); a.click(); a.remove();
}
window.ttOpenChatPhoto = ttOpenChatPhoto;
window.ttOpenChatFile = ttOpenChatFile;

function openLedgerDetail(ordId) {
  const o = ordersData.find(x => String(x.id) === String(ordId));
  if (!o) return;
  let pg = document.getElementById('ledgerDetailPage');
  if (!pg) {
    pg = document.createElement('div'); pg.id = 'ledgerDetailPage';
    pg.style.cssText = 'position:fixed;inset:0;z-index:3400;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;';
    document.body.appendChild(pg);
  }
  window.__ttPhotoStore = {};
  let pi = 0;
  const reg = src => { const k = 'p' + (pi++); window.__ttPhotoStore[k] = src; return k; };
  const row = (l, v) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed var(--border);font-size:12.5px;"><span style="color:var(--text-muted);">${l}</span><strong style="text-align:right;">${v}</strong></div>`;
  const sec = (t, body) => `<div class="card" style="margin:10px 12px;padding:12px 14px;"><div style="font-weight:800;font-size:13.5px;margin-bottom:6px;color:var(--text-main);">${t}</div>${body}</div>`;
  const photoBtn = (src, label) => src ? `<button class="btn btn-accent btn-sm" style="margin-top:8px;" onclick="ttViewPhoto(window.__ttPhotoStore['${reg(src)}'])">🖼️ ${label}</button>` : `<div style="font-size:11.5px;color:var(--text-muted);margin-top:6px;">No photo</div>`;

  const cust = customerDatabase.find(c => (c.phone && c.phone === o.phone) || c.name === o.customerName) || {};
  const trail = (o.auditTrail || []).slice().reverse();
  const pays = Array.isArray(o.payments) ? o.payments : [];

  let payHtml = '';
  if (pays.length) {
    payHtml = pays.map((p, i) => `<div style="padding:8px 0;border-bottom:1px dashed var(--border);"><div style="display:flex;justify-content:space-between;font-size:12.5px;"><strong>Payment #${i + 1} — ₹${ttInr(p.amount)}</strong><span>${esc(p.mode || '')}</span></div><div style="font-size:11.5px;color:var(--text-muted);">🕒 ${esc(p.at || '')} · by ${esc(p.by || '')}</div>${photoBtn(p.photo, 'Payment Photo Dekhein')}</div>`).join('');
  } else if (o.recvAmount > 0) {
    payHtml = `<div style="font-size:12.5px;">Received: <strong>₹${ttInr(o.recvAmount)}</strong>${o.lastPaymentDate ? ' · Last: ' + esc(o.lastPaymentDate) : ''}${o.payMode ? ' · ' + esc(o.payMode) : ''}</div>${photoBtn(o.lastPaymentProof, 'Payment Photo Dekhein')}`;
  } else {
    payHtml = `<div style="font-size:12.5px;color:var(--text-muted);">No payment received yet.</div>`;
  }

  pg.innerHTML = `
    <div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(120deg,#0a2540,#0e4a7a);color:#fff;">
      <button class="btn btn-outline btn-sm" style="background:#fff;" onclick="document.getElementById('ledgerDetailPage').style.display='none'">⬅ Back</button>
      <div style="flex:1;min-width:0;"><div style="font-weight:800;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(o.customerName)}</div><div style="font-size:11px;opacity:.85;">Invoice ${esc(o.id)}</div></div>
      <span class="badge ${o.dueAmount > 0 ? 'badge-danger' : 'badge-delivered'}">${o.dueAmount > 0 ? 'Due ₹' + ttInr(o.dueAmount) : 'Paid'}</span>
    </div>
    ${sec('💰 Bill Summary', row('Total Bill', '₹' + ttInr(o.totalAmount)) + row('Received', '₹' + ttInr(o.recvAmount)) + row('Due', '₹' + ttInr(o.dueAmount)) + row('Booked / Sales By', esc(o.bookedBy || '-')) + row('Phone', esc(o.phone || cust.phone || '-')))}
    ${sec('📅 Order & Follow-up Timeline', row('Order received on', esc(o.orderDate || '-')) + row('Delivery target', esc(o.deliveryDate || '-')) +
        (o.payFollowupDate ? row('Payment follow-up', esc(o.payFollowupDate) + (o.payFollowupNote ? ' — ' + esc(o.payFollowupNote) : '')) : '') +
        (trail.length ? trail.map(t => `<div style="font-size:12px;padding:5px 0;border-bottom:1px dashed var(--border);">🕒 <strong>${esc(t.time || '')}</strong> — ${esc(t.note || '')}<br><span style="color:var(--text-muted);">by ${esc(t.by || '')}</span></div>`).join('') : '<div style="font-size:12px;color:var(--text-muted);padding-top:6px;">No follow-up history.</div>'))}
    ${sec('🚚 Delivery Details', row('Status', esc(o.status || '-')) + row('Delivered date & time', esc(o.deliveredAt || o.deliveredDate || '-')) + row('Delivered by', esc(o.deliveredBy || '-')) + photoBtn(o.deliveryProofPhoto, 'Delivery Photo Dekhein'))}
    ${sec('💵 Payment Details', payHtml)}
    ${sec('🧾 Items (' + (o.items || []).length + ')' + (isAdminUser() ? ` <button class="btn btn-outline btn-sm" style="float:right;" onclick="openAdminEditLedgerModal('${o.id}')">✏️ Edit</button>` : ''), (o.items || []).map((it, i) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px dashed var(--border);font-size:12.5px;"><span>${i + 1}. ${esc(it.name)} × ${it.qty}</span><strong>₹${ttInr(it.total)}</strong></div>`).join(''))}
    <div style="display:flex;gap:8px;padding:6px 12px 30px;">
      <button class="btn btn-print" style="flex:1;" onclick="document.getElementById('ledgerDetailPage').style.display='none'; openInvoicePrintModal('${o.id}')">🖨️ Tax Invoice</button>
      ${o.dueAmount > 0 ? `<button class="btn btn-outline" style="flex:1;" onclick="openPayFollowupModal('${o.id}')">📅 Follow-up</button>` : ''}
    </div>`;
  pg.style.display = 'block';
  pg.scrollTop = 0;
}
window.openLedgerDetail = openLedgerDetail;

/* ---- Backup & Import ---- */
function openBackupModal() {
  let m = document.getElementById('backupModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'backupModal'; m.className = 'auth-overlay'; m.style.display = 'none'; m.style.zIndex = '3500';
    m.innerHTML = `<div class="auth-card">
      <div class="card-header"><span class="card-title">💾 Data Backup & Import</span><button class="btn btn-outline btn-sm" onclick="document.getElementById('backupModal').style.display='none'">✕</button></div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;">The backup includes the full Ledger/Orders (with photos), Customers, Stock, Leads, Services and Machinery data.</div>
      <button class="btn btn-primary btn-block" onclick="downloadFullBackup()">⬇️ Backup Download (JSON)</button>
      <div style="height:10px;"></div>
      <button class="btn btn-accent btn-block" onclick="document.getElementById('backupFileInput').click()">⬆️ Backup File Import / Restore</button>
      <input type="file" id="backupFileInput" accept=".json,application/json" style="display:none;" onchange="restoreBackupFile(event)">
      <div style="font-size:11.5px;color:var(--text-muted);margin-top:10px;">Import only adds or updates data; nothing is deleted.</div>
    </div>`;
    document.body.appendChild(m);
  }
  m.style.display = 'flex';
}
function ttBackupSets() {
  return { ORDERS: ordersData, CUSTOMERS: customerDatabase, INVENTORY: sampleInventory, LEADS: leadsData, SERVICES: serviceCallsData, MACHINERY: machineryDatabase };
}
function downloadFullBackup() {
  const sets = ttBackupSets(); const out = { app: 'TTESPL-ERP', version: 1, exportedAt: new Date().toISOString(), data: {} };
  Object.keys(sets).forEach(k => out.data[k] = Array.isArray(sets[k]) ? sets[k] : []);
  const d = ttYmd(new Date());
  downloadFile(JSON.stringify(out), `TTESPL_Backup_${d}.json`, 'application/json');
}
async function restoreBackupFile(ev) {
  const f = ev.target.files[0]; ev.target.value = '';
  if (!f) return;
  if (!isAdminUser()) { alert('Only an Admin can restore.'); return; }
  try {
    const j = JSON.parse(await f.text());
    const data = j && j.data;
    if (!data) throw new Error('This does not look like a TTESPL backup file.');
    const counts = Object.keys(data).map(k => `${k}: ${(data[k] || []).length}`).join('\n');
    if (!confirm('Restore this data? (Items are only added or updated; nothing is deleted.)\n\n' + counts)) return;
    const targets = {
      ORDERS: () => ordersData, CUSTOMERS: () => customerDatabase, INVENTORY: () => sampleInventory,
      LEADS: () => leadsData, SERVICES: () => serviceCallsData, MACHINERY: () => machineryDatabase
    };
    let notes = '';
    for (const k of Object.keys(targets)) {
      const inc = Array.isArray(data[k]) ? data[k] : []; if (!inc.length) continue;
      const cur = targets[k]().slice(); const idx = new Map(cur.map((x, i) => [String(x.id), i]));
      inc.forEach(it => { if (!it || it.id == null) return; const p = idx.get(String(it.id)); if (p === undefined) { idx.set(String(it.id), cur.length); cur.push(it); } else cur[p] = Object.assign({}, cur[p], it); });
      if (k === 'ORDERS') ordersData = cur; else if (k === 'CUSTOMERS') { customerDatabase = cur; window.customerDatabase = cur; }
      else if (k === 'INVENTORY') sampleInventory = cur; else if (k === 'LEADS') leadsData = cur;
      else if (k === 'SERVICES') serviceCallsData = cur; else if (k === 'MACHINERY') machineryDatabase = cur;
      setStored(k, cur);
      try { if (window.cloudSync && window.cloudSync.pushKey) await window.cloudSync.pushKey(k, cur); } catch (e) { notes += `\n⚠️ ${k} cloud save fail: ${e.message}`; }
    }
    document.getElementById('backupModal').style.display = 'none';
    renderBilling('all'); renderDashboard(); if (typeof renderOrders === 'function') renderOrders();
    alert('✅ Backup restored.' + notes);
  } catch (e) { alert('Restore fail: ' + e.message); }
}
window.openBackupModal = openBackupModal; window.downloadFullBackup = downloadFullBackup; window.restoreBackupFile = restoreBackupFile;

/* ===== PRODUCT CATALOG (read-only reference - never feeds into orders/billing) ===== */
let activeCatalogSub = 'ALL';

function getCatalogItems() {
  return (sampleInventory || []).filter(i => i.category === 'Catalog Equipment');
}

function renderCatalog() {
  const items = getCatalogItems();
  const cats = (typeof catalogCatsData !== 'undefined' && Array.isArray(catalogCatsData)) ? catalogCatsData.slice().sort((x, y) => String(x.name).localeCompare(String(y.name))) : [];
  if (activeCatalogSub !== 'ALL' && !cats.some(c => String(c.id) === String(activeCatalogSub))) activeCatalogSub = 'ALL';

  const tabsBox = document.getElementById('catalogSubTabs');
  if (tabsBox) {
    tabsBox.innerHTML = `<button class="sub-tab-btn ${activeCatalogSub === 'ALL' ? 'active' : ''}" onclick="triggerAppHaptic(); selectCatalogSub('ALL', this)">🌟 All (${items.length})</button>` +
      cats.map(c => {
        const n = items.filter(i => String(i.catalogCat) === String(c.id)).length;
        return `<button class="sub-tab-btn ${String(activeCatalogSub) === String(c.id) ? 'active' : ''}" onclick="triggerAppHaptic(); selectCatalogSub('${ttH(c.id)}', this)">${ttH(c.name)} (${n})</button>`;
      }).join('') +
      (activeCatalogSub !== 'ALL' ? `<button class="sub-tab-btn" onclick="triggerAppHaptic(); ttCatManage('${ttH(activeCatalogSub)}')">⚙️ Manage</button>` : '') +
      `<button class="sub-tab-btn" onclick="triggerAppHaptic(); ttCatManage()">➕ Category</button>`;
  }
  filterCatalog(document.getElementById('catalogSearchInput') ? document.getElementById('catalogSearchInput').value : '');
}
window.renderCatalog = renderCatalog;

function selectCatalogSub(sub, el) {
  activeCatalogSub = sub;
  document.querySelectorAll('#catalogSubTabs .sub-tab-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  filterCatalog(document.getElementById('catalogSearchInput').value);
}
window.selectCatalogSub = selectCatalogSub;

function filterCatalog(q) {
  q = String(q || '').toLowerCase().trim();
  let list = getCatalogItems();
  if (activeCatalogSub !== 'ALL') list = list.filter(i => String(i.catalogCat) === String(activeCatalogSub));
  if (q) list = list.filter(i => (i.name && i.name.toLowerCase().includes(q)) || (i.subCategory && i.subCategory.toLowerCase().includes(q)) || (i.desc && i.desc.toLowerCase().includes(q)));

  const box = document.getElementById('catalogListContainer');
  if (!box) return;
  if (list.length === 0) {
    box.innerHTML = `<div style="text-align:center; padding:25px; color:var(--text-muted); font-size:12.5px;">No products found.</div>`;
    return;
  }
  box.innerHTML = list.map(i => `
    <div class="card" style="cursor:pointer;" onclick="triggerAppHaptic(); openCatalogDetail(${i.id})">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
        <div style="flex:1;">
          <strong style="font-size:14.5px; color:var(--text-main);">${esc(i.name)}</strong>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">${esc((typeof ttCatCatName === 'function' && ttCatCatName(i)) || 'Catalog')}</div>
          ${ttCatalogCardPrices(i)}
          ${i.desc ? `<div style="font-size:12px; color:var(--text-muted); margin-top:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${esc(i.desc)}</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
          <button class="btn btn-outline btn-sm" style="padding:4px 8px;" title="Search on the web" onclick="event.stopPropagation(); triggerAppHaptic(); openCatalogWebSearch('${esc(i.name).replace(/'/g, "\\'")}')">🌐</button>
          <button class="btn btn-wa btn-sm" style="padding:4px 8px;" title="Share (Customer Price only)" onclick="event.stopPropagation(); triggerAppHaptic(); ttShareProduct('${i.id}')">📤</button>
          <span style="font-size:18px;">›</span>
        </div>
      </div>
    </div>
  `).join('');
}
window.filterCatalog = filterCatalog;

function openCatalogWebSearch(name) {
  // Ab Chrome me bahar nahi jata - app ke andar hi ek chhota "browser" panel khulta hai
  const q = encodeURIComponent(name);
  let m = document.getElementById('inAppBrowserModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'inAppBrowserModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    m.innerHTML = `<div class="auth-card" style="max-width:none; width:100%; height:100dvh; max-height:100dvh; margin:0; border-radius:0; padding:0; display:flex; flex-direction:column;">
      <div class="card-header" style="padding:12px 14px; border-bottom:1px solid var(--border); flex-shrink:0;">
        <span class="card-title" id="inAppBrowserTitle" style="font-size:13.5px;">🌐 Searching...</span>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-outline btn-sm" id="inAppBrowserOpenExtBtn">↗ Open in browser</button>
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('inAppBrowserModal').style.display='none'; document.getElementById('inAppBrowserFrame').src='about:blank';">✕</button>
        </div>
      </div>
      <div style="font-size:11px; color:var(--text-muted); padding:6px 14px; border-bottom:1px solid var(--border); flex-shrink:0;">
        Result seedha web se hai (ye app khud isse likh/summarize nahi karta). Agar page yahan khali dikhe, to upar wala "Open in browser" button dabayein.
      </div>
      <iframe id="inAppBrowserFrame" style="flex:1; width:100%; border:0; background:#fff;"></iframe>
    </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('inAppBrowserTitle').textContent = '🌐 ' + name;
  const extUrl = 'https://www.google.com/search?tbm=isch&q=' + q;
  document.getElementById('inAppBrowserOpenExtBtn').onclick = () => window.open(extUrl, '_blank');
  document.getElementById('inAppBrowserFrame').src = 'https://www.bing.com/search?q=' + q;
  m.style.display = 'flex';
}
window.openCatalogWebSearch = openCatalogWebSearch;

function handleCatalogSearchInput(val) {
  filterCatalog(val);
  const q = String(val || '').toLowerCase().trim();
  const box = document.getElementById('catalogSuggestionBox');
  if (!box) return;
  if (!q) { box.style.display = 'none'; return; }
  const matches = getCatalogItems().filter(i => (i.name && i.name.toLowerCase().includes(q)) || (i.subCategory && i.subCategory.toLowerCase().includes(q))).slice(0, 8);
  if (!matches.length) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(i => `
    <div class="suggestion-item" onmousedown="triggerAppHaptic(); openCatalogDetail(${i.id})">
      <div style="flex:1;">
        <strong style="font-size:12.5px; color:var(--text-main);">${esc(i.name)}</strong>
        <div class="suggestion-sub">${esc(i.subCategory || 'Catalog')}</div>
      </div>
    </div>
  `).join('');
  box.style.display = 'block';
}
window.handleCatalogSearchInput = handleCatalogSearchInput;

document.addEventListener('click', (e) => {
  if (!e.target.closest || !e.target.closest('#catalogSearchInput, #catalogSuggestionBox')) {
    const b = document.getElementById('catalogSuggestionBox');
    if (b) b.style.display = 'none';
  }
});

function openCatalogDetail(id) {
  const i = getCatalogItems().find(x => x.id === id);
  if (!i) return;
  let m = document.getElementById('catalogDetailModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'catalogDetailModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    document.body.appendChild(m);
  }
  const row = (label, val) => val ? `<div style="margin-bottom:14px;"><div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:.4px; margin-bottom:4px;">${esc(label)}</div><div style="font-size:13.5px; color:var(--text-main); white-space:pre-wrap; line-height:1.5;">${esc(val)}</div></div>` : '';
  m.innerHTML = `<div class="auth-card" style="max-width:480px;">
    <div class="card-header"><span class="card-title">${esc(i.name)}</span><button class="btn btn-outline btn-sm" onclick="document.getElementById('catalogDetailModal').style.display='none'">✕</button></div>
    ${row('Category', [i.category, i.subCategory].filter(Boolean).join(' → '))}
    ${row('Model / Code', [i.machine && i.machine !== i.name ? i.machine : '', i.code].filter(Boolean).join(' • '))}
    ${row('Description', i.desc)}
    ${row('Technical Data / Specs', i.specs)}
    <div id="catalogPriceBlock">${ttCatalogPriceBlockHtml(i)}</div>
    <button class="btn btn-outline btn-sm btn-block" style="margin-bottom:10px;" onclick="triggerAppHaptic(); ttCatProdEdit('${i.id}')">✏️ Edit Product Details</button>
    <div id="catalogAiBox" style="margin:4px 0 10px; padding:10px 12px; border-radius:12px; background:var(--bg); border:1px dashed var(--border); font-size:12.5px; line-height:1.5; color:var(--text-main);">
      <div style="font-weight:800; font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.4px; margin-bottom:4px;">🤖 AI Summary (Google Search se)</div>
      <div id="catalogAiBoxBody">⏳ Searching...</div>
    </div>
    <button class="btn btn-outline btn-block" style="margin-top:6px;" onclick="triggerAppHaptic(); openCatalogWebSearch('${esc(i.name).replace(/'/g, "\'")}')">🌐 Search on Web / Photos</button>
    <div style="margin-top:10px; padding-top:12px; border-top:1px solid var(--border); font-size:11px; color:var(--text-muted);">This is a reference catalog only - no bill or order is created from this item.</div>
  </div>`;
  m.style.display = 'flex';
  fetchCatalogAiSummary(i.name);
}
window.openCatalogDetail = openCatalogDetail;

/* ===== AI Summary (Gemini + Google Search grounding) ===== */
/* SECURITY: koi API key ab app code me nahi hai. Key sirf (a) is device par Admin ne jo save ki, ya
   (b) AI Gateway (Cloud Function, /functions) me rehti hai. */
function ttGeminiKey() {
  try { return String(localStorage.getItem('TTESPL_ERP_GEMINI_KEY') || '').trim(); } catch (e) { return ''; }
}
async function ttGeminiCall(model, prompt, withSearch) {
  const M = window.TT_AI_MODELS;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  if (withSearch) payload.tools = [{ google_search: {} }];
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(M.resolve(model)) + ':generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ttGeminiKey() }, body: JSON.stringify(payload)
  });
  let data = null; try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const er = (data && data.error) || {};
    return { err: { status: res.status, code: er.status || '', msg: er.message || ('HTTP ' + res.status) } };
  }
  return { text: M.textOf(data) };
}
async function fetchCatalogAiSummary(productName) {
  const body = document.getElementById('catalogAiBoxBody');
  if (!body) return;
  if (!ttGeminiKey()) { body.textContent = 'AI summary is not set up yet. Admin: add the Gemini key in AI Settings (or connect the AI gateway).'; return; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { body.textContent = '⚠️ You are offline. The AI summary needs internet.'; return; }
  const prompt = 'This is a car-detailing / machinery product: "' + productName + '" (catalog item of Twin Town Express Services). ' +
    'Explain it in 3-4 short lines in simple English: what it is, what it is used for, the dilution ratio if it is a chemical/liquid, and the essential accessories / safety notes. Keep it very brief, in bullet style.';
  // Try with Google Search first, then plain model answers, then a lighter model (different quota)
  const MD = window.TT_AI_MODELS, plan = [[MD.defaultModel, true], [MD.defaultModel, false], [MD.fallbackModel, false]];
  let last = null;
  try {
    for (const [model, search] of plan) {
      let r;
      try { r = await ttGeminiCall(model, prompt, search); } catch (netErr) { last = { status: 0, msg: 'Network error - check internet' }; break; }
      if (r.text) { body.innerHTML = esc(r.text).replace(/\n/g, '<br>'); return; }
      if (r.err) {
        last = r.err;
        // key problems will not be fixed by trying another model
        if (r.err.status === 401 || r.err.status === 403 || (r.err.status === 400 && /api key|API_KEY|not valid|expired/i.test(r.err.msg + ' ' + r.err.code))) break;
      } else { last = { status: 200, msg: 'Empty answer' }; }
    }
  } catch (e) { last = { status: 0, msg: String(e && e.message || e) }; }
  console.error('Gemini summary failed', last);
  let hint = 'Try "Search on Web" below.';
  if (last) {
    if (last.status === 429) hint = 'The free quota is used up for now - try again later, or use a billing-enabled key.';
    else if (last.status === 400 || last.status === 401 || last.status === 403) hint = 'The Gemini API key is not accepted (invalid, expired or restricted to another website/app).';
    else if (last.status === 404) hint = 'This AI model is no longer available. Admin: open AI Settings and choose a current model.';
    else if (last.status === 0) hint = 'No connection to Google. Check the internet.';
  }
  const adminCan = (typeof isAdminUser === 'function' && isAdminUser());
  body.innerHTML = '⚠️ AI summary unavailable.<br><span style="font-size:11px;opacity:.8;">' + esc(hint) + '</span>' +
    (last ? '<br><span style="font-size:10.5px;opacity:.65;">Google: ' + esc((last.status || '') + ' ' + String(last.msg || '').slice(0, 160)) + '</span>' : '') +
    '<div style="display:flex;gap:6px;margin-top:8px;"><button class="btn btn-outline btn-sm" onclick="fetchCatalogAiSummary(\'' + String(productName).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;') + '\')">↻ Retry</button>' +
    (adminCan ? '<button class="btn btn-outline btn-sm" onclick="ttSetGeminiKey()">🔑 Set API key</button>' : '') + '</div>';
}
window.ttSetGeminiKey = function () {
  if (typeof isAdminUser === 'function' && !isAdminUser()) { alert('Only Admin can do this.'); return; }
  const k = prompt('Paste a valid Gemini API key (from Google AI Studio). It is saved on THIS device only. Leave empty to remove the saved key.', '');
  if (k === null) return;
  const key = k.trim();
  if (key && (key.length < 20 || /\s/.test(key))) { alert('That does not look like an API key. Nothing was saved.'); return; }
  try { if (key) localStorage.setItem('TTESPL_ERP_GEMINI_KEY', key); else localStorage.removeItem('TTESPL_ERP_GEMINI_KEY'); } catch (e) {}
  alert(key ? 'Key saved on this device. Open the product again to retry.' : 'Saved key removed from this device.');
};
window.fetchCatalogAiSummary = fetchCatalogAiSummary;

/* ===== TTESPL UPGRADE v5: Quotation History, Travel Expenses, Catalog dual pricing, Product share ===== */
var quotationsData = getStored("QUOTATIONS", []);
var travelData = getStored("TRAVEL", []);
// Pull-to-refresh (custom) ab band hai - native overscroll bhi CSS se band kiya gaya hai
window.TT_DISABLE_PTR = true;

function ttH(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
window.ttH = ttH;

/* ================= QUOTATION: history + serial + save/print ================= */
function ttQuotPad(n) { return String(n).padStart(4, '0'); }

function ttPeekNextQuotSerial() {
  var max = 0;
  (quotationsData || []).forEach(function (q) { var n = Number(q && q.serial) || 0; if (n > max) max = n; });
  var counter = 0;
  try { counter = Number(localStorage.getItem(DB_PREFIX + 'QUOT_SERIAL_COUNTER') || 0) || 0; } catch (e) {}
  return Math.max(max, counter) + 1;
}

function ttUpdateQuotSerialLabel() {
  var el = document.getElementById('quotSerialLabel');
  if (!el) return;
  var idEl = document.getElementById('quotEditId');
  var id = idEl ? idEl.value : '';
  var rec = id ? (quotationsData || []).find(function (q) { return q && q.id === id; }) : null;
  if (rec) el.innerHTML = '✏️ Editing <b>' + ttH(rec.id) + '</b> (Serial #' + ttH(rec.serial) + ') — saving will update this same quotation';
  else el.innerHTML = '🔢 Next Serial: <b>QTN-' + ttQuotPad(ttPeekNextQuotSerial()) + '</b> (auto)';
}
window.openQuotationModal = openQuotationModal;

function ttCollectQuotationForm() {
  var custName = document.getElementById('quotCustName').value.trim();
  if (!custName) { alert('Please enter the customer name'); return null; }
  var rows = document.querySelectorAll('#quotItemsBody .quot-item-row');
  var items = Array.from(rows).map(function (r) {
    var qty = Number(r.querySelector('.qit-qty').value) || 0;
    var rate = Number(r.querySelector('.qit-rate').value) || 0;
    var disc = Number(r.querySelector('.qit-disc').value) || 0;
    var lineInclusive = qty * rate * (1 - disc / 100);
    var lineTaxable = Math.round((lineInclusive / 1.18) * 100) / 100;
    return {
      name: r.querySelector('.qit-name').value.trim() || 'Item',
      hsn: r.querySelector('.qit-hsn').value.trim() || '-',
      qty: qty, rate: rate, disc: disc, amount: lineTaxable,
      desc: r.dataset.desc || '', specs: r.dataset.specs || ''
    };
  });
  if (items.length === 0) { alert('Please add at least one item'); return null; }
  var t = quotRecalc();
  return {
    custName: custName,
    custPhone: document.getElementById('quotCustPhone').value.trim(),
    custAddr: document.getElementById('quotCustAddr').value.trim(),
    custGst: document.getElementById('quotCustGst').value.trim(),
    payMode: document.getElementById('quotPayMode').value.trim() || 'Cash/Online',
    items: items, totalNoGst: t.totalNoGst, cgst: t.cgst, sgst: t.sgst, svc: t.svc, roundOff: t.roundOff, final: t.final
  };
}

function ttPersistQuotation(form) {
  var editEl = document.getElementById('quotEditId');
  var editId = editEl ? editEl.value : '';
  var by = currentUser ? currentUser.name : 'Staff';
  var rec = editId ? (quotationsData || []).find(function (q) { return q && q.id === editId; }) : null;
  if (rec) {
    Object.assign(rec, form, { updatedAt: Date.now(), updatedBy: by });
  } else {
    var serial = ttPeekNextQuotSerial();
    try { localStorage.setItem(DB_PREFIX + 'QUOT_SERIAL_COUNTER', String(serial)); } catch (e) {}
    rec = Object.assign({}, form, {
      id: 'QTN-' + ttQuotPad(serial),
      serial: serial,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      createdAt: Date.now(),
      createdBy: by
    });
    if (!Array.isArray(quotationsData)) quotationsData = [];
    quotationsData.unshift(rec);
  }
  setStored("QUOTATIONS", quotationsData);
  if (editEl) editEl.value = rec.id;
  ttUpdateQuotSerialLabel();
  return rec;
}

function ttQuotPlain(q) {
  var itemsTxt = (q.items || []).map(function (i) { return i.name + ' x' + i.qty + ' - Rs.' + Number(i.amount || 0).toFixed(2); }).join('\n');
  return 'TWIN TOWN EXPRESS SERVICES PVT LTD\nQuotation: ' + q.id + '\nCustomer: ' + q.custName + '\n-----------------------\n' + itemsTxt + '\n-----------------------\nTotal: Rs.' + q.final + '\n\nRasulgarh, Bhubaneswar';
}

// SHARE (pehle jaisa) - ab quotation history me bhi save hoti hai
function printQuotation() {
  var form = ttCollectQuotationForm();
  if (!form) return;
  var q = ttPersistQuotation(form);
  ttNativeShareOrFallback(
    { title: 'TTESPL Quotation ' + q.id, text: ttQuotPlain(q) },
    function () { ttPrintHtml('Quotation ' + q.id, buildQuotationHtml(q)); }
  );
}
window.printQuotation = printQuotation;

// SAVE / PRINT: history me save + PDF dialog
function ttSaveAndPrintQuotation() {
  var form = ttCollectQuotationForm();
  if (!form) return;
  var q = ttPersistQuotation(form);
  ttShowSuccessToast('Quotation ' + q.id + ' saved to history.');
  ttPrintHtml('Quotation ' + q.id, buildQuotationHtml(q));
}
window.ttSaveAndPrintQuotation = ttSaveAndPrintQuotation;

function ttEditQuotation(id) {
  var q = (quotationsData || []).find(function (x) { return x && x.id === id; });
  if (!q) return;
  var hm = document.getElementById('quotationHistoryModal');
  if (hm) hm.style.display = 'none';
  openQuotationModal();
  document.getElementById('quotCustName').value = q.custName || '';
  document.getElementById('quotCustPhone').value = q.custPhone || '';
  document.getElementById('quotCustGst').value = q.custGst || '';
  document.getElementById('quotCustAddr').value = q.custAddr || '';
  document.getElementById('quotServiceCharge').value = q.svc || 0;
  document.getElementById('quotPayMode').value = q.payMode || 'Cash/Online';
  var body = document.getElementById('quotItemsBody');
  body.innerHTML = '';
  var items = (q.items && q.items.length) ? q.items : [{}];
  items.forEach(function (it) {
    quotAddItemRow();
    var rows = body.querySelectorAll('.quot-item-row');
    var r = rows[rows.length - 1];
    r.querySelector('.qit-name').value = it.name || '';
    r.querySelector('.qit-hsn').value = (it.hsn && it.hsn !== '-') ? it.hsn : '';
    r.querySelector('.qit-qty').value = it.qty != null ? it.qty : 1;
    r.querySelector('.qit-rate').value = it.rate != null ? it.rate : 0;
    r.querySelector('.qit-disc').value = it.disc != null ? it.disc : 0;
    if (it.desc || it.specs) { r.dataset.descFor = (it.name || '').trim(); ttQuotSetDesc(r, it.desc || '', it.specs || ''); }
  });
  document.getElementById('quotEditId').value = id;
  quotRecalc();
  ttUpdateQuotSerialLabel();
}
window.ttEditQuotation = ttEditQuotation;

function ttEnsureQuotHistoryModal() {
  var m = document.getElementById('quotationHistoryModal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'quotationHistoryModal';
  m.className = 'auth-overlay';
  m.style.display = 'none';
  m.style.zIndex = '3100';
  m.innerHTML = '<div class="auth-card" style="max-width:560px;">' +
    '<div class="card-header"><span class="card-title">🕘 Quotation History</span>' +
    '<div style="display:flex;gap:6px;"><button class="btn btn-accent btn-sm" onclick="triggerAppHaptic(); ttNewQuotationFromHistory()">+ New</button>' +
    '<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'quotationHistoryModal\').style.display=\'none\'">✕</button></div></div>' +
    '<div class="grid-2" style="margin-bottom:8px;">' +
    '<input type="text" id="qhSearch" placeholder="🔍 Customer / phone / serial..." oninput="ttDeb(\'qh\',ttRenderQuotationHistory)" autocomplete="off">' +
    '<select id="qhCust" onchange="ttRenderQuotationHistory()"><option value="">All Customers</option></select></div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;"><div id="qhCount" style="font-size:11.5px;color:var(--text-muted);"></div>' +
    '<button id="qhFuBtn" class="btn btn-outline btn-sm" style="white-space:nowrap;" onclick="triggerAppHaptic(); ttFuToggle()">📞 Follow-up due</button></div>' +
    '<div id="qhList" style="max-height:58vh;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div></div>';
  document.body.appendChild(m);
  return m;
}

function openQuotationHistory() {
  var m = ttEnsureQuotHistoryModal();
  ttRenderQuotationHistory();
  m.style.display = 'flex';
}
window.openQuotationHistory = openQuotationHistory;

function ttNewQuotationFromHistory() {
  var hm = document.getElementById('quotationHistoryModal');
  if (hm) hm.style.display = 'none';
  openQuotationModal();
}
window.ttNewQuotationFromHistory = ttNewQuotationFromHistory;

function ttRenderQuotationHistory() {
  var box = document.getElementById('qhList');
  if (!box) return;
  var all = (quotationsData || []).filter(Boolean).slice().sort(function (a, b) { return (Number(b.serial) || 0) - (Number(a.serial) || 0); });

  var sel = document.getElementById('qhCust');
  var cur = sel.value;
  var names = [];
  all.forEach(function (q) { if (q.custName && names.indexOf(q.custName) < 0) names.push(q.custName); });
  names.sort(function (a, b) { return a.localeCompare(b); });
  var optHtml = '<option value="">All Customers (' + names.length + ')</option>' + names.map(function (n) { return '<option value="' + ttH(n) + '">' + ttH(n) + '</option>'; }).join('');
  if (sel._sig !== optHtml) { sel.innerHTML = optHtml; sel._sig = optHtml; }
  sel.value = names.indexOf(cur) >= 0 ? cur : '';

  var term = (document.getElementById('qhSearch').value || '').toLowerCase().trim();
  var custSel = sel.value;
  var list = all.filter(function (q) {
    if (custSel && q.custName !== custSel) return false;
    if (window.__ttQhFuOnly && !(window.ttFuNextDue && ttFuNextDue(q))) return false;
    if (!term) return true;
    return (q.custName || '').toLowerCase().indexOf(term) >= 0 || String(q.custPhone || '').indexOf(term) >= 0 || (q.id || '').toLowerCase().indexOf(term) >= 0;
  });
  document.getElementById('qhCount').textContent = list.length + ' quotation' + (list.length === 1 ? '' : 's') + ' (newest first, by serial)';

  if (!list.length) {
    box.innerHTML = '<div class="empty-state"><span class="empty-icon">📝</span><div class="empty-sub">No quotations found.</div></div>';
    return;
  }
  var isAdm = isAdminUser();
  box.innerHTML = list.map(function (q) {
    return '<div class="card" style="padding:10px 12px;margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">' +
      '<div style="min-width:0;"><span class="badge badge-info" style="font-size:10px;">#' + ttQuotPad(Number(q.serial) || 0) + '</span> ' +
      '<strong style="font-size:13.5px;color:var(--text-main);">' + ttH(q.custName) + '</strong>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + ttH(q.id) + ' • ' + ttH(q.date || '') + (q.custPhone ? ' • ' + ttH(q.custPhone) : '') + '</div>' +
      (q.updatedAt ? '<div style="font-size:10px;color:var(--text-muted);">Updated by ' + ttH(q.updatedBy || '') + '</div>' : '') + '</div>' +
      '<strong style="font-size:15px;color:var(--accent);white-space:nowrap;">₹' + Number(q.final || 0).toLocaleString('en-IN') + '</strong></div>' +
      (window.ttFuStrip ? ttFuStrip(q) : '') +
      '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
      '<button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttEditQuotation(\'' + q.id + '\')">✏️ Edit</button>' +
      '<button class="btn btn-wa btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttShareQuotationRecord(\'' + q.id + '\')">📤 Resend</button>' +
      '<button class="btn btn-print btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttPrintQuotationRecord(\'' + q.id + '\')">🖨️ Print</button>' +
      (isAdm ? '<button class="btn btn-danger-sm btn-sm" onclick="triggerAppHaptic(); ttDeleteQuotation(\'' + q.id + '\')">🗑️</button>' : '') +
      '</div></div>';
  }).join('');
}
window.ttRenderQuotationHistory = ttRenderQuotationHistory;

function ttShareQuotationRecord(id) {
  var q = (quotationsData || []).find(function (x) { return x && x.id === id; });
  if (!q) return;
  ttNativeShareOrFallback(
    { title: 'TTESPL Quotation ' + q.id, text: ttQuotPlain(q) },
    function () { ttPrintHtml('Quotation ' + q.id, buildQuotationHtml(q)); }
  );
}
function ttPrintQuotationRecord(id) {
  var q = (quotationsData || []).find(function (x) { return x && x.id === id; });
  if (!q) return;
  ttPrintHtml('Quotation ' + q.id, buildQuotationHtml(q));
}
function ttDeleteQuotation(id) {
  if (!isAdminUser()) { alert('Admin only!'); return; }
  if (!confirm('Delete Quotation ' + id + '?')) return;
  try { if (window.cloudSync && window.cloudSync.deleteItem) window.cloudSync.deleteItem('QUOTATIONS', id); } catch (e) {}
  quotationsData = (quotationsData || []).filter(function (q) { return q && q.id !== id; });
  setStored("QUOTATIONS", quotationsData);
  ttRenderQuotationHistory();
}
window.ttShareQuotationRecord = ttShareQuotationRecord;
window.ttPrintQuotationRecord = ttPrintQuotationRecord;
window.ttDeleteQuotation = ttDeleteQuotation;

window.ttRenderQuotHistoryIfOpen = function () {
  var m = document.getElementById('quotationHistoryModal');
  if (m && m.style.display === 'flex' && document.activeElement !== document.getElementById('qhSearch')) ttRenderQuotationHistory();
  ttUpdateQuotSerialLabel();
};

/* ================= STOCK: category select helper ================= */
function ttSetStockCategory(v) {
  var sel = document.getElementById('stkCategory');
  if (!sel) return;
  v = v || 'Machine Spares';
  sel.querySelectorAll('option[data-extra]').forEach(function (o) { o.remove(); });
  var found = Array.prototype.some.call(sel.options, function (o) { return o.value === v; });
  if (!found) {
    var o = document.createElement('option');
    o.value = v; o.textContent = v; o.setAttribute('data-extra', '1');
    sel.appendChild(o);
  }
  sel.value = v;
}
window.ttSetStockCategory = ttSetStockCategory;

/* ================= PRODUCT SHARE (sirf Customer Price) + CATALOG DUAL PRICING ================= */
function ttShareProduct(id) {
  var i = (sampleInventory || []).find(function (x) { return String(x.id) === String(id); });
  if (!i) { alert('Product not found.'); return; }
  var cp = Number(i.rate) || 0;
  var lines = [i.name];
  var cat = [i.category, i.subCategory].filter(Boolean).join(' → ');
  if (cat) lines.push('Category: ' + cat);
  if (i.code) lines.push('Code: ' + i.code);
  if (i.machine && i.machine !== i.name) lines.push('Model: ' + i.machine);
  if (i.desc) lines.push('\n' + String(i.desc).slice(0, 500));
  if (i.specs) lines.push('\nSpecs: ' + String(i.specs).slice(0, 400));
  lines.push('\nCustomer Price: ' + (cp > 0 ? '₹' + cp.toLocaleString('en-IN') : 'On request'));
  lines.push('\nTWIN TOWN EXPRESS SERVICES PVT LTD\nRasulgarh, Bhubaneswar');
  var plain = lines.join('\n');
  ttNativeShareOrFallback({ title: i.name, text: plain }, function () {
    window.open('https://wa.me/?text=' + encodeURIComponent(plain), '_blank');
  });
}
window.ttShareProduct = ttShareProduct;

function ttCatalogCardPrices(i) {
  var cp = Number(i.rate) || 0, dp = Number(i.dealerPrice) || 0;
  return '<div style="font-size:11.5px;margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;">' +
    '<span style="color:var(--success);font-weight:800;">👤 Customer: ' + (cp > 0 ? '₹' + cp.toLocaleString('en-IN') : '—') + '</span>' +
    '<span style="color:var(--cyan);font-weight:800;">🏷️ Dealer: ' + (dp > 0 ? '₹' + dp.toLocaleString('en-IN') : '—') + '</span></div>';
}
window.ttCatalogCardPrices = ttCatalogCardPrices;

function ttCatalogPriceBlockHtml(i) {
  var cp = Number(i.rate) || 0, dp = Number(i.dealerPrice) || 0;
  var fmt = function (n) { return n > 0 ? '₹' + n.toLocaleString('en-IN') : 'Not set'; };
  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">' +
    '<div style="background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);border-radius:12px;padding:10px;"><div style="font-size:10.5px;font-weight:800;color:var(--success);">CUSTOMER PRICE</div><div style="font-size:17px;font-weight:900;color:var(--text-main);">' + fmt(cp) + '</div></div>' +
    '<div style="background:rgba(0,180,216,.12);border:1px solid rgba(0,180,216,.35);border-radius:12px;padding:10px;"><div style="font-size:10.5px;font-weight:800;color:var(--cyan);">DEALER PRICE</div><div style="font-size:17px;font-weight:900;color:var(--text-main);">' + fmt(dp) + '</div></div></div>' +
    '<div style="display:flex;gap:8px;margin-bottom:6px;">' +
    '<button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttOpenCatalogPriceEdit(\'' + i.id + '\')">✏️ Edit Prices</button>' +
    '<button class="btn btn-wa btn-sm" style="flex:1;" onclick="triggerAppHaptic(); ttShareProduct(\'' + i.id + '\')">📤 Share</button></div>' +
    '<div style="font-size:10.5px;color:var(--text-muted);margin-bottom:12px;">Only the Customer Price is shared — the Dealer Price is never shared.</div>';
}
window.ttCatalogPriceBlockHtml = ttCatalogPriceBlockHtml;

function ttOpenCatalogPriceEdit(id) {
  var i = (sampleInventory || []).find(function (x) { return String(x.id) === String(id); });
  if (!i) return;
  var m = document.getElementById('catalogPriceModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'catalogPriceModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    m.style.zIndex = '3200';
    document.body.appendChild(m);
  }
  m.innerHTML = '<div class="auth-card" style="max-width:380px;">' +
    '<div class="card-header"><span class="card-title">✏️ Edit Prices</span><button class="btn btn-outline btn-sm" onclick="document.getElementById(\'catalogPriceModal\').style.display=\'none\'">✕</button></div>' +
    '<div style="font-size:12.5px;font-weight:700;margin-bottom:10px;">' + ttH(i.name) + '</div>' +
    '<input type="hidden" id="cpItemId" value="' + ttH(i.id) + '">' +
    '<div class="form-group"><label class="form-label">👤 Customer Price (₹)</label><input type="number" id="cpCustomer" min="0" step="any" value="' + (Number(i.rate) || 0) + '"></div>' +
    '<div class="form-group"><label class="form-label">🏷️ Dealer Price (₹)</label><input type="number" id="cpDealer" min="0" step="any" value="' + (Number(i.dealerPrice) || 0) + '"></div>' +
    '<button class="btn btn-primary btn-block" onclick="triggerAppHaptic(); ttSaveCatalogPrices()">💾 Save Prices</button></div>';
  m.style.display = 'flex';
}
function ttSaveCatalogPrices() {
  var id = document.getElementById('cpItemId').value;
  var i = (sampleInventory || []).find(function (x) { return String(x.id) === String(id); });
  if (!i) return;
  var cp = parseFloat(document.getElementById('cpCustomer').value) || 0;
  var dp = parseFloat(document.getElementById('cpDealer').value) || 0;
  if (cp < 0 || dp < 0) { alert('Price cannot be negative.'); return; }
  i.rate = cp;
  i.dealerPrice = dp;
  setStored("INVENTORY", sampleInventory);
  document.getElementById('catalogPriceModal').style.display = 'none';
  var pb = document.getElementById('catalogPriceBlock');
  if (pb) pb.innerHTML = ttCatalogPriceBlockHtml(i);
  if (typeof renderCatalog === 'function') renderCatalog();
  if (typeof renderStockList === 'function') renderStockList();
}
window.ttOpenCatalogPriceEdit = ttOpenCatalogPriceEdit;
window.ttSaveCatalogPrices = ttSaveCatalogPrices;
