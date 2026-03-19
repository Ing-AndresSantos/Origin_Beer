requireAuth();
document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('tables');
initDate();

// TODO: implement data loading from /api/tables
async function load() {
    const data = await apiFetch('/api/tables');
    if (data) console.log('Tables loaded:', data);
}
load();
