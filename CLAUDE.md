# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NetCom** is a cross-platform content reader application supporting comics, ebooks, and videos from multiple aggregated sources. The project has two parallel frontend implementations:

1. **React Native/Expo** (original) - Located at root
2. **Flutter** (active development) - Located in `flutter_app/`

Both frontends connect to the same **Python Flask** backend API service in `backend/`.

## Development Commands

### React Native/Expo Frontend (Root)
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on platform
npm run android    # Android
npm run ios        # iOS (macOS only)
npm run web        # Web browser
```

### Flutter Frontend (`flutter_app/`)
```bash
# Navigate to Flutter app
cd flutter_app

# Get dependencies
flutter pub get

# Run development (requires emulator or connected device)
flutter run

# Build Android APK
flutter build apk

# Build app bundle
flutter build appbundle
```

### Python Backend (`backend/`)
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start API server (default port 5000)
python app.py

# With custom port
PORT=8000 python app.py
```

### Quick Start Scripts
- `start.bat` (Windows) - Starts both frontend and backend simultaneously

## Architecture Overview

### Technology Stack

**Frontend (React Native):**
- React Native + Expo SDK 54
- Expo Router for navigation
- React Native Paper for Material Design components
- Axios for HTTP requests

**Frontend (Flutter):**
- Flutter 3.10+
- Riverpod for state management
- GoRouter for declarative navigation
- Dio for HTTP networking
- Material Design 3

**Backend:**
- Python Flask with Blueprint architecture
- BeautifulSoup for web scraping
- In-memory caching (Redis support available)
- CORS enabled for cross-origin requests

### Project Structure

```
netcom/
├── app/                     # React Native pages (Expo Router)
├── components/             # Shared React Native components
├── services/               # React Native API service layer
├── utils/                  # Utility functions
├── backend/
│   ├── routes/             # Flask blueprint routes (comic, ebook, video, search, market)
│   ├── services/           # Scrapers and business logic
│   │   ├── base_scraper.py        # Base scraper class
│   │   ├── scraper_factory.py     # Factory for comic scrapers
│   │   ├── ebook_scraper_factory.py
│   │   ├── video_scraper_factory.py
│   │   └── *_scraper.py          # Source-specific scrapers
│   ├── config.py           # Source configuration and proxy settings
│   └── app.py              # Flask application entry point
├── flutter_app/
│   └── lib/
│       ├── app/            # App configuration
│       │   ├── app_router.dart        # GoRouter configuration
│       │   └── theme/                 # Theme providers and colors
│       ├── core/           # Core utilities
│       │   ├── network/     # API client, Dio config, image proxy
│       │   ├── storage/     # Local storage providers
│       │   └── services/    # File cache service
│       ├── components/      # Reusable UI components
│       └── features/        # Feature modules (comics, videos, ebooks, profile, settings)
├── docs/                   # Documentation
├── android/                # Android native files (Expo)
├── package.json           # Root dependencies (React Native)
├── pubspec.yaml           # Flutter dependencies
└── requirements.txt       # Python dependencies
```

## Core Architectural Patterns

### 1. Multi-Source Data Aggregation (Backend)

**Factory Pattern:** The `ScraperFactory` class creates appropriate scrapers for different content sources.

```python
# Getting a scraper instance
scraper = ScraperFactory.get_scraper('xmanhua')  # or 'hmzxa', 'baozimh', etc.
```

**Supported Comic Sources:**
- `xmanhua` - X漫画 (requires proxy)
- `hmzxa` - HMZXA漫画
- `animezilla` - 18H成人漫画
- `baozimh` - 包子漫画

**Additional Sources:**
- Ebooks: ttkan, kanunu8, guoman8, heli999, cool18, youshu, etc.
- Videos: yinghua, youtube, netflixgc, badnews, contentchina, etc.

**Configuration:** Sources are configured in `backend/config.py` with:
- `enabled` flag for enabling/disabling sources
- `proxy` settings for sources requiring proxy
- `download_config` with referers, cookies, and headers

