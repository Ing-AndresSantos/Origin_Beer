/**
 * RUTA FRONTEND: src/pages/reports/reports.js
 *
 * Sprint 6 — Admin Reports Dashboard
 * RF-26 Filtro por rango de fechas
 * RF-27 Reporte por producto
 * RF-28 Columnas: fechaCierre, código, cantidad, costoVenta, costoCompra, ganancia, sede
 * RF-30 Admin: todas las sedes consolidadas
 *
 * Exportación Excel profesional generada 100% en el navegador con SheetJS.
 * Al hacer clic en "📊 Excel" descarga un .xlsx con 5 hojas:
 *   Cover · Sales Detail · Executive Summary · Pivot Summary · Notes
 */

requireAuth();
document.getElementById('sidebar').innerHTML = getSidebarNav('../');
initSidebar('reports');
initDate();

// ── State ──────────────────────────────────────────────────────
let reportData   = { summary: {}, rows: [] };
let allBranches  = [];
let filteredRows = [];
let currentPage  = 1;
const PER_PAGE   = 12;
let chartSales   = null;
let chartPayment = null;
let chartBranch  = null;

const COLORS = ['#f59e0b','#10b981','#6366f1','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

// ══════════════════════════════════════════════════════════════
// LOAD
// ══════════════════════════════════════════════════════════════
async function loadBranches() {
    try {
        const res = await fetch(`${API}/api/branches`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (res.ok) {
            allBranches = await res.json();
            populateBranchFilter();
        }
    } catch (e) { console.error('Could not load branches', e); }
}

async function load() {
    showSkeleton(true);
    try {
        const params = buildParams();
        const rep = await apiFetch(`/api/reports/admin${params}`);
        reportData = rep || { summary: {}, rows: [] };
        applyFilter();
        renderSummary(reportData.summary);
        renderCharts(reportData);
    } catch (e) {
        showEmptyState('❌', 'Could not connect to the server');
    } finally {
        showSkeleton(false);
    }
}

function buildParams() {
    const from     = document.getElementById('filterDateFrom').value;
    const to       = document.getElementById('filterDateTo').value;
    const branchId = document.getElementById('filterBranch').value;
    const parts    = [];
    if (from)     parts.push(`startDate=${from}`);
    if (to)       parts.push(`endDate=${to}`);
    if (branchId) parts.push(`branchId=${branchId}`);
    return parts.length ? '?' + parts.join('&') : '';
}

function populateBranchFilter() {
    const sel = document.getElementById('filterBranch');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All branches</option>';
    allBranches.filter(b => b.active).forEach(b => {
        sel.innerHTML += `<option value="${b.idBranch}" ${cur == b.idBranch ? 'selected' : ''}>${b.name}</option>`;
    });
}

// ══════════════════════════════════════════════════════════════
// SUMMARY CARDS
// ══════════════════════════════════════════════════════════════
function renderSummary(s) {
    if (!s || !Object.keys(s).length) return;
    setEl('statTotalOrders',    (s.totalInvoices || 0).toLocaleString('es-CO'));
    setEl('statTotalSales',     fmt(s.totalSale));
    setEl('statProductsSold',   (s.totalQty || 0).toLocaleString('es-CO'));
    setEl('statActiveBranches', Object.keys(s.salesByBranch || {}).length);
    setEl('kpiTotalProfit',  fmt(s.totalProfit));
    setEl('kpiMargin',       (s.globalMargin || 0) + '%');
    setEl('kpiAvgTicket',    fmt(s.avgTicket));
    setEl('kpiTopProduct',   s.topProductByQty || '—');
    setEl('kpiTopBranch',    s.topBranch       || '—');
    setEl('kpiTopCashier',   s.topCashier      || '—');
    setEl('kpiTopPayment',   s.topPayMethod    || '—');
    setEl('kpiPeakHour',     s.peakHour        || '—');
}

// ══════════════════════════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════════════════════════
function renderCharts(data) {
    if (typeof Chart === 'undefined') return;
    const s = data.summary || {};
    renderDailyChart(data.rows || []);
    renderPaymentChart(s.salesByPayMethod || {});
    renderProductChart(s.salesByProduct   || {});
    renderBranchChart(s.salesByBranch     || {});
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
    const ctx    = document.getElementById('chartDaily');
    if (!ctx) return;
    if (chartSales) chartSales.destroy();
    chartSales = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(d => new Date(d+'T00:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'})),
            datasets: [{ label:'Sales', data: labels.map(k=>daily[k]), backgroundColor:'rgba(245,158,11,0.7)', borderColor:'#f59e0b', borderWidth:1, borderRadius:6 }]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>'$ '+c.raw.toLocaleString('es-CO')}} },
            scales:{
                y:{ ticks:{color:'#9ca3af',callback:v=>'$ '+Number(v).toLocaleString('es-CO')}, grid:{color:'#1f2937'} },
                x:{ ticks:{color:'#9ca3af'}, grid:{display:false} }
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
        data: { labels: Object.keys(data), datasets:[{ data:Object.values(data), backgroundColor:COLORS, borderWidth:2, borderColor:'#111827' }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{color:'#9ca3af',padding:12,font:{size:11}}}} }
    });
}

