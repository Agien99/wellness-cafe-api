# Server Specifications — Wellness Cafe Integrated POS

**Prepared for:** UPSI ICT Department
**Project:** Wellness Cafe Integrated POS & Ordering System
**Location:** Ground Floor, Block 7, FPM, UPSI
**Prepared by:** _[Your name]_
**Date:** _[Submission date]_

---

## 1. Project Summary

A web-based Point-of-Sale and customer ordering system for Wellness Cafe. The system consists of:

- **Staff portal** — used by cashiers, managers, kitchen staff, and inventory staff via touchscreen tablets or PCs at the cafe counter.
- **Customer QR ordering page** — accessed by customers via smartphones after scanning a QR code at the table. No customer login required.
- **REST API backend** that serves both the staff portal and the customer page from a single Laravel application.

The system handles real-time sales, kitchen order routing, inventory deduction, loyalty management, purchase orders, refunds, and reporting.

---

## 2. Software Requirements

| Component | Required Version | Notes |
|---|---|---|
| **Operating System** | Ubuntu 22.04 LTS or 24.04 LTS (preferred) | CentOS / RHEL / Rocky Linux 9+ also acceptable |
| **Web Server** | Nginx 1.24+ or Apache 2.4+ | Either works; Nginx slightly preferred for static asset performance |
| **PHP** | 8.2 or higher (8.3 recommended) | CLI + FPM both required |
| **Database** | MySQL 8.0 or MariaDB 10.6+ | UTF-8mb4 charset, InnoDB engine |
| **Composer** | 2.x | For installing PHP dependencies |
| **Git** | 2.x | For pulling source code from repository |
| **SSL/TLS** | Let's Encrypt (free) or institutional certificate | Mandatory for production — payment/POS data must travel over HTTPS |

### Required PHP Extensions

The following must be enabled in `php.ini`:

- `BCMath`
- `Ctype`
- `cURL`
- `DOM`
- `Fileinfo`
- `GD` or `Imagick` _(for product image uploads)_
- `JSON`
- `Mbstring`
- `OpenSSL`
- `PCRE`
- `PDO`
- `PDO_MySQL`
- `Tokenizer`
- `XML`

---

## 3. Hardware Requirements

For a single-branch cafe with ~10 staff and up to ~50 concurrent QR customers during peak hours:

### Minimum (suitable for pilot / low traffic)

| Resource | Spec |
|---|---|
| CPU | 2 vCPU |
| RAM | 2 GB |
| Storage | 20 GB SSD |
| Network | 100 Mbps shared, public IP |

### Recommended (production)

| Resource | Spec |
|---|---|
| CPU | 4 vCPU (e.g., Intel Xeon / AMD EPYC) |
| RAM | 4 GB |
| Storage | 50 GB SSD with daily snapshots |
| Network | 1 Gbps shared, dedicated public IPv4 |

### Why these numbers

- Laravel + PHP-FPM is lightweight; a 4-vCPU box comfortably handles hundreds of concurrent requests
- The 4 GB RAM headroom accommodates MySQL buffer pool + PHP-FPM workers + OS cache
- 50 GB SSD is generous: the application is ~150 MB, the database grows ~5–10 MB per month from order data, and product images use ~6 MB initially (scales with menu size)

---

## 4. Network Requirements

| Requirement | Detail |
|---|---|
| **Public domain name** | e.g., `wellnesscafe.upsi.edu.my` (or sub-domain of upsi.edu.my) |
| **DNS records** | A record pointing to server IPv4; optional AAAA for IPv6 |
| **Inbound ports** | TCP 80 (HTTP → redirects to HTTPS) and TCP 443 (HTTPS) — open to the public Internet |
| **SSH access** | TCP 22 — restricted to UPSI ICT and authorised admin IPs |
| **Outbound** | Standard HTTPS (port 443) for Composer / Let's Encrypt / package updates |
| **WiFi coverage** | The cafe area must have reliable WiFi for customer phones to access the QR ordering page (existing UPSI WiFi sufficient) |
| **Latency** | Server should be co-located in Malaysia or nearby for sub-100ms response times |

---

## 5. Storage Requirements

