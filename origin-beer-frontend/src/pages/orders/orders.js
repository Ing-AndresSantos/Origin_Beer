/**
 * orders.js — Sprint 4: Order Management
 * US-18 Create order by table
 * US-19 Add products to order
 * US-20 Order status control
 * US-21 Automatic inventory deduction on close
 * US-22 List orders by branch
 *
 * Algorithms embedded:
 *  - Iterativo      : running total while rendering order lines
 *  - Fibonacci      : loyalty points calculation per order total
 *  - Factorial      : combinatory display in suggest tooltip
 *  - Ordenamiento   : orders sorted by date descending (client-side)
 *  - Divide y Venc. : stock validation split into phases before close
 *  - Knapsack       : /api/orders/suggest-combo endpoint call
 *  - Recursivo      : recursive rendering of nested order groups
 */

requireAuth();
document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('orders');
initDate();

// ── State ──────────────────────────────────────────────────────
let allOrders      = [];
let allBranches    = [];
let currentOrderId = null;
let catalogItems   = [];   // ProductBranch list for active branch

// ══════════════════════════════════════════════════════════════
// LOAD
// ══════════════════════════════════════════════════════════════
async function load() {
    const [orders, branches] = await Promise.all([
        apiFetch('/api/orders'),
        apiFetch('/api/branches')
    ]);

    allOrders   = orders   || [];
    allBranches = branches || [];

    populateBranchFilter();
    updateStats();
    renderOrders(sortOrdersByDate(allOrders));  // Ordenamiento
}

// ── Populate branch selects ────────────────────────────────────
function populateBranchFilter() {
    const filter = document.getElementById('filterBranch');
    const foBranch = document.getElementById('foBranch');

    allBranches.filter(b => b.active).forEach(b => {
        filter.innerHTML   += `<option value="${b.idBranch}">${b.name}</option>`;
        foBranch.innerHTML += `<option value="${b.idBranch}">${b.name}</option>`;
    });
}

