package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.dto.AssignUsersRequest;
import com.sentineldev.originbeer.dto.CreateBranchRequest;
import com.sentineldev.originbeer.dto.UpdateBranchRequest;
import com.sentineldev.originbeer.model.Branch;
import com.sentineldev.originbeer.model.User;
import com.sentineldev.originbeer.model.UserBranch;
import com.sentineldev.originbeer.repository.BranchRepository;
import com.sentineldev.originbeer.repository.UserBranchRepository;
import com.sentineldev.originbeer.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/branches")
public class BranchController {

    private final BranchRepository     branchRepository;
    private final UserRepository       userRepository;
    private final UserBranchRepository userBranchRepository;

    public BranchController(BranchRepository branchRepository,
                            UserRepository userRepository,
                            UserBranchRepository userBranchRepository) {
        this.branchRepository     = branchRepository;
        this.userRepository       = userRepository;
        this.userBranchRepository = userBranchRepository;
    }

    // ── GET /api/sedes ───────────────────────────────────────
    @GetMapping
    public List<Branch> listBranches() {
        return branchRepository.findAll();
    }

    // ── GET /api/sedes/{id} ──────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<?> getBranch(@PathVariable Integer id) {
        return branchRepository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body("Branch not found"));
    }

    // ── POST /api/sedes ──────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> createBranch(@RequestBody CreateBranchRequest request) {

        if (request.getCode() == null || request.getCode().isBlank())
            return ResponseEntity.status(400).body("Branch code is required");
        if (request.getName() == null || request.getName().isBlank())
            return ResponseEntity.status(400).body("Branch name is required");
        if (request.getCreatedBy() == null)
            return ResponseEntity.status(400).body("Creator user ID is required");

        if (branchRepository.findByCode(request.getCode().toUpperCase()).isPresent())
            return ResponseEntity.status(409).body("A branch with that code already exists");

        User creator = userRepository.findById(request.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("Creator user not found"));

        Branch branch = new Branch();
        branch.setCode(request.getCode().toUpperCase().trim());
        branch.setName(request.getName().trim());
        branch.setAddress(request.getAddress());
        branch.setCity(request.getCity());
        branch.setPhone(request.getPhone());
        branch.setEmail(request.getEmail());
        branch.setCreatedBy(creator);
        branch.setActive(true);

        return ResponseEntity.status(201).body(branchRepository.save(branch));
    }

    // ── PUT /api/sedes/{id} ──────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<?> updateBranch(@PathVariable Integer id,
                                          @RequestBody UpdateBranchRequest request) {
        Branch branch = branchRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Branch not found"));

        if (request.getName() == null || request.getName().isBlank())
            return ResponseEntity.status(400).body("Branch name is required");

        branch.setName(request.getName().trim());
        branch.setAddress(request.getAddress());
        branch.setCity(request.getCity());
        branch.setPhone(request.getPhone());
        branch.setEmail(request.getEmail());

        return ResponseEntity.ok(branchRepository.save(branch));
    }

    // ── PATCH /api/sedes/{id}/status ─────────────────────────
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> toggleStatus(@PathVariable Integer id) {
        Branch branch = branchRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Branch not found"));

        branch.setActive(!branch.getActive());
        branchRepository.save(branch);

        return ResponseEntity.ok(branch.getActive() ? "activated" : "deactivated");
    }

    // ── GET /api/sedes/{id}/users ────────────────────────────
    @GetMapping("/{id}/users")
    public ResponseEntity<?> getAssignedUsers(@PathVariable Integer id) {
        if (!branchRepository.existsById(id))
            return ResponseEntity.status(404).body("Branch not found");

        List<User> users = userBranchRepository
                .findByBranch_IdBranch(id)
                .stream()
                .map(UserBranch::getUser)
                .toList();

        return ResponseEntity.ok(users);
    }

    // ── PUT /api/sedes/{id}/users ────────────────────────────
    // Replaces all current assignments for the branch with the new list.
    @Transactional
    @PutMapping("/{id}/users")
    public ResponseEntity<?> assignUsers(@PathVariable Integer id,
                                         @RequestBody AssignUsersRequest request) {
        Branch branch = branchRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Branch not found"));

        if (request.getAssignedBy() == null)
            return ResponseEntity.status(400).body("assignedBy is required");

        User admin = userRepository.findById(request.getAssignedBy())
                .orElseThrow(() -> new RuntimeException("Admin user not found"));

        // Remove all existing assignments for this branch
        userBranchRepository.deleteByBranch_IdBranch(id);

        // Create new assignments
        if (request.getUserIds() != null) {
            for (Integer userId : request.getUserIds()) {
                User user = userRepository.findById(userId).orElse(null);
                if (user == null || !user.getActive()) continue;

                UserBranch ub = new UserBranch();
                ub.setUser(user);
                ub.setBranch(branch);
                ub.setAssignedBy(admin);
                userBranchRepository.save(ub);
            }
        }

        return ResponseEntity.ok("Assignments updated successfully");
    }
}
