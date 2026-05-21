package com.sentineldev.originbeer.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "category")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_category")
    private Integer idCategory;

    @Column(name = "name", nullable = false, length = 60, unique = true)
    private String name;

    @Column(name = "description", length = 160)
    private String description;

    @Column(name = "active", nullable = false)
    private Boolean active;
}