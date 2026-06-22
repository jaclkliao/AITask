# Java版任务AI Agent — V1\.0 最简落地详细开发说明书

本版本为**极简最小可用版本（MVP）**，剔除排期、四象限、冲突检测、记忆、前端复杂图表等高级功能；仅实现：数据库基础结构、任务CRUD、自然语言AI解析任务、自动拆解复杂任务、定时消息提醒。单人3天即可完成完整开发，适合快速上手验证AI Agent架构。

# 一、V1\.0 版本边界（明确做与不做）

## 1\.1 功能范围（做）

- 开发环境H2数据库，开箱即用，无需安装MySQL

- 完整任务管理：新增/删除/修改状态/查询任务

- AI自然语言解析：一句话自动生成结构化任务

- AI复杂任务拆解：超过4小时任务自动拆分子任务

- 动态定时提醒：任务前置提醒、每日早8点推送当日待办

- 极简前后端交互页面

## 1\.2 功能范围（不做）

- 无登录、无用户体系，全局单用户模式

- 无智能排期、无时间冲突检测

- 无四象限、无数据统计、无复盘功能

- 无用户记忆、无智能问答、无第三方平台推送

- 不接入本地私有大模型，仅支持云端LLM API（DeepSeek/通义千问）

# 二、技术栈 \&amp; 环境配置

## 2\.1 基础技术栈

- JDK：17

- 框架：SpringBoot 3\.2\.5

- ORM：Mybatis\-Plus 3\.5\.5

- 数据库：H2 内存数据库（开发）

- 定时任务：Quartz

- AI调用：OkHttp3 \+ FastJSON2

- 工具：Lombok、Hutool

## 2\.2 完整Pom依赖（直接复制）

```xml
<dependencies>
    <!-- Spring Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <!-- 定时任务Quartz -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-quartz</artifactId>
    </dependency>
    <!-- 参数校验 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <!-- H2内存数据库 -->
    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <scope>runtime</scope>
    </dependency>
    <!-- Mybatis-Plus -->
    <dependency>
        <groupId>com.baomidou</groupId>
        <artifactId>mybatis-plus-boot-starter</artifactId>
        <version>3.5.5</version>
    </dependency>
    <!-- 工具类 -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
    <dependency>
        <groupId>cn.hutool</groupId>
        <artifactId>hutool-all</artifactId>
        <version>5.8.32</version>
    </dependency>
    <!-- Http & JSON -->
    <dependency>
        <groupId>com.squareup.okhttp3</groupId>
        <artifactId>okhttp</artifactId>
        <version>4.12.0</version>
    </dependency>
    <dependency>
        <groupId>com.alibaba.fastjson2</groupId>
        <artifactId>fastjson2</artifactId>
        <version>2.0.48</version>
    </dependency>
</dependencies>
```

## 2\.3 application\.yml 配置（直接复制）

```yaml
server:
  port: 8080
spring:
  # H2数据库配置
  datasource:
    driver-class-name: org.h2.Driver
    url: jdbc:h2:mem:taskagent;DB_CLOSE_DELAY=-1
    username: root
    password: 123456
  h2:
    console:
      enabled: true
mybatis-plus:
  configuration:
    map-underscore-to-camel-case: true
  global-config:
    db-config:
      id-type: auto
# 自定义LLM配置
llm:
  api-key: 你的大模型API密钥
  api-url: https://api.deepseek.com/v1/chat/completions
  timeout: 15000
```

# 三、项目目录（V1\.0专属精简版）

```plain text
com.task.agent
├── AgentApplication.java          # 启动类
├── common/                       # 公共模块
│   ├── result/Result.java        # 统一返回体
│   ├── enums/TaskStatusEnum.java # 任务状态枚举
│   └── exception/GlobalExceptionHandler.java
├── config/                       # 配置类
│   ├── MybatisPlusConfig.java
│   ├── CorsConfig.java
│   └── QuartzConfig.java
├── entity/                       # 数据库实体
│   ├── Task.java                 # 主任务
│   ├── SubTask.java              # 子任务
│   ├── RemindPlan.java           # 提醒计划
│   └── UserConfig.java           # 用户配置
├── mapper/                       # DAO层
├── dto/                          # 请求DTO
│   └── NaturalTaskDTO.java       # 自然语言入参
├── controller/
│   └── TaskController.java       # 全部接口
├── service/
│   ├── TaskService.java
│   ├── RemindService.java
│   └── impl/
├── llm/                          # 大模型调用
│   ├── LlmClient.java
│   └── LlmPromptFactory.java
├── agent/                        # Agent核心
│   ├── parser/NaturalTaskParser.java
│   └── planner/TaskDecomposePlanner.java
└── scheduler/                    # 定时提醒
    └── RemindScheduler.java
```

# 四、数据库SQL脚本（schema\.sql）

放置于resources/db/schema\.sql，项目启动自动执行，仅4张核心表，剔除冗余字段

