package com.sentineldev.originbeer.dto;

import lombok.Data;

@Data
public class CreateBranchRequest {
    private String code;
    private String name;
    private String address;
    private String city;
    private String phone;
    private String email;
    private Integer createdBy;  // id_user of the admin creating the branch
}