package com.sentineldev.originbeer.model;

import jakarta.persistence.*;
import lombok.Data;

/**
 * Catálogo de métodos de pago aceptados.
 * Tabla: payment_method
 * Datos iniciales en BD: CASH, DEBIT, CREDIT
 * US-24 — Registro del método de pago
 */
@Data
@Entity
@Table(name = "payment_method")
public class PaymentMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_payment_method")
    private Integer idPaymentMethod;

    @Column(name = "name", nullable = false, length = 30)
    private String name;

    @Column(name = "active", nullable = false)
    private Boolean active;
}