requireAuth();

document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('products');
initDate();

let allProducts = [];
let currentPage = 1;
const PER_PAGE = 10;

const categoryIcons = {
    'Cervezas Artesanales': '🍺',
    'Cervezas Importadas':  '🍻',
    'Bebidas No Alcohólicas': '🥤',
    'Snacks y Comidas': '🍽️',
    'Mercancía': '👕'
};

async function loadProducts() {
    try {
        const res = await fetch(`${API}/api/productos`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        allProducts = await res.json();
        updateStats();
        loadCategoryFilters();
        filter();
    } catch (e) {
        document.getElementById('productsTable').innerHTML =
            `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">❌</span><p>Could not connect to the server</p></div></td></tr>`;
    }
}

function updateStats() {
    const active     = allProducts.filter(p => p.activo).length;
    const categories = new Set(allProducts.map(p => p.categoria?.nombre)).size;
    const prices     = allProducts.filter(p => p.precioVenta).map(p => p.precioVenta);
    const avg        = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    document.getElementById('totalProducts').textContent  = allProducts.length;
    document.getElementById('totalActive').textContent    = active;
    document.getElementById('totalCategories').textContent = categories;
    document.getElementById('avgPrice').textContent       = '$ ' + Math.round(avg).toLocaleString('en-US');
}

function loadCategoryFilters() {
    const cats   = [...new Set(allProducts.map(p => p.categoria?.nombre).filter(Boolean))];
    const select = document.getElementById('filterCategory');
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
}

function filter() {
    const search   = document.getElementById('search').value.toLowerCase();
    const category = document.getElementById('filterCategory').value;
    const status   = document.getElementById('filterStatus').value;

    const result = allProducts.filter(p => {
        const text = `${p.nombre} ${p.codigo} ${p.categoria?.nombre || ''}`.toLowerCase();
        const matchSearch   = text.includes(search);
        const matchCategory = !category || p.categoria?.nombre === category;
        const matchStatus   = !status ||
            (status === 'active'   && p.activo) ||
            (status === 'inactive' && !p.activo);
        return matchSearch && matchCategory && matchStatus;
    });

    currentPage = 1;
    renderTable(result);
}

function renderTable(products) {
    const tbody      = document.getElementById('productsTable');
    const total      = products.length;
    const totalPages = Math.ceil(total / PER_PAGE);
    const start      = (currentPage - 1) * PER_PAGE;
    const end        = start + PER_PAGE;
    const page       = products.slice(start, end);

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">🔍</span><p>No products found</p></div></td></tr>`;
    } else {
        tbody.innerHTML = page.map(p => {
            const catName = p.categoria?.nombre || '—';
            const icon    = categoryIcons[catName] || '📦';
            const price   = p.precioVenta ? '$ ' + Number(p.precioVenta).toLocaleString('en-US') : '—';
            const cost    = p.costoCompra ? '$ ' + Number(p.costoCompra).toLocaleString('en-US') : '—';
            return `
            <tr>
                <td>
                    <div class="product-info">
                        <div class="product-icon">${icon}</div>
                        <div>
                            <div class="product-name">${p.nombre}</div>
                            <div class="product-code">${p.codigo}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-cat">${catName}</span></td>
                <td>${p.unidad || '—'}</td>
                <td><div class="price">${price}</div></td>
                <td><div class="cost">${cost}</div></td>
                <td><span class="badge ${p.activo ? 'badge-active' : 'badge-inactive'}">${p.activo ? 'Active' : 'Inactive'}</span></td>
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
    btnNext.disabled = currentPage === totalPages || totalPages === 0;
    btnNext.onclick = () => { currentPage++; renderTable(products); };
    btns.appendChild(btnNext);
}

loadProducts();
