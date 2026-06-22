package com.task.agent.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.task.agent.entity.Project;
import com.task.agent.entity.Task;
import com.task.agent.entity.TimeLog;
import com.task.agent.mapper.ProjectMapper;
import com.task.agent.mapper.TaskMapper;
import com.task.agent.mapper.TimeLogMapper;
import com.task.agent.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ProjectServiceImpl implements ProjectService {

    private final ProjectMapper projectMapper;
    private final TaskMapper taskMapper;
    private final TimeLogMapper timeLogMapper;

    @Override
    public List<Project> listByUser(Integer userId) {
        return projectMapper.selectList(
                new LambdaQueryWrapper<Project>()
                        .eq(Project::getUserId, userId)
                        .orderByDesc(Project::getCreateTime));
    }

    @Override
    public Project create(Project project) {
        project.setStatus("ACTIVE");
        projectMapper.insert(project);
        return project;
    }

    @Override
    public Project update(Project project) {
        projectMapper.updateById(project);
        return projectMapper.selectById(project.getId());
    }

    @Override
    public void delete(Integer id, Integer userId) {
        projectMapper.delete(
                new LambdaQueryWrapper<Project>()
                        .eq(Project::getId, id)
                        .eq(Project::getUserId, userId));
    }

    @Override
    public Map<String, Object> getStats(Integer id, Integer userId) {
        List<Task> tasks = taskMapper.selectList(
                new LambdaQueryWrapper<Task>()
                        .eq(Task::getProjectId, id)
                        .eq(Task::getUserId, userId));
        long total = tasks.size();
        long done = tasks.stream().filter(t -> "DONE".equals(t.getStatus())).count();
        int totalActualTime = tasks.stream().mapToInt(t -> t.getActualTime() != null ? t.getActualTime() : 0).sum();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTasks", total);
        stats.put("doneTasks", done);
        stats.put("progress", total > 0 ? (int) (done * 100 / total) : 0);
        stats.put("totalActualTime", totalActualTime);
        return stats;
    }
}
