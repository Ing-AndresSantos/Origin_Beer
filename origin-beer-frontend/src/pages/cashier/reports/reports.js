/**
 * cashier/reports/reports.js — Sprint 6
 * RF-26 Filtro por rango de fechas
 * RF-27 Reporte por producto
 * RF-28 Columnas: fechaCierre, código, cantidad, costoVenta, costoCompra, ganancia, sede
 * RF-29 Cajero: solo su sede
 */

requireAuth();
document.getElementById('sidebar').innerHTML = getCashierSidebar('../');
initSidebar('reports');
initDate();

// ── State ──────────────────────────────────────────────────────
let reportData   = { summary: {}, rows: [] };
let filteredRows = [];
let currentPage  = 1;
const PER_PAGE   = 12;
let userBranchId   = null;
let userBranchName = '—';
let chartDaily   = null;
let chartPayment = null;

const COLORS = ['#f59e0b','#10b981','#6366f1','#ef4444','#3b82f6','#8b5cf6'];

// ══════════════════════════════════════════════════════════════
// BRANCH RESOLUTION
// ══════════════════════════════════════════════════════════════
async function resolveUserBranch(userId) {
    const branches = await apiFetch('/api/branches') || [];
    for (const b of branches) {
        try {
            const res = await fetch(`${API}/api/branches/${b.idBranch}/users`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!res.ok) continue;
            const users = await res.json();
            if (users.some(u => u.idUser === userId)) {
                userBranchName = b.name;
                return b.idBranch;
            }
        } catch (_) {}
    }
    return null;
}

// ══════════════════════════════════════════════════════════════
// LOAD
// ══════════════════════════════════════════════════════════════
async function load() {
    showSkeleton(true);
    try {
        const params = buildParams();
        const data   = await apiFetch(`/api/reports/cashier/${userBranchId}${params}`);
        reportData   = data || { summary: {}, rows: [] };
        applyFilter();
        renderSummary(reportData.summary);
        renderCharts(reportData);
        setEl('branchBadge', userBranchName);
    } catch (e) {
        showEmptyState('❌', 'Could not connect to the server');
    } finally {
        showSkeleton(false);
    }
}

function buildParams() {
    const from = document.getElementById('filterFrom').value;
    const to   = document.getElementById('filterTo').value;
    const p    = [];
    if (from) p.push(`startDate=${from}`);
    if (to)   p.push(`endDate=${to}`);
    return p.length ? '?' + p.join('&') : '';
}

// ══════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════
function renderSummary(s) {
    if (!s || !Object.keys(s).length) return;
    setEl('kpiTotalSale',   fmt(s.totalSale));
    setEl('kpiTotalProfit', fmt(s.totalProfit));
    setEl('kpiMargin',      (s.globalMargin || 0) + '%');
    setEl('kpiQty',         (s.totalQty || 0).toLocaleString('es-CO'));
    setEl('kpiInvoices',    (s.totalInvoices || 0).toLocaleString('es-CO'));
    setEl('kpiAvgTicket',   fmt(s.avgTicket));
    setEl('kpiTopProduct',  s.topProductByQty || '—');
    setEl('kpiTopPayment',  s.topPayMethod    || '—');
    setEl('kpiPeakHour',    s.peakHour        || '—');

    const marginEl = document.getElementById('kpiMargin');
    if (marginEl) {
        const v = parseFloat(s.globalMargin || 0);
        marginEl.style.color = v >= 30 ? '#10b981' : v >= 15 ? '#f59e0b' : '#ef4444';
    }
}

// ══════════════════════════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════════════════════════
function renderCharts(data) {
    const s = data.summary || {};
    renderDailyChart(data.rows || []);
    renderPaymentChart(s.salesByPayMethod || {});
    renderProductChart(s.salesByProduct   || {});
    renderHourlyHeatmap(s.hourlyActivity  || {});
}

