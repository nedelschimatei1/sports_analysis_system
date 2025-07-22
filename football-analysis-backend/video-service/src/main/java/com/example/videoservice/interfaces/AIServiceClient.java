package com.example.videoservice.interfaces;

import com.example.videoservice.client.AIServiceClientConfig;
import com.example.videoservice.dto.ai.*;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

@FeignClient(
        name = "football-ai-service",
        url = "${ai.service.url:http://football-ai-service:8000}",
        configuration = AIServiceClientConfig.class
)
public interface AIServiceClient {

    @GetMapping("/health")
    AIHealthResponse getHealth();

    @PostMapping("/internal/process-video")
    AIProcessingResponse processVideo(@RequestBody AIProcessingRequest request);

    @GetMapping("/internal/job/{jobId}")
    AIJobStatusResponse getJobStatus(@PathVariable("jobId") String jobId);

    @GetMapping("/internal/jobs")
    AIActiveJobsResponse getActiveJobs();
}