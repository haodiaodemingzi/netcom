#!/bin/bash

echo "========================================"
echo "开始构建 APK (使用 Java 17)"
echo "========================================"
echo

# 设置 Java 17 环境变量
export JAVA_HOME="/c/Program Files/Java/jdk-17"
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
echo "步骤 1: 清理之前的构建"
echo "========================================"
cd android
./gradlew clean
if [ $? -ne 0 ]; then
    echo "清理失败！"
    exit 1
fi

echo
echo "========================================"
echo "步骤 2: 停止 Gradle 守护进程"
echo "========================================"
./gradlew --stop

echo
echo "========================================"
echo "步骤 3: 构建 Release APK"
echo "========================================"
./gradlew :app:assembleRelease --stacktrace
if [ $? -ne 0 ]; then
    echo
    echo "========================================"
    echo "构建失败！请检查上面的错误信息"
    echo "========================================"
    exit 1
fi

cd ..

echo
echo "========================================"
echo "构建成功！"
echo "========================================"
echo
echo "APK 位置:"
echo "android/app/build/outputs/apk/release/app-release.apk"
echo

# 检查文件是否存在
if [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
    echo "文件已生成，大小:"
    ls -lh android/app/build/outputs/apk/release/app-release.apk
    echo
    echo "构建完成！"
else
    echo "警告: 找不到生成的 APK 文件"
fi

