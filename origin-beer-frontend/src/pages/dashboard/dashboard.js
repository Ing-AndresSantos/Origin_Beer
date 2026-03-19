requireAuth();

document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('dashboard');
initDate();

const user = getUser();
document.getElementById('bannerName').textContent = user.nombre || 'Admin';
document.getElementById('bannerDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

async function loadStats() {
    const users = await apiFetch('/api/usuarios');
    if (users) {
        const active = users.filter(u => u.activo).length;
        document.getElementById('statUsers').textContent = active;
        document.getElementById('trendUsers').textContent = `↑ ${users.length} total`;

        const list = document.getElementById('listUsers');
        if (!users.length) {
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">👥</span><p>No users registered</p></div>`;
        } else {
            list.innerHTML = users.slice(0, 5).map(u => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">${u.nombre.charAt(0)}${u.apellido.charAt(0)}</div>
                        <div>
                            <div class="list-name">${u.nombre} ${u.apellido}</div>
                            <div class="list-sub">${u.correo}</div>
                        </div>
                    </div>
                    <span class="badge badge-${(u.rol?.nombre || 'admin').toLowerCase()}">${u.rol?.nombre || '—'}</span>
                </div>
            `).join('');
        }
    }
}

async function loadBranches() {
    const branches = await apiFetch('/api/sedes');
    if (branches) {
        const active = branches.filter(s => s.activo).length;
        document.getElementById('statBranches').textContent = active;
        document.getElementById('trendBranches').textContent = `↑ ${branches.length} registered`;

        const list = document.getElementById('listBranches');
        list.innerHTML = !branches.length
            ? `<div class="empty-state"><span class="empty-icon">🏢</span><p>No branches registered</p></div>`
            : branches.slice(0, 5).map(s => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">🏢</div>
                        <div>
                            <div class="list-name">${s.nombre}</div>
                            <div class="list-sub">${s.ciudad || '—'} · ${s.codigo}</div>
                        </div>
                    </div>
                    <span class="badge ${s.activo ? 'badge-active' : 'badge-inactive'}">${s.activo ? 'Active' : 'Inactive'}</span>
                </div>
            `).join('');
    } else {
        document.getElementById('statBranches').textContent = '—';
        document.getElementById('listBranches').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🏢</span><p>Endpoint not available yet</p></div>`;
    }
}

async function loadProducts() {
    const products = await apiFetch('/api/productos');
    if (products) {
        document.getElementById('statProducts').textContent = products.filter(p => p.activo).length;
        document.getElementById('trendProducts').textContent = `↑ ${products.length} in catalog`;
    } else {
        document.getElementById('statProducts').textContent = '—';
    }
}

async function loadOrders() {
    const orders = await apiFetch('/api/pedidos');
    if (orders) {
        const today = new Date().toDateString();
        const todayOrders = orders.filter(p => new Date(p.fechaCreacion).toDateString() === today);
        document.getElementById('statOrders').textContent = todayOrders.length;
        document.getElementById('statOpen').textContent = orders.filter(p => p.estado === 'ABIERTO').length;

        const list = document.getElementById('listOrders');
        list.innerHTML = !orders.length
            ? `<div class="empty-state"><span class="empty-icon">🧾</span><p>No orders registered</p></div>`
            : orders.slice(0, 5).map(p => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">🧾</div>
                        <div>
                            <div class="list-name">Order #${p.idPedido}</div>
                            <div class="list-sub">Table ${p.mesa?.numeroMesa || '—'}</div>
                        </div>
                    </div>
                    <span class="badge ${p.estado === 'ABIERTO' ? 'badge-open' : 'badge-paid'}">${p.estado}</span>
                </div>
            `).join('');
    } else {
        document.getElementById('statOrders').textContent = '—';
        document.getElementById('statOpen').textContent = '—';
        document.getElementById('listOrders').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🧾</span><p>Endpoint not available yet</p></div>`;
    }
}

async function loadInventory() {
    const stock = await apiFetch('/api/inventario/stock-bajo');
    if (stock) {
        document.getElementById('statLowStock').textContent = stock.length;
        const list = document.getElementById('listStock');
        if (!stock.length) {
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">✅</span><p>All inventory at normal levels</p></div>`;
            document.getElementById('trendStock').textContent = '✅ No alerts';
            document.getElementById('trendStock').className = 'stat-trend trend-up';
        } else {
            list.innerHTML = stock.slice(0, 5).map(s => `
                <div class="stock-bar">
                    <div>
                        <div class="stock-name">${s.producto?.nombre || '—'}</div>
                        <div class="stock-branch">${s.sede?.nombre || '—'}</div>
                    </div>
                    <div class="stock-qty">${s.cantidad}</div>
                </div>
            `).join('');
        }
    } else {
        document.getElementById('statLowStock').textContent = '—';
        document.getElementById('listStock').innerHTML =
            `<div class="empty-state"><span class="empty-icon">📦</span><p>Endpoint not available yet</p></div>`;
    }
}

async function loadInvoices() {
    const invoices = await apiFetch('/api/facturas');
    if (invoices) {
        const today = new Date().toDateString();
        const todayInvoices = invoices.filter(f => new Date(f.fechaEmision).toDateString() === today);
        const total = todayInvoices.reduce((sum, f) => sum + (f.total || 0), 0);
        document.getElementById('statInvoices').textContent = todayInvoices.length;
        document.getElementById('statSales').textContent = '$ ' + total.toLocaleString('en-US');
    } else {
        document.getElementById('statInvoices').textContent = '—';
        document.getElementById('statSales').textContent = '—';
    }
}

loadStats();
loadBranches();
loadProducts();
loadOrders();
loadInventory();
loadInvoices();
