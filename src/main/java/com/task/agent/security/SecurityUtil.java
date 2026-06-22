package com.task.agent.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public class SecurityUtil {

    public static Integer getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Integer userId) {
            return userId;
        }
        return null;
    }

    public static Integer requireUserId() {
        Integer userId = getCurrentUserId();
        if (userId == null) {
            throw new RuntimeException("未登录或登录已过期，请重新登录");
        }
        return userId;
    }
}
