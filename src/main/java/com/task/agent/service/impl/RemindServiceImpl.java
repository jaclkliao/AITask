package com.task.agent.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.task.agent.entity.RemindPlan;
import com.task.agent.entity.Task;
import com.task.agent.mapper.RemindPlanMapper;
import com.task.agent.mapper.TaskMapper;
import com.task.agent.service.RemindService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RemindServiceImpl implements RemindService {

    private final RemindPlanMapper remindPlanMapper;
    private final TaskMapper taskMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createRemind(Integer userId, Integer taskId, String taskTitle, LocalDateTime deadline, Integer remindMinBefore) {
        LocalDateTime remindTime = deadline.minusMinutes(remindMinBefore);
        RemindPlan plan = new RemindPlan();
        plan.setUserId(userId);
        plan.setTaskId(taskId);
        plan.setRemindTime(remindTime);
        plan.setRemindContent("任务提醒：【" + taskTitle + "】即将截止");
        plan.setRemindType("DEADLINE");
        plan.setPushStatus(0);
        remindPlanMapper.insert(plan);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteByTaskId(Integer userId, Integer taskId) {
        remindPlanMapper.delete(
                new LambdaQueryWrapper<RemindPlan>()
                        .eq(RemindPlan::getTaskId, taskId)
                        .eq(RemindPlan::getUserId, userId));
    }

    @Override
    public List<RemindPlan> findUnpushedReminds() {
        return remindPlanMapper.selectList(
                new LambdaQueryWrapper<RemindPlan>()
                        .eq(RemindPlan::getPushStatus, 0)
                        .le(RemindPlan::getRemindTime, LocalDateTime.now()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void markPushed(Integer remindId) {
        RemindPlan plan = remindPlanMapper.selectById(remindId);
        if (plan != null) {
            plan.setPushStatus(1);
            remindPlanMapper.updateById(plan);
        }
    }

    @Override
    public String getDailyTodoContent(Integer userId) {
        LocalDateTime todayStart = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime todayEnd = todayStart.plusDays(1);

        List<Task> todayTasks = taskMapper.selectList(
                new LambdaQueryWrapper<Task>()
                        .eq(Task::getUserId, userId)
                        .in(Task::getStatus, "TODO", "DOING")
                        .and(w -> w.isNull(Task::getDeadline)
                                .or().between(Task::getDeadline, todayStart, todayEnd)));

        if (todayTasks.isEmpty()) return "今日暂无待办任务，祝您工作愉快！";

        StringBuilder sb = new StringBuilder("【每日待办】今日待办任务：\n");
        for (int i = 0; i < todayTasks.size(); i++) {
            Task t = todayTasks.get(i);
            sb.append(i + 1).append(". ").append(t.getTitle());
            if (t.getDeadline() != null) {
                sb.append(" (截止: ").append(t.getDeadline().format(DateTimeFormatter.ofPattern("HH:mm"))).append(")");
            }
            sb.append("\n");
        }
        return sb.toString();
    }
}
