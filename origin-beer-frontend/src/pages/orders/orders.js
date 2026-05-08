/**
 * orders.js — Sprint 4 + Sprint 5: Order Management + Billing
 *
 * US-18  Create order by table
 * US-19  Add products to order
 * US-20  Order status control
 * US-21  Automatic inventory deduction on close
 * US-22  List orders by branch
 * US-23  Close order and register payment        ← Sprint 5
 * US-24  Register payment method (CASH/DEBIT/CREDIT) ← Sprint 5
 * US-25  Generate internal invoice               ← Sprint 5
 * US-26  Register branch on each sale            ← Sprint 5
 */

requireAuth();
document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('orders');
initDate();

// ── State ──────────────────────────────────────────────────────
let allOrders        = [];
let allBranches      = [];
let paymentMethods   = [];   // US-24: catalog loaded once on init
let currentOrderId   = null;
let catalogItems     = [];

// ══════════════════════════════════════════════════════════════
// LOAD
// ══════════════════════════════════════════════════════════════
async function load() {
    const [orders, branches, methods] = await Promise.all([
        apiFetch('/api/orders'),
        apiFetch('/api/branches'),
        apiFetch('/api/orders/payment-methods')   // US-24
    ]);

    allOrders      = orders   || [];
    allBranches    = branches || [];
    paymentMethods = methods  || [];

    populateBranchFilter();
    updateStats();
    renderOrders(sortOrdersByDate(allOrders));
}

function populateBranchFilter() {
    const filter   = document.getElementById('filterBranch');
    const foBranch = document.getElementById('foBranch');
    filter.innerHTML   = '<option value="">All branches</option>';
    foBranch.innerHTML = '<option value="">Select branch…</option>';

    allBranches.filter(b => b.active).forEach(b => {
        filter.innerHTML   += `<option value="${b.idBranch}">${b.name}</option>`;
        foBranch.innerHTML += `<option value="${b.idBranch}">${b.name}</option>`;
    });
}

// ══════════════════════════════════════════════════════════════
// ALGORITMO DE ORDENAMIENTO (TimSort via Array.sort)
// Pedidos del más reciente al más antiguo
// ══════════════════════════════════════════════════════════════
function sortOrdersByDate(orders) {
    return [...orders].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
}

