package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.OrderTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderTicketRepository extends JpaRepository<OrderTicket, Long> {
    List<OrderTicket> findByBranch_IdBranch(Integer idBranch);
    List<OrderTicket> findByBranch_IdBranchAndStatus(Integer idBranch, OrderTicket.OrderStatus status);
    List<OrderTicket> findByStatus(OrderTicket.OrderStatus status);
}