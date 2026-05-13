package com.sentineldev.originbeer.dto;

import lombok.Data;

@Data
public class CreateBranchRequest {
    // 'code' eliminado: se genera automáticamente en el backend
    private String  name;
    private String  address;
    private String  city;
    private String  phone;
    private String  email;
    private Integer createdBy;  // id_user del admin que crea la sucursal
}