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
| **User & Role Management** | 5 built-in roles (Super Admin / Manager / Cashier / Kitchen / Inventory) with permission-based UI access |
| **Customer Management** | Customer profiles, contact info, loyalty tier auto-upgrade, soft delete |
| **Product & Menu Management** | Categories + products with prices, costs, recipes, photo uploads, soft delete |
| **Ordering Management** | POS terminal, QR ordering, online channel — unified order pipeline |
| **Payment Management** | Cash, Card, E-Wallet, QR Pay — with cash change calculation and receipt printing |
| **Inventory Management** | Auto-deduction from product recipes, stock adjustments with audit trail, low-stock alerts |
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

### Step 8 — Run the dev server

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
GET  /tables
GET  /promotions                   POST /promotions  PUT /promotions/{id}  DELETE /promotions/{id}
POST /promotions/validate          { code, subtotal } -> { discount }
```

### Kitchen Display (auth)
```
GET   /kitchen/orders              { orders, summary: {pending,preparing,ready} }
PATCH /kitchen/orders/{id}/status  { status }
```

### Inventory & Suppliers (auth)
```
GET    /inventory                  POST /inventory
GET    /inventory/{id}             PUT  /inventory/{id}     DELETE /inventory/{id}
POST   /inventory/{id}/adjust      { type: in|out|set, qty, reason }
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
GET    /users                      POST /users
GET    /users/{id}                 PUT  /users/{id}         DELETE /users/{id}
GET    /roles
```

### Public (no auth — for QR ordering)
```
GET  /public/menu                  cafe info + categories + available products
GET  /public/tables
POST /public/orders                guest order (payment pending at counter)
```

---

## Database Schema

20 tables in total, modeled after the original project specification:

```
users, roles                     - authentication & access control
categories, products             - menu (products have JSON recipe column)
inventory_items, stock_movements - stock with full movement history
suppliers, purchase_orders, purchase_order_items - procurement
customers                        - loyalty profile (tier, points, lifetime spend)
tables                           - dining table directory
orders, order_items, payments    - the heart of sales
refunds                          - refund records (reverses an order)
promotions                       - discount codes
audit_logs                       - every action by every user, ever
```

**Soft deletes** are enabled on: categories, products, customers, suppliers, inventory_items, promotions, users — so "deleting" a record only hides it from the UI; it's still in the DB for audit.

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
│   │   ├── UserController.php
│   │   └── PublicController.php        (QR ordering, no auth)
│   ├── Models/                  17 Eloquent models
│   └── Services/
│       └── OrderService.php     order creation, inventory deduction, loyalty,
│                                payment confirmation, refund reversal
├── database/
│   ├── migrations/              21 migration files
│   └── seeders/                 9 seeders (DB populated with real menu data)
├── public/
│   ├── index.html               Customer QR ordering page
│   ├── staff.html               Staff sign-in
│   ├── app.html                 Main staff SPA
│   ├── css/styles.css
│   ├── js/
│   │   ├── api.js               fetch wrapper with auth + file upload
│   │   └── app.js               all 13 module views
│   ├── img/logo.png             (put your logo here)
│   └── storage                  symlink to ../storage/app/public
├── routes/
│   ├── api.php                  all REST endpoints
│   └── web.php                  static file routing
└── README.md                    (this file)
```

---

## Quick Test After Install

1. Visit `http://127.0.0.1:8000/staff` and sign in as `admin / admin123`
2. Dashboard shows live KPIs (seeded order data)
3. Open POS, tap Spanish Latte (Iced), add to cart, choose customer "Nurul Aina (Gold)"
4. Click Pay, enter promo `WELCOME10`, choose Cash, enter RM 30, Complete Sale
5. Receipt prints; order is now in MySQL with inventory auto-deducted
6. Open Kitchen Display, see your order in pending, click through Preparing -> Ready -> Picked Up
7. Open a separate **incognito** browser tab, visit `http://127.0.0.1:8000/` (the customer side), place a QR order
8. Within ~8 seconds, the QR order appears on the staff KDS automatically (live polling)
9. Orders module shows the yellow "pending payment" banner, click **Take Payment** to complete

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
