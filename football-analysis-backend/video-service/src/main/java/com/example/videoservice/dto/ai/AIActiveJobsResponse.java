package com.example.videoservice.dto.ai;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIActiveJobsResponse {
    private List<Map<String, Object>> activeJobs;
    private Integer totalJobs;
    private Double timestamp;
    private String error;
}
