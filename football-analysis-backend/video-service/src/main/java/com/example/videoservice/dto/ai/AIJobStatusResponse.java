package com.example.videoservice.dto.ai;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonProperty;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIJobStatusResponse {
    @JsonProperty("job_id")
    private String jobId;

    private String status;
    private Double progress;

    @JsonProperty("video_id")
    private String videoId;

    @JsonProperty("video_key")
    private String videoKey;

    @JsonProperty("output_key")
    private String outputKey;

    @JsonProperty("started_at")
    private Long startedAt;

    @JsonProperty("completed_at")
    private Long completedAt;

    private String error;

    @JsonProperty("estimated_completion")
    private Long estimatedCompletion;
}