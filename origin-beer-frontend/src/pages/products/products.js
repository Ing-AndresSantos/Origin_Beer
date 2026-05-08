requireAuth();

document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('products');
initDate();

let allProducts   = [];
let allCategories = [];
let currentPage   = 1;
const PER_PAGE    = 10;
let editingId     = null;

const categoryIcons = {
    'Craft Beers':   '🍺',
    'Imported Beers':'🍻',
    'Non-Alcoholic': '🥤',
    'Snacks & Food': '🍽️',
    'Merchandise':   '👕'
};

// ── LOAD ──────────────────────────────────────────────────────
async function loadProducts() {
    try {
        const res = await fetch(`${API}/api/products`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        allProducts = await res.json();
        updateStats();
        filter();
    } catch (e) {
        document.getElementById('productsTable').innerHTML =
            `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">❌</span><p>Could not connect to the server</p></div></td></tr>`;
    }
}

async function loadCategories() {
    try {
        const res = await fetch(`${API}/api/categories`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.ok) {
            allCategories = await res.json();
            populateCategorySelects();
        }
    } catch (e) { console.error('Could not load categories', e); }
}

function populateCategorySelects() {
    const filterSel = document.getElementById('filterCategory');
    filterSel.innerHTML = '<option value="">All categories</option>';
    allCategories.filter(c => c.active).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.idCategory;
        opt.textContent = c.name;
        filterSel.appendChild(opt);
    });

    const formSel = document.getElementById('fCategory');
    formSel.innerHTML = '<option value="">— Select a category —</option>';
    allCategories.filter(c => c.active).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.idCategory;
        opt.textContent = c.name;
        formSel.appendChild(opt);
    });
}

// ── STATS ─────────────────────────────────────────────────────
function updateStats() {
    const active     = allProducts.filter(p => p.active).length;
    const categories = new Set(allProducts.map(p => p.category?.idCategory)).size;
    const prices     = allProducts.filter(p => p.salePrice).map(p => Number(p.salePrice));
    const avg        = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    document.getElementById('totalProducts').textContent   = allProducts.length;
    document.getElementById('totalActive').textContent     = active;
    document.getElementById('totalCategories').textContent = categories;
    document.getElementById('avgPrice').textContent        = '$ ' + Math.round(avg).toLocaleString('en-US');
}

// ── AUTO-ID PREVIEW ───────────────────────────────────────────
// Muestra el próximo ID que el backend asignará al nuevo producto.
// El campo es solo lectura; el backend genera el ID real con AUTO_INCREMENT.

function updateNextProductIdPreview() {
    const el = document.getElementById('fNextId');
    if (!el) return;
    if (!allProducts.length) {
        el.value = '001';
        return;
    }
    const maxId  = Math.max(...allProducts.map(p => p.idProduct || 0));
    const nextId = maxId + 1;
    el.value = String(nextId).padStart(3, '0');
}

// ══════════════════════════════════════════════════════════════
// VALIDACIÓN DE PRECIOS
// Regla: salePrice >= purchaseCost  (precio venta ≥ precio compra)
// ══════════════════════════════════════════════════════════════

/**
 * Valida en tiempo real mientras el usuario escribe.
 * Llama a esta función con oninput en los campos fSalePrice / fCostPrice.
 */
function validatePricesLive() {
    const salePrice  = parseFloat(document.getElementById('fSalePrice').value)  || 0;
    const costPrice  = parseFloat(document.getElementById('fCostPrice').value)  || 0;
    const warnEl     = document.getElementById('priceWarning');

    if (!warnEl) return;

    if (salePrice > 0 && costPrice > 0 && salePrice < costPrice) {
        warnEl.textContent = `⚠️ Sale price ($${salePrice.toLocaleString('en-US')}) cannot be less than purchase cost ($${costPrice.toLocaleString('en-US')}).`;
        warnEl.style.display = 'block';
    } else {
        warnEl.style.display = 'none';
        warnEl.textContent   = '';
    }
}

