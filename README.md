# Java版任务AI Agent — V2.0 功能增强详细开发说明书

本版本为 **V2.0 功能增强版**，在 V1.0（MVP 极简版）基础上新增：用户登录与权限体系、项目管理、时间追踪、富文本编辑器（支持图片粘贴/粘贴上传）、任务二次编辑等功能。本说明书完整覆盖所有开发细节，适合单人 2 周完成开发。

---

# 一、V2.0 版本边界

## 1.1 新增功能范围（做）

### 用户体系
- 用户注册/登录（JWT Token 鉴权）
- 用户个人配置（工作时间、默认提醒时长）
- 多用户数据隔离，每个用户只能看到自己的任务

### 项目管理
- 项目 CRUD（创建/编辑/删除/查询）
- 任务归属项目，支持项目维度筛选
- 项目进度概览（已完成/总任务数）

### 时间追踪
- 任务实际耗时记录（开始计时/暂停/结束）
- 时间日志表（记录每次工作时间段）
- 项目累计耗时统计

### 富文本编辑器
- 任务描述支持富文本（基于 TinyMCE / Quill）
- 支持图片粘贴上传（Ctrl+V 直接粘贴）
- 图片存储至本地 `uploads/` 目录
- 支持图文混排

### 任务二次编辑
- AI 生成任务后可手动编辑全部字段
- 支持修改标题、描述、截止时间、优先级、状态
- 支持新增/删除/重排子任务
- 支持重新触发 AI 拆分

## 1.2 V1.0 保留功能

- ✅ H2 数据库（开发）/ MySQL（生产）
- ✅ 任务 CRUD（增强：支持编辑）
- ✅ AI 自然语言解析（增强：支持项目归属、标签）
- ✅ AI 复杂任务拆解
- ✅ 动态定时提醒
- ✅ 前后端交互页面

## 1.3 功能范围（不做）

- ❌ 无四象限、无数据统计仪表盘
- ❌ 无智能排期、无时间冲突检测
- ❌ 无复盘功能、无用户记忆
- ❌ 不接入本地私有大模型
- ❌ 无第三方平台推送（钉钉/飞书/微信）

---

# 二、技术栈与环境配置

## 2.1 基础技术栈

| 组件 | 版本 | 说明 |
|------|------|------|
| JDK | 17 | 必需 |
| Spring Boot | 3.2.5 | 主框架 |
| Mybatis-Plus | 3.5.9 | ORM |
| Spring Security | 6.x | 用户认证/授权 |
| JWT | jjwt 0.12.x | Token 鉴权 |
| H2 / MySQL | - | 开发/生产数据库 |
| Quartz | - | 定时任务 |
| OkHttp3 | 4.12.0 | LLM API 调用 |
| FastJSON2 | 2.0.48 | JSON 处理 |
| TinyMCE / Quill | - | 富文本编辑器 |
| Lombok + Hutool | - | 工具库 |

## 2.2 Pom 依赖（新增部分）

在 V1.0 依赖基础上，新增以下依赖：

```xml
<!-- Spring Security -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>

<!-- JWT -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.5</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
```

## 2.3 application.yml 配置（新增项）

```yaml
# 文件上传配置
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 20MB

# JWT 配置
jwt:
  secret: your-jwt-secret-key-at-least-256-bits-long
  expiration: 86400000  # 24小时

# 上传文件存储路径
app:
  upload-dir: uploads
```

---

# 三、项目目录结构（V2.0）

