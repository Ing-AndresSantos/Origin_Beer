requireAuth();
document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('inventory');
initDate();

// TODO: implement data loading from /api/inventory
async function load() {
    const data = await apiFetch('/api/inventory');
    if (data) console.log('Inventory loaded:', data);
}
load();
