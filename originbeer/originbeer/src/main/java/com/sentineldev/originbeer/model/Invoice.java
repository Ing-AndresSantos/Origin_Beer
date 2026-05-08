package com.sentineldev.originbeer.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Factura interna generada al cerrar un pedido.
 * Tabla: invoice
 * Relación: 1 order_ticket → 1 invoice (UNIQUE en id_order)
 *
 * US-23 — Cierre de pedido y registro de pago
 * US-24 — Registro del método de pago (Efectivo / Débito / Crédito)
 * US-25 — Generación de factura interna
 * US-26 — Registro de sede en cada venta
 */
@Data
@Entity
@Table(name = "invoice")
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_invoice")
    private Long idInvoice;

    // ── Relación 1:1 con el pedido ────────────────────────────
    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_order", nullable = false, unique = true)
    @JsonIgnoreProperties({"table", "waiter", "notes", "openedAt", "closedAt", "createdAt", "updatedAt"})
    private OrderTicket order;

    // ── Sede donde ocurrió la venta (US-26) ───────────────────
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_branch", nullable = false)
    @JsonIgnoreProperties({"createdBy", "createdAt", "updatedAt", "address", "phone", "email"})
    private Branch branch;

    // ── Cajero que cerró el pedido (US-23) ────────────────────
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_cashier", nullable = false)
    @JsonIgnoreProperties({"password", "phone", "active", "lastAccess", "createdAt", "updatedAt"})
    private User cashier;

    // ── Método de pago utilizado (US-24) ─────────────────────
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    // ── Número de factura (INV-{branchCode}-{yyyyMMdd}-{seq}) ─
    @Column(name = "invoice_number", nullable = false, length = 40, unique = true)
    private String invoiceNumber;

    @Column(name = "subtotal", nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "total", nullable = false, precision = 14, scale = 2)
    private BigDecimal total;

    @Column(name = "amount_received", nullable = false, precision = 14, scale = 2)
    private BigDecimal amountReceived;

    // change_given es columna GENERATED en BD (amount_received - total)
    // Se mapea como no-insertable/no-updatable; se calcula aquí para el JSON
    @Column(name = "change_given", insertable = false, updatable = false, precision = 14, scale = 2)
    private BigDecimal changeGiven;

    @Column(name = "notes", length = 200)
    private String notes;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private LocalDateTime issuedAt;

    @PrePersist
    protected void onCreate() {
        if (this.issuedAt == null) this.issuedAt = LocalDateTime.now();
    }

    /**
     * Retorna el cambio calculado en Java si la BD no lo pobló aún.
     * Garantiza que el JSON siempre tenga el campo change_given.
     */
    public BigDecimal getChangeGiven() {
        if (this.changeGiven != null) return this.changeGiven;
        if (this.amountReceived != null && this.total != null)
            return this.amountReceived.subtract(this.total);
        return BigDecimal.ZERO;
    }
}