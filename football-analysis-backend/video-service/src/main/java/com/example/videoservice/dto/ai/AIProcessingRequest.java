package com.example.videoservice.dto.ai;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIProcessingRequest {
    @JsonProperty("video_id")
    private String videoId;

    @JsonProperty("video_key")
    private String videoKey;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("spaces_config")
    private Map<String, String> spacesConfig;

    @JsonProperty("stub_mode")
    private Boolean stubMode = false;

    @JsonProperty("preserve_audio")
    private Boolean preserveAudio = false;

    @JsonProperty("callback_url")
    private String callbackUrl;
}
