# 📱 漫画阅读器 APK 打包说明

## 版本信息
- **应用名称**: 漫画阅读器
- **版本号**: 1.0.0
- **包名**: com.comicreader.app

---

## 🚀 方式一：使用EAS Build（推荐）

### 1. 安装EAS CLI

```bash
npm install -g eas-cli
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

### 3. 配置项目

```bash
cd c:\coding\netcom
eas build:configure
```

### 4. 构建APK

```bash
# 构建APK (不需要Google Play签名)
eas build -p android --profile preview

# 或构建用于发布的AAB
eas build -p android --profile production
```

### 5. 下载APK

构建完成后，会得到一个下载链接，直接下载APK文件即可。

---

## 🛠️ 方式二：本地构建（需要Android Studio）

### 前置要求
- 安装Android Studio
- 配置ANDROID_HOME环境变量
- 安装JDK 11+

### 步骤

#### 1. 安装依赖

```bash
cd c:\coding\netcom
npm install
```

#### 2. 预构建

```bash
npx expo prebuild
```

#### 3. 构建APK

```bash
cd android
./gradlew assembleRelease
```

#### 4. 找到APK

APK位置：
```
android/app/build/outputs/apk/release/app-release.apk
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

```bash
# 1. 登录Expo
eas login

# 2. 配置EAS
eas build:configure

# 3. 构建APK
eas build -p android --profile preview

# 4. 等待构建完成（约10-15分钟）

# 5. 下载APK并安装测试
```

---

## 📞 技术支持

遇到问题？

1. 查看Expo文档: https://docs.expo.dev/
2. 查看EAS Build文档: https://docs.expo.dev/build/introduction/
3. 检查构建日志
4. 清理缓存重试
