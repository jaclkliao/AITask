-- ============================================================
-- 启动时执行的兼容性 DDL
-- 用于在已有数据库上做字段类型升级/补丁
-- ============================================================

-- 任务表 description: TEXT(65KB) -> MEDIUMTEXT(16MB)
-- 富文本中可能含 base64 图片，TEXT 容量不够会导致 Data too long
SET @sql := (
  SELECT IF(
    (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'task' AND COLUMN_NAME = 'description') = 'text',
    'ALTER TABLE task MODIFY COLUMN description MEDIUMTEXT',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 项目表 description 同样升级
SET @sql := (
  SELECT IF(
    (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND COLUMN_NAME = 'description') = 'text',
    'ALTER TABLE project MODIFY COLUMN description MEDIUMTEXT',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