```sql
-- 用户配置表（单用户）
CREATE TABLE user_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    daily_work_start VARCHAR(20),
    daily_work_end VARCHAR(20),
    default_remind_min INT DEFAULT 15,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO user_config(daily_work_start,daily_work_end,default_remind_min) VALUES ('09:00','18:00',15);

-- 任务主表
CREATE TABLE task (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline DATETIME,
    cost_time INT COMMENT '预估耗时(分钟)',
    priority INT DEFAULT 2 COMMENT '1高 2中 3低',
    status VARCHAR(20) DEFAULT 'TODO',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 子任务表
CREATE TABLE sub_task (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parent_task_id INT,
    content VARCHAR(255),
    status VARCHAR(20) DEFAULT 'TODO',
    sort INT DEFAULT 0,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 提醒计划表
CREATE TABLE remind_plan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT,
    remind_time DATETIME,
    remind_content VARCHAR(255),
    remind_type VARCHAR(20),
    push_status INT DEFAULT 0 COMMENT '0未推送 1已推送',
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

# 五、核心公共类代码

## 5\.1 统一返回结果 Result

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Result<T> {
    private Integer code;
    private String msg;
    private T data;

    public static <T> Result<T> success(T data){
        return new Result<>(200,"success",data);
    }
    public static <T> Result<T> fail(String msg){
        return new Result&lt;&gt;(500,msg,null);
    }
}
```

## 5\.2 任务状态枚举 TaskStatusEnum

```java
public enum TaskStatusEnum {
    TODO,DOING,DONE,OVERDUE
}
```

# 六、LLM与Agent核心（V1\.0核心重中之重）

## 6\.1 固定Prompt（指令解析专用）

功能：接收用户自然语言，强制返回固定JSON结构，自动提取任务信息

```plain text
你是个人任务管理助手，请解析用户输入的任务，严格按照JSON格式返回，禁止返回多余文字。
字段说明：
title:任务标题(简短)
description:任务详细描述
deadline:截止时间(yyyy-MM-dd HH:mm:ss，无则填null)
costTime:预估耗时(单位分钟，整数)
priority:优先级 1高 2中 3低

用户任务：{{content}}
```

## 6\.2 任务拆解专用Prompt

```plain text
你是任务拆解专家，请将复杂任务拆分为多个可直接执行的子任务，返回JSON数组，仅返回数组：
[{content:"子任务内容"}]
任务内容：{{taskContent}}
```

## 6\.3 LlmClient 大模型请求工具类

```java
@Component
public class LlmClient {
    @Value("${llm.api-key}")
    private String apiKey;
    @Value("${llm.api-url}")
    private String apiUrl;
    @Value("${llm.timeout}")
    private long timeout;

    private final OkHttpClient client;

    public LlmClient(){
        this.client = new OkHttpClient.Builder()
                .callTimeout(timeout, TimeUnit.MILLISECONDS)
                .build();
    }

    public String chat(String prompt){
        Map<String,Object> message = new HashMap<>();
        message.put("role","user");
        message.put("content",prompt);

        List<Map<String,Object>> messages = Collections.singletonList(message);
        Map<String,Object> body = new HashMap<>();
        body.put("model","deepseek-chat");
        body.put("messages",messages);
        body.put("temperature",0.2);

        Request request = new Request.Builder()
                .url(apiUrl)
                .addHeader("Authorization","Bearer "+apiKey)
                .addHeader("Content-Type","application/json")
                .post(RequestBody.create(JSON.toJSONString(body), MediaType.get("application/json")))
                .build();
        try(Response response = client.newCall(request).execute()){
            if(!response.isSuccessful()) return null;
            String resBody = response.body().string();
            JSONObject json = JSON.parseObject(resBody);
            return json.getJSONArray("choices")
                    .getJSONObject(0)
                    .getJSONObject("message")
                    .getString("content");
        }catch (Exception e){
            e.printStackTrace();
            return null;
        }
    }
}
```

## 6\.4 自然语言解析器（完整源码）

作用：接收用户一句话，调用LLM解析为结构化任务，内置JSON容错、字段兜底，解决大模型返回多余文本导致解析失败问题

```java
@Component
@RequiredArgsConstructor
public class NaturalTaskParser {

    private final LlmClient llmClient;
    private final LlmPromptFactory promptFactory;

    /**
     * 解析自然语言任务
     * @param content 用户原始口语化任务
     * @return 结构化任务DTO
     */
    public TaskParseDTO parse(String content){
        // 获取拼装完整Prompt
        String prompt = promptFactory.getTaskParsePrompt(content);
        String res = llmClient.chat(prompt);
        if(StrUtil.isBlank(res)){
            throw new RuntimeException("AI任务解析失败，请稍后重试");
        }
        // 清洗LLM返回内容，剔除markdown代码块符号
        res = cleanJsonContent(res);
        try {
            return JSON.parseObject(res, TaskParseDTO.class);
        }catch (Exception e){
            throw new RuntimeException("任务数据解析异常，请优化任务描述");
        }
    }

    /**
     * 清洗JSON：剔除```json、```等无用字符
     */
    private String cleanJsonContent(String content){
        content = content.replace("```json","");
        content = content.replace("```","");
        return content.trim();
    }

    /**
     * 内部DTO：接收解析后的结构化任务
     */
    @Data
    public static class TaskParseDTO{
        private String title;
        private String description;
        private LocalDateTime deadline;
        private Integer costTime;
        private Integer priority;
    }
}
```

## 6\.5 任务拆解器（完整源码）

作用：判断任务是否超4小时，自动拆解复杂任务，返回子任务集合，适配主任务批量入库

```java
@Component
@RequiredArgsConstructor
public class TaskDecomposePlanner {

