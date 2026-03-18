package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.Sede;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SedeRepository extends JpaRepository<Sede, Integer> {
    long countByActivoTrue();
}