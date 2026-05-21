package com.sentineldev.originbeer.controller;

import com.sentineldev.originbeer.model.Category;
import com.sentineldev.originbeer.repository.CategoryRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository categoryRepository;

    public CategoryController(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @GetMapping
    public List<Category> listCategories() {
        return categoryRepository.findAll();
    }
}