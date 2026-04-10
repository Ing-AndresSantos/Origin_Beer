package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.model.Role;
import com.sentineldev.originbeer.repository.RoleRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/roles")
public class RoleController {

    private final RoleRepository roleRepository;

    public RoleController(RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
    }

    @GetMapping
    public List<Role> listRoles() {
        return roleRepository.findAll();
    }
}