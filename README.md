# 漫画阅读器

一个基于 React Native + Expo 开发的全平台漫画阅读应用。

## 功能特性

- 📱 支持 Android、iOS、Web 全平台
- 🎨 Google Play 风格的现代化 UI
- 📖 流畅的漫画阅读体验
- 🔍 强大的搜索和筛选功能
- ⭐ 收藏和历史记录管理
- 🌙 夜间模式支持
- 💾 图片缓存和预加载

## 技术栈

### 前端
- React Native + Expo
- React Navigation
- React Native Paper
- Axios

### 后端
- Python + Flask
- BeautifulSoup (数据采集)
- Redis (缓存)

## 快速开始

### 前端

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 在 Android 上运行
npm run android

# 在 iOS 上运行
npm run ios

# 在 Web 上运行
npm run web
```

### 后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务器
python app.py
```

## 项目结构

```
comic-reader/
├── app/                    # 前端页面
├── components/             # 可复用组件
├── services/              # API 服务
├── utils/                 # 工具函数
├── backend/               # 后端服务
└── assets/                # 静态资源
```

## 开发计划

- [x] 项目基础架构
- [ ] 后端 API 开发
- [ ] 首页和搜索功能
- [ ] 漫画详情页
- [ ] 阅读器功能
- [ ] 个人中心

## 许可证

MIT
