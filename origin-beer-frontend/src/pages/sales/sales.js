requireAuth();
document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('sales');
initDate();

// TODO: implement data loading from /api/sales
async function load() {
    const data = await apiFetch('/api/sales');
    if (data) console.log('Sales loaded:', data);
}
load();
