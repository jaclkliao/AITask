-- 用户配置表
CREATE TABLE IF NOT EXISTS user_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    daily_work_start VARCHAR(20),
    daily_work_end VARCHAR(20),
    default_remind_min INT DEFAULT 15,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO user_config(daily_work_start,daily_work_end,default_remind_min) VALUES ('09:00','18:00',15);

-- 用户表
CREATE TABLE IF NOT EXISTS `user` (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    email VARCHAR(100),
    avatar VARCHAR(255),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 项目表
CREATE TABLE IF NOT EXISTS project (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description MEDIUMTEXT,
    color VARCHAR(20) DEFAULT '#4a6cf7',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 任务主表
CREATE TABLE IF NOT EXISTS task (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    project_id INT,
    title VARCHAR(255) NOT NULL,
    description MEDIUMTEXT,
    deadline DATETIME,
    cost_time INT COMMENT '预估耗时(分钟)',
    actual_time INT DEFAULT 0 COMMENT '实际耗时(分钟)',
    priority INT DEFAULT 2 COMMENT '1高 2中 3低',
    status VARCHAR(20) DEFAULT 'TODO',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 子任务表
CREATE TABLE IF NOT EXISTS sub_task (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    content VARCHAR(255),
    status VARCHAR(20) DEFAULT 'TODO',
    sort INT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 提醒计划表
CREATE TABLE IF NOT EXISTS remind_plan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    task_id INT,
    remind_time DATETIME,
    remind_content VARCHAR(255),
    remind_type VARCHAR(20),
    push_status INT DEFAULT 0 COMMENT '0未推送 1已推送',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 时间日志表
CREATE TABLE IF NOT EXISTS time_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration INT COMMENT '耗时(秒)',
    description VARCHAR(255),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 任务评论表
CREATE TABLE IF NOT EXISTS task_comment (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    content MEDIUMTEXT NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 通知表（用于评论 @ 用户）
CREATE TABLE IF NOT EXISTS notification (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    task_id INT,
    comment_id INT,
    from_user_id INT,
    type VARCHAR(30) NOT NULL,
    content VARCHAR(500),
    read_status INT DEFAULT 0 COMMENT '0未读 1已读',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文件存储表（图片等二进制数据）
CREATE TABLE IF NOT EXISTS `file` (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    uuid VARCHAR(64) NOT NULL UNIQUE,
    original_name VARCHAR(255),
    content_type VARCHAR(100),
    size BIGINT,
    data MEDIUMBLOB NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LLM 配置表（每用户一份）
CREATE TABLE IF NOT EXISTS llm_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    provider VARCHAR(50),
    api_key VARCHAR(500),
    api_url VARCHAR(500),
    model VARCHAR(100),
    temperature DECIMAL(3,2) DEFAULT 0.20,
    timeout INT DEFAULT 30000,
    max_tokens INT DEFAULT 2000,
    enabled INT DEFAULT 1,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
