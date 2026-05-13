package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.PaymentMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentMethodRepository extends JpaRepository<PaymentMethod, Integer> {
    List<PaymentMethod> findByActiveTrue();
}