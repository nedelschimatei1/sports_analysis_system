package com.pm.authservice.controller;

import com.pm.authservice.model.User;
import com.pm.authservice.service.AuthService;
import com.pm.authservice.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> loginRequest,
                                   HttpServletRequest request,
                                   HttpServletResponse response) {
        try {
            String email = loginRequest.get("email");
            String password = loginRequest.get("password");

            if (email == null || password == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Email and password are required"));
            }

            String ipAddress = request.getRemoteAddr();

            String location = "Unknown";

            User user = authService.authenticate(email, password, ipAddress, location);
            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid credentials"));
            }

            String token = jwtUtil.generateToken(user.getId(), user.getEmail());

            Cookie cookie = new Cookie("authToken", token);
            cookie.setHttpOnly(true);
            cookie.setSecure(false);
            cookie.setPath("/");
            cookie.setMaxAge(7 * 24 * 60 * 60);
            response.addCookie(cookie);

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("user", Map.of(
                    "id", user.getId(),
                    "email", user.getEmail(),
                    "name", user.getName(),
                    "failedLoginAttempts", user.getFailedLoginAttempts(),
                    "lastFailedIp", user.getLastFailedIp() != null ? user.getLastFailedIp() : "",
                    "lastFailedLocation", user.getLastFailedLocation() != null ? user.getLastFailedLocation() : "",
                    "lastFailedTime", user.getLastFailedTime() != null ? user.getLastFailedTime().toString() : "",
                    "lastLoginTime", user.getLastLoginTime() != null ? user.getLastLoginTime().toString() : ""
            ));
            responseData.put("message", "Login successful");
            responseData.put("token", token);

            return ResponseEntity.ok(responseData);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Login failed: " + e.getMessage()));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> registerRequest,
                                      HttpServletResponse response) {
        try {
            String name = registerRequest.get("name");
            String email = registerRequest.get("email");
            String password = registerRequest.get("password");

            if (name == null || email == null || password == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Name, email, and password are required"));
            }

            if (authService.existsByEmail(email)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "Email already exists"));
            }

            User user = authService.register(name, email, password);

            String token = jwtUtil.generateToken(user.getId(), user.getEmail());

            Cookie cookie = new Cookie("authToken", token);
            cookie.setHttpOnly(true);
            cookie.setSecure(false);
            cookie.setPath("/");
            cookie.setMaxAge(7 * 24 * 60 * 60);
            response.addCookie(cookie);

            Map<String, Object> responseData = new HashMap<>();
            responseData.put("user", Map.of(
                    "id", user.getId(),
                    "email", user.getEmail(),
                    "name", user.getName(),
                    "failedLoginAttempts", user.getFailedLoginAttempts(),
                    "lastFailedIp", user.getLastFailedIp() != null ? user.getLastFailedIp() : "",
                    "lastFailedLocation", user.getLastFailedLocation() != null ? user.getLastFailedLocation() : "",
                    "lastFailedTime", user.getLastFailedTime() != null ? user.getLastFailedTime().toString() : "",
                    "lastLoginTime", user.getLastLoginTime() != null ? user.getLastLoginTime().toString() : ""
            ));
            responseData.put("message", "Registration successful");
            responseData.put("token", token);

            return ResponseEntity.ok(responseData);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Registration failed: " + e.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(HttpServletRequest request) {
        try {
            String token = getTokenFromRequest(request);
            if (token == null || !jwtUtil.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid or missing token"));
            }

            String userId = jwtUtil.getUserIdFromToken(token);
            User user = authService.findById(userId);

            if (user == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "User not found"));
            }

            return ResponseEntity.ok(Map.of("user", Map.of(
                    "id", user.getId(),
                    "email", user.getEmail(),
                    "name", user.getName(),
                    "failedLoginAttempts", user.getFailedLoginAttempts(),
                    "lastFailedIp", user.getLastFailedIp() != null ? user.getLastFailedIp() : "",
                    "lastFailedLocation", user.getLastFailedLocation() != null ? user.getLastFailedLocation() : "",
                    "lastFailedTime", user.getLastFailedTime() != null ? user.getLastFailedTime().toString() : "",
                    "lastLoginTime", user.getLastLoginTime() != null ? user.getLastLoginTime().toString() : "",
                    "createdAt", user.getCreatedAt().toString(),
                    "updatedAt", user.getUpdatedAt().toString()
            )));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to get user: " + e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {

        Cookie cookie = new Cookie("authToken", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return ResponseEntity.ok(Map.of("message", "Logout successful"));
    }

    @GetMapping("/validate")
    public ResponseEntity<?> validateToken(HttpServletRequest request) {
        try {
            String token = getTokenFromRequest(request);
            if (token == null || !jwtUtil.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid token"));
            }

            String userId = jwtUtil.getUserIdFromToken(token);
            String email = jwtUtil.getEmailFromToken(token);

            return ResponseEntity.ok(Map.of(
                    "valid", true,
                    "userId", userId,
                    "email", email
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Token validation failed"));
        }
    }

    @PutMapping("/update-profile")
    public ResponseEntity<?> updateProfile(
            @RequestBody Map<String, String> updateRequest,
            HttpServletRequest request) {
        try {
            String token = getTokenFromRequest(request);
            if (token == null || !jwtUtil.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid or missing token"));
            }

            String userId = jwtUtil.getUserIdFromToken(token);
            User user = authService.findById(userId);

            if (user == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "User not found"));
            }

            String name = updateRequest.get("name");
            String email = updateRequest.get("email");

            if (name == null || email == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Name and email are required"));
            }

            if (!email.equals(user.getEmail()) && authService.existsByEmail(email)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "Email already exists"));
            }

            user.setName(name);
            user.setEmail(email);
            authService.save(user);

            return ResponseEntity.ok(Map.of(
                    "user", Map.of(
                            "id", user.getId(),
                            "email", user.getEmail(),
                            "name", user.getName(),
                            "failedLoginAttempts", user.getFailedLoginAttempts(),
                            "lastFailedIp", user.getLastFailedIp() != null ? user.getLastFailedIp() : "",
                            "lastFailedLocation", user.getLastFailedLocation() != null ? user.getLastFailedLocation() : "",
                            "lastFailedTime", user.getLastFailedTime() != null ? user.getLastFailedTime().toString() : "",
                            "lastLoginTime", user.getLastLoginTime() != null ? user.getLastLoginTime().toString() : ""
                    ),
                    "message", "Profile updated successfully"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update profile: " + e.getMessage()));
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @RequestBody Map<String, String> passwordRequest,
            HttpServletRequest request) {
        try {
            String currentPassword = passwordRequest.get("currentPassword");
            String newPassword = passwordRequest.get("newPassword");

            if (currentPassword == null || newPassword == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Current password and new password are required"));
            }

            String token = getTokenFromRequest(request);
            if (token == null || !jwtUtil.validateToken(token)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid or missing token"));
            }

            String userId = jwtUtil.getUserIdFromToken(token);
            User user = authService.findById(userId);

            if (user == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "User not found"));
            }

            boolean isPasswordUpdated = authService.verifyAndUpdatePassword(user, currentPassword, newPassword);
            if (!isPasswordUpdated) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Current password is incorrect"));
            }

            return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update password: " + e.getMessage()));
        }
    }

    private String getTokenFromRequest(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("authToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}