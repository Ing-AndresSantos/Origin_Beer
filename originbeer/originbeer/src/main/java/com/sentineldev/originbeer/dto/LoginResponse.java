package com.sentineldev.originbeer.dto;

import lombok.Data;
import lombok.AllArgsConstructor;

@Data
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private String firstName;
    private String lastName;
    private String role;
}