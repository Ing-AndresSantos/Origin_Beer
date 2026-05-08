package com.sentineldev.originbeer.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class CreateProductRequest {
    // 'code' eliminado: se genera automáticamente en el backend
    private Integer    idCategory;
    private String     name;
    private String     description;
    private String     unit;
    private BigDecimal purchaseCost;
    private BigDecimal salePrice;
    private Integer    createdBy;
}
