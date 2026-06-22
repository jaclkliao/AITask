package com.task.agent.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_config")
public class UserConfig {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private String dailyWorkStart;
    private String dailyWorkEnd;
    private Integer defaultRemindMin;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