function renderDailyChart(rows) {
    const daily = {};
    rows.forEach(r => {
        const d = r.closeDate ? r.closeDate.split('T')[0] : '';
        if (!d) return;
        daily[d] = (daily[d] || 0) + parseFloat(r.totalSale || 0);
    });
    const labels = Object.keys(daily).sort();
    const values = labels.map(k => daily[k]);
    const ctx    = document.getElementById('chartDaily');
    if (!ctx) return;
    if (chartDaily) chartDaily.destroy();
    chartDaily = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(d => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'short' })),
            datasets: [{
                label: 'Sales',
                data: values,
                backgroundColor: 'rgba(245,158,11,0.7)',
                borderColor: '#f59e0b',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: {
                label: c => '$ ' + c.raw.toLocaleString('es-CO')
            }}},
            scales: {
                y: { ticks: { color: '#9ca3af', callback: v => '$ ' + Number(v).toLocaleString('es-CO') }, grid: { color: '#1f2937' } },
                x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
            }
        }
    });
}

function renderPaymentChart(data) {
    const ctx = document.getElementById('chartPayment');
    if (!ctx) return;
    if (chartPayment) chartPayment.destroy();
    chartPayment = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data),
            datasets: [{ data: Object.values(data), backgroundColor: COLORS, borderWidth: 2, borderColor: '#111827' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 10, font: { size: 11 } } } }
        }
    });
}

function renderProductChart(data) {
    const ctx    = document.getElementById('chartProducts');
    if (!ctx) return;
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (window._chartProd) window._chartProd.destroy();
    window._chartProd = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(e => e[0]),
            datasets: [{ label: 'Units', data: sorted.map(e => e[1]), backgroundColor: COLORS, borderRadius: 6 }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
                y: { ticks: { color: '#e5e7eb', font: { size: 11 } }, grid: { display: false } }
            }
        }
    });
}

function renderHourlyHeatmap(data) {
    const el  = document.getElementById('heatmapGrid');
    if (!el) return;
    const max = Math.max(...Object.values(data), 1);
    let html  = '';
    for (let h = 0; h < 24; h++) {
        const cnt = data[h] || 0;
        const pct = Math.round((cnt / max) * 100);
        const bg  = pct > 80 ? '#f59e0b' : pct > 50 ? '#d97706' : pct > 20 ? '#92400e' : '#1f2937';
        html += `<div class="heatmap-cell" style="background:${bg}" title="${h}:00 — ${cnt} orders">
                    <span class="heatmap-hour">${h}</span>
                 </div>`;
    }
    el.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
// TABLE — RF-27, RF-28
// ══════════════════════════════════════════════════════════════
function applyFilter() {
    const q = (document.getElementById('search').value || '').toLowerCase();
    filteredRows = (reportData.rows || []).filter(r => {
        const text = `${r.productCode} ${r.productName} ${r.cashier}`.toLowerCase();
        return !q || text.includes(q);
    });
    currentPage = 1;
    renderTable();
}

function renderTable() {
    const tbody    = document.getElementById('reportsTable');
    const total    = filteredRows.length;
    const totPages = Math.ceil(total / PER_PAGE) || 1;
    const start    = (currentPage - 1) * PER_PAGE;
    const page     = filteredRows.slice(start, start + PER_PAGE);

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="empty-icon">📭</span><p>No data for this period</p></div></td></tr>`;
    } else {
        tbody.innerHTML = page.map(r => {
            const profit = parseFloat(r.profit || 0);
            const margin = parseFloat(r.margin || 0);
            const mColor = margin >= 30 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444';
            const closeD = r.closeDate ? new Date(r.closeDate).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' }) : '—';
            return `<tr>
                <td style="font-size:11px;color:#9ca3af">${closeD}</td>
                <td><span class="badge badge-branch">${r.productCode || '—'}</span></td>
                <td><div style="font-weight:600">${r.productName || '—'}</div><div style="font-size:10px;color:#6b7280">${r.category || ''}</div></td>
                <td style="text-align:center"><strong>${r.quantity}</strong></td>
                <td>$ ${Number(r.unitCostPrice || 0).toLocaleString('es-CO')}</td>
                <td>$ ${Number(r.totalSale || 0).toLocaleString('es-CO')}</td>
                <td>$ ${Number(r.totalCost || 0).toLocaleString('es-CO')}</td>
                <td style="color:${mColor};font-weight:700">$ ${profit.toLocaleString('es-CO')} <span style="font-size:10px">(${margin}%)</span></td>
            </tr>`;
        }).join('');
    }

    document.getElementById('pageInfo').textContent =
        `${Math.min(start + 1, total)}–${Math.min(start + PER_PAGE, total)} of ${total}`;
    renderPagination(totPages);
}

function renderPagination(totalPages) {
    const el   = document.getElementById('pageBtns');
    let html   = `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;
    const range = pagRange(currentPage, totalPages);
    range.forEach(p => {
        if (p === '…') html += `<span style="padding:0 6px">…</span>`;
        else html += `<button class="${p === currentPage ? 'active' : ''}" onclick="changePage(${p})">${p}</button>`;
    });
    html += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;
    el.innerHTML = html;
}

function pagRange(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)   return [1,2,3,4,5,'…',total];
    if (cur >= total - 3) return [1,'…',total-4,total-3,total-2,total-1,total];
    return [1,'…',cur-1,cur,cur+1,'…',total];
}

