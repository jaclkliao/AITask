@echo off
set JAVA_HOME=C:\Users\wen\Java\jdk-17.0.19+10
set PATH=C:\Users\wen\Java\jdk-17.0.19+10\bin;C:\ProgramData\apache-maven-3.9.6\bin;%PATH%
cd /d d:\liaojun\tools\AITask

if not exist logs mkdir logs

echo ==========================================
echo   Java Version Check
echo ==========================================
%JAVA_HOME%\bin\java -version
echo.
echo JAVA_HOME=%JAVA_HOME%
echo.

echo === 清理旧缓存（确保新版依赖生效）===
if exist target rmdir /s /q target
if exist "%USERPROFILE%\.m2\repository\com\baomidou" rmdir /s /q "%USERPROFILE%\.m2\repository\com\baomidou"
if exist "%USERPROFILE%\.m2\repository\org\mybatis\mybatis-spring" rmdir /s /q "%USERPROFILE%\.m2\repository\org\mybatis\mybatis-spring"
echo OK

echo.
echo === 重新编译 + 启动 Spring Boot ===
echo.
echo 完整日志: logs\AITask_full.log
echo.
call C:\ProgramData\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run > logs\AITask_full.log 2>&1

echo.
echo ===== 关键错误信息 =====
type logs\AITask_full.log | findstr /V "^\[INFO\] ^\[WARNING\] ^Picked"
echo ========================
echo.
echo 完整日志已保存到: logs\AITask_full.log
echo.
pause