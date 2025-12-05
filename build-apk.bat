@echo off
chcp 65001 >nul
echo ========================================
echo 开始构建 APK (使用 Java 17)
echo ========================================
echo.

REM 设置 Java 17 环境变量
set JAVA_HOME=C:\Program Files\Java\jdk-17
set PATH=%JAVA_HOME%\bin;%PATH%

echo 检查 Java 版本...
java -version
echo.

echo 检查 Gradle 配置...
if not exist "android\gradle.properties" (
    echo 错误: android\gradle.properties 不存在
    pause
    exit /b 1
)

echo.
echo ========================================
echo 步骤 1: 清理之前的构建
echo ========================================
cd android
call gradlew.bat clean
if errorlevel 1 (
    echo 清理失败！
    pause
    exit /b 1
)

echo.
echo ========================================
echo 步骤 2: 停止 Gradle 守护进程
echo ========================================
call gradlew.bat --stop

echo.
echo ========================================
echo 步骤 3: 构建 Release APK
echo ========================================
call gradlew.bat :app:assembleRelease --stacktrace
if errorlevel 1 (
    echo.
    echo ========================================
    echo 构建失败！请检查上面的错误信息
    echo ========================================
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo 构建成功！
echo ========================================
echo.
echo APK 位置:
echo android\app\build\outputs\apk\release\app-release.apk
echo.

REM 检查文件是否存在
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    echo 文件已生成，大小:
    dir "android\app\build\outputs\apk\release\app-release.apk" | findstr "app-release.apk"
    echo.
    echo 构建完成！
) else (
    echo 警告: 找不到生成的 APK 文件
)

pause

