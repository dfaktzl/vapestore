/* ==========================================================================
   DEFAULT CATALOG AND SITE CONFIGURATION
   ========================================================================== */

const CONFIG_DEFAULT = {
  seo: {
    title: "Crown & Gold | Australia's Premium Smoke & Vape Wholesale",
    description: "Welcome to Crown & Gold. We offer authentic IGET, Alibarbar, cigarette cartons, and bulk boxes of Waka and HQD. Premium bank-transfer checkout with fast, discreet shipping Australia-wide.",
    keywords: "cigarettes online australia, cheap cigarettes, iget bar wholesale, buy vapes in bulk, waka box wholesale, alibarbar vape australia, tobacco delivery, cheap smokes sydney"
  },
  settings: {
    siteName: "Crown & Gold",
    tagline: "The Luxury Standard in Smokes & Vapes",
    contactEmail: "orders@crowngoldstore.com",
    contactPhone: "+61 488 888 888",
    announcement: "✨ luxury wholesale: enjoy bank transfer discounts & express shipping on all orders over $250! ✨",
    ageLimit: 18,
    bankDetails: {
      bankName: "Commonwealth Bank of Australia",
      accountName: "CROWN & GOLD LOGISTICS",
      bsb: "062-900",
      accountNumber: "1088 4729"
    }
  },
  categories: [
    { id: "all", name: "All Products" },
    { id: "cigarettes", name: "Cigarette Cartons" },
    { id: "vapes-single", name: "IGET & Alibarbar (Singles/Cartons)" },
    { id: "vapes-boxes", name: "Waka & HQD Boxes (Wholesale 10x)" }
  ],
  products: [
    /* ==================== ALIBARBAR ==================== */
    {
      id: "alibarbar-toybox-8k",
      brand: "Alibarbar",
      name: "Alibarbar Toybox 8000 Puffs",
      category: "vapes-single",
      price: 38.00,
      boxPrice: 320.00, // Box of 10
      isBoxOnly: false,
      flavors: ["Blue Razz Ice", "Double Apple", "Strawberry Kiwi", "Watermelon Bubblegum", "Lush Ice", "Grape Mint"],
      image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", // Fallback placeholder
      description: "Experience the unique Toybox design by Alibarbar. Featuring 8000 puffs of dense vapor, mesh coil technology for enhanced flavor, and a rechargeable 650mAh Type-C battery.",
      inStock: true,
      popular: true
    },
    {
      id: "alibarbar-link-12k",
      brand: "Alibarbar",
      name: "Alibarbar Link 12000 Puffs (Smart Display)",
      category: "vapes-single",
      price: 45.00,
      boxPrice: 380.00,
      isBoxOnly: false,
      flavors: ["Peach Mango Watermelon", "Triple Berry Ice", "Strawberry Banana", "Cool Mint", "Cherry Lemonade"],
      image: "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "The ultimate Alibarbar vape featuring a smart display screen showing e-liquid level and battery percentage. Dual-mesh coil, adjustable airflow, and 12,000 premium puffs.",
      inStock: true,
      popular: false
    },
    
    /* ==================== IGET PRODUCTS ==================== */
    {
      id: "iget-bar-3500",
      brand: "IGET",
      name: "IGET Bar 3500 Puffs",
      category: "vapes-single",
      price: 32.00,
      boxPrice: 260.00,
      isBoxOnly: false,
      flavors: ["Blackberry Raspberry Ice", "Strawberry Watermelon", "Double Apple", "Banana Ice", "Grape Ice", "Blueberry Ice", "Mango Ice", "Passion Fruit Grape", "Strawberry Kiwi"],
      image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "Australia's favorite disposable vape. The IGET Bar features a sturdy ergonomic design, pre-filled with 12mL of premium e-liquid and a 1500mAh built-in battery delivering 3500 pure puffs.",
      inStock: true,
      popular: true
    },
    {
      id: "iget-legend-4000",
      brand: "IGET",
      name: "IGET Legend 4000 Puffs",
      category: "vapes-single",
      price: 36.00,
      boxPrice: 290.00,
      isBoxOnly: false,
      flavors: ["Lush Ice", "Mango Banana Ice", "Passion Fruit Melon Ice", "Grape Blue Razz", "Pink Lemonade", "Pineapple Coconut Ice"],
      image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "Elegantly designed with translucent PCTG materials. The IGET Legend features a mesh coil for smooth hits and rich clouds, producing 4000 satisfying puffs.",
      inStock: true,
      popular: false
    },
    {
      id: "iget-hot-5500",
      brand: "IGET",
      name: "IGET Hot L5500 Puffs",
      category: "vapes-single",
      price: 40.00,
      boxPrice: 320.00,
      isBoxOnly: false,
      flavors: ["Watermelon Ice", "Strawberry Mint", "Double Apple Ice", "Aloe Grape", "Cola Ice", "Blueberry Blackberry"],
      image: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "A futuristic aluminum-housed device with advanced heating elements. Delivers 5500 puffs, high throat hit, and consistent flavor intensity from the first puff to the last.",
      inStock: true,
      popular: true
    },

    /* ==================== POPULAR CIGARETTES (CARTONS) ==================== */
    {
      id: "cig-marlboro-gold",
      brand: "Marlboro",
      name: "Marlboro Gold Carton (10 Packs x 20 Cigarettes)",
      category: "cigarettes",
      price: 240.00,
      boxPrice: 240.00,
      isBoxOnly: true,
      flavors: ["Standard Smooth"],
      image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "The world-famous Marlboro Gold. Known for its refined, smooth tobacco blend and exceptional quality. Sold strictly as a carton containing 200 cigarettes.",
      inStock: true,
      popular: true
    },
    {
      id: "cig-winfield-blue",
      brand: "Winfield",
      name: "Winfield Blue Carton (10 Packs x 25 Cigarettes)",
      category: "cigarettes",
      price: 285.00,
      boxPrice: 285.00,
      isBoxOnly: true,
      flavors: ["Classic Blue Blend"],
      image: "https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "An absolute Australian classic. Winfield Blue offers the signature rich domestic blend. Carton contains 10 packs of 25s (250 cigarettes total).",
      inStock: true,
      popular: true
    },
    {
      id: "cig-jps-blue",
      brand: "JPS",
      name: "JPS Blue Carton (10 Packs x 20 Cigarettes)",
      category: "cigarettes",
      price: 210.00,
      boxPrice: 210.00,
      isBoxOnly: true,
      flavors: ["Smooth Blue"],
      image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "John Player Special Blue cartons. Premium fine-cut tobacco, smooth draw and affordable bulk pricing. Contains 200 cigarettes.",
      inStock: true,
      popular: false
    },
    {
      id: "cig-bh-classic",
      brand: "Benson & Hedges",
      name: "Benson & Hedges Classic Carton (10 Packs x 20 Cigarettes)",
      category: "cigarettes",
      price: 265.00,
      boxPrice: 265.00,
      isBoxOnly: true,
      flavors: ["Classic Rich Tobacco"],
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "Benson & Hedges Classic Red cartons. Gold-leaf tobacco blend offering a full-flavored, luxurious, and clean smoke. 200 cigarettes per carton.",
      inStock: true,
      popular: false
    },

    /* ==================== BOX-ONLY VAPES (HQD & WAKA) ==================== */
    {
      id: "waka-sopro-10k-box",
      brand: "Waka",
      name: "Waka SoPro DM8000 Box (10x Disposables)",
      category: "vapes-boxes",
      price: 230.00, // Wholesale Box price
      boxPrice: 230.00,
      isBoxOnly: true,
      flavors: ["Watermelon Chill", "Triple Mango", "Strawberry Burst", "Blueberry Splash", "Minty Mint", "Raspberry Watermelon"],
      image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "WHOLESALE ONLY BOX. Powered by Relx, the Waka SoPro features dual mesh coils, boost mode for massive cloud production, and clear status lights. Each box contains 10 units of the selected flavor.",
      inStock: true,
      popular: true
    },
    {
      id: "hqd-cuvie-box",
      brand: "HQD",
      name: "HQD Cuvie Bar Box (10x Disposables)",
      category: "vapes-boxes",
      price: 210.00,
      boxPrice: 210.00,
      isBoxOnly: true,
      flavors: ["Black Ice", "Grapey", "Lush Ice", "Strawberry Banana", "Mango Peach", "Double Apple"],
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      description: "WHOLESALE ONLY BOX. HQD Cuvie Bar disposables featuring 7000 puffs, mesh heating coils, and sleek designs. Each box contains 10 units of the selected flavor.",
      inStock: true,
      popular: false
    }
  ]
};

// Export to window object for frontend consumption
if (typeof window !== "undefined") {
  window.CONFIG_DEFAULT = CONFIG_DEFAULT;
}

// Node export if required
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG_DEFAULT;
}
