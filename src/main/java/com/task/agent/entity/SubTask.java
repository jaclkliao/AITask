package com.task.agent.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("sub_task")
public class SubTask {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer taskId;
    private Integer userId;
    private String content;
    private String status;
    private Integer sort;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
