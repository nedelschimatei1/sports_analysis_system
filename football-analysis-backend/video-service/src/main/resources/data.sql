-- Enhanced Video table
CREATE TABLE IF NOT EXISTS "videos" (
                        id BIGSERIAL PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        title VARCHAR(500),
                        description TEXT,
                        original_file_key VARCHAR(500) NOT NULL,
                        processed_file_key VARCHAR(500),
                        file_size BIGINT,
                        duration_seconds INTEGER,
                        processing_status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',
                        processing_progress INTEGER DEFAULT 0,
                        processing_job_id VARCHAR(255),
                        ai_analysis_completed BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
);

-- Analytics table with JSON support
CREATE TABLE IF NOT EXISTS "video_analytics" (
                                 id BIGSERIAL PRIMARY KEY,
                                 video_id BIGINT REFERENCES videos(id) ON DELETE CASCADE,
                                 analysis_type VARCHAR(100) NOT NULL,
                                 team1_possession_percentage DECIMAL(5,2),
                                 team2_possession_percentage DECIMAL(5,2),
                                 total_passes INTEGER,
                                 avg_player_speed DECIMAL(8,2),
                                 max_player_speed DECIMAL(8,2),
                                 analysis_data JSONB, -- For flexible analytics storage
                                 created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE videos
    ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_task VARCHAR(255),
    ADD COLUMN IF NOT EXISTS analytics_data TEXT,
    ADD COLUMN IF NOT EXISTS output_key VARCHAR(500);
-- CREATE INDEX idx_video_analytics_video_id ON video_analytics(video_id);
-- CREATE INDEX idx_video_analytics_type ON video_analytics(analysis_type);