```plain text
com.task.agent
├── AgentApplication.java                    # 启动类
├── common/
│   ├── result/Result.java
│   ├── enums/
│   │   ├── TaskStatusEnum.java
│   │   ├── TaskPriorityEnum.java
│   │   └── ProjectStatusEnum.java
│   └── exception/GlobalExceptionHandler.java
├── config/
│   ├── SecurityConfig.java                  # [新增] Spring Security 配置
│   ├── CorsConfig.java
│   ├── MybatisPlusConfig.java
│   ├── QuartzConfig.java
│   └── WebMvcConfig.java                    # [新增] 静态资源配置
├── entity/
│   ├── User.java                            # [新增] 用户
│   ├── Project.java                         # [新增] 项目
│   ├── Task.java
│   ├── SubTask.java
│   ├── RemindPlan.java
│   ├── TimeLog.java                         # [新增] 时间日志
│   └── UserConfig.java
├── mapper/                                  # 对应实体 Mapper
├── dto/
│   ├── request/
│   │   ├── LoginDTO.java                    # [新增]
│   │   ├── RegisterDTO.java                 # [新增]
│   │   ├── NaturalTaskDTO.java
│   │   └── TaskUpdateDTO.java               # [新增] 任务编辑 DTO
│   └── response/
│       ├── LoginVO.java                     # [新增]
│       └── TaskVO.java                      # [新增]
├── controller/
│   ├── AuthController.java                  # [新增] 登录/注册
│   ├── TaskController.java
│   ├── ProjectController.java               # [新增] 项目管理
│   └── FileController.java                  # [新增] 图片上传
├── service/
│   ├── UserService.java                     # [新增]
│   ├── ProjectService.java                  # [新增]
│   ├── TaskService.java
│   ├── RemindService.java
│   ├── FileService.java                     # [新增] 文件存储
│   ├── TimeLogService.java                  # [新增] 时间追踪
│   └── impl/
├── security/                                # [新增] 安全模块
│   ├── JwtTokenProvider.java                # JWT 生成/验证
│   ├── JwtAuthenticationFilter.java         # JWT 过滤器
│   └── UserDetailsServiceImpl.java          # 用户加载
├── llm/
│   ├── LlmClient.java
│   └── LlmPromptFactory.java
├── agent/
│   ├── parser/NaturalTaskParser.java
│   └── planner/TaskDecomposePlanner.java
└── scheduler/
    └── RemindScheduler.java
```

---

# 四、数据库 SQL（V2.0 新增表）

## 4.1 用户表

