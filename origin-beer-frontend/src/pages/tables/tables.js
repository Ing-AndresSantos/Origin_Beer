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

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
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

    const tables = await apiFetch(`/api/tables?idBranch=${idBranch}`) || [];
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
            <p>No active tables for this branch.</p>
            ${isAdmin ? '<button class="btn-primary" onclick="openCreateModal()">+ Add First Table</button>' : ''}
        </div>`;
        return;
    }

    grid.innerHTML = tables.map(t => `
        <div class="table-card" onclick="handleTableClick(${t.idTable})" data-id="${t.idTable}">
            <div class="table-number">${t.tableNumber}</div>
            <div class="table-capacity">👥 ${t.capacity} seats</div>
            <div class="table-status ${t.active ? 'status-active' : 'status-inactive'}">
                ${t.active ? 'Available' : 'Inactive'}
            </div>
            ${isAdmin ? `
            <div class="table-actions" onclick="event.stopPropagation()">
                <button class="btn-icon" title="Edit" onclick="openEditModal(${t.idTable})">✏️</button>
                <button class="btn-icon btn-danger" title="Deactivate" onclick="confirmDelete(${t.idTable}, '${t.tableNumber}')">🗑️</button>
            </div>` : ''}
        </div>
    `).join('');
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

// ── Delete confirmation ────────────────────────────────────────────────────
function confirmDelete(idTable, tableNumber) {
    document.getElementById('deleteTableName').textContent = `Table ${tableNumber}`;
    document.getElementById('btnConfirmDelete').onclick = () => doDelete(idTable);
    openModal('deleteOverlay');
}

async function doDelete(idTable) {
    try {
        const res = await fetch(`${API}/api/tables/${idTable}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) { alert('Could not deactivate table'); return; }
        closeModal('deleteOverlay');
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