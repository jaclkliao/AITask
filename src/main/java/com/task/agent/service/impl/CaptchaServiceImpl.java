package com.task.agent.service.impl;

import com.task.agent.dto.response.CaptchaVO;
import com.task.agent.service.CaptchaService;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CaptchaServiceImpl implements CaptchaService {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final long TTL_SECONDS = 300;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, CaptchaItem> cache = new ConcurrentHashMap<>();

    @Override
    public CaptchaVO generate() {
        cleanup();
        String code = randomCode();
        String key = UUID.randomUUID().toString().replace("-", "");
        cache.put(key, new CaptchaItem(code, Instant.now().plusSeconds(TTL_SECONDS).toEpochMilli()));
        return new CaptchaVO(key, "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString(svg(code).getBytes(StandardCharsets.UTF_8)));
    }

    @Override
    public boolean verify(String key, String code) {
        if (key == null || code == null) return false;
        CaptchaItem item = cache.remove(key);
        if (item == null || item.expireAt < System.currentTimeMillis()) return false;
        return item.code.equalsIgnoreCase(code.trim());
    }

    private String randomCode() {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            code.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return code.toString();
    }

    private String svg(String code) {
        StringBuilder text = new StringBuilder();
        for (int i = 0; i < code.length(); i++) {
            int x = 16 + i * 24;
            int y = 33 + random.nextInt(8);
            int rotate = random.nextInt(24) - 12;
            text.append("<text x=\"").append(x).append("\" y=\"").append(y)
                    .append("\" transform=\"rotate(").append(rotate).append(" ").append(x).append(" ").append(y)
                    .append(")\" class=\"c\">").append(code.charAt(i)).append("</text>");
        }
        return """
                <svg xmlns="http://www.w3.org/2000/svg" width="128" height="44" viewBox="0 0 128 44">
                  <rect width="128" height="44" rx="8" fill="#f3f5f7"/>
                  <path d="M8 30 C30 8, 58 44, 120 14" stroke="#0a84ff" stroke-opacity=".26" stroke-width="2" fill="none"/>
                  <path d="M4 14 C35 42, 70 2, 124 34" stroke="#30d158" stroke-opacity=".24" stroke-width="2" fill="none"/>
                  <style>.c{font:700 24px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;fill:#1d1d1f;letter-spacing:2px}</style>
                """ + text + "</svg>";
    }

    private void cleanup() {
        long now = System.currentTimeMillis();
        cache.entrySet().removeIf(e -> e.getValue().expireAt < now);
    }

    private record CaptchaItem(String code, long expireAt) {}
}
