/**
 * orders.js — Cashier Orders Management
 * Cashier-specific view of orders filtered by assigned branch
 *
 * Algorithms embedded:
 *  - Iterativo      : running total while rendering order lines
 *  - Ordenamiento   : orders sorted by date descending (client-side)
 *  - Divide y Venc. : stock validation split into phases before close
 */

requireAuth();
document.getElementById('sidebar').innerHTML = getCashierSidebar('../');
initSidebar('orders');
initDate();

// ── State ──────────────────────────────────────────────────────
let allOrders      = [];
let currentOrderId = null;
let catalogItems   = [];
let userBranchId   = null;

// ══════════════════════════════════════════════════════════════
// BRANCH RESOLUTION — same pattern as inventory.js & tables.js
// Resolves the cashier's assigned branch via /api/branches + /users
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
// LOAD
// ══════════════════════════════════════════════════════════════
async function load() {
    const user = getUser();

    // Resolve branch only once
    if (!userBranchId) {
        userBranchId = await resolveUserBranch(user.idUser);
    }

    if (!userBranchId) {
        document.getElementById('ordersBody').innerHTML =
            `<tr><td colspan="7" class="loading-row">⚠️ No branch assigned to this cashier</td></tr>`;
        return;
    }

    // Fetch orders scoped to this branch directly from the API
    const orders = await apiFetch(`/api/orders/branch/${userBranchId}`);
    allOrders = orders || [];

    updateStats();
    renderOrders(sortOrdersByDate(allOrders));
}

// ══════════════════════════════════════════════════════════════
// Ordenamiento por fecha — TimSort interno de JS
// ══════════════════════════════════════════════════════════════
function sortOrdersByDate(orders) {
    return [...orders].sort((a, b) =>
        new Date(b.openedAt) - new Date(a.openedAt)
    );
}

// ══════════════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════════════
function updateStats() {
    const today   = new Date().toDateString();
    const open    = allOrders.filter(o => o.status === 'OPEN');
    const paid    = allOrders.filter(o => o.status === 'PAID');
    const todayPd = paid.filter(o => new Date(o.closedAt).toDateString() === today);

    // ---- ALGORITMO ITERATIVO ----
    // El backend retorna `total` directamente en cada orden.
    // Se itera sobre los pedidos pagados de hoy y se suma su total.
    let revenue = 0;
    todayPd.forEach(o => {
        revenue += Number(o.total ?? 0);
    });

    document.getElementById('statTotal').textContent   = allOrders.length;
    document.getElementById('statOpen').textContent    = open.length;
    document.getElementById('statPaid').textContent    = paid.length;
    document.getElementById('statRevenue').textContent = '$ ' + revenue.toLocaleString('es-CO');
}

// ══════════════════════════════════════════════════════════════
// FILTER + RENDER TABLE
// ══════════════════════════════════════════════════════════════
function filterOrders() {
    const q      = document.getElementById('search').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;

    const result = allOrders.filter(o => {
        const text = `${o.idOrder} ${o.table?.tableNumber || ''} ${o.waiter?.firstName || ''} ${o.waiter?.lastName || ''}`.toLowerCase();
        const matchQ = !q || text.includes(q);
        const matchS = !status || o.status === status;
        return matchQ && matchS;
    });

    document.getElementById('resultInfo').textContent =
        `${result.length} order${result.length !== 1 ? 's' : ''} found`;
    renderOrders(sortOrdersByDate(result));
}

