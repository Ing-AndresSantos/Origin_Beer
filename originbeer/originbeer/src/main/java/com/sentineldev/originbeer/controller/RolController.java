package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.model.Rol;
import com.sentineldev.originbeer.repository.RolRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/roles")
public class RolController {

    private final RolRepository rolRepository;

    public RolController(RolRepository rolRepository) {
        this.rolRepository = rolRepository;
    }

    @GetMapping
    public List<Rol> listarRoles() {
        return rolRepository.findAll();
    }
}