```sql
CREATE TABLE `user` (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    email VARCHAR(100),
    avatar VARCHAR(255),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 4.2 项目表

```sql
CREATE TABLE project (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#4a6cf7',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 4.3 任务表（V2.0 增强字段）

```sql
CREATE TABLE task (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    project_id INT,                          -- [新增] 所属项目
    title VARCHAR(255) NOT NULL,
    description TEXT,                         -- [增强] 支持富文本 HTML
    deadline DATETIME,
    cost_time INT COMMENT '预估耗时(分钟)',
    actual_time INT DEFAULT 0 COMMENT '实际耗时(分钟)',  -- [新增]
    priority INT DEFAULT 2,
    status VARCHAR(20) DEFAULT 'TODO',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 4.4 子任务表（V2.0）

```sql
CREATE TABLE sub_task (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT,                             -- [改] parent_task_id → task_id
    content VARCHAR(255),
    status VARCHAR(20) DEFAULT 'TODO',
    sort INT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 4.5 时间日志表（新增）

```sql
CREATE TABLE time_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration INT COMMENT '耗时(秒)',
    description VARCHAR(255),
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 4.6 提醒计划表（V2.0 新增 user_id）

```sql
CREATE TABLE remind_plan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,                    -- [新增] 用户隔离
    task_id INT,
    remind_time DATETIME,
    remind_content VARCHAR(255),
    remind_type VARCHAR(20),
    push_status INT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 五、API 接口清单（V2.0 完整版）

## 5.1 认证接口

| 请求方式 | 接口地址 | 作用 |
|---------|---------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录，返回 JWT |
| GET | `/api/auth/me` | 获取当前用户信息 |

## 5.2 任务接口（增强）

| 请求方式 | 接口地址 | 作用 |
|---------|---------|------|
| POST | `/api/task/natural` | 自然语言新增任务（AI解析+拆解） |
| GET | `/api/task/list` | 查询任务列表（支持按项目/状态筛选） |
| GET | `/api/task/{id}` | 查询任务详情（含子任务、时间日志） |
| POST | `/api/task` | 手动新增任务 |
| PUT | `/api/task/{id}` | **[新增]** 编辑任务（所有字段） |
| PUT | `/api/task/status/{id}` | 修改任务状态 |
| DELETE | `/api/task/{id}` | 删除任务 |
| POST | `/api/task/{id}/decompose` | **[新增]** 重新 AI 拆解子任务 |
| POST | `/api/task/{id}/time/start` | **[新增]** 开始计时 |
| POST | `/api/task/{id}/time/stop` | **[新增]** 停止计时 |

## 5.3 项目接口（新增）

| 请求方式 | 接口地址 | 作用 |
|---------|---------|------|
| GET | `/api/project/list` | 查询项目列表 |
| POST | `/api/project` | 新增项目 |
| PUT | `/api/project/{id}` | 编辑项目 |
| DELETE | `/api/project/{id}` | 删除项目 |
| GET | `/api/project/{id}/stats` | 项目统计（任务数/进度/耗时） |

## 5.4 文件接口（新增）

| 请求方式 | 接口地址 | 作用 |
|---------|---------|------|
| POST | `/api/file/upload` | 上传图片（支持富文本粘贴） |
| GET | `/api/file/{filename}` | 获取图片（静态资源映射） |

---

# 六、核心功能设计

## 6.1 用户认证流程

```
用户注册 → 密码 BCrypt 加密入库 → 登录验证 → 下发 JWT Token
            ↓
     前端存储 Token 到 localStorage
            ↓
     每次请求在 Header 携带: Authorization: Bearer <token>
            ↓
     JwtAuthenticationFilter 解析 Token → 设置 SecurityContext
            ↓
     所有接口通过 @AuthenticationPrincipal 获取当前用户
```

## 6.2 图片粘贴上传流程

```
用户 Ctrl+V 粘贴图片
    ↓
前端拦截 paste 事件，提取 File 对象
    ↓
调用 POST /api/file/upload 上传
    ↓
后端保存至 uploads/{yyyyMM}/{uuid}.{ext}
    ↓
返回图片 URL: /api/file/{filename}
    ↓
前端插入 <img> 标签到富文本编辑器
```

**富文本建议使用 Quill.js**（轻量、支持粘贴上传、移动端友好）：
```javascript
// 前端粘贴上传示例
quill.clipboard.addMatcher(Node.ELEMENT_NODE, function(node, delta) {
    if (node.tagName === 'IMG') {
        // 处理粘贴的图片
    }
    return delta;
});
```

## 6.3 时间追踪流程

```
用户点击"开始计时"
    ↓
创建 TimeLog（start_time = now）
    ↓
前端每 10 秒轮询或本地计时
    ↓
用户点击"停止计时"
    ↓
更新 TimeLog（end_time = now, duration = 秒数）
    ↓
累加 task.actual_time
    ↓
重新计算项目总耗时
```

## 6.4 任务编辑与 AI 重拆分

```
AI 生成任务后，用户可以：
1. 直接编辑任意字段（标题/描述/时间/优先级）
2. 手动增删改子任务
3. 点击"重新 AI 拆分" → 调用 /decompose 接口
   → 后端删除旧子任务 → 重新调用 LLM → 生成新子任务
```

---

# 七、开发顺序（推荐）

| 阶段 | 天数 | 内容 |
|------|------|------|
| Phase 1 | 2天 | 用户注册/登录 + JWT 鉴权 + 数据隔离改造 |
| Phase 2 | 2天 | 项目管理 CRUD + 任务关联项目 |
| Phase 3 | 3天 | 富文本编辑器集成 + 图片粘贴上传 + 任务编辑 |
| Phase 4 | 2天 | 时间追踪（开始/停止/统计） |
| Phase 5 | 2天 | 前端页面适配 + 接口联调 + 自测修复 |
| Phase 6 | 1天 | 验收测试 + Bug 修复 |

---

# 八、V2.0 验收标准

- [ ] 注册新用户 → 登录 → 获取 Token → 正常访问接口
- [ ] 新建项目 → 在项目下通过自然语言创建任务
- [ ] AI 生成任务后，可手动编辑标题、描述（富文本）、截止时间
- [ ] 富文本中粘贴图片 → 图片自动上传并显示
- [ ] 任务开始计时 → 暂停 → 查看累计耗时
- [ ] 按项目筛选任务 → 查看项目进度统计
- [ ] 再次 AI 拆分 → 旧子任务被替换为新子任务
- [ ] 不同用户数据完全隔离
- [ ] 每日早8点推送当前用户的待办任务

---

> 本文档覆盖范围：用户体系、项目管理、富文本/图片粘贴、时间追踪、任务编辑。预计开发周期 12 天，单人可完成。
