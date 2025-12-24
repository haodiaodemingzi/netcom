# Flutter电子书功能实现文档

## 项目概述

本文档描述了将React Native电子书功能迁移到Flutter应用的完整实现计划。电子书模块将提供在线阅读、离线下载、分类浏览、搜索和数据源切换等核心功能。

## 功能特性

### 核心功能
- ✅ **电子书分类浏览** - 支持多分类展示
- ✅ **数据源切换** - 支持多个电子书源（努努书坊、天天看小说等）
- ✅ **搜索功能** - 关键词搜索书籍
- ✅ **书籍详情** - 封面、作者、简介、章节列表
- ✅ **在线阅读** - 分页阅读、进度保存
- ✅ **离线下载** - 整本书下载为txt文件
- ✅ **离线阅读** - 本地文件阅读、目录解析
- ✅ **阅读设置** - 字体大小、行距、主题切换
- ✅ **下载管理** - 集成到下载中心，支持进度监控

### 高级功能
- 📱 **响应式设计** - 适配手机和平板
- 🎨 **主题支持** - 白天、护眼、夜间、绿色主题
- 📚 **智能目录** - 自动解析章节目录
- 📖 **阅读记录** - 自动保存阅读进度
- 🔄 **批量操作** - 章节批量选择下载
- ⚡ **并发下载** - 多线程下载优化
- 🎯 **精准定位** - 目录跳转、进度跳转

## 技术架构

### 数据层
```
lib/features/ebooks/
├── data/
│   └── ebooks_remote_service.dart     # 远程API服务
├── ebooks_models.dart                 # 数据模型
├── ebooks_provider.dart              # 状态管理
├── ebooks_page.dart                  # 列表页面
├── ebook_detail_page.dart            # 详情页面
├── ebook_reader_page.dart            # 在线阅读器
├── ebook_offline_reader_page.dart    # 离线阅读器
└── ebook_downloader.dart             # 下载管理器
```

### 依赖包
```yaml
dependencies:
  flutter:
    sdk: flutter
  # 状态管理
  flutter_riverpod: ^2.5.1
  # 网络请求
  dio: ^5.6.0
  # 本地存储
  shared_preferences: ^2.3.2
  path_provider: ^2.1.4
  # 路由
  go_router: ^14.3.0
  # UI组件
  flutter_staggered_grid_view: ^0.7.0
```

## 数据模型设计

### 1. 电子书分类 (EbookCategory)
```dart
class EbookCategory {
  final String id;
  final String name;
  final String type; // category, writer, group
  final String? group;
  
  const EbookCategory({
    required this.id,
    required this.name,
    required this.type,
    this.group,
  });
}
```

### 2. 电子书数据源 (EbookSourceInfo)
```dart
class EbookSourceInfo {
  final String id;
  final String name;
  final String description;
  final bool supportsSearch;
  
  const EbookSourceInfo({
    required this.id,
    required this.name,
    required this.description,
    required this.supportsSearch,
  });
}
```

### 3. 电子书摘要 (EbookSummary)
```dart
class EbookSummary {
  final String id;
  final String title;
  final String author;
  final String cover;
  final String category;
  final String categoryId;
  final String group;
  final String source;
  
  const EbookSummary({
    required this.id,
    required this.title,
    required this.author,
    required this.cover,
    required this.category,
    required this.categoryId,
    required this.group,
    required this.source,
  });
}
```

### 4. 电子书详情 (EbookDetail)
```dart
class EbookDetail {
  final String id;
  final String title;
  final String author;
  final String cover;
  final String description;
  final String status;
  final String source;
  final List<EbookChapter> chapters;
  final int totalChapters;
  
  const EbookDetail({
    required this.id,
    required this.title,
    required this.author,
    required this.cover,
    required this.description,
    required this.status,
    required this.source,
    required this.chapters,
    required this.totalChapters,
  });
}
```

### 5. 章节信息 (EbookChapter)
```dart
class EbookChapter {
  final String id;
  final String title;
  final int index;
  final String content;
  
  const EbookChapter({
    required this.id,
    required this.title,
    required this.index,
    this.content = '',
  });
}
```

### 6. 章节内容 (ChapterContent)
```dart
class ChapterContent {
  final String id;
  final String title;
  final String content;
  final String bookTitle;
  final String author;
  
  const ChapterContent({
    required this.id,
    required this.title,
    required this.content,
    required this.bookTitle,
    required this.author,
  });
}
```

## API接口设计

