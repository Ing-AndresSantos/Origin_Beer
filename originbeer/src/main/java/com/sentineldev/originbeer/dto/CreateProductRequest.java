package com.sentineldev.originbeer.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class CreateProductRequest {
    private Integer idCategory;
    private String code;
    private String name;
    private String description;
    private String unit;
    private BigDecimal purchaseCost;
    private BigDecimal salePrice;
    private Integer createdBy;
}
