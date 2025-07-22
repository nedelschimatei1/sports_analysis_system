package com.example.videoservice.dto.ai;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonProperty;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIProcessingResponse {
    @JsonProperty("job_id")
    private String jobId;

    private String status;
    private String message;

    @JsonProperty("video_id")
    private String videoId;
}