### 后端API端点
```javascript
// 获取电子书分类
GET /api/ebooks/categories?source={source}

// 根据分类获取书籍列表
GET /api/ebooks/category/{categoryId}?page={page}&limit={limit}&source={source}

// 获取书籍详情
GET /api/ebooks/{bookId}?source={source}

// 获取章节列表
GET /api/ebooks/{bookId}/chapters?source={source}

// 获取章节内容
GET /api/ebooks/chapters/{chapterId}/content?source={source}

// 搜索书籍
GET /api/ebooks/search?keyword={keyword}&page={page}&limit={limit}&source={source}

// 获取数据源列表
GET /api/ebooks/sources
```

### 响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {
    // 具体数据
  }
}
```

## 状态管理

### EbooksProvider - 列表页状态管理
```dart
class EbooksState {
  final List<EbookCategory> categories;
  final List<EbookSummary> books;
  final EbookSourceInfo? selectedSource;
  final EbookCategory? selectedCategory;
  final String searchQuery;
  final bool isLoading;
  final bool hasMore;
  final int currentPage;
  final bool isSearching;
  final String? error;
}

class EbooksNotifier extends StateNotifier<EbooksState> {
  // 状态管理方法
  void changeSource(EbookSourceInfo source);
  void changeCategory(EbookCategory category);
  Future<void> searchBooks(String keyword);
  Future<void> loadBooks({bool reset = false});
  void clearSearch();
}
```

### EbookDetailProvider - 详情页状态管理
```dart
class EbookDetailState {
  final EbookDetail? detail;
  final List<EbookChapter> chapters;
  final bool isLoading;
  final bool isDownloaded;
  final DownloadStatus downloadStatus;
  final double downloadProgress;
  final String? error;
}

class EbookDetailNotifier extends StateNotifier<EbookDetailState> {
  Future<void> loadDetail(String bookId, String source);
  Future<void> downloadBook();
  void pauseDownload();
  Future<void> resumeDownload();
  void cancelDownload();
  Future<void> deleteDownload();
}
```

## 页面实现

### 1. 电子书列表页面 (EbooksPage)
**文件**: `lib/features/ebooks/ebooks_page.dart`

**功能特性**:
- 🔝 **顶部导航栏** - 标题、搜索栏、数据源选择器
- 📚 **分类标签栏** - 可展开/收起的分类选择
- 📱 **网格/列表视图** - 卡片模式切换
- 🔍 **搜索功能** - 实时搜索、清除搜索
- 📊 **分页加载** - 下拉刷新、上拉加载更多
- ⚙️ **数据源管理** - 多数据源切换支持

**UI布局**:
```
┌─────────────────────────────┐
│  电子书  [搜索框]  [数据源▼]  │
├─────────────────────────────┤
│  [分类1] [分类2] [更多▼]     │
├─────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐    │
│  │封面 │ │封面 │ │封面 │    │
│  │标题 │ │标题 │ │标题 │    │
│  │作者 │ │作者 │ │作者 │    │
│  └─────┘ └─────┘ └─────┘    │
│  ┌─────┐ ┌─────┐ ┌─────┐    │
│  │封面 │ │封面 │ │封面 │    │
│  │标题 │ │标题 │ │标题 │    │
│  │作者 │ │作者 │ │作者 │    │
│  └─────┘ └─────┘ └─────┘    │
└─────────────────────────────┘
```

### 2. 电子书详情页面 (EbookDetailPage)
**文件**: `lib/features/ebooks/ebook_detail_page.dart`

**功能特性**:
- 📖 **书籍信息** - 封面、标题、作者、状态、章节数
- 🎯 **快捷操作** - 开始阅读、下载整本、离线阅读
- 📊 **下载进度** - 实时进度条、暂停/继续/取消操作
- 📝 **书籍简介** - 完整描述信息
- 📑 **章节列表** - 正序/倒序排列、章节选择阅读
- 💾 **离线管理** - 删除下载、重新下载

**UI布局**:
```
┌─────────────────────────────┐
│  ← 返回    书籍标题    ...   │
├─────────────────────────────┤
│  ┌─────┐                    │
│  │封面 │  标题              │
│  └─────┘  作者              │
│          状态: 完结          │
│          共 XXX 章           │
│                              │
│  [开始阅读] [下载整本]       │
│                              │
│  📖 简介                     │
│  这里是书籍的详细介绍...     │
├─────────────────────────────┤
│  📑 章节列表 (共XXX章)       │
│  [正序▼] [倒序] [批量▼]      │
│  ┌─────────────────────────┐ │
│  │ 第1章 章节标题    [阅读] │ │
│  │ 第2章 章节标题    [阅读] │ │
│  │ 第3章 章节标题    [阅读] │ │
│  └─────────────────────────┘ │
└─────────────────────────────┘
```

### 3. 在线阅读器 (EbookReaderPage)
**文件**: `lib/features/ebooks/ebook_reader_page.dart`

**功能特性**:
- 📱 **全屏阅读** - 沉浸式阅读体验
- 👆 **手势控制** - 左滑上一页、右滑下一页、中间点击设置
- 📄 **智能分页** - 根据字体大小和行距自动分页
- 🎨 **阅读设置** - 字体大小、行距、主题切换
- 📚 **章节导航** - 上一章/下一章快速跳转
- 💾 **进度保存** - 自动保存阅读位置

**UI布局**:
```
┌─────────────────────────────┐
│  ← 章节标题        1/10    │ <- 顶部导航
├─────────────────────────────┤
│                             │
│         阅读内容             │
│       (分页显示)            │
│                             │
│                             │
├─────────────────────────────┤
│  ████████████████░░░░ 50%   │ <- 底部进度条
└─────────────────────────────┘
```

### 4. 离线阅读器 (EbookOfflineReaderPage)
**文件**: `lib/features/ebooks/ebook_offline_reader_page.dart`

**功能特性**:
- 📁 **本地文件读取** - 读取下载的txt文件
- 🔍 **目录解析** - 自动识别章节分隔符
- 📖 **目录导航** - 侧边栏目录、快速跳转
- ⚙️ **阅读设置** - 字体、主题、段落间距设置
- 🎯 **精准定位** - 基于字符位置的精确跳转
- 📊 **阅读统计** - 页面进度、阅读百分比

**UI布局**:
```
┌─────────────────────────────┐
│  ← 书名      [目录]  1/100  │
├─────────────────────────────┤
│                             │
│         阅读内容             │
│       (本地分页)            │
│                             │
│                             │
├─────────────────────────────┤
│  ████████████████████░░░ 80%│ <- 底部进度
└─────────────────────────────┘
```

## 下载管理器

### EbookDownloader - 下载核心
**文件**: `lib/features/ebooks/ebook_downloader.dart`

**功能特性**:
- 📦 **整本下载** - 将所有章节合并为单个txt文件
- ⚡ **并发控制** - 多线程并发下载优化速度
- 📊 **进度跟踪** - 实时下载进度、章节进度
- ⏯️ **下载控制** - 暂停、继续、取消下载
- 💾 **断点续传** - 支持暂停后继续下载
- 📁 **文件管理** - 自动创建目录、文件命名

**下载流程**:
```dart
1. 获取章节列表
2. 创建临时目录
3. 并发下载各章节
   ├── 章节内容获取
   ├── 格式化内容
   └── 保存到临时文件
