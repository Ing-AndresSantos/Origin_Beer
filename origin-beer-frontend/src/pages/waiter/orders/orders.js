/**
 * orders.js — Waiter Orders
 *
 * Waiter puede:
 *  - Ver sus propias órdenes filtradas por sede
 *  - Ver el detalle de cada orden (líneas + total)
 *  - Agregar productos a órdenes OPEN (misma lógica que Tables General)
 *
 * Waiter NO puede:
 *  - Cerrar/pagar órdenes (acción exclusiva del Cashier)
 *
 * Algorithms:
 *  - Iterativo   : running total al renderizar líneas (computeTotal)
 *  - Ordenamiento: TimSort descendente por fecha de apertura
 *  - Recursivo   : renderLinesRecursive construye HTML de líneas
 */

requireAuth();
requireRole('WAITER');

document.getElementById('sidebar').innerHTML = getWaiterSidebar('../');
initSidebar('orders');
initDate();

// ── State ──────────────────────────────────────────────────────
let allOrders      = [];
let currentOrderId = null;
let catalogItems   = [];   // ProductBranch list for active branch
let userBranchId   = null;

// ══════════════════════════════════════════════════════════════
// BRANCH RESOLUTION — same pattern as waiter/tables
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

    if (!userBranchId) {
        userBranchId = await resolveUserBranch(user.idUser);
    }

    if (!userBranchId) {
        document.getElementById('ordersBody').innerHTML =
            `<tr><td colspan="7" class="loading-row">⚠️ No branch assigned to this waiter</td></tr>`;
        return;
    }

    // Fetch orders for this branch, filter to own orders only
    const orders = await apiFetch(`/api/orders/branch/${userBranchId}`);
    allOrders = (orders || []).filter(o => o.waiter?.idUser === user.idUser);

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
    const open = allOrders.filter(o => o.status === 'OPEN');
    const paid = allOrders.filter(o => o.status === 'PAID');
    document.getElementById('statTotal').textContent = allOrders.length;
    document.getElementById('statOpen').textContent  = open.length;
    document.getElementById('statPaid').textContent  = paid.length;
}

