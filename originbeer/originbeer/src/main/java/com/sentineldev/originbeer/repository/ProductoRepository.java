package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.Producto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductoRepository extends JpaRepository<Producto, Integer> {
    long countByActivoTrue();
}
