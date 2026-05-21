package com.sentineldev.originbeer.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "order_detail")
public class OrderDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_detail")
    private Long idDetail;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_order", nullable = false)
    @JsonIgnoreProperties({"table","waiter","branch","notes","openedAt","closedAt","createdAt","updatedAt"})
    private OrderTicket order;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_product", nullable = false)
    @JsonIgnoreProperties({"createdBy","description","purchaseCost","createdAt","updatedAt"})
    private Product product;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "sale_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal salePrice;

    @Column(name = "purchase_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal purchaseCost;

    // subtotal es columna generada en BD — no insertable/updatable
    // Se calcula en Java para garantizar que siempre tenga valor en la respuesta JSON
    @Column(name = "subtotal", insertable = false, updatable = false, precision = 14, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "note", length = 150)
    private String note;

    @Column(name = "added_at", nullable = false, updatable = false)
    private LocalDateTime addedAt;

    @PrePersist
    protected void onCreate() {
        if (this.addedAt == null) this.addedAt = LocalDateTime.now();
    }

    // Retorna subtotal calculado en Java si la BD no lo pobló
    public BigDecimal getSubtotal() {
        if (this.subtotal != null) return this.subtotal;
        if (this.quantity != null && this.salePrice != null)
            return this.salePrice.multiply(BigDecimal.valueOf(this.quantity));
        return BigDecimal.ZERO;
    }
}