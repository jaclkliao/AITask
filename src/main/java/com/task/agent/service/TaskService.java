package com.task.agent.service;

import com.task.agent.dto.NaturalTaskDTO;
import com.task.agent.dto.request.CommentCreateDTO;
import com.task.agent.dto.request.TaskUpdateDTO;
import com.task.agent.entity.SubTask;
import com.task.agent.entity.Task;
import com.task.agent.entity.TaskComment;
import com.task.agent.entity.TimeLog;

import java.util.List;
import java.util.Map;

public interface TaskService {

    Task createByNatural(Integer userId, NaturalTaskDTO dto);

    Task createManually(Integer userId, Task task);

    List<Task> listAll(Integer userId, Integer projectId, String status);

    Task getById(Integer id, Integer userId);

    Task updateTask(Integer id, Integer userId, TaskUpdateDTO dto);

    void updateStatus(Integer id, Integer userId, String status);

    void deleteById(Integer id, Integer userId);

    List<SubTask> listSubTasks(Integer taskId, Integer userId);

    List<SubTask> redecompose(Integer taskId, Integer userId, TaskUpdateDTO dto);

    TimeLog startTimer(Integer taskId, Integer userId);

    TimeLog pauseTimer(Integer taskId, Integer userId);

    TimeLog stopTimer(Integer taskId, Integer userId);

    List<TimeLog> getTimeLogs(Integer taskId, Integer userId);

    Map<String, Object> getTaskHeatmap(Integer userId, Integer targetUserId);

    List<TaskComment> listComments(Integer taskId, Integer userId);

    TaskComment addComment(Integer taskId, Integer userId, CommentCreateDTO dto);

    TaskComment updateComment(Integer taskId, Integer commentId, Integer userId, CommentCreateDTO dto);

    void deleteComment(Integer taskId, Integer commentId, Integer userId);

    Map<String, Object> getNotifications(Integer userId);

    void markNotificationsRead(Integer userId, List<Integer> ids);
}
