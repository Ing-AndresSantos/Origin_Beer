requireAuth();

document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('users');
initDate();

let allUsers = [];
let currentPage = 1;
const PER_PAGE = 10;

async function loadUsers() {
    try {
        const res = await fetch(`${API}/api/usuarios`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        allUsers = await res.json();
        updateStats();
        filter();
    } catch (e) {
        document.getElementById('usersTable').innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state"><span class="empty-icon">❌</span><p>Could not connect to the server</p></div>
            </td></tr>`;
    }
}

function updateStats() {
    const active   = allUsers.filter(u => u.activo).length;
    const inactive = allUsers.filter(u => !u.activo).length;
    const admins   = allUsers.filter(u => u.rol?.nombre === 'ADMIN').length;
    document.getElementById('totalUsers').textContent   = allUsers.length;
    document.getElementById('totalActive').textContent  = active;
    document.getElementById('totalInactive').textContent = inactive;
    document.getElementById('totalAdmins').textContent  = admins;
}

function filter() {
    const search = document.getElementById('search').value.toLowerCase();
    const role   = document.getElementById('filterRole').value;
    const status = document.getElementById('filterStatus').value;

    const result = allUsers.filter(u => {
        const text = `${u.nombre} ${u.apellido} ${u.correo} ${u.rol?.nombre || ''}`.toLowerCase();
        const matchSearch = text.includes(search);
        const matchRole   = !role   || u.rol?.nombre === role;
        const matchStatus = !status ||
            (status === 'active'   && u.activo) ||
            (status === 'inactive' && !u.activo);
        return matchSearch && matchRole && matchStatus;
    });

    currentPage = 1;
    renderTable(result);
}

function renderTable(users) {
    const tbody      = document.getElementById('usersTable');
    const total      = users.length;
    const totalPages = Math.ceil(total / PER_PAGE);
    const start      = (currentPage - 1) * PER_PAGE;
    const end        = start + PER_PAGE;
    const page       = users.slice(start, end);

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">🔍</span><p>No users found</p></div></td></tr>`;
    } else {
        tbody.innerHTML = page.map(u => {
            const initials   = `${u.nombre?.charAt(0) || ''}${u.apellido?.charAt(0) || ''}`;
            const roleName   = u.rol?.nombre || '—';
            const roleClass  = roleName.toLowerCase();
            const lastAccess = u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString('en-US') : 'Never';
            const created    = u.fechaCreacion ? new Date(u.fechaCreacion).toLocaleDateString('en-US') : '—';
            return `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="avatar">${initials}</div>
                        <div>
                            <div class="name">${u.nombre} ${u.apellido}</div>
                            <div class="email">${u.correo}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-${roleClass}">${roleName}</span></td>
                <td>${u.telefono || '—'}</td>
                <td><span class="badge ${u.activo ? 'badge-active' : 'badge-inactive'}">${u.activo ? 'Active' : 'Inactive'}</span></td>
                <td>${lastAccess}</td>
                <td>${created}</td>
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
    btnNext.disabled = currentPage === totalPages || totalPages === 0;
    btnNext.onclick = () => { currentPage++; renderTable(users); };
    btns.appendChild(btnNext);
}

loadUsers();
