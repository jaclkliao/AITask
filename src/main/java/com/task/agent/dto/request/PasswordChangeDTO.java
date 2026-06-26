package com.task.agent.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PasswordChangeDTO {
    @NotBlank(message = "原密码不能为空")
    private String oldPassword;
    @NotBlank(message = "新密码不能为空")
    @Size(min = 6, max = 100, message = "新密码长度6-100位")
    private String newPassword;
    @NotBlank(message = "确认密码不能为空")
    private String confirmPassword;
}
