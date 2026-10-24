/* TTESPL ERP module: 02-customers-billing-chat-machine-parts.js */
function editStockItemPrompt(id) { const it = sampleInventory.find(x => x.id === id); if(it) openAddPartModal(it); }
function deleteStockItem(id) {
  if (!isAdminUser()) { alert("Admin only!"); return; }
  if(confirm("Confirm DELETE item?")) {
    sampleInventory = sampleInventory.filter(x => x.id !== id);
    setStored("INVENTORY", sampleInventory);
    renderStockList();
  }
}
function exportInventoryCSV() {
  let csv = "ID,Name,Code,Category,Stock,MRP\n";
  sampleInventory.forEach(i => { csv += `"${i.id}","${i.name}","${i.code}","${i.category}","${i.stock}","${i.rate}"\n`; });
  downloadFile(csv, "TTESPL_Inventory.csv", "text/csv");
}
window.exportInventoryCSV = exportInventoryCSV;

function openAddCustomerModal(cObj = null) {
  const title = document.getElementById('custModalTitle');
  const editId = document.getElementById('editCustId');
  if(cObj) {
    title.textContent = "Edit Customer";
    editId.value = cObj.id;
    document.getElementById('cName').value = cObj.name;
    document.getElementById('cPhone').value = cObj.phone;
    document.getElementById('cEmail').value = cObj.email;
    document.getElementById('cAddress').value = cObj.address;
    document.getElementById('cGst').value = cObj.gst;
    document.getElementById('cPerson').value = cObj.person;
  } else {
    title.textContent = "Register Client";
    editId.value = "";
    document.getElementById('cName').value = "";
    document.getElementById('cPhone').value = "";
    document.getElementById('cEmail').value = "";
    document.getElementById('cAddress').value = "";
    document.getElementById('cGst').value = "";
    document.getElementById('cPerson').value = "";
  }
  document.getElementById('customerModal').style.display = 'flex';
}
function closeCustomerModal() { document.getElementById('customerModal').style.display = 'none'; }
function editCustomerPrompt(id) { const c = customerDatabase.find(x => x.id === id); if(c) openAddCustomerModal(c); }

function saveCustomerAction() {
  const editId = document.getElementById('editCustId').value;
  const name = document.getElementById('cName').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const addr = document.getElementById('cAddress').value.trim();
  const gst = document.getElementById('cGst').value.trim();

  if(!name || !phone) { alert("Name & Phone required!"); return; }

  if(editId) {
    const cust = customerDatabase.find(x => x.id === parseInt(editId));
    if(cust) { cust.name = name; cust.phone = phone; cust.address = addr; cust.gst = gst; }
  } else {
    customerDatabase.unshift({ id: Date.now(), name, phone, address: addr, gst: gst || "Unregistered" });
  }

  setStored("CUSTOMERS", customerDatabase);
  closeCustomerModal();
  renderStockList();
  alert("Customer saved!");
}