function renderOrders(orders) {
    const tbody = document.getElementById('ordersBody');
    if (!orders.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No orders found</td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const isOpen = o.status === 'OPEN';
        const opened = o.openedAt ? new Date(o.openedAt).toLocaleString('es-CO') : '—';
        // Backend returns `total` computed from order_detail lines
        const total  = Number(o.total ?? 0);
        return `
        <tr class="${isOpen ? 'row-open' : 'row-paid'}">
            <td><strong>#${o.idOrder}</strong></td>
            <td>🪑 ${o.table?.tableNumber || '—'}</td>
            <td>${o.waiter?.firstName || '—'} ${o.waiter?.lastName || ''}</td>
            <td><span class="badge ${isOpen ? 'badge-open' : 'badge-paid'}">${o.status}</span></td>
            <td>${opened}</td>
            <td>$ ${total.toLocaleString('es-CO')}</td>
            <td>
                <button class="btn-action btn-edit" onclick="openDetailModal(${o.idOrder})">👁 View</button>
                ${isOpen ? `<button class="btn-action btn-activate" onclick="quickClose(${o.idOrder})">✅ Close</button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

// ---- ALGORITMO ITERATIVO ----
// Recorre las líneas del pedido sumando quantity * salePrice.
// Se usa en el modal de detalle para mostrar el total en tiempo real.
function computeTotal(details) {
    let total = 0;
    for (const d of details) {
        total += (d.quantity || 0) * parseFloat(d.salePrice || 0);
    }
    return total;
}

// ══════════════════════════════════════════════════════════════
// DETAIL MODAL
// ══════════════════════════════════════════════════════════════
async function openDetailModal(orderId) {
    currentOrderId = orderId;
    document.getElementById('detailOverlay').classList.add('active');
    document.getElementById('detailTitle').textContent  = `🧾 Order #${orderId}`;
    document.getElementById('orderLines').innerHTML     = '<div class="empty-state"><span class="empty-icon">⏳</span><p>Loading…</p></div>';

    const [order, details] = await Promise.all([
        apiFetch(`/api/orders/${orderId}`),
        apiFetch(`/api/orders/${orderId}/details`)
    ]);

    if (!order) return;

    const isPaid = order.status === 'PAID';
    document.getElementById('detailMeta').textContent =
        `Table ${order.table?.tableNumber || '—'} · ${order.waiter?.firstName || '—'} ${order.waiter?.lastName || ''}`;
    document.getElementById('detailStatusBadge').textContent = order.status;
    document.getElementById('detailStatusBadge').className   = `badge ${isPaid ? 'badge-paid' : 'badge-open'}`;
    document.getElementById('btnCloseOrder').style.display   = isPaid ? 'none' : 'block';

    document.getElementById('infoTable').textContent  = order.table?.tableNumber || '—';
    document.getElementById('infoWaiter').textContent = (order.waiter?.firstName || '—') + ' ' + (order.waiter?.lastName || '');
    document.getElementById('infoOpened').textContent = order.openedAt ? new Date(order.openedAt).toLocaleString('es-CO') : '—';
    document.getElementById('infoItems').textContent  = details?.length || 0;

    renderLines(details || [], isPaid);
}

// ---- ALGORITMO RECURSIVO ----
// Construye el HTML de las líneas del pedido recursivamente,
// procesando un elemento por llamada hasta recorrer el array completo.
function renderLinesRecursive(details, index, accumHtml) {
    if (index >= details.length) return accumHtml;
    const d   = details[index];
    const sub = ((d.quantity || 0) * parseFloat(d.salePrice || 0)).toLocaleString('es-CO');
    const html = `
        <div class="order-line">
            <div class="order-line-info">
                <span class="order-line-name">${d.product?.name || '—'}</span>
                <span class="order-line-meta">$ ${Number(d.salePrice || 0).toLocaleString('es-CO')} c/u</span>
                <span class="order-line-note">${d.note ? '📝 ' + d.note : ''}</span>
            </div>
            <div class="order-line-right">
                <span class="order-line-qty">×${d.quantity}</span>
                <span class="order-line-price">$ ${sub}</span>
            </div>
        </div>`;
    return renderLinesRecursive(details, index + 1, accumHtml + html);
}

function renderLines(details, isPaid) {
    const el    = document.getElementById('orderLines');
    const total = computeTotal(details);

    if (!details.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">🛒</span><p>No items</p></div>`;
    } else {
        el.innerHTML = renderLinesRecursive(details, 0, '');
    }

    document.getElementById('orderTotal').textContent = '$ ' + total.toLocaleString('es-CO');

    // Loyalty points — Fibonacci based on distinct products
    const nDistinct  = new Set(details.map(d => d.product?.idProduct)).size;
    const loyaltyEl  = document.getElementById('loyaltyPoints');
    if (loyaltyEl) loyaltyEl.textContent = fibonacci(nDistinct) + ' pts';
}

// Fibonacci para puntos de fidelidad
function fibonacci(n) {
    if (n <= 0) return 0;
    if (n === 1) return 1;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
    return b;
}

// ══════════════════════════════════════════════════════════════
// CLOSE ORDER (US-20 / US-21)
// Divide y Vencerás: validación → descuento de inventario → cierre
// ══════════════════════════════════════════════════════════════
async function closeOrder() {
    if (!confirm('Close this order and deduct inventory?')) return;
    const btn = document.getElementById('btnCloseOrder');
    btn.disabled = true; btn.textContent = 'Processing…';

    try {
        const res = await fetch(`${API}/api/orders/${currentOrderId}/close`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) { alert(await res.text()); return; }

        closeModal('detailOverlay');
        await load();

    } catch (e) { alert('Could not connect to server.'); }
    finally { btn.disabled = false; btn.textContent = '✅ Close & Pay Order'; }
}

async function quickClose(orderId) {
    if (!confirm(`Close order #${orderId} and deduct inventory?`)) return;
    const res = await fetch(`${API}/api/orders/${orderId}/close`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) { alert(await res.text()); return; }
    await load();
}

// ── Modal helpers ──────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'detailOverlay') { currentOrderId = null; }
}
function closeIfOutside(e, id) {
    if (e.target === document.getElementById(id)) closeModal(id);
}

// ── Init ───────────────────────────────────────────────────────
load();