// ══════════════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════════════
function updateStats() {
    const today   = new Date().toDateString();
    const open    = allOrders.filter(o => o.status === 'OPEN');
    const paid    = allOrders.filter(o => o.status === 'PAID');
    const todayPd = paid.filter(o => new Date(o.closedAt).toDateString() === today);

    // ALGORITMO ITERATIVO — revenue diario
    let revenue = 0;
    todayPd.forEach(o => { revenue += Number(o.total ?? 0); });

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
        const matchS = !status   || o.status === status;
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
        const total  = Number(o.total ?? 0);
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
                ${isOpen ? `<button class="btn-action btn-activate" onclick="openPaymentModal(${o.idOrder})">💳 Close</button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

// ALGORITMO ITERATIVO — computeTotal
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

    const tableNum  = document.getElementById('foTable').selectedOptions[0]?.text || '';
    const conflict  = allOrders.find(o =>
        o.status === 'OPEN' && String(o.table?.idTable) === String(idTable));
    if (conflict) {
        showErr('newOrderError',
            `⚠️ Table ${tableNum} already has open order #${conflict.idOrder}. Close it before creating a new one.`);
        return;
    }

    const btn = document.getElementById('btnCreateOrder');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
        const res = await fetch(`${API}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ idBranch: +idBranch, idTable: +idTable, idWaiter: user.idUser, notes })
        });
        if (res.status === 401) { logout(); return; }
        if (res.status === 409) { showErr('newOrderError', '⚠️ ' + await res.text()); return; }
        if (!res.ok)            { showErr('newOrderError', await res.text()); return; }
        const order = await res.json();
        closeModal('newOrderOverlay');
        await load();
        openDetailModal(order.idOrder);
    } catch (e) { showErr('newOrderError', 'Could not connect to server.'); }
    finally     { btn.disabled = false; btn.textContent = 'Create Order'; }
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
    document.getElementById('detailStatusBadge').textContent = order.status;
    document.getElementById('detailStatusBadge').className   = `badge ${isPaid ? 'badge-paid' : 'badge-open'}`;

    // Botón Close → abre el modal de pago (US-23)
    const btnClose = document.getElementById('btnCloseOrder');
    btnClose.style.display = isPaid ? 'none' : 'block';
    btnClose.onclick = () => { closeModal('detailOverlay'); openPaymentModal(orderId); };

    const inventory = await apiFetch(`/api/inventory/branch/${order.branch?.idBranch}`);
    catalogItems = (inventory || []).filter(pb => pb.product.active && pb.quantity > 0);
    renderCatalog(catalogItems);
    renderLines(details || [], isPaid);
}

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

// FIBONACCI — loyalty points
function fibonacci(n) {
    if (n <= 0) return 0;
    if (n === 1) return 1;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
    return b;
}

// FACTORIAL recursivo — combinaciones para Knapsack
function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

// RECURSIVO — render lines por grupos
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
    const el         = document.getElementById('orderLines');
    const total      = computeTotal(details);
    const nDistinct  = new Set(details.map(d => d.product?.idProduct)).size;
    const loyaltyPts = fibonacci(nDistinct);

    if (!details.length) {
        el.innerHTML = `<div class="empty-state"><span class="empty-icon">🛒</span><p>No items yet</p></div>`;
    } else {
        el.innerHTML = renderLinesRecursive(details, 0, '');
        if (isPaid) el.querySelectorAll('.btn-remove-line').forEach(b => b.style.display = 'none');
    }
    document.getElementById('orderTotal').textContent    = '$ ' + total.toLocaleString('es-CO');
    document.getElementById('loyaltyPoints').textContent = loyaltyPts + ' pts';
}

// KNAPSACK — suggest combo
async function suggestCombo() {
    const budget = document.getElementById('suggestBudget').value;
    if (!budget || budget <= 0) { alert('Enter a valid budget.'); return; }
    const order  = await apiFetch(`/api/orders/${currentOrderId}`);
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
// PAYMENT MODAL — US-23, US-24, US-25, US-26
// ══════════════════════════════════════════════════════════════
let _payOrderId    = null;
let _payOrderTotal = 0;

async function openPaymentModal(orderId) {
    _payOrderId = orderId;

    hideErr('payError');
    document.getElementById('payOrderId').textContent   = `#${orderId}`;
    document.getElementById('payChangeRow').style.display = 'none';
    document.getElementById('payChange').textContent    = '';
    document.getElementById('payAmountReceived').value  = '';
    document.getElementById('payNotes').value           = '';

    // Obtener total del pedido
    const order = await apiFetch(`/api/orders/${orderId}`);
    if (!order) return;

    _payOrderTotal = Number(order.total ?? 0);
    document.getElementById('payOrderTotal').textContent =
        '$ ' + _payOrderTotal.toLocaleString('es-CO');
    document.getElementById('payBranch').textContent =
        order.branch?.name + ' (' + order.branch?.code + ')';   // US-26

    // Poblar métodos de pago (US-24)
    const methodsSel = document.getElementById('payMethod');
    methodsSel.innerHTML = '<option value="">— Select payment method —</option>';
    paymentMethods.forEach(m => {
        methodsSel.innerHTML += `<option value="${m.idPaymentMethod}">${m.name}</option>`;
    });

    // Detectar cajero de la sesión
    const u = getUser();
    document.getElementById('payCashier').textContent =
        (u.firstName || '') + ' ' + (u.lastName || '');

    document.getElementById('payModalOverlay').classList.add('active');
}

/** Calcula el cambio en tiempo real mientras el cajero escribe */
function onAmountReceivedInput() {
    const received = parseFloat(document.getElementById('payAmountReceived').value) || 0;
    const method   = document.getElementById('payMethod').value;
    const changeRow = document.getElementById('payChangeRow');

    if (method === '1' || document.getElementById('payMethod').selectedOptions[0]?.text === 'CASH') {
        // Solo mostrar cambio para CASH
        if (received > 0) {
            const change = received - _payOrderTotal;
            document.getElementById('payChange').textContent =
                '$ ' + Math.max(0, change).toLocaleString('es-CO');
            changeRow.style.display = 'flex';
            changeRow.style.color   = change < 0 ? '#ef4444' : '#22c55e';
        } else {
            changeRow.style.display = 'none';
        }
    } else {
        changeRow.style.display = 'none';
    }
}

function onPayMethodChange() {
    const methodText = document.getElementById('payMethod').selectedOptions[0]?.text || '';
    const amountRow  = document.getElementById('payAmountRow');

    if (methodText === 'CASH') {
        // Monto recibido obligatorio para efectivo
        amountRow.style.display = 'block';
        document.getElementById('payAmountReceived').placeholder = 'Amount received from customer';
        document.getElementById('payAmountLabel').textContent    = 'Amount Received *';
    } else {
        // Para DEBIT/CREDIT el monto = total exacto
        amountRow.style.display = 'block';
        document.getElementById('payAmountReceived').value       = _payOrderTotal;
        document.getElementById('payAmountReceived').placeholder = 'Total amount';
        document.getElementById('payAmountLabel').textContent    = 'Amount';
        document.getElementById('payChangeRow').style.display    = 'none';
    }
}

async function submitPayment() {
    hideErr('payError');

    const idPaymentMethod = parseInt(document.getElementById('payMethod').value);
    const amountReceived  = parseFloat(document.getElementById('payAmountReceived').value);
    const notes           = document.getElementById('payNotes').value.trim();
    const u               = getUser();

    // Validaciones frontend
    if (!idPaymentMethod) { showErr('payError', 'Select a payment method.'); return; }
    if (isNaN(amountReceived) || amountReceived < 0) {
        showErr('payError', 'Enter a valid amount received.'); return;
    }

    const methodText = document.getElementById('payMethod').selectedOptions[0]?.text || '';
    if (methodText === 'CASH' && amountReceived < _payOrderTotal) {
        showErr('payError',
            `Amount received ($${amountReceived.toLocaleString('es-CO')}) is less than the total ($${_payOrderTotal.toLocaleString('es-CO')}).`);
        return;
    }

    const btn = document.getElementById('btnSubmitPayment');
    btn.disabled = true; btn.textContent = 'Processing…';

    try {
        const res = await fetch(`${API}/api/orders/${_payOrderId}/close`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({
                idCashier:       u.idUser,
                idPaymentMethod: idPaymentMethod,
                amountReceived:  amountReceived,
                notes:           notes || null
            })
        });

        if (res.status === 401) { logout(); return; }
        if (!res.ok) { showErr('payError', await res.text()); return; }

        const invoice = await res.json();

        closeModal('payModalOverlay');
        await load();

        // Mostrar factura generada (US-25)
        showInvoiceModal(invoice);

    } catch (e) {
        showErr('payError', 'Could not connect to server.');
    } finally {
        btn.disabled = false; btn.textContent = '✅ Confirm Payment';
    }
}

