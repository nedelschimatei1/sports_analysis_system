package com.example.videoservice.repository;

import com.example.videoservice.model.Video;
import com.example.videoservice.model.VideoAnalytics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoAnalyticsRepository extends JpaRepository<VideoAnalytics, Long> {

    List<VideoAnalytics> findByVideoOrderByCreatedAtDesc(Video video);

    Optional<VideoAnalytics> findByVideoAndAnalysisType(Video video, VideoAnalytics.AnalysisType analysisType);

    List<VideoAnalytics> findByVideoAndAnalysisTypeIn(Video video, List<VideoAnalytics.AnalysisType> analysisTypes);

    boolean existsByVideoAndAnalysisType(Video video, VideoAnalytics.AnalysisType analysisType);
}