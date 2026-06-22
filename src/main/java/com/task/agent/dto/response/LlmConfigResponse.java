package com.task.agent.dto.response;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class LlmConfigResponse {
    private String provider;
    private String apiKey;          // 返回时仅显示前 4 位 + ****
    private String apiUrl;
    private String model;
    private BigDecimal temperature;
    private Integer timeout;
    private Integer maxTokens;
    private Integer enabled;

    @Data
    public static class ProviderInfo {
        private String code;
        private String name;
        private String defaultUrl;
        private String defaultModel;
        private String docsUrl;
        private String description;
        private List<ModelOption> models;
        private String apiKeyHint;
    }

    @Data
    public static class ModelOption {
        private String value;
        private String label;
        private String description;
    }

    @Data
    public static class TestResult {
        private Boolean success;
        private String message;
        private Long latencyMs;
        private String model;
    }
}
