package com.task.agent.common.exception;

import com.task.agent.common.result.Result;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 静态资源未找到（favicon.ico / .well-known/* 等浏览器自带探测）
     * 静默处理为 404，不打 ERROR 日志
     */
    @ExceptionHandler(NoResourceFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Result<?> handleNoResource(NoResourceFoundException e, HttpServletRequest req) {
        log.debug("静态资源未找到: {}", req.getRequestURI());
        return Result.fail(404, "资源不存在");
    }

    /**
     * 未登录 / Token 过期 / Token 无效
     * 业务码固定为 2001，便于前端统一识别
     */
    @ExceptionHandler(com.task.agent.common.exception.UnauthorizedException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public Result<?> handleUnauthorized(com.task.agent.common.exception.UnauthorizedException e, HttpServletRequest req) {
        log.debug("未授权访问: {} - {}", req.getRequestURI(), e.getMessage());
        // 业务码 2001 表示 token 相关，前端按 401 处理
        return new Result<>(2001, e.getMessage(), null);
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Result<?> handleNoHandler(NoHandlerFoundException e, HttpServletRequest req) {
        log.debug("路由未找到: {}", req.getRequestURI());
        return Result.fail(404, "接口不存在");
    }

    @ExceptionHandler(RuntimeException.class)
    public Result<?> handleRuntimeException(RuntimeException e) {
        log.error("运行时异常: ", e);
        return Result.fail(e.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public Result<?> handleAccessDenied(AccessDeniedException e) {
        return Result.fail(403, "无权访问");
    }

    @ExceptionHandler(Exception.class)
    public Result<?> handleException(Exception e) {
        log.error("系统异常: ", e);
        return Result.fail("系统繁忙，请稍后重试");
    }
}
