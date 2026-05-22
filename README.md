# Wellness Cafe — Integrated POS & Ordering System

> A full-stack Point-of-Sale and ordering platform built for Wellness Cafe
> (Ground Floor, Block 7, FPM, UPSI). _Relax · Reflect · Recharge_

A production-ready system that handles the complete cafe operation end-to-end:
counter sales, customer QR ordering, kitchen display, inventory with auto-deduction,
loyalty programme, purchase orders, refunds, reporting, and full audit logging.

Built with **Laravel 13 + MySQL** on the backend and **vanilla HTML/CSS/JavaScript**
on the frontend — packaged as a single deployable PHP application.

## TL;DR — Get it running in 5 minutes

```bash
git clone <YOUR-REPO-URL> wellness-cafe-api
cd wellness-cafe-api
composer install
cp .env.example .env
php artisan key:generate
# create a MySQL database named "wellness_cafe", then edit .env with credentials
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

Visit `http://127.0.0.1:8000/staff` and sign in as `admin / admin123`.

---

## Features

### 11 Core Modules

| Module | What it does |
|---|---|
| **User & Role Management** | 5 built-in roles (Super Admin / Manager / Cashier / Kitchen / Inventory) — **users can hold multiple roles simultaneously** (e.g. cashier + kitchen at small cafes), with permissions merged across all assigned roles |
| **Customer Management** | Customer profiles, contact info, loyalty tier auto-upgrade, soft delete |
| **Product & Menu Management** | Categories + products with prices, costs, recipes, photo uploads, soft delete |
| **Table Management** | Full CRUD for dining tables — add / edit / remove (soft-delete preserves historical orders); only available tables appear in customer QR picker |
| **Ordering Management** | POS terminal, QR ordering, online channel — unified order pipeline with payment-first workflow (kitchen only sees paid orders) |
| **Payment Management** | Cash, Card, E-Wallet, **Dynamic DuitNow QR** (amount-embedded per order) — with cash change calculation and receipt printing |
| **Customer Pickup Notification** | After ordering, customer's phone stays on a live status page that polls every 5s. Phone vibrates + flashes when order is *Ready for pickup*. Persists across reloads |
| **Inventory Management** | Auto-deduction from product recipes, stock adjustments with audit trail, low-stock alerts, **physical-count Stocktake** with variance preview |
| **Purchase Orders** | Supplier directory, PO creation, goods receiving (auto stock increment) |
| **Reporting & Analytics** | Dashboard KPIs, sales reports with date filters, top products, by-category, by-payment-method, CSV export |
| **System & Audit** | Every write operation logged with user, action, details, and timestamp |
| **Promotion & Loyalty** | Promo codes (percent/fixed), 4-tier membership (Bronze->Platinum) with discount + points multiplier |
| **Refund Management** | Approval workflow that auto-reverses inventory, loyalty points, and tier status |

### Production-grade behaviour

- **Token authentication** with Laravel Sanctum
- **Live auto-refresh** on Kitchen Display (8s) and Orders list (10s) with "NEW order" toast notifications
- **Real-time inventory deduction** — every order's recipe items decrement stock atomically inside a DB transaction
- **Loyalty auto-upgrade** — tier promotions trigger automatically when lifetime spend crosses thresholds
- **Soft deletes** — deleted records stay in the database for audit; just hidden from listings
- **Product photo uploads** with emoji fallback if no photo exists
- **Receipt printing** via the browser's print dialog
- **Mobile-friendly QR ordering page** — no login required, customers scan and order from their phone
- **Single deployment** — frontend and backend ship as one Laravel app; one URL, one SSL, one upload

---

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | PHP 8.2+ · Laravel 13 · Laravel Sanctum |
| Database | MySQL 8 |
| Frontend | HTML5 · CSS3 (custom design system) · Vanilla JavaScript |
| Charts | Chart.js (via CDN) |
| Storage | Laravel public disk (for uploaded product photos) |
| Auth | Sanctum bearer tokens |