// ══════════════════════════════════════════════════════════════
// INVOICE MODAL — US-25  Factura interna
// ══════════════════════════════════════════════════════════════
function showInvoiceModal(invoice) {
    // Generar HTML de líneas de detalle
    const linesHtml = (invoice.details || []).map(d => `
        <tr>
            <td>${d.product?.name || '—'}</td>
            <td style="text-align:center">×${d.quantity}</td>
            <td style="text-align:right">$ ${Number(d.salePrice).toLocaleString('es-CO')}</td>
            <td style="text-align:right">$ ${Number(d.quantity * d.salePrice).toLocaleString('es-CO')}</td>
        </tr>`).join('');

    document.getElementById('invoiceContent').innerHTML = `
        <div class="invoice-header">
            <div class="invoice-logo">🍺 Origin Beer</div>
            <div class="invoice-meta">
                <div class="invoice-num">${invoice.invoiceNumber}</div>
                <div class="invoice-date">${new Date(invoice.issuedAt).toLocaleString('es-CO')}</div>
            </div>
        </div>

        <div class="invoice-info-grid">
            <div class="invoice-info-row">
                <span class="invoice-info-label">📍 Branch</span>
                <span class="invoice-info-val">${invoice.branch} <span class="badge badge-branch">${invoice.branchCode}</span></span>
            </div>
            <div class="invoice-info-row">
                <span class="invoice-info-label">🪑 Table</span>
                <span class="invoice-info-val">${invoice.table}</span>
            </div>
            <div class="invoice-info-row">
                <span class="invoice-info-label">👤 Cashier</span>
                <span class="invoice-info-val">${invoice.cashier}</span>
            </div>
            <div class="invoice-info-row">
                <span class="invoice-info-label">💳 Payment</span>
                <span class="invoice-info-val">${invoice.paymentMethod}</span>
            </div>
        </div>

        <table class="invoice-lines">
            <thead>
                <tr>
                    <th>Product</th>
                    <th style="text-align:center">Qty</th>
                    <th style="text-align:right">Price</th>
                    <th style="text-align:right">Subtotal</th>
                </tr>
            </thead>
            <tbody>${linesHtml}</tbody>
        </table>

        <div class="invoice-totals">
            <div class="invoice-total-row">
                <span>Subtotal</span>
                <span>$ ${Number(invoice.subtotal).toLocaleString('es-CO')}</span>
            </div>
            <div class="invoice-total-row invoice-total-main">
                <span><strong>TOTAL</strong></span>
                <span><strong>$ ${Number(invoice.total).toLocaleString('es-CO')}</strong></span>
            </div>
            <div class="invoice-total-row">
                <span>Amount Received</span>
                <span>$ ${Number(invoice.amountReceived).toLocaleString('es-CO')}</span>
            </div>
            <div class="invoice-total-row invoice-change">
                <span>Change Given</span>
                <span>$ ${Number(invoice.changeGiven).toLocaleString('es-CO')}</span>
            </div>
        </div>

        <div class="invoice-footer">
            🍺 Thank you for visiting Origin Beer!
        </div>`;

    document.getElementById('invoiceModalOverlay').classList.add('active');
}

