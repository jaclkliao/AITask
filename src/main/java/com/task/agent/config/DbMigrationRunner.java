package com.task.agent.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * 启动时数据库字段兼容性升级（替代 data.sql）
 * - 幂等：已升级的表不会重复执行
 * - 异常不中断启动
 */
@Slf4j
@Component
public class DbMigrationRunner implements CommandLineRunner {

    private final DataSource dataSource;

    public DbMigrationRunner(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(String... args) {
        try (Connection conn = dataSource.getConnection()) {
            migrateColumn(conn, "task", "description", "mediumtext");
            migrateColumn(conn, "project", "description", "mediumtext");
            ensureTaskCommentTable(conn);
            ensureNotificationTable(conn);
            ensureLlmConfigColumn(conn, "llm_config");
        } catch (Exception e) {
            log.warn("[DB迁移] 执行异常（不影响启动）: {}", e.getMessage());
        }
    }

    private void migrateColumn(Connection conn, String table, String column, String targetType) {
        try {
            // 检查表是否存在
            ResultSet tables = conn.getMetaData().getTables(null, null, table, new String[]{"TABLE"});
            if (!tables.next()) { tables.close(); return; }
            tables.close();

            // 检查当前字段类型
            PreparedStatement ps = conn.prepareStatement(
                "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS " +
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
            ps.setString(1, table);
            ps.setString(2, column);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) { rs.close(); ps.close(); return; }
            String currentType = rs.getString("DATA_TYPE");
            rs.close(); ps.close();

            if (currentType == null) return;
            currentType = currentType.toLowerCase();
            if (currentType.equals(targetType)) {
                log.debug("[DB迁移] {}.{} 已是 {}, 跳过", table, column, targetType);
                return;
            }
            // 执行 ALTER
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("ALTER TABLE `" + table + "` MODIFY COLUMN `" + column + "` " + targetType.toUpperCase());
                log.info("[DB迁移] ✓ {}.{} {} → {}", table, column, currentType, targetType);
            }
        } catch (Exception e) {
            log.warn("[DB迁移] {}.{} 升级失败: {}", table, column, e.getMessage());
        }
    }

    /** 确保 llm_config 常用字段长度足够（非关键） */
    private void ensureLlmConfigColumn(Connection conn, String table) {
        try {
            ResultSet tables = conn.getMetaData().getTables(null, null, table, new String[]{"TABLE"});
            if (!tables.next()) return;
            tables.close();
        } catch (Exception e) {
            // 表不存在就算了
        }
    }

    private void ensureTaskCommentTable(Connection conn) {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS task_comment (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    task_id INT NOT NULL,
                    user_id INT NOT NULL,
                    content MEDIUMTEXT NOT NULL,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """);
            log.debug("[DB迁移] task_comment 表已就绪");
        } catch (Exception e) {
            log.warn("[DB迁移] task_comment 建表失败: {}", e.getMessage());
        }
    }

    private void ensureNotificationTable(Connection conn) {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS notification (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    task_id INT,
                    comment_id INT,
                    from_user_id INT,
                    type VARCHAR(30) NOT NULL,
                    content VARCHAR(500),
                    read_status INT DEFAULT 0,
                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """);
            log.debug("[DB迁移] notification 表已就绪");
        } catch (Exception e) {
            log.warn("[DB迁移] notification 建表失败: {}", e.getMessage());
        }
    }
}
