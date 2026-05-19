/* =====================================================
   Wellness Cafe Integrated POS - Sample Data & Storage
   =====================================================
   Real menu data from the Wellness Cafe brochure
   (Ground Floor, Block 7, FPM, UPSI).
   Data persistence handled via localStorage.
   ===================================================== */

const DB_KEY = 'wellness_cafe_pos_db_v2';

// ---------- Demo / Seed Data ---------- //
const SEED_DATA = {
  meta: {
    cafeName: "Wellness Cafe",
    tagline: "Relax . Reflect . Recharge",
    address: "Ground Floor, Block 7, FPM, UPSI",
    phone: "+60 5-450 6000",
    taxRate: 0.06,           // 6% SST
    serviceCharge: 0.0,
    currency: "RM",
    seededAt: new Date().toISOString()
  },

  // ---------- Users & Roles ---------- //
  roles: [
    { id: 1, name: "Super Admin", permissions: ["*"] },
    { id: 2, name: "Manager",     permissions: ["dashboard","pos","kds","menu","inventory","purchase","customer","promo","refund","reports","audit"] },
    { id: 3, name: "Cashier",     permissions: ["dashboard","pos","customer"] },
    { id: 4, name: "Kitchen",     permissions: ["kds"] },
    { id: 5, name: "Inventory",   permissions: ["dashboard","inventory","purchase"] }
  ],

  users: [
    { id: 1, username: "admin",   password: "admin123",   name: "System Administrator", roleId: 1, active: true, email: "admin@wellnesscafe.upsi.edu.my",   phone: "0123456789", createdAt: "2026-01-01" },
    { id: 2, username: "manager", password: "manager123", name: "Aisha Rahman",         roleId: 2, active: true, email: "manager@wellnesscafe.upsi.edu.my", phone: "0123456790", createdAt: "2026-01-05" },
    { id: 3, username: "cashier", password: "cashier123", name: "Hafiz Zulkifli",       roleId: 3, active: true, email: "cashier@wellnesscafe.upsi.edu.my", phone: "0123456791", createdAt: "2026-01-08" },
    { id: 4, username: "kitchen", password: "kitchen123", name: "Barista Liyana",       roleId: 4, active: true, email: "kitchen@wellnesscafe.upsi.edu.my", phone: "0123456792", createdAt: "2026-01-10" },
    { id: 5, username: "stock",   password: "stock123",   name: "Daniel Tan",           roleId: 5, active: true, email: "stock@wellnesscafe.upsi.edu.my",   phone: "0123456793", createdAt: "2026-01-12" }
  ],

  // ---------- Categories ---------- //
  categories: [
    { id: 1, name: "Brew-tiful Coffee",  icon: "☕",  color: "#a16207" },
    { id: 2, name: "Whisked Me Away",    icon: "🍫",  color: "#7c3aed" },
    { id: 3, name: "The Mojito Mood",    icon: "🍃",  color: "#10b981" },
    { id: 4, name: "Calming Tea Series", icon: "🍵",  color: "#0ea5e9" },
    { id: 5, name: "Specialty (NEW)",    icon: "✨",  color: "#ec4899" },
    { id: 6, name: "Boost It Up",        icon: "🚀",  color: "#f59e0b" }
  ],

  // ---------- Products (matching the real brochure) ---------- //
  // Convention: each size = its own SKU; recipe references inventory ingredient ids
  products: [
    // ===== Brew-tiful Coffee =====
    { id: 1,  name: "Americano (S)",            categoryId: 1, price: 4.50,  cost: 1.20, image: "☕", available: true,  size:"S",   recipe:[ {ingredientId:1, qty:1} ] },
    { id: 2,  name: "Americano (M)",            categoryId: 1, price: 5.50,  cost: 1.40, image: "☕", available: true,  size:"M",   recipe:[ {ingredientId:1, qty:1} ] },
    { id: 3,  name: "Americano (Iced)",         categoryId: 1, price: 6.00,  cost: 1.60, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:1, qty:1}, {ingredientId:20, qty:1} ] },

    { id: 4,  name: "Latte (S)",                categoryId: 1, price: 5.50,  cost: 1.60, image: "☕", available: true,  size:"S",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.15} ] },
    { id: 5,  name: "Latte (M)",                categoryId: 1, price: 7.50,  cost: 2.20, image: "☕", available: true,  size:"M",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20} ] },
    { id: 6,  name: "Latte (Iced)",             categoryId: 1, price: 8.00,  cost: 2.40, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:20, qty:1} ] },

    { id: 7,  name: "Cappuccino (S)",           categoryId: 1, price: 5.50,  cost: 1.60, image: "☕", available: true,  size:"S",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.15} ] },
    { id: 8,  name: "Cappuccino (M)",           categoryId: 1, price: 7.50,  cost: 2.20, image: "☕", available: true,  size:"M",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20} ] },
    { id: 9,  name: "Cappuccino (Iced)",        categoryId: 1, price: 8.00,  cost: 2.40, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:20, qty:1} ] },

    { id: 10, name: "Spanish Latte (S)",        categoryId: 1, price: 7.50,  cost: 2.30, image: "☕", available: true,  size:"S",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.15}, {ingredientId:3, qty:0.03} ] },
    { id: 11, name: "Spanish Latte (M)",        categoryId: 1, price: 9.50,  cost: 2.90, image: "☕", available: true,  size:"M",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:3, qty:0.04} ] },
    { id: 12, name: "Spanish Latte (Iced)",     categoryId: 1, price: 10.00, cost: 3.10, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:3, qty:0.04}, {ingredientId:20, qty:1} ] },

    { id: 13, name: "Mocha (S)",                categoryId: 1, price: 7.50,  cost: 2.40, image: "☕", available: true,  size:"S",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.15}, {ingredientId:4, qty:0.03} ] },
    { id: 14, name: "Mocha (M)",                categoryId: 1, price: 9.50,  cost: 3.00, image: "☕", available: true,  size:"M",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:4, qty:0.04} ] },
    { id: 15, name: "Mocha (Iced)",             categoryId: 1, price: 10.00, cost: 3.20, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:4, qty:0.04}, {ingredientId:20, qty:1} ] },

    { id: 16, name: "Hazelnut Latte (S)",       categoryId: 1, price: 7.50,  cost: 2.30, image: "☕", available: true,  size:"S",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.15}, {ingredientId:5, qty:0.02} ] },
    { id: 17, name: "Hazelnut Latte (M)",       categoryId: 1, price: 9.50,  cost: 2.90, image: "☕", available: true,  size:"M",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:5, qty:0.03} ] },
    { id: 18, name: "Hazelnut Latte (Iced)",    categoryId: 1, price: 10.00, cost: 3.10, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:5, qty:0.03}, {ingredientId:20, qty:1} ] },

    { id: 19, name: "Salted Caramel Latte (S)", categoryId: 1, price: 7.50,  cost: 2.30, image: "☕", available: true,  size:"S",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.15}, {ingredientId:6, qty:0.02} ] },
    { id: 20, name: "Salted Caramel Latte (M)", categoryId: 1, price: 9.50,  cost: 2.90, image: "☕", available: true,  size:"M",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:6, qty:0.03} ] },
    { id: 21, name: "Salted Caramel Latte (Iced)",categoryId:1,price: 10.00, cost: 3.10, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:6, qty:0.03}, {ingredientId:20, qty:1} ] },

    { id: 22, name: "Vanilla Latte (S)",        categoryId: 1, price: 7.50,  cost: 2.30, image: "☕", available: true,  size:"S",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.15}, {ingredientId:7, qty:0.02} ] },
    { id: 23, name: "Vanilla Latte (M)",        categoryId: 1, price: 9.50,  cost: 2.90, image: "☕", available: true,  size:"M",   recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:7, qty:0.03} ] },
    { id: 24, name: "Vanilla Latte (Iced)",     categoryId: 1, price: 10.00, cost: 3.10, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:1, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:7, qty:0.03}, {ingredientId:20, qty:1} ] },

    // ===== Whisked Me Away =====
    { id: 25, name: "Chocolate (S)",            categoryId: 2, price: 5.50,  cost: 1.80, image: "🍫", available: true,  size:"S",   recipe:[ {ingredientId:4, qty:0.04}, {ingredientId:2, qty:0.20} ] },
    { id: 26, name: "Chocolate (M)",            categoryId: 2, price: 7.50,  cost: 2.30, image: "🍫", available: true,  size:"M",   recipe:[ {ingredientId:4, qty:0.05}, {ingredientId:2, qty:0.25} ] },
    { id: 27, name: "Chocolate (Iced)",         categoryId: 2, price: 8.00,  cost: 2.50, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:4, qty:0.05}, {ingredientId:2, qty:0.25}, {ingredientId:20, qty:1} ] },
    { id: 28, name: "Chocolate Strawberry (Iced)",categoryId:2,price: 10.00, cost: 3.50, image: "🍓", available: true,  size:"Iced",recipe:[ {ingredientId:4, qty:0.05}, {ingredientId:2, qty:0.25}, {ingredientId:8, qty:0.03}, {ingredientId:20, qty:1} ] },

    { id: 29, name: "Matcha (S)",               categoryId: 2, price: 7.00,  cost: 2.20, image: "🍵", available: true,  size:"S",   recipe:[ {ingredientId:9, qty:0.005}, {ingredientId:2, qty:0.20} ] },
    { id: 30, name: "Matcha (M)",               categoryId: 2, price: 9.00,  cost: 2.80, image: "🍵", available: true,  size:"M",   recipe:[ {ingredientId:9, qty:0.007}, {ingredientId:2, qty:0.25} ] },
    { id: 31, name: "Matcha (Iced)",            categoryId: 2, price: 10.00, cost: 3.00, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:9, qty:0.007}, {ingredientId:2, qty:0.25}, {ingredientId:20, qty:1} ] },
    { id: 32, name: "Matcha Strawberry (Iced)", categoryId: 2, price: 12.00, cost: 4.00, image: "🍓", available: true,  size:"Iced",recipe:[ {ingredientId:9, qty:0.007}, {ingredientId:2, qty:0.25}, {ingredientId:8, qty:0.03}, {ingredientId:20, qty:1} ] },

    // ===== The Mojito Mood (all Iced) =====
    { id: 33, name: "Blue Mojito",              categoryId: 3, price: 6.00,  cost: 1.80, image: "🍹", available: true,  size:"Iced",recipe:[ {ingredientId:10, qty:0.03}, {ingredientId:11, qty:5}, {ingredientId:20, qty:1} ] },
    { id: 34, name: "Strawberry Mojito",        categoryId: 3, price: 6.00,  cost: 1.80, image: "🍹", available: true,  size:"Iced",recipe:[ {ingredientId:8, qty:0.03}, {ingredientId:11, qty:5}, {ingredientId:20, qty:1} ] },
    { id: 35, name: "Apple Mojito",             categoryId: 3, price: 6.00,  cost: 1.80, image: "🍏", available: true,  size:"Iced",recipe:[ {ingredientId:12, qty:0.03}, {ingredientId:11, qty:5}, {ingredientId:20, qty:1} ] },
    { id: 36, name: "Strawberry Lemonade",      categoryId: 3, price: 5.00,  cost: 1.50, image: "🍋", available: true,  size:"Iced",recipe:[ {ingredientId:8, qty:0.03}, {ingredientId:13, qty:1}, {ingredientId:20, qty:1} ] },
    { id: 37, name: "Lemonade",                 categoryId: 3, price: 4.00,  cost: 1.20, image: "🍋", available: true,  size:"Iced",recipe:[ {ingredientId:13, qty:1}, {ingredientId:20, qty:1} ] },

    // ===== Calming Tea Series =====
    { id: 38, name: "Earl Grey (S)",            categoryId: 4, price: 4.00,  cost: 1.00, image: "🍵", available: true,  size:"S",   recipe:[ {ingredientId:14, qty:1} ] },
    { id: 39, name: "Earl Grey (M)",            categoryId: 4, price: 5.50,  cost: 1.30, image: "🍵", available: true,  size:"M",   recipe:[ {ingredientId:14, qty:1} ] },
    { id: 40, name: "Earl Grey (Iced)",         categoryId: 4, price: 6.00,  cost: 1.50, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:14, qty:1}, {ingredientId:20, qty:1} ] },

    { id: 41, name: "Peach Tea (S)",            categoryId: 4, price: 4.00,  cost: 1.00, image: "🍑", available: true,  size:"S",   recipe:[ {ingredientId:15, qty:1} ] },
    { id: 42, name: "Peach Tea (M)",            categoryId: 4, price: 5.50,  cost: 1.30, image: "🍑", available: true,  size:"M",   recipe:[ {ingredientId:15, qty:1} ] },
    { id: 43, name: "Peach Tea (Iced)",         categoryId: 4, price: 6.00,  cost: 1.50, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:15, qty:1}, {ingredientId:20, qty:1} ] },

    { id: 44, name: "Jasmine Tea (S)",          categoryId: 4, price: 4.00,  cost: 1.00, image: "🌸", available: true,  size:"S",   recipe:[ {ingredientId:16, qty:1} ] },
    { id: 45, name: "Jasmine Tea (M)",          categoryId: 4, price: 5.50,  cost: 1.30, image: "🌸", available: true,  size:"M",   recipe:[ {ingredientId:16, qty:1} ] },
    { id: 46, name: "Jasmine Tea (Iced)",       categoryId: 4, price: 6.00,  cost: 1.50, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:16, qty:1}, {ingredientId:20, qty:1} ] },

    { id: 47, name: "Oolong Milk Peach Tea (Iced)",categoryId:4,price: 9.00, cost: 2.80, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:17, qty:1}, {ingredientId:15, qty:1}, {ingredientId:2, qty:0.20}, {ingredientId:20, qty:1} ] },

    { id: 48, name: "Teh BOH (S)",              categoryId: 4, price: 2.00,  cost: 0.60, image: "🍵", available: true,  size:"S",   recipe:[ {ingredientId:18, qty:1} ] },
    { id: 49, name: "Teh BOH (M)",              categoryId: 4, price: 3.50,  cost: 0.90, image: "🍵", available: true,  size:"M",   recipe:[ {ingredientId:18, qty:1} ] },
    { id: 50, name: "Teh BOH (Iced)",           categoryId: 4, price: 4.00,  cost: 1.10, image: "🧊", available: true,  size:"Iced",recipe:[ {ingredientId:18, qty:1}, {ingredientId:20, qty:1} ] },

    // ===== Specialty (NEW from gallery) =====
    { id: 51, name: "Americano Strawberry ✨NEW", categoryId: 5, price: 7.00,  cost: 2.20, image: "🍓", available: true, size:"Iced", recipe:[ {ingredientId:1, qty:1}, {ingredientId:8, qty:0.03}, {ingredientId:20, qty:1} ] },
    { id: 52, name: "Mango Matcha ✨NEW",         categoryId: 5, price: 12.00, cost: 4.00, image: "🥭", available: true, size:"Iced", recipe:[ {ingredientId:9, qty:0.007}, {ingredientId:19, qty:0.05}, {ingredientId:2, qty:0.20}, {ingredientId:20, qty:1} ] },
    { id: 53, name: "Chocolate Matcha ✨NEW",     categoryId: 5, price: 12.00, cost: 4.20, image: "🍫", available: true, size:"Iced", recipe:[ {ingredientId:9, qty:0.007}, {ingredientId:4, qty:0.04}, {ingredientId:2, qty:0.20}, {ingredientId:20, qty:1} ] },

    // ===== Boost It Up (Add-ons) =====
    { id: 54, name: "Change Milk to Oatside",   categoryId: 6, price: 3.00,  cost: 1.50, image: "🥛", available: true, size:"-", recipe:[ {ingredientId:21, qty:0.20} ] },
    { id: 55, name: "Extra Shot",               categoryId: 6, price: 2.00,  cost: 0.70, image: "☕", available: true, size:"-", recipe:[ {ingredientId:1, qty:1} ] },
    { id: 56, name: "Caramel Syrup",            categoryId: 6, price: 1.00,  cost: 0.20, image: "🍯", available: true, size:"-", recipe:[ {ingredientId:6, qty:0.02} ] },
    { id: 57, name: "Hazelnut Syrup",           categoryId: 6, price: 1.00,  cost: 0.20, image: "🥜", available: true, size:"-", recipe:[ {ingredientId:5, qty:0.02} ] },
    { id: 58, name: "Vanilla Syrup",            categoryId: 6, price: 1.00,  cost: 0.20, image: "🌼", available: true, size:"-", recipe:[ {ingredientId:7, qty:0.02} ] },
    { id: 59, name: "Sugar",                    categoryId: 6, price: 0.50,  cost: 0.05, image: "🍚", available: true, size:"-", recipe:[ {ingredientId:22, qty:0.01} ] }
  ],

  // ---------- Inventory ---------- //
  inventory: [
    { id: 1,  name: "Espresso Shot",          unit: "shot",  stock: 320, reorderLevel: 100, costPerUnit: 0.90, supplierId: 1 },
    { id: 2,  name: "Fresh Milk",             unit: "L",     stock: 28,  reorderLevel: 10,  costPerUnit: 7.50, supplierId: 2 },
    { id: 3,  name: "Sweetened Condensed Milk",unit:"L",     stock: 6,   reorderLevel: 2,   costPerUnit: 18.00,supplierId: 2 },
    { id: 4,  name: "Chocolate Sauce",        unit: "L",     stock: 4,   reorderLevel: 2,   costPerUnit: 26.00,supplierId: 3 },
    { id: 5,  name: "Hazelnut Syrup",         unit: "L",     stock: 3,   reorderLevel: 1,   costPerUnit: 32.00,supplierId: 3 },
    { id: 6,  name: "Caramel Syrup",          unit: "L",     stock: 3,   reorderLevel: 1,   costPerUnit: 30.00,supplierId: 3 },
    { id: 7,  name: "Vanilla Syrup",          unit: "L",     stock: 3,   reorderLevel: 1,   costPerUnit: 28.00,supplierId: 3 },
    { id: 8,  name: "Strawberry Puree",       unit: "L",     stock: 4,   reorderLevel: 1,   costPerUnit: 36.00,supplierId: 4 },
    { id: 9,  name: "Matcha Powder",          unit: "kg",    stock: 1.2, reorderLevel: 0.5, costPerUnit: 180.00,supplierId: 5 },
    { id: 10, name: "Blue Curacao Syrup",     unit: "L",     stock: 2,   reorderLevel: 1,   costPerUnit: 28.00,supplierId: 3 },
    { id: 11, name: "Mint Leaves",            unit: "leaf",  stock: 400, reorderLevel: 150, costPerUnit: 0.05, supplierId: 6 },
    { id: 12, name: "Apple Syrup",            unit: "L",     stock: 2,   reorderLevel: 1,   costPerUnit: 26.00,supplierId: 3 },
    { id: 13, name: "Lemon",                  unit: "pcs",   stock: 50,  reorderLevel: 20,  costPerUnit: 1.20, supplierId: 4 },
    { id: 14, name: "Earl Grey Tea Bag",      unit: "pcs",   stock: 90,  reorderLevel: 30,  costPerUnit: 0.80, supplierId: 7 },
    { id: 15, name: "Peach Tea Bag",          unit: "pcs",   stock: 85,  reorderLevel: 30,  costPerUnit: 0.85, supplierId: 7 },
    { id: 16, name: "Jasmine Tea Bag",        unit: "pcs",   stock: 80,  reorderLevel: 30,  costPerUnit: 0.80, supplierId: 7 },
    { id: 17, name: "Oolong Tea Bag",         unit: "pcs",   stock: 50,  reorderLevel: 20,  costPerUnit: 1.20, supplierId: 7 },
    { id: 18, name: "Teh BOH Tea Bag",        unit: "pcs",   stock: 120, reorderLevel: 50,  costPerUnit: 0.30, supplierId: 8 },
    { id: 19, name: "Mango Puree",            unit: "L",     stock: 3,   reorderLevel: 1,   costPerUnit: 38.00,supplierId: 4 },
    { id: 20, name: "Ice",                    unit: "cup",   stock: 500, reorderLevel: 200, costPerUnit: 0.10, supplierId: 9 },
    { id: 21, name: "Oat Milk (Oatside)",     unit: "L",     stock: 5,   reorderLevel: 2,   costPerUnit: 22.00,supplierId: 2 },
    { id: 22, name: "Sugar",                  unit: "kg",    stock: 8,   reorderLevel: 3,   costPerUnit: 4.50, supplierId: 8 },
    { id: 23, name: "Whipped Cream",          unit: "L",     stock: 2,   reorderLevel: 1,   costPerUnit: 22.00,supplierId: 2 },
    { id: 24, name: "Paper Cup (S)",          unit: "pcs",   stock: 250, reorderLevel: 100, costPerUnit: 0.18, supplierId: 9 },
    { id: 25, name: "Paper Cup (M)",          unit: "pcs",   stock: 200, reorderLevel: 100, costPerUnit: 0.22, supplierId: 9 },
    { id: 26, name: "Plastic Cup (Iced)",     unit: "pcs",   stock: 300, reorderLevel: 100, costPerUnit: 0.25, supplierId: 9 }
  ],

  // ---------- Suppliers ---------- //
  suppliers: [
    { id: 1, name: "BeanBoss Coffee Roasters",  contact: "Mr. Tan",       phone: "0123334441", email: "wholesale@beanboss.my",   address: "Kuala Lumpur",            category: "Coffee Beans" },
    { id: 2, name: "DairyFresh Sdn Bhd",        contact: "Puan Salmah",   phone: "0123334442", email: "orders@dairyfresh.my",    address: "Petaling Jaya, Selangor", category: "Dairy" },
    { id: 3, name: "Sweet Syrup Distributors",  contact: "Encik Faizal",  phone: "0123334443", email: "sales@sweetsyrup.my",     address: "Shah Alam, Selangor",     category: "Syrups & Sauces" },
    { id: 4, name: "Tropical Fruit Wholesale",  contact: "Mr. Chen",      phone: "0123334444", email: "info@tropicalfw.my",      address: "Klang, Selangor",         category: "Fruits & Purees" },
    { id: 5, name: "MatchaWorld Premium",       contact: "Mr. Yamato",    phone: "0123334445", email: "sales@matchaworld.my",    address: "Penang",                  category: "Tea Specialty" },
    { id: 6, name: "FreshHerbs Garden",         contact: "Puan Maimun",   phone: "0123334446", email: "orders@freshherbs.my",    address: "Cameron Highlands",       category: "Herbs" },
    { id: 7, name: "Tea & Herbs House",         contact: "Puan Rohani",   phone: "0123334447", email: "info@teaherbs.my",        address: "Penang",                  category: "Tea Bags" },
    { id: 8, name: "PantryPro Sdn Bhd",         contact: "Encik Yusof",   phone: "0123334448", email: "sales@pantrypro.my",      address: "Subang, Selangor",        category: "Pantry / Tea" },
    { id: 9, name: "Packaging Plus",            contact: "Ms. Lim",       phone: "0123334449", email: "orders@packagingplus.my", address: "Ipoh, Perak",             category: "Packaging" }
  ],

  // ---------- Customers ---------- //
  customers: [
    { id: 1, name: "Nurul Aina",       phone: "0192223331", email: "aina@upsi.edu.my",    membership: "Gold",     points: 850, joinedAt: "2026-02-10", totalSpent: 425.50 },
    { id: 2, name: "Ahmad Faris",      phone: "0192223332", email: "faris@upsi.edu.my",   membership: "Silver",   points: 320, joinedAt: "2026-03-05", totalSpent: 178.90 },
    { id: 3, name: "Siti Nurhaliza",   phone: "0192223333", email: "siti@upsi.edu.my",    membership: "Platinum", points: 1820,joinedAt: "2026-01-15", totalSpent: 912.30 },
    { id: 4, name: "Kevin Lim",        phone: "0192223334", email: "kevin@upsi.edu.my",   membership: "Silver",   points: 240, joinedAt: "2026-04-01", totalSpent: 142.60 },
    { id: 5, name: "Priya Devi",       phone: "0192223335", email: "priya@upsi.edu.my",   membership: "Gold",     points: 640, joinedAt: "2026-02-22", totalSpent: 318.40 },
    { id: 6, name: "Tan Wei Ming",     phone: "0192223336", email: "weiming@upsi.edu.my", membership: "Bronze",   points: 90,  joinedAt: "2026-04-18", totalSpent: 58.00 },
    { id: 7, name: "Farah Husna",      phone: "0192223337", email: "farah@upsi.edu.my",   membership: "Gold",     points: 720, joinedAt: "2026-02-28", totalSpent: 362.10 },
    { id: 8, name: "Walk-in Customer", phone: "",           email: "",                    membership: "None",     points: 0,   joinedAt: "2026-01-01", totalSpent: 0 }
  ],

  membershipTiers: [
    { name: "Bronze",   minSpend: 0,    discount: 0,    benefit: "1 point per RM1 spent" },
    { name: "Silver",   minSpend: 100,  discount: 0.05, benefit: "5% discount + 1.2x points" },
    { name: "Gold",     minSpend: 300,  discount: 0.08, benefit: "8% discount + 1.5x points" },
    { name: "Platinum", minSpend: 800,  discount: 0.12, benefit: "12% discount + 2x points" }
  ],

  // ---------- Promotions ---------- //
  promotions: [
    { id: 1, code: "WELCOME10",  name: "Welcome Promo 10%",    type: "percent", value: 10, minOrder: 15,  validTill: "2026-12-31", active: true },
    { id: 2, code: "STUDENT5",   name: "UPSI Student Discount",type: "percent", value: 5,  minOrder: 0,   validTill: "2026-12-31", active: true },
    { id: 3, code: "HAPPYHOUR",  name: "Happy Hour RM2 Off",   type: "fixed",   value: 2,  minOrder: 10,  validTill: "2026-06-30", active: true },
    { id: 4, code: "WELLNESS20", name: "Anniversary 20%",      type: "percent", value: 20, minOrder: 25,  validTill: "2026-05-31", active: true }
  ],

  // ---------- Operational data ---------- //
  orders: [],
  payments: [],
  refunds: [],
  auditLog: [],
  stockMovements: [],
  purchaseOrders: [],
  qrSessions: [],

  tables: [
    { id: 1, name: "T1", capacity: 2, status: "available" },
    { id: 2, name: "T2", capacity: 2, status: "available" },
    { id: 3, name: "T3", capacity: 4, status: "available" },
    { id: 4, name: "T4", capacity: 4, status: "available" },
    { id: 5, name: "T5", capacity: 4, status: "available" },
    { id: 6, name: "T6", capacity: 6, status: "available" },
    { id: 7, name: "T7", capacity: 6, status: "available" },
    { id: 8, name: "T8", capacity: 8, status: "available" }
  ]
};

