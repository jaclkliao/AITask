package com.task.agent.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginVO {
    private Integer userId;
    private String username;
    private String nickname;
    private String token;
}
