package com.task.agent.service;

import com.task.agent.entity.RemindPlan;
import java.time.LocalDateTime;
import java.util.List;

public interface RemindService {
    void createRemind(Integer userId, Integer taskId, String taskTitle, LocalDateTime deadline, Integer remindMinBefore);
    void deleteByTaskId(Integer userId, Integer taskId);
    List<RemindPlan> findUnpushedReminds();
    void markPushed(Integer remindId);
    String getDailyTodoContent(Integer userId);
}
