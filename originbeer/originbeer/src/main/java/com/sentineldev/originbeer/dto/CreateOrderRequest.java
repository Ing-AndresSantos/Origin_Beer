package com.sentineldev.originbeer.dto;

import lombok.Data;

@Data
public class CreateOrderRequest {
    private Integer idBranch;
    private Integer idTable;
    private Integer idWaiter;
    private String  notes;
}