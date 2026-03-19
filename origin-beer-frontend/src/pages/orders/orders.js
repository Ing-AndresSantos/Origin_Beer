requireAuth();
document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('orders');
initDate();

// TODO: implement data loading from /api/orders
async function load() {
    const data = await apiFetch('/api/orders');
    if (data) console.log('Orders loaded:', data);
}
load();
