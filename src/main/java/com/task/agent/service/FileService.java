package com.task.agent.service;

import com.task.agent.entity.StoredFile;

public interface FileService {
    StoredFile upload(byte[] bytes, String originalFilename, String contentType, Integer userId);
    StoredFile getByUuid(String uuid);
    void deleteByUuid(String uuid);
}
