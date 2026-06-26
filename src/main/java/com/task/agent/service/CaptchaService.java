package com.task.agent.service;

import com.task.agent.dto.response.CaptchaVO;

public interface CaptchaService {
    CaptchaVO generate();
    boolean verify(String key, String code);
}
