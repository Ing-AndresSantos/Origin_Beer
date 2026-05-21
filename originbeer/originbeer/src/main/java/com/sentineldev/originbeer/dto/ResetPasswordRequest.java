package com.sentineldev.originbeer.dto;

import lombok.Data;

@Data
public class ResetPasswordRequest {
    private String newPassword;
}