No build step. No frontend framework. No npm install required to run.

---

## Order Lifecycle & Payment Flow

Understanding this is essential before you start poking at the code — it's the spine the rest of the system is built on.

### The two status fields

Every `Order` row has **two independent status columns**:

| Column | Meaning | Allowed values |
|---|---|---|
| `status` | Payment state | `pending_payment` → `completed` → `refunded` / `cancelled` |
| `kitchen_status` | Kitchen progress | `pending` → `preparing` → `ready` → `completed` |

The kitchen display query is:

```sql
WHERE kitchen_status IN ('pending','preparing','ready')
  AND status != 'pending_payment'
```

→ **Unpaid orders are invisible to the kitchen.** This is the "payment-first" workflow.

### Full flow for a QR-ordered customer

```
1. Customer scans table QR -> picks items -> places order
   Order created: status=pending_payment, kitchen_status=pending
   Kitchen does NOT see it.

2. Customer's phone shows live status: "Pay to start your order"
   It displays a DuitNow QR with amount + reference embedded, PLUS
   an option to pay at the counter for cash/card/e-wallet.
   (polls /api/public/orders/{order_no}/status every 5s)

3. Customer picks how to pay:

   A) Pay from phone (DuitNow QR)
      - Long-presses the QR on their own status page to save it.
      - Opens any MY banking app (Maybank, CIMB, MAE, TNG, Boost, ...).
      - Taps "Scan QR" -> "Upload from Gallery" -> picks the saved QR.
      - Banking app shows the merchant + amount (already filled in).
      - Customer confirms payment.

   B) Pay at counter (cash/card/e-wallet/QR shown on POS)
      - Customer walks to counter.
      - Cashier opens Orders -> "Take Payment".
      - Cashier picks payment method.
      - For DuitNow QR: the same EMV QR is rendered on the POS screen.

   In both cases, the cafe owner's phone gets the bank-app notification
   for QR/e-wallet payments. Cashier verifies and clicks "Confirm Payment".

4. OrderService.takePayment() flips status=completed
   -> Loyalty points awarded, tier may auto-upgrade
   -> Audit log entry written

5. KDS picks up the order on its next 8s poll -> flashes as NEW.
   Kitchen progresses: pending -> preparing -> ready -> completed.

6. Customer's phone status page updates on its next 5s poll:
   "Preparing" -> "Ready for pickup" (vibrate + green flash)
   -> "Picked up".

The customer only HAS to walk to the counter once: to pick up the food
when it's ready. They can pay from their seat if they prefer.
```

### POS-channel orders (cashier creates the order directly)

For walk-in orders rung up at the POS terminal, the cashier takes payment **in the same modal that creates the order**. In that case the order is born `status=completed` and lands on the KDS immediately. The `pending_payment` state only applies to QR-channel orders.

### Future: payment gateway auto-detection (Plan C)

The cashier's "Confirm Payment" click is the only manual step that prevents this from being fully automatic. When the cafe later integrates a payment gateway (Billplz, iPay88, Curlec, GHL, etc.), a webhook controller verifies the gateway signature and calls the same `OrderService::takePayment()` method — same code path, same audit trail. No DB schema change required; reuse the `payments.reference` column for the gateway transaction ID.

---

## Quick Start (Local Development)

### Prerequisites

- **PHP 8.2+** (we tested with 8.3)
- **Composer 2.x**
- **MySQL 8** (or MariaDB 10.6+)
- **Git**