// ══════════════════════════════════════════════════════════════
// FILTER + RENDER TABLE
// ══════════════════════════════════════════════════════════════
function filterOrders() {
    const q      = document.getElementById('search').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;

    const result = allOrders.filter(o => {
        const text   = `${o.idOrder} ${o.table?.tableNumber || ''}`.toLowerCase();
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
        const isOpen  = o.status === 'OPEN';
        const opened  = o.openedAt ? new Date(o.openedAt).toLocaleString('es-CO') : '—';
        const total   = Number(o.total ?? 0);
        const items   = o.details?.length ?? '—';
        return `
        <tr class="${isOpen ? 'row-open' : 'row-paid'}">
            <td><strong>#${o.idOrder}</strong></td>
            <td>🪑 ${o.table?.tableNumber || '—'}</td>
            <td><span class="badge ${isOpen ? 'badge-open' : 'badge-paid'}">${o.status}</span></td>
            <td>${opened}</td>
            <td>${items}</td>
            <td>$ ${total.toLocaleString('es-CO')}</td>
            <td>
                <button class="btn-action btn-edit" onclick="openDetailModal(${o.idOrder})">
                    ${isOpen ? '✏️ Edit' : '👁 View'}
                </button>
                ${isOpen ? `<button class="btn-action btn-cancel" onclick="cancelOrderFromTable(${o.idOrder})" title="Cancel this order">✕ Cancel</button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

// ── Algoritmo Iterativo — suma quantity × salePrice por línea ─
function computeTotal(details) {
    let total = 0;
    for (const d of details) {
        total += (d.quantity || 0) * parseFloat(d.salePrice || 0);
    }
    return total;
}

// ══════════════════════════════════════════════════════════════
// DETAIL MODAL
// Si la orden es OPEN: muestra catálogo de productos a la izquierda
// Si la orden es PAID: oculta el panel de catálogo (solo lectura)
// ══════════════════════════════════════════════════════════════
async function openDetailModal(orderId) {
    currentOrderId = orderId;
    catalogItems   = [];

    document.getElementById('detailOverlay').classList.add('active');
    document.getElementById('detailTitle').textContent    = `🧾 Order #${orderId}`;
    document.getElementById('orderLines').innerHTML       =
        '<div class="empty-state"><span class="empty-icon">⏳</span><p>Loading…</p></div>';
    document.getElementById('productCatalog').innerHTML   =
        '<div class="empty-state"><span class="empty-icon">⏳</span><p>Loading…</p></div>';
    document.getElementById('productSearch').value        = '';

    const [order, details] = await Promise.all([
        apiFetch(`/api/orders/${orderId}`),
        apiFetch(`/api/orders/${orderId}/details`)
    ]);

    if (!order) return;

    const isPaid = order.status === 'PAID';

    document.getElementById('detailMeta').textContent =
        `Table ${order.table?.tableNumber || '—'} · ${new Date(order.openedAt).toLocaleString('es-CO')}`;
    document.getElementById('detailStatusBadge').textContent = order.status;
    document.getElementById('detailStatusBadge').className   =
        `badge ${isPaid ? 'badge-paid' : 'badge-open'}`;

    // Mostrar/ocultar panel de catálogo según estado de la orden
    const catalogPanel = document.getElementById('catalogPanel');
    const detailRight  = catalogPanel.nextElementSibling;

    if (isPaid) {
        // PAID: ocultar catálogo, expandir líneas a pantalla completa
        catalogPanel.style.display  = 'none';
        detailRight.style.gridColumn = 'span 2';
    } else {
        // OPEN: mostrar catálogo para agregar productos
        catalogPanel.style.display   = '';
        detailRight.style.gridColumn  = '';

        // Cargar catálogo de productos de la sede
        const inventory = await apiFetch(`/api/inventory/branch/${userBranchId}`);
        catalogItems = (inventory || []).filter(pb => pb.product.active && pb.quantity > 0);
        renderCatalog(catalogItems);
    }

    renderLines(details || [], isPaid);
}

// ── Product catalog ────────────────────────────────────────────
function filterCatalog() {
    const q = document.getElementById('productSearch').value.toLowerCase();
    renderCatalog(
        q ? catalogItems.filter(pb =>
                pb.product.name.toLowerCase().includes(q) ||
                pb.product.code.toLowerCase().includes(q))
          : catalogItems
    );
}

function renderCatalog(items) {
    const el = document.getElementById('productCatalog');
    if (!items.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">📦</span><p>No products available</p></div>`;
        return;
    }
    el.innerHTML = items.map(pb => `
        <div class="catalog-item">
            <div class="catalog-info">
                <span class="catalog-name">${pb.product.name}</span>
                <span class="catalog-meta">$ ${Number(pb.product.salePrice).toLocaleString('es-CO')} · Stock: ${pb.quantity}</span>
            </div>
            <button class="btn-add-product" onclick="addProduct(${pb.product.idProduct})">＋</button>
        </div>
    `).join('');
}

// ── Add product to existing order ─────────────────────────────
async function addProduct(idProduct) {
    const res = await fetch(`${API}/api/orders/${currentOrderId}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ idProduct, quantity: 1 })
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) { alert(await res.text()); return; }

    // Refrescar líneas y total después de agregar
    const [details, order] = await Promise.all([
        apiFetch(`/api/orders/${currentOrderId}/details`),
        apiFetch(`/api/orders/${currentOrderId}`)
    ]);

    renderLines(details || [], order?.status === 'PAID');

    // Actualizar fila en la tabla principal
    const idx = allOrders.findIndex(o => o.idOrder === currentOrderId);
    if (idx !== -1 && order) allOrders[idx] = order;
    updateStats();
    renderOrders(sortOrdersByDate(allOrders));
}

// ── Remove detail line ─────────────────────────────────────────
async function removeDetail(idDetail) {
    const res = await fetch(`${API}/api/orders/${currentOrderId}/details/${idDetail}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) { alert(await res.text()); return; }

    const [details, order] = await Promise.all([
        apiFetch(`/api/orders/${currentOrderId}/details`),
        apiFetch(`/api/orders/${currentOrderId}`)
    ]);

    renderLines(details || [], order?.status === 'PAID');

    const idx = allOrders.findIndex(o => o.idOrder === currentOrderId);
    if (idx !== -1 && order) allOrders[idx] = order;
    updateStats();
    renderOrders(sortOrdersByDate(allOrders));
}

// ── Algoritmo Recursivo — construye HTML de líneas recursivamente
function renderLinesRecursive(details, index, accumHtml, isPaid) {
    if (index >= details.length) return accumHtml;
    const d   = details[index];
    const sub = ((d.quantity || 0) * parseFloat(d.salePrice || 0)).toLocaleString('es-CO');
    const removeBtn = isPaid
        ? ''
        : `<button class="btn-remove-line" onclick="removeDetail(${d.idDetail})" title="Remove">✕</button>`;
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
                ${removeBtn}
            </div>
        </div>`;
    return renderLinesRecursive(details, index + 1, accumHtml + html, isPaid);
}

// ── Algoritmo Iterativo — actualiza total en tiempo real ───────
function renderLines(details, isPaid) {
    const el    = document.getElementById('orderLines');
    const total = computeTotal(details);

    if (!details.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">🛒</span><p>No items</p></div>`;
    } else {
        el.innerHTML = renderLinesRecursive(details, 0, '', isPaid);
    }

    document.getElementById('orderTotal').textContent = '$ ' + total.toLocaleString('es-CO');
}

// ── CUSTOM CONFIRM MODAL ──────────────────────────────────────
function showConfirm({ title = 'Are you sure?', message = '', okLabel = 'Confirm' } = {}) {
    return new Promise(resolve => {
        const overlay = document.getElementById('confirmOverlay');
        document.getElementById('confirmTitle').textContent   = title;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmOk').textContent      = okLabel;
        overlay.classList.add('active');

        function cleanup(result) {
            overlay.classList.remove('active');
            document.getElementById('confirmOk').removeEventListener('click', onOk);
            document.getElementById('confirmCancel').removeEventListener('click', onCancel);
            overlay.removeEventListener('click', onBackdrop);
            resolve(result);
        }
        const onOk       = () => cleanup(true);
        const onCancel   = () => cleanup(false);
        const onBackdrop = e => { if (e.target === overlay) cleanup(false); };

        document.getElementById('confirmOk').addEventListener('click', onOk);
        document.getElementById('confirmCancel').addEventListener('click', onCancel);
        overlay.addEventListener('click', onBackdrop);
    });
}

// ── Modal helpers ──────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'detailOverlay') {
        currentOrderId = null;
        catalogItems   = [];
        // Restaurar layout al cerrar
        document.getElementById('catalogPanel').style.display  = '';
        document.getElementById('catalogPanel').nextElementSibling.style.gridColumn = '';
    }
}
function closeIfOutside(e, id) {
    if (e.target === document.getElementById(id)) closeDetailModalSafe();
}

