package com.task.agent.llm;

import org.springframework.stereotype.Component;

@Component
public class LlmPromptFactory {

    /** 任务解析模板 */
    private static final String TASK_PARSE_TEMPLATE = "你是个人任务管理助手，请解析用户输入的任务，严格按照JSON格式返回，禁止返回多余文字。\n" +
            "字段说明：\n" +
            "title:任务标题(简短)\n" +
            "description:任务详细描述\n" +
            "deadline:截止时间(yyyy-MM-dd HH:mm:ss，无则填null)\n" +
            "costTime:预估耗时(单位分钟，整数)\n" +
            "priority:优先级 1高 2中 3低\n\n" +
            "用户任务：%s";

    /** 任务拆解模板 */
    private static final String TASK_DECOMPOSE_TEMPLATE = "你是任务拆解专家，请将复杂任务拆分为多个可直接执行的子任务，返回JSON数组，仅返回数组，不要多余解释：\n" +
            "[{content:\"子任务内容\"}]\n" +
            "任务内容：%s";

    public String getTaskParsePrompt(String content) {
        return String.format(TASK_PARSE_TEMPLATE, content);
    }

    public String getTaskDecomposePrompt(String taskContent) {
        return String.format(TASK_DECOMPOSE_TEMPLATE, taskContent);
    }
}
