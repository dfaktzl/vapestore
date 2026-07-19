/* ==========================================================================
   STOREFRONT MAIN CONTROLLER (Vape Matrix REBRAND)
   ========================================================================== */

// Safe localStorage wrapper to prevent exceptions under file:// or cookie-blocked environments
const localStorage = (() => {
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    console.warn("localStorage is blocked or unavailable. Falling back to in-memory storage.", e);
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
  window.store = new StoreApp();
});

class StoreApp {
  constructor() {
    this.config = null;
    this.guides = [];
    this.cart = [];
    
    // UI state
    this.activeCategory = "all";
    this.selectedBrands = [];
    this.selectedPrices = [];
    this.selectedFormats = [];
    this.searchQuery = "";
    this.currentSort = "featured";
    
    // Active modal states
    this.selectedProduct = null;
    this.selectedFlavor = "";
    this.selectedFormat = "Single";
    
    this.init();
  }

  async init() {
    this.setupAgeGate();
    await this.loadConfig();
    await this.loadGuides();
    this.loadCart();
    
    // Once configuration is loaded, initialize dynamic SEO and settings
    this.applySEO();
    this.applySettings();
    this.initEmailJS();
    this.initPromoBanner();
    
    // Render templates
    this.renderCategoryTabs();
    this.renderBrandFilters();
    this.renderProducts();
    this.renderFeaturedProducts();
    this.renderGuides();
    this.generateSEOSchema();
    
    // Apply saved logo style
    const savedLogo = localStorage.getItem("vape_matrix_logo_style") || "2";
    this.applyLogoStyle(savedLogo);
    
    // Bind all events
    this.bindEvents();
    
    // Update cart counts
    this.updateCartUI();

    // Log visitor session & details
    await this.trackVisitor();
  }

  /* ==========================================================================
     1. CONFIG & CACHE ENGINE
     ========================================================================== */
  
