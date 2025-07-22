package com.example.videoservice.repository;

import com.example.videoservice.model.Video;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {

    Page<Video> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    Optional<Video> findByIdAndUserId(Long id, String userId);

    void deleteByIdAndUserId(Long id, String userId);
}