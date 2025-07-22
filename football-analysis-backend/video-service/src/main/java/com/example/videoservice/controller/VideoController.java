package com.example.videoservice.controller;

import com.example.videoservice.dto.ai.AICallbackRequest;
import com.example.videoservice.dto.VideoRegistrationRequest;
import com.example.videoservice.model.ProcessingStatus;
import com.example.videoservice.model.Video;
import com.example.videoservice.repository.VideoRepository;
import com.example.videoservice.service.VideoAnalyticsService;
import com.example.videoservice.service.VideoProcessingService;
import com.example.videoservice.service.VideoService;
import com.example.videoservice.service.CloudStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static com.example.videoservice.service.VideoProcessingService.logger;
import static jakarta.persistence.GenerationType.UUID;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:3000"},
        allowedHeaders = "*",
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class VideoController {
    @Autowired
    private final VideoAnalyticsService videoAnalyticsService;
    @Autowired
    private final VideoService videoService;
    @Autowired
    private final CloudStorageService cloudStorageService;
    @Autowired
    private final VideoProcessingService videoProcessingService;
    @Autowired
    private final VideoRepository videoRepository;
    @Autowired
    private S3Presigner s3Presigner;
    @Autowired
    private ObjectMapper objectMapper;
    @Value("${digitalocean.spaces.bucket}")
    private String bucketName;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam(value = "description", required = false) String description,
            @RequestHeader("X-User-ID") String userId) {

        log.info("📋 Direct upload for file: {} by user: {}", file.getOriginalFilename(), userId);

        try {

            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "File is empty")
                );
            }

            if (file.getSize() > 500 * 1024 * 1024) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "File size exceeds 500MB limit")
                );
            }

            String fileKey = cloudStorageService.uploadFile(file, userId);

            VideoRegistrationRequest request = new VideoRegistrationRequest();
            request.setFileKey(fileKey);
            request.setTitle(title);
            request.setDescription(description);
            request.setFileSize(file.getSize());
            request.setContentType(file.getContentType());

            Video video = videoService.registerUploadedVideo(request, userId);

            return ResponseEntity.ok(Map.of(
                    "videoId", video.getId(),
                    "status", "uploaded",
                    "message", "Video uploaded successfully",
                    "title", video.getTitle(),
                    "fileSize", video.getFileSize(),
                    "fileKey", fileKey
            ));

        } catch (Exception e) {
            log.error("❌ Upload failed: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(
                    Map.of("error", e.getMessage())
            );
        }
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerVideo(
            @RequestBody VideoRegistrationRequest request,
            @RequestHeader("X-User-ID") String userId) {

        log.info("📋 Registering video for user: {}", userId);

        try {

            if (!cloudStorageService.fileExists(request.getFileKey())) {
                return ResponseEntity.badRequest().body(
                        Map.of("error", "File not found in storage")
                );
            }

            Video video = videoService.registerUploadedVideo(request, userId);

            return ResponseEntity.ok(Map.of(
                    "videoId", video.getId(),
                    "status", "uploaded",
                    "message", "Video registered successfully",
                    "title", video.getTitle(),
                    "fileSize", video.getFileSize()
            ));

        } catch (Exception e) {
            log.error("❌ Registration failed: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(
                    Map.of("error", e.getMessage())
            );
        }
    }

    @PostMapping("/{id}/process")
    public ResponseEntity<?> processVideo(@PathVariable Long id,
                                          @RequestHeader("X-User-ID") String userId) {
        try {
            logger.info("🎬 Processing request for video: {} by user: {}", id, userId);

            Optional<Video> videoOpt = videoRepository.findByIdAndUserId(id, userId);
            if (videoOpt.isEmpty()) {
                logger.warn("❌ Video {} not found for user: {}", id, userId);
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Video not found or access denied"));
            }

            Video video = videoOpt.get();

            if (video.getProcessingStatus() == ProcessingStatus.PROCESSING) {
                logger.warn("⚠️ Video {} is already being processed", id);
                return ResponseEntity.ok(Map.of(
                        "videoId", id,
                        "status", "already_processing",
                        "message", "Video is already being processed"
                ));
            }

            if (video.getProcessingStatus() == ProcessingStatus.COMPLETED) {
                logger.warn("⚠️ Video {} is already completed", id);
                return ResponseEntity.ok(Map.of(
                        "videoId", id,
                        "status", "already_completed",
                        "message", "Video processing already completed"
                ));
            }

            videoProcessingService.startProcessing(id, userId);

            logger.info("🎬 Started processing for video: {}", id);

            return ResponseEntity.ok(Map.of(
                    "videoId", id,
                    "status", "processing",
                    "message", "Processing started successfully"
            ));

        } catch (Exception e) {
            logger.error("❌ Error starting processing for video {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to start processing", "message", e.getMessage()));
        }
    }

    @GetMapping("/{videoId}/status")
    public ResponseEntity<Map<String, Object>> getProcessingStatus(@PathVariable Long videoId,
                                                                   @RequestHeader("X-User-ID") String userId) {
        try {
            logger.info("📊 Getting processing status for video: {} by user: {}", videoId, userId);

            Optional<Video> videoOpt = videoRepository.findByIdAndUserId(videoId, userId);
            if (videoOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Video video = videoOpt.get();
            Map<String, Object> response = new HashMap<>();

            response.put("status", video.getProcessingStatusString().toLowerCase());
            response.put("progress", video.getProcessingProgress());
            response.put("jobId", video.getProcessingJobId());
            response.put("currentTask", video.getCurrentTask());
            response.put("outputKey", video.getOutputKey());

            if (video.getAnalyticsData() != null && !video.getAnalyticsData().isEmpty()) {
                try {
                    logger.info("📊 Raw analytics data from DB: {}", video.getAnalyticsData());

                    Map<String, Object> analytics = objectMapper.readValue(
                            video.getAnalyticsData(),
                            new TypeReference<Map<String, Object>>() {}
                    );
                    response.put("analytics", analytics);
                    logger.info("📊 Analytics successfully parsed and added to response for video {}", videoId);
                } catch (Exception e) {
                    logger.error("❌ Failed to parse analytics data for video {}: {}", videoId, e.getMessage());
                    logger.error("📊 Raw analytics data causing error: {}", video.getAnalyticsData());

                    try {
                        String analyticsStr = video.getAnalyticsData();
                        if (analyticsStr.startsWith("{") && !analyticsStr.startsWith("{\"")) {

                            String jsonStr = convertPythonDictToJson(analyticsStr);
                            logger.info("📊 Converted Python dict to JSON: {}", jsonStr);
                            Map<String, Object> analytics = objectMapper.readValue(jsonStr, new TypeReference<Map<String, Object>>() {});
                            response.put("analytics", analytics);
                            logger.info("📊 Analytics converted from Python dict format for video {}", videoId);
                        }
                    } catch (Exception e2) {
                        logger.error("❌ Failed to convert Python dict format for video {}: {}", videoId, e2.getMessage());

                        response.put("analytics", Map.of(
                                "team_stats", Map.of(),
                                "speed_analysis", Map.of(),
                                "video_id", videoId,
                                "processing_completed", false,
                                "error", "Failed to parse analytics data"
                        ));
                    }
                }
            } else {

                response.put("analytics", Map.of(
                        "team_stats", Map.of(),
                        "speed_analysis", Map.of(),
                        "video_id", videoId,
                        "processing_completed", false
                ));
                logger.info("📊 No analytics data available for video {}", videoId);
            }

            if (video.getProcessingError() != null && !video.getProcessingError().isEmpty()) {
                response.put("error", video.getProcessingError());
            }

            logger.info("✅ Returning status for video {}: {} ({}%)", videoId,
                    video.getProcessingStatusString().toLowerCase(), video.getProcessingProgress());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("❌ Error getting video status: {}", e.getMessage(), e);
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to get video status"));
        }
    }

    private String convertPythonDictToJson(String pythonDict) {

        return pythonDict
                .replaceAll("([a-zA-Z_][a-zA-Z0-9_]*)(\\s*)=", "\"$1\"$2:")
                .replace("True", "true")
                .replace("False", "false")
                .replace("None", "null")
                .replaceAll(":\\s*([a-zA-Z_][a-zA-Z0-9_]*)(\\s*[,}])", ": \"$1\"$2")
                .replaceAll(":\\s*([0-9]+\\.?[0-9]*)(\\s*[,}])", ": $1$2");
    }

    @GetMapping("/{videoId}/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics(
            @PathVariable Long videoId,
            @RequestHeader("X-User-ID") String userId) {

        try {
            Video video = videoService.getVideoById(videoId, userId);

            if (!video.isAiAnalysisCompleted()) {
                return ResponseEntity.ok(Map.of(
                        "processing_completed", false,
                        "message", "Analytics not yet available"
                ));
            }

            Map<String, Object> analytics = videoAnalyticsService.getAnalyticsSummary(videoId);
            return ResponseEntity.ok(analytics);

        } catch (Exception e) {
            log.error("❌ Error getting analytics for video {}: {}", videoId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{videoId}/analytics/team-stats")
    public ResponseEntity<Map<String, Object>> getTeamStatistics(
            @PathVariable Long videoId,
            @RequestHeader("X-User-ID") String userId) {

        try {
            videoService.getVideoById(videoId, userId);
            Map<String, Object> teamStats = videoAnalyticsService.getTeamStatistics(videoId);
            return ResponseEntity.ok(teamStats);

        } catch (Exception e) {
            log.error("❌ Error getting team stats for video {}: {}", videoId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{videoId}/analytics/speed-distance")
    public ResponseEntity<Map<String, Object>> getSpeedDistanceAnalysis(
            @PathVariable Long videoId,
            @RequestHeader("X-User-ID") String userId) {

        try {
            videoService.getVideoById(videoId, userId);
            Map<String, Object> speedData = videoAnalyticsService.getSpeedDistanceData(videoId);
            return ResponseEntity.ok(speedData);

        } catch (Exception e) {
            log.error("❌ Error getting speed analysis for video {}: {}", videoId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/processing-callback")
    public ResponseEntity<Map<String, Object>> processingCallback(@RequestBody Map<String, Object> callbackData) {
        try {
            logger.info("🔔 Received processing callback: {}", callbackData);

            Long videoId = Long.valueOf(callbackData.get("video_id").toString());
            String status = callbackData.get("status").toString();
            Integer progress = Integer.valueOf(callbackData.get("progress").toString());
            String message = callbackData.getOrDefault("message", "").toString();
            String outputKey = callbackData.getOrDefault("output_key", "").toString();

            Optional<Video> videoOpt = videoRepository.findById(videoId);
            if (videoOpt.isEmpty()) {
                logger.error("❌ Video not found: {}", videoId);
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Video not found"));
            }

            Video video = videoOpt.get();

            video.setProcessingStatus(ProcessingStatus.valueOf(status.toUpperCase()));
            video.setProcessingProgress(progress);
            video.setCurrentTask(message);

            if (outputKey != null && !outputKey.isEmpty()) {
                video.setOutputKey(outputKey);
            }

            Object analyticsObj = callbackData.get("analytics");
            if (analyticsObj != null) {
                try {
                    String analyticsJson;
                    if (analyticsObj instanceof String) {

                        analyticsJson = (String) analyticsObj;
                        logger.info("📊 Analytics received as string: {}", analyticsJson);
                    } else {

                        analyticsJson = objectMapper.writeValueAsString(analyticsObj);
                        logger.info("📊 Analytics converted to JSON: {}", analyticsJson);
                    }

                    video.setAnalyticsData(analyticsJson);

                    Map<String, Object> parsedAnalytics = objectMapper.readValue(analyticsJson, new TypeReference<Map<String, Object>>() {});
                    logger.info("✅ Analytics successfully stored and validated for video {}", videoId);

                } catch (Exception e) {
                    logger.error("❌ Failed to process analytics data: {}", e.getMessage(), e);

                }
            }

            if ("completed".equalsIgnoreCase(status)) {
                video.setProcessingCompletedAt(LocalDateTime.now());
                video.setCompletedAt(LocalDateTime.now());
                video.setAiAnalysisCompleted(true);
                logger.info("📊 Analytics saved for video {}", videoId);
            } else if ("failed".equalsIgnoreCase(status)) {
                String error = callbackData.getOrDefault("error", "Unknown error").toString();
                video.setProcessingError(error);
            }

            videoRepository.save(video);
            logger.info("✅ Updated video {} status to {} ({}%)", videoId, status, progress);

            return ResponseEntity.ok(Map.of("message", "Callback processed successfully"));

        } catch (Exception e) {
            logger.error("❌ Error processing callback: {}", e.getMessage(), e);
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to process callback"));
        }
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getVideos(
            @RequestHeader("X-User-ID") String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        try {
            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
            Page<Video> videos = videoService.getUserVideos(userId, pageable);

            return ResponseEntity.ok(Map.of(
                    "videos", videos.getContent(),
                    "totalElements", videos.getTotalElements(),
                    "totalPages", videos.getTotalPages(),
                    "currentPage", page
            ));

        } catch (Exception e) {
            log.error("❌ Error getting videos: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(
                    Map.of("error", e.getMessage())
            );
        }
    }

    @GetMapping("/{videoId}")
    public ResponseEntity<Map<String, Object>> getVideo(
            @PathVariable Long videoId,
            @RequestHeader("X-User-ID") String userId) {

        try {
            Video video = videoService.getVideoById(videoId, userId);

            Map<String, Object> videoData = Map.of(
                    "video", video,
                    "originalVideoUrl", cloudStorageService.getFileUrl(video.getOriginalFileKey()),
                    "processedVideoUrl", video.getProcessedFileKey() != null ?
                            cloudStorageService.getFileUrl(video.getProcessedFileKey()) : null
            );

            return ResponseEntity.ok(videoData);

        } catch (Exception e) {
            log.error("❌ Error getting video {}: {}", videoId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{videoId}/download/processed")
    public ResponseEntity<?> downloadProcessedVideo(@PathVariable Long videoId,
                                                    @RequestHeader("X-User-ID") String userId,
                                                    HttpServletRequest request) {
        try {
            if (userId == null || userId.trim().isEmpty()) {
                logger.error("❌ No user ID provided for video {} download", videoId);
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "User ID is required", "videoId", videoId));
            }

            logger.info("📥 Download request for processed video {} by user {}", videoId, userId);

            Optional<Video> videoOpt = videoRepository.findByIdAndUserId(videoId, userId);
            if (videoOpt.isEmpty()) {
                logger.warn("❌ Video {} not found for user {}", videoId, userId);
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Video not found or access denied", "videoId", videoId, "userId", userId));
            }

            Video video = videoOpt.get();
            String outputKey = video.getOutputKey();

            if (outputKey == null || outputKey.isEmpty()) {
                logger.error("❌ No processed video available for video {}", videoId);
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "No processed video available", "videoId", videoId, "status", video.getProcessingStatusString()));
            }

            logger.info("📤 Generating presigned URL for: {}", outputKey);

            String presignedUrl = generatePresignedUrl(outputKey, 3600);

            logger.info("✅ Generated presigned URL for video {}", videoId);

            return ResponseEntity.status(302)
                    .header("Location", presignedUrl)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Expose-Headers", "Location")
                    .build();

        } catch (Exception e) {
            logger.error("❌ Error downloading processed video {}: {}", videoId, e.getMessage(), e);
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to download processed video", "details", e.getMessage()));
        }
    }

    private String generatePresignedUrl(String objectKey, int expirationInSeconds) {
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofSeconds(expirationInSeconds))
                    .getObjectRequest(getObjectRequest)
                    .build();

            PresignedGetObjectRequest presignedRequest = s3Presigner.presignGetObject(presignRequest);
            String url = presignedRequest.url().toString();

            logger.info("🔗 Generated presigned URL: {}", url.substring(0, Math.min(100, url.length())) + "...");

            return url;

        } catch (Exception e) {
            logger.error("❌ Error generating presigned URL for key {}: {}", objectKey, e.getMessage());
            throw new RuntimeException("Failed to generate download URL: " + e.getMessage());
        }
    }

    @GetMapping("/{videoId}/debug")
    public ResponseEntity<Map<String, Object>> debugVideo(@PathVariable Long videoId,
                                                          @RequestHeader("X-User-ID") String userId) {
        try {
            if (userId == null || userId.trim().isEmpty()) {
                logger.error("❌ No user ID provided for debug request for video {}", videoId);
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "User ID is required"));
            }

            logger.info("🔍 Debug request for video {} by user {}", videoId, userId);

            Optional<Video> videoOpt = videoRepository.findByIdAndUserId(videoId, userId);
            if (videoOpt.isEmpty()) {
                logger.warn("❌ Video {} not found for user {}", videoId, userId);
                return ResponseEntity.status(403)
                        .body(Map.of(
                                "exists", false,
                                "videoId", videoId,
                                "message", "Video not found or access denied"
                        ));
            }

            Video video = videoOpt.get();
            boolean userMatches = userId.equals(video.getUserId());

            return ResponseEntity.ok(Map.of(
                    "exists", true,
                    "videoId", videoId,
                    "actualUserId", video.getUserId(),
                    "requestUserId", userId,
                    "userMatches", userMatches,
                    "status", video.getProcessingStatusString(),
                    "outputKey", video.getOutputKey(),
                    "hasAnalytics", video.getAnalyticsData() != null
            ));

        } catch (Exception e) {
            logger.error("❌ Error debugging video {}: {}", videoId, e.getMessage());
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Debug failed", "details", e.getMessage()));
        }
    }

    @DeleteMapping("/{videoId}")
    public ResponseEntity<?> deleteVideo(
            @PathVariable Long videoId,
            @RequestHeader("X-User-ID") String userId) {

        try {
            log.info("🗑️ DELETE request for video {} by user {}", videoId, userId);

            if (userId == null || userId.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "User ID is required"));
            }

            Optional<Video> videoOpt = videoService.findByIdAndUserId(videoId, userId);
            if (videoOpt.isEmpty()) {
                log.warn("❌ Video {} not found or doesn't belong to user {}", videoId, userId);
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Video not found or access denied"));
            }

            Video video = videoOpt.get();

            boolean deleted = videoService.deleteVideo(videoId, userId);

            if (deleted) {
                log.info("✅ Video {} deleted successfully by user {}", videoId, userId);
                return ResponseEntity.ok()
                        .body(Map.of(
                                "message", "Video deleted successfully",
                                "videoId", videoId
                        ));
            } else {
                log.error("❌ Failed to delete video {} for user {}", videoId, userId);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to delete video"));
            }

        } catch (Exception e) {
            log.error("❌ Error deleting video {} for user {}: {}", videoId, userId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Internal server error: " + e.getMessage()));
        }
    }
}