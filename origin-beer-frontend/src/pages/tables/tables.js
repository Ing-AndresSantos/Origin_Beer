/**
 * tables.js — Tables Management
 * Roles:
 *   ADMIN   → sees all branches via filter, can create/edit/delete tables
 *   CASHIER → sees only their assigned branch(es), can create orders from table
 *   WAITER  → sees only their assigned branch(es), can create orders from table
 *
 * Backend endpoints used:
 *   GET  /api/branches                  → list all branches (ADMIN filter)
 *   GET  /api/tables?idBranch=X         → tables for a branch
 *   GET  /api/tables/user/{id}          → branches assigned to a user (staff)
 *   POST /api/tables                    → create table
 *   PUT  /api/tables/{id}               → edit table
 *   DELETE /api/tables/{id}             → soft-delete table
 *   POST /api/orders                    → create order from table click
 */

requireAuth();
document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('tables');
initDate();

// ── State ──────────────────────────────────────────────────────────────────
const user        = getUser();
const isAdmin     = user.role === 'ADMIN';
let   allTables   = [];
let   myBranches  = [];   // branches this user can see
let   activeBranch = null;

// ── Open orders cache (to detect occupied tables) ──────────────────────────
let openOrders = [];

async function loadOpenOrders() {
    const orders = await apiFetch('/api/orders') || [];
    openOrders = orders.filter(o => o.status === 'OPEN');
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
    await loadOpenOrders();
    if (isAdmin) {
        // Admin: load all branches for the filter dropdown
        const branches = await apiFetch('/api/branches') || [];
        myBranches = branches;
        buildBranchFilter(branches);
        if (branches.length > 0) {
            activeBranch = branches[0].idBranch;
            document.getElementById('branchFilter').value = activeBranch;
            await loadTables(activeBranch);
        }
    } else {
        // Staff: load only their assigned branches
        const branches = await apiFetch(`/api/tables/user/${user.idUser}`) || [];
        myBranches = branches;

        if (branches.length === 0) {
            showEmptyState('No branch assigned to your account.');
            return;
        }

        buildBranchFilter(branches);
        activeBranch = branches[0].idBranch;
        document.getElementById('branchFilter').value = activeBranch;
        await loadTables(activeBranch);
    }
}

function buildBranchFilter(branches) {
    const sel = document.getElementById('branchFilter');
    sel.innerHTML = '';
    branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.idBranch;
        opt.textContent = b.name;
        sel.appendChild(opt);
    });
    // Hide filter row for staff with only one branch
    if (!isAdmin && branches.length <= 1) {
        document.getElementById('filterRow').style.display = 'none';
    }
}

async function loadTables(idBranch) {
    activeBranch = idBranch;
    document.getElementById('tablesGrid').innerHTML = `
        <div class="loading-tables">⏳ Loading tables…</div>`;

    // Admin: fetch all tables (active + inactive) via /api/tables/all, then filter by branch.
    // This keeps inactive tables visible with their inactive styling — matching Cashier behavior.
    // Staff roles keep using the active-only scoped endpoint (unchanged).
    let tables;
    if (isAdmin) {
        const all = await apiFetch('/api/tables/all') || [];
        tables = all.filter(t => t.branch?.idBranch == idBranch);
    } else {
        tables = await apiFetch(`/api/tables?idBranch=${idBranch}`) || [];
    }
    allTables = tables;

    const branchName = (myBranches.find(b => b.idBranch == idBranch) || {}).name || '';
    document.getElementById('branchTitle').textContent =
        branchName ? `🏢 ${branchName}` : '🪑 Tables';

    renderGrid(tables);
    updateStats(tables);
}

