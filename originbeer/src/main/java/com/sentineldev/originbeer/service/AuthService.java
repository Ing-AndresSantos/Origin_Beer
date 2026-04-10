package com.sentineldev.originbeer.service;

import com.sentineldev.originbeer.dto.LoginRequest;
import com.sentineldev.originbeer.dto.LoginResponse;
import com.sentineldev.originbeer.model.User;
import com.sentineldev.originbeer.repository.UserRepository;
import com.sentineldev.originbeer.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.getActive()) {
            throw new RuntimeException(
                    "Your account has been deactivated. Please contact your establishment administrator to regain access."
            );
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Incorrect password");
        }

        user.setLastAccess(LocalDateTime.now());
        userRepository.save(user);

        String token = jwtService.generateToken(
                user.getEmail(),
                user.getRole().getName()
        );

        return new LoginResponse(
                user.getIdUser(),
                token,
                user.getFirstName(),
                user.getLastName(),
                user.getRole().getName()
        );
    }
}