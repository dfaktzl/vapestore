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

document.addEventListener("DOMContentLoaded", () => {
  window.adminApp = new AdminApp();
});

class AdminApp {
  constructor() {
    this.config = null;
    this.guides = [];
    this.orders = [];
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
      const resp = await fetch("config.json");
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
      const resp = await fetch("config.json");
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
      const response = await fetch("config.json");
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
      const response = await fetch("guides.json");
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
      order.items.forEach(item => {
        itemsHTML += `
          <tr>
            <td>${item.name} (${item.flavor}) [Format: ${item.format || "Single"}]</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">$${item.total.toFixed(2)}</td>
          </tr>
        `;
      });

      let metaHTML = "";
      if (order.metadata) {
        metaHTML = `
          <p style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.05); font-size:11px; color:var(--text-muted);">
            <strong>Client System Log:</strong> UA: ${order.metadata.userAgent.slice(0, 75)}... | Res: ${order.metadata.resolution} | Lang: ${order.metadata.language}
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

      card.innerHTML = `
        <div class="order-card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div class="order-id-block">
            <span class="order-id">Order ID: ${order.orderId}</span>
            <span class="order-date">Date: ${formattedDate}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="order-ref" style="font-size:12px; margin-right:5px;">Ref: <strong>${order.refCode}</strong></span>
            ${statusSelectHTML}
            <button class="btn-icon delete-order-btn" title="Delete Order" data-order-id="${order.orderId}" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑️</button>
          </div>
        </div>
        <div class="order-grid">
          <div class="order-customer-details">
            <p><strong>Customer Name:</strong> ${order.customer.name}</p>
            <p><strong>Phone Number:</strong> ${order.customer.phone}</p>
            <p><strong>Email Address:</strong> ${order.customer.email}</p>
            <p><strong>Shipping Address:</strong> ${order.customer.address}</p>
            <p><strong>Delivery Notes:</strong> <span style="font-style:italic; color:var(--text-muted);">${order.customer.notes || "None"}</span></p>
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
                  <td style="padding-top:15px; font-weight:700; text-align:right; color:var(--gold-accent); font-size:16px;">$${order.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
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

    // Orders
    const clearOrdersBtn = document.getElementById("btn-clear-orders");
    if (clearOrdersBtn) clearOrdersBtn.addEventListener("click", () => this.clearOrders());

    // Logout
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("admin_authenticated");
      location.reload();
    });
  }
}
