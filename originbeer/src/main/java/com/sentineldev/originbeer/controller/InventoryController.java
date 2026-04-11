package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.dto.UpdateStockRequest;
import com.sentineldev.originbeer.model.Branch;
import com.sentineldev.originbeer.model.Product;
import com.sentineldev.originbeer.model.ProductBranch;
import com.sentineldev.originbeer.model.User;
import com.sentineldev.originbeer.repository.BranchRepository;
import com.sentineldev.originbeer.repository.ProductBranchRepository;
import com.sentineldev.originbeer.repository.ProductRepository;
import com.sentineldev.originbeer.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final ProductBranchRepository productBranchRepository;
    private final ProductRepository       productRepository;
    private final BranchRepository        branchRepository;
    private final UserRepository          userRepository;

    public InventoryController(ProductBranchRepository productBranchRepository,
                               ProductRepository productRepository,
                               BranchRepository branchRepository,
                               UserRepository userRepository) {
        this.productBranchRepository = productBranchRepository;
        this.productRepository       = productRepository;
        this.branchRepository        = branchRepository;
        this.userRepository          = userRepository;
    }

    // ── GET /api/inventory ────────────────────────────────────
    // Full consolidated inventory (all branches)
    @GetMapping
    public List<ProductBranch> listAll() {
        return productBranchRepository.findAll();
    }

    // ── GET /api/inventory/branch/{id} ───────────────────────
    // Inventory for a specific branch
    @GetMapping("/branch/{id}")
    public ResponseEntity<?> getByBranch(@PathVariable Integer id) {
        if (!branchRepository.existsById(id))
            return ResponseEntity.status(404).body("Branch not found");
        return ResponseEntity.ok(productBranchRepository.findByBranch_IdBranch(id));
    }

    // ── GET /api/inventory/product/{id} ──────────────────────
    // Stock of a product across all branches
    @GetMapping("/product/{id}")
    public ResponseEntity<?> getByProduct(@PathVariable Integer id) {
        if (!productRepository.existsById(id))
            return ResponseEntity.status(404).body("Product not found");
        return ResponseEntity.ok(productBranchRepository.findByProduct_IdProduct(id));
    }

    // ── GET /api/inventory/low-stock ─────────────────────────
    // Items at or below min_stock threshold
    @GetMapping("/low-stock")
    public List<ProductBranch> getLowStock() {
        return productBranchRepository.findAll().stream()
                .filter(pb -> pb.getQuantity() <= pb.getMinStock())
                .toList();
    }

    // ── PUT /api/inventory/{idProduct}/branch/{idBranch} ─────
    // Set or update stock for a product at a branch
    @PutMapping("/{idProduct}/branch/{idBranch}")
    public ResponseEntity<?> updateStock(@PathVariable Integer idProduct,
                                         @PathVariable Integer idBranch,
                                         @RequestBody UpdateStockRequest request) {
        if (request.getQuantity() == null || request.getQuantity() < 0)
            return ResponseEntity.status(400).body("Quantity must be 0 or greater");
        if (request.getUpdatedBy() == null)
            return ResponseEntity.status(400).body("updatedBy is required");

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
