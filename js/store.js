/* ==========================================================================
   STOREFRONT MAIN CONTROLLER (OZCHEAPVAPES REBRAND)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  window.store = new StoreApp();
});

class StoreApp {
  constructor() {
    this.config = null;
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
    this.loadCart();
    
    // Once configuration is loaded, initialize dynamic SEO and settings
    this.applySEO();
    this.applySettings();
    
    // Render templates
    this.renderCategoryTabs();
    this.renderBrandFilters();
    this.renderProducts();
    
    // Bind all events
    this.bindEvents();
    
    // Update cart counts
    this.updateCartUI();
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
    if (localStorage.getItem("age_verified") === "true") {
      ageGate.classList.add("hidden");
    }

    verifyBtn.addEventListener("click", () => {
      localStorage.setItem("age_verified", "true");
      ageGate.classList.add("hidden");
    });

    rejectBtn.addEventListener("click", () => {
      window.location.href = "https://www.google.com";
    });

    if (clearCookieBtn) {
      clearCookieBtn.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("age_verified");
        alert("Age Verification cache cleared. The age gate will show on next reload.");
        location.reload();
      });
    }
  }

  async loadConfig() {
    // 1. Check preview settings in localStorage
    const localConfig = localStorage.getItem("crown_gold_config");
    if (localConfig) {
      try {
        this.config = JSON.parse(localConfig);
        console.log("Loaded configuration from local preview storage.");
        return;
      } catch (e) {
        console.error("Failed parsing localStorage config, falling back.", e);
      }
    }

    // 2. Fetch deployed config.json
    try {
      const response = await fetch("config.json");
      if (response.ok) {
        this.config = await response.json();
        console.log("Loaded configuration from config.json.");
        return;
      }
    } catch (e) {
      console.warn("Could not load config.json. Falling back to default script.");
    }

    // 3. Fallback to JS config default
    if (window.CONFIG_DEFAULT) {
      this.config = window.CONFIG_DEFAULT;
      console.log("Loaded configuration from config_default.js fallback.");
    } else {
      alert("Error: Core configuration failed to load.");
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
      const li = document.createElement("li");
      li.className = "filter-item";
      
      const isChecked = this.selectedBrands.includes(brand);
      li.innerHTML = `
        <label class="filter-checkbox-label">
          <input type="checkbox" name="brand-filter" value="${brand}" class="filter-checkbox" ${isChecked ? "checked" : ""}>
          ${brand}
        </label>
      `;
      
      li.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) {
          this.selectedBrands.push(brand);
        } else {
          this.selectedBrands = this.selectedBrands.filter(b => b !== brand);
        }
        this.renderProducts();
      });
      
      container.appendChild(li);
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
          <img class="product-card-image" src="${prod.image}" alt="${prod.name}">
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
    
    const modal = document.getElementById("product-detail-modal");
    const mImg = document.getElementById("modal-image");
    const mBrand = document.getElementById("modal-brand");
    const mName = document.getElementById("modal-name");
    const mDesc = document.getElementById("modal-description");
    
    const mFlavorSelect = document.getElementById("modal-flavor-select");
    const mFormatSelect = document.getElementById("modal-format-select");
    const mPriceValue = document.getElementById("modal-price-value");
    const mPriceLabel = document.getElementById("modal-price-label");
    
    // Fill text
    mImg.src = product.image;
    mBrand.innerText = product.brand;
    mName.innerText = product.name;
    mDesc.innerText = product.description;
    
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
    const stored = localStorage.getItem("crown_gold_cart");
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
    localStorage.setItem("crown_gold_cart", JSON.stringify(this.cart));
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

    // Hardcode free shipping on all orders over $200 (updated from $250)
    const shipping = (total >= 200 || total === 0) ? 0 : 15.00;
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
          <img class="cart-item-image" src="${item.image}" alt="${item.name}">
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
    document.getElementById("checkout-success").style.display = "none";
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
    
    // LOG DETAILED CLIENT INFORMATION & BROWSER METADATA
    const metadata = {
      userAgent: navigator.userAgent,
      resolution: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      localTime: new Date().toString(),
      referrer: document.referrer || "direct"
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
      metadata // Save user agent metrics
    };
    
    const storedOrders = localStorage.getItem("crown_gold_orders");
    let ordersList = [];
    if (storedOrders) {
      try {
        ordersList = JSON.parse(storedOrders);
      } catch(e) {}
    }
    ordersList.unshift(order);
    localStorage.setItem("crown_gold_orders", JSON.stringify(ordersList));
    
    // Display Checkout instructions
    const successPayid = document.getElementById("success-payid");
    const successBank = document.getElementById("success-bank-name");
    const successName = document.getElementById("success-account-name");
    const successBsb = document.getElementById("success-bsb");
    const successAccNum = document.getElementById("success-account-num");
    const successRef = document.getElementById("success-ref");
    
    const bank = this.config.settings.bankDetails;
    if (successPayid) successPayid.innerText = bank.payId || "vapesonlineaustralia@proton.me";
    if (successBank) successBank.innerText = bank.bankName;
    if (successName) successName.innerText = bank.accountName;
    if (successBsb) successBsb.innerText = bank.bsb;
    if (successAccNum) successAccNum.innerText = bank.accountNumber;
    if (successRef) successRef.innerText = refCode;
    
    // Clear cart
    this.cart = [];
    localStorage.removeItem("crown_gold_cart");
    this.updateCartUI();
    
    // Swap checkout view screen
    document.getElementById("checkout-content").style.display = "none";
    document.getElementById("checkout-success").style.display = "block";
  }

  /* ==========================================================================
     7. GENERAL BINDING EVENTS
     ========================================================================= */
  
  bindEvents() {
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
    
    document.getElementById("modal-close").addEventListener("click", () => this.closeModal());
    document.getElementById("product-detail-modal").addEventListener("click", (e) => {
      if (e.target === document.getElementById("product-detail-modal")) this.closeModal();
    });
    
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
  }
}
