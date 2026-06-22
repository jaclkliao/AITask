package com.task.agent.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("time_log")
public class TimeLog {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer taskId;
    private Integer userId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer duration;
    private String description;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