    private final LlmClient llmClient;
    private final LlmPromptFactory promptFactory;

    // 复杂任务阈值：4小时 = 240分钟
    private static final Integer COMPLEX_TASK_THRESHOLD = 240;

    /**
     * 判断是否需要拆解
     */
    public boolean needDecompose(Integer costTime){
        return costTime != null && costTime > COMPLEX_TASK_THRESHOLD;
    }

    /**
     * 拆解复杂任务
     * @param taskContent 主任务内容
     * @return 子任务文本集合
     */
    public List<String> decompose(String taskContent){
        String prompt = promptFactory.getTaskDecomposePrompt(taskContent);
        String res = llmClient.chat(prompt);
        if(StrUtil.isBlank(res)){
            return Collections.emptyList();
        }
        res = cleanJsonContent(res);
        try {
            List<SubTaskDTO> subTaskList = JSON.parseArray(res, SubTaskDTO.class);
            return subTaskList.stream().map(SubTaskDTO::getContent).toList();
        }catch (Exception e){
            return Collections.emptyList();
        }
    }

    private String cleanJsonContent(String content){
        content = content.replace("```json","");
        content = content.replace("```","");
        return content.trim();
    }

    @Data
    public static class SubTaskDTO{
        private String content;
    }
}
```

## 6\.6 Prompt工厂类（补充缺失，统一管理提示词）

```java
@Component
public class LlmPromptFactory {

    // 任务解析模板
    private static final String TASK_PARSE_TEMPLATE = "你是个人任务管理助手，请解析用户输入的任务，严格按照JSON格式返回，禁止返回多余文字。\n" +
            "字段说明：\n" +
            "title:任务标题(简短)\n" +
            "description:任务详细描述\n" +
            "deadline:截止时间(yyyy-MM-dd HH:mm:ss，无则填null)\n" +
            "costTime:预估耗时(单位分钟，整数)\n" +
            "priority:优先级 1高 2中 3低\n\n" +
            "用户任务：%s";

    // 任务拆解模板
    private static final String TASK_DECOMPOSE_TEMPLATE = "你是任务拆解专家，请将复杂任务拆分为多个可直接执行的子任务，返回JSON数组，仅返回数组，不要多余解释：\n" +
            "[{content:\"子任务内容\"}]\n" +
            "任务内容：%s";

    public String getTaskParsePrompt(String content){
        return String.format(TASK_PARSE_TEMPLATE,content);
    }

    public String getTaskDecomposePrompt(String taskContent){
        return String.format(TASK_DECOMPOSE_TEMPLATE,taskContent);
    }
}
```

自动调用LLM，把口语转为结构化任务，自动捕获JSON异常并兜底

# 七、V1\.0 全部接口清单（前端直接对接）

|请求方式|接口地址|作用|
|---|---|---|
|POST|/api/task/natural|自然语言新增任务（AI解析\+拆解）|
|GET|/api/task/list|查询全部主任务|
|GET|/api/task/sub/\{parentId\}|查询对应子任务|
|PUT|/api/task/status/\{id\}|修改任务状态|
|DELETE|/api/task/\{id\}|删除任务（级联删除子任务、提醒）|

# 八、开发顺序（照着顺序做，零踩坑）

1. 创建项目，导入pom依赖，配置yml

2. 执行schema\.sql，生成数据表

3. 编写Entity、Mapper、统一返回类、枚举

4. 编写Mybatis、跨域、Quartz基础配置

5. 开发LlmClient大模型调用类，测试API连通性

6. 开发Agent解析器、任务拆解器

7. 开发TaskService，整合AI解析、拆解、提醒创建

8. 开发Controller接口，完成后端闭环

9. 导入极简Vue前端页面，对接接口调试

# 九、V1\.0验收标准（开发完成自测）

- 启动项目，访问H2控制台能够正常查看4张数据表

- 输入短句：**今天晚上完成项目方案，耗时2小时**，可自动解析并生成任务

- 输入复杂任务：**三天内完成Java Agent项目开发**，自动拆解多条子任务

- 新增任务自动生成前置提醒，定时可正常触发

- 每日早上8点自动推送当日所有待办任务

> （注：文档部分内容可能由 AI 生成）
