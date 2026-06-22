package com.task.agent.dto.request;

import com.task.agent.entity.SubTask;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskUpdateDTO {
    private String title;
    private String description;
    private LocalDateTime deadline;
    private Integer costTime;
    private Integer priority;
    private String status;
    private Integer projectId;
    private List<SubTaskDTO> subTasks;

    @Data
    public static class SubTaskDTO {
        private Integer id;
        private String content;
        private String status;
        private Integer sort;
    }
}
