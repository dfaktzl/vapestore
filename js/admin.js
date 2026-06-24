/* ==========================================================================
   MERCHANT DASHBOARD CONTROLLER (OZCHEAPVAPES REBRAND)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  window.adminApp = new AdminApp();
});

class AdminApp {
  constructor() {
    this.config = null;
    this.orders = [];
    this.init();
  }

  async init() {
    this.setupTabs();
    await this.loadConfig();
    this.loadOrders();
    
    // Populate form fields with config settings
    this.populateSettingsForm();
    this.renderProductsList();
    this.renderOrders();
    
    // Setup event handlers
    this.bindEvents();
  }

  /* ==========================================================================
     1. INITIALIZATION & DATA SYNCING
     ========================================================================== */
  
  setupTabs() {
    const tabs = document.querySelectorAll(".admin-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        // Remove active class from all tabs & contents
        tabs.forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".admin-tab-content").forEach(c => c.classList.remove("active"));
        
        // Add active to current
        tab.classList.add("active");
        const contentId = `tab-${tab.dataset.tab}`;
        const targetContent = document.getElementById(contentId);
        if (targetContent) targetContent.classList.add("active");
      });
    });
  }

  async loadConfig() {
    // 1. Check local storage cache first
    const cached = localStorage.getItem("crown_gold_config");
    if (cached) {
      try {
        this.config = JSON.parse(cached);
        console.log("Admin loaded config from local storage cache.");
        return;
      } catch (e) {
        console.error("Failed to parse cached config, resetting.", e);
      }
    }

    // 2. Try fetching config.json from server
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
      this.config = JSON.parse(JSON.stringify(window.CONFIG_DEFAULT)); // Deep copy
      console.log("Admin loaded config from config_default.js fallback.");
    } else {
      alert("Error: Default configuration variables missing.");
    }
  }

  saveConfigPreview() {
    // Saves current settings in browser cache for storefront preview
    localStorage.setItem("crown_gold_config", JSON.stringify(this.config));
  }

  loadOrders() {
    const stored = localStorage.getItem("crown_gold_orders");
    if (stored) {
      try {
        this.orders = JSON.parse(stored);
      } catch(e) {
        this.orders = [];
      }
    }
  }

  /* ==========================================================================
     2. SETTINGS POPULATION & SAVING
     ========================================================================== */
  
  populateSettingsForm() {
    if (!this.config) return;
    
    // SEO
    document.getElementById("set-seo-title").value = this.config.seo.title || "";
    document.getElementById("set-seo-desc").value = this.config.seo.description || "";
    
    // Contact
    document.getElementById("set-contact-email").value = this.config.settings.contactEmail || "";
    document.getElementById("set-contact-phone").value = this.config.settings.contactPhone || "";
    document.getElementById("set-announcement").value = this.config.settings.announcement || "";
    
    // Bank & PayID
    const bank = this.config.settings.bankDetails;
    document.getElementById("set-payid").value = bank.payId || "";
    document.getElementById("set-bank-name").value = bank.bankName || "";
    document.getElementById("set-bank-holder").value = bank.accountName || "";
    document.getElementById("set-bank-bsb").value = bank.bsb || "";
    document.getElementById("set-bank-account").value = bank.accountNumber || "";
  }

  saveSettings() {
    if (!this.config) return;

    // Update settings objects
    this.config.seo.title = document.getElementById("set-seo-title").value;
    this.config.seo.description = document.getElementById("set-seo-desc").value;
    
    this.config.settings.contactEmail = document.getElementById("set-contact-email").value;
    this.config.settings.contactPhone = document.getElementById("set-contact-phone").value;
    this.config.settings.announcement = document.getElementById("set-announcement").value;
    
    this.config.settings.bankDetails = {
      payId: document.getElementById("set-payid").value,
      bankName: document.getElementById("set-bank-name").value,
      accountName: document.getElementById("set-bank-holder").value,
      bsb: document.getElementById("set-bank-bsb").value,
      accountNumber: document.getElementById("set-bank-account").value
    };
    
    this.saveConfigPreview();
    alert("Settings saved in local browser cache. Click 'Export config.json' to generate deploy files.");
  }

  /* ==========================================================================
     3. PRODUCT CRUD ENGINE
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
      
      // Bind Edit & Delete clicks
      tr.querySelector(".edit-btn").addEventListener("click", () => this.editProduct(prod));
      tr.querySelector(".delete-btn").addEventListener("click", () => this.deleteProduct(prod.id));
      
      listBody.appendChild(tr);
    });
  }

  saveProduct() {
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
    
    // Parse flavors
    const flavors = flavorsRaw ? flavorsRaw.split(",").map(f => f.trim()).filter(f => f !== "") : [];
    const boxPrice = isNaN(boxPriceVal) ? price : boxPriceVal;

    const productData = {
      brand,
      name,
      category,
      price,
      boxPrice,
      isBoxOnly,
      image,
      flavors,
      description,
      inStock: true
    };
    
    if (editId) {
      // Edit existing product
      const index = this.config.products.findIndex(p => p.id === editId);
      if (index !== -1) {
        this.config.products[index] = { ...this.config.products[index], ...productData };
      }
      this.cancelProductEdit();
    } else {
      // Create new product
      productData.id = `prod-${Date.now()}`;
      productData.popular = false;
      this.config.products.push(productData);
      
      // Reset form
      document.getElementById("product-form").reset();
    }
    
    this.saveConfigPreview();
    this.renderProductsList();
  }

  editProduct(product) {
    // Fill form inputs
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
    
    // Swap header text & buttons
    document.getElementById("editor-title").innerText = `Edit: ${product.name}`;
    document.getElementById("btn-save-product").innerText = "Update Product";
    document.getElementById("btn-cancel-edit").style.display = "inline-flex";
    
    // Scroll form into view
    document.getElementById("product-editor-card").scrollIntoView({ behavior: "smooth" });
  }

  cancelProductEdit() {
    document.getElementById("edit-product-id").value = "";
    document.getElementById("product-form").reset();
    
    document.getElementById("editor-title").innerText = "Add New Catalog Product";
    document.getElementById("btn-save-product").innerText = "Add Product";
    document.getElementById("btn-cancel-edit").style.display = "none";
  }

  deleteProduct(productId) {
    if (confirm("Are you sure you want to delete this product from the inventory?")) {
      this.config.products = this.config.products.filter(p => p.id !== productId);
      this.saveConfigPreview();
      this.renderProductsList();
    }
  }

  /* ==========================================================================
     4. EXPORT / IMPORT ENGINE
     ========================================================================== */
  
  exportConfig() {
    if (!this.config) return;
    
    // Format JSON with 2-spaces indentation
    const jsonStr = JSON.stringify(this.config, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "config.json";
    
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  importConfig(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        
        // Simple schema validation
        if (parsed.products && parsed.settings && parsed.seo) {
          this.config = parsed;
          this.saveConfigPreview();
          this.populateSettingsForm();
          this.renderProductsList();
          alert("config.json successfully imported! Edits applied to browser cache.");
        } else {
          alert("Invalid config schema. Make sure the JSON contains products, settings, and seo properties.");
        }
      } catch (err) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  resetConfig() {
    if (confirm("WARNING: This will clear all custom edits and reset the store to the default catalog. Do you want to continue?")) {
      localStorage.removeItem("crown_gold_config");
      this.loadConfig().then(() => {
        this.populateSettingsForm();
        this.renderProductsList();
        alert("Configuration restored to defaults.");
      });
    }
  }

  /* ==========================================================================
     5. ORDERS VIEWER
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
      
      // Items list HTML
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
      
      // Log client agent metadata if stored
      let metaHTML = "";
      if (order.metadata) {
        metaHTML = `
          <p style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.05); font-size:11px; color:var(--text-muted);">
            <strong>Client System Log:</strong> UA: ${order.metadata.userAgent.slice(0, 75)}... | Res: ${order.metadata.resolution} | Lang: ${order.metadata.language}
          </p>
        `;
      }
      
      card.innerHTML = `
        <div class="order-card-header">
          <div class="order-id-block">
            <span class="order-id">Order ID: ${order.orderId}</span>
            <span class="order-date">Date: ${formattedDate}</span>
          </div>
          <span class="order-ref">${order.refCode}</span>
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
              <tbody>
                ${itemsHTML}
              </tbody>
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
  }

  clearOrders() {
    if (confirm("Are you sure you want to delete all order history logs? This cannot be undone.")) {
      localStorage.removeItem("crown_gold_orders");
      this.orders = [];
      this.renderOrders();
    }
  }

  /* ==========================================================================
     6. EVENTS BINDING
     ========================================================================== */
  
  bindEvents() {
    // Form saving logic
    const prodForm = document.getElementById("product-form");
    if (prodForm) {
      prodForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveProduct();
      });
    }
    
    const cancelEditBtn = document.getElementById("btn-cancel-edit");
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", () => this.cancelProductEdit());
    }
    
    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
      settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }
    
    // Export/Reset buttons
    document.getElementById("btn-export-config").addEventListener("click", () => this.exportConfig());
    document.getElementById("btn-reset-config").addEventListener("click", () => this.resetConfig());
    
    // File upload loading
    const configUpload = document.getElementById("config-upload");
    if (configUpload) {
      configUpload.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          this.importConfig(e.target.files[0]);
        }
      });
    }
    
    // Clear Orders
    const clearOrdersBtn = document.getElementById("btn-clear-orders");
    if (clearOrdersBtn) {
      clearOrdersBtn.addEventListener("click", () => this.clearOrders());
    }
  }
}