The easiest setup on Windows is [Laragon](https://laragon.org/) — bundles PHP, MySQL, Apache, Composer, and auto-virtual-hosts.

### Note for Windows users

If you have a third-party antivirus that does **SSL/HTTPS scanning** (Norton, Kaspersky, Bitdefender, McAfee, etc.), Composer will fail with `curl error 60: SSL certificate problem`. Either disable HTTPS scanning during install, or uninstall the AV and use Windows Defender.

### Step 1 — Clone the repository

```bash
git clone <YOUR-REPO-URL> wellness-cafe-api
cd wellness-cafe-api
```

### Step 2 — Install PHP dependencies

```bash
composer install
```

### Step 3 — Environment file

```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` and fill in your database credentials:

```env
APP_NAME="Wellness Cafe POS"
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=wellness_cafe
DB_USERNAME=root
DB_PASSWORD=
```

### Step 4 — Create the database

```sql
CREATE DATABASE wellness_cafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 5 — Run migrations + seed sample data

```bash
php artisan migrate --seed
```

This creates ~20 tables and seeds:
- 5 user accounts (1 per role) with real passwords
- 6 categories matching the real Wellness Cafe brochure
- 59 menu products (Brew-tiful Coffee, Whisked Me Away, Mojito Mood, Calming Tea, Specialty NEW, Boost It Up)
- 26 inventory ingredients, 9 suppliers, 8 customers (across all tiers), 4 promo codes, 8 dining tables

### Step 6 — Create the storage symlink (for product photos)

```bash
php artisan storage:link
```

Run as Administrator on Windows if you hit a permissions error.

### Step 7 — Add your cafe logo (optional)

Place your logo at `public/img/logo.png` — it will appear on the login page, the QR ordering page, and the staff sidebar. If the file is missing, a coffee-cup emoji is used as fallback.

### Step 8 — (Optional) Configure DuitNow QR for payments

If the cafe wants the cashier's "QR Pay" option to display a working DuitNow QR with the amount pre-filled, add these lines to `.env` and replace the placeholders with the cafe's real DuitNow merchant credentials (obtained when the owner registers a DuitNow QR merchant account with any participating Malaysian bank):

```env
DUITNOW_ENABLED=true
DUITNOW_MERCHANT_ID=60000000000           # <-- cafe's real merchant ID
DUITNOW_MERCHANT_NAME="Wellness Cafe"
DUITNOW_MERCHANT_CITY="Tanjong Malim"
DUITNOW_MCC=5812                          # ISO 18245: 5812 = Eating Places
DUITNOW_GUID=DUITNOW
```

Run `php artisan config:clear` after editing. Until real credentials are set, the QR is structurally valid (any QR app can decode it) and the cashier UX works end-to-end — but a real banking app will reject the placeholder merchant ID as "unregistered". That's expected for demo. See **"DuitNow QR & Payment Detection"** below for the full design.

### Step 9 — Run the dev server

```bash
php artisan serve
```

Open `http://127.0.0.1:8000` in your browser.

---

## URL Map

| URL | Page | Auth |
|---|---|---|
| `/` | Customer QR ordering (default landing) | Public |
| `/qr` | Alias to `/` | Public |
| `/staff` or `/staff.html` | Staff sign-in | Public |
| `/app.html` | Main staff application | Authenticated (token) |
| `/api/health` | API health check | Public |
| `/api/*` | All REST endpoints | Mostly token-protected (Bearer) |
| `/api/public/*` | QR ordering endpoints (menu, tables, create order) | Public |

---

## Demo Accounts

| Username | Password | Role | Access |
|---|---|---|---|
| `admin` | `admin123` | Super Admin | Everything |
| `manager` | `manager123` | Manager | Operations + reports + audit |
| `cashier` | `cashier123` | Cashier | Dashboard, POS, Customers |
| `kitchen` | `kitchen123` | Kitchen Staff | Kitchen Display only |
| `stock` | `stock123` | Inventory Staff | Dashboard, Inventory, Purchase |

> **Change these passwords before going to production.** Sign in as `admin`, open **Users & Roles**, and update each account's password.

---

## API Reference (Summary)

All routes are prefixed with `/api`. Protected routes require an `Authorization: Bearer <token>` header obtained from `/api/login`.

### Authentication
```
POST /login              { username, password } -> { token, user }
GET  /me                 -> { user }
POST /logout             revokes current token
```

### Menu & Catalog (auth)
```
GET    /menu                      -> { categories, products }
GET    /categories                POST /categories
GET    /categories/{id}           PUT  /categories/{id}    DELETE /categories/{id}
GET    /products                  POST /products
GET    /products/{id}             PUT  /products/{id}      DELETE /products/{id}
POST   /products/{id}/image       (multipart)              DELETE /products/{id}/image
```

### Orders & Sales (auth)
```
GET  /orders                       (filters: q, channel, status, date_from, date_to)
POST /orders                       creates with inventory deduction + loyalty
GET  /orders/{id}
POST /orders/{id}/payment          confirm payment at counter for pending_payment orders
GET  /orders/{id}/duitnow-qr       returns DuitNow EMV QR payload for the cashier UI
GET  /tables                       POST /tables
GET  /tables/{id}                  PUT  /tables/{id}        DELETE /tables/{id}
GET  /promotions                   POST /promotions  PUT /promotions/{id}  DELETE /promotions/{id}
POST /promotions/validate          { code, subtotal } -> { discount }
```

### Kitchen Display (auth)
```
GET   /kitchen/orders              { orders, summary: {pending,preparing,ready} }
                                   excludes orders with status=pending_payment
PATCH /kitchen/orders/{id}/status  { status }
```

### Inventory & Suppliers (auth)
```
GET    /inventory                  POST /inventory
GET    /inventory/{id}             PUT  /inventory/{id}     DELETE /inventory/{id}
POST   /inventory/{id}/adjust      { type: in|out|set, qty, reason }
POST   /inventory/stocktake        { note, counts: [{inventory_item_id, physical_count}] }
GET    /inventory/movements
GET    /suppliers                  POST /suppliers
GET    /suppliers/{id}             PUT  /suppliers/{id}     DELETE /suppliers/{id}
GET    /purchase-orders            POST /purchase-orders
GET    /purchase-orders/{id}       POST /purchase-orders/{id}/receive
```

### Customers (auth)
```
GET    /customers                  POST /customers
GET    /customers/{id}             PUT  /customers/{id}     DELETE /customers/{id}
```

### Refunds (auth)
```
GET  /refunds                      POST /refunds   { order_id, reason, method }
GET  /refunds/{id}
```

### Reports (auth)
```
GET  /reports/dashboard            today/yesterday/month KPIs + 14-day trend + top products
GET  /reports/sales?from=&to=      detailed sales report
GET  /reports/sales.csv?from=&to=  CSV download
GET  /reports/audit?limit=         audit log entries
```

### Users & Roles (auth, Super Admin)
```
GET    /users                      POST /users   { name, username, email, role_id, role_ids[], ... }
GET    /users/{id}                 PUT  /users/{id}         DELETE /users/{id}
GET    /roles
```

> `role_id` is the user's *primary* role (shown as the sidebar label).
> `role_ids[]` is the full list of roles the user holds — permissions are merged across all of them.

### Public (no auth — for QR ordering)
```
GET  /public/menu                  cafe info + categories + available products
GET  /public/tables
POST /public/orders                guest order (payment pending at counter)
GET  /public/orders/{order_no}/status   live status for customer's pickup-notification page
```

---

## Database Schema

21 tables in total, modeled after the original project specification:

```
users, roles, user_roles         - authentication & access control
                                   (user_roles = many-to-many pivot for multi-role staff)
categories, products             - menu (products have JSON recipe column)
inventory_items, stock_movements - stock with full movement history
                                   (stock_movements also records Stocktake adjustments)
suppliers, purchase_orders, purchase_order_items - procurement
customers                        - loyalty profile (tier, points, lifetime spend)
tables                           - dining table directory (soft-deletable)
orders, order_items, payments    - the heart of sales
                                   (orders.status decouples payment from kitchen progress)
refunds                          - refund records (reverses an order)
promotions                       - discount codes
audit_logs                       - every action by every user, ever
```

**Soft deletes** are enabled on: categories, products, customers, suppliers, inventory_items, promotions, users, **tables** — so "deleting" a record only hides it from the UI; it's still in the DB for audit. Historical orders that reference a removed table keep working.

**Transactions** wrap every write that touches multiple tables (creating an order, processing a refund, receiving a PO) so partial state can never leak in on failure.

---

## Project Structure

```
wellness-cafe-api/
├── app/
│   ├── Http/Controllers/Api/    all REST controllers
│   │   ├── AuthController.php
│   │   ├── CategoryController.php
│   │   ├── ProductController.php       (incl. image upload)
│   │   ├── OrderController.php
│   │   ├── KitchenController.php
│   │   ├── InventoryItemController.php
│   │   ├── SupplierController.php
│   │   ├── PurchaseOrderController.php
│   │   ├── CustomerController.php
│   │   ├── PromotionController.php
│   │   ├── RefundController.php
│   │   ├── ReportController.php
│   │   ├── UserController.php           (now supports multi-role assignment)
│   │   ├── TableController.php          (full CRUD — add/edit/remove tables)
│   │   └── PublicController.php         (QR ordering + pickup status endpoint)
│   ├── Models/                  17 Eloquent models
│   │                            User has roles() many-to-many alongside primary role()
│   └── Services/
│       ├── OrderService.php     order creation, inventory deduction, loyalty,
│       │                        payment confirmation, refund reversal
│       └── DuitNowQRService.php builds EMV-format DuitNow QR payload per order
├── config/
│   └── duitnow.php              merchant ID, name, city, MCC — env-driven
├── database/
│   ├── migrations/              23 migration files (incl. tables soft-delete + user_roles pivot)
│   └── seeders/                 9 seeders (DB populated with real menu data)
├── public/
│   ├── index.html               Customer QR ordering page (mobile-first redesigned)
│   │                            + post-order live status view with pickup notification
│   ├── staff.html               Staff sign-in
│   ├── app.html                 Main staff SPA (loads Chart.js + QRious from CDN)
│   ├── css/styles.css           includes qr-* (customer), status-* (pickup), qr-pay-* (DuitNow)
│   ├── js/
│   │   ├── api.js               fetch wrapper with auth + file upload
│   │   └── app.js               14 module views — incl. Tables CRUD + Stocktake
│   ├── img/logo.png             (put your logo here)
│   └── storage                  symlink to ../storage/app/public
├── routes/
│   ├── api.php                  all REST endpoints
│   └── web.php                  static file routing
└── README.md                    (this file)
```

---

## Recent Updates (May 2026)

The system received a round of client-feedback changes after initial review. Each item below has its design notes plus the exact files that implement it — useful for code review, troubleshooting, or extending.

### 1. Payment-first workflow (kitchen waits for payment)

The KDS query now excludes `status = pending_payment` orders. A QR-ordered item is invisible to the kitchen until the cashier confirms payment at the counter — preventing kitchen from preparing food someone may never pay for.

| File | Change |
|---|---|
| `app/Http/Controllers/Api/KitchenController.php` | Added `where('status', '!=', 'pending_payment')` to index() |
| `app/Http/Controllers/Api/ReportController.php` | Same filter on the dashboard's `pending_kitchen` count |

### 2. Customer pickup notification (live status on customer's phone)

After placing a QR order, the customer's phone stays on a live status view that polls every 5s. Shows the journey: *Pay at counter → Preparing → Ready for pickup → Picked up*. When the kitchen marks the order ready, the screen vibrates + flashes green. Persists across page reloads via `localStorage`.

| File | Change |
|---|---|
| `app/Http/Controllers/Api/PublicController.php` | New `orderStatus()` method — derives a single `stage` value from `status` + `kitchen_status` |
| `routes/api.php` | New public route `GET /api/public/orders/{orderNo}/status` |
| `public/index.html` | After `placeOrder()` switches to `showStatusView()`; polls every 5s; restores from localStorage on reload |
| `public/css/styles.css` | New `.status-hero`, `.status-steps`, `.status-step` styles + `qrFlash` and `statusPulse` keyframes |

### 3. Dining Tables CRUD (owner can add/edit/remove tables)

A new **Dining Tables** module under Management. Soft-delete preserves historical orders that reference a removed table. Only `status='available'` tables appear in the customer QR picker.

| File | Change |
|---|---|
| `database/migrations/2026_05_22_100000_add_soft_deletes_to_tables.php` | Adds `deleted_at` column |
| `app/Models/Table.php` | Adds `SoftDeletes` trait |
| `app/Http/Controllers/Api/TableController.php` | Expanded from index-only to full CRUD |
| `routes/api.php` | Added POST/PUT/DELETE table routes |
| `public/js/app.js` | New `VIEWS.tables`, `openTableForm()`, `deleteTable()`; nav entry under Management |

### 4. Multi-role staff (one user, many roles)

For small cafes where Staff A might be cashier AND kitchen at the same time. The `users.role_id` column is kept as the user's *primary role* (sidebar display label). A new `user_roles` pivot table stores additional roles. The user's effective permissions are the **merged set** across every role they hold.

| File | Change |
|---|---|
| `database/migrations/2026_05_22_100100_create_user_roles_pivot.php` | Creates pivot + backfills existing users' primary roles into it |
| `app/Models/User.php` | New `roles()` BelongsToMany; new `permissions()` accessor merges across all roles |
| `app/Http/Controllers/Api/AuthController.php` | Login & /me responses now include `roles[]` array + merged `permissions[]` |
| `app/Http/Controllers/Api/UserController.php` | Accepts `role_ids[]` on create/update; syncs the pivot in addition to `role_id` |
| `public/js/app.js` | `hasPermission()` uses merged permissions; sidebar shows roles joined with `·`; user-edit form has a multi-select role picker |

### 5. Inventory Stocktake (physical-count reconciliation)

A new **📋 Stocktake** button on the Inventory page. Staff enter physical counts; the modal shows live variance per item; confirming writes per-item `stock_movements` (type `in` or `out` depending on direction) plus a single summary audit-log entry.

| File | Change |
|---|---|
| `app/Http/Controllers/Api/InventoryItemController.php` | New `stocktake()` method — accepts batch of physical counts, computes variance, writes adjustment movements in a DB transaction |
| `routes/api.php` | New route `POST /api/inventory/stocktake` |
| `public/js/app.js` | New `openStocktake()` modal — live variance preview with green/red badges |

### 6. Customer page UI/UX redesign (mobile-first polish)

The customer QR page was restyled mobile-first for thumb-friendly tapping. Targets are 44px minimum, the cart bar slides up smoothly with safe-area-inset for iPhone notch, product cards have animated Add buttons, category chips are pill-shaped with scroll-snap.

| File | Change |
|---|---|
| `public/css/styles.css` | Rewrote the `.qr-*` section: gradient header, larger touch targets, polished cards, slide-up cart bar |

### 7. DuitNow QR & Payment Detection

The cashier's "QR Pay" payment option now generates a fresh **DuitNow QR with the amount and order reference embedded** (EMV-format TLV with CRC-16/CCITT-FALSE checksum) per order. Customer scans with any Malaysian banking app, the amount is pre-filled (they can't underpay or send to the wrong merchant). Cashier verifies bank-app notification and clicks Confirm.

