package com.example.videoservice.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VideoRegistrationRequest {
    private String fileKey;
    private String title;
    private String description;
    private Long fileSize;
    private String contentType;
}
