package com.task.agent.service;

import com.task.agent.dto.request.LoginDTO;
import com.task.agent.dto.request.PasswordChangeDTO;
import com.task.agent.dto.request.RegisterDTO;
import com.task.agent.dto.request.UserSearchDTO;
import com.task.agent.dto.response.LoginVO;
import com.task.agent.entity.User;

import java.util.List;

public interface UserService {
    void register(RegisterDTO dto);
    LoginVO login(LoginDTO dto);
    User getById(Integer id);
    List<User> search(UserSearchDTO dto);
    void changePassword(Integer userId, PasswordChangeDTO dto);
}
