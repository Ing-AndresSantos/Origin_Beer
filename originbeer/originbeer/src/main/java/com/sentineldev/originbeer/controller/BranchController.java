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

    // ══════════════════════════════════════════════════════════
    // Genera el código de sucursal a partir del ID asignado.
    // Formato: BR-001, BR-002, BR-003 ...
    // Se usa después del primer save() para obtener el ID real
    // (AUTO_INCREMENT) y nunca hay riesgo de duplicados.
    // ══════════════════════════════════════════════════════════
    private String buildBranchCode(Integer id) {
        return String.format("BR-%03d", id);
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
    @Transactional
    @PostMapping
    public ResponseEntity<?> createBranch(@RequestBody CreateBranchRequest request) {
        // Validaciones — ya no se valida 'code' porque se genera automáticamente
        if (request.getName() == null || request.getName().isBlank())
            return ResponseEntity.status(400).body("Branch name is required");
        if (request.getCreatedBy() == null)
            return ResponseEntity.status(400).body("Creator user ID is required");

        User creator = userRepository.findById(request.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("Creator user not found"));

        // ── Paso 1: guardar con un code temporal para obtener el ID ──
        // El code tiene restricción UNIQUE y NOT NULL, por lo que usamos
        // un placeholder único basado en UUID para el primer insert.
        // Inmediatamente después lo reemplazamos con el code definitivo.
        String tempCode = "TEMP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Branch branch = new Branch();
        branch.setCode(tempCode);
        branch.setName(request.getName().trim());
        branch.setAddress(request.getAddress());
        branch.setCity(request.getCity());
        branch.setPhone(request.getPhone());
        branch.setEmail(request.getEmail());
        branch.setCreatedBy(creator);
        branch.setActive(true);

        // Primer save → genera el AUTO_INCREMENT id_branch
        branch = branchRepository.save(branch);

        // ── Paso 2: construir el code definitivo con el ID real ───────
        String definitiveCode = buildBranchCode(branch.getIdBranch());

        // Garantía adicional de unicidad (muy improbable pero defensivo)
        if (branchRepository.findByCode(definitiveCode).isPresent()) {
            // Si por alguna razón ya existe, usar el id como sufijo extendido
            definitiveCode = String.format("BR-%05d", branch.getIdBranch());
        }

        branch.setCode(definitiveCode);
        branch = branchRepository.save(branch);   // segundo save → actualiza el code

        return ResponseEntity.status(201).body(branch);
    }

    // ── PUT /api/branches/{id} ───────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<?> updateBranch(@PathVariable Integer id,
                                          @RequestBody UpdateBranchRequest request) {
        Branch branch = branchRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Branch not found"));

        if (request.getName() == null || request.getName().isBlank())
            return ResponseEntity.status(400).body("Branch name is required");

        // El CODE nunca se actualiza — es inmutable una vez asignado
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
            for (Integer userId : incomingIds) {
                userBranchRepository.findAll().stream()
                        .filter(ub -> ub.getUser().getIdUser().equals(userId)
                                && !ub.getBranch().getIdBranch().equals(id))
                        .forEach(userBranchRepository::delete);
            }
        }

        Set<Integer> currentIds = userBranchRepository.findByBranch_IdBranch(id)
                .stream()
                .map(ub -> ub.getUser().getIdUser())
                .collect(Collectors.toSet());

        Set<Integer> incomingSet = new HashSet<>(incomingIds);

        userBranchRepository.findByBranch_IdBranch(id).forEach(ub -> {
            if (!incomingSet.contains(ub.getUser().getIdUser()))
                userBranchRepository.delete(ub);
        });

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