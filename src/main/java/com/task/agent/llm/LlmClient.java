package com.task.agent.llm;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.task.agent.dto.response.LlmConfigResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * 大模型客户端
 * - 每次调用前从 LlmConfigService 动态读取配置
 * - 兼容 OpenAI 风格协议（绝大多数国产模型已对齐）
 * - 特殊处理：豆包/部分服务在 body 中需要 model 字段拼接
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LlmClient {

    private final LlmConfigService configService;

    private final Map<String, OkHttpClient> clientCache = new ConcurrentHashMap<>();

    private OkHttpClient getClient(int timeoutMs){
        return clientCache.computeIfAbsent(String.valueOf(timeoutMs), k ->
            new OkHttpClient.Builder()
                .callTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .writeTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .build());
    }

    /**
     * 用默认 user（null）调用 - 兼容旧业务路径
     */
    public String chat(String prompt){
        return chat(null, prompt);
    }

    /**
     * 核心方法
     * @param userId 用户ID（用于查询该用户的 LLM 配置），传 null 时使用 yml 默认配置
     * @param prompt 提示词
     * @return 模型返回文本
     */
    public String chat(Integer userId, String prompt){
        LlmConfigService.ResolvedConfig cfg;
        if(userId == null){
            // 兜底：构造 yml 默认 cfg
            cfg = new LlmConfigService.ResolvedConfig();
            cfg.apiKey  = configService.defaultApiKey;
            cfg.apiUrl  = configService.defaultApiUrl;
            cfg.model   = "deepseek-chat";
            cfg.timeout = (int) configService.defaultTimeout;
            cfg.temperature = new java.math.BigDecimal("0.20");
            cfg.maxTokens = 2000;
            cfg.provider = LlmProviders.DEEPSEEK;
            cfg.enabled = true;
        }else{
            cfg = configService.resolve(userId);
        }

        if(!cfg.enabled){
            log.warn("[LLM] 用户 {} 的 LLM 配置已禁用", userId);
            return null;
        }
        if(cfg.apiKey==null||cfg.apiKey.isBlank()){
            log.warn("[LLM] 用户 {} 的 API Key 未配置", userId);
            return null;
        }
        if(cfg.apiUrl==null||cfg.apiUrl.isBlank()){
            log.warn("[LLM] 用户 {} 的 API URL 未配置", userId);
            return null;
        }

        Map<String, Object> message = new HashMap<>();
        message.put("role", "user");
        message.put("content", prompt);

        List<Map<String, Object>> messages = Collections.singletonList(message);
        Map<String, Object> body = new HashMap<>();
        body.put("model", cfg.model);
        body.put("messages", messages);
        body.put("temperature", cfg.temperature);
        if(cfg.maxTokens!=null && cfg.maxTokens>0) body.put("max_tokens", cfg.maxTokens);

        String jsonBody = JSON.toJSONString(body);
        Request request = new Request.Builder()
            .url(cfg.apiUrl)
            .addHeader("Authorization", "Bearer " + cfg.apiKey)
            .addHeader("Content-Type", "application/json")
            .post(RequestBody.create(jsonBody, MediaType.get("application/json")))
            .build();

        try(Response response = getClient(cfg.timeout).newCall(request).execute()){
            if(!response.isSuccessful()){
                String err=response.body()!=null?response.body().string():"";
                log.error("[LLM] 调用失败 status={} body={}", response.code(), err);
                return null;
            }
            String resBody = response.body().string();
            return extractContent(resBody);
        }catch(Exception e){
            log.error("[LLM] 调用异常 provider={} url={}", cfg.provider, cfg.apiUrl, e);
            return null;
        }
    }

    /**
     * 测试连通性（专供设置面板）
     * @return 包含耗时/成功标志/错误信息的对象
     */
    public LlmConfigResponse.TestResult testConnection(Integer userId, String provider,
                                                        String apiKey, String apiUrl,
                                                        String model, Integer timeout){
        LlmConfigResponse.TestResult r = new LlmConfigResponse.TestResult();
        r.setModel(model);
        long t0 = System.currentTimeMillis();
        try{
            Map<String,Object> msg = new HashMap<>();
            msg.put("role","user");
            msg.put("content","hi");
            Map<String,Object> body = new HashMap<>();
            body.put("model", model!=null&&!model.isBlank()?model:"deepseek-chat");
            body.put("messages", Collections.singletonList(msg));
            body.put("temperature", 0.1);
            body.put("max_tokens", 10);
            String jsonBody = JSON.toJSONString(body);
            int t = timeout!=null && timeout>0 ? timeout : 15000;
            Request req = new Request.Builder()
                .url(apiUrl)
                .addHeader("Authorization","Bearer "+apiKey)
                .addHeader("Content-Type","application/json")
                .post(RequestBody.create(jsonBody, MediaType.get("application/json")))
                .build();
            try(Response resp = getClient(t).newCall(req).execute()){
                r.setLatencyMs(System.currentTimeMillis()-t0);
                if(resp.isSuccessful()){
                    String rb=resp.body()!=null?resp.body().string():"";
                    String content=extractContent(rb);
                    r.setSuccess(content!=null);
                    r.setMessage(content!=null?"连接成功，已收到模型回复":"HTTP 200 但响应解析失败");
                }else{
                    String err=resp.body()!=null?resp.body().string():"";
                    r.setSuccess(false);
                    r.setMessage("HTTP "+resp.code()+" · "+(err.length()>200?err.substring(0,200):err));
                }
            }
        }catch(Exception e){
            r.setLatencyMs(System.currentTimeMillis()-t0);
            r.setSuccess(false);
            r.setMessage("连接异常: " + e.getMessage());
        }
        return r;
    }

    /**
     * 兼容多种响应格式（OpenAI 标准 + 火山豆包差异）
     */
    private String extractContent(String resBody){
        try{
            JSONObject json = JSON.parseObject(resBody);
            JSONArray choices = json.getJSONArray("choices");
            if(choices==null||choices.isEmpty()) return null;
            JSONObject first = choices.getJSONObject(0);
            JSONObject message = first.getJSONObject("message");
            if(message!=null) return message.getString("content");
            // 兼容其他格式
            return first.getString("text");
        }catch(Exception e){
            return null;
        }
    }
}
