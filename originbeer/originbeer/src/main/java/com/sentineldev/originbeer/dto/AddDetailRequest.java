package com.sentineldev.originbeer.dto;

import lombok.Data;

@Data
public class AddDetailRequest {
    private Integer idProduct;
    private Integer quantity;
    private String  note;
}