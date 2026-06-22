package com.task.agent.agent.planner;

import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson2.JSON;
import com.task.agent.llm.LlmClient;
import com.task.agent.llm.LlmPromptFactory;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
public class TaskDecomposePlanner {

    private final LlmClient llmClient;
    private final LlmPromptFactory promptFactory;

    private static final Integer COMPLEX_TASK_THRESHOLD = 240;

    public boolean needDecompose(Integer costTime) {
        return costTime != null && costTime > COMPLEX_TASK_THRESHOLD;
    }

    public List<String> decompose(String taskContent) {
        return decompose(null, taskContent);
    }

    public List<String> decompose(Integer userId, String taskContent) {
        String prompt = promptFactory.getTaskDecomposePrompt(taskContent);
        String res = llmClient.chat(userId, prompt);
        if (StrUtil.isBlank(res)) {
            return Collections.emptyList();
        }
        res = cleanJsonContent(res);
        try {
            List<SubTaskDTO> subTaskList = JSON.parseArray(res, SubTaskDTO.class);
            return subTaskList.stream()
                    .map(SubTaskDTO::getContent)
                    .filter(StrUtil::isNotBlank)
                    .map(String::trim)
                    .toList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String cleanJsonContent(String content) {
        content = content.replace("```json", "");
        content = content.replace("```", "");
        return content.trim();
    }

    @Data
    public static class SubTaskDTO {
        private String content;
    }
}
