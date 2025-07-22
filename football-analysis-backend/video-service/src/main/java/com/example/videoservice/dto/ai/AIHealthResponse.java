package com.example.videoservice.dto.ai;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIHealthResponse {
    private String status;
    private String service;
    private String version;
    private Boolean redisConnected;
    private List<String> capabilities;
    private Double timestamp;
}
