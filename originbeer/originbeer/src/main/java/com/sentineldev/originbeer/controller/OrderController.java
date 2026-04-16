package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.dto.AddDetailRequest;
import com.sentineldev.originbeer.dto.CreateOrderRequest;
import com.sentineldev.originbeer.model.*;
import com.sentineldev.originbeer.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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

    public OrderController(OrderTicketRepository orderRepo,
                           OrderDetailRepository detailRepo,
                           TableSeatRepository tableRepo,
                           BranchRepository branchRepo,
                           UserRepository userRepo,
                           ProductRepository productRepo,
                           ProductBranchRepository pbRepo) {
        this.orderRepo  = orderRepo;
        this.detailRepo = detailRepo;
        this.tableRepo  = tableRepo;
        this.branchRepo = branchRepo;
        this.userRepo   = userRepo;
        this.productRepo = productRepo;
        this.pbRepo      = pbRepo;
    }

    // ═══════════════════════════════════════════════════════════
    // US-18 — CREATE ORDER BY TABLE
    // ═══════════════════════════════════════════════════════════
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

        OrderTicket order = new OrderTicket();
        order.setBranch(branch);
        order.setTable(table);
        order.setWaiter(waiter);
        order.setNotes(req.getNotes());
        order.setStatus(OrderTicket.OrderStatus.OPEN);

        return ResponseEntity.status(201).body(orderRepo.save(order));
    }

    // ═══════════════════════════════════════════════════════════
    // US-19 — ADD PRODUCTS TO AN ORDER
    //
    // ---- Estamos usando este Algoritmo: ALGORITMO ITERATIVO ----
    // Descripción: Al agregar múltiples productos a un pedido, el
    // backend recorre iterativamente la lista de detalles y calcula
    // el subtotal acumulado (running total) línea por línea.
    // En el front, la tabla de productos se construye con un bucle
    // que suma subtotales en tiempo real con cada cambio de cantidad,
    // visible en el panel derecho del modal de pedido.
    // -----------------------------------------------------------
    @PostMapping("/{id}/details")
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

        // Check stock at the branch
        ProductBranch pb = pbRepo
                .findByProduct_IdProductAndBranch_IdBranch(req.getIdProduct(), order.getBranch().getIdBranch())
                .orElse(null);
        if (pb == null || pb.getQuantity() < req.getQuantity())
            return ResponseEntity.status(409)
                    .body("Insufficient stock. Available: " + (pb == null ? 0 : pb.getQuantity()));

        // Check if product already exists in order — increase qty instead of duplicate
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
    @DeleteMapping("/{id}/details/{idDetail}")
    public ResponseEntity<?> removeDetail(@PathVariable Long id,
                                          @PathVariable Long idDetail) {
        OrderTicket order = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        if (order.getStatus() == OrderTicket.OrderStatus.PAID)
            return ResponseEntity.status(409).body("Cannot modify a PAID order");

        detailRepo.deleteById(idDetail);
        return ResponseEntity.ok("Detail removed");
    }

    // ── GET details of an order ───────────────────────────────
    @GetMapping("/{id}/details")
    public ResponseEntity<?> getDetails(@PathVariable Long id) {
        if (!orderRepo.existsById(id))
            return ResponseEntity.status(404).body("Order not found");
        return ResponseEntity.ok(detailRepo.findByOrder_IdOrder(id));
    }

    // ═══════════════════════════════════════════════════════════
    // US-20 — ORDER STATUS CONTROL (OPEN → PAID)
    // US-21 — AUTOMATIC INVENTORY DEDUCTION ON CLOSE
    //
    // ---- Estamos usando este Algoritmo: DIVIDE Y VENCERÁS -----
    // Descripción: Al cerrar un pedido, el problema se divide en
    // subproblemas independientes: (1) validar stock suficiente
    // para CADA línea, (2) descontar inventario línea a línea,
    // (3) marcar el pedido como PAID. Si cualquier subproblema falla
    // (stock insuficiente), se hace rollback de toda la transacción.
    // En el front se muestra el resultado final consolidado en el
    // panel de estado del pedido, con los ítems descontados visibles.
    // -----------------------------------------------------------
    @Transactional
    @PatchMapping("/{id}/close")
    public ResponseEntity<?> closeOrder(@PathVariable Long id) {
        OrderTicket order = orderRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() == OrderTicket.OrderStatus.PAID)
            return ResponseEntity.status(409).body("Order is already PAID");

        List<OrderDetail> details = detailRepo.findByOrder_IdOrder(id);
        if (details.isEmpty())
            return ResponseEntity.status(400).body("Cannot close an empty order");

        // ── Divide y Vencerás: phase 1 — validate all stock ──
        List<String> stockErrors = new ArrayList<>();
        for (OrderDetail line : details) {
            ProductBranch pb = pbRepo
                    .findByProduct_IdProductAndBranch_IdBranch(
                            line.getProduct().getIdProduct(),
                            order.getBranch().getIdBranch())
                    .orElse(null);
            int available = (pb == null) ? 0 : pb.getQuantity();
            if (available < line.getQuantity()) {
                stockErrors.add(line.getProduct().getName()
                        + ": need " + line.getQuantity() + ", have " + available);
            }
        }
        if (!stockErrors.isEmpty())
            return ResponseEntity.status(409)
                    .body("Insufficient stock:\n" + String.join("\n", stockErrors));

        // ── Divide y Vencerás: phase 2 — deduct inventory ────
        for (OrderDetail line : details) {
            ProductBranch pb = pbRepo
                    .findByProduct_IdProductAndBranch_IdBranch(
                            line.getProduct().getIdProduct(),
                            order.getBranch().getIdBranch())
                    .get();
            pb.setQuantity(pb.getQuantity() - line.getQuantity());
            pbRepo.save(pb);
        }

        // ── Divide y Vencerás: phase 3 — mark as PAID ────────
        order.setStatus(OrderTicket.OrderStatus.PAID);
        order.setClosedAt(LocalDateTime.now());
        orderRepo.save(order);

        return ResponseEntity.ok("Order #" + id + " closed and inventory updated");
    }

    // ═══════════════════════════════════════════════════════════
    // US-22 — LIST ORDERS BY BRANCH
    //
    // ---- Estamos usando este Algoritmo: ORDENAMIENTO (Merge Sort) -
    // Descripción: Los pedidos se retornan ordenados por fecha de
    // apertura descendente usando Comparator.comparing con reversed(),
    // que internamente aplica un algoritmo de ordenamiento estable
    // (TimSort en Java). En el front, el filtro de estado + búsqueda
    // aplica un segundo ordenamiento visual en el cliente, permitiendo
    // ver los pedidos más recientes primero y comparar tiempos.
    // -----------------------------------------------------------
    @GetMapping
    public List<OrderTicket> listAll() {
        return orderRepo.findAll()
                .stream()
                .sorted(Comparator.comparing(OrderTicket::getOpenedAt).reversed())
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

        // Sort by openedAt desc — Merge Sort (TimSort)
        orders.sort(Comparator.comparing(OrderTicket::getOpenedAt).reversed());
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getOrder(@PathVariable Long id) {
        return orderRepo.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body("Order not found"));
    }

    // ═══════════════════════════════════════════════════════════
    // ---- Estamos usando este Algoritmo: PROBLEMA DE LA MOCHILA -
    // Descripción: GET /api/orders/suggest-combo — dado un
    // presupuesto (budget) del cliente y los productos disponibles
    // en la sede, sugiere la combinación de productos que MAXIMIZA
    // el subtotal sin exceder el presupuesto (Knapsack 0/1 con DP).
    // En el front aparece como "Suggest combo" en el modal de pedido,
    // mostrando qué productos agregar para aprovechar al máximo el
    // presupuesto ingresado por el mesero.
    // -----------------------------------------------------------
    @GetMapping("/suggest-combo")
    public ResponseEntity<?> suggestCombo(
            @RequestParam Integer idBranch,
            @RequestParam Integer budget) {

        if (budget == null || budget <= 0)
            return ResponseEntity.status(400).body("budget must be > 0");

        // Only in-stock products at branch
        List<ProductBranch> stock = pbRepo.findByBranch_IdBranch(idBranch)
                .stream()
                .filter(pb -> pb.getQuantity() > 0 && pb.getProduct().getActive())
                .collect(Collectors.toList());

        int n = stock.size();
        int W = budget;

        // DP table: dp[i][w] = max revenue using first i items with capacity w
        int[][] dp = new int[n + 1][W + 1];

        for (int i = 1; i <= n; i++) {
            int price = stock.get(i - 1).getProduct().getSalePrice().intValue();
            for (int w = 0; w <= W; w++) {
                dp[i][w] = dp[i - 1][w];
                if (price <= w) {
                    dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - price] + price);
                }
            }
        }

        // Backtrack to find selected items
        List<Map<String, Object>> selected = new ArrayList<>();
        int w = W;
        for (int i = n; i >= 1; i--) {
            if (dp[i][w] != dp[i - 1][w]) {
                ProductBranch pb = stock.get(i - 1);
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("idProduct",  pb.getProduct().getIdProduct());
                item.put("name",       pb.getProduct().getName());
                item.put("salePrice",  pb.getProduct().getSalePrice());
                item.put("stock",      pb.getQuantity());
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

    // ── Tables for a branch ───────────────────────────────────
    @GetMapping("/tables/{idBranch}")
    public ResponseEntity<?> getTablesByBranch(@PathVariable Integer idBranch) {
        return ResponseEntity.ok(tableRepo.findByBranch_IdBranchAndActiveTrue(idBranch));
    }
}