4. 合并所有章节
5. 移动到最终目录
6. 清理临时文件
7. 更新下载状态
```

**文件结构**:
```
ebooks/
├── {bookId}.txt          # 最终合并文件
└── temp_{bookId}/        # 临时目录
    ├── chapter_00001.txt # 章节文件
    ├── chapter_00002.txt
    └── ...
```

## 集成到下载中心

### DownloadCenter扩展
```dart
// 在download_center_provider.dart中添加
void enqueueEbookChapters({
  required EbookDetail detail,
  required List<EbookChapter> chapters,
}) {
  // 实现电子书下载队列逻辑
}

Future<void> _runEbookDownload(DownloadItem item, EbookDetail detail, EbookChapter chapter) async {
  // 实现电子书下载逻辑
}
```

### DownloadItem扩展
```dart
// 在download_models.dart中确保支持ebook类型
enum DownloadType {
  comic,
  video,
  ebook,  // 已支持
}
```

## 路由配置

### GoRouter配置
```dart
// lib/app/app_router.dart
import 'package:go_router/go_router.dart';

// 电子书相关路由
RouteConfiguration(
  routes: [
    // 电子书列表页
    GoRoute(
      path: '/tabs/ebooks',
      builder: (context, state) => const EbooksPage(),
    ),
    
    // 电子书详情页
    GoRoute(
      path: '/ebooks/:id',
      builder: (context, state) {
        final bookId = state.pathParameters['id']!;
        final source = state.uri.queryParameters['source'] ?? 'kanunu8';
        return EbookDetailPage(bookId: bookId, source: source);
      },
    ),
    
    // 在线阅读器
    GoRoute(
      path: '/ebook-reader/:chapterId',
      builder: (context, state) {
        final chapterId = state.pathParameters['chapterId']!;
        final bookId = state.uri.queryParameters['bookId'] ?? '';
        final source = state.uri.queryParameters['source'] ?? 'kanunu8';
        final bookTitle = state.uri.queryParameters['bookTitle'] ?? '';
        final bookCover = state.uri.queryParameters['bookCover'] ?? '';
        return EbookReaderPage(
          chapterId: chapterId,
          bookId: bookId,
          source: source,
          bookTitle: bookTitle,
          bookCover: bookCover,
        );
      },
    ),
    
    // 离线阅读器
    GoRoute(
      path: '/ebook-offline-reader/:bookId',
      builder: (context, state) {
        final bookId = state.pathParameters['bookId']!;
        final bookTitle = state.uri.queryParameters['bookTitle'] ?? '';
        return EbookOfflineReaderPage(
          bookId: bookId,
          bookTitle: bookTitle,
        );
      },
    ),
  ],
);
```

## 样式规范

### 主题色彩
```dart
// 继承app_theme.dart的主题配置
class EbookTheme {
  // 主要颜色
  static const primaryColor = Color(0xFF6200EE);
  static const secondaryColor = Color(0xFF03DAC6);
  
