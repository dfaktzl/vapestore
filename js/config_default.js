/* ==========================================================================
   DEFAULT CATALOG AND SITE CONFIGURATION (OZCHEAPVAPES LOCAL IMAGE LINKS)
   ========================================================================== */

const CONFIG_DEFAULT = {
  seo: {
    title: "Vape 'R' Aus | Buy Cheap Vapes & Cigarettes Online Australia",
    description: "Vape 'R' Aus & Smokes is Australia's #1 trusted online vape & smoke shop. Buy cheap cigarettes online, IGET Bar 3500, Alibarbar, Waka SoPro, & HQD boxes at discount wholesale prices. Bank transfer & PayID processed with fast, discreet shipping.",
    keywords: "buy vapes online, cheap vapes australia, cheap cigarettes online, iget bar 3500 online, alibarbar vape, waka box wholesale, cheap smokes sydney, vaperaus, local cig supply, auvaper, quantum vape, tobacco delivery australia"
  },
  settings: {
    siteName: "Vape 'R' Aus",
    tagline: "Best Deals on Vapes & Smokes in Australia",
    contactEmail: "vapesonlineaustralia@proton.me",
    contactPhone: "0402 179 489",
    announcement: "🔥 VAPE 'R' AUS: FREE EXPRESS SHIPPING ON ALL ORDERS OVER $200! PAYID & BANK XFER ACCEPTED 🔥",
    ageLimit: 18,
    orderSyncUrl: "",
    bankDetails: {
      payId: "vapesonlineaustralia@proton.me",
      bankName: "NAB - National Australia Bank",
      accountName: "Vapes Discount Australia",
      bsb: "086-724",
      accountNumber: "91-591-6658"
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
      price: 36.00,
      boxPrice: 290.00, // Box of 10
      isBoxOnly: false,
      flavors: ["Blue Razz Ice", "Double Apple", "Strawberry Kiwi", "Watermelon Bubblegum", "Lush Ice", "Grape Mint"],
      image: "img/alibarbar_toybox_8k.webp",
      description: "Experience the unique Toybox design by Alibarbar. Featuring 8000 puffs of dense flavor, mesh coil heating, and a rechargeable Type-C battery. Available in single units or bulk boxes of 10.",
      inStock: true,
      popular: true
    },
    {
      id: "alibarbar-link-12k",
      brand: "Alibarbar",
      name: "Alibarbar Link 12000 Puffs (Smart Display)",
      category: "vapes-single",
      price: 42.00,
      boxPrice: 340.00,
      isBoxOnly: false,
      flavors: ["Peach Mango Watermelon", "Triple Berry Ice", "Strawberry Banana", "Cool Mint", "Cherry Lemonade"],
      image: "img/alibarbar_link_12k.webp",
      description: "Premium Alibarbar vape featuring a smart display screen showing e-liquid level and battery percentage. Dual-mesh coil, adjustable airflow, and 12,000 premium puffs.",
      inStock: true,
      popular: false
    },
    
    /* ==================== IGET PRODUCTS ==================== */
    {
      id: "iget-bar-3500",
      brand: "IGET",
      name: "IGET Bar 3500 Puffs",
      category: "vapes-single",
      price: 30.00,
      boxPrice: 240.00,
      isBoxOnly: false,
      flavors: ["Blackberry Raspberry Ice", "Strawberry Watermelon", "Double Apple", "Banana Ice", "Grape Ice", "Blueberry Ice", "Mango Ice", "Passion Fruit Grape", "Strawberry Kiwi"],
      image: "img/iget_bar_3500.webp",
      description: "Australia's favorite disposable vape. The IGET Bar features a sturdy ergonomic design, pre-filled with 12mL of premium e-liquid and a 1500mAh built-in battery delivering 3500 pure puffs.",
      inStock: true,
      popular: true
    },
    {
      id: "iget-legend-4000",
      brand: "IGET",
      name: "IGET Legend 4000 Puffs",
      category: "vapes-single",
      price: 34.00,
      boxPrice: 270.00,
      isBoxOnly: false,
      flavors: ["Lush Ice", "Mango Banana Ice", "Passion Fruit Melon Ice", "Grape Blue Razz", "Pink Lemonade", "Pineapple Coconut Ice"],
      image: "img/iget_legend_4000.webp",
      description: "Elegantly designed with translucent PCTG materials. The IGET Legend features a mesh coil for smooth hits and rich clouds, producing 4000 satisfying puffs.",
      inStock: true,
      popular: false
    },
    {
      id: "iget-hot-5500",
      brand: "IGET",
      name: "IGET Hot L5500 Puffs",
      category: "vapes-single",
      price: 38.00,
      boxPrice: 300.00,
      isBoxOnly: false,
      flavors: ["Watermelon Ice", "Strawberry Mint", "Double Apple Ice", "Aloe Grape", "Cola Ice", "Blueberry Blackberry"],
      image: "img/iget_hot_5500.webp",
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
      price: 220.00,
      boxPrice: 220.00,
      isBoxOnly: true,
      flavors: ["Standard Smooth"],
      image: "img/marlboro_gold.webp",
      description: "The world-famous Marlboro Gold. Known for its refined, smooth tobacco blend and exceptional quality. Sold strictly as a carton containing 200 cigarettes.",
      inStock: true,
      popular: true
    },
    {
      id: "cig-winfield-blue",
      brand: "Winfield",
      name: "Winfield Blue Carton (10 Packs x 25 Cigarettes)",
      category: "cigarettes",
      price: 260.00,
      boxPrice: 260.00,
      isBoxOnly: true,
      flavors: ["Classic Blue Blend"],
      image: "img/winfield_blue.webp",
      description: "An absolute Australian classic. Winfield Blue offers the signature rich domestic tobacco blend. Carton contains 10 packs of 25s (250 cigarettes total).",
      inStock: true,
      popular: true
    },
    {
      id: "cig-jps-blue",
      brand: "JPS",
      name: "JPS Blue Carton (10 Packs x 20 Cigarettes)",
      category: "cigarettes",
      price: 190.00,
      boxPrice: 190.00,
      isBoxOnly: true,
      flavors: ["Smooth Blue"],
      image: "img/jps_blue.webp",
      description: "John Player Special Blue cartons. Premium fine-cut tobacco, smooth draw and affordable bulk pricing. Contains 200 cigarettes.",
      inStock: true,
      popular: false
    },
    {
      id: "cig-bh-classic",
      brand: "Benson & Hedges",
      name: "Benson & Hedges Classic Carton (10 Packs x 20 Cigarettes)",
      category: "cigarettes",
      price: 245.00,
      boxPrice: 245.00,
      isBoxOnly: true,
      flavors: ["Classic Rich Tobacco"],
      image: "img/bh_classic.webp",
      description: "Benson & Hedges Classic Red cartons. Gold-leaf tobacco blend offering a full-flavored, luxurious, and clean smoke. 200 cigarettes per carton.",
      inStock: true,
      popular: false
    },

    /* ==================== BOX-ONLY VAPES (HQD & WAKA) ==================== */
    {
      id: "hqd-cuvie-box",
      brand: "HQD",
      name: "HQD Cuvie Bar Box (10x Disposables)",
      category: "vapes-boxes",
      price: 175.00, // Cheapest Box, No Singles
      boxPrice: 175.00,
      isBoxOnly: true,
      flavors: ["Black Ice", "Grapey", "Lush Ice", "Strawberry Banana", "Mango Peach", "Double Apple"],
      image: "img/hqd_cuvie_box.png",
      description: "WHOLESALE ONLY BOX (Cheapest Box Option - No Singles Available). HQD Cuvie Bar disposables featuring 7000 puffs and mesh heating coils. Each box contains 10 units of the selected flavor.",
      inStock: true,
      popular: true
    },
    {
      id: "waka-sopro-10k-box",
      brand: "Waka",
      name: "Waka SoPro DM8000 Box (10x Disposables)",
      category: "vapes-boxes",
      price: 210.00,
      boxPrice: 210.00,
      isBoxOnly: true,
      flavors: ["Watermelon Chill", "Triple Mango", "Strawberry Burst", "Blueberry Splash", "Minty Mint", "Raspberry Watermelon"],
      image: "img/waka_sopro_box.webp",
      description: "WHOLESALE ONLY BOX. Powered by Relx, the Waka SoPro features dual mesh coils, boost mode for massive cloud production, and clear status lights. Each box contains 10 units of the selected flavor.",
      inStock: true,
      popular: false
    }
  ],
  guides: [
    {
      id: "how-to-clean-vape-coil",
      title: "How to Clean a Vape Coil: A Step-by-Step Maintenance Guide",
      keyword: "how to clean a vape coil",
      date: "2026-06-25",
      summary: "Extend the life of your vape coils, improve flavor, and prevent burnt hits with our simple step-by-step coil cleaning guide.",
      content: "Cleaning your vape coils regularly is one of the best ways to ensure a clean taste and extend their lifespan. Over time, e-liquid residue (commonly known as 'gunk') builds up on the heating coil and wick. This residue can lead to a burnt taste, reduced vapor production, and overall poor performance.\n\n### Why Clean Your Vape Coils?\n1. **Restore Flavor:** A build-up of old sweetener and flavoring can mute new e-liquid profiles.\n2. **Extend Coil Lifespan:** Removing debris prevents the coil from overheating and burning out prematurely.\n3. **Save Money:** Reusing clean coils reduces the frequency of buying replacements.\n\n### Step-by-Step Cleaning Process\n1. **Disassemble the Tank:** Carefully remove the tank from your mod and unscrew the coil head.\n2. **Rinse in Warm Water:** Run warm water through the coil to wash away loose e-liquid. For deep cleaning, submerge the coil in a bowl of warm water for 30 minutes.\n3. **Use an Alcohol Bath (Optional):** For stubborn build-ups, soak the coil in high-proof grain alcohol (like ethanol or vodka) for 2 hours, then rinse thoroughly with warm water.\n4. **Air Dry Completely:** This is the most crucial step. Place the coil on a paper towel and let it dry for at least 24 hours. Placing a coil with water in it back into your vape can cause spitting and short circuits.\n5. **Prime and Reassemble:** Once bone-dry, apply a few drops of e-liquid directly onto the wick, screw the coil back into the tank, and fill it. Let it sit for 5-10 minutes before firing.",
      author: "Vape 'R' Aus Education"
    },
    {
      id: "understanding-vg-pg-ratios",
      title: "Understanding VG/PG Ratios: The Complete E-Liquid Guide",
      keyword: "understanding vg/pg ratios",
      date: "2026-06-25",
      summary: "Learn the difference between Vegetable Glycerin (VG) and Propylene Glycol (PG) to optimize vapor production and throat hit for your device.",
      content: "Every bottle of e-liquid contains two primary base carriers: Vegetable Glycerin (VG) and Propylene Glycol (PG). The ratio between these two fluids determines how your e-liquid behaves, the amount of vapor it produces, the severity of the throat hit, and which devices it is compatible with.\n\n### What is Vegetable Glycerin (VG)?\nVG is a thick, sweet vegetable-derived liquid. \n* **Characteristics:** Produces massive vapor clouds, offers a smooth throat hit, and has a slight natural sweetness.\n* **Best For:** Sub-ohm devices, high-wattage mods, and direct-to-lung (DTL) vaping styles.\n\n### What is Propylene Glycol (PG)?\nPG is a thin, odorless, and tasteless organic compound.\n* **Characteristics:** Carries flavor more effectively, provides a strong 'throat hit' similar to traditional smoking, and has a very thin viscosity.\n* **Best For:** Low-wattage pod devices, starter kits, and mouth-to-lung (MTL) vaping styles.\n\n### Choosing Your Ideal VG/PG Ratio\n* **70% VG / 30% PG:** The gold standard for sub-ohm vaping. Excellent cloud production and smooth inhales.\n* **50% VG / 50% PG:** Perfect for pod systems (like IGET or Alibarbar style systems) and starter kits. Balanced throat hit and sharp flavor delivery.\n* **Max VG:** Best for vapers with PG sensitivities and cloud chasing enthusiasts.",
      author: "Vape 'R' Aus Education"
    },
    {
      id: "cigarette-carton-storage-guide",
      title: "How to Store Cigarette Cartons: Keeping Tobacco Fresh",
      keyword: "how to store cigarette cartons",
      date: "2026-06-25",
      summary: "Discover the best techniques to preserve the freshness and flavor of bulk cigarette cartons and loose leaf tobacco.",
      content: "Buying cigarettes in bulk cartons is a highly cost-effective option, but proper storage is vital to prevent the tobacco from drying out, losing its natural aroma, or becoming stale. Storing your tobacco products correctly preserves their moisture levels and premium smoking quality.\n\n### Environmental Factors Affecting Tobacco\n1. **Humidity:** Excessive humidity can cause mold, while very dry air makes tobacco burn hot and harsh.\n2. **Temperature:** Keep cartons away from high heat sources, which bake the oils out of the leaf.\n3. **Air Exposure:** Once cellophane is opened, oxygen speeds up the drying process.\n\n### Best Storage Practices\n* **Keep Sealed:** Do not open the cellophane wrapping around the carton until you are ready to smoke the individual packs.\n* **Cool, Dark Place:** Store cartons in a drawer, closet, or cabinet away from direct sunlight and temperature fluctuations.\n* **Use Airtight Containers:** For long-term storage of opened packs, placing them in a sealed container or high-quality ziplock bag with a humidity control pack (like Boveda 62%) is highly recommended.\n* **Never Freeze:** Avoid putting cigarettes in the freezer, as freezing cycles dry out the tobacco fibers and ruin the paper wrappers.",
      "author": "Vape 'R' Aus Education"
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