| Layer | File | Purpose |
|---|---|---|
| Config | `config/duitnow.php` | Merchant ID, name, city, MCC — placeholder defaults, .env-driven |
| Env | `.env.example` | `DUITNOW_*` variables the cafe owner fills in once they have a merchant account |
| Service | `app/Services/DuitNowQRService.php` | Builds the EMV TLV payload with CRC-16/CCITT |
| API | `app/Http/Controllers/Api/OrderController.php::duitnowQr()` | `GET /api/orders/{order}/duitnow-qr` — returns payload + amount + reference |
| UI | `public/app.html` | Loads `qrious` JS library for QR rendering |
| UI | Take Payment modal in `public/js/app.js` | Fetches payload, renders to canvas, shows verify prompt |
| UI | `public/css/styles.css` | `.qr-pay-card` styling |

**How payment detection actually works today:** the customer pays via their banking app → the cafe owner's phone gets the bank-app notification → cashier verifies and clicks Confirm. The QR ensures the *amount* and *reference* match — but the cashier is the verifier. See **"Order Lifecycle & Payment Flow"** above for the Plan C upgrade path to fully-automatic detection via payment-gateway webhooks.

### 8. Pay from phone — DuitNow QR on the customer status page

The customer can now pay **without walking to the counter**. After placing an order, their status page shows the DuitNow QR with amount + reference pre-filled. The customer screenshots / long-presses to save the QR, opens their banking app, picks "Scan QR → Upload from gallery", and confirms. The cashier still verifies the bank-app notification (until Plan C is integrated). "Pay at counter" remains a fallback for cash / card customers.

