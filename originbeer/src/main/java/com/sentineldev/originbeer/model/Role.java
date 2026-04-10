package com.sentineldev.originbeer.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "role")
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_role")
    private Integer idRole;

    @Column(name = "name", nullable = false, length = 30)
    private String name;

    @Column(name = "description", length = 150)
    private String description;

    @Column(name = "active", nullable = false)
    private Boolean active;
}