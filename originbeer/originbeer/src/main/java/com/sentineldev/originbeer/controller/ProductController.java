package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.dto.CreateProductRequest;
import com.sentineldev.originbeer.dto.UpdateProductRequest;
import com.sentineldev.originbeer.model.Category;
import com.sentineldev.originbeer.model.Product;
import com.sentineldev.originbeer.model.User;
import com.sentineldev.originbeer.repository.CategoryRepository;
import com.sentineldev.originbeer.repository.ProductRepository;
import com.sentineldev.originbeer.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository  productRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository     userRepository;

    public ProductController(ProductRepository productRepository,
                             CategoryRepository categoryRepository,
                             UserRepository userRepository) {
        this.productRepository  = productRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository     = userRepository;
    }

    // ══════════════════════════════════════════════════════════
    // Genera el código de producto a partir del ID asignado.
    // Formato: PROD-001, PROD-002, PROD-003 ...
    // Se invoca después del primer save() para usar el ID real
    // (AUTO_INCREMENT); garantiza unicidad sin cálculos manuales.
    // ══════════════════════════════════════════════════════════
    private String buildProductCode(Integer id) {
        return String.format("PROD-%03d", id);
    }

    // ── GET /api/products ─────────────────────────────────────
    @GetMapping
    public List<Product> listProducts() {
        return productRepository.findAll();
    }

    // ── GET /api/products/{id} ────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<?> getProduct(@PathVariable Integer id) {
        return productRepository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body("Product not found"));
    }

    // ── POST /api/products ────────────────────────────────────
    @Transactional
    @PostMapping
    public ResponseEntity<?> createProduct(@RequestBody CreateProductRequest request) {
        // Validaciones — ya no se valida 'code' porque se genera automáticamente
        if (request.getName() == null || request.getName().isBlank())
            return ResponseEntity.status(400).body("Product name is required");
        if (request.getSalePrice() == null)
            return ResponseEntity.status(400).body("Sale price is required");
        if (request.getIdCategory() == null)
            return ResponseEntity.status(400).body("Category is required");
        if (request.getCreatedBy() == null)
            return ResponseEntity.status(400).body("Creator user ID is required");

        Category category = categoryRepository.findById(request.getIdCategory())
                .orElseThrow(() -> new RuntimeException("Category not found"));

        User creator = userRepository.findById(request.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("Creator user not found"));

        // ── Paso 1: guardar con code temporal para obtener el ID ─────
        // El code tiene restricción UNIQUE y NOT NULL; se usa un
        // placeholder único para el primer insert y se reemplaza
        // de inmediato con el code definitivo basado en el ID real.
        String tempCode = "TEMP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Product product = new Product();
        product.setCode(tempCode);
        product.setName(request.getName().trim());
        product.setDescription(request.getDescription());
        product.setUnit(request.getUnit() != null ? request.getUnit().trim() : "unit");
        product.setPurchaseCost(request.getPurchaseCost() != null
                ? request.getPurchaseCost()
                : java.math.BigDecimal.ZERO);
        product.setSalePrice(request.getSalePrice());
        product.setCategory(category);
        product.setCreatedBy(creator);
        product.setActive(true);

        // Primer save → genera el AUTO_INCREMENT id_product
        product = productRepository.save(product);

        // ── Paso 2: construir el code definitivo con el ID real ───────
        String definitiveCode = buildProductCode(product.getIdProduct());

        // Garantía defensiva de unicidad (prácticamente imposible,
        // pero protege contra estados inconsistentes en la BD).
        if (productRepository.findByCode(definitiveCode).isPresent()) {
            definitiveCode = String.format("PROD-%05d", product.getIdProduct());
        }

        product.setCode(definitiveCode);
        product = productRepository.save(product);  // segundo save → actualiza el code

        return ResponseEntity.status(201).body(product);
    }

    // ── PUT /api/products/{id} ────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable Integer id,
                                           @RequestBody UpdateProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        if (request.getName() == null || request.getName().isBlank())
            return ResponseEntity.status(400).body("Product name is required");
        if (request.getSalePrice() == null)
            return ResponseEntity.status(400).body("Sale price is required");
        if (request.getIdCategory() == null)
            return ResponseEntity.status(400).body("Category is required");

        Category category = categoryRepository.findById(request.getIdCategory())
                .orElseThrow(() -> new RuntimeException("Category not found"));

        // El CODE nunca se actualiza — es inmutable una vez asignado
        product.setName(request.getName().trim());
        product.setDescription(request.getDescription());
        product.setUnit(request.getUnit() != null ? request.getUnit().trim() : product.getUnit());
        product.setPurchaseCost(request.getPurchaseCost() != null
                ? request.getPurchaseCost()
                : java.math.BigDecimal.ZERO);
        product.setSalePrice(request.getSalePrice());
        product.setCategory(category);

        return ResponseEntity.ok(productRepository.save(product));
    }

    // ── PATCH /api/products/{id}/status ──────────────────────
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> toggleStatus(@PathVariable Integer id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        product.setActive(!product.getActive());
        productRepository.save(product);

        return ResponseEntity.ok(product.getActive() ? "activated" : "deactivated");
    }
}