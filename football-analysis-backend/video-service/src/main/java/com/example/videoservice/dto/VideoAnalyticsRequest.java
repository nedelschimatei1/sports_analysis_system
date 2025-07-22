package com.example.videoservice.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoAnalyticsRequest {

    @NotNull(message = "Video ID is required")
    private Long videoId;

    private Double possessionPercentageTeamA;
    private Double possessionPercentageTeamB;
    private Integer passesCompletedTeamA;
    private Integer passesCompletedTeamB;
    private Integer shotsOnTargetTeamA;
    private Integer shotsOnTargetTeamB;
}