| File | Change |
|---|---|
| `app/Http/Controllers/Api/PublicController.php` | New `orderDuitnowQr()` method — public sibling of the staff endpoint |
| `routes/api.php` | New public route `GET /api/public/orders/{orderNo}/duitnow-qr` |
| `public/index.html` | Loads QRious JS lib; `renderStatusView()` now injects the pay-card with QR canvas when stage is `waiting_payment`; `ensurePayQrRendered()` fetches & draws (payload cached to avoid re-fetching every 5s poll) |
| `public/css/styles.css` | `.pay-card`, `.pay-card-amount`, `.pay-qr-slot`, `.pay-instructions`, `.pay-alt` |

---

## Upgrading an existing install

If you already have the system running and you're pulling the May 2026 updates, do this:

```bash
git pull
composer install                 # in case any dependencies shifted
php artisan migrate              # applies the 2 new migrations (tables soft-delete + user_roles)
php artisan config:clear         # picks up the new DuitNow config
```

Then hard-refresh the staff page (Ctrl+Shift+R) and any open customer phones so the new JS, CSS, and QRious library load.

The `user_roles` migration **backfills** every existing user's primary role into the new pivot — nobody loses access.

---

## Quick Test After Install

1. Visit `http://127.0.0.1:8000/staff` and sign in as `admin / admin123`
2. Dashboard shows live KPIs (seeded order data)
3. Open POS, tap Spanish Latte (Iced), add to cart, choose customer "Nurul Aina (Gold)"
4. Click Pay, enter promo `WELCOME10`, choose Cash, enter RM 30, Complete Sale
5. Receipt prints; order is now in MySQL with inventory auto-deducted
6. Open Kitchen Display, see your order in pending, click through Preparing -> Ready -> Picked Up
7. Open a separate **incognito** browser tab, visit `http://127.0.0.1:8000/` (the customer side), place a QR order
8. **The customer page switches to a live status view** — "Pay at counter". Leave this tab open.
9. **The order does NOT yet appear on KDS** — kitchen waits for payment.
10. Back on staff side, open Orders → find the order with the "Pending Payment" banner → click **Take Payment**.
11. Pick **📷 QR Pay** — a DuitNow QR with the amount embedded renders. Click **✓ Confirm Payment** to simulate the cashier verifying the bank-app notification.
12. Order flips to `completed`. Within ~8s it appears on KDS with the "NEW" flash.
13. Within ~5s the **customer's live status page** advances to "Preparing".
14. On KDS, mark the order **Ready** — the customer's phone vibrates and the screen flashes green ("Ready for pickup!").
15. Try the new Management modules:
    - **Dining Tables** — add a new table, refresh customer page, confirm it appears in the picker
    - **Inventory → 📋 Stocktake** — enter a different physical count for one item, confirm the variance shows, apply, then check Audit Log for the `STOCKTAKE` entry
    - **Users & Roles** — edit a user, tick a second role, save, sign in as them, confirm the sidebar shows both roles and the merged nav items

