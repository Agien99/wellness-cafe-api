/* ============================================================
   Wellness Cafe POS - Main Application Controller (API Edition)
   ============================================================
   Loads all data from the Laravel REST API. All mutations call
   the API; local state mirrors server state.
   ============================================================ */

// ---------- Auth gate ---------- //
if (!API.isAuthenticated()) {
  location.href = 'staff.html';
}

// ---------- App State ---------- //
const state = {
  meta: {
    cafeName: 'Wellness Cafe',
    tagline:  'Relax . Reflect . Recharge',
    address:  'Ground Floor, Block 7, FPM, UPSI',
    phone:    '+60 5-450 6000',
    currency: 'RM',
    taxRate:  0.06,
  },
  user: API.getUser(),
  role: API.getUser()?.role,
  categories: [],
  products: [],
  customers: [],
  tables: [],
  promotions: [],
  loyaltyTiers: [],
};

const currentUser = state.user;
const currentRole = state.role; // primary role — used for display label only

/**
 * Permission check. Uses the merged permission list across ALL roles
 * the user holds (set by the backend on login / /me). Falls back to the
 * primary role's permissions for older session payloads.
 */
function hasPermission(key) {
  const perms = (currentUser && currentUser.permissions)
              || (currentRole && currentRole.permissions)
              || [];
  if (perms.includes('*')) return true;
  return perms.includes(key);
}

// ---------- Helpers ---------- //
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function money(n) { return state.meta.currency + ' ' + (+n).toFixed(2); }
function r2(n)    { return Math.round(+n * 100) / 100; }
function fmtDate(s, withTime = true) {
  const d = new Date(s);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!withTime) return date;
  return date + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function fmtTimeAgo(s) {
  const ms = Date.now() - new Date(s).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}
function toast(msg, type = 'success') {
  const c = $('#toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'error' ? 'error' : type === 'warn' ? 'warn' : '');
  t.innerHTML = `<b>${type === 'error' ? 'Error' : type === 'warn' ? 'Notice' : 'Success'}</b>${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = '.2s'; }, 2700);
  setTimeout(() => t.remove(), 3000);
}
function openModal(html, opts = {}) {
  const root = $('#modalRoot');
  const sz = opts.size || '';
  root.innerHTML = `<div class="modal-backdrop" id="modalBackdrop">
    <div class="modal ${sz}">${html}</div>
  </div>`;
  $('#modalBackdrop').addEventListener('click', e => {
    if (e.target.id === 'modalBackdrop' && !opts.persistent) closeModal();
  });
}
function closeModal() { $('#modalRoot').innerHTML = ''; }

// Decimal fields from Laravel come as strings; normalize for arithmetic
function num(v) { return v === null || v === undefined ? 0 : +v; }

function isAndroidPOS() {
  return (
    typeof window.AndroidPOS !== 'undefined' &&
    typeof window.AndroidPOS.printReceipt === 'function'
  );
}

function buildAndroidReceipt(
  order,
  method,
  amountReceived = null
) {
  const total = num(order.total);

  return {
    order_no:
      order.order_no || '-',

    date:
      fmtDate(
        order.paid_at ||
        order.updated_at ||
        order.created_at
      ),

    cashier:
      order.cashier?.name ||
      currentUser?.name ||
      '-',

    customer:
      order.customer_name ||
      order.customer?.name ||
      'Walk-in',

    order_type:
      order.channel === 'qr'
        ? 'QR Order'
        : 'Counter',

    table:
      order.table
        ? (
            order.table.name ||
            `Table ${order.table_id}`
          )
        : '',

    items:
      (order.items || []).map(item => ({
        name:
          item.name || 'Item',

        variant:
          item.variant_name || '',

        qty:
          num(item.qty),

        total:
          num(item.price) *
          num(item.qty),

        addons:
          (item.addons || []).map(addon => ({
            name:
              addon.name || 'Add-on',

            price:
              num(addon.price)
          }))
      })),

    subtotal:
      num(order.subtotal),

    discount:
      num(order.discount),

    tax:
      num(order.tax),

    total,

    payment_method:
      method.toUpperCase(),

    ...(method === 'cash' &&
       amountReceived !== null
      ? {
          amount_received:
            amountReceived,

          change:
            Math.max(
              0,
              amountReceived - total
            )
        }
      : {})
  };
}

async function getReceiptLogoBase64() {
  try {
    const response =
      await fetch(
        '/img/logo.png'
      );

    if (!response.ok) {
      throw new Error(
        'Logo could not be loaded'
      );
    }

    const blob =
      await response.blob();

    return await new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onloadend =
          () => {
            const result =
              reader.result;

            if (
              typeof result !==
              'string'
            ) {
              reject(
                new Error(
                  'Invalid logo data'
                )
              );

              return;
            }

            resolve(
              result.split(',')[1]
            );
          };

        reader.onerror =
          () => {
            reject(
              new Error(
                'Logo could not be read'
              )
            );
          };

        reader.readAsDataURL(
          blob
        );
      }
    );

  } catch (err) {
    console.error(
      'Receipt logo failed:',
      err
    );

    return null;
  }
}

async function printAndroidReceipt(
  order,
  method,
  amountReceived = null,
  openDrawerAfterPrint = true
) {
  if (!isAndroidPOS()) {
    return false;
  }

  try {
    const receipt =
      buildAndroidReceipt(
        order,
        method,
        amountReceived
      );

    const logoBase64 =
      await getReceiptLogoBase64();

    if (logoBase64) {
      receipt.logo_base64 =
        logoBase64;
    }

    /*
     * Drawer is opened by Android only
     * AFTER receipt printing succeeds.
     *
     * Normal cash payment:
     *   true
     *
     * Card / E-Wallet / QR:
     *   false
     *
     * Reprint:
     *   false
     */
    const shouldOpenDrawer =
      openDrawerAfterPrint &&
      method === 'cash';

    window.AndroidPOS.printReceipt(
      JSON.stringify(receipt),
      shouldOpenDrawer
    );

    return true;

  } catch (err) {
    console.error(
      'Android receipt printing failed:',
      err
    );

    toast(
      'Payment successful, but receipt printing failed.',
      'warn'
    );

    return false;
  }
}

async function reprintOrderReceipt(
  orderId
) {
  if (!isAndroidPOS()) {
    toast(
      'Receipt printer is only available in the Wellness Cafe POS Android app.',
      'warn'
    );

    return;
  }

  try {
    const order =
      await API.get(
        '/orders/' + orderId
      );

    if (!order.payment) {
      toast(
        'This order has no payment record.',
        'warn'
      );

      return;
    }

    const method =
      (
        order.payment.method ||
        'cash'
      ).toLowerCase();

    /*
     * Reprint intentionally does NOT
     * open the cash drawer.
     *
     * amountReceived is also unavailable
     * from historical orders, so we do not
     * recreate Received / Change values.
     */
    const sent =
      await printAndroidReceipt(
        order,
        method,
        null,
        false
      );

    if (sent) {
      toast(
        `Receipt ${order.order_no} sent to printer.`,
        'success'
      );
    }

  } catch (err) {
    console.error(
      'Receipt reprint failed:',
      err
    );

    toast(
      err.payload?.message ||
      'Could not reprint receipt.',
      'error'
    );
  }
}

function androidPrintSuccess() {
  console.log(
    'Android receipt print successful.'
  );

  toast(
    'Receipt printed successfully.',
    'success'
  );
}

function androidPrintFailed(error) {
  console.error(
    'Android receipt print failed:',
    error
  );

  toast(
    'Payment is saved, but receipt printing failed. You can reprint it from Order Details.',
    'warn'
  );
}

function orderItemConfigHtml(
  item,
  options = {}
) {
  const compact =
    options.compact ?? false;

  const addons =
    Array.isArray(item.addons)
      ? item.addons
      : [];

  const fontSize =
    compact
      ? '10px'
      : '12px';

  return `
    ${
      item.variant_name
        ? `
          <div
            style="
              margin-top:3px;
              font-size:${fontSize};
              color:var(--text-soft);
              font-weight:600;
            "
          >
            ${item.variant_name}
          </div>
        `
        : ''
    }

    ${
      addons.length
        ? `
          <div
            style="
              margin-top:3px;
              font-size:${fontSize};
              line-height:1.45;
            "
          >
            ${
              addons
                .map(
                  addon =>
                    `+ ${addon.name}`
                )
                .join('<br>')
            }
          </div>
        `
        : ''
    }
  `;
}

// ---------- Initial data load ---------- //
async function loadInitial() {
  try {
    const [
      menu,
      tables,
      customers,
      promos,
      loyaltyTiers,
    ] = await Promise.all([
      API.get('/menu'),
      API.get('/tables'),
      API.get('/customers'),
      API.get('/promotions'),
      API.get('/loyalty-tiers'),
    ]);
    state.categories = menu.categories;
    state.products = menu.products.map(p => ({
      ...p,

      price:
        num(p.price),

      cost:
        num(p.cost),

      option_groups:
        p.option_groups || [],

      variants:
        (p.variants || []).map(v => ({
          ...v,
          price: num(v.price),
          option_values:
            v.option_values || [],
        })),

      addons:
        (p.addons || []).map(a => ({
          ...a,
          price: num(a.price),
        })),
    }));
    state.tables     = tables;
    state.customers  = customers;
    state.promotions = promos;
    state.loyaltyTiers = loyaltyTiers;
  } catch (err) {
    console.error('loadInitial failed', err);
    toast('Could not load initial data. ' + (err.message || ''), 'error');
  }
}

// ---------- Navigation ---------- //
const NAV = [
  { section: 'Operations' },
  { key: 'dashboard', label: 'Dashboard',       icon: '📊' },
  { key: 'pos',       label: 'POS Terminal',    icon: '🧾' },
  { key: 'kds',       label: 'Kitchen Display', icon: '👨‍🍳' },
  { key: 'orders',    label: 'Orders',          icon: '📋' },
  { section: 'Management' },
  { key: 'menu',      label: 'Menu & Products', icon: '🍽️' },
  { key: 'tables',    label: 'Dining Tables',   icon: '🪑' },
  { key: 'inventory', label: 'Inventory',       icon: '📦' },
  { key: 'purchase',  label: 'Purchase Orders', icon: '🛒' },
  { key: 'customer',  label: 'Customers',       icon: '👥' },
  { key: 'promo',     label: 'Promotions',      icon: '🎁' },
  { key: 'refund',    label: 'Refunds',         icon: '↩️' },
  { section: 'Insights & System' },
  { key: 'reports',   label: 'Reports',         icon: '📈' },
  { key: 'users',     label: 'Users & Roles',   icon: '🔑' },
  { key: 'audit',     label: 'Audit Log',       icon: '📝' },
];

const PERM_MAP = {
  dashboard:'dashboard', pos:'pos', kds:'kds', orders:'pos',
  menu:'menu', tables:'menu', inventory:'inventory', purchase:'purchase',
  customer:'customer', promo:'promo', refund:'refund',
  reports:'reports', users:'users', audit:'audit',
};

const THEME_MAP = {
  /*
   * Pillar 01
   * Customer Experience
   */
  pos: 'p1',
  orders: 'p1',
  customer: 'p1',
  promo: 'p1',
  refund: 'p1',

  /*
   * Pillar 02
   * Core Operations
   */
  kds: 'p2',
  menu: 'p2',
  tables: 'p2',
  inventory: 'p2',
  purchase: 'p2',

  /*
   * Pillar 03
   * Business Intelligence / Administration
   */
  dashboard: 'p3',
  reports: 'p3',
  users: 'p3',
  audit: 'p3',
};


function applyRouteTheme(routeKey) {
  const theme =
    THEME_MAP[routeKey] || 'p1';

  document.body.dataset.theme =
    theme;
}

function renderNav() {
  const list = $('#navList');
  list.innerHTML = NAV.map(item => {
    if (item.section) return `<li class="nav-section">${item.section}</li>`;
    const perm = PERM_MAP[item.key];
    if (perm && !hasPermission(perm)) return '';
    return `<li><button class="nav-link" data-route="${item.key}">
      <span class="ico">${item.icon}</span><span>${item.label}</span>
    </button></li>`;
  }).join('');
  $$('#navList .nav-link').forEach(b => b.addEventListener('click', () => route(b.dataset.route)));
  const roleLabel = (currentUser.roles && currentUser.roles.length > 1)
    ? currentUser.roles.map(r => r.name).join(' · ')
    : (currentRole?.name || '—');
  $('#userCard').innerHTML = `
    <div class="avatar">${currentUser.name.charAt(0)}</div>
    <div class="info"><b>${currentUser.name}</b><small>${roleLabel}</small></div>`;
}

let currentRoute = null;
const PAGE_META = {
  dashboard: ['Dashboard',          'Operational overview & live metrics'],
  pos:       ['POS Terminal',       'Process sales & take orders'],
  kds:       ['Kitchen Display',    'Live order queue for the kitchen'],
  orders:    ['Order Management',   'All orders across all channels'],
  menu:      ['Menu & Products',    'Manage categories, products & pricing'],
  tables:    ['Dining Tables',      'Manage QR ordering tables for the cafe'],
  inventory: ['Inventory',          'Stock control & ingredients'],
  purchase:  ['Purchase Orders',    'Manage suppliers & procurement'],
  customer:  ['Customers & Loyalty','Customer database & loyalty programme'],
  promo:     ['Promotions',         'Discount codes & campaigns'],
  refund:    ['Refunds',            'Process refunds & cancellations'],
  reports:   ['Reports & Analytics','Sales, financial and product analytics'],
  users:     ['Users & Roles',      'User access management'],
  audit:     ['Audit Log',          'System activity log'],
};

function route(key) {
    if (
      PERM_MAP[key] &&
      !hasPermission(PERM_MAP[key])
    ) {
      toast(
        "You don't have permission for this module.",
        'error'
      );

      return;
    }

    applyRouteTheme(key);
  // Stop background polling on the previous view
  if (currentRoute === 'kds'    && key !== 'kds')    clearKdsTimers();
  if (currentRoute === 'orders' && key !== 'orders') clearOrdersTimers();
  currentRoute = key;
  $$('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.route === key));
  const m = PAGE_META[key] || [key, ''];
  $('#pageTitle').textContent = m[0];
  $('#pageSubtitle').textContent = m[1];
  const c = $('#content');
  c.innerHTML = '<div class="empty"><span class="em">⏳</span>Loading…</div>';
  setTimeout(() => {
    if (VIEWS[key]) {
      VIEWS[key](c).catch(err => {
        console.error(err);
        c.innerHTML = `<div class="alert alert-danger">Failed to load: ${err.message}</div>`;
      });
    } else {
      c.innerHTML = '<div class="empty"><span class="em">🚧</span>Module under construction</div>';
    }
  }, 50);
}

function updateClock() {
  const d = new Date();
  $('#clock').textContent =
    d.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}

// ---------- VIEWS ---------- //
const VIEWS = {};

/* ===== DASHBOARD ===== */
VIEWS.dashboard = async (root) => {
  const d = await API.get('/reports/dashboard');
  root.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi">
        <div class="label">Today's Sales</div>
        <div class="value">${money(d.today.sales)}</div>
        <div class="delta ${d.today.delta_pct<0?'neg':''}">${d.today.delta_pct>=0?'▲':'▼'} ${Math.abs(d.today.delta_pct)}% vs yesterday</div>
      </div>
      <div class="kpi amber">
        <div class="label">Today's Orders</div>
        <div class="value">${d.today.orders}</div>
        <div class="delta">${d.yesterday.orders} yesterday</div>
      </div>
      <div class="kpi blue">
        <div class="label">This Month</div>
        <div class="value">${money(d.month.sales)}</div>
        <div class="delta">${d.month.orders} orders</div>
      </div>
      <div class="kpi rose">
        <div class="label">Customers</div>
        <div class="value">${d.customers.total}</div>
        <div class="delta">${d.customers.members} members</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>Sales Trend - Last 14 Days</h3><small>Daily revenue</small></div>
        <canvas id="chartSales" height="120"></canvas>
      </div>
      <div class="card">
        <div class="card-header"><h3>⚠️ Operational Alerts</h3></div>
        ${(d.low_stock===0 && d.pending_kitchen===0) ?
          '<div class="alert alert-success">All systems normal.</div>' : ''}
        ${d.pending_payment>0 ? `<div class="alert alert-warn"><b>⏳ Pending Payment:</b> ${d.pending_payment} order(s) awaiting counter payment <button class="btn sm" onclick="app.route('orders')" style="margin-left:8px">View</button></div>` : ''}
        ${d.pending_kitchen>0 ? `<div class="alert alert-info"><b>👨‍🍳 Kitchen:</b> ${d.pending_kitchen} order(s) in queue</div>` : ''}
        ${d.low_stock>0 ? `<div class="alert alert-danger"><b>Low Stock:</b> ${d.low_stock} item(s) at or below reorder level</div>` : ''}
        <div class="card-header mt-3"><h3>Top Selling Products</h3></div>
        <table class="data">
          <thead><tr><th>#</th><th>Product</th><th class="text-right">Units</th><th class="text-right">Revenue</th></tr></thead>
          <tbody>
            ${d.top_products.map((p,i)=>`<tr>
              <td>${i+1}</td><td><b>${p.name}</b></td>
              <td class="text-right">${p.units}</td>
              <td class="text-right">${money(p.revenue)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">No data</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  new Chart($('#chartSales').getContext('2d'), {
    type: 'line',
    data: {
      labels: d.sales_trend.map(x => x.label),
      datasets: [{
        label: 'Revenue (RM)', data: d.sales_trend.map(x => x.revenue),
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.10)',
        fill: true, tension: 0.32, pointRadius: 3, borderWidth: 2,
      }]
    },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true} } }
  });
};

/* ===== POS TERMINAL ===== */
let pos = {
  cart: [],
  categoryId: null,
  customerId: 8,
  tableId: null,
  channel: 'pos',

  promoCode: null,

  /*
   * Stores the result returned by
   * Promotion V2 backend validation.
   */
  promoValidation: null,
};

