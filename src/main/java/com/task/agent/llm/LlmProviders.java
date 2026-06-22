package com.task.agent.llm;

import com.task.agent.dto.response.LlmConfigResponse;

import java.util.Arrays;
import java.util.List;

/**
 * 预置 LLM Provider 列表
 * 兼容主流国产与海外模型
 */
public final class LlmProviders {

    private LlmProviders(){}

    public static final String DEEPSEEK = "deepseek";
    public static final String DOUBAO   = "doubao";
    public static final String QWEN     = "qwen";
    public static final String GLM      = "glm";
    public static final String MINIMAX  = "minimax";
    public static final String OPENAI   = "openai";
    public static final String CUSTOM   = "custom";

    public static List<LlmConfigResponse.ProviderInfo> all(){
        return Arrays.asList(
            build(DEEPSEEK, "DeepSeek",
                "https://api.deepseek.com/v1/chat/completions",
                "deepseek-chat",
                "https://platform.deepseek.com",
                "深度求索，国产开源大模型，长文本/推理强",
                Arrays.asList(
                    model("deepseek-chat", "DeepSeek-V3", "通用对话模型，性价比高"),
                    model("deepseek-reasoner", "DeepSeek-R1", "推理模型，适合复杂任务拆解")
                ),
                "在 DeepSeek 开放平台申请 API Key"),

            build(DOUBAO, "豆包（Doubao）",
                "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
                "doubao-1-5-pro-32k-250115",
                "https://www.volcengine.com/product/doubao",
                "字节跳动豆包大模型，Volcengine ARK 平台",
                Arrays.asList(
                    model("doubao-1-5-pro-32k-250115", "Doubao 1.5 Pro 32K", "稳定版 32K 上下文"),
                    model("doubao-1-5-lite-32k-250115", "Doubao 1.5 Lite 32K", "轻量版，速度快"),
                    model("doubao-pro-32k", "Doubao Pro 32K", "上一代旗舰")
                ),
                "在火山引擎控制台创建 ARK API Key"),

            build(QWEN, "通义千问（Qwen）",
                "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                "qwen-plus",
                "https://dashscope.aliyun.com",
                "阿里云通义千问，OpenAI 兼容模式",
                Arrays.asList(
                    model("qwen-plus", "Qwen Plus", "通用增强版"),
                    model("qwen-turbo", "Qwen Turbo", "极速版"),
                    model("qwen-max", "Qwen Max", "旗舰版，效果最强"),
                    model("qwen-long", "Qwen Long", "超长上下文（1M）")
                ),
                "在阿里云百炼 / DashScope 控制台申请 API Key"),

            build(GLM, "智谱 GLM",
                "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                "glm-4-plus",
                "https://open.bigmodel.cn",
                "智谱 AI 开放平台，OpenAI 兼容",
                Arrays.asList(
                    model("glm-4-plus", "GLM-4 Plus", "旗舰"),
                    model("glm-4-air", "GLM-4 Air", "高性价比"),
                    model("glm-4-flash", "GLM-4 Flash", "免费且快"),
                    model("glm-4-long", "GLM-4 Long", "长文本")
                ),
                "在智谱开放平台申请 API Key"),

            build(MINIMAX, "MiniMax",
                "https://api.minimax.chat/v1/text/chatcompletion_v2",
                "MiniMax-Text-01",
                "https://api.minimax.chat",
                "MiniMax 大模型，OpenAI 风格接口",
                Arrays.asList(
                    model("MiniMax-Text-01", "MiniMax Text 01", "文本旗舰（推荐）"),
                    model("abab6.5s-chat", "ABAB 6.5s", "上一代对话模型")
                ),
                "在 MiniMax 开放平台申请 API Key"),

            build(OPENAI, "OpenAI 兼容",
                "https://api.openai.com/v1/chat/completions",
                "gpt-4o-mini",
                "https://platform.openai.com",
                "OpenAI 官方 / 任何 OpenAI 兼容服务（Azure / LocalAI / Ollama）",
                Arrays.asList(
                    model("gpt-4o", "GPT-4o", "OpenAI 旗舰"),
                    model("gpt-4o-mini", "GPT-4o mini", "轻量快速"),
                    model("gpt-3.5-turbo", "GPT-3.5 Turbo", "老版本，便宜"),
                    model("o1-mini", "o1-mini", "推理模型")
                ),
                "OpenAI: 在 platform.openai.com 申请；其他: 对应平台控制台"),

            build(CUSTOM, "自定义",
                "",
                "",
                "",
                "完全自定义 URL 与模型名（OpenAI 兼容协议）",
                Arrays.asList(),
                "请填写你的服务地址与 key")
        );
    }

    private static LlmConfigResponse.ProviderInfo build(String code, String name,
            String defaultUrl, String defaultModel, String docsUrl, String desc,
            List<LlmConfigResponse.ModelOption> models, String apiKeyHint){
        LlmConfigResponse.ProviderInfo p = new LlmConfigResponse.ProviderInfo();
        p.setCode(code);p.setName(name);p.setDefaultUrl(defaultUrl);
        p.setDefaultModel(defaultModel);p.setDocsUrl(docsUrl);
        p.setDescription(desc);p.setModels(models);p.setApiKeyHint(apiKeyHint);
        return p;
    }
    private static LlmConfigResponse.ModelOption model(String v, String l, String d){
        LlmConfigResponse.ModelOption m = new LlmConfigResponse.ModelOption();
        m.setValue(v);m.setLabel(l);m.setDescription(d);
        return m;
    }

    public static LlmConfigResponse.ProviderInfo findByCode(String code){
        if(code==null) return null;
        return all().stream().filter(p->p.getCode().equals(code)).findFirst().orElse(null);
    }
}
