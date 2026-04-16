package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.OrderDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderDetailRepository extends JpaRepository<OrderDetail, Long> {
    List<OrderDetail> findByOrder_IdOrder(Long idOrder);
    void deleteByOrder_IdOrder(Long idOrder);
}