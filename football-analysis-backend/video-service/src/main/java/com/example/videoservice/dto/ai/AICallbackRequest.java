package com.example.videoservice.dto.ai;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AICallbackRequest {

    private String videoId;
    private String userId;
    private String status;
    private String outputKey;
    private String error;
    private Integer progress;
    private String message;
    private Long processingTimeMs;

    private String processingStage;
    private Double confidence;
    private String analysisType;

    public boolean isCompleted() {
        return "COMPLETED".equalsIgnoreCase(status);
    }

    public boolean isFailed() {
        return "FAILED".equalsIgnoreCase(status);
    }

    public boolean isProcessing() {
        return "PROCESSING".equalsIgnoreCase(status);
    }

    public int getProgressSafe() {
        return progress != null ? progress : 0;
    }
}