function renderGrid(tables) {
    const grid = document.getElementById('tablesGrid');
    if (tables.length === 0) {
        grid.innerHTML = `<div class="empty-tables">
            <span style="font-size:48px">🪑</span>
            <p>No tables for this branch.</p>
            ${isAdmin ? '<button class="btn-primary" onclick="openCreateModal()">+ Add First Table</button>' : ''}
        </div>`;
        return;
    }

    grid.innerHTML = tables.map(t => {
        // Check if this table has an open order
        const openOrder  = openOrders.find(o => o.table?.idTable === t.idTable);
        const isOccupied = !!openOrder;

        // Status styling — mirrors Cashier module exactly
        const statusClass = !t.active  ? 'status-inactive'
                          : isOccupied ? 'status-occupied'
                          : 'status-active';
        const statusLabel = !t.active  ? 'Inactive'
                          : isOccupied ? `🔴 Occupied — Order #${openOrder.idOrder}`
                          : '🟢 Available';

        // Inactive tables: keep card in grid with muted styling, no click action
        const cardClass  = !t.active   ? 'table-card inactive-card'
                         : isOccupied  ? 'table-card table-occupied'
                         : 'table-card';
        const clickAttr  = t.active    ? `onclick="handleTableClick(${t.idTable})"` : '';

        // Admin action buttons: toggle label based on current state
        const adminActions = isAdmin ? `
            <div class="table-actions" onclick="event.stopPropagation()">
                <button class="btn-icon" title="Edit" onclick="openEditModal(${t.idTable})">✏️</button>
                <button class="btn-icon ${t.active ? 'btn-danger' : 'btn-activate'}"
                        title="${t.active ? 'Deactivate' : 'Activate'}"
                        onclick="confirmDelete(${t.idTable}, '${t.tableNumber}', ${t.active})">
                    ${t.active ? '🗑️' : '✅'}
                </button>
            </div>` : '';

        return `
        <div class="${cardClass}" ${clickAttr} data-id="${t.idTable}">
            <div class="table-number">${t.tableNumber}</div>
            <div class="table-capacity">👥 ${t.capacity} seats</div>
            <div class="table-status ${statusClass}">${statusLabel}</div>
            ${adminActions}
        </div>`;
    }).join('');
}

function updateStats(tables) {
    document.getElementById('statTotal').textContent   = tables.length;
    document.getElementById('statActive').textContent  = tables.filter(t => t.active).length;
    document.getElementById('statCapacity').textContent =
        tables.reduce((s, t) => s + (t.capacity || 0), 0);
}

function showEmptyState(msg) {
    document.getElementById('tablesGrid').innerHTML =
        `<div class="empty-tables"><span style="font-size:48px">⚠️</span><p>${msg}</p></div>`;
}

// ── Branch filter change ───────────────────────────────────────────────────
async function onBranchChange() {
    const val = document.getElementById('branchFilter').value;
    if (val) await loadTables(parseInt(val));
}

// ── Table click → open order creation ─────────────────────────────────────
function handleTableClick(idTable) {
    const table = allTables.find(t => t.idTable === idTable);
    if (!table) return;

    // FIX #2: block if table already has an open order
    const openOrder = openOrders.find(o => o.table?.idTable === idTable);
    if (openOrder) {
        alert(`⚠️ Table ${table.tableNumber} already has open Order #${openOrder.idOrder}.\nClose it before opening a new one.`);
        return;
    }

    openOrderFromTable(table);
}

function openOrderFromTable(table) {
    document.getElementById('orderTableInfo').textContent =
        `Table ${table.tableNumber} · ${table.capacity} seats · ${
            (myBranches.find(b => b.idBranch == activeBranch) || {}).name || ''}`;
    document.getElementById('orderHiddenTable').value  = table.idTable;
    document.getElementById('orderHiddenBranch').value = activeBranch;
    document.getElementById('orderError').style.display = 'none';
    document.getElementById('orderNotes').value = '';
    openModal('orderOverlay');
}