  // 背景颜色
  static const lightBg = Color(0xFFF7F7F7);
  static const darkBg = Color(0xFF1A1A1A);
  
  // 卡片颜色
  static const cardBg = Color(0xFFFFFFFF);
  
  // 文字颜色
  static const textPrimary = Color(0xFF111111);
  static const textSecondary = Color(0xFF666666);
  static const textDisabled = Color(0xFF999999);
}
```

### 间距规范
```dart
// 页面边距
const pagePadding = EdgeInsets.all(16.0);

// 卡片间距
const cardSpacing = 12.0;

// 列表项间距
const listItemSpacing = 8.0;

// 按钮内边距
const buttonPadding = EdgeInsets.symmetric(
  horizontal: 16.0,
  vertical: 12.0,
);
```

### 字体规范
```dart
// 标题字体
const titleTextStyle = TextStyle(
  fontSize: 20,
  fontWeight: FontWeight.w700,
  color: EbookTheme.textPrimary,
);

// 副标题字体
const subtitleTextStyle = TextStyle(
  fontSize: 16,
  fontWeight: FontWeight.w600,
  color: EbookTheme.textSecondary,
);

// 正文字体
const bodyTextStyle = TextStyle(
  fontSize: 14,
  fontWeight: FontWeight.w400,
  color: EbookTheme.textPrimary,
);

// 按钮字体
const buttonTextStyle = TextStyle(
  fontSize: 16,
  fontWeight: FontWeight.w600,
);
```

## 性能优化

### 1. 列表优化
- **懒加载** - 使用ListView.builder实现虚拟滚动
- **图片缓存** - 封面图片本地缓存
- **分页加载** - 避免一次性加载过多数据
- **状态缓存** - 缓存已加载的分类和书籍数据

### 2. 阅读器优化
- **分页缓存** - 预计算并缓存分页结果
- **内存管理** - 及时释放不需要的页面内容
- **手势优化** - 优化手势识别，避免误触

### 3. 下载优化
- **并发控制** - 限制同时下载的章节数量
- **网络优化** - 添加请求超时和重试机制
- **存储优化** - 使用临时文件避免数据丢失

### 4. 数据优化
- **本地缓存** - 分类列表、书籍列表本地缓存
- **增量更新** - 只更新变化的数据
- **内存优化** - 及时释放大型对象

## 错误处理

### 1. 网络错误
```dart
try {
  final response = await dio.get(url);
  // 处理成功响应
} on DioException catch (e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      throw EbookException('网络连接超时');
    case DioExceptionType.badResponse:
      throw EbookException('服务器响应错误: ${e.response?.statusCode}');
    case DioExceptionType.cancel:
      throw EbookException('请求已取消');
    default:
      throw EbookException('网络请求失败');
  }
}
```

### 2. 文件操作错误
```dart
try {
  final file = await File(path).readAsString();
  // 处理文件内容
} catch (e) {
  if (e is FileSystemException) {
    throw EbookException('文件不存在或无法访问');
  } else {
    throw EbookException('文件读取失败');
  }
}
```

### 3. 数据解析错误
```dart
try {
  final data = json.decode(response);
  return EbookDetail.fromJson(data);
} catch (e) {
  throw EbookException('数据格式错误');
}
```

## 测试策略

### 1. 单元测试
```dart
// 测试数据模型
group('EbookModels', () {
  test('should parse ebook detail correctly', () {
    final json = {'id': '1', 'title': 'Test Book'};
    final detail = EbookDetail.fromJson(json);
    expect(detail.id, '1');
    expect(detail.title, 'Test Book');
  });
});

