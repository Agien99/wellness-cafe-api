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
  membershipTiers: [
    { name: 'Bronze',   minSpend: 0,    discount: 0,    benefit: '1 pt per RM1' },
    { name: 'Silver',   minSpend: 100,  discount: 0.05, benefit: '5% off + 1.2x pts' },
    { name: 'Gold',     minSpend: 300,  discount: 0.08, benefit: '8% off + 1.5x pts' },
    { name: 'Platinum', minSpend: 800,  discount: 0.12, benefit: '12% off + 2x pts' },
  ],
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

// ---------- Initial data load ---------- //
async function loadInitial() {
  try {
    const [menu, tables, customers, promos] = await Promise.all([
      API.get('/menu'),
      API.get('/tables'),
      API.get('/customers'),
      API.get('/promotions'),
    ]);
    state.categories = menu.categories;
    state.products   = menu.products.map(p => ({ ...p, price: num(p.price), cost: num(p.cost) }));
    state.tables     = tables;
    state.customers  = customers;
    state.promotions = promos;
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
  if (PERM_MAP[key] && !hasPermission(PERM_MAP[key])) {
    toast("You don't have permission for this module.", 'error');
    return;
  }
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
  cart: [], categoryId: null, customerId: 8,
  tableId: null, channel: 'pos', promoCode: null,
};

VIEWS.pos = async (root) => {
  if (pos.categoryId === null) pos.categoryId = state.categories[0]?.id;
  root.innerHTML = `
    <div class="pos-layout">
      <div class="pos-products">
        <div class="category-bar" id="catBar"></div>
        <div class="product-grid" id="prodGrid"></div>
      </div>
      <div class="pos-cart">
        <div class="cart-head">
          <h3>🛒 Order Cart</h3>
          <button class="btn-icon" id="clearCart" title="Clear cart">🗑</button>
        </div>
        <div class="cart-meta">
          <div><label>Customer</label>
            <select id="custSel">
              ${state.customers.map(c=>`<option value="${c.id}" ${c.id===pos.customerId?'selected':''}>${c.name}${c.membership!=='None'?' ('+c.membership+')':''}</option>`).join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><label>Channel</label>
              <select id="chanSel">
                <option value="pos" ${pos.channel==='pos'?'selected':''}>Dine-in / POS</option>
                <option value="qr" ${pos.channel==='qr'?'selected':''}>QR Order</option>
                <option value="online" ${pos.channel==='online'?'selected':''}>Online / Pickup</option>
              </select>
            </div>
            <div><label>Table</label>
              <select id="tableSel">
                <option value="">- none -</option>
                ${state.tables.map(t=>`<option value="${t.id}" ${t.id===pos.tableId?'selected':''}>${t.name} (${t.capacity})</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="cart-items" id="cartItems"></div>
        <div class="cart-summary" id="cartSum"></div>
        <div class="cart-actions">
          <button class="btn block" id="parkOrder">Park</button>
          <button class="btn primary block lg" id="payBtn">💳 Pay</button>
        </div>
      </div>
    </div>`;

  renderCategoryBar(); renderProductGrid(); renderCart();

  $('#custSel').addEventListener('change', e => { pos.customerId = +e.target.value; renderCart(); });
  $('#chanSel').addEventListener('change', e => { pos.channel = e.target.value; });
  $('#tableSel').addEventListener('change', e => { pos.tableId = e.target.value ? +e.target.value : null; });
  $('#clearCart').addEventListener('click', () => { pos.cart = []; renderCart(); });
  $('#parkOrder').addEventListener('click', () => { pos.cart = []; renderCart(); toast('Order parked.', 'success'); });
  $('#payBtn').addEventListener('click', openPayModal);

  function renderCategoryBar() {
    $('#catBar').innerHTML = state.categories.map(c =>
      `<button class="cat-btn ${c.id===pos.categoryId?'active':''}" data-id="${c.id}">${c.icon} ${c.name}</button>`
    ).join('');
    $$('#catBar .cat-btn').forEach(b => b.addEventListener('click', () => {
      pos.categoryId = +b.dataset.id; renderCategoryBar(); renderProductGrid();
    }));
  }
  function renderProductGrid() {
    const products = state.products.filter(p => p.category_id === pos.categoryId);
    $('#prodGrid').innerHTML = products.map(p => {
      const visual = p.image_url
        ? `<img src="${p.image_url}" style="width:60px;height:60px;border-radius:8px;object-fit:cover">`
        : (p.image || '🍽');
      return `<div class="product-card ${p.available?'':'unavail'}" data-id="${p.id}">
        <div class="img">${visual}</div>
        <div class="name">${p.name}</div>
        <div class="price">${money(p.price)}</div>
      </div>`;
    }).join('');
    $$('#prodGrid .product-card').forEach(card => card.addEventListener('click', () => {
      const p = state.products.find(x => x.id === +card.dataset.id);
      if (!p || !p.available) { toast('Item not available', 'warn'); return; }
      const ex = pos.cart.find(x => x.productId === p.id);
      if (ex) ex.qty += 1;
      else pos.cart.push({ productId: p.id, name: p.name, price: p.price, qty: 1 });
      renderCart();
    }));
  }
  function renderCart() {
    if (pos.cart.length === 0) {
      $('#cartItems').innerHTML = '<div class="cart-empty"><span class="emoji">🛒</span>Cart is empty</div>';
      $('#cartSum').innerHTML = `
        <div class="sum-line"><span>Subtotal</span><span>${money(0)}</span></div>
        <div class="sum-line"><span>Tax (${(state.meta.taxRate*100).toFixed(0)}%)</span><span>${money(0)}</span></div>
        <div class="sum-line total"><span>Total</span><span>${money(0)}</span></div>`;
      return;
    }
    $('#cartItems').innerHTML = pos.cart.map((it,idx)=>`
      <div class="cart-item">
        <div class="info"><b>${it.name}</b><small>${money(it.price)} × ${it.qty} = ${money(it.price*it.qty)}</small></div>
        <div class="qty-ctrl">
          <button data-act="dec" data-i="${idx}">−</button>
          <span>${it.qty}</span>
          <button data-act="inc" data-i="${idx}">+</button>
          <button data-act="rem" data-i="${idx}" style="margin-left:4px;background:#fee2e2;color:#991b1b">×</button>
        </div>
      </div>`).join('');
    $$('#cartItems button').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i, act = b.dataset.act;
      if (act==='inc') pos.cart[i].qty += 1;
      else if (act==='dec') { if (pos.cart[i].qty>1) pos.cart[i].qty -= 1; }
      else if (act==='rem') pos.cart.splice(i,1);
      renderCart();
    }));
    const sub = pos.cart.reduce((s,x) => s + x.price * x.qty, 0);
    const customer = state.customers.find(c => c.id === pos.customerId);
    const tier = state.membershipTiers.find(t => t.name === customer.membership);
    const memberDisc = tier ? sub * tier.discount : 0;
    const promoDisc = computePromoDiscount(sub);
    const totalDisc = memberDisc + promoDisc;
    const taxBase = Math.max(0, sub - totalDisc);
    const tax = taxBase * state.meta.taxRate;
    const total = taxBase + tax;
    pos._calc = { sub, memberDisc, promoDisc, tax, total };

    $('#cartSum').innerHTML = `
      <div class="sum-line"><span>Subtotal</span><span>${money(sub)}</span></div>
      ${memberDisc>0?`<div class="sum-line" style="color:#059669"><span>Member discount (${(tier.discount*100).toFixed(0)}%)</span><span>−${money(memberDisc)}</span></div>`:''}
      ${promoDisc>0?`<div class="sum-line" style="color:#059669"><span>Promo (${pos.promoCode})</span><span>−${money(promoDisc)}</span></div>`:''}
      <div class="sum-line"><span>Tax (${(state.meta.taxRate*100).toFixed(0)}%)</span><span>${money(tax)}</span></div>
      <div class="sum-line total"><span>Total</span><span>${money(total)}</span></div>`;
  }
  function computePromoDiscount(sub) {
    if (!pos.promoCode) return 0;
    const promo = state.promotions.find(p => p.code === pos.promoCode && p.active);
    if (!promo) return 0;
    if (sub < num(promo.min_order)) return 0;
    if (promo.type === 'percent') return r2(sub * num(promo.value) / 100);
    return num(promo.value);
  }

  function openPayModal() {
    if (pos.cart.length === 0) { toast('Cart is empty', 'warn'); return; }
    const total = pos._calc.total;
    openModal(`
      <div class="modal-head">
        <h3>💳 Process Payment — ${money(total)}</h3>
        <button class="close-btn" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="alert alert-info" style="margin-bottom:12px">Customer: <b>${state.customers.find(c=>c.id===pos.customerId).name}</b> · Channel: <b>${pos.channel.toUpperCase()}</b></div>
        <div class="section-title">Promo Code (Optional)</div>
        <div class="flex gap-2 mb-4">
          <input type="text" id="promoIn" placeholder="Enter code e.g. WELCOME10" class="search" style="flex:1" value="${pos.promoCode||''}">
          <button class="btn" id="applyPromo">Apply</button>
          ${pos.promoCode?`<button class="btn danger" id="removePromo">Remove</button>`:''}
        </div>
        <div class="section-title">Payment Method</div>
        <div class="payment-grid">
          <div class="pay-option active" data-m="cash"><span class="ico">💵</span><span class="label">Cash</span></div>
          <div class="pay-option" data-m="card"><span class="ico">💳</span><span class="label">Card</span></div>
          <div class="pay-option" data-m="ewallet"><span class="ico">📱</span><span class="label">E-Wallet</span></div>
          <div class="pay-option" data-m="qr"><span class="ico">📷</span><span class="label">QR Pay</span></div>
        </div>
        <div id="cashSection">
          <div class="section-title">Amount Received</div>
          <input type="number" id="amtRcv" class="search" style="font-size:18px;padding:14px" value="${total.toFixed(2)}" step="0.01">
          <div class="alert alert-info mt-3" style="font-size:15px">Change: <b id="changeAmt">${state.meta.currency} 0.00</b></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn primary lg" id="confirmPay">✓ Complete Sale</button>
      </div>`, {size:'lg'});

    let method = 'cash';
    $$('.pay-option').forEach(o => o.addEventListener('click', () => {
      $$('.pay-option').forEach(x => x.classList.remove('active'));
      o.classList.add('active');
      method = o.dataset.m;
      $('#cashSection').style.display = method==='cash' ? 'block' : 'none';
    }));
    $('#amtRcv').addEventListener('input', e => {
      const change = +e.target.value - total;
      $('#changeAmt').textContent = state.meta.currency + ' ' + Math.max(0,change).toFixed(2);
    });
    $('#applyPromo').addEventListener('click', async () => {
      const code = $('#promoIn').value.trim().toUpperCase();
      if (!code) return;
      try {
        const sub = pos.cart.reduce((s,x)=>s+x.price*x.qty, 0);
        const r = await API.post('/promotions/validate', { code, subtotal: sub });
        pos.promoCode = code;
        toast(r.message, 'success');
        closeModal(); renderCart(); setTimeout(openPayModal, 80);
      } catch (err) {
        toast(err.payload?.message || 'Invalid promo', 'error');
      }
    });
    if ($('#removePromo')) $('#removePromo').addEventListener('click', () => {
      pos.promoCode = null; closeModal(); renderCart(); setTimeout(openPayModal, 80);
    });
    $('#confirmPay').addEventListener('click', async () => {
      if (method==='cash') {
        const amt = +$('#amtRcv').value;
        if (amt < total) { toast('Insufficient amount', 'error'); return; }
      }
      await completeSale(method);
    });
  }

  async function completeSale(method) {
    const btn = $('#confirmPay');
    btn.disabled = true; btn.textContent = 'Processing...';
    try {
      const order = await API.post('/orders', {
        items: pos.cart.map(c => ({ product_id: c.productId, qty: c.qty })),
        customer_id: pos.customerId,
        channel: pos.channel,
        table_id: pos.tableId,
        promo_code: pos.promoCode,
        payment: { method },
      });
      closeModal();
      showReceipt(order, method);
      pos.cart = []; pos.promoCode = null; pos.tableId = null;
      // Refresh customers in case loyalty tier changed
      state.customers = await API.get('/customers');
    } catch (err) {
      btn.disabled = false; btn.textContent = '✓ Complete Sale';
      toast(err.payload?.message || err.message || 'Sale failed', 'error');
    }
  }

  function showReceipt(order, method) {
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
      ${order.items.map(it=>`<div>
        <div class="item-row"><b>${it.name}</b><span></span></div>
        <div class="item-row"><span>  ${it.qty} x ${state.meta.currency}${num(it.price).toFixed(2)}</span><span>${state.meta.currency}${(it.qty*num(it.price)).toFixed(2)}</span></div>
      </div>`).join('')}
      <div class="sep"></div>
      <div class="row"><span>Subtotal</span><span>${state.meta.currency}${num(order.subtotal).toFixed(2)}</span></div>
      ${num(order.discount)>0?`<div class="row"><span>Discount</span><span>-${state.meta.currency}${num(order.discount).toFixed(2)}</span></div>`:''}
      <div class="row"><span>Tax (${(state.meta.taxRate*100).toFixed(0)}%)</span><span>${state.meta.currency}${num(order.tax).toFixed(2)}</span></div>
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
        <button class="btn primary" onclick="closeModal();app.route('pos')">New Sale</button>
      </div>`);
  }
};

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