| Storage area | Purpose | Initial size | Growth rate |
|---|---|---|---|
| Application code (`/var/www/wellness-cafe`) | Laravel app + frontend | ~150 MB | Static (only grows with updates) |
| MySQL database (`/var/lib/mysql`) | Orders, customers, audit log, etc. | ~10 MB | ~5–10 MB/month |
| Public storage (uploaded product photos) | Menu item photos | ~6 MB | ~5 MB/year |
| Laravel logs (`storage/logs`) | Error + activity logs | ~1 MB | ~10 MB/month (rotated) |
| Database backups | Daily snapshots | ~100 MB | Retained 30 days |

**Total Year-1 estimate: ~5 GB.** The 50 GB recommendation provides ~5 years of comfortable runway.

---

## 6. Security & Access Requirements

- **HTTPS-only access** — port 80 redirects all traffic to port 443
- **TLS certificate** — Let's Encrypt with auto-renewal, OR institutional UPSI certificate
- **Firewall** — UFW or equivalent, allowing only ports 22, 80, 443 inbound; SSH limited to admin IP ranges
- **OS user separation** — application runs as `www-data` (or dedicated non-root user); database runs as `mysql`
- **MySQL access** — application connects via a non-root MySQL user with privileges scoped to the `wellness_cafe` database only
- **Environment file (`.env`)** — file mode `600`, owned by application user, contains DB password and Laravel app key
- **SSH access** — key-based authentication only; password authentication disabled
- **Fail2ban** (recommended) — auto-bans IPs after repeated failed SSH attempts
- **No public direct access to MySQL** — port 3306 closed to public Internet (bound to `127.0.0.1` only)

---

## 7. Backup & Disaster Recovery

| Item | Frequency | Retention | Storage |
|---|---|---|---|
| Database dump (`mysqldump`) | Daily, 02:00 local time | 30 days rolling | Local + off-server (e.g., UPSI backup share or cloud) |
| Application files | Weekly | 4 weeks rolling | Off-server |
| Full system snapshot | Weekly | 4 weeks rolling | At hypervisor level if VM |

A simple `cron` script can handle DB + file backups; UPSI ICT may already have an institutional backup policy this can plug into.

**Recovery objective:** Restore service within 4 hours of total server loss using off-server backups.

---

## 8. Expected Load Profile

Based on a typical campus cafe operating 8 hours/day:

| Metric | Estimate |
|---|---|
| Daily orders | 50–200 |
| Peak concurrent customers (QR ordering) | 20–30 simultaneously around lunch |
| Concurrent staff sessions | 3–5 (cashier, kitchen, manager, etc.) |
| API requests per minute (peak) | ~200 (mostly auto-refresh polling) |
| Database transactions per minute (peak) | ~20–40 |

The recommended hardware (4 vCPU / 4 GB) operates well within capacity at these levels — typical CPU usage is expected to stay below 30%.

---

## 9. Optional / Nice-to-Have

| Item | Why |
|---|---|
| **Monitoring** (Uptime Kuma, Zabbix, or UPSI's existing tooling) | Alert when server / database goes down |
| **PHPMyAdmin** access (admin-IP-restricted) | Convenient DB inspection for the project team |
| **Redis** (1 GB instance) | If we later add session caching or background queues — not required at launch |
| **Staging subdomain** (e.g., `staging.wellnesscafe.upsi.edu.my`) | Test updates before pushing to production |

---

## 10. Deployment Notes

The codebase is in a Git repository. Once the server is provisioned, deployment is approximately:

```bash
git clone <repo-url> /var/www/wellness-cafe
cd /var/www/wellness-cafe
composer install --no-dev --optimize-autoloader
cp .env.example .env
# (edit .env with production DB credentials, APP_URL, APP_ENV=production)
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan config:cache
php artisan route:cache
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
```

Then point the web server's document root to `/var/www/wellness-cafe/public`. Total deployment time from a clean server: approximately 30 minutes.

---

## 11. Summary — One-Line Spec

> **A Linux (Ubuntu 22.04+) VPS with PHP 8.3, MySQL 8, Nginx, 4 vCPU, 4 GB RAM, 50 GB SSD, public IPv4, domain name with HTTPS certificate, and standard daily backups.**

---

## Contact

For technical clarification, please contact **_[Your name + email]_**.
The project repository is at: **_[Repository URL]_**.
