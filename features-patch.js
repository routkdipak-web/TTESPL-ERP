/**
 * TTESPL ERP - All-In-One Features Patch
 * (Automatically injects Brand menu into header + handles PDF Catalogs, History, WhatsApp, Backup)
 */

// ==============================================================
// 1. AUTO-INJECT BRAND MENU & STYLES INTO HEADER
// ==============================================================
(function injectBrandHeader() {
  // CSS styles inject karna
  const style = document.createElement("style");
  style.innerHTML = `
    .brand-dropdown-wrapper {
      position: relative;
      display: inline-block;
      margin-right: 12px;
      font-family: inherit;
    }
    .brand-btn {
      background: #0f172a;
      color: #ffffff;
      border: 1px solid #334155;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .brand-btn:hover {
      background: #1e293b;
    }
    .brand-dropdown-menu {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      background: #ffffff;
      min-width: 250px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      border-radius: 8px;
      overflow: hidden;
      z-index: 10000;
      border: 1px solid #e2e8f0;
    }
    .brand-dropdown-wrapper:hover .brand-dropdown-menu {
      display: block;
    }
    .brand-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      text-decoration: none;
      color: #0f172a;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
      transition: background 0.15s;
    }
    .brand-item:hover {
      background: #f8fafc;
    }
  `;
  document.head.appendChild(style);

  // Brand dropdown element banana
  const brandWrapper = document.createElement("div");
  brandWrapper.className = "brand-dropdown-wrapper";
  brandWrapper.innerHTML = `
    <button type="button" class="brand-btn">
      <span>🏢 Brands</span> <span style="font-size:10px;">▼</span>
    </button>
    <div class="brand-dropdown-menu">
      <div class="brand-item" onclick="openBrandModal('man_diesel', 'MAN Diesel & Turbo', 'Authorized dealer & service partner for heavy industrial & marine diesel cleaning and pump equipment.')">
        <span style="font-size:20px;">⚙️</span>
        <div>
          <div style="font-weight:600; font-size:13px;">MAN Diesel</div>
          <div style="font-size:11px; color:#64748b;">Industrial & Pumps</div>
        </div>
      </div>
      <div class="brand-item" onclick="openBrandModal('annovi_reverberi', 'Annovi Reverberi (AR)', 'High pressure plunger pumps, triplex car wash pumps and spares catalog.')">
        <span style="font-size:20px;">💧</span>
        <div>
          <div style="font-weight:600; font-size:13px;">Annovi Reverberi</div>
          <div style="font-size:11px; color:#64748b;">Plunger Pumps</div>
        </div>
      </div>
    </div>
  `;

  // Page load hone par Header me add karna
  window.addEventListener("DOMContentLoaded", () => {
    // Header dhoondna (header tag, navbar, ya body me fallback)
    const header = document.querySelector("header") || 
                   document.querySelector(".navbar") || 
                   document.querySelector(".top-bar") || 
                   document.querySelector("#header");

    if (header) {
      header.appendChild(brandWrapper);
    } else {
      // Agar header tag na mile toh top right corner me fix kar dega
      brandWrapper.style.position = "fixed";
      brandWrapper.style.top = "12px";
      brandWrapper.style.right = "16px";
      brandWrapper.style.zIndex = "9999";
      document.body.appendChild(brandWrapper);
    }
  });
})();


// ==============================================================
// 2. BRAND SHOWCASE & LOCAL PDF CATALOG (IndexedDB 250MB Safe)
// ==============================================================
const BrandCatalogDB = {
  dbName: "TTESPL_CatalogDB",
  storeName: "brand_catalogs",

  async getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id", autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async savePDF(brandKey, file) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const record = {
        brand: brandKey,
        name: file.name,
        size: file.size,
        blob: file,
        uploadedAt: new Date().toISOString()
      };
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getPDFs(brandKey) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []).filter(item => item.brand === brandKey);
        resolve(records);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async deletePDF(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

window.openBrandModal = function(brandKey, brandTitle, brandInfo) {
  let modal = document.getElementById("brandCatalogModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "brandCatalogModal";
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.65);
      display: flex; align-items: center; justify-content: center; z-index: 999999;
      font-family: inherit;
    `;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:#fff; width:92%; max-width:850px; max-height:90vh; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 12px 35px rgba(0,0,0,0.3);">
      <div style="background:#0f172a; color:#fff; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:17px; font-weight:600;">${brandTitle} - Catalog & Details</h3>
        <button onclick="document.getElementById('brandCatalogModal').style.display='none'" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding:20px; overflow-y:auto; flex:1;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:20px;">
          <h4 style="margin:0 0 6px 0; color:#1e293b; font-size:14px;">Brand Overview</h4>
          <p style="margin:0; color:#475569; font-size:13px; line-height:1.5;">${brandInfo}</p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="margin:0; color:#1e293b; font-size:14px;">Local Catalogs (Offline / Fast Local Access)</h4>
          <label style="background:#0284c7; color:#fff; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;">
            + Upload PDF (Up to 250MB)
            <input type="file" accept="application/pdf" style="display:none;" onchange="handleCatalogUpload('${brandKey}', this)">
          </label>
        </div>

        <div id="catalogList" style="display:grid; gap:10px;">Loading catalogs...</div>
      </div>
    </div>
  `;
  modal.style.display = "flex";
  loadBrandCatalogs(brandKey);
};

window.handleCatalogUpload = async function(brandKey, input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    await BrandCatalogDB.savePDF(brandKey, file);
    loadBrandCatalogs(brandKey);
  }
};