/* TAB 5: BILLING & LEDGER */
function renderBilling(filterType, empFilter = "ALL") {
  // Naye bill sabse upar, purane niche (delivered/order date ke hisab se descending)
  const ledgerList = ordersData.filter(o => o.status === 'Delivered').slice().sort((a, b) => {
    const da = a.deliveredDate || a.orderDate || '';
    const db_ = b.deliveredDate || b.orderDate || '';
    if (da !== db_) return da < db_ ? 1 : -1;
    return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });

  const container = document.getElementById('billingListContainer');
  container.innerHTML = '';
  const isAdmin = isAdminUser();

  let list = ledgerList;
  if(empFilter !== "ALL") list = list.filter(o => o.bookedBy === empFilter);

  // Summary cards ab jo bhi filter (staff / due / received) lagaya hai, usi ka total dikhate hain -
  // isse "how much each staff member sold and how much is due" seedha upar hi dikh jata hai
  let totalBilled = 0, totalRecv = 0, totalDue = 0;
  (filterType === 'due' ? list.filter(o => o.dueAmount > 0) : filterType === 'received' ? list.filter(o => o.dueAmount === 0) : list)
    .forEach(o => { totalBilled += o.totalAmount; totalRecv += o.recvAmount; totalDue += o.dueAmount; });
  document.getElementById('metricTotalBilled').textContent = '₹' + totalBilled.toLocaleString('en-IN');
  document.getElementById('metricTotalRecv').textContent = '₹' + totalRecv.toLocaleString('en-IN');
  document.getElementById('metricTotalDue').textContent = '₹' + totalDue.toLocaleString('en-IN');

  if(filterType === 'due') {
    list = list.filter(o => o.dueAmount > 0);
    document.getElementById('billingFilterTitle').innerHTML = `🔴 Due Customers Only (${list.length})`;
  } else if(filterType === 'received') {
    list = list.filter(o => o.dueAmount === 0);
    document.getElementById('billingFilterTitle').innerHTML = `🟢 Fully Paid (${list.length})`;
  } else {
    document.getElementById('billingFilterTitle').textContent = `Showing Delivered Tax Invoices (${list.length})`;
  }

  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:25px; color:var(--text-muted); font-size:12.5px;">No invoices found.</div>`;
    return;
  }

  list.forEach(o => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header" style="cursor:pointer;" onclick="if(!event.target.closest('button')){ triggerAppHaptic(); openLedgerDetail('${o.id}'); }">
        <div>
          <strong style="font-size:15px; color:var(--text-main);">${ttEscHtml(o.customerName)}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">Invoice: ${ttEscHtml(window.ttInvNo ? ttInvNo(o) : o.id)} | Delivered: ${o.deliveredDate || o.orderDate}</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="badge ${o.dueAmount > 0 ? 'badge-danger' : 'badge-delivered'}">${o.dueAmount > 0 ? 'Due: ₹' + o.dueAmount : 'Paid'}</span>
          <button class="btn btn-outline btn-sm" onclick="triggerAppHaptic(); openAdminEditLedgerModal('${o.id}')">✏️</button>
        </div>
      </div>
      ${(o.dueAmount > 0 && o.payFollowupDate) ? `<div style="margin-top:8px; font-size:12px; font-weight:800; color:${o.payFollowupDate <= ttYmd(new Date()) ? 'var(--danger)' : 'var(--warning, #d97706)'};">📅 Payment follow-up: ${o.payFollowupDate}${o.payFollowupNote ? ' — ' + esc(o.payFollowupNote) : ''}</div>` : ''}
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
        <button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openLedgerDetail('${o.id}')">📄 Details</button>
        <button class="btn btn-print btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openInvoicePrintModal('${o.id}')">🖨️ Tax Invoice</button>
        <button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openUpiModal('${esc(o.customerName)}', ${o.dueAmount > 0 ? o.dueAmount : o.totalAmount})">📱 UPI QR</button>
        ${o.dueAmount > 0 ? `<button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); collectDuePayment('${o.id}')">💵 Collect Due</button>` : ''}
        ${o.dueAmount > 0 ? `<button class="btn btn-outline btn-sm" style="flex:1;" onclick="triggerAppHaptic(); openPayFollowupModal('${o.id}')">📅 Payment Follow-up</button>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}
window.renderBilling = renderBilling;

function filterBilling(type) {
  renderBilling(type, document.getElementById('billingEmployeeFilter').value);
}
function filterBillingByEmployee(empName) {
  renderBilling('due', empName);
}

function downloadFile(content, fileName, mimeType) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
  a.setAttribute('download', fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* TAB 6: WHATSAPP / MESSENGER CHAT HUB */
const TT_APP_VERSION = 'v23';
let pendingChat = [];
window.pendingChat = pendingChat;

function renderChatMessages() {
  if (window.ttChat && window.ttChat.render) return window.ttChat.render();   // v28 premium chat (old renderer below kept as fallback)
  const container = document.getElementById('chatMessagesContainer');
  if(!container) return;
  container.innerHTML = '';
  const myName = currentUser ? currentUser.name : '';

  // Cloud messages (duplicate cid ek hi baar) + jo abhi cloud tak confirm nahi hue (pending/failed)
  const seen = new Set();
  const cloudList = [];
  teamChatData.forEach(m => {
    if (m && m.cid) { if (seen.has(m.cid)) return; seen.add(m.cid); }
    cloudList.push(m);
  });
  pendingChat = pendingChat.filter(p => !seen.has(p.cid));
  window.pendingChat = pendingChat;
  const all = cloudList.concat(pendingChat);
  document.getElementById('chatCountBadge').textContent = `${all.length} msgs`;
  const badge = document.getElementById('chatCountBadge');
  if (badge) badge.title = 'App ' + TT_APP_VERSION;

  all.forEach(msg => {
    const isMine = myName && msg.sender === myName;
    const bubble = document.createElement('div');
    bubble.className = `messenger-bubble ${isMine ? 'outgoing' : 'incoming'}`;
    let status = '';
    if (msg._state === 'sending') status = ' ⏳';
    if (msg._state === 'failed') { status = ' ⚠️ Not sent - tap to retry'; bubble.style.cursor = 'pointer'; bubble.onclick = () => retryChatMessage(msg.cid); }
    // BUG FIX: attached photo/file ab tap karne par khulta hai - image ho to
    // chhota thumbnail (tap se full-screen viewer), file ho to naam par tap
    // karke naye tab/download me khulta hai.
    let attachmentHtml = '';
    if (msg.fileData) {
      const isImg = (msg.fileType || '').indexOf('image/') === 0;
      if (isImg) {
        attachmentHtml = `<img src="${msg.fileData}" alt="${esc(msg.fileName || 'Photo')}" style="max-width:180px;max-height:180px;border-radius:10px;margin-top:6px;cursor:pointer;display:block;" onclick="event.stopPropagation(); ttOpenChatPhoto('${msg.cid}')">`;
      } else {
        attachmentHtml = `<div onclick="event.stopPropagation(); ttOpenChatFile('${msg.cid}')" style="margin-top:6px;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.08);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:700;">📄 <span style="text-decoration:underline;">${esc(msg.fileName || 'File')}</span></div>`;
      }
    }
    bubble.innerHTML = `
      ${!isMine ? `<span class="msg-author-tag">${esc(msg.sender)}</span>` : ''}
      <div>${esc(msg.text)}</div>
      ${attachmentHtml}
      <span class="msg-time-tag">${esc(msg.time)}${status}</span>
    `;
    container.appendChild(bubble);
  });
  container.scrollTop = container.scrollHeight;
}
window.renderChatMessages = renderChatMessages;

function pushChatToCloud(msg) {
  const clean = { sender: msg.sender, text: msg.text, time: msg.time, timestamp: msg.timestamp, cid: msg.cid };
  // BUG FIX: attachment data pehle cloud push se bahar reh jata tha (sirf
  // text "📎 filename" jaata tha), isliye doosre device par kabhi photo/file
  // dikhta hi nahi tha. Ab ye bhi saath jaata hai.
  if (msg.fileData) { clean.fileData = msg.fileData; clean.fileType = msg.fileType || ''; clean.fileName = msg.fileName || 'File'; }
  ['senderId', 'replyTo', 'mentions'].forEach(k => { if (msg[k] != null) clean[k] = msg[k]; });   // v28 optional fields
  const mark = (state) => { const p = pendingChat.find(x => x.cid === msg.cid); if (p) { p._state = state; renderChatMessages(); } };
  if (!(window.cloudSync && typeof window.cloudSync.sendChatMessage === 'function')) { mark('failed'); return; }
  msg._state = 'sending';
  const timer = setTimeout(() => mark('failed'), 20000);
  window.cloudSync.sendChatMessage(clean).then(() => { clearTimeout(timer); }).catch(e => {
    clearTimeout(timer);
    console.error('Chat send failed', e);
    mark('failed');
  });
}

function retryChatMessage(cid) {
  const p = pendingChat.find(x => x.cid === cid);
  if (!p) return;
  p._state = 'sending';
  renderChatMessages();
  pushChatToCloud(p);
}
window.retryChatMessage = retryChatMessage;

function sendLiveChatMessage(fileObj = null) {
  if (window.ttChat && window.ttChat.send) return window.ttChat.send(fileObj);   // v28
  const input = document.getElementById('chatInputMessage');
  let txt = input.value.trim();
  if(!txt && !fileObj) return;
  if(!txt && fileObj) txt = '📎 ' + (fileObj.name || 'File');

  const newMsg = {
    sender: currentUser ? currentUser.name : "Staff",
    text: txt,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now(),
    cid: 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    _state: 'sending'
  };
  // BUG FIX: attachment ka asli data (photo/file) ab message ke sath save
  // hota hai, taaki chat me tap karne par photo viewer ya file khul sake -
  // pehle ye fields bilkul bheje hi nahi jaate the.
  if (fileObj && fileObj.data) {
    newMsg.fileData = fileObj.data;
    newMsg.fileType = fileObj.type || '';
    newMsg.fileName = fileObj.name || 'File';
  }
  input.value = '';
  pendingChat.push(newMsg);
  renderChatMessages();
  pushChatToCloud(newMsg);
}

function handleChatFileUpload(event) {
  const file = event.target.files[0];
  if(!file) return;
  // v28: a chat message is one cloud document (max ~1 MB). Refuse oversize files up-front instead of failing silently later.
  if (!(file.type || '').startsWith('image/') && file.size > 650 * 1024) {
    try { event.target.value = ''; } catch (e) {}
    if (window.ttShowErrorToast) ttShowErrorToast('File is too large (' + Math.round(file.size / 1024) + ' KB). Chat files must be under 650 KB.'); else alert('File too large (max 650 KB).');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const isImage = (file.type || '').indexOf('image/') === 0;
    // BUG FIX: pehle yahan sirf filename text bhej diya jata tha, asli photo/
    // file ka data (e.target.result) kahin store hi nahi hota tha - isliye
    // chat me tap karne par kuch khulta hi nahi tha. Ab image ho to compress
    // karke (Firestore 1MB limit ke andar), aur file ho to as-is, uska data
    // bhi message ke sath bhejte hain.
    if (isImage && typeof ttCompressImageSafe === 'function') {
      ttCompressImageSafe(e.target.result, 1000, 0.65).then(function (cd) {
        if (cd && cd.length > 900000) { if (window.ttShowErrorToast) ttShowErrorToast('This photo is too large even after compression.'); return; }
        sendLiveChatMessage({ name: file.name, type: file.type, data: cd });
      });
    } else {
      sendLiveChatMessage({ name: file.name, type: file.type, data: e.target.result });
    }
  };
  reader.readAsDataURL(file);
}

function getPaymentFollowupsDue() {
  const today = ttYmd(new Date());
  return ordersData.filter(o => o.dueAmount > 0 && o.payFollowupDate && o.payFollowupDate <= today);
}

function updateGlobalReminders() {
  const today = ttYmd(new Date());
  let delDue = ordersData.filter(o => o.status === 'Pending' && o.deliveryDate <= today).length;
  let srvDue = serviceCallsData.filter(s => s.status !== 'Work Completed' && s.targetDate <= today).length;
  const payFu = getPaymentFollowupsDue();
  const partsDue = getDuePartsList();
  let txt = `${delDue} Orders Due | ${srvDue} Services Due`;
  if (payFu.length > 0) {
    const names = payFu.slice(0, 2).map(o => o.customerName).join(', ') + (payFu.length > 2 ? ` +${payFu.length - 2} more` : '');
    txt += ` | 📞 Today follow up ${names} for due payment`;
  }
  if (partsDue.length > 0) {
    const pnames = partsDue.slice(0, 2).map(p => `${p.partName} (${p.machineName})`).join(', ') + (partsDue.length > 2 ? ` +${partsDue.length - 2} more` : '');
    txt += ` | 🔩 Replace ${pnames}`;
  }
  // Installed machines ke due Free Service / Maintenance bhi yahan dikha dete hain
  let instDueCount = 0;
  (leadsData || []).forEach(l => {
    (l.freeServiceSchedule || []).forEach(f => { if (!f.done && f.date <= today) instDueCount++; });
    (l.maintenanceSchedule || []).forEach(m => { if (!m.done && m.dueDate <= today) instDueCount++; });
  });
  if (instDueCount > 0) txt += ` | 🛠️ ${instDueCount} Free Service/Maintenance due`;
  document.getElementById('dailyReminderText').textContent = txt;

  // Daily notification (ek device par din me ek hi baar, sirf Admin login par)
  try {
    if (payFu.length > 0 && isAdminUser()) {
      const key = 'TT_PAYFU_NOTIF_' + today;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        if (window.cloudSync && typeof window.cloudSync.pushLiveNotification === 'function') {
          window.cloudSync.pushLiveNotification({
            title: "📞 Payment Follow-up Today",
            body: payFu.slice(0, 3).map(o => `Today follow up ${o.customerName} for due payment (₹${Number(o.dueAmount).toLocaleString('en-IN')})`).join('\n'),
            type: "payment"
          });
        }
      }
    }
  } catch (e) { console.warn('payment follow-up notif skipped', e); }

  try {
    if (partsDue.length > 0 && isAdminUser()) {
      const key = 'TT_PARTS_NOTIF_' + today;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        if (window.cloudSync && typeof window.cloudSync.pushLiveNotification === 'function') {
          window.cloudSync.pushLiveNotification({
            title: "🔩 Machine Part Replacement Due",
            body: partsDue.slice(0, 3).map(p => `${p.partName} - ${p.machineName} (${p.customerName || 'Workshop'})`).join('\n'),
            type: "info"
          });
        }
      }
    }
  } catch (e) { console.warn('parts reminder notif skipped', e); }
}

/* ===== MACHINE PARTS REPLACEMENT REMINDERS ===== */
function ttPartNextDue(p) {
  const d = new Date(p.installedDate);
  if (isNaN(d)) return '';
  d.setMonth(d.getMonth() + (Number(p.intervalMonths) || 0));
  return ttYmd(d);
}
function getDuePartsList() {
  const today = ttYmd(new Date());
  return (machinePartsData || []).filter(p => ttPartNextDue(p) && ttPartNextDue(p) <= today);
}
window.getDuePartsList = getDuePartsList;

function openMachinePartsModal() {
  let m = document.getElementById('machinePartsModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'machinePartsModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    document.body.appendChild(m);
  }
  renderMachinePartsModal();
  m.style.display = 'flex';
}
window.openMachinePartsModal = openMachinePartsModal;

function renderMachinePartsModal() {
  const m = document.getElementById('machinePartsModal');
  if (!m) return;
  const today = ttYmd(new Date());
  const list = (machinePartsData || []).slice().sort((a, b) => (ttPartNextDue(a) || '9999').localeCompare(ttPartNextDue(b) || '9999'));
  const rows = list.map(p => {
    const due = ttPartNextDue(p);
    const isDue = due && due <= today;
    return `<div class="card" style="padding:10px 12px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; gap:8px;">
        <div>
          <strong style="font-size:13.5px; color:var(--text-main);">${esc(p.partName)}</strong>
          <div style="font-size:11.5px; color:var(--text-muted);">${esc(p.machineName)}${p.customerName ? ' • ' + esc(p.customerName) : ''}</div>
          <div style="font-size:11px; color:${isDue ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:${isDue ? 800 : 400}; margin-top:3px;">${isDue ? '⚠️ Replace due: ' : 'Next replace: '}${esc(due || '-')}</div>
        </div>
        <button class="btn btn-outline btn-sm" style="height:fit-content;" onclick="triggerAppHaptic(); deleteMachinePart('${p.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('') || `<div style="text-align:center; padding:15px; color:var(--text-muted); font-size:12.5px;">No parts tracked.</div>`;

  m.innerHTML = `<div class="auth-card" style="max-width:460px;">
    <div class="card-header"><span class="card-title">🔩 Machine Parts Replacement Reminders</span><button class="btn btn-outline btn-sm" onclick="document.getElementById('machinePartsModal').style.display='none'">✕</button></div>
    <div style="max-height:260px; overflow-y:auto; margin-bottom:14px;">${rows}</div>
    <div style="border-top:1px solid var(--border); padding-top:12px;">
      <label class="form-label">Machine Name</label>
      <input type="text" id="mpMachineName" placeholder="e.g. HRR PRO 11.14" style="width:100%; margin-bottom:8px;">
      <label class="form-label">Customer (optional)</label>
      <input type="text" id="mpCustomerName" placeholder="e.g. Sai Car Care" style="width:100%; margin-bottom:8px;">
      <label class="form-label">Part Name</label>
      <input type="text" id="mpPartName" placeholder="e.g. HP Pump Seal Kit" style="width:100%; margin-bottom:8px;">
      <div style="display:flex; gap:8px;">
        <div style="flex:1;">
          <label class="form-label">Installed Date</label>
          <input type="date" id="mpInstalledDate" style="width:100%;">
        </div>
        <div style="flex:1;">
          <label class="form-label">Replace After (months)</label>
          <input type="number" id="mpIntervalMonths" min="1" value="6" style="width:100%;">
        </div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="triggerAppHaptic(); saveMachinePart()">💾 Add Reminder</button>
    </div>
  </div>`;
  const dateEl = document.getElementById('mpInstalledDate');
  if (dateEl) dateEl.value = today;
}

function saveMachinePart() {
  const machineName = document.getElementById('mpMachineName').value.trim();
  const partName = document.getElementById('mpPartName').value.trim();
  const installedDate = document.getElementById('mpInstalledDate').value;
  const intervalMonths = Number(document.getElementById('mpIntervalMonths').value) || 6;
  if (!machineName || !partName || !installedDate) { alert('Please enter the machine name, part name and installed date!'); return; }
  const entry = {
    id: 'MP' + Date.now(),
    machineName, partName, installedDate, intervalMonths,
    customerName: document.getElementById('mpCustomerName').value.trim(),
    addedBy: currentUser ? currentUser.name : 'Staff'
  };
  machinePartsData.push(entry);
  window.machinePartsData = machinePartsData;
  setStored("MACHINE_PARTS", machinePartsData);
  updateGlobalReminders();
  renderMachinePartsModal();
}
window.saveMachinePart = saveMachinePart;

function deleteMachinePart(id) {
  if (!confirm('Delete this reminder?')) return;
  machinePartsData = machinePartsData.filter(p => p.id !== id);
  window.machinePartsData = machinePartsData;
  setStored("MACHINE_PARTS", machinePartsData);
  updateGlobalReminders();
  renderMachinePartsModal();
}
window.deleteMachinePart = deleteMachinePart;

function switchTab(tab, el) {
  const panel = document.getElementById('view-' + tab);
  // SIMPLE & SMOOTH (no lag): purana "crossfade" wala tarika do heavy
  // glass-blur panels (purana + naya) ko ek saath animate kar raha tha,
  // jisse real device par lag/jhatka wala feel aata tha. Ab sirf purana
  // panel turant hat jata hai aur naya panel ek hi smooth fade+slide-in
  // animation ke sath khulta hai - jaisa pehle tha, halka aur premium.
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  panel.classList.add('active');
  ttUpdateNavPill(el);
  if (el) el.classList.add('active');

  const fabBtn = document.getElementById('fabMainBtn');
  const fabMenu = document.getElementById('fabMenu');
  // Tab switch par quick-action panel hamesha collapse kar do (agar khula tha),
  // taaki wo doosre tab ke peeche khula na reh jaye.
  if (fabMenu && fabMenu.classList.contains('show')) {
    fabMenu.classList.remove('show');
    if (fabBtn) fabBtn.classList.remove('fab-open');
  }
  if (tab === 'chat') {
    if (fabBtn) fabBtn.style.display = 'none';
  } else {
    if (fabBtn) fabBtn.style.display = 'flex';
  }

  if(tab === 'dashboard') renderDashboard();
  if(tab === 'leads') renderLeads();
  if(tab === 'orders') renderOrders();
  if(tab === 'services') renderServices();
  if(tab === 'inventory') renderStockList();
  if(tab === 'catalog') renderCatalog();
  if(tab === 'billing') renderBilling('all');
  if(tab === 'chat') renderChatMessages();
}

function showBroadcastToastAlert(notif) {
  const container = document.getElementById('broadcastToastContainer');
  if (!container) return;

  try {
    const audioCtx = getAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch(e) {}

  if (navigator.vibrate) { try { navigator.vibrate([100, 50, 100]); } catch(e){} }

  const icons = { order: '📦', delivery: '🚚', payment: '💰' };
  const toast = document.createElement('div');
  toast.className = 'broadcast-toast';
  toast.innerHTML = `
    <div class="toast-icon">${icons[notif.type] || '🔔'}</div>
    <div class="toast-content">
      <div class="toast-title">${ttEscHtml(notif.title)}</div>
      <div class="toast-body">${notif.body}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  toast.style.cursor = 'pointer';
  toast.onclick = (e) => { if (!e.target.closest('.toast-close')) toast.remove(); };
  container.prepend(toast);

  // Popup ab 8 second me apne aap band ho jata hai (order/delivery/payment sab); cross ya tap se turant bhi band hota hai.
  setTimeout(() => {
    if (!toast.parentElement) return;
    toast.style.transition = 'opacity .35s ease, transform .35s ease';
    toast.style.opacity = '0'; toast.style.transform = 'translateY(-12px)';
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 380);
  }, 8000);
  // Ek saath 3 se zyada popup na jame
  while (container.children.length > 3) container.lastElementChild.remove();

  // Sirf is device ke khule app-page tak simit "3 second toast" hi nahi -
  // ab ye Android/browser ke asli notification tray me bhi jata hai, taaki
  // app minimized/background me ho tab bhi HAR device par dikhe.
  try {
    if (window.Notification && Notification.permission === 'granted') {
      const sysNotif = new Notification(notif.title || 'TTESPL Alert', {
        body: notif.body || '',
        tag: 'ttespl-' + (notif.type || 'info') + '-' + (notif.timestamp || Date.now()),
        renotify: true,
        silent: true // hamara apna beep upar already bajaya ja chuka hai, double-beep na ho
      });
      sysNotif.onclick = () => { try { window.focus(); } catch (e) {} sysNotif.close(); };
    }
  } catch (e) { console.warn('System notification failed', e); }
}
window.showBroadcastToastAlert = showBroadcastToastAlert;

function requestAppSystemPermissions() {
  if (window.Notification && Notification.permission !== 'granted') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        alert("✓ Notification Alerts Active!");
        if (typeof enablePushNotificationsFCM === 'function') enablePushNotificationsFCM();
      }
    });
  } else if (window.Notification && Notification.permission === 'granted') {
    if (typeof enablePushNotificationsFCM === 'function') enablePushNotificationsFCM();
  }

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        alert("✓ Camera & File Picker Permission Verified!");
      })
      .catch(err => {
        console.log("Camera access:", err);
      });
  }
}
window.requestAppSystemPermissions = requestAppSystemPermissions;

/* ===== Real Android push notification setup (FCM) ===== */
var ttMessaging = null, ttMessagingMod = null;
var TT_VAPID_KEY = "BEH0BShvwEYtoJd2LZmjZveapaE6UrmW9uQkzBA1HcLXFT9-ZMrGuOphsWJItSigUlhF1lrfNvsiEEs9H_nMEZw";
function ttInitMessaging(cb) {
  if (ttMessaging) { cb(); return; }
  Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js')
  ]).then(function (mods) {
    var A = mods[0], M = mods[1];
    var cfg = {
      apiKey: "AIzaSyAjsq2wbyXmt8_MjEazM9mAYd5vlZW0dy4",
      authDomain: "ttespl.firebaseapp.com",
      projectId: "ttespl",
      storageBucket: "ttespl.firebasestorage.app",
      messagingSenderId: "244674439608",
      appId: "1:244674439608:web:7f7299ffd94e0a0cc5474d"
    };
    var app = A.getApps().length ? A.getApp() : A.initializeApp(cfg);
    ttMessagingMod = M;
    ttMessaging = M.getMessaging(app);
    cb();
  }).catch(function (e) { console.error('FCM init failed', e); });
}
function ttSaveFcmTokenWhenReady(token, staffName, attemptsLeft) {
  // BUG FIX: pehle ye seedha check karta tha, aur agar us waqt live-sync.js
  // (Firebase) abhi load hi nahi hua tha to token chupchap save hi nahi hota tha -
  // koi error bhi nahi dikhta tha, isliye pata hi nahi chalta tha. Ab jab tak
  // cloudSync taiyar na ho jaye, 1-1 second ruk ke dobara try karta hai (max 20 baar).
  if (window.cloudSync && typeof window.cloudSync.saveFcmToken === 'function') {
    window.cloudSync.saveFcmToken(token, staffName);
    return;
  }
  if (attemptsLeft <= 0) { console.error('FCM: cloud never became ready; token could not be saved'); return; }
  setTimeout(function () { ttSaveFcmTokenWhenReady(token, staffName, attemptsLeft - 1); }, 1000);
}
function enablePushNotificationsFCM() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!TT_VAPID_KEY || TT_VAPID_KEY === "PASTE_YOUR_VAPID_KEY_HERE") { console.warn('FCM: VAPID key is not set yet'); return; }
  navigator.serviceWorker.register('firebase-messaging-sw.js').then(function (reg) {
    ttInitMessaging(function () {
      ttMessagingMod.getToken(ttMessaging, { vapidKey: TT_VAPID_KEY, serviceWorkerRegistration: reg }).then(function (token) {
        if (!token) return;
        var staffName = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'Staff';
        ttSaveFcmTokenWhenReady(token, staffName, 20);
      }).catch(function (e) { console.error('FCM getToken failed', e); });
    });
  }).catch(function (e) { console.error('Service worker register failed', e); });
}
window.enablePushNotificationsFCM = enablePushNotificationsFCM;
// Agar permission pehle se hi granted hai (purane user), to agli baar app khulte hi
// token refresh/save ho jaye - taaki sabko dobara button dabane ki zarurat na pade.
document.addEventListener('DOMContentLoaded', function () {
  if (window.Notification && Notification.permission === 'granted') {
    setTimeout(enablePushNotificationsFCM, 2500);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  checkAuthSession();
});

/* ===== TTESPL splash + login wash animation (added) ===== */
(function(){
  var t0=performance.now(), sp=document.getElementById('ttSplash'), done=false;
  function ready(){document.body.classList.add('tt-ready');}
  function leave(){
    if(done)return; done=true;
    var wait=Math.max(0,1900-(performance.now()-t0));
    setTimeout(function(){ if(sp){sp.classList.add('out'); setTimeout(function(){sp.remove();},800);} ready(); },wait);
  }
  if(document.readyState==='complete') leave(); else window.addEventListener('load',leave);
  setTimeout(leave,6000);
  var cv=document.getElementById('ttWashCanvas'); if(!cv||!cv.getContext)return;
  var cx=cv.getContext('2d'), W=0,H=0, dpr=Math.min(window.devicePixelRatio||1,2), B=[],S=[],K=[];
  function rnd(a,b){return a+Math.random()*(b-a);}
  function size(){W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0);}
  function bub(y){return{x:rnd(0,W),y:y===undefined?rnd(0,H):y,r:rnd(3,20),v:rnd(.3,1.2),p:rnd(0,6.28),a:rnd(.25,.6)};}
  function spr(){return{x:rnd(-60,W),y:rnd(-H,0),l:rnd(30,80),v:rnd(9,16),a:rnd(.12,.32)};}
  function init(){size();B=[];S=[];K=[];for(var i=0;i<34;i++)B.push(bub());for(i=0;i<40;i++)S.push(spr());for(i=0;i<22;i++)K.push({x:rnd(0,W),y:rnd(0,H*.8),p:rnd(0,6.28),s:rnd(.02,.05),r:rnd(2,5)});}
  init(); addEventListener('resize',init);
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(){
    requestAnimationFrame(frame);
    var a=document.getElementById('authScreen'); if(document.hidden||!a||a.style.display==='none')return;
    cx.clearRect(0,0,W,H);
    cx.lineCap='round';
    S.forEach(function(s){cx.strokeStyle='rgba(190,235,255,'+s.a+')';cx.lineWidth=1.6;cx.beginPath();cx.moveTo(s.x,s.y);cx.lineTo(s.x-s.l*.35,s.y+s.l);cx.stroke();
      if(!reduce){s.y+=s.v;s.x-=s.v*.35;} if(s.y>H){s.x=rnd(0,W+60);s.y=rnd(-120,-10);}});
    B.forEach(function(b){var g=cx.createRadialGradient(b.x-b.r*.3,b.y-b.r*.3,b.r*.1,b.x,b.y,b.r);
      g.addColorStop(0,'rgba(255,255,255,'+b.a+')');g.addColorStop(.7,'rgba(140,220,255,'+b.a*.25+')');g.addColorStop(1,'rgba(140,220,255,'+b.a*.7+')');
      cx.fillStyle=g;cx.beginPath();cx.arc(b.x,b.y,b.r,0,6.283);cx.fill();
      if(!reduce){b.y-=b.v;b.p+=.02;b.x+=Math.sin(b.p)*.5;} if(b.y<-30){var n=bub(H+30);b.x=n.x;b.y=n.y;b.r=n.r;b.v=n.v;}});
    K.forEach(function(k){k.p+=k.s;var o=(Math.sin(k.p)+1)/2;cx.fillStyle='rgba(255,244,190,'+o*.9+')';
      cx.beginPath();cx.moveTo(k.x,k.y-k.r*2);cx.lineTo(k.x+k.r*.5,k.y);cx.lineTo(k.x,k.y+k.r*2);cx.lineTo(k.x-k.r*.5,k.y);cx.fill();
      cx.beginPath();cx.moveTo(k.x-k.r*2,k.y);cx.lineTo(k.x,k.y+k.r*.5);cx.lineTo(k.x+k.r*2,k.y);cx.lineTo(k.x,k.y-k.r*.5);cx.fill();});
  }
  frame();
})();

/* ===== PAYMENT FOLLOW-UP + LEDGER IMPORT (added) ===== */
function openPayFollowupModal(ordId) {
  const o = ordersData.find(x => x.id === ordId);
  if (!o) return;
  let m = document.getElementById('payFollowupModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'payFollowupModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    m.innerHTML = `<div class="auth-card">
      <div class="card-header"><span class="card-title">📅 Payment Follow-up</span><button class="btn btn-outline btn-sm" onclick="document.getElementById('payFollowupModal').style.display='none'">✕</button></div>
      <div id="pfuInfo" style="font-size:12.5px; margin-bottom:10px; color:var(--text-muted);"></div>
      <input type="hidden" id="pfuOrdId">
      <label class="form-label">On which date will the customer pay?</label>
      <input type="date" id="pfuDate" style="width:100%; margin-bottom:10px;">
      <label class="form-label">Note (who said it / how much they will pay)</label>
      <input type="text" id="pfuNote" placeholder="e.g. Owner said he will pay 20000 on Friday" style="width:100%; margin-bottom:14px;">
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" style="flex:2;" onclick="savePayFollowup()">💾 Save Follow-up</button>
        <button class="btn btn-outline" style="flex:1;" onclick="clearPayFollowup()">Clear</button>
      </div>
    </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('pfuOrdId').value = ordId;
  document.getElementById('pfuInfo').innerHTML = `<strong>${esc(o.customerName)}</strong> — Invoice ${esc(o.id)} — Due ₹${Number(o.dueAmount).toLocaleString('en-IN')}`;
  const d = new Date(); d.setDate(d.getDate() + 3);
  document.getElementById('pfuDate').value = o.payFollowupDate || ttYmd(d);
  document.getElementById('pfuNote').value = o.payFollowupNote || '';
  m.style.display = 'flex';
}

function savePayFollowup() {
  const id = document.getElementById('pfuOrdId').value;
  const o = ordersData.find(x => x.id === id);
  if (!o) return;
  const date = document.getElementById('pfuDate').value;
  if (!date) { alert('Please select a follow-up date!'); return; }
  o.payFollowupDate = date;
  o.payFollowupNote = document.getElementById('pfuNote').value.trim();
  o.auditTrail = o.auditTrail || [];
  o.auditTrail.unshift({ by: currentUser ? currentUser.name : 'Staff', time: getNowStr(), note: 'Payment follow-up set for ' + date });
  setStored("ORDERS", ordersData);
  document.getElementById('payFollowupModal').style.display = 'none';
  renderBilling('due');
  updateGlobalReminders();
  if (window.cloudSync && typeof window.cloudSync.pushLiveNotification === 'function') {
    window.cloudSync.pushLiveNotification({ title: "📅 Payment Follow-up Set", body: `${o.customerName} - ${date} (Due ₹${Number(o.dueAmount).toLocaleString('en-IN')})`, type: "payment" });
  }
}

function clearPayFollowup() {
  const id = document.getElementById('pfuOrdId').value;
  const o = ordersData.find(x => x.id === id);
  if (!o) return;
  delete o.payFollowupDate; delete o.payFollowupNote;
  setStored("ORDERS", ordersData);
  document.getElementById('payFollowupModal').style.display = 'none';
  renderBilling('due');
  updateGlobalReminders();
}
window.openPayFollowupModal = openPayFollowupModal;
window.savePayFollowup = savePayFollowup;
window.clearPayFollowup = clearPayFollowup;

/* ---- Ledger import: ledger-import.json (Excel se convert) ---- */
function ttNormKey(k) { return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function ttNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[₹,\s]/g, ''));
  return isNaN(n) ? null : n;
}
function ttDate(v) {
  const today = ttYmd(new Date());
  if (v === null || v === undefined || v === '') return today;
  if (typeof v === 'number' || /^\d{5}$/.test(String(v).trim())) {
    const d = new Date(Math.round((Number(v) - 25569) * 86400 * 1000));
    return isNaN(d) ? today : ttYmd(d);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? today : ttYmd(d);
}
const TT_LEDGER_ALIASES = {
  inv: ['invoicenumber', 'invoiceno', 'invoice', 'billno', 'billnumber', 'invno'],
  date: ['invoicedate', 'date', 'billdate'],
  name: ['customername', 'name', 'customer', 'partyname', 'party'],
  phone: ['mobileno', 'mobilenumber', 'mobile', 'phone', 'phoneno', 'contact'],
  email: ['email', 'emailid', 'emailaddress'],
  address: ['address', 'customeraddress'],
  gst: ['customergstno', 'gstno', 'gstin', 'gst', 'gstnumber'],
  item: ['itemname', 'item', 'items', 'product', 'particulars', 'description'],
  qty: ['qty', 'quantity'],
  amt: ['itemamountwithgst', 'itemamount', 'amountwithgst', 'amount', 'total'],
  paid: ['paymentreceived', 'payment', 'paid', 'received', 'receivedamount'],
  due: ['dueamount', 'duepayment', 'due', 'balance'],
  staff: ['salesby', 'salesbystaffname', 'staffname', 'staff', 'soldby']
};
function ttPick(nrow, key) {
  for (const a of TT_LEDGER_ALIASES[key]) {
    if (nrow[a] !== undefined && String(nrow[a]).trim() !== '') return nrow[a];
  }
  return '';
}
function ttLast10(p) { return String(p || '').replace(/\D/g, '').slice(-10); }

async function importLedgerFromJson() {
  if (!isAdminUser()) { alert('Permission denied: only an Admin can import the ledger.'); return; }
  let data;
  try {
    const res = await fetch('ledger-import.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (e) {
    alert('ledger-import.json was not found or could not be read. Upload that file to GitHub next to index.html.\n(' + e.message + ')');
    return;
  }
  const rows = Array.isArray(data) ? data : (data && (data.rows || data.data || data.ledger)) || [];
  if (!rows.length) { alert('No rows found in the file.'); return; }

  // Invoice number ke hisab se group
  const groups = new Map();
  let noInvCounter = 0;
  rows.forEach(r => {
    const nrow = {};
    Object.keys(r).forEach(k => nrow[ttNormKey(k)] = r[k]);
    let inv = String(ttPick(nrow, 'inv')).trim();
    if (!inv) { inv = 'NOINV-' + (++noInvCounter); }
    if (!groups.has(inv)) groups.set(inv, []);
    groups.get(inv).push(nrow);
  });

  if (!confirm(`${rows.length} rows contain ${groups.size} bills. Import them into the ledger?\n(Invoices whose number already exists in the app will be skipped.)`)) return;

  const existingIds = new Set(ordersData.map(o => String(o.id)));
  const customers = Array.isArray(customerDatabase) ? customerDatabase.slice() : [];
  const byPhone = new Map(), byName = new Map();
  customers.forEach(c => {
    const p = ttLast10(c.phone); if (p.length === 10) byPhone.set(p, c);
    const n = String(c.name || '').trim().toLowerCase(); if (n) byName.set(n, c);
  });

  let imported = 0, skipped = 0, matched = 0, added = 0, bad = 0, idSeq = 0, cloudNote = '';
  const newOrders = [];

  groups.forEach((list, inv) => {
    if (existingIds.has(inv)) { skipped++; return; }
    const first = (key) => { for (const r of list) { const v = ttPick(r, key); if (v !== '') return v; } return ''; };

    const name = String(first('name')).trim();
    const phone = String(first('phone')).replace(/\D/g, '');
    if (!name && !phone) { bad++; return; }

    // Customer match: phone ya name kuch bhi mile to usi ke naam se bill
    let cust = null;
    const p10 = ttLast10(phone);
    if (p10.length === 10 && byPhone.has(p10)) cust = byPhone.get(p10);
    if (!cust && name && byName.has(name.toLowerCase())) cust = byName.get(name.toLowerCase());
    if (cust) {
      matched++;
    } else {
      cust = {
        id: 'IMP' + Date.now() + '_' + (++idSeq),
        name: name || phone, person: name || phone, phone: phone,
        email: String(first('email')).trim(), address: String(first('address')).trim(), gst: String(first('gst')).trim()
      };
      customers.push(cust);
      if (p10.length === 10) byPhone.set(p10, cust);
      if (cust.name) byName.set(String(cust.name).trim().toLowerCase(), cust);
      added++;
    }

    // Items - sirf bill me, products list me koi entry nahi
    const items = [];
    list.forEach((r, i) => {
      const iname = String(ttPick(r, 'item')).trim();
      const amt = ttNum(ttPick(r, 'amt'));
      if (!iname && amt === null) return;
      const qty = Math.max(1, parseInt(ttNum(ttPick(r, 'qty'))) || 1);
      const total = amt || 0;
      items.push({ id: 'IMPITEM' + Date.now() + '_' + (++idSeq), name: iname || 'Item', hsn: '84139190', qty, mrp: total / qty, disc: 0, rate: total / qty, total });
    });
    if (!items.length) { bad++; return; }

    const totalAmount = Math.round(items.reduce((s, it) => s + it.total, 0) * 100) / 100;
    let recv = ttNum(first('paid')), due = ttNum(first('due'));
    if (recv === null && due === null) { recv = totalAmount; due = 0; }
    else if (recv === null) { recv = Math.max(0, totalAmount - due); }
    else if (due === null) { due = Math.max(0, totalAmount - recv); }

    const dt = ttDate(first('date'));
    const gstNo = cust.gst || '';
    newOrders.push({
      id: inv, customerName: cust.name, phone: cust.phone || phone,
      orderDate: dt, deliveryDate: dt, deliveredDate: dt,
      items, totalAmount, recvAmount: recv, dueAmount: due, payMode: 'Imported',
      taxType: (gstNo && !gstNo.startsWith('21')) ? 'INTER' : 'INTRA',
      status: 'Delivered', bookedBy: String(first('staff')).trim() || 'Imported',
      auditTrail: [{ by: currentUser.name + ' (Admin)', time: getNowStr(), note: 'Imported from Excel ledger' }]
    });
    imported++;
  });

  if (imported > 0) {
    ordersData.push(...newOrders);
    customerDatabase = customers;
    window.customerDatabase = customerDatabase;
    setStored("CUSTOMERS", customerDatabase);
    setStored("ORDERS", ordersData);
    try {
      if (window.cloudSync && window.cloudSync.pushKey) {
        await window.cloudSync.pushKey('CUSTOMERS', customers);
        await window.cloudSync.pushKey('ORDERS', newOrders);
        cloudNote = '\n☁️ Saved to the cloud - it will now appear on all devices.';
      } else { cloudNote = '\n⚠️ Not connected to the cloud - check the internet and tap Import again.'; }
    } catch (e) { console.error(e); cloudNote = '\n⚠️ Cloud save failed: ' + e.message + ' - please tap Import again.'; }
  }
  renderBilling('all');
  renderDashboard();
  if (typeof renderOrders === 'function') renderOrders();
  updateGlobalReminders();
  alert(`Import complete!\n✅ ${imported} bills added to the ledger\n👤 ${matched} bills matched to existing customers\n🆕 ${added} new customers added automatically\n⏭️ ${skipped} bills already existed (skipped)\n⚠️ ${bad} incomplete rows (skipped)` + cloudNote);
}
window.importLedgerFromJson = importLedgerFromJson;

/* ===== IMAGE COMPRESS + TALLY INVOICE + LEDGER DETAIL + BACKUP (added) ===== */
function ttCompressImage(dataUrl, maxDim, quality) {
  maxDim = maxDim || 900; quality = quality || 0.6;
  return new Promise(function(resolve) {
    const img = new Image();
    img.onload = function() {
      try {
        let w = img.width, hh = img.height;
        const sc = Math.min(1, maxDim / Math.max(w, hh));
        w = Math.round(w * sc); hh = Math.round(hh * sc);
        const c = document.createElement('canvas'); c.width = w; c.height = hh;
        c.getContext('2d').drawImage(img, 0, 0, w, hh);
        resolve(c.toDataURL('image/jpeg', quality));
      } catch (e) { resolve(dataUrl); }
    };
    img.onerror = function() { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

// IMAGE SIZE SAFEGUARD: Firestore ka 1 document max ~1MB hota hai. Normal compress
// (900px/0.6) usually kaafi hota hai, lekin bahut high-res phone photo me kabhi-kabhi
// phir bhi bada reh sakta hai - tab ye khud-ba-khud ek aur round chhoti size/quality
// me compress karta hai, jab tak safe size na aa jaye. Purana ttCompressImage() waisa
// hi rehta hai (kahin aur use ho raha ho to kuch nahi tootega) - ye ek extra wrapper hai.
function ttCompressImageSafe(dataUrl, maxDim, quality, maxLen) {
  maxDim = maxDim || 900; quality = quality || 0.6; maxLen = maxLen || 600000;
  return ttCompressImage(dataUrl, maxDim, quality).then(function (out) {
    if (out && out.length > maxLen && maxDim > 450) {
      return ttCompressImageSafe(out, Math.round(maxDim * 0.75), Math.max(0.4, quality - 0.15), maxLen);
    }
    return out;
  });
}
window.ttCompressImageSafe = ttCompressImageSafe;

// MACHINERY BRAND BADGE: product/machine ke naam me jo bhi known brand (Ma-Fra,
// Annovi Reverberi, Maxshine) mention ho, uska chhota colored badge dikha dete
// hain - sirf display helper hai, kisi data/field ko chhuta nahi hai.
var TT_BRANDS = [
  { key: 'annovi reverberi', label: 'AR', color: '#c0392b' },
  { key: 'ma-fra', label: 'Ma-Fra', color: '#2563eb' },
  { key: 'mafra', label: 'Ma-Fra', color: '#2563eb' },
  { key: 'maxshine', label: 'Maxshine', color: '#16a34a' }
];
function ttBrandBadge(name) {
  if (!name) return '';
  const lower = String(name).toLowerCase();
  const b = TT_BRANDS.find(function (x) { return lower.indexOf(x.key) !== -1; });
  if (!b) return '';
  return `<span style="font-size:9px; font-weight:800; padding:1px 6px; border-radius:6px; color:#fff; background:${b.color}; letter-spacing:.2px;">${ttEscHtml(b.label)}</span>`;
}

// SKELETON LOADER: cloud se data fetch hone tak (list khaali ho) ek chhota
// shimmer placeholder dikhane ke liye - blank screen/jumpy render ki jagah.
function ttSkeletonCards(n) {
  n = n || 3;
  let out = '';
  for (let i = 0; i < n; i++) out += '<div class="tt-skeleton tt-skeleton-card"></div>';
  return out;
}
window.ttBrandBadge = ttBrandBadge;
window.ttSkeletonCards = ttSkeletonCards;

// Agar list khaali dikh rahi hai kyunki cloud ka pehla data abhi load ho raha
// hai (window.ttCloudInitialLoadDone === false), to "no data" empty-state ke
// bajaye shimmer skeleton dikhao - taaki layout jump na ho jab asli data aaye.
function ttMaybeSkeleton(container, count) {
  if (window.ttCloudInitialLoadDone === false && container) {
    container.innerHTML = ttSkeletonCards(count || 3);
    return true;
  }
  return false;
}
window.ttMaybeSkeleton = ttMaybeSkeleton;

function ttInr(n) { return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function ttWords(num) {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const two = n => n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
  const three = n => (n >= 100 ? a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : '');
  function whole(n) {
    if (n === 0) return 'Zero';
    let out = '';
    const cr = Math.floor(n / 10000000); n %= 10000000;
    const lk = Math.floor(n / 100000); n %= 100000;
    const th = Math.floor(n / 1000); n %= 1000;
    if (cr) out += three(cr) + ' Crore '; if (lk) out += two(lk) + ' Lakh '; if (th) out += two(th) + ' Thousand ';
    if (n) out += three(n);
    return out.trim();
  }
  const rupees = Math.floor(num), paise = Math.round((num - rupees) * 100);
  return 'INR ' + whole(rupees) + (paise ? ' and ' + whole(paise) + ' paise' : '') + ' Only';
}

function buildTallyInvoiceHtmlLegacy(o) {
  const cust = customerDatabase.find(c => (c.phone && c.phone === o.phone) || c.name === o.customerName) || {};
  const gstNo = cust.gst || '';
  const intra = (o.taxType || 'INTRA') !== 'INTER';
  const dt = o.deliveredDate || o.orderDate || '';
  const items = (o.items || []).map(it => {
    const incl = Number(it.total) || 0;
    const taxable = Math.round(incl / 1.18 * 100) / 100;
    const qty = Number(it.qty) || 1;
    return { name: it.name, hsn: it.hsn || '84139190', qty, inclRate: qty ? incl / qty : incl, rate: qty ? taxable / qty : taxable, disc: it.disc || 0, taxable, incl };
  });
  const sumTaxable = Math.round(items.reduce((s, i) => s + i.taxable, 0) * 100) / 100;
  const total = Number(o.totalAmount) || 0;
  // Courier/Transport charge is a non-taxable add-on: pull it out of the
  // grand total before working out the GST split, then show it as its own
  // line below the tax rows so product-level GST math stays untouched.
  const courierCharge = Number(o.courierCharge) || 0;
  const totalForTax = Math.round((total - courierCharge) * 100) / 100;
  const tax = Math.round((totalForTax - sumTaxable) * 100) / 100;
  const half = Math.round(tax / 2 * 100) / 100;
  const roundOff = Math.round((totalForTax - (sumTaxable + (intra ? half * 2 : tax))) * 100) / 100;
  // HSN summary
  const hs = {};
  items.forEach(i => { hs[i.hsn] = hs[i.hsn] || 0; hs[i.hsn] += i.taxable; });
  let hsRows = '', hsTot = 0, hsTax = 0;
  Object.keys(hs).forEach(k => {
    const tv = Math.round(hs[k] * 100) / 100, tx = Math.round(tv * 0.18 * 100) / 100;
    hsTot += tv; hsTax += tx;
    hsRows += `<tr><td style="text-align:left;">${esc(k)}</td><td>${ttInr(tv)}</td>` +
      (intra ? `<td>9%</td><td>${ttInr(tx / 2)}</td><td>9%</td><td>${ttInr(tx / 2)}</td>` : `<td colspan="2">IGST 18%</td><td colspan="2">${ttInr(tx)}</td>`) +
      `<td>${ttInr(tx)}</td></tr>`;
  });
  const B = 'border:1px solid #000;';
  const cell = 'padding:3px 5px;vertical-align:top;';
  const meta = (l, v) => `<div style="${B}border-width:0 0 1px 1px;padding:2px 5px;min-height:30px;"><div style="font-size:9.5px;">${l}</div><div style="font-weight:700;font-size:11.5px;">${v || ''}</div></div>`;
  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11px;line-height:1.35;">
  <div style="text-align:center;font-weight:800;font-size:15px;margin-bottom:4px;">Tax Invoice</div>
  <div style="${B}">
    <div style="display:grid;grid-template-columns:1.25fr 1fr;">
      <div>
        <div style="padding:5px 6px;border-bottom:1px solid #000;">
          <strong style="font-size:12.5px;">TWINTOWN EXPRESS SERVICES PVT LTD</strong><br>
          PLOT:1270/8566, SATYA VIHAR, RASHULGARH,<br>BHUBANESWAR-751010<br>
          Ph-8917465040 / 6743175599<br>GSTIN/UIN: 21AAICT6014E1ZT<br>State Name : Odisha, Code : 21<br>E-Mail : info@ttespl.com
        </div>
        <div style="padding:5px 6px;border-bottom:1px solid #000;">
          <span style="font-size:9.5px;">Consignee (Ship to)</span><br>
          <strong>${esc(o.customerName)}</strong><br>${esc(cust.address || '')}<br>${o.phone ? 'Mobile: ' + esc(o.phone) + '<br>' : ''}
          GSTIN/UIN : ${esc(gstNo || 'Unregistered')}<br>State Name : Odisha, Code : 21
        </div>
        <div style="padding:5px 6px;">
          <span style="font-size:9.5px;">Buyer (Bill to)</span><br>
          <strong>${esc(o.customerName)}</strong><br>${esc(cust.address || '')}<br>
          GSTIN/UIN : ${esc(gstNo || 'Unregistered')}<br>State Name : Odisha, Code : 21
        </div>
      </div>
      <div style="border-left:1px solid #000;">
        <div style="display:grid;grid-template-columns:1fr 1fr;">
          ${meta('Invoice No.', esc(o.id))}${meta('Dated', esc(dt))}
          ${meta('Delivery Note', '')}${meta('Mode/Terms of Payment', esc(o.payMode && o.payMode !== 'Imported' ? o.payMode : ''))}
          ${meta('Reference No. &amp; Date.', '')}${meta('Other References', '')}
          ${meta("Buyer's Order No.", '')}${meta('Dated', esc(o.orderDate || ''))}
          ${meta('Dispatch Doc No.', '')}${meta('Delivery Note Date', '')}
          ${meta('Dispatched through', '')}${meta('Destination', '')}
        </div>
        <div style="padding:3px 5px;min-height:40px;font-size:9.5px;">Terms of Delivery<br>Billed By: <strong>${esc(o.bookedBy || '')}</strong></div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="text-align:center;">
        <th style="${B}${cell}width:24px;">SI No.</th><th style="${B}${cell}">Description of Goods</th><th style="${B}${cell}">HSN/SAC</th>
        <th style="${B}${cell}">GST Rate</th><th style="${B}${cell}">Quantity</th><th style="${B}${cell}">Rate (Incl. of Tax)</th>
        <th style="${B}${cell}">Rate</th><th style="${B}${cell}">per</th><th style="${B}${cell}">Disc. %</th><th style="${B}${cell}">Amount</th></tr></thead>
      <tbody>
        ${items.map((i, n) => `<tr>
          <td style="${cell}border-left:1px solid #000;text-align:center;">${n + 1}</td><td style="${cell}border-left:1px solid #000;"><strong>${esc(i.name)}</strong></td>
          <td style="${cell}border-left:1px solid #000;">${esc(i.hsn)}</td><td style="${cell}border-left:1px solid #000;text-align:center;">18 %</td>
          <td style="${cell}border-left:1px solid #000;text-align:right;"><strong>${i.qty} PCS</strong></td><td style="${cell}border-left:1px solid #000;text-align:right;">${ttInr(i.inclRate)}</td>
          <td style="${cell}border-left:1px solid #000;text-align:right;">${ttInr(i.rate)}</td><td style="${cell}border-left:1px solid #000;text-align:center;">PCS</td>
          <td style="${cell}border-left:1px solid #000;text-align:center;">${i.disc || ''}</td><td style="${cell}border-left:1px solid #000;border-right:1px solid #000;text-align:right;"><strong>${ttInr(i.taxable)}</strong></td></tr>`).join('')}
        <tr style="height:26px;"><td style="border-left:1px solid #000;"></td><td style="border-left:1px solid #000;"></td><td style="border-left:1px solid #000;"></td><td style="border-left:1px solid #000;"></td><td style="border-left:1px solid #000;"></td><td style="border-left:1px solid #000;"></td><td style="border-left:1px solid #000;"></td><td style="border-left:1px solid #000;"></td><td style="border-left:1px solid #000;"></td><td style="border-left:1px solid #000;border-right:1px solid #000;text-align:right;border-top:1px solid #000;padding:3px 5px;">${ttInr(sumTaxable)}</td></tr>
        ${intra ? `<tr><td colspan="9" style="text-align:right;font-weight:800;padding:2px 5px;border-left:1px solid #000;">CGST</td><td style="text-align:right;padding:2px 5px;border-left:1px solid #000;border-right:1px solid #000;font-weight:700;">${ttInr(half)}</td></tr>
        <tr><td colspan="9" style="text-align:right;font-weight:800;padding:2px 5px;border-left:1px solid #000;">SGST</td><td style="text-align:right;padding:2px 5px;border-left:1px solid #000;border-right:1px solid #000;font-weight:700;">${ttInr(half)}</td></tr>`
        : `<tr><td colspan="9" style="text-align:right;font-weight:800;padding:2px 5px;border-left:1px solid #000;">IGST</td><td style="text-align:right;padding:2px 5px;border-left:1px solid #000;border-right:1px solid #000;font-weight:700;">${ttInr(tax)}</td></tr>`}
        ${Math.abs(roundOff) >= 0.005 ? `<tr><td colspan="9" style="text-align:right;font-weight:800;padding:2px 5px;border-left:1px solid #000;">ROUND OFF</td><td style="text-align:right;padding:2px 5px;border-left:1px solid #000;border-right:1px solid #000;font-weight:700;">${ttInr(roundOff)}</td></tr>` : ''}
        ${courierCharge > 0 ? `<tr><td colspan="9" style="text-align:right;font-weight:800;padding:2px 5px;border-left:1px solid #000;">Courier / Transport Charges</td><td style="text-align:right;padding:2px 5px;border-left:1px solid #000;border-right:1px solid #000;font-weight:700;">${ttInr(courierCharge)}</td></tr>` : ''}
        <tr style="height:14px;"><td colspan="10" style="border-left:1px solid #000;border-right:1px solid #000;"></td></tr>
        <tr><td colspan="4" style="${B}text-align:right;font-weight:800;padding:3px 5px;">Total</td><td style="${B}text-align:right;font-weight:800;padding:3px 5px;">${items.reduce((s, i) => s + i.qty, 0)} PCS</td><td colspan="4" style="${B}"></td><td style="${B}text-align:right;font-weight:800;font-size:13px;padding:3px 5px;">₹ ${ttInr(total)}</td></tr>
      </tbody>
    </table>
    <div style="padding:4px 6px;border-top:1px solid #000;display:flex;justify-content:space-between;"><span>Amount Chargeable (in words)<br><strong style="font-size:12px;">${ttWords(total)}</strong></span><span style="font-size:10px;">E. &amp; O.E</span></div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5px;text-align:right;border-top:1px solid #000;">
      <thead><tr><th style="${B}${cell}text-align:center;" rowspan="2">HSN/SAC</th><th style="${B}${cell}" rowspan="2">Taxable Value</th>${intra ? `<th style="${B}${cell}text-align:center;" colspan="2">CGST</th><th style="${B}${cell}text-align:center;" colspan="2">SGST/UTGST</th>` : `<th style="${B}${cell}text-align:center;" colspan="4">IGST</th>`}<th style="${B}${cell}" rowspan="2">Total Tax Amount</th></tr>
      <tr>${intra ? '<th style="border:1px solid #000;padding:2px 4px;">Rate</th><th style="border:1px solid #000;padding:2px 4px;">Amount</th><th style="border:1px solid #000;padding:2px 4px;">Rate</th><th style="border:1px solid #000;padding:2px 4px;">Amount</th>' : '<th colspan="2" style="border:1px solid #000;">Rate</th><th colspan="2" style="border:1px solid #000;">Amount</th>'}</tr></thead>
      <tbody>${hsRows}<tr style="font-weight:800;"><td style="${B}${cell}text-align:right;">Total</td><td style="${B}${cell}">${ttInr(hsTot)}</td><td style="${B}${cell}" colspan="4">${ttInr(hsTax)}</td><td style="${B}${cell}">${ttInr(hsTax)}</td></tr></tbody>
    </table>
    <div style="padding:4px 6px;border-top:1px solid #000;">Tax Amount (in words) : <strong>${ttWords(hsTax).replace('INR ', 'INR ')}</strong></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;">
      <div style="padding:5px 6px;font-size:10px;"><u>Declaration</u><br>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        <div style="margin-top:6px;">Received: <strong>₹${ttInr(o.recvAmount)}</strong> &nbsp; Balance Due: <strong style="color:#b91c1c;">₹${ttInr(o.dueAmount)}</strong></div></div>
      <div style="padding:5px 6px;border-left:1px solid #000;font-size:10.5px;"><strong>Company's Bank Details</strong><br>Bank Name : ICICI BANK AC-150005501249<br>A/c No. : 150005501249<br>Branch &amp; IFS Code : CUTTACK ROAD &amp; ICIC0001500</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;min-height:64px;">
      <div style="padding:5px 6px;font-size:10px;">Customer's Seal and Signature</div>
      <div style="padding:5px 6px;border-left:1px solid #000;text-align:right;font-size:10.5px;">for <strong>TWINTOWN EXPRESS SERVICES PVT LTD</strong><br><br><br>Authorised Signatory</div>
    </div>
    <div style="padding:5px 8px;border-top:1px solid #000;font-size:8.5px;line-height:1.35;page-break-inside:avoid;"><strong style="font-size:9.5px;"><u>Terms &amp; Conditions for Invoice / Bill</u></strong><ol style="margin:2px 0 0 14px;padding:0;"><li><b>Payment Due Date:</b> Full payment must be settled within 7–15 days from the invoice date.</li><li><b>Payment Mode:</b> For bill amounts exceeding ₹5,000, payment via Cheque is compulsory. Otherwise, payments can be made via Bank Transfer, UPI, or Cheque.</li><li><b>Late Fee:</b> A late interest charge of 1.5% per month will be applicable on payments delayed past the due date.</li><li><b>Goods Return Policy:</b> Goods once sold cannot be returned or exchanged.</li><li><b>Warranty / Guarantee:</b> Warranty or guarantee terms are subject strictly to the manufacturer's/company's standard policy.</li><li><b>Jurisdiction:</b> All legal disputes are subject to the exclusive jurisdiction of the courts in Bhubaneswar.</li></ol></div>
  </div>
  <div style="text-align:center;font-size:10px;margin-top:4px;">This is a Computer Generated Invoice</div>
</div>`;
}
window.buildTallyInvoiceHtmlLegacy = buildTallyInvoiceHtmlLegacy;

/* ===== QUOTATION (Service/Leads se banayi ja sakti he) ===== */
function openQuotationModalBase() {
  let m = document.getElementById('quotationModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'quotationModal';
    m.className = 'auth-overlay';
    m.style.display = 'none';
    m.innerHTML = `<div class="auth-card" style="max-width:520px;">
      <div class="card-header"><span class="card-title">📝 Quotation</span><div style="display:flex;gap:6px;"><button class="btn btn-outline btn-sm" onclick="openQuotationHistory()">🕘 History</button><button class="btn btn-accent btn-sm" onclick="ttSaveAndPrintQuotation()">💾 Save/Print</button><button class="btn btn-outline btn-sm" onclick="document.getElementById('quotationModal').style.display='none'">✕</button></div></div>
      <input type="hidden" id="quotEditId"><div id="quotSerialLabel"></div>

      <label class="form-label">Customer</label>
      <div style="position:relative; margin-bottom:10px;">
        <input type="text" id="quotCustName" placeholder="Type customer name or phone..." oninput="handleQuotCustomerAutocomplete(this)" style="width:100%;">
        <div class="solid-suggestion-box" id="quotCustSuggestBox"></div>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <input type="text" id="quotCustPhone" placeholder="Phone" style="flex:1;">
        <input type="text" id="quotCustGst" placeholder="GSTIN (optional)" style="flex:1;">
      </div>
      <input type="text" id="quotCustAddr" placeholder="Address" style="width:100%; margin-bottom:14px;">

      <label class="form-label">Items</label>
      <div id="quotItemsBody"></div>
      <button class="btn btn-outline btn-sm" style="margin:6px 0 14px;" onclick="quotAddItemRow()">➕ Add Item</button>

      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <div style="flex:1;"><label class="form-label">Service &amp; Travel Charges</label><input type="number" id="quotServiceCharge" value="0" oninput="quotRecalc()" style="width:100%;"></div>
        <div style="flex:1;"><label class="form-label">Mode of Payment</label><input type="text" id="quotPayMode" value="Cash/Online" style="width:100%;"></div>
      </div>

      <div id="quotTotalsBox" style="background:var(--card-glass); border:1px solid var(--card-glass-border); border-radius:10px; padding:10px 12px; margin-bottom:14px; font-size:13px;"></div>

      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" style="flex:1;" onclick="printQuotation()">📤 Share</button>
        <button class="btn btn-accent" style="flex:1;" onclick="ttSaveAndPrintQuotation()">💾 Save / Print</button>
        <button class="btn btn-outline" style="flex:1;" onclick="document.getElementById('quotationModal').style.display='none'">Close</button>
      </div>
    </div>`;
    document.body.appendChild(m);
  }
  document.getElementById('quotCustName').value = '';
  document.getElementById('quotCustPhone').value = '';
  document.getElementById('quotCustGst').value = '';
  document.getElementById('quotCustAddr').value = '';
  document.getElementById('quotServiceCharge').value = '0';
  document.getElementById('quotPayMode').value = 'Cash/Online';
  document.getElementById('quotItemsBody').innerHTML = '';
  quotAddItemRow();
  m.style.display = 'flex';
}

function handleQuotCustomerAutocomplete(inputEl) {
  const val = (inputEl.value || '').toLowerCase().trim();
  const box = document.getElementById('quotCustSuggestBox');
  if (!box) return;
  if (!val) { box.style.display = 'none'; return; }
  const matches = (customerDatabase || []).filter(c =>
    (c.name && c.name.toLowerCase().includes(val)) || (c.phone && String(c.phone).includes(val))
  ).slice(0, 8);
  if (matches.length === 0) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(c => `
    <div class="suggestion-item" onmousedown="selectQuotCustomerSuggestion('${encodeURIComponent(c.name || '')}', '${c.phone || ''}', '${encodeURIComponent(c.address || '')}', '${encodeURIComponent(c.gst || '')}')">
      <div style="flex:1;">
        <strong style="font-size:13px; color:var(--text-main);">${c.name || ''}</strong>
        <div class="suggestion-sub">📍 ${c.address || ''}</div>
      </div>
      <span class="badge badge-info" style="font-size:10px;">${c.phone || ''}</span>
    </div>`).join('');
  box.style.display = 'block';
}
function selectQuotCustomerSuggestion(encName, phone, encAddr, encGst) {
  document.getElementById('quotCustName').value = decodeURIComponent(encName);
  document.getElementById('quotCustPhone').value = phone || '';
  document.getElementById('quotCustAddr').value = decodeURIComponent(encAddr || '');
  document.getElementById('quotCustGst').value = decodeURIComponent(encGst || '');
  document.getElementById('quotCustSuggestBox').style.display = 'none';
}

function quotAddItemRow() {
  const wrap = document.getElementById('quotItemsBody');
  const row = document.createElement('div');
  row.className = 'quot-item-row';
  row.style.cssText = 'border:1px solid var(--border); border-radius:10px; padding:8px; margin-bottom:8px; position:relative;';
  row.innerHTML = `
    <div style="position:relative; margin-bottom:6px;">
      <input type="text" class="qit-name" placeholder="Type product name..." oninput="handleQuotItemInput(this)" style="width:100%;">
      <div class="solid-suggestion-box"></div>
      <div class="qit-desc" style="display:none;font-size:9px;line-height:1.3;color:var(--text-muted);margin-top:3px;white-space:pre-wrap;"></div>
    </div>
    <div style="display:flex; gap:6px; align-items:center;">
      <input type="text" class="qit-hsn" placeholder="HSN" style="width:70px; font-size:12px;">
      <input type="number" class="qit-qty" placeholder="Qty" value="1" min="0" oninput="quotRecalc()" style="width:55px;">
      <input type="number" class="qit-rate" placeholder="Rate" value="0" oninput="quotRecalc()" style="flex:1; min-width:70px;">
      <input type="number" class="qit-disc" placeholder="Disc%" value="0" oninput="quotRecalc()" style="width:55px;">
      <button class="btn btn-outline btn-sm" onclick="this.closest('.quot-item-row').remove(); quotRecalc();" style="padding:4px 8px;">✕</button>
    </div>`;
  wrap.appendChild(row);
  quotRecalc();
}

function handleQuotItemInput(inputEl) {
  const val = (inputEl.value || '').toLowerCase().trim();
  const row = inputEl.closest('.quot-item-row');
  if (!row) return;
  const box = row.querySelector('.solid-suggestion-box');
  if (!val) { box.style.display = 'none'; return; }
  // Typing se naya naam likha to purana catalog description hata do
  if (row.dataset.descFor && row.dataset.descFor !== inputEl.value.trim()) ttQuotSetDesc(row, '', '');
  // SIRF QUOTATION me: Product Catalog ke products bhi searchable (pehle catalog wale, phir stock)
  const hit = p => [p.name, p.code, p.subCategory, p.machine].some(f => f && String(f).toLowerCase().includes(val));
  const all = (sampleInventory || []).filter(hit);
  const matches = all.filter(p => p.category === 'Catalog Equipment').concat(all.filter(p => p.category !== 'Catalog Equipment')).slice(0, 10);
  if (matches.length === 0) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(p => `
    <div class="suggestion-item" onmousedown="ttSelQuotItem(this, '${encodeURIComponent(String(p.id))}')">
      <div style="flex:1;">
        <strong style="font-size:12.5px; color:var(--text-main);">${ttH(p.name)}</strong>
        <div class="suggestion-sub">${p.category === 'Catalog Equipment' ? '📚 Catalog' + (p.subCategory ? ' • ' + ttH(p.subCategory) : '') : 'SKU: ' + ttH(p.code || 'N/A')}</div>
      </div>
      <strong style="color:var(--accent); font-size:13px;">₹${p.rate || 0}</strong>
    </div>`).join('');
  box.style.display = 'block';
}
function ttQuotSetDesc(row, desc, specs) {
  row.dataset.desc = desc || '';
  row.dataset.specs = specs || '';
  const el = row.querySelector('.qit-desc');
  if (!el) return;
  const clip = s => s.length > 260 ? s.slice(0, 260) + '…' : s;
  const parts = [];
  if (desc) parts.push(clip(String(desc)));
  if (specs) parts.push('Tech: ' + clip(String(specs)));
  el.textContent = parts.join('\n');
  el.style.display = parts.length ? 'block' : 'none';
  if (!parts.length) delete row.dataset.descFor;
}
function ttSelQuotItem(el, encId) {
  const row = el.closest('.quot-item-row');
  if (!row) return;
  const id = decodeURIComponent(encId);
  const p = (sampleInventory || []).find(x => String(x.id) === id);
  if (!p) return;
  row.querySelector('.qit-name').value = p.name || '';
  row.querySelector('.qit-hsn').value = p.hsn || '';
  row.querySelector('.qit-rate').value = p.rate || 0; // Customer Price (Dealer Price kabhi nahi)
  row.querySelector('.solid-suggestion-box').style.display = 'none';
  if (p.category === 'Catalog Equipment') {
    row.dataset.descFor = (p.name || '').trim();
    ttQuotSetDesc(row, p.desc || '', p.specs || '');
  } else {
    ttQuotSetDesc(row, '', '');
  }
  quotRecalc();
}
function selectQuotItemSuggestion(el, encName, hsn, rate) {
  const row = el.closest('.quot-item-row');
  if (!row) return;
  row.querySelector('.qit-name').value = decodeURIComponent(encName);
  row.querySelector('.qit-hsn').value = hsn || '';
  row.querySelector('.qit-rate').value = rate || 0;
  row.querySelector('.solid-suggestion-box').style.display = 'none';
  quotRecalc();
}

function quotRecalc() {
  const rows = document.querySelectorAll('#quotItemsBody .quot-item-row');
  let totalNoGst = 0;
  rows.forEach(r => {
    const qty = Number(r.querySelector('.qit-qty').value) || 0;
    const rate = Number(r.querySelector('.qit-rate').value) || 0;
    const disc = Number(r.querySelector('.qit-disc').value) || 0;
    // GST FIX: product ka 'rate' GST-INCLUSIVE hota he (jaise 118), isliye pehle
    // discount GST-inclusive amount par lagao, fir usse 1.18 se divide karke
    // taxable (without-GST) base nikalo - taaki niche CGST/SGST dobara na lage.
    const lineInclusive = qty * rate * (1 - disc / 100);
    const lineTaxable = Math.round((lineInclusive / 1.18) * 100) / 100;
    totalNoGst += lineTaxable;
  });
  const svc = Number(document.getElementById('quotServiceCharge').value) || 0;
  const cgst = totalNoGst * 0.09, sgst = totalNoGst * 0.09;
  const grand = totalNoGst + cgst + sgst + svc;
  const roundOff = Math.round(grand) - grand;
  const final = Math.round(grand);
  const box = document.getElementById('quotTotalsBox');
  if (box) box.innerHTML = `
    <div style="display:flex; justify-content:space-between;"><span>Total Without GST</span><strong>₹${ttInr(totalNoGst)}</strong></div>
    <div style="display:flex; justify-content:space-between;"><span>CGST @ 9%</span><strong>₹${ttInr(cgst)}</strong></div>
    <div style="display:flex; justify-content:space-between;"><span>SGST @ 9%</span><strong>₹${ttInr(sgst)}</strong></div>
    <div style="display:flex; justify-content:space-between;"><span>Service &amp; Travel</span><strong>₹${ttInr(svc)}</strong></div>
    <div style="display:flex; justify-content:space-between;"><span>Round Off</span><strong>₹${ttInr(roundOff)}</strong></div>
    <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); margin-top:6px; padding-top:6px; font-size:15px;"><span>Total</span><strong style="color:var(--accent);">₹${final.toLocaleString('en-IN')}</strong></div>`;
  return { totalNoGst, cgst, sgst, svc, roundOff, final };
}

function quotNextId() {
  const d = new Date();
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const yy = String(d.getFullYear()).slice(-2);
  const seqKey = DB_PREFIX + 'QUOT_SEQ_' + mon + yy;
  let seq = Number(localStorage.getItem(seqKey) || '0') + 1;
  localStorage.setItem(seqKey, String(seq));
  return `QTN-${mon}-${yy}-${String(seq).padStart(3, '0')}`;
}

function buildQuotationHtmlLegacy(q) {
  const B = 'border:1px solid #000;';
  const cell = 'padding:3px 5px;vertical-align:top;';
  const meta = (l, v) => `<div style="${B}border-width:0 0 1px 1px;padding:2px 5px;min-height:28px;"><div style="font-size:9.5px;">${l}</div><div style="font-weight:700;font-size:11px;">${v || ''}</div></div>`;
  const itemRows = q.items.map((i, n) => `<tr>
    <td style="${cell}border-left:1px solid #000;text-align:center;">${n + 1}</td>
    <td style="${cell}border-left:1px solid #000;">${esc(i.name)}${(i.desc || i.specs) ? `<div style="font-size:7.5px;line-height:1.25;color:#333;margin-top:2px;white-space:pre-wrap;">${i.desc ? ttH(i.desc) : ''}${(i.desc && i.specs) ? '\n' : ''}${i.specs ? '<b>Technical:</b> ' + ttH(i.specs) : ''}</div>` : ''}</td>
    <td style="${cell}border-left:1px solid #000;text-align:center;">${esc(i.hsn)}</td>
    <td style="${cell}border-left:1px solid #000;text-align:center;">18</td>
    <td style="${cell}border-left:1px solid #000;text-align:center;">${i.qty}</td>
    <td style="${cell}border-left:1px solid #000;text-align:right;">${ttInr(i.rate)}</td>
    <td style="${cell}border-left:1px solid #000;text-align:center;">Nos</td>
    <td style="${cell}border-left:1px solid #000;text-align:center;">${i.disc} %</td>
    <td style="${cell}border-left:1px solid #000;border-right:1px solid #000;text-align:right;">₹${ttInr(i.amount)}</td></tr>`).join('');
  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11px;line-height:1.35;">
  <div style="${B}display:flex; justify-content:space-between; padding:6px 8px;"><strong style="font-size:15px;">QUOTATION</strong><span style="font-size:9.5px;">(ORIGINAL FOR RECIPIENT)</span></div>
  <div style="${B}border-top:0;">
    <div style="display:grid;grid-template-columns:1.25fr 1fr;">
      <div style="padding:5px 6px;border-bottom:1px solid #000;">
        <strong style="font-size:12.5px;">TWINTOWN EXPRESS SERVICES PVT LTD</strong><br>
        PLOT:1270/8566, SATYA VIHAR, RASHULGARH,<br>BHUBANESWAR-751010<br>
        Ph-8917465040 / 6743175599<br>GSTIN/UIN: 21AAICT6014E1ZT<br>State Name : Odisha, Code : 21<br>E-Mail : info@ttespl.com
      </div>
      <div style="border-left:1px solid #000;display:grid;grid-template-columns:1fr 1fr;">
        ${meta('Quotation No.', esc(q.id))}${meta('Dated', esc(q.date))}
        ${meta('Mode/Terms of Payment', esc(q.payMode))}${meta('Terms of Delivery', '100% Advance')}
      </div>
    </div>
    <div style="padding:5px 6px;border-top:1px solid #000;">
      <span style="font-size:9.5px;">Consignee / Buyer (Bill to)</span><br>
      <strong>${esc(q.custName)}</strong><br>${esc(q.custAddr || '')}<br>${q.custPhone ? 'Contact: ' + esc(q.custPhone) + '<br>' : ''}
      GSTIN/UIN : ${esc(q.custGst || 'Unregistered')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;border-top:1px solid #000;">
      <thead><tr style="text-align:center;">
        <th style="${B}${cell}width:24px;">SI No.</th><th style="${B}${cell}">Description of Goods</th><th style="${B}${cell}">HSN/SAC</th>
        <th style="${B}${cell}">GST Rate</th><th style="${B}${cell}">Qty.</th><th style="${B}${cell}">Rate</th>
        <th style="${B}${cell}">per</th><th style="${B}${cell}">Disc. %</th><th style="${B}${cell}">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;">
      <div></div>
      <div>
        <div style="display:flex;justify-content:space-between;padding:2px 6px;border-left:1px solid #000;"><span>Total Without GST</span><strong>₹${ttInr(q.totalNoGst)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:2px 6px;border-left:1px solid #000;border-top:1px solid #000;"><span>Out Put CGST @ 9%</span><strong>₹${ttInr(q.cgst)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:2px 6px;border-left:1px solid #000;border-top:1px solid #000;"><span>Out Put SGST @ 9%</span><strong>₹${ttInr(q.sgst)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:2px 6px;border-left:1px solid #000;border-top:1px solid #000;background:#eef4e8;"><span>Service &amp; travel charges</span><strong>₹${ttInr(q.svc)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:2px 6px;border-left:1px solid #000;border-top:1px solid #000;"><span>Round Off</span><strong>₹${ttInr(q.roundOff)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:4px 6px;border:1px solid #000;border-top:1px solid #000;font-weight:800;font-size:13px;"><span>Total</span><strong>₹${q.final.toLocaleString('en-IN')}</strong></div>
      </div>
    </div>
    <div style="padding:4px 6px;border-top:1px solid #000;">Amount (in words)<br><strong style="font-size:12px;">${ttWords(q.final)}</strong></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #000;">
      <div style="padding:5px 6px;font-size:10px;"><strong>Company's Bank Details</strong><br>A/c Name: TWINTOWN EXPRESS SERVICES PVT LTD<br>Bank Name: ICICI BANK (CUTTACK ROAD)<br>A/c No. &amp; IFSC: 150005501249 | ICIC0001500</div>
      <div style="padding:5px 6px;border-left:1px solid #000;text-align:right;font-size:10.5px;">for <strong>TWINTOWN EXPRESS SERVICES PVT LTD</strong><br><br><br>Authorised Signatory</div>
    </div>
    <div style="padding:5px 8px;border-top:1px solid #000;font-size:8.5px;line-height:1.35;page-break-inside:avoid;"><strong style="font-size:9.5px;"><u>Terms &amp; Conditions for Quotation</u></strong><ol style="margin:2px 0 0 14px;padding:0;"><li><b>Validity Period:</b> This quotation is valid for 30 days from the date of issue.</li><li><b>Payment Terms:</b> An advance payment of 50% is required to initiate the work. The remaining balance must be cleared prior to product delivery/installation.</li><li><b>Taxes:</b> All quoted prices are Exclusive of GST.</li><li><b>Scope of Work:</b> The quoted prices apply strictly to the items and services listed in this quotation. Any additional work or items requested later will incur extra charges.</li><li><b>Delivery &amp; Installation Time:</b> Delivery/installation will be completed within 15–30 days after receiving the advance payment.</li><li><b>Cancellation Policy:</b> The advance payment is non-refundable in the event of order cancellation after confirmation.</li></ol></div>
  </div>
  <div style="text-align:center;font-size:10px;margin-top:4px;">This is a Computer Generated Quotation</div>
</div>`;
}

function printQuotationLegacy() {
  const custName = document.getElementById('quotCustName').value.trim();
  if (!custName) { alert('Please enter the customer name'); return; }
  const rows = document.querySelectorAll('#quotItemsBody .quot-item-row');
  const items = Array.from(rows).map(r => {
    const qty = Number(r.querySelector('.qit-qty').value) || 0;
    const rate = Number(r.querySelector('.qit-rate').value) || 0;
    const disc = Number(r.querySelector('.qit-disc').value) || 0;
    // GST FIX: 'rate' GST-inclusive he, isliye print table ke "Amount" column me
    // bhi taxable (without-GST) value dikhana he - quotRecalc() ke totalNoGst ke
    // sath match karne ke liye, taaki neeche CGST/SGST dobara na lage.
    const lineInclusive = qty * rate * (1 - disc / 100);
    const lineTaxable = Math.round((lineInclusive / 1.18) * 100) / 100;
    return {
      name: r.querySelector('.qit-name').value.trim() || 'Item',
      hsn: r.querySelector('.qit-hsn').value.trim() || '-',
      qty, rate, disc, amount: lineTaxable,
      desc: r.dataset.desc || '', specs: r.dataset.specs || ''
    };
  }).filter(i => i.name);
  if (items.length === 0) { alert('Please add at least one item'); return; }
  const t = quotRecalc();
  const q = {
    id: quotNextId(),
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    custName, custPhone: document.getElementById('quotCustPhone').value.trim(),
    custAddr: document.getElementById('quotCustAddr').value.trim(),
    custGst: document.getElementById('quotCustGst').value.trim(),
    payMode: document.getElementById('quotPayMode').value.trim() || 'Cash/Online',
    items, totalNoGst: t.totalNoGst, cgst: t.cgst, sgst: t.sgst, svc: t.svc, roundOff: t.roundOff, final: t.final
  };
  // Record ek local history me rakhte hain (is device pe) taaki baad me dekha ja sake
  try {
    const key = DB_PREFIX + 'QUOTATIONS_HISTORY';
    const hist = JSON.parse(localStorage.getItem(key) || '[]');
    hist.unshift({ id: q.id, date: q.date, custName: q.custName, final: q.final });
    localStorage.setItem(key, JSON.stringify(hist.slice(0, 200)));
  } catch (e) { console.error('Quotation history save failed', e); }
  // NATIVE SHARE FIRST: mobile par seedha WhatsApp/Telegram/Email share sheet
  // khulta hai; agar wo available na ho ya fail ho jaye to purana Print/PDF
  // flow (ttPrintHtml) fallback ke roop me chalta hai - dono kaam karte hain.
  const itemsTxt = items.map(i => `${i.name} x${i.qty} - Rs.${i.amount.toFixed(2)}`).join('\n');
  const plainMsg = `TWIN TOWN EXPRESS SERVICES PVT LTD\nQuotation: ${q.id}\nCustomer: ${q.custName}\n-----------------------\n${itemsTxt}\n-----------------------\nTotal: Rs.${q.final}\n\nRasulgarh, Bhubaneswar`;
  ttNativeShareOrFallback(
    { title: `TTESPL Quotation ${q.id}`, text: plainMsg },
    function () { ttPrintHtml('Quotation ' + q.id, buildQuotationHtml(q)); }
  );
}
window.openQuotationModal = openQuotationModal;
