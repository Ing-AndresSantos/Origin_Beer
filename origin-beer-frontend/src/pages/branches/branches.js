requireAuth();

document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('branches');
initDate();

let allBranches  = [];
let editingId    = null;   // null = create mode, number = edit mode
let assigningId  = null;   // branch id being assigned

// ── LOAD ─────────────────────────────────────────────────────
async function loadBranches() {
    try {
        const res = await fetch(`${API}/api/branches`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        allBranches = await res.json();
        updateStats();
        filter();
    } catch (e) {
        document.getElementById('branchesGrid').innerHTML =
            `<div style="grid-column:1/-1"><div class="empty-state"><span class="empty-icon">❌</span><p>Could not connect to the server</p></div></div>`;
    }
}

// ── STATS ────────────────────────────────────────────────────
function updateStats() {
    const active = allBranches.filter(s => s.active).length;
    document.getElementById('totalBranches').textContent = allBranches.length;
    document.getElementById('totalActive').textContent   = active;
    document.getElementById('totalInactive').textContent = allBranches.length - active;
}

// ── FILTER ───────────────────────────────────────────────────
function filter() {
    const search = document.getElementById('search').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;

    const result = allBranches.filter(s => {
        const text = `${s.name} ${s.city || ''} ${s.code}`.toLowerCase();
        const matchSearch = text.includes(search);
        const matchStatus = !status ||
            (status === 'active'   && s.active) ||
            (status === 'inactive' && !s.active);
        return matchSearch && matchStatus;
    });

    document.getElementById('resultInfo').textContent =
        `${result.length} branch${result.length !== 1 ? 'es' : ''} found`;
    renderBranches(result);
}

// ── RENDER ───────────────────────────────────────────────────
function renderBranches(branches) {
    const grid = document.getElementById('branchesGrid');
    if (!branches.length) {
        grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><span class="empty-icon">🔍</span><p>No branches found</p></div></div>`;
        return;
    }
    grid.innerHTML = branches.map(s => `
        <div class="branch-card ${s.active ? '' : 'branch-card-inactive'}">
            <div class="branch-card-header">
                <div>
                    <div class="branch-icon">🏢</div>
                    <div class="branch-name">${s.name}</div>
                    <div class="branch-code">${s.code}</div>
                </div>
                <span class="badge ${s.active ? 'badge-active' : 'badge-inactive'}">${s.active ? 'Active' : 'Inactive'}</span>
            </div>
            <div class="branch-card-body">
                <div class="branch-detail"><span>📍</span> ${s.address || 'No address'}</div>
                <div class="branch-detail"><span>🏙️</span> ${s.city || '—'}</div>
                <div class="branch-detail"><span>📞</span> ${s.phone || '—'}</div>
                <div class="branch-detail"><span>✉️</span> ${s.email || '—'}</div>
            </div>
            <div class="branch-card-actions">
                <button class="btn-action btn-edit"   onclick="openEditModal(${s.idBranch})">✏️ Edit</button>
                <button class="btn-action btn-users"  onclick="openAssignModal(${s.idBranch}, '${escHtml(s.name)}')">👥 Users</button>
                <button class="btn-action ${s.active ? 'btn-deactivate' : 'btn-activate'}"
                        onclick="toggleStatus(${s.idBranch}, ${s.active})">
                    ${s.active ? '🔴 Deactivate' : '✅ Activate'}
                </button>
            </div>
        </div>
    `).join('');
}

function escHtml(str) {
    return str.replace(/'/g, "\\'");
}

// ════════════════════════════════════════════════════════════
// CREATE / EDIT MODAL
// ════════════════════════════════════════════════════════════
function openCreateModal() {
    editingId = null;
    clearForm();
    document.getElementById('modalTitle').textContent = '🏢 New Branch';
    document.getElementById('btnSave').textContent    = 'Create Branch';
    document.getElementById('fCode').removeAttribute('disabled');
    document.getElementById('modalOverlay').classList.add('active');
}

function openEditModal(id) {
    const branch = allBranches.find(b => b.idBranch === id);
    if (!branch) return;

    editingId = id;
    clearForm();
    document.getElementById('modalTitle').textContent = '✏️ Edit Branch';
    document.getElementById('btnSave').textContent    = 'Save Changes';

    // Fill form
    document.getElementById('fCode').value    = branch.code;
    document.getElementById('fName').value    = branch.name;
    document.getElementById('fCity').value    = branch.city    || '';
    document.getElementById('fPhone').value   = branch.phone   || '';
    document.getElementById('fAddress').value = branch.address || '';
    document.getElementById('fEmail').value   = branch.email   || '';

    // Code is not editable in edit mode (it's a unique key)
    document.getElementById('fCode').setAttribute('disabled', true);

    document.getElementById('modalOverlay').classList.add('active');
}

function closeCreateModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    clearForm();
    editingId = null;
}


function clearForm() {
    ['fCode', 'fName', 'fCity', 'fPhone', 'fAddress', 'fEmail'].forEach(id => {
        document.getElementById(id).value = '';
    });
    hideError('modalError');
}

// ── SAVE (create or edit) ────────────────────────────────────
async function saveBranch() {
    hideError('modalError');

    const name = document.getElementById('fName').value.trim();
    const code = document.getElementById('fCode').value.trim();

    if (!name) { showError('modalError', 'Branch name is required.'); return; }

    const btn = document.getElementById('btnSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        let res;

        if (editingId === null) {
            // ── CREATE ──
            if (!code) { showError('modalError', 'Branch code is required.'); return; }

            const user = getUser();
            if (!user || !user.idUser) { showError('modalError', 'Session error. Please log in again.'); return; }

            res = await fetch(`${API}/api/branches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({
                    code,
                    name,
                    address:   document.getElementById('fAddress').value.trim() || null,
                    city:      document.getElementById('fCity').value.trim()    || null,
                    phone:     document.getElementById('fPhone').value.trim()   || null,
                    email:     document.getElementById('fEmail').value.trim()   || null,
                    createdBy: user.idUser
                })
            });

            if (res.status === 409) { showError('modalError', 'A branch with that code already exists.'); return; }

        } else {
            // ── EDIT ──
            res = await fetch(`${API}/api/branches/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({
                    name,
                    address: document.getElementById('fAddress').value.trim() || null,
                    city:    document.getElementById('fCity').value.trim()    || null,
                    phone:   document.getElementById('fPhone').value.trim()   || null,
                    email:   document.getElementById('fEmail').value.trim()   || null,
                })
            });
        }

        if (res.status === 401) { logout(); return; }
        if (!res.ok) { const msg = await res.text(); showError('modalError', msg || 'Error saving branch.'); return; }

        closeCreateModal();
        await loadBranches();

    } catch (e) {
        showError('modalError', 'Could not connect to the server.');
    } finally {
        btn.disabled = false;
        btn.textContent = editingId === null ? 'Create Branch' : 'Save Changes';
    }
}

// ════════════════════════════════════════════════════════════
// TOGGLE STATUS
// ════════════════════════════════════════════════════════════
async function toggleStatus(id, currentActive) {
    const action = currentActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this branch?`)) return;

    try {
        const res = await fetch(`${API}/api/branches/${id}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) { alert('Error updating status.'); return; }
        await loadBranches();
    } catch (e) {
        alert('Could not connect to the server.');
    }
}

// ════════════════════════════════════════════════════════════
// ASSIGN USERS MODAL
// ════════════════════════════════════════════════════════════
async function openAssignModal(branchId, branchName) {
    assigningId = branchId;
    document.getElementById('assignBranchName').textContent = branchName;
    document.getElementById('assignOverlay').classList.add('active');
    hideError('assignError');

    const list = document.getElementById('userCheckList');
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">⏳</span><p>Loading users...</p></div>`;

    try {
        // Load all users and current assignments in parallel
        const [usersRes, assignedRes] = await Promise.all([
            fetch(`${API}/api/users`,                          { headers: { 'Authorization': `Bearer ${getToken()}` } }),
            fetch(`${API}/api/branches/${branchId}/users`,        { headers: { 'Authorization': `Bearer ${getToken()}` } })
        ]);

        if (usersRes.status === 401) { logout(); return; }

        const users    = await usersRes.json();
        const assigned = assignedRes.ok ? await assignedRes.json() : [];
        const assignedIds = new Set(assigned.map(u => u.idUser));

        if (!users.length) {
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">👤</span><p>No users available</p></div>`;
            return;
        }

        list.innerHTML = users
            .filter(u => u.active)
            .map(u => `
                <label class="user-check-item">
                    <input type="checkbox" value="${u.idUser}" ${assignedIds.has(u.idUser) ? 'checked' : ''}>
                    <div class="user-check-info">
                        <span class="user-check-name">${u.firstName} ${u.lastName}</span>
                        <span class="user-check-meta">${u.role?.name || '—'} · ${u.email}</span>
                    </div>
                </label>
            `).join('');

    } catch (e) {
        list.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><p>Could not load users</p></div>`;
    }
}

function closeAssignModal() {
    document.getElementById('assignOverlay').classList.remove('active');
    assigningId = null;
}


// Pending payload while reassign confirmation is open
let _pendingReassignIds = null;

async function saveAssignments() {
    hideError('assignError');

    const checkboxes  = document.querySelectorAll('#userCheckList input[type=checkbox]');
    const selectedIds = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));

    const admin = getUser();
    if (!admin || !admin.idUser) { showError('assignError', 'Session error. Please log in again.'); return; }

    // Detect which selected users are in another branch (need reassignment)
    const ubMap = window._userBranchMap || {};
    const toReassign = selectedIds
        .filter(id => ubMap[id])
        .map(id => ({ id, branchName: ubMap[id] }));

    if (toReassign.length > 0) {
        // Show confirmation modal before proceeding
        _pendingReassignIds = selectedIds;
        const targetName = document.getElementById('assignBranchName').textContent;
        document.getElementById('reassignTargetBranch').textContent = targetName;
        document.getElementById('reassignList').innerHTML = toReassign
            .map(u => {
                const checkboxLabel = document.querySelector(`#userCheckList input[value="${u.id}"]`)
                    ?.closest('label')?.querySelector('.user-check-name')?.textContent || 'User #' + u.id;
                return `<div class="reassign-item">👤 <strong>${checkboxLabel}</strong> — currently in <em>"${u.branchName}"</em></div>`;
            }).join('');
        document.getElementById('reassignOverlay').classList.add('active');
        return;
    }

    // No conflicts — save directly
    await doSaveAssignments(selectedIds);
}

