package com.task.agent.service;

import com.task.agent.entity.Project;
import java.util.List;
import java.util.Map;

public interface ProjectService {
    List<Project> listByUser(Integer userId);
    Project create(Project project);
    Project update(Project project);
    void delete(Integer id, Integer userId);
    Map<String, Object> getStats(Integer id, Integer userId);
}
