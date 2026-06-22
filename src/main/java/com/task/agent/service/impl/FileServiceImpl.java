package com.task.agent.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.task.agent.entity.StoredFile;
import com.task.agent.mapper.StoredFileMapper;
import com.task.agent.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileServiceImpl implements FileService {

    private final StoredFileMapper storedFileMapper;

    @Override
    public StoredFile upload(byte[] bytes, String originalFilename, String contentType, Integer userId) {
        StoredFile file = new StoredFile();
        file.setUserId(userId);
        file.setUuid(UUID.randomUUID().toString().replace("-", ""));
        file.setOriginalName(originalFilename);
        file.setContentType(contentType);
        file.setSize((long) bytes.length);
        file.setData(bytes);
        storedFileMapper.insert(file);
        return file;
    }

    @Override
    public StoredFile getByUuid(String uuid) {
        return storedFileMapper.selectOne(
                new LambdaQueryWrapper<StoredFile>().eq(StoredFile::getUuid, uuid));
    }

    @Override
    public void deleteByUuid(String uuid) {
        storedFileMapper.delete(
                new LambdaQueryWrapper<StoredFile>().eq(StoredFile::getUuid, uuid));
    }
}