function kdsCard(o, isNew = false) {
  const next = o.kitchen_status==='pending' ? 'preparing' : o.kitchen_status==='preparing' ? 'ready' : 'completed';
  const btnLabel = o.kitchen_status==='pending'?'Start Preparing':o.kitchen_status==='preparing'?'Mark Ready':'Mark Picked Up';
  return `<div class="kds-card ${o.kitchen_status} ${isNew?'kds-new':''}">
    <div class="head">
      <div><b>${o.order_no}</b> ${isNew?'<span class="badge badge-success" style="margin-left:6px">NEW</span>':''}<div style="font-size:11.5px;color:#6b7280">${o.channel.toUpperCase()}${o.table_id?' · '+(o.table?.name||''):''} · ${o.customer_name||''}</div></div>
      <div class="time">${fmtTimeAgo(o.created_at)}</div>
    </div>
    <ul class="kds-items">${o.items.map(it=>`<li><span><b>${it.qty}×</b> ${it.name}</span></li>`).join('')}</ul>
    <div class="kds-actions">
      <button class="btn primary block" data-id="${o.id}" data-next="${next}">${btnLabel}</button>
    </div>
  </div>`;
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
    const o = await API.get('/orders/' + orderId);
    const isPending = o.status === 'pending_payment';
    openModal(`
      <div class="modal-head"><h3>Order ${o.order_no}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <div class="alert alert-info">${fmtDate(o.created_at)} · ${o.channel.toUpperCase()}${o.table_id?' · Table '+(o.table?.name||o.table_id):''} · ${o.customer_name||''}</div>
        ${isPending ? `<div class="alert alert-warn"><b>⏳ Awaiting payment at counter</b> — total due: <b>${money(o.total)}</b></div>` : ''}
        <table class="data"><thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Subtotal</th></tr></thead>
          <tbody>${o.items.map(it=>`<tr><td>${it.name}</td><td class="text-right">${it.qty}</td><td class="text-right">${money(it.price)}</td><td class="text-right">${money(it.qty*num(it.price))}</td></tr>`).join('')}</tbody>
          <tfoot>
            <tr><td colspan="3" class="text-right">Subtotal</td><td class="text-right">${money(o.subtotal)}</td></tr>
            <tr><td colspan="3" class="text-right">Discount</td><td class="text-right">-${money(o.discount)}</td></tr>
            <tr><td colspan="3" class="text-right">Tax</td><td class="text-right">${money(o.tax)}</td></tr>
            <tr><td colspan="3" class="text-right"><b>Total</b></td><td class="text-right"><b>${money(o.total)}</b></td></tr>
          </tfoot>
        </table>
        <p class="mt-3">Status: <span class="badge badge-${o.status==='completed'?'success':o.status==='refunded'?'danger':'warn'}">${o.status}</span> · Kitchen: <span class="badge">${o.kitchen_status||'—'}</span></p>
        ${o.payment?`<p>Paid by: <b>${o.payment.method.toUpperCase()}</b> · ${o.payment.reference||''}</p>`:''}
        ${o.notes?`<p class="text-muted"><b>Notes:</b> ${o.notes}</p>`:''}
      </div>
      <div class="modal-foot">
        ${isPending ? `<button class="btn primary lg" onclick="app.takePayment(${o.id})">💳 Take Payment</button>` : ''}
        ${o.status==='completed'?`<button class="btn danger" onclick="app.initRefund(${o.id})">↩ Refund</button>`:''}
        <button class="btn" onclick="closeModal()">Close</button>
      </div>`);
  } catch (err) {
    toast('Could not load order', 'error');
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
        Customer: <b>${o.customer_name||'Walk-in'}</b>
        ${o.table_id?' · Table '+(o.table?.name||o.table_id):''}
        · ${o.items.length} item(s)
      </div>
      <div style="text-align:center;font-size:28px;font-weight:800;color:#064e3b;margin:18px 0">
        Total Due: ${money(total)}
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
    if (method === 'cash') {
      const amt = +$('#amtRcv2').value;
      if (amt < total) { toast('Insufficient amount', 'error'); return; }
    }
    const btn = $('#confirmTakePay');
    btn.disabled = true; btn.textContent = 'Processing...';
    try {
      const order = await API.post(`/orders/${o.id}/payment`, { method });
      toast(`Payment received: ${method.toUpperCase()} ${money(total)}`);
      closeModal();
      showCounterReceipt(order, method);
      // Refresh customer cache (loyalty may have changed)
      state.customers = await API.get('/customers');
    } catch (err) {
      btn.disabled = false; btn.textContent = '✓ Confirm Payment';
      toast(err.payload?.message || 'Payment failed', 'error');
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
    ${order.items.map(it=>`<div>
      <div class="item-row"><b>${it.name}</b><span></span></div>
      <div class="item-row"><span>  ${it.qty} x ${state.meta.currency}${num(it.price).toFixed(2)}</span><span>${state.meta.currency}${(it.qty*num(it.price)).toFixed(2)}</span></div>
    </div>`).join('')}
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
              <button class="btn sm primary" onclick="app.adjustStock(${i.id},'${i.name.replace(/'/g,"\\'")}','${i.unit}')">Adjust</button>
              <button class="btn sm" onclick="app.openInventoryForm(${i.id})">Edit</button>
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
  const tiers = state.membershipTiers;
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
      <div class="card-header"><h3>Loyalty Tier Benefits</h3></div>
      <table class="data">
        <thead><tr><th>Tier</th><th>Min Spend</th><th>Discount</th><th>Benefit</th></tr></thead>
        <tbody>${tiers.map(t=>`<tr><td><b>${t.name}</b></td><td>${money(t.minSpend)}</td><td>${(t.discount*100).toFixed(0)}%</td><td>${t.benefit}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
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

async function openCustomerForm(id) {
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
        <div class="field"><label>Tier</label><select id="cTier">${state.membershipTiers.map(t=>`<option value="${t.name}" ${t.name===c.membership?'selected':''}>${t.name}</option>`).join('')}</select></div>
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
      if (isNew) await API.post('/customers', body);
      else       await API.put('/customers/' + id, body);
      toast('Saved'); closeModal(); route('customer');
    } catch (err) {
      toast(err.payload?.message || 'Save failed', 'error');
    }
  });
}
async function deleteCustomer(id) {
  if (!confirm('Soft-delete this customer?')) return;
  try { await API.delete('/customers/' + id); toast('Deleted'); closeModal(); route('customer'); }
  catch (err) { toast(err.payload?.message || 'Delete failed', 'error'); }
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

/* ===== MENU & PRODUCTS (full CRUD) ===== */
VIEWS.menu = async (root) => {
  const [cats, prods] = await Promise.all([API.get('/categories'), API.get('/products')]);
  state.categories = cats;
  state.products = prods.map(p => ({ ...p, price: num(p.price), cost: num(p.cost) }));

  root.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="prod">Products (${prods.length})</button>
      <button class="tab" data-tab="cat">Categories (${cats.length})</button>
    </div>
    <div id="menuBody"></div>`;
  $$('.tabs .tab').forEach(t => t.addEventListener('click', () => {
    $$('.tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    renderTab(t.dataset.tab);
  }));
  renderTab('prod');

  function renderTab(tab) {
    const body = $('#menuBody');
    if (tab === 'prod') {
      body.innerHTML = `
        <div class="toolbar">
          <input class="search" id="prodSearch" placeholder="🔍 Search products">
          <select id="prodCat"><option value="">All categories</option>${cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select>
          <button class="btn primary" onclick="app.openProductForm()">+ Add Product</button>
        </div>
        <div class="card"><div id="prodTable"></div></div>`;
      const draw = () => {
        const q = $('#prodSearch').value.toLowerCase();
        const fc = $('#prodCat').value;
        let rows = state.products.slice();
        if (q) rows = rows.filter(p => p.name.toLowerCase().includes(q));
        if (fc) rows = rows.filter(p => p.category_id === +fc);
        $('#prodTable').innerHTML = `<table class="data">
          <thead><tr><th></th><th>Product</th><th>Category</th><th class="text-right">Price</th><th class="text-right">Cost</th><th class="text-right">Margin</th><th>Available</th><th></th></tr></thead>
          <tbody>${rows.map(p => {
            const cat = cats.find(c => c.id === p.category_id);
            const margin = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : '0';
            const visual = p.image_url
              ? `<img src="${p.image_url}" style="width:40px;height:40px;border-radius:6px;object-fit:cover">`
              : `<span style="font-size:24px">${p.image||'🍽'}</span>`;
            return `<tr>
              <td>${visual}</td>
              <td><b>${p.name}</b></td>
              <td>${cat ? cat.icon + ' ' + cat.name : '-'}</td>
              <td class="text-right">${money(p.price)}</td>
              <td class="text-right text-muted">${money(p.cost)}</td>
              <td class="text-right"><b>${margin}%</b></td>
              <td><span class="badge ${p.available ? 'badge-success' : 'badge-danger'}">${p.available ? 'Available' : 'Off Menu'}</span></td>
              <td><button class="btn sm" onclick="app.openProductForm(${p.id})">Edit</button></td>
            </tr>`;
          }).join('') || '<tr><td colspan="8" class="text-center text-muted">No products</td></tr>'}</tbody>
        </table>`;
      };
      draw();
      $('#prodSearch').addEventListener('input', draw);
      $('#prodCat').addEventListener('change', draw);
    } else {
      body.innerHTML = `
        <div class="toolbar">
          <button class="btn primary" onclick="app.openCategoryForm()">+ Add Category</button>
        </div>
        <div class="card"><table class="data">
          <thead><tr><th>Icon</th><th>Name</th><th class="text-right">Sort</th><th class="text-right">Products</th><th></th></tr></thead>
          <tbody>${cats.map(c=>{
            const cnt = state.products.filter(p => p.category_id === c.id).length;
            return `<tr>
              <td style="font-size:24px">${c.icon}</td>
              <td><b>${c.name}</b></td>
              <td class="text-right">${c.sort_order}</td>
              <td class="text-right">${cnt}</td>
              <td><button class="btn sm" onclick="app.openCategoryForm(${c.id})">Edit</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>`;
    }
  }
};

async function openProductForm(id) {
  const isNew = !id;
  const cats = state.categories;
  const p = isNew
    ? { name:'', category_id: cats[0]?.id, price: 0, cost: 0, size:'', image:'🍽', image_url: null, available: true }
    : state.products.find(x => x.id === id);
  openModal(`
    <div class="modal-head"><h3>${isNew?'New Product':'Edit Product'}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="field"><label>Name</label><input id="pName" value="${p.name}"></div>
        <div class="field"><label>Category</label><select id="pCat">${cats.map(c=>`<option value="${c.id}" ${c.id===p.category_id?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></div>
      </div>
      <div class="form-row three">
        <div class="field"><label>Price (RM)</label><input id="pPrice" type="number" step="0.01" value="${p.price}"></div>
        <div class="field"><label>Cost (RM)</label><input id="pCost" type="number" step="0.01" value="${p.cost}"></div>
        <div class="field"><label>Size</label><input id="pSize" value="${p.size||''}" placeholder="S / M / Iced / -"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Emoji (fallback when no photo)</label><input id="pImg" maxlength="2" value="${p.image||'🍽'}"></div>
        <div class="field"><label>&nbsp;</label><label><input type="checkbox" id="pAvail" ${p.available?'checked':''}> Available on menu</label></div>
      </div>

      ${!isNew ? `
      <div class="section-title mt-3">Product Photo</div>
      <div style="display:flex;align-items:center;gap:14px;padding:10px;background:#f9fafb;border-radius:10px">
        <div id="pImgPreview" style="width:80px;height:80px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:38px;border:1.5px dashed #d1d5db;overflow:hidden">
          ${p.image_url
            ? `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover">`
            : (p.image || '🍽')}
        </div>
        <div style="flex:1">
          <input type="file" id="pImgFile" accept="image/png,image/jpeg,image/webp,image/gif" style="font-size:13px">
          <div class="text-muted" style="font-size:11px;margin-top:4px">PNG / JPG / WebP, up to 4 MB. Square images look best.</div>
        </div>
        ${p.image_url ? `<button class="btn sm danger" id="pImgRemove">Remove</button>` : ''}
      </div>
      ` : '<div class="alert alert-info mt-3" style="font-size:12px">💡 Save the product first, then re-open it to upload a photo.</div>'}
    </div>
    <div class="modal-foot">
      ${!isNew?`<button class="btn danger" onclick="app.deleteProduct(${id})">🗑 Delete</button>`:''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="saveProd">${isNew?'Create':'Save'}</button>
    </div>`, {size:'lg'});

  // --- Image upload handlers (only for existing products) ---
  if (!isNew) {
    const fileInput = $('#pImgFile');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
          toast('File too large (max 4 MB)', 'error');
          fileInput.value = '';
          return;
        }
        try {
          await API.upload(`/products/${id}/image`, file, 'image');
          toast('Photo uploaded'); closeModal(); route('menu');
        } catch (err) {
          toast(err.payload?.message || 'Upload failed', 'error');
        }
      });
    }
    const removeBtn = $('#pImgRemove');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        if (!confirm('Remove this photo? The product will fall back to its emoji icon.')) return;
        try {
          await API.delete(`/products/${id}/image`);
          toast('Photo removed'); closeModal(); route('menu');
        } catch (err) {
          toast(err.payload?.message || 'Remove failed', 'error');
        }
      });
    }
  }

  $('#saveProd').addEventListener('click', async () => {
    const name = $('#pName').value.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    const body = {
      name,
      category_id: +$('#pCat').value,
      price: +$('#pPrice').value,
      cost: +$('#pCost').value,
      size: $('#pSize').value || null,
      image: $('#pImg').value || '🍽',
      available: $('#pAvail').checked,
    };
    try {
      if (isNew) await API.post('/products', body);
      else       await API.put('/products/' + id, body);
      toast('Saved');
      closeModal();
      route('menu');
    } catch (err) {
      toast(err.payload?.message || 'Save failed', 'error');
    }
  });
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
    if (tab==='po') {
      $('#poBody').innerHTML = `
        <div class="card"><table class="data">
          <thead><tr><th>PO #</th><th>Date</th><th>Supplier</th><th class="text-right">Total</th><th>Status</th><th></th></tr></thead>
          <tbody>${pos.map(p=>`<tr>
            <td><b>${p.po_no}</b></td>
            <td>${fmtDate(p.created_at,false)}</td>
            <td>${p.supplier?.name||'-'}</td>
            <td class="text-right"><b>${money(p.total)}</b></td>
            <td><span class="badge badge-${p.status==='received'?'success':'warn'}">${p.status}</span></td>
            <td>${p.status==='pending'?`<button class="btn sm primary" onclick="app.receivePurchase(${p.id})">Receive</button>`:''}</td>
          </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">No purchase orders</td></tr>'}</tbody>
        </table></div>`;
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
  root.innerHTML = `
    <div class="toolbar"><button class="btn primary" onclick="app.openPromoForm()">+ New Promotion</button></div>
    <div class="card"><table class="data">
      <thead><tr><th>Code</th><th>Name</th><th>Type</th><th class="text-right">Value</th><th class="text-right">Min Order</th><th>Valid Till</th><th>Status</th><th></th></tr></thead>
      <tbody>${promos.map(p=>`<tr>
        <td><code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;font-weight:600">${p.code}</code></td>
        <td>${p.name}</td>
        <td><span class="badge badge-info">${p.type}</span></td>
        <td class="text-right">${p.type==='percent'?p.value+'%':money(p.value)}</td>
        <td class="text-right">${money(p.min_order)}</td>
        <td>${p.valid_till||'-'}</td>
        <td><span class="badge ${p.active?'badge-success':'badge-danger'}">${p.active?'Active':'Inactive'}</span></td>
        <td><button class="btn sm" onclick="app.openPromoForm(${p.id})">Edit</button></td>
      </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted">No promotions</td></tr>'}</tbody>
    </table></div>`;
};

async function openPromoForm(id) {
  const isNew = !id;
  const p = isNew
    ? { code:'', name:'', type:'percent', value: 10, min_order: 0, valid_till: new Date(Date.now()+30*86400000).toISOString().split('T')[0], active: true }
    : state.promotions.find(x => x.id === id);
  openModal(`
    <div class="modal-head"><h3>${isNew?'New Promotion':'Edit Promotion'}</h3><button class="close-btn" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-row">
        <div class="field"><label>Code</label><input id="pCode" value="${p.code}" style="text-transform:uppercase"></div>
        <div class="field"><label>Name</label><input id="pName" value="${p.name}"></div>
      </div>
      <div class="form-row three">
        <div class="field"><label>Type</label><select id="pType"><option value="percent" ${p.type==='percent'?'selected':''}>Percent (%)</option><option value="fixed" ${p.type==='fixed'?'selected':''}>Fixed (RM)</option></select></div>
        <div class="field"><label>Value</label><input id="pVal" type="number" step="0.01" value="${p.value}"></div>
        <div class="field"><label>Min Order</label><input id="pMin" type="number" step="0.01" value="${p.min_order}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Valid Till</label><input id="pTill" type="date" value="${p.valid_till||''}"></div>
        <div class="field"><label>&nbsp;</label><label><input type="checkbox" id="pActive" ${p.active?'checked':''}> Active</label></div>
      </div>
    </div>
    <div class="modal-foot">
      ${!isNew?`<button class="btn danger" onclick="app.deletePromo(${id})">🗑 Delete</button>`:''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn primary" id="savePromo">${isNew?'Create':'Save'}</button>
    </div>`);
  $('#savePromo').addEventListener('click', async () => {
    const body = {
      code: $('#pCode').value.trim().toUpperCase(),
      name: $('#pName').value.trim(),
      type: $('#pType').value,
      value: +$('#pVal').value,
      min_order: +$('#pMin').value,
      valid_till: $('#pTill').value || null,
      active: $('#pActive').checked,
    };
    if (!body.code || !body.name) { toast('Code and name required', 'error'); return; }
    try {
      if (isNew) await API.post('/promotions', body);
      else       await API.put('/promotions/' + id, body);
      toast('Saved'); closeModal(); route('promo');
    } catch (err) {
      const msg = err.payload?.errors?.code?.[0] || err.payload?.message || 'Save failed';
      toast(msg, 'error');
    }
  });
}
async function deletePromo(id) {
  if (!confirm('Soft-delete this promotion?')) return;
  try { await API.delete('/promotions/' + id); toast('Deleted'); closeModal(); route('promo'); }
  catch (err) { toast(err.payload?.message || 'Delete failed', 'error'); }
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
  viewOrder: viewOrderDetail,
  takePayment: takePaymentForOrder,
  initRefund,
  // Menu
  openProductForm, deleteProduct,
  openCategoryForm, deleteCategory,
  // Customers
  openCustomerForm, deleteCustomer,
  // Tables
  openTableForm, deleteTable,
  // Promotions
  openPromoForm, deletePromo,
  // Suppliers + Purchase
  openSupplierForm, deleteSupplier,
  receivePurchase,
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