function printInvoice() {
    const content = document.getElementById('invoiceContent').innerHTML;
    const win     = window.open('', '_blank', 'width=400,height=700');
    win.document.write(`
        <html><head><title>Invoice</title>
        <style>
            body { font-family: monospace; padding: 20px; font-size: 13px; }
            .invoice-logo { font-size:18px; font-weight:bold; text-align:center; margin-bottom:8px; }
            .invoice-num  { font-weight:bold; text-align:center; }
            .invoice-date { text-align:center; color:#666; margin-bottom:12px; }
            table { width:100%; border-collapse:collapse; margin:12px 0; }
            th, td { padding:4px 6px; border-bottom:1px solid #eee; font-size:12px; }
            .invoice-total-main { font-size:15px; border-top:2px solid #333; }
            .invoice-footer { text-align:center; margin-top:12px; }
        </style>
        </head><body>${content}</body></html>`);
    win.document.close();
    win.print();
}

// ── Modal helpers ──────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'detailOverlay')  { currentOrderId = null; catalogItems = []; }
    if (id === 'payModalOverlay') { _payOrderId = null; _payOrderTotal = 0; }
}
function closeIfOutside(e, id) {
    if (e.target === document.getElementById(id)) closeModal(id);
}
function showErr(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg; el.style.display = 'block';
}
function hideErr(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
    await load();
    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get('openOrder');
    if (orderId) openDetailModal(parseInt(orderId));
}
init();