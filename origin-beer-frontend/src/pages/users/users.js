requireAuth();

document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('users');
initDate();

let allUsers       = [];
let allRoles       = [];
let userBranchMap  = {};   // { userId: [{idBranch, name, code}] }
let currentPage    = 1;
const PER_PAGE  = 10;

// ── LOAD ─────────────────────────────────────────────────────

async function loadUsers() {
    try {
        const res = await fetch(`${API}/api/users`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        allUsers = await res.json();
        updateStats();
        filter();
    } catch (e) {
        document.getElementById('usersTable').innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state"><span class="empty-icon">❌</span><p>Could not connect to the server</p></div>
            </td></tr>`;
    }
}

async function loadRoles() {
    try {
        const res = await fetch(`${API}/api/roles`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.ok) allRoles = await res.json();
        populateRoleSelects();
    } catch (e) { console.error('Could not load roles', e); }
}

async function loadBranchAssignments() {
    try {
        const res = await fetch(`${API}/api/branches`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) return;
        const branches = await res.json();

        userBranchMap = {};
        await Promise.all(branches.map(async branch => {
            try {
                const r = await fetch(`${API}/api/branches/${branch.idBranch}/users`, {
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                if (!r.ok) return;
                const users = await r.json();
                users.forEach(u => {
                    if (!userBranchMap[u.idUser]) userBranchMap[u.idUser] = [];
                    userBranchMap[u.idUser].push({ idBranch: branch.idBranch, name: branch.name, code: branch.code });
                });
            } catch (e) { /* skip failed branch */ }
        }));

        // Re-render table with branch data
        filter();
    } catch (e) { console.error('Could not load branch assignments', e); }
}

function populateRoleSelects() {
    ['f-role', 'r-role'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">— Select a role —</option>';
        allRoles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.idRole;
            opt.textContent = r.name;
            sel.appendChild(opt);
        });
    });
}

// ── STATS ─────────────────────────────────────────────────────

function updateStats() {
    const active   = allUsers.filter(u => u.active).length;
    const inactive = allUsers.filter(u => !u.active).length;
    const admins   = allUsers.filter(u => u.role?.name === 'ADMIN').length;
    document.getElementById('totalUsers').textContent    = allUsers.length;
    document.getElementById('totalActive').textContent   = active;
    document.getElementById('totalInactive').textContent = inactive;
    document.getElementById('totalAdmins').textContent   = admins;
}

// ── FILTER ────────────────────────────────────────────────────

function filter() {
    const search = document.getElementById('search').value.toLowerCase();
    const role   = document.getElementById('filterRole').value;
    const status = document.getElementById('filterStatus').value;

    const result = allUsers.filter(u => {
        const text = `${u.firstName} ${u.lastName} ${u.email} ${u.role?.name || ''}`.toLowerCase();
        const matchSearch = text.includes(search);
        const matchRole   = !role   || u.role?.name === role;
        const matchStatus = !status ||
            (status === 'active'   &&  u.active) ||
            (status === 'inactive' && !u.active);
        return matchSearch && matchRole && matchStatus;
    });

    currentPage = 1;
    renderTable(result);
}

// ── TABLE ─────────────────────────────────────────────────────

function renderTable(users) {
    const tbody      = document.getElementById('usersTable');
    const total      = users.length;
    const totalPages = Math.ceil(total / PER_PAGE) || 1;
    const start      = (currentPage - 1) * PER_PAGE;
    const end        = start + PER_PAGE;
    const page       = users.slice(start, end);

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">🔍</span><p>No users found</p></div></td></tr>`;
    } else {
        tbody.innerHTML = page.map(u => {
            const initials  = `${u.firstName?.charAt(0) || ''}${u.lastName?.charAt(0) || ''}`;
            const roleName  = u.role?.name || '—';
            const roleClass = roleName.toLowerCase();
            const lastAccess = u.lastAccess ? new Date(u.lastAccess).toLocaleString('en-US') : 'Never';
            const created    = u.createdAt  ? new Date(u.createdAt).toLocaleDateString('en-US') : '—';
            return `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="avatar">${initials}</div>
                        <div>
                            <div class="name">${u.firstName} ${u.lastName}</div>
                            <div class="email">${u.email}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-${roleClass}" id="badge-role-${u.idUser}">${roleName}</span></td>
                <td>
                    <div class="user-branches" id="branches-${u.idUser}">
                        ${renderBranches(u.idUser)}
                    </div>
                </td>
                <td>
                    <div class="toggle-wrap">
                        <label class="toggle">
                            <input type="checkbox" ${u.active ? 'checked' : ''}
                                   onchange="handleToggleStatus(${u.idUser}, this)">
                            <span class="slider"></span>
                        </label>
                        <span class="toggle-label ${u.active ? '' : 'inactive'}" id="toggle-label-${u.idUser}">
                            ${u.active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </td>
                <td style="font-size:12px;color:var(--text-muted)">${lastAccess}</td>
                <td class="actions-td">
                    <button class="action-btn role-btn" title="Change role"
                            onclick="openRoleModal(${u.idUser}, '${u.firstName} ${u.lastName}', '${u.email}', '${initials}', ${u.role?.idRole || ''}, '${roleName}')">
                        ⬡
                    </button>
                    <button class="action-btn pwd-btn" title="Reset password"
                            onclick="openPwdModal(${u.idUser}, '${u.firstName} ${u.lastName}', '${u.email}', '${initials}')">
                        🔑
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    document.getElementById('pageInfo').textContent =
        `Showing ${Math.min(start + 1, total)}–${Math.min(end, total)} of ${total} users`;

    const btns = document.getElementById('pageBtns');
    btns.innerHTML = '';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn-page';
    btnPrev.textContent = '← Previous';
    btnPrev.disabled = currentPage === 1;
    btnPrev.onclick = () => { currentPage--; renderTable(users); };
    btns.appendChild(btnPrev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `btn-page ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; renderTable(users); };
        btns.appendChild(btn);
    }

    const btnNext = document.createElement('button');
    btnNext.className = 'btn-page';
    btnNext.textContent = 'Next →';
    btnNext.disabled = currentPage === totalPages;
    btnNext.onclick = () => { currentPage++; renderTable(users); };
    btns.appendChild(btnNext);
}

// ── BRANCH BADGES ─────────────────────────────────────────────

function renderBranches(userId) {
    const branches = userBranchMap[userId];
    if (!branches || branches.length === 0) {
        return '<span style="font-size:11px;color:var(--text-muted)">—</span>';
    }
    return branches.map(b =>
        `<span class="badge badge-branch" title="${b.name}">${b.code}</span>`
    ).join('');
}

// ── TOGGLE STATUS ─────────────────────────────────────────────

async function handleToggleStatus(userId, checkbox) {
    const originalState = !checkbox.checked; // revert on error
    try {
        const res = await fetch(`${API}/api/users/${userId}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (res.ok) {
            const isActive = checkbox.checked;
            const label = document.getElementById(`toggle-label-${userId}`);
            if (label) {
                label.textContent = isActive ? 'Active' : 'Inactive';
                label.className = `toggle-label ${isActive ? '' : 'inactive'}`;
            }
            // Update local array so stats are correct
            const u = allUsers.find(u => u.idUser === userId);
            if (u) u.active = isActive;
            updateStats();
        } else {
            checkbox.checked = originalState; // revert
            showToast('Could not update status. Try again.', 'error');
        }
    } catch (e) {
        checkbox.checked = originalState;
        showToast('Could not connect to the server.', 'error');
    }
}

// ── ROLE MODAL ────────────────────────────────────────────────

let activeRoleUserId = null;

function openRoleModal(userId, fullName, email, initials, currentRoleId, currentRoleName) {
    activeRoleUserId = userId;
    document.getElementById('r-initials').textContent  = initials;
    document.getElementById('r-name').textContent      = fullName;
    document.getElementById('r-email').textContent     = email;
    document.getElementById('r-current').value         = currentRoleName;
    document.getElementById('r-role').value            = currentRoleId || '';
    hideModalError('roleError');
    document.getElementById('roleModalOverlay').classList.add('open');
}

function closeRoleModal() {
    document.getElementById('roleModalOverlay').classList.remove('open');
    activeRoleUserId = null;
}

async function saveRole() {
    const idRole = parseInt(document.getElementById('r-role').value);
    if (!idRole) { showModalError('roleError', 'Please select a role.'); return; }

    const btn = document.getElementById('btnSaveRole');
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
        const res = await fetch(`${API}/api/users/${activeRoleUserId}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ idRole })
        });

        if (res.ok) {
            closeRoleModal();
            await loadUsers();
            showToast('Role updated successfully.', 'success');
        } else {
            showModalError('roleError', 'Could not update role. Try again.');
        }
    } catch (e) {
        showModalError('roleError', 'Could not connect to the server.');
    } finally {
        btn.disabled = false; btn.textContent = 'Save Role';
    }
}

