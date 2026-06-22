package com.task.agent.service;

import com.task.agent.dto.request.LoginDTO;
import com.task.agent.dto.request.RegisterDTO;
import com.task.agent.dto.response.LoginVO;
import com.task.agent.entity.User;

public interface UserService {
    void register(RegisterDTO dto);
    LoginVO login(LoginDTO dto);
    User getById(Integer id);
}