VIEWS.pos = async (root) => {
  if (pos.categoryId === null) pos.categoryId = state.categories[0]?.id;

  const selectedCustomer =
  state.customers.find(
    c => c.id === pos.customerId
  ) ||
  state.customers.find(
    c => c.id === 8
  );

  const activeLoyaltyTiers =
  state.loyaltyTiers
    .filter(t => t.active)
    .sort(
      (a, b) =>
        num(a.minimum_spend) -
        num(b.minimum_spend)
    );

  const currentSpend =
    num(selectedCustomer?.total_spent);

  const nextTier =
    selectedCustomer?.id === 8
      ? null
      : activeLoyaltyTiers.find(
          t =>
            num(t.minimum_spend) >
            currentSpend
        );

  const amountToNextTier =
    nextTier
      ? Math.max(
          0,
          r2(
            num(nextTier.minimum_spend) -
            currentSpend
          )
        )
      : 0;

  root.innerHTML = `
    <div class="pos-shell">

      <!-- LEFT: MENU / PRODUCTS -->
      <section class="pos-menu-panel">
        <div class="pos-section-header">
          <div>
            <span class="pos-eyebrow">POINT OF SALE</span>
            <h2>Menu</h2>
            <p>Select an item to add it to the current order.</p>
          </div>

          <div class="pos-ready-status">
            <span class="pos-status-dot"></span>
            Ready
          </div>
        </div>

        <div class="pos-menu-tools">

          <div class="pos-search-wrap">
            <span class="pos-search-icon">⌕</span>

            <input
              type="search"
              id="posProductSearch"
              class="pos-product-search"
              placeholder="Search menu items..."
              autocomplete="off"
              aria-label="Search menu items"
            >

            <button
              class="pos-search-clear"
              id="posSearchClear"
              type="button"
              aria-label="Clear search"
              title="Clear search"
            >
              ×
            </button>
          </div>

        </div>

        <div class="pos-category-wrapper">
          <div class="category-bar" id="catBar"></div>
        </div>

        <div class="product-grid" id="prodGrid"></div>
      </section>

      <!-- RIGHT: CURRENT ORDER -->
      <aside class="pos-order-panel">
        <div class="pos-order-header">
          <div>
            <span class="pos-eyebrow">CURRENT ORDER</span>
            <h2>Order Cart</h2>
          </div>

          <button class="pos-clear-btn" id="clearCart" type="button" title="Clear cart">
            <span>🗑</span>
            Clear
          </button>
        </div>

        <div class="pos-order-meta">
          <div class="pos-field pos-field-full">
            <label>Customer</label>

            <div
              style="
                border:1.5px solid var(--border);
                border-radius:var(--radius);
                padding:12px;
                background:#fff;
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:12px;
              "
            >
              <div>
                <div style="font-weight:700">
                  ${selectedCustomer?.name || 'Walk-in Customer'}
                </div>

                ${
                  selectedCustomer?.id === 8
                    ? `
                      <div
                        style="
                          font-size:12px;
                          color:var(--text-soft);
                          margin-top:3px;
                        "
                      >
                        No loyalty benefits
                      </div>
                    `
                    : `
                      <div
                        style="
                          font-size:12px;
                          color:var(--text-soft);
                          margin-top:3px;
                        "
                      >
                        ${selectedCustomer?.membership || 'Bronze'}
                        Member
                        ·
                        ${selectedCustomer?.points || 0}
                        pts

                        <br>

                        <span>
                          ${money(currentSpend)} spent
                        </span>

                        ${nextTier ? `
                          <br>
                          <span>
                            ${money(amountToNextTier)}
                            to ${nextTier.name}
                          </span>
                        ` : `
                          <br>
                          <span>
                            Highest loyalty tier reached
                          </span>
                        `}
                      </div>
                    `
                }
              </div>

              <button
                class="btn sm"
                id="changePosCustomer"
                type="button"
              >
                Change
              </button>
            </div>
          </div>

          <div class="pos-meta-grid">
            <div class="pos-field">
              <label for="chanSel">Order Type</label>
              <select id="chanSel">
                <option value="pos" ${pos.channel==='pos'?'selected':''}>Dine-in / POS</option>
                <option value="qr" ${pos.channel==='qr'?'selected':''}>QR Order</option>
                <option value="online" ${pos.channel==='online'?'selected':''}>Online / Pickup</option>
              </select>
            </div>

            <div class="pos-field">
              <label for="tableSel">Table</label>
              <select id="tableSel">
                <option value="">No table</option>
                ${state.tables.map(t=>`
                  <option value="${t.id}" ${t.id===pos.tableId?'selected':''}>
                    ${t.name} · ${t.capacity} pax
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="pos-cart-section">
          <div class="pos-cart-section-title">
            <span>Order Items</span>
            <span class="pos-cart-count" id="cartCount">0 items</span>
          </div>

          <div class="cart-items" id="cartItems"></div>
        </div>

        <div class="cart-summary pos-order-summary" id="cartSum"></div>

        <div class="cart-actions pos-order-actions">
          <button class="btn pos-park-btn" id="parkOrder" type="button">
            Park Order
          </button>

          <button class="btn primary pos-pay-btn" id="payBtn" type="button">
            <span>💳</span>
            Proceed to Payment
          </button>
        </div>
      </aside>
    </div>

    <!-- MOBILE ONLY: STICKY CART BAR -->
    <div class="pos-mobile-bar" id="mobilePosBar">

      <button
        class="pos-mobile-cart-info"
        id="mobileCartJump"
        type="button"
      >
        <span class="pos-mobile-cart-icon">
          🛒
        </span>

        <span class="pos-mobile-cart-text">
          <b id="mobileCartCount">
            0 items
          </b>

          <small>
            View current order
          </small>
        </span>
      </button>

      <button
        class="pos-mobile-pay"
        id="mobilePayBtn"
        type="button"
      >
        <span id="mobileCartTotal">
          RM 0.00
        </span>

        <strong>
          Pay →
        </strong>
      </button>

    </div>`;

  renderCategoryBar();
  renderProductGrid();
  renderCart();

  const productSearch =
    $('#posProductSearch');

  const searchClear =
    $('#posSearchClear');

  if (productSearch) {
    productSearch.addEventListener(
      'input',
      () => {
        renderProductGrid();
        updateSearchClear();
      }
    );
  }

  if (searchClear) {
    searchClear.addEventListener(
      'click',
      () => {
        productSearch.value = '';
        productSearch.focus();

        renderProductGrid();
        updateSearchClear();
      }
    );
  }

  function updateSearchClear() {
    if (!searchClear || !productSearch) {
      return;
    }

    searchClear.classList.toggle(
      'show',
      productSearch.value.trim().length > 0
    );
  }

  $('#changePosCustomer')
  ?.addEventListener(
    'click',
    () => openPosCustomerPicker()
  );

  $('#chanSel').addEventListener('change', e => {
    pos.channel = e.target.value;

    clearAppliedPromo();

    renderCart();
  });
  
  $('#tableSel').addEventListener('change', e => {
    pos.tableId = e.target.value ? +e.target.value : null;
  });

  $('#clearCart').addEventListener('click', () => {
    pos.cart = [];

    clearAppliedPromo();

    renderCart();
  });

  $('#parkOrder').addEventListener('click', () => {
    pos.cart = [];

    clearAppliedPromo();

    renderCart();

    toast(
      'Order parked.',
      'success'
    );
  });

  $('#payBtn').addEventListener('click', openPayModal);

  const mobileCartJump =
    $('#mobileCartJump');

  const mobilePayBtn =
    $('#mobilePayBtn');

  if (mobileCartJump) {
    mobileCartJump.addEventListener(
      'click',
      () => {
        const orderPanel =
          $('.pos-order-panel');

        if (orderPanel) {
          orderPanel.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }
    );
  }

  if (mobilePayBtn) {
    mobilePayBtn.addEventListener(
      'click',
      openPayModal
    );
  }

  function renderCategoryBar() {
    $('#catBar').innerHTML = state.categories.map(c =>
      `<button class="cat-btn ${c.id===pos.categoryId?'active':''}" data-id="${c.id}" type="button">
        <span class="cat-icon">${c.icon}</span>
        <span>${c.name}</span>
      </button>`
    ).join('');

    $$('#catBar .cat-btn').forEach(b => b.addEventListener('click', () => {
      pos.categoryId = +b.dataset.id;
      renderCategoryBar();
      renderProductGrid();
    }));
  }

  function posProductAvailable(product) {
    if (!product.available) {
      return false;
    }

    if (
      product.product_type !==
      'configurable'
    ) {
      return true;
    }

    return (product.variants || [])
      .some(
        variant =>
          variant.available
      );
  }


  function posProductPriceLabel(
    product
  ) {
    if (
      product.product_type !==
      'configurable'
    ) {
      return money(product.price);
    }

    const prices =
      (product.variants || [])
        .filter(
          variant =>
            variant.available
        )
        .map(
          variant =>
            num(variant.price)
        );

    if (!prices.length) {
      return 'Sold Out';
    }

    return (
      'From ' +
      money(
        Math.min(...prices)
      )
    );
  }


  function renderProductGrid() {
    const searchTerm =
      $('#posProductSearch')
        ?.value
        .trim()
        .toLowerCase() || '';

    let products;

    if (searchTerm) {
      products =
        state.products.filter(
          p =>
            p.visible !== false &&
            p.name
              .toLowerCase()
              .includes(searchTerm)
        );
    }
    else {
      products =
        state.products.filter(
          p =>
            p.visible !== false &&
            p.category_id ===
              pos.categoryId
        );
    }

    if (products.length === 0) {
      $('#prodGrid').innerHTML = `
        <div class="pos-no-products">
          <span
            class="pos-no-products-icon"
          >
            🔎
          </span>

          <b>
            No menu items found
          </b>

          <small>
            ${
              searchTerm
                ? `No results for "${searchTerm}".`
                : 'There are no products in this category.'
            }
          </small>
        </div>
      `;

      return;
    }

    $('#prodGrid').innerHTML =
      products.map(p => {
        const orderable =
          posProductAvailable(p);

        const visual =
          p.image_url
            ? `
              <img
                src="${p.image_url}"
                alt="${p.name}"
                class="product-image"
              >
            `
            : `
              <span
                class="product-emoji"
              >
                ${p.image || '🍽'}
              </span>
            `;

        return `
          <button
            class="
              product-card
              ${
                orderable
                  ? ''
                  : 'unavail'
              }
            "
            data-id="${p.id}"
            type="button"
            ${
              orderable
                ? ''
                : 'aria-disabled="true"'
            }
          >
            <div class="product-visual">
              ${visual}

              ${
                !orderable
                  ? `
                    <span
                      class="product-sold-out"
                    >
                      Sold Out
                    </span>
                  `
                  : ''
              }
            </div>

            <div class="product-details">

              <div class="product-info">

                <span class="name">
                  ${p.name}
                </span>

                <span class="price">
                  ${posProductPriceLabel(p)}
                </span>

              </div>

              ${
                orderable
                  ? `
                    <span
                      class="product-add"
                      aria-hidden="true"
                    >
                      ${
                        p.product_type ===
                          'configurable' ||
                        (p.addons || [])
                          .length > 0
                          ? '›'
                          : '+'
                      }
                    </span>
                  `
                  : ''
              }

            </div>
          </button>
        `;
      }).join('');

    $$('#prodGrid .product-card')
      .forEach(card => {

        card.addEventListener(
          'click',
          () => {

            const product =
              state.products.find(
                x =>
                  x.id ===
                  +card.dataset.id
              );

            if (
              !product ||
              !posProductAvailable(product)
            ) {
              toast(
                'Item not available',
                'warn'
              );

              return;
            }

            if (
              product.product_type ===
                'configurable' ||
              (product.addons || [])
                .length > 0
            ) {
              openPosProductConfigurator(
                product
              );

              return;
            }

            addPosConfiguredItem(
              product,
              null,
              []
            );
          }
        );
      });
  }

  function addPosConfiguredItem(
    product,
    variant = null,
    addons = []
  ) {
    const addonIds =
      addons
        .map(
          addon =>
            Number(addon.id)
        )
        .sort(
          (a, b) => a - b
        );

    const addonTotal =
      addons.reduce(
        (sum, addon) =>
          sum +
          num(addon.price),
        0
      );

    const basePrice =
      variant
        ? num(variant.price)
        : num(product.price);

    const unitPrice =
      r2(
        basePrice +
        addonTotal
      );

    const key = [
      product.id,
      variant?.id || 0,
      addonIds.join('-'),
    ].join(':');

    const existing =
      pos.cart.find(
        item =>
          item.key === key
      );

    if (existing) {
      existing.qty += 1;
    }
    else {
      pos.cart.push({
        key,

        productId:
          product.id,

        productVariantId:
          variant?.id || null,

        addonIds,

        name:
          product.name,

        variantName:
          variant?.name || null,

        addonNames:
          addons.map(
            addon =>
              addon.name
          ),

        price:
          unitPrice,

        qty:
          1,
      });
    }

    clearAppliedPromo();

    renderCart();
  }


  function openPosProductConfigurator(
    product
  ) {
    const groups =
      product.option_groups || [];

    const variants =
      product.variants || [];

    const addons =
      (product.addons || [])
        .filter(
          addon =>
            addon.available
        );

    const selectedValues = {};
    const selectedAddonIds =
      new Set();


    function selectedVariant() {
      if (
        product.product_type !==
        'configurable'
      ) {
        return null;
      }

      const selectedIds =
        Object.values(
          selectedValues
        )
          .map(Number)
          .sort(
            (a, b) => a - b
          );

      if (
        selectedIds.length !==
        groups.length
      ) {
        return null;
      }

      return variants.find(
        variant => {

          if (!variant.available) {
            return false;
          }

          const variantIds =
            (
              variant.option_values ||
              []
            )
              .map(
                value =>
                  Number(value.id)
              )
              .sort(
                (a, b) =>
                  a - b
              );

          return (
            variantIds.length ===
              selectedIds.length &&
            variantIds.every(
              (id, index) =>
                id ===
                selectedIds[index]
            )
          );
        }
      ) || null;
    }


    function drawConfigurator() {
      const variant =
        selectedVariant();

      const selectedAddons =
        addons.filter(
          addon =>
            selectedAddonIds.has(
              Number(addon.id)
            )
        );

      const addonTotal =
        selectedAddons.reduce(
          (sum, addon) =>
            sum +
            num(addon.price),
          0
        );

      const basePrice =
        product.product_type ===
          'configurable'
          ? (
              variant
                ? num(variant.price)
                : null
            )
          : num(product.price);

      const total =
        basePrice === null
          ? null
          : r2(
              basePrice +
              addonTotal
            );


      openModal(`
        <div class="modal-head">

          <div>
            <h3>
              ${product.name}
            </h3>

            <small
              class="text-muted"
            >
              Configure item
            </small>
          </div>

          <button
            class="close-btn"
            onclick="closeModal()"
          >
            ×
          </button>

        </div>


        <div class="modal-body">

          ${
            groups.map(
              group => `
                <div
                  class="form-section"
                >

                  <div
                    class="form-section-title"
                  >
                    ${group.name}
                    ${
                      group.required
                        ? '*'
                        : ''
                    }
                  </div>

                  <div
                    class="product-option-values"
                  >

                    ${
                      (
                        group.values ||
                        []
                      ).map(
                        value => `
                          <button
                            type="button"
                            class="
                              product-option-btn
                              ${
                                selectedValues[
                                  group.id
                                ] ===
                                value.id
                                  ? 'selected'
                                  : ''
                              }
                            "
                            data-pos-group="
                              ${group.id}
                            "
                            data-pos-value="
                              ${value.id}
                            "
                            ${
                              value.available
                                ? ''
                                : 'disabled'
                            }
                          >
                            ${value.name}

                            ${
                              value.available
                                ? ''
                                : '<small>Sold Out</small>'
                            }
                          </button>
                        `
                      ).join('')
                    }

                  </div>

                </div>
              `
            ).join('')
          }


          ${
            product.product_type ===
              'configurable'
              ? `
                <div
                  class="
                    product-variant-message
                    ${
                      variant
                        ? 'valid'
                        : ''
                    }
                  "
                >
                  ${
                    variant
                      ? variant.name
                      : 'Select all required options.'
                  }
                </div>
              `
              : ''
          }


          ${
            addons.length
              ? `
                <div
                  class="form-section"
                >

                  <div
                    class="form-section-title"
                  >
                    ⚡ Boost It Up!
                  </div>

                  <div
                    class="product-addon-list"
                  >

                    ${addons.map(
                      addon => `
                        <label
                          class="
                            product-addon-row
                          "
                        >

                          <span>
                            <input
                              type="checkbox"
                              data-pos-addon="
                                ${addon.id}
                              "
                              ${
                                selectedAddonIds
                                  .has(
                                    Number(
                                      addon.id
                                    )
                                  )
                                  ? 'checked'
                                  : ''
                              }
                            >

                            ${addon.name}
                          </span>

                          <b>
                            + ${money(
                              addon.price
                            )}
                          </b>

                        </label>
                      `
                    ).join('')}

                  </div>

                </div>
              `
              : ''
          }

        </div>


        <div
          class="
            modal-foot
            product-config-foot
          "
        >

          <div
            class="product-config-price"
          >
            <small>
              Item Price
            </small>

            <strong>
              ${
                total === null
                  ? 'Select options'
                  : money(total)
              }
            </strong>
          </div>

          <button
            class="btn primary lg"
            id="posAddConfigured"
            ${
              product.product_type ===
                'configurable' &&
              !variant
                ? 'disabled'
                : ''
            }
          >
            Add to Order
          </button>

        </div>
      `, {
        size: 'lg',
      });


      $$(
        '[data-pos-group]'
      ).forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              selectedValues[
                Number(
                  button.dataset
                    .posGroup
                )
              ] =
                Number(
                  button.dataset
                    .posValue
                );

              drawConfigurator();
            }
          );
        }
      );


      $$(
        '[data-pos-addon]'
      ).forEach(
        input => {

          input.addEventListener(
            'change',
            () => {

              const addonId =
                Number(
                  input.dataset
                    .posAddon
                );

              if (input.checked) {
                selectedAddonIds
                  .add(addonId);
              }
              else {
                selectedAddonIds
                  .delete(addonId);
              }

              drawConfigurator();
            }
          );
        }
      );


      $('#posAddConfigured')
        ?.addEventListener(
          'click',
          () => {

            const chosenVariant =
              selectedVariant();

            if (
              product.product_type ===
                'configurable' &&
              !chosenVariant
            ) {
              return;
            }

            const chosenAddons =
              addons.filter(
                addon =>
                  selectedAddonIds.has(
                    Number(addon.id)
                  )
              );

            addPosConfiguredItem(
              product,
              chosenVariant,
              chosenAddons
            );

            closeModal();
          }
        );
    }


    drawConfigurator();
  }

  function renderCart() {
    const totalItems = pos.cart.reduce((sum, item) => sum + item.qty, 0);
    const cartCount = $('#cartCount');

    const mobileBar =
      $('#mobilePosBar');

    const mobileCount =
      $('#mobileCartCount');

    const mobileTotal =
      $('#mobileCartTotal');

    if (cartCount) {
      cartCount.textContent =
        `${totalItems} item${totalItems === 1 ? '' : 's'}`;
    }

    if (pos.cart.length === 0) {
      $('#cartItems').innerHTML = `
        <div class="cart-empty">
          <span class="emoji">🛒</span>
          <b>Your cart is empty</b>
          <small>Select a menu item to begin an order.</small>
        </div>`;

      $('#cartSum').innerHTML = `
        <div class="sum-line">
          <span>Subtotal</span>
          <span>${money(0)}</span>
        </div>

        <div class="sum-line">
          <span>Tax (${(state.meta.taxRate*100).toFixed(0)}%)</span>
          <span>${money(0)}</span>
        </div>

        <div class="sum-line total">
          <span>Total</span>
          <span>${money(0)}</span>
        </div>`;

      pos._calc = {
        sub: 0,
        memberDisc: 0,
        promoDisc: 0,
        tax: 0,
        total: 0,
      };

      const payBtn =
        $('#payBtn');

      if (payBtn) {
        payBtn.innerHTML = `
          <span>💳</span>
          Proceed to Payment
        `;
      }

      /*
       * Hide phone sticky cart bar
       * when cart is empty.
       */
      if (mobileBar) {
        mobileBar.classList.remove(
          'show'
        );
      }

      if (mobileCount) {
        mobileCount.textContent =
          '0 items';
      }

      if (mobileTotal) {
        mobileTotal.textContent =
          money(0);
      }

      return;
    }

    $('#cartItems').innerHTML = pos.cart.map((it,idx)=>`
      <div class="cart-item">

        <div class="info">

          <b>
            ${it.name}
          </b>

          ${
            it.variantName
              ? `
                <small
                  class="cart-config"
                >
                  ${it.variantName}
                </small>
              `
              : ''
          }

          ${
            (it.addonNames || [])
              .length
              ? `
                <small
                  class="cart-config"
                >
                  ${
                    it.addonNames
                      .map(
                        name =>
                          `+ ${name}`
                      )
                      .join('<br>')
                  }
                </small>
              `
              : ''
          }

          <small>
            ${money(it.price)} each
          </small>

          <strong>
            ${money(
              it.price *
              it.qty
            )}
          </strong>

        </div>

        <div class="qty-ctrl">
          <button
            data-act="dec"
            data-i="${idx}"
            type="button"
            aria-label="Decrease quantity"
          >
            −
          </button>

          <span>${it.qty}</span>

          <button
            data-act="inc"
            data-i="${idx}"
            type="button"
            aria-label="Increase quantity"
          >
            +
          </button>

          <button
            class="cart-remove"
            data-act="rem"
            data-i="${idx}"
            type="button"
            aria-label="Remove item"
          >
            ×
          </button>
        </div>

      </div>`).join('');

    $$('#cartItems button').forEach(
      b => b.addEventListener(
        'click',
        () => {
          const i = +b.dataset.i;
          const act = b.dataset.act;

          if (act === 'inc') {
            pos.cart[i].qty += 1;
          }
          else if (act === 'dec') {
            if (pos.cart[i].qty > 1) {
              pos.cart[i].qty -= 1;
            }
          }
          else if (act === 'rem') {
            pos.cart.splice(i, 1);
          }

          clearAppliedPromo();

          renderCart();
        }
      )
    );

    const sub =
      pos.cart.reduce(
        (s,x) => s + x.price * x.qty,
        0
      );

    const customer =
      state.customers.find(
        c => c.id === pos.customerId
      );

    const tier =
      state.loyaltyTiers.find(
        t =>
          t.name === customer?.membership &&
          t.active
      );

    const memberDisc =
      tier
        ? r2(
            sub *
            (
              num(tier.discount_percentage) /
              100
            )
          )
        : 0;

    const promoDisc =
      computePromoDiscount(sub);

    let totalDisc;

      if (
        promoDisc > 0 &&
        pos.promoValidation &&
        pos.promoValidation.stackable === false
      ) {
        totalDisc = Math.max(
          memberDisc,
          promoDisc
        );
      } else {
        totalDisc =
          memberDisc + promoDisc;
      }

      totalDisc = Math.min(
        totalDisc,
        sub
      );

    const taxBase =
      Math.max(
        0,
        sub - totalDisc
      );

    const tax =
      taxBase * state.meta.taxRate;

    const total =
      taxBase + tax;

    pos._calc = {
      sub,
      memberDisc,
      promoDisc,
      tax,
      total
    };

    $('#cartSum').innerHTML = `
      <div class="sum-line">
        <span>Subtotal</span>
        <span>${money(sub)}</span>
      </div>

      ${
        memberDisc > 0 &&
        (
          promoDisc === 0 ||
          pos.promoValidation?.stackable !== false ||
          memberDisc >= promoDisc
        )
          ? `
            <div class="sum-line discount-line">
              <span>
                Member discount
                (${num(tier.discount_percentage).toFixed(0)}%)
                ${
                  promoDisc > 0 &&
                  pos.promoValidation?.stackable === false
                    ? '<small class="text-muted"> · Applied</small>'
                    : ''
                }
              </span>

              <span>
                −${money(memberDisc)}
              </span>
            </div>
          `
          : ''
      }

      ${
        promoDisc > 0 &&
        (
          pos.promoValidation?.stackable !== false ||
          promoDisc > memberDisc
        )
          ? `
            <div class="sum-line discount-line">
              <span>
                Promo (${pos.promoCode})
                ${
                  memberDisc > 0 &&
                  pos.promoValidation?.stackable === false
                    ? '<small class="text-muted"> · Applied</small>'
                    : ''
                }
              </span>

              <span>
                −${money(promoDisc)}
              </span>
            </div>
          `
          : ''
      }

      ${
        memberDisc > 0 &&
        promoDisc > 0 &&
        pos.promoValidation?.stackable === false
          ? `
            <div class="sum-line">
              <span class="text-muted">
                ${
                  memberDisc >= promoDisc
                    ? `Promo ${pos.promoCode} not combined`
                    : 'Member discount not combined'
                }
              </span>

              <span class="text-muted">
                Best discount applied
              </span>
            </div>
          `
          : ''
      }

      <div class="sum-line">
        <span>
          Tax
          (${(state.meta.taxRate*100).toFixed(0)}%)
        </span>

        <span>
          ${money(tax)}
        </span>
      </div>

      <div class="sum-line total">
        <span>Total</span>
        <span>${money(total)}</span>
      </div>
    `;

    const payBtn =
      $('#payBtn');

    if (payBtn) {
      payBtn.innerHTML = `
        <span>💳</span>
        Pay ${money(total)}
      `;
    }

    /*
     * Update mobile sticky cart bar.
     */
    if (mobileCount) {
      mobileCount.textContent =
        `${totalItems} item${totalItems === 1 ? '' : 's'}`;
    }

    if (mobileTotal) {
      mobileTotal.textContent =
        money(total);
    }

    if (mobileBar) {
      mobileBar.classList.add(
        'show'
      );
    }
  }

  function computePromoDiscount(sub) {
    if (
      !pos.promoCode ||
      !pos.promoValidation
    ) {
      return 0;
    }

    const validContext =
      r2(pos.promoValidation.subtotal) === r2(sub)
      &&
      pos.promoValidation.customerId === pos.customerId
      &&
      pos.promoValidation.channel === pos.channel;

    if (!validContext) {
      return 0;
    }

    return r2(
      num(pos.promoValidation.discount)
    );
  }

  function openPayModal() {
    if (pos.cart.length === 0) {
      toast(
        'Cart is empty',
        'warn'
      );

      return;
    }

    const total =
      pos._calc.total;

    openModal(`
      <div class="modal-head">
        <h3>
          💳 Process Payment —
          ${money(total)}
        </h3>

        <button
          class="close-btn"
          onclick="closeModal()"
        >
          ×
        </button>
      </div>

      <div class="modal-body">

        <div
          class="alert alert-info"
          style="margin-bottom:12px"
        >
          Customer:
          <b>
            ${
              state.customers.find(
                c => c.id === pos.customerId
              ).name
            }
          </b>

          · Channel:
          <b>
            ${pos.channel.toUpperCase()}
          </b>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div
            class="pos-payment-preview"
            style="
              margin-bottom:16px;
            "
          >
            <div
              class="section-title"
              style="margin-bottom:10px"
            >
              Order Preview
            </div>

            <div
              style="
                display:flex;
                flex-direction:column;
                gap:10px;
              "
            >
              ${
                pos.cart.map(item => `
                  <div
                    style="
                      border:1px solid var(--border);
                      border-radius:10px;
                      padding:12px 14px;
                      background:#fff;
                    "
                  >
                    <div
                      style="
                        display:flex;
                        justify-content:space-between;
                        gap:12px;
                        align-items:flex-start;
                      "
                    >
                      <div>
                        <b>
                          ${item.qty} × ${item.name}
                        </b>

                        ${
                          item.variantName
                            ? `
                              <div
                                class="text-muted"
                                style="
                                  font-size:12px;
                                  margin-top:4px;
                                "
                              >
                                ${item.variantName}
                              </div>
                            `
                            : ''
                        }

                        ${
                          (item.addonNames || []).length
                            ? `
                              <div
                                style="
                                  font-size:12px;
                                  margin-top:4px;
                                "
                              >
                                ${
                                  item.addonNames
                                    .map(
                                      name =>
                                        `+ ${name}`
                                    )
                                    .join('<br>')
                                }
                              </div>
                            `
                            : ''
                        }
                      </div>

                      <div
                        style="
                          text-align:right;
                          white-space:nowrap;
                        "
                      >
                        <b>
                          ${money(
                            item.price *
                            item.qty
                          )}
                        </b>

                        ${
                          item.qty > 1
                            ? `
                              <div
                                class="text-muted"
                                style="
                                  font-size:11px;
                                  margin-top:3px;
                                "
                              >
                                ${money(item.price)}
                                each
                              </div>
                            `
                            : ''
                        }
                      </div>
                    </div>
                  </div>
                `).join('')
              }
            </div>
          </div>
          <div class="cart-summary">

            <div class="sum-line">
              <span>Subtotal</span>
              <span>${money(pos._calc.sub)}</span>
            </div>

            ${
              pos._calc.memberDisc > 0 &&
              (
                pos._calc.promoDisc === 0 ||
                pos.promoValidation?.stackable !== false ||
                pos._calc.memberDisc >= pos._calc.promoDisc
              )
                ? `
                  <div class="sum-line discount-line">
                    <span>
                      Member discount
                    </span>

                    <span>
                      −${money(pos._calc.memberDisc)}
                    </span>
                  </div>
                `
                : ''
            }

            ${
              pos._calc.promoDisc > 0 &&
              (
                pos.promoValidation?.stackable !== false ||
                pos._calc.promoDisc > pos._calc.memberDisc
              )
                ? `
                  <div class="sum-line discount-line">
                    <span>
                      Promo (${pos.promoCode})
                    </span>

                    <span>
                      −${money(pos._calc.promoDisc)}
                    </span>
                  </div>
                `
                : ''
            }

            ${
              pos._calc.memberDisc > 0 &&
              pos._calc.promoDisc > 0 &&
              pos.promoValidation?.stackable === false
                ? `
                  <div class="sum-line">
                    <span class="text-muted">
                      Best discount applied
                    </span>

                    <span class="text-muted">
                      ${
                        pos._calc.promoDisc > pos._calc.memberDisc
                          ? 'Promotion'
                          : 'Membership'
                      }
                    </span>
                  </div>
                `
                : ''
            }

            <div class="sum-line">
              <span>Tax</span>
              <span>${money(pos._calc.tax)}</span>
            </div>

            <div class="sum-line total">
              <span>Total</span>
              <span>${money(pos._calc.total)}</span>
            </div>

          </div>
        </div>

        <div class="section-title">
          Promo Code (Optional)
        </div>

        <div class="pos-promo-entry mb-4">

          <input
            type="text"
            id="promoIn"
            placeholder="Enter code e.g. WELCOME10"
            class="search"
            style="flex:1"
            value="${pos.promoCode || ''}"
          >

          <button
            class="btn"
            id="applyPromo"
          >
            Apply
          </button>

          ${
            pos.promoCode
              ? `
                <button
                  class="btn danger"
                  id="removePromo"
                >
                  Remove
                </button>
              `
              : ''
          }

        </div>

        <div class="section-title">
          Payment Method
        </div>

        <div class="payment-grid">

          <div
            class="pay-option active"
            data-m="cash"
          >
            <span class="ico">💵</span>
            <span class="label">Cash</span>
          </div>

          <div
            class="pay-option"
            data-m="card"
          >
            <span class="ico">💳</span>
            <span class="label">Card</span>
          </div>

          <div
            class="pay-option"
            data-m="ewallet"
          >
            <span class="ico">📱</span>
            <span class="label">E-Wallet</span>
          </div>

          <div
            class="pay-option"
            data-m="qr"
          >
            <span class="ico">📷</span>
            <span class="label">QR Pay</span>
          </div>

        </div>

        <div id="cashSection">

          <div class="section-title">
            Amount Received
          </div>

          <input
            type="number"
            id="amtRcv"
            class="search"
            style="font-size:18px;padding:14px"
            value="${total.toFixed(2)}"
            step="0.01"
          >

          <div
            class="alert alert-info mt-3"
            style="font-size:15px"
          >
            Change:
            <b id="changeAmt">
              ${state.meta.currency} 0.00
            </b>
          </div>

        </div>

      </div>

      <div class="modal-foot">

        <button
          class="btn"
          onclick="closeModal()"
        >
          Cancel
        </button>

        <button
          class="btn primary lg"
          id="confirmPay"
        >
          ✓ Complete Sale
        </button>

      </div>
    `, {
      size:'lg'
    });

    let method = 'cash';

    $$('.pay-option').forEach(
      o => o.addEventListener(
        'click',
        () => {
          $$('.pay-option').forEach(
            x => x.classList.remove(
              'active'
            )
          );

          o.classList.add(
            'active'
          );

          method =
            o.dataset.m;

          $('#cashSection').style.display =
            method === 'cash'
              ? 'block'
              : 'none';
        }
      )
    );

    $('#amtRcv').addEventListener(
      'input',
      e => {
        const change =
          +e.target.value -
          total;

        $('#changeAmt').textContent =
          state.meta.currency +
          ' ' +
          Math.max(
            0,
            change
          ).toFixed(2);
      }
    );

    $('#applyPromo').addEventListener(
      'click',
      async () => {
        const input =
          $('#promoIn');

        const button =
          $('#applyPromo');

        const code =
          input
            .value
            .trim()
            .toUpperCase();

        if (!code) {
          toast(
            'Enter a promotion code.',
            'warn'
          );

          input.focus();

          return;
        }

        const sub =
          pos.cart.reduce(
            (sum, item) =>
              sum +
              item.price *
              item.qty,
            0
          );

        button.disabled = true;
        button.textContent = 'Checking...';

        try {
          const r =
            await API.post(
              '/promotions/validate',
              {
                code,
                subtotal: r2(sub),

                customer_id:
                  pos.customerId === 8
                    ? null
                    : pos.customerId,

                channel:
                  pos.channel,
              }
            );

          if (!r.valid) {
            throw new Error(
              r.message ||
              'Promotion is not valid.'
            );
          }

          pos.promoCode =
            code;

          pos.promoValidation = {
            discount:
              num(r.discount),

            stackable:
              r.promo?.stackable ?? false,

            subtotal:
              r2(sub),

            customerId:
              pos.customerId,

            channel:
              pos.channel,
          };

          toast(
            r.message ||
            `${code} applied.`,
            'success'
          );

          closeModal();

          renderCart();

          setTimeout(
            openPayModal,
            80
          );
        }
        catch (err) {
          const promoError =
            err.payload
              ?.errors
              ?.promo_code?.[0];

          const message =
            promoError ||
            err.payload?.message ||
            err.message ||
            'Promotion could not be applied.';

          clearAppliedPromo();

          toast(
            message,
            'error'
          );

          button.disabled = false;
          button.textContent = 'Apply';
        }
      }
    );

    if ($('#removePromo')) {
      $('#removePromo').addEventListener(
        'click',
        () => {
          clearAppliedPromo();

          closeModal();

          renderCart();

          setTimeout(
            openPayModal,
            80
          );
        }
      );
    }

    $('#confirmPay').addEventListener(
      'click',
      async () => {

        if (method === 'cash') {
          const amt =
            +$('#amtRcv').value;

          if (r2(amt) < r2(total)) {
            toast(
              'Insufficient amount',
              'error'
            );

            return;
          }
        }

        await completeSale(
          method
        );
      }
    );
  }

  async function completeSale(method) {
    const btn =
      $('#confirmPay');

    btn.disabled =
      true;

    btn.textContent =
      'Processing...';

    try {
      const order =
        await API.post(
          '/orders',
          {
            items:
              pos.cart.map(
                c => ({
                  product_id:
                    c.productId,

                  product_variant_id:
                    c.productVariantId || null,

                  addon_ids:
                    c.addonIds || [],

                  qty:
                    c.qty
                })
              ),

            customer_id:
              pos.customerId,

            channel:
              pos.channel,

            table_id:
              pos.tableId,

            promo_code:
              pos.promoCode,

            payment: {
              method
            },
          }
        );

      closeModal();

      showReceipt(
        order,
        method
      );

      /*
      * Fetch the complete saved order before
      * sending it to the Android printer.
      *
      * This uses the same detailed order data
      * that the working Reprint Receipt uses.
      */
      try {
        const printableOrder =
          await API.get(
            '/orders/' + order.id
          );

        printAndroidReceipt(
          printableOrder,
          method
        );

      } catch (printErr) {
        console.error(
          'Could not prepare completed sale receipt:',
          printErr
        );

        toast(
          'Sale completed, but receipt could not be prepared for printing.',
          'warn'
        );
      }

      pos.cart = [];

      clearAppliedPromo();

      pos.customerId = 8;
      pos.tableId = null;

      state.customers =
        await API.get(
          '/customers'
        );
    }
    catch (err) {
      btn.disabled =
        false;

      btn.textContent =
        '✓ Complete Sale';

      const promoError =
        err.payload
          ?.errors
          ?.promo_code?.[0];

      const orderError =
        err.payload
          ?.errors
          ?.order?.[0];

      toast(
        promoError ||
        orderError ||
        err.payload?.message ||
        err.message ||
        'Sale failed',
        'error'
      );
    }
  }

  function showReceipt(order, method) {
    const customer =
      state.customers.find(
        c =>
          c.id ===
          order.customer_id
      ) || {
        name:
          order.customer_name
      };

    const html = `
      <div
        class="receipt"
        id="receipt"
      >

        <div class="center">

          <h4>
            ${state.meta.cafeName}
          </h4>

          <div style="font-size:11px">
            ${state.meta.tagline}
          </div>

          <div style="font-size:11px">
            ${state.meta.address}
          </div>

          <div style="font-size:11px">
            Tel: ${state.meta.phone}
          </div>

        </div>

        <div class="sep"></div>

        <div class="row">
          <span>Order:</span>
          <b>${order.order_no}</b>
        </div>

        <div class="row">
          <span>Date:</span>
          <span>
            ${fmtDate(order.created_at)}
          </span>
        </div>

        <div class="row">
          <span>Cashier:</span>
          <span>
            ${currentUser.name}
          </span>
        </div>

        <div class="row">
          <span>Channel:</span>
          <span>
            ${order.channel.toUpperCase()}
          </span>
        </div>

        ${
          order.table_id
            ? `
              <div class="row">
                <span>Table:</span>

                <span>
                  ${
                    state.tables.find(
                      t =>
                        t.id ===
                        order.table_id
                    )?.name || ''
                  }
                </span>
              </div>
            `
            : ''
        }

        <div class="row">
          <span>Customer:</span>
          <span>
            ${customer.name}
          </span>
        </div>

        <div class="sep"></div>

        ${
          order.items.map(
            item => `
              <div
                style="
                  margin-bottom:8px;
                "
              >

                <div class="item-row">

                  <b>
                    ${item.qty} ×
                    ${item.name}
                  </b>

                  <span>
                    ${money(
                      num(item.price) *
                      item.qty
                    )}
                  </span>

                </div>

                ${orderItemConfigHtml(
                  item,
                  {
                    compact: true,
                  }
                )}

              </div>
            `
          ).join('')
        }

        <div class="sep"></div>

        <div class="row">
          <span>Subtotal</span>

          <span>
            ${state.meta.currency}
            ${num(order.subtotal).toFixed(2)}
          </span>
        </div>

        ${
          num(order.discount) > 0
            ? `
              <div class="row">

                <span>
                  Discount
                </span>

                <span>
                  -
                  ${state.meta.currency}
                  ${num(order.discount).toFixed(2)}
                </span>

              </div>
            `
            : ''
        }

        <div class="row">
          <span>
            Tax
            (${(state.meta.taxRate*100).toFixed(0)}%)
          </span>

          <span>
            ${state.meta.currency}
            ${num(order.tax).toFixed(2)}
          </span>
        </div>

        <div class="row">
          <b>TOTAL</b>

          <b>
            ${state.meta.currency}
            ${num(order.total).toFixed(2)}
          </b>
        </div>

        <div class="sep"></div>

        <div class="row">
          <span>Paid by:</span>

          <span>
            ${method.toUpperCase()}
          </span>
        </div>

        <div class="sep"></div>

        <div
          class="center"
          style="font-size:11px"
        >
          Thank you! Stay healthy 🌿
        </div>

      </div>
    `;

    openModal(`
      <div class="modal-head">

        <h3>
          🧾 Receipt —
          ${order.order_no}
        </h3>

        <button
          class="close-btn"
          onclick="closeModal()"
        >
          ×
        </button>

      </div>

      <div class="modal-body">
        ${html}
      </div>

      <div class="modal-foot">

        <button
          class="btn"
          id="printSaleReceipt"
        >
          🖨 Print Receipt
        </button>

        <button
          class="btn primary"
          onclick="closeModal();app.route('pos')"
        >
          New Sale
        </button>

      </div>
    `);

    $('#printSaleReceipt')
      ?.addEventListener(
        'click',
        async () => {
          try {
            const printableOrder =
              await API.get(
                '/orders/' + order.id
              );

            printAndroidReceipt(
              printableOrder,
              method,
              null,
              false
            );

          } catch (err) {
            console.error(
              'Receipt print failed:',
              err
            );

            toast(
              'Could not prepare receipt for printing.',
              'error'
            );
          }
        }
      );
  }
};

function clearAppliedPromo() {
  pos.promoCode = null;
  pos.promoValidation = null;
}

function openPosCustomerPicker() {
  const customers =
    [...state.customers].sort((a, b) => {
      if (a.id === 8) return -1;
      if (b.id === 8) return 1;

      return a.name.localeCompare(b.name);
    });

  openModal(`
    <div class="modal-head">
      <h3>Select Customer</h3>

      <button
        class="close-btn"
        onclick="closeModal()"
      >
        ×
      </button>
    </div>

    <div class="modal-body">

      <div
        style="
          display:flex;
          justify-content:flex-end;
          margin-bottom:12px;
        "
      >
        <button
          type="button"
          class="btn primary"
          id="newPosCustomer"
        >
          + New Customer
        </button>
      </div>

      <div class="field">
        <label>Search</label>

        <input
          id="posCustomerSearch"
          placeholder="Search name, phone or email..."
          autocomplete="off"
        >
      </div>

      <div
        id="posCustomerList"
        style="
          display:flex;
          flex-direction:column;
          gap:8px;
          max-height:55vh;
          overflow-y:auto;
        "
      ></div>
    </div>
  `);

  $('#newPosCustomer')
  ?.addEventListener(
    'click',
    () => {
      openCustomerForm(
        null,
        {
          returnToPos: true,
        }
      );
    }
  );

  const draw = () => {
    const q =
      ($('#posCustomerSearch')?.value || '')
        .trim()
        .toLowerCase();

    const filtered =
      customers.filter(c => {
        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      });

    $('#posCustomerList').innerHTML =
      filtered.map(c => `
        <button
          type="button"
          class="btn pos-customer-option"
          data-customer-id="${c.id}"
          style="
            width:100%;
            justify-content:space-between;
            text-align:left;
            padding:12px 14px;
          "
        >
          <span>
            <b>${c.name}</b>

            <small
              style="
                display:block;
                margin-top:3px;
                color:var(--text-soft);
              "
            >
              ${
                c.id === 8
                  ? 'Walk-in · No loyalty'
                  : `${c.membership} Member · ${c.points || 0} pts`
              }
            </small>
          </span>

          ${
            c.id === pos.customerId
              ? '<span class="badge badge-success">Selected</span>'
              : ''
          }
        </button>
      `).join('') ||
      `
        <div class="empty">
          No customers found.
        </div>
      `;
  };

  $('#posCustomerSearch')
    ?.addEventListener(
      'input',
      draw
    );

  $('#posCustomerList')
    ?.addEventListener(
      'click',
      e => {
        const btn =
          e.target.closest(
            '.pos-customer-option'
          );

        if (!btn) {
          return;
        }

        pos.customerId =
          Number(
            btn.dataset.customerId
          );

        clearAppliedPromo();

        closeModal();

        VIEWS.pos(
          $('#content')
        );
      }
    );

  draw();
}

/* ===== KDS (auto-refreshing) ===== */
let kdsPollTimer = null;
let kdsTickTimer = null;
let kdsLastSeenIds = new Set();
let kdsLastFetch = null;
const KDS_POLL_MS = 8000; // refresh every 8 seconds

function clearKdsTimers() {
  if (kdsPollTimer) { clearInterval(kdsPollTimer); kdsPollTimer = null; }
  if (kdsTickTimer) { clearInterval(kdsTickTimer); kdsTickTimer = null; }
}

VIEWS.kds = async (root) => {
  clearKdsTimers();
  kdsLastSeenIds = new Set(); // reset baseline so first render doesn't flag everything as "new"

  async function render(isInitial = false) {
    let data;
    try {
      data = await API.get('/kitchen/orders');
    } catch (err) {
      if (isInitial) throw err;
      return; // silent fail on background poll
    }

    // Detect newly arrived orders (compared to last poll)
    const newOrders = isInitial ? [] : data.orders.filter(o => !kdsLastSeenIds.has(o.id));
    if (newOrders.length > 0) {
      toast(`🔔 ${newOrders.length} new order(s) received!`, 'success');
    }
    kdsLastSeenIds = new Set(data.orders.map(o => o.id));
    kdsLastFetch = new Date();

    root.innerHTML = `
      <div class="stat-row">
        <div class="stat-pill"><div class="ico" style="background:#fef3c7;color:#92400e">⏳</div><div><div class="l">Pending</div><div class="v">${data.summary.pending}</div></div></div>
        <div class="stat-pill"><div class="ico" style="background:#dbeafe;color:#1e40af">🔥</div><div><div class="l">Preparing</div><div class="v">${data.summary.preparing}</div></div></div>
        <div class="stat-pill"><div class="ico" style="background:#d1fae5;color:#065f46">✓</div><div><div class="l">Ready</div><div class="v">${data.summary.ready}</div></div></div>
        <div style="flex:1"></div>
        <div class="stat-pill" style="background:#d1fae5;border:1px solid #6ee7b7">
          <span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:50%;animation:kdsPulse 1.5s ease-in-out infinite"></span>
          <span style="color:#065f46;font-weight:700;margin:0 8px 0 6px">LIVE</span>
          <span class="text-muted" id="kdsUpdated" style="font-size:11px">just now</span>
        </div>
        <button class="btn" onclick="app.route('kds')" title="Manual refresh">🔄</button>
      </div>
      ${data.orders.length===0 ?
        `<div class="kds-empty"><span class="em">🍽️</span><div>No active kitchen orders.</div><small>Auto-refresh every ${KDS_POLL_MS/1000} seconds — new orders appear automatically.</small></div>` :
        `<div class="kds-grid">${data.orders.map(o => kdsCard(o, newOrders.some(n => n.id === o.id))).join('')}</div>`
      }`;

    $$('.kds-card .kds-actions button').forEach(b => b.addEventListener('click', async () => {
      const id = +b.dataset.id, next = b.dataset.next;
      try {
        await API.patch(`/kitchen/orders/${id}/status`, { status: next });
        toast(`Order → ${next.toUpperCase()}`);
        render(); // re-render immediately, don't wait for next poll
      } catch (err) {
        toast(err.payload?.message || 'Update failed', 'error');
      }
    }));
  }

  await render(true);

  // Start auto-refresh polling
  kdsPollTimer = setInterval(() => render(false), KDS_POLL_MS);

  // Tick the "last updated" indicator every second
  kdsTickTimer = setInterval(() => {
    const el = $('#kdsUpdated');
    if (!el || !kdsLastFetch) return;
    const secs = Math.floor((Date.now() - kdsLastFetch.getTime()) / 1000);
    el.textContent = secs < 2 ? 'just now' : `${secs}s ago`;
  }, 1000);
};

function kdsCard(
  o,
  isNew = false
) {
  const next =
    o.kitchen_status === 'pending'
      ? 'preparing'
      : o.kitchen_status === 'preparing'
        ? 'ready'
        : 'completed';

  const btnLabel =
    o.kitchen_status === 'pending'
      ? 'Start Preparing'
      : o.kitchen_status === 'preparing'
        ? 'Mark Ready'
        : 'Mark Picked Up';


  const itemsHtml =
    o.items.map(item => {

      const addons =
        Array.isArray(item.addons)
          ? item.addons
          : [];

      return `
        <li
          style="
            display:block;
            padding:10px 0;
          "
        >

          <div
            style="
              display:flex;
              align-items:flex-start;
              gap:8px;
            "
          >

            <b
              style="
                min-width:30px;
                font-size:16px;
              "
            >
              ${item.qty}×
            </b>

            <div
              style="
                flex:1;
                min-width:0;
              "
            >

              <div
                style="
                  font-weight:700;
                  font-size:15px;
                "
              >
                ${item.name}
              </div>


              ${
                item.variant_name
                  ? `
                    <div
                      style="
                        margin-top:4px;
                        font-size:13px;
                        font-weight:600;
                        color:var(--text-soft);
                      "
                    >
                      ${item.variant_name}
                    </div>
                  `
                  : ''
              }


              ${
                addons.length
                  ? `
                    <div
                      style="
                        margin-top:5px;
                        display:flex;
                        flex-direction:column;
                        gap:2px;
                        font-size:12px;
                      "
                    >
                      ${
                        addons.map(
                          addon => `
                            <span>
                              + ${addon.name}
                            </span>
                          `
                        ).join('')
                      }
                    </div>
                  `
                  : ''
              }

            </div>

          </div>

        </li>
      `;
    }).join('');


  return `
    <div
      class="
        kds-card
        ${o.kitchen_status}
        ${isNew ? 'kds-new' : ''}
      "
    >

      <div class="head">

        <div>

          <b>
            ${o.order_no}
          </b>

          ${
            isNew
              ? `
                <span
                  class="
                    badge
                    badge-success
                  "
                  style="
                    margin-left:6px;
                  "
                >
                  NEW
                </span>
              `
              : ''
          }

          <div
            style="
              font-size:11.5px;
              color:#6b7280;
            "
          >
            ${o.channel.toUpperCase()}

            ${
              o.table_id
                ? ' · ' +
                  (
                    o.table?.name ||
                    ''
                  )
                : ''
            }

            ${
              o.customer_name
                ? ' · ' +
                  o.customer_name
                : ''
            }
          </div>

        </div>


        <div class="time">
          ${fmtTimeAgo(o.created_at)}
        </div>

      </div>


      <ul class="kds-items">
        ${itemsHtml}
      </ul>


      <div class="kds-actions">

        <button
          class="
            btn
            primary
            block
          "
          data-id="${o.id}"
          data-next="${next}"
        >
          ${btnLabel}
        </button>

      </div>

    </div>
  `;
}

/* ===== ORDERS LIST (auto-refreshing) ===== */
let ordersPollTimer = null;
let ordersTickTimer = null;
let ordersLastSeenIds = new Set();
let ordersLastFetch = null;
const ORDERS_POLL_MS = 10000; // refresh every 10 seconds

function clearOrdersTimers() {
  if (ordersPollTimer) { clearInterval(ordersPollTimer); ordersPollTimer = null; }
  if (ordersTickTimer) { clearInterval(ordersTickTimer); ordersTickTimer = null; }
}

VIEWS.orders = async (root) => {
  clearOrdersTimers();
  ordersLastSeenIds = new Set();

  // Initial shell — toolbar stays put, table body refreshes
  root.innerHTML = `
    <div id="pendingBanner"></div>
    <div class="toolbar">
      <input class="search" id="searchOrder" placeholder="🔍 Search order #, customer...">
      <select id="filterChannel"><option value="">All channels</option><option value="pos">POS</option><option value="qr">QR</option><option value="online">Online</option></select>
      <select id="filterStatus">
        <option value="">All statuses</option>
        <option value="pending_payment">⏳ Pending Payment</option>
        <option value="completed">Completed</option>
        <option value="refunded">Refunded</option>
      </select>
      <div class="stat-pill" style="background:#d1fae5;border:1px solid #6ee7b7;padding:6px 12px">
        <span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:50%;animation:kdsPulse 1.5s ease-in-out infinite"></span>
        <span style="color:#065f46;font-weight:700;margin:0 8px 0 6px">LIVE</span>
        <span class="text-muted" id="ordersUpdated" style="font-size:11px">just now</span>
      </div>
      <button class="btn" onclick="app.route('orders')" title="Manual refresh">🔄</button>
    </div>
    <div class="card"><div id="orderTable"><div class="empty"><span class="em">⏳</span>Loading…</div></div></div>`;

  async function render(isInitial = false) {
    // Pull pending count for the banner (separate small call, cheap)
    let pendingCount = 0;
    try {
      const pendingRes = await API.get('/orders?status=pending_payment');
      pendingCount = (pendingRes.data || pendingRes).length;
    } catch (e) { /* ignore on poll */ }

    $('#pendingBanner').innerHTML = pendingCount > 0 ? `
      <div class="alert alert-warn" style="display:flex;align-items:center;gap:12px">
        <span style="font-size:22px">⏳</span>
        <div style="flex:1"><b>${pendingCount} order(s) awaiting payment at the counter</b><div style="font-size:12px">QR / online customers will pay when they arrive.</div></div>
        <button class="btn primary" id="showPending">Show Pending</button>
      </div>` : '';
    const showPendingBtn = $('#showPending');
    if (showPendingBtn) {
      showPendingBtn.addEventListener('click', () => { $('#filterStatus').value = 'pending_payment'; render(); });
    }

    // Apply current filter values to fetch the list
    const params = new URLSearchParams();
    if ($('#searchOrder').value) params.set('q', $('#searchOrder').value);
    if ($('#filterChannel').value) params.set('channel', $('#filterChannel').value);
    if ($('#filterStatus').value) params.set('status', $('#filterStatus').value);

    let res;
    try {
      res = await API.get('/orders?' + params.toString());
    } catch (err) {
      if (isInitial) throw err;
      return;
    }
    const rows = res.data || res;

    // Detect new orders against last poll's snapshot
    const newOrders = isInitial ? [] : rows.filter(o => !ordersLastSeenIds.has(o.id));
    if (newOrders.length > 0) {
      toast(`🆕 ${newOrders.length} new order(s) in this view`, 'success');
    }
    ordersLastSeenIds = new Set(rows.map(o => o.id));
    ordersLastFetch = new Date();

    $('#orderTable').innerHTML = `<table class="data">
      <thead><tr><th>Order #</th><th>Time</th><th>Channel</th><th>Customer</th><th>Items</th><th class="text-right">Total</th><th>Status</th><th>Kitchen</th><th></th></tr></thead>
      <tbody>
        ${rows.map(o => {
          const isNew = newOrders.some(n => n.id === o.id);
          return `<tr class="${isNew?'kds-new':''}" style="${o.status==='pending_payment'?'background:#fef3c7':''}">
            <td><b>${o.order_no}</b> ${isNew?'<span class="badge badge-success" style="margin-left:4px">NEW</span>':''}</td>
            <td>${fmtDate(o.created_at)}</td>
            <td><span class="badge badge-${o.channel==='pos'?'info':o.channel==='qr'?'purple':'success'}">${o.channel.toUpperCase()}</span></td>
            <td>${o.customer_name||'-'}</td>
            <td>${o.items?.length||0}</td>
            <td class="text-right"><b>${money(o.total)}</b></td>
            <td><span class="badge badge-${o.status==='completed'?'success':o.status==='refunded'?'danger':'warn'}">${o.status==='pending_payment'?'⏳ Pending Payment':o.status}</span></td>
            <td><span class="badge badge-${o.kitchen_status==='completed'?'success':'warn'}">${o.kitchen_status||'—'}</span></td>
            <td>
              ${o.status==='pending_payment'?`<button class="btn sm primary" onclick="app.takePayment(${o.id})">💳 Take Payment</button>`:''}
              <button class="btn sm" onclick="app.viewOrder(${o.id})">View</button>
            </td>
          </tr>`;
        }).join('') || '<tr><td colspan="9" class="text-center text-muted">No orders</td></tr>'}
      </tbody></table>`;
  }

  await render(true);

  // Filter inputs trigger an immediate render (don't wait for poll)
  ['searchOrder','filterChannel','filterStatus'].forEach(id => {
    $('#'+id).addEventListener('input', () => render(false));
  });

  // Background polling
  ordersPollTimer = setInterval(() => render(false), ORDERS_POLL_MS);

  // "Last updated" ticker
  ordersTickTimer = setInterval(() => {
    const el = $('#ordersUpdated');
    if (!el || !ordersLastFetch) return;
    const secs = Math.floor((Date.now() - ordersLastFetch.getTime()) / 1000);
    el.textContent = secs < 2 ? 'just now' : `${secs}s ago`;
  }, 1000);
};

async function viewOrderDetail(orderId) {
  try {
    const o =
      await API.get(
        '/orders/' + orderId
      );

    const isPending =
      o.status ===
      'pending_payment';

    openModal(`
      <div class="modal-head">

        <div>
          <h3>
            Order ${o.order_no}
          </h3>

          <small class="text-muted">
            Order Details
          </small>
        </div>

        <button
          class="close-btn"
          onclick="closeModal()"
        >
          ×
        </button>

      </div>


      <div class="modal-body">

        <div class="alert alert-info">

          ${fmtDate(o.created_at)}

          ·

          ${o.channel.toUpperCase()}

          ${
            o.table_id
              ? ' · ' +
                (
                  o.table?.name ||
                  o.table_id
                )
              : ''
          }

          ${
            o.customer_name
              ? ' · ' +
                o.customer_name
              : ''
          }

        </div>


        ${
          isPending
            ? `
              <div class="alert alert-warn">

                <b>
                  ⏳ Awaiting payment
                  at counter
                </b>

                <br>

                Total due:

                <b>
                  ${money(o.total)}
                </b>

              </div>
            `
            : ''
        }


        <div class="card">

          <table class="data">

            <thead>
              <tr>
                <th>
                  Item
                </th>

                <th
                  class="text-right"
                >
                  Qty
                </th>

                <th
                  class="text-right"
                >
                  Price
                </th>

                <th
                  class="text-right"
                >
                  Subtotal
                </th>
              </tr>
            </thead>


            <tbody>

              ${
                o.items.map(
                  item => `
                    <tr>

                      <td>

                        <b>
                          ${item.name}
                        </b>

                        ${orderItemConfigHtml(
                          item
                        )}

                      </td>

                      <td
                        class="text-right"
                      >
                        ${item.qty}
                      </td>

                      <td
                        class="text-right"
                      >
                        ${money(
                          item.price
                        )}
                      </td>

                      <td
                        class="text-right"
                      >
                        <b>
                          ${money(
                            item.qty *
                            num(
                              item.price
                            )
                          )}
                        </b>
                      </td>

                    </tr>
                  `
                ).join('')
              }

            </tbody>


            <tfoot>

              <tr>
                <td
                  colspan="3"
                  class="text-right"
                >
                  Subtotal
                </td>

                <td
                  class="text-right"
                >
                  ${money(o.subtotal)}
                </td>
              </tr>


              ${
                num(o.discount) > 0
                  ? `
                    <tr>

                      <td
                        colspan="3"
                        class="text-right"
                      >
                        Discount
                      </td>

                      <td
                        class="text-right"
                      >
                        -${money(
                          o.discount
                        )}
                      </td>

                    </tr>
                  `
                  : ''
              }


              <tr>

                <td
                  colspan="3"
                  class="text-right"
                >
                  Tax
                </td>

                <td
                  class="text-right"
                >
                  ${money(o.tax)}
                </td>

              </tr>


              <tr>

                <td
                  colspan="3"
                  class="text-right"
                >
                  <b>
                    Total
                  </b>
                </td>

                <td
                  class="text-right"
                >
                  <b>
                    ${money(o.total)}
                  </b>
                </td>

              </tr>

            </tfoot>

          </table>

        </div>


        <p class="mt-3">

          Status:

          <span
            class="
              badge
              badge-${
                o.status === 'completed'
                  ? 'success'
                  : o.status ===
                    'refunded'
                    ? 'danger'
                    : 'warn'
              }
            "
          >
            ${o.status}
          </span>

          · Kitchen:

          <span class="badge">
            ${o.kitchen_status || '—'}
          </span>

        </p>


        ${
          o.payment
            ? `
              <p>

                Paid by:

                <b>
                  ${o.payment.method
                    .toUpperCase()}
                </b>

                ·

                ${
                  o.payment.reference ||
                  ''
                }

              </p>
            `
            : ''
        }


        ${
          o.notes
            ? `
              <p class="text-muted">

                <b>
                  Notes:
                </b>

                ${o.notes}

              </p>
            `
            : ''
        }

      </div>


      <div class="modal-foot">

        ${
          isPending
            ? `
              <button
                class="btn primary lg"
                onclick="
                  app.takePayment(
                    ${o.id}
                  )
                "
              >
                💳 Take Payment
              </button>
            `
            : ''
        }

        ${
          !isPending &&
          o.payment
            ? `
              <button
                class="btn"
                onclick="app.reprintReceipt(${o.id})"
              >
                🖨 Reprint Receipt
              </button>
            `
            : ''
        }


        ${
          o.status === 'completed'
            ? `
              <button
                class="btn danger"
                onclick="
                  app.initRefund(
                    ${o.id}
                  )
                "
              >
                ↩ Refund
              </button>
            `
            : ''
        }


        <button
          class="btn"
          onclick="closeModal()"
        >
          Close
        </button>

      </div>
    `, {
      size: 'lg'
    });

  }
  catch (err) {
    toast(
      'Could not load order',
      'error'
    );
  }
}

async function takePaymentForOrder(orderId) {
  closeModal();
  const o = await API.get('/orders/' + orderId);
  if (o.status !== 'pending_payment') {
    toast('Order is not pending payment.', 'warn');
    return;
  }
  const total = num(o.total);
  openModal(`
    <div class="modal-head">
      <h3>💳 Take Payment — ${o.order_no}</h3>
      <button class="close-btn" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="alert alert-info">

        Customer:

        <b>
          ${o.customer_name || 'Walk-in'}
        </b>

        ${
          o.table_id
            ? ' · Table ' +
              (
                o.table?.name ||
                o.table_id
              )
            : ''
        }

        ·

        ${o.items.length}
        item(s)

      </div>


      <div
        class="card"
        style="
          margin-bottom:16px;
        "
      >

        <div
          class="section-title"
          style="
            margin-bottom:10px;
          "
        >
          Order Preview
        </div>


        <div
          style="
            display:flex;
            flex-direction:column;
            gap:10px;
          "
        >

          ${
            o.items.map(
              item => `
                <div
                  style="
                    border-bottom:
                      1px solid
                      var(--border);
                    padding-bottom:10px;
                  "
                >

                  <div
                    style="
                      display:flex;
                      justify-content:
                        space-between;
                      gap:12px;
                      align-items:flex-start;
                    "
                  >

                    <div>

                      <b>
                        ${item.qty} ×
                        ${item.name}
                      </b>

                      ${orderItemConfigHtml(
                        item
                      )}

                    </div>


                    <div
                      style="
                        text-align:right;
                        white-space:nowrap;
                      "
                    >

                      <b>
                        ${money(
                          num(item.price) *
                          item.qty
                        )}
                      </b>

                      ${
                        item.qty > 1
                          ? `
                            <div
                              class="text-muted"
                              style="
                                font-size:11px;
                                margin-top:3px;
                              "
                            >
                              ${money(
                                item.price
                              )}
                              each
                            </div>
                          `
                          : ''
                      }

                    </div>

                  </div>

                </div>
              `
            ).join('')
          }

        </div>

      </div>


      <div
        style="
          text-align:center;
          font-size:28px;
          font-weight:800;
          color:#064e3b;
          margin:18px 0;
        "
      >
        Total Due:
        ${money(total)}
      </div>
      <div class="section-title">Payment Method</div>
      <div class="payment-grid">
        <div class="pay-option active" data-m="cash"><span class="ico">💵</span><span class="label">Cash</span></div>
        <div class="pay-option" data-m="card"><span class="ico">💳</span><span class="label">Card</span></div>
        <div class="pay-option" data-m="ewallet"><span class="ico">📱</span><span class="label">E-Wallet</span></div>
        <div class="pay-option" data-m="qr"><span class="ico">📷</span><span class="label">QR Pay</span></div>
      </div>
      <div id="cashSection2">
        <div class="section-title">Amount Received</div>
        <input type="number" id="amtRcv2" class="search" style="font-size:18px;padding:14px" value="${total.toFixed(2)}" step="0.01">
        <div class="alert alert-info mt-3" style="font-size:15px">Change: <b id="changeAmt2">${state.meta.currency} 0.00</b></div>
      </div>

      <div id="qrSection2" style="display:none">
        <div class="section-title">DuitNow QR — Show this to the customer</div>
        <div class="qr-pay-card" id="qrPayCard">
          <div class="qr-pay-loading">Generating QR…</div>
        </div>
        <div class="alert alert-warn mt-3" style="font-size:13px">
          <b>Verify before confirming:</b> Check your bank app notification for
          <b id="qrVerifyAmt">${money(total)}</b> with reference <code id="qrVerifyRef">${o.order_no}</code>,
          then click <b>Confirm Payment</b> below.
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary lg" id="confirmTakePay">✓ Confirm Payment</button>
    </div>`, {size: 'lg'});

  let method = 'cash';
  let qrLoaded = false;

  async function ensureQrLoaded() {
    if (qrLoaded) return;
    try {
      const data = await API.get(`/orders/${o.id}/duitnow-qr`);
      const card = $('#qrPayCard');
      card.innerHTML = `
        <div class="qr-pay-amount">
          <div class="lbl">Amount</div>
          <div class="val">${money(data.amount)}</div>
        </div>
        <canvas id="qrCanvas" width="240" height="240"></canvas>
        <div class="qr-pay-meta">
          <div><span>Merchant</span><b>${data.merchant_name}</b></div>
          <div><span>Reference</span><b>${data.order_no}</b></div>
          <div class="text-muted" style="font-size:11px;margin-top:6px">Powered by DuitNow QR · scan with any Malaysian banking app</div>
        </div>`;
      // Render the QR onto the canvas
      // eslint-disable-next-line no-undef
      new QRious({
        element: document.getElementById('qrCanvas'),
        value: data.payload,
        size: 240,
        level: 'M',
        background: '#ffffff',
        foreground: '#064e3b',
      });
      qrLoaded = true;
    } catch (err) {
      $('#qrPayCard').innerHTML = `<div class="alert alert-danger" style="margin:0">
        Could not generate QR: ${err.payload?.message || err.message}
      </div>`;
    }
  }

  $$('.pay-option').forEach(opt => opt.addEventListener('click', () => {
    $$('.pay-option').forEach(x => x.classList.remove('active'));
    opt.classList.add('active');
    method = opt.dataset.m;
    $('#cashSection2').style.display = method === 'cash' ? 'block' : 'none';
    $('#qrSection2').style.display   = method === 'qr'   ? 'block' : 'none';
    if (method === 'qr') ensureQrLoaded();
  }));
  $('#amtRcv2').addEventListener('input', e => {
    const change = +e.target.value - total;
    $('#changeAmt2').textContent = state.meta.currency + ' ' + Math.max(0, change).toFixed(2);
  });
  $('#confirmTakePay').addEventListener('click', async () => {
    let amountReceived = null;

    if (method === 'cash') {
      amountReceived =
        +$('#amtRcv2').value;

      if (amountReceived < total) {
        toast(
          'Insufficient amount',
          'error'
        );

        return;
      }
    }

    const btn =
      $('#confirmTakePay');

    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
      /*
      * IMPORTANT:
      * Payment is completed FIRST.
      */
      const order =
        await API.post(
          `/orders/${o.id}/payment`,
          { method }
        );

      toast(
        `Payment received: ` +
        `${method.toUpperCase()} ` +
        `${money(total)}`
      );

      closeModal();

      /*
      * Existing browser receipt.
      */
      showCounterReceipt(
        order,
        method
      );

      /*
      * Android hardware receipt.
      *
      * Printing happens only AFTER
      * successful payment.
      */
      printAndroidReceipt(
        order,
        method,
        amountReceived
      );

      /*
      * Refresh customer cache.
      * Loyalty may have changed.
      */
      state.customers =
        await API.get('/customers');

    } catch (err) {
      btn.disabled = false;
      btn.textContent =
        '✓ Confirm Payment';

      toast(
        err.payload?.message ||
        'Payment failed',
        'error'
      );
    }
  });
}

function showCounterReceipt(order, method) {
  const customer = state.customers.find(c => c.id === order.customer_id) || { name: order.customer_name };
  const html = `<div class="receipt" id="receipt">
    <div class="center"><h4>${state.meta.cafeName}</h4>
      <div style="font-size:11px">${state.meta.tagline}</div>
      <div style="font-size:11px">${state.meta.address}</div>
      <div style="font-size:11px">Tel: ${state.meta.phone}</div>
    </div>
    <div class="sep"></div>
    <div class="row"><span>Order:</span><b>${order.order_no}</b></div>
    <div class="row"><span>Date:</span><span>${fmtDate(order.created_at)}</span></div>
    <div class="row"><span>Cashier:</span><span>${currentUser.name}</span></div>
    <div class="row"><span>Channel:</span><span>${order.channel.toUpperCase()}</span></div>
    ${order.table_id?`<div class="row"><span>Table:</span><span>${state.tables.find(t=>t.id===order.table_id)?.name||''}</span></div>`:''}
    <div class="row"><span>Customer:</span><span>${customer.name}</span></div>
    <div class="sep"></div>
    ${
      order.items.map(
        item => `
          <div
            style="
              margin-bottom:8px;
            "
          >

            <div class="item-row">

              <b>
                ${item.qty} ×
                ${item.name}
              </b>

              <span>
                ${money(
                  num(item.price) *
                  item.qty
                )}
              </span>

            </div>

            ${orderItemConfigHtml(
              item,
              {
                compact: true,
              }
            )}

            <div
              style="
                font-size:10px;
                color:#666;
                margin-top:2px;
              "
            >
              ${money(item.price)}
              each
            </div>

          </div>
        `
      ).join('')
    }
    <div class="sep"></div>
    <div class="row"><span>Subtotal</span><span>${state.meta.currency}${num(order.subtotal).toFixed(2)}</span></div>
    ${num(order.discount)>0?`<div class="row"><span>Discount</span><span>-${state.meta.currency}${num(order.discount).toFixed(2)}</span></div>`:''}
    <div class="row"><span>Tax</span><span>${state.meta.currency}${num(order.tax).toFixed(2)}</span></div>
    <div class="row"><b>TOTAL</b><b>${state.meta.currency}${num(order.total).toFixed(2)}</b></div>
    <div class="sep"></div>
    <div class="row"><span>Paid by:</span><span>${method.toUpperCase()}</span></div>
    <div class="sep"></div>
    <div class="center" style="font-size:11px">Thank you! Stay healthy 🌿</div>
  </div>`;
  openModal(`
    <div class="modal-head"><h3>🧾 Receipt — ${order.order_no}</h3>
      <button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">${html}</div>
    <div class="modal-foot">
      <button class="btn" onclick="window.print()">🖨 Print</button>
      <button class="btn primary" onclick="closeModal();app.route('orders')">Done</button>
    </div>`);
}

async function initRefund(orderId) {
  closeModal();
  const order = await API.get('/orders/' + orderId);
  openModal(`
    <div class="modal-head"><h3>Refund ${order.order_no}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="alert alert-warn">Refunding will reverse the order, restore inventory and reverse loyalty points. Total: <b>${money(order.total)}</b></div>
      <div class="field"><label>Reason</label><textarea id="refReason" rows="3" style="width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:10px;font-family:inherit">Customer request</textarea></div>
      <div class="field"><label>Refund Method</label><select id="refMethod"><option value="original">Original payment</option><option value="cash">Cash</option><option value="credit">Store credit</option></select></div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn danger" id="confirmRefund">✓ Approve Refund</button>
    </div>`);
  $('#confirmRefund').addEventListener('click', async () => {
    try {
      await API.post('/refunds', { order_id: order.id, reason: $('#refReason').value, method: $('#refMethod').value });
      toast('Refund processed', 'success');
      closeModal();
      if (currentRoute==='refund' || currentRoute==='orders') route(currentRoute);
    } catch (err) {
      toast(err.payload?.message || 'Refund failed', 'error');
    }
  });
}

/* ===== INVENTORY (full CRUD + adjust) ===== */
VIEWS.inventory = async (root) => {
  const [items, sups] = await Promise.all([API.get('/inventory'), API.get('/suppliers')]);
  state.suppliers = sups;
  const low = items.filter(i => num(i.stock) <= num(i.reorder_level));
  root.innerHTML = `
    ${low.length>0 ? `<div class="alert alert-warn"><b>⚠ Low Stock:</b> ${low.length} item(s) need replenishment.</div>` : ''}
    <div class="stat-row">
      <div class="stat-pill"><div class="ico">📦</div><div><div class="l">Total Items</div><div class="v">${items.length}</div></div></div>
      <div class="stat-pill"><div class="ico" style="background:#fee2e2;color:#991b1b">⚠</div><div><div class="l">Low Stock</div><div class="v">${low.length}</div></div></div>
      <div class="stat-pill"><div class="ico" style="background:#dbeafe;color:#1e40af">💰</div><div><div class="l">Inventory Value</div><div class="v">${money(items.reduce((s,i)=>s+num(i.stock)*num(i.cost_per_unit),0))}</div></div></div>
      <div style="flex:1"></div>
      <button class="btn" onclick="app.openStocktake()">📋 Stocktake</button>
      <button class="btn primary" onclick="app.openInventoryForm()">+ Add Item</button>
    </div>
    <div class="card">
      <table class="data">
        <thead><tr><th>Item</th><th>Unit</th><th class="text-right">Current</th><th class="text-right">Reorder</th><th class="text-right">Cost/Unit</th><th class="text-right">Value</th><th>Status</th><th></th></tr></thead>
        <tbody>${items.map(i=>{
          const isLow = num(i.stock) <= num(i.reorder_level);
          return `<tr>
            <td><b>${i.name}</b><div style="font-size:11px;color:#6b7280">${i.supplier?.name||'-'}</div></td>
            <td>${i.unit}</td>
            <td class="text-right"><b style="color:${isLow?'#dc2626':'#065f46'}">${i.stock}</b></td>
            <td class="text-right">${i.reorder_level}</td>
            <td class="text-right">${money(i.cost_per_unit)}</td>
            <td class="text-right">${money(num(i.stock)*num(i.cost_per_unit))}</td>
            <td>${isLow?'<span class="badge badge-danger">Low</span>':'<span class="badge badge-success">OK</span>'}</td>
            <td>
              ${
                isLow
                  ? `
                    <button
                      class="btn sm"
                      onclick="app.reorderInventory(${i.id})"
                    >
                      🛒 Reorder
                    </button>
                  `
                  : ''
              }

              <button
                class="btn sm primary"
                onclick="app.adjustStock(
                  ${i.id},
                  '${i.name.replace(/'/g,"\\'")}',
                  '${i.unit}'
                )"
              >
                Adjust
              </button>

              <button
                class="btn sm"
                onclick="app.openInventoryForm(${i.id})"
              >
                Edit
              </button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  state._inventoryCache = items;
};

async function openInventoryForm(id) {
  const isNew = !id;
  const items = state._inventoryCache || await API.get('/inventory');
  const i = isNew
    ? { name:'', unit:'pcs', stock: 0, reorder_level: 0, cost_per_unit: 0, supplier_id: state.suppliers[0]?.id }
    : items.find(x => x.id === id);
  openModal(`
    <div class="modal-head"><h3>${isNew?'New Inventory Item':'Edit Inventory Item'}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="field"><label>Name</label><input id="iName" value="${i.name}"></div>
        <div class="field"><label>Unit</label><input id="iUnit" value="${i.unit}"></div>
      </div>
      <div class="form-row three">
        ${isNew?`<div class="field"><label>Initial Stock</label><input id="iStock" type="number" step="0.01" value="${i.stock}"></div>`:''}
        <div class="field"><label>Reorder Level</label><input id="iReorder" type="number" step="0.01" value="${i.reorder_level}"></div>
        <div class="field"><label>Cost / Unit (RM)</label><input id="iCost" type="number" step="0.01" value="${i.cost_per_unit}"></div>
      </div>
      <div class="field"><label>Supplier</label><select id="iSupp">${state.suppliers.map(s=>`<option value="${s.id}" ${s.id===i.supplier_id?'selected':''}>${s.name}</option>`).join('')}</select></div>
      ${!isNew?'<div class="text-muted" style="font-size:12px;margin-top:8px">Tip: to change stock quantity, use the <b>Adjust</b> button instead — it leaves an audit trail.</div>':''}
    </div>
    <div class="modal-foot">
      ${!isNew?`<button class="btn danger" onclick="app.deleteInventory(${id})">🗑 Delete</button>`:''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="saveInv">${isNew?'Create':'Save'}</button>
    </div>`);
  $('#saveInv').addEventListener('click', async () => {
    const name = $('#iName').value.trim();
    if (!name) { toast('Name required', 'error'); return; }
    const body = {
      name,
      unit: $('#iUnit').value,
      reorder_level: +$('#iReorder').value,
      cost_per_unit: +$('#iCost').value,
      supplier_id: +$('#iSupp').value || null,
    };
    if (isNew) body.stock = +$('#iStock').value;
    try {
      if (isNew) await API.post('/inventory', body);
      else       await API.put('/inventory/' + id, body);
      toast('Saved'); closeModal(); route('inventory');
    } catch (err) {
      toast(err.payload?.message || 'Save failed', 'error');
    }
  });
}
async function deleteInventory(id) {
  if (!confirm('Soft-delete this inventory item?')) return;
  try { await API.delete('/inventory/' + id); toast('Deleted'); closeModal(); route('inventory'); }
  catch (err) { toast(err.payload?.message || 'Delete failed', 'error'); }
}

async function adjustStock(id, name, unit) {
  openModal(`
    <div class="modal-head"><h3>Adjust Stock: ${name}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="field"><label>Adjustment Type</label><select id="adjType"><option value="in">Stock In (+)</option><option value="out">Stock Out (−)</option><option value="set">Set Exact</option></select></div>
        <div class="field"><label>Quantity</label><input id="adjQty" type="number" step="0.01" value="0"></div>
      </div>
      <div class="field"><label>Reason</label><input id="adjReason" placeholder="e.g. Wastage, Count correction"></div>
    </div>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" id="confirmAdj">Apply</button></div>`);
  $('#confirmAdj').addEventListener('click', async () => {
    try {
      await API.post(`/inventory/${id}/adjust`, {
        type: $('#adjType').value, qty: +$('#adjQty').value,
        reason: $('#adjReason').value || 'Manual adjustment',
      });
      toast('Stock adjusted'); closeModal();
      if (currentRoute==='inventory') route('inventory');
    } catch (err) {
      toast(err.payload?.message || 'Adjust failed', 'error');
    }
  });
}

/* ===== STOCKTAKE (physical count reconciliation) ===== */
async function openStocktake() {
  const items = state._inventoryCache || await API.get('/inventory');
  if (!items.length) { toast('No inventory items yet', 'error'); return; }
  const rows = items.map(i => `
    <tr data-id="${i.id}">
      <td><b>${i.name}</b><div style="font-size:11px;color:#6b7280">${i.unit}</div></td>
      <td class="text-right" data-system>${num(i.stock).toFixed(2)}</td>
      <td><input class="stk-input" type="number" step="0.01" min="0" data-system="${i.stock}" style="width:90px;text-align:right" placeholder="—"></td>
      <td class="text-right" data-var>—</td>
    </tr>`).join('');

  openModal(`
    <div class="modal-head"><h3>📋 Stocktake — Physical Count</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="alert alert-info" style="font-size:12.5px">
        Enter the <b>physical count</b> for each item. Items left blank are skipped. The variance column shows how
        far off the system was — confirming will write adjustment movements for any item with a non-zero variance.
      </div>
      <div class="field">
        <label>Notes (optional)</label>
        <input id="stkNote" placeholder="e.g. End-of-day count, Saturday">
      </div>
      <div class="card" style="margin-top:8px;max-height:50vh;overflow:auto">
        <table class="data">
          <thead><tr><th>Item</th><th class="text-right">System</th><th class="text-right">Physical</th><th class="text-right">Variance</th></tr></thead>
          <tbody id="stkBody">${rows}</tbody>
        </table>
      </div>
      <div class="text-muted text-center mt-3" style="font-size:12px">
        <b id="stkSummary">No items counted yet.</b>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="stkSave" disabled>Apply Stocktake</button>
    </div>`, { size: 'lg' });

  function recomputeSummary() {
    let counted = 0, varSum = 0, posVar = 0, negVar = 0;
    $$('.stk-input').forEach(inp => {
      if (inp.value === '' || inp.value === null) return;
      counted++;
      const sys = parseFloat(inp.dataset.system);
      const phy = parseFloat(inp.value);
      const v = +(phy - sys).toFixed(2);
      varSum += v;
      if (v > 0) posVar += v;
      else if (v < 0) negVar += v;
      const cell = inp.closest('tr').querySelector('[data-var]');
      cell.innerHTML = v === 0
        ? '<span class="badge badge-success">0</span>'
        : v > 0
          ? `<span class="badge badge-info">+${v.toFixed(2)}</span>`
          : `<span class="badge badge-danger">${v.toFixed(2)}</span>`;
    });
    $('#stkSummary').textContent = counted === 0
      ? 'No items counted yet.'
      : `${counted} item(s) counted · Variance +${posVar.toFixed(2)} / ${negVar.toFixed(2)} (net ${varSum.toFixed(2)})`;
    $('#stkSave').disabled = counted === 0;
  }
  $('#stkBody').addEventListener('input', e => {
    if (e.target.classList.contains('stk-input')) recomputeSummary();
  });

  $('#stkSave').addEventListener('click', async () => {
    const counts = [];
    $$('.stk-input').forEach(inp => {
      if (inp.value === '' || inp.value === null) return;
      counts.push({
        inventory_item_id: +inp.closest('tr').dataset.id,
        physical_count: parseFloat(inp.value),
      });
    });
    if (!counts.length) { toast('Enter at least one physical count', 'error'); return; }
    if (!confirm(`Apply stocktake to ${counts.length} item(s)? This will adjust stock and write audit movements.`)) return;
    try {
      const res = await API.post('/inventory/stocktake', { note: $('#stkNote').value.trim() || null, counts });
      toast(`Stocktake complete — ${res.adjusted} item(s) adjusted`);
      closeModal();
      route('inventory');
    } catch (err) {
      toast(err.payload?.message || 'Stocktake failed', 'error');
    }
  });
}

/* ===== CUSTOMERS (full CRUD) ===== */
VIEWS.customer = async (root) => {
  const customers = await API.get('/customers');
  state.customers = customers;
  const tiers = state.loyaltyTiers;
  root.innerHTML = `
    <div class="stat-row">
      ${tiers.map(t=>{
        const cnt = customers.filter(c=>c.membership===t.name).length;
        return `<div class="stat-pill"><div class="ico" style="background:${t.name==='Platinum'?'#e0e7ff':t.name==='Gold'?'#fef3c7':t.name==='Silver'?'#f3f4f6':'#fde68a'};color:#000">${t.name==='Platinum'?'💎':t.name==='Gold'?'🥇':t.name==='Silver'?'🥈':'🥉'}</div><div><div class="l">${t.name}</div><div class="v">${cnt}</div></div></div>`;
      }).join('')}
      <div style="flex:1"></div>
      <button class="btn primary" onclick="app.openCustomerForm()">+ New Customer</button>
    </div>
    <div class="card">
      <div class="toolbar"><input class="search" id="custSearch" placeholder="🔍 Search customers..."></div>
      <div id="custTable"></div>
    </div>
    <div class="card">

      <div
        class="card-header"
        style="align-items:flex-start"
      >
        <div>
          <h3>
            Loyalty Tier Benefits
          </h3>

          <small>
            Membership levels are assigned automatically
            based on customer spending.
          </small>
        </div>

        <button
          class="btn primary sm"
          id="addLoyaltyTierBtn"
        >
          + Add Tier
        </button>
      </div>

      <div style="overflow-x:auto">

        <table class="data">

          <thead>
            <tr>
              <th>Tier</th>
              <th>Min Spend</th>
              <th>Discount</th>
              <th>Points</th>
              <th>Status</th>
              <th class="text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>

            ${tiers.map(t => `
              <tr>

                <td>
                  <b>${t.name}</b>

                  ${
                    t.name === 'Bronze'
                      ? `
                        <span
                          class="badge badge-bronze"
                          style="margin-left:6px"
                        >
                          Base
                        </span>
                      `
                      : ''
                  }
                </td>

                <td>
                  ${money(
                    num(t.minimum_spend)
                  )}
                </td>

                <td>
                  ${
                    num(
                      t.discount_percentage
                    ).toFixed(0)
                  }%
                </td>

                <td>
                  ${
                    num(
                      t.points_multiplier
                    ).toFixed(1)
                  }x
                </td>

                <td>
                  <span
                    class="badge ${
                      t.active
                        ? 'badge-success'
                        : 'badge-none'
                    }"
                  >
                    ${
                      t.active
                        ? 'Active'
                        : 'Inactive'
                    }
                  </span>
                </td>

                <td class="text-right">

                  <button
                    class="btn sm loyalty-edit-btn"
                    data-id="${t.id}"
                  >
                    Edit
                  </button>

                  ${
                    t.name !== 'Bronze'
                      ? `
                        <button
                          class="btn sm loyalty-toggle-btn"
                          data-id="${t.id}"
                        >
                          ${
                            t.active
                              ? 'Disable'
                              : 'Enable'
                          }
                        </button>

                        <button
                          class="btn sm danger loyalty-delete-btn"
                          data-id="${t.id}"
                        >
                          Delete
                        </button>
                      `
                      : ''
                  }

                </td>

              </tr>
            `).join('')}

          </tbody>

        </table>

      </div>

    </div>`;

    $('#addLoyaltyTierBtn')?.addEventListener(
      'click',
      () => openLoyaltyTierModal()
    );

    $$('.loyalty-edit-btn').forEach(btn => {
      btn.addEventListener(
        'click',
        () => {
          const tier = state.loyaltyTiers.find(
            t => String(t.id) === btn.dataset.id
          );

          if (tier) {
            openLoyaltyTierModal(tier);
          }
        }
      );
    });

    $$('.loyalty-toggle-btn').forEach(btn => {
      btn.addEventListener(
        'click',
        async () => {
          const tier = state.loyaltyTiers.find(
            t => String(t.id) === btn.dataset.id
          );

          if (!tier) {
            return;
          }

          try {
            await API.put(
              `/loyalty-tiers/${tier.id}`,
              {
                active: !tier.active,
              }
            );

            toast(
              `${tier.name} tier ${
                tier.active
                  ? 'disabled'
                  : 'enabled'
              }.`
            );

            await refreshLoyaltyTiers();

            route('customer');
          } catch (err) {
            showLoyaltyApiError(err);
          }
        }
      );
    });

    $$('.loyalty-delete-btn').forEach(btn => {
      btn.addEventListener(
        'click',
        async () => {
          const tier = state.loyaltyTiers.find(
            t => String(t.id) === btn.dataset.id
          );

          if (!tier) {
            return;
          }

          const confirmed = confirm(
            `Delete loyalty tier "${tier.name}"?\n\n` +
            'Existing customers will be automatically reassigned.'
          );

          if (!confirmed) {
            return;
          }

          try {
            await API.delete(
              `/loyalty-tiers/${tier.id}`
            );

            toast(
              `${tier.name} tier deleted.`
            );

            await refreshLoyaltyTiers();

            route('customer');
          } catch (err) {
            showLoyaltyApiError(err);
          }
        }
      );
    });
  const draw = () => {
    const q = $('#custSearch').value.toLowerCase();
    let rows = customers.filter(c=>c.id!==8);
    if (q) rows = rows.filter(c => c.name.toLowerCase().includes(q) || (c.phone||'').includes(q) || (c.email||'').toLowerCase().includes(q));
    $('#custTable').innerHTML = `<table class="data">
      <thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Tier</th><th class="text-right">Points</th><th class="text-right">Total Spent</th><th>Since</th><th></th></tr></thead>
      <tbody>${rows.map(c=>`<tr>
        <td><b>${c.name}</b></td>
        <td>${c.phone||'-'}</td>
        <td>${c.email||'-'}</td>
        <td><span class="badge badge-${c.membership.toLowerCase()}">${c.membership}</span></td>
        <td class="text-right"><b>${c.points}</b></td>
        <td class="text-right">${money(c.total_spent)}</td>
        <td>${c.joined_at||'-'}</td>
        <td><button class="btn sm" onclick="app.openCustomerForm(${c.id})">Edit</button></td>
      </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted">No customers</td></tr>'}</tbody>
    </table>`;
  };
  draw();
  $('#custSearch').addEventListener('input', draw);
};

async function openCustomerForm(
  id,
  options = {}
) {
  const isNew = !id;
  const c = isNew
    ? { name:'', phone:'', email:'', membership:'Bronze', points: 0 }
    : state.customers.find(x => x.id === id);
  openModal(`
    <div class="modal-head"><h3>${isNew?'New Customer':'Edit Customer'}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="field"><label>Name</label><input id="cName" value="${c.name}"></div>
      <div class="form-row">
        <div class="field"><label>Phone</label><input id="cPhone" value="${c.phone||''}"></div>
        <div class="field"><label>Email</label><input id="cEmail" type="email" value="${c.email||''}"></div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Tier</label>

          <select id="cTier">
            ${state.loyaltyTiers
              .filter(function (t) {
                return (
                  t.active ||
                  t.name === c.membership
                );
              })
              .map(function (t) {
                return `
                  <option
                    value="${t.name}"
                    ${
                      t.name === c.membership
                        ? 'selected'
                        : ''
                    }
                  >
                    ${t.name}
                  </option>
                `;
              })
              .join('')}
          </select>
        </div>
        <div class="field"><label>Points</label><input id="cPts" type="number" value="${c.points}"></div>
      </div>
    </div>
    <div class="modal-foot">
      ${!isNew?`<button class="btn danger" onclick="app.deleteCustomer(${id})">🗑 Delete</button>`:''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="saveCust">${isNew?'Create':'Save'}</button>
    </div>`);
  $('#saveCust').addEventListener('click', async () => {
    const name = $('#cName').value.trim();
    if (!name) { toast('Name required', 'error'); return; }
    const body = { name, phone: $('#cPhone').value, email: $('#cEmail').value, membership: $('#cTier').value, points: +$('#cPts').value };
    try {
      let savedCustomer;

      if (isNew) {
        savedCustomer =
          await API.post(
            '/customers',
            body
          );
      }
      else {
        savedCustomer =
          await API.put(
            '/customers/' + id,
            body
          );
      }

      state.customers =
        await API.get(
          '/customers'
        );

      toast('Saved');

      closeModal();

      if (
        options.returnToPos &&
        isNew &&
        savedCustomer?.id
      ) {
        pos.customerId =
          Number(savedCustomer.id);

        clearAppliedPromo();

        VIEWS.pos(
          $('#content')
        );

        return;
      }

      route('customer');
    }
    catch (err) {
      toast(err.payload?.message || 'Save failed', 'error');
    }
  });
}
async function deleteCustomer(id) {
  if (!confirm('Soft-delete this customer?')) return;
  try { await API.delete('/customers/' + id); toast('Deleted'); closeModal(); route('customer'); }
  catch (err) { toast(err.payload?.message || 'Delete failed', 'error'); }
}

async function refreshLoyaltyTiers() {
  state.loyaltyTiers =
    await API.get(
      '/loyalty-tiers'
    );
}

function showLoyaltyApiError(err) {
  console.error(
    'Loyalty tier error:',
    err
  );

  if (
    err.payload &&
    err.payload.errors
  ) {
    const firstError =
      Object.values(
        err.payload.errors
      )
        .flat()
        .find(Boolean);

    toast(
      firstError ||
      err.message ||
      'Unable to save loyalty tier.',
      'error'
    );

    return;
  }

  toast(
    err.message ||
    'Unable to process loyalty tier.',
    'error'
  );
}

function openLoyaltyTierModal(
  tier = null
) {
  const editing = !!tier;

  const isBronze =
    tier?.name === 'Bronze';

  openModal(`
    <div class="modal-head">
      <div>
        <h3>
          ${
            editing
              ? 'Edit Loyalty Tier'
              : 'Add Loyalty Tier'
          }
        </h3>

        <small class="text-muted">
          Configure spending threshold,
          discount and points multiplier.
        </small>
      </div>

      <button
        type="button"
        class="btn sm"
        id="closeLoyaltyTierModal"
      >
        ✕
      </button>
    </div>

    <form id="loyaltyTierForm">

      <div class="modal-body">

        <div class="field">
          <label>
            Tier Name
          </label>

          <input
            type="text"
            id="loyaltyTierName"
            value="${tier?.name ?? ''}"
            maxlength="100"
            ${isBronze ? 'disabled' : ''}
            required
          >
        </div>

        <div class="grid-2">

          <div class="field">
            <label>
              Minimum Spend (RM)
            </label>

            <input
              type="number"
              id="loyaltyTierMinSpend"
              min="0"
              step="0.01"
              value="${
                tier?.minimum_spend ?? 0
              }"
              ${isBronze ? 'disabled' : ''}
              required
            >
          </div>

          <div class="field">
            <label>
              Discount (%)
            </label>

            <input
              type="number"
              id="loyaltyTierDiscount"
              min="0"
              max="100"
              step="0.01"
              value="${
                tier?.discount_percentage ?? 0
              }"
              required
            >
          </div>

        </div>

        <div class="grid-2">

          <div class="field">
            <label>
              Points Multiplier
            </label>

            <input
              type="number"
              id="loyaltyTierMultiplier"
              min="0"
              step="0.01"
              value="${
                tier?.points_multiplier ?? 1
              }"
              required
            >

            <small class="text-muted">
              Example: 1.5 means 1.5x points.
            </small>
          </div>

          <div class="field">
            <label>
              Sort Order
            </label>

            <input
              type="number"
              id="loyaltyTierSort"
              min="0"
              step="1"
              value="${
                tier?.sort_order ??
                state.loyaltyTiers.length + 1
              }"
            >
          </div>

        </div>

        <div class="field">
          <label
            style="
              display:flex;
              align-items:center;
              gap:8px;
            "
          >
            <input
              type="checkbox"
              id="loyaltyTierActive"
              style="width:auto"
              ${
                tier
                  ? (
                      tier.active
                        ? 'checked'
                        : ''
                    )
                  : 'checked'
              }
              ${isBronze ? 'disabled' : ''}
            >

            Active Tier
          </label>

          ${
            isBronze
              ? `
                <small class="text-muted">
                  Bronze is the base tier and must remain active at RM0.
                </small>
              `
              : ''
          }
        </div>

      </div>

      <div class="modal-foot">

        <button
          type="button"
          class="btn"
          id="cancelLoyaltyTierBtn"
        >
          Cancel
        </button>

        <button
          type="submit"
          class="btn primary"
          id="saveLoyaltyTierBtn"
        >
          ${
            editing
              ? 'Save Changes'
              : 'Create Tier'
          }
        </button>

      </div>

    </form>
  `);

  $('#closeLoyaltyTierModal')
    ?.addEventListener(
      'click',
      closeModal
    );

  $('#cancelLoyaltyTierBtn')
    ?.addEventListener(
      'click',
      closeModal
    );

  $('#loyaltyTierForm')
    ?.addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        const saveBtn =
          $('#saveLoyaltyTierBtn');

        saveBtn.disabled = true;

        const payload = {
          name: isBronze
            ? 'Bronze'
            : $('#loyaltyTierName')
                .value
                .trim(),

          minimum_spend: isBronze
            ? 0
            : num(
                $('#loyaltyTierMinSpend')
                  .value
              ),

          discount_percentage:
            num(
              $('#loyaltyTierDiscount')
                .value
            ),

          points_multiplier:
            num(
              $('#loyaltyTierMultiplier')
                .value
            ),

          active: isBronze
            ? true
            : $('#loyaltyTierActive')
                .checked,

          sort_order:
            parseInt(
              $('#loyaltyTierSort')
                .value || 0,
              10
            ),
        };

        try {
          if (editing) {
            await API.put(
              `/loyalty-tiers/${tier.id}`,
              payload
            );

            toast(
              `${tier.name} tier updated.`
            );
          } else {
            await API.post(
              '/loyalty-tiers',
              payload
            );

            toast(
              `${payload.name} tier created.`
            );
          }

          await refreshLoyaltyTiers();

          closeModal();

          route('customer');

        } catch (err) {
          showLoyaltyApiError(err);

          saveBtn.disabled =
            false;
        }
      }
    );
}

/* ===== AUDIT ===== */
VIEWS.audit = async (root) => {
  const logs = await API.get('/reports/audit?limit=200');
  root.innerHTML = `
    <div class="card">
      <table class="data">
        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>${logs.map(a=>`<tr>
          <td>${fmtDate(a.created_at)}</td>
          <td><b>${a.username}</b></td>
          <td><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:11px">${a.action}</code></td>
          <td>${a.details||''}</td>
        </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">No entries</td></tr>'}</tbody>
      </table>
    </div>`;
};

/* ===== REPORTS ===== */
VIEWS.reports = async (root) => {
  root.innerHTML = `
    <div class="toolbar">
      <div class="field" style="margin:0"><label style="font-size:11px">From</label><input type="date" id="dateFrom" value="${new Date(Date.now()-30*86400000).toISOString().split('T')[0]}"></div>
      <div class="field" style="margin:0"><label style="font-size:11px">To</label><input type="date" id="dateTo" value="${new Date().toISOString().split('T')[0]}"></div>
      <button class="btn primary" id="applyDate">Apply</button>
      <button class="btn" id="exportCsv">⬇ Export CSV</button>
    </div>
    <div id="reportBody"></div>`;

  $('#exportCsv').addEventListener('click', async () => {
    const from = $('#dateFrom').value, to = $('#dateTo').value;
    const btn = $('#exportCsv'); btn.disabled = true; btn.textContent = 'Exporting…';
    try {
      // Fetch with auth header, then trigger browser download from blob.
      const res = await fetch(`/api/reports/sales.csv?from=${from}&to=${to}`, {
        headers: { 'Authorization': 'Bearer ' + API.token() }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `wellness_cafe_sales_${from}_to_${to}.csv`;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      toast('CSV exported');
    } catch (err) {
      toast('Export failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '⬇ Export CSV';
    }
  });

  async function load() {
    const from = $('#dateFrom').value, to = $('#dateTo').value;
    const r = await API.get(`/reports/sales?from=${from}&to=${to}`);
    $('#reportBody').innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><div class="label">Revenue</div><div class="value">${money(r.revenue)}</div><div class="delta">${r.orders} orders</div></div>
        <div class="kpi amber"><div class="label">Profit</div><div class="value">${money(r.profit)}</div><div class="delta">${r.margin_pct}% margin</div></div>
        <div class="kpi blue"><div class="label">Tax</div><div class="value">${money(r.tax)}</div><div class="delta">SST 6%</div></div>
        <div class="kpi rose"><div class="label">Avg Order</div><div class="value">${money(r.avg_order)}</div><div class="delta">per transaction</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-header"><h3>Top Products</h3></div>
          <table class="data"><thead><tr><th>#</th><th>Product</th><th class="text-right">Units</th><th class="text-right">Revenue</th></tr></thead>
            <tbody>${r.top_products.map((p,i)=>`<tr><td>${i+1}</td><td>${p.name}</td><td class="text-right">${p.units}</td><td class="text-right">${money(p.revenue)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">No data</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card"><div class="card-header"><h3>By Category</h3></div>
          <table class="data"><thead><tr><th>Category</th><th class="text-right">Revenue</th></tr></thead>
            <tbody>${r.by_category.map(c=>`<tr><td>${c.name}</td><td class="text-right">${money(c.revenue)}</td></tr>`).join('') || '<tr><td colspan="2" class="text-center text-muted">No data</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  }
  await load();
  $('#applyDate').addEventListener('click', load);
};

/* ===== MENU & PRODUCTS V2 ===== */
VIEWS.menu = async (root) => {
  const [
    cats,
    prods,
    addons,
  ] = await Promise.all([
    API.get('/categories'),
    API.get('/products'),
    API.get('/addons'),
  ]);

  state.categories = cats;

  state.products = prods.map(p => ({
    ...p,
    price: num(p.price),
    cost: num(p.cost),

    variants: (p.variants || []).map(v => ({
      ...v,
      price: num(v.price),
    })),

    addons: p.addons || [],
    option_groups: p.option_groups || [],
  }));

  state.addons = addons.map(a => ({
    ...a,
    price: num(a.price),
  }));

  root.innerHTML = `
    <div class="tabs">
      <button
        class="tab active"
        data-tab="prod"
      >
        Products (${prods.length})
      </button>

      <button
        class="tab"
        data-tab="cat"
      >
        Categories (${cats.length})
      </button>

      <button
        class="tab"
        data-tab="addon"
      >
        ⚡ Boost It Up! (${addons.length})
      </button>
    </div>

    <div id="menuBody"></div>
  `;

  $$('.tabs .tab').forEach(tab => {
    tab.addEventListener(
      'click',
      () => {
        $$('.tabs .tab').forEach(x =>
          x.classList.remove('active')
        );

        tab.classList.add('active');

        renderTab(tab.dataset.tab);
      }
    );
  });

  renderTab('prod');

  function productPriceLabel(product) {
    if (
      product.product_type !==
      'configurable'
    ) {
      return money(product.price);
    }

    const availablePrices =
      (product.variants || [])
        .filter(v => v.available)
        .map(v => num(v.price));

    if (!availablePrices.length) {
      return '—';
    }

    return (
      'From ' +
      money(
        Math.min(...availablePrices)
      )
    );
  }

  function productStatus(product) {
    if (!product.visible) {
      return {
        label: 'Hidden',
        className: 'badge-none',
      };
    }

    if (!product.available) {
      return {
        label: 'Sold Out',
        className: 'badge-danger',
      };
    }

    if (
      product.product_type ===
      'configurable'
    ) {
      const availableVariant =
        (product.variants || [])
          .some(v => v.available);

      if (!availableVariant) {
        return {
          label: 'Sold Out',
          className: 'badge-danger',
        };
      }
    }

    return {
      label: 'Available',
      className: 'badge-success',
    };
  }

  function renderTab(tab) {
    const body = $('#menuBody');

    if (tab === 'prod') {
      renderProductsTab(body);
      return;
    }

    if (tab === 'cat') {
      renderCategoriesTab(body);
      return;
    }

    renderAddonsTab(body);
  }

  function renderProductsTab(body) {
    body.innerHTML = `
      <div class="toolbar">
        <input
          class="search"
          id="prodSearch"
          placeholder="🔍 Search products"
        >

        <select id="prodCat">
          <option value="">
            All categories
          </option>

          ${cats.map(c => `
            <option value="${c.id}">
              ${c.icon || '🍽️'} ${c.name}
            </option>
          `).join('')}
        </select>

        <select id="prodType">
          <option value="">
            All product types
          </option>

          <option value="simple">
            Simple
          </option>

          <option value="configurable">
            Configurable
          </option>
        </select>

        <button
          class="btn primary"
          onclick="app.openProductForm()"
        >
          + Add Product
        </button>
      </div>

      <div class="card">
        <div id="prodTable"></div>
      </div>
    `;

    const draw = () => {
      const q =
        $('#prodSearch')
          .value
          .trim()
          .toLowerCase();

      const category =
        $('#prodCat').value;

      const type =
        $('#prodType').value;

      let rows =
        state.products.slice();

      if (q) {
        rows = rows.filter(p =>
          p.name
            .toLowerCase()
            .includes(q)
        );
      }

      if (category) {
        rows = rows.filter(
          p =>
            p.category_id ===
            Number(category)
        );
      }

      if (type) {
        rows = rows.filter(
          p => p.product_type === type
        );
      }

      $('#prodTable').innerHTML = `
        <table class="data">
          <thead>
            <tr>
              <th></th>

              <th>
                Product
              </th>

              <th>
                Category
              </th>

              <th>
                Type
              </th>

              <th>
                Options / Variants
              </th>

              <th class="text-right">
                Selling Price
              </th>

              <th>
                Customer Menu
              </th>

              <th></th>
            </tr>
          </thead>

          <tbody>
            ${
              rows.map(p => {
                const cat =
                  cats.find(
                    c =>
                      c.id ===
                      p.category_id
                  );

                const status =
                  productStatus(p);

                const variantCount =
                  (p.variants || [])
                    .length;

                const optionCount =
                  (p.option_groups || [])
                    .length;

                const visual =
                  p.image_url
                    ? `
                      <img
                        src="${p.image_url}"
                        style="
                          width:44px;
                          height:44px;
                          border-radius:8px;
                          object-fit:cover;
                        "
                      >
                    `
                    : `
                      <span
                        style="font-size:26px"
                      >
                        ${p.image || '🍽️'}
                      </span>
                    `;

                return `
                  <tr>
                    <td>
                      ${visual}
                    </td>

                    <td>
                      <b>
                        ${p.name}
                      </b>

                      ${
                        (p.addons || [])
                          .length
                          ? `
                            <div
                              class="text-muted"
                              style="
                                font-size:11px;
                                margin-top:3px;
                              "
                            >
                              ⚡ ${
                                p.addons.length
                              } add-on${
                                p.addons.length === 1
                                  ? ''
                                  : 's'
                              }
                            </div>
                          `
                          : ''
                      }
                    </td>

                    <td>
                      ${
                        cat
                          ? `
                            ${cat.icon || '🍽️'}
                            ${cat.name}
                          `
                          : '—'
                      }
                    </td>

                    <td>
                      ${
                        p.product_type ===
                        'configurable'
                          ? `
                            <span
                              class="
                                badge
                                badge-info
                              "
                            >
                              Configurable
                            </span>
                          `
                          : `
                            <span
                              class="
                                badge
                                badge-silver
                              "
                            >
                              Simple
                            </span>
                          `
                      }
                    </td>

                    <td>
                      ${
                        p.product_type ===
                        'configurable'
                          ? `
                            <b>
                              ${variantCount}
                              variant${
                                variantCount === 1
                                  ? ''
                                  : 's'
                              }
                            </b>

                            <div
                              class="text-muted"
                              style="
                                font-size:11px;
                                margin-top:3px;
                              "
                            >
                              ${optionCount}
                              option group${
                                optionCount === 1
                                  ? ''
                                  : 's'
                              }
                            </div>
                          `
                          : `
                            <span
                              class="text-muted"
                            >
                              —
                            </span>
                          `
                      }
                    </td>

                    <td class="text-right">
                      <b>
                        ${productPriceLabel(p)}
                      </b>
                    </td>

                    <td>
                      <span
                        class="
                          badge
                          ${status.className}
                        "
                      >
                        ${status.label}
                      </span>

                      ${
                        !p.visible
                          ? `
                            <div
                              class="text-muted"
                              style="
                                font-size:10px;
                                margin-top:3px;
                              "
                            >
                              Not shown to customers
                            </div>
                          `
                          : ''
                      }
                    </td>

                    <td>
                      <button
                        class="btn sm"
                        onclick="
                          app.openProductForm(
                            ${p.id}
                          )
                        "
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')
              ||
              `
                <tr>
                  <td
                    colspan="8"
                    class="
                      text-center
                      text-muted
                    "
                  >
                    No products found
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      `;
    };

    $('#prodSearch')
      .addEventListener(
        'input',
        draw
      );

    $('#prodCat')
      .addEventListener(
        'change',
        draw
      );

    $('#prodType')
      .addEventListener(
        'change',
        draw
      );

    draw();
  }

  function renderCategoriesTab(body) {
    body.innerHTML = `
      <div class="toolbar">
        <button
          class="btn primary"
          onclick="app.openCategoryForm()"
        >
          + Add Category
        </button>
      </div>

      <div class="card">
        <table class="data">
          <thead>
            <tr>
              <th>
                Icon
              </th>

              <th>
                Name
              </th>

              <th class="text-right">
                Sort
              </th>

              <th class="text-right">
                Products
              </th>

              <th></th>
            </tr>
          </thead>

          <tbody>
            ${cats.map(c => {
              const count =
                state.products.filter(
                  p =>
                    p.category_id === c.id
                ).length;

              return `
                <tr>
                  <td
                    style="font-size:24px"
                  >
                    ${c.icon || '🍽️'}
                  </td>

                  <td>
                    <b>
                      ${c.name}
                    </b>
                  </td>

                  <td class="text-right">
                    ${c.sort_order}
                  </td>

                  <td class="text-right">
                    ${count}
                  </td>

                  <td>
                    <button
                      class="btn sm"
                      onclick="
                        app.openCategoryForm(
                          ${c.id}
                        )
                      "
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAddonsTab(body) {
    body.innerHTML = `
      <div class="toolbar">
        <div
          style="flex:1"
        >
          <b>
            ⚡ Boost It Up!
          </b>

          <div
            class="text-muted"
            style="
              font-size:12px;
              margin-top:3px;
            "
          >
            Reusable extras that can be
            assigned to menu products.
          </div>
        </div>

        <button
          class="btn primary"
          onclick="app.openAddonForm()"
        >
          + Add Add-on
        </button>
      </div>

      <div class="card">
        <table class="data">
          <thead>
            <tr>
              <th>
                Add-on
              </th>

              <th class="text-right">
                Price
              </th>

              <th>
                Availability
              </th>

              <th class="text-right">
                Sort
              </th>

              <th></th>
            </tr>
          </thead>

          <tbody>
            ${
              state.addons.map(a => `
                <tr>
                  <td>
                    <b>
                      ${a.name}
                    </b>
                  </td>

                  <td class="text-right">
                    <b>
                      + ${money(a.price)}
                    </b>
                  </td>

                  <td>
                    <span
                      class="
                        badge
                        ${
                          a.available
                            ? 'badge-success'
                            : 'badge-danger'
                        }
                      "
                    >
                      ${
                        a.available
                          ? 'Available'
                          : 'Sold Out'
                      }
                    </span>
                  </td>

                  <td class="text-right">
                    ${a.sort_order}
                  </td>

                  <td>
                    <button
                      class="btn sm"
                      onclick="
                        app.openAddonForm(
                          ${a.id}
                        )
                      "
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              `).join('')
              ||
              `
                <tr>
                  <td
                    colspan="5"
                    class="
                      text-center
                      text-muted
                    "
                  >
                    No add-ons created yet.
                  </td>
                </tr>
              `
            }
          </tbody>
        </table>
      </div>
    `;
  }
};

async function openAddonForm(id) {
  const editing = Boolean(id);

  const addon = editing
    ? state.addons.find(
        a => a.id === id
      )
    : {
        name: '',
        price: 0,
        available: true,
        sort_order:
          state.addons.length + 1,
      };

  if (!addon) {
    toast(
      'Add-on not found.',
      'error'
    );

    return;
  }

  openModal(`
    <div class="modal-head">
      <div>
        <h3>
          ${
            editing
              ? 'Edit Add-on'
              : 'New Add-on'
          }
        </h3>

        <small class="text-muted">
          Boost It Up! menu option
        </small>
      </div>

      <button
        class="close-btn"
        onclick="closeModal()"
      >
        ×
      </button>
    </div>

    <div class="modal-body">

      <div class="field">
        <label>
          Add-on Name
        </label>

        <input
          id="addonName"
          value="${addon.name || ''}"
          placeholder="e.g. Extra Shot"
        >
      </div>

      <div class="form-row">

        <div class="field">
          <label>
            Additional Price (RM)
          </label>

          <input
            id="addonPrice"
            type="number"
            min="0"
            step="0.01"
            value="${num(addon.price)}"
          >
        </div>

        <div class="field">
          <label>
            Sort Order
          </label>

          <input
            id="addonSort"
            type="number"
            min="0"
            step="1"
            value="${addon.sort_order || 0}"
          >
        </div>

      </div>

      <div class="field">
        <label
          style="
            display:flex;
            align-items:center;
            gap:8px;
          "
        >
          <input
            id="addonAvailable"
            type="checkbox"
            style="width:auto"
            ${
              addon.available
                ? 'checked'
                : ''
            }
          >

          Available for ordering
        </label>

        <small class="text-muted">
          Turn this off when the add-on
          is temporarily sold out.
        </small>
      </div>

    </div>

    <div class="modal-foot">

      ${
        editing
          ? `
            <button
              class="btn danger"
              onclick="
                app.deleteAddon(
                  ${addon.id}
                )
              "
              style="margin-right:auto"
            >
              Delete
            </button>
          `
          : ''
      }

      <button
        class="btn"
        onclick="closeModal()"
      >
        Cancel
      </button>

      <button
        class="btn primary"
        id="saveAddon"
      >
        ${
          editing
            ? 'Save Changes'
            : 'Create Add-on'
        }
      </button>
    </div>
  `);

  $('#saveAddon')
    .addEventListener(
      'click',
      async () => {
        const name =
          $('#addonName')
            .value
            .trim();

        if (!name) {
          toast(
            'Add-on name is required.',
            'error'
          );

          return;
        }

        const payload = {
          name,

          price:
            Number(
              $('#addonPrice').value
            ),

          available:
            $('#addonAvailable')
              .checked,

          sort_order:
            Number(
              $('#addonSort').value
            ),
        };

        try {
          if (editing) {
            await API.put(
              '/addons/' + addon.id,
              payload
            );

            toast(
              'Add-on updated.'
            );
          } else {
            await API.post(
              '/addons',
              payload
            );

            toast(
              'Add-on created.'
            );
          }

          closeModal();

          route('menu');

        } catch (err) {
          const errors =
            err.payload?.errors;

          const message =
            errors
              ? Object.values(errors)
                  .flat()[0]
              : (
                  err.payload?.message ||
                  'Save failed'
                );

          toast(
            message,
            'error'
          );
        }
      }
    );
}

async function deleteAddon(id) {
  if (
    !confirm(
      'Delete this add-on?'
    )
  ) {
    return;
  }

  try {
    await API.delete(
      '/addons/' + id
    );

    toast(
      'Add-on deleted.'
    );

    closeModal();

    route('menu');

  } catch (err) {
    toast(
      err.payload?.message ||
      'Delete failed',
      'error'
    );
  }
}

async function openProductForm(id) {
  const isNew = !id;

  const cats = state.categories || [];

  let product = isNew
    ? {
        name: '',
        category_id: cats[0]?.id || null,
        price: 0,
        cost: 0,
        image: '🍽️',
        image_url: null,
        available: true,
        visible: true,
        product_type: 'simple',
        addons: [],
        option_groups: [],
        variants: [],
      }
    : await API.get(
        '/products/' + id
      );

  product.price =
    num(product.price);

  product.cost =
    num(product.cost);

  product.addons =
    product.addons || [];

  product.option_groups =
    product.option_groups || [];

  product.variants =
    product.variants || [];

  const selectedAddonIds =
    new Set(
      product.addons.map(
        addon => Number(addon.id)
      )
    );

  function draw() {
    const configurable =
      $('#productType')
        ?.value === 'configurable';

    const simplePriceSection =
      $('#simplePriceSection');

    const configurableNote =
      $('#configurablePriceNote');

    if (simplePriceSection) {
      simplePriceSection.style.display =
        configurable
          ? 'none'
          : '';
    }

    if (configurableNote) {
      configurableNote.style.display =
        configurable
          ? ''
          : 'none';
    }
  }

  openModal(`
    <div class="modal-head">
      <div>
        <h3>
          ${
            isNew
              ? 'New Product'
              : 'Edit Product'
          }
        </h3>

        <small class="text-muted">
          Menu V2 product configuration
        </small>
      </div>

      <button
        class="close-btn"
        onclick="closeModal()"
      >
        ×
      </button>
    </div>

    <div class="modal-body">

      <div class="form-section">

        <div class="form-section-title">
          Product Information
        </div>

        <div class="form-row">

          <div class="field">
            <label>
              Product Name
            </label>

            <input
              id="productName"
              value="${product.name || ''}"
              placeholder="e.g. Americano"
            >
          </div>


          <div class="field">
            <label>
              Category
            </label>

            <select id="productCategory">

              ${cats.map(category => `
                <option
                  value="${category.id}"
                  ${
                    Number(product.category_id) ===
                    Number(category.id)
                      ? 'selected'
                      : ''
                  }
                >
                  ${category.icon || '🍽️'}
                  ${category.name}
                </option>
              `).join('')}

            </select>
          </div>

        </div>


        <div class="form-row">

          <div class="field">
            <label>
              Product Type
            </label>

            <select id="productType">

              <option
                value="simple"
                ${
                  product.product_type ===
                  'simple'
                    ? 'selected'
                    : ''
                }
              >
                Simple Product
              </option>

              <option
                value="configurable"
                ${
                  product.product_type ===
                  'configurable'
                    ? 'selected'
                    : ''
                }
              >
                Configurable Product
              </option>

            </select>

            <small class="text-muted">
              Simple = one price.
              Configurable = options and variants.
            </small>
          </div>


          <div class="field">
            <label>
              Fallback Icon
            </label>

            <input
              id="productIcon"
              maxlength="8"
              value="${product.image || ''}"
              placeholder="☕"
            >

            <small class="text-muted">
              Used if no product image is uploaded.
            </small>
          </div>

        </div>


        <div class="form-section">

          <div class="form-section-title">
            Product Image
          </div>

          <div
            style="
              display:flex;
              gap:18px;
              align-items:flex-start;
              flex-wrap:wrap;
            "
          >

            <div
              id="productImagePreview"
              style="
                width:150px;
                height:150px;
                border:1px solid var(--border);
                border-radius:12px;
                background:#f7f7f5;
                display:flex;
                align-items:center;
                justify-content:center;
                overflow:hidden;
                flex-shrink:0;
              "
            >

              ${
                product.image_url
                  ? `
                    <img
                      src="${product.image_url}"
                      alt="${product.name || 'Product'}"
                      style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                      "
                    >
                  `
                  : `
                    <span
                      style="
                        font-size:54px;
                      "
                    >
                      ${product.image || '🍽️'}
                    </span>
                  `
              }

            </div>


            <div
              style="
                flex:1;
                min-width:220px;
              "
            >

              <div class="field">

                <label>
                  Upload Product Image
                </label>

                <input
                  type="file"
                  id="productImageFile"
                  accept="image/jpeg,image/png,image/webp"
                >

                <small class="text-muted">
                  JPG, PNG or WebP.
                  Image will be uploaded after
                  the product is saved.
                </small>

              </div>


              ${
                product.image_url
                  ? `
                    <button
                      type="button"
                      class="btn danger sm"
                      id="removeProductImage"
                    >
                      Remove Image
                    </button>
                  `
                  : ''
              }

            </div>

          </div>

        </div>

        <div class="form-row">

          <div class="field">
            <label>
              Product Type
            </label>

            <select id="productType">

              <option
                value="simple"
                ${
                  product.product_type ===
                  'simple'
                    ? 'selected'
                    : ''
                }
              >
                Simple Product
              </option>

              <option
                value="configurable"
                ${
                  product.product_type ===
                  'configurable'
                    ? 'selected'
                    : ''
                }
              >
                Configurable Product
              </option>

            </select>

            <small class="text-muted">
              Simple = one price.
              Configurable = options and variants.
            </small>
          </div>

          <div class="field">
            <label>
              Icon
            </label>

            <input
              id="productIcon"
              maxlength="8"
              value="${product.image || ''}"
              placeholder="☕"
            >
          </div>

        </div>

      </div>


      <div class="form-section">

        <div class="form-section-title">
          Pricing
        </div>

        <div id="simplePriceSection">

          <div class="form-row">

            <div class="field">
              <label>
                Selling Price (RM)
              </label>

              <input
                id="productPrice"
                type="number"
                min="0"
                step="0.01"
                value="${product.price}"
              >
            </div>

            <div class="field">
              <label>
                Cost (RM)
              </label>

              <input
                id="productCost"
                type="number"
                min="0"
                step="0.01"
                value="${product.cost}"
              >
            </div>

          </div>

        </div>

        <div
          id="configurablePriceNote"
          class="alert alert-info"
          style="display:none"
        >
          <b>Configurable product</b><br>

          Selling price will come from
          the product variants.

          Example:

          <br><br>

          Small RM4.50<br>
          Medium RM5.50<br>
          Iced RM6.00
        </div>

      </div>


      <div class="form-section">

        <div class="form-section-title">
          Customer Menu Status
        </div>

        <div class="check-grid">

          <label class="check-card">

            <input
              id="productVisible"
              type="checkbox"
              ${
                product.visible
                  ? 'checked'
                  : ''
              }
            >

            <span>
              <b>
                Visible
              </b>

              <small>
                Show this product on
                the customer menu.
              </small>
            </span>

          </label>


          <label class="check-card">

            <input
              id="productAvailable"
              type="checkbox"
              ${
                product.available
                  ? 'checked'
                  : ''
              }
            >

            <span>
              <b>
                Available
              </b>

              <small>
                Customers may order it.
                Turn off for Sold Out.
              </small>
            </span>

          </label>

        </div>

      </div>


      <div class="form-section">

        <div class="form-section-title">
          ⚡ Boost It Up!
        </div>

        <div class="text-muted"
          style="
            font-size:12px;
            margin-bottom:10px;
          "
        >
          Select which add-ons may be
          used with this product.
        </div>

        ${
          (state.addons || []).length
            ? `
              <div class="check-grid">

                ${state.addons.map(addon => `
                  <label class="check-card">

                    <input
                      type="checkbox"
                      class="productAddonCheck"
                      value="${addon.id}"
                      ${
                        selectedAddonIds.has(
                          Number(addon.id)
                        )
                          ? 'checked'
                          : ''
                      }
                    >

                    <span>

                      <b>
                        ${addon.name}
                      </b>

                      <small>
                        + ${money(addon.price)}
                      </small>

                    </span>

                  </label>
                `).join('')}

              </div>
            `
            : `
              <div
                class="text-muted"
              >
                No add-ons created yet.
              </div>
            `
        }

      </div>


      ${
        !isNew &&
        product.product_type ===
          'configurable'
          ? `
            <div class="form-section">

              <div class="form-section-title">
                Current Configuration
              </div>

              <div
                style="
                  display:grid;
                  grid-template-columns:
                    repeat(
                      auto-fit,
                      minmax(150px,1fr)
                    );
                  gap:10px;
                "
              >

                <div class="stat-pill">
                  <div>
                    <div class="l">
                      Option Groups
                    </div>

                    <div class="v">
                      ${
                        product
                          .option_groups
                          .length
                      }
                    </div>
                  </div>
                </div>

                <div class="stat-pill">
                  <div>
                    <div class="l">
                      Variants
                    </div>

                    <div class="v">
                      ${
                        product
                          .variants
                          .length
                      }
                    </div>
                  </div>
                </div>

              </div>

              <div
                class="text-muted"
                style="
                  font-size:12px;
                  margin-top:10px;
                "
              >
                Option groups and exact variant
                pricing are managed separately.

                <div style="margin-top:12px">
                  <button
                    type="button"
                    class="btn primary"
                    id="configureProductBtn"
                  >
                    ⚙ Configure Options & Variants
                  </button>
                </div>
              </div>

            </div>
          `
          : ''
      }

    </div>


    <div class="modal-foot">

      ${
        !isNew
          ? `
            <button
              class="btn danger"
              onclick="
                app.deleteProduct(
                  ${product.id}
                )
              "
              style="margin-right:auto"
            >
              Delete
            </button>
          `
          : ''
      }

      <button
        class="btn"
        onclick="closeModal()"
      >
        Cancel
      </button>

      <button
        class="btn primary"
        id="saveProduct"
      >
        ${
          isNew
            ? 'Create Product'
            : 'Save Changes'
        }
      </button>

    </div>
  `, {
    size: 'lg',
  });


  $('#productType')
    ?.addEventListener(
      'change',
      draw
    );

  draw();

  $('#configureProductBtn')
    ?.addEventListener(
      'click',
      () => {
        openProductConfigurator(
          product.id
        );
      }
    );

  const productImageInput =
    $('#productImageFile');

  productImageInput
    ?.addEventListener(
      'change',
      event => {

        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

        const preview =
          $('#productImagePreview');

        if (!preview) {
          return;
        }

        const url =
          URL.createObjectURL(file);

        preview.innerHTML = `
          <img
            src="${url}"
            alt="Preview"
            style="
              width:100%;
              height:100%;
              object-fit:cover;
            "
          >
        `;
      }
    );


  $('#removeProductImage')
    ?.addEventListener(
      'click',
      async () => {

        if (
          !confirm(
            'Remove this product image?'
          )
        ) {
          return;
        }

        try {

          await API.delete(
            '/products/' +
              product.id +
              '/image'
          );

          toast(
            'Product image removed.'
          );

          openProductForm(
            product.id
          );

        }
        catch (err) {

          toast(
            err.payload?.message ||
            'Could not remove image.',
            'error'
          );

        }
      }
    );

  $('#saveProduct')
    .addEventListener(
      'click',
      async () => {

        const name =
          $('#productName')
            .value
            .trim();

        if (!name) {
          toast(
            'Product name is required.',
            'error'
          );

          return;
        }

        const productType =
          $('#productType').value;

        const payload = {
          name,

          category_id:
            Number(
              $('#productCategory').value
            ),

          image:
            $('#productIcon')
              .value
              .trim() || null,

          product_type:
            productType,

          visible:
            $('#productVisible')
              .checked,

          available:
            $('#productAvailable')
              .checked,

          /*
           * Configurable products use
           * variant pricing.
           */
          price:
            productType ===
            'configurable'
              ? 0
              : Number(
                  $('#productPrice')
                    .value || 0
                ),

          cost:
            Number(
              $('#productCost')
                ?.value ||
              product.cost ||
              0
            ),
        };


        const addonIds =
          $$('.productAddonCheck:checked')
            .map(
              input =>
                Number(input.value)
            );


        const button =
          $('#saveProduct');

        button.disabled = true;

        button.textContent =
          'Saving...';


        try {
          let savedProduct;

          if (isNew) {
            savedProduct =
              await API.post(
                '/products',
                payload
              );
          } else {
            savedProduct =
              await API.put(
                '/products/' +
                product.id,
                payload
              );
          }

          const imageFile =
            $('#productImageFile')
              ?.files?.[0];

          if (imageFile) {

            if (
              imageFile.size >
              4 * 1024 * 1024
            ) {
              throw new Error(
                'Product image must not exceed 4 MB.'
              );
            }

            await API.upload(
              '/products/' +
                savedProduct.id +
                '/image',
              imageFile,
              'image'
            );
          }


          /*
           * Sync eligible add-ons
           * after the product exists.
           */
          await API.put(
            '/products/' +
              savedProduct.id +
              '/addons',
            {
              addon_ids:
                addonIds,
            }
          );


          toast(
            isNew
              ? 'Product created.'
              : 'Product updated.'
          );

          closeModal();

          route('menu');

        } catch (err) {

          const errors =
            err.payload?.errors;

          const message =
            errors
              ? Object.values(
                  errors
                )
                  .flat()[0]
              : (
                  err.payload
                    ?.message ||
                  'Save failed'
                );

          toast(
            message,
            'error'
          );

          button.disabled = false;

          button.textContent =
            isNew
              ? 'Create Product'
              : 'Save Changes';
        }
      }
    );
}

async function openProductConfigurator(
  productId
) {
  const product =
    await API.get(
      '/products/' + productId
    );

  const groups =
    product.option_groups || [];

  const variants =
    product.variants || [];

  openModal(`
    <div class="modal-head">
      <div>
        <h3>
          ⚙ ${product.name}
        </h3>

        <small class="text-muted">
          Options & Variant Pricing
        </small>
      </div>

      <button
        class="close-btn"
        onclick="closeModal()"
      >
        ×
      </button>
    </div>

    <div class="modal-body">

      <div class="form-section">

        <div
          style="
            display:flex;
            justify-content:
              space-between;
            align-items:center;
            gap:12px;
            margin-bottom:14px;
          "
        >
          <div>
            <div
              class="form-section-title"
              style="margin-bottom:3px"
            >
              Option Groups
            </div>

            <small class="text-muted">
              Example: Size,
              Temperature or Choice
            </small>
          </div>

          <button
            class="btn primary sm"
            onclick="
              app.openOptionGroupForm(
                ${product.id}
              )
            "
          >
            + Add Option Group
          </button>
        </div>

        ${
          groups.length
            ? groups.map(group => `
                <div
                  class="card"
                  style="
                    margin-bottom:12px;
                    box-shadow:none;
                    border:1px solid
                      var(--border);
                  "
                >

                  <div
                    style="
                      display:flex;
                      justify-content:
                        space-between;
                      align-items:center;
                      gap:10px;
                    "
                  >

                    <div>
                      <b>
                        ${group.name}
                      </b>

                      <div
                        class="text-muted"
                        style="
                          font-size:11px;
                          margin-top:3px;
                        "
                      >
                        ${
                          group.required
                            ? 'Required'
                            : 'Optional'
                        }

                        ·

                        ${
                          group.multiple
                            ? 'Multiple selection'
                            : 'Single selection'
                        }
                      </div>
                    </div>

                    <div
                      style="
                        display:flex;
                        gap:6px;
                      "
                    >
                      <button
                        class="btn sm"
                        onclick="
                          app.openOptionGroupForm(
                            ${product.id},
                            ${group.id}
                          )
                        "
                      >
                        Edit
                      </button>

                      <button
                        class="btn sm danger"
                        onclick="
                          app.deleteOptionGroup(
                            ${product.id},
                            ${group.id}
                          )
                        "
                      >
                        Delete
                      </button>
                    </div>

                  </div>

                  <div
                    style="
                      display:flex;
                      flex-wrap:wrap;
                      gap:7px;
                      margin-top:12px;
                    "
                  >

                    ${
                      (group.values || [])
                        .map(value => `
                          <button
                            type="button"
                            class="btn sm"
                            onclick="
                              app.openOptionValueForm(
                                ${product.id},
                                ${group.id},
                                ${value.id}
                              )
                            "
                            style="
                              ${
                                value.available
                                  ? ''
                                  : 'opacity:.55;'
                              }
                            "
                          >
                            ${value.name}

                            ${
                              value.available
                                ? ''
                                : ' · Sold Out'
                            }
                          </button>
                        `)
                        .join('')
                    }

                    <button
                      type="button"
                      class="btn sm primary"
                      onclick="
                        app.openOptionValueForm(
                          ${product.id},
                          ${group.id}
                        )
                      "
                    >
                      + Value
                    </button>

                  </div>

                </div>
              `).join('')
            : `
              <div
                class="empty"
                style="padding:24px"
              >
                No option groups yet.
              </div>
            `
        }

      </div>


      <div class="form-section">

        <div
          style="
            display:flex;
            justify-content:
              space-between;
            align-items:center;
            gap:12px;
            margin-bottom:14px;
          "
        >

          <div>
            <div
              class="form-section-title"
              style="margin-bottom:3px"
            >
              Variants
            </div>

            <small class="text-muted">
              Each valid combination has
              its own exact selling price.
            </small>
          </div>

          <button
            class="btn primary sm"
            onclick="
              app.openVariantForm(
                ${product.id}
              )
            "
            ${
              groups.length
                ? ''
                : 'disabled'
            }
          >
            + Add Variant
          </button>

        </div>

        ${
          variants.length
            ? `
              <table class="data">

                <thead>
                  <tr>
                    <th>
                      Variant
                    </th>

                    <th>
                      Options
                    </th>

                    <th
                      class="text-right"
                    >
                      Price
                    </th>

                    <th>
                      Status
                    </th>

                    <th></th>
                  </tr>
                </thead>

                <tbody>

                  ${variants.map(variant => {

                    const values =
                      (
                        variant
                          .option_values ||
                        []
                      )
                        .map(v => v.name)
                        .join(' · ');

                    return `
                      <tr>

                        <td>
                          <b>
                            ${variant.name}
                          </b>
                        </td>

                        <td>
                          ${
                            values ||
                            '—'
                          }
                        </td>

                        <td
                          class="text-right"
                        >
                          <b>
                            ${money(
                              variant.price
                            )}
                          </b>
                        </td>

                        <td>
                          <span
                            class="
                              badge
                              ${
                                variant
                                  .available
                                  ? 'badge-success'
                                  : 'badge-danger'
                              }
                            "
                          >
                            ${
                              variant
                                .available
                                ? 'Available'
                                : 'Sold Out'
                            }
                          </span>
                        </td>

                        <td>
                          <button
                            class="btn sm"
                            onclick="
                              app.openVariantForm(
                                ${product.id},
                                ${variant.id}
                              )
                            "
                          >
                            Edit
                          </button>

                          <button
                            class="btn sm danger"
                            onclick="
                              app.deleteVariant(
                                ${product.id},
                                ${variant.id}
                              )
                            "
                          >
                            Delete
                          </button>
                        </td>

                      </tr>
                    `;
                  }).join('')}

                </tbody>

              </table>
            `
            : `
              <div
                class="empty"
                style="padding:24px"
              >
                No variants created yet.
              </div>
            `
        }

      </div>

    </div>

    <div class="modal-foot">

      <button
        class="btn"
        onclick="
          closeModal();
          app.route('menu');
        "
      >
        Done
      </button>

    </div>
  `, {
    size: 'lg',
  });
}

async function openOptionGroupForm(
  productId,
  groupId = null
) {
  const product =
    await API.get(
      '/products/' + productId
    );

  const editing =
    Boolean(groupId);

  const group =
    editing
      ? (
          product.option_groups || []
        ).find(
          g => g.id === groupId
        )
      : {
          name: '',
          required: true,
          multiple: false,
          sort_order:
            (
              product
                .option_groups || []
            ).length + 1,
        };

  if (!group) {
    toast(
      'Option group not found.',
      'error'
    );

    return;
  }

  openModal(`
    <div class="modal-head">

      <h3>
        ${
          editing
            ? 'Edit Option Group'
            : 'New Option Group'
        }
      </h3>

      <button
        class="close-btn"
        onclick="closeModal()"
      >
        ×
      </button>

    </div>

    <div class="modal-body">

      <div class="field">
        <label>
          Group Name
        </label>

        <input
          id="optionGroupName"
          value="${group.name || ''}"
          placeholder="e.g. Size"
        >
      </div>

      <div class="field">

        <label>
          Sort Order
        </label>

        <input
          id="optionGroupSort"
          type="number"
          min="0"
          step="1"
          value="${group.sort_order || 0}"
        >

      </div>

      <div class="check-grid">

        <label class="check-card">

          <input
            id="optionGroupRequired"
            type="checkbox"
            ${
              group.required
                ? 'checked'
                : ''
            }
          >

          <span>
            <b>
              Required
            </b>

            <small>
              Customer must select
              a value.
            </small>
          </span>

        </label>


        <label class="check-card">

          <input
            id="optionGroupMultiple"
            type="checkbox"
            ${
              group.multiple
                ? 'checked'
                : ''
            }
          >

          <span>
            <b>
              Multiple
            </b>

            <small>
              Allow multiple values
              from this group.
            </small>
          </span>

        </label>

      </div>

    </div>

    <div class="modal-foot">

      <button
        class="btn"
        onclick="
          app.openProductConfigurator(
            ${productId}
          )
        "
      >
        Cancel
      </button>

      <button
        class="btn primary"
        id="saveOptionGroup"
      >
        Save
      </button>

    </div>
  `);

  $('#saveOptionGroup')
    .addEventListener(
      'click',
      async () => {

        const name =
          $('#optionGroupName')
            .value
            .trim();

        if (!name) {
          toast(
            'Group name is required.',
            'error'
          );

          return;
        }

        const payload = {
          name,

          required:
            $('#optionGroupRequired')
              .checked,

          multiple:
            $('#optionGroupMultiple')
              .checked,

          sort_order:
            Number(
              $('#optionGroupSort')
                .value || 0
            ),
        };

        try {

          if (editing) {
            await API.put(
              '/product-option-groups/' +
                group.id,
              payload
            );
          } else {
            await API.post(
              '/products/' +
                productId +
                '/option-groups',
              payload
            );
          }

          toast(
            'Option group saved.'
          );

          openProductConfigurator(
            productId
          );

        } catch (err) {
          toast(
            err.payload?.message ||
            'Save failed.',
            'error'
          );
        }
      }
    );
}

async function openOptionValueForm(
  productId,
  groupId,
  valueId = null
) {
  const product =
    await API.get(
      '/products/' + productId
    );

  const group =
    (
      product.option_groups || []
    ).find(
      g => g.id === groupId
    );

  if (!group) {
    toast(
      'Option group not found.',
      'error'
    );

    return;
  }

  const editing =
    Boolean(valueId);

  const value =
    editing
      ? (
          group.values || []
        ).find(
          v => v.id === valueId
        )
      : {
          name: '',
          available: true,
          sort_order:
            (
              group.values || []
            ).length + 1,
        };

  openModal(`
    <div class="modal-head">

      <div>
        <h3>
          ${
            editing
              ? 'Edit Option Value'
              : 'New Option Value'
          }
        </h3>

        <small class="text-muted">
          ${group.name}
        </small>
      </div>

      <button
        class="close-btn"
        onclick="closeModal()"
      >
        ×
      </button>

    </div>

    <div class="modal-body">

      <div class="field">

        <label>
          Value Name
        </label>

        <input
          id="optionValueName"
          value="${value.name || ''}"
          placeholder="e.g. Large"
        >

      </div>

      <div class="field">

        <label>
          Sort Order
        </label>

        <input
          id="optionValueSort"
          type="number"
          min="0"
          value="${value.sort_order || 0}"
        >

      </div>

      <div class="field">

        <label
          style="
            display:flex;
            gap:8px;
            align-items:center;
          "
        >

          <input
            id="optionValueAvailable"
            type="checkbox"
            style="width:auto"
            ${
              value.available
                ? 'checked'
                : ''
            }
          >

          Available

        </label>

      </div>

    </div>

    <div class="modal-foot">

      ${
        editing
          ? `
            <button
              class="btn danger"
              onclick="
                app.deleteOptionValue(
                  ${productId},
                  ${value.id}
                )
              "
              style="margin-right:auto"
            >
              Delete
            </button>
          `
          : ''
      }

      <button
        class="btn"
        onclick="
          app.openProductConfigurator(
            ${productId}
          )
        "
      >
        Cancel
      </button>

      <button
        class="btn primary"
        id="saveOptionValue"
      >
        Save
      </button>

    </div>
  `);

  $('#saveOptionValue')
    .addEventListener(
      'click',
      async () => {

        const name =
          $('#optionValueName')
            .value
            .trim();

        if (!name) {
          toast(
            'Value name is required.',
            'error'
          );

          return;
        }

        const payload = {
          name,

          available:
            $('#optionValueAvailable')
              .checked,

          sort_order:
            Number(
              $('#optionValueSort')
                .value || 0
            ),
        };

        try {

          if (editing) {
            await API.put(
              '/product-option-values/' +
                value.id,
              payload
            );
          } else {
            await API.post(
              '/product-option-groups/' +
                group.id +
                '/values',
              payload
            );
          }

          toast(
            'Option value saved.'
          );

          openProductConfigurator(
            productId
          );

        } catch (err) {
          toast(
            err.payload?.message ||
            'Save failed.',
            'error'
          );
        }
      }
    );
}

async function openVariantForm(
  productId,
  variantId = null
) {
  const product =
    await API.get(
      '/products/' + productId
    );

  const groups =
    product.option_groups || [];

  const editing =
    Boolean(variantId);

  const variant =
    editing
      ? (
          product.variants || []
        ).find(
          v => v.id === variantId
        )
      : {
          name: '',
          price: 0,
          available: true,
          sort_order:
            (
              product.variants || []
            ).length + 1,

          option_values: [],
        };

  if (!variant) {
    toast(
      'Variant not found.',
      'error'
    );

    return;
  }

  const currentValueIds =
    new Set(
      (
        variant.option_values || []
      ).map(
        value => Number(value.id)
      )
    );

  openModal(`
    <div class="modal-head">

      <div>
        <h3>
          ${
            editing
              ? 'Edit Variant'
              : 'New Variant'
          }
        </h3>

        <small class="text-muted">
          ${product.name}
        </small>
      </div>

      <button
        class="close-btn"
        onclick="closeModal()"
      >
        ×
      </button>

    </div>

    <div class="modal-body">

      <div class="field">

        <label>
          Variant Name
        </label>

        <input
          id="variantName"
          value="${variant.name || ''}"
          placeholder="e.g. Large + Cold"
        >

      </div>


      ${
        groups.map(group => `
          <div class="field">

            <label>
              ${group.name}
              ${
                group.required
                  ? '*'
                  : ''
              }
            </label>

            <select
              class="variantOptionSelect"
              data-group-id="${group.id}"
            >

              ${
                !group.required
                  ? `
                    <option value="">
                      None
                    </option>
                  `
                  : `
                    <option value="">
                      Select...
                    </option>
                  `
              }

              ${
                (group.values || [])
                  .map(value => `
                    <option
                      value="${value.id}"
                      ${
                        currentValueIds
                          .has(
                            Number(
                              value.id
                            )
                          )
                          ? 'selected'
                          : ''
                      }
                      ${
                        value.available
                          ? ''
                          : 'disabled'
                      }
                    >
                      ${value.name}
                      ${
                        value.available
                          ? ''
                          : ' (Sold Out)'
                      }
                    </option>
                  `)
                  .join('')
              }

            </select>

          </div>
        `).join('')
      }


      <div class="form-row">

        <div class="field">

          <label>
            Exact Selling Price (RM)
          </label>

          <input
            id="variantPrice"
            type="number"
            min="0"
            step="0.01"
            value="${num(variant.price)}"
          >

        </div>

        <div class="field">

          <label>
            Sort Order
          </label>

          <input
            id="variantSort"
            type="number"
            min="0"
            value="${variant.sort_order || 0}"
          >

        </div>

      </div>


      <div class="field">

        <label
          style="
            display:flex;
            align-items:center;
            gap:8px;
          "
        >

          <input
            id="variantAvailable"
            type="checkbox"
            style="width:auto"
            ${
              variant.available
                ? 'checked'
                : ''
            }
          >

          Available

        </label>

        <small class="text-muted">
          Turn off to mark only this
          variant as sold out.
        </small>

      </div>

    </div>


    <div class="modal-foot">

      <button
        class="btn"
        onclick="
          app.openProductConfigurator(
            ${productId}
          )
        "
      >
        Cancel
      </button>

      <button
        class="btn primary"
        id="saveVariant"
      >
        Save Variant
      </button>

    </div>
  `, {
    size: 'lg',
  });


  function generateVariantName() {
    const names =
      $$('.variantOptionSelect')
        .map(select => {

          const option =
            select.options[
              select.selectedIndex
            ];

          return select.value
            ? option.text
                .replace(
                  ' (Sold Out)',
                  ''
                )
            : null;
        })
        .filter(Boolean);

    if (names.length) {
      $('#variantName').value =
        names.join(' + ');
    }
  }


  $$('.variantOptionSelect')
    .forEach(select => {
      select.addEventListener(
        'change',
        generateVariantName
      );
    });


  $('#saveVariant')
    .addEventListener(
      'click',
      async () => {

        const optionValueIds =
          $$('.variantOptionSelect')
            .map(select =>
              select.value
                ? Number(
                    select.value
                  )
                : null
            )
            .filter(Boolean);


        const missingRequired =
          groups.some(group => {

            if (!group.required) {
              return false;
            }

            const select =
              $(
                `.variantOptionSelect[data-group-id="${group.id}"]`
              );

            return !select?.value;
          });


        if (missingRequired) {
          toast(
            'Select all required options.',
            'error'
          );

          return;
        }


        const name =
          $('#variantName')
            .value
            .trim();


        if (!name) {
          toast(
            'Variant name is required.',
            'error'
          );

          return;
        }


        const payload = {
          name,

          price:
            Number(
              $('#variantPrice')
                .value || 0
            ),

          available:
            $('#variantAvailable')
              .checked,

          sort_order:
            Number(
              $('#variantSort')
                .value || 0
            ),

          option_value_ids:
            optionValueIds,
        };


        try {

          if (editing) {
            await API.put(
              '/product-variants/' +
                variant.id,
              payload
            );
          } else {
            await API.post(
              '/products/' +
                productId +
                '/variants',
              payload
            );
          }


          toast(
            'Variant saved.'
          );

          openProductConfigurator(
            productId
          );

        } catch (err) {

          const errors =
            err.payload?.errors;

          const message =
            errors
              ? Object.values(
                  errors
                )
                  .flat()[0]
              : (
                  err.payload?.message ||
                  'Save failed.'
                );

          toast(
            message,
            'error'
          );
        }
      }
    );
}

async function deleteOptionGroup(
  productId,
  groupId
) {
  if (
    !confirm(
      'Delete this option group and its values?'
    )
  ) {
    return;
  }

  try {
    await API.delete(
      '/product-option-groups/' +
        groupId
    );

    toast(
      'Option group deleted.'
    );

    openProductConfigurator(
      productId
    );

  } catch (err) {
    toast(
      err.payload?.message ||
      'Delete failed.',
      'error'
    );
  }
}


async function deleteOptionValue(
  productId,
  valueId
) {
  if (
    !confirm(
      'Delete this option value?'
    )
  ) {
    return;
  }

  try {
    await API.delete(
      '/product-option-values/' +
        valueId
    );

    toast(
      'Option value deleted.'
    );

    openProductConfigurator(
      productId
    );

  } catch (err) {
    toast(
      err.payload?.message ||
      'Delete failed.',
      'error'
    );
  }
}


async function deleteVariant(
  productId,
  variantId
) {
  if (
    !confirm(
      'Delete this product variant?'
    )
  ) {
    return;
  }

  try {
    await API.delete(
      '/product-variants/' +
        variantId
    );

    toast(
      'Variant deleted.'
    );

    openProductConfigurator(
      productId
    );

  } catch (err) {
    toast(
      err.payload?.message ||
      'Delete failed.',
      'error'
    );
  }
}

async function deleteProduct(id) {
  if (!confirm('Soft-delete this product? It will be hidden from the menu but kept for audit.')) return;
  try {
    await API.delete('/products/' + id);
    toast('Product deleted');
    closeModal();
    route('menu');
  } catch (err) {
    toast(err.payload?.message || 'Delete failed', 'error');
  }
}

async function openCategoryForm(id) {
  const isNew = !id;
  const c = isNew
    ? { name:'', icon:'🍽', color:'#10b981', sort_order: 99 }
    : state.categories.find(x => x.id === id);
  openModal(`
    <div class="modal-head"><h3>${isNew?'New Category':'Edit Category'}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="field"><label>Name</label><input id="cName" value="${c.name}"></div>
        <div class="field"><label>Icon (emoji)</label><input id="cIcon" maxlength="2" value="${c.icon||'🍽'}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Color (hex)</label><input id="cColor" value="${c.color||'#10b981'}"></div>
        <div class="field"><label>Sort Order</label><input id="cSort" type="number" value="${c.sort_order||99}"></div>
      </div>
    </div>
    <div class="modal-foot">
      ${!isNew?`<button class="btn danger" onclick="app.deleteCategory(${id})">🗑 Delete</button>`:''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="saveCat">${isNew?'Create':'Save'}</button>
    </div>`);

  $('#saveCat').addEventListener('click', async () => {
    const name = $('#cName').value.trim();
    if (!name) { toast('Name required', 'error'); return; }
    const body = { name, icon: $('#cIcon').value || '🍽', color: $('#cColor').value, sort_order: +$('#cSort').value };
    try {
      if (isNew) await API.post('/categories', body);
      else       await API.put('/categories/' + id, body);
      toast('Saved');
      closeModal();
      route('menu');
    } catch (err) {
      toast(err.payload?.message || 'Save failed', 'error');
    }
  });
}

async function deleteCategory(id) {
  if (!confirm('Soft-delete this category? It will be hidden but kept for audit. (Requires zero active products.)')) return;
  try {
    await API.delete('/categories/' + id);
    toast('Category deleted');
    closeModal();
    route('menu');
  } catch (err) {
    toast(err.payload?.message || 'Delete failed', 'error');
  }
}

/* ===== SUPPLIERS + PURCHASE ORDERS (full CRUD) ===== */
VIEWS.purchase = async (root) => {
  const [pos, sups] = await Promise.all([API.get('/purchase-orders'), API.get('/suppliers')]);
  state.suppliers = sups;
  root.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="po">Purchase Orders (${pos.length})</button>
      <button class="tab" data-tab="sup">Suppliers (${sups.length})</button>
    </div>
    <div id="poBody"></div>`;
  $$('.tabs .tab').forEach(t => t.addEventListener('click', () => {
    $$('.tabs .tab').forEach(x=>x.classList.remove('active')); t.classList.add('active');
    renderTab(t.dataset.tab);
  }));
  renderTab('po');
  function renderTab(tab) {
    if (tab === 'po') {
      $('#poBody').innerHTML = `
        <div class="toolbar">
          <div style="flex:1"></div>

          <button
            class="btn primary"
            id="newPurchaseOrderBtn"
          >
            + New Purchase Order
          </button>
        </div>

        <div class="card">
          <table class="data">

            <thead>
              <tr>
                <th>PO #</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Expected</th>
                <th class="text-right">
                  Total
                </th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              ${
                pos.map(p => `
                  <tr>

                    <td>
                      <b>${p.po_no}</b>
                    </td>

                    <td>
                      ${fmtDate(
                        p.created_at,
                        false
                      )}
                    </td>

                    <td>
                      ${p.supplier?.name || '-'}
                    </td>

                    <td>
                      ${
                        p.expected_date
                          ? fmtDate(
                              p.expected_date,
                              false
                            )
                          : '-'
                      }
                    </td>

                    <td class="text-right">
                      <b>
                        ${money(p.total)}
                      </b>
                    </td>

                    <td>
                      <span
                        class="badge badge-${
                          p.status === 'received'
                            ? 'success'
                            : 'warn'
                        }"
                      >
                        ${p.status}
                      </span>
                    </td>

                    <td class="text-right">

                      <button
                        class="btn sm"
                        onclick="app.viewPurchaseOrder(${p.id})"
                      >
                        View
                      </button>

                    </td>

                  </tr>
                `).join('')
                ||
                `
                  <tr>
                    <td
                      colspan="7"
                      class="text-center text-muted"
                      style="padding:30px"
                    >
                      No purchase orders
                    </td>
                  </tr>
                `
              }
            </tbody>

          </table>
        </div>
      `;

      $('#newPurchaseOrderBtn')
        .addEventListener(
          'click',
          () => openPurchaseOrderForm()
        );
    } else {
      $('#poBody').innerHTML = `
        <div class="toolbar"><button class="btn primary" onclick="app.openSupplierForm()">+ New Supplier</button></div>
        <div class="card"><table class="data">
          <thead><tr><th>Supplier</th><th>Category</th><th>Contact</th><th>Phone</th><th>Email</th><th></th></tr></thead>
          <tbody>${sups.map(s=>`<tr>
            <td><b>${s.name}</b><div style="font-size:11px;color:#6b7280">${s.address||''}</div></td>
            <td><span class="badge badge-info">${s.category||'-'}</span></td>
            <td>${s.contact||'-'}</td>
            <td>${s.phone||'-'}</td>
            <td>${s.email||'-'}</td>
            <td><button class="btn sm" onclick="app.openSupplierForm(${s.id})">Edit</button></td>
          </tr>`).join('')}</tbody>
        </table></div>`;
    }
  }
};

async function openPurchaseOrderForm(
  prefill = null
) {
  try {

    const [suppliers, inventory] =
      await Promise.all([
        API.get('/suppliers'),
        API.get('/inventory'),
      ]);

    if (!suppliers.length) {
      toast(
        'Please create a supplier first.',
        'warn'
      );
      return;
    }

    if (!inventory.length) {
      toast(
        'Please create an inventory item first.',
        'warn'
      );
      return;
    }

    openModal(`
      <div class="modal-head">

        <div>
          <h3>
            New Purchase Order
          </h3>

          <small class="text-muted">
            Order inventory stock from a supplier
          </small>
        </div>

        <button
          class="close-btn"
          onclick="closeModal()"
        >
          ×
        </button>

      </div>

      <div class="modal-body">

        <div class="form-row">

          <div class="field">
            <label>Supplier</label>

            <select id="poSupplier">

              ${
                suppliers.map(s => `

                  <option
                    value="${s.id}"

                    ${
                      Number(s.id) ===
                      Number(prefill?.supplier_id)
                        ? 'selected'
                        : ''
                    }
                  >
                    ${s.name}
                  </option>

                `).join('')
              }

            </select>
          </div>

          <div class="field">
            <label>
              Expected Delivery
            </label>

            <input
              type="date"
              id="poExpectedDate"
            >
          </div>

        </div>

        <div
          class="section-title"
          style="margin-top:20px"
        >
          Items
        </div>

        <div id="poItems"></div>

        <button
          type="button"
          class="btn"
          id="poAddItem"
          style="margin-top:10px"
        >
          + Add Item
        </button>

        <div
          style="
            margin-top:20px;
            padding-top:16px;
            border-top:1px solid var(--border);
            display:flex;
            justify-content:flex-end;
            align-items:center;
            gap:15px;
          "
        >

          <span class="text-muted">
            Purchase Total
          </span>

          <b
            id="poTotal"
            style="font-size:22px"
          >
            ${money(0)}
          </b>

        </div>

      </div>

      <div class="modal-foot">

        <button
          class="btn"
          onclick="closeModal()"
        >
          Cancel
        </button>

        <button
          class="btn primary"
          id="poCreate"
        >
          Create Purchase Order
        </button>

      </div>
    `, {
      size: 'lg'
    });


    const container =
      $('#poItems');


    function recalculate() {

      let total = 0;

      $$('.po-item-row', container)
        .forEach(row => {

          const qty =
            num(
              $('.po-qty', row).value
            );

          const cost =
            num(
              $('.po-cost', row).value
            );

          const subtotal =
            qty * cost;

          $('.po-subtotal', row)
            .value =
              money(subtotal);

          total += subtotal;
        });

      $('#poTotal').textContent =
        money(total);
    }


    function addRow(
      selectedItemId = null
    ) {

      const row =
        document.createElement('div');

      row.className =
        'po-item-row';

      row.style.cssText = `
        display:grid;
        grid-template-columns:
          minmax(180px,2fr)
          90px
          120px
          130px
          auto;
        gap:10px;
        align-items:end;
        margin-bottom:12px;
      `;


      row.innerHTML = `

        <div
          class="field"
          style="margin:0"
        >

          <label>
            Inventory Item
          </label>

          <select class="po-item">

            ${inventory.map(i => `
              <option
                value="${i.id}"

                data-cost="${
                  num(i.cost_per_unit)
                }"

                ${
                  Number(i.id) ===
                  Number(selectedItemId)
                    ? 'selected'
                    : ''
                }
              >
                ${i.name} (${i.unit})
              </option>
            `).join('')}

          </select>

        </div>


        <div
          class="field"
          style="margin:0"
        >

          <label>Qty</label>

          <input
            type="number"
            class="po-qty"
            min="0.01"
            step="0.01"
            value="1"
          >

        </div>


        <div
          class="field"
          style="margin:0"
        >

          <label>
            Unit Cost
          </label>

          <input
            type="number"
            class="po-cost"
            min="0"
            step="0.01"
            value="${
              num(
                (
                  inventory.find(
                    i =>
                      Number(i.id) ===
                      Number(selectedItemId)
                  ) ||
                  inventory[0]
                ).cost_per_unit
              ).toFixed(2)
            }"
          >

        </div>


        <div
          class="field"
          style="margin:0"
        >

          <label>
            Subtotal
          </label>

          <input
            class="po-subtotal"
            disabled
          >

        </div>


        <button
          type="button"
          class="btn danger sm po-remove"
          title="Remove"
        >
          ×
        </button>

      `;


      container.appendChild(row);


      const itemSelect =
        $('.po-item', row);

      const qtyInput =
        $('.po-qty', row);

      const costInput =
        $('.po-cost', row);


      itemSelect.addEventListener(
        'change',
        () => {

          const option =
            itemSelect.options[
              itemSelect.selectedIndex
            ];

          costInput.value =
            num(
              option.dataset.cost
            ).toFixed(2);

          recalculate();
        }
      );


      qtyInput.addEventListener(
        'input',
        recalculate
      );


      costInput.addEventListener(
        'input',
        recalculate
      );


      $('.po-remove', row)
        .addEventListener(
          'click',
          () => {

            row.remove();

            recalculate();
          }
        );


      recalculate();
    }


    $('#poAddItem')
      .addEventListener(
        'click',
        addRow
      );


    // Start with one item row.
    // If opened from Inventory,
    // preselect that inventory item.
    addRow(
      prefill?.inventory_item_id || null
    );


    $('#poCreate')
      .addEventListener(
        'click',
        async () => {

          const rows =
            $$('.po-item-row', container);


          if (!rows.length) {

            toast(
              'Add at least one item.',
              'error'
            );

            return;
          }


          const items =
            rows.map(row => ({

              inventory_item_id:
                Number(
                  $('.po-item', row)
                    .value
                ),

              qty:
                num(
                  $('.po-qty', row)
                    .value
                ),

              cost:
                num(
                  $('.po-cost', row)
                    .value
                ),

            }));


          if (
            items.some(
              item => item.qty <= 0
            )
          ) {

            toast(
              'Quantity must be greater than 0.',
              'error'
            );

            return;
          }


          const button =
            $('#poCreate');

          button.disabled = true;

          button.textContent =
            'Creating...';


          try {

            const po =
              await API.post(
                '/purchase-orders',
                {

                  supplier_id:
                    Number(
                      $('#poSupplier')
                        .value
                    ),

                  expected_date:
                    $('#poExpectedDate')
                      .value || null,

                  items,

                }
              );


            toast(
              `Purchase order ${po.po_no} created.`
            );


            closeModal();

            route('purchase');

          }
          catch (err) {

            button.disabled = false;

            button.textContent =
              'Create Purchase Order';

            toast(
              err.payload?.message ||
              'Could not create purchase order.',
              'error'
            );
          }
        }
      );

  }
  catch (err) {

    console.error(err);

    toast(
      'Could not load purchase order form.',
      'error'
    );
  }
}

function reorderInventory(id) {

  const items =
    state._inventoryCache || [];

  const item =
    items.find(
      i =>
        Number(i.id) ===
        Number(id)
    );


  if (!item) {

    toast(
      'Inventory item not found.',
      'error'
    );

    return;
  }


  if (!item.supplier_id) {

    toast(
      `${item.name} does not have a supplier assigned.`,
      'warn'
    );

    return;
  }


  openPurchaseOrderForm({

    inventory_item_id:
      item.id,

    supplier_id:
      item.supplier_id,

  });
}

async function viewPurchaseOrder(id) {

  try {

    const po =
      await API.get(
        `/purchase-orders/${id}`
      );


    const isPending =
      po.status === 'pending';


    openModal(`
      <div class="modal-head">

        <div>

          <h3>
            Purchase Order
            ${po.po_no}
          </h3>

          <small class="text-muted">
            ${
              po.supplier?.name ||
              'Unknown Supplier'
            }
          </small>

        </div>


        <button
          class="close-btn"
          onclick="closeModal()"
        >
          ×
        </button>

      </div>


      <div class="modal-body">

        <div
          class="grid-2"
          style="margin-bottom:20px"
        >

          <div class="card">

            <div
              class="text-muted"
              style="font-size:12px"
            >
              Supplier
            </div>

            <b>
              ${
                po.supplier?.name ||
                '-'
              }
            </b>

          </div>


          <div class="card">

            <div
              class="text-muted"
              style="font-size:12px"
            >
              Status
            </div>

            <span
              class="badge badge-${
                po.status === 'received'
                  ? 'success'
                  : 'warn'
              }"
            >
              ${po.status}
            </span>

          </div>


          <div class="card">

            <div
              class="text-muted"
              style="font-size:12px"
            >
              Created
            </div>

            <b>
              ${
                fmtDate(
                  po.created_at,
                  false
                )
              }
            </b>

          </div>


          <div class="card">

            <div
              class="text-muted"
              style="font-size:12px"
            >
              Expected Delivery
            </div>

            <b>
              ${
                po.expected_date
                  ? fmtDate(
                      po.expected_date,
                      false
                    )
                  : '-'
              }
            </b>

          </div>

        </div>


        <div class="section-title">
          Items
        </div>


        <div
          class="card"
          style="padding:0"
        >

          <table class="data">

            <thead>

              <tr>
                <th>Inventory Item</th>

                <th class="text-right">
                  Qty
                </th>

                <th class="text-right">
                  Unit Cost
                </th>

                <th class="text-right">
                  Subtotal
                </th>
              </tr>

            </thead>


            <tbody>

              ${
                (po.items || [])
                  .map(item => {

                    const qty =
                      num(item.qty);

                    const cost =
                      num(item.cost);

                    return `
                      <tr>

                        <td>
                          <b>
                            ${
                              item
                                .inventory_item
                                ?.name ||
                              'Inventory Item'
                            }
                          </b>

                          ${
                            item
                              .inventory_item
                              ?.unit
                              ? `
                                <div
                                  class="text-muted"
                                  style="font-size:11px"
                                >
                                  Unit:
                                  ${
                                    item
                                      .inventory_item
                                      .unit
                                  }
                                </div>
                              `
                              : ''
                          }
                        </td>


                        <td class="text-right">
                          ${qty}
                        </td>


                        <td class="text-right">
                          ${money(cost)}
                        </td>


                        <td class="text-right">
                          <b>
                            ${
                              money(
                                qty *
                                cost
                              )
                            }
                          </b>
                        </td>

                      </tr>
                    `;
                  })
                  .join('')
              }

            </tbody>

          </table>

        </div>


        <div
          style="
            display:flex;
            justify-content:flex-end;
            align-items:center;
            gap:20px;
            margin-top:18px;
          "
        >

          <span class="text-muted">
            Purchase Total
          </span>

          <strong
            style="font-size:24px"
          >
            ${money(po.total)}
          </strong>

        </div>


        ${
          isPending
            ? `
              <div
                class="alert alert-info"
                style="margin-top:20px"
              >

                <b>
                  Stock has not been received yet.
                </b>

                <br>

                Inventory quantities will only
                increase when this purchase order
                is received.

              </div>
            `
            : `
              <div
                class="alert alert-success"
                style="margin-top:20px"
              >

                ✓ This purchase order has been
                received and added to inventory.

                ${
                  po.received_at
                    ? `
                      <br>

                      Received:
                      <b>
                        ${
                          fmtDate(
                            po.received_at
                          )
                        }
                      </b>
                    `
                    : ''
                }

              </div>
            `
        }

      </div>


      <div class="modal-foot">

        <button
          class="btn"
          onclick="closeModal()"
        >
          Close
        </button>


        ${
          isPending
            ? `
              <button
                class="btn primary"
                id="receivePurchaseOrderBtn"
              >
                ✓ Receive Stock
              </button>
            `
            : ''
        }

      </div>
    `, {
      size: 'lg'
    });


    if (isPending) {

      $('#receivePurchaseOrderBtn')
        .addEventListener(
          'click',
          async () => {

            const confirmed =
              confirm(
                `Receive ${po.po_no}?\n\n` +
                'This will add all quantities in this purchase order to inventory.'
              );


            if (!confirmed) {
              return;
            }


            const button =
              $('#receivePurchaseOrderBtn');


            button.disabled = true;

            button.textContent =
              'Receiving...';


            try {

              await API.post(
                `/purchase-orders/${po.id}/receive`,
                {}
              );


              toast(
                `${po.po_no} received. Inventory updated.`
              );


              closeModal();

              route('purchase');

            }
            catch (err) {

              button.disabled = false;

              button.textContent =
                '✓ Receive Stock';


              toast(
                err.payload?.message ||
                'Could not receive purchase order.',
                'error'
              );
            }
          }
        );
    }

  }
  catch (err) {

    console.error(
      'Purchase order error:',
      err
    );


    toast(
      'Could not load purchase order.',
      'error'
    );
  }
}

async function openSupplierForm(id) {
  const isNew = !id;
  const s = isNew
    ? { name:'', category:'', contact:'', phone:'', email:'', address:'' }
    : state.suppliers.find(x => x.id === id);
  openModal(`
    <div class="modal-head"><h3>${isNew?'New Supplier':'Edit Supplier'}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="field"><label>Name</label><input id="sName" value="${s.name}"></div>
        <div class="field"><label>Category</label><input id="sCat" value="${s.category||''}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Contact</label><input id="sContact" value="${s.contact||''}"></div>
        <div class="field"><label>Phone</label><input id="sPhone" value="${s.phone||''}"></div>
      </div>
      <div class="field"><label>Email</label><input id="sEmail" type="email" value="${s.email||''}"></div>
      <div class="field"><label>Address</label><input id="sAddr" value="${s.address||''}"></div>
    </div>
    <div class="modal-foot">
      ${!isNew?`<button class="btn danger" onclick="app.deleteSupplier(${id})">🗑 Delete</button>`:''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="saveSupp">${isNew?'Create':'Save'}</button>
    </div>`);
  $('#saveSupp').addEventListener('click', async () => {
    const name = $('#sName').value.trim();
    if (!name) { toast('Name required', 'error'); return; }
    const body = { name, category:$('#sCat').value, contact:$('#sContact').value, phone:$('#sPhone').value, email:$('#sEmail').value, address:$('#sAddr').value };
    try {
      if (isNew) await API.post('/suppliers', body);
      else       await API.put('/suppliers/' + id, body);
      toast('Saved'); closeModal(); route('purchase');
    } catch (err) {
      toast(err.payload?.message || 'Save failed', 'error');
    }
  });
}
async function deleteSupplier(id) {
  if (!confirm('Soft-delete this supplier?')) return;
  try { await API.delete('/suppliers/' + id); toast('Deleted'); closeModal(); route('purchase'); }
  catch (err) { toast(err.payload?.message || 'Delete failed', 'error'); }
}

async function receivePurchase(id) {
  if (!confirm('Mark this purchase order as received? Stock will be added to inventory.')) return;
  try {
    await API.post(`/purchase-orders/${id}/receive`);
    toast('Goods received, inventory updated', 'success');
    route('purchase');
  } catch (err) {
    toast(err.payload?.message || 'Failed', 'error');
  }
}

/* ===== PROMOTIONS (full CRUD) ===== */
/* ===== Dining Tables (CRUD) ===== */
VIEWS.tables = async (root) => {
  const tables = await API.get('/tables');
  state.tables = tables;
  root.innerHTML = `
    <div class="toolbar">
      <button class="btn primary" onclick="app.openTableForm()">+ Add Table</button>
      <span class="text-muted" style="margin-left:auto;font-size:12.5px">${tables.length} active table(s) · customers see these in the QR ordering page</span>
    </div>
    <div class="card"><table class="data">
      <thead><tr><th>Table</th><th class="text-right">Capacity</th><th>Status</th><th></th></tr></thead>
      <tbody>${tables.map(t => `<tr>
        <td><b>${t.name}</b></td>
        <td class="text-right">${t.capacity} pax</td>
        <td><span class="badge badge-${t.status==='available'?'success':t.status==='occupied'?'warn':'info'}">${t.status}</span></td>
        <td class="text-right"><button class="btn sm" onclick="app.openTableForm(${t.id})">Edit</button></td>
      </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">No tables yet — add one to start QR ordering.</td></tr>'}</tbody>
    </table></div>`;
};

async function openTableForm(id) {
  const isNew = !id;
  const t = isNew
    ? { name:'', capacity: 4, status: 'available' }
    : state.tables.find(x => x.id === id);
  openModal(`
    <div class="modal-head"><h3>${isNew?'Add Table':'Edit Table'}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="field"><label>Table Name / Number</label><input id="tName" value="${t.name||''}" placeholder="e.g. T1, T2, A-01" maxlength="16"></div>
        <div class="field"><label>Capacity (seats)</label><input id="tCap" type="number" min="1" max="50" value="${t.capacity||4}"></div>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="tStatus">
          <option value="available" ${t.status==='available'?'selected':''}>Available</option>
          <option value="occupied"  ${t.status==='occupied'?'selected':''}>Occupied</option>
          <option value="reserved"  ${t.status==='reserved'?'selected':''}>Reserved</option>
        </select>
        <small class="text-muted">Only <b>available</b> tables appear in the customer QR page picker.</small>
      </div>
    </div>
    <div class="modal-foot">
      ${!isNew?`<button class="btn danger" onclick="app.deleteTable(${id})">🗑 Remove</button>`:''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="saveTable">${isNew?'Create':'Save'}</button>
    </div>`);
  $('#saveTable').addEventListener('click', async () => {
    const body = {
      name:     $('#tName').value.trim(),
      capacity: +$('#tCap').value,
      status:   $('#tStatus').value,
    };
    if (!body.name) { toast('Table name is required', 'error'); return; }
    if (!body.capacity || body.capacity < 1) { toast('Capacity must be at least 1', 'error'); return; }
    try {
      if (isNew) await API.post('/tables', body);
      else       await API.put('/tables/' + id, body);
      toast('Saved'); closeModal(); route('tables');
    } catch (err) {
      const msg = err.payload?.errors?.name?.[0]
               || err.payload?.errors?.capacity?.[0]
               || err.payload?.message
               || 'Save failed';
      toast(msg, 'error');
    }
  });
}

async function deleteTable(id) {
  if (!confirm('Remove this table? Existing orders that reference it will still work, but it will disappear from the QR ordering picker.')) return;
  try { await API.delete('/tables/' + id); toast('Table removed'); closeModal(); route('tables'); }
  catch (err) { toast(err.payload?.message || 'Delete failed', 'error'); }
}

VIEWS.promo = async (root) => {
  const promos = await API.get('/promotions?all=1');

  state.promotions = promos;

  const statusLabel = {
    active: 'Active',
    scheduled: 'Scheduled',
    expired: 'Expired',
    disabled: 'Disabled',
    usage_limit_reached: 'Limit Reached',
  };

  const statusClass = {
    active: 'badge-success',
    scheduled: 'badge-info',
    expired: 'badge-danger',
    disabled: 'badge-secondary',
    usage_limit_reached: 'badge-warn',
  };

  root.innerHTML = `
    <div class="toolbar">
      <button
        class="btn primary"
        onclick="app.openPromoForm()"
      >
        + New Promotion
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Promotion Campaigns</h3>
          <small>
            Configure discount rules, eligibility,
            limits and availability
          </small>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Promotion</th>
              <th>Discount</th>
              <th>Minimum Spend</th>
              <th>Validity</th>
              <th>Usage</th>
              <th>Audience</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${
              promos.length
                ? promos.map(p => {
                    const discount =
                      p.type === 'percent'
                        ? `${num(p.value)}%${
                            p.max_discount
                              ? ` · Max ${money(p.max_discount)}`
                              : ''
                          }`
                        : money(p.value);

                    const validity = `
                      <div class="promo-validity">
                        <span>
                          ${p.starts_at
                            ? fmtDate(p.starts_at, false)
                            : 'Immediate'}
                        </span>

                        <span class="text-muted">
                          →
                        </span>

                        <span>
                          ${p.ends_at
                            ? fmtDate(p.ends_at, false)
                            : 'No expiry'}
                        </span>
                      </div>
                    `;

                    const usageLimit =
                      p.usage_limit === null
                        ? 'Unlimited'
                        : `${p.usage_count ?? 0} / ${p.usage_limit}`;

                    const perCustomer =
                      p.usage_limit_per_customer
                        ? `Max ${p.usage_limit_per_customer} per customer`
                        : 'No customer limit';

                    const audience =
                      p.customer_scope === 'registered'
                        ? 'Registered only'
                        : 'All customers';

                    return `
                      <tr>
                        <td>
                          <code class="promo-code">
                            ${p.code}
                          </code>
                        </td>

                        <td>
                          <div class="promo-name">
                            <b>${p.name}</b>

                            ${
                              p.description
                                ? `<small>${p.description}</small>`
                                : ''
                            }
                          </div>
                        </td>

                        <td>
                          <b>${discount}</b>

                          <small class="block text-muted">
                            ${p.type === 'percent'
                              ? 'Percentage'
                              : 'Fixed amount'}
                          </small>
                        </td>

                        <td>
                          ${money(p.min_order || 0)}
                        </td>

                        <td>
                          ${validity}
                        </td>

                        <td>
                          <div>
                            <b>${usageLimit}</b>
                          </div>

                          <small class="text-muted">
                            ${perCustomer}
                          </small>
                        </td>

                        <td>
                          <div>${audience}</div>

                          <small class="text-muted">
                            ${
                              p.allowed_channels?.length
                                ? p.allowed_channels
                                    .map(x => x.toUpperCase())
                                    .join(', ')
                                : 'All channels'
                            }
                          </small>
                        </td>

                        <td>
                          <span
                            class="badge ${
                              statusClass[p.status]
                                || 'badge-secondary'
                            }"
                          >
                            ${
                              statusLabel[p.status]
                                || p.status
                                || 'Unknown'
                            }
                          </span>
                        </td>

                        <td>
                          <button
                            class="btn sm"
                            onclick="app.openPromoForm(${p.id})"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')
                : `
                  <tr>
                    <td
                      colspan="9"
                      class="text-center text-muted"
                    >
                      No promotions created yet.
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
};

async function openPromoForm(id) {
  const isNew = !id;

  const defaultEndDate =
    new Date(
      Date.now() + 30 * 86400000
    )
      .toISOString()
      .slice(0, 16);

  const p = isNew
    ? {
        code: '',
        name: '',
        description: '',
        type: 'percent',
        value: 10,
        max_discount: null,
        min_order: 0,
        starts_at: null,
        ends_at: defaultEndDate,
        usage_limit: null,
        usage_limit_per_customer: null,
        stackable: false,
        customer_scope: 'all',
        allowed_channels: null,
        active: true,
      }
    : state.promotions.find(
        x => x.id === id
      );

  if (!p) {
    toast(
      'Promotion could not be found.',
      'error'
    );
    return;
  }

  const toInputDateTime = (value) => {
    if (!value) return '';

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return '';
    }

    const pad = n =>
      String(n).padStart(2, '0');

    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  };

  const channels =
    Array.isArray(p.allowed_channels)
      ? p.allowed_channels
      : [];

  openModal(`
    <div class="modal-head">
      <div>
        <h3>
          ${isNew
            ? 'New Promotion'
            : 'Edit Promotion'}
        </h3>

        <small class="text-muted">
          Configure campaign rules and redemption limits.
        </small>
      </div>

      <button
        type="button"
        class="close-btn"
        onclick="app.closeModal()"
      >
        ×
      </button>
    </div>

    <div class="modal-body">
      <form id="promoForm">

        <div class="form-section">
          <div class="form-section-title">
            Campaign Information
          </div>

          <div class="form-grid-2">
            <label>
              <span>Promotion Code *</span>

              <input
                id="promoCode"
                type="text"
                maxlength="64"
                value="${p.code || ''}"
                placeholder="WELCOME10"
                required
              >
            </label>

            <label>
              <span>Promotion Name *</span>

              <input
                id="promoName"
                type="text"
                maxlength="255"
                value="${p.name || ''}"
                placeholder="Welcome Discount"
                required
              >
            </label>
          </div>

          <label>
            <span>Description</span>

            <textarea
              id="promoDescription"
              rows="3"
              maxlength="2000"
              placeholder="Optional internal campaign description"
            >${p.description || ''}</textarea>
          </label>
        </div>

        <div class="form-section">
          <div class="form-section-title">
            Discount Rules
          </div>

          <div class="form-grid-2">
            <label>
              <span>Discount Type *</span>

              <select id="promoType">
                <option
                  value="percent"
                  ${p.type === 'percent' ? 'selected' : ''}
                >
                  Percentage
                </option>

                <option
                  value="fixed"
                  ${p.type === 'fixed' ? 'selected' : ''}
                >
                  Fixed Amount
                </option>
              </select>
            </label>

            <label>
              <span>Discount Value *</span>

              <input
                id="promoValue"
                type="number"
                min="0.01"
                step="0.01"
                value="${num(p.value)}"
                required
              >
            </label>

            <label id="promoMaxDiscountField">
              <span>Maximum Discount</span>

              <input
                id="promoMaxDiscount"
                type="number"
                min="0.01"
                step="0.01"
                value="${p.max_discount ?? ''}"
                placeholder="No limit"
              >

              <small>
                Only applies to percentage promotions.
              </small>
            </label>

            <label>
              <span>Minimum Spend</span>

              <input
                id="promoMinOrder"
                type="number"
                min="0"
                step="0.01"
                value="${num(p.min_order)}"
              >
            </label>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">
            Campaign Schedule
          </div>

          <div class="form-grid-2">
            <label>
              <span>Starts At</span>

              <input
                id="promoStartsAt"
                type="datetime-local"
                value="${toInputDateTime(p.starts_at)}"
              >

              <small>
                Leave empty to start immediately.
              </small>
            </label>

            <label>
              <span>Ends At</span>

              <input
                id="promoEndsAt"
                type="datetime-local"
                value="${toInputDateTime(p.ends_at)}"
              >

              <small>
                Leave empty for no expiry.
              </small>
            </label>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">
            Usage Limits
          </div>

          <div class="form-grid-2">
            <label>
              <span>Total Usage Limit</span>

              <input
                id="promoUsageLimit"
                type="number"
                min="1"
                step="1"
                value="${p.usage_limit ?? ''}"
                placeholder="Unlimited"
              >
            </label>

            <label>
              <span>Usage Limit Per Customer</span>

              <input
                id="promoCustomerLimit"
                type="number"
                min="1"
                step="1"
                value="${p.usage_limit_per_customer ?? ''}"
                placeholder="Unlimited"
              >
            </label>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">
            Eligibility
          </div>

          <div class="form-grid-2">
            <label>
              <span>Customer Scope</span>

              <select id="promoCustomerScope">
                <option
                  value="all"
                  ${p.customer_scope === 'all' ? 'selected' : ''}
                >
                  All Customers
                </option>

                <option
                  value="registered"
                  ${p.customer_scope === 'registered' ? 'selected' : ''}
                >
                  Registered Customers Only
                </option>
              </select>
            </label>

            <div>
              <span class="form-label">
                Allowed Channels
              </span>

              <div class="check-grid">
                <label class="check-card">
                  <input
                    type="checkbox"
                    name="promoChannel"
                    value="pos"
                    ${
                      channels.length === 0 ||
                      channels.includes('pos')
                        ? 'checked'
                        : ''
                    }
                  >
                  <span>POS</span>
                </label>

                <label class="check-card">
                  <input
                    type="checkbox"
                    name="promoChannel"
                    value="qr"
                    ${
                      channels.length === 0 ||
                      channels.includes('qr')
                        ? 'checked'
                        : ''
                    }
                  >
                  <span>QR Ordering</span>
                </label>

                <label class="check-card">
                  <input
                    type="checkbox"
                    name="promoChannel"
                    value="online"
                    ${
                      channels.length === 0 ||
                      channels.includes('online')
                        ? 'checked'
                        : ''
                    }
                  >
                  <span>Online</span>
                </label>
              </div>

              <small>
                Select all three to allow the promotion everywhere.
              </small>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">
            Campaign Settings
          </div>

          <div class="check-grid">
            <label class="check-card">
              <input
                id="promoActive"
                type="checkbox"
                ${p.active ? 'checked' : ''}
              >

              <span>
                <b>Active</b>

                <small>
                  Promotion may be used when all other rules pass.
                </small>
              </span>
            </label>

            <label class="check-card">
              <input
                id="promoStackable"
                type="checkbox"
                ${p.stackable ? 'checked' : ''}
              >

              <span>
                <b>Stackable</b>

                <small>
                  Reserved for future multi-reward rules.
                </small>
              </span>
            </label>
          </div>
        </div>

        ${
          !isNew
            ? `
              <div class="promo-edit-summary">
                <div>
                  <span>Current Status</span>
                  <b>${p.status || '-'}</b>
                </div>

                <div>
                  <span>Total Redemptions</span>
                  <b>${p.usage_count ?? 0}</b>
                </div>
              </div>
            `
            : ''
        }

      </form>
    </div>

    <div class="modal-foot">

      ${
        !isNew
          ? `
            <button
              type="button"
              class="btn danger"
              onclick="app.deletePromo(${p.id})"
              style="margin-right:auto"
            >
              Delete
            </button>
          `
          : ''
      }

      <button
        type="button"
        class="btn"
        onclick="app.closeModal()"
      >
        Cancel
      </button>

      <button
        type="submit"
        form="promoForm"
        class="btn primary"
      >
        ${isNew
          ? 'Create Promotion'
          : 'Save Changes'}
      </button>

    </div>
  `, {
    size: 'lg',
  });

  const typeSelect =
    $('#promoType');

  const maxField =
    $('#promoMaxDiscountField');

  function syncDiscountType() {
    const percentage =
      typeSelect.value === 'percent';

    maxField.style.display =
      percentage ? '' : 'none';
  }

  syncDiscountType();

  typeSelect.addEventListener(
    'change',
    syncDiscountType
  );

  $('#promoForm').addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const selectedChannels = $$(
        'input[name="promoChannel"]:checked'
      ).map(input => input.value);

      if (selectedChannels.length === 0) {
        toast(
          'Select at least one allowed channel.',
          'error'
        );

        return;
      }

      const allChannelsSelected =
        selectedChannels.length === 3;

      const startsAt =
        $('#promoStartsAt').value || null;

      const endsAt =
        $('#promoEndsAt').value || null;

      if (
        startsAt &&
        endsAt &&
        new Date(endsAt) < new Date(startsAt)
      ) {
        toast(
          'End date cannot be earlier than start date.',
          'error'
        );

        return;
      }

      const usageLimitRaw =
        $('#promoUsageLimit').value;

      const customerLimitRaw =
        $('#promoCustomerLimit').value;

      const maxDiscountRaw =
        $('#promoMaxDiscount').value;

      const payload = {
        code:
          $('#promoCode')
            .value
            .trim()
            .toUpperCase(),

        name:
          $('#promoName')
            .value
            .trim(),

        description:
          $('#promoDescription')
            .value
            .trim() || null,

        type:
          $('#promoType').value,

        value:
          Number(
            $('#promoValue').value
          ),

        max_discount:
          $('#promoType').value === 'percent'
          && maxDiscountRaw
            ? Number(maxDiscountRaw)
            : null,

        min_order:
          Number(
            $('#promoMinOrder').value || 0
          ),

        starts_at:
          startsAt,

        ends_at:
          endsAt,

        usage_limit:
          usageLimitRaw
            ? Number(usageLimitRaw)
            : null,

        usage_limit_per_customer:
          customerLimitRaw
            ? Number(customerLimitRaw)
            : null,

        stackable:
          $('#promoStackable').checked,

        customer_scope:
          $('#promoCustomerScope').value,

        allowed_channels:
          allChannelsSelected
            ? null
            : selectedChannels,

        active:
          $('#promoActive').checked,
      };

      try {
        if (isNew) {
          await API.post(
            '/promotions',
            payload
          );

          toast(
            'Promotion created.'
          );
        } else {
          await API.put(
            '/promotions/' + p.id,
            payload
          );

          toast(
            'Promotion updated.'
          );
        }

        closeModal();

        route('promo');
      } catch (err) {
        const errors =
          err.payload?.errors;

        let msg =
          err.payload?.message
          || 'Save failed';

        if (errors) {
          const first =
            Object.values(errors)
              .flat()[0];

          if (first) {
            msg = first;
          }
        }

        toast(
          msg,
          'error'
        );
      }
    }
  );
}

async function deletePromo(id) {
  if (
    !confirm(
      'Delete this promotion? ' +
      'Historical redemption records will remain preserved.'
    )
  ) {
    return;
  }

  try {
    await API.delete(
      '/promotions/' + id
    );

    toast(
      'Promotion deleted.'
    );

    closeModal();

    route('promo');
  } catch (err) {
    toast(
      err.payload?.message
      || 'Delete failed',
      'error'
    );
  }
}

VIEWS.refund = async (root) => {
  const refunds = await API.get('/refunds');
  root.innerHTML = `<div class="card"><table class="data">
    <thead><tr><th>Refund #</th><th>Order #</th><th>Date</th><th class="text-right">Amount</th><th>Reason</th><th>Status</th><th>By</th></tr></thead>
    <tbody>${refunds.map(r=>`<tr>
      <td><b>${r.refund_no}</b></td>
      <td>${r.order?.order_no||'-'}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td class="text-right"><b>${money(r.amount)}</b></td>
      <td>${r.reason||''}</td>
      <td><span class="badge badge-${r.status==='approved'?'success':'warn'}">${r.status}</span></td>
      <td>${r.user?.username||'-'}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted">No refunds yet</td></tr>'}</tbody>
  </table></div>`;
};

VIEWS.users = async (root) => {
  const [users, roles] = await Promise.all([API.get('/users'), API.get('/roles')]);
  state._usersCache = users;
  state._rolesCache = roles;
  root.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="users">Users (${users.length})</button>
      <button class="tab" data-tab="roles">Roles & Permissions (${roles.length})</button>
    </div>
    <div id="userBody"></div>`;
  $$('.tabs .tab').forEach(t => t.addEventListener('click', () => {
    $$('.tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    renderTab(t.dataset.tab);
  }));
  renderTab('users');

  function renderTab(tab) {
    if (tab === 'users') {
      $('#userBody').innerHTML = `
        <div class="toolbar"><button class="btn primary" onclick="app.openUserForm()">+ New User</button></div>
        <div class="card"><table class="data">
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>${users.map(u=>{
            const allRoles = (u.roles && u.roles.length) ? u.roles : (u.role ? [u.role] : []);
            const roleBadges = allRoles.map(r => {
              const isPrimary = r.id === u.role_id;
              return `<span class="badge ${isPrimary?'badge-info':'badge-purple'}" style="margin:1px" title="${isPrimary?'Primary role':'Additional role'}">${r.name}${isPrimary && allRoles.length>1?' ★':''}</span>`;
            }).join('') || '-';
            return `<tr>
              <td><b>${u.name}</b></td>
              <td><code>${u.username}</code></td>
              <td>${u.email}</td>
              <td>${u.phone||'-'}</td>
              <td>${roleBadges}</td>
              <td><span class="badge ${u.active?'badge-success':'badge-danger'}">${u.active?'Active':'Inactive'}</span></td>
              <td><button class="btn sm" onclick="app.openUserForm(${u.id})">Edit</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>`;
    } else {
      $('#userBody').innerHTML = `<div class="card"><table class="data">
        <thead><tr><th>Role</th><th>Permissions</th><th>Users</th></tr></thead>
        <tbody>${roles.map(r=>`<tr><td><b>${r.name}</b></td><td>${(r.permissions||[]).includes('*')?'<span class="badge badge-purple">All Access</span>':(r.permissions||[]).map(p=>`<span class="badge badge-info" style="margin:2px">${p}</span>`).join('')}</td><td>${r.users_count||0}</td></tr>`).join('')}</tbody>
      </table></div>`;
    }
  }
};

async function openUserForm(id) {
  const isNew = !id;
  const roles = state._rolesCache;
  const u = isNew
    ? { name:'', username:'', email:'', phone:'', role_id: 3, roles: [], active: true }
    : state._usersCache.find(x => x.id === id);
  // Set of role IDs this user currently holds (across primary + additional)
  const heldIds = new Set(
    ((u.roles && u.roles.length) ? u.roles.map(r => r.id) : [u.role_id]).filter(Boolean)
  );
  const rolesChecklist = roles.map(r =>
    `<label class="role-pick" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin:4px 0;cursor:pointer">
      <input type="checkbox" class="uRoleChk" value="${r.id}" ${heldIds.has(r.id)?'checked':''}>
      <span style="flex:1"><b>${r.name}</b><br><small class="text-muted">${(r.permissions||[]).includes('*')?'All access':(r.permissions||[]).join(', ')}</small></span>
    </label>`
  ).join('');
  openModal(`
    <div class="modal-head"><h3>${isNew?'New User':'Edit User'}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="field"><label>Full Name</label><input id="uName" value="${u.name}"></div>
        <div class="field"><label>Username</label><input id="uUser" value="${u.username}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Password ${isNew?'':'(leave blank to keep current)'}</label><input id="uPass" type="password" placeholder="${isNew?'Required':'Unchanged'}"></div>
        <div class="field"><label>Email</label><input id="uEmail" type="email" value="${u.email||''}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Phone</label><input id="uPhone" value="${u.phone||''}"></div>
        <div class="field"><label>Primary Role <small class="text-muted">(shown in sidebar)</small></label><select id="uRole">${roles.map(r=>`<option value="${r.id}" ${r.id===u.role_id?'selected':''}>${r.name}</option>`).join('')}</select></div>
      </div>
      <div class="field">
        <label>Assigned Roles <small class="text-muted">(a user can hold more than one — permissions are merged)</small></label>
        ${rolesChecklist}
      </div>
      <div class="field"><label><input type="checkbox" id="uActive" ${u.active?'checked':''}> Active</label></div>
    </div>
    <div class="modal-foot">
      ${!isNew && u.id !== currentUser.id ? `<button class="btn danger" onclick="app.deleteUser(${id})">🗑 Delete</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="saveUser">${isNew?'Create':'Save'}</button>
    </div>`);
  // Ensure the primary role is always among the checked additional roles
  $('#uRole').addEventListener('change', () => {
    const primary = +$('#uRole').value;
    $$('.uRoleChk').forEach(cb => { if (+cb.value === primary) cb.checked = true; });
  });
  $('#saveUser').addEventListener('click', async () => {
    const name = $('#uName').value.trim();
    const un = $('#uUser').value.trim();
    if (!name || !un) { toast('Name and username required', 'error'); return; }
    const pass = $('#uPass').value;
    if (isNew && !pass) { toast('Password required', 'error'); return; }
    const primaryRole = +$('#uRole').value;
    const roleIds = $$('.uRoleChk').filter(cb => cb.checked).map(cb => +cb.value);
    if (!roleIds.includes(primaryRole)) roleIds.push(primaryRole);
    const body = {
      name, username: un,
      email: $('#uEmail').value, phone: $('#uPhone').value,
      role_id: primaryRole,
      role_ids: roleIds,
      active: $('#uActive').checked,
    };
    if (pass) body.password = pass;
    try {
      if (isNew) await API.post('/users', body);
      else       await API.put('/users/' + id, body);
      toast('Saved'); closeModal(); route('users');
    } catch (err) {
      const msg = err.payload?.errors?.username?.[0]
               || err.payload?.errors?.email?.[0]
               || err.payload?.message || 'Save failed';
      toast(msg, 'error');
    }
  });
}
async function deleteUser(id) {
  if (id === currentUser.id) { toast('You cannot delete your own account', 'error'); return; }
  if (!confirm('Soft-delete this user? They will be hidden but kept for audit.')) return;
  try { await API.delete('/users/' + id); toast('Deleted'); closeModal(); route('users'); }
  catch (err) { toast(err.payload?.message || 'Delete failed', 'error'); }
}

/* ===== APP INIT ===== */
window.app = {
  route,
  closeModal,
  viewOrder: viewOrderDetail,
  takePayment: takePaymentForOrder,
  reprintReceipt: reprintOrderReceipt,
  androidPrintSuccess,
  androidPrintFailed,
  initRefund,
  // Menu
  openProductForm,
  deleteProduct,
  openProductConfigurator,
  openOptionGroupForm,
  deleteOptionGroup,
  openOptionValueForm,
  deleteOptionValue,
  openVariantForm,
  deleteVariant,
  openCategoryForm,
  deleteCategory,
  openAddonForm,
  deleteAddon,
  // Customers
  openCustomerForm, deleteCustomer,
  // Tables
  openTableForm, deleteTable,
  // Promotions
  openPromoForm, deletePromo,
  // Suppliers + Purchase
  openSupplierForm, deleteSupplier,
  receivePurchase,
  openPurchaseOrderForm,
  viewPurchaseOrder,
  reorderInventory,
  // Inventory
  openInventoryForm, deleteInventory,
  adjustStock,
  openStocktake,
  // Users
  openUserForm, deleteUser,
};

document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (!confirm('Sign out?')) return;
  try { await API.logout(); } catch (e) { /* ignore */ }
  API.clearSession();
  location.href = 'staff.html';
});

(async function init() {
  renderNav();
  updateClock(); setInterval(updateClock, 30000);
  await loadInitial();
  const defaultRoute = hasPermission('dashboard') ? 'dashboard'
                     : hasPermission('kds')       ? 'kds'
                     : hasPermission('pos')       ? 'pos'
                     : 'audit';
  route(defaultRoute);
})();
