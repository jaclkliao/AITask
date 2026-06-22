package com.task.agent.llm;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.task.agent.dto.request.LlmConfigUpdateRequest;
import com.task.agent.dto.response.LlmConfigResponse;
import com.task.agent.entity.LlmConfig;
import com.task.agent.mapper.LlmConfigMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.concurrent.ConcurrentHashMap;

/**
 * LLM 配置服务
 * - 数据库持久化（每用户一份）
 * - 内存缓存，避免每次请求都查 DB
 * - 未配置时回退到 application.yml 的默认值
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LlmConfigService {

    private final LlmConfigMapper mapper;

    // yml 默认值
    @Value("${llm.api-key:}")  String defaultApiKey;
    @Value("${llm.api-url:}")  String defaultApiUrl;
    @Value("${llm.timeout:30000}") long defaultTimeout;

    // 内存缓存：userId -> ResolvedConfig
    private final java.util.concurrent.ConcurrentHashMap<Integer, ResolvedConfig> cache = new ConcurrentHashMap<>();

    public LlmConfig getOrInit(Integer userId){
        LlmConfig c = mapper.selectOne(
            new LambdaQueryWrapper<LlmConfig>().eq(LlmConfig::getUserId, userId));
        if(c==null){
            c = new LlmConfig();
            c.setUserId(userId);
            c.setProvider(LlmProviders.DEEPSEEK);
            c.setApiUrl(defaultApiUrl);
            c.setApiKey(defaultApiKey);
            c.setModel("deepseek-chat");
            c.setTemperature(new BigDecimal("0.20"));
            c.setTimeout((int)defaultTimeout);
            c.setMaxTokens(2000);
            c.setEnabled(1);
            mapper.insert(c);
            log.info("[LLM] 初始化用户 {} 默认 LLM 配置", userId);
        }
        return c;
    }

    public LlmConfigResponse toResponse(LlmConfig c){
        LlmConfigResponse r = new LlmConfigResponse();
        r.setProvider(c.getProvider());
        r.setApiKey(maskKey(c.getApiKey()));
        r.setApiUrl(c.getApiUrl());
        r.setModel(c.getModel());
        r.setTemperature(c.getTemperature());
        r.setTimeout(c.getTimeout());
        r.setMaxTokens(c.getMaxTokens());
        r.setEnabled(c.getEnabled());
        return r;
    }

    public LlmConfig update(Integer userId, LlmConfigUpdateRequest req){
        LlmConfig c = getOrInit(userId);
        if(req.getProvider()!=null) c.setProvider(req.getProvider());
        if(req.getApiKey()!=null)   c.setApiKey(req.getApiKey().trim());
        if(req.getApiUrl()!=null)   c.setApiUrl(req.getApiUrl().trim());
        if(req.getModel()!=null)    c.setModel(req.getModel().trim());
        if(req.getTemperature()!=null) c.setTemperature(req.getTemperature());
        if(req.getTimeout()!=null)   c.setTimeout(req.getTimeout());
        if(req.getMaxTokens()!=null) c.setMaxTokens(req.getMaxTokens());
        if(req.getEnabled()!=null)   c.setEnabled(req.getEnabled());
        mapper.updateById(c);
        cache.remove(userId);  // 清缓存
        log.info("[LLM] 用户 {} 更新 LLM 配置 provider={} model={}", userId, c.getProvider(), c.getModel());
        return c;
    }

    public ResolvedConfig resolve(Integer userId){
        ResolvedConfig r = cache.get(userId);
        if(r!=null) return r;
        LlmConfig c = getOrInit(userId);
        r = new ResolvedConfig();
        r.apiKey   = nz(c.getApiKey(),  defaultApiKey);
        r.apiUrl   = nz(c.getApiUrl(),  defaultApiUrl);
        r.model    = c.getModel();
        r.timeout  = c.getTimeout()!=null ? c.getTimeout() : (int)defaultTimeout;
        r.temperature = c.getTemperature()!=null ? c.getTemperature() : new BigDecimal("0.20");
        r.maxTokens = c.getMaxTokens()!=null ? c.getMaxTokens() : 2000;
        r.provider = c.getProvider();
        r.enabled  = c.getEnabled()==null || c.getEnabled()==1;
        cache.put(userId, r);
        return r;
    }

    public void invalidate(Integer userId){ cache.remove(userId); }

    private String maskKey(String k){
        if(k==null||k.length()<=8) return "****";
        return k.substring(0,4) + "****" + k.substring(k.length()-4);
    }
    private String nz(String v, String def){ return (v==null||v.isBlank()) ? def : v; }

    public static class ResolvedConfig {
        public String provider;
        public String apiKey;
        public String apiUrl;
        public String model;
        public Integer timeout;
        public BigDecimal temperature;
        public Integer maxTokens;
        public boolean enabled;
    }
}