// 测试远程服务
group('EbooksRemoteService', () {
  test('should fetch categories successfully', () async {
    final service = EbooksRemoteService();
    final categories = await service.fetchCategories('kanunu8');
    expect(categories, isNotEmpty);
  });
});
```

### 2. Widget测试
```dart
// 测试电子书列表页面
testWidgets('should display ebook categories', (tester) async {
  await tester.pumpWidget(
    MaterialApp(
      home: EbooksPage(),
    ),
  );
  
  expect(find.text('电子书'), findsOneWidget);
  expect(find.byType(CategoryChip), findsWidgets);
});

// 测试电子书详情页面
testWidgets('should display book detail correctly', (tester) async {
  await tester.pumpWidget(
    MaterialApp(
      home: EbookDetailPage(bookId: '1', source: 'kanunu8'),
    ),
  );
  
  expect(find.byType(BookCover), findsOneWidget);
  expect(find.byType(ChapterList), findsOneWidget);
});
```

### 3. 集成测试
```dart
// 测试完整的阅读流程
testWidgets('should complete reading flow', (tester) async {
  // 1. 打开电子书列表
  // 2. 选择电子书
  // 3. 点击开始阅读
  // 4. 验证阅读器打开
  // 5. 测试翻页功能
});
```

## 部署配置

### 1. 权限配置
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### 2. 文件路径配置
```dart
// lib/core/config/ebook_config.dart
class EbookConfig {
  static const String baseDir = 'ebooks';
  static const String tempDir = 'ebooks_temp';
  static const String cacheDir = 'ebooks_cache';
  
  // 下载配置
  static const int maxConcurrentDownloads = 5;
  static const Duration downloadTimeout = Duration(seconds: 30);
  static const int retryTimes = 3;
}
```

### 3. 构建配置
```yaml
# pubspec.yaml
flutter:
  uses-material-design: true
  
  assets:
    - assets/images/ebook_placeholder.png
    - assets/images/reading_icons/
  
  fonts:
    - family: NotoSans
      fonts:
        - asset: assets/fonts/NotoSans-Regular.ttf
        - asset: assets/fonts/NotoSans-Bold.ttf
          weight: 700
```

## 开发里程碑

### 阶段1: 基础架构 (预计2天)
- [x] 数据模型设计
- [x] 远程服务实现
- [x] 状态管理架构
- [x] 路由配置

### 阶段2: 核心功能 (预计3天)
- [ ] 电子书列表页面
- [ ] 电子书详情页面
- [ ] 在线阅读器
- [ ] 基础搜索功能

### 阶段3: 高级功能 (预计2天)
- [ ] 离线阅读器
- [ ] 下载管理器
- [ ] 下载中心集成
- [ ] 设置和主题

### 阶段4: 优化测试 (预计1天)
- [ ] 性能优化
- [ ] 错误处理
- [ ] 单元测试
- [ ] 集成测试

## 风险评估

### 高风险项
1. **API兼容性** - 后端API可能需要调整
2. **大文件处理** - 电子书文件可能很大，需要优化内存使用
3. **并发下载** - 需要仔细处理并发和线程安全

### 中风险项
1. **UI一致性** - 需要确保与现有页面风格一致
2. **数据同步** - 离线数据与在线数据同步
3. **存储管理** - 本地文件存储和清理

### 低风险项
1. **基本功能** - 核心功能相对稳定
2. **路由集成** - 已有路由架构可复用
3. **状态管理** - Riverpod架构清晰

## 总结

电子书功能迁移将显著提升Flutter应用的内容丰富度，为用户提供完整的阅读体验。通过模块化设计、高效的状态管理和优化的用户体验，电子书功能将成为应用的核心亮点之一。

### 关键成功因素
- 🔄 **渐进式开发** - 分阶段实现，降低风险
- 🧪 **充分测试** - 确保稳定性和用户体验
- 📱 **响应式设计** - 适配不同设备和屏幕
- ⚡ **性能优化** - 保证流畅的使用体验
- 🎨 **UI一致性** - 与现有设计语言保持统一

### 预期收益
- 📈 **用户留存** - 丰富的阅读内容提升用户粘性
- 💰 **商业价值** - 电子书是重要的内容变现渠道
- 🎯 **竞争优势** - 完整的阅读生态闭环
- 📊 **数据洞察** - 阅读行为数据分析和优化

通过系统化的规划和实施，电子书功能将为Flutter应用带来显著的价值提升。