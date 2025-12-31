# 播客功能模块实现计划

## 需求概述

新增"播客"功能模块，后端提供API（参考喜马拉雅），前端分阶段实现：
- **阶段1**: 后端API + Flutter页面框架 + 底部导航
- **阶段2**: 播客详情页 + 基础音频播放器
- **阶段3**: 收藏 + 播放历史 + 后台播放

---

## API 接口文档（后端需实现）

### 基础信息
- **Base URL**: `/api/podcast` (独立 blueprint)
- **source 参数**: 用于指定数据源，默认 `ximalaya`
- **分页参数**: `page` (默认1), `limit` (默认20)
- **响应格式**: 与 comic/video/ebook 保持一致，使用 `success_response` 包装

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/podcast/sources` | 获取所有可用数据源 |
| GET | `/api/podcast/categories` | 获取分类列表 |
| GET | `/api/podcast/programs` | 获取播客节目列表 |
| GET | `/api/podcast/programs/hot` | 获取热门播客 |
| GET | `/api/podcast/programs/latest` | 获取最新播客 |
| GET | `/api/podcast/programs/<id>` | 获取播客详情 |
| GET | `/api/podcast/programs/<id>/episodes` | 获取节目单集列表 |
| GET | `/api/podcast/episodes/<id>` | 获取单集详情（含音频地址） |
| GET | `/api/podcast/search` | 搜索播客 |

> 注: 播客使用独立的 blueprint，与 comic/video/ebook 保持相同架构模式

---

### 1. 获取数据源列表

**请求:**
```
GET /api/podcast/sources
```

**响应:**
```json
{
  "success": true,
  "data": {
    "sources": {
      "ximalaya": {
        "id": "ximalaya",
        "name": "喜马拉雅",
        "enabled": true
      },
      "lizhi": {
        "id": "lizhi",
        "name": "荔枝FM",
        "enabled": true
      }
    }
  }
}
```

### 2. 获取分类列表

**请求:**
```
GET /api/podcast/categories?source=ximalaya
```

**响应:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {"id": "all", "name": "全部"},
      {"id": "有声书", "name": "有声书"},
      {"id": "相声评书", "name": "相声评书"},
      {"id": "音乐", "name": "音乐"},
      {"id": "情感", "name": "情感"},
      {"id": "知识", "name": "知识"},
      {"id": "儿童", "name": "儿童"},
      {"id": "历史", "name": "历史"}
    ]
  }
}
```

### 3. 获取播客节目列表（按分类）

**请求:**
```
GET /api/podcast/programs?category=有声书&page=1&limit=20&source=ximalaya
```

**响应:**
```json
{
  "success": true,
  "data": {
    "programs": [
      {
        "id": "123456",
        "title": "三国演义",
        "cover": "https://example.com/cover.jpg",
        "author": "单田芳",
        "source": "ximalaya",
        "episodes": 200,
        "description": "经典评书三国演义...",
        "updateTime": "2024-01-15"
      }
    ],
    "hasMore": true,
    "total": 100
  }
}
```

### 4. 获取热门播客

**请求:**
```
GET /api/podcast/programs/hot?page=1&limit=20&source=ximalaya
```

**响应格式同 programs 接口**

### 5. 获取最新播客

**请求:**
```
GET /api/podcast/programs/latest?page=1&limit=20&source=ximalaya
```

**响应格式同 programs 接口**

### 6. 获取播客详情

**请求:**
```
GET /api/podcast/programs/123456?source=ximalaya
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "123456",
    "title": "三国演义",
    "cover": "https://example.com/cover.jpg",
    "author": "单田芳",
    "source": "ximalaya",
    "episodes": 200,
    "description": "经典评书三国演义...",
    "playCount": "1.2亿",
    "updateTime": "2024-01-15"
  }
}
```

### 7. 获取节目单集列表

**请求:**
```
GET /api/podcast/programs/123456/episodes?page=1&limit=50&source=ximalaya
```

