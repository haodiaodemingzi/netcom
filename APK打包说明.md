# 📱 漫画阅读器 APK 打包说明

## 版本信息
- **应用名称**: 漫画阅读器
- **版本号**: 1.0.0
- **包名**: com.comicreader.app

---

## 🚀 方式一：使用EAS Build（推荐）

EAS Build是Expo提供的云端构建服务，可以避免本地环境配置问题，推荐使用。

### 1. 安装EAS CLI

```bash
npm install -g eas-cli
```

验证安装：
```bash
eas --version
```

### 2. 登录Expo账号

```bash
eas login
```

如果没有账号：
```bash
# 注册账号
eas register
```

检查登录状态：
```bash
eas whoami
```

### 3. 配置项目

```bash
cd c:\coding\netcom
eas build:configure
```

这会创建或更新 `eas.json` 配置文件。

### 4. 构建APK

#### 预览版APK（用于测试）

```bash
# 非交互式构建（适合CI/CD）
eas build -p android --profile preview --non-interactive

# 或交互式构建（会提示选择）
eas build -p android --profile preview
```

#### 生产版APK

```bash
eas build -p android --profile production --non-interactive
```

#### 查看构建状态

构建开始后，会显示构建日志链接，例如：
```
See logs: https://expo.dev/accounts/your-account/projects/comic-reader/builds/xxx
```

### 5. 下载APK

构建完成后：
- 在终端会显示下载链接
- 或访问构建日志页面下载
- 或使用命令：
```bash
eas build:list
```

### 6. EAS Build配置文件说明

`eas.json` 配置文件示例：

