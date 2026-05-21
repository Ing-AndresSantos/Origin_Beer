package com.sentineldev.originbeer.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "user_branch",
        uniqueConstraints = @UniqueConstraint(columnNames = {"id_user", "id_branch"}))
public class UserBranch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_user_branch")
    private Integer idUserBranch;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_user", nullable = false)
    @JsonIgnoreProperties({"password"})
    private User user;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_branch", nullable = false)
    @JsonIgnoreProperties({"createdBy"})
    private Branch branch;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assigned_by", nullable = false)
    @JsonIgnoreProperties({"password"})
    private User assignedBy;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private LocalDateTime assignedAt;

    @PrePersist
    protected void onCreate() {
        if (this.assignedAt == null) this.assignedAt = LocalDateTime.now();
    }
}