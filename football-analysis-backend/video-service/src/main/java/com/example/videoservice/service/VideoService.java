package com.example.videoservice.service;

import com.example.videoservice.dto.VideoRegistrationRequest;
import com.example.videoservice.dto.ai.AICallbackRequest;
import com.example.videoservice.model.ProcessingStatus;
import com.example.videoservice.model.Video;
import com.example.videoservice.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class VideoService {

    private final VideoRepository videoRepository;
    private final CloudStorageService cloudStorageService;

    public Video registerUploadedVideo(VideoRegistrationRequest request, String userId) {
        log.info("📋 Registering video for user: {}", userId);

        if (request.getFileKey() == null || request.getFileKey().trim().isEmpty()) {
            throw new IllegalArgumentException("File key is required");
        }

        if (request.getTitle() == null || request.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }

        if (userId == null || userId.trim().isEmpty()) {
            throw new IllegalArgumentException("User ID is required");
        }

        Video video = new Video();
        video.setUserId(userId);
        video.setTitle(request.getTitle().trim());
        video.setDescription(request.getDescription() != null ? request.getDescription().trim() : "");

        video.setFilePath(request.getFileKey());
        video.setOriginalFileKey(request.getFileKey());

        video.setFileSize(request.getFileSize());
        video.setContentType(request.getContentType());
        video.setProcessingStatus(ProcessingStatus.UPLOADED);
        video.setProcessingProgress(0);
        video.setAiAnalysisCompleted(false);

        log.info("🔍 Setting video fields:");
        log.info("   - userId: {}", video.getUserId());
        log.info("   - title: {}", video.getTitle());
        log.info("   - filePath: {}", video.getFilePath());
        log.info("   - originalFileKey: {}", video.getOriginalFileKey());
        log.info("   - fileSize: {}", video.getFileSize());
        log.info("   - contentType: {}", video.getContentType());
        log.info("   - processingStatus: {}", video.getProcessingStatusString());

        Video savedVideo = videoRepository.save(video);
        log.info("✅ Video registered successfully with ID: {}", savedVideo.getId());

        return savedVideo;
    }

    public Video getVideoById(Long videoId, String userId) {
        return videoRepository.findByIdAndUserId(videoId, userId)
                .orElseThrow(() -> new RuntimeException("Video not found or access denied"));
    }

    public Page<Video> getUserVideos(String userId, Pageable pageable) {
        return videoRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    public void startProcessing(Long videoId, String userId) {
        Video video = getVideoById(videoId, userId);

        if (video.isProcessing()) {
            throw new RuntimeException("Video is already being processed");
        }

        video.setProcessingStatus(ProcessingStatus.PROCESSING);
        video.setProcessingProgress(0);
        video.setProcessingStartedAt(LocalDateTime.now());
        video.setProcessingError(null);

        videoRepository.save(video);

        log.info("🎬 Started processing for video: {}", videoId);
    }

    public void handleProcessingCallback(AICallbackRequest callbackRequest) {
        try {
            Long videoId = Long.parseLong(callbackRequest.getVideoId());
            Optional<Video> videoOpt = videoRepository.findById(videoId);
            if (videoOpt.isEmpty()) {
                log.error("❌ Video not found: {}", videoId);
                throw new RuntimeException("Video not found: " + videoId);
            }

            Video video = videoOpt.get();

            if (callbackRequest.getUserId() != null && !callbackRequest.getUserId().equals(video.getUserId())) {
                log.error("❌ User ID mismatch for video {}: callback user {}, video user {}",
                        videoId, callbackRequest.getUserId(), video.getUserId());
                throw new RuntimeException("User ID mismatch");
            }

            String status = callbackRequest.getStatus().toUpperCase();
            log.info("📥 Processing callback for video {} (user: {}): status={}, progress={}",
                    videoId, video.getUserId(), status, callbackRequest.getProgressSafe());

            switch (status) {
                case "COMPLETED":
                    video.setProcessingStatus(ProcessingStatus.COMPLETED);
                    video.setProcessingProgress(100);
                    video.setProcessingCompletedAt(LocalDateTime.now());
                    video.setAiAnalysisCompleted(true);
                    video.setProcessingError(null);
                    if (callbackRequest.getOutputKey() != null) {
                        video.setProcessedFileKey(callbackRequest.getOutputKey());
                        log.info("📁 Set processed file key: {}", callbackRequest.getOutputKey());
                    }
                    break;

                case "FAILED":
                    video.setProcessingStatus(ProcessingStatus.FAILED);
                    video.setProcessingError(callbackRequest.getError() != null ?
                            callbackRequest.getError() : "Processing failed");
                    log.error("❌ Video processing failed for user {}: {}", video.getUserId(), video.getProcessingError());
                    break;

                case "PROCESSING":
                    try {
                        Integer progress = callbackRequest.getProgress();
                        if (progress != null && progress >= 0 && progress <= 100) {
                            video.setProcessingProgress(progress);
                            log.info("📊 Updated progress to {}% for user {}", progress, video.getUserId());
                        }
                    } catch (Exception e) {
                        log.debug("No progress information provided in callback");
                    }
                    break;

                case "QUEUED":
                    video.setProcessingStatus(ProcessingStatus.QUEUED);
                    video.setProcessingProgress(0);
                    log.info("⏳ Video queued for processing for user {}", video.getUserId());
                    break;

                default:
                    log.warn("⚠️ Unknown processing status: {}", callbackRequest.getStatus());
                    return;
            }

            videoRepository.save(video);
            log.info("✅ Updated video {} status to {} ({}%) for user {}",
                    videoId, status, video.getProcessingProgress(), video.getUserId());

        } catch (NumberFormatException e) {
            log.error("❌ Invalid video ID in callback: {}", callbackRequest.getVideoId());
            throw new RuntimeException("Invalid video ID format", e);
        } catch (Exception e) {
            log.error("❌ Error handling callback for video {}: {}", callbackRequest.getVideoId(), e.getMessage());
            throw new RuntimeException("Failed to process callback", e);
        }
    }

    public Optional<Video> findByIdAndUserId(Long videoId, String userId) {
        return videoRepository.findByIdAndUserId(videoId, userId);
    }

    public boolean deleteVideo(Long videoId, String userId) {
        try {
            Optional<Video> videoOpt = videoRepository.findByIdAndUserId(videoId, userId);
            if (videoOpt.isEmpty()) {
                log.warn("Video {} not found for user {}", videoId, userId);
                return false;
            }

            Video video = videoOpt.get();

            try {
                if (video.getOriginalFileKey() != null) {
                    cloudStorageService.deleteFile(video.getOriginalFileKey());
                    log.info("🗑️ Deleted original file: {}", video.getOriginalFileKey());
                }

                if (video.getProcessedFileKey() != null) {
                    cloudStorageService.deleteFile(video.getProcessedFileKey());
                    log.info("🗑️ Deleted processed file: {}", video.getProcessedFileKey());
                }
            } catch (Exception e) {
                log.warn("⚠️ Failed to delete some files from storage: {}", e.getMessage());

            }

            videoRepository.deleteByIdAndUserId(videoId, userId);
            log.info("✅ Video {} deleted from database", videoId);

            return true;

        } catch (Exception e) {
            log.error("❌ Error deleting video {}: {}", videoId, e.getMessage(), e);
            return false;
        }
    }

    public ProcessingStatus getProcessingStatus(Long videoId, String userId) {
        Video video = getVideoById(videoId, userId);
        return video.getProcessingStatusEnum();
    }

    public ProcessingInfo getProcessingInfo(Long videoId, String userId) {
        Video video = getVideoById(videoId, userId);

        return ProcessingInfo.builder()
                .videoId(video.getId())
                .status(video.getProcessingStatusString())
                .progress(video.getProcessingProgress())
                .error(video.getProcessingError())
                .startedAt(video.getProcessingStartedAt())
                .completedAt(video.getProcessingCompletedAt())
                .estimatedCompletionAt(video.getEstimatedCompletionAt())
                .aiAnalysisCompleted(video.isAiAnalysisCompleted())
                .build();
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ProcessingInfo {
        private Long videoId;
        private String status;
        private Integer progress;
        private String error;
        private LocalDateTime startedAt;
        private LocalDateTime completedAt;
        private LocalDateTime estimatedCompletionAt;
        private Boolean aiAnalysisCompleted;
    }
}