**响应:**
```json
{
  "success": true,
  "data": {
    "episodes": [
      {
        "id": "ep_001",
        "title": "第一回 桃园三结义",
        "duration": 1800,
        "publishTime": "2020-01-01",
        "order": 1,
        "isPlayed": false,
        "progress": 0
      },
      {
        "id": "ep_002",
        "title": "第二回 张飞怒打督邮",
        "duration": 2100,
        "publishTime": "2020-01-08",
        "order": 2,
        "isPlayed": true,
        "progress": 2100
      }
    ],
    "hasMore": false,
    "total": 200
  }
}
```

### 8. 获取单集详情（含音频地址）

**请求:**
```
GET /api/podcast/episodes/ep_001?source=ximalaya
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "ep_001",
    "title": "第一回 桃园三结义",
    "programId": "123456",
    "programTitle": "三国演义",
    "duration": 1800,
    "publishTime": "2020-01-01",
    "audioUrl": "https://example.com/audio.mp3",
    "audioUrlBackup": "https://backup.example.com/audio.mp3"
  }
}
```

### 9. 搜索播客

**请求:**
```
GET /api/podcast/search?keyword=三国&page=1&limit=20&source=ximalaya
```

**响应:**
```json
{
  "success": true,
  "data": {
    "programs": [
      {
        "id": "123456",
        "title": "三国演义",
        "cover": "https://example.com/cover.jpg",
        "author": "单田芳",
        "source": "ximalaya",
        "episodes": 200
      }
    ],
    "hasMore": false,
    "total": 1
  }
}
```

---

## Flutter 前端实现

### 目录结构

```
flutter_app/lib/features/podcast/
├── podcast_page.dart              # 主页面
├── podcast_provider.dart          # 状态管理
├── podcast_models.dart            # 数据模型
├── podcast_detail_page.dart       # 详情页
└── data/
    └── podcast_remote_service.dart # 网络服务

flutter_app/lib/components/
└── podcast_card.dart              # 播客卡片组件
```

### 数据模型

```dart
// 播客分类
class PodcastCategory {
  final String id;
  final String name;
}

// 播客数据源信息
class PodcastSourceInfo {
  final String id;
  final String name;
  final bool enabled;
}

// 播客摘要
class PodcastSummary {
  final String id;
  final String title;
  final String cover;
  final String source;
  final String? author;
  final int episodes;
  final String? description;
}

// 播客详情
class PodcastDetail {
  final String id;
  final String title;
  final String cover;
  final String source;
  final String? author;
  final int episodes;
  final String? description;
  final String? playCount;
}

// 播客单集
class PodcastEpisode {
  final String id;
  final String title;
  final int duration;
  final String? publishTime;
  final int order;
  final bool isPlayed;
  final int progress;
  final String? audioUrl;

  String get formattedDuration => '${duration ~/ 60}:${(duration % 60).toString().padLeft(2, '0')}';
}
```

### 状态管理

参考 `videos_provider.dart` 实现：
- `PodcastsState`: podcasts, categories, selectedCategory, loading, error...
- `PodcastsNotifier`: refresh(), loadMore(), search(), selectCategory()...

### 页面布局

与 `videos_page.dart` 一致：
```
Scaffold
└─ CustomScrollView
    ├─ SliverAppBar (标题 + 搜索/源切换/视图/刷新)
    ├─ _SourceTabBar
    ├─ _CategoryBar
    ├─ 内容区域 (Grid/List)
    └─ 底部加载更多
```

---

## 新增文件清单

| 文件 | 路径 | 状态 |
|------|------|------|
| 模型 | `flutter_app/lib/features/podcast/podcast_models.dart` | ✅ 已完成 |
| 远程服务 | `flutter_app/lib/features/podcast/data/podcast_remote_service.dart` | ✅ 已完成 |
| 状态管理 | `flutter_app/lib/features/podcast/podcast_provider.dart` | ✅ 已完成 |
| 主页面 | `flutter_app/lib/features/podcast/podcast_page.dart` | ✅ 已完成 |
| 详情页 | `flutter_app/lib/features/podcast/podcast_detail_page.dart` | ✅ 占位 |
| 卡片组件 | `flutter_app/lib/components/podcast_card.dart` | ✅ 已完成 |

