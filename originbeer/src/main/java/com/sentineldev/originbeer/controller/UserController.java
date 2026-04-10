package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.dto.ChangeRoleRequest;
import com.sentineldev.originbeer.dto.CreateUserRequest;
import com.sentineldev.originbeer.dto.ResetPasswordRequest;
import com.sentineldev.originbeer.model.Role;
import com.sentineldev.originbeer.model.User;
import com.sentineldev.originbeer.repository.RoleRepository;
import com.sentineldev.originbeer.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository,
                          RoleRepository roleRepository,
                          PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ── GET /api/users ───────────────────────────────────────
    @GetMapping
    public List<User> listUsers() {
        return userRepository.findAll();
    }

    // ── POST /api/users ──────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            return ResponseEntity.status(409).body("Email already in use");
        }

        Role role = roleRepository.findById(request.getIdRole())
                .orElseThrow(() -> new RuntimeException("Role not found"));

        User user = new User();
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setPhone(request.getPhone());
        user.setRole(role);
        user.setActive(true);

        return ResponseEntity.status(201).body(userRepository.save(user));
    }

    // ── PATCH /api/users/{id}/status ─────────────────────────
    @PatchMapping("/{id}/status")
    public ResponseEntity<?> toggleStatus(@PathVariable Integer id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setActive(!user.getActive());
        userRepository.save(user);

        return ResponseEntity.ok(user.getActive() ? "activated" : "deactivated");
    }

    // ── PATCH /api/users/{id}/role ───────────────────────────
    @PatchMapping("/{id}/role")
    public ResponseEntity<?> changeRole(@PathVariable Integer id,
                                        @RequestBody ChangeRoleRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Role role = roleRepository.findById(request.getIdRole())
                .orElseThrow(() -> new RuntimeException("Role not found"));

        user.setRole(role);
        userRepository.save(user);

        return ResponseEntity.ok("Role updated to " + role.getName());
    }

    // ── PATCH /api/users/{id}/password ───────────────────────
    @PatchMapping("/{id}/password")
    public ResponseEntity<?> resetPassword(@PathVariable Integer id,
                                           @RequestBody ResetPasswordRequest request) {
        if (request.getNewPassword() == null || request.getNewPassword().length() < 8) {
            return ResponseEntity.status(400).body("Password must be at least 8 characters");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        return ResponseEntity.ok("Password updated successfully");
    }
}