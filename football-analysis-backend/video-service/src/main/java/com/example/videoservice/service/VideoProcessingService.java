package com.example.videoservice.service;

import com.example.videoservice.model.Video;
import com.example.videoservice.model.ProcessingStatus;
import com.example.videoservice.repository.VideoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.HttpClientErrorException;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class VideoProcessingService {

    public static final Logger logger = LoggerFactory.getLogger(VideoProcessingService.class);

    @Autowired
    private VideoRepository videoRepository;

    @Autowired
    private RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Value("${app.callback.base-url:http://localhost:8082}")
    private String callbackBaseUrl;

    public void startProcessing(Long videoId, String userId) {
        logger.info("🎬 Starting processing for video: {} by user: {}", videoId, userId);

        if (userId == null || userId.trim().isEmpty()) {
            logger.error("❌ User ID is required for video: {}", videoId);
            throw new IllegalArgumentException("User ID is required");
        }

        Optional<Video> videoOpt = videoRepository.findByIdAndUserId(videoId, userId);
        if (videoOpt.isEmpty()) {
            logger.error("❌ Video {} not found or access denied for user: {}", videoId, userId);
            throw new RuntimeException("Video not found or access denied");
        }

        Video video = videoOpt.get();

        try {

            video.setProcessingStatus(ProcessingStatus.PROCESSING);
            video.setProcessingProgress(0);
            video.setProcessingStartedAt(java.time.LocalDateTime.now());
            videoRepository.save(video);
            logger.info("✅ Updated video {} status to PROCESSING for user: {}", videoId, userId);

            callAiService(video);

        } catch (Exception e) {
            logger.error("❌ Error starting processing for video {} for user {}: {}", videoId, userId, e.getMessage(), e);

            video.setProcessingStatus(ProcessingStatus.FAILED);
            video.setProcessingError("Failed to start processing: " + e.getMessage());
            videoRepository.save(video);
            throw e;
        }
    }

    private void callAiService(Video video) {
        try {

            String healthUrl = aiServiceUrl + "/health";
            logger.info("🏥 Checking AI service health at: {}", healthUrl);

            try {
                ResponseEntity<Map> healthResponse = restTemplate.getForEntity(healthUrl, Map.class);
                if (!healthResponse.getStatusCode().is2xxSuccessful()) {
                    throw new RuntimeException("AI service health check failed");
                }
                logger.info("✅ AI service is healthy");
            } catch (Exception healthError) {
                logger.error("❌ AI service health check failed: {}", healthError.getMessage());
                throw new RuntimeException("AI service is not available: " + healthError.getMessage());
            }

            String url = aiServiceUrl + "/internal/process-video";

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("video_id", video.getId().toString());
            requestBody.put("video_key", video.getOriginalFileKey());
            requestBody.put("user_id", video.getUserId());

            String callbackUrl;
            if (callbackBaseUrl.contains("localhost")) {

                String hostIp = getHostMachineIp();
                callbackUrl = callbackBaseUrl.replace("localhost", hostIp) + "/api/videos/processing-callback";
            } else {
                callbackUrl = callbackBaseUrl + "/api/videos/processing-callback";
            }

            requestBody.put("callback_url", callbackUrl);
            requestBody.put("stub_mode", false);
            requestBody.put("preserve_audio", false);

            Map<String, Object> spacesConfig = new HashMap<>();
            spacesConfig.put("endpoint_url", "https://fra1.digitaloceanspaces.com");
            spacesConfig.put("region_name", "FRA1");
            spacesConfig.put("access_key_id", System.getenv("SPACES_ACCESS_KEY"));
            spacesConfig.put("secret_access_key", System.getenv("SPACES_SECRET_KEY"));
            spacesConfig.put("bucket_name", System.getenv("SPACES_BUCKET"));
            requestBody.put("spaces_config", spacesConfig);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", "application/json");

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            logger.info("🔗 Calling AI service at: {} with video_id: {}", url, video.getId());
            logger.info("📞 Callback URL: {}", callbackUrl);
            logger.debug("📋 Request payload: {}", requestBody);

            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                Map<String, Object> responseBody = response.getBody();
                logger.info("✅ AI service responded successfully: {}", responseBody);

                if (responseBody != null && responseBody.containsKey("job_id")) {
                    video.setProcessingJobId(responseBody.get("job_id").toString());
                    video.setProcessingStatus(ProcessingStatus.PROCESSING);
                    videoRepository.save(video);
                    logger.info("💾 Saved job_id: {} for video: {}", responseBody.get("job_id"), video.getId());
                }
            } else {
                throw new RuntimeException("AI service returned status: " + response.getStatusCode());
            }

        } catch (HttpClientErrorException e) {
            logger.error("❌ HTTP error calling AI service: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());

            video.setProcessingStatus(ProcessingStatus.FAILED);
            video.setProcessingError("AI service HTTP error: " + e.getStatusCode() + " - " + e.getResponseBodyAsString());
            videoRepository.save(video);

        } catch (ResourceAccessException e) {
            logger.error("❌ Cannot connect to AI service at {}: {}", aiServiceUrl, e.getMessage());

            video.setProcessingStatus(ProcessingStatus.FAILED);
            video.setProcessingError("AI service unavailable: " + e.getMessage());
            videoRepository.save(video);

        } catch (Exception e) {
            logger.error("❌ Error calling AI service: {}", e.getMessage(), e);

            video.setProcessingStatus(ProcessingStatus.FAILED);
            video.setProcessingError("AI service error: " + e.getMessage());
            videoRepository.save(video);
        }
    }

    public Map<String, Object> getProcessingStatus(Long videoId) {
        logger.info("📊 Getting processing status for video: {}", videoId);

        Optional<Video> videoOpt = videoRepository.findById(videoId);
        if (videoOpt.isEmpty()) {
            logger.error("❌ Video not found for status check: {}", videoId);
            return null;
        }

        Video video = videoOpt.get();

        Map<String, Object> status = new HashMap<>();
        status.put("videoId", video.getId());
        status.put("status", video.getProcessingStatus().toString().toLowerCase());
        status.put("progress", video.getProcessingProgress() != null ? video.getProcessingProgress() : 0);

        if (video.getProcessingError() != null) {
            status.put("error", video.getProcessingError());
        }

        if (video.getProcessingJobId() != null) {
            status.put("jobId", video.getProcessingJobId());
        }

        if (video.getProcessingStartedAt() != null) {
            status.put("startedAt", video.getProcessingStartedAt().toString());
        }

        if (video.getProcessingCompletedAt() != null) {
            status.put("completedAt", video.getProcessingCompletedAt().toString());
        }

        logger.info("📊 Status for video {}: {}", videoId, status);
        return status;
    }

    public void updateProcessingStatus(Long videoId, ProcessingStatus status, Integer progress, String error) {
        logger.info("🔄 Updating processing status for video {}: {} ({}%)", videoId, status, progress);

        Optional<Video> videoOpt = videoRepository.findById(videoId);
        if (videoOpt.isEmpty()) {
            logger.error("❌ Video not found for status update: {}", videoId);
            return;
        }

        Video video = videoOpt.get();
        video.setProcessingStatus(status);

        if (progress != null) {
            video.setProcessingProgress(progress);
        }

        if (error != null) {
            video.setProcessingError(error);
        }

        if (status == ProcessingStatus.COMPLETED) {
            video.setProcessingCompletedAt(java.time.LocalDateTime.now());
            video.setAiAnalysisCompleted(true);
        }

        videoRepository.save(video);
        logger.info("✅ Updated processing status for video: {}", videoId);
    }

    private String getHostMachineIp() {

        String hostIp = System.getenv("HOST_MACHINE_IP");
        if (hostIp != null && !hostIp.isEmpty()) {
            return hostIp;
        }

        try {
            java.net.InetAddress localHost = java.net.InetAddress.getLocalHost();
            String autoDetectedIp = localHost.getHostAddress();
            logger.info("🔍 Auto-detected host IP: {}", autoDetectedIp);

            if (!autoDetectedIp.startsWith("127.")) {
                return autoDetectedIp;
            }
        } catch (Exception e) {
            logger.error("❌ Failed to auto-detect host IP: {}", e.getMessage());
        }

        logger.warn("⚠️ Using fallback IP - please set HOST_MACHINE_IP environment variable");
        return "192.168.0.101";
    }
}