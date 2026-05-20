package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.dto.AddDetailRequest;
import com.sentineldev.originbeer.dto.CloseOrderRequest;
import com.sentineldev.originbeer.dto.CreateOrderRequest;
import com.sentineldev.originbeer.model.*;
import com.sentineldev.originbeer.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderTicketRepository   orderRepo;
    private final OrderDetailRepository   detailRepo;
    private final TableSeatRepository     tableRepo;
    private final BranchRepository        branchRepo;
    private final UserRepository          userRepo;
    private final ProductRepository       productRepo;
    private final ProductBranchRepository pbRepo;
    private final InvoiceRepository       invoiceRepo;
    private final PaymentMethodRepository paymentRepo;

    public OrderController(OrderTicketRepository orderRepo,
                           OrderDetailRepository detailRepo,
                           TableSeatRepository tableRepo,
                           BranchRepository branchRepo,
                           UserRepository userRepo,
                           ProductRepository productRepo,
                           ProductBranchRepository pbRepo,
                           InvoiceRepository invoiceRepo,
                           PaymentMethodRepository paymentRepo) {
        this.orderRepo   = orderRepo;
        this.detailRepo  = detailRepo;
        this.tableRepo   = tableRepo;
        this.branchRepo  = branchRepo;
        this.userRepo    = userRepo;
        this.productRepo = productRepo;
        this.pbRepo      = pbRepo;
        this.invoiceRepo = invoiceRepo;
        this.paymentRepo = paymentRepo;
    }

    // ── Helper: compute total for an order ───────────────────
    private BigDecimal computeOrderTotal(Long idOrder) {
        return detailRepo.findByOrder_IdOrder(idOrder)
                .stream()
                .map(d -> d.getSalePrice().multiply(BigDecimal.valueOf(d.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // ── Helper: build enriched response with total ───────────
    private Map<String, Object> enrichOrder(OrderTicket o) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("idOrder",   o.getIdOrder());
        map.put("branch",    o.getBranch());
        map.put("table",     o.getTable());
        map.put("waiter",    o.getWaiter());
        map.put("status",    o.getStatus());
        map.put("notes",     o.getNotes());
        map.put("openedAt",  o.getOpenedAt());
        map.put("closedAt",  o.getClosedAt());
        map.put("createdAt", o.getCreatedAt());
        map.put("updatedAt", o.getUpdatedAt());
        map.put("total",     computeOrderTotal(o.getIdOrder()));
        return map;
    }

    // ══════════════════════════════════════════════════════════
    // GET /api/payment-methods  — Listar métodos de pago activos
    // US-24
    // ══════════════════════════════════════════════════════════
    @GetMapping("/payment-methods")
    public List<PaymentMethod> listPaymentMethods() {
        return paymentRepo.findByActiveTrue();
    }

    // ══════════════════════════════════════════════════════════
    // US-18 — CREATE ORDER BY TABLE
    // ══════════════════════════════════════════════════════════
    @PostMapping
    public ResponseEntity<?> createOrder(@RequestBody CreateOrderRequest req) {
        if (req.getIdBranch() == null || req.getIdTable() == null || req.getIdWaiter() == null)
            return ResponseEntity.status(400).body("idBranch, idTable and idWaiter are required");

        Branch    branch = branchRepo.findById(req.getIdBranch())
                .orElseThrow(() -> new RuntimeException("Branch not found"));
        TableSeat table  = tableRepo.findById(req.getIdTable())
                .orElseThrow(() -> new RuntimeException("Table not found"));
        User      waiter = userRepo.findById(req.getIdWaiter())
                .orElseThrow(() -> new RuntimeException("Waiter not found"));

        // Validar que la mesa no tenga órdenes abiertas CON PRODUCTOS
        boolean tableOccupied = orderRepo
                .findByBranch_IdBranchAndStatus(req.getIdBranch(), OrderTicket.OrderStatus.OPEN)
                .stream()
                .filter(o -> o.getTable().getIdTable().equals(req.getIdTable()))
                .anyMatch(o -> !detailRepo.findByOrder_IdOrder(o.getIdOrder()).isEmpty());

        if (tableOccupied)
            return ResponseEntity.status(409)
                    .body("Table " + table.getTableNumber()
                            + " already has an open order with products. Close it before creating a new one.");

        OrderTicket order = new OrderTicket();
        order.setBranch(branch);
        order.setTable(table);
        order.setWaiter(waiter);
        order.setNotes(req.getNotes());
        order.setStatus(OrderTicket.OrderStatus.OPEN);

        OrderTicket saved = orderRepo.save(order);
        return ResponseEntity.status(201).body(enrichOrder(saved));
    }

    // ══════════════════════════════════════════════════════════
    // US-19 — ADD PRODUCTS TO AN ORDER
    // Descuenta inventario inmediatamente al tomar el pedido
    // ══════════════════════════════════════════════════════════
    @PostMapping("/{id}/details")
    @Transactional
    public ResponseEntity<?> addDetail(@PathVariable Long id,
                                       @RequestBody AddDetailRequest req) {
        OrderTicket order = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() == OrderTicket.OrderStatus.PAID)
            return ResponseEntity.status(409).body("Cannot modify a PAID order");
        if (req.getIdProduct() == null || req.getQuantity() == null || req.getQuantity() <= 0)
            return ResponseEntity.status(400).body("idProduct and quantity > 0 are required");

        Product product = productRepo.findById(req.getIdProduct())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        ProductBranch pb = pbRepo
                .findByProduct_IdProductAndBranch_IdBranch(req.getIdProduct(), order.getBranch().getIdBranch())
                .orElse(null);
        if (pb == null || pb.getQuantity() < req.getQuantity())
            return ResponseEntity.status(409)
                    .body("Insufficient stock. Available: " + (pb == null ? 0 : pb.getQuantity()));

        // Descontar inventario inmediatamente (ANTES de agregar a la orden)
        pb.setQuantity(pb.getQuantity() - req.getQuantity());
        pbRepo.save(pb);

        List<OrderDetail> existing = detailRepo.findByOrder_IdOrder(id);
        Optional<OrderDetail> same = existing.stream()
                .filter(d -> d.getProduct().getIdProduct().equals(req.getIdProduct()))
                .findFirst();

        if (same.isPresent()) {
            OrderDetail line = same.get();
            line.setQuantity(line.getQuantity() + req.getQuantity());
            return ResponseEntity.ok(detailRepo.save(line));
        }

        OrderDetail detail = new OrderDetail();
        detail.setOrder(order);
        detail.setProduct(product);
        detail.setQuantity(req.getQuantity());
        detail.setSalePrice(product.getSalePrice());
        detail.setPurchaseCost(product.getPurchaseCost());
        detail.setNote(req.getNote());

        return ResponseEntity.status(201).body(detailRepo.save(detail));
    }

    // ── DELETE detail line ────────────────────────────────────
    // Restaura el inventario cuando se elimina un producto del pedido
    @DeleteMapping("/{id}/details/{idDetail}")
    @Transactional
    public ResponseEntity<?> removeDetail(@PathVariable Long id,
                                          @PathVariable Long idDetail) {
        OrderTicket order = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        if (order.getStatus() == OrderTicket.OrderStatus.PAID)
            return ResponseEntity.status(409).body("Cannot modify a PAID order");
        
        // Restaurar inventario antes de eliminar
        OrderDetail detail = detailRepo.findById(idDetail)
                .orElseThrow(() -> new RuntimeException("Detail not found"));
        
        ProductBranch pb = pbRepo
                .findByProduct_IdProductAndBranch_IdBranch(
                        detail.getProduct().getIdProduct(),
                        order.getBranch().getIdBranch())
                .orElseThrow(() -> new RuntimeException("ProductBranch not found"));
        
        pb.setQuantity(pb.getQuantity() + detail.getQuantity());
        pbRepo.save(pb);
        
        detailRepo.deleteById(idDetail);
        return ResponseEntity.ok("Detail removed and inventory restored");
    }

    // ── GET details of an order ───────────────────────────────
    @GetMapping("/{id}/details")
    public ResponseEntity<?> getDetails(@PathVariable Long id) {
        if (!orderRepo.existsById(id))
            return ResponseEntity.status(404).body("Order not found");
        return ResponseEntity.ok(detailRepo.findByOrder_IdOrder(id));
    }

    // ── DELETE order ───────────────────────────────────────────
    // Elimina una orden (solo órdenes OPEN sin pagarse)
    // Restaura el inventario de todos los productos antes de eliminar
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteOrder(@PathVariable Long id) {
        OrderTicket order = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() == OrderTicket.OrderStatus.PAID)
            return ResponseEntity.status(409).body("Cannot delete a PAID order");

        // Restaurar inventario de todos los detalles
        List<OrderDetail> details = detailRepo.findByOrder_IdOrder(id);
        for (OrderDetail detail : details) {
            ProductBranch pb = pbRepo
                    .findByProduct_IdProductAndBranch_IdBranch(
                            detail.getProduct().getIdProduct(),
                            order.getBranch().getIdBranch())
                    .orElse(null);
            if (pb != null) {
                pb.setQuantity(pb.getQuantity() + detail.getQuantity());
                pbRepo.save(pb);
            }
        }

        // Eliminar todos los detalles
        detailRepo.deleteAll(details);

        // Eliminar la orden
        orderRepo.deleteById(id);

        return ResponseEntity.ok("Order deleted successfully. Inventory restored.");
    }

    // ══════════════════════════════════════════════════════════
    // US-23 — CLOSE ORDER + REGISTER PAYMENT (Sprint 5)
    // US-24 — Payment method (CASH / DEBIT / CREDIT)
    // US-25 — Generate internal invoice
    // US-26 — Register branch on each sale
    //
    // Algoritmo Divide y Vencerás:
    //   Fase 1 → validaciones (pago, duplicado de factura)
    //   Fase 2 → cerrar orden y crear factura
    //
    // NOTA: El inventario ya fue descontado en addDetail cuando se tomó el pedido
    // ══════════════════════════════════════════════════════════
    @Transactional
    @PatchMapping("/{id}/close")
    public ResponseEntity<?> closeOrder(@PathVariable Long id,
                                        @RequestBody(required = false) CloseOrderRequest req) {
        // ── FASE 1: Validaciones ──────────────────────────────
        OrderTicket order = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() == OrderTicket.OrderStatus.PAID)
            return ResponseEntity.status(409).body("Order is already PAID");

        List<OrderDetail> details = detailRepo.findByOrder_IdOrder(id);
        if (details.isEmpty())
            return ResponseEntity.status(400).body("Cannot close an empty order");

        // Validar que no exista ya una factura para este pedido (idempotencia)
        if (invoiceRepo.existsByOrder_IdOrder(id))
            return ResponseEntity.status(409).body("An invoice already exists for this order");

        // Validar método de pago (US-24)
        if (req == null || req.getIdPaymentMethod() == null)
            return ResponseEntity.status(400).body("Payment method is required (idPaymentMethod)");

        PaymentMethod paymentMethod = paymentRepo.findById(req.getIdPaymentMethod())
                .orElseThrow(() -> new RuntimeException("Payment method not found"));

        // Validar cajero (US-23)
        if (req.getIdCashier() == null)
            return ResponseEntity.status(400).body("Cashier ID is required (idCashier)");

        User cashier = userRepo.findById(req.getIdCashier())
                .orElseThrow(() -> new RuntimeException("Cashier user not found"));

        // Calcular total del pedido
        BigDecimal orderTotal = computeOrderTotal(id);

        // Validar monto recibido (obligatorio para calcular cambio)
        BigDecimal amountReceived = req.getAmountReceived();
        if (amountReceived == null || amountReceived.compareTo(BigDecimal.ZERO) < 0)
            return ResponseEntity.status(400).body("amountReceived is required and must be >= 0");

        // Para CASH: el monto recibido debe cubrir el total
        if ("CASH".equalsIgnoreCase(paymentMethod.getName())
                && amountReceived.compareTo(orderTotal) < 0) {
            return ResponseEntity.status(400)
                    .body("Amount received ($" + amountReceived
                            + ") is less than the order total ($" + orderTotal + ")");
        }

        // ── FASE 2: Cerrar orden y crear factura ──────────────
        order.setStatus(OrderTicket.OrderStatus.PAID);
        order.setClosedAt(LocalDateTime.now());
        orderRepo.save(order);

        // ── Generar número de factura único ───────────────────
        // Formato: INV-{branchCode}-{yyyyMMdd}-{secuencia 6 dígitos}
        // La secuencia es la cantidad de facturas de la sede en el día + 1
        String branchCode = order.getBranch().getCode().replace("-", "");
        String dateStr    = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay   = startOfDay.plusDays(1).minusNanos(1);
        long todayCount = invoiceRepo.countByBranch_IdBranchAndIssuedAtBetween(
                order.getBranch().getIdBranch(), startOfDay, endOfDay);
        String invoiceNumber = String.format("INV-%s-%s-%06d",
                branchCode, dateStr, todayCount + 1);

        // ── Crear factura (US-25, US-26) ──────────────────────
        Invoice invoice = new Invoice();
        invoice.setOrder(order);
        invoice.setBranch(order.getBranch());     // US-26: sede de la venta
        invoice.setCashier(cashier);              // US-23: cajero responsable
        invoice.setPaymentMethod(paymentMethod);  // US-24: método de pago
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setSubtotal(orderTotal);
        invoice.setTotal(orderTotal);
        invoice.setAmountReceived(amountReceived);
        invoice.setNotes(req.getNotes());

        Invoice savedInvoice = invoiceRepo.save(invoice);

        // ── Respuesta con factura completa ────────────────────
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message",       "Order #" + id + " closed successfully");
        response.put("invoiceNumber",  savedInvoice.getInvoiceNumber());
        response.put("idInvoice",      savedInvoice.getIdInvoice());
        response.put("branch",         order.getBranch().getName());
        response.put("branchCode",     order.getBranch().getCode());
        response.put("table",          order.getTable().getTableNumber());
        response.put("cashier",        cashier.getFirstName() + " " + cashier.getLastName());
        response.put("paymentMethod",  paymentMethod.getName());
        response.put("subtotal",       savedInvoice.getSubtotal());
        response.put("total",          savedInvoice.getTotal());
        response.put("amountReceived", savedInvoice.getAmountReceived());
        response.put("changeGiven",    savedInvoice.getChangeGiven());
        response.put("issuedAt",       savedInvoice.getIssuedAt());
        response.put("details",        details);

        return ResponseEntity.ok(response);
    }

    // ══════════════════════════════════════════════════════════
    // GET /api/orders/{id}/invoice — Recuperar factura de un pedido
    // US-25
    // ══════════════════════════════════════════════════════════
    @GetMapping("/{id}/invoice")
    public ResponseEntity<?> getInvoice(@PathVariable Long id) {
        return invoiceRepo.findByOrder_IdOrder(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body("No invoice found for order #" + id));
    }

    // ══════════════════════════════════════════════════════════
    // US-22 — LIST ORDERS
    // ══════════════════════════════════════════════════════════
    @GetMapping
    public List<Map<String, Object>> listAll() {
        return orderRepo.findAll()
                .stream()
                .sorted(Comparator.comparing(OrderTicket::getOpenedAt).reversed())
                .map(this::enrichOrder)
                .collect(Collectors.toList());
    }

    @GetMapping("/branch/{idBranch}")
    public ResponseEntity<?> listByBranch(@PathVariable Integer idBranch,
                                          @RequestParam(required = false) String status) {
        if (!branchRepo.existsById(idBranch))
            return ResponseEntity.status(404).body("Branch not found");

        List<OrderTicket> orders;
        if (status != null) {
            try {
                OrderTicket.OrderStatus s = OrderTicket.OrderStatus.valueOf(status.toUpperCase());
                orders = orderRepo.findByBranch_IdBranchAndStatus(idBranch, s);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body("Invalid status. Use OPEN or PAID");
            }
        } else {
            orders = orderRepo.findByBranch_IdBranch(idBranch);
        }

        orders.sort(Comparator.comparing(OrderTicket::getOpenedAt).reversed());
        return ResponseEntity.ok(orders.stream().map(this::enrichOrder).collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getOrder(@PathVariable Long id) {
        return orderRepo.findById(id)
                .<ResponseEntity<?>>map(o -> ResponseEntity.ok(enrichOrder(o)))
                .orElse(ResponseEntity.status(404).body("Order not found"));
    }

    // ══════════════════════════════════════════════════════════
    // Knapsack suggest combo
    // ══════════════════════════════════════════════════════════
    @GetMapping("/suggest-combo")
    public ResponseEntity<?> suggestCombo(@RequestParam Integer idBranch,
                                          @RequestParam Integer budget) {
        if (budget == null || budget <= 0)
            return ResponseEntity.status(400).body("budget must be > 0");

        List<ProductBranch> stock = pbRepo.findByBranch_IdBranch(idBranch)
                .stream()
                .filter(pb -> pb.getQuantity() > 0 && pb.getProduct().getActive())
                .collect(Collectors.toList());

        int n = stock.size();
        int W = budget;
        int[][] dp = new int[n + 1][W + 1];

        for (int i = 1; i <= n; i++) {
            int price = stock.get(i - 1).getProduct().getSalePrice().intValue();
            for (int w = 0; w <= W; w++) {
                dp[i][w] = dp[i - 1][w];
                if (price <= w) dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - price] + price);
            }
        }

        List<Map<String, Object>> selected = new ArrayList<>();
        int w = W;
        for (int i = n; i >= 1; i--) {
            if (dp[i][w] != dp[i - 1][w]) {
                ProductBranch pb = stock.get(i - 1);
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("idProduct", pb.getProduct().getIdProduct());
                item.put("name",      pb.getProduct().getName());
                item.put("salePrice", pb.getProduct().getSalePrice());
                item.put("stock",     pb.getQuantity());
                selected.add(item);
                w -= pb.getProduct().getSalePrice().intValue();
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("budget",    budget);
        result.put("totalUsed", dp[n][W]);
        result.put("items",     selected);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/tables/{idBranch}")
    public ResponseEntity<?> getTablesByBranch(@PathVariable Integer idBranch) {
        return ResponseEntity.ok(tableRepo.findByBranch_IdBranchAndActiveTrue(idBranch));
    }
}