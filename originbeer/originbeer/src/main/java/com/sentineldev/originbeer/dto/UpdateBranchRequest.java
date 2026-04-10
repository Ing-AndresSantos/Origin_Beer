package com.sentineldev.originbeer.dto;

import lombok.Data;

@Data
public class UpdateBranchRequest {
    private String name;
    private String address;
    private String city;
    private String phone;
    private String email;
}