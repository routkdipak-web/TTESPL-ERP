/**
 * ============================================================================
 * TTESPL ERP - PREMIUM GLASSMORPHIC EXPANSION SUITE
 * ============================================================================
 * Features Included:
 * 1. Ultra-Glass UI & Top-Bar Brand Hub Integration
 * 2. Dynamic Partner Brand Master (Custom Logos, Descriptions, Multi-PDF Vault)
 * 3. 500MB+ Local PDF Catalog Engine (IndexedDB Blob Store - No Cloud Lag)
 * 4. Deep-Linked Customer Ledger History (Audits all past & live invoices)
 * 5. Deep-Linked Stock Item Sales History (Audits sold rates, quantities, clients)
 * 6. Auto-Injected WhatsApp Invoice & Follow-up Trigger in Ledger
 * 7. 7-Day Data Protection & Local Backup Warning Alert
 * ============================================================================
 */

(function () {
  'use strict';

  // ==========================================================================
  // SECTION 1: INDEXEDDB LOCAL STORAGE ENGINE (500MB+ PDF CATALOG SAFE)
  // ==========================================================================
  const StorageVault = {
    dbName: "TTESPL_CatalogEngine_v2",
    version: 1,

    async getDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, this.version);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("brands")) {
            db.createObjectStore("brands", { keyPath: "id", autoIncrement: true });
          }
          if (!db.objectStoreNames.contains("catalogs")) {
            const catStore = db.createObjectStore("catalogs", { keyPath: "id", autoIncrement: true });
            catStore.createIndex("brandId", "brandId", { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async getBrands() {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction("brands", "readonly");
        const req = tx.objectStore("brands").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    },

    async addBrand(brandObj) {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("brands", "readwrite");
        const req = tx.objectStore("brands").add(brandObj);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async deleteBrand(brandId) {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(["brands", "catalogs"], "readwrite");
        tx.objectStore("brands").delete(brandId);
        
        // Remove associated catalogs
        const catStore = tx.objectStore("catalogs");
        const index = catStore.index("brandId");
        const cursorReq = index.openCursor(IDBKeyRange.only(Number(brandId)));
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve();
      });
    },

    async savePDF(brandId, file) {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("catalogs", "readwrite");
        const entry = {
          brandId: Number(brandId),
          name: file.name,
          size: file.size,
          blob: file,
          date: new Date().toISOString()
        };
        const req = tx.objectStore("catalogs").add(entry);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async getPDFs(brandId) {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction("catalogs", "readonly");
        const index = tx.objectStore("catalogs").index("brandId");
        const req = index.getAll(IDBKeyRange.only(Number(brandId)));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    },

    async deletePDF(catId) {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction("catalogs", "readwrite");
        tx.objectStore("catalogs").delete(catId);
        tx.oncomplete = () => resolve();
      });
    }
  };

  // ==========================================================================
  // SECTION 2: GLOBAL TRANSACTION DATA AGGREGATOR (PAST & LIVE BILLING)
  // ==========================================================================
  function fetchAllLedgerTransactions() {
    let dataset = [];

    // 1. Direct App Memory Stores
    if (window.appData && Array.isArray(window.appData.invoices)) dataset.push(...window.appData.invoices);
    if (window.invoices && Array.isArray(window.invoices)) dataset.push(...window.invoices);
    if (window.orders && Array.isArray(window.orders)) dataset.push(...window.orders);
    if (window.salesData && Array.isArray(window.salesData)) dataset.push(...window.salesData);
    if (window.deliveredInvoices && Array.isArray(window.deliveredInvoices)) dataset.push(...window.deliveredInvoices);

    // 2. LocalStorage Persistence Fallback
    const persistentKeys = [
      "ttespl_invoices", "invoices", "orders", "tax_invoices",
      "appData_invoices", "delivered_orders", "ledger_records"
    ];
    persistentKeys.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) dataset.push(...parsed);
          else if (parsed && Array.isArray(parsed.invoices)) dataset.push(...parsed.invoices);
        }
      } catch (err) {}
    });

    // Deduplicate by invoice ID / order number
    const unique = [];
    const seen = new Set();
    dataset.forEach(item => {
      const uid = item.invoiceNo || item.invNo || item.orderId || item.id || (item.customerName + item.date + item.totalAmount);
      if (uid && !seen.has(uid)) {
        seen.add(uid);
        unique.push(item);
      }
    });

    return unique;
  }

  // ==========================================================================
  // SECTION 3: PREMIUM GLASSMORPHIC UI STYLING
  // ==========================================================================
  (function injectStyles() {
    const css = `
      /* Header Brands Button */
      .glass-brand-action {
        background: rgba(15, 23, 42, 0.45) !important;
        backdrop-filter: blur(14px) !important;
        -webkit-backdrop-filter: blur(14px) !important;
        border: 1px solid rgba(255, 255, 255, 0.22) !important;
        border-radius: 12px !important;
        color: #ffffff !important;
        padding: 7px 14px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        cursor: pointer !important;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.25) !important;
        transition: transform 0.15s ease, background 0.2s ease !important;
      }
      .glass-brand-action:active {
        transform: scale(0.96) !important;
      }

      /* Modal Overlay & Container */
      .glass-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        font-family: inherit;
      }
      .glass-window {
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.85);
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
        width: 100%;
        max-width: 740px;
        max-height: 88vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: glassPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes glassPop {
        from { opacity: 0; transform: scale(0.92) translateY(12px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }

      /* Buttons & Chips */
      .patch-chip-btn {
        background: rgba(2, 132, 199, 0.1) !important;
        border: 1px solid rgba(2, 132, 199, 0.35) !important;
        color: #0284c7 !important;
        padding: 6px 12px !important;
        border-radius: 9px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        transition: all 0.15s ease !important;
      }
      .patch-chip-btn:active {
        background: rgba(2, 132, 199, 0.22) !important;
        transform: scale(0.96) !important;
      }
      .patch-wa-btn {
        background: #25d366 !important;
        color: #ffffff !important;
        border: none !important;
        padding: 6px 12px !important;
        border-radius: 9px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        cursor: pointer !important;
        box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3) !important;
        transition: transform 0.15s ease !important;
      }
      .patch-wa-btn:active {
        transform: scale(0.96) !important;
      }
    `;
    const styleEl = document.createElement("style");
    styleEl.innerHTML = css;
    document.head.appendChild(styleEl);
  })();

  // ==========================================================================
  // SECTION 4: HEADER BRAND BUTTON MOUNTING
  // ==========================================================================
  function mountHeaderBrandButton() {
    // Purane hardcoded dropdowns ko replace karna
    document.querySelectorAll(".brand-dropdown-wrapper, [data-old-brand-menu]").forEach(e => e.remove());
    if (document.getElementById("btnOpenGlassBrandVault")) return;

    const brandBtn = document.createElement("button");
    brandBtn.id = "btnOpenGlassBrandVault";
    brandBtn.type = "button";
    brandBtn.className = "glass-brand-action";
    brandBtn.innerHTML = `<span>🏢</span> <span>Brands</span>`;
    brandBtn.onclick = () => window.openBrandHubModal();

    const header = document.querySelector("header") || 
                   document.querySelector(".navbar") || 
                   document.querySelector(".top-bar");

    if (header) {
      header.appendChild(brandBtn);
    } else {
      brandBtn.style.position = "fixed";
      brandBtn.style.top = "12px";
      brandBtn.style.right = "12px";
      brandBtn.style.zIndex = "9999";
      document.body.appendChild(brandBtn);
    }
  }

  // ==========================================================================
  // SECTION 5: DYNAMIC BRAND HUB (ADD COMPANIES & MULTI-PDF VAULT)
  // ==========================================================================
  window.openBrandHubModal = async function () {
    let overlay = document.getElementById("glassBrandModalRoot");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "glassBrandModalRoot";
      overlay.className = "glass-overlay";
      document.body.appendChild(overlay);
    }

    const brandList = await StorageVault.getBrands();

    overlay.innerHTML = `
      <div class="glass-window">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 8px;">
            <span>🏢</span> Partner Brands & Catalog Vault
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button onclick="promptCreateBrand()" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(2,132,199,0.35);">
              + Add Company
            </button>
            <button onclick="document.getElementById('glassBrandModalRoot').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:24px; cursor:pointer;">&times;</button>
          </div>
        </div>

        <div style="padding: 18px; overflow-y: auto; flex: 1;">
          ${brandList.length === 0 ? `
            <div style="text-align: center; padding: 45px 20px; border: 2px dashed #cbd5e1; border-radius: 16px; background: rgba(248, 250, 252, 0.7);">
              <div style="font-size: 34px; margin-bottom: 8px;">📂</div>
              <div style="font-weight: 600; color: #334155; font-size: 15px;">No Companies Added Yet</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Upar "+ Add Company" par click karein aur apna brand, logo aur local PDF catalogs set karein.</div>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
              ${brandList.map(b => `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; box-shadow: 0 6px 16px rgba(0,0,0,0.03); display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                      <img src="${b.logo || 'https://via.placeholder.com/60?text=Brand'}" style="width: 48px; height: 48px; border-radius: 12px; object-fit: cover; border: 1px solid #e2e8f0; background: #f8fafc;" />
                      <div>
                        <div style="font-weight: 700; font-size: 15px; color: #0f172a;">${b.name}</div>
                        <div style="font-size: 11px; color: #64748b;">${new Date(b.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style="font-size: 12px; color: #475569; line-height: 1.4; max-height: 48px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 12px;">
                      ${b.description || 'No description added.'}
                    </div>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 10px;">
                    <button onclick="openBrandVault(${b.id})" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
                      📚 Catalogs
                    </button>
                    <button onclick="removeBrandRecord(${b.id})" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer;">
                      Delete
                    </button>
                  </div>
                </div>
              `).join("")}
            </div>
          `}
        </div>
      </div>
    `;
    overlay.style.display = "flex";
  };

  window.promptCreateBrand = function () {
    const name = prompt("Company / Brand Name:");
    if (!name) return;
    const logo = prompt("Brand Logo URL (Image link ya blank chhodein):", "") || ("https://via.placeholder.com/80?text=" + encodeURIComponent(name.slice(0, 2).toUpperCase()));
    const description = prompt("Brand Description / Overview:", "") || "";

    StorageVault.addBrand({
      name,
      logo,
      description,
      createdAt: new Date().toISOString()
    }).then(() => {
      window.openBrandHubModal();
    });
  };

  window.removeBrandRecord = function (id) {
    if (confirm("Is brand aur iske sabhi local catalogs ko delete karein?")) {
      StorageVault.deleteBrand(id).then(() => window.openBrandHubModal());
    }
  };

  // View Multi PDFs inside a Brand
  window.openBrandVault = async function (brandId) {
    const brandList = await StorageVault.getBrands();
    const brand = brandList.find(b => b.id === brandId);
    if (!brand) return;

    const pdfList = await StorageVault.getPDFs(brandId);
    const overlay = document.getElementById("glassBrandModalRoot");

    overlay.innerHTML = `
      <div class="glass-window">
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button onclick="window.openBrandHubModal()" style="background: rgba(255,255,255,0.15); border: none; color: #fff; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 13px;">← Back</button>
            <div style="font-weight: 700; font-size: 15px;">${brand.name} - Catalogs</div>
          </div>
          <button onclick="document.getElementById('glassBrandModalRoot').style.display='none'" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">&times;</button>
        </div>

        <div style="padding: 16px; overflow-y: auto; flex: 1;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 16px; display: flex; gap: 12px; align-items: center;">
            <img src="${brand.logo}" style="width: 50px; height: 50px; border-radius: 10px; object-fit: cover;" />
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #0f172a;">${brand.name}</div>
              <div style="font-size: 12px; color: #64748b;">${brand.description}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-weight: 700; font-size: 13px; color: #1e293b;">Local PDF Catalogs (Up to 500MB+)</div>
            <label style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(2,132,199,0.3);">
              + Upload PDF
              <input type="file" accept="application/pdf" multiple style="display:none;" onchange="uploadPDFBatch(${brandId}, this)">
            </label>
          </div>

          <div style="display: grid; gap: 10px;">
            ${pdfList.length === 0 ? `
              <div style="text-align: center; padding: 30px; border: 1px dashed #cbd5e1; border-radius: 12px; color: #94a3b8; font-size: 13px;">
                Abhi tak koi PDF catalog upload nahi kiya gaya. "+ Upload PDF" se add karein.
              </div>
            ` : pdfList.map(p => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
                <div style="overflow: hidden; padding-right: 12px;">
                  <div style="font-weight: 600; font-size: 13px; color: #0f172a; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${p.name}</div>
                  <div style="font-size: 11px; color: #64748b;">${(p.size / (1024 * 1024)).toFixed(1)} MB • ${new Date(p.date).toLocaleDateString()}</div>
                </div>
                <div style="display: flex; gap: 6px; flex-shrink: 0;">
                  <button onclick="streamLocalBlob(${p.id})" style="background: #10b981; color: #fff; border: none; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;">Open</button>
                  <button onclick="deleteLocalBlob(${p.id},${brandId})" style="background: #ef4444; color: #fff; border: none; padding: 6px 10px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;">✕</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  };

  window.uploadPDFBatch = async function (brandId, input) {
    if (input.files && input.files.length) {
      for (let i = 0; i < input.files.length; i++) {
        await StorageVault.savePDF(brandId, input.files[i]);
      }
      window.openBrandVault(brandId);
    }
  };

  window.streamLocalBlob = async function (id) {
    const db = await StorageVault.getDB();
    const tx = db.transaction("catalogs", "readonly");
    const req = tx.objectStore("catalogs").get(id);
    req.onsuccess = () => {
      if (req.result && req.result.blob) {
        const url = URL.createObjectURL(req.result.blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 180000); // 3 minutes buffer
      }
    };
  };

  window.deleteLocalBlob = async function (id, brandId) {
    if (confirm("Delete this catalog file?")) {
      await StorageVault.deletePDF(id);
      window.openBrandVault(brandId);
    }
  };

  // ==========================================================================
  // SECTION 6: CUSTOMER & ITEM MASTER SALES HISTORY VIEWS
  // ==========================================================================
  window.openCustomerHistoryView = function (custName) {
    let overlay = document.getElementById("glassHistoryModalRoot");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "glassHistoryModalRoot";
      overlay.className = "glass-overlay";
      document.body.appendChild(overlay);
    }

    const allRecords = fetchAllLedgerTransactions();
    const cleanQuery = custName.trim().toLowerCase();

    // Past aur live transactions filter karna
    const customerBills = allRecords.filter(item => {
      const target = (item.customerName || item.clientName || item.partyName || item.name || "").toLowerCase();
      return target.includes(cleanQuery) || cleanQuery.includes(target);
    });

    overlay.innerHTML = `
      <div class="glass-window">
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 15px;">📜 Customer Ledger History</div>
            <div style="font-size: 12px; color: #94a3b8;">${custName}</div>
          </div>
          <button onclick="document.getElementById('glassHistoryModalRoot').style.display='none'" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">&times;</button>
        </div>

        <div style="padding: 16px; overflow-y: auto; max-height: 70vh;">
          ${customerBills.length === 0 ? `
            <div style="text-align: center; padding: 30px; color: #64748b; font-size: 13px;">
              Is client ke liye ledger me koi purana bill record match nahi hua.
            </div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="background: #f1f5f9; color: #475569; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 8px;">Date</th>
                  <th style="padding: 8px;">Invoice / Order #</th>
                  <th style="padding: 8px;">Total Billed</th>
                  <th style="padding: 8px;">Received</th>
                  <th style="padding: 8px;">Due</th>
                </tr>
              </thead>
              <tbody>
                ${customerBills.map(b => {
                  const total = Number(b.totalAmount || b.total || b.amount || 0);
                  const received = Number(b.paidAmount || b.received || 0);
                  const due = Number(b.dueAmount || b.due || (total - received) || 0);
                  const date = b.date || b.deliveryDate || b.createdAt || "-";
                  const invNo = b.invoiceNo || b.invNo || b.orderId || b.id || "-";
                  return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 8px;">${date}</td>
                      <td style="padding: 8px; font-weight: 600; color: #0284c7;">${invNo}</td>
                      <td style="padding: 8px; font-weight: 600;">₹${total.toLocaleString('en-IN')}</td>
                      <td style="padding: 8px; color: #16a34a;">₹${received.toLocaleString('en-IN')}</td>
                      <td style="padding: 8px;">
                        <span style="background: ${due > 0 ? '#fee2e2' : '#dcfce7'}; color: ${due > 0 ? '#b91c1c' : '#15803d'}; padding: 2px 7px; border-radius: 4px; font-weight: 600;">
                          ${due > 0 ? '₹' + due.toLocaleString('en-IN') : 'Settled'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
    overlay.style.display = "flex";
  };

  window.openItemSalesHistoryView = function (itemName) {
    let overlay = document.getElementById("glassHistoryModalRoot");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "glassHistoryModalRoot";
      overlay.className = "glass-overlay";
      document.body.appendChild(overlay);
    }

    const allRecords = fetchAllLedgerTransactions();
    const cleanItem = itemName.trim().toLowerCase();
    const salesLog = [];

    // Har invoice ke line items traverse karna
    allRecords.forEach(bill => {
      const items = bill.items || bill.products || bill.lineItems || [];
      items.forEach(it => {
        const target = (it.name || it.itemName || it.title || "").toLowerCase();
        if (target.includes(cleanItem) || cleanItem.includes(target)) {
          salesLog.push({
            date: bill.date || bill.deliveryDate || bill.createdAt || "-",
            invoiceNo: bill.invoiceNo || bill.orderId || "-",
            customerName: bill.customerName || bill.clientName || "Direct Walk-in",
            qty: it.qty || it.quantity || 1,
            soldRate: it.rate || it.price || it.unitPrice || 0
          });
        }
      });
    });

    overlay.innerHTML = `
      <div class="glass-window">
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 15px;">📊 Item Sales Transaction History</div>
            <div style="font-size: 12px; color: #94a3b8;">${itemName}</div>
          </div>
          <button onclick="document.getElementById('glassHistoryModalRoot').style.display='none'" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">&times;</button>
        </div>

        <div style="padding: 16px; overflow-y: auto; max-height: 70vh;">
          ${salesLog.length === 0 ? `
            <div style="text-align: center; padding: 30px; color: #64748b; font-size: 13px;">
              Is product ke liye past invoices me koi line-item transaction match nahi hua.
            </div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="background: #f1f5f9; color: #475569; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 8px;">Date</th>
                  <th style="padding: 8px;">Sold To (Client)</th>
                  <th style="padding: 8px;">Qty</th>
                  <th style="padding: 8px;">Sold Rate (₹)</th>
                  <th style="padding: 8px;">Inv Ref</th>
                </tr>
              </thead>
              <tbody>
                ${salesLog.map(row => `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px;">${row.date}</td>
                    <td style="padding: 8px; font-weight: 600; color: #0f172a;">${row.customerName}</td>
                    <td style="padding: 8px;">${row.qty}</td>
                    <td style="padding: 8px; color: #0284c7; font-weight: 600;">₹${Number(row.soldRate).toLocaleString('en-IN')}</td>
                    <td style="padding: 8px; font-size: 11px; color: #64748b;">${row.invoiceNo}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
    overlay.style.display = "flex";
  };

  // ==========================================================================
  // SECTION 7: AUTO-ATTACH ENGINE (CARDS, LEDGER & WHATSAPP)
  // ==========================================================================
  setInterval(function scanAndAttachUI() {
    mountHeaderBrandButton();

    // 1. Customer Cards: Attach History Button
    document.querySelectorAll('.card, [class*="client"], [class*="customer"]').forEach(card => {
      if (card.querySelector(".btn-injected-cust-hist")) return;
      const editBtn = card.querySelector("button, .btn, [onclick*='edit'], [onclick*='Edit']");
      const nameEl = card.querySelector("h3, h4, strong, .name, [class*='name']");
      if (nameEl && editBtn) {
        const custName = nameEl.innerText.trim();
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "patch-chip-btn btn-injected-cust-hist";
        btn.innerHTML = "📜 History";
        btn.onclick = (e) => {
          e.stopPropagation();
          window.openCustomerHistoryView(custName);
        };
        editBtn.parentNode.insertBefore(btn, editBtn);
      }
    });

    // 2. Product / Stock Item Cards: Attach History Button
    document.querySelectorAll('.stock-item, .item-card, [class*="product"], [class*="item"]').forEach(card => {
      if (card.querySelector(".btn-injected-item-hist")) return;
      const shareBtn = card.querySelector("button, .btn, [onclick*='share'], [onclick*='Share']");
      const nameEl = card.querySelector("h3, h4, strong, .title, [class*='title']");
      if (nameEl && shareBtn) {
        const itemName = nameEl.innerText.trim();
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "patch-chip-btn btn-injected-item-hist";
        btn.innerHTML = "📊 History";
        btn.onclick = (e) => {
          e.stopPropagation();
          window.openItemSalesHistoryView(itemName);
        };
        shareBtn.parentNode.insertBefore(btn, shareBtn);
      }
    });

    // 3. Ledger Cards: Attach WhatsApp Share Button
    document.querySelectorAll('[class*="invoice"], [class*="ledger"], .card, tr').forEach(card => {
      if (card.querySelector(".btn-injected-ledger-wa")) return;
      const followBtn = card.querySelector("[onclick*='follow'], [onclick*='Follow'], [onclick*='collect'], [onclick*='Collect'], [onclick*='Invoice']");
      const phoneEl = card.querySelector("[href^='tel:'], [data-phone]");
      const nameEl = card.querySelector("h3, h4, strong, .name");

      if (followBtn) {
        const phone = phoneEl ? phoneEl.innerText.replace(/\D/g, "") : "";
        const clientName = nameEl ? nameEl.innerText.trim() : "Client";
        
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "patch-wa-btn btn-injected-ledger-wa";
        btn.innerHTML = "<span>💬</span> WhatsApp";
        btn.onclick = (e) => {
          e.stopPropagation();
          const text = encodeURIComponent(`Namaste ${clientName}! Twin Town Express Services Pvt. Ltd. se aapka statement / tax invoice reference share kiya ja raha hai. Kripya check karein.`);
          const target = phone.length >= 10 
            ? `https://api.whatsapp.com/send?phone=91${phone.slice(-10)}&text=${text}`
            : `https://api.whatsapp.com/send?text=${text}`;
          window.open(target, "_blank");
        };
        followBtn.parentNode.appendChild(btn);
      }
    });
  }, 1000);

  // ==========================================================================
  // SECTION 8: 7-DAY LOCAL DATA BACKUP INTEGRITY MONITOR
  // ==========================================================================
  (function runBackupAuditor() {
    const lastBackup = localStorage.getItem("ttespl_last_backup_audit");
    const now = Date.now();
    const interval = 7 * 24 * 60 * 60 * 1000; // 7 Days

    if (!lastBackup || now - parseInt(lastBackup) > interval) {
      setTimeout(() => {
        const alertBox = document.createElement("div");
        alertBox.style.cssText = `
          position: fixed; bottom: 24px; right: 24px;
          background: rgba(254, 243, 199, 0.95);
          backdrop-filter: blur(14px);
          border: 1px solid #f59e0b;
          color: #92400e;
          padding: 14px 18px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          z-index: 999999;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 12px;
        `;
        alertBox.innerHTML = `
          <div>⚠️ <strong>Backup Alert:</strong> It has been more than 7 days since your last offline/local backup.</div>
          <button id="btnDismissBackupAudit" style="background:#f59e0b; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">Dismiss</button>
        `;
        document.body.appendChild(alertBox);
        document.getElementById("btnDismissBackupAudit").onclick = () => {
          localStorage.setItem("ttespl_last_backup_audit", now.toString());
          alertBox.remove();
        };
      }, 3000);
    }
  })();

})();
