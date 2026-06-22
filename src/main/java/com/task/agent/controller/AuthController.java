package com.task.agent.controller;

import com.task.agent.common.result.Result;
import com.task.agent.dto.request.LoginDTO;
import com.task.agent.dto.request.RegisterDTO;
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

    @PostMapping("/register")
    public Result<Void> register(@Valid @RequestBody RegisterDTO dto) {
        userService.register(dto);
        return Result.success("注册成功", null);
    }

    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginDTO dto) {
        LoginVO vo = userService.login(dto);
        return Result.success(vo);
    }

    @GetMapping("/me")
    public Result<User> me(@AuthUser Integer userId) {
        User user = userService.getById(userId);
        user.setPassword(null);
        return Result.success(user);
    }
}
