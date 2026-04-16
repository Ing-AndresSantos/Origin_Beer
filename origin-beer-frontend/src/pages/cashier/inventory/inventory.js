requireAuth();

document.getElementById('sidebar').innerHTML = getCashierSidebar('../');
initSidebar('inventory');
initDate();

let allInventory = [];
let userBranchId = null;
let userBranchName = '—';
let currentPage = 1;
const PER_PAGE = 12;

// editing state for stock modal
let editingIdProduct = null;
let editingIdBranch  = null;

// ── INITIALIZATION ────────────────────────────────────────────
async function initializePage() {
    const user = getUser();
    if (!user?.idUser) {
        console.error('No user found');
        logout();
        return;
    }
    
    // Get the user's branch
    await getUserBranchId(user.idUser);
    
    if (!userBranchId) {
        document.getElementById('inventoryTable').innerHTML =
            `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">❌</span><p>No branch assigned to this cashier</p></div></td></tr>`;
        return;
    }
    
    // Load inventory for this branch
    await loadInventory();
}

async function getUserBranchId(userId) {
    try {
        const res = await fetch(`${API}/api/branches`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) return;
        
        const branches = await res.json();
        
        // Find branch(es) assigned to this user
        for (const branch of branches) {
            try {
                const r = await fetch(`${API}/api/branches/${branch.idBranch}/users`, {
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                if (!r.ok) continue;
                
                const users = await r.json();
                if (users.some(u => u.idUser === userId)) {
                    userBranchId = branch.idBranch;
                    userBranchName = branch.name;
                    document.getElementById('branchNameHeader').textContent = branch.name;
                    break;
                }
            } catch (e) {}
        }
    } catch (e) {
        console.error('Could not load branches', e);
    }
}

// ── LOAD ──────────────────────────────────────────────────────
async function loadInventory() {
    try {
        const res = await fetch(`${API}/api/inventory`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        
        const inventory = await res.json();
        
        // Filter only items for this cashier's branch
        allInventory = inventory.filter(i => i.branch?.idBranch === userBranchId);
        
        updateStats();
        filter();
    } catch (e) {
        console.error('Error loading inventory:', e);
        document.getElementById('inventoryTable').innerHTML =
            `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">❌</span><p>Could not connect to the server</p></div></td></tr>`;
    }
}

// ── STATS ─────────────────────────────────────────────────────
function updateStats() {
    const lowStock  = allInventory.filter(i => i.quantity <= i.minStock).length;
    const products  = new Set(allInventory.map(i => i.product?.idProduct)).size;
    const totalValue = allInventory.reduce((sum, i) => sum + ((i.product?.price || 0) * i.quantity), 0);

    document.getElementById('statTotalItems').textContent = allInventory.length;
    document.getElementById('statLowStock').textContent = lowStock;
    document.getElementById('statProducts').textContent = products;
    document.getElementById('statTotalValue').textContent = '$' + totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// ── FILTER ────────────────────────────────────────────────────
function filter() {
    const search = document.getElementById('search').value.toLowerCase();
    const stock  = document.getElementById('filterStock').value;

    const result = allInventory.filter(i => {
        const text = `${i.product?.name || ''} ${i.product?.code || ''}`.toLowerCase();
        const matchSearch = text.includes(search);
        const matchStock = !stock ||
            (stock === 'low' && i.quantity <= i.minStock) ||
            (stock === 'ok' && i.quantity > i.minStock);
        return matchSearch && matchStock;
    });

    document.getElementById('resultInfo').textContent = `${result.length} item${result.length !== 1 ? 's' : ''} found`;
    currentPage = 1;
    renderTable(result);
}

// ── TABLE ─────────────────────────────────────────────────────
function renderTable(items) {
    const tbody      = document.getElementById('inventoryTable');
    const total      = items.length;
    const totalPages = Math.ceil(total / PER_PAGE) || 1;
    const start      = (currentPage - 1) * PER_PAGE;
    const end        = start + PER_PAGE;
    const page       = items.slice(start, end);

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">🔍</span><p>No inventory records found</p></div></td></tr>`;
    } else {
        tbody.innerHTML = page.map(i => {
            const isLow     = i.quantity <= i.minStock;
            const pct       = i.minStock > 0 ? Math.min(100, Math.round((i.quantity / (i.minStock * 3)) * 100)) : 100;
            const barColor  = isLow ? '#ef4444' : i.quantity <= i.minStock * 2 ? '#f59e0b' : '#22c55e';
            return `
            <tr>
                <td>
                    <div class="inv-product">
                        <div class="inv-icon">📦</div>
                        <div>
                            <div class="inv-name">${i.product?.name || '—'}</div>
                            <div class="inv-code">${i.product?.code || '—'}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-cat">${i.product?.category?.name || '—'}</span></td>
                <td>
                    <div class="stock-wrap">
                        <div class="stock-num ${isLow ? 'stock-low' : ''}">${i.quantity}</div>
                        <div class="stock-bar-wrap">
                            <div class="stock-bar-fill" style="width:${pct}%;background:${barColor}"></div>
                        </div>
                    </div>
                </td>
                <td><span class="min-stock">${i.minStock}</span></td>
                <td>
                    <span class="badge ${isLow ? 'badge-warn' : 'badge-active'}">
                        ${isLow ? '⚠️ Low' : '✅ OK'}
                    </span>
                </td>
                <td class="actions-td">
                    <button class="action-btn edit-btn" title="Update stock"
                            onclick="openStockModal(${i.product?.idProduct}, ${i.branch?.idBranch}, '${esc(i.product?.name)}', '${esc(i.branch?.name)}', ${i.quantity}, ${i.minStock})">
                        ✏️
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    document.getElementById('pageInfo').textContent =
        `Showing ${Math.min(start + 1, total)}–${Math.min(end, total)} of ${total} items`;

    const btns = document.getElementById('pageBtns');
    btns.innerHTML = '';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn-page';
    btnPrev.textContent = '← Previous';
    btnPrev.disabled = currentPage === 1;
    btnPrev.onclick = () => { currentPage--; renderTable(items); };
    btns.appendChild(btnPrev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `btn-page ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; renderTable(items); };
        btns.appendChild(btn);
    }

    const btnNext = document.createElement('button');
    btnNext.className = 'btn-page';
    btnNext.textContent = 'Next →';
    btnNext.disabled = currentPage === totalPages;
    btnNext.onclick = () => { currentPage++; renderTable(items); };
    btns.appendChild(btnNext);
}

function esc(str) { return (str || '').replace(/'/g, "\\'"); }

// ── STOCK MODAL ───────────────────────────────────────────────
function openStockModal(idProduct, idBranch, productName, branchName, qty, minStock) {
    editingIdProduct = idProduct;
    editingIdBranch  = idBranch;
    document.getElementById('stockModalSub').textContent = `${productName} · ${branchName}`;
    document.getElementById('stockTarget').innerHTML = `
        <div class="target-row">
            <span class="target-label">📦 ${productName}</span>
            <span class="target-sep">→</span>
            <span class="target-label">🏢 ${branchName}</span>
        </div>`;
    document.getElementById('sQuantity').value = qty;
    document.getElementById('sMinStock').value = minStock;
    hideError('stockError');
    document.getElementById('stockModalOverlay').classList.add('active');
}

function closeStockModal() {
    document.getElementById('stockModalOverlay').classList.remove('active');
    editingIdProduct = null;
    editingIdBranch  = null;
}

async function saveStock() {
    hideError('stockError');
    const quantity = parseInt(document.getElementById('sQuantity').value);
    const minStock = parseInt(document.getElementById('sMinStock').value) || 5;
    const user     = getUser();

    if (isNaN(quantity) || quantity < 0) { showError('stockError', 'Enter a valid quantity (0 or more).'); return; }
    if (!user?.idUser)                   { showError('stockError', 'Session error. Please log in again.'); return; }

    const btn = document.getElementById('btnSaveStock');
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
        const res = await fetch(`${API}/api/inventory/${editingIdProduct}/branch/${editingIdBranch}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ quantity, minStock, updatedBy: user.idUser })
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) { const msg = await res.text(); showError('stockError', msg || 'Error updating stock.'); return; }

        closeStockModal();
        await loadInventory();
        showToast('Stock updated successfully.', 'success');
    } catch (e) {
        showError('stockError', 'Could not connect to the server.');
    } finally {
        btn.disabled = false; btn.textContent = 'Update Stock';
    }
}

// ── ERROR HANDLING ────────────────────────────────────────────
function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideError(id) {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
}

function showToast(message, type = 'success') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'toast'; toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ── INITIALIZE ON LOAD ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initializePage);