requireAuth();
document.getElementById('sidebar').innerHTML = getCashierSidebar('../');
initSidebar('reports');
initDate();

let allReports = [];
let userBranchId   = null;
let userBranchName = '—';
let currentPage = 1;
const PER_PAGE = 10;

// ── BRANCH RESOLUTION ─────────────────────────────────────────
// Resolve which branch this cashier belongs to
async function resolveUserBranch(userId) {
    try {
        const res = await fetch(`${API}/api/branches`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!res.ok) return null;
        const branches = await res.json();

        for (const branch of branches) {
            try {
                const r = await fetch(`${API}/api/branches/${branch.idBranch}/users`, {
                    headers: { 'Authorization': `Bearer ${getToken()}` }
                });
                if (!r.ok) continue;
                const users = await r.json();
                if (users.some(u => u.idUser === userId)) {
                    userBranchName = branch.name;
                    const headerEl = document.getElementById('branchNameHeader');
                    if (headerEl) headerEl.textContent = branch.name;
                    return branch.idBranch;
                }
            } catch (_) {}
        }
    } catch (e) {
        console.error('Could not load branches', e);
    }
    return null;
}

// ── INITIALIZATION ────────────────────────────────────────────
async function initializePage() {
    const user = getUser();
    if (!user?.idUser) { logout(); return; }

    userBranchId = await resolveUserBranch(user.idUser);

    if (!userBranchId) {
        document.getElementById('reportsTable').innerHTML =
            `<tr><td colspan="6"><div class="empty-state">
                <span class="empty-icon">❌</span>
                <p>No branch assigned to this cashier</p>
            </div></td></tr>`;
        return;
    }

    await loadReports();
}

// ── LOAD DATA ──────────────────────────────────────────────────
async function loadReports() {
    try {
        const res = await fetch(`${API}/api/reports/branch/${userBranchId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.status === 401) { logout(); return; }
        if (res.ok) {
            const data = await res.json();
            // Filtrar solo reportes de sales e inventory (sin expenses)
            allReports = data.filter(r => r.reportType === 'sales' || r.reportType === 'inventory');
            updateStats();
            filter();
        } else {
            document.getElementById('reportsTable').innerHTML =
                `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">❌</span><p>Could not load reports</p></div></td></tr>`;
        }
    } catch (e) {
        console.error('Error loading reports:', e);
        document.getElementById('reportsTable').innerHTML =
            `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">❌</span><p>Could not connect to the server</p></div></td></tr>`;
    }
}

function updateStats() {
    if (!allReports || allReports.length === 0) {
        document.getElementById('statTotalSales').textContent = '$0';
        document.getElementById('statInventoryItems').textContent = '0';
        document.getElementById('statTotalOrders').textContent = '0';
        return;
    }

    const salesReports = allReports.filter(r => r.reportType === 'sales');
    const inventoryReports = allReports.filter(r => r.reportType === 'inventory');
    
    const totalSales = salesReports.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const totalInventoryItems = inventoryReports.reduce((sum, r) => sum + (r.itemsCount || 0), 0);
    const totalOrders = salesReports.reduce((sum, r) => sum + (r.ordersCount || 0), 0);

    document.getElementById('statTotalSales').textContent = `$${totalSales.toFixed(2)}`;
    document.getElementById('statInventoryItems').textContent = totalInventoryItems.toLocaleString();
    document.getElementById('statTotalOrders').textContent = totalOrders.toLocaleString();
}

// ── FILTER & SEARCH ────────────────────────────────────────────
function validateDateRange() {
    const dateFromInput = document.getElementById('filterDateFrom');
    const dateToInput = document.getElementById('filterDateTo');
    const dateFrom = dateFromInput.value;
    const dateTo = dateToInput.value;

    // Si se selecciona fecha "From", establece como mínimo para "To"
    if (dateFrom) {
        dateToInput.min = dateFrom;
        if (dateTo && dateTo < dateFrom) {
            dateToInput.value = '';
        }
    } else {
        dateToInput.min = '';
    }

    // Si se selecciona fecha "To", establece como máximo para "From"
    if (dateTo) {
        dateFromInput.max = dateTo;
        if (dateFrom && dateFrom > dateTo) {
            dateFromInput.value = '';
        }
    } else {
        dateFromInput.max = '';
    }

    filter();
}

function filter() {
    const search = document.getElementById('search').value.toLowerCase();
    const type = document.getElementById('filterType').value;
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;

    let filtered = allReports.filter(r => {
        const matchSearch = !search || (r.reportDate && r.reportDate.toLowerCase().includes(search));
        const matchType = !type || r.reportType === type;
        
        // Date range filtering
        let matchDateRange = true;
        if (dateFrom || dateTo) {
            const reportDate = r.reportDate ? r.reportDate.split('T')[0] : '';
            if (dateFrom && dateTo) {
                matchDateRange = reportDate >= dateFrom && reportDate <= dateTo;
            } else if (dateFrom) {
                matchDateRange = reportDate >= dateFrom;
            } else if (dateTo) {
                matchDateRange = reportDate <= dateTo;
            }
        }
        
        return matchSearch && matchType && matchDateRange;
    });

    displayReports(filtered);
}

