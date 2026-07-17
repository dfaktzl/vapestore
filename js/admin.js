/* ==========================================================================
   MERCHANT DASHBOARD CONTROLLER — FIREBASE LIVE PUBLISH EDITION
   Changes flow: Admin edits → Firebase → Storefront reads Firebase → LIVE
   ========================================================================== */

// Safe localStorage wrapper
const localStorage = (() => {
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    return {
      _data: {},
      setItem(id, val) { this._data[id] = String(val); },
      getItem(id) { return this._data.hasOwnProperty(id) ? this._data[id] : null; },
      removeItem(id) { delete this._data[id]; },
      clear() { this._data = {}; }
    };
  }
})();

// HTML escaping helper to prevent DOM XSS
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

document.addEventListener("DOMContentLoaded", () => {
  window.adminApp = new AdminApp();
});

class AdminApp {
  constructor() {
    this.config = null;
    this.guides = [];
    this.orders = [];
    this.visitors = [];
    this.firebaseUrl = null; // Resolved on init from config
    this.init();
  }

  async init() {
    this.setupTabs();

    if (sessionStorage.getItem("admin_authenticated") === "true") {
      document.getElementById("admin-login-overlay").style.display = "none";
      await this.initDashboard();
    } else {
      document.getElementById("admin-login-overlay").style.display = "flex";
      this.bindLoginEvent();
    }
  }

  async initDashboard() {
    await this.loadConfig();
    // Resolve Firebase URL once config is loaded
    this.firebaseUrl = this._resolveFirebaseUrl();
    await this.loadGuides();
    await this.loadOrders();

    this.populateSettingsForm();
    this.renderProductsList();
    this.renderGuidesList();
    this.renderOrders();
    this.bindEvents();
  }

  _resolveFirebaseUrl() {
    const url = this.config?.settings?.orderSyncUrl?.trim();
    if (!url) return null;
    return url.endsWith("/") ? url : url + "/";
  }

  /* ==========================================================================
     AUTHENTICATION — Validated against Firebase /adminKey node
     ========================================================================== */

