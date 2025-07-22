package com.example.videoservice.dto;

import com.example.videoservice.model.Video;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoResponse {

    private Long id;
    private String userId;
    private String title;
    private String description;
    private String filePath;
    private String originalFileKey;
    private String processedFileKey;
    private Long fileSize;
    private String contentType;
    private Integer durationSeconds;
    private String processingStatus;
    private Integer processingProgress;
    private String processingError;
    private Boolean aiAnalysisCompleted;
    private LocalDateTime processingStartedAt;
    private LocalDateTime processingCompletedAt;
    private LocalDateTime estimatedCompletionAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private String originalVideoUrl;
    private String processedVideoUrl;

    public static VideoResponse fromEntity(Video video) {
        return VideoResponse.builder()
                .id(video.getId())
                .userId(video.getUserId())
                .title(video.getTitle())
                .description(video.getDescription())
                .filePath(video.getFilePath())
                .originalFileKey(video.getOriginalFileKey())
                .processedFileKey(video.getProcessedFileKey())
                .fileSize(video.getFileSize())
                .contentType(video.getContentType())
                .durationSeconds(video.getDurationSeconds())
                .processingStatus(video.getProcessingStatusString())
                .processingProgress(video.getProcessingProgress())
                .processingError(video.getProcessingError())
                .aiAnalysisCompleted(video.isAiAnalysisCompleted())
                .processingStartedAt(video.getProcessingStartedAt())
                .processingCompletedAt(video.getProcessingCompletedAt())
                .estimatedCompletionAt(video.getEstimatedCompletionAt())
                .createdAt(video.getCreatedAt())
                .updatedAt(video.getUpdatedAt())
                .build();
    }

    public static VideoResponse fromEntityWithUrls(Video video, String originalUrl, String processedUrl) {
        VideoResponse response = fromEntity(video);
        response.setOriginalVideoUrl(originalUrl);
        response.setProcessedVideoUrl(processedUrl);
        return response;
    }

    public boolean isProcessingComplete() {
        return "COMPLETED".equals(processingStatus);
    }

    public boolean isProcessingFailed() {
        return "FAILED".equals(processingStatus);
    }

    public boolean isProcessing() {
        return "PROCESSING".equals(processingStatus);
    }
}