function renderProductChart(data) {
    const ctx    = document.getElementById('chartProducts');
    if (!ctx) return;
    const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8);
    if (chartBranch) chartBranch.destroy();
    chartBranch = new Chart(ctx, {
        type:'bar',
        data:{ labels:sorted.map(e=>e[0]), datasets:[{label:'Units sold',data:sorted.map(e=>e[1]),backgroundColor:COLORS.slice(0,sorted.length),borderRadius:6}] },
        options:{
            indexAxis:'y', responsive:true, maintainAspectRatio:false,
            plugins:{legend:{display:false}},
            scales:{ x:{ticks:{color:'#9ca3af'},grid:{color:'#1f2937'}}, y:{ticks:{color:'#e5e7eb',font:{size:11}},grid:{display:false}} }
        }
    });
}

function renderBranchChart(data) {
    const ctx = document.getElementById('chartBranch');
    if (!ctx) return;
    if (window._chartBranch2) window._chartBranch2.destroy();
    window._chartBranch2 = new Chart(ctx, {
        type:'doughnut',
        data:{ labels:Object.keys(data), datasets:[{data:Object.values(data).map(v=>parseFloat(v)),backgroundColor:COLORS,borderWidth:2,borderColor:'#111827'}] },
        options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{
                legend:{position:'bottom',labels:{color:'#9ca3af',padding:10,font:{size:11}}},
                tooltip:{callbacks:{label:c=>c.label+': $ '+Number(c.raw).toLocaleString('es-CO')}}
            }
        }
    });
}