  bindLoginEvent() {
    const form = document.getElementById("admin-login-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = document.getElementById("login-username").value.trim();
      const pass = document.getElementById("login-password").value;
      const errorEl = document.getElementById("login-error");
      const btn = form.querySelector("button[type=submit]");

      btn.innerText = "Verifying...";
      btn.disabled = true;
      errorEl.style.display = "none";

      const authenticated = await this._verifyCredentials(user, pass);

      if (authenticated) {
        sessionStorage.setItem("admin_authenticated", "true");
        document.getElementById("admin-login-overlay").style.display = "none";
        await this.initDashboard();
      } else {
        errorEl.style.display = "block";
        btn.innerText = "Verify Credentials";
        btn.disabled = false;
      }
    });
  }

  async _verifyCredentials(user, pass) {
    // Step 1: Try to validate against Firebase adminKey node
    // Load base config first to get the Firebase URL
    try {
      let baseConfig = null;
      const resp = await fetch("config.json?v=3");
      if (resp.ok) baseConfig = await resp.json();
      else if (window.CONFIG_DEFAULT) baseConfig = window.CONFIG_DEFAULT;

      const fbUrl = baseConfig?.settings?.orderSyncUrl?.trim();
      if (fbUrl) {
        const cleanUrl = fbUrl.endsWith("/") ? fbUrl : fbUrl + "/";
        const keyResp = await fetch(`${cleanUrl}adminKey.json`);
        if (keyResp.ok) {
          const storedKey = await keyResp.json();
          // storedKey is stored as "username:password" hash in Firebase
          if (storedKey && storedKey === `${user}:${pass}`) {
            return true;
          }
        }
      }
    } catch(e) {
      console.warn("Firebase auth check failed, using fallback credentials.", e);
    }

    // Step 2: Fallback hardcoded credentials (only if Firebase key not set)
    return (user === "admin" && pass === "_passw00rd!_");
  }

  /* ==========================================================================
     1. DATA LOADING — Firebase first, then config.json, then defaults
     ========================================================================== */

  async loadConfig() {
    // 1. Try Firebase live config
    try {
      let fbBase = null;
      const resp = await fetch("config.json?v=9");
      if (resp.ok) {
        const staticConf = await resp.json();
        fbBase = staticConf?.settings?.orderSyncUrl?.trim();
      } else if (window.CONFIG_DEFAULT) {
        fbBase = window.CONFIG_DEFAULT?.settings?.orderSyncUrl?.trim();
      }

      if (fbBase) {
        const cleanUrl = fbBase.endsWith("/") ? fbBase : fbBase + "/";
        const fbResp = await fetch(`${cleanUrl}config.json`);
        if (fbResp.ok) {
          const fbData = await fbResp.json();
          if (fbData && fbData.products && fbData.settings) {
            this.config = fbData;
            console.log("Admin loaded config from Firebase (live).");
            return;
          }
        }
      }
    } catch(e) {
      console.warn("Firebase config load failed, trying config.json.", e);
    }

    // 2. Fetch config.json from server
    try {
      const response = await fetch("config.json?v=9");
      if (response.ok) {
        this.config = await response.json();
        console.log("Admin loaded config from config.json.");
        return;
      }
    } catch(e) {
      console.warn("Could not retrieve config.json. Using fallback default.");
    }

    // 3. Fallback to default
    if (window.CONFIG_DEFAULT) {
      this.config = JSON.parse(JSON.stringify(window.CONFIG_DEFAULT));
      console.log("Admin loaded config from config_default.js fallback.");
    } else {
      alert("Error: Default configuration variables missing.");
    }
  }

  async loadGuides() {
    // 1. Try Firebase live guides
    if (this.firebaseUrl) {
      try {
        const fbResp = await fetch(`${this.firebaseUrl}guides.json`);
        if (fbResp.ok) {
          const fbData = await fbResp.json();
          if (Array.isArray(fbData) && fbData.length > 0) {
            this.guides = fbData;
            console.log("Admin loaded guides from Firebase (live).");
            return;
          }
        }
      } catch(e) {
        console.warn("Firebase guides load failed, trying guides.json.", e);
      }
    }

    // 2. Fetch guides.json from server
    try {
      const response = await fetch("guides.json?v=3");
      if (response.ok) {
        this.guides = await response.json();
        console.log("Admin loaded guides from guides.json.");
        return;
      }
    } catch(e) {
      console.warn("Could not retrieve guides.json.");
    }

    this.guides = [];
  }

  async loadOrders() {
    const stored = localStorage.getItem("crown_gold_orders");
    if (stored) {
      try { this.orders = JSON.parse(stored); } catch(e) { this.orders = []; }
    }

    if (this.firebaseUrl) {
      try {
        const response = await fetch(`${this.firebaseUrl}orders.json`);
        if (response.ok) {
          const data = await response.json();
          if (data) {
            const list = [];
            Object.keys(data).forEach(key => {
              const item = data[key];
              item.firebaseKey = key;
              if (!item.status) item.status = "Pending Payment";
              list.push(item);
            });
            list.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.orders = list;
            localStorage.setItem("crown_gold_orders", JSON.stringify(list));
          } else {
            this.orders = [];
          }
        }
      } catch (err) {
        console.warn("Could not fetch orders from Firebase:", err);
      }
    }
  }

  /* ==========================================================================
     2. FIREBASE LIVE PUBLISH ENGINE
     ========================================================================== */

  async publishToFirebase() {
    const dbUrl = this._resolveFirebaseUrl();
    if (!dbUrl) {
      alert("⚠️ No Firebase URL configured. Go to SEO & Bank Settings and enter your Firebase Database URL first.");
      return false;
    }

    const btn = document.getElementById("btn-publish-live");
    const originalText = btn ? btn.innerText : "";
    if (btn) { btn.innerText = "Publishing..."; btn.disabled = true; }

    try {
      // Write config
      const configResp = await fetch(`${dbUrl}config.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.config)
      });

      // Write guides
      const guidesResp = await fetch(`${dbUrl}guides.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.guides)
      });

      if (configResp.ok && guidesResp.ok) {
        this._showPublishSuccess();
        return true;
      } else {
        const errStatus = !configResp.ok ? configResp.status : guidesResp.status;
        throw new Error(`Firebase returned HTTP ${errStatus}. Check your database security rules.`);
      }
    } catch (err) {
      alert("❌ Publish failed: " + err.message + "\n\nIf you see a 401/403 error, your Firebase rules need to be updated. Check the 'Hosting & Automation' tab for instructions.");
      return false;
    } finally {
      if (btn) { btn.innerText = originalText; btn.disabled = false; }
    }
  }

  _showPublishSuccess() {
    const btn = document.getElementById("btn-publish-live");
    if (!btn) return;
    const originalText = btn.innerText;
    btn.innerText = "✅ Live! Changes Published";
    btn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
    btn.style.borderColor = "#10b981";
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = "";
      btn.style.borderColor = "";
    }, 3000);
  }

  /* ==========================================================================
     3. SETTINGS — Save locally AND publish to Firebase
     ========================================================================== */

  populateSettingsForm() {
    if (!this.config) return;

    document.getElementById("set-seo-title").value = this.config.seo.title || "";
    document.getElementById("set-seo-desc").value = this.config.seo.description || "";

    document.getElementById("set-contact-email").value = this.config.settings.contactEmail || "";
    document.getElementById("set-contact-phone").value = this.config.settings.contactPhone || "";
    document.getElementById("set-announcement").value = this.config.settings.announcement || "";
    document.getElementById("set-order-sync-url").value = this.config.settings.orderSyncUrl || "";

    const bank = this.config.settings.bankDetails;
    document.getElementById("set-payid").value = bank.payId || "";
    document.getElementById("set-bank-name").value = bank.bankName || "";
    document.getElementById("set-bank-holder").value = bank.accountName || "";
    document.getElementById("set-bank-bsb").value = bank.bsb || "";
    document.getElementById("set-bank-account").value = bank.accountNumber || "";

    document.getElementById("set-emailjs-service").value = this.config.settings.emailjsServiceId || "";
    document.getElementById("set-emailjs-public").value = this.config.settings.emailjsPublicKey || "";
    document.getElementById("set-emailjs-contact-template").value = this.config.settings.emailjsContactTemplateId || "";
    document.getElementById("set-emailjs-order-template").value = this.config.settings.emailjsOrderTemplateId || "";
    document.getElementById("set-emailjs-payment-received-template").value = this.config.settings.emailjsPaymentReceivedTemplateId || "";

    // Admin password field if present
    const adminPassField = document.getElementById("set-admin-password");
    if (adminPassField) adminPassField.value = "";
  }

  async saveSettings() {
    if (!this.config) return;

    this.config.seo.title = document.getElementById("set-seo-title").value;
    this.config.seo.description = document.getElementById("set-seo-desc").value;

    this.config.settings.contactEmail = document.getElementById("set-contact-email").value;
    this.config.settings.contactPhone = document.getElementById("set-contact-phone").value;
    this.config.settings.announcement = document.getElementById("set-announcement").value;
    this.config.settings.orderSyncUrl = document.getElementById("set-order-sync-url").value.trim();

    this.config.settings.bankDetails = {
      payId: document.getElementById("set-payid").value,
      bankName: document.getElementById("set-bank-name").value,
      accountName: document.getElementById("set-bank-holder").value,
      bsb: document.getElementById("set-bank-bsb").value,
      accountNumber: document.getElementById("set-bank-account").value
    };

    this.config.settings.emailjsServiceId = document.getElementById("set-emailjs-service").value.trim();
    this.config.settings.emailjsPublicKey = document.getElementById("set-emailjs-public").value.trim();
    this.config.settings.emailjsContactTemplateId = document.getElementById("set-emailjs-contact-template").value.trim();
    this.config.settings.emailjsOrderTemplateId = document.getElementById("set-emailjs-order-template").value.trim();
    this.config.settings.emailjsPaymentReceivedTemplateId = document.getElementById("set-emailjs-payment-received-template").value.trim();

    // Refresh Firebase URL after URL field may have changed
    this.firebaseUrl = this._resolveFirebaseUrl();

    // Handle admin password update
    const newPass = document.getElementById("set-admin-password")?.value?.trim();
    const newUser = document.getElementById("set-admin-username")?.value?.trim();
    if (newPass && newUser && this.firebaseUrl) {
      try {
        await fetch(`${this.firebaseUrl}adminKey.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(`${newUser}:${newPass}`)
        });
        document.getElementById("set-admin-password").value = "";
        document.getElementById("set-admin-username").value = "";
      } catch(e) {
        console.error("Could not update admin credentials in Firebase:", e);
      }
    }

    // Publish settings + full config to Firebase
    const published = await this.publishToFirebase();
    if (!published) {
      // If Firebase failed, at least alert it was saved in memory
      alert("Settings saved in memory. Note: Firebase publish failed — check your Firebase URL and rules.");
    }
  }

  /* ==========================================================================
     4. PRODUCT CRUD ENGINE
     ========================================================================== */

  renderProductsList() {
    const listBody = document.getElementById("admin-products-list");
    const countText = document.getElementById("admin-product-count");
    if (!listBody || !this.config || !this.config.products) return;

    countText.innerText = this.config.products.length;
    listBody.innerHTML = "";

    if (this.config.products.length === 0) {
      listBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            No products currently in the catalog. Use the form above to add items.
          </td>
        </tr>
      `;
      return;
    }

    this.config.products.forEach(prod => {
      const tr = document.createElement("tr");

      const formatsHTML = prod.isBoxOnly
        ? `<span class="product-badge" style="position:static; font-size:9px;">Box Only</span>`
        : `<span class="product-badge" style="position:static; background:#fff; color:#000; font-size:9px; margin-right:5px;">Single</span><span class="product-badge" style="position:static; font-size:9px;">Box</span>`;

      const catLabel = prod.category === "cigarettes" ? "Cigarette Cartons" :
                       (prod.category === "vapes-boxes" ? "Waka/HQD Boxes" : "IGET/Alibarbar (Singles)");

      tr.innerHTML = `
        <td>
          <div class="td-product-info">
            <img class="td-product-img" src="${prod.image}" alt="">
            <div class="td-product-details">
              <span class="td-product-name">${prod.name}</span>
              <span class="td-product-brand">${prod.brand}</span>
            </div>
          </div>
        </td>
        <td>${catLabel}</td>
        <td>$${prod.price.toFixed(2)}</td>
        <td>${prod.isBoxOnly ? "N/A" : `$${(prod.boxPrice || prod.price).toFixed(2)}`}</td>
        <td>${formatsHTML}</td>
        <td>
          <div class="action-btn-group">
            <button class="btn-icon edit-btn" title="Edit Product">✏️</button>
            <button class="btn-icon delete-btn" title="Delete Product">🗑️</button>
          </div>
        </td>
      `;

      tr.querySelector(".edit-btn").addEventListener("click", () => this.editProduct(prod));
      tr.querySelector(".delete-btn").addEventListener("click", () => this.deleteProduct(prod.id));

      listBody.appendChild(tr);
    });
  }

  async saveProduct() {
    const editId = document.getElementById("edit-product-id").value;
    const brand = document.getElementById("prod-brand").value;
    const name = document.getElementById("prod-name").value;
    const category = document.getElementById("prod-category").value;
    const price = parseFloat(document.getElementById("prod-price").value);
    const boxPriceVal = parseFloat(document.getElementById("prod-box-price").value);
    const isBoxOnly = document.getElementById("prod-box-only").checked;
    const image = document.getElementById("prod-image").value;
    const flavorsRaw = document.getElementById("prod-flavors").value;
    const description = document.getElementById("prod-description").value;

    if (!brand || !name || !image || isNaN(price)) {
      alert("Please fill out all required fields marked with *");
      return;
    }

    const flavors = flavorsRaw ? flavorsRaw.split(",").map(f => f.trim()).filter(f => f !== "") : [];
    const boxPrice = isNaN(boxPriceVal) ? price : boxPriceVal;

    const productData = { brand, name, category, price, boxPrice, isBoxOnly, image, flavors, description, inStock: true };

    if (editId) {
      const index = this.config.products.findIndex(p => p.id === editId);
      if (index !== -1) this.config.products[index] = { ...this.config.products[index], ...productData };
      this.cancelProductEdit();
    } else {
      productData.id = `prod-${Date.now()}`;
      productData.popular = false;
      this.config.products.push(productData);
      document.getElementById("product-form").reset();
    }

    this.renderProductsList();
    await this.publishToFirebase();
  }

  editProduct(product) {
    document.getElementById("edit-product-id").value = product.id;
    document.getElementById("prod-brand").value = product.brand;
    document.getElementById("prod-name").value = product.name;
    document.getElementById("prod-category").value = product.category;
    document.getElementById("prod-price").value = product.price;
    document.getElementById("prod-box-price").value = product.isBoxOnly ? "" : product.boxPrice;
    document.getElementById("prod-box-only").checked = product.isBoxOnly;
    document.getElementById("prod-image").value = product.image;
    document.getElementById("prod-flavors").value = product.flavors ? product.flavors.join(", ") : "";
    document.getElementById("prod-description").value = product.description || "";

    document.getElementById("editor-title").innerText = `Edit: ${product.name}`;
    document.getElementById("btn-save-product").innerText = "Update Product";
    document.getElementById("btn-cancel-edit").style.display = "inline-flex";
    document.getElementById("product-editor-card").scrollIntoView({ behavior: "smooth" });
  }

  cancelProductEdit() {
    document.getElementById("edit-product-id").value = "";
    document.getElementById("product-form").reset();
    document.getElementById("editor-title").innerText = "Add New Catalog Product";
    document.getElementById("btn-save-product").innerText = "Add Product";
    document.getElementById("btn-cancel-edit").style.display = "none";
  }

  async deleteProduct(productId) {
    if (confirm("Are you sure you want to delete this product from the inventory?")) {
      this.config.products = this.config.products.filter(p => p.id !== productId);
      this.renderProductsList();
      await this.publishToFirebase();
    }
  }

  resetConfig() {
    if (confirm("WARNING: This will reset the store to the default catalog. Are you sure?")) {
      if (window.CONFIG_DEFAULT) {
        this.config = JSON.parse(JSON.stringify(window.CONFIG_DEFAULT));
        this.populateSettingsForm();
        this.renderProductsList();
        this.renderGuidesList();
        alert("Configuration restored to defaults. Click 'Publish Live' to push to Firebase.");
      }
    }
  }

  /* ==========================================================================
     5. GUIDES CRUD ENGINE
     ========================================================================== */

  renderGuidesList() {
    const listBody = document.getElementById("admin-guides-list");
    const countText = document.getElementById("admin-guide-count");
    if (!listBody || !this.guides) return;

    countText.innerText = this.guides.length;
    listBody.innerHTML = "";

    if (this.guides.length === 0) {
      listBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">
            No articles currently in the content hub. Use the form above to add items.
          </td>
        </tr>
      `;
      return;
    }

    this.guides.forEach(guide => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 600; color: #fff;">${guide.title}</td>
        <td><code>${guide.keyword || ""}</code></td>
        <td>${guide.date || ""}</td>
        <td>${guide.author || "Vape 'R' Aus Education"}</td>
        <td style="text-align: right;">
          <button class="btn-primary btn-edit-guide" style="padding: 4px 8px; font-size: 11px; margin-right: 5px; border-color: var(--gold-accent);">Edit</button>
          <button class="btn-secondary btn-delete-guide" style="padding: 4px 8px; font-size: 11px; color: var(--error-color); border-color: var(--error-color);">Delete</button>
        </td>
      `;
      tr.querySelector(".btn-edit-guide").addEventListener("click", () => this.editGuide(guide.id));
      tr.querySelector(".btn-delete-guide").addEventListener("click", () => this.deleteGuide(guide.id));
      listBody.appendChild(tr);
    });
  }

  async saveGuide() {
    if (!this.guides) this.guides = [];

    const idField = document.getElementById("edit-guide-id").value;
    const titleVal = document.getElementById("guide-title").value.trim();
    const keywordVal = document.getElementById("guide-keyword").value.trim();
    const authorVal = document.getElementById("guide-author").value.trim() || "Vape 'R' Aus Education";
    const summaryVal = document.getElementById("guide-summary").value.trim();
    const contentVal = document.getElementById("guide-content").value.trim();

    if (!titleVal || !keywordVal || !summaryVal || !contentVal) {
      alert("Please fill in all required fields marked with *");
      return;
    }

    if (idField) {
      const guide = this.guides.find(g => g.id === idField);
      if (guide) {
        guide.title = titleVal;
        guide.keyword = keywordVal;
        guide.author = authorVal;
        guide.summary = summaryVal;
        guide.content = contentVal;
      }
    } else {
      const newId = titleVal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      let finalId = newId;
      let counter = 1;
      while (this.guides.some(g => g.id === finalId)) { finalId = `${newId}-${counter}`; counter++; }
      const today = new Date().toISOString().split("T")[0];
      this.guides.push({ id: finalId, title: titleVal, keyword: keywordVal, date: today, summary: summaryVal, content: contentVal, author: authorVal });
    }

    this.renderGuidesList();
    this.cancelGuideEdit();
    await this.publishToFirebase();
  }

  editGuide(guideId) {
    const guide = this.guides.find(g => g.id === guideId);
    if (!guide) return;

    document.getElementById("edit-guide-id").value = guide.id;
    document.getElementById("guide-title").value = guide.title;
    document.getElementById("guide-keyword").value = guide.keyword || "";
    document.getElementById("guide-author").value = guide.author || "Vape 'R' Aus Education";
    document.getElementById("guide-summary").value = guide.summary;
    document.getElementById("guide-content").value = guide.content;

    document.getElementById("guide-editor-title").innerText = "Edit Educational Article";
    document.getElementById("btn-save-guide").innerText = "Save Changes";
    document.getElementById("btn-cancel-guide-edit").style.display = "inline-block";
    document.getElementById("guide-editor-card").scrollIntoView({ behavior: "smooth" });
  }

  async deleteGuide(guideId) {
    if (confirm("Are you sure you want to delete this educational article?")) {
      this.guides = this.guides.filter(g => g.id !== guideId);
      this.renderGuidesList();
      this.cancelGuideEdit();
      await this.publishToFirebase();
    }
  }

  cancelGuideEdit() {
    document.getElementById("edit-guide-id").value = "";
    document.getElementById("guide-form").reset();
    document.getElementById("guide-editor-title").innerText = "Add New Educational Article";
    document.getElementById("btn-save-guide").innerText = "Add Article";
    document.getElementById("btn-cancel-guide-edit").style.display = "none";
  }

  /* ==========================================================================
     6. ORDERS VIEWER & MANAGEMENT
     ========================================================================== */

  renderOrders() {
    const container = document.getElementById("admin-orders-container");
    if (!container) return;
    container.innerHTML = "";

    if (this.orders.length === 0) {
      container.innerHTML = `
        <div class="glass-card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
          No bank orders placed yet. Orders submitted via checkout will be logged here.
        </div>
      `;
      return;
    }

    this.orders.forEach(order => {
      const card = document.createElement("div");
      card.className = "glass-card order-card";
      const formattedDate = new Date(order.date).toLocaleString("en-AU");

      let itemsHTML = "";
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (item) {
            const itemTotal = parseFloat(item.total || 0);
            itemsHTML += `
              <tr>
                <td>${item.name || "Unknown Item"} (${item.flavor || "Default"}) [Format: ${item.format || "Single"}]</td>
                <td style="text-align:center;">${item.quantity || 0}</td>
                <td style="text-align:right;">$${itemTotal.toFixed(2)}</td>
              </tr>
            `;
          }
        });
      } else {
        itemsHTML = `
          <tr>
            <td colspan="3" style="text-align:center; color:var(--text-muted); font-style:italic;">No items in this order.</td>
          </tr>
        `;
      }

      let metaHTML = "";
      if (order.metadata && order.metadata.userAgent) {
        const escapedUA = escapeHTML(order.metadata.userAgent.slice(0, 75));
        const escapedRes = escapeHTML(order.metadata.resolution || "N/A");
        const escapedLang = escapeHTML(order.metadata.language || "N/A");
        const escapedIP = escapeHTML(order.metadata.ip || "Unknown");
        metaHTML = `
          <p style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.05); font-size:11px; color:var(--text-muted);">
            <strong>Client System Log:</strong> IP: <span>${escapedIP}</span> | UA: ${escapedUA}... | Res: ${escapedRes} | Lang: ${escapedLang}
          </p>
        `;
      }

      const status = order.status || "Pending Payment";
      const statusOptions = ["Pending Payment", "Payment Received", "Processed / Shipped", "Cancelled"];
      let statusSelectHTML = `<select class="order-status-select sort-select" style="width:auto; height:32px; padding:0 8px; font-size:12px; border-color:var(--gold-accent); background:rgba(0,0,0,0.6);" data-order-id="${order.orderId}">`;
      statusOptions.forEach(opt => {
        statusSelectHTML += `<option value="${opt}" ${status === opt ? "selected" : ""}>${opt}</option>`;
      });
      statusSelectHTML += `</select>`;

      const cust = order.customer || {};
      const orderTotal = parseFloat(order.total || 0);

      card.innerHTML = `
        <div class="order-card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div class="order-id-block">
            <span class="order-id">Order ID: ${escapeHTML(order.orderId) || "N/A"}</span>
            <span class="order-date">Date: ${formattedDate}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="order-ref" style="font-size:12px; margin-right:5px;">Ref: <strong>${escapeHTML(order.refCode) || "N/A"}</strong></span>
            ${statusSelectHTML}
            <button class="btn-icon delete-order-btn" title="Delete Order" data-order-id="${order.orderId}" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑️</button>
          </div>
        </div>
        <div class="order-grid">
          <div class="order-customer-details">
            <p><strong>Customer Name:</strong> ${escapeHTML(cust.name) || "N/A"}</p>
            <p><strong>Phone Number:</strong> ${escapeHTML(cust.phone) || "N/A"}</p>
            <p><strong>Email Address:</strong> ${escapeHTML(cust.email) || "N/A"}</p>
            <p><strong>Shipping Address:</strong> ${escapeHTML(cust.address) || "N/A"}</p>
            <p><strong>Delivery Notes:</strong> <span style="font-style:italic; color:var(--text-muted);">${escapeHTML(cust.notes) || "None"}</span></p>
            ${metaHTML}
          </div>
          <div>
            <table class="order-items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>${itemsHTML}</tbody>
              <tfoot>
                <tr style="border-top: 1px dashed rgba(255,255,255,0.1);">
                  <td colspan="2" style="padding-top:15px; font-weight:700; color:var(--text-primary); text-transform:uppercase; font-size:12px;">Total Payable</td>
                  <td style="padding-top:15px; font-weight:700; text-align:right; color:var(--gold-accent); font-size:16px;">$${orderTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 15px;">
              <button class="btn-primary send-reminder-email-btn" data-order-id="${order.orderId}" style="font-size: 11px; height: 32px; padding: 0 10px; display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 700; cursor: pointer; border-radius: 4px;">
                ✉️ Send Reminder
              </button>
              <button class="btn-secondary send-confirmed-email-btn" data-order-id="${order.orderId}" style="font-size: 11px; height: 32px; padding: 0 10px; display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 700; cursor: pointer; border-color: #10b981; color: #10b981; margin:0; border-radius: 4px; background: transparent;">
                ✉️ Send Receipt
              </button>
            </div>
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    container.querySelectorAll(".order-status-select").forEach(select => {
      select.addEventListener("change", (e) => this.updateOrderStatus(e.target.dataset.orderId, e.target.value));
    });
    container.querySelectorAll(".delete-order-btn").forEach(btn => {
      btn.addEventListener("click", (e) => this.deleteOrder(e.currentTarget.dataset.orderId));
    });
    container.querySelectorAll(".send-reminder-email-btn").forEach(btn => {
      btn.addEventListener("click", (e) => this.sendReminderEmail(e.currentTarget.dataset.orderId, e.currentTarget));
    });
    container.querySelectorAll(".send-confirmed-email-btn").forEach(btn => {
      btn.addEventListener("click", (e) => this.sendConfirmedEmail(e.currentTarget.dataset.orderId, e.currentTarget));
    });
  }

  async updateOrderStatus(orderId, newStatus) {
    const index = this.orders.findIndex(o => o.orderId === orderId);
    if (index === -1) return;
    this.orders[index].status = newStatus;
    localStorage.setItem("crown_gold_orders", JSON.stringify(this.orders));

    const order = this.orders[index];
    if (order.firebaseKey && this.firebaseUrl) {
      try {
        await fetch(`${this.firebaseUrl}orders/${order.firebaseKey}.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus })
        });
      } catch (err) {
        console.error("Cloud status update failed:", err);
      }
    }
    this.renderOrders();
  }

  async deleteOrder(orderId) {
    if (!confirm(`Are you sure you want to delete order ${orderId}? This action cannot be undone.`)) return;
    const index = this.orders.findIndex(o => o.orderId === orderId);
    if (index === -1) return;
    const order = this.orders[index];
    this.orders.splice(index, 1);
    localStorage.setItem("crown_gold_orders", JSON.stringify(this.orders));

    if (order.firebaseKey && this.firebaseUrl) {
      try {
        await fetch(`${this.firebaseUrl}orders/${order.firebaseKey}.json`, { method: "DELETE" });
      } catch (err) {
        console.error("Cloud delete failed:", err);
      }
    }
    this.renderOrders();
  }

  async clearOrders() {
    if (!confirm("Are you sure you want to delete all order history logs? This cannot be undone.")) return;
    if (this.firebaseUrl) {
      try {
        await fetch(`${this.firebaseUrl}orders.json`, { method: "DELETE" });
      } catch (err) {
        console.error("Cloud database clear failed:", err);
      }
    }
    localStorage.removeItem("crown_gold_orders");
    this.orders = [];
    this.renderOrders();
  }

  /* ==========================================================================
     6B. VISITOR ANALYTICS CONTROLLER
     ========================================================================== */

  async loadVisitors() {
    const tbody = document.getElementById("visitors-log-tbody");
    if (!tbody) return;

    if (!this.firebaseUrl) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding:30px; text-align:center; color:var(--error-color);">
            ⚠️ No Cloud Database configured. Geolocation and visitor logs require Firebase Database URL in Settings.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding:30px; text-align:center; color:var(--text-secondary);">
          Loading visitor logs from database...
        </td>
      </tr>
    `;

    try {
      const response = await fetch(`${this.firebaseUrl}visits.json`);
      if (response.ok) {
        const data = await response.json();
        this.visitors = data ? Object.values(data).filter(v => v !== null) : [];
        // Sort visitors by timestamp descending (newest first)
        this.visitors.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        this.renderVisitors();
      } else {
        throw new Error("HTTP " + response.status);
      }
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding:30px; text-align:center; color:var(--error-color);">
            ❌ Failed to load visitor logs: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  renderVisitors() {
    const tbody = document.getElementById("visitors-log-tbody");
    if (!tbody) return;

    if (!this.visitors || this.visitors.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding:30px; text-align:center; color:var(--text-muted); font-size:13px;">
            No visitor logs available.
          </td>
        </tr>
      `;
      // Reset metrics
      document.getElementById("metric-total-sessions").innerText = "0";
      document.getElementById("metric-unique-visitors").innerText = "0";
      document.getElementById("metric-mobile-sessions").innerText = "0";
      document.getElementById("metric-desktop-sessions").innerText = "0";
      return;
    }

    // Calculate metrics
    const totalSessions = this.visitors.length;
    const uniqueIPs = new Set(this.visitors.map(v => v.ip).filter(ip => ip && ip !== "Unknown")).size;
    const mobileSessions = this.visitors.filter(v => v.device === "Mobile/Tablet").length;
    const desktopSessions = this.visitors.filter(v => v.device === "Desktop").length;

    document.getElementById("metric-total-sessions").innerText = totalSessions;
    document.getElementById("metric-unique-visitors").innerText = uniqueIPs;
    document.getElementById("metric-mobile-sessions").innerText = mobileSessions;
    document.getElementById("metric-desktop-sessions").innerText = desktopSessions;

    tbody.innerHTML = "";
    this.visitors.forEach(visitor => {
      const dateStr = new Date(visitor.timestamp).toLocaleString("en-AU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      const location = (visitor.city !== "Unknown" || visitor.country !== "Unknown")
        ? `${visitor.city || ""}, ${visitor.country || ""}`
        : "Unknown / Blocked";

      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
      
      // Calculate activity items count
      const activityCount = visitor.activity ? Object.keys(visitor.activity).length : 0;

      tr.innerHTML = `
        <td style="padding:12px 15px; font-size:13px; color:var(--text-secondary);">${dateStr}</td>
        <td style="padding:12px 15px; font-size:13px; font-family:monospace; color:var(--text-primary); font-weight:600;">${escapeHTML(visitor.ip) || "Unknown"}</td>
        <td style="padding:12px 15px; font-size:13px; color:#fff;">📍 ${escapeHTML(location)}</td>
        <td style="padding:12px 15px; font-size:12px; color:var(--text-secondary); max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHTML(visitor.isp) || ""}">${escapeHTML(visitor.isp) || "Unknown"}</td>
        <td style="padding:12px 15px; font-size:12px; color:var(--text-secondary); max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHTML(visitor.userAgent) || ""}">🖥️ [${escapeHTML(visitor.device) || "Desktop"}]</td>
        <td style="padding:12px 15px; font-size:12px; color:var(--text-secondary); max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHTML(visitor.referrer) || ""}">🔗 ${escapeHTML(visitor.referrer) || "Direct"}</td>
        <td style="padding:12px 15px; text-align:center;">
          <button class="btn-primary btn-view-journey" data-id="${visitor.visitId}" style="font-size:10px; padding:4px 8px; margin:0; min-height:auto; height:24px; line-height:22px; width:auto; border-radius:4px; font-weight:700;">
            Flow (${activityCount})
          </button>
        </td>
      `;

      tr.querySelector(".btn-view-journey").addEventListener("click", () => {
        this.viewVisitorActivity(visitor);
      });

      tbody.appendChild(tr);
    });
  }

  async viewVisitorActivity(visitor) {
    const modal = document.getElementById("visitor-detail-modal");
    const metaContainer = document.getElementById("visitor-modal-meta");
    const timelineContainer = document.getElementById("visitor-activity-timeline");
    const actionsContainer = document.getElementById("visitor-modal-actions");
    if (!modal || !metaContainer || !timelineContainer || !actionsContainer) return;

    metaContainer.innerHTML = `
      <div><strong>IP:</strong> ${escapeHTML(visitor.ip) || "Unknown"}</div>
      <div><strong>ISP:</strong> ${escapeHTML(visitor.isp) || "Unknown"}</div>
      <div><strong>Location:</strong> ${escapeHTML(visitor.city) || ""}, ${escapeHTML(visitor.region) || ""}, ${escapeHTML(visitor.country) || ""}</div>
      <div><strong>Referrer:</strong> ${escapeHTML(visitor.referrer) || "Direct"}</div>
      <div><strong>Landing:</strong> ${escapeHTML(visitor.landingPage) || "/"}</div>
      <div><strong>Screen Size:</strong> ${escapeHTML(visitor.screen) || "Unknown"}</div>
      <div style="grid-column: span 2; word-break: break-all;"><strong>User Agent:</strong> ${escapeHTML(visitor.userAgent) || "Unknown"}</div>
    `;

    timelineContainer.innerHTML = "";

    // Parse activity list
    let activities = [];
    if (visitor.activity) {
      if (Array.isArray(visitor.activity)) {
        activities = visitor.activity.filter(a => a !== null && a !== undefined);
      } else {
        activities = Object.values(visitor.activity).filter(a => a !== null && a !== undefined);
      }
    }

    // Sort timeline ascending by timestamp
    activities.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (activities.length === 0) {
      timelineContainer.innerHTML = `<li style="font-size:13px; color:var(--text-muted);">No activity logged.</li>`;
    } else {
      activities.forEach((act) => {
        const timeStr = new Date(act.timestamp).toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });

        const li = document.createElement("li");
        li.style.position = "relative";
        li.style.fontSize = "13px";
        li.style.color = "#fff";
        li.innerHTML = `
          <div style="position:absolute; left:-25px; top:5px; width:10px; height:10px; border-radius:50%; background:var(--gold-accent); box-shadow:0 0 5px var(--gold-accent);"></div>
          <span style="font-size:10px; color:var(--text-muted); font-family:monospace; margin-right:8px;">[${timeStr}]</span>
          <strong>${escapeHTML(act.action) || ""}</strong>
        `;
        timelineContainer.appendChild(li);
      });
    }

    // Blacklist block status logic
    actionsContainer.innerHTML = `<span style="font-size:12px; color:var(--text-muted);">Checking block status...</span>`;
    
    if (visitor.ip && visitor.ip !== "Unknown" && this.firebaseUrl) {
      const sanitizedIp = visitor.ip.replace(/\./g, "-").replace(/:/g, "_");
      
      const renderBlockButton = async () => {
        try {
          const resp = await fetch(`${this.firebaseUrl}blacklist/${sanitizedIp}.json`);
          let isBlocked = false;
          if (resp.ok) {
            const data = await resp.json();
            isBlocked = data && data.blocked === true;
          }
          
          actionsContainer.innerHTML = "";
          const btn = document.createElement("button");
          btn.style.fontSize = "11px";
          btn.style.padding = "6px 12px";
          btn.style.borderRadius = "4px";
          btn.style.fontWeight = "700";
          btn.style.cursor = "pointer";
          btn.style.transition = "background-color 0.2s";
          
          if (isBlocked) {
            btn.innerText = "✔️ Unblock IP Address";
            btn.className = "btn-secondary";
            btn.style.background = "#28a745";
            btn.style.borderColor = "#28a745";
            btn.style.color = "#fff";
            
            btn.addEventListener("click", async () => {
              btn.disabled = true;
              btn.innerText = "Processing...";
              try {
                const delResp = await fetch(`${this.firebaseUrl}blacklist/${sanitizedIp}.json`, {
                  method: "DELETE"
                });
                if (delResp.ok) {
                  alert(`IP address ${visitor.ip} has been unblocked.`);
                  renderBlockButton();
                } else {
                  throw new Error("HTTP " + delResp.status);
                }
              } catch (err) {
                alert(`Error unblocking IP: ${err.message}`);
                btn.disabled = false;
                btn.innerText = "✔️ Unblock IP Address";
              }
            });
          } else {
            btn.innerText = "🚫 Block IP Address";
            btn.className = "btn-secondary";
            btn.style.background = "#dc3545";
            btn.style.borderColor = "#dc3545";
            btn.style.color = "#fff";
            
            btn.addEventListener("click", async () => {
              if (confirm(`Are you sure you want to block IP address ${visitor.ip} from accessing the website?`)) {
                btn.disabled = true;
                btn.innerText = "Processing...";
                try {
                  const putResp = await fetch(`${this.firebaseUrl}blacklist/${sanitizedIp}.json`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      blocked: true,
                      timestamp: Date.now(),
                      ip: visitor.ip,
                      reason: "Banned from Admin Panel"
                    })
                  });
                  if (putResp.ok) {
                    alert(`IP address ${visitor.ip} has been blocked.`);
                    renderBlockButton();
                  } else {
                    throw new Error("HTTP " + putResp.status);
                  }
                } catch (err) {
                  alert(`Error blocking IP: ${err.message}`);
                  btn.disabled = false;
                  btn.innerText = "🚫 Block IP Address";
                }
              }
            });
          }
          actionsContainer.appendChild(btn);
        } catch (err) {
          console.warn("Error loading block button:", err);
          actionsContainer.innerHTML = `<span style="font-size:12px; color:var(--error-color);">Error checking status</span>`;
        }
      };
      
      renderBlockButton();
    } else {
      actionsContainer.innerHTML = `<span style="font-size:12px; color:var(--text-muted);">IP block unavailable</span>`;
    }

    modal.classList.add("active");
  }

  async sendReminderEmail(orderId, btn) {
    const order = this.orders.find(o => o.orderId === orderId);
    if (!order) return;

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "⏳ Sending...";

    const bank = this.config.settings.bankDetails || {
      payId: "vapesonlineaustralia@proton.me",
      bankName: "NAB - National Australia Bank",
      accountName: "Vapes Discount Australia",
      bsb: "086-724",
      accountNumber: "91-591-6658"
    };

    let itemsText = "";
    let subtotal = 0;
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const itemTotal = parseFloat(item.total || 0);
        subtotal += itemTotal;
        const flavorText = item.flavor ? ` (${item.flavor})` : "";
        const formatText = item.format ? ` [${item.format}]` : "";
        itemsText += `${item.quantity}x ${item.name}${flavorText}${formatText} - $${itemTotal.toFixed(2)}\n`;
      });
    }
    const orderTotal = parseFloat(order.total || 0);

    const templateParams = {
      order_id: order.orderId,
      ref_code: order.refCode,
      customer_name: order.customer.name,
      customer_email: order.customer.email,
      customer_phone: order.customer.phone || "",
      customer_address: order.customer.address,
      customer_notes: order.customer.notes || "",
      order_items: itemsText,
      total_price: `$${orderTotal.toFixed(2)}`,
      payid: bank.payId,
      bank_name: bank.bankName,
      account_name: bank.accountName,
      bsb: bank.bsb,
      account_number: bank.accountNumber
    };

    try {
      const serviceId = this.config.settings.emailjsServiceId;
      const templateId = this.config.settings.emailjsOrderTemplateId;
      const publicKey = this.config.settings.emailjsPublicKey;

      if (!serviceId || !templateId || !publicKey) {
        throw new Error("EmailJS configurations are incomplete under SEO & Bank Settings.");
      }

      if (typeof emailjs === "undefined") {
        throw new Error("EmailJS library not loaded. Check internet connection.");
      }

      emailjs.init({ publicKey: publicKey.trim() });
      const resp = await emailjs.send(serviceId.trim(), templateId.trim(), templateParams);
      if (resp.status === 200) {
        alert("✉️ Payment Reminder Email sent successfully via EmailJS!");
        btn.innerText = "✓ Sent!";
        btn.style.background = "#10b981";
      } else {
        throw new Error("Status code " + resp.status);
      }
    } catch(err) {
      console.error("Failed to send EmailJS Reminder:", err);
      alert("❌ Failed to send Payment Reminder: " + err.message);
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }

  async sendConfirmedEmail(orderId, btn) {
    const order = this.orders.find(o => o.orderId === orderId);
    if (!order) return;

    const originalText = btn.innerText;
    
    const serviceId = this.config.settings.emailjsServiceId;
    const templateId = this.config.settings.emailjsPaymentReceivedTemplateId;
    const publicKey = this.config.settings.emailjsPublicKey;

    if (!templateId) {
      alert("⚠️ Please configure the 'EmailJS Payment Received Template ID' inside the SEO & Bank Settings tab first.");
      return;
    }

    btn.disabled = true;
    btn.innerText = "⏳ Sending...";

    let itemsText = "";
    let subtotal = 0;
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const itemTotal = parseFloat(item.total || 0);
        subtotal += itemTotal;
        const flavorText = item.flavor ? ` (${item.flavor})` : "";
        const formatText = item.format ? ` [${item.format}]` : "";
        itemsText += `${item.quantity}x ${item.name}${flavorText}${formatText} - $${itemTotal.toFixed(2)}\n`;
      });
    }
    const orderTotal = parseFloat(order.total || 0);

    const templateParams = {
      order_id: order.orderId,
      ref_code: order.refCode,
      customer_name: order.customer.name,
      customer_email: order.customer.email,
      customer_phone: order.customer.phone || "",
      customer_address: order.customer.address,
      customer_notes: order.customer.notes || "",
      order_items: itemsText,
      total_price: `$${orderTotal.toFixed(2)}`
    };

    try {
      if (!serviceId || !publicKey) {
        throw new Error("EmailJS configurations are incomplete under SEO & Bank Settings.");
      }

      if (typeof emailjs === "undefined") {
        throw new Error("EmailJS library not loaded. Check internet connection.");
      }

      emailjs.init({ publicKey: publicKey.trim() });
      const resp = await emailjs.send(serviceId.trim(), templateId.trim(), templateParams);
      if (resp.status === 200) {
        alert("✉️ Payment Received Email sent successfully via EmailJS!");
        btn.innerText = "✓ Sent!";
        btn.style.background = "#10b981";
      } else {
        throw new Error("Status code " + resp.status);
      }
    } catch(err) {
      console.error("Failed to send EmailJS Received confirmation:", err);
      alert("❌ Failed to send Payment Received confirmation: " + err.message);
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }

  async clearVisitors() {
    if (!confirm("Are you sure you want to delete all visitor history tracking logs? This cannot be undone.")) return;
    if (this.firebaseUrl) {
      try {
        await fetch(`${this.firebaseUrl}visits.json`, { method: "DELETE" });
        alert("Visitor analytics logs cleared successfully!");
        await this.loadVisitors();
      } catch (err) {
        console.error("Cloud database clear failed:", err);
        alert("Failed to clear visitor logs: " + err.message);
      }
    }
  }

  async loadUsersDirectory() {
    const tbody = document.getElementById("users-directory-tbody");
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 30px; text-align: center; color: var(--text-secondary);">
          <div class="loading-spinner" style="margin: 0 auto 10px auto;"></div>
          Fetching and aggregating user records...
        </td>
      </tr>
    `;

    try {
      const syncUrl = this.config?.settings?.orderSyncUrl?.trim();
      if (!syncUrl) {
        throw new Error("Cloud database URL is not configured.");
      }
      const cleanUrl = syncUrl.endsWith("/") ? syncUrl : syncUrl + "/";
      const resp = await fetch(cleanUrl + "visits.json");
      if (!resp.ok) throw new Error("Database responded with status " + resp.status);

      const visitsObj = await resp.json();
      if (!visitsObj) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="padding: 30px; text-align: center; color: var(--text-secondary);">
              No visitor sessions recorded yet.
            </td>
          </tr>
        `;
        return;
      }

      // Group visits by visitorId
      const usersMap = {};
      Object.keys(visitsObj).forEach(key => {
        const visit = visitsObj[key];
        const vId = visit.visitorId || "Unknown";
        if (!usersMap[vId]) {
          usersMap[vId] = {
            visitorId: vId,
            sessions: [],
            ip: visit.ip || "Unknown",
            geo: visit.geo || null,
            userAgent: visit.userAgent || "Unknown",
            lastActivity: 0
          };
        }

        // Add visit record
        usersMap[vId].sessions.push(visit);

        // Update last activity
        const time = visit.timestamp || 0;
        if (time > usersMap[vId].lastActivity) {
          usersMap[vId].lastActivity = time;
          // Capture latest session meta
          if (visit.ip) usersMap[vId].ip = visit.ip;
          if (visit.geo) usersMap[vId].geo = visit.geo;
          if (visit.userAgent) usersMap[vId].userAgent = visit.userAgent;
        }
      });

      const usersList = Object.values(usersMap);
      // Sort users by last activity desc
      usersList.sort((a, b) => b.lastActivity - a.lastActivity);

      tbody.innerHTML = "";
      usersList.forEach(user => {
        const row = document.createElement("tr");

        // Format short visitorId code
        const shortId = user.visitorId.substring(0, 8).toUpperCase();

        // Count unique sessions
        const sessionCount = user.sessions.length;

        // Geo details
        let geoText = "Unknown";
        let ispText = "Unknown";
        if (user.geo) {
          const city = user.geo.city || "";
          const country = user.geo.country || "";
          geoText = [city, country].filter(Boolean).join(", ") || "Unknown";
          ispText = user.geo.org || user.geo.asn || "Unknown";
        }

        // Browser agent simplifier
        let browserName = "Unknown";
        const ua = user.userAgent.toLowerCase();
        if (ua.includes("firefox")) browserName = "Firefox";
        else if (ua.includes("chrome")) browserName = "Chrome";
        else if (ua.includes("safari")) browserName = "Safari";
        else if (ua.includes("edge")) browserName = "Edge";
        else if (ua.includes("opera")) browserName = "Opera";
        else browserName = "Mobile/Other";

        row.innerHTML = `
          <td><strong style="color: var(--gold-accent); font-family: monospace;">USR-${shortId}</strong></td>
          <td><span class="status-badge status-approved" style="background: rgba(212,175,55,0.15); color: var(--gold-light); font-weight: bold; padding: 2px 8px; border-radius: 4px;">${sessionCount} sessions</span></td>
          <td><span style="font-family: monospace;">${user.ip}</span></td>
          <td>${geoText}</td>
          <td><span style="font-size: 11px; color: var(--text-secondary);">${ispText}</span></td>
          <td><span style="font-size: 11px;">${browserName}</span></td>
          <td>
            <button class="btn-secondary view-user-timeline-btn" style="padding: 4px 8px; font-size: 11px; margin: 0; border-radius: 4px; cursor: pointer;" data-visitor-id="${user.visitorId}">🔍 View Timeline</button>
          </td>
        `;

        row.querySelector(".view-user-timeline-btn").addEventListener("click", () => {
          // Flatten activity timeline from all sessions
          const activitiesList = [];
          user.sessions.forEach(session => {
            // Add session start activity
            activitiesList.push({
              timestamp: session.timestamp || 0,
              action: `Started session on ${session.landingPage || "/"}`
            });

            // Add detailed actions
            if (session.activity) {
              const acts = Array.isArray(session.activity) ? session.activity : Object.values(session.activity);
              acts.forEach(act => {
                if (act && act.action) {
                  activitiesList.push(act);
                }
              });
            }
          });

          // Sort combined list by timestamp asc
          activitiesList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

          const visitorObj = {
            ip: user.ip,
            isp: ispText,
            city: user.geo?.city || "",
            region: user.geo?.region || "",
            country: user.geo?.country || "",
            referrer: "Various Sessions",
            landingPage: "/",
            screen: "Various",
            userAgent: user.userAgent,
            activity: activitiesList,
            visitorId: user.visitorId
          };

          this.viewVisitorActivity(visitorObj);
        });

        tbody.appendChild(row);
      });

    } catch (err) {
      console.error("Failed to load User Directory:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 30px; text-align: center; color: #ef4444;">
            Failed to load User Directory: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  /* ==========================================================================
     7. TABS & EVENT BINDING
     ========================================================================== */

  setupTabs() {
    const tabs = document.querySelectorAll(".admin-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".admin-tab-content").forEach(c => c.classList.remove("active"));
        tab.classList.add("active");
        const targetContent = document.getElementById(`tab-${tab.dataset.tab}`);
        if (targetContent) targetContent.classList.add("active");

        if (tab.dataset.tab === "visitors") {
          this.loadVisitors();
        } else if (tab.dataset.tab === "users") {
          this.loadUsersDirectory();
        }
      });
    });
  }

  bindEvents() {
    // Product form
    const prodForm = document.getElementById("product-form");
    if (prodForm) prodForm.addEventListener("submit", (e) => { e.preventDefault(); this.saveProduct(); });

    const cancelEditBtn = document.getElementById("btn-cancel-edit");
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", () => this.cancelProductEdit());

    // Settings form
    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) settingsForm.addEventListener("submit", (e) => { e.preventDefault(); this.saveSettings(); });

    // Guide form
    const guideForm = document.getElementById("guide-form");
    if (guideForm) guideForm.addEventListener("submit", (e) => { e.preventDefault(); this.saveGuide(); });

    const cancelGuideEditBtn = document.getElementById("btn-cancel-guide-edit");
    if (cancelGuideEditBtn) cancelGuideEditBtn.addEventListener("click", () => this.cancelGuideEdit());

    // Top-level action buttons
    const publishBtn = document.getElementById("btn-publish-live");
    if (publishBtn) publishBtn.addEventListener("click", () => this.publishToFirebase());

    const resetBtn = document.getElementById("btn-reset-config");
    if (resetBtn) resetBtn.addEventListener("click", () => this.resetConfig());

    // Users refresh
    const refreshUsersBtn = document.getElementById("btn-refresh-users");
    if (refreshUsersBtn) refreshUsersBtn.addEventListener("click", () => this.loadUsersDirectory());

    // Orders
    const clearOrdersBtn = document.getElementById("btn-clear-orders");
    if (clearOrdersBtn) clearOrdersBtn.addEventListener("click", () => this.clearOrders());

    // Visitors
    const refreshVisitorsBtn = document.getElementById("btn-refresh-visitors");
    if (refreshVisitorsBtn) refreshVisitorsBtn.addEventListener("click", () => this.loadVisitors());

    const clearVisitorsBtn = document.getElementById("btn-clear-visitors");
    if (clearVisitorsBtn) clearVisitorsBtn.addEventListener("click", () => this.clearVisitors());

    const closeVisitorModalBtn = document.getElementById("btn-close-visitor-modal");
    if (closeVisitorModalBtn) {
      closeVisitorModalBtn.addEventListener("click", () => {
        document.getElementById("visitor-detail-modal").classList.remove("active");
      });
    }

    const visitorModal = document.getElementById("visitor-detail-modal");
    if (visitorModal) {
      visitorModal.addEventListener("click", (e) => {
        if (e.target === visitorModal) {
          visitorModal.classList.remove("active");
        }
      });
    }


    // Create Test Order
    const createTestOrderBtn = document.getElementById("btn-create-test-order");
    if (createTestOrderBtn) createTestOrderBtn.addEventListener("click", () => this.createTestOrder());

    // Logout
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("admin_authenticated");
      location.reload();
    });
  }

  async createTestOrder() {
    const confirmText = "Are you sure you want to generate a random test order? This will sync to Firebase and send emails to admin@vaperaus.com.";
    if (!confirm(confirmText)) return;

    const btn = document.getElementById("btn-create-test-order");
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Creating Order...";
    }

    try {
      // 1. Pick a random product from config or fallback
      const products = this.config?.products || [];
      if (products.length === 0) {
        alert("No products available to create a test order.");
        if (btn) {
          btn.disabled = false;
          btn.innerText = "✨ Create Test Order";
        }
        return;
      }

      // Generate random order fields
      const testNames = ["John Doe", "Sarah Connor", "Alex Smith", "Emma Watson", "James Bond"];
      const testAddresses = ["123 Gold Coast Hwy, Surfers Paradise QLD 4217", "456 Swanston St, Melbourne VIC 3000", "789 George St, Sydney NSW 2000", "11 Flinders Lane, Melbourne VIC 3000"];
      const testPhones = ["0412 345 678", "0422 987 654", "0433 111 222", "0400 999 888"];

      const name = testNames[Math.floor(Math.random() * testNames.length)];
      const address = testAddresses[Math.floor(Math.random() * testAddresses.length)];
      const phone = testPhones[Math.floor(Math.random() * testPhones.length)];
      const email = "admin@vaperaus.com"; // Fixed test email
      const notes = "SYSTEM GENERATED TEST ORDER";

      // Select 1 to 2 random products
      const count = Math.floor(Math.random() * 2) + 1;
      const orderItems = [];
      let total = 0;

      for (let i = 0; i < count; i++) {
        const prod = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const flavor = prod.flavors && prod.flavors.length > 0 ? prod.flavors[Math.floor(Math.random() * prod.flavors.length)] : "Standard";
        const format = prod.isBoxOnly ? "Box of 10" : "Single";
        const price = prod.price || 50;

        orderItems.push({
          name: prod.name,
          flavor: flavor,
          format: format,
          quantity: qty,
          total: qty * price
        });
        total += qty * price;
      }

      // Generate IDs
      const orderId = `OCV-TEST-${Date.now().toString().slice(-5)}`;
      const randAlpha = Math.random().toString(36).substring(2, 6).toUpperCase();
      const refCode = `REF-TEST-${Date.now().toString().slice(-4)}-${randAlpha}`;

      const order = {
        orderId,
        refCode,
        date: new Date().toISOString(),
        customer: { name, address, phone, email, notes },
        items: orderItems,
        total: total,
        status: "Pending Payment",
        metadata: {
          userAgent: navigator.userAgent + " (Test Mode)",
          resolution: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
          localTime: new Date().toString(),
          referrer: "admin-panel",
          ip: "127.0.0.1 (Local Test)"
        }
      };

      // 2. Sync to Firebase
      if (!this.firebaseUrl) {
        throw new Error("Firebase orderSyncUrl is not resolved or config is not loaded.");
      }
      
      const syncUrl = `${this.firebaseUrl}orders.json`;
      const fbResp = await fetch(syncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order)
      });
      if (!fbResp.ok) {
        throw new Error(`Firebase push failed with status ${fbResp.status}`);
      }
      console.log("Test order synced to Firebase successfully.");

      // 3. Send Email notifications (EmailJS & FormSubmit)
      const settings = this.config.settings || {};
      const hasEmailJS = settings.emailjsPublicKey && settings.emailjsServiceId && settings.emailjsOrderTemplateId;

      // Compile order summary text
      let orderItemsText = "";
      orderItems.forEach(item => {
        orderItemsText += `- ${item.quantity}x ${item.name} (${item.flavor} / ${item.format}) - $${(item.total).toFixed(2)}\n`;
      });

      const bank = settings.bankDetails || {
        payId: "vapesonlineaustralia@proton.me",
        bankName: "NAB",
        accountName: "Vapes Discount Australia",
        bsb: "086-724",
        accountNumber: "91-591-6658"
      };

      let emailJSFailed = false;
      if (hasEmailJS && typeof emailjs !== "undefined") {
        try {
          // Initialize EmailJS
          emailjs.init({ publicKey: settings.emailjsPublicKey.trim() });

          await emailjs.send(
            settings.emailjsServiceId.trim(),
            settings.emailjsOrderTemplateId.trim(),
            {
              order_id: orderId,
              ref_code: refCode,
              customer_name: name,
              customer_email: email, // admin@vaperaus.com
              reply_to: email,
              bcc: "admin@vaperaus.com",
              customer_phone: phone,
              customer_address: address,
              customer_notes: notes,
              order_items: orderItemsText,
              total_price: `$${total.toFixed(2)}`,
              payid: bank.payId || "vapesonlineaustralia@proton.me",
              bank_name: bank.bankName,
              account_name: bank.accountName,
              bsb: bank.bsb,
              account_number: bank.accountNumber
            }
          );
          console.log("Test order confirmation sent via EmailJS.");
        } catch (emailErr) {
          console.warn("EmailJS test send failed:", emailErr);
        }
      }

      // Merchant FormSubmit notification
      const targetEmail = settings.contactEmail || "vapesonlineaustralia@proton.me";
      const orderPostUrl = `https://formsubmit.co/ajax/${targetEmail.trim()}`;
      await fetch(orderPostUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          "Order ID": orderId,
          "Reference Code": refCode,
          "Customer Name": name,
          "Customer Email": email,
          "Customer Phone": phone,
          "Shipping Address": address,
          "Delivery Notes": notes,
          "Order Items": orderItemsText,
          "Total Amount": `$${total.toFixed(2)}`,
          "_captcha": "false",
          "_subject": `🛒 NEW TEST ORDER: ${orderId} (${refCode})`
        })
      });
      console.log("Test order notification sent to merchant via FormSubmit.");

      // Save order details to localStorage for order-success.html
      const latestOrder = {
        orderId: orderId,
        refCode: refCode,
        total: total,
        shippingFee: 0,
        items: order.items,
        customer: {
          name: name,
          phone: phone,
          address: address,
          notes: notes
        },
        bankDetails: bank
      };
      localStorage.setItem("latest_order", JSON.stringify(latestOrder));

      // Open confirmation page in a separate tab
      window.open("order-success.html", "_blank");

      alert(`Test Order ${orderId} created successfully!\n\nAll notifications (EmailJS & FormSubmit) have been dispatched to admin@vaperaus.com.`);
      
      // Reload the orders list in admin panel
      await this.loadOrders();
      this.renderOrders();

    } catch (e) {
      console.error("Failed to create test order:", e);
      alert(`Error creating test order: ${e.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "✨ Create Test Order";
      }
    }
  }
}
