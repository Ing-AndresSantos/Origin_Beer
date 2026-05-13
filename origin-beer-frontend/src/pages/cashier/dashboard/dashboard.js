requireAuth();

document.getElementById('sidebar').innerHTML = getCashierSidebar('../');
initSidebar('dashboard');
initDate();

const user = getUser();
document.getElementById('bannerName').textContent = user.firstName || 'Cashier';
document.getElementById('bannerDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// ── BRANCH RESOLUTION ─────────────────────────────────────────
// Resolves cashier's assigned branch. Same pattern used across all
// cashier modules — does not expose other branches.
let userBranchId = null;

async function resolveUserBranch(userId) {
    try {
        const branches = await apiFetch('/api/branches');
        if (!branches) return null;

        for (const branch of branches) {
            try {
                const res = await fetch(`${API}/api/branches/${branch.idBranch}/users`, {
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                if (!res.ok) continue;
                const users = await res.json();
                if (users.some(u => u.idUser === userId)) {
                    return branch.idBranch;
                }
            } catch (_) {}
        }
    } catch (e) {
        console.error('Could not resolve branch', e);
    }
    return null;
}

// ── LOAD ORDERS (pending + today's revenue) ───────────────────
async function loadOrders() {
    if (!userBranchId) return;

    // Fetch only orders for this branch — branch filter is enforced here
    const orders = await apiFetch(`/api/orders/branch/${userBranchId}`);

    if (orders) {
        const today   = new Date().toDateString();
        const pending = orders.filter(o => o.status === 'OPEN');

        // ---- ALGORITMO ITERATIVO ----
        // Suma el total de las órdenes pagadas hoy usando el campo `total`
        // retornado directamente por el backend en cada orden enriquecida.
        const todayRevenue = orders
            .filter(o => o.status === 'PAID' && new Date(o.closedAt).toDateString() === today)
            .reduce((sum, o) => sum + Number(o.total ?? 0), 0);

        document.getElementById('statPending').textContent    = pending.length;
        document.getElementById('statSalesToday').textContent = '$ ' + todayRevenue.toLocaleString('es-CO');

        const list = document.getElementById('listPendingOrders');
        list.innerHTML = !pending.length
            ? `<div class="empty-state"><span class="empty-icon">✅</span><p>No orders pending payment</p></div>`
            : pending.slice(0, 8).map(o => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">🧾</div>
                        <div>
                            <div class="list-name">Order #${o.idOrder}</div>
                            <div class="list-sub">Table ${o.table?.tableNumber || '—'} · $ ${Number(o.total ?? 0).toLocaleString('es-CO')}</div>
                        </div>
                    </div>
                    <span class="badge badge-open">OPEN</span>
                </div>`).join('');
    } else {
        document.getElementById('statPending').textContent    = '—';
        document.getElementById('statSalesToday').textContent = '—';
        document.getElementById('listPendingOrders').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🧾</span><p>Could not load orders</p></div>`;
    }
}

// ── LOAD TABLES ───────────────────────────────────────────────
async function loadTables() {
    if (!userBranchId) return;

    const tables = await apiFetch(`/api/tables?idBranch=${userBranchId}`);
    if (tables) {
        document.getElementById('statTables').textContent  = tables.length;
        document.getElementById('trendTables').textContent = `${tables.filter(t => t.active).length} active`;
    } else {
        document.getElementById('statTables').textContent = '—';
    }
}

// ── LOAD INVOICES ─────────────────────────────────────────────
async function loadInvoices() {
    // but there is no dedicated invoices endpoint yet.
    // We derive invoice count from today's PAID orders for this branch.
    if (!userBranchId) return;

    const orders = await apiFetch(`/api/orders/branch/${userBranchId}`);
    if (!orders) {
        document.getElementById('statInvoices').textContent = '—';
        document.getElementById('listInvoices').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🧾</span><p>Could not load invoices</p></div>`;
        return;
    }

    const today        = new Date().toDateString();
    const todayInvoices = orders.filter(o =>
        o.status === 'PAID' && new Date(o.closedAt).toDateString() === today
    );

    document.getElementById('statInvoices').textContent = todayInvoices.length;

    const list = document.getElementById('listInvoices');
    list.innerHTML = !todayInvoices.length
        ? `<div class="empty-state"><span class="empty-icon">🧾</span><p>No invoices issued today</p></div>`
        : todayInvoices.slice(0, 8).map(o => `
            <div class="list-item">
                <div class="list-item-left">
                    <div>
                        <div class="list-name">Order #${o.idOrder}</div>
                        <div class="list-sub">${o.closedAt ? new Date(o.closedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                    </div>
                </div>
                <span class="invoice-amount">$ ${Number(o.total ?? 0).toLocaleString('es-CO')}</span>
            </div>`).join('');
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
    userBranchId = await resolveUserBranch(user.idUser);
    await Promise.all([loadOrders(), loadTables(), loadInvoices()]);
}

init();

// ── NAVEGACIÓN ────────────────────────────────────────────────
document.getElementById('btnCloseOrders')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});


document.getElementById('btnInventory')?.addEventListener('click', () => {
    window.location.href = '../inventory/inventory.html';
});

document.getElementById('btnTables')?.addEventListener('click', () => {
    window.location.href = '../tables/tables.html';
});

document.getElementById('btnPaymentMethods')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});

document.getElementById('btnTransactions')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});

document.getElementById('btnReports')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});

document.getElementById('btnReconciliation')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});

document.getElementById('btnRefunds')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});

document.getElementById('btnViewAllPendingOrders')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});

document.getElementById('btnViewAllInvoices')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});