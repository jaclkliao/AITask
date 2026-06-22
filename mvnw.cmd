@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.  See the NOTICE file
@REM distributed with this work for additional information
@REM regarding copyright ownership.  The ASF licenses this file
@REM to you under the Apache License, Version 2.0 (the
@REM "License"); you may not use this file except in compliance
@REM with the License.  You may obtain a copy of the License at
@REM
@REM    https://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing,
@REM software distributed under the License is distributed on an
@REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
@REM KIND, either express or implied.  See the License for the
@REM specific language governing permissions and limitations
@REM under the License.
@REM ----------------------------------------------------------------------------

@REM ----------------------------------------------------------------------------
@REM Maven Start Up Batch script
@REM
@REM Required ENV vars:
@REM JAVA_HOME - location of a JDK home dir
@REM
@REM Optional ENV vars
@REM M2_HOME - location of maven2's installed home dir
@REM MAVEN_BATCH_ECHO - set to 'on' to enable the echoing of the batch commands
@REM MAVEN_BATCH_PAUSE - set to 'on' to wait for a keystroke before ending
@REM MAVEN_OPTS - parameters passed to the Java VM when running Maven
@REM     e.g. to debug Maven itself, use
@REM set MAVEN_OPTS=-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8000
@REM MAVEN_SKIP_RC - flag to disable loading of mavenrc files
@REM ----------------------------------------------------------------------------

@REM Determine the Java command to use to start the JVM.
if "%JAVA_HOME%" == "" goto error_java_home
set JAVA_EXE=%JAVA_HOME%\bin\java.exe
if not exist "%JAVA_EXE%" goto error_java_not_found
goto okJava

:error_java_home
echo ERROR: JAVA_HOME not found in your environment.
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java 17 installation.
goto end

:error_java_not_found
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME%
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java 17 installation.
goto end

:okJava
set DIRNAME=%~dp0
if "%DIRNAME%" == "" set DIRNAME=.
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

@REM Resolve any "." and ".." in APP_HOME to make it shorter.
for %%i in ("%APP_HOME%") do set APP_HOME=%%~fi

@REM Add default JVM options here.
set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m"

@REM Find maven-wrapper.jar, if it exists
set WRAPPER_JAR="%APP_HOME%\.mvn\wrapper\maven-wrapper.jar"
if exist %WRAPPER_JAR% goto run

@REM Download maven-wrapper.jar if not present
echo Downloading maven-wrapper.jar...
if exist %TEMP%\maven-wrapper-3.2.0.jar (
    copy %TEMP%\maven-wrapper-3.2.0.jar %WRAPPER_JAR%
    goto run
)
powershell -Command "&{[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar', '%TEMP%\maven-wrapper-3.2.0.jar')"
if exist %TEMP%\maven-wrapper-3.2.0.jar (
    copy %TEMP%\maven-wrapper-3.2.0.jar %WRAPPER_JAR%
) else (
    echo Failed to download maven-wrapper.jar
    echo Please ensure Maven is installed and add it to PATH, then run: mvn spring-boot:run
    goto end
)

:run
@REM Setup the command line
set MAVEN_CMD_LINE_ARGS=%*
set MAVEN_OPTS=%MAVEN_OPTS%
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% -jar %WRAPPER_JAR% %MAVEN_CMD_LINE_ARGS%

:end
@REM End of script
