package com.task.agent.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.task.agent.entity.Task;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TaskMapper extends BaseMapper<Task> {
}
