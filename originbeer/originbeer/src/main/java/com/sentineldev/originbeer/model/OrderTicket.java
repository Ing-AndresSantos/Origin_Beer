package com.sentineldev.originbeer.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "order_ticket")
public class OrderTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_order")
    private Long idOrder;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_branch", nullable = false)
    @JsonIgnoreProperties({"createdBy","createdAt","updatedAt","address","phone","email"})
    private Branch branch;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_table", nullable = false)
    private TableSeat table;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_waiter", nullable = false)
    @JsonIgnoreProperties({"password","phone","lastAccess","createdAt","updatedAt"})
    private User waiter;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private OrderStatus status;

    @Column(name = "notes", length = 300)
    private String notes;

    @Column(name = "opened_at", nullable = false, updatable = false)
    private LocalDateTime openedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public enum OrderStatus { OPEN, PAID }

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (this.openedAt  == null) this.openedAt  = now;
        if (this.createdAt == null) this.createdAt = now;
        if (this.updatedAt == null) this.updatedAt = now;
        if (this.status    == null) this.status    = OrderStatus.OPEN;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}