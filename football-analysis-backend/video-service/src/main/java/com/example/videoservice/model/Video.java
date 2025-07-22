package com.example.videoservice.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "videos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Video {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", updatable = false, nullable = false, length = 36)
    private String userId;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    @Column(name = "file_path", nullable = false)
    private String filePath;

    @Column(name = "original_file_key")
    private String originalFileKey;

    @Column(name = "processed_file_key")
    private String processedFileKey;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Enumerated(EnumType.STRING)
    @Column(name = "processing_status")
    @Builder.Default
    private ProcessingStatus processingStatus = ProcessingStatus.UPLOADED;

    @Column(name = "processing_progress")
    @Builder.Default
    private Integer processingProgress = 0;

    @Column(name = "processing_error")
    private String processingError;

    @Column(name = "processing_job_id")
    private String processingJobId;

    @Column(name = "ai_analysis_completed")
    @Builder.Default
    private Boolean aiAnalysisCompleted = false;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "processing_started_at")
    private LocalDateTime processingStartedAt;

    @Column(name = "processing_completed_at")
    private LocalDateTime processingCompletedAt;

    @Column(name = "estimated_completion_at")
    private LocalDateTime estimatedCompletionAt;

    @Column(name = "current_task")
    private String currentTask;

    @Column(name = "analytics_data", columnDefinition = "TEXT")
    private String analyticsData;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public boolean isAiAnalysisCompleted() {
        return Boolean.TRUE.equals(aiAnalysisCompleted);
    }

    public ProcessingStatus getProcessingStatusEnum() {
        return processingStatus != null ? processingStatus : ProcessingStatus.UPLOADED;
    }

    public String getProcessingStatusString() {
        return processingStatus != null ? processingStatus.name() : ProcessingStatus.UPLOADED.name();
    }

    public boolean isProcessing() {
        return ProcessingStatus.PROCESSING.equals(processingStatus);
    }

    public boolean isCompleted() {
        return ProcessingStatus.COMPLETED.equals(processingStatus);
    }

    public boolean isFailed() {
        return ProcessingStatus.FAILED.equals(processingStatus);
    }

    public boolean isUploaded() {
        return ProcessingStatus.UPLOADED.equals(processingStatus);
    }

    public boolean isQueued() {
        return ProcessingStatus.QUEUED.equals(processingStatus);
    }

    public String getOutputKey() {
        return this.processedFileKey;
    }

    public void setOutputKey(String outputKey) {
        this.processedFileKey = outputKey;
    }
}