/**
 * tables.js — Cashier Tables Management
 * - Full CRUD: create + edit (no delete button on cards)
 * - Edit keeps card in grid, only updates badge
 * - Order modal: two-column layout with budget/suggest, product search,
 *   order lines with +/− steppers, total, loyalty pts, notes, pay button
 */

requireAuth();
document.getElementById('sidebar').innerHTML = getCashierSidebar('../');
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

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
    if (!user?.idUser) { logout(); return; }
    await resolveUserBranch(user.idUser);
    if (!userBranchId) {
        showEmptyState('No branch assigned to this cashier');
        return;
    }
    await loadTables();
}

// ── BRANCH RESOLUTION ─────────────────────────────────────────────────────
// Shared pattern: finds the branch this cashier belongs to.
// Does not expose other branches.
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
        grid.innerHTML = `<div class="empty-tables">
            <span style="font-size:48px">🪑</span><p>No tables for this branch.</p></div>`;
        return;
    }
    grid.innerHTML = tables.map(t => `
        <div class="table-card ${t.active ? '' : 'inactive-card'}"
             id="tableCard-${t.idTable}"
             onclick="${t.active ? `openOrderModal(${t.idTable})` : ''}">
            <div class="table-actions" onclick="event.stopPropagation()">
                <button class="btn-icon" title="Edit" onclick="openEditModal(${t.idTable})">✏️</button>
            </div>
            <div class="table-number">${esc(t.tableNumber)}</div>
            <div class="table-capacity">👥 ${t.capacity} seats</div>
            <div class="table-status ${t.active ? 'status-active' : 'status-inactive'}"
                 id="tableStatus-${t.idTable}">
                ${t.active ? 'Available' : 'Inactive'}
            </div>
        </div>`).join('');
}

function updateStats(tables) {
    document.getElementById('statTotal').textContent    = tables.length;
    document.getElementById('statActive').textContent   = tables.filter(t => t.active).length;
    document.getElementById('statCapacity').textContent =
        tables.reduce((s, t) => s + (t.capacity || 0), 0);
}

function showEmptyState(msg) {
    document.getElementById('tablesGrid').innerHTML =
        `<div class="empty-tables"><span style="font-size:48px">⚠️</span><p>${msg}</p></div>`;
}

// ── CREATE TABLE ───────────────────────────────────────────────────────────
function openCreateModal() {
    document.getElementById('createNumber').value            = '';
    document.getElementById('createCapacity').value         = '4';
    document.getElementById('createError').style.display    = 'none';
    openModal('createOverlay');
    setTimeout(() => document.getElementById('createNumber').focus(), 80);
}

async function submitCreate() {
    const tableNumber = document.getElementById('createNumber').value.trim();
    const capacity    = parseInt(document.getElementById('createCapacity').value) || 4;
    const btn         = document.getElementById('btnCreate');
    if (!tableNumber) { showErr('createError', 'Table number is required'); return; }

    btn.disabled = true; btn.textContent = 'Creating…';
    try {
        const res = await fetch(`${API}/api/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ tableNumber, capacity, idBranch: userBranchId, active: true })
        });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        if (!res.ok) { showErr('createError', data?.message || 'Could not create table'); return; }
        closeModal('createOverlay');
        await loadTables();
    } catch (_) {
        showErr('createError', 'Connection error');
    } finally {
        btn.disabled = false; btn.textContent = 'Create';
    }
}

// ── EDIT TABLE ─────────────────────────────────────────────────────────────
function openEditModal(idTable) {
    const t = allTables.find(x => x.idTable === idTable);
    if (!t) return;
    document.getElementById('editId').value             = t.idTable;
    document.getElementById('editNumber').value         = t.tableNumber;
    document.getElementById('editCapacity').value       = t.capacity;
    document.getElementById('editActive').checked       = t.active;
    document.getElementById('editError').style.display  = 'none';
    openModal('editOverlay');
    setTimeout(() => document.getElementById('editNumber').focus(), 80);
}

async function submitEdit() {
    const idTable     = parseInt(document.getElementById('editId').value);
    const tableNumber = document.getElementById('editNumber').value.trim();
    const capacity    = parseInt(document.getElementById('editCapacity').value) || 4;
    const active      = document.getElementById('editActive').checked;
    const btn         = document.getElementById('btnEdit');
    if (!tableNumber) { showErr('editError', 'Table number is required'); return; }

    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        const res = await fetch(`${API}/api/tables/${idTable}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ tableNumber, capacity, active, idBranch: userBranchId })
        });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        if (!res.ok) { showErr('editError', data?.message || 'Could not update table'); return; }

        const idx = allTables.findIndex(x => x.idTable === idTable);
        if (idx !== -1) { allTables[idx] = { ...allTables[idx], tableNumber, capacity, active }; }
        patchCard(allTables[idx]);
        updateStats(allTables);
        closeModal('editOverlay');
    } catch (_) {
        showErr('editError', 'Connection error');
    } finally {
        btn.disabled = false; btn.textContent = 'Save';
    }
}

