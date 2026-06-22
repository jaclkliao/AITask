package com.task.agent.scheduler;

import com.task.agent.entity.RemindPlan;
import com.task.agent.mapper.UserMapper;
import com.task.agent.service.RemindService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@EnableScheduling
@RequiredArgsConstructor
public class RemindScheduler {

    private final RemindService remindService;
    private final UserMapper userMapper;

    @Scheduled(fixedRate = 60000)
    public void checkReminds() {
        List<RemindPlan> unpushed = remindService.findUnpushedReminds();
        for (RemindPlan plan : unpushed) {
            log.info("===== 任务提醒推送 =====> {}", plan.getRemindContent());
            remindService.markPushed(plan.getId());
        }
    }

    @Scheduled(cron = "0 0 8 * * ?")
    public void dailyTodoPush() {
        userMapper.selectList(null).forEach(user -> {
            String content = remindService.getDailyTodoContent(user.getId());
            log.info("===== 每日待办 [{}] =====>\n{}", user.getUsername(), content);
        });
    }
}
