package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.dto.UpdateStockRequest;
import com.sentineldev.originbeer.model.Branch;
import com.sentineldev.originbeer.model.Product;
import com.sentineldev.originbeer.model.ProductBranch;
import com.sentineldev.originbeer.model.User;
import com.sentineldev.originbeer.repository.BranchRepository;
import com.sentineldev.originbeer.repository.ProductBranchRepository;
import com.sentineldev.originbeer.repository.ProductRepository;
import com.sentineldev.originbeer.repository.UserBranchRepository;
import com.sentineldev.originbeer.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final ProductBranchRepository productBranchRepository;
    private final ProductRepository       productRepository;
    private final BranchRepository        branchRepository;
    private final UserRepository          userRepository;
    private final UserBranchRepository    userBranchRepository;

    public InventoryController(ProductBranchRepository productBranchRepository,
                               ProductRepository productRepository,
                               BranchRepository branchRepository,
                               UserRepository userRepository,
                               UserBranchRepository userBranchRepository) {
        this.productBranchRepository = productBranchRepository;
        this.productRepository       = productRepository;
        this.branchRepository        = branchRepository;
        this.userRepository          = userRepository;
        this.userBranchRepository    = userBranchRepository;
    }

    /**
     * Obtiene el email del usuario autenticado desde el SecurityContext
     */
    private String getAuthenticatedUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /**
     * Obtiene el rol del usuario autenticado
     */
    private String getAuthenticatedUserRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getAuthorities() != null) {
            return auth.getAuthorities().stream()
                    .findFirst()
                    .map(a -> a.getAuthority().replace("ROLE_", ""))
                    .orElse(null);
        }
        return null;
    }

    /**
     * Obtiene el ID de la sucursal del usuario si es CASHIER, o null si es INVENTORY_MANAGER
     */
    private Integer getCashierBranchId() {
        String role = getAuthenticatedUserRole();
        if (role == null || role.equals("INVENTORY_MANAGER")) {
            return null; // INVENTORY_MANAGER puede ver todas las sucursales
        }

        String email = getAuthenticatedUserEmail();
        if (email == null) return null;

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) return null;

        // Obtener la sucursal del CASHIER
        return userBranchRepository.findByUser_IdUser(user.getIdUser()).stream()
                .findFirst()
                .map(ub -> ub.getBranch().getIdBranch())
                .orElse(null);
    }

    // ── GET /api/inventory ────────────────────────────────────
    // Full consolidated inventory or filtered by branch if CASHIER
    @GetMapping
    public ResponseEntity<?> listAll() {
        Integer branchId = getCashierBranchId();
        if (branchId != null) {
            // CASHIER: solo ver su sucursal
            return ResponseEntity.ok(productBranchRepository.findByBranch_IdBranch(branchId));
        }
        // INVENTORY_MANAGER: ver todo
        return ResponseEntity.ok(productBranchRepository.findAll());
    }

    // ── GET /api/inventory/branch/{id} ───────────────────────
    // Inventory for a specific branch
    @GetMapping("/branch/{id}")
    public ResponseEntity<?> getByBranch(@PathVariable Integer id) {
        if (!branchRepository.existsById(id))
            return ResponseEntity.status(404).body("Branch not found");

        Integer cashierBranchId = getCashierBranchId();
        if (cashierBranchId != null && !cashierBranchId.equals(id)) {
            return ResponseEntity.status(403).body("You only have access to your assigned branch");
        }

        return ResponseEntity.ok(productBranchRepository.findByBranch_IdBranch(id));
    }

    // ── GET /api/inventory/product/{id} ──────────────────────
    // Stock of a product across branches (filtered by role)
    @GetMapping("/product/{id}")
    public ResponseEntity<?> getByProduct(@PathVariable Integer id) {
        if (!productRepository.existsById(id))
            return ResponseEntity.status(404).body("Product not found");

        List<ProductBranch> allProducts = productBranchRepository.findByProduct_IdProduct(id);
        Integer cashierBranchId = getCashierBranchId();

        if (cashierBranchId != null) {
            // CASHIER: solo ver su sucursal
            List<ProductBranch> filtered = allProducts.stream()
                    .filter(pb -> pb.getBranch().getIdBranch().equals(cashierBranchId))
                    .toList();
            return ResponseEntity.ok(filtered);
        }

        // INVENTORY_MANAGER: ver todo
        return ResponseEntity.ok(allProducts);
    }

    // ── GET /api/inventory/low-stock ─────────────────────────
    // Items at or below min_stock threshold (filtered by role)
    @GetMapping("/low-stock")
    public ResponseEntity<?> getLowStock() {
        Integer cashierBranchId = getCashierBranchId();
        List<ProductBranch> allLowStock = productBranchRepository.findAll().stream()
                .filter(pb -> pb.getQuantity() <= pb.getMinStock())
                .toList();

        if (cashierBranchId != null) {
            // CASHIER: solo ver su sucursal
            List<ProductBranch> filtered = allLowStock.stream()
                    .filter(pb -> pb.getBranch().getIdBranch().equals(cashierBranchId))
                    .toList();
            return ResponseEntity.ok(filtered);
        }

        // INVENTORY_MANAGER: ver todo
        return ResponseEntity.ok(allLowStock);
    }

    // ── PUT /api/inventory/{idProduct}/branch/{idBranch} ─────
    // Set or update stock for a product at a branch
    @PutMapping("/{idProduct}/branch/{idBranch}")
    @PreAuthorize("hasAnyRole('INVENTORY_MANAGER', 'CASHIER')")
    public ResponseEntity<?> updateStock(@PathVariable Integer idProduct,
                                         @PathVariable Integer idBranch,
                                         @RequestBody UpdateStockRequest request) {
        if (request.getQuantity() == null || request.getQuantity() < 0)
            return ResponseEntity.status(400).body("Quantity must be 0 or greater");
        if (request.getUpdatedBy() == null)
            return ResponseEntity.status(400).body("updatedBy is required");

        // Validar permisos: CASHIER solo puede editar su sucursal
        Integer cashierBranchId = getCashierBranchId();
        if (cashierBranchId != null && !cashierBranchId.equals(idBranch)) {
            return ResponseEntity.status(403)
                    .body("You only have access to your assigned branch");
        }

        Product product = productRepository.findById(idProduct)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        Branch branch = branchRepository.findById(idBranch)
                .orElseThrow(() -> new RuntimeException("Branch not found"));
        User editor = userRepository.findById(request.getUpdatedBy())
                .orElseThrow(() -> new RuntimeException("User not found"));

        ProductBranch pb = productBranchRepository
                .findByProduct_IdProductAndBranch_IdBranch(idProduct, idBranch)
                .orElse(new ProductBranch());

        pb.setProduct(product);
        pb.setBranch(branch);
        pb.setQuantity(request.getQuantity());
        pb.setMinStock(request.getMinStock() != null ? request.getMinStock() : 5);
        pb.setUpdatedBy(editor);

        return ResponseEntity.ok(productBranchRepository.save(pb));
    }
}
