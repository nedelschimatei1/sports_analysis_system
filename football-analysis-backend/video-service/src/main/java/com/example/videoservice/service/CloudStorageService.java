package com.example.videoservice.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.UUID;

@Service
@Slf4j
public class CloudStorageService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${digitalocean.spaces.bucket}")
    private String bucketName;

    @Value("${digitalocean.spaces.cdn-endpoint:#{null}}")
    private String cdnEndpoint;

    public CloudStorageService(
            @Value("${digitalocean.spaces.access-key}") String accessKey,
            @Value("${digitalocean.spaces.secret-key}") String secretKey,
            @Value("${digitalocean.spaces.endpoint}") String endpoint,
            @Value("${digitalocean.spaces.region}") String region) {

        AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKey, secretKey);
        StaticCredentialsProvider credentialsProvider = StaticCredentialsProvider.create(credentials);

        this.s3Client = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .credentialsProvider(credentialsProvider)
                .region(Region.of(region))
                .build();

        this.s3Presigner = S3Presigner.builder()
                .endpointOverride(URI.create(endpoint))
                .credentialsProvider(credentialsProvider)
                .region(Region.of(region))
                .build();
    }

    public String uploadFile(MultipartFile file, String userId) throws IOException {
        if (userId == null || userId.trim().isEmpty()) {
            log.error("❌ User ID is required for file upload");
            throw new IllegalArgumentException("User ID is required");
        }

        try {
            String fileKey = generateFileKey(userId, file.getOriginalFilename());

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileKey)
                    .contentType(file.getContentType())
                    .contentLength(file.getSize())
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(file.getBytes()));

            log.info("✅ File uploaded successfully to Spaces: {} for user: {}", fileKey, userId);
            return fileKey;

        } catch (IOException e) {
            log.error("❌ IOException uploading file for user {}: {}", userId, e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("❌ Unexpected error uploading file for user {}: {}", userId, e.getMessage());
            throw new RuntimeException("Failed to upload file: " + e.getMessage(), e);
        }
    }

    public PresignedUploadData generatePresignedUploadUrl(String filename, String userId) {
        if (userId == null || userId.trim().isEmpty()) {
            log.error("❌ User ID is required for generating presigned URL");
            throw new IllegalArgumentException("User ID is required");
        }

        try {
            String fileKey = generateFileKey(userId, filename);

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileKey)
                    .contentType("video
    public boolean fileExists(String fileKey) {
        try {
            HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileKey)
                    .build();

            s3Client.headObject(headObjectRequest);
            log.debug("✅ File exists: {}", fileKey);
            return true;

        } catch (NoSuchKeyException e) {
            log.debug("❌ File does not exist: {}", fileKey);
            return false;
        } catch (Exception e) {
            log.error("❌ Error checking file existence {}: {}", fileKey, e.getMessage());
            return false;
        }
    }

    public void deleteFile(String fileKey) {
        try {
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileKey)
                    .build();

            s3Client.deleteObject(deleteObjectRequest);
            log.info("🗑️ File deleted from Spaces: {}", fileKey);

        } catch (Exception e) {
            log.error("❌ Error deleting file {}: {}", fileKey, e.getMessage());
            throw new RuntimeException("Failed to delete file: " + e.getMessage(), e);
        }
    }

    public String getFileUrl(String fileKey) {
        if (cdnEndpoint != null && !cdnEndpoint.trim().isEmpty()) {

            return String.format("%s/%s", cdnEndpoint.replaceAll("/$", ""), fileKey);

        } else {

            return String.format("https://%s.fra1.digitaloceanspaces.com/%s", bucketName, fileKey);

        }
    }

    public String getDirectFileUrl(String fileKey) {
        return String.format("https://%s.fra1.digitaloceanspaces.com/%s", bucketName, fileKey);
    }

    public String getCdnFileUrl(String fileKey) {
        return String.format("https://%s.fra1.cdn.digitaloceanspaces.com/%s", bucketName, fileKey);
    }

    public String getSignedFileUrl(String fileKey, Duration expiration) {
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileKey)
                    .build();

            software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest presignRequest =
                    software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest.builder()
                            .signatureDuration(expiration)
                            .getObjectRequest(getObjectRequest)
                            .build();

            software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest presignedRequest =
                    s3Presigner.presignGetObject(presignRequest);

            return presignedRequest.url().toString();

        } catch (Exception e) {
            log.error("❌ Error generating signed URL for {}: {}", fileKey, e.getMessage());
            throw new RuntimeException("Failed to generate signed URL: " + e.getMessage(), e);
        }
    }

    private String generateFileKey(String userId, String originalFilename) {
        if (userId == null || userId.trim().isEmpty()) {
            log.error("❌ User ID is required for generating file key");
            throw new IllegalArgumentException("User ID is required");
        }

        String extension = "";
        if (originalFilename != null) {
            int dotIndex = originalFilename.lastIndexOf('.');
            if (dotIndex > 0) {
                extension = originalFilename.substring(dotIndex);
            }
        }

        String timestamp = String.valueOf(System.currentTimeMillis());
        String uniqueId = UUID.randomUUID().toString().substring(0, 8);

        String fileKey = String.format("videos/%s/%s_%s%s", userId, timestamp, uniqueId, extension);
        log.info("📋 Generated file key: {}", fileKey);
        return fileKey;
    }

    public static class PresignedUploadData {
        private final String url;
        private final String fileKey;
        private final int expiresIn;

        public PresignedUploadData(String url, String fileKey, int expiresIn) {
            this.url = url;
            this.fileKey = fileKey;
            this.expiresIn = expiresIn;
        }

        public String getUrl() { return url; }
        public String getFileKey() { return fileKey; }
        public int getExpiresIn() { return expiresIn; }
    }

    public static class FileMetadata {
        private final String fileKey;
        private final Long size;
        private final String contentType;
        private final java.time.Instant lastModified;

        public FileMetadata(String fileKey, Long size, String contentType, java.time.Instant lastModified) {
            this.fileKey = fileKey;
            this.size = size;
            this.contentType = contentType;
            this.lastModified = lastModified;
        }

        public String getFileKey() { return fileKey; }
        public Long getSize() { return size; }
        public String getContentType() { return contentType; }
        public java.time.Instant getLastModified() { return lastModified; }
    }
}