package com.task.agent.controller;

import com.task.agent.common.result.Result;
import com.task.agent.dto.NaturalTaskDTO;
import com.task.agent.dto.request.TaskUpdateDTO;
import com.task.agent.entity.SubTask;
import com.task.agent.entity.Task;
import com.task.agent.entity.TimeLog;
import com.task.agent.security.AuthUserArgumentResolver.AuthUser;
import com.task.agent.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/task")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @PostMapping("/natural")
    public Result<Task> createByNatural(@AuthUser Integer userId,
                                         @Valid @RequestBody NaturalTaskDTO dto) {
        return Result.success(taskService.createByNatural(userId, dto));
    }

    @PostMapping
    public Result<Task> create(@AuthUser Integer userId,
                                @RequestBody Task task) {
        return Result.success(taskService.createManually(userId, task));
    }

    /**
     * 查询任务列表
     * 用 POST + body 传参避免 URL 暴露过滤条件、避免 GET 缓存
     */
    @PostMapping("/list")
    public Result<List<Task>> listAll(@AuthUser Integer userId,
                                      @RequestBody(required = false) TaskListQuery query) {
        if(query==null) query=new TaskListQuery();
        return Result.success(taskService.listAll(userId, query.getProjectId(), query.getStatus()));
    }

    /** 查询单条任务 */
    @PostMapping("/get")
    public Result<Task> getById(@AuthUser Integer userId,
                                @RequestBody IdBody body) {
        return Result.success(taskService.getById(body.getId(), userId));
    }

    @PutMapping("/{id}")
    public Result<Task> update(@AuthUser Integer userId,
                                @PathVariable Integer id,
                                @RequestBody TaskUpdateDTO dto) {
        return Result.success(taskService.updateTask(id, userId, dto));
    }

    /** 状态更新：业务上是写操作，POST 更安全 */
    @PostMapping("/status/{id}")
    public Result<Void> updateStatus(@AuthUser Integer userId,
                                      @PathVariable Integer id,
                                      @RequestBody StatusBody body) {
        taskService.updateStatus(id, userId, body.getStatus());
        return Result.success(null);
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@AuthUser Integer userId,
                                @PathVariable Integer id) {
        taskService.deleteById(id, userId);
        return Result.success("删除成功", null);
    }

    /** 子任务列表 */
    @PostMapping("/sub")
    public Result<List<SubTask>> listSubTasks(@AuthUser Integer userId,
                                               @RequestBody IdBody body) {
        return Result.success(taskService.listSubTasks(body.getTaskId(), userId));
    }

    @PostMapping("/{id}/decompose")
    public Result<List<SubTask>> redecompose(@AuthUser Integer userId,
                                              @PathVariable Integer id,
                                              @RequestBody(required = false) TaskUpdateDTO dto) {
        return Result.success(taskService.redecompose(id, userId, dto));
    }

    @PostMapping("/{id}/time/start")
    public Result<TimeLog> startTimer(@AuthUser Integer userId,
                                       @PathVariable Integer id) {
        return Result.success(taskService.startTimer(id, userId));
    }

    @PostMapping("/{id}/time/pause")
    public Result<TimeLog> pauseTimer(@AuthUser Integer userId,
                                      @PathVariable Integer id) {
        return Result.success(taskService.pauseTimer(id, userId));
    }

    @PostMapping("/{id}/time/stop")
    public Result<TimeLog> stopTimer(@AuthUser Integer userId,
                                      @PathVariable Integer id) {
        return Result.success(taskService.stopTimer(id, userId));
    }

    /** 时间日志查询 */
    @PostMapping("/time/logs")
    public Result<List<TimeLog>> getTimeLogs(@AuthUser Integer userId,
                                              @RequestBody IdBody body) {
        return Result.success(taskService.getTimeLogs(body.getTaskId(), userId));
    }

    @PostMapping("/heatmap")
    public Result<Map<String, Object>> getTaskHeatmap(@AuthUser Integer userId,
                                                       @RequestBody(required = false) IdBody body) {
        Integer targetUserId = body == null ? null : body.getUserId();
        return Result.success(taskService.getTaskHeatmap(userId, targetUserId));
    }

    // ===== 请求体 =====
    @lombok.Data
    public static class TaskListQuery {
        private Integer projectId;
        private String status;
    }
    @lombok.Data
    public static class IdBody {
        private Integer id;
        private Integer taskId;
        private Integer userId;
    }
    @lombok.Data
    public static class StatusBody {
        private String status;
    }
}
