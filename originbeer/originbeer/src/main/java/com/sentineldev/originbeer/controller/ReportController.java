package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.model.*;
import com.sentineldev.originbeer.repository.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * ReportController — Sprint 6
 * RF-26 Filtro por rango de fechas
 * RF-27 Reporte por producto (no por factura consolidada)
 * RF-28 Columnas: fechaCierre, codigoProducto, cantidad, costoVenta, costoCompra, ganancia, sede
 * RF-29 Cajero: solo su sede
 * RF-30 Admin: todas las sedes consolidadas
 */
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final InvoiceRepository       invoiceRepo;
    private final OrderDetailRepository   detailRepo;
    private final BranchRepository        branchRepo;
    private final UserBranchRepository    userBranchRepo;

    public ReportController(InvoiceRepository invoiceRepo,
                            OrderDetailRepository detailRepo,
                            BranchRepository branchRepo,
                            UserBranchRepository userBranchRepo) {
        this.invoiceRepo    = invoiceRepo;
        this.detailRepo     = detailRepo;
        this.branchRepo     = branchRepo;
        this.userBranchRepo = userBranchRepo;
    }

    // ══════════════════════════════════════════════════════════
    // HELPER — Construye filas de reporte por producto
    // Fuente de verdad: invoice.issuedAt + order_detail
    // ══════════════════════════════════════════════════════════
    private List<Map<String, Object>> buildProductRows(List<Invoice> invoices) {
        List<Map<String, Object>> rows = new ArrayList<>();

        for (Invoice inv : invoices) {
            Long idOrder = inv.getOrder().getIdOrder();
            List<OrderDetail> details = detailRepo.findByOrder_IdOrder(idOrder);

            for (OrderDetail d : details) {
                BigDecimal qty      = BigDecimal.valueOf(d.getQuantity());
                BigDecimal saleLine = d.getSalePrice().multiply(qty);       // costo venta total línea
                BigDecimal costLine = d.getPurchaseCost().multiply(qty);    // costo compra total línea
                BigDecimal profit   = saleLine.subtract(costLine);          // ganancia línea

                Map<String, Object> row = new LinkedHashMap<>();
                row.put("idInvoice",      inv.getIdInvoice());
                row.put("invoiceNumber",  inv.getInvoiceNumber());
                row.put("closeDate",      inv.getIssuedAt());               // RF-28: fecha cierre
                row.put("branchId",       inv.getBranch().getIdBranch());   // RF-28: sede
                row.put("branchName",     inv.getBranch().getName());
                row.put("branchCode",     inv.getBranch().getCode());
                row.put("cashier",        inv.getCashier().getFirstName() + " " + inv.getCashier().getLastName());
                row.put("cashierId",      inv.getCashier().getIdUser());
                row.put("paymentMethod",  inv.getPaymentMethod().getName());
                row.put("productId",      d.getProduct().getIdProduct());
                row.put("productCode",    d.getProduct().getCode());        // RF-28: código producto
                row.put("productName",    d.getProduct().getName());
                row.put("category",       d.getProduct().getCategory() != null
                        ? d.getProduct().getCategory().getName() : "—");
                row.put("quantity",       d.getQuantity());                 // RF-28: cantidad vendida
                row.put("unitSalePrice",  d.getSalePrice());
                row.put("unitCostPrice",  d.getPurchaseCost());
                row.put("totalSale",      saleLine.setScale(2, RoundingMode.HALF_UP));   // RF-28: costo venta
                row.put("totalCost",      costLine.setScale(2, RoundingMode.HALF_UP));   // RF-28: costo compra
                row.put("profit",         profit.setScale(2, RoundingMode.HALF_UP));     // RF-28: ganancia
                row.put("margin",         saleLine.compareTo(BigDecimal.ZERO) == 0 ? 0
                        : profit.multiply(BigDecimal.valueOf(100))
                        .divide(saleLine, 2, RoundingMode.HALF_UP));
                rows.add(row);
            }
        }
        return rows;
    }

    // ══════════════════════════════════════════════════════════
    // HELPER — Construye summary KPIs desde filas
    // ══════════════════════════════════════════════════════════
    private Map<String, Object> buildSummary(List<Map<String, Object>> rows) {
        BigDecimal totalSale   = BigDecimal.ZERO;
        BigDecimal totalCost   = BigDecimal.ZERO;
        BigDecimal totalProfit = BigDecimal.ZERO;
        int        totalQty    = 0;

        Map<String, Integer>    productQty    = new LinkedHashMap<>();
        Map<String, BigDecimal> productProfit = new LinkedHashMap<>();
        Map<String, BigDecimal> branchSale    = new LinkedHashMap<>();
        Map<String, Integer>    cashierOrders = new LinkedHashMap<>();
        Map<String, Integer>    payMethods    = new LinkedHashMap<>();
        Map<Integer, Long>      hourActivity  = new TreeMap<>();

        Set<Long> invoicesSeen = new HashSet<>();

        for (Map<String, Object> r : rows) {
            BigDecimal sale   = (BigDecimal) r.get("totalSale");
            BigDecimal cost   = (BigDecimal) r.get("totalCost");
            BigDecimal profit = (BigDecimal) r.get("profit");
            int        qty    = (Integer) r.get("quantity");
            String     prod   = (String) r.get("productName");
            String     branch = (String) r.get("branchName");
            String     cashier= (String) r.get("cashier");
            String     pay    = (String) r.get("paymentMethod");
            LocalDateTime closeDate = (LocalDateTime) r.get("closeDate");

            totalSale   = totalSale.add(sale);
            totalCost   = totalCost.add(cost);
            totalProfit = totalProfit.add(profit);
            totalQty   += qty;

            productQty.merge(prod, qty, Integer::sum);
            productProfit.merge(prod, profit, BigDecimal::add);
            branchSale.merge(branch, sale, BigDecimal::add);
            cashierOrders.merge(cashier, 1, Integer::sum);
            payMethods.merge(pay, 1, Integer::sum);

            if (closeDate != null)
                hourActivity.merge(closeDate.getHour(), 1L, Long::sum);

            Long invId = (Long) r.get("idInvoice");
            invoicesSeen.add(invId);
        }

        // Top productos
        String topProductByQty = productQty.entrySet().stream()
                .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("—");
        String topProductByProfit = productProfit.entrySet().stream()
                .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("—");

        // Sede más rentable
        String topBranch = branchSale.entrySet().stream()
                .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("—");

        // Cajero con más ventas
        String topCashier = cashierOrders.entrySet().stream()
                .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("—");

        // Método más usado
        String topPayMethod = payMethods.entrySet().stream()
                .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("—");

        // Hora pico
        int peakHour = hourActivity.entrySet().stream()
                .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(0);

        // Ticket promedio = totalSale / facturas únicas
        BigDecimal avgTicket = invoicesSeen.isEmpty() ? BigDecimal.ZERO
                : totalSale.divide(BigDecimal.valueOf(invoicesSeen.size()), 2, RoundingMode.HALF_UP);

        BigDecimal globalMargin = totalSale.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO
                : totalProfit.multiply(BigDecimal.valueOf(100)).divide(totalSale, 2, RoundingMode.HALF_UP);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalSale",         totalSale.setScale(2, RoundingMode.HALF_UP));
        summary.put("totalCost",         totalCost.setScale(2, RoundingMode.HALF_UP));
        summary.put("totalProfit",       totalProfit.setScale(2, RoundingMode.HALF_UP));
        summary.put("totalQty",          totalQty);
        summary.put("totalInvoices",     invoicesSeen.size());
        summary.put("avgTicket",         avgTicket);
        summary.put("globalMargin",      globalMargin);
        summary.put("topProductByQty",   topProductByQty);
        summary.put("topProductByProfit",topProductByProfit);
        summary.put("topBranch",         topBranch);
        summary.put("topCashier",        topCashier);
        summary.put("topPayMethod",      topPayMethod);
        summary.put("peakHour",          peakHour + ":00");
        summary.put("salesByBranch",     branchSale);
        summary.put("salesByProduct",    productQty);
        summary.put("salesByPayMethod",  payMethods);
        summary.put("hourlyActivity",    hourActivity);
        return summary;
    }

    // ══════════════════════════════════════════════════════════
    // RF-30 — GET /api/reports/admin
    // Admin: todas las sedes + consolidado
    // ══════════════════════════════════════════════════════════
    @GetMapping("/admin")
    public ResponseEntity<?> adminReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Integer branchId,
            @RequestParam(required = false) Integer cashierId) {

        LocalDateTime from = startDate != null ? startDate.atStartOfDay()          : LocalDateTime.of(2000,1,1,0,0);
        LocalDateTime to   = endDate   != null ? endDate.atTime(LocalTime.MAX)     : LocalDateTime.now();

        List<Invoice> invoices = invoiceRepo.findAll().stream()
                .filter(inv -> !inv.getIssuedAt().isBefore(from) && !inv.getIssuedAt().isAfter(to))
                .filter(inv -> branchId  == null || inv.getBranch().getIdBranch().equals(branchId))
                .filter(inv -> cashierId == null || inv.getCashier().getIdUser().equals(cashierId))
                .collect(Collectors.toList());

        List<Map<String, Object>> rows    = buildProductRows(invoices);
        Map<String, Object>       summary = buildSummary(rows);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("rows",    rows);
        return ResponseEntity.ok(result);
    }

    // ══════════════════════════════════════════════════════════
    // RF-29 — GET /api/reports/cashier/{idBranch}
    // Cajero: solo su sede
    // ══════════════════════════════════════════════════════════
    @GetMapping("/cashier/{idBranch}")
    public ResponseEntity<?> cashierReport(
            @PathVariable Integer idBranch,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Integer cashierId) {

        if (!branchRepo.existsById(idBranch))
            return ResponseEntity.status(404).body("Branch not found");

        LocalDateTime from = startDate != null ? startDate.atStartOfDay()      : LocalDateTime.of(2000,1,1,0,0);
        LocalDateTime to   = endDate   != null ? endDate.atTime(LocalTime.MAX) : LocalDateTime.now();

        List<Invoice> invoices = invoiceRepo.findByBranch_IdBranch(idBranch).stream()
                .filter(inv -> !inv.getIssuedAt().isBefore(from) && !inv.getIssuedAt().isAfter(to))
                .filter(inv -> cashierId == null || inv.getCashier().getIdUser().equals(cashierId))
                .collect(Collectors.toList());

        List<Map<String, Object>> rows    = buildProductRows(invoices);
        Map<String, Object>       summary = buildSummary(rows);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("branchId",   idBranch);
        result.put("branchName", branchRepo.findById(idBranch).map(Branch::getName).orElse("—"));
        result.put("summary",    summary);
        result.put("rows",       rows);
        return ResponseEntity.ok(result);
    }

    // ══════════════════════════════════════════════════════════
    // GET /api/reports/dashboard  — KPIs globales para header
    // ══════════════════════════════════════════════════════════
    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard() {
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime now        = LocalDateTime.now();

        List<Invoice> thisMonth = invoiceRepo.findAll().stream()
                .filter(inv -> !inv.getIssuedAt().isBefore(monthStart))
                .collect(Collectors.toList());

        List<Map<String, Object>> rows    = buildProductRows(thisMonth);
        Map<String, Object>       summary = buildSummary(rows);
        summary.put("period", "current_month");
        return ResponseEntity.ok(summary);
    }
}