// ---------- Seed past orders (last 14 days) for dashboard ---------- //
(function seedOrders() {
  const today = new Date();
  let orderId = 1, paymentId = 1, auditId = 1;
  const channels = ["pos","pos","pos","pos","qr","qr","online"];
  const paymentMethods = ["cash","card","ewallet","qr","card"];
  // Pick popular product IDs (we want top-sellers to skew naturally)
  const popularProducts = [
    3, 6, 9, 12, 15, 18, 21, 24,   // iced coffees
    27, 31, 32, 33, 34, 36, 40, 43, 46, 47, 50,  // popular iced others
    51, 52, 53   // new specials
  ];

  for (let d = 14; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const ordersPerDay = 10 + Math.floor(Math.random() * 14); // 10–23 orders/day

    for (let i = 0; i < ordersPerDay; i++) {
      const orderTime = new Date(date);
      orderTime.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));

      const itemCount = 1 + Math.floor(Math.random() * 3);
      const items = [];
      let subtotal = 0;
      const usedIds = new Set();
      for (let j = 0; j < itemCount; j++) {
        // 70% chance pick a popular product, 30% random
        let pId;
        let p;
        let tries = 0;
        do {
          if (Math.random() < 0.7) pId = popularProducts[Math.floor(Math.random() * popularProducts.length)];
          else pId = SEED_DATA.products[Math.floor(Math.random() * SEED_DATA.products.length)].id;
          p = SEED_DATA.products.find(x => x.id === pId);
          tries++;
        } while (usedIds.has(pId) && tries < 5);
        usedIds.add(pId);
        if (!p || p.categoryId === 6) continue; // skip add-ons as standalone
        const qty = 1 + (Math.random() < 0.2 ? 1 : 0);
        items.push({ productId: p.id, name: p.name, price: p.price, qty });
        subtotal += p.price * qty;
      }
      if (items.length === 0) continue;
      const tax = subtotal * SEED_DATA.meta.taxRate;
      const total = subtotal + tax;
      const customerIdx = Math.random() < 0.45 ? 7 : Math.floor(Math.random() * 7);
      const customer = SEED_DATA.customers[customerIdx];
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

      SEED_DATA.orders.push({
        id: orderId,
        orderNo: "WC" + String(20260000 + orderId).padStart(8,'0'),
        items,
        subtotal: round2(subtotal),
        discount: 0,
        tax: round2(tax),
        total: round2(total),
        customerId: customer.id,
        customerName: customer.name,
        channel,
        tableId: channel === "pos" ? 1 + Math.floor(Math.random() * 8) : null,
        status: "completed",
        kitchenStatus: "completed",
        cashierId: 3,
        createdAt: orderTime.toISOString()
      });

      SEED_DATA.payments.push({
        id: paymentId,
        orderId: orderId,
        amount: round2(total),
        method: paymentMethod,
        status: "paid",
        reference: "PAY" + String(20260000 + paymentId).padStart(8,'0'),
        paidAt: orderTime.toISOString()
      });

      SEED_DATA.auditLog.push({
        id: auditId++,
        userId: 3, username: "cashier",
        action: "ORDER_CREATED",
        details: `Order WC${String(20260000+orderId).padStart(8,'0')} - RM${round2(total)}`,
        at: orderTime.toISOString()
      });
      SEED_DATA.auditLog.push({
        id: auditId++,
        userId: 3, username: "cashier",
        action: "PAYMENT_RECEIVED",
        details: `${paymentMethod.toUpperCase()} RM${round2(total)}`,
        at: orderTime.toISOString()
      });

      orderId++;
      paymentId++;
    }
  }
})();

function round2(n) { return Math.round(n * 100) / 100; }

// ---------- Storage Layer ---------- //
const DB = {
  load() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try { return JSON.parse(raw); }
      catch(e) { console.warn("DB corrupt, reseeding."); }
    }
    this.save(SEED_DATA);
    return JSON.parse(JSON.stringify(SEED_DATA));
  },
  save(state) {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
  },
  reset() {
    localStorage.removeItem(DB_KEY);
    location.reload();
  }
};
