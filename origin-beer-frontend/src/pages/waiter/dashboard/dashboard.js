/**
 * dashboard.js — Waiter Dashboard
 * Shows open orders and tables for the waiter's assigned branch.
 * Read-only view — waiter creates orders via Tables module.
 */

requireAuth();
requireRole('WAITER'); // ← guards against wrong-role access

document.getElementById('sidebar').innerHTML = getWaiterSidebar('../');
initSidebar('dashboard');
initDate();

const user = getUser();
document.getElementById('bannerName').textContent = user.firstName || 'Waiter';
document.getElementById('bannerDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// ── BRANCH RESOLUTION — same pattern as Cashier ───────────────
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

// ── LOAD ORDERS — filtered to this waiter's own orders ────────
async function loadOrders() {
    if (!userBranchId) return;

    const orders = await apiFetch(`/api/orders/branch/${userBranchId}`);

    if (orders) {
        const today = new Date().toDateString();

        // Only show own orders
        const myOrders  = orders.filter(o => o.waiter?.idUser === user.idUser);
        const open      = myOrders.filter(o => o.status === 'OPEN');
        const todayAll  = myOrders.filter(o => new Date(o.openedAt).toDateString() === today);

        document.getElementById('statMyOrders').textContent    = open.length;
        document.getElementById('statOrdersToday').textContent = todayAll.length;

        const list = document.getElementById('listOpenOrders');
        list.innerHTML = !open.length
            ? `<div class="empty-state"><span class="empty-icon">✅</span><p>No open orders right now</p></div>`
            : open.slice(0, 8).map(o => `
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
        document.getElementById('statMyOrders').textContent    = '—';
        document.getElementById('statOrdersToday').textContent = '—';
        document.getElementById('listOpenOrders').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🧾</span><p>Could not load orders</p></div>`;
    }
}

// ── LOAD TABLES — shows active tables for the branch ──────────
async function loadTables() {
    if (!userBranchId) return;

    const tables = await apiFetch(`/api/tables?idBranch=${userBranchId}`);
    if (tables) {
        const active = tables.filter(t => t.active);
        document.getElementById('statTables').textContent  = active.length;
        document.getElementById('trendTables').textContent = `${tables.length} total tables`;

        const list = document.getElementById('listTables');
        list.innerHTML = !active.length
            ? `<div class="empty-state"><span class="empty-icon">🪑</span><p>No active tables</p></div>`
            : active.slice(0, 8).map(t => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">🪑</div>
                        <div>
                            <div class="list-name">Table ${t.tableNumber}</div>
                            <div class="list-sub">Capacity: ${t.capacity || '—'}</div>
                        </div>
                    </div>
                    <span class="table-status-badge status-active">Available</span>
                </div>`).join('');
    } else {
        document.getElementById('statTables').textContent = '—';
        document.getElementById('listTables').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🪑</span><p>Could not load tables</p></div>`;
    }
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
    userBranchId = await resolveUserBranch(user.idUser);
    if (!userBranchId) {
        document.getElementById('listOpenOrders').innerHTML =
            `<div class="empty-state"><span class="empty-icon">⚠️</span><p>No branch assigned to this account</p></div>`;
        document.getElementById('listTables').innerHTML =
            `<div class="empty-state"><span class="empty-icon">⚠️</span><p>No branch assigned to this account</p></div>`;
        return;
    }
    await Promise.all([loadOrders(), loadTables()]);
}

init();

// ── Navigation ────────────────────────────────────────────────
document.getElementById('btnTables')?.addEventListener('click', () => {
    window.location.href = '../tables/tables.html';
});
document.getElementById('btnOrders')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});
document.getElementById('btnViewAllOrders')?.addEventListener('click', () => {
    window.location.href = '../orders/orders.html';
});
document.getElementById('btnViewAllTables')?.addEventListener('click', () => {
    window.location.href = '../tables/tables.html';
});