/**
 * tables.js — Waiter Tables Management
 * - View tables for the waiter's assigned branch
 * - Click table to open order modal and submit orders
 * - Branch resolution mirrors Cashier pattern exactly
 *
 * Algorithms:
 *  - Iterativo   : cart total computed iterating over orderCart entries
 *  - Knapsack    : suggestByBudget fills cart maximizing items within budget
 */

requireAuth();
requireRole('WAITER'); // ← guards against wrong-role access

document.getElementById('sidebar').innerHTML = getWaiterSidebar('../');
initSidebar('tables');
initDate();

// ── State ──────────────────────────────────────────────────────────────────
const user           = getUser();
let   allTables      = [];
let   allProducts    = [];
let   filteredProds  = [];
let   orderCart      = {};        // { idProduct: quantity }
let   userBranchId   = null;
let   userBranchName = '—';

// ── Open orders cache ──────────────────────────────────────────
let openOrders = [];

async function loadOpenOrders() {
    const orders = await apiFetch('/api/orders') || [];
    openOrders = orders.filter(o => o.status === 'OPEN');
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
    if (!user?.idUser) { logout(); return; }

    // Load open orders first
    await loadOpenOrders();

    await resolveUserBranch(user.idUser);

    if (!userBranchId) {
        showEmptyState('No branch assigned to this waiter');
        return;
    }

    await loadTables();
}

// ── BRANCH RESOLUTION — same pattern as Cashier ───────────────────────────
async function resolveUserBranch(userId) {
    try {
        const res = await fetch(`${API}/api/branches`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!res.ok) return;

        const branches = await res.json();

        for (const branch of branches) {
            try {
                const r = await fetch(`${API}/api/branches/${branch.idBranch}/users`, {
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });

                if (!r.ok) continue;

                const users = await r.json();

                if (users.some(u => u.idUser === userId)) {
                    userBranchId   = branch.idBranch;
                    userBranchName = branch.name;

                    const headerEl = document.getElementById('branchNameHeader');
                    const titleEl  = document.getElementById('branchTitle');

                    if (headerEl) headerEl.textContent = branch.name;
                    if (titleEl)  titleEl.textContent  = `🏢 ${branch.name}`;

                    break;
                }

            } catch (_) {}
        }

    } catch (e) {
        console.error('Could not load branches', e);
    }
}

// ── Load tables ────────────────────────────────────────────────────────────
async function loadTables() {
    document.getElementById('tablesGrid').innerHTML =
        `<div class="loading-tables">⏳ Loading tables…</div>`;

    try {
        allTables = await apiFetch(`/api/tables?idBranch=${userBranchId}`) || [];

        renderGrid(allTables);
        updateStats(allTables);

    } catch (_) {
        showEmptyState('Could not connect to the server');
    }
}