function changePage(p) {
    const total = Math.ceil(filteredRows.length / PER_PAGE) || 1;
    if (p < 1 || p > total) return;
    currentPage = p;
    renderTable();
}

// ══════════════════════════════════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════════════════════════════════
function exportCSV() {
    if (!filteredRows.length) { alert('No data to export.'); return; }
    const header = 'Close Date,Product Code,Product,Category,Qty,Unit Cost,Total Sale,Total Cost,Profit,Margin %,Cashier,Payment\n';
    const body   = filteredRows.map(r => [
        r.closeDate ? new Date(r.closeDate).toLocaleDateString('es-CO') : '',
        r.productCode, `"${r.productName}"`, `"${r.category}"`,
        r.quantity, r.unitCostPrice, r.totalSale, r.totalCost,
        r.profit, r.margin, `"${r.cashier}"`, r.paymentMethod
    ].join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8;' });
    const a    = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `cashier-report-${userBranchName.replace(/\s/g,'_')}-${today()}.csv`
    });
    a.click();
}

// ══════════════════════════════════════════════════════════════
// EXPORT PDF
// ══════════════════════════════════════════════════════════════
function exportPDF() {
    if (!filteredRows.length) { alert('No data to export.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const s   = reportData.summary || {};
    const u   = getUser();

    // ── Portada ────────────────────────────────────────────────────────
    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, 297, 210, 'F');
    
    // Título principal
    doc.setFontSize(38); doc.setTextColor(245, 158, 11);
    doc.text('ORIGIN BEER', 148, 35, { align: 'center' });
    
    // Subtítulo
    doc.setFontSize(18); doc.setTextColor(229, 231, 235);
    doc.text('Cashier Sales Report', 148, 50, { align: 'center' });
    
    // Subtítulo secundario
    doc.setFontSize(11); doc.setTextColor(156, 163, 175);
    doc.text(`Cashier Dashboard | Sprint 6 | RF-26`, 148, 58, { align: 'center' });
    
    // Línea divisoria dorada
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(1);
    doc.line(20, 62, 276, 62);
    
    // Información de contexto en filas
    const info = [
        ['Report Date', new Date().toLocaleDateString('es-CO')],
        ['Generated By', `${u.firstName || ''} ${u.lastName || ''}`],
        ['Role', 'CASHIER'],
        ['Branch', userBranchName],
        ['Period', `${document.getElementById('filterFrom').value || '—'} | ${document.getElementById('filterTo').value || '—'}`]
    ];
    
    let iy = 70;
    info.forEach(([label, val]) => {
        doc.setFillColor(31, 41, 55);
        doc.rect(20, iy, 256, 10, 'F');
        doc.setFontSize(9); doc.setTextColor(156, 163, 175);
        doc.text(label, 25, iy + 7);
        doc.setFontSize(10); doc.setTextColor(229, 231, 235);
        doc.text(String(val), 90, iy + 7);
        iy += 12;
    });

    doc.addPage();
    doc.setFontSize(14); doc.setTextColor(245, 158, 11);
    doc.text('Product Sales Detail', 14, 14);

    // Calcular totales
    const totQty = filteredRows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totSale = filteredRows.reduce((sum, r) => sum + Number(r.totalSale || 0), 0);
    const totCost = filteredRows.reduce((sum, r) => sum + Number(r.totalCost || 0), 0);
    const totProfit = filteredRows.reduce((sum, r) => sum + Number(r.profit || 0), 0);

    // Preparar datos de la tabla con fila de totales
    const tableBody = [
        ...filteredRows.map(r => [
            r.closeDate ? new Date(r.closeDate).toLocaleDateString('es-CO') : '',
            r.productCode, r.productName, r.quantity,
            '$ ' + Number(r.unitCostPrice).toLocaleString('es-CO'),
            '$ ' + Number(r.totalSale).toLocaleString('es-CO'),
            '$ ' + Number(r.totalCost).toLocaleString('es-CO'),
            '$ ' + Number(r.profit).toLocaleString('es-CO') + ' (' + r.margin + '%)'
        ]),
        // Fila de totales
        [
            'TOTAL',
            '',
            '',
            String(totQty),
            '',
            '$ ' + totSale.toLocaleString('es-CO'),
            '$ ' + totCost.toLocaleString('es-CO'),
            '$ ' + totProfit.toLocaleString('es-CO')
        ]
    ];

    doc.autoTable({
        head: [['Close Date','Code','Product','Qty','Unit Cost','Sale Total','Cost Total','Profit']],
        body: tableBody,
        startY: 20,
        styles:       { fontSize: 8, cellPadding: 2, textColor: [229,231,235], fillColor: [17,24,39] },
        headStyles:   { fillColor: [245,158,11], textColor: [0,0,0], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [31,41,55] },
        didDrawCell: function(data) {
            // Estilo especial para la fila de totales
            if (data.row.index === tableBody.length - 1) {
                data.cell.styles.fillColor = [245, 158, 11];
                data.cell.styles.textColor = [0, 0, 0];
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fontSize = 9;
            }
        },
        theme: 'grid'
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(107, 114, 128);
        doc.text(`Origin Beer — ${userBranchName} | Page ${i} of ${pages}`, 148, 205, { align: 'center' });
    }
    doc.save(`cashier-report-${userBranchName.replace(/\s/g,'_')}-${today()}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// DATE PRESETS
// ══════════════════════════════════════════════════════════════
function setPreset(preset) {
    const now  = new Date();
    const toStr = d => d.toISOString().split('T')[0];
    let from, to = toStr(now);
    if (preset === 'today')   { from = toStr(now); }
    else if (preset === 'week')  { const d = new Date(now); d.setDate(d.getDate()-6); from = toStr(d); }
    else if (preset === 'month') { from = toStr(new Date(now.getFullYear(), now.getMonth(), 1)); }
    document.getElementById('filterFrom').value = from;
    document.getElementById('filterTo').value   = to;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    load();
}

// ── UTILS ──────────────────────────────────────────────────────
function fmt(val) { return '$ ' + Number(val||0).toLocaleString('es-CO', { minimumFractionDigits: 0 }); }
function today()  { return new Date().toISOString().split('T')[0]; }
function setEl(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }
function showSkeleton(on) { document.querySelectorAll('.skeleton').forEach(el => el.style.display = on ? 'block' : 'none'); }
function showEmptyState(icon, msg) {
    document.getElementById('reportsTable').innerHTML =
        `<tr><td colspan="8"><div class="empty-state"><span class="empty-icon">${icon}</span><p>${msg}</p></div></td></tr>`;
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
async function init() {
    const user = getUser();
    if (!user?.idUser) { logout(); return; }

    userBranchId = await resolveUserBranch(user.idUser);
    if (!userBranchId) {
        showEmptyState('⚠️', 'No branch assigned to this cashier');
        return;
    }
    setEl('branchBadge', userBranchName);

    const now = new Date();
    document.getElementById('filterFrom').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    document.getElementById('filterTo').value   = now.toISOString().split('T')[0];
    await load();
}
init();