---

## Production Deployment (cPanel)

### Files to upload

Upload the entire project to your hosting account, then in cPanel:

1. Point your domain's document root to the project's `public/` folder
2. Or, if your host doesn't allow that, move `public/*` to `public_html/` and edit `public_html/index.php` to point back to the framework

### Setup on the host

```bash
composer install --no-dev --optimize-autoloader
cp .env.example .env
nano .env                      # fill in production DB credentials
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan config:cache
php artisan route:cache
chmod -R 775 storage bootstrap/cache
```

### .env production values

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com

DB_HOST=localhost            # usually localhost on cPanel
DB_DATABASE=cpaneluser_wellness_cafe
DB_USERNAME=cpaneluser_dbuser
DB_PASSWORD=<the password you set in cPanel>
```

### Common cPanel issues

- **No SSH access** -> use cPanel Terminal or upload `vendor/` via FTP from local
- **`storage:link` fails** -> manually copy uploaded photos to `public/storage/` or edit `config/filesystems.php`
- **PHP < 8.2** -> enable PHP 8.2+ via cPanel's "Select PHP Version"
- **Composer not available** -> run `composer install` locally, zip everything including `vendor/`, upload, then skip the composer step

---

## Out of Scope (Future Phase 2)

Per the original project document, these are explicitly Phase 2 enhancements:

- AI sales prediction & smart recommendations
- Multi-branch / franchise governance
- Flutter native mobile app
- WebSocket real-time push (we use polling instead — fine for cPanel)
- Self-service kiosk hardware integration
- Docker / Redis / Nginx orchestration

Items proposed during client review but deferred:

- **Payment gateway auto-detection (Plan C)** — webhook integration with Billplz / iPay88 / Curlec / GHL so paid orders are recognised without cashier confirmation. The current architecture is ready for this (see "Order Lifecycle & Payment Flow").
- **Member points-for-purchase** — let loyalty members buy points outright and redeem them for products. Skipped per client request to keep the v1 scope focused.

The current build covers all 11 documented modules in production-grade form.

---

## Git & GitHub Notes

Laravel's default `.gitignore` already excludes the right things, but double-check before your first push:

**Already ignored (do NOT commit):**
- `/vendor/` — Composer dependencies (~50MB, re-installed via `composer install`)
- `/node_modules/` — npm dependencies (not used in this project, safe regardless)
- `/.env` — your local secrets (DB password, app key)
- `/storage/*.key` — application keys
- `/storage/app/public/` — user-uploaded product photos (won't exist in fresh clones)
- `/public/storage` — the symlink (regenerated via `php artisan storage:link`)

**Safe to commit:**
- All source code in `app/`, `routes/`, `database/migrations/`, `database/seeders/`
- The frontend in `public/index.html`, `public/staff.html`, `public/app.html`, `public/css/`, `public/js/`
- `.env.example` (template only, no secrets)
- `composer.json` + `composer.lock` (so others get the same package versions)
- `public/img/logo.png` if you want to include the cafe logo in the repo

**Before pushing for the first time:**

```bash
# Verify .env is ignored
git status

# Initial push
git init
git add .
git commit -m "Initial commit: Wellness Cafe Integrated POS"
git branch -M main
git remote add origin <YOUR-REPO-URL>
git push -u origin main
```

If you accidentally commit `.env`:

```bash
git rm --cached .env
git commit -m "Remove accidentally committed .env"
# Then rotate any leaked secrets (DB password, APP_KEY, API tokens)
```

---

## Contributing

This is a project deliverable for Wellness Cafe @ UPSI. If you'd like to extend or adapt it:

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

For bug reports or feature requests, please open an Issue on GitHub.

---

## Credits

- **Client:** Wellness Cafe @ FPM, UPSI
- **System Documentation:** _Wellness Café Integrated POS & Ordering System — Complete Master Development Documentation_
- **Tech foundation:** [Laravel](https://laravel.com), [Laravel Sanctum](https://laravel.com/docs/sanctum), [Chart.js](https://www.chartjs.org/)
- **Built:** May 2026

---

## License

This project is open-sourced for educational and operational use under the [MIT license](https://opensource.org/licenses/MIT).
