package com.example.videoservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoAnalyticsResponse {
    private Long id;
    private Long videoId;
    private Double possessionPercentageTeamA;
    private Double possessionPercentageTeamB;
    private Integer passesCompletedTeamA;
    private Integer passesCompletedTeamB;
    private Integer shotsOnTargetTeamA;
    private Integer shotsOnTargetTeamB;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
