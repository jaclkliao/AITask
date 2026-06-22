package com.task.agent.dto;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;

@Data
public class NaturalTaskDTO {
    @NotBlank(message = "任务描述不能为空")
    private String content;
    private Integer projectId;
}