### 2. Flask Blueprint Architecture

The backend is organized into Blueprints registered in `app.py`:
- `/api/comic` - Comic endpoints
- `/api/ebook` - Ebook endpoints
- `/api/video` - Video endpoints
- `/api/search` - Search functionality
- `/api/market` - Marketplace content

Each blueprint has corresponding routes in `backend/routes/` and service logic in `backend/services/`.

### 3. Flutter State Management (Riverpod)

The Flutter app uses Riverpod providers for state management:

```dart
// Reading a provider
final comics = ref.watch(comicsProvider);

// Modifying state
ref.read(comicsProvider.notifier).loadComics();
```

**Provider patterns used:**
- `StateNotifierProvider` for state with async operations
- `FutureProvider` for one-time async data
- `Provider` for immutable dependencies
- `StateProvider` for simple values

### 4. Navigation

**Flutter (GoRouter):**
- Bottom tab navigation with `StatefulShellRoute.indexedStack`
- Tab branches: `/tabs/comics`, `/tabs/videos`, `/tabs/ebooks`, `/tabs/profile`
- Named routes for deep linking
- Route transitions defined in `app_router.dart`

**React Native (Expo Router):**
- File-based routing in `app/` directory
- Tabs layout in `app/(tabs)`

### 5. Network Layer

**Flutter:**
- `Dio` as HTTP client with interceptors
- `ApiClient` wrapper in `core/network/api_client.dart`
- `image_proxy.dart` handles image loading with custom headers
- Base URL configured in `api_config.dart`

**React Native:**
- `axios` with custom instance configuration
- API service layer in `services/`

### 6. Image Loading (Flutter Specific)

The app has custom image loading logic to handle hotlinked images with required headers:

- **Network images with headers**: Uses `ImageUtils.loadImageWithHeaders()` in `core/image_utils.dart`
- **Cached network images**: Uses `cached_network_image` package
- **Image proxy**: Backend proxy endpoint in `core/network/image_proxy.dart`

When adding new image sources, ensure headers (Referer, User-Agent, Cookie) are configured in `backend/config.py` and passed through the Flutter image loading utilities.

## Important Development Notes

### Language and Style
- **Comments**: Code comments are primarily in Chinese
- **Coding conventions**: Follow Flutter/Dart style guide and Python PEP 8
- **Recent commits**: Active on `flutter` branch with focus on image loading improvements

### Current Branch Status
- Active development on `flutter` branch
- Both React Native and Flutter implementations are maintained
- Recent work: network image loading with headers, retry mechanisms, theme customization

### Key Implementation Details

**Comic Reader:**
- Source parameter must be passed through navigation: `comic/detail?id=<id>&source=<source>`
- Chapter list and image loading depend on correct source routing
- Recent fixes for source parameter passing in `comic_detail_page.dart`

**Image Loading:**
- Network images require custom headers (Referer, User-Agent)
- Implemented retry mechanism for failed loads
- Uses `CachedNetworkImage` for caching with custom headers

**Video Player:**
- Uses `video_player` and `chewie` packages
- Supports local file playback and network streaming
- Fullscreen transitions with custom page builders

**Ebook Reader:**
- Supports online and offline reading modes
- File caching service for downloaded chapters
- Offline reader: `ebook_offline_reader_page.dart`

## Configuration Files

### Frontend
- `app.json` / `app.config.js` - Expo configuration
- `eas.json` - Expo Application Services build config
- `flutter_app/pubspec.yaml` - Flutter dependencies

### Backend
- `backend/config.py` - Data source configuration, proxy settings, cache TTLs
- `backend/requirements.txt` - Python dependencies
- `backend/.env.example` - Environment variables template (create `.env` from this)

### Android
- `android/app/build.gradle` - Android build configuration
- Build scripts: `build-apk.bat` (Windows), `build-apk.sh` (Unix)

## Testing

To add a new data source:

