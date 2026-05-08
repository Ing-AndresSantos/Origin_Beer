/**
 * orders.js — Cashier Orders Management
 * Sprint 4 + Sprint 5
 *
 * US-20  Order status control
 * US-21  Automatic inventory deduction on close
 * US-22  List orders by branch
 * US-23  Close order and register payment        ← Sprint 5
 * US-24  Register payment method (CASH/DEBIT/CREDIT) ← Sprint 5
 * US-25  Generate internal invoice               ← Sprint 5
 * US-26  Register branch on each sale            ← Sprint 5
 */

requireAuth();
document.getElementById('sidebar').innerHTML = getCashierSidebar('../');
initSidebar('orders');
initDate();

// ── State ──────────────────────────────────────────────────────
let allOrders      = [];
let paymentMethods = [];
let currentOrderId = null;
let userBranchId   = null;
let _payOrderId    = null;
let _payOrderTotal = 0;

// ══════════════════════════════════════════════════════════════
// BRANCH RESOLUTION
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
                if (users.some(u => u.idUser === userId)) return branch.idBranch;
            } catch (_) {}
        }
    } catch (e) { console.error('Could not resolve branch', e); }
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
            `<tr><td colspan="7" class="loading-row">⚠️ No branch assigned to this cashier</td></tr>`;
        return;
    }

    // Cargar órdenes y métodos de pago en paralelo
    const [orders, methods] = await Promise.all([
        apiFetch(`/api/orders/branch/${userBranchId}`),
        apiFetch('/api/orders/payment-methods')
    ]);

    allOrders      = orders   || [];
    paymentMethods = methods  || [];

    updateStats();
    renderOrders(sortOrdersByDate(allOrders));
}

// ══════════════════════════════════════════════════════════════
// ALGORITMO DE ORDENAMIENTO — TimSort
// ══════════════════════════════════════════════════════════════
function sortOrdersByDate(orders) {
    return [...orders].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
}

