package com.task.agent.controller;

import com.task.agent.common.result.Result;
import com.task.agent.dto.request.PasswordChangeDTO;
import com.task.agent.dto.request.LoginDTO;
import com.task.agent.dto.request.RegisterDTO;
import com.task.agent.dto.request.UserSearchDTO;
import com.task.agent.dto.response.CaptchaVO;
import com.task.agent.dto.response.LoginVO;
import com.task.agent.entity.User;
import com.task.agent.security.AuthUserArgumentResolver.AuthUser;
import com.task.agent.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final com.task.agent.service.CaptchaService captchaService;

    @PostMapping("/captcha")
    public Result<CaptchaVO> captcha() {
        return Result.success(captchaService.generate());
    }

    @PostMapping("/register")
    public Result<Void> register(@Valid @RequestBody RegisterDTO dto) {
        userService.register(dto);
        return Result.success("注册成功", null);
    }

    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginDTO dto) {
        if (!captchaService.verify(dto.getCaptchaKey(), dto.getCaptchaCode())) {
            throw new RuntimeException("验证码错误或已过期");
        }
        LoginVO vo = userService.login(dto);
        return Result.success(vo);
    }

    @GetMapping("/me")
    public Result<User> me(@AuthUser Integer userId) {
        User user = userService.getById(userId);
        user.setPassword(null);
        return Result.success(user);
    }

    @PostMapping("/users/search")
    public Result<java.util.List<User>> searchUsers(@AuthUser Integer userId,
                                                    @RequestBody(required = false) UserSearchDTO dto) {
        return Result.success(userService.search(dto));
    }

    @PostMapping("/password/change")
    public Result<Void> changePassword(@AuthUser Integer userId,
                                       @Valid @RequestBody PasswordChangeDTO dto) {
        userService.changePassword(userId, dto);
        return Result.success("密码修改成功", null);
    }
}
