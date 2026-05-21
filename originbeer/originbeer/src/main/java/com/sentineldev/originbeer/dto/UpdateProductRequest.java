package com.sentineldev.originbeer.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class UpdateProductRequest {
    private Integer idCategory;
    private String name;
    private String description;
    private String unit;
    private BigDecimal purchaseCost;
    private BigDecimal salePrice;
}