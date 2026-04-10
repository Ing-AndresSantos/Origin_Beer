package com.sentineldev.originbeer.dto;

import lombok.Data;

@Data
public class CreateUserRequest {
    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String phone;
    private Integer idRole;
}