function closeReassignModal() {
    document.getElementById('reassignOverlay').classList.remove('active');
    _pendingReassignIds = null;
}

async function confirmReassign() {
    if (!_pendingReassignIds) return;
    const btn = document.getElementById('btnConfirmReassign');
    btn.disabled = true;
    btn.textContent = 'Reassigning…';
    try {
        await doSaveAssignments(_pendingReassignIds);
    } finally {
        btn.disabled = false;
        btn.textContent = '✅ Yes, Reassign';
        closeReassignModal();
    }
}

async function doSaveAssignments(selectedIds) {
    const admin = getUser();
    const btn   = document.getElementById('btnAssign');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
        const res = await fetch(`${API}/api/branches/${assigningId}/users`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ userIds: selectedIds, assignedBy: admin.idUser, force: true })
        });

        if (res.status === 401) { logout(); return; }
        if (!res.ok) { const msg = await res.text(); showError('assignError', msg || 'Error saving assignments.'); return; }

        closeAssignModal();
        await loadBranches();

    } catch (e) {
        showError('assignError', 'Could not connect to the server.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Assignments';
    }
}

// ── HELPERS ──────────────────────────────────────────────────
function showError(elId, msg) {
    const el = document.getElementById(elId);
    el.textContent = msg;
    el.style.display = 'block';
}

function hideError(elId) {
    const el = document.getElementById(elId);
    if (el) el.style.display = 'none';
}

// ── INIT ─────────────────────────────────────────────────────
loadBranches();