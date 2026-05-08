package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByOrder_IdOrder(Long idOrder);

    List<Invoice> findByBranch_IdBranch(Integer idBranch);

    boolean existsByOrder_IdOrder(Long idOrder);

    /** Para generar número secuencial: cuántas facturas hay en la sede hoy. */
    long countByBranch_IdBranchAndIssuedAtBetween(
            Integer idBranch,
            java.time.LocalDateTime from,
            java.time.LocalDateTime to
    );
}