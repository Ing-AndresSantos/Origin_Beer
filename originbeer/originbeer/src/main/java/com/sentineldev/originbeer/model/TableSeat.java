package com.sentineldev.originbeer.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "table_seat",
        uniqueConstraints = @UniqueConstraint(columnNames = {"id_branch", "table_number"}))
public class TableSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_table")
    private Integer idTable;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_branch", nullable = false)
    @JsonIgnoreProperties({"createdBy","createdAt","updatedAt","address","phone","email","active"})
    private Branch branch;

    @Column(name = "table_number", nullable = false, length = 10)
    private String tableNumber;

    @Column(name = "capacity", nullable = false, columnDefinition = "TINYINT")
    private Byte capacity;

    @Column(name = "active", nullable = false)
    private Boolean active;

    @PrePersist
    protected void onCreate() {
        if (this.active   == null) this.active   = true;
        if (this.capacity == null) this.capacity = (byte) 4;
    }
}