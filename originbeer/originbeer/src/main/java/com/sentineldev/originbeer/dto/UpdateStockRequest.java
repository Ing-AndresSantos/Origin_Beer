package com.sentineldev.originbeer.dto;

import lombok.Data;

@Data
public class UpdateStockRequest {
    private Integer quantity;
    private Integer minStock;
    private Integer updatedBy;
}