function renderGrid(tables) {
    const grid = document.getElementById('tablesGrid');

    if (tables.length === 0) {
        grid.innerHTML = `
            <div class="empty-tables">
                <span style="font-size:48px">🪑</span>
                <p>No tables for this branch.</p>
            </div>`;
        return;
    }

    grid.innerHTML = tables.map(t => {

        // Validate occupied table
        const openOrder  = openOrders.find(o => o.table?.idTable === t.idTable);
        const isOccupied = !!openOrder;

        return `
        <div class="table-card 
                    ${t.active ? '' : 'inactive-card'} 
                    ${isOccupied ? 'table-occupied' : ''}"
             id="tableCard-${t.idTable}"
             onclick="${t.active ? `openOrderModal(${t.idTable})` : ''}">

            <div class="table-number">${esc(t.tableNumber)}</div>

            <div class="table-capacity">
                👥 ${t.capacity} seats
            </div>

            <div class="table-status 
                        ${!t.active ? 'status-inactive' : isOccupied ? 'status-occupied' : 'status-active'}"
                 id="tableStatus-${t.idTable}">

                ${
                    !t.active
                    ? 'Inactive'
                    : isOccupied
                        ? `🔴 Occupied — Order #${openOrder.idOrder}`
                        : '🟢 Available'
                }

            </div>
        </div>`;

    }).join('');
}

function updateStats(tables) {
    document.getElementById('statTotal').textContent    = tables.length;
    document.getElementById('statActive').textContent   = tables.filter(t => t.active).length;

    document.getElementById('statCapacity').textContent =
        tables.reduce((s, t) => s + (t.capacity || 0), 0);
}

function showEmptyState(msg) {
    document.getElementById('tablesGrid').innerHTML =
        `<div class="empty-tables">
            <span style="font-size:48px">⚠️</span>
            <p>${msg}</p>
        </div>`;
}

// ── ORDER MODAL ────────────────────────────────────────────────────────────
async function openOrderModal(idTable) {

    const table = allTables.find(t => t.idTable === idTable);

    if (!table) return;

    // ── Validate if table already has open order ─────────────────────
    const openOrder = openOrders.find(o => o.table?.idTable === idTable);

    if (openOrder) {
        document.getElementById('occupiedMessage').textContent =
            `Table ${table.tableNumber} already has open Order #${openOrder.idOrder}.\n\nClose that order before opening a new one, or tap "View Order" to manage it.`;

        document.getElementById('btnViewOrder').onclick = () => {
            closeModal('occupiedOverlay');
            window.location.href = `../orders/orders.html?openOrder=${openOrder.idOrder}`;
        };
        openModal('occupiedOverlay');
        return;
    }

    // Reset cart and UI
    orderCart     = {};
    allProducts   = [];
    filteredProds = [];

    document.getElementById('omTitle').textContent = `📋 New Order`;

    document.getElementById('omSubtitle').textContent =
        `${userBranchName} · Table ${table.tableNumber} · ${user.firstName || 'Waiter'}`;

    document.getElementById('orderError').style.display = 'none';
    document.getElementById('orderError').textContent   = '';

    document.getElementById('omNotes').value         = '';
    document.getElementById('omBudget').value        = '';
    document.getElementById('omProductSearch').value = '';

    document.getElementById('btnSubmitOrder').dataset.table  = table.idTable;
    document.getElementById('btnSubmitOrder').dataset.branch = userBranchId;

    openModal('orderOverlay');

    renderOrderLines();
    updateTotal();

    // Load inventory for this branch — same endpoint as Cashier
    document.getElementById('omProductList').innerHTML =
        `<div class="om-no-products">⏳ Loading products…</div>`;

    try {

        const inventory = await apiFetch(`/api/inventory/branch/${userBranchId}`);

        allProducts = (inventory || [])
            .filter(pb => pb.product?.active && pb.quantity > 0)
            .map(pb => ({
                idProduct : pb.product.idProduct,
                name      : pb.product.name,
                code      : pb.product.code,
                salePrice : Number(pb.product.salePrice || 0),
                stock     : pb.quantity,
                category  : pb.product.category?.name || '—'
            }));

    } catch (_) {
        allProducts = [];
    }

    filteredProds = [...allProducts];

    renderProductList();
}

// ── Product list ───────────────────────────────────────────────────────────
function filterProducts() {
    const q = document.getElementById('omProductSearch').value.toLowerCase().trim();

    filteredProds = q
        ? allProducts.filter(p =>
            p.name?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q) ||
            p.code?.toLowerCase().includes(q))
        : [...allProducts];

    renderProductList();
}

function renderProductList() {
    const el = document.getElementById('omProductList');

    if (filteredProds.length === 0) {
        el.innerHTML = `<div class="om-no-products">No products found</div>`;
        return;
    }

    el.innerHTML = filteredProds.map(p => `
        <div class="om-product-row">
            <div class="om-prod-info">
                <div class="om-prod-name">${esc(p.name)}</div>
                <div class="om-prod-meta">
                    $ ${p.salePrice.toLocaleString('es-CO')}
                    ${p.stock != null ? ` · Stock: ${p.stock}` : ''}
                </div>
            </div>

            <button class="om-add-btn"
                    onclick="addToCart(${p.idProduct})"
                    title="Add">+</button>
        </div>`).join('');
}

// ── Budget suggest — Knapsack greedy ──────────────────────────────────────
function suggestByBudget() {
    const budget = parseFloat(document.getElementById('omBudget').value);

    if (!budget || budget <= 0) return;

    orderCart = {};

    let remaining = budget;

    const sorted = [...allProducts]
        .sort((a, b) => a.salePrice - b.salePrice);

    for (const p of sorted) {

        if (p.salePrice > 0 && p.salePrice <= remaining) {

            const qty = Math.floor(remaining / p.salePrice);

            orderCart[p.idProduct] = qty;

            remaining -= p.salePrice * qty;
        }
    }

    renderProductList();
    renderOrderLines();
    updateTotal();
}

// ── Cart operations ────────────────────────────────────────────────────────
function addToCart(idProduct) {
    orderCart[idProduct] = (orderCart[idProduct] || 0) + 1;
    renderOrderLines();
    updateTotal();
}

