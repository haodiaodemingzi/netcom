# Flutter 视频页面实现文档

## 已完成功能

### 1. 数据模型
- `VideoCategory` 视频分类模型
- `VideoSourceInfo` 数据源信息模型
- `VideoSummary` 视频摘要模型 (列表展示)
- `VideoDetail` 视频详情模型
- `VideoEpisode` 剧集模型
- `VideoPlaySource` 播放源模型
- `VideoFeed` 视频列表数据模型

### 2. 数据服务
- `VideoRemoteService` 远程数据服务
  - `fetchSources()` 获取数据源列表
  - `fetchCategories()` 获取分类列表
  - `fetchFeed()` 获取视频列表
  - `search()` 搜索视频
  - `fetchDetail()` 获取视频详情
  - `fetchEpisodes()` 获取剧集列表
  - `fetchEpisodePlaySource()` 获取播放地址

### 3. 状态管理
- `VideosProvider` 视频列表页状态管理
  - 数据源切换
  - 分类筛选
  - 搜索功能
  - 分页加载
  - 收藏管理
  - 搜索历史
- `VideoDetailProvider` 视频详情页状态管理
  - 详情加载
  - 剧集列表
  - 播放源获取
  - 收藏状态

### 4. UI 组件
- `VideoCard` 视频卡片组件 (复用漫画卡片样式)
  - 封面展示
  - 评分显示
  - 收藏按钮
  - 下载按钮
- `VideosPage` 视频列表页
  - 数据源选择器
  - 分类筛选栏
  - 搜索功能
  - 网格/列表视图切换
  - 下拉刷新
  - 上拉加载
- `VideoDetailPage` 视频详情页
  - 封面展示
  - 基本信息 (评分/状态/地区/年份)
  - 标签展示
  - 演员列表
  - 简介
  - 剧集列表
  - 剧集排序
  - 收藏功能
- `VideoPlayerPage` 视频播放页
  - media_kit 播放器集成
  - 播放控制 (播放/暂停/进度条)
  - 倍速播放
  - 全屏切换
  - 上一集/下一集切换
  - 自动隐藏控制栏

### 5. 路由集成
- `/tabs/videos` 视频列表页
- `/videos/:id` 视频详情页

## 后端 API 依赖

视频页面依赖以下后端接口:

- `GET /videos/sources` 获取数据源列表
- `GET /videos/categories?source=mjwu` 获取分类列表
- `GET /videos/series?category=xxx&page=1&limit=20&source=mjwu` 获取视频列表
- `GET /videos/search?keyword=xxx&page=1&limit=20&source=mjwu` 搜索视频
- `GET /videos/series/:id?source=mjwu` 获取视频详情
- `GET /videos/episodes/:id?source=mjwu` 获取剧集列表
- `GET /videos/episodes/:episodeId/play?source=mjwu` 获取播放地址

## 待完成功能

### 1. 下载中心集成
- 视频下载任务创建
- 下载进度同步
- 离线播放支持
- 下载队列管理
- 限速设置

### 2. 历史与收藏
- 播放历史记录
- 播放进度保存
- 继续播放功能
- 收藏列表展示
- 历史记录清理

### 3. 播放器增强
- 弹幕支持
- 手势控制 (音量/亮度/进度)
- 画面比例调整
- 字幕支持
- 播放记忆 (记住上次播放位置)
- 自动播放下一集

### 4. 性能优化
- 列表缓存策略
- 图片懒加载
- 预加载优化
- 内存管理

## 技术栈

- Flutter 状态管理: Riverpod
- 网络请求: Dio
- 路由: go_router
- 视频播放: media_kit + media_kit_video
- 瀑布流布局: flutter_staggered_grid_view

## 注意事项

1. 所有网络请求需做空值判断与异常处理
2. 日志使用参数化格式
3. 复用漫画页面的 UI 组件与交互模式
4. 视频播放页需处理横竖屏切换
5. 播放器退出时恢复系统 UI 模式
