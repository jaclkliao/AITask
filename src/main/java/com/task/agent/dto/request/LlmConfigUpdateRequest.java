package com.task.agent.dto.request;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class LlmConfigUpdateRequest {
    private String provider;        // deepseek/doubao/qwen/glm/openai/minimax/custom
    private String apiKey;
    private String apiUrl;
    private String model;
    private BigDecimal temperature;
    private Integer timeout;
    private Integer maxTokens;
    private Integer enabled;
}
