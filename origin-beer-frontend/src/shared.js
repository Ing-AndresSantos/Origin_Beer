/**
 * shared.js — Common utilities for all Origin Beer pages
 */

const API = 'http://127.0.0.1:8080';

// ── AUTH ──────────────────────────────────────────────────────
function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    return JSON.parse(localStorage.getItem('user') || '{}');
}

/**
 * Builds the absolute path to the login page regardless of how deep
 * the current page is nested inside /pages/.
 */
function _loginPath() {
    const pathname  = window.location.pathname;
    const pagesIdx  = pathname.indexOf('/pages/');
    if (pagesIdx !== -1) {
        const base = pathname.substring(0, pagesIdx + '/pages/'.length);
        return window.location.origin + base + 'login/login.html';
    }
    return '/origin-beer-frontend/src/pages/login/login.html';
}

function requireAuth() {
    if (!getToken()) {
        window.location.href = _loginPath();
    }
}

/**
 * requireRole(role)
 * Verifies that the authenticated user actually has the expected role.
 * If not authenticated → redirect to login.
 * If wrong role → redirect to the correct dashboard for their actual role.
 *
 * @param {string} role  Expected role: 'ADMIN' | 'CASHIER' | 'WAITER'
 */
function requireRole(role) {
    requireAuth();
    const user       = getUser();
    const actualRole = (user.role || '').toUpperCase();
    const expected   = (role || '').toUpperCase();

    if (actualRole === expected) return; // ✅ correct role, nothing to do

    // Wrong role: redirect to the correct dashboard
    const pathname  = window.location.pathname;
    const pagesIdx  = pathname.indexOf('/pages/');
    const pagesBase = pagesIdx !== -1
        ? window.location.origin + pathname.substring(0, pagesIdx + '/pages/'.length)
        : window.location.origin + '/origin-beer-frontend/src/pages/';

    if (actualRole === 'WAITER')  { window.location.href = pagesBase + 'waiter/dashboard/dashboard.html';  return; }
    if (actualRole === 'CASHIER') { window.location.href = pagesBase + 'cashier/dashboard/dashboard.html'; return; }
    if (actualRole === 'ADMIN')   { window.location.href = pagesBase + 'dashboard/dashboard.html';         return; }

    // Unknown role — force logout
    logout();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = _loginPath();
}


// ── THEME MANAGER ──────────────────────────────────────────────
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Inicializar tema al cargar la página
document.addEventListener('DOMContentLoaded', initTheme);

