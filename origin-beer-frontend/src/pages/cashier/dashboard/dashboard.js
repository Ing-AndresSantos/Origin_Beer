requireRole('CAJERO');

document.getElementById('sidebar').innerHTML = getCashierSidebar('../');
initSidebar('dashboard');
initDate();

const user = getUser();
document.getElementById('bannerName').textContent = user.nombre || 'Cashier';
document.getElementById('bannerDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

async function loadOrders() {
    const orders = await apiFetch('/api/pedidos');
    if (orders) {
        const pending = orders.filter(p => p.estado === 'ABIERTO');
        document.getElementById('statPending').textContent = pending.length;

        const list = document.getElementById('listPendingOrders');
        list.innerHTML = !pending.length
            ? `<div class="empty-state"><span class="empty-icon">✅</span><p>No orders pending payment</p></div>`
            : pending.slice(0, 8).map(p => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">🧾</div>
                        <div>
                            <div class="list-name">Order #${p.idPedido}</div>
                            <div class="list-sub">Table ${p.mesa?.numeroMesa || '—'}</div>
                        </div>
                    </div>
                    <span class="badge badge-open">OPEN</span>
                </div>`).join('');
    } else {
        document.getElementById('statPending').textContent = '—';
        document.getElementById('listPendingOrders').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🧾</span><p>Endpoint not available yet</p></div>`;
    }
}

async function loadInvoices() {
    const invoices = await apiFetch('/api/facturas');
    if (invoices) {
        const today         = new Date().toDateString();
        const todayInvoices = invoices.filter(f => new Date(f.fechaEmision).toDateString() === today);
        const total         = todayInvoices.reduce((s, f) => s + (f.total || 0), 0);

        document.getElementById('statInvoices').textContent   = todayInvoices.length;
        document.getElementById('statSalesToday').textContent = '$ ' + total.toLocaleString('en-US');

        const list = document.getElementById('listInvoices');
        list.innerHTML = !todayInvoices.length
            ? `<div class="empty-state"><span class="empty-icon">🧾</span><p>No invoices issued today</p></div>`
            : todayInvoices.slice(0, 8).map(f => `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">💳</div>
                        <div>
                            <div class="list-name">Invoice #${f.idFactura || f.id}</div>
                            <div class="list-sub">${f.fechaEmision ? new Date(f.fechaEmision).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                        </div>
                    </div>
                    <span class="invoice-amount">$ ${(f.total || 0).toLocaleString('en-US')}</span>
                </div>`).join('');
    } else {
        document.getElementById('statInvoices').textContent   = '—';
        document.getElementById('statSalesToday').textContent = '—';
        document.getElementById('listInvoices').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🧾</span><p>Endpoint not available yet</p></div>`;
    }
}

async function loadTables() {
    const tables = await apiFetch('/api/mesas');
    if (tables) {
        const occupied = tables.filter(t => t.estado === 'OCUPADA').length;
        document.getElementById('statTables').textContent  = occupied;
        document.getElementById('trendTables').textContent = `${tables.length} total`;
    } else {
        document.getElementById('statTables').textContent = '—';
    }
}

loadOrders();
loadInvoices();
loadTables();

// ── NAVEGACIÓN ────────────────────────────────────────────────
document.getElementById('btnCloseOrders')?.addEventListener('click', () => {
    window.location.href = '../../admin/orders/orders.html';
});

document.getElementById('btnSales')?.addEventListener('click', () => {
    window.location.href = '../../admin/sales/sales.html';
});

document.getElementById('btnInventory')?.addEventListener('click', () => {
    window.location.href = '../inventory/inventory.html';
});

document.getElementById('btnTables')?.addEventListener('click', () => {
    window.location.href = '../../admin/tables/tables.html';
});

document.getElementById('btnPaymentMethods')?.addEventListener('click', () => {
    window.location.href = '../../admin/sales/sales.html';
});

document.getElementById('btnTransactions')?.addEventListener('click', () => {
    window.location.href = '../../admin/sales/sales.html';
});

document.getElementById('btnReports')?.addEventListener('click', () => {
    window.location.href = '../../admin/reports/reports.html';
});

document.getElementById('btnReconciliation')?.addEventListener('click', () => {
    window.location.href = '../../admin/reports/reports.html';
});

document.getElementById('btnRefunds')?.addEventListener('click', () => {
    window.location.href = '../../admin/orders/orders.html';
});

document.getElementById('btnViewAllPendingOrders')?.addEventListener('click', () => {
    window.location.href = '../../admin/orders/orders.html';
});

document.getElementById('btnViewAllInvoices')?.addEventListener('click', () => {
    window.location.href = '../../admin/sales/sales.html';
});