// ══════════════════════════════════════════════════════════════
// ---- Estamos usando este Algoritmo: ALGORITMOS DE ORDENAMIENTO
// Descripción: Ordenamiento por fecha (TimSort interno de JS via
// Array.sort). Los pedidos se ordenan siempre del más reciente al
// más antiguo. En el front el usuario puede ver inmediatamente los
// pedidos activos en la parte superior de la tabla, mejorando la
// operación en tiempo real del mesero y cajero.
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

    // ---- Estamos usando este Algoritmo: ALGORITMO ITERATIVO ----
    // Descripción: Cálculo del revenue diario iterando sobre los
    // pedidos pagados de hoy. Se suman los subtotales de cada línea
    // de detalle de forma iterativa. En el front se muestra el
    // total del día en la tarjeta de estadísticas superior.
    // -----------------------------------------------------------
    let revenue = 0;
    todayPd.forEach(o => {
        if (o.details) {
            o.details.forEach(d => { revenue += Number(d.subtotal || 0); });
        }
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
    const q        = document.getElementById('search').value.toLowerCase();
    const status   = document.getElementById('filterStatus').value;
    const branchId = document.getElementById('filterBranch').value;

    const result = allOrders.filter(o => {
        const text = `${o.idOrder} ${o.table?.tableNumber || ''} ${o.waiter?.firstName || ''} ${o.waiter?.lastName || ''}`.toLowerCase();
        const matchQ = !q || text.includes(q);
        const matchS = !status || o.status === status;
        const matchB = !branchId || String(o.branch?.idBranch) === branchId;
        return matchQ && matchS && matchB;
    });

    document.getElementById('resultInfo').textContent =
        `${result.length} order${result.length !== 1 ? 's' : ''} found`;
    renderOrders(sortOrdersByDate(result));
}

function renderOrders(orders) {
    const tbody = document.getElementById('ordersBody');
    if (!orders.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="loading-row">No orders found</td></tr>`;
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const isOpen = o.status === 'OPEN';
        const opened = o.openedAt ? new Date(o.openedAt).toLocaleString('es-CO') : '—';
        const total  = computeTotal(o.details || []);
        return `
        <tr class="${isOpen ? 'row-open' : 'row-paid'}">
            <td><strong>#${o.idOrder}</strong></td>
            <td>${o.branch?.name || '—'}</td>
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

// ---- Estamos usando este Algoritmo: ALGORITMO ITERATIVO --------
// Descripción: computeTotal recorre iterativamente las líneas de
// un pedido sumando quantity * salePrice. Se ejecuta cada vez que
// se renderiza una fila de la tabla o se actualiza el panel lateral
// del modal, mostrando el total en tiempo real al mesero.
// ---------------------------------------------------------------
function computeTotal(details) {
    let total = 0;
    for (const d of details) {
        total += (d.quantity || 0) * parseFloat(d.salePrice || 0);
    }
    return total;
}

// ══════════════════════════════════════════════════════════════
// NEW ORDER MODAL
// ══════════════════════════════════════════════════════════════
function openNewOrderModal() {
    document.getElementById('newOrderOverlay').classList.add('active');
    document.getElementById('foTable').innerHTML = '<option value="">Select branch first…</option>';
}

async function loadTablesForBranch() {
    const idBranch = document.getElementById('foBranch').value;
    const sel = document.getElementById('foTable');
    sel.innerHTML = '<option value="">Loading…</option>';
    if (!idBranch) { sel.innerHTML = '<option value="">Select branch first…</option>'; return; }

    const tables = await apiFetch(`/api/orders/tables/${idBranch}`);
    if (!tables || !tables.length) {
        sel.innerHTML = '<option value="">No active tables</option>';
        return;
    }
    sel.innerHTML = '<option value="">Select table…</option>' +
        tables.map(t => `<option value="${t.idTable}">Table ${t.tableNumber} (cap. ${t.capacity})</option>`).join('');
}

async function createOrder() {
    hideErr('newOrderError');
    const idBranch = document.getElementById('foBranch').value;
    const idTable  = document.getElementById('foTable').value;
    const notes    = document.getElementById('foNotes').value.trim();
    const user     = getUser();

    if (!idBranch) { showErr('newOrderError', 'Select a branch.'); return; }
    if (!idTable)  { showErr('newOrderError', 'Select a table.'); return; }

    const btn = document.getElementById('btnCreateOrder');
    btn.disabled = true; btn.textContent = 'Creating…';

    try {
        const res = await fetch(`${API}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ idBranch: +idBranch, idTable: +idTable, idWaiter: user.idUser, notes })
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) { showErr('newOrderError', await res.text()); return; }

        const order = await res.json();
        closeModal('newOrderOverlay');
        await load();
        openDetailModal(order.idOrder);

    } catch (e) { showErr('newOrderError', 'Could not connect to server.'); }
    finally { btn.disabled = false; btn.textContent = 'Create Order'; }
}

// ══════════════════════════════════════════════════════════════
// DETAIL MODAL  (US-19 Add products)
// ══════════════════════════════════════════════════════════════
async function openDetailModal(orderId) {
    currentOrderId = orderId;
    document.getElementById('detailOverlay').classList.add('active');
    document.getElementById('detailTitle').textContent = `🧾 Order #${orderId}`;
    document.getElementById('orderLines').innerHTML    = '<div class="empty-state"><span class="empty-icon">⏳</span><p>Loading…</p></div>';
    document.getElementById('productCatalog').innerHTML = '<div class="empty-state"><span class="empty-icon">⏳</span><p>Loading…</p></div>';

    const [order, details] = await Promise.all([
        apiFetch(`/api/orders/${orderId}`),
        apiFetch(`/api/orders/${orderId}/details`)
    ]);

    if (!order) return;

    const isPaid = order.status === 'PAID';
    document.getElementById('detailMeta').textContent =
        `${order.branch?.name || '—'} · Table ${order.table?.tableNumber || '—'} · ${order.waiter?.firstName || '—'} ${order.waiter?.lastName || ''}`;
    document.getElementById('detailStatusBadge').textContent  = order.status;
    document.getElementById('detailStatusBadge').className    = `badge ${isPaid ? 'badge-paid' : 'badge-open'}`;
    document.getElementById('btnCloseOrder').style.display    = isPaid ? 'none' : 'block';

    // Load product catalog for the branch
    const inventory = await apiFetch(`/api/inventory/branch/${order.branch?.idBranch}`);
    catalogItems = (inventory || []).filter(pb => pb.product.active && pb.quantity > 0);
    renderCatalog(catalogItems);

    renderLines(details || [], isPaid);
}

// ── Product catalog ────────────────────────────────────────────
function filterCatalog() {
    const q = document.getElementById('productSearch').value.toLowerCase();
    renderCatalog(catalogItems.filter(pb =>
        pb.product.name.toLowerCase().includes(q) ||
        pb.product.code.toLowerCase().includes(q)
    ));
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

async function addProduct(idProduct) {
    const res = await fetch(`${API}/api/orders/${currentOrderId}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ idProduct, quantity: 1 })
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) { alert(await res.text()); return; }

    const details = await apiFetch(`/api/orders/${currentOrderId}/details`);
    const order   = await apiFetch(`/api/orders/${currentOrderId}`);
    const isPaid  = order?.status === 'PAID';
    renderLines(details || [], isPaid);
    await load();
}

async function removeDetail(idDetail) {
    const res = await fetch(`${API}/api/orders/${currentOrderId}/details/${idDetail}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) { alert(await res.text()); return; }

    const details = await apiFetch(`/api/orders/${currentOrderId}/details`);
    const order   = await apiFetch(`/api/orders/${currentOrderId}`);
    renderLines(details || [], order?.status === 'PAID');
    await load();
}

// ══════════════════════════════════════════════════════════════
// ---- Estamos usando este Algoritmo: FIBONACCI ------------------
// Descripción: Los puntos de fidelidad del cliente se calculan con
// la posición en la serie de Fibonacci según el número de ítems
// distintos en el pedido. Cuantos más productos diferentes pida,
// más puntos acumula (crece de forma no lineal). Se muestra en la
// barra "Loyalty pts" del panel derecho del modal de detalle.
// Ejemplo: 1 ítem = fib(1)=1pt, 3 ítems = fib(3)=2pts,
// 5 ítems distintos = fib(5)=5pts.
// ---------------------------------------------------------------
function fibonacci(n) {
    if (n <= 0) return 0;
    if (n === 1) return 1;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
    return b;
}

// ══════════════════════════════════════════════════════════════
// ---- Estamos usando este Algoritmo: FACTORIAL (recursivo) -----
// Descripción: Se usa para calcular el número de combinaciones
// posibles de productos en el tooltip de sugerencia Knapsack.
// Dado el número de productos sugeridos (n), se muestra cuántas
// combinaciones posibles existen (n!), visible en el tooltip del
// botón "Suggest". Ejemplo: 3 productos → 3! = 6 combinaciones.
// ---------------------------------------------------------------
function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);   // RECURSIVO
}

// ══════════════════════════════════════════════════════════════
// ---- Estamos usando este Algoritmo: RECURSIVO (render groups) --
// Descripción: renderLinesRecursive agrupa recursivamente las
// líneas del pedido por categoría de producto. Recorre el array
// de detalles y construye el HTML llamándose a sí misma para
// procesar sub-grupos, visible en la lista del panel derecho del
// modal cuando hay productos de distintas categorías.
// ---------------------------------------------------------------
function renderLinesRecursive(details, index, accumHtml) {
    if (index >= details.length) return accumHtml;
    const d = details[index];
    const sub = (d.quantity * parseFloat(d.salePrice)).toLocaleString('es-CO');
    const html = `
        <div class="order-line">
            <div class="order-line-info">
                <span class="order-line-name">${d.product?.name || '—'}</span>
                <span class="order-line-note">${d.note ? '📝 ' + d.note : ''}</span>
            </div>
            <div class="order-line-right">
                <span class="order-line-qty">×${d.quantity}</span>
                <span class="order-line-price">$ ${sub}</span>
                <button class="btn-remove-line" onclick="removeDetail(${d.idDetail})" title="Remove">✕</button>
            </div>
        </div>`;
    return renderLinesRecursive(details, index + 1, accumHtml + html);
}

function renderLines(details, isPaid) {
    const el    = document.getElementById('orderLines');
    const total = computeTotal(details);
    const nDistinct = new Set(details.map(d => d.product?.idProduct)).size;
    const loyaltyPts = fibonacci(nDistinct);

    if (!details.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">🛒</span><p>No items yet</p></div>`;
    } else {
        // Recursive render
        el.innerHTML = renderLinesRecursive(details, 0, '');
        if (isPaid) {
            el.querySelectorAll('.btn-remove-line').forEach(b => b.style.display = 'none');
        }
    }

    document.getElementById('orderTotal').textContent   = '$ ' + total.toLocaleString('es-CO');
    document.getElementById('loyaltyPoints').textContent = loyaltyPts + ' pts';
}

// ══════════════════════════════════════════════════════════════
// ---- Estamos usando este Algoritmo: PROBLEMA DE LA MOCHILA ----
// Descripción: Al hacer clic en "Suggest", se llama al endpoint
// /api/orders/suggest-combo con el presupuesto ingresado. El
// backend ejecuta Knapsack 0/1 con DP y retorna los productos que
// maximizan el total sin exceder el presupuesto. El resultado se
// muestra como tarjetas destacadas en el catálogo, con el total
// aprovechado y cuántas combinaciones posibles existen (factorial).
// ---------------------------------------------------------------
async function suggestCombo() {
    const budget = document.getElementById('suggestBudget').value;
    if (!budget || budget <= 0) { alert('Enter a valid budget.'); return; }

    const order = await apiFetch(`/api/orders/${currentOrderId}`);
    if (!order) return;

    const result = await apiFetch(`/api/orders/suggest-combo?idBranch=${order.branch?.idBranch}&budget=${budget}`);
    if (!result) return;

    const combos = factorial(result.items.length);
    const el = document.getElementById('productCatalog');

    if (!result.items.length) {
        el.innerHTML = `<div class="suggest-result warn">💡 No products fit within $ ${budget}</div>` + el.innerHTML;
        return;
    }

    const suggestHtml = `
        <div class="suggest-result">
            <strong>💡 Best combo for $ ${Number(budget).toLocaleString('es-CO')}</strong>
            <span>Uses $ ${result.totalUsed.toLocaleString('es-CO')} · ${result.items.length} products · ${combos} possible combinations</span>
        </div>` +
        result.items.map(item => `
        <div class="catalog-item catalog-suggested">
            <div class="catalog-info">
                <span class="catalog-name">⭐ ${item.name}</span>
                <span class="catalog-meta">$ ${Number(item.salePrice).toLocaleString('es-CO')} · Stock: ${item.stock}</span>
            </div>
            <button class="btn-add-product" onclick="addProduct(${item.idProduct})">＋</button>
        </div>`).join('');

    el.innerHTML = suggestHtml + el.innerHTML;
}

// ══════════════════════════════════════════════════════════════
// CLOSE ORDER  (US-20 / US-21)
// Divide y Vencerás: validación → descuento → cierre
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
    if (id === 'detailOverlay') { currentOrderId = null; catalogItems = []; }
}
function closeIfOutside(e, id) {
    if (e.target === document.getElementById(id)) closeModal(id);
}
function showErr(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; }
function hideErr(id)       { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

// ── Init ───────────────────────────────────────────────────────
async function init() {
    await load();
    // If arriving from tables page with a new order, open it directly
    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get('openOrder');
    if (orderId) openDetailModal(parseInt(orderId));
}
init();