function changeQty(idProduct, delta) {
    const next = (orderCart[idProduct] || 0) + delta;

    if (next <= 0) delete orderCart[idProduct];
    else orderCart[idProduct] = next;

    renderOrderLines();
    updateTotal();
}

// ── Render order lines — Algoritmo Iterativo ──────────────────────────────
function renderOrderLines() {
    const el    = document.getElementById('omLines');
    const items = Object.entries(orderCart);

    if (items.length === 0) {
        el.innerHTML = `<div class="om-lines-empty">No products added yet</div>`;
        return;
    }

    el.innerHTML = items.map(([idProduct, qty]) => {

        const p         = allProducts.find(x => x.idProduct == idProduct);
        const unitPrice = p?.salePrice || 0;
        const subtotal  = unitPrice * qty;

        return `
        <div class="om-line">
            <span class="om-line-name">${esc(p?.name || '?')}</span>

            <span class="om-line-unit">
                $ ${unitPrice.toLocaleString('es-CO')}
            </span>

            <div class="om-line-stepper">
                <button class="om-qty-btn"
                        onclick="changeQty(${idProduct}, -1)">−</button>

                <span class="om-line-qty">×${qty}</span>

                <button class="om-qty-btn"
                        onclick="changeQty(${idProduct}, +1)">+</button>
            </div>

            <span class="om-line-price">
                $ ${subtotal.toLocaleString('es-CO')}
            </span>

            <button class="om-line-remove"
                    onclick="changeQty(${idProduct}, -${qty})"
                    title="Remove">✕</button>
        </div>`;
    }).join('');
}

// ── Algoritmo Iterativo — suma subtotales del carrito ─────────────────────
function updateTotal() {

    let total = 0;

    for (const [idProduct, qty] of Object.entries(orderCart)) {

        const p = allProducts.find(x => x.idProduct == idProduct);

        total += (p?.salePrice || 0) * qty;
    }

    document.getElementById('omTotal').textContent =
        `$ ${total.toLocaleString('es-CO')}`;

    document.getElementById('omLoyalty').textContent =
        `${Math.floor(total / 10000)} pts`;
}

// ── Submit order — two-step: header then details ───────────────────────────
async function submitOrder() {
    const btn      = document.getElementById('btnSubmitOrder');
    const idTable  = parseInt(btn.dataset.table);
    const idBranch = parseInt(btn.dataset.branch);
    const notes    = document.getElementById('omNotes').value.trim();
    const errEl    = document.getElementById('orderError');

    const items = Object.entries(orderCart).map(([idProduct, quantity]) =>
        ({ idProduct: parseInt(idProduct), quantity }));

    if (items.length === 0) {
        errEl.textContent   = 'Add at least one product to the order';
        errEl.style.display = 'block';
        return;
    }

    errEl.style.display = 'none';

    btn.disabled = true;
    btn.textContent = 'Creating…';

    try {

        const res = await fetch(`${API}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                idBranch,
                idTable,
                idWaiter: user.idUser,
                notes
            })
        });

        if (res.status === 401) {
            logout();
            return;
        }

        const data = await res.json();

        if (!res.ok) {
            errEl.textContent   = data?.message || 'Could not create order';
            errEl.style.display = 'block';
            return;
        }

        const idOrder = data.idOrder;

        for (const item of items) {

            const detailRes = await fetch(`${API}/api/orders/${idOrder}/details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    idProduct: item.idProduct,
                    quantity : item.quantity
                })
            });

            if (detailRes.status === 401) {
                logout();
                return;
            }

            if (!detailRes.ok) {

                const detailErr = await detailRes.text();

                errEl.textContent =
                    `Order created (#${idOrder}) but failed to add product: ${detailErr}`;

                errEl.style.display = 'block';

                setTimeout(() => {
                    window.location.href =
                        `../orders/orders.html?openOrder=${idOrder}`;
                }, 2500);

                return;
            }
        }

        closeModal('orderOverlay');

        window.location.href =
            `../orders/orders.html?openOrder=${idOrder}`;

    } catch (_) {

        errEl.textContent   = 'Connection error';
        errEl.style.display = 'block';

    } finally {

        btn.disabled = false;
        btn.textContent = '✅ Submit Order';
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function openModal(id)  {
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function closeIfOutside(e, id) {
    if (e.target.id === id) closeModal(id);
}

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);