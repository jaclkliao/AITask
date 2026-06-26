package com.task.agent.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("notification")
public class Notification {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer userId;
    private Integer taskId;
    private Integer commentId;
    private Integer fromUserId;
    private String type;
    private String content;
    private Integer readStatus;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