function patchCard(t) {
    const card = document.getElementById(`tableCard-${t.idTable}`);
    if (!card) return;
    card.querySelector('.table-number').textContent   = t.tableNumber;
    card.querySelector('.table-capacity').textContent = `👥 ${t.capacity} seats`;

    const st = document.getElementById(`tableStatus-${t.idTable}`);
    if (st) {
        st.className   = `table-status ${t.active ? 'status-active' : 'status-inactive'}`;
        st.textContent = t.active ? 'Available' : 'Inactive';
    }
    if (t.active) {
        card.classList.remove('inactive-card');
        card.onclick = () => openOrderModal(t.idTable);
    } else {
        card.classList.add('inactive-card');
        card.onclick = null;
    }
}

// ── ORDER MODAL ────────────────────────────────────────────────────────────
async function openOrderModal(idTable) {
    const table = allTables.find(t => t.idTable === idTable);
    if (!table) return;

    // Reset cart and UI
    orderCart = {};
    document.getElementById('omTitle').textContent    = `📋 New Order`;
    document.getElementById('omSubtitle').textContent =
        `${userBranchName} · Table ${table.tableNumber} · ${user.firstName || 'Cashier'}`;
    document.getElementById('orderError').style.display = 'none';
    document.getElementById('orderError').textContent   = '';
    document.getElementById('omNotes').value            = '';
    document.getElementById('omBudget').value           = '';
    document.getElementById('omProductSearch').value    = '';

    document.getElementById('btnSubmitOrder').dataset.table  = table.idTable;
    document.getElementById('btnSubmitOrder').dataset.branch = userBranchId;

    openModal('orderOverlay');
    renderOrderLines();
    updateTotal();

    // Load inventory for this branch to get stock + salePrice
    document.getElementById('omProductList').innerHTML =
        `<div class="om-no-products">⏳ Loading products…</div>`;
    try {
        const inventory = await apiFetch(`/api/inventory/branch/${userBranchId}`);
        // Map inventory to a product list with the fields the modal needs
        allProducts = (inventory || [])
            .filter(pb => pb.product?.active && pb.quantity > 0)
            .map(pb => ({
                idProduct : pb.product.idProduct,
                name      : pb.product.name,
                code      : pb.product.code,
                // salePrice is the correct field — not `price`
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

// Product list
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
            <button class="om-add-btn" onclick="addToCart(${p.idProduct})" title="Add">+</button>
        </div>`).join('');
}

// Budget suggest — greedy fill using salePrice
function suggestByBudget() {
    const budget = parseFloat(document.getElementById('omBudget').value);
    if (!budget || budget <= 0) return;
    orderCart = {};
    let remaining = budget;
    const sorted  = [...allProducts].sort((a, b) => a.salePrice - b.salePrice);
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

// Cart operations
function addToCart(idProduct) {
    orderCart[idProduct] = (orderCart[idProduct] || 0) + 1;
    renderOrderLines();
    updateTotal();
}

function changeQty(idProduct, delta) {
    const next = (orderCart[idProduct] || 0) + delta;
    if (next <= 0) { delete orderCart[idProduct]; }
    else           { orderCart[idProduct] = next; }
    renderOrderLines();
    updateTotal();
}

// ---- ALGORITMO ITERATIVO ----
// Recorre las líneas del carrito y construye el HTML,
// mostrando precio unitario y subtotal por línea.
function renderOrderLines() {
    const el    = document.getElementById('omLines');
    const items = Object.entries(orderCart);

    if (items.length === 0) {
        el.innerHTML = `<div class="om-lines-empty">No products added yet</div>`;
        return;
    }

    el.innerHTML = items.map(([idProduct, qty]) => {
        const p        = allProducts.find(x => x.idProduct == idProduct);
        const unitPrice = p?.salePrice || 0;
        const subtotal  = unitPrice * qty;
        return `
        <div class="om-line">
            <span class="om-line-name">${esc(p?.name || '?')}</span>
            <span class="om-line-unit">$ ${unitPrice.toLocaleString('es-CO')}</span>
            <div class="om-line-stepper">
                <button class="om-qty-btn" onclick="changeQty(${idProduct}, -1)">−</button>
                <span class="om-line-qty">×${qty}</span>
                <button class="om-qty-btn" onclick="changeQty(${idProduct}, +1)">+</button>
            </div>
            <span class="om-line-price">$ ${subtotal.toLocaleString('es-CO')}</span>
            <button class="om-line-remove" onclick="changeQty(${idProduct}, -${qty})" title="Remove">✕</button>
        </div>`;
    }).join('');
}

// ---- ALGORITMO ITERATIVO ----
// Suma los subtotales del carrito iterando sobre cada entrada.
// Usa salePrice (campo correcto del modelo Product).
function updateTotal() {
    let total = 0;
    for (const [idProduct, qty] of Object.entries(orderCart)) {
        const p  = allProducts.find(x => x.idProduct == idProduct);
        total   += (p?.salePrice || 0) * qty;
    }
    document.getElementById('omTotal').textContent   = `$ ${total.toLocaleString('es-CO')}`;
    document.getElementById('omLoyalty').textContent = `${Math.floor(total / 10000)} pts`;
}

// Submit order
// FIX: After creating the order header, POST each cart item as an order detail
// so the backend can compute the correct total from order_detail lines.
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

    btn.disabled = true; btn.textContent = 'Creating…';
    try {
        // Step 1 — Create the order header (branch + table + waiter)
        const res = await fetch(`${API}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ idBranch, idTable, idWaiter: user.idUser, notes })
        });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent   = data?.message || 'Could not create order';
            errEl.style.display = 'block';
            return;
        }

        const idOrder = data.idOrder;

        // Step 2 — POST each cart item as an order detail
        // The backend computes the total by summing order_detail lines,
        // so the details MUST exist before the order total is meaningful.
        for (const item of items) {
            const detailRes = await fetch(`${API}/api/orders/${idOrder}/details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ idProduct: item.idProduct, quantity: item.quantity })
            });
            if (detailRes.status === 401) { logout(); return; }
            if (!detailRes.ok) {
                const detailErr = await detailRes.text();
                errEl.textContent   = `Order created (#${idOrder}) but failed to add product: ${detailErr}`;
                errEl.style.display = 'block';
                // Redirect anyway so the cashier can manually fix the order
                setTimeout(() => {
                    window.location.href = `../orders/orders.html?openOrder=${idOrder}`;
                }, 2500);
                return;
            }
        }

        closeModal('orderOverlay');
        window.location.href = `../orders/orders.html?openOrder=${idOrder}`;
    } catch (_) {
        errEl.textContent   = 'Connection error';
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false; btn.textContent = '✅ Close & Pay Order';
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeIfOutside(e, id) { if (e.target.id === id) closeModal(id); }
function showErr(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg; el.style.display = 'block';
}
function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);