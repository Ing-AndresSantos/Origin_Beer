requireAuth();
document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('reports');
initDate();

// TODO: implement data loading from /api/reports
async function load() {
    const data = await apiFetch('/api/reports');
    if (data) console.log('Reports loaded:', data);
}
load();