// ══════════════════════════════════════════════════════════════
// STATS — ALGORITMO ITERATIVO
// ══════════════════════════════════════════════════════════════
function updateStats() {
    const today   = new Date().toDateString();
    const open    = allOrders.filter(o => o.status === 'OPEN');
    const paid    = allOrders.filter(o => o.status === 'PAID');
    const todayPd = paid.filter(o => new Date(o.closedAt).toDateString() === today);

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
    const q      = document.getElementById('search').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;

    const result = allOrders.filter(o => {
        const text = `${o.idOrder} ${o.table?.tableNumber || ''} ${o.waiter?.firstName || ''} ${o.waiter?.lastName || ''}`.toLowerCase();
        return (!q || text.includes(q)) && (!status || o.status === status);
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
                ${isOpen ? `<button class="btn-action btn-activate" onclick="openPaymentModal(${o.idOrder})">💳 Close</button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

// ALGORITMO ITERATIVO — total del pedido
function computeTotal(details) {
    let total = 0;
    for (const d of details) total += (d.quantity || 0) * parseFloat(d.salePrice || 0);
    return total;
}

// ══════════════════════════════════════════════════════════════
// DETAIL MODAL
// ══════════════════════════════════════════════════════════════
async function openDetailModal(orderId) {
    currentOrderId = orderId;
    document.getElementById('detailOverlay').classList.add('active');
    document.getElementById('detailTitle').textContent = `🧾 Order #${orderId}`;
    document.getElementById('orderLines').innerHTML    = '<div class="empty-state"><span class="empty-icon">⏳</span><p>Loading…</p></div>';

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

    document.getElementById('infoTable').textContent  = order.table?.tableNumber || '—';
    document.getElementById('infoWaiter').textContent = (order.waiter?.firstName || '—') + ' ' + (order.waiter?.lastName || '');
    document.getElementById('infoOpened').textContent = order.openedAt ? new Date(order.openedAt).toLocaleString('es-CO') : '—';
    document.getElementById('infoItems').textContent  = details?.length || 0;

    // Botón Close → abre modal de pago (US-23)
    const btnClose = document.getElementById('btnCloseOrder');
    btnClose.style.display = isPaid ? 'none' : 'block';
    btnClose.onclick = () => { closeModal('detailOverlay'); openPaymentModal(orderId); };

    renderLines(details || [], isPaid);
}

// ALGORITMO RECURSIVO — render lines
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

    el.innerHTML = details.length
        ? renderLinesRecursive(details, 0, '')
        : `<div class="empty-state"><span class="empty-icon">🛒</span><p>No items</p></div>`;

    document.getElementById('orderTotal').textContent = '$ ' + total.toLocaleString('es-CO');
    const loyaltyEl = document.getElementById('loyaltyPoints');
    if (loyaltyEl) loyaltyEl.textContent = fibonacci(new Set(details.map(d => d.product?.idProduct)).size) + ' pts';
}

// Fibonacci — loyalty points
function fibonacci(n) {
    if (n <= 0) return 0;
    if (n === 1) return 1;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
    return b;
}

// ══════════════════════════════════════════════════════════════
// PAYMENT MODAL — US-23, US-24, US-25, US-26
// ══════════════════════════════════════════════════════════════
async function openPaymentModal(orderId) {
    _payOrderId = orderId;
    hideErr('payError');
    document.getElementById('payOrderId').textContent      = `#${orderId}`;
    document.getElementById('payChangeRow').style.display  = 'none';
    document.getElementById('payChange').textContent       = '';
    document.getElementById('payAmountReceived').value     = '';
    document.getElementById('payNotes').value              = '';

    const order = await apiFetch(`/api/orders/${orderId}`);
    if (!order) return;

    _payOrderTotal = Number(order.total ?? 0);
    document.getElementById('payOrderTotal').textContent =
        '$ ' + _payOrderTotal.toLocaleString('es-CO');
    document.getElementById('payBranch').textContent =
        (order.branch?.name || '—') + ' (' + (order.branch?.code || '—') + ')';

    // Poblar métodos de pago (US-24)
    const methodsSel = document.getElementById('payMethod');
    methodsSel.innerHTML = '<option value="">— Select payment method —</option>';
    paymentMethods.forEach(m => {
        methodsSel.innerHTML += `<option value="${m.idPaymentMethod}">${m.name}</option>`;
    });

    const u = getUser();
    document.getElementById('payCashier').textContent = (u.firstName || '') + ' ' + (u.lastName || '');

    document.getElementById('payModalOverlay').classList.add('active');
}

function onAmountReceivedInput() {
    const received  = parseFloat(document.getElementById('payAmountReceived').value) || 0;
    const methodTxt = document.getElementById('payMethod').selectedOptions[0]?.text || '';
    const changeRow = document.getElementById('payChangeRow');

    if (methodTxt === 'CASH' && received > 0) {
        const change = received - _payOrderTotal;
        document.getElementById('payChange').textContent =
            '$ ' + Math.max(0, change).toLocaleString('es-CO');
        changeRow.style.display = 'flex';
        changeRow.style.color   = change < 0 ? '#ef4444' : '#22c55e';
    } else {
        changeRow.style.display = 'none';
    }
}

function onPayMethodChange() {
    const methodTxt = document.getElementById('payMethod').selectedOptions[0]?.text || '';
    if (methodTxt !== 'CASH') {
        // Para DEBIT/CREDIT el monto = total exacto
        document.getElementById('payAmountReceived').value       = _payOrderTotal;
        document.getElementById('payAmountLabel').textContent    = 'Amount';
        document.getElementById('payChangeRow').style.display    = 'none';
    } else {
        document.getElementById('payAmountReceived').value       = '';
        document.getElementById('payAmountLabel').textContent    = 'Amount Received *';
    }
}

async function submitPayment() {
    hideErr('payError');

    const idPaymentMethod = parseInt(document.getElementById('payMethod').value);
    const amountReceived  = parseFloat(document.getElementById('payAmountReceived').value);
    const notes           = document.getElementById('payNotes').value.trim();
    const u               = getUser();
    const methodTxt       = document.getElementById('payMethod').selectedOptions[0]?.text || '';

    if (!idPaymentMethod)                        { showErr('payError', 'Select a payment method.'); return; }
    if (isNaN(amountReceived) || amountReceived < 0) { showErr('payError', 'Enter a valid amount.'); return; }
    if (methodTxt === 'CASH' && amountReceived < _payOrderTotal) {
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
        showInvoiceModal(invoice);

    } catch (e) {
        showErr('payError', 'Could not connect to server.');
    } finally {
        btn.disabled = false; btn.textContent = '✅ Confirm Payment';
    }
}

// ══════════════════════════════════════════════════════════════
// INVOICE MODAL — US-25
// ══════════════════════════════════════════════════════════════
function showInvoiceModal(invoice) {
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
        <div class="invoice-footer">🍺 Thank you for visiting Origin Beer!</div>`;

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
    if (id === 'detailOverlay')   { currentOrderId = null; }
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
load();