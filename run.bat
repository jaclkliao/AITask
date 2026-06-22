@echo off
chcp 65001 >nul
set JAVA_HOME=C:\Users\wen\Java\jdk-17.0.19+10
set PATH=C:\Users\wen\Java\jdk-17.0.19+10\bin;C:\ProgramData\apache-maven-3.9.6\bin;%PATH%
cd /d d:\liaojun\tools\AITask
echo JAVA_HOME=%JAVA_HOME%
echo.
java -version
echo.
echo ===== Starting project =====
echo.
mvn spring-boot:run -e
pause
