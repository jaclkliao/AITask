package com.task.agent.agent.parser;

import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson2.JSON;
import com.task.agent.llm.LlmClient;
import com.task.agent.llm.LlmPromptFactory;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class NaturalTaskParser {

    private final LlmClient llmClient;
    private final LlmPromptFactory promptFactory;

    public TaskParseDTO parse(String content) {
        return parse(null, content);
    }

    public TaskParseDTO parse(Integer userId, String content) {
        String prompt = promptFactory.getTaskParsePrompt(content);
        String res = llmClient.chat(userId, prompt);
        if (StrUtil.isBlank(res)) {
            throw new RuntimeException("AI任务解析失败，请稍后重试");
        }
        res = cleanJsonContent(res);
        try {
            return JSON.parseObject(res, TaskParseDTO.class);
        } catch (Exception e) {
            throw new RuntimeException("任务数据解析异常，请优化任务描述");
        }
    }

    private String cleanJsonContent(String content) {
        content = content.replace("```json", "");
        content = content.replace("```", "");
        return content.trim();
    }

    @Data
    public static class TaskParseDTO {
        private String title;
        private String description;
        private LocalDateTime deadline;
        private Integer costTime;
        private Integer priority;
    }
}
