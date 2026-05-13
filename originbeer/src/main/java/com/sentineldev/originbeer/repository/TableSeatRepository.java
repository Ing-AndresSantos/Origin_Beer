package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.TableSeat;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TableSeatRepository extends JpaRepository<TableSeat, Integer> {
    List<TableSeat> findByBranch_IdBranchAndActiveTrue(Integer idBranch);
    List<TableSeat> findByBranch_IdBranch(Integer idBranch);
}