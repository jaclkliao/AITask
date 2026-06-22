package com.task.agent.controller;

import com.task.agent.common.result.Result;
import com.task.agent.entity.Project;
import com.task.agent.security.AuthUserArgumentResolver.AuthUser;
import com.task.agent.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/project")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    /** 列表查询改 POST + body */
    @PostMapping("/list")
    public Result<List<Project>> list(@AuthUser Integer userId) {
        return Result.success(projectService.listByUser(userId));
    }

    @PostMapping
    public Result<Project> create(@AuthUser Integer userId,
                                   @RequestBody Project project) {
        project.setUserId(userId);
        return Result.success(projectService.create(project));
    }

    @PutMapping("/{id}")
    public Result<Project> update(@AuthUser Integer userId,
                                   @RequestBody Project project) {
        project.setUserId(userId);
        return Result.success(projectService.update(project));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@AuthUser Integer userId,
                                @PathVariable Integer id) {
        projectService.delete(id, userId);
        return Result.success(null);
    }

    /** 统计查询改 POST */
    @PostMapping("/stats")
    public Result<Map<String, Object>> stats(@AuthUser Integer userId,
                                              @RequestBody IdBody body) {
        return Result.success(projectService.getStats(body.getId(), userId));
    }

    @lombok.Data
    public static class IdBody {
        private Integer id;
    }
}
