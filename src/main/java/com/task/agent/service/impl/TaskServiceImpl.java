package com.task.agent.service.impl;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.task.agent.agent.parser.NaturalTaskParser;
import com.task.agent.agent.planner.TaskDecomposePlanner;
import com.task.agent.dto.NaturalTaskDTO;
import com.task.agent.dto.request.TaskUpdateDTO;
import com.task.agent.entity.SubTask;
import com.task.agent.entity.Task;
import com.task.agent.entity.TimeLog;
import com.task.agent.entity.User;
import com.task.agent.mapper.SubTaskMapper;
import com.task.agent.mapper.TaskMapper;
import com.task.agent.mapper.TimeLogMapper;
import com.task.agent.mapper.UserMapper;
import com.task.agent.service.RemindService;
import com.task.agent.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {

    private final TaskMapper taskMapper;
    private final SubTaskMapper subTaskMapper;
    private final TimeLogMapper timeLogMapper;
    private final UserMapper userMapper;
    private final NaturalTaskParser taskParser;
    private final TaskDecomposePlanner taskDecomposePlanner;
    private final RemindService remindService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Task createByNatural(Integer userId, NaturalTaskDTO dto) {
        NaturalTaskParser.TaskParseDTO parseResult = taskParser.parse(userId, dto.getContent());
        if (parseResult.getPriority() == null) parseResult.setPriority(2);

        Task task = new Task();
        task.setUserId(userId);
        task.setProjectId(dto.getProjectId());
        task.setTitle(parseResult.getTitle());
        task.setDescription(parseResult.getDescription());
        task.setDeadline(parseResult.getDeadline());
        task.setCostTime(parseResult.getCostTime());
        task.setPriority(parseResult.getPriority());
        task.setActualTime(0);
        task.setStatus("TODO");
        taskMapper.insert(task);

        if (taskDecomposePlanner.needDecompose(parseResult.getCostTime())) {
            String content = parseResult.getTitle() + " " + (parseResult.getDescription() != null ? parseResult.getDescription() : "");
            List<String> subs = taskDecomposePlanner.decompose(userId, content);
            for (int i = 0; i < subs.size(); i++) {
                SubTask st = new SubTask();
                st.setTaskId(task.getId());
                st.setUserId(userId);
                st.setContent(subs.get(i));
                st.setStatus("TODO");
                st.setSort(i);
                subTaskMapper.insert(st);
            }
        }

        if (parseResult.getDeadline() != null) {
            remindService.createRemind(userId, task.getId(), task.getTitle(), parseResult.getDeadline(), 15);
        }
        return task;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Task createManually(Integer userId, Task task) {
        task.setUserId(userId);
        task.setActualTime(0);
        task.setStatus("TODO");
        taskMapper.insert(task);
        return task;
    }

    @Override
    public List<Task> listAll(Integer userId, Integer projectId, String status) {
        LambdaQueryWrapper<Task> wrapper = new LambdaQueryWrapper<Task>()
                .eq(Task::getUserId, userId)
                .orderByDesc(Task::getCreateTime);
        if (projectId != null) wrapper.eq(Task::getProjectId, projectId);
        if (StrUtil.isNotBlank(status)) wrapper.eq(Task::getStatus, status);
        return taskMapper.selectList(wrapper);
    }

    @Override
    public Task getById(Integer id, Integer userId) {
        return taskMapper.selectOne(
                new LambdaQueryWrapper<Task>().eq(Task::getId, id).eq(Task::getUserId, userId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Task updateTask(Integer id, Integer userId, TaskUpdateDTO dto) {
        Task task = taskMapper.selectOne(
                new LambdaQueryWrapper<Task>().eq(Task::getId, id).eq(Task::getUserId, userId));
        if (task == null) throw new RuntimeException("任务不存在");

        if (dto.getTitle() != null) task.setTitle(dto.getTitle());
        if (dto.getDescription() != null) task.setDescription(dto.getDescription());
        if (dto.getDeadline() != null) task.setDeadline(dto.getDeadline());
        if (dto.getCostTime() != null) task.setCostTime(dto.getCostTime());
        if (dto.getPriority() != null) task.setPriority(dto.getPriority());
        if (dto.getStatus() != null) task.setStatus(dto.getStatus());
        if (dto.getProjectId() != null) task.setProjectId(dto.getProjectId());
        task.setUpdateTime(LocalDateTime.now());
        taskMapper.updateById(task);
        if ("DONE".equals(dto.getStatus())) {
            finishRunningTimer(id, userId, false);
        } else if ("DOING".equals(dto.getStatus())) {
            startRunningTimer(id, userId, false);
        }

        // 更新子任务
        if (dto.getSubTasks() != null) {
            subTaskMapper.delete(new LambdaQueryWrapper<SubTask>().eq(SubTask::getTaskId, id));
            for (int i = 0; i < dto.getSubTasks().size(); i++) {
                TaskUpdateDTO.SubTaskDTO sd = dto.getSubTasks().get(i);
                SubTask st = new SubTask();
                st.setTaskId(id);
                st.setUserId(userId);
                st.setContent(sd.getContent());
                st.setStatus(sd.getStatus() != null ? sd.getStatus() : "TODO");
                st.setSort(i);
                subTaskMapper.insert(st);
            }
        }
        return task;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateStatus(Integer id, Integer userId, String status) {
        Task task = taskMapper.selectOne(
                new LambdaQueryWrapper<Task>().eq(Task::getId, id).eq(Task::getUserId, userId));
        if (task != null) {
            task.setStatus(status);
            task.setUpdateTime(LocalDateTime.now());
            taskMapper.updateById(task);
            if ("DONE".equals(status)) {
                finishRunningTimer(id, userId, false);
            } else if ("DOING".equals(status)) {
                startRunningTimer(id, userId, false);
            }
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteById(Integer id, Integer userId) {
        subTaskMapper.delete(new LambdaQueryWrapper<SubTask>().eq(SubTask::getTaskId, id));
        remindService.deleteByTaskId(userId, id);
        timeLogMapper.delete(new LambdaQueryWrapper<TimeLog>().eq(TimeLog::getTaskId, id));
        taskMapper.delete(new LambdaQueryWrapper<Task>().eq(Task::getId, id).eq(Task::getUserId, userId));
    }

    @Override
    public List<SubTask> listSubTasks(Integer taskId, Integer userId) {
        return subTaskMapper.selectList(
                new LambdaQueryWrapper<SubTask>()
                        .eq(SubTask::getTaskId, taskId)
                        .eq(SubTask::getUserId, userId)
                        .orderByAsc(SubTask::getSort));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<SubTask> redecompose(Integer taskId, Integer userId, TaskUpdateDTO dto) {
        Task task = taskMapper.selectOne(
                new LambdaQueryWrapper<Task>().eq(Task::getId, taskId).eq(Task::getUserId, userId));
        if (task == null) throw new RuntimeException("任务不存在");

        String title = dto != null && StrUtil.isNotBlank(dto.getTitle()) ? dto.getTitle() : task.getTitle();
        String description = dto != null && StrUtil.isNotBlank(dto.getDescription()) ? dto.getDescription() : task.getDescription();
        Integer costTime = dto != null && dto.getCostTime() != null ? dto.getCostTime() : task.getCostTime();
        String content = buildDecomposeContent(title, description, costTime);
        if (StrUtil.isBlank(content)) {
            throw new RuntimeException("任务内容为空，无法进行 AI 重拆分");
        }
        List<String> subs = taskDecomposePlanner.decompose(userId, content);
        if (subs.isEmpty()) {
            throw new RuntimeException("AI 未生成有效子任务，请检查模型配置或补充任务描述后重试");
        }

        subTaskMapper.delete(new LambdaQueryWrapper<SubTask>().eq(SubTask::getTaskId, taskId));
        for (int i = 0; i < subs.size(); i++) {
            SubTask st = new SubTask();
            st.setTaskId(taskId);
            st.setUserId(userId);
            st.setContent(subs.get(i));
            st.setStatus("TODO");
            st.setSort(i);
            subTaskMapper.insert(st);
        }
        return listSubTasks(taskId, userId);
    }

    private String buildDecomposeContent(String title, String description, Integer costTime) {
        StringBuilder content = new StringBuilder();
        if (StrUtil.isNotBlank(title)) {
            content.append("任务标题：").append(title.trim());
        }
        String plainDescription = stripHtml(description);
        if (StrUtil.isNotBlank(plainDescription)) {
            if (!content.isEmpty()) content.append("\n");
            content.append("任务描述：").append(plainDescription);
        }
        if (costTime != null && costTime > 0) {
            if (!content.isEmpty()) content.append("\n");
            content.append("预估耗时：").append(costTime).append("分钟");
        }
        return content.toString();
    }

    private String stripHtml(String html) {
        if (StrUtil.isBlank(html)) return "";
        return html.replaceAll("<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replaceAll("\\s+", " ")
                .trim();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TimeLog startTimer(Integer taskId, Integer userId) {
        return startRunningTimer(taskId, userId, true);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TimeLog pauseTimer(Integer taskId, Integer userId) {
        return finishRunningTimer(taskId, userId, true);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TimeLog stopTimer(Integer taskId, Integer userId) {
        return finishRunningTimer(taskId, userId, true);
    }

    @Override
    public List<TimeLog> getTimeLogs(Integer taskId, Integer userId) {
        return timeLogMapper.selectList(
                new LambdaQueryWrapper<TimeLog>()
                        .eq(TimeLog::getTaskId, taskId)
                        .eq(TimeLog::getUserId, userId)
                        .orderByDesc(TimeLog::getStartTime));
    }

    @Override
    public Map<String, Object> getTaskHeatmap(Integer userId, Integer targetUserId) {
        User currentUser = userMapper.selectById(userId);
        boolean admin = currentUser != null && (userId == 1 || "admin".equalsIgnoreCase(currentUser.getUsername()));
        Integer queryUserId = admin ? targetUserId : userId;
        LocalDate start = LocalDate.now().minusDays(364);

        LambdaQueryWrapper<Task> wrapper = new LambdaQueryWrapper<>();
        if (queryUserId != null) {
            wrapper.eq(Task::getUserId, queryUserId);
        }
        List<Task> tasks = taskMapper.selectList(wrapper);

        Map<LocalDate, Map<String, Integer>> byDate = new HashMap<>();
        for (Task task : tasks) {
            LocalDate day = resolveHeatmapDay(task);
            if (day.isBefore(start) || day.isAfter(LocalDate.now())) continue;
            String bucket = resolveHeatmapStatus(task);
            Map<String, Integer> counts = byDate.computeIfAbsent(day, k -> new HashMap<>());
            counts.put(bucket, counts.getOrDefault(bucket, 0) + 1);
            counts.put("total", counts.getOrDefault("total", 0) + 1);
        }

        List<Map<String, Object>> days = new ArrayList<>();
        for (int i = 0; i < 365; i++) {
            LocalDate day = start.plusDays(i);
            Map<String, Integer> counts = byDate.getOrDefault(day, new HashMap<>());
            String status = dominantHeatmapStatus(counts);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", day.toString());
            item.put("status", status);
            item.put("done", counts.getOrDefault("DONE", 0));
            item.put("pending", counts.getOrDefault("PENDING", 0));
            item.put("overdue", counts.getOrDefault("OVERDUE", 0));
            item.put("todo", counts.getOrDefault("TODO", 0));
            item.put("total", counts.getOrDefault("total", 0));
            days.add(item);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("admin", admin);
        result.put("targetUserId", queryUserId);
        result.put("startDate", start.toString());
        result.put("endDate", LocalDate.now().toString());
        result.put("days", days);
        if (admin) {
            result.put("users", userMapper.selectList(null).stream().map(user -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", user.getId());
                item.put("username", user.getUsername());
                item.put("nickname", user.getNickname());
                return item;
            }).toList());
        }
        return result;
    }

    private LocalDate resolveHeatmapDay(Task task) {
        if ("DONE".equals(task.getStatus()) && task.getUpdateTime() != null) {
            return task.getUpdateTime().toLocalDate();
        }
        if (task.getDeadline() != null && !"DONE".equals(task.getStatus())) {
            return task.getDeadline().toLocalDate();
        }
        return task.getCreateTime() != null ? task.getCreateTime().toLocalDate() : LocalDate.now();
    }

    private String resolveHeatmapStatus(Task task) {
        if (!"DONE".equals(task.getStatus()) && task.getDeadline() != null && task.getDeadline().isBefore(LocalDateTime.now())) {
            return "OVERDUE";
        }
        if ("DONE".equals(task.getStatus())) {
            return "DONE";
        }
        if ("TODO".equals(task.getStatus())) {
            return "TODO";
        }
        return "PENDING";
    }

    private String dominantHeatmapStatus(Map<String, Integer> counts) {
        if (counts.getOrDefault("total", 0) == 0) return "EMPTY";
        if (counts.getOrDefault("OVERDUE", 0) > 0) return "OVERDUE";
        if (counts.getOrDefault("PENDING", 0) > 0) return "PENDING";
        if (counts.getOrDefault("TODO", 0) > 0) return "TODO";
        return "DONE";
    }

    private TimeLog startRunningTimer(Integer taskId, Integer userId, boolean required) {
        TimeLog running = timeLogMapper.selectOne(
                new LambdaQueryWrapper<TimeLog>()
                        .eq(TimeLog::getTaskId, taskId)
                        .eq(TimeLog::getUserId, userId)
                        .isNull(TimeLog::getEndTime));
        if (running != null) {
            if (required) throw new RuntimeException("已有正在进行的计时，请先停止");
            return running;
        }

        TimeLog tl = new TimeLog();
        tl.setTaskId(taskId);
        tl.setUserId(userId);
        tl.setStartTime(LocalDateTime.now());
        timeLogMapper.insert(tl);
        return tl;
    }

    private TimeLog finishRunningTimer(Integer taskId, Integer userId, boolean required) {
        TimeLog tl = timeLogMapper.selectOne(
                new LambdaQueryWrapper<TimeLog>()
                        .eq(TimeLog::getTaskId, taskId)
                        .eq(TimeLog::getUserId, userId)
                        .isNull(TimeLog::getEndTime));
        if (tl == null) {
            if (required) throw new RuntimeException("没有正在进行的计时");
            return null;
        }

        tl.setEndTime(LocalDateTime.now());
        tl.setDuration((int) Duration.between(tl.getStartTime(), tl.getEndTime()).getSeconds());
        timeLogMapper.updateById(tl);

        Task task = taskMapper.selectOne(
                new LambdaQueryWrapper<Task>()
                        .eq(Task::getId, taskId)
                        .eq(Task::getUserId, userId));
        if (task != null) {
            task.setActualTime((task.getActualTime() == null ? 0 : task.getActualTime()) + tl.getDuration() / 60);
            task.setUpdateTime(LocalDateTime.now());
            taskMapper.updateById(task);
        }
        return tl;
    }
}
