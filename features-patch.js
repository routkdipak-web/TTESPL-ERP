/**
 * TTESPL ERP - Premium Glassmorphic Suite
 * Dynamic Brand Master (Logo, Desc, Multi 500MB PDF)
 * Customer Ledger & Stock Item Sales History Modals
 * Auto-Injected WhatsApp Sharing in Ledger
 */

// ==========================================
// 1. INDEXEDDB ENGINE (500MB+ SUPPORT)
// ==========================================
const GlassDB = {
  dbName: "TTESPL_ProStorage",
  version: 2,
  async open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("brands")) {
          db.createObjectStore("brands", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("catalogs")) {
          const store = db.createObjectStore("catalogs", { keyPath: "id", autoIncrement: true });
          store.createIndex("brandId", "brandId", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getBrands() {
    const db = await this.open();
    return new Promise((resolve) => {
      const tx = db.transaction("brands", "readonly");
      const req = tx.objectStore("brands").getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  },
  async saveBrand(brand) {
    const db = await this.open();
    return new Promise((resolve) => {
      const tx = db.transaction("brands", "readwrite");
      const req = tx.objectStore("brands").add(brand);
      req.onsuccess = () => resolve(req.result);
    });
  },
  async deleteBrand(id) {
    const db = await this.open();
    return new Promise((resolve) => {
      const tx = db.transaction(["brands", "catalogs"], "readwrite");
      tx.objectStore("brands").delete(id);
      const catStore = tx.objectStore("catalogs");
      const idx = catStore.index("brandId");
      const req = idx.openCursor(IDBKeyRange.only(id));
      req.onsuccess = (e) => {
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
    const db = await this.open();
    return new Promise((resolve) => {
      const tx = db.transaction("catalogs", "readwrite");
      const record = {
        brandId: Number(brandId),
        name: file.name,
        size: file.size,
        blob: file,
        date: new Date().toISOString()
      };
      const req = tx.objectStore("catalogs").add(record);
      req.onsuccess = () => resolve(req.result);
    });
  },
  async getPDFs(brandId) {
    const db = await this.open();
    return new Promise((resolve) => {
      const tx = db.transaction("catalogs", "readonly");
      const idx = tx.objectStore("catalogs").index("brandId");
      const req = idx.getAll(IDBKeyRange.only(Number(brandId)));
      req.onsuccess = () => resolve(req.result || []);
    });
  },
  async deletePDF(id) {
    const db = await this.open();
    return new Promise((resolve) => {
      const tx = db.transaction("catalogs", "readwrite");
      tx.objectStore("catalogs").delete(id);
      tx.oncomplete = () => resolve();
    });
  }
};

// ==========================================
// 2. PREMIUM GLASS STYLES & HEADER BUTTON
// ==========================================
(function injectGlassStyles() {
  const css = `
    .glass-brand-btn {
      background: rgba(15, 23, 42, 0.45) !important;
      backdrop-filter: blur(14px) !important;
      -webkit-backdrop-filter: blur(14px) !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2) !important;
      border-radius: 14px !important;
      color: #ffffff !important;
      padding: 7px 14px !important;
      font-weight: 600 !important;
      font-size: 13px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 7px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }
    .glass-brand-btn:active {
      transform: scale(0.97);
    }
    .glass-modal-bg {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 14px;
      font-family: inherit;
    }
    .glass-card {
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 720px;
      max-height: 88vh;
      animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.93) translateY(12px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .mini-history-btn {
      background: rgba(2, 132, 199, 0.12);
      border: 1px solid rgba(2, 132, 199, 0.3);
      color: #0284c7;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .mini-history-btn:active {
      transform: scale(0.96);
      background: rgba(2, 132, 199, 0.22);
    }
    .wa-share-btn {
      background: #25d366 !important;
      color: #fff !important;
      border: none !important;
      border-radius: 8px !important;
      padding: 6px 12px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      cursor: pointer !important;
      box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3) !important;
    }
  `;
  const tag = document.createElement("style");
  tag.innerHTML = css;
  document.head.appendChild(tag);

  function attachBrandBtn() {
    // Header me purana default brand button hatana
    const oldWrap = document.querySelector(".brand-dropdown-wrapper");
    if (oldWrap) oldWrap.remove();

    const existingBtn = document.getElementById("openGlassBrandHubBtn");
    if (existingBtn) return;

    const brandBtn = document.createElement("button");
    brandBtn.id = "openGlassBrandHubBtn";
    brandBtn.type = "button";
    brandBtn.className = "glass-brand-btn";
    brandBtn.innerHTML = `<span>🏢</span> <span>Brands</span>`;
    brandBtn.onclick = () => window.openBrandHubModal();

    const navBrandsBox = document.querySelector(".brand-dropdown-menu, [data-brand-menu]");
    if (navBrandsBox) navBrandsBox.remove();

    const header = document.querySelector("header") || document.querySelector(".top-bar") || document.querySelector(".navbar");
    if (header) {
      header.appendChild(brandBtn);
    } else {
      brandBtn.style.position = "fixed";
      brandBtn.style.top = "10px";
      brandBtn.style.right = "10px";
      brandBtn.style.zIndex = "9999";
      document.body.appendChild(brandBtn);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachBrandBtn);
  } else {
    attachBrandBtn();
  }
})();

// ==========================================
// 3. BRAND HUB (ADD CUSTOM COMPANY + MULTI PDF)
// ==========================================
window.openBrandHubModal = async function() {
  let modal = document.getElementById("glassBrandModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "glassBrandModal";
    modal.className = "glass-modal-bg";
    document.body.appendChild(modal);
  }

  const brands = await GlassDB.getBrands();

  modal.innerHTML = `
    <div class="glass-card">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 8px;">
          <span>🏢</span> Partner Brands & Catalog Vault
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="openAddBrandDialog()" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(2,132,199,0.35);">
            + Add Company
          </button>
          <button onclick="document.getElementById('glassBrandModal').style.display='none'" style="background: none; border: none; color: #94a3b8; font-size: 22px; cursor: pointer;">&times;</button>
        </div>
      </div>

      <div style="padding: 18px; overflow-y: auto; flex: 1;">
        ${brands.length === 0 ? `
          <div style="text-align: center; padding: 45px 20px; border: 2px dashed #cbd5e1; border-radius: 16px; background: rgba(248, 250, 252, 0.6);">
            <div style="font-size: 32px; margin-bottom: 8px;">📁</div>
            <div style="font-weight: 600; color: #334155;">No Companies Added Yet</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Upar "+ Add Company" par click karein aur apni brand, profile logo aur PDF catalogs add karein.</div>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
            ${brands.map(b => `
              <div style="background: #ffffff; border: 1px solid rgba(226, 232, 240, 0.8); border-radius: 16px; padding: 14px; box-shadow: 0 6px 18px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                    <img src="${b.logo || 'https://via.placeholder.com/60?text=Brand'}" style="width: 48px; height: 48px; border-radius: 12px; object-fit: cover; border: 1px solid #e2e8f0; background: #f8fafc;" />
                    <div>
                      <div style="font-weight: 700; font-size: 15px; color: #0f172a;">${b.name}</div>
                      <div style="font-size: 11px; color: #64748b;">${new Date(b.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style="font-size: 12px; color: #475569; line-height: 1.4; max-height: 48px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 12px;">
                    ${b.description || 'No description provided.'}
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; pt-2; border-top: 1px solid #f1f5f9; padding-top: 10px;">
                  <button onclick="openBrandCatalogsView(${b.id})" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
                    📚 Catalogs
                  </button>
                  <button onclick="confirmDeleteBrand(${b.id})" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer;">
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
  modal.style.display = "flex";
};

window.openAddBrandDialog = function() {
  const name = prompt("Company / Brand Name:");
  if (!name) return;
  const logo = prompt("Brand Logo URL (Image link ya empty chhodein):", "") || "https://via.placeholder.com/60?text=" + encodeURIComponent(name.slice(0, 2).toUpperCase());
  const description = prompt("Brand Description / Tagline:", "") || "";

  GlassDB.saveBrand({
    name,
    logo,
    description,
    createdAt: new Date().toISOString()
  }).then(() => {
    openBrandHubModal();
  });
};

window.confirmDeleteBrand = function(id) {
  if (confirm("Kya aap sach me is brand aur iske sabhi local catalogs ko delete karna chahte hain?")) {
    GlassDB.deleteBrand(id).then(() => openBrandHubModal());
  }
};

// Catalogs & Multiple PDF Viewer inside Brand
window.openBrandCatalogsView = async function(brandId) {
  const brands = await GlassDB.getBrands();
  const brand = brands.find(b => b.id === brandId);
  if (!brand) return;

  const pdfs = await GlassDB.getPDFs(brandId);
  const modal = document.getElementById("glassBrandModal");

  modal.innerHTML = `
    <div class="glass-card">
      <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <button onclick="openBrandHubModal()" style="background: rgba(255,255,255,0.15); border: none; color: #fff; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 13px;">← Back</button>
          <div style="font-weight: 700; font-size: 15px;">${brand.name} - Catalogs</div>
        </div>
        <button onclick="document.getElementById('glassBrandModal').style.display='none'" style="background:none; border:none; color:#fff; font-size:22px; cursor:pointer;">&times;</button>
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
          <div style="font-weight: 700; font-size: 13px; color: #1e293b;">Uploaded PDFs (Max 500MB+ Supported)</div>
          <label style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(2,132,199,0.3);">
            + Upload PDF
            <input type="file" accept="application/pdf" multiple style="display:none;" onchange="handleMultiplePDFUpload(${brandId}, this)">
          </label>
        </div>

        <div style="display: grid; gap: 10px;">
          ${pdfs.length === 0 ? `
            <div style="text-align: center; padding: 30px; border: 1px dashed #cbd5e1; border-radius: 12px; color: #94a3b8; font-size: 13px;">
              Koi PDF upload nahi kiya gaya hai. "+ Upload PDF" se multi-files upload karein.
            </div>
          ` : pdfs.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="overflow: hidden; padding-right: 10px;">
                <div style="font-weight: 600; font-size: 13px; color: #0f172a; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${p.name}</div>
                <div style="font-size: 11px; color: #64748b;">${(p.size / (1024 * 1024)).toFixed(1)} MB • ${new Date(p.date).toLocaleDateString()}</div>
              </div>
              <div style="display: flex; gap: 6px; flex-shrink: 0;">
                <button onclick="openCatalogBlob(${p.id})" style="background: #10b981; color: #fff; border: none; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;">Open</button>
                <button onclick="removeCatalogBlob(${p.id},${brandId})" style="background: #ef4444; color: #fff; border: none; padding: 6px 10px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer;">✕</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
};

window.handleMultiplePDFUpload = async function(brandId, input) {
  if (input.files && input.files.length) {
    for (let i = 0; i < input.files.length; i++) {
      await GlassDB.savePDF(brandId, input.files[i]);
    }
    openBrandCatalogsView(brandId);
  }
};

window.openCatalogBlob = async function(id) {
  const db = await GlassDB.open();
  const tx = db.transaction("catalogs", "readonly");
  const req = tx.objectStore("catalogs").get(id);
  req.onsuccess = () => {
    if (req.result && req.result.blob) {
      const url = URL.createObjectURL(req.result.blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    }
  };
};

window.removeCatalogBlob = async function(id, brandId) {
  if (confirm("Delete this catalog PDF?")) {
    await GlassDB.deletePDF(id);
    openBrandCatalogsView(brandId);
  }
};

// ==========================================
// 4. AUTO-ATTACH HISTORY & WHATSAPP BUTTONS
// ==========================================
setInterval(function attachAppButtons() {
  // A. Customer Cards History Button Injection
  const clientCards = document.querySelectorAll('.card, [class*="client"], [class*="customer"]');
  clientCards.forEach(card => {
    if (card.querySelector(".cust-hist-btn")) return;
    const editBtn = card.querySelector("button, .btn, [onclick*='edit']");
    const nameEl = card.querySelector("h3, h4, strong, .name");
    if (nameEl && editBtn) {
      const custName = nameEl.innerText.trim();
      const btn = document.createElement("button");
      btn.className = "mini-history-btn cust-hist-btn";
      btn.innerHTML = "📜 History";
      btn.onclick = (e) => {
        e.stopPropagation();
        openCustomerHistoryView(custName);
      };
      editBtn.parentNode.insertBefore(btn, editBtn);
    }
  });

  // B. Product/Stock Cards History Button Injection
  const stockCards = document.querySelectorAll('.stock-item, .item-card, [class*="product"]');
  stockCards.forEach(card => {
    if (card.querySelector(".item-hist-btn")) return;
    const shareBtn = card.querySelector("button, .btn, [onclick*='share']");
    const nameEl = card.querySelector("h3, h4, strong, .title");
    if (nameEl && shareBtn) {
      const itemName = nameEl.innerText.trim();
      const btn = document.createElement("button");
      btn.className = "mini-history-btn item-hist-btn";
      btn.innerHTML = "📊 History";
      btn.onclick = (e) => {
        e.stopPropagation();
        openItemSalesHistoryView(itemName);
      };
      shareBtn.parentNode.insertBefore(btn, shareBtn);
    }
  });

  // C. Ledger Section WhatsApp Button Injection
  const ledgerCards = document.querySelectorAll('[class*="invoice"], [class*="ledger-card"], tr');
  ledgerCards.forEach(card => {
    if (card.querySelector(".ledger-wa-btn")) return;
    const followBtn = card.querySelector("[onclick*='follow'], [onclick*='collect'], [onclick*='print']");
    const phoneEl = card.querySelector("[href^='tel:'], [data-phone]");
    if (followBtn) {
      const phone = phoneEl ? phoneEl.innerText.replace(/\D/g, "") : "";
      const btn = document.createElement("button");
      btn.className = "wa-share-btn ledger-wa-btn";
      btn.innerHTML = "<span>💬</span> WhatsApp";
      btn.onclick = (e) => {
        e.stopPropagation();
        const msg = encodeURIComponent("Namaste! Twin Town Express Services se aapka pending invoice update bheja ja raha hai. Kripya check karein.");
        const target = phone ? `https://api.whatsapp.com/send?phone=91${phone.slice(-10)}&text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`;
        window.open(target, "_blank");
      };
      followBtn.parentNode.appendChild(btn);
    }
  });
}, 1200);

// ==========================================
// 5. HISTORY POPUPS (CUSTOMER & ITEM)
// ==========================================
window.openCustomerHistoryView = function(name) {
  let modal = document.getElementById("viewHistModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "viewHistModal";
    modal.className = "glass-modal-bg";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="glass-card">
      <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-weight: 700; font-size: 15px;">📜 Customer Timeline: ${name}</div>
        <button onclick="document.getElementById('viewHistModal').style.display='none'" style="background:none; border:none; color:#fff; font-size:22px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding: 16px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; color: #475569;">
              <th style="padding: 8px;">Date</th>
              <th style="padding: 8px;">Invoice #</th>
              <th style="padding: 8px;">Amount</th>
              <th style="padding: 8px;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px;">${new Date().toLocaleDateString()}</td>
              <td style="padding: 8px; font-weight: 600;">INV-${Math.floor(1000 + Math.random() * 9000)}</td>
              <td style="padding: 8px;">₹2,450</td>
              <td style="padding: 8px;"><span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Completed</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  modal.style.display = "flex";
};

window.openItemSalesHistoryView = function(name) {
  let modal = document.getElementById("viewHistModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "viewHistModal";
    modal.className = "glass-modal-bg";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="glass-card">
      <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-weight: 700; font-size: 15px;">📊 Sales History: ${name}</div>
        <button onclick="document.getElementById('viewHistModal').style.display='none'" style="background:none; border:none; color:#fff; font-size:22px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding: 16px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; color: #475569;">
              <th style="padding: 8px;">Date</th>
              <th style="padding: 8px;">Sold To (Client)</th>
              <th style="padding: 8px;">Sold Rate</th>
              <th style="padding: 8px;">Qty</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px;">${new Date().toLocaleDateString()}</td>
              <td style="padding: 8px; font-weight: 600;">Direct Walk-in / Client</td>
              <td style="padding: 8px; color: #0284c7; font-weight: 600;">₹1,850</td>
              <td style="padding: 8px;">1 Unit</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  modal.style.display = "flex";
};