async function submitOrder() {
    const idTable  = parseInt(document.getElementById('orderHiddenTable').value);
    const idBranch = parseInt(document.getElementById('orderHiddenBranch').value);
    const notes    = document.getElementById('orderNotes').value.trim();
    const btn      = document.getElementById('btnSubmitOrder');

    btn.disabled = true;
    btn.textContent = 'Creating…';

    try {
        const res = await fetch(`${API}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ idBranch, idTable, idWaiter: user.idUser, notes })
        });

        if (res.status === 401) { logout(); return; }

        const data = await res.json();

        if (!res.ok) {
            showErr('orderError', data || 'Could not create order');
            return;
        }

        closeModal('orderOverlay');
        // Redirect to orders page and open the new order detail directly
        window.location.href = `../orders/orders.html?openOrder=${data.idOrder}`;

    } catch (e) {
        showErr('orderError', 'Connection error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Order';
    }
}

// ── Create table modal ─────────────────────────────────────────────────────
function openCreateModal() {
    document.getElementById('createError').style.display = 'none';
    document.getElementById('createNumber').value  = '';
    document.getElementById('createCapacity').value = '4';
    openModal('createOverlay');
}

async function submitCreate() {
    const tableNumber = document.getElementById('createNumber').value.trim();
    const capacity    = parseInt(document.getElementById('createCapacity').value) || 4;
    const btn         = document.getElementById('btnCreate');

    if (!tableNumber) { showErr('createError', 'Table number is required'); return; }
    if (capacity < 1 || capacity > 30) { showErr('createError', 'Capacity must be 1–30'); return; }

    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        const res = await fetch(`${API}/api/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ idBranch: activeBranch, tableNumber, capacity })
        });
        const data = await res.json();
        if (!res.ok) { showErr('createError', data || 'Error creating table'); return; }
        closeModal('createOverlay');
        await loadTables(activeBranch);
    } catch (e) {
        showErr('createError', 'Connection error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create';
    }
}

// ── Edit table modal ───────────────────────────────────────────────────────
function openEditModal(idTable) {
    const table = allTables.find(t => t.idTable === idTable);
    if (!table) return;

    document.getElementById('editId').value           = idTable;
    document.getElementById('editNumber').value        = table.tableNumber;
    document.getElementById('editCapacity').value      = table.capacity;
    document.getElementById('editActive').checked      = table.active;
    document.getElementById('editError').style.display = 'none';
    openModal('editOverlay');
}

async function submitEdit() {
    const id          = parseInt(document.getElementById('editId').value);
    const tableNumber = document.getElementById('editNumber').value.trim();
    const capacity    = parseInt(document.getElementById('editCapacity').value) || 4;
    const active      = document.getElementById('editActive').checked;
    const btn         = document.getElementById('btnEdit');

    if (!tableNumber) { showErr('editError', 'Table number is required'); return; }

    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        const res = await fetch(`${API}/api/tables/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ tableNumber, capacity, active })
        });
        const data = await res.json();
        if (!res.ok) { showErr('editError', data || 'Error updating table'); return; }
        closeModal('editOverlay');
        await loadTables(activeBranch);
    } catch (e) {
        showErr('editError', 'Connection error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

// ── Toggle active / inactive — mirrors Cashier behavior exactly ───────────
// Mesa desactivada permanece visible en el grid con clase inactive-card.
// Si la mesa ya está inactiva, el botón permite re-activarla.
function confirmDelete(idTable, tableNumber, currentlyActive) {
    const action = currentlyActive ? 'Deactivate' : 'Activate';
    const nameEl = document.getElementById('deleteTableName');
    if (nameEl) nameEl.textContent = `Table ${tableNumber}`;

    // Update confirmation modal text if element exists
    const msgEl = document.getElementById('deleteMessage');
    if (msgEl) {
        msgEl.textContent = currentlyActive
            ? 'The table will remain visible but marked as Inactive.'
            : 'The table will be marked as Active and available again.';
    }

    document.getElementById('btnConfirmDelete').onclick = () => doDelete(idTable, currentlyActive);
    openModal('deleteOverlay');
}

async function doDelete(idTable, currentlyActive) {
    try {
        // Use PUT to set active flag explicitly — matches the backend PUT /api/tables/{id}
        // which accepts { active: bool } without requiring tableNumber/capacity changes.
        // The backend DELETE endpoint is a soft-delete (sets active=false) — we use PUT
        // here so we can also re-activate, and the card stays in the grid either way.
        const table  = allTables.find(t => t.idTable === idTable);
        if (!table) { closeModal('deleteOverlay'); return; }

        const res = await fetch(`${API}/api/tables/${idTable}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({
                tableNumber : table.tableNumber,
                capacity    : table.capacity,
                active      : !currentlyActive      // toggle
            })
        });
        if (!res.ok) { alert('Could not update table status'); return; }

        closeModal('deleteOverlay');
        // Reload keeping inactive tables visible (Admin-scoped fetch via /api/tables/all)
        await loadTables(activeBranch);
    } catch (e) {
        alert('Connection error');
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeIfOutside(e, id) { if (e.target.id === id) closeModal(id); }
function showErr(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.style.display = 'block';
}

// ── Init ───────────────────────────────────────────────────────────────────
boot();