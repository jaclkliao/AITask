package com.task.agent.controller;

import com.task.agent.common.result.Result;
import com.task.agent.dto.request.LlmConfigUpdateRequest;
import com.task.agent.dto.response.LlmConfigResponse;
import com.task.agent.entity.LlmConfig;
import com.task.agent.llm.LlmClient;
import com.task.agent.llm.LlmConfigService;
import com.task.agent.llm.LlmProviders;
import com.task.agent.security.AuthUserArgumentResolver.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/llm")
@RequiredArgsConstructor
public class LlmConfigController {

    private final LlmConfigService configService;
    private final LlmClient llmClient;

    /** Provider 列表 + 当前配置：读改 POST 防止 URL 泄露配置信息 */
    @PostMapping("/providers")
    public Result<Map<String, Object>> providers(@AuthUser Integer userId){
        LlmConfig current = configService.getOrInit(userId);
        Map<String,Object> m = new HashMap<>();
        m.put("providers", LlmProviders.all());
        m.put("current", configService.toResponse(current));
        return Result.success(m);
    }

    @PostMapping("/config/get")
    public Result<LlmConfigResponse> getConfig(@AuthUser Integer userId){
        return Result.success(configService.toResponse(configService.getOrInit(userId)));
    }

    @PutMapping("/config")
    public Result<LlmConfigResponse> updateConfig(@AuthUser Integer userId,
                                                  @RequestBody LlmConfigUpdateRequest req){
        LlmConfig c = configService.update(userId, req);
        return Result.success("保存成功", configService.toResponse(c));
    }

    @PostMapping("/test")
    public Result<LlmConfigResponse.TestResult> test(@AuthUser Integer userId,
                                                     @RequestBody Map<String,String> body){
        String provider = body.get("provider");
        String apiKey   = body.get("apiKey");
        String apiUrl   = body.get("apiUrl");
        String model    = body.get("model");
        Integer timeout = null;
        try{ if(body.get("timeout")!=null) timeout = Integer.parseInt(body.get("timeout")); }catch(Exception ignore){}

        if(apiKey==null || apiKey.isBlank() || apiKey.contains("****")){
            LlmConfig c = configService.getOrInit(userId);
            apiKey = c.getApiKey();
        }
        LlmConfigResponse.TestResult r = llmClient.testConnection(userId, provider, apiKey, apiUrl, model, timeout);
        return Result.success(r);
    }
}
