package com.sentineldev.originbeer.repository;

import com.sentineldev.originbeer.model.UserBranch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserBranchRepository extends JpaRepository<UserBranch, Integer> {
    List<UserBranch> findByBranch_IdBranch(Integer idBranch);
    List<UserBranch> findByUser_IdUser(Integer idUser);
    void deleteByBranch_IdBranch(Integer idBranch);
}