// ── FILTER ────────────────────────────────────────────────────
function filter() {
    const search = document.getElementById('search').value.toLowerCase();
    const catId  = document.getElementById('filterCategory').value;
    const status = document.getElementById('filterStatus').value;

    const result = allProducts.filter(p => {
        const text = `${p.name} ${p.code} ${p.category?.name || ''}`.toLowerCase();
        const matchSearch = text.includes(search);
        const matchCat    = !catId || String(p.category?.idCategory) === catId;
        const matchStatus = !status ||
            (status === 'active'   &&  p.active) ||
            (status === 'inactive' && !p.active);
        return matchSearch && matchCat && matchStatus;
    });

    currentPage = 1;
    renderTable(result);
}

// ── TABLE ─────────────────────────────────────────────────────
function renderTable(products) {
    const tbody      = document.getElementById('productsTable');
    const total      = products.length;
    const totalPages = Math.ceil(total / PER_PAGE) || 1;
    const start      = (currentPage - 1) * PER_PAGE;
    const end        = start + PER_PAGE;
    const page       = products.slice(start, end);

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">🔍</span><p>No products found</p></div></td></tr>`;
    } else {
        tbody.innerHTML = page.map(p => {
            const catName     = p.category?.name || '—';
            const icon        = categoryIcons[catName] || '📦';
            const idFormatted = String(p.idProduct).padStart(3, '0');
            return `
            <tr>
                <td>
                    <div class="product-info">
                        <div class="product-icon">${icon}</div>
                        <div>
                            <div class="product-name">${p.name}</div>
                            <div class="product-code">${p.code} <span style="font-size:10px;color:var(--text-muted)">· ID: ${idFormatted}</span></div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-cat">${catName}</span></td>
                <td style="font-size:12px;color:var(--text-sub)">${p.unit || '—'}</td>
                <td><div class="price">$ ${Number(p.salePrice).toLocaleString('en-US')}</div></td>
                <td><div class="cost">$ ${Number(p.purchaseCost || 0).toLocaleString('en-US')}</div></td>
                <td><span class="badge ${p.active ? 'badge-active' : 'badge-inactive'}">${p.active ? 'Active' : 'Inactive'}</span></td>
                <td class="actions-td">
                    <button class="action-btn edit-btn" title="Edit" onclick="openEditModal(${p.idProduct})">✏️</button>
                    <button class="action-btn ${p.active ? 'deact-btn' : 'act-btn'}" title="${p.active ? 'Deactivate' : 'Activate'}"
                            onclick="toggleStatus(${p.idProduct}, ${p.active})">${p.active ? '🔴' : '✅'}</button>
                </td>
            </tr>`;
        }).join('');
    }

    document.getElementById('pageInfo').textContent =
        `Showing ${Math.min(start + 1, total)}–${Math.min(end, total)} of ${total} products`;

    const btns = document.getElementById('pageBtns');
    btns.innerHTML = '';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn-page';
    btnPrev.textContent = '← Previous';
    btnPrev.disabled = currentPage === 1;
    btnPrev.onclick = () => { currentPage--; renderTable(products); };
    btns.appendChild(btnPrev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `btn-page ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; renderTable(products); };
        btns.appendChild(btn);
    }

    const btnNext = document.createElement('button');
    btnNext.className = 'btn-page';
    btnNext.textContent = 'Next →';
    btnNext.disabled = currentPage === totalPages;
    btnNext.onclick = () => { currentPage++; renderTable(products); };
    btns.appendChild(btnNext);
}

// ── TOGGLE STATUS ─────────────────────────────────────────────
async function toggleStatus(id, current) {
    const action = current ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this product?`)) return;
    try {
        const res = await fetch(`${API}/api/products/${id}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        if (res.ok) { await loadProducts(); showToast(`Product ${action}d successfully.`, 'success'); }
    } catch (e) { showToast('Could not connect to the server.', 'error'); }
}

// ── MODAL ─────────────────────────────────────────────────────
function openCreateModal() {
    editingId = null;
    clearForm();
    document.getElementById('modalTitle').textContent = '🛒 New Product';
    document.getElementById('btnSave').textContent    = 'Create Product';
    document.getElementById('fCode').removeAttribute('disabled');
    updateNextProductIdPreview();   // ← muestra el próximo ID automático
    document.getElementById('modalOverlay').classList.add('active');
}

function openEditModal(id) {
    const p = allProducts.find(x => x.idProduct === id);
    if (!p) return;
    editingId = id;
    clearForm();
    document.getElementById('modalTitle').textContent    = '✏️ Edit Product';
    document.getElementById('btnSave').textContent       = 'Save Changes';

    // Mostrar ID actual en el campo de solo lectura
    const nextIdEl = document.getElementById('fNextId');
    if (nextIdEl) nextIdEl.value = String(id).padStart(3, '0');

    document.getElementById('fCode').value        = p.code;
    document.getElementById('fCode').setAttribute('disabled', true);
    document.getElementById('fName').value        = p.name;
    document.getElementById('fDescription').value = p.description || '';
    document.getElementById('fUnit').value        = p.unit || 'unit';
    document.getElementById('fSalePrice').value   = p.salePrice;
    document.getElementById('fCostPrice').value   = p.purchaseCost || 0;
    document.getElementById('fCategory').value    = p.category?.idCategory || '';
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    clearForm();
    editingId = null;
}

function clearForm() {
    ['fCode','fName','fDescription','fSalePrice','fCostPrice'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('fCategory').value = '';
    document.getElementById('fUnit').value = 'unit';
    const nextIdEl = document.getElementById('fNextId');
    if (nextIdEl) nextIdEl.value = '—';
    // Ocultar advertencia de precio al limpiar
    const warnEl = document.getElementById('priceWarning');
    if (warnEl) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
    hideError('formError');
}

async function saveProduct() {
    hideError('formError');
    const name       = document.getElementById('fName').value.trim();
    const code       = document.getElementById('fCode').value.trim();
    const desc       = document.getElementById('fDescription').value.trim();
    const unit       = document.getElementById('fUnit').value.trim() || 'unit';
    const salePrice  = parseFloat(document.getElementById('fSalePrice').value);
    const costPrice  = parseFloat(document.getElementById('fCostPrice').value) || 0;
    const idCategory = parseInt(document.getElementById('fCategory').value);

    // ── Validaciones básicas ──────────────────────────────────
    if (!name)                             { showError('formError', 'Product name is required.'); return; }
    if (!idCategory)                       { showError('formError', 'Please select a category.'); return; }
    if (isNaN(salePrice) || salePrice < 0) { showError('formError', 'Enter a valid sale price.'); return; }

    // ══════════════════════════════════════════════════════════
    // VALIDACIÓN PRECIO VENTA >= PRECIO COMPRA
    // Bloquea el guardado si el precio de venta es menor al costo.
    // ══════════════════════════════════════════════════════════
    if (!isNaN(costPrice) && costPrice > 0 && salePrice < costPrice) {
        showError('formError',
            `❌ Sale price ($${salePrice.toLocaleString('en-US')}) cannot be less than purchase cost ($${costPrice.toLocaleString('en-US')}). Please correct the prices before saving.`
        );
        return;
    }

    const btn = document.getElementById('btnSave');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        let res;
        if (editingId === null) {
            if (!code) { showError('formError', 'Product code is required.'); return; }
            const user = getUser();
            if (!user?.idUser) { showError('formError', 'Session error. Please log in again.'); return; }
            res = await fetch(`${API}/api/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ code, name, description: desc || null, unit, salePrice, purchaseCost: costPrice, idCategory, createdBy: user.idUser })
            });
            if (res.status === 409) { showError('formError', 'A product with that code already exists.'); return; }
        } else {
            res = await fetch(`${API}/api/products/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ name, description: desc || null, unit, salePrice, purchaseCost: costPrice, idCategory })
            });
        }

        if (res.status === 401) { logout(); return; }
        if (!res.ok) { const msg = await res.text(); showError('formError', msg || 'Error saving product.'); return; }

        closeModal();
        await loadProducts();
        showToast(editingId === null ? 'Product created successfully.' : 'Product updated successfully.', 'success');

    } catch (e) {
        showError('formError', 'Could not connect to the server.');
    } finally {
        btn.disabled = false;
        btn.textContent = editingId === null ? 'Create Product' : 'Save Changes';
    }
}

// ── HELPERS ───────────────────────────────────────────────────
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
    toast.id = 'toast';
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ── INIT ──────────────────────────────────────────────────────
loadCategories();
loadProducts();