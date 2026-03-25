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

function requireAuth() {
    if (!getToken()) window.location.href = '../login/login.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../login/login.html';
}

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
    if (nameEl) nameEl.textContent = (user.firstName || '') + ' ' + (user.lastName || '');  // ← actualizado
    if (roleEl) roleEl.textContent = user.role || 'ADMIN';                                   // ← actualizado

    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('href') && item.getAttribute('href').includes(activePage)) {
            item.classList.add('active');
        }
    });
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

// ── SIDEBAR HTML (shared nav) ─────────────────────────────────
function getSidebarNav(base = '../') {
    return `
    <div class="sidebar-logo">
        <span>🍺</span>
        <div><h2>Origin Beer</h2><p>Management System</p></div>
    </div>
    <div class="sidebar-user">
        <div class="user-name" id="sidebarName">Loading...</div>
        <div class="user-role" id="sidebarRolee">—</div>
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
        <a class="nav-item" href="${base}sales/sales.html"><span class="nav-icon">💳</span> Sales</a>
        <div class="nav-section">Analytics</div>
        <a class="nav-item" href="${base}reports/reports.html"><span class="nav-icon">📈</span> Reports</a>
    </nav>
    <div class="sidebar-footer">
        <button class="btn-logout" onclick="logout()">🚪 Log Out</button>
    </div>
    `;
}
