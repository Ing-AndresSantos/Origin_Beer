requireAuth();

document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('dashboard');
initDate();

const user = getUser();
document.getElementById('bannerName').textContent = user.firstName || 'Admin';
document.getElementById('bannerDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// ── USERS ─────────────────────────────────────────────────────
async function loadStats() {
    const users = await apiFetch('/api/users');
    if (users) {
        const active = users.filter(u => u.active).length;
        document.getElementById('statUsers').textContent  = active;
        document.getElementById('trendUsers').textContent = `↑ ${users.length} total`;

        const list = document.getElementById('listUsers');
        if (!users.length) {
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">👥</span><p>No users registered</p></div>`;
        } else {
            list.innerHTML = users.slice(0, 5).map(u => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">${(u.firstName || '?').charAt(0)}${(u.lastName || '?').charAt(0)}</div>
                        <div>
                            <div class="list-name">${u.firstName} ${u.lastName}</div>
                            <div class="list-sub">${u.email}</div>
                        </div>
                    </div>
                    <span class="badge badge-${(u.role?.name || 'admin').toLowerCase()}">${u.role?.name || '—'}</span>
                </div>
            `).join('');
        }
    } else {
        document.getElementById('statUsers').textContent = '—';
    }
}

// ── BRANCHES ──────────────────────────────────────────────────
async function loadBranches() {
    const branches = await apiFetch('/api/branches');
    if (branches) {
        const active = branches.filter(b => b.active).length;
        document.getElementById('statBranches').textContent  = active;
        document.getElementById('trendBranches').textContent = `↑ ${branches.length} registered`;

        const list = document.getElementById('listBranches');
        list.innerHTML = !branches.length
            ? `<div class="empty-state"><span class="empty-icon">🏢</span><p>No branches registered</p></div>`
            : branches.slice(0, 5).map(b => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">🏢</div>
                        <div>
                            <div class="list-name">${b.name}</div>
                            <div class="list-sub">${b.city || '—'} · ${b.code}</div>
                        </div>
                    </div>
                    <span class="badge ${b.active ? 'badge-active' : 'badge-inactive'}">${b.active ? 'Active' : 'Inactive'}</span>
                </div>
            `).join('');
    } else {
        document.getElementById('statBranches').textContent = '—';
        document.getElementById('listBranches').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🏢</span><p>Endpoint not available yet</p></div>`;
    }
}

// ── PRODUCTS ──────────────────────────────────────────────────
async function loadProducts() {
    const products = await apiFetch('/api/products');
    if (products) {
        document.getElementById('statProducts').textContent  = products.filter(p => p.active).length;
        document.getElementById('trendProducts').textContent = `↑ ${products.length} in catalog`;
    } else {
        document.getElementById('statProducts').textContent = '—';
    }
}

// ── ORDERS ────────────────────────────────────────────────────
async function loadOrders() {
    const orders = await apiFetch('/api/orders');
    if (orders) {
        const today       = new Date().toDateString();
        const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today);
        document.getElementById('statOrders').textContent = todayOrders.length;
        document.getElementById('statOpen').textContent   = orders.filter(o => o.status === 'OPEN').length;

        const list = document.getElementById('listOrders');
        list.innerHTML = !orders.length
            ? `<div class="empty-state"><span class="empty-icon">🧾</span><p>No orders registered</p></div>`
            : orders.slice(0, 5).map(o => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">🧾</div>
                        <div>
                            <div class="list-name">Order #${o.idOrder}</div>
                            <div class="list-sub">Table ${o.table?.tableNumber || '—'}</div>
                        </div>
                    </div>
                    <span class="badge ${o.status === 'OPEN' ? 'badge-open' : 'badge-paid'}">${o.status}</span>
                </div>
            `).join('');
    } else {
        document.getElementById('statOrders').textContent = '—';
        document.getElementById('statOpen').textContent   = '—';
        document.getElementById('listOrders').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🧾</span><p>Endpoint not available yet</p></div>`;
    }
}

// ── INVENTORY ─────────────────────────────────────────────────
async function loadInventory() {
    const stock = await apiFetch('/api/inventory/low-stock');
    if (stock) {
        document.getElementById('statLowStock').textContent = stock.length;
        const list = document.getElementById('listStock');
        if (!stock.length) {
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span><p>All inventory at normal levels</p></div>`;
            document.getElementById('trendStock').textContent = '✅ No alerts';
            document.getElementById('trendStock').className   = 'stat-trend trend-up';
        } else {
            list.innerHTML = stock.slice(0, 5).map(s => `
                <div class="stock-bar">
                    <div>
                        <div class="stock-name">${s.product?.name || '—'}</div>
                        <div class="stock-branch">${s.branch?.name || '—'}</div>
                    </div>
                    <div class="stock-qty">${s.quantity}</div>
                </div>
            `).join('');
        }
    } else {
        document.getElementById('statLowStock').textContent = '—';
        document.getElementById('listStock').innerHTML =
            `<div class="empty-state"><span class="empty-icon">📦</span><p>Endpoint not available yet</p></div>`;
    }
}

// ── INVOICES / SALES ──────────────────────────────────────────
async function loadInvoices() {
    const data = await apiFetch('/api/reports/dashboard');
    if (data) {
        document.getElementById('statInvoices').textContent = data.totalInvoices ?? '0';
        document.getElementById('statSales').textContent    = '$ ' + Number(data.totalSale ?? 0).toLocaleString('es-CO');
    } else {
        document.getElementById('statInvoices').textContent = '—';
        document.getElementById('statSales').textContent    = '—';
    }
}

// ── INIT ──────────────────────────────────────────────────────
loadStats();
loadBranches();
loadProducts();
loadOrders();
loadInventory();
loadInvoices();