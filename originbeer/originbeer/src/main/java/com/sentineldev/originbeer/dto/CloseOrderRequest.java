package com.sentineldev.originbeer.dto;

import lombok.Data;
import java.math.BigDecimal;

/**
 * Payload recibido al cerrar un pedido y registrar el pago.
 *
 * US-23 — Cierre de pedido y registro de pago
 * US-24 — Registro del método de pago
 */
@Data
public class CloseOrderRequest {

    /** ID del cajero que cierra el pedido. */
    private Integer idCashier;

    /** ID del método de pago: 1=CASH, 2=DEBIT, 3=CREDIT */
    private Integer idPaymentMethod;

    /** Monto entregado por el cliente (obligatorio para calcular cambio). */
    private BigDecimal amountReceived;

    /** Nota opcional en la factura. */
    private String notes;
}