  setupAgeGate() {
    const ageGate = document.getElementById("age-gate");
    const verifyBtn = document.getElementById("btn-age-verify");
    const rejectBtn = document.getElementById("btn-age-reject");
    const clearCookieBtn = document.getElementById("footer-btn-clear-cookie");

    // Check age consent
    if (ageGate && localStorage.getItem("vape_matrix_age_verified") === "true") {
      ageGate.classList.add("hidden");
    }

    if (verifyBtn) {
      verifyBtn.addEventListener("click", () => {
        localStorage.setItem("vape_matrix_age_verified", "true");
        if (ageGate) ageGate.classList.add("hidden");
      });
    }

    if (rejectBtn) {
      rejectBtn.addEventListener("click", () => {
        window.location.href = "https://www.google.com";
      });
    }

    if (clearCookieBtn) {
      clearCookieBtn.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("vape_matrix_age_verified");
        alert("Age Verification cache cleared. The age gate will show on next reload.");
        location.reload();
      });
    }
  }

  initPromoBanner() {
    const promoCountEl = document.getElementById("promo-spots-count");
    if (!promoCountEl) return;

    // Use a reference date of July 4th (campaign start date)
    // To ensure the number starts at 36 today, and decreases deterministically every 3.5 hours on average.
    const baseTime = new Date("2026-07-04T00:00:00").getTime();
    const currentTime = Date.now();
    const diffHours = (currentTime - baseTime) / (1000 * 60 * 60);

    // Let's decrement from 36 every 3.5 hours on average.
    let currentSpots = 36;
    
    // Calculate the total steps elapsed since baseTime (only positive values count)
    const stepSizeHours = 3.5;
    const totalSteps = diffHours > 0 ? Math.floor(diffHours / stepSizeHours) : 0;

    for (let i = 0; i < totalSteps; i++) {
      // Deterministically pick 1 or 2 based on step index i.
      const deduction = ((i * 17 + 5) % 2 === 0) ? 2 : 1;
      currentSpots -= deduction;
    }

    // Keep the number wrapping in a realistic loop (so it never hits 0 or looks expired).
    // Let's wrap around to stay between 4 and 15 spots left once depleted.
    if (currentSpots < 4) {
      currentSpots = 15 - (Math.abs(currentSpots) % 12);
      if (currentSpots < 4) currentSpots = 4;
    }

    promoCountEl.innerText = currentSpots;
  }

  async loadConfig() {
    // 1. Load base configuration from config.json, or fallback JS defaults
    let baseConfig = null;

    try {
      const response = await fetch("config.json?v=15");
      if (response.ok) {
        baseConfig = await response.json();
        console.log("Loaded base configuration from config.json.");
      }
    } catch (e) {
      console.warn("Could not load config.json. Falling back to default script.");
    }

    if (!baseConfig && window.CONFIG_DEFAULT) {
      baseConfig = JSON.parse(JSON.stringify(window.CONFIG_DEFAULT));
      console.log("Loaded base configuration from config_default.js fallback.");
    }

    if (!baseConfig) {
      alert("Error: Core configuration failed to load.");
      return;
    }

    this.config = baseConfig;

    // 2. Try fetching live configuration from Firebase if sync URL exists
    const syncUrl = baseConfig.settings?.orderSyncUrl?.trim();
    if (syncUrl) {
      const cleanUrl = syncUrl.endsWith("/") ? syncUrl : syncUrl + "/";
      try {
        const fbResponse = await fetch(`${cleanUrl}config.json`);
        if (fbResponse.ok) {
          const fbConfig = await fbResponse.json();
          if (fbConfig && fbConfig.products && fbConfig.settings) {
            this.config = fbConfig;
            console.log("Loaded live configuration from Firebase.");
          }
        }
      } catch (e) {
        console.warn("Could not load live configuration from Firebase. Using base configuration.", e);
      }
    }
  }

  async loadGuides() {
    // 1. Load base guides from guides.json, or default guides
    let baseGuides = null;

    try {
      const response = await fetch("guides.json?v=3");
      if (response.ok) {
        baseGuides = await response.json();
        console.log("Loaded base guides from guides.json.");
      }
    } catch (e) {
      console.warn("Could not load guides.json. Using fallback default.");
    }

    this.guides = baseGuides || [];

    // 2. Try fetching live guides from Firebase if sync URL exists
    const syncUrl = this.config?.settings?.orderSyncUrl?.trim();
    if (syncUrl) {
      const cleanUrl = syncUrl.endsWith("/") ? syncUrl : syncUrl + "/";
      try {
        const fbResponse = await fetch(`${cleanUrl}guides.json`);
        if (fbResponse.ok) {
          const fbGuides = await fbResponse.json();
          if (Array.isArray(fbGuides)) {
            this.guides = fbGuides;
            console.log("Loaded live guides from Firebase.");
          }
        }
      } catch (e) {
        console.warn("Could not load live guides from Firebase. Using base guides.", e);
      }
    }
  }

  applySEO() {
    if (!this.config || !this.config.seo) return;
    document.title = this.config.seo.title || document.title;
    
    const metaDesc = document.getElementById("meta-description");
    if (metaDesc) {
      metaDesc.setAttribute("content", this.config.seo.description || "");
    }
  }

  applySettings() {
    if (!this.config || !this.config.settings) return;
    const settings = this.config.settings;
    
    // Announcement bar
    const barText = document.getElementById("announcement-text");
    if (barText) {
      barText.innerText = settings.announcement || "";
    }
    
    // Footer contact info
    const footerEmail = document.getElementById("footer-email");
    const footerPhone = document.getElementById("footer-phone");
    if (footerEmail) footerEmail.innerText = settings.contactEmail || "";
    if (footerPhone) footerPhone.innerText = settings.contactPhone || "";
  }

  initEmailJS() {
    if (this.config && this.config.settings && this.config.settings.emailjsPublicKey) {
      const pubKey = this.config.settings.emailjsPublicKey.trim();
      if (pubKey && typeof emailjs !== "undefined") {
        emailjs.init({ publicKey: pubKey });
        console.log("EmailJS initialized successfully.");
      }
    }
  }

  showBlockOverlay(ip) {
    document.body.innerHTML = `
      <div style="
        position: fixed;
        left: 0;
        top: 0;
        width: 100vw;
        height: 100vh;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: 'Times New Roman', Times, serif;
        color: #000000;
        padding: 20px;
        box-sizing: border-box;
      ">
        <div style="max-width: 600px; text-align: center;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Coat_of_Arms_of_Australia.svg/400px-Coat_of_Arms_of_Australia.svg.png" 
               alt="Australian Coat of Arms" 
               style="width: 200px; height: auto; margin-bottom: 25px;" />
          <h1 style="font-size: 20px; font-weight: bold; line-height: 1.6; margin: 0 0 15px 0;">
            The Australian Government has seized this website active immediately due to regulatory issues and other commerce failures, it is now the property of the Australian Competition & Consumer Commission (ACCC).
          </h1>
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            For a period of no more or less than (60) days is it to be held as seized or until the Illicit Tobacco Taskforce (ITTF) has finished their investigation.
          </p>
          <p style="font-size: 14px; font-style: italic; color: #555555; margin: 0;">
            We are sorry for any inconvenience.
          </p>
        </div>
      </div>
    `;
    document.body.style.background = "#ffffff";
    document.body.style.overflow = "hidden";
  }

  /* ==========================================================================
     2. RENDERERS
     ========================================================================== */
  
  renderCategoryTabs() {
    const container = document.getElementById("category-tabs");
    if (!container || !this.config || !this.config.categories) return;
    
    container.innerHTML = "";
    this.config.categories.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = `category-tab ${this.activeCategory === cat.id ? "active" : ""}`;
      btn.innerText = cat.name;
      btn.dataset.id = cat.id;
      
      btn.addEventListener("click", () => {
        this.setCategory(cat.id);
      });
      
      container.appendChild(btn);
    });
  }

  renderBrandFilters() {
    const container = document.getElementById("brand-filters");
    if (!container || !this.config || !this.config.products) return;
    
    const brands = [...new Set(this.config.products.map(p => p.brand))].sort();
    
    container.innerHTML = "";
    brands.forEach(brand => {
      const label = document.createElement("label");
      label.className = "filter-chip";
      
      const isChecked = this.selectedBrands.includes(brand);
      label.innerHTML = `
        <input type="checkbox" name="brand-filter" value="${brand}" class="filter-checkbox" ${isChecked ? "checked" : ""}>
        ${brand}
      `;
      
      label.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) {
          this.selectedBrands.push(brand);
        } else {
          this.selectedBrands = this.selectedBrands.filter(b => b !== brand);
        }
        this.renderProducts();
      });
      
      container.appendChild(label);
    });
  }

  renderProducts() {
    const grid = document.getElementById("products-grid");
    const counter = document.getElementById("displayed-products-count");
    if (!grid || !this.config || !this.config.products) return;
    
    // Filter logic
    let filtered = this.config.products.filter(prod => {
      if (this.activeCategory !== "all") {
        if (prod.category !== this.activeCategory) return false;
      }
      
      if (this.selectedBrands.length > 0) {
        if (!this.selectedBrands.includes(prod.brand)) return false;
      }
      
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const matchesName = prod.name.toLowerCase().includes(query);
        const matchesBrand = prod.brand.toLowerCase().includes(query);
        const matchesFlavor = prod.flavors.some(f => f.toLowerCase().includes(query));
        if (!matchesName && !matchesBrand && !matchesFlavor) return false;
      }
      
      if (this.selectedPrices.length > 0) {
        let matchPrice = false;
        if (this.selectedPrices.includes("under-50") && prod.price < 50) matchPrice = true;
        if (this.selectedPrices.includes("50-250") && prod.price >= 50 && prod.price <= 250) matchPrice = true;
        if (this.selectedPrices.includes("over-250") && prod.price > 250) matchPrice = true;
        if (!matchPrice) return false;
      }

      if (this.selectedFormats.length > 0) {
        let matchFormat = false;
        if (this.selectedFormats.includes("single") && !prod.isBoxOnly) matchFormat = true;
        if (this.selectedFormats.includes("box-only") && prod.isBoxOnly) matchFormat = true;
        if (!matchFormat) return false;
      }
      
      return true;
    });

    // Sort logic
    if (this.currentSort === "price-asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (this.currentSort === "price-desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (this.currentSort === "name-asc") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (counter) counter.innerText = filtered.length;
    grid.innerHTML = "";
    
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-catalog">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">No products match your criteria</h3>
          <p class="empty-desc">Try clearing filters or searching for another term.</p>
        </div>
      `;
      return;
    }
    
    filtered.forEach(prod => {
      const card = document.createElement("div");
      card.className = "product-card glass-card animate-slideup";
      
      let badgeHTML = "";
      if (prod.popular) {
        badgeHTML = `<div class="product-badge">Best Seller</div>`;
      } else if (prod.isBoxOnly) {
        badgeHTML = `<div class="product-badge">Wholesale Box Only</div>`;
      }
      
      // Flavor Dropdown
      let flavorHTML = "";
      if (prod.flavors && prod.flavors.length > 0) {
        flavorHTML = `<div class="form-field" style="margin-bottom:10px;"><select class="product-card-flavor-select" id="flavor-${prod.id}" style="margin-bottom:0;">`;
        prod.flavors.forEach(flavor => {
          flavorHTML += `<option value="${flavor}">${flavor}</option>`;
        });
        flavorHTML += `</select></div>`;
      }
      
      // Format Dropdown select (Single vs Box of 10)
      let formatHTML = "";
      if (prod.isBoxOnly) {
        formatHTML = `
          <div class="form-field" style="margin-bottom:12px;">
            <select class="product-card-flavor-select" id="format-${prod.id}" style="margin-bottom:0;" disabled>
              <option value="Box">Box of 10 Pack</option>
            </select>
          </div>
        `;
      } else {
        formatHTML = `
          <div class="form-field" style="margin-bottom:12px;">
            <select class="product-card-flavor-select" id="format-${prod.id}" style="margin-bottom:0;">
              <option value="Single">Single Unit ($${prod.price.toFixed(2)})</option>
              <option value="Box">Box of 10 ($${prod.boxPrice.toFixed(2)})</option>
            </select>
          </div>
        `;
      }
      
      // Prices row representation
      let priceRow = "";
      if (prod.isBoxOnly) {
        priceRow = `
          <div class="product-card-price-row">
            <span class="price-label">Wholesale Price:</span>
            <span class="price-value highlight-gold">$${prod.price.toFixed(2)}</span>
          </div>
        `;
      } else {
        priceRow = `
          <div class="product-card-price-row">
            <span class="price-label">Single Rate:</span>
            <span class="price-value">$${prod.price.toFixed(2)}</span>
          </div>
          <div class="product-card-price-row">
            <span class="price-label">Box Rate (10x):</span>
            <span class="price-value highlight-gold">$${prod.boxPrice.toFixed(2)}</span>
          </div>
        `;
      }
      
      card.innerHTML = `
        ${badgeHTML}
        <div class="product-card-image-wrap" style="cursor: pointer;">
          <img class="product-card-image" src="${prod.image}?v=2" alt="${prod.name}">
        </div>
        <div class="product-card-brand">${prod.brand}</div>
        <a href="#" class="product-card-name" id="name-${prod.id}">${prod.name}</a>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
          ${flavorHTML}
          ${formatHTML}
        </div>
        
        <div class="product-card-footer">
          <div class="product-card-prices">
            ${priceRow}
          </div>
          <button class="btn-primary btn-card-add" id="add-${prod.id}">Add to Cart</button>
        </div>
      `;
      
      const imgWrap = card.querySelector(".product-card-image-wrap");
      const nameLink = card.querySelector(`#name-${prod.id}`);
      const addBtn = card.querySelector(`#add-${prod.id}`);
      
      const openDetails = (e) => {
        e.preventDefault();
        this.openModal(prod);
      };
      
      imgWrap.addEventListener("click", openDetails);
      nameLink.addEventListener("click", openDetails);
      
      addBtn.addEventListener("click", () => {
        const selectFlav = card.querySelector(`#flavor-${prod.id}`);
        const selectForm = card.querySelector(`#format-${prod.id}`);
        
        const flavor = selectFlav ? selectFlav.value : (prod.flavors[0] || "Default");
        const format = selectForm ? selectForm.value : "Box"; // Default to Box if boxOnly
        
        this.addToCart(prod, flavor, format, 1);
        
        // Success animation feedback on button
        const originalText = addBtn.innerText;
        addBtn.innerText = "Added! ✓";
        addBtn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        setTimeout(() => {
          addBtn.innerText = originalText;
          addBtn.style.background = "";
        }, 1200);
      });
      
      grid.appendChild(card);
    });
  }

  setCategory(catId) {
    this.activeCategory = catId;
    this.renderCategoryTabs();
    this.renderProducts();
  }

  /* ==========================================================================
     3. PRODUCT DETAIL MODAL
     ========================================================================== */
  
  openModal(product) {
    this.selectedProduct = product;
    this.selectedFlavor = product.flavors[0] || "Default";
    this.selectedFormat = "Single";
    
    this.logActivity(`Opened product details: ${product.brand} ${product.name}`);
    
    const modal = document.getElementById("product-detail-modal");
    const mImg = document.getElementById("modal-image");
    const mBrand = document.getElementById("modal-brand");
    const mName = document.getElementById("modal-name");
    const mDesc = document.getElementById("modal-description");
    const mSpecs = document.getElementById("modal-specs-container");
    
    const mFlavorSelect = document.getElementById("modal-flavor-select");
    const mFormatSelect = document.getElementById("modal-format-select");
    const mPriceValue = document.getElementById("modal-price-value");
    const mPriceLabel = document.getElementById("modal-price-label");
    
    // Fill text
    mImg.src = product.image + "?v=2";
    mBrand.innerText = product.brand;
    mName.innerText = product.name;
    mDesc.innerText = product.description;

    if (mSpecs) {
      mSpecs.innerHTML = "";
      if (product.specs) {
        Object.keys(product.specs).forEach(key => {
          const specItem = document.createElement("div");
          specItem.style.background = "rgba(255,255,255,0.03)";
          specItem.style.padding = "6px 10px";
          specItem.style.borderRadius = "4px";
          specItem.style.border = "1px solid rgba(255,255,255,0.05)";
          specItem.style.display = "flex";
          specItem.style.justifyContent = "space-between";
          specItem.innerHTML = `<span style="color: var(--text-secondary); font-weight:600;">${key}:</span> <span style="color: #fff;">${product.specs[key]}</span>`;
          mSpecs.appendChild(specItem);
        });
        mSpecs.style.display = "grid";
      } else {
        mSpecs.style.display = "none";
      }
    }
    
    // Render flavor select options
    mFlavorSelect.innerHTML = "";
    if (product.flavors && product.flavors.length > 0) {
      document.getElementById("modal-flavor-group").style.display = "block";
      product.flavors.forEach(flavor => {
        const option = document.createElement("option");
        option.value = flavor;
        option.innerText = flavor;
        mFlavorSelect.appendChild(option);
      });
    } else {
      document.getElementById("modal-flavor-group").style.display = "none";
    }
    
    // Render format select options
    mFormatSelect.innerHTML = "";
    if (product.isBoxOnly) {
      const option = document.createElement("option");
      option.value = "Box";
      option.innerText = "Box of 10 pack";
      mFormatSelect.appendChild(option);
      mFormatSelect.disabled = true;
      this.selectedFormat = "Box";
    } else {
      mFormatSelect.disabled = false;
      const optionSingle = document.createElement("option");
      optionSingle.value = "Single";
      optionSingle.innerText = "Single Unit";
      
      const optionBox = document.createElement("option");
      optionBox.value = "Box";
      optionBox.innerText = "Box of 10 Pack";
      
      mFormatSelect.appendChild(optionSingle);
      mFormatSelect.appendChild(optionBox);
      this.selectedFormat = "Single";
    }
    
    // Price dynamic change handler
    const updatePrice = () => {
      if (this.selectedFormat === "Box") {
        mPriceLabel.innerText = "Box Price:";
        mPriceValue.innerText = `$${(product.boxPrice || product.price).toFixed(2)}`;
      } else {
        mPriceLabel.innerText = "Single Price:";
        mPriceValue.innerText = `$${product.price.toFixed(2)}`;
      }
    };
    
    updatePrice();
    
    // Bind change event to modal selectors
    mFlavorSelect.onchange = (e) => {
      this.selectedFlavor = e.target.value;
    };
    
    mFormatSelect.onchange = (e) => {
      this.selectedFormat = e.target.value;
      updatePrice();
    };
    
    // Open
    modal.classList.add("active");
  }

  closeModal() {
    const modal = document.getElementById("product-detail-modal");
    modal.classList.remove("active");
    this.selectedProduct = null;
  }

  /* ==========================================================================
     4. CART MANAGEMENT & STORAGE
     ========================================================================== */
  
  loadCart() {
    const stored = localStorage.getItem("vape_matrix_cart");
    if (stored) {
      try {
        this.cart = JSON.parse(stored);
      } catch (e) {
        console.error("Cart loading failed, reset.", e);
        this.cart = [];
      }
    }
  }

  saveCart() {
    localStorage.setItem("vape_matrix_cart", JSON.stringify(this.cart));
    this.updateCartUI();
  }

  addToCart(product, flavor, format, qty) {
    // Unique match by ID + Flavor + Format
    const existing = this.cart.find(item => item.id === product.id && item.flavor === flavor && item.format === format);
    
    const unitPrice = format === "Box" ? (product.boxPrice || product.price) : product.price;
    
    if (existing) {
      existing.quantity += qty;
    } else {
      this.cart.push({
        id: product.id,
        brand: product.brand,
        name: product.name,
        flavor: flavor,
        format: format, // "Single" or "Box"
        price: unitPrice,
        singlePrice: product.price,
        boxPrice: product.boxPrice || product.price,
        isBoxOnly: product.isBoxOnly,
        image: product.image,
        quantity: qty
      });
    }
    
    this.logActivity(`Added to cart: ${product.brand} ${product.name} (${flavor}, ${format}) x${qty}`);
    this.saveCart();
  }

  updateQuantity(id, flavor, format, delta) {
    const item = this.cart.find(item => item.id === id && item.flavor === flavor && item.format === format);
    if (!item) return;
    
    item.quantity += delta;
    if (item.quantity <= 0) {
      this.cart = this.cart.filter(i => !(i.id === id && i.flavor === flavor && i.format === format));
    }
    
    this.saveCart();
  }

  removeFromCart(id, flavor, format) {
    this.cart = this.cart.filter(item => !(item.id === id && item.flavor === flavor && item.format === format));
    this.saveCart();
  }

  /* ==========================================================================
     5. CART CALCULATOR & BULK SAVINGS ENGINE
     ========================================================================== */
  
  calculateOrder() {
    let subtotal = 0;
    let total = 0;
    let savings = 0;
    let itemCount = 0;

    // Group items in format "Single" by product ID to apply auto-carton discounts
    const singleProductQuantities = {};
    this.cart.forEach(item => {
      itemCount += item.quantity;
      if (item.format === "Single") {
        if (!singleProductQuantities[item.id]) {
          singleProductQuantities[item.id] = 0;
        }
        singleProductQuantities[item.id] += item.quantity;
      }
    });

    this.cart.forEach(item => {
      // 1. If the item is in Box format, the price is already discounted, so sum it up directly
      if (item.format === "Box") {
        const cost = item.quantity * item.boxPrice;
        subtotal += cost;
        total += cost;
      } else {
        // 2. If the item is in Single format, check if total singles ordered reaches 10
        const totalSingleQty = singleProductQuantities[item.id];
        
        if (totalSingleQty < 10) {
          const cost = item.quantity * item.singlePrice;
          subtotal += cost;
          total += cost;
        } else {
          // Auto Carton rate discount applied for buying 10 or more singles!
          const proportion = item.quantity / totalSingleQty;
          
          const boxes = Math.floor(totalSingleQty / 10);
          const leftovers = totalSingleQty % 10;
          
          const totalCalculatedCost = (boxes * item.boxPrice) + (leftovers * item.singlePrice);
          const itemAllocatedCost = totalCalculatedCost * proportion;
          
          const standardCost = item.quantity * item.singlePrice;
          
          subtotal += standardCost;
          total += itemAllocatedCost;
          savings += (standardCost - itemAllocatedCost);
        }
      }
    });

    // Hardcode free shipping on all orders over $150
    const shipping = (total >= 150 || total === 0) ? 0 : 15.00;
    total += shipping;

    return {
      subtotal,
      savings,
      shipping,
      total,
      itemCount
    };
  }

  updateCartUI() {
    const countBadge = document.getElementById("cart-count");
    const countText = document.getElementById("cart-items-count");
    const subtotalText = document.getElementById("cart-subtotal");
    const savingsText = document.getElementById("cart-savings");
    const totalText = document.getElementById("cart-total");
    const shippingText = document.getElementById("cart-shipping");
    const itemsList = document.getElementById("cart-items");
    
    const calculations = this.calculateOrder();
    
    if (countBadge) countBadge.innerText = calculations.itemCount;
    if (countText) countText.innerText = calculations.itemCount;
    
    if (subtotalText) subtotalText.innerText = `$${calculations.subtotal.toFixed(2)}`;
    if (savingsText) {
      if (calculations.savings > 0) {
        savingsText.parentElement.style.display = "flex";
        savingsText.innerText = `-$${calculations.savings.toFixed(2)}`;
      } else {
        savingsText.parentElement.style.display = "none";
      }
    }
    if (shippingText) {
      shippingText.innerText = calculations.shipping === 0 ? "Free Express" : `$${calculations.shipping.toFixed(2)}`;
    }
    if (totalText) totalText.innerText = `$${calculations.total.toFixed(2)}`;
    
    if (!itemsList) return;
    itemsList.innerHTML = "";
    
    if (this.cart.length === 0) {
      itemsList.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">🛒</div>
          <h4 class="empty-title" style="font-size: 16px;">Your cart is empty</h4>
          <p class="empty-desc" style="font-size: 12px;">Add items from the catalog above to build your order.</p>
        </div>
      `;
      return;
    }
    
    this.cart.forEach(item => {
      const cartItem = document.createElement("div");
      cartItem.className = "cart-item";
      
      const itemPriceTotal = item.quantity * item.price;
      const formatBadge = item.format === "Box" ? "10x Box" : "Single";
      
      cartItem.innerHTML = `
        <div class="cart-item-image-wrap">
          <img class="cart-item-image" src="${item.image}?v=2" alt="${item.name}">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-brand">${item.brand}</div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-flavor">
            Flavor: <strong>${item.flavor}</strong> | Format: <span class="product-badge" style="position:static; font-size:9px; padding:2px 6px;">${formatBadge}</span>
          </div>
          <div class="cart-item-controls">
            <div class="qty-selector">
              <button class="qty-btn dec-btn">-</button>
              <span class="qty-value">${item.quantity}</span>
              <button class="qty-btn inc-btn">+</button>
            </div>
            <div class="cart-item-price">$${itemPriceTotal.toFixed(2)}</div>
          </div>
        </div>
        <button class="cart-item-remove-btn">✖</button>
      `;
      
      cartItem.querySelector(".dec-btn").addEventListener("click", () => this.updateQuantity(item.id, item.flavor, item.format, -1));
      cartItem.querySelector(".inc-btn").addEventListener("click", () => this.updateQuantity(item.id, item.flavor, item.format, 1));
      cartItem.querySelector(".cart-item-remove-btn").addEventListener("click", () => this.removeFromCart(item.id, item.flavor, item.format));
      
      itemsList.appendChild(cartItem);
    });
  }

  /* ==========================================================================
     6. CHECKOUT FLOW & METADATA LOGGING
     ========================================================================== */
  
  openCheckout() {
    if (this.cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    
    this.logActivity("Opened checkout form overlay");
    
    const checkout = document.getElementById("checkout-section");
    const checkList = document.getElementById("checkout-items-list");
    const subtotalText = document.getElementById("checkout-subtotal");
    const savingsText = document.getElementById("checkout-savings");
    const shippingText = document.getElementById("checkout-shipping");
    const totalText = document.getElementById("checkout-total");
    
    document.getElementById("cart-drawer").classList.remove("active");
    document.getElementById("cart-drawer-overlay").classList.remove("active");
    
    const calculations = this.calculateOrder();
    
    subtotalText.innerText = `$${calculations.subtotal.toFixed(2)}`;
    if (calculations.savings > 0) {
      savingsText.parentElement.style.display = "flex";
      savingsText.innerText = `-$${calculations.savings.toFixed(2)}`;
    } else {
      savingsText.parentElement.style.display = "none";
    }
    shippingText.innerText = calculations.shipping === 0 ? "Free" : `$${calculations.shipping.toFixed(2)}`;
    totalText.innerText = `$${calculations.total.toFixed(2)}`;
    
    checkList.innerHTML = "";
    this.cart.forEach(item => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.fontSize = "13px";
      row.style.marginBottom = "8px";
      row.innerHTML = `
        <span style="color:var(--text-secondary)">
          ${item.quantity}x ${item.name} (${item.flavor}) [${item.format}]
        </span>
        <strong>$${(item.quantity * item.price).toFixed(2)}</strong>
      `;
      checkList.appendChild(row);
    });
    
    document.getElementById("checkout-content").style.display = "block";
    checkout.classList.add("active");
  }

  closeCheckout() {
    document.getElementById("checkout-section").classList.remove("active");
  }

  submitOrder() {
    const name = document.getElementById("cust-name").value;
    const addr = document.getElementById("cust-address").value;
    const city = document.getElementById("cust-city").value;
    const state = document.getElementById("cust-state").value;
    const post = document.getElementById("cust-postcode").value;
    const phone = document.getElementById("cust-phone").value;
    const email = document.getElementById("cust-email").value;
    const notes = document.getElementById("cust-notes").value;
    
    if (!name || !addr || !city || !post || !phone || !email) {
      alert("Please fill out all required fields.");
      return;
    }
    
    const calculations = this.calculateOrder();
    
    // Generate Order ID & Reference Code
    const orderId = `OCV-${Date.now().toString().slice(-6)}`;
    const randAlpha = Math.random().toString(36).substring(2, 6).toUpperCase();
    const refCode = `REF-${Date.now().toString().slice(-4)}-${randAlpha}`;
    
    this.logActivity(`Placed order ${orderId} (Total: $${calculations.total.toFixed(2)})`);
    
    // LOG DETAILED CLIENT INFORMATION & BROWSER METADATA
    const metadata = {
      userAgent: navigator.userAgent,
      resolution: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      localTime: new Date().toString(),
      referrer: document.referrer || "direct",
      ip: localStorage.getItem("vape_matrix_visitor_ip") || "Unknown"
    };

    const order = {
      orderId,
      refCode,
      date: new Date().toISOString(),
      customer: { name, address: `${addr}, ${city}, ${state} ${post}`, phone, email, notes },
      items: this.cart.map(i => ({ 
        name: i.name, 
        flavor: i.flavor, 
        format: i.format, 
        quantity: i.quantity, 
        total: i.quantity * i.price 
      })),
      total: calculations.total,
      status: "Pending Payment",
      metadata // Save user agent metrics
    };
    
    const storedOrders = localStorage.getItem("vape_matrix_orders");
    let ordersList = [];
    if (storedOrders) {
      try {
        ordersList = JSON.parse(storedOrders);
      } catch(e) {}
    }
    ordersList.unshift(order);
    localStorage.setItem("vape_matrix_orders", JSON.stringify(ordersList));

    // Disable submit button during processing to prevent multiple submissions
    const submitBtn = document.querySelector("#checkout-form button[type=submit]");
    const originalBtnText = submitBtn ? submitBtn.innerText : "Confirm Order";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Processing Order...";
    }

    let firebaseSyncPromise = Promise.resolve();
    // Optional Cloud Sync to Firebase
    if (this.config && this.config.settings && this.config.settings.orderSyncUrl) {
      let dbUrl = this.config.settings.orderSyncUrl.trim();
      if (dbUrl) {
        if (!dbUrl.endsWith("/")) dbUrl += "/";
        const postUrl = `${dbUrl}orders.json`;
        
        firebaseSyncPromise = fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order)
        })
        .then(res => {
          if (!res.ok) throw new Error("Sync server returned error status " + res.status);
          console.log("Order successfully pushed to real-time cloud database.");
        });
      }
    }
    
    // Display Checkout instructions
    const successPayid = document.getElementById("success-payid");
    const successBank = document.getElementById("success-bank-name");
    const successName = document.getElementById("success-account-name");
    const successBsb = document.getElementById("success-bsb");
    const successAccNum = document.getElementById("success-account-num");
    const successRef = document.getElementById("success-ref");
    
    const bank = this.config.settings.bankDetails;
    if (successPayid) successPayid.innerText = bank.payId || "orders@vapematrix.co";
    if (successBank) successBank.innerText = bank.bankName;
    if (successName) successName.innerText = bank.accountName;
    if (successBsb) successBsb.innerText = bank.bsb;
    if (successAccNum) successAccNum.innerText = bank.accountNumber;
    if (successRef) successRef.innerText = refCode;
    
    // Generate pre-formatted order summary text
    let orderItemsText = "";
    this.cart.forEach(item => {
      orderItemsText += `- ${item.quantity}x ${item.name} (${item.flavor || "Standard"} / ${item.format || "Single"}) - $${(item.quantity * item.price).toFixed(2)}\n`;
    });

    // Send email notifications
    const settings = this.config.settings;
    const hasEmailJS = settings.emailjsPublicKey && settings.emailjsServiceId && settings.emailjsOrderTemplateId;
    
    let emailPromise = Promise.resolve();

    if (hasEmailJS && typeof emailjs !== "undefined") {
      // Send via EmailJS (to customer)
      emailPromise = emailjs.send(
        settings.emailjsServiceId.trim(),
        settings.emailjsOrderTemplateId.trim(),
        {
          order_id: orderId,
          ref_code: refCode,
          customer_name: name,
          customer_email: email,
          reply_to: email,
          bcc: "orders@vapematrix.co",
          customer_phone: phone,
          customer_address: `${addr}, ${city}, ${state} ${post}`,
          customer_notes: notes || "None",
          order_items: orderItemsText,
          total_price: `$${calculations.total.toFixed(2)}`,
          payid: bank.payId || "orders@vapematrix.co",
          bank_name: bank.bankName,
          account_name: bank.accountName,
          bsb: bank.bsb,
          account_number: bank.accountNumber
        }
      ).then(() => {
        console.log("Order confirmation email triggered via EmailJS.");
        this.logActivity(`Order confirmation email sent successfully to ${email}`);
      }).catch(err => {
        console.error("EmailJS Order trigger failed:", err);
        const errMsg = err.text || err.message || JSON.stringify(err);
        this.logActivity(`❌ Order confirmation email failed: ${errMsg}`);
      });
    } else {
      this.logActivity("Order confirmation email skipped (EmailJS keys not fully configured or SDK not loaded)");
    }

    // Always send the full merchant notification via FormSubmit.co as the backend logging database
    const targetEmail = settings.contactEmail || "orders@vapematrix.co";
    const orderPostUrl = `https://formsubmit.co/ajax/${targetEmail.trim()}`;
    
    const merchantNotificationPromise = fetch(orderPostUrl, {
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
        "Shipping Address": `${addr}, ${city}, ${state} ${post}`,
        "Delivery Notes": notes || "None",
        "Order Items": orderItemsText,
        "Total Amount": `$${calculations.total.toFixed(2)}`,
        "User Agent": metadata.userAgent,
        "Screen Resolution": metadata.resolution,
        "Language": metadata.language,
        "Local Time": metadata.localTime,
        "_captcha": "false",
        "_subject": `🛒 NEW ORDER PLACED: ${orderId} (${refCode})`
      })
    })
    .then(res => {
      if (res.ok) {
        console.log("Order notification sent to merchant via FormSubmit.co.");
      }
    });

    // Wait for all critical async tasks to complete before redirecting
    Promise.all([
      firebaseSyncPromise.catch(err => console.warn("Firebase sync failed:", err)),
      emailPromise.catch(err => console.warn("Customer email trigger failed:", err)),
      merchantNotificationPromise.catch(err => console.warn("Merchant notification failed:", err))
    ])
    .then(() => {
      
      // Clear cart
      this.cart = [];
      localStorage.removeItem("vape_matrix_cart");
      this.updateCartUI();
      
      // Save order details to localStorage for order-success.html
      const latestOrder = {
        orderId: orderId,
        refCode: refCode,
        total: calculations.total,
        shippingFee: calculations.shipping,
        items: order.items,
        customer: {
          name: name,
          phone: phone,
          address: order.customer.address,
          notes: notes || "None"
        },
        bankDetails: bank
      };
      localStorage.setItem("vape_matrix_latest_order", JSON.stringify(latestOrder));

      // Redirect to standalone order-success page
      window.location.href = "order-success.html";
    })
    .catch(err => {
      console.error("Order finalization encountered errors:", err);
      // Fallback redirect anyway so the customer sees the instructions card
      window.location.href = "order-success.html";
    });
  }

  async submitContactForm() {
    const name = document.getElementById("contact-name").value.trim();
    const email = document.getElementById("contact-email").value.trim();
    const message = document.getElementById("contact-message").value.trim();
    
    if (!name || !email || !message) {
      alert("Please fill in all required fields.");
      return;
    }
    
    const submitBtn = document.getElementById("btn-contact-submit");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Sending Message...";
    }
    
    this.sendContactFormSubmit(name, email, message);
  }

  sendContactFormSubmit(name, email, message) {
    const targetEmail = (this.config && this.config.settings && this.config.settings.contactEmail) || "orders@vapematrix.co";
    const postUrl = `https://formsubmit.co/ajax/${targetEmail.trim()}`;
    
    fetch(postUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        Name: name,
        Email: email,
        Message: message,
        _captcha: "false",
        _subject: `New contact message from ${name}`
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Status " + res.status);
      this.showContactSuccess();
    })
    .catch(err => {
      console.error("Contact FormSubmit failed:", err);
      alert("Failed to send message. Please contact us directly at " + targetEmail);
      const submitBtn = document.getElementById("btn-contact-submit");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Send Message";
      }
    });
  }

  showContactSuccess() {
    document.getElementById("contact-form").style.display = "none";
    document.getElementById("contact-success").style.display = "block";
  }

  /* ==========================================================================
     7. GENERAL BINDING EVENTS
     ========================================================================= */
  
  bindEvents() {
    const logoSelect = document.getElementById("logo-style-select");
    if (logoSelect) {
      logoSelect.addEventListener("change", (e) => {
        this.applyLogoStyle(e.target.value);
      });
    }

    const globalSearch = document.getElementById("global-search");
    if (globalSearch) {
      globalSearch.addEventListener("input", (e) => {
        this.searchQuery = e.target.value;
        this.renderProducts();
      });
    }
    
    const clearBtn = document.getElementById("btn-clear-filters");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.selectedBrands = [];
        this.selectedPrices = [];
        this.selectedFormats = [];
        this.searchQuery = "";
        
        document.querySelectorAll(".filter-checkbox").forEach(c => c.checked = false);
        if (globalSearch) globalSearch.value = "";
        
        this.renderProducts();
      });
    }
    
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.currentSort = e.target.value;
        this.renderProducts();
      });
    }
    
    document.querySelectorAll("input[name='price-filter']").forEach(box => {
      box.addEventListener("change", () => {
        this.selectedPrices = Array.from(document.querySelectorAll("input[name='price-filter']:checked")).map(b => b.value);
        this.renderProducts();
      });
    });

    document.querySelectorAll("input[name='format-filter']").forEach(box => {
      box.addEventListener("change", () => {
        this.selectedFormats = Array.from(document.querySelectorAll("input[name='format-filter']:checked")).map(b => b.value);
        this.renderProducts();
      });
    });
    
    const modalClose = document.getElementById("modal-close");
    const detailModal = document.getElementById("product-detail-modal");
    if (modalClose) modalClose.addEventListener("click", () => this.closeModal());
    if (detailModal) {
      detailModal.addEventListener("click", (e) => {
        if (e.target === detailModal) this.closeModal();
      });
    }
    
    const modalAdd = document.getElementById("btn-modal-add");
    if (modalAdd) {
      modalAdd.addEventListener("click", () => {
        if (this.selectedProduct) {
          this.addToCart(this.selectedProduct, this.selectedFlavor, this.selectedFormat, 1);
          
          modalAdd.innerText = "Added to Cart! ✓";
          modalAdd.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
          
          setTimeout(() => {
            modalAdd.innerText = "Add Item to Cart";
            modalAdd.style.background = "";
            this.closeModal();
          }, 800);
        }
      });
    }
    
    const cartToggle = document.getElementById("cart-toggle");
    const cartClose = document.getElementById("cart-close");
    const cartOverlay = document.getElementById("cart-drawer-overlay");
    const cartDrawer = document.getElementById("cart-drawer");
    
    const toggleCart = () => {
      cartDrawer.classList.toggle("active");
      cartOverlay.classList.toggle("active");
    };
    
    if (cartToggle) cartToggle.addEventListener("click", toggleCart);
    if (cartClose) cartClose.addEventListener("click", toggleCart);
    if (cartOverlay) cartOverlay.addEventListener("click", toggleCart);
    
    const checkTrigger = document.getElementById("btn-checkout-trigger");
    const checkClose = document.getElementById("checkout-close");
    
    if (checkTrigger) checkTrigger.addEventListener("click", () => this.openCheckout());
    if (checkClose) checkClose.addEventListener("click", () => this.closeCheckout());
    
    const form = document.getElementById("checkout-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitOrder();
      });
    }

    const contactForm = document.getElementById("contact-form");
    if (contactForm) {
      contactForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitContactForm();
      });
    }

    // Vape Matrix Unique Features bindings
    const compareTrigger = document.getElementById("btn-compare-trigger");
    const compareClose = document.getElementById("spec-compare-close");
    const specCompareModal = document.getElementById("spec-compare-modal");
    
    if (compareTrigger) {
      compareTrigger.addEventListener("click", () => {
        specCompareModal.classList.add("active");
        this.logActivity("Opened Spec Comparison Matrix");
      });
    }
    if (compareClose) {
      compareClose.addEventListener("click", () => specCompareModal.classList.remove("active"));
    }
    if (specCompareModal) {
      specCompareModal.addEventListener("click", (e) => {
        if (e.target === specCompareModal) specCompareModal.classList.remove("active");
      });
    }

    const transitTrigger = document.getElementById("btn-transit-trigger");
    const transitClose = document.getElementById("transit-estimator-close");
    const transitModal = document.getElementById("transit-estimator-modal");
    const checkTransitBtn = document.getElementById("btn-check-transit");
    
    if (transitTrigger) {
      transitTrigger.addEventListener("click", () => {
        transitModal.classList.add("active");
        this.logActivity("Opened Transit Estimator Widget");
      });
    }
    if (transitClose) {
      transitClose.addEventListener("click", () => transitModal.classList.remove("active"));
    }
    if (transitModal) {
      transitModal.addEventListener("click", (e) => {
        if (e.target === transitModal) transitModal.classList.remove("active");
      });
    }
    if (checkTransitBtn) {
      checkTransitBtn.addEventListener("click", () => this.runTransitEstimator());
    }

    const builderTrigger = document.getElementById("btn-carton-builder-trigger");
    const builderClose = document.getElementById("carton-builder-close");
    const builderModal = document.getElementById("carton-builder-modal");
    const builderBrandSelect = document.getElementById("builder-brand-select");
    const builderAddBtn = document.getElementById("btn-builder-add-cart");
    
    if (builderTrigger) {
      builderTrigger.addEventListener("click", () => {
        this.initCartonBuilder();
        this.logActivity("Opened Carton Builder Modal");
      });
    }
    if (builderClose) {
      builderClose.addEventListener("click", () => builderModal.classList.remove("active"));
    }
    if (builderModal) {
      builderModal.addEventListener("click", (e) => {
        if (e.target === builderModal) builderModal.classList.remove("active");
      });
    }
    if (builderBrandSelect) {
      builderBrandSelect.addEventListener("change", (e) => {
        this.builderState.brand = e.target.value;
        this.builderState.selectedFlavors = {};
        this.builderState.totalCount = 0;
        this.updateBuilderFlavors();
        this.updateBuilderUI();
      });
    }
    if (builderAddBtn) {
      builderAddBtn.addEventListener("click", () => this.addBuilderCartonToCart());
    }
  }

  renderGuides() {
    const grid = document.getElementById("guides-grid");
    if (!grid || !this.guides) return;
    
    grid.innerHTML = "";
    
    this.guides.forEach(guide => {
      const card = document.createElement("div");
      card.className = "guide-card animate-fade";
      card.style.cursor = "pointer";
      
      card.innerHTML = `
        <a href="education/${guide.id}.html" style="text-decoration: none; color: inherit; display: block; height: 100%;">
          <div class="guide-meta">Educational • ${guide.keyword || "maintenance"}</div>
          <h3 class="guide-card-title">${guide.title}</h3>
          <p class="guide-excerpt">${guide.summary}</p>
          <div class="guide-readmore">Read Factual Article →</div>
        </a>
      `;
      
      grid.appendChild(card);
    });
  }



  generateSEOSchema() {
    if (!this.config) return;
    
    const schemas = [];
    const siteUrl = "https://vapematrix.co";
    
    // 1. Organization Schema
    const orgSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      "name": this.config.settings.siteName || "Vape Matrix",
      "url": siteUrl,
      "logo": `${siteUrl}/img/logo.png`,
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": this.config.settings.contactPhone || "",
        "contactType": "customer service",
        "email": this.config.settings.contactEmail || ""
      }
    };
    schemas.push(orgSchema);
    
    // 2. Product Catalog Schema
    if (this.config.products && this.config.products.length > 0) {
      this.config.products.forEach(prod => {
        const prodSchema = {
          "@context": "https://schema.org",
          "@type": "Product",
          "@id": `${siteUrl}/#product-${prod.id}`,
          "name": prod.name,
          "image": `${siteUrl}/${prod.image}`,
          "description": prod.description,
          "brand": {
            "@type": "Brand",
            "name": prod.brand
          },
          "offers": {
            "@type": "Offer",
            "priceCurrency": "AUD",
            "price": prod.price.toFixed(2),
            "availability": prod.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "url": `${siteUrl}/#product-${prod.id}`
          }
        };
        schemas.push(prodSchema);
      });
    }
    
    // 3. Factual Guides Article Schema
    if (this.guides && this.guides.length > 0) {
      this.guides.forEach(guide => {
        const articleSchema = {
          "@context": "https://schema.org",
          "@type": "Article",
          "@id": `${siteUrl}/#guide-${guide.id}`,
          "headline": guide.title,
          "description": guide.summary,
          "image": `${siteUrl}/img/logo.png`,
          "datePublished": guide.date || "2026-06-25",
          "author": {
            "@type": "Person",
            "name": guide.author || "Vape Matrix Education"
          },
          "publisher": {
            "@type": "Organization",
            "name": this.config.settings.siteName || "Vape Matrix",
            "logo": {
              "@type": "ImageObject",
              "url": `${siteUrl}/img/logo.png`
            }
          },
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `${siteUrl}/#guide-${guide.id}`
          }
        };
        schemas.push(articleSchema);
      });
    }
    
    // Inject schema tag
    const existing = document.getElementById("dynamic-seo-schema");
    if (existing) {
      existing.remove();
    }
    
    const script = document.createElement("script");
    script.id = "dynamic-seo-schema";
    script.type = "application/ld+json";
    script.text = JSON.stringify(schemas, null, 2);
    document.head.appendChild(script);
    console.log("Dynamically generated SEO Schema Markup injected.");
  }

  /* ==========================================================================
     8. VISITOR ANALYTICS & CLIENT TRACKING
     ========================================================================== */

  async trackVisitor() {
    try {
      const syncUrl = this.config?.settings?.orderSyncUrl?.trim();
      if (!syncUrl) return;
      const cleanUrl = syncUrl.endsWith("/") ? syncUrl : syncUrl + "/";

      let visitId = sessionStorage.getItem("vape_matrix_visit_id");
      let visitLogged = sessionStorage.getItem("vape_matrix_visit_logged");
      let visitorId = localStorage.getItem("vape_matrix_visitor_id");

      if (!visitorId) {
        visitorId = "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
        localStorage.setItem("vape_matrix_visitor_id", visitorId);
      }

      if (!visitId) {
        visitId = "vst_" + Date.now() + "_" + Math.random().toString(36).substring(2, 11);
        sessionStorage.setItem("vape_matrix_visit_id", visitId);
      }

      this.currentVisitId = visitId;
      this.dbSyncUrl = cleanUrl;

      // If this session has not been successfully logged to Firebase yet, attempt to write
      if (visitLogged !== "true") {
        const userAgent = navigator.userAgent;
        const referrer = document.referrer || "Direct / Bookmark";
        const screen = window.screen.width + "x" + window.screen.height;
        const landingPage = window.location.pathname + window.location.hash;
        const timestamp = Date.now();

        // Simple device type detection
        let device = "Desktop";
        if (/Mobi|Android|iPhone|iPad/i.test(userAgent)) {
          device = "Mobile/Tablet";
        }

        // Fetch Location/Geo IP details
        let geoData = { ip: "Unknown", city: "Unknown", region: "Unknown", country_name: "Unknown", org: "Unknown" };
        try {
          const geoResponse = await fetch("https://ipapi.co/json/");
          if (geoResponse.ok) {
            const data = await geoResponse.json();
            if (data && data.ip) {
              geoData = data;
              localStorage.setItem("vape_matrix_visitor_ip", data.ip);

              // Blacklist Check
              const sanitizedIp = data.ip.replace(/\./g, "-").replace(/:/g, "_");
              try {
                const blockResp = await fetch(`${cleanUrl}blacklist/${sanitizedIp}.json`);
                if (blockResp.ok) {
                  const blockData = await blockResp.json();
                  if (blockData && blockData.blocked === true) {
                    this.showBlockOverlay(data.ip);
                    return; // Halt storefront initialization
                  }
                }
              } catch (blockErr) {
                console.warn("Could not retrieve blacklist status:", blockErr);
              }
            }
          }
        } catch (e) {
          console.warn("Could not retrieve IP geolocation details, logging generic details.", e);
        }

        const visitRecord = {
          visitId,
          visitorId,
          timestamp,
          userAgent,
          device,
          referrer,
          screen,
          landingPage,
          ip: geoData.ip,
          city: geoData.city,
          region: geoData.region,
          country: geoData.country_name,
          isp: geoData.org
        };

        // Write to Firebase
        const response = await fetch(`${cleanUrl}visits/${visitId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(visitRecord)
        });

        if (response.ok) {
          sessionStorage.setItem("vape_matrix_visit_logged", "true");
          // Initialize activity log with Landed event
          await this.currentLogActivity(cleanUrl, visitId, "Landed on website: " + landingPage);
        }
      }
    } catch (e) {
      console.warn("Visitor tracking encountered an error:", e);
    }
  }

  async logActivity(action) {
    if (!this.currentVisitId || !this.dbSyncUrl) return;
    await this.currentLogActivity(this.dbSyncUrl, this.currentVisitId, action);
  }

  async currentLogActivity(dbUrl, visitId, action) {
    try {
      const timestamp = Date.now();
      const activityItem = { timestamp, action };

      // Push activity details under visits/$visitId/activity
      await fetch(`${dbUrl}visits/${visitId}/activity.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityItem)
      });
    } catch (e) {
      console.warn("Could not log user activity:", e);
    }
  }

  initCartonBuilder() {
    this.builderState = {
      brand: document.getElementById("builder-brand-select").value,
      selectedFlavors: {},
      totalCount: 0
    };
    
    // Clear slots grid
    const slotsGrid = document.getElementById("builder-slots-grid");
    slotsGrid.innerHTML = "";
    for (let i = 0; i < 10; i++) {
      const slot = document.createElement("div");
      slot.style.height = "35px";
      slot.style.border = "1px dashed var(--glass-border)";
      slot.style.borderRadius = "var(--radius-sm)";
      slot.style.display = "flex";
      slot.style.alignItems = "center";
      slot.style.justifyContent = "center";
      slot.style.fontSize = "12px";
      slot.style.color = "var(--text-muted)";
      slot.innerText = i + 1;
      slotsGrid.appendChild(slot);
    }
    
    this.updateBuilderFlavors();
    this.updateBuilderUI();
    document.getElementById("carton-builder-modal").classList.add("active");
  }

  updateBuilderFlavors() {
    const brandId = this.builderState.brand;
    const product = this.config.products.find(p => p.id === brandId);
    const flavorListEl = document.getElementById("builder-flavor-list");
    if (!product || !flavorListEl) return;
    
    flavorListEl.innerHTML = "";
    
    product.flavors.forEach(flavor => {
      const currentQty = this.builderState.selectedFlavors[flavor] || 0;
      
      const itemRow = document.createElement("div");
      itemRow.style.display = "flex";
      itemRow.style.justifyContent = "space-between";
      itemRow.style.alignItems = "center";
      itemRow.style.padding = "6px 10px";
      itemRow.style.background = "rgba(255,255,255,0.02)";
      itemRow.style.border = "1px solid rgba(255,255,255,0.03)";
      itemRow.style.borderRadius = "var(--radius-sm)";
      
      itemRow.innerHTML = `
        <span style="font-size:13px; color:#fff;">${flavor}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="qty-btn dec-flavor" style="width:24px; height:24px; font-size:12px;">-</button>
          <span class="flavor-qty-val" style="font-size:13px; font-weight:700; min-width:18px; text-align:center;">${currentQty}</span>
          <button class="qty-btn inc-flavor" style="width:24px; height:24px; font-size:12px;">+</button>
        </div>
      `;
      
      const decBtn = itemRow.querySelector(".dec-flavor");
      const incBtn = itemRow.querySelector(".inc-flavor");
      const qtyVal = itemRow.querySelector(".flavor-qty-val");
      
      decBtn.addEventListener("click", () => {
        if (this.builderState.selectedFlavors[flavor] > 0) {
          this.builderState.selectedFlavors[flavor]--;
          this.builderState.totalCount--;
          qtyVal.innerText = this.builderState.selectedFlavors[flavor];
          this.updateBuilderUI();
        }
      });
      
      incBtn.addEventListener("click", () => {
        if (this.builderState.totalCount < 10) {
          this.builderState.selectedFlavors[flavor] = (this.builderState.selectedFlavors[flavor] || 0) + 1;
          this.builderState.totalCount++;
          qtyVal.innerText = this.builderState.selectedFlavors[flavor];
          this.updateBuilderUI();
        }
      });
      
      flavorListEl.appendChild(itemRow);
    });
  }

  updateBuilderUI() {
    const totalCount = this.builderState.totalCount;
    document.getElementById("builder-slot-count").innerText = `${totalCount} / 10`;
    
    // Update slots grid
    const slots = document.getElementById("builder-slots-grid").children;
    for (let i = 0; i < 10; i++) {
      if (i < totalCount) {
        slots[i].style.background = "var(--gold-accent)";
        slots[i].style.borderColor = "var(--gold-accent)";
        slots[i].style.color = "#000";
        slots[i].style.fontWeight = "700";
        slots[i].innerHTML = "✓";
      } else {
        slots[i].style.background = "";
        slots[i].style.borderColor = "";
        slots[i].style.color = "";
        slots[i].style.fontWeight = "";
        slots[i].innerText = i + 1;
      }
    }
    
    // Update summary list
    const summaryEl = document.getElementById("builder-selected-summary");
    summaryEl.innerHTML = "";
    
    const activeFlavors = Object.entries(this.builderState.selectedFlavors).filter(([f, qty]) => qty > 0);
    
    if (activeFlavors.length === 0) {
      summaryEl.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">No flavors selected yet.</p>';
    } else {
      const list = document.createElement("ul");
      list.style.listStyle = "none";
      list.style.padding = "0";
      list.style.margin = "0";
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "6px";
      
      activeFlavors.forEach(([flavor, qty]) => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.innerHTML = `<span>${flavor}</span><strong style="color:var(--cyan-accent);">x${qty}</strong>`;
        list.appendChild(li);
      });
      summaryEl.appendChild(list);
    }
    
    // Calculate price
    const product = this.config.products.find(p => p.id === this.builderState.brand);
    const boxPrice = product ? (product.boxPrice || 260) : 260;
    document.getElementById("builder-total-price").innerText = `$${boxPrice.toFixed(2)}`;
    
    // Enable/Disable Add to Cart Button
    const addBtn = document.getElementById("btn-builder-add-cart");
    if (totalCount === 10) {
      addBtn.removeAttribute("disabled");
      addBtn.classList.add("pulse-gold");
    } else {
      addBtn.setAttribute("disabled", "true");
      addBtn.classList.remove("pulse-gold");
    }
  }

  addBuilderCartonToCart() {
    if (this.builderState.totalCount !== 10) return;
    
    const product = this.config.products.find(p => p.id === this.builderState.brand);
    if (!product) return;
    
    const activeFlavors = Object.entries(this.builderState.selectedFlavors)
      .filter(([f, qty]) => qty > 0)
      .map(([f, qty]) => `${f} (x${qty})`)
      .join(", ");
      
    const boxPrice = product.boxPrice || 260;
    
    // Create unique ID for this custom carton instance
    const customId = `carton-${product.id}-${Date.now()}`;
    
    this.cart.push({
      id: customId,
      brand: product.brand,
      name: `Custom Mixed Carton (${product.name})`,
      flavor: activeFlavors,
      format: "Box", // Box gets treated with the boxPrice
      price: boxPrice,
      singlePrice: product.price,
      boxPrice: boxPrice,
      isBoxOnly: true,
      image: product.image,
      quantity: 1,
      customCarton: true
    });
    
    this.logActivity(`Added custom mixed carton: ${product.name} with flavors [${activeFlavors}]`);
    this.saveCart();
    
    // Reset and close
    document.getElementById("carton-builder-modal").classList.remove("active");
  }

  runTransitEstimator() {
    const postcode = document.getElementById("transit-postcode").value.trim();
    const resultEl = document.getElementById("transit-result");
    if (!postcode || postcode.length < 3) {
      alert("Please enter a valid Australian postcode or state code.");
      return;
    }
    
    resultEl.style.display = "block";
    
    let state = "VIC";
    let locationType = "Metro";
    let time = "1-2 Business Days";
    let desc = "";
    
    const char = postcode[0];
    if (char === '3') {
      state = "Victoria";
      if (postcode.startsWith("30") || postcode.startsWith("31") || postcode.startsWith("320")) {
        locationType = "Metro (Melbourne)";
        time = "Next Business Day (Overnight)";
        desc = "Your order is dispatched locally from Melbourne. You get the fastest priority transit.";
      } else {
        locationType = "Regional VIC";
        time = "1-2 Business Days";
        desc = "Country VIC destinations clear quickly via AusPost Express channels.";
      }
    } else if (char === '2') {
      state = "NSW / ACT";
      if (postcode.startsWith("20") || postcode.startsWith("21") || postcode.startsWith("260")) {
        locationType = "Metro (Sydney / Canberra)";
        time = "1-2 Business Days";
        desc = "High frequency express lane ensures delivery in 24-48 hours post-payment clearance.";
      } else {
        locationType = "Regional NSW";
        time = "2-3 Business Days";
        desc = "Outer regional hubs take slightly longer to clear local depots.";
      }
    } else if (char === '4') {
      state = "Queensland";
      if (postcode.startsWith("40") || postcode.startsWith("41") || postcode.startsWith("42")) {
        locationType = "Metro (Brisbane / Gold Coast)";
        time = "2-3 Business Days";
        desc = "Express air lane ensures fast delivery to South-East Queensland.";
      } else {
        locationType = "Regional QLD / Far North";
        time = "3-4 Business Days";
        desc = "Tropical QLD and outer rural areas require additional sorting stops.";
      }
    } else if (char === '5') {
      state = "South Australia";
      if (postcode.startsWith("50") || postcode.startsWith("51")) {
        locationType = "Metro (Adelaide)";
        time = "2-3 Business Days";
        desc = "Adelaide metro hubs process incoming shipments rapidly.";
      } else {
        locationType = "Regional SA";
        time = "3-4 Business Days";
        desc = "Rural and wine region distribution centers clear within 72-96 hours.";
      }
    } else if (char === '6') {
      state = "Western Australia";
      if (postcode.startsWith("60")) {
        locationType = "Metro (Perth)";
        time = "2-3 Business Days";
        desc = "Express air cargo delivers Perth orders quickly across the Nullarbor.";
      } else {
        locationType = "Regional WA / Mining Hubs";
        time = "4-6 Business Days";
        desc = "WA country and remote mining sites experience longer transits.";
      }
    } else if (char === '7') {
      state = "Tasmania";
      time = "2-3 Business Days";
      desc = "Bass Strait transport clears Hobart/Launceston within 48-72 hours.";
    } else if (char === '0') {
      state = "Northern Territory";
      time = "3-5 Business Days";
      desc = "Darwin and regional NT locations process through national linehaul corridors.";
    } else {
      state = "Unknown / Interstate";
      time = "3-5 Business Days";
      desc = "Standard national express dispatch timeline applies.";
    }
    
    resultEl.innerHTML = `
      <div style="margin-bottom:8px;"><span style="color:var(--cyan-accent); font-weight:700;">State:</span> ${state} (${locationType})</div>
      <div style="margin-bottom:8px;"><span style="color:var(--cyan-accent); font-weight:700;">Estimated Delivery:</span> <strong style="color:var(--success-color); font-size:14px;">${time}</strong></div>
      <div style="font-size:12px; color:var(--text-secondary); line-height:1.4;">${desc}</div>
    `;
  }

  applyLogoStyle(style) {
    const target = document.getElementById("dynamic-logo-target");
    if (!target) return;
    
    let html = "";
    if (style === "1") {
      html = `<span style="font-family:var(--font-title); font-weight:900; font-size:20px; color:#fff; letter-spacing:5px; text-transform:uppercase;">VAPE<span style="color:var(--cyan-accent); font-weight:300;">MATRIX</span></span>`;
    } else if (style === "3") {
      html = `<span style="font-family:monospace; font-weight:700; font-size:20px; color:var(--gold-accent); letter-spacing:-0.5px;">vape<span style="color:#fff;">//</span><span style="color:var(--cyan-accent);">matrix</span></span>`;
    } else {
      // Default: Style 2 (Cyber)
      html = `<span style="font-family:var(--font-title); font-weight:800; font-size:20px; color:#fff; letter-spacing:1px; text-transform:uppercase;">⚡ <span style="color:var(--gold-accent);">[</span>VAPE_<span style="color:var(--cyan-accent);">MATRIX</span><span style="color:var(--gold-accent);">]</span></span>`;
    }
    target.innerHTML = html;
    localStorage.setItem("vape_matrix_logo_style", style);
    
    // Sync selector if it exists
    const select = document.getElementById("logo-style-select");
    if (select) select.value = style;
  }

  renderFeaturedProducts() {
    const grid = document.getElementById("featured-products-grid");
    if (!grid || !this.config || !this.config.products) return;
    
    // Get first 3 popular or general products
    const featured = this.config.products.filter(p => p.popular).slice(0, 3);
    if (featured.length === 0) {
      featured.push(...this.config.products.slice(0, 3));
    }
    
    grid.innerHTML = "";
    
    featured.forEach(prod => {
      const card = document.createElement("div");
      card.className = "product-card glass-card animate-slideup";
      
      let badgeHTML = prod.popular ? `<div class="product-badge">Best Seller</div>` : "";
      
      let flavorHTML = "";
      if (prod.flavors && prod.flavors.length > 0) {
        flavorHTML = `<div class="form-field" style="margin-bottom:10px;"><select class="product-card-flavor-select" id="flavor-${prod.id}" style="margin-bottom:0;">`;
        prod.flavors.forEach(flavor => {
          flavorHTML += `<option value="${flavor}">${flavor}</option>`;
        });
        flavorHTML += `</select></div>`;
      }
      
      let formatHTML = prod.isBoxOnly ? `
        <div class="form-field" style="margin-bottom:12px;">
          <select class="product-card-flavor-select" id="format-${prod.id}" style="margin-bottom:0;" disabled>
            <option value="Box">Box of 10 Pack</option>
          </select>
        </div>
      ` : `
        <div class="form-field" style="margin-bottom:12px;">
          <select class="product-card-flavor-select" id="format-${prod.id}" style="margin-bottom:0;">
            <option value="Single">Single Unit ($${prod.price.toFixed(2)})</option>
            <option value="Box">Box of 10 ($${prod.boxPrice.toFixed(2)})</option>
          </select>
        </div>
      `;
      
      let priceRow = prod.isBoxOnly ? `
        <div class="product-card-price-row">
          <span class="price-label">Wholesale Price:</span>
          <span class="price-value highlight-gold">$${prod.price.toFixed(2)}</span>
        </div>
      ` : `
        <div class="product-card-price-row">
          <span class="price-label">Single Rate:</span>
          <span class="price-value">$${prod.price.toFixed(2)}</span>
        </div>
        <div class="product-card-price-row">
          <span class="price-label">Box Rate (10x):</span>
          <span class="price-value highlight-gold">$${prod.boxPrice.toFixed(2)}</span>
        </div>
      `;
      
      card.innerHTML = `
        ${badgeHTML}
        <div class="product-card-image-wrap" style="cursor: pointer;">
          <img class="product-card-image" src="${prod.image}?v=2" alt="${prod.name}">
        </div>
        <div class="product-card-brand">${prod.brand}</div>
        <a href="#" class="product-card-name" id="name-${prod.id}">${prod.name}</a>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
          ${flavorHTML}
          ${formatHTML}
        </div>
        
        <div class="product-card-footer">
          <div class="product-card-prices">
            ${priceRow}
          </div>
          <button class="btn-primary btn-card-add" id="add-${prod.id}">Add to Cart</button>
        </div>
      `;
      
      // Add event listeners
      card.querySelector(".product-card-image-wrap").addEventListener("click", () => this.openModal(prod));
      card.querySelector(".product-card-name").addEventListener("click", (e) => {
        e.preventDefault();
        this.openModal(prod);
      });
      
      card.querySelector(".btn-card-add").addEventListener("click", (e) => {
        const flavorSelect = document.getElementById(`flavor-${prod.id}`);
        const formatSelect = document.getElementById(`format-${prod.id}`);
        
        const chosenFlavor = flavorSelect ? flavorSelect.value : (prod.flavors[0] || "Default");
        const chosenFormat = formatSelect ? formatSelect.value : (prod.isBoxOnly ? "Box" : "Single");
        
        this.addToCart(prod, chosenFlavor, chosenFormat, 1);
        
        const btn = e.target;
        btn.innerText = "Added! ✓";
        btn.style.background = "linear-gradient(135deg, #a3e635 0%, #84cc16 100%)";
        setTimeout(() => {
          btn.innerText = "Add to Cart";
          btn.style.background = "";
        }, 1000);
      });
      
      grid.appendChild(card);
    });
  }

}





