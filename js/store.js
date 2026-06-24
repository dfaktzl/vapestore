/* ==========================================================================
   STOREFRONT MAIN CONTROLLER (LUXURY GOLD)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize App
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
      // Redirect to safety or search engine
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
      console.warn("Could not load config.json (expected in local file:// mode). Falling back to default script.");
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
    
    // Extract unique brands
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
      // 1. Category check
      if (this.activeCategory !== "all") {
        if (prod.category !== this.activeCategory) return false;
      }
      
      // 2. Brand check
      if (this.selectedBrands.length > 0) {
        if (!this.selectedBrands.includes(prod.brand)) return false;
      }
      
      // 3. Search check
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const matchesName = prod.name.toLowerCase().includes(query);
        const matchesBrand = prod.brand.toLowerCase().includes(query);
        const matchesFlavor = prod.flavors.some(f => f.toLowerCase().includes(query));
        if (!matchesName && !matchesBrand && !matchesFlavor) return false;
      }
      
      // 4. Price check
      if (this.selectedPrices.length > 0) {
        let matchPrice = false;
        if (this.selectedPrices.includes("under-50") && prod.price < 50) matchPrice = true;
        if (this.selectedPrices.includes("50-250") && prod.price >= 50 && prod.price <= 250) matchPrice = true;
        if (this.selectedPrices.includes("over-250") && prod.price > 250) matchPrice = true;
        if (!matchPrice) return false;
      }

      // 5. Format check
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
    // "featured" leaves the products in default order

    // Render count
    if (counter) counter.innerText = filtered.length;
    
    // Clear grid
    grid.innerHTML = "";
    
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-catalog">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">No products match your criteria</h3>
          <p class="empty-desc">Try clearing filters or searching for another flavor.</p>
        </div>
      `;
      return;
    }
    
    // Render cards
    filtered.forEach(prod => {
      const card = document.createElement("div");
      card.className = "product-card glass-card animate-slideup";
      
      // Badges
      let badgeHTML = "";
      if (prod.popular) {
        badgeHTML = `<div class="product-badge">Best Seller</div>`;
      } else if (prod.isBoxOnly) {
        badgeHTML = `<div class="product-badge">Wholesale Box</div>`;
      }
      
      // Flavor select
      let flavorHTML = "";
      if (prod.flavors && prod.flavors.length > 0) {
        flavorHTML = `<select class="product-card-flavor-select" id="flavor-${prod.id}">`;
        prod.flavors.forEach(flavor => {
          flavorHTML += `<option value="${flavor}">${flavor}</option>`;
        });
        flavorHTML += `</select>`;
      }
      
      // Prices row
      let priceRow = "";
      if (prod.isBoxOnly) {
        priceRow = `
          <div class="product-card-price-row">
            <span class="price-label">Wholesale Box:</span>
            <span class="price-value highlight-gold">$${prod.price.toFixed(2)}</span>
          </div>
        `;
      } else {
        priceRow = `
          <div class="product-card-price-row">
            <span class="price-label">Single Unit:</span>
            <span class="price-value">$${prod.price.toFixed(2)}</span>
          </div>
          <div class="product-card-price-row">
            <span class="price-label">Box (10x):</span>
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
        
        ${flavorHTML}
        
        <div class="product-card-footer">
          <div class="product-card-prices">
            ${priceRow}
          </div>
          <button class="btn-primary btn-card-add" id="add-${prod.id}">Add to Cart</button>
        </div>
      `;
      
      // Add Event Listeners
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
        const select = card.querySelector(`#flavor-${prod.id}`);
        const selectedFlav = select ? select.value : (prod.flavors[0] || "Default");
        this.addToCart(prod, selectedFlav, 1);
        
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
    
    const modal = document.getElementById("product-detail-modal");
    const mImg = document.getElementById("modal-image");
    const mBrand = document.getElementById("modal-brand");
    const mName = document.getElementById("modal-name");
    const mDesc = document.getElementById("modal-description");
    const mFlavors = document.getElementById("modal-flavors");
    const mPriceSingle = document.getElementById("modal-price-single");
    const mPriceBox = document.getElementById("modal-price-box");
    const mPriceBoxRow = document.getElementById("modal-price-box-row");
    const mFlavGroup = document.getElementById("modal-flavor-group");
    
    // Fill text
    mImg.src = product.image;
    mBrand.innerText = product.brand;
    mName.innerText = product.name;
    mDesc.innerText = product.description;
    
    // Price renders
    mPriceSingle.innerText = `$${product.price.toFixed(2)}`;
    if (product.isBoxOnly) {
      mPriceBoxRow.style.display = "none";
      mPriceSingle.previousElementSibling.innerText = "Wholesale Price:";
      mPriceSingle.classList.add("highlight-gold");
    } else {
      mPriceBoxRow.style.display = "flex";
      mPriceSingle.previousElementSibling.innerText = "Single Price:";
      mPriceSingle.classList.remove("highlight-gold");
      mPriceBox.innerText = `$${product.boxPrice.toFixed(2)}`;
    }
    
    // Render flavor pills
    mFlavors.innerHTML = "";
    if (product.flavors && product.flavors.length > 0) {
      mFlavGroup.style.display = "block";
      product.flavors.forEach(flavor => {
        const pill = document.createElement("div");
        pill.className = `modal-flavor-pill ${this.selectedFlavor === flavor ? "active" : ""}`;
        pill.innerText = flavor;
        
        pill.addEventListener("click", () => {
          this.selectedFlavor = flavor;
          // toggle classes
          mFlavors.querySelectorAll(".modal-flavor-pill").forEach(p => p.classList.remove("active"));
          pill.classList.add("active");
        });
        
        mFlavors.appendChild(pill);
      });
    } else {
      mFlavGroup.style.display = "none";
    }
    
    // Open
    modal.classList.add("active");
  }

  closeModal() {
    const modal = document.getElementById("product-detail-modal");
    modal.classList.remove("active");
    this.selectedProduct = null;
  }

  /* ==========================================================================
     4. CART MANAGEMENT & LOGIC
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

  addToCart(product, flavor, qty) {
    const existing = this.cart.find(item => item.id === product.id && item.flavor === flavor);
    
    if (existing) {
      existing.quantity += qty;
    } else {
      this.cart.push({
        id: product.id,
        brand: product.brand,
        name: product.name,
        flavor: flavor,
        price: product.price,
        boxPrice: product.boxPrice || product.price,
        isBoxOnly: product.isBoxOnly,
        image: product.image,
        quantity: qty
      });
    }
    
    this.saveCart();
  }

  updateQuantity(id, flavor, delta) {
    const item = this.cart.find(item => item.id === id && item.flavor === flavor);
    if (!item) return;
    
    item.quantity += delta;
    if (item.quantity <= 0) {
      this.cart = this.cart.filter(i => !(i.id === id && i.flavor === flavor));
    }
    
    this.saveCart();
  }

  removeFromCart(id, flavor) {
    this.cart = this.cart.filter(item => !(item.id === id && item.flavor === flavor));
    this.saveCart();
  }

  /* ==========================================================================
     5. CART CALCULATOR & BULK SAVINGS Engine
     ========================================================================== */
  
  calculateOrder() {
    let subtotal = 0;
    let total = 0;
    let savings = 0;
    let itemCount = 0;

    // Group items by product ID to check if their combined flavor quantities exceed 10 (carton rate)
    const productQuantities = {};
    this.cart.forEach(item => {
      itemCount += item.quantity;
      if (!productQuantities[item.id]) {
        productQuantities[item.id] = 0;
      }
      productQuantities[item.id] += item.quantity;
    });

    this.cart.forEach(item => {
      const singlePrice = item.price;
      const boxPrice = item.boxPrice; // e.g. 260
      const isBoxOnly = item.isBoxOnly;
      
      const totalProdQty = productQuantities[item.id];
      
      // If the product is naturally sold only in cartons/boxes (like HQD Box or Winfield),
      // or if they haven't reached 10 units threshold, they pay the default unit price.
      if (isBoxOnly || totalProdQty < 10) {
        const cost = item.quantity * singlePrice;
        subtotal += cost;
        total += cost;
      } else {
        // Carton rate discount logic:
        // Calculate the proportion of this flavor relative to total product order
        const proportion = item.quantity / totalProdQty;
        
        // Full boxes of 10 cost boxPrice. Singles cost singlePrice.
        const totalFullBoxes = Math.floor(totalProdQty / 10);
        const totalLeftoverSingles = totalProdQty % 10;
        
        const totalCalculatedCost = (totalFullBoxes * boxPrice) + (totalLeftoverSingles * singlePrice);
        const itemAllocatedCost = totalCalculatedCost * proportion;
        
        const standardCost = item.quantity * singlePrice;
        
        subtotal += standardCost;
        total += itemAllocatedCost;
        savings += (standardCost - itemAllocatedCost);
      }
    });

    // Hardcode free shipping on all orders over $250
    const shipping = (total >= 250 || total === 0) ? 0 : 15.00;
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
    
    // Update header badge
    if (countBadge) countBadge.innerText = calculations.itemCount;
    if (countText) countText.innerText = calculations.itemCount;
    
    // Update footer totals
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
    
    // Render list
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
      
      cartItem.innerHTML = `
        <div class="cart-item-image-wrap">
          <img class="cart-item-image" src="${item.image}" alt="${item.name}">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-brand">${item.brand}</div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-flavor">Flavor: <strong>${item.flavor}</strong></div>
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
      
      // Event listeners for quantity adjustment
      cartItem.querySelector(".dec-btn").addEventListener("click", () => this.updateQuantity(item.id, item.flavor, -1));
      cartItem.querySelector(".inc-btn").addEventListener("click", () => this.updateQuantity(item.id, item.flavor, 1));
      cartItem.querySelector(".cart-item-remove-btn").addEventListener("click", () => this.removeFromCart(item.id, item.flavor));
      
      itemsList.appendChild(cartItem);
    });
  }

  /* ==========================================================================
     6. CHECKOUT FLOW
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
    
    // Close cart drawer
    document.getElementById("cart-drawer").classList.remove("active");
    document.getElementById("cart-drawer-overlay").classList.remove("active");
    
    const calculations = this.calculateOrder();
    
    // Populate summaries
    subtotalText.innerText = `$${calculations.subtotal.toFixed(2)}`;
    if (calculations.savings > 0) {
      savingsText.parentElement.style.display = "flex";
      savingsText.innerText = `-$${calculations.savings.toFixed(2)}`;
    } else {
      savingsText.parentElement.style.display = "none";
    }
    shippingText.innerText = calculations.shipping === 0 ? "Free" : `$${calculations.shipping.toFixed(2)}`;
    totalText.innerText = `$${calculations.total.toFixed(2)}`;
    
    // Render simple items list
    checkList.innerHTML = "";
    this.cart.forEach(item => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.fontSize = "13px";
      row.style.marginBottom = "8px";
      row.innerHTML = `
        <span style="color:var(--text-secondary)">
          ${item.quantity}x ${item.name} (${item.flavor})
        </span>
        <strong>$${(item.quantity * item.price).toFixed(2)}</strong>
      `;
      checkList.appendChild(row);
    });
    
    // Open
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
    
    // Generate order ID and unique reference
    const orderId = `CG-${Date.now().toString().slice(-6)}`;
    const randAlpha = Math.random().toString(36).substring(2, 6).toUpperCase();
    const refCode = `REF-${Date.now().toString().slice(-4)}-${randAlpha}`;
    
    // Create order object
    const order = {
      orderId,
      refCode,
      date: new Date().toISOString(),
      customer: { name, address: `${addr}, ${city}, ${state} ${post}`, phone, email, notes },
      items: this.cart.map(i => ({ name: i.name, flavor: i.flavor, quantity: i.quantity, total: i.quantity * i.price })),
      total: calculations.total
    };
    
    // Save order locally for Admin logs
    const storedOrders = localStorage.getItem("crown_gold_orders");
    let ordersList = [];
    if (storedOrders) {
      try {
        ordersList = JSON.parse(storedOrders);
      } catch(e) {}
    }
    ordersList.unshift(order); // add to top
    localStorage.setItem("crown_gold_orders", JSON.stringify(ordersList));
    
    // Display Bank transfer details
    const successBank = document.getElementById("success-bank-name");
    const successName = document.getElementById("success-account-name");
    const successBsb = document.getElementById("success-bsb");
    const successAccNum = document.getElementById("success-account-num");
    const successRef = document.getElementById("success-ref");
    
    const bank = this.config.settings.bankDetails;
    if (successBank) successBank.innerText = bank.bankName;
    if (successName) successName.innerText = bank.accountName;
    if (successBsb) successBsb.innerText = bank.bsb;
    if (successAccNum) successAccNum.innerText = bank.accountNumber;
    if (successRef) successRef.innerText = refCode;
    
    // Clear cart
    this.cart = [];
    localStorage.removeItem("crown_gold_cart");
    this.updateCartUI();
    
    // Swap screens
    document.getElementById("checkout-content").style.display = "none";
    document.getElementById("checkout-success").style.display = "block";
  }

  /* ==========================================================================
     7. GENERAL BINDING EVENTS
     ========================================================================= */
  
  bindEvents() {
    // Search bindings
    const globalSearch = document.getElementById("global-search");
    if (globalSearch) {
      globalSearch.addEventListener("input", (e) => {
        this.searchQuery = e.target.value;
        this.renderProducts();
      });
    }
    
    // Sidebar clears
    const clearBtn = document.getElementById("btn-clear-filters");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.selectedBrands = [];
        this.selectedPrices = [];
        this.selectedFormats = [];
        this.searchQuery = "";
        
        // Uncheck all sidebar checkboxes
        document.querySelectorAll(".filter-checkbox").forEach(c => c.checked = false);
        if (globalSearch) globalSearch.value = "";
        
        this.renderProducts();
      });
    }
    
    // Sort Select
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.currentSort = e.target.value;
        this.renderProducts();
      });
    }
    
    // Sidebar format / price changes
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
    
    // Modal Close binding
    document.getElementById("modal-close").addEventListener("click", () => this.closeModal());
    document.getElementById("product-detail-modal").addEventListener("click", (e) => {
      if (e.target === document.getElementById("product-detail-modal")) this.closeModal();
    });
    
    // Modal Add Button binding
    const modalAdd = document.getElementById("btn-modal-add");
    if (modalAdd) {
      modalAdd.addEventListener("click", () => {
        if (this.selectedProduct) {
          this.addToCart(this.selectedProduct, this.selectedFlavor, 1);
          
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
    
    // Cart Drawer Toggle
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
    
    // Checkout Drawer
    const checkTrigger = document.getElementById("btn-checkout-trigger");
    const checkClose = document.getElementById("checkout-close");
    
    if (checkTrigger) checkTrigger.addEventListener("click", () => this.openCheckout());
    if (checkClose) checkClose.addEventListener("click", () => this.closeCheckout());
    
    // Form Submit
    const form = document.getElementById("checkout-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitOrder();
      });
    }
  }
}
