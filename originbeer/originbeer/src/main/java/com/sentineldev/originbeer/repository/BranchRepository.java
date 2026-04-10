package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.Branch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BranchRepository extends JpaRepository<Branch, Integer> {
    Optional<Branch> findByCode(String code);
}
