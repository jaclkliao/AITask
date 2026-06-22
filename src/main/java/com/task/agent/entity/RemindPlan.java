package com.task.agent.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("remind_plan")
public class RemindPlan {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer userId;
    private Integer taskId;
    private LocalDateTime remindTime;
    private String remindContent;
    private String remindType;
    private Integer pushStatus;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
