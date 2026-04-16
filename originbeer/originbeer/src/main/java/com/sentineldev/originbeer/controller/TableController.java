package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.model.Branch;
import com.sentineldev.originbeer.model.TableSeat;
import com.sentineldev.originbeer.repository.BranchRepository;
import com.sentineldev.originbeer.repository.TableSeatRepository;
import com.sentineldev.originbeer.repository.UserBranchRepository;
import com.sentineldev.originbeer.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tables")
public class TableController {

    private final TableSeatRepository  tableRepo;
    private final BranchRepository     branchRepo;
    private final UserRepository       userRepo;
    private final UserBranchRepository userBranchRepo;

    public TableController(TableSeatRepository tableRepo,
                           BranchRepository branchRepo,
                           UserRepository userRepo,
                           UserBranchRepository userBranchRepo) {
        this.tableRepo      = tableRepo;
        this.branchRepo     = branchRepo;
        this.userRepo       = userRepo;
        this.userBranchRepo = userBranchRepo;
    }

    // ── GET /api/tables?idBranch=X  (all active tables for a branch) ────────
    // Used by: ADMIN (can pass any idBranch), CASHIER/WAITER (pass their branch)
    @GetMapping
    public ResponseEntity<?> listByBranch(@RequestParam Integer idBranch) {
        if (!branchRepo.existsById(idBranch))
            return ResponseEntity.status(404).body("Branch not found");
        List<TableSeat> tables = tableRepo.findByBranch_IdBranchAndActiveTrue(idBranch);
        return ResponseEntity.ok(tables);
    }

    // ── GET /api/tables/all  (all tables, all branches — ADMIN only) ─────────
    @GetMapping("/all")
    public List<TableSeat> listAll() {
        return tableRepo.findAll();
    }

    // ── GET /api/tables/{id} ─────────────────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<?> getTable(@PathVariable Integer id) {
        return tableRepo.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body("Table not found"));
    }

    // ── GET /api/tables/user/{idUser}  → branches this user belongs to ───────
    // Frontend uses this to know which branches a waiter/cashier can see
    @GetMapping("/user/{idUser}")
    public ResponseEntity<?> getBranchesForUser(@PathVariable Integer idUser) {
        if (!userRepo.existsById(idUser))
            return ResponseEntity.status(404).body("User not found");

        List<Integer> branchIds = userBranchRepo
                .findByBranch_IdBranch(idUser)   // re-use: filter by user below
                .stream()
                .map(ub -> ub.getBranch().getIdBranch())
                .toList();

        // Correct query: find all user_branch rows where user.idUser = idUser
        List<Integer> userBranchIds = userBranchRepo.findAll()
                .stream()
                .filter(ub -> ub.getUser().getIdUser().equals(idUser))
                .map(ub -> ub.getBranch().getIdBranch())
                .toList();

        List<Branch> branches = branchRepo.findAll()
                .stream()
                .filter(b -> userBranchIds.contains(b.getIdBranch()))
                .toList();

        return ResponseEntity.ok(branches);
    }

    // ── POST /api/tables  (create) ───────────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> createTable(@RequestBody Map<String, Object> body) {
        Integer idBranch    = (Integer) body.get("idBranch");
        String  tableNumber = (String)  body.get("tableNumber");
        Integer capacity    = (Integer) body.get("capacity");

        if (idBranch == null || tableNumber == null || tableNumber.isBlank())
            return ResponseEntity.status(400).body("idBranch and tableNumber are required");

        Branch branch = branchRepo.findById(idBranch)
                .orElseThrow(() -> new RuntimeException("Branch not found"));

        // Duplicate check
        boolean exists = tableRepo.findAll().stream()
                .anyMatch(t -> t.getBranch().getIdBranch().equals(idBranch)
                        && t.getTableNumber().equalsIgnoreCase(tableNumber));
        if (exists)
            return ResponseEntity.status(409)
                    .body("Table number '" + tableNumber + "' already exists in this branch");

        TableSeat table = new TableSeat();
        table.setBranch(branch);
        table.setTableNumber(tableNumber.trim().toUpperCase());
        table.setCapacity(capacity != null ? capacity.byteValue() : (byte) 4);
        table.setActive(true);

        return ResponseEntity.status(201).body(tableRepo.save(table));
    }

    // ── PUT /api/tables/{id}  (edit) ─────────────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<?> updateTable(@PathVariable Integer id,
                                         @RequestBody Map<String, Object> body) {
        TableSeat table = tableRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Table not found"));

        if (body.containsKey("tableNumber")) {
            String newNumber = ((String) body.get("tableNumber")).trim().toUpperCase();
            // Check uniqueness within same branch (excluding itself)
            boolean conflict = tableRepo.findAll().stream()
                    .anyMatch(t -> !t.getIdTable().equals(id)
                            && t.getBranch().getIdBranch().equals(table.getBranch().getIdBranch())
                            && t.getTableNumber().equalsIgnoreCase(newNumber));
            if (conflict)
                return ResponseEntity.status(409)
                        .body("Table number '" + newNumber + "' already exists in this branch");
            table.setTableNumber(newNumber);
        }
        if (body.containsKey("capacity")) {
            table.setCapacity(((Integer) body.get("capacity")).byteValue());
        }
        if (body.containsKey("active")) {
            table.setActive((Boolean) body.get("active"));
        }

        return ResponseEntity.ok(tableRepo.save(table));
    }

    // ── DELETE /api/tables/{id}  (soft delete — sets active = false) ─────────
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTable(@PathVariable Integer id) {
        TableSeat table = tableRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Table not found"));
        table.setActive(false);
        tableRepo.save(table);
        return ResponseEntity.ok("Table #" + id + " deactivated");
    }
}