function displayReports(reports) {
    if (reports.length === 0) {
        document.getElementById('reportsTable').innerHTML =
            `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">📭</span><p>No reports found</p></div></td></tr>`;
        document.getElementById('resultInfo').textContent = '';
        document.getElementById('pageInfo').textContent = 'No data';
        document.getElementById('pageBtns').innerHTML = '';
        return;
    }

    // Pagination
    const totalPages = Math.ceil(reports.length / PER_PAGE);
    const start = (currentPage - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    const paginated = reports.slice(start, end);

    // Build HTML
    let html = '';
    paginated.forEach(r => {
        const typeIcon = r.reportType === 'sales' ? '💵' : '📦';
        const date = new Date(r.reportDate).toLocaleDateString('es-CO');
        const amount = parseFloat(r.totalAmount || 0);

        html += `<tr>
            <td><div class="report-type"><div class="report-icon">${typeIcon}</div><div><div class="report-name">${r.reportType === 'sales' ? 'Sales' : 'Inventory'}</div></div></div></td>
            <td>${date}</td>
            <td><strong>${r.ordersCount || 0}</strong></td>
            <td><span class="report-amount">$${amount.toFixed(2)}</span></td>
            <td><strong>${r.itemsCount || 0}</strong></td>
            <td class="actions-td">
                <button class="action-btn" title="View details" onclick="viewReportDetails(${r.idReport || 0})">👁️</button>
            </td>
        </tr>`;
    });

    document.getElementById('reportsTable').innerHTML = html;
    document.getElementById('resultInfo').textContent = `Showing ${start + 1} to ${Math.min(end, reports.length)} of ${reports.length} reports`;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;

    // Pagination buttons
    let btnHtml = '';
    if (currentPage > 1) btnHtml += `<button onclick="prevPage()">← Previous</button>`;
    if (currentPage < totalPages) btnHtml += `<button onclick="nextPage()">Next →</button>`;
    document.getElementById('pageBtns').innerHTML = btnHtml;
}

function prevPage() { if (currentPage > 1) { currentPage--; filter(); } }
function nextPage() { const totalPages = Math.ceil(allReports.length / PER_PAGE); if (currentPage < totalPages) { currentPage++; filter(); } }

// ── MODALS ────────────────────────────────────────────────────
function viewReportDetails(reportId) {
    const report = allReports.find(r => r.idReport == reportId);
    if (!report) return;

    const date = new Date(report.reportDate).toLocaleDateString('es-CO');
    const amount = parseFloat(report.totalAmount || 0);
    const typeIcon = report.reportType === 'sales' ? '💵 Sales Report' : '📦 Inventory Report';

    const html = `
        <div class="detail-group">
            <div class="detail-label">Report Type</div>
            <div class="detail-value">${typeIcon}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Date</div>
            <div class="detail-value">${date}</div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Total Orders</div>
            <div class="detail-value"><strong>${report.ordersCount || 0}</strong></div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Total Amount</div>
            <div class="detail-value"><strong style="color: #10b981;">$${amount.toFixed(2)}</strong></div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Items</div>
            <div class="detail-value"><strong>${report.itemsCount || 0}</strong></div>
        </div>
        <div class="detail-group">
            <div class="detail-label">Notes</div>
            <div class="detail-value">${report.notes || 'No additional notes'}</div>
        </div>
    `;

    document.getElementById('detailsContent').innerHTML = html;
    document.getElementById('detailsModalOverlay').classList.add('active');
}

function closeDetailsModal(event) {
    if (event && event.target !== document.getElementById('detailsModalOverlay')) return;
    document.getElementById('detailsModalOverlay').classList.remove('active');
}

function printReport() {
    window.print();
}

function exportReport() {
    if (allReports.length === 0) { alert('No reports to export'); return; }

    let csv = 'Report Type,Date,Orders,Amount,Items\n';
    allReports.forEach(r => {
        const date = new Date(r.reportDate).toLocaleDateString('es-CO');
        csv += `${r.reportType},${date},${r.ordersCount || 0},$${(r.totalAmount || 0).toFixed(2)},${r.itemsCount || 0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashier-reports-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function exportPDF() {
    if (allReports.length === 0) { alert('No reports to export'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(16);
    doc.text('Cashier Reports', 14, 15);
    
    // Fecha de generación
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('es-CO')}`, 14, 22);
    
    // Preparar datos para la tabla
    const tableData = allReports.map(r => [
        r.reportType === 'sales' ? 'Sales' : 'Inventory',
        new Date(r.reportDate).toLocaleDateString('es-CO'),
        r.ordersCount || 0,
        `$${(r.totalAmount || 0).toFixed(2)}`,
        r.itemsCount || 0
    ]);

    // Crear tabla
    doc.autoTable({
        head: [['Report Type', 'Date', 'Orders', 'Amount', 'Items']],
        body: tableData,
        startY: 30,
        theme: 'grid',
        styles: {
            fontSize: 10,
            cellPadding: 4,
        },
        headStyles: {
            fillColor: [245, 166, 35],
            textColor: [0, 0, 0],
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        }
    });

    // Guardar PDF
    doc.save(`cashier-reports-${new Date().toISOString().split('T')[0]}.pdf`);
}

// ── INIT ────────────────────────────────────────────────────
initializePage();