```json
{
  "cli": {
    "version": ">= 5.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### 7. EAS Build常见问题

**构建失败：**
- 检查依赖版本是否匹配 Expo SDK
- 运行 `npx expo-doctor` 检查项目配置
- 查看构建日志中的具体错误信息

**依赖版本不匹配：**
```bash
# 检查并修复依赖版本
npx expo install --check
npx expo install expo-av expo-file-system expo-media-library
```

---

## 🛠️ 方式二：本地构建（需要Android Studio）

### 前置要求

#### 1. 环境准备

- **安装Android Studio**：下载并安装最新版本
- **配置ANDROID_HOME环境变量**：
  ```bash
  # Windows (PowerShell)
  [System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\YourName\AppData\Local\Android\Sdk', 'User')
  
  # Windows (CMD)
  setx ANDROID_HOME "C:\Users\YourName\AppData\Local\Android\Sdk"
  
  # 验证
  echo %ANDROID_HOME%
  ```

- **安装JDK 17**（推荐）或 JDK 11+：
  ```bash
  # 检查Java版本
  java -version
  ```

- **配置Java路径**：在 `android/gradle.properties` 中添加：
  ```properties
  org.gradle.java.home=C:/Program Files/Java/jdk-17
  ```

#### 2. 检查依赖版本

```bash
cd c:\coding\netcom

# 检查依赖版本是否匹配
npx expo-doctor

# 如果发现版本不匹配，修复：
npx expo install --check
npx expo install expo-av expo-file-system expo-media-library expo-constants
```

### 构建步骤

#### 1. 安装项目依赖

```bash
cd c:\coding\netcom
npm install
```

如果遇到依赖冲突：
```bash
npm install --legacy-peer-deps
```

#### 2. 预构建原生代码

```bash
# 清理并重新生成原生代码
npx expo prebuild --clean
```

这会生成 `android/` 和 `ios/` 目录。

#### 3. 清理构建缓存

```bash
cd android
./gradlew clean
```

#### 4. 构建Release APK

**标准构建：**
```bash
cd android
./gradlew :app:assembleRelease
```

**带详细错误信息（推荐用于调试）：**
```bash
cd android
./gradlew :app:assembleRelease --stacktrace
```

**带完整调试信息：**
```bash
cd android
./gradlew :app:assembleRelease --stacktrace --info
```

#### 5. 找到生成的APK

构建成功后，APK位置：
```
android/app/build/outputs/apk/release/app-release.apk
```

#### 6. 验证APK

```bash
# 检查APK文件大小
ls -lh android/app/build/outputs/apk/release/app-release.apk

# Windows
dir android\app\build\outputs\apk\release\app-release.apk
```

### 本地构建常见问题

#### 问题1：Java版本错误

**错误信息：**
```
Dependency requires at least JVM runtime version 11. This build uses a Java 8 JVM.
```

**解决方法：**
1. 在 `android/gradle.properties` 中添加：
   ```properties
   org.gradle.java.home=C:/Program Files/Java/jdk-17
   ```
2. 停止Gradle守护进程：
   ```bash
   cd android
   ./gradlew --stop
   ```

#### 问题2：CMake构建失败

**错误信息：**
```
CMake Error: Target "expo-av" links to target "ReactAndroid::reactnativejni" but the target was not found.
```

**解决方法：**
1. 确保依赖版本正确：
   ```bash
   npx expo install --check
   ```
2. 清理CMake缓存：
   ```bash
   cd android
   ./gradlew clean
   ```
3. 重新运行prebuild：
   ```bash
   npx expo prebuild --clean
   ```

#### 问题3：新架构相关错误

如果使用 `react-native-reanimated`，必须启用新架构：
```properties
# android/gradle.properties
newArchEnabled=true
```

#### 问题4：依赖版本不匹配

运行检查：
```bash
npx expo-doctor
```

根据提示更新依赖：
```bash
npx expo install expo-av@~16.0.7 expo-file-system@~19.0.19 expo-media-library@~18.2.0
```

---

## 📦 方式三：使用Expo构建服务

### 快速构建

```bash
# 开发版APK（无需签名）
expo build:android -t apk

# 生产版AAB（Google Play）
expo build:android -t app-bundle
```

### 下载APK

```bash
# 查看构建状态
expo build:status

# 下载构建好的文件
expo build:download
```

---

## ⚙️ EAS Build配置文件

创建 `eas.json`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## 🔑 签名配置（生产环境）

### 生成密钥

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore comic-reader.keystore -alias comic-reader -keyalg RSA -keysize 2048 -validity 10000
```

### 配置gradle.properties

在 `android/gradle.properties` 添加：

```properties
MYAPP_RELEASE_STORE_FILE=comic-reader.keystore
MYAPP_RELEASE_KEY_ALIAS=comic-reader
MYAPP_RELEASE_STORE_PASSWORD=your_password
MYAPP_RELEASE_KEY_PASSWORD=your_password
```

---

## 📋 打包检查清单

### 打包前
- [ ] 修改后端API地址（指向服务器）
- [ ] 更新版本号
- [ ] 测试所有功能
- [ ] 检查权限配置
- [ ] 准备应用图标
- [ ] 准备启动页

### 打包后
- [ ] 安装测试
- [ ] 功能测试
- [ ] 性能测试
- [ ] 文件大小检查

---

## 🎨 修改后端地址

在打包前，修改 `utils/constants.js`:

```javascript
// 开发环境
// export const API_BASE_URL = 'http://localhost:5000/api';

// 生产环境 - 改为你的服务器地址
export const API_BASE_URL = 'https://your-server.com/api';
```

---

## 📊 APK大小优化

### 1. 启用Proguard

在 `android/app/build.gradle`:

```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

### 2. 分包构建

```gradle
splits {
    abi {
        enable true
        reset()
        include 'armeabi-v7a', 'arm64-v8a'
        universalApk false
    }
}
```

### 3. 移除不必要的语言

```gradle
android {
    defaultConfig {
        resConfigs "zh", "en"
    }
}
```

---

## ⚙️ 环境配置详解

### Java版本配置

项目需要Java 17（推荐）或Java 11+。

#### 检查Java版本
```bash
java -version
```

#### 配置Gradle使用指定Java版本

在 `android/gradle.properties` 文件中添加：
```properties
# 指定Java路径（根据实际安装路径修改）
org.gradle.java.home=C:/Program Files/Java/jdk-17
```

#### Windows路径格式说明
- 使用正斜杠 `/` 或双反斜杠 `\\`
- 示例：`C:/Program Files/Java/jdk-17` 或 `C:\\Program Files\\Java\\jdk-17`

### Android SDK配置

#### 设置ANDROID_HOME环境变量

**Windows PowerShell:**
```powershell
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\YourName\AppData\Local\Android\Sdk', 'User')
```

**Windows CMD:**
```cmd
setx ANDROID_HOME "C:\Users\YourName\AppData\Local\Android\Sdk"
```

**验证配置:**
```bash
echo $ANDROID_HOME  # Git Bash
echo %ANDROID_HOME%  # CMD
```

### Gradle配置优化

在 `android/gradle.properties` 中可以添加以下配置：

```properties
# JVM参数（增加内存）
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m

# 并行构建
org.gradle.parallel=true

# 指定Java版本
org.gradle.java.home=C:/Program Files/Java/jdk-17

# 新架构（react-native-reanimated需要）
newArchEnabled=true

# Hermes引擎
hermesEnabled=true
```

### 依赖版本检查

在构建前，务必检查依赖版本：

```bash
# 检查项目健康状态
npx expo-doctor

# 检查并修复依赖版本
npx expo install --check

# 手动更新关键依赖
npx expo install expo-av expo-file-system expo-media-library expo-constants
```

---

## 🐛 常见问题

### 1. 构建失败

```bash
# 清理缓存
npx expo start -c
rm -rf node_modules
npm install
```

### 2. 签名错误

```bash
# 重新生成密钥
keytool -delete -alias comic-reader -keystore comic-reader.keystore
keytool -genkeypair -v -storetype PKCS12 ...
```

### 3. 依赖冲突

```bash
# 使用legacy模式
npm install --legacy-peer-deps
```

### 4. Gradle构建失败（本地构建）

**查看详细错误：**
```bash
cd android
./gradlew :app:assembleRelease --stacktrace
```

**常见解决方案：**
```bash
# 1. 清理构建
cd android
./gradlew clean

# 2. 停止Gradle守护进程
./gradlew --stop

# 3. 重新预构建
cd ..
npx expo prebuild --clean

# 4. 检查Java版本配置
# 确保 android/gradle.properties 中有正确的Java路径
```

### 5. EAS Build失败

**查看构建日志：**
- 构建开始后会显示日志链接
- 访问链接查看详细错误信息

**常见原因：**
- 依赖版本不匹配 Expo SDK
- `app.json` 配置错误
- 环境变量未正确设置

**解决方法：**
```bash
# 检查项目配置
npx expo-doctor

# 修复依赖
npx expo install --check

# 重新构建
eas build -p android --profile preview --non-interactive
```

---

## 📤 发布到应用商店

### Google Play

1. 创建开发者账号（$25一次性费用）
2. 创建应用
3. 上传AAB文件
4. 填写应用信息
5. 提交审核

### 第三方商店

- 小米应用商店
- 华为应用市场
- OPPO软件商店
- vivo应用商店
- 腾讯应用宝

直接上传APK文件即可。

---

## 🎯 快速开始（推荐流程）

### 方式A：EAS Build（推荐，最简单）

```bash
# 1. 安装EAS CLI
npm install -g eas-cli

# 2. 登录Expo账号
eas login

# 3. 配置项目（首次需要）
cd c:\coding\netcom
eas build:configure

# 4. 构建APK
eas build -p android --profile preview --non-interactive

# 5. 等待构建完成（约10-15分钟），然后下载APK
```

### 方式B：本地构建（需要配置环境）

```bash
# 1. 检查环境
java -version  # 需要JDK 17
echo $ANDROID_HOME  # 需要配置Android SDK路径

# 2. 安装依赖
cd c:\coding\netcom
npm install

# 3. 检查依赖版本
npx expo-doctor
npx expo install --check

# 4. 预构建
npx expo prebuild --clean

# 5. 配置Java路径（在 android/gradle.properties）
# 添加：org.gradle.java.home=C:/Program Files/Java/jdk-17

# 6. 构建APK
cd android
./gradlew clean
./gradlew :app:assembleRelease --stacktrace

# 7. 找到APK
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 📞 技术支持

遇到问题？

1. 查看Expo文档: https://docs.expo.dev/
2. 查看EAS Build文档: https://docs.expo.dev/build/introduction/
3. 检查构建日志
4. 清理缓存重试
