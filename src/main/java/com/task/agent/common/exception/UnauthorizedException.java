package com.task.agent.common.exception;

/**
 * 未登录 / 登录已过期异常
 * 由 GlobalExceptionHandler 统一返回 401 + 业务码 2001
 */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String msg) {
        super(msg);
    }
    public UnauthorizedException() {
        super("登录已过期，请重新登录");
    }
}