## 修改文件

| 文件 | 修改内容 | 状态 |
|------|----------|------|
| `flutter_app/lib/app/app_router.dart` | 添加播客路由和底部导航 | ✅ 已完成 |

---

## 后端实现任务

1. 创建 `backend/routes/podcast.py`
2. 创建 `backend/services/podcast_scraper.py`
3. 在 `backend/app.py` 注册 blueprint
4. 在 `backend/services/scraper_factory.py` 添加 podcast factory
5. 在 `backend/config.py` 添加播客源配置

---

## 第二阶段：播客详情页 + 基础播放器

### 详情页功能
- 播客头部信息（封面、标题、作者、描述）
- 播放按钮（播放最新或第一集）
- 节目列表（单集列表）
- 底部迷你播放器

### 音频播放器
```dart
// 需要添加的依赖
dependencies:
  audioplayers: ^6.0.0
```

```dart
AudioPlayerState:
├── currentEpisode: PodcastEpisode?
├── isPlaying: bool
├── position: Duration
└── duration: Duration

AudioPlayerNotifier:
├── play(episode)
├── pause()
├── seek(position)
└── stop()
```

---

## 第三阶段：收藏 + 历史 + 后台播放

### 收藏功能
- 添加 `favoriteProvider` 支持 podcast 类型
- 收藏页面添加 podcast tab

### 播放历史
- 添加 `playHistoryProvider` 支持 podcast
- 历史页面添加 podcast tab
- 记录播放进度

### 后台播放
- 使用 `audio_service` 包
- 通知栏控制
- 耳机控制

---

## 项目现有架构参考

### Flutter 页面模式（参考 videos_page.dart）

```
VideosPage (ConsumerStatefulWidget)
  ├─ Scaffold
  │   └─ CustomScrollView
  │       ├─ SliverAppBar
  │       ├─ _SourceTabBar
  │       ├─ _CategoryBar
  │       └─ SliverGrid/SliverList
  └─ 内部组件: _SearchBar, _CategoryBar, _SourceTabBar
```

### Provider 模式（参考 videos_provider.dart）

- **State**: 包含所有UI状态
- **Notifier**: 处理业务逻辑
- **Repository**: 数据持久化

### 路由配置（参考 app_router.dart）

- 使用 `StatefulShellRoute.indexedStack` 管理底部标签导航
- 每个标签对应一个 `StatefulShellBranch`

---

## 关键文件路径

| 功能 | 文件路径 |
|------|----------|
| 视频页面 | `flutter_app/lib/features/videos/videos_page.dart` |
| 视频状态管理 | `flutter_app/lib/features/videos/videos_provider.dart` |
| 视频模型 | `flutter_app/lib/features/videos/video_models.dart` |
| 视频远程服务 | `flutter_app/lib/features/videos/data/video_remote_service.dart` |
| 漫画页面 | `flutter_app/lib/features/comics/comics_page.dart` |
| 路由配置 | `flutter_app/lib/app/app_router.dart` |
| 漫画卡片组件 | `flutter_app/lib/components/comic_card.dart` |
| API客户端 | `flutter_app/lib/core/network/api_client.dart` |

---

## 命名规范

### 文件命名
```
features/[feature_name]/
  ├── [feature]_page.dart
  ├── [feature]_models.dart
  ├── [feature]_provider.dart
  └── data/
      └── [feature]_remote_service.dart
```

### 类命名
- 页面类: `XxxPage` (e.g., `PodcastsPage`)
- 状态类: `XxxState` (e.g., `PodcastsState`)
- Notifier类: `XxxNotifier` (e.g., `PodcastsNotifier`)
- 模型类: `Xxx` (e.g., `PodcastSummary`)
- 内部组件: `_XxxBar`, `_XxxWidget`
