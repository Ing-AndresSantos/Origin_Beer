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

function requireRole(role) {
    requireAuth();
    // Validación de rol - puede ajustarse según la estructura de datos del usuario
    // Por ahora se enfoca en verificar autenticación
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Construir ruta limpia: reemplazar todo después de "/pages/" con "login/login.html"
    const pathname = window.location.pathname;
    const pagesIndex = pathname.indexOf('/pages/');
    
    if (pagesIndex !== -1) {
        // Extraer desde el inicio hasta "/pages/" incluido
        const baseToPages = pathname.substring(0, pagesIndex + '/pages/'.length);
        window.location.href = window.location.origin + baseToPages + 'login/login.html';
    } else {
        window.location.href = '/origin-beer-frontend/src/pages/login/login.html';
    }
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