window.loadBrandCatalogs = async function(brandKey) {
  const container = document.getElementById("catalogList");
  if (!container) return;
  const list = await BrandCatalogDB.getPDFs(brandKey);

  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:24px; color:#94a3b8; font-size:13px; border:1px dashed #cbd5e1; border-radius:8px;">No local PDFs uploaded yet. Tap "+ Upload PDF" to save catalogs locally.</div>`;
    return;
  }

  container.innerHTML = list.map(item => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border:1px solid #e2e8f0; border-radius:8px; background:#fff;">
      <div>
        <div style="font-weight:600; color:#0f172a; font-size:14px;">${item.name}</div>
        <div style="font-size:12px; color:#64748b;">${(item.size / (1024 * 1024)).toFixed(2)} MB • Added: ${new Date(item.uploadedAt).toLocaleDateString()}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button onclick="viewLocalPDF(${item.id})" style="background:#10b981; color:#fff; border:none; padding:6px 12px; border-radius:5px; cursor:pointer; font-size:13px; font-weight:600;">Open PDF</button>
        <button onclick="deleteCatalogPDF(${item.id}, '${brandKey}')" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:5px; cursor:pointer; font-size:13px;">Delete</button>
      </div>
    </div>
  `).join("");
};

window.viewLocalPDF = async function(id) {
  const db = await BrandCatalogDB.getDB();
  const tx = db.transaction(BrandCatalogDB.storeName, "readonly");
  const req = tx.objectStore(BrandCatalogDB.storeName).get(id);
  req.onsuccess = () => {
    if (req.result && req.result.blob) {
      const blobUrl = URL.createObjectURL(req.result.blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    }
  };
};

window.deleteCatalogPDF = async function(id, brandKey) {
  if (confirm("Are you sure you want to remove this PDF?")) {
    await BrandCatalogDB.deletePDF(id);
    loadBrandCatalogs(brandKey);
  }
};


// ==============================================================
// 3. MASTER DATA: CUSTOMER HISTORY MODAL
// ==============================================================
window.showCustomerHistoryModal = function(customerId, customerName, salesRecords) {
  const filtered = (salesRecords || []).filter(r => r.customerId === customerId || r.customerName === customerName);
  
  let modal = document.getElementById("historyModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "historyModal";
    modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; z-index:999999; font-family:inherit;";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:#fff; width:92%; max-width:720px; max-height:85vh; border-radius:10px; overflow:hidden; display:flex; flex-direction:column;">
      <div style="background:#0f172a; color:#fff; padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
        <h4 style="margin:0; font-size:16px;">Orders & Payment Timeline: ${customerName}</h4>
        <button onclick="document.getElementById('historyModal').style.display='none'" style="background:none; border:none; color:#fff; font-size:22px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding:16px; overflow-y:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; color:#334155;">
              <th style="padding:8px;">Date</th>
              <th style="padding:8px;">Inv / Ref #</th>
              <th style="padding:8px;">Total (₹)</th>
              <th style="padding:8px;">Paid (₹)</th>
              <th style="padding:8px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length ? filtered.map(row => `
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px;">${row.date || "-"}</td>
                <td style="padding:8px; font-weight:600;">${row.invoiceNo || "-"}</td>
                <td style="padding:8px;">₹${row.totalAmount || 0}</td>
                <td style="padding:8px;">₹${row.paidAmount || 0}</td>
                <td style="padding:8px;"><span style="padding:2px 8px; border-radius:4px; font-size:11px; background:${(row.dueAmount > 0) ? '#fee2e2; color:#b91c1c' : '#dcfce7; color:#15803d'}">${(row.dueAmount > 0) ? 'Pending' : 'Settled'}</span></td>
              </tr>
            `).join("") : '<tr><td colspan="5" style="text-align:center; padding:16px; color:#94a3b8;">No records found for this customer.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
  modal.style.display = "flex";
};


// ==============================================================
// 4. MASTER DATA: ITEM SALES HISTORY MODAL
// ==============================================================
window.showItemSalesHistoryModal = function(itemId, itemName, invoiceItemsRecords) {
  const filtered = (invoiceItemsRecords || []).filter(item => item.itemId === itemId || item.name === itemName);

  let modal = document.getElementById("itemHistoryModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "itemHistoryModal";
    modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; z-index:999999; font-family:inherit;";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:#fff; width:92%; max-width:720px; max-height:85vh; border-radius:10px; overflow:hidden; display:flex; flex-direction:column;">
      <div style="background:#0f172a; color:#fff; padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
        <h4 style="margin:0; font-size:16px;">Sales History: ${itemName}</h4>
        <button onclick="document.getElementById('itemHistoryModal').style.display='none'" style="background:none; border:none; color:#fff; font-size:22px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding:16px; overflow-y:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; color:#334155;">
              <th style="padding:8px;">Date</th>
              <th style="padding:8px;">Sold To Customer</th>
              <th style="padding:8px;">Qty</th>
              <th style="padding:8px;">Sold Rate (₹)</th>
              <th style="padding:8px;">Inv #</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length ? filtered.map(row => `
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px;">${row.date || "-"}</td>
                <td style="padding:8px; font-weight:600;">${row.customerName || "-"}</td>
                <td style="padding:8px;">${row.qty || 1}</td>
                <td style="padding:8px; font-weight:600; color:#0284c7;">₹${row.soldRate || row.price}</td>
                <td style="padding:8px;">${row.invoiceNo || "-"}</td>
              </tr>
            `).join("") : '<tr><td colspan="5" style="text-align:center; padding:16px; color:#94a3b8;">No sales history found for this item.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
  modal.style.display = "flex";
};


// ==============================================================
// 5. DIRECT WHATSAPP SHARING (PDF + LOCAL DOWNLOAD)
// ==============================================================
window.shareViaWhatsApp = function({ phone, pdfBlob, fileName, textSummary }) {
  const cleanPhone = (phone || "").replace(/\D/g, "");
  const encodedText = encodeURIComponent(textSummary || "Document from Twin Town Express Services.");

  // Web Share API support (Mobile me direct file attach ho sakti hai)
  if (navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], fileName, { type: "application/pdf" })] })) {
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });
    navigator.share({
      files: [file],
      title: fileName,
      text: textSummary
    }).catch(err => console.log("Share skipped", err));
    return;
  }

  // Fallback: Local download trigger + Open WhatsApp
  const blobUrl = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  const waUrl = cleanPhone 
    ? `https://api.whatsapp.com/send?phone=91${cleanPhone.slice(-10)}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(waUrl, "_blank");
};


// ==============================================================
// 6. 7-DAY BACKUP REMINDER
// ==============================================================
(function initAutomatedReminders() {
  const lastBackup = localStorage.getItem("last_erp_backup_date");
  const now = new Date().getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (!lastBackup || now - parseInt(lastBackup) > sevenDays) {
    setTimeout(() => {
      const banner = document.createElement("div");
      banner.style.cssText = "position:fixed; bottom:20px; right:20px; background:#fef3c7; border:1px solid #f59e0b; color:#92400e; padding:14px 18px; border-radius:8px; box-shadow:0 4px 14px rgba(0,0,0,0.15); z-index:999999; font-family:inherit; display:flex; gap:12px; align-items:center;";
      banner.innerHTML = `
        <div>⚠️ <strong>Backup Alert:</strong> 7 days se zyada ho gaye hain last backup liye hue.</div>
        <button id="dismissBackup" style="background:#f59e0b; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:600;">Dismiss</button>
      `;
      document.body.appendChild(banner);
      document.getElementById("dismissBackup").onclick = () => {
        localStorage.setItem("last_erp_backup_date", now.toString());
        banner.remove();
      };
    }, 2500);
  }
})();
