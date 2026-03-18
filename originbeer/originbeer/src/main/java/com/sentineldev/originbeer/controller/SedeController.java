package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.model.Sede;
import com.sentineldev.originbeer.repository.SedeRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/sedes")
public class SedeController {

    private final SedeRepository sedeRepository;

    public SedeController(SedeRepository sedeRepository) {
        this.sedeRepository = sedeRepository;
    }

    @GetMapping
    public List<Sede> listar() {
        return sedeRepository.findAll();
    }
}