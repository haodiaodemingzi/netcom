#!/bin/bash
set -e

echo "========================================"
echo "开始构建 APK (使用 Java 17)"
echo "========================================"
echo

# 支持外部传入 JAVA_HOME；未传则使用默认
JAVA_HOME_DEFAULT="/c/Program Files/Java/jdk-17"
export JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_DEFAULT}"
export PATH="$JAVA_HOME/bin:$PATH"

echo "检查 Java 版本..."
java -version
echo

echo "检查 Gradle 配置..."
if [ ! -f "android/gradle.properties" ]; then
    echo "错误: android/gradle.properties 不存在"
    exit 1
fi

echo
echo "========================================"
echo "清理旧生成文件与缓存"
echo "========================================"
rm -rf android/app/build \
       android/app/.cxx \
       node_modules/.cache \
       metro-cache \
       .expo \
       .expo-shared

echo
echo "========================================"
echo "停止 Gradle 守护进程"
echo "========================================"
(cd android && ./gradlew --stop || true)

echo
echo "========================================"
echo "构建 Release APK"
echo "========================================"
#(cd android && ./gradlew clean assembleRelease --stacktrace)
(cd /c/coding/netcom/android && export JAVA_HOME="/c/Program Files/Java/jdk-17" && ./gradlew.bat :app:assembleRelease)


echo
echo "========================================"
echo "构建完成"
echo "APK 位置: android/app/build/outputs/apk/release/app-release.apk"
echo "========================================"
if [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
    ls -lh android/app/build/outputs/apk/release/app-release.apk
else
    echo "警告: 未找到生成的 APK 文件，请检查上方日志"
fi