// ── AUTHENTICATED FETCH ───────────────────────────────────────
async function apiFetch(endpoint) {
    try {
        const res = await fetch(`${API}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return null; }
        return await res.json();
    } catch (e) {
        console.error('Error at ' + endpoint, e);
        return null;
    }
}

// ── SIDEBAR ───────────────────────────────────────────────────
function initSidebar(activePage) {
    const user   = getUser();
    const nameEl = document.getElementById('sidebarName');
    const roleEl = document.getElementById('sidebarRolee');
    if (nameEl) nameEl.textContent = (user.firstName || '') + ' ' + (user.lastName || '');
    if (roleEl) roleEl.textContent = user.role || 'ADMIN';

    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('href') && item.getAttribute('href').includes(activePage)) {
            item.classList.add('active');
        }
    });

    // Load assigned branch for this user
    if (user.idUser) {
        loadUserBranch(user.idUser);
    }
}

async function loadUserBranch(userId) {
    try {
        const res = await fetch(`${API}/api/branches`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) return;
        const branches = await res.json();

        const userBranches = [];
        await Promise.all(branches.map(async branch => {
            try {
                const r = await fetch(`${API}/api/branches/${branch.idBranch}/users`, {
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                if (!r.ok) return;
                const users = await r.json();
                if (users.some(u => u.idUser === userId)) {
                    userBranches.push(branch.name);
                }
            } catch (e) {}
        }));

        const branchEl = document.getElementById('sidebarBranch');
        if (branchEl) {
            if (userBranches.length > 0) {
                branchEl.textContent = '🏢 ' + userBranches.join(', ');
                branchEl.style.display = 'block';
            } else {
                branchEl.style.display = 'none';
            }
        }
    } catch (e) {}
}

// ── TOPBAR DATE ───────────────────────────────────────────────
function initDate() {
    const el = document.getElementById('todayDate');
    if (el) {
        el.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}
function _logoPath() {
    const pathname = window.location.pathname;
    const pagesIdx = pathname.indexOf('/pages/');
    if (pagesIdx !== -1) {
        const base = pathname.substring(0, pagesIdx + '/pages/'.length);
        return window.location.origin + base + 'logo/logo origeen beer.png';
    }
    return '/origin-beer-frontend/src/pages/logo/logo origeen beer.png';
}
// ── SIDEBAR HTML (admin nav) ──────────────────────────────────
function getSidebarNav(base = '../') {
    return `
    <div class="sidebar-logo">
        <img src="${_logoPath()}" alt="Origin Beer" class="logo-icon">
        <div><h2>Origin Beer</h2><p>Management System</p></div>
    </div>
    <div class="sidebar-user">
        <div class="user-name" id="sidebarName">Loading...</div>
        <div class="user-role" id="sidebarRolee">—</div>
        <div class="user-branch" id="sidebarBranch" style="display:none"></div>
    </div>
    <nav class="sidebar-nav">
        <div class="nav-section">Main</div>
        <a class="nav-item" href="${base}dashboard/dashboard.html"><span class="nav-icon">📊</span> Dashboard</a>
        <div class="nav-section">Administration</div>
        <a class="nav-item" href="${base}users/users.html"><span class="nav-icon">👥</span> Users</a>
        <a class="nav-item" href="${base}branches/branches.html"><span class="nav-icon">🏢</span> Branches</a>
        <div class="nav-section">Inventory</div>
        <a class="nav-item" href="${base}products/products.html"><span class="nav-icon">🛒</span> Products</a>
        <a class="nav-item" href="${base}inventory/inventory.html"><span class="nav-icon">📦</span> Inventory</a>
        <div class="nav-section">Operations</div>
        <a class="nav-item" href="${base}orders/orders.html"><span class="nav-icon">🧾</span> Orders</a>
        <a class="nav-item" href="${base}tables/tables.html"><span class="nav-icon">🪑</span> Tables</a>
        <div class="nav-section">Analytics</div>
        <a class="nav-item" href="${base}reports/reports.html"><span class="nav-icon">📈</span> Reports</a>
    </nav>
    <div class="sidebar-footer">
        <button class="btn-theme-toggle" onclick="toggleTheme()">🌙 Toggle Theme</button>
        <button class="btn-logout" onclick="logout()">🚪 Log Out</button>
    </div>
    `;
}

// ── SIDEBAR HTML (cashier nav) ────────────────────────────────
function getCashierSidebar(base = '../') {
    return `
    <div class="sidebar-logo">
        <img src="${_logoPath()}" alt="Origin Beer" class="logo-icon">
        <div><h2>Origin Beer</h2><p>Cashier Station</p></div>
    </div>
    <div class="sidebar-user">
        <div class="user-name" id="sidebarName">Loading...</div>
        <div class="user-role" id="sidebarRolee">—</div>
        <div class="user-branch" id="sidebarBranch" style="display:none"></div>
    </div>
    <nav class="sidebar-nav">
        <div class="nav-section">Main</div>
        <a class="nav-item" href="${base}dashboard/dashboard.html"><span class="nav-icon">📊</span> Dashboard</a>
        <div class="nav-section">Operations</div>
        <a class="nav-item" href="${base}orders/orders.html"><span class="nav-icon">🧾</span> Orders</a>
        <a class="nav-item" href="${base}tables/tables.html"><span class="nav-icon">🪑</span> Tables</a>
        <div class="nav-section">Inventory</div>
        <a class="nav-item" href="${base}inventory/inventory.html"><span class="nav-icon">📦</span> Branch Inventory</a>
        <div class="nav-section">Reports</div>
        <a class="nav-item" href="${base}reports/reports.html"><span class="nav-icon">📈</span> Reports</a>
    </nav>
    <div class="sidebar-footer">
        <button class="btn-theme-toggle" onclick="toggleTheme()">🌙 Toggle Theme</button>
        <button class="btn-logout" onclick="logout()">🚪 Log Out</button>
    </div>
    `;
}

// ── SIDEBAR HTML (waiter nav) ─────────────────────────────────
// IMPORTANT: All waiter pages live at pages/waiter/<section>/<file>.html
// so the correct base from any waiter page is always '../' (one level up
// to /waiter/, then the section subfolder). Do NOT pass '../../' here.
function getWaiterSidebar(base = '../') {
    return `
    <div class="sidebar-logo">
        <img src="${_logoPath()}" alt="Origin Beer" class="logo-icon">
        <div><h2>Origin Beer</h2><p>Waiter Station</p></div>
    </div>
    <div class="sidebar-user">
        <div class="user-name" id="sidebarName">Loading...</div>
        <div class="user-role" id="sidebarRolee">—</div>
        <div class="user-branch" id="sidebarBranch" style="display:none"></div>
    </div>
    <nav class="sidebar-nav">
        <div class="nav-section">Main</div>
        <a class="nav-item" href="${base}dashboard/dashboard.html"><span class="nav-icon">📊</span> Dashboard</a>
        <div class="nav-section">Operations</div>
        <a class="nav-item" href="${base}tables/tables.html"><span class="nav-icon">🪑</span> Tables</a>
        <a class="nav-item" href="${base}orders/orders.html"><span class="nav-icon">🧾</span> Orders</a>
    </nav>
    <div class="sidebar-footer">
        <button class="btn-theme-toggle" onclick="toggleTheme()">🌙 Toggle Theme</button>
        <button class="btn-logout" onclick="logout()">🚪 Log Out</button>
    </div>
    `;
}