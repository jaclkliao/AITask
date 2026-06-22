package com.task.agent.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("llm_config")
public class LlmConfig {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer userId;
    private String provider;
    private String apiKey;
    private String apiUrl;
    private String model;
    private BigDecimal temperature;
    private Integer timeout;
    private Integer maxTokens;
    private Integer enabled;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
