package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.ProductBranch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductBranchRepository extends JpaRepository<ProductBranch, Integer> {

    List<ProductBranch> findByBranch_IdBranch(Integer idBranch);

    List<ProductBranch> findByProduct_IdProduct(Integer idProduct);

    Optional<ProductBranch> findByProduct_IdProductAndBranch_IdBranch(Integer idProduct, Integer idBranch);

    @Query("SELECT pb FROM ProductBranch pb WHERE pb.quantity <= pb.minStock")
    List<ProductBranch> findLowStock();
}