1. **Backend:**
   - Create scraper class in `backend/services/` inheriting from `BaseScraper` (or `BaseEbookScraper`, `BaseVideoScraper`)
   - Add configuration in `backend/config.py`
   - Register in `ScraperFactory` (or respective factory)

2. **Flutter:**
   - Update `api_config.dart` if base URL changes
   - Ensure image loading utilities pass required headers for the source
   - Test with `comic/detail?id=<test_id>&source=<new_source>`

## API Endpoints Reference

The backend exposes these main endpoints:
- `GET /api/sources` - List available sources
- `GET /api/comic/hot` - Hot comics (supports `?source=` parameter)
- `GET /api/comic/latest` - Latest updates
- `GET /api/comic/detail?id=<id>` - Comic details
- `GET /api/comic/chapters?id=<id>` - Chapter list
- `GET /api/comic/images?id=<id>&chapter=<num>` - Chapter images
- Similar patterns for `/api/ebook` and `/api/video`
- `POST /api/search/comic` - Search comics

---

<skills_instructions>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

When users ask you to run a "slash command" or reference "/<something>" (e.g., "/commit", "/review-pr"), they are referring to a skill. Use this tool to invoke the corresponding skill.

**How to invoke:**
- Use this tool with the skill name and optional arguments
- Examples:
  - `skill: "pdf"` - invoke the pdf skill
  - `skill: "commit", args: "-m 'Fix bug'"` - invoke with arguments
  - `skill: "review-pr", args: "123"` - invoke with arguments
  - `skill: "ms-office-suite:pdf"` - invoke using fully qualified name

**Important notes:**
- When a skill is relevant, you must invoke this tool IMMEDIATELY as your first action
- NEVER just announce or mention a skill in your text response without actually calling this tool
- This is a BLOCKING REQUIREMENT: invoke the relevant Skill tool BEFORE generating any other response about the task
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already running
- Do not use this tool for built-in CLI commands (like /help, /clear, etc.)
</skills_instructions>

<available_skills>
<skill>
<name>haiku</name>
<description>/model haiku (user) - 轻量级对话模型，适合简单任务</description>
</skill>
<skill>
<name>sonnet</name>
<description>/model claude-sonnet-4-20250501 (user) - 中等复杂度任务模型</description>
</skill>
<skill>
<name>opus</name>
<description>/model claude-opus-4-5-20251101 (user) - 最强推理模型，适合复杂任务</description>
</skill>
<skill>
<name>glm</name>
<description>/model GLM-4.7 (user) - 智谱AI GLM-4.7模型</description>
</skill>
<skill>
<name>gemini</name>
<description>/model gemini-2.5-pro (user) - Google Gemini 2.5 Pro模型</description>
</skill>
<skill>
<name>minimax</name>
<description>/model MiniMax-M2.1 (user) - MiniMax M2.1模型</description>
</skill>
<skill>
<name>codex</name>
<description>/model gpt-5.1-codex-max (user) - OpenAI Codex模型，适合代码任务</description>
</skill>
<skill>
<name>flut</name>
<description>
Flutter高级开发者subagent，专注于NetCom项目的复杂Flutter开发任务。

**擅长领域：**
- Riverpod状态管理架构设计和实现
- GoRouter路由配置和深层链接
- Dio网络请求封装和拦截器
- 自定义图片加载（带请求头）
- 漫画阅读器开发（PageView + 自定义手势）
- 视频播放器集成（video_player + chewie）
- 离线阅读和文件缓存
- 主题系统和深色模式
- Material Design 3组件使用

**工作方式：**
- 深入分析现有代码结构后再进行修改
- 遵循项目现有的代码风格和注释规范（中文注释）
- 使用TodoWrite跟踪复杂任务的进度
- 对于多文件改动，先规划再实施
- 重视性能优化和用户体验

**调用时机：**
- 需要实现新的Flutter功能页面
- 涉及状态管理重构
- 需要处理复杂的网络请求或图片加载
- 页面路由和导航逻辑修改
- 视频/漫画阅读器相关开发
</description>
</skill>
</available_skills>