// ── PASSWORD MODAL ────────────────────────────────────────────

let activePwdUserId = null;

function openPwdModal(userId, fullName, email, initials) {
    activePwdUserId = userId;
    document.getElementById('p-initials').textContent = initials;
    document.getElementById('p-name').textContent     = fullName;
    document.getElementById('p-email').textContent    = email;
    document.getElementById('p-password').value       = '';
    document.getElementById('p-confirm').value        = '';
    hideModalError('pwdError');
    document.getElementById('pwdModalOverlay').classList.add('open');
}

function closePwdModal() {
    document.getElementById('pwdModalOverlay').classList.remove('open');
    activePwdUserId = null;
}

function togglePwdVisibility(fieldId) {
    const input = document.getElementById(fieldId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function savePassword() {
    const newPassword = document.getElementById('p-password').value;
    const confirm     = document.getElementById('p-confirm').value;

    if (!newPassword || newPassword.length < 8) {
        showModalError('pwdError', 'Password must be at least 8 characters.'); return;
    }
    if (newPassword !== confirm) {
        showModalError('pwdError', 'Passwords do not match.'); return;
    }

    const btn = document.getElementById('btnSavePwd');
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
        const res = await fetch(`${API}/api/users/${activePwdUserId}/password`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ newPassword })
        });

        if (res.ok) {
            closePwdModal();
            showToast('Password reset successfully.', 'success');
        } else {
            const msg = await res.text();
            showModalError('pwdError', msg || 'Could not reset password.');
        }
    } catch (e) {
        showModalError('pwdError', 'Could not connect to the server.');
    } finally {
        btn.disabled = false; btn.textContent = 'Reset Password';
    }
}

