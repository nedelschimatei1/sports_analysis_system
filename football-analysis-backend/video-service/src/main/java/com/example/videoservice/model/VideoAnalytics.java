package com.example.videoservice.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "video_analytics")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VideoAnalytics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_id", nullable = false)
    private Video video;

    @Enumerated(EnumType.STRING)
    @Column(name = "analysis_type", nullable = false)
    private AnalysisType analysisType;

    @Column(name = "team1_possession_percentage")
    private Double team1PossessionPercentage;

    @Column(name = "team2_possession_percentage")
    private Double team2PossessionPercentage;

    @Column(name = "total_passes")
    private Integer totalPasses;

    @Column(name = "team1_passes")
    private Integer team1Passes;

    @Column(name = "team2_passes")
    private Integer team2Passes;

    @Column(name = "avg_player_speed")
    private Double avgPlayerSpeed;

    @Column(name = "max_player_speed")
    private Double maxPlayerSpeed;

    @Column(name = "total_distance_covered")
    private Double totalDistanceCovered;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "analysis_data", columnDefinition = "jsonb")
    private Map<String, Object> analysisData;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum AnalysisType {
        TEAM_STATISTICS,
        SPEED_ANALYSIS
    }
}