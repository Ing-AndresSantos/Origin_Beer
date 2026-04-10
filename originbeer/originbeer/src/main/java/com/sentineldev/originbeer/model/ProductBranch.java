package com.sentineldev.originbeer.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "product_branch",
        uniqueConstraints = @UniqueConstraint(columnNames = {"id_product", "id_branch"}))
public class ProductBranch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_product_branch")
    private Integer idProductBranch;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_product", nullable = false)
    @JsonIgnoreProperties({"createdBy", "description", "createdAt", "updatedAt"})
    private Product product;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_branch", nullable = false)
    @JsonIgnoreProperties({"createdBy", "createdAt", "updatedAt", "address", "phone", "email"})
    private Branch branch;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "min_stock", nullable = false)
    private Integer minStock;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "updated_by")
    @JsonIgnoreProperties({"password", "role", "phone", "active", "lastAccess", "createdAt", "updatedAt"})
    private User updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}