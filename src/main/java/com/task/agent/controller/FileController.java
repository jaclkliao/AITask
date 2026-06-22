package com.task.agent.controller;

import com.task.agent.common.result.Result;
import com.task.agent.entity.StoredFile;
import com.task.agent.security.AuthUserArgumentResolver.AuthUser;
import com.task.agent.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/file")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    @PostMapping("/upload")
    public Result<Map<String, String>> upload(@AuthUser Integer userId,
                                               @RequestParam("file") MultipartFile file) throws IOException {
        StoredFile sf = fileService.upload(
                file.getBytes(),
                file.getOriginalFilename(),
                file.getContentType(),
                userId);
        return Result.success(Map.of(
                "url", "/api/file/" + sf.getUuid(),
                "uuid", sf.getUuid()));
    }

    @GetMapping("/{uuid}")
    public ResponseEntity<Resource> getFile(@PathVariable String uuid) {
        StoredFile sf = fileService.getByUuid(uuid);
        if (sf == null) return ResponseEntity.notFound().build();

        Resource resource = new ByteArrayResource(sf.getData());
        String contentType = sf.getContentType() != null ? sf.getContentType() : "application/octet-stream";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .contentLength(sf.getSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(resource);
    }
}
