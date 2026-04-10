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
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository    productRepository;
    private final CategoryRepository   categoryRepository;
    private final UserRepository       userRepository;

    public ProductController(ProductRepository productRepository,
                             CategoryRepository categoryRepository,
                             UserRepository userRepository) {
        this.productRepository  = productRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository     = userRepository;
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
    @PostMapping
    public ResponseEntity<?> createProduct(@RequestBody CreateProductRequest request) {
        if (request.getCode() == null || request.getCode().isBlank())
            return ResponseEntity.status(400).body("Product code is required");
        if (request.getName() == null || request.getName().isBlank())
            return ResponseEntity.status(400).body("Product name is required");
        if (request.getSalePrice() == null)
            return ResponseEntity.status(400).body("Sale price is required");
        if (request.getIdCategory() == null)
            return ResponseEntity.status(400).body("Category is required");
        if (request.getCreatedBy() == null)
            return ResponseEntity.status(400).body("Creator user ID is required");

        if (productRepository.findByCode(request.getCode().toUpperCase()).isPresent())
            return ResponseEntity.status(409).body("A product with that code already exists");

        Category category = categoryRepository.findById(request.getIdCategory())
                .orElseThrow(() -> new RuntimeException("Category not found"));

        User creator = userRepository.findById(request.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("Creator user not found"));

        Product product = new Product();
        product.setCode(request.getCode().toUpperCase().trim());
        product.setName(request.getName().trim());
        product.setDescription(request.getDescription());
        product.setUnit(request.getUnit() != null ? request.getUnit().trim() : "unit");
        product.setPurchaseCost(request.getPurchaseCost() != null ? request.getPurchaseCost() : java.math.BigDecimal.ZERO);
        product.setSalePrice(request.getSalePrice());
        product.setCategory(category);
        product.setCreatedBy(creator);
        product.setActive(true);

        return ResponseEntity.status(201).body(productRepository.save(product));
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

        product.setName(request.getName().trim());
        product.setDescription(request.getDescription());
        product.setUnit(request.getUnit() != null ? request.getUnit().trim() : product.getUnit());
        product.setPurchaseCost(request.getPurchaseCost() != null ? request.getPurchaseCost() : java.math.BigDecimal.ZERO);
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
