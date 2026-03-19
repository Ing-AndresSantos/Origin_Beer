requireAuth();

document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('branches');
initDate();

let allBranches = [];

async function loadBranches() {
    try {
        const res = await fetch(`${API}/api/sedes`, {
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

function updateStats() {
    const active = allBranches.filter(s => s.activo).length;
    document.getElementById('totalBranches').textContent = allBranches.length;
    document.getElementById('totalActive').textContent   = active;
    document.getElementById('totalInactive').textContent = allBranches.length - active;
}

function filter() {
    const search = document.getElementById('search').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;

    const result = allBranches.filter(s => {
        const text = `${s.nombre} ${s.ciudad || ''} ${s.codigo}`.toLowerCase();
        const matchSearch = text.includes(search);
        const matchStatus = !status ||
            (status === 'active'   && s.activo) ||
            (status === 'inactive' && !s.activo);
        return matchSearch && matchStatus;
    });

    document.getElementById('resultInfo').textContent =
        `${result.length} branch${result.length !== 1 ? 'es' : ''} found`;
    renderBranches(result);
}

function renderBranches(branches) {
    const grid = document.getElementById('branchesGrid');
    if (!branches.length) {
        grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><span class="empty-icon">🔍</span><p>No branches found</p></div></div>`;
        return;
    }
    grid.innerHTML = branches.map(s => `
        <div class="branch-card">
            <div class="branch-card-header">
                <div>
                    <div class="branch-icon">🏢</div>
                    <div class="branch-name">${s.nombre}</div>
                    <div class="branch-code">${s.codigo}</div>
                </div>
                <span class="badge ${s.activo ? 'badge-active' : 'badge-inactive'}">${s.activo ? 'Active' : 'Inactive'}</span>
            </div>
            <div class="branch-card-body">
                <div class="branch-detail"><span>📍</span> ${s.direccion || 'No address'}</div>
                <div class="branch-detail"><span>🏙️</span> ${s.ciudad || '—'}</div>
                <div class="branch-detail"><span>📞</span> ${s.telefono || '—'}</div>
                <div class="branch-detail"><span>✉️</span> ${s.correo || '—'}</div>
            </div>
        </div>
    `).join('');
}

loadBranches();