// ══════════════════════════════════════════════════════════════
// CERRAR MODAL CON VALIDACIÓN — Elimina órdenes vacías
// ══════════════════════════════════════════════════════════════
async function closeDetailModalSafe() {
    if (!currentOrderId) {
        closeModal('detailOverlay');
        return;
    }

    const details = await apiFetch(`/api/orders/${currentOrderId}/details`);
    const hasProducts = details && details.length > 0;

    // Si la orden está vacía, eliminarla automáticamente
    if (!hasProducts) {
        try {
            const res = await fetch(`${API}/api/orders/${currentOrderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            
            if (res.ok) {
                console.log(`✅ Empty order #${currentOrderId} deleted`);
            }
        } catch (e) {
            console.error('Error deleting empty order:', e);
        }
    }

    closeModal('detailOverlay');
    await load();
}

// ══════════════════════════════════════════════════════════════
// CANCELAR ORDEN DESDE TABLA — Elimina órdenes OPEN con confirmación
// ══════════════════════════════════════════════════════════════
async function cancelOrderFromTable(orderId) {
    const order = allOrders.find(o => o.idOrder === orderId);
    if (!order) return;
    
    if (order.status !== 'OPEN') {
        alert('⚠️ Only OPEN orders can be cancelled');
        return;
    }

    // Confirmar cancelación
    const confirmed = await showConfirm({
        title:   `🗑️ Cancel Order #${orderId}?`,
        message: `Table ${order.table?.tableNumber || '—'}\n\nAll products will be returned to inventory. This action cannot be undone.`,
        okLabel: 'Yes, Cancel Order'
    });
    if (!confirmed) return;

    try {
        const res = await fetch(`${API}/api/orders/${orderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (res.ok) {
            console.log(`✅ Order #${orderId} cancelled successfully`);
            
            // Notificación visual
            const msg = document.createElement('div');
            msg.style.cssText = 'position:fixed;top:20px;right:20px;background:#ff6b6b;color:white;padding:15px 20px;border-radius:6px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-weight:bold';
            msg.textContent = `✅ Order #${orderId} cancelled - Table ${order.table?.tableNumber} is now available`;
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 4000);

            // Recargar listado
            await load();
        } else {
            const errorMsg = await res.text();
            alert(`❌ Error: ${errorMsg}`);
        }
    } catch (e) {
        console.error('Error cancelling order:', e);
        alert('❌ Connection error');
    }
}

// ── Init ───────────────────────────────────────────────────────
load();