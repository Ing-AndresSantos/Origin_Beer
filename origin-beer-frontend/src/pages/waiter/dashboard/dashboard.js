requireRole('MESERO');

document.getElementById('sidebar').innerHTML = getWaiterSidebar('../');
initSidebar('dashboard');
initDate();

const user = getUser();
document.getElementById('bannerName').textContent = user.nombre || 'Waiter';
document.getElementById('bannerDate').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

async function loadOrders() {
    const orders = await apiFetch('/api/pedidos');
    if (orders) {
        const today    = new Date().toDateString();
        const open     = orders.filter(p => p.estado === 'ABIERTO');
        const todayAll = orders.filter(p => new Date(p.fechaCreacion).toDateString() === today);

        document.getElementById('statMyOrders').textContent    = open.length;
        document.getElementById('statOrdersToday').textContent = todayAll.length;

        const list = document.getElementById('listOpenOrders');
        list.innerHTML = !open.length
            ? `<div class="empty-state"><span class="empty-icon">✅</span><p>No open orders right now</p></div>`
            : open.slice(0, 8).map(p => `
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
        document.getElementById('statMyOrders').textContent    = '—';
        document.getElementById('statOrdersToday').textContent = '—';
        document.getElementById('listOpenOrders').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🧾</span><p>Endpoint not available yet</p></div>`;
    }
}

async function loadTables() {
    const tables = await apiFetch('/api/mesas');
    if (tables) {
        const occupied = tables.filter(t => t.estado === 'OCUPADA').length;
        document.getElementById('statTables').textContent = occupied;
        document.getElementById('trendTables').textContent = `${tables.length} total tables`;

        const list = document.getElementById('listTables');
        list.innerHTML = !tables.length
            ? `<div class="empty-state"><span class="empty-icon">🪑</span><p>No tables registered</p></div>`
            : tables.slice(0, 8).map(t => {
                const estado = (t.estado || 'FREE').toUpperCase();
                const cls = estado === 'OCUPADA' ? 'status-occupied'
                          : estado === 'RESERVADA' ? 'status-reserved'
                          : 'status-free';
                const label = estado === 'OCUPADA' ? 'Occupied'
                            : estado === 'RESERVADA' ? 'Reserved'
                            : 'Free';
                return `
                <div class="list-item">
                    <div class="list-item-left">
                        <div class="list-avatar">🪑</div>
                        <div>
                            <div class="list-name">Table ${t.numeroMesa || t.numero || t.id}</div>
                            <div class="list-sub">Capacity: ${t.capacidad || '—'}</div>
                        </div>
                    </div>
                    <span class="table-status-badge ${cls}">${label}</span>
                </div>`;
            }).join('');
    } else {
        document.getElementById('statTables').textContent = '—';
        document.getElementById('listTables').innerHTML =
            `<div class="empty-state"><span class="empty-icon">🪑</span><p>Endpoint not available yet</p></div>`;
    }
}

loadOrders();
loadTables();

// Prevenir navegación - mantener dashboard independiente
document.getElementById('btnTables')?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Tables button clicked - staying in waiter dashboard');
});

document.getElementById('btnOrders')?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Orders button clicked - staying in waiter dashboard');
});

document.getElementById('btnMenu')?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Menu button clicked - staying in waiter dashboard');
});

document.getElementById('btnViewAllOrders')?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('View all orders clicked - staying in waiter dashboard');
});

document.getElementById('btnViewAllTables')?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('View all tables clicked - staying in waiter dashboard');
});