function renderHourlyHeatmap(data) {
    const el = document.getElementById('heatmapGrid');
    if (!el) return;
    const max = Math.max(...Object.values(data), 1);
    let html = '';
    for (let h = 0; h < 24; h++) {
        const cnt = data[h] || 0;
        const pct = Math.round((cnt/max)*100);
        const bg  = pct>80?'#f59e0b':pct>50?'#d97706':pct>20?'#92400e':'#1f2937';
        html += `<div class="heatmap-cell" style="background:${bg}" title="${h}:00 — ${cnt} orders"><span class="heatmap-hour">${h}</span></div>`;
    }
    el.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
// TABLE RF-27 / RF-28
// ══════════════════════════════════════════════════════════════
function applyFilter() {
    const q   = (document.getElementById('search').value || '').toLowerCase();
    const cat = document.getElementById('filterType')?.value || '';

    filteredRows = (reportData.rows || []).filter(r => {
        const text = `${r.productCode} ${r.productName} ${r.branchName} ${r.cashier}`.toLowerCase();
        return (!q || text.includes(q)) && (!cat || r.category === cat);
    });
    currentPage = 1;
    renderTable();
    updateStats();
}

function filter() { applyFilter(); }

function validateDateRange() {
    const from = document.getElementById('filterDateFrom');
    const to   = document.getElementById('filterDateTo');
    if (from.value) to.min = from.value;
    if (to.value)   from.max = to.value;
    applyFilter();
}

function updateStats() {
    const s = reportData.summary || {};
    setEl('statTotalOrders',    (s.totalInvoices  || 0).toLocaleString('es-CO'));
    setEl('statTotalSales',     fmt(s.totalSale));
    setEl('statProductsSold',   (s.totalQty       || 0).toLocaleString('es-CO'));
    setEl('statActiveBranches', Object.keys(s.salesByBranch || {}).length);
}

function renderTable() {
    const tbody    = document.getElementById('reportsTable');
    const total    = filteredRows.length;
    const totPages = Math.ceil(total / PER_PAGE) || 1;
    const start    = (currentPage - 1) * PER_PAGE;
    const page     = filteredRows.slice(start, start + PER_PAGE);

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><span class="empty-icon">📭</span><p>No data found</p></div></td></tr>`;
    } else {
        tbody.innerHTML = page.map(r => {
            const profit = parseFloat(r.profit || 0);
            const margin = parseFloat(r.margin || 0);
            const mColor = margin >= 30 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444';
            const closeD = r.closeDate ? new Date(r.closeDate).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'}) : '—';
            return `<tr>
                <td style="font-size:11px;color:#9ca3af">${closeD}</td>
                <td><span class="badge badge-branch">${r.productCode||'—'}</span></td>
                <td><div style="font-weight:600">${r.productName||'—'}</div><div style="font-size:10px;color:#6b7280">${r.category||''}</div></td>
                <td style="text-align:center"><strong>${r.quantity}</strong></td>
                <td>$ ${Number(r.unitCostPrice||0).toLocaleString('es-CO')}</td>
                <td>$ ${Number(r.totalSale||0).toLocaleString('es-CO')}</td>
                <td>$ ${Number(r.totalCost||0).toLocaleString('es-CO')}</td>
                <td style="color:${mColor};font-weight:700">$ ${profit.toLocaleString('es-CO')} <span style="font-size:10px">(${margin}%)</span></td>
                <td><span class="badge badge-cat">${r.branchName||'—'}</span></td>
            </tr>`;
        }).join('');
    }

    setEl('resultInfo', `Showing ${Math.min(start+1,total)} to ${Math.min(start+PER_PAGE,total)} of ${total} records`);
    setEl('pageInfo',   `Page ${currentPage} of ${totPages}`);
    renderPagination(totPages);
}

function renderPagination(totalPages) {
    const el   = document.getElementById('pageBtns');
    let html   = `<button onclick="prevPage()" ${currentPage===1?'disabled':''}>← Previous</button>`;
    pagRange(currentPage, totalPages).forEach(p => {
        if (p==='…') html += `<span style="padding:0 6px">…</span>`;
        else html += `<button class="${p===currentPage?'active':''}" onclick="changePage(${p})">${p}</button>`;
    });
    html += `<button onclick="nextPage()" ${currentPage===totalPages?'disabled':''}>Next →</button>`;
    el.innerHTML = html;
}

function pagRange(cur, total) {
    if (total <= 7) return Array.from({length:total},(_,i)=>i+1);
    if (cur <= 4)   return [1,2,3,4,5,'…',total];
    if (cur >= total-3) return [1,'…',total-4,total-3,total-2,total-1,total];
    return [1,'…',cur-1,cur,cur+1,'…',total];
}

function changePage(p) {
    const total = Math.ceil(filteredRows.length/PER_PAGE)||1;
    if (p<1||p>total) return;
    currentPage = p; renderTable();
}
function prevPage() { changePage(currentPage-1); }
function nextPage() { changePage(currentPage+1); }

// ══════════════════════════════════════════════════════════════
// EXPORT EXCEL PROFESIONAL — SheetJS (100% frontend, sin backend)
// Botón: "📊 Excel" → llama exportReport()
// Genera 5 hojas: Cover · Sales Detail · Executive Summary ·
//                 Pivot Summary · Notes
// ══════════════════════════════════════════════════════════════
function exportReport() {
    if (!filteredRows.length) { alert('No data to export.'); return; }

    const XLSX = window.XLSX;
    if (!XLSX) { alert('SheetJS not loaded. Check your internet connection.'); return; }

    const wb  = XLSX.utils.book_new();
    const s   = reportData.summary || {};
    const u   = (typeof getUser === 'function') ? getUser() : {};
    const now = new Date();

    // ── Paleta ─────────────────────────────────────────────────
    const C = {
        DARK:'FF111827', AMBER:'FFF59E0B', GREEN:'FF10B981',
        PURPLE:'FF6366F1', WHITE:'FFF9FAFB', GRAY1:'FF1F2937',
        GRAY2:'FF374151', GRAY3:'FF6B7280', RED:'FFEF4444', BLUE:'FF3B82F6',
        ALT:'FF1A2333'
    };

    // Helper de celda con estilo
    function mkCell(v, bg, fg, sz, bold, align, fmt) {
        return {
            v, t: typeof v==='number'?'n':'s',
            s: {
                font:  {name:'Arial', sz:sz||10, bold:bold||false, color:{rgb:fg||C.WHITE}},
                fill:  {fgColor:{rgb:bg||C.DARK}, patternType:'solid'},
                alignment:{horizontal:align||'left',vertical:'center',wrapText:false},
                border:{ top:{style:'thin',color:{rgb:'FF2D3748'}}, bottom:{style:'thin',color:{rgb:'FF2D3748'}}, left:{style:'thin',color:{rgb:'FF2D3748'}}, right:{style:'thin',color:{rgb:'FF2D3748'}} },
                numFmt: fmt || (typeof v==='number'?'0':'@')
            }
        };
    }

    const H = (v)       => mkCell(v, C.AMBER, C.DARK,   9,  true,  'center');
    const T = (v)       => mkCell(v, C.GRAY1, C.AMBER,  14, true,  'center');
    const S = (v)       => mkCell(v, C.DARK,  C.GRAY3,  9,  false, 'center');
    const TOT = (v, m)  => mkCell(v, C.GRAY2, C.AMBER,  10, true,  'center', m?'"$"#,##0.00':'@');
    const MONEY = (v,bg,fg) => mkCell(v, bg||C.GRAY1, fg||C.AMBER, 9, true, 'center', '"$"#,##0.00');
    const PCT   = (v,bg)    => mkCell(v, bg||C.GRAY1, C.WHITE, 9, false, 'center', '0.00"%"');

    function applyStyles(ws, aoa) {
        aoa.forEach((row, ri) => (row||[]).forEach((c, ci) => {
            if (!c || !c.s) return;
            const addr = XLSX.utils.encode_cell({r:ri,c:ci});
            if (ws[addr]) ws[addr].s = c.s;
        }));
    }

    // ── HOJA 1: COVER ─────────────────────────────────────────
    const dateStr = now.toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});
    const coverAoA = [
        [ T('🍺  ORIGIN BEER') ],
        [ S('Enterprise Sales Report — Admin Dashboard') ],
        [ S('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') ],
        [],
        [ mkCell('📅  Report Date', C.GRAY1,C.GRAY3,9,false,'left'), mkCell(dateStr, C.GRAY1,C.WHITE,9,true,'left') ],
        [ mkCell('👤  Generated By',C.GRAY1,C.GRAY3,9,false,'left'), mkCell((u.firstName||'Admin')+' '+(u.lastName||''), C.GRAY1,C.WHITE,9,true,'left') ],
        [ mkCell('📍  Scope',       C.GRAY1,C.GRAY3,9,false,'left'), mkCell('All Branches — Consolidated', C.GRAY1,C.WHITE,9,true,'left') ],
        [ mkCell('📊  Period',      C.GRAY1,C.GRAY3,9,false,'left'), mkCell(buildParams()||'Full history', C.GRAY1,C.WHITE,9,true,'left') ],
        [],
        [ mkCell('━ KPI SUMMARY ━', C.GRAY1,C.AMBER,11,true,'center') ],
        [],
        [
            mkCell('💰 TOTAL SALES',  C.GRAY1,C.GRAY3,9,false,'center'), mkCell('',C.GRAY1,C.GRAY3,9),
            mkCell('📈 TOTAL PROFIT', C.GRAY1,C.GRAY3,9,false,'center'), mkCell('',C.GRAY1,C.GRAY3,9),
            mkCell('📦 UNITS SOLD',   C.GRAY1,C.GRAY3,9,false,'center'), mkCell('',C.GRAY1,C.GRAY3,9),
            mkCell('🧾 INVOICES',     C.GRAY1,C.GRAY3,9,false,'center'),
        ],
        [
            MONEY(Number(s.totalSale   ||0), C.GRAY1, C.AMBER), mkCell('',C.GRAY1,C.AMBER,9),
            MONEY(Number(s.totalProfit ||0), C.GRAY1, C.GREEN), mkCell('',C.GRAY1,C.GREEN,9),
            mkCell(Number(s.totalQty   ||0), C.GRAY1,C.PURPLE,18,true,'center'), mkCell('',C.GRAY1,C.PURPLE,9),
            mkCell(Number(s.totalInvoices||0),C.GRAY1,C.BLUE,18,true,'center'),
        ],
        [],
        [ S('CONFIDENTIAL — Internal Use Only — Origin Beer Analytics Platform') ],
    ];
    const wsCover = XLSX.utils.aoa_to_sheet(coverAoA.map(r=>(r||[]).map(c=>c?.v??'')));
    wsCover['!cols'] = Array(10).fill({wch:18});
    applyStyles(wsCover, coverAoA);
    XLSX.utils.book_append_sheet(wb, wsCover, '📋 Cover');

    // ── HOJA 2: SALES DETAIL — RF-28 ─────────────────────────
    const hdrs = ['Close Date','Product Code','Product','Category','Qty','Unit Cost ($)','Total Sale ($)','Total Cost ($)','Profit ($)','Margin %','Branch','Cashier','Payment'];
    const detAoA = [
        [ T('📊  ORIGIN BEER — PRODUCT SALES DETAIL (RF-28)') ],
        [ S(`Period: ${buildParams()||'All time'}  |  Rows: ${filteredRows.length}  |  Sprint 6 RF-28`) ],
        [],
        hdrs.map(H),
        ...filteredRows.map((r,i) => {
            const bg     = i%2===0 ? C.GRAY1 : C.ALT;
            const profit = parseFloat(r.profit||0);
            const margin = parseFloat(r.margin||0);
            const mFg    = margin>=30?C.GREEN:margin>=15?C.AMBER:C.RED;
            return [
                mkCell(r.closeDate?new Date(r.closeDate).toLocaleDateString('es-CO'):'—',bg,C.GRAY3,9,false,'center'),
                mkCell(r.productCode||'—',  bg,C.BLUE,  9,true, 'center'),
                mkCell(r.productName||'—',  bg,C.WHITE, 9,false,'left'),
                mkCell(r.category||'—',     bg,C.GRAY3, 9,false,'left'),
                mkCell(r.quantity||0,       bg,C.WHITE, 9,true, 'center'),
                mkCell(Number(r.unitCostPrice||0),bg,C.WHITE,9,false,'center','"$"#,##0.00'),
                MONEY(Number(r.totalSale||0),bg,C.AMBER),
                mkCell(Number(r.totalCost||0),bg,C.WHITE,9,false,'center','"$"#,##0.00'),
                mkCell(profit,              bg,mFg,9,true,'center','"$"#,##0.00'),
                PCT(margin, bg),
                mkCell(r.branchName||'—',   bg,C.PURPLE,9,false,'left'),
                mkCell(r.cashier||'—',      bg,C.WHITE, 9,false,'left'),
                mkCell(r.paymentMethod||'—',bg,C.WHITE, 9,false,'center'),
            ];
        }),
        [
            TOT('TOTALS'), TOT(''), TOT(''), TOT(''),
            TOT(filteredRows.reduce((a,r)=>a+(r.quantity||0),0)),
            TOT(''),
            TOT(filteredRows.reduce((a,r)=>a+Number(r.totalSale||0),0), true),
            TOT(filteredRows.reduce((a,r)=>a+Number(r.totalCost||0),0), true),
            TOT(filteredRows.reduce((a,r)=>a+Number(r.profit||0),0),    true),
            mkCell(
                (filteredRows.reduce((a,r)=>a+parseFloat(r.margin||0),0)/(filteredRows.length||1)).toFixed(2)+'%',
                C.GRAY2,C.AMBER,10,true,'center'
            ),
            TOT(''), TOT(''), TOT(''),
        ]
    ];
    const wsDet = XLSX.utils.aoa_to_sheet(detAoA.map(r=>r.map(c=>c?.v??'')));
    wsDet['!cols'] = [14,13,26,15,6,12,14,14,13,10,20,18,16].map(w=>({wch:w}));
    wsDet['!autofilter'] = { ref:'A4:M4' };
    applyStyles(wsDet, detAoA);
    XLSX.utils.book_append_sheet(wb, wsDet, '📊 Sales Detail');

    // ── HOJA 3: EXECUTIVE SUMMARY ─────────────────────────────
    const summAoA = [
        [ T('EXECUTIVE SUMMARY — ORIGIN BEER') ],
        [ S('KPI Dashboard — Sprint 6') ],
        [],
        [
            mkCell('💰 TOTAL SALES',  C.GRAY1,C.GRAY3,9,false,'center'), mkCell('',C.GRAY1,C.GRAY3,9),
            mkCell('📈 TOTAL PROFIT', C.GRAY1,C.GRAY3,9,false,'center'), mkCell('',C.GRAY1,C.GRAY3,9),
            mkCell('% AVG MARGIN',    C.GRAY1,C.GRAY3,9,false,'center'), mkCell('',C.GRAY1,C.GRAY3,9),
            mkCell('🧾 INVOICES',     C.GRAY1,C.GRAY3,9,false,'center'),
        ],
        [
            MONEY(Number(s.totalSale   ||0),C.GRAY1,C.AMBER), mkCell('',C.GRAY1,C.AMBER,9),
            MONEY(Number(s.totalProfit ||0),C.GRAY1,C.GREEN), mkCell('',C.GRAY1,C.GREEN,9),
            PCT(Number(s.globalMargin  ||0),C.GRAY1), mkCell('',C.GRAY1,C.BLUE,9),
            mkCell(Number(s.totalInvoices||0),C.GRAY1,C.BLUE,18,true,'center'),
        ],
        [],
        [ H('Branch'), H('Total Sales ($)'), H('Share %') ],
        ...Object.entries(s.salesByBranch||{}).map(([br,val],i) => {
            const bg    = i%2===0?C.GRAY1:C.ALT;
            const share = ((Number(val)/(Number(s.totalSale)||1))*100).toFixed(1)+'%';
            return [
                mkCell(br,         bg,C.WHITE,10,false,'left'),
                MONEY(Number(val), bg,C.AMBER),
                mkCell(share,      bg,C.GREEN, 10,false,'center'),
            ];
        }),
        [],
        [ H('KPI'),              H('Value') ],
        [ mkCell('Top Product',  C.GRAY1,C.AMBER,9,true,'left'),  mkCell(s.topProductByQty||'—',C.GRAY1,C.WHITE,9) ],
        [ mkCell('Top Branch',   C.GRAY1,C.AMBER,9,true,'left'),  mkCell(s.topBranch      ||'—',C.GRAY1,C.WHITE,9) ],
        [ mkCell('Top Cashier',  C.GRAY1,C.AMBER,9,true,'left'),  mkCell(s.topCashier     ||'—',C.GRAY1,C.WHITE,9) ],
        [ mkCell('Top Payment',  C.GRAY1,C.AMBER,9,true,'left'),  mkCell(s.topPayMethod   ||'—',C.GRAY1,C.WHITE,9) ],
        [ mkCell('Peak Hour',    C.GRAY1,C.AMBER,9,true,'left'),  mkCell(s.peakHour       ||'—',C.GRAY1,C.WHITE,9) ],
        [ mkCell('Avg Ticket',   C.GRAY1,C.AMBER,9,true,'left'),  MONEY(Number(s.avgTicket||0),C.GRAY1,C.GREEN) ],
    ];
    const wsSum = XLSX.utils.aoa_to_sheet(summAoA.map(r=>r.map(c=>c?.v??'')));
    wsSum['!cols'] = [24,18,12,14,14,12,12].map(w=>({wch:w}));
    applyStyles(wsSum, summAoA);
    XLSX.utils.book_append_sheet(wb, wsSum, '📈 Executive Summary');

    // ── HOJA 4: PIVOT CATEGORY × BRANCH ──────────────────────
    const branchNames = Object.keys(s.salesByBranch||{});
    const catMap = {};
    filteredRows.forEach(r => {
        const cat = r.category||'—';
        if (!catMap[cat]) catMap[cat] = {};
        catMap[cat][r.branchName] = (catMap[cat][r.branchName]||0) + Number(r.totalSale||0);
    });

    const pivAoA = [
        [ T('PIVOT — CATEGORY × BRANCH') ],
        [],
        [ H('Category'), ...branchNames.map(H), H('TOTAL') ],
        ...Object.entries(catMap).map(([cat,brMap],i) => {
            const bg    = i%2===0?C.GRAY1:C.ALT;
            const rowT  = Object.values(brMap).reduce((a,v)=>a+v,0);
            return [
                mkCell(cat, bg,C.WHITE,9,false,'left'),
                ...branchNames.map(br => MONEY(brMap[br]||0,bg,C.GREEN)),
                MONEY(rowT, C.GRAY2, C.AMBER),
            ];
        }),
        [
            TOT('GRAND TOTAL'),
            ...branchNames.map(br => TOT(Object.values(catMap).reduce((a,m)=>a+(m[br]||0),0),true)),
            TOT(filteredRows.reduce((a,r)=>a+Number(r.totalSale||0),0), true),
        ]
    ];
    const wsPiv = XLSX.utils.aoa_to_sheet(pivAoA.map(r=>r.map(c=>c?.v??'')));
    wsPiv['!cols'] = [22,...branchNames.map(()=>18),14].map(w=>({wch:w}));
    applyStyles(wsPiv, pivAoA);
    XLSX.utils.book_append_sheet(wb, wsPiv, '🔄 Pivot Summary');

    // ── HOJA 5: NOTES ─────────────────────────────────────────
    const notesAoA = [
        [ T('DATA DICTIONARY & REPORT NOTES') ],
        [],
        [ H('Field'), H('Definition') ],
        ...([
            ['Profit',      'Total Sale − Total Cost (per line)'],
            ['Margin %',    '(Profit / Total Sale) × 100'],
            ['Total Sale',  'sale_price × quantity'],
            ['Total Cost',  'purchase_cost × quantity'],
            ['Branch',      'invoice.branch — registered at payment close (RF-26)'],
            ['Source',      'invoice → order_ticket → order_detail (Live DB)'],
            ['Amber',       'Revenue / Sales figures'],
            ['Green',       'Profit / positive KPIs'],
            ['Red',         'Loss or margin below threshold'],
            ['Scope',       'Only PAID invoices within selected date range'],
        ]).map(([k,v],i) => [
            mkCell(k, i%2===0?C.GRAY1:C.DARK, C.AMBER,9,true,'left'),
            mkCell(v, i%2===0?C.GRAY1:C.DARK, C.WHITE,9,false,'left'),
        ])
    ];
    const wsNot = XLSX.utils.aoa_to_sheet(notesAoA.map(r=>r.map(c=>c?.v??'')));
    wsNot['!cols'] = [{wch:18},{wch:55}];
    applyStyles(wsNot, notesAoA);
    XLSX.utils.book_append_sheet(wb, wsNot, '📝 Notes');

    // ── DESCARGAR ──────────────────────────────────────────────
    XLSX.writeFile(wb, `origin-beer-report-${today()}.xlsx`);
}

// ══════════════════════════════════════════════════════════════
// EXPORT PDF
// ══════════════════════════════════════════════════════════════
function exportPDF() {
    if (!filteredRows.length) { alert('No data to export.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape' });
    const s   = reportData.summary || {};
    const u   = (typeof getUser==='function') ? getUser() : {};

    doc.setFillColor(17,24,39); doc.rect(0,0,297,210,'F');
    doc.setFontSize(28); doc.setTextColor(245,158,11);
    doc.text('🍺 Origin Beer', 148, 55, {align:'center'});
    doc.setFontSize(16); doc.setTextColor(229,231,235);
    doc.text('Sales Report — Admin Dashboard', 148, 70, {align:'center'});
    doc.setFontSize(11); doc.setTextColor(156,163,175);
    doc.text(`Generated: ${new Date().toLocaleString('es-CO')}`, 148, 82, {align:'center'});
    doc.text(`User: ${u.firstName||''} ${u.lastName||''}  |  ADMIN`, 148, 90, {align:'center'});

    const kpis = [
        ['Total Sales',  '$ '+Number(s.totalSale||0).toLocaleString('es-CO')],
        ['Total Profit', '$ '+Number(s.totalProfit||0).toLocaleString('es-CO')],
        ['Margin',       (s.globalMargin||0)+'%'],
        ['Invoices',     s.totalInvoices||0],
        ['Top Branch',   s.topBranch||'—'],
        ['Top Product',  s.topProductByQty||'—']
    ];
    let kx=20, ky=115;
    kpis.forEach(([label,val],i)=>{
        if(i===3){kx=20;ky=145;}
        doc.setFillColor(31,41,55); doc.roundedRect(kx,ky,80,22,3,3,'F');
        doc.setFontSize(8);  doc.setTextColor(156,163,175); doc.text(label,kx+5,ky+8);
        doc.setFontSize(12); doc.setTextColor(245,158,11);  doc.text(String(val),kx+5,ky+17);
        kx+=88;
    });

    doc.addPage();
    doc.setFontSize(13); doc.setTextColor(245,158,11);
    doc.text('Product Sales Detail (RF-28)', 14, 14);
    doc.autoTable({
        head:[['Close Date','Code','Product','Qty','Unit Cost','Total Sale','Total Cost','Profit','Branch']],
        body: filteredRows.map(r=>[
            r.closeDate?new Date(r.closeDate).toLocaleDateString('es-CO'):'',
            r.productCode, r.productName, r.quantity,
            '$ '+Number(r.unitCostPrice).toLocaleString('es-CO'),
            '$ '+Number(r.totalSale).toLocaleString('es-CO'),
            '$ '+Number(r.totalCost).toLocaleString('es-CO'),
            '$ '+Number(r.profit).toLocaleString('es-CO')+' ('+r.margin+'%)',
            r.branchName
        ]),
        startY:26,
        styles:{fontSize:8,cellPadding:2,textColor:[229,231,235],fillColor:[17,24,39]},
        headStyles:{fillColor:[245,158,11],textColor:[0,0,0],fontStyle:'bold'},
        alternateRowStyles:{fillColor:[31,41,55]},
        theme:'grid'
    });
    const pages = doc.getNumberOfPages();
    for(let i=1;i<=pages;i++){
        doc.setPage(i); doc.setFontSize(8); doc.setTextColor(107,114,128);
        doc.text(`Origin Beer — Confidential | Page ${i} of ${pages}`,148,205,{align:'center'});
    }
    doc.save(`origin-beer-admin-report-${today()}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// DATE PRESETS
// ══════════════════════════════════════════════════════════════
function setPreset(preset) {
    const now   = new Date();
    const toStr = d => d.toISOString().split('T')[0];
    let from, to = toStr(now);
    if      (preset==='today')   { from=toStr(now); }
    else if (preset==='week')    { const d=new Date(now); d.setDate(d.getDate()-6); from=toStr(d); }
    else if (preset==='month')   { from=toStr(new Date(now.getFullYear(),now.getMonth(),1)); }
    else if (preset==='quarter') { from=toStr(new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1)); }
    document.getElementById('filterDateFrom').value = from;
    document.getElementById('filterDateTo').value   = to;
    document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
    if(event&&event.currentTarget) event.currentTarget.classList.add('active');
    load();
}

// ── UTILS ──────────────────────────────────────────────────────
function fmt(val)   { return '$ '+Number(val||0).toLocaleString('es-CO',{minimumFractionDigits:0}); }
function today()    { return new Date().toISOString().split('T')[0]; }
function setEl(id,val){ const e=document.getElementById(id); if(e) e.textContent=val; }
function showSkeleton(on){ document.querySelectorAll('.skeleton').forEach(el=>el.style.display=on?'block':'none'); }
function showEmptyState(icon,msg){
    document.getElementById('reportsTable').innerHTML=
        `<tr><td colspan="9"><div class="empty-state"><span class="empty-icon">${icon}</span><p>${msg}</p></div></td></tr>`;
}

// ── INIT ──────────────────────────────────────────────────────
const _n = new Date();
document.getElementById('filterDateFrom').value =
    new Date(_n.getFullYear(), _n.getMonth(), 1).toISOString().split('T')[0];
document.getElementById('filterDateTo').value = _n.toISOString().split('T')[0];
loadBranches();
load();