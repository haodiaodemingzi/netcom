
# 前端下载器架构

## 1. 目标

将漫画和视频的下载过程从后端代理转移到前端客户端，以减少服务器带宽和负载。

## 2. 问题分析

根据用户反馈和代码审查，发现了以下问题：

1.  **视频下载问题：** 用户报告没有看到 MP4 或 M3U8 文件被下载。
2.  **目录结构问题：** 创建的目录名称不清晰（例如，`video/show_5683.html`），这使得用户难以找到下载的文件。
3.  **现有实现：** `flutter_app/lib/features/downloads/video_downloader.dart` 已经实现了直接下载 M3U8 和 MP4 的逻辑，但可能存在一些问题。

## 3. 后端 API 设计

### 2.1. 漫画下载配置 API

此 API 已在 `backend/routes/comic.py` 中实现。我们将继续使用它。

- **端点:** `GET /api/chapters/<chapter_id>/download-info`
- **查询参数:** `source` (必需)
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "data": {
      "images": [
        {
          "page": 1,
          "url": "https://example.com/image1.jpg"
        },
        {
          "page": 2,
          "url": "https://example.com/image2.jpg"
        }
      ],
      "total": 2,
      "download_config": {
        "referer": "https://manga-source.com/",
        "cookie_url": "https://manga-source.com/get_cookie",
        "headers": {
          "User-Agent": "Mozilla/5.0 ..."
        }
      }
    }
  }
  ```

### 2.2. 视频下载配置 API (新)

我们将创建一个新的 API 端点来为视频提供下载配置。

- **端点:** `GET /api/videos/episodes/<episode_id>/download-info`
- **查询参数:** `source` (必需)
- **成功响应 (200):**
  ```json
  {
    "success": true,
    "data": {
      "type": "hls", // 或 "mp4", "dash"
      "segments": [
        {
          "index": 0,
          "url": "https://video-source.com/segment0.ts"
        },
        {
          "index": 1,
          "url": "https://video-source.com/segment1.ts"
        }
      ],
      "download_config": {
        "referer": "https://video-source.com/player",
        "cookie_url": "https://video-source.com/get_cookie",
        "headers": {
          "User-Agent": "Mozilla/5.0 ...",
          "Origin": "https://video-source.com"
        }
      },
      "ffmpeg_required": false, // 指示客户端是否需要调用 ffmpeg
      "ffmpeg_command": null // 如果需要，提供建议的 ffmpeg 命令
    }
  }
  ```
- **实现说明:**
  - 此端点将整合 `video.py` 中 `proxy_video` 和 `convert_video` 的逻辑，以收集所有必要的头信息和 URL。
  - 它将解析 `.m3u8` 文件，提取片段 URL，并将它们与下载配置一起返回。
  - 如果视频源需要服务器端处理（例如，使用 `ffmpeg` 合并分片），`ffmpeg_required` 将为 `true`，并且后端将像当前一样处理下载。

## 4. Flutter 应用更改

### 4.1. 文件修改

- **`flutter_app/lib/features/downloads/comic_downloader.dart`:**
  - 修改 [`downloadChapter`](flutter_app/lib/features/downloads/comic_downloader.dart:26) 方法以使用新的下载配置。
  - 它将不再调用 `/proxy/image`。
  - 它将使用 `dio` 直接下载图片，并使用从 `/download-info` 端点获取的 `headers` 和 `referer`。
- **`flutter_app/lib/features/downloads/video_downloader.dart`:**
  - 修改 [`_ensureVideoDir`](flutter_app/lib/features/downloads/video_downloader.dart:496) 方法，以使用更清晰的目录名称。例如，使用视频标题或一个更清晰的 ID，而不是原始的 `detail.id`。
  - 修改 [`_downloadM3u8Video`](flutter_app/lib/features/downloads/video_downloader.dart:122) 和 [`_downloadDirectVideo`](flutter_app/lib/features/downloads/video_downloader.dart:94) 方法，以从后端获取必要的头部信息和 Cookie，而不是在客户端中硬编码或推断它们。
  - 添加更多的日志记录，以帮助诊断下载问题。
- **`flutter_app/lib/core/network/api_client.dart`:**
  - 可能需要进行调整以支持下载进度跟踪和处理二进制数据流。

### 4.2. 下载逻辑

1.  **获取配置:** 在开始下载之前，应用程序将首先调用相应的 `download-info` 端点。
2.  **预热 Cookies (如果需要):** 如果 `download_config` 包含 `cookie_url`，应用程序将首先向该 URL 发出请求以获取必要的 cookie。
3.  **并发下载:**
    - 应用程序将使用一个并发下载池（例如，`Future.wait` 或一个 worker pool）来同时获取多个文件（图片或视频片段）。
    - 并发级别应该是可配置的，以避免因请求过多而触发速率限制。
4.  **进度跟踪:** UI 将显示每个下载任务的总体进度（已完成的文件/总文件）。
5.  **错误处理和重试:**
    - 下载单个文件失败不应中止整个下载过程。
    - 实现一个重试机制，对失败的下载进行几次尝试，并有指数退避。
6.  **文件存储:**
    - 下载的文件将存储在应用程序的文档目录中，按漫画/视频 ID 和章节/剧集 ID 进行组织。
    - 将创建一个元数据文件来跟踪下载的文件及其顺序。
    - 目录名称将是用户友好的，例如使用视频标题而不是原始 ID。

## 5. 边缘情况

- **快速过期的 Cookies/URL:**
  - 如果 URL 或 cookie 的有效期很短，应用程序需要在下载开始时立即获取它们。
  - 如果在下载过程中 URL 过期，应用程序可能需要重新获取下载配置并恢复下载。
- **IP 限制:**
  - 某些源可能会将 URL 绑定到获取它们的 IP 地址。由于下载现在是在客户端进行的，这应该不成问题。
- **需要 `ffmpeg` 的视频:**
  - 对于需要服务器端处理的视频，应用程序将回退到使用现有的后端端点。`download-info` 响应中的 `ffmpeg_required` 标志将控制此行为。

## 6. 计划

1.  **后端:**
    - [ ] 在 `backend/routes/video.py` 中实现 `GET /api/videos/episodes/<episode_id>/download-info`。
    - [ ] 确保新的视频端点正确处理所有视频源的 `headers`、`cookies` 和 `referer`。
2.  **Flutter 应用:**
    - [ ] 修改 `flutter_app/lib/features/downloads/video_downloader.dart` 中的 [`_ensureVideoDir`](flutter_app/lib/features/downloads/video_downloader.dart:496) 方法，以使用更清晰的目录名称。
    - [ ] 修改 `flutter_app/lib/features/downloads/video_downloader.dart` 中的 [`_downloadM3u8Video`](flutter_app/lib/features/downloads/video_downloader.dart:122) 和 [`_downloadDirectVideo`](flutter_app/lib/features/downloads/video_downloader.dart:94) 方法，以从后端获取必要的头部信息和 Cookie。
    - [ ] 添加更多的日志记录，以帮助诊断下载问题。
    - [ ] 修改 `flutter_app/lib/features/downloads/comic_downloader.dart` 以使用直接下载逻辑。
    - [ ] 更新 UI 以使用新的下载器并显示下载进度。
3.  **文档:**
    - [x] 创建 `docs/frontend_downloader_architecture.md`。
    - [x] 更新计划以反映用户反馈。
