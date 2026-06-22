package com.task.agent.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("`file`")
public class StoredFile {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer userId;
    private String uuid;
    private String originalName;
    private String contentType;
    private Long size;
    private byte[] data;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