// ── NEW USER MODAL ────────────────────────────────────────────

function openNewUserModal() {
    clearNewUserForm();
    document.getElementById('modalOverlay').classList.add('open');
}

function closeNewUserModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

function clearNewUserForm() {
    ['f-firstName','f-lastName','f-email','f-password','f-phone'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('f-role').value = '';
    hideModalError('formError');
    const btn = document.getElementById('btnSave');
    btn.disabled = false; btn.textContent = 'Create User';
}

function toggleNewPwd() {
    const input = document.getElementById('f-password');
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function saveUser() {
    hideModalError('formError');
    const firstName = document.getElementById('f-firstName').value.trim();
    const lastName  = document.getElementById('f-lastName').value.trim();
    const email     = document.getElementById('f-email').value.trim();
    const password  = document.getElementById('f-password').value;
    const phone     = document.getElementById('f-phone').value.trim();
    const idRole    = parseInt(document.getElementById('f-role').value);

    if (!firstName || !lastName)  { showModalError('formError', 'First and last name are required.');   return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showModalError('formError', 'Enter a valid email address.'); return; }
    if (!password || password.length < 8) { showModalError('formError', 'Password must be at least 8 characters.'); return; }
    if (!idRole)                  { showModalError('formError', 'Please select a role.');               return; }

    const btn = document.getElementById('btnSave');
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
        const res = await fetch(`${API}/api/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ firstName, lastName, email, password, phone, idRole })
        });

        if (res.status === 201) {
            closeNewUserModal();
            await loadUsers();
            showToast('User created successfully.', 'success');
        } else if (res.status === 409) {
            showModalError('formError', 'That email is already registered.');
        } else {
            showModalError('formError', 'An error occurred. Please try again.');
        }
    } catch (e) {
        showModalError('formError', 'Could not connect to the server.');
    } finally {
        btn.disabled = false; btn.textContent = 'Create User';
    }
}

// ── OVERLAY CLICK TO CLOSE ────────────────────────────────────

function handleOverlayClick(e, closeFunc) {
    if (e.target === e.currentTarget) closeFunc();
}

// ── TOAST NOTIFICATION ────────────────────────────────────────

function showToast(message, type = 'success') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ── MODAL ERROR HELPERS ───────────────────────────────────────

function showModalError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideModalError(id) {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
}

// ── INIT ──────────────────────────────────────────────────────

loadUsers();
loadRoles();
loadBranchAssignments();