package com.sentineldev.originbeer.dto;

import lombok.Data;
import java.util.List;

@Data
public class AssignUsersRequest {
    private List<Integer> userIds;
    private Integer assignedBy;  // id_user of the admin making the assignment
    private Boolean force;       // true = reassign users from other branches without error
}
