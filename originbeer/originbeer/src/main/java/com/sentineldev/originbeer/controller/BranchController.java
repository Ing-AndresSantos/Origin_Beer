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

import java.util.*;
import java.util.stream.Collectors;

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

    // ── GET /api/branches ────────────────────────────────────
    @GetMapping
    public List<Branch> listBranches() {
        return branchRepository.findAll();
    }

    // ── GET /api/branches/{id} ───────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<?> getBranch(@PathVariable Integer id) {
        return branchRepository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body("Branch not found"));
    }

    // ── POST /api/branches ───────────────────────────────────
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

    // ── PUT /api/branches/{id} ───────────────────────────────
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

    // ── PATCH /api/branches/{id}/status ──────────────────────
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> toggleStatus(@PathVariable Integer id) {
        Branch branch = branchRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Branch not found"));
        branch.setActive(!branch.getActive());
        branchRepository.save(branch);
        return ResponseEntity.ok(branch.getActive() ? "activated" : "deactivated");
    }

    // ── GET /api/branches/{id}/users ─────────────────────────
    @GetMapping("/{id}/users")
    public ResponseEntity<?> getAssignedUsers(@PathVariable Integer id) {
        if (!branchRepository.existsById(id))
            return ResponseEntity.status(404).body("Branch not found");

        List<User> users = userBranchRepository
                .findByBranch_IdBranch(id)
                .stream()
                .map(UserBranch::getUser)
                .collect(Collectors.toList());

        return ResponseEntity.ok(users);
    }

    // ── PUT /api/branches/{id}/users ─────────────────────────
    // force=false → rejects if any user is in another branch (409)
    // force=true  → reassigns users (removes from old branch first)
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

        List<Integer> incomingIds = request.getUserIds() != null
                ? request.getUserIds()
                : Collections.emptyList();

        boolean force = Boolean.TRUE.equals(request.getForce());

        if (!force) {
            // Validate: no user can be in another branch
            List<String> conflicts = new ArrayList<>();
            for (Integer userId : incomingIds) {
                boolean inOther = userBranchRepository.findAll().stream()
                        .anyMatch(ub -> ub.getUser().getIdUser().equals(userId)
                                && !ub.getBranch().getIdBranch().equals(id));
                if (inOther) {
                    User u = userRepository.findById(userId).orElse(null);
                    String name = u != null ? u.getFirstName() + " " + u.getLastName() : "User #" + userId;
                    conflicts.add(name);
                }
            }
            if (!conflicts.isEmpty())
                return ResponseEntity.status(409)
                        .body("These users are already in another branch: "
                                + String.join(", ", conflicts)
                                + ". Check them and confirm reassignment.");
        } else {
            // Force mode: remove users from any other branch before assigning here
            for (Integer userId : incomingIds) {
                userBranchRepository.findAll().stream()
                        .filter(ub -> ub.getUser().getIdUser().equals(userId)
                                && !ub.getBranch().getIdBranch().equals(id))
                        .forEach(userBranchRepository::delete);
            }
        }

        // Additive update for this branch
        Set<Integer> currentIds = userBranchRepository.findByBranch_IdBranch(id)
                .stream()
                .map(ub -> ub.getUser().getIdUser())
                .collect(Collectors.toSet());

        Set<Integer> incomingSet = new HashSet<>(incomingIds);

        // Remove unchecked users
        userBranchRepository.findByBranch_IdBranch(id).forEach(ub -> {
            if (!incomingSet.contains(ub.getUser().getIdUser()))
                userBranchRepository.delete(ub);
        });

        // Add new users
        for (Integer userId : incomingIds) {
            if (!currentIds.contains(userId)) {
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