# Cookie 处理全面修复方案

## 问题分析

根据你提到的问题，部分爬虫在下载图片/小说/视频时没有先访问首页获取必要的 Cookie，导致请求失败。

## 修复范围

### 1. 后端爬虫 - 需要添加 Cookie 初始化

#### 漫画爬虫

- ✅ **xmanhua_scraper.py** - 已修复（在 get_chapter_images 方法中添加了访问主页）
- ✅ **animezilla_scraper.py** - 已实现（有 _ensure_initialized 方法）
- ❌ **hmzxa_scraper.py** - 需要修复
- ❌ **baozimh_scraper.py** - 需要修复（已有 Referer 更新，但缺少首页访问）
- ❌ **guoman8_scraper.py** - 需要修复

#### 视频爬虫

- **thanju_scraper.py** - 需要检查
- **mjwu_scraper.py** - 需要检查  
- **yinghua_scraper.py** - 需要检查
- **guoman8_scraper.py** (视频部分) - 需要检查
- **badnews_scraper.py** - 需要检查

#### 小说爬虫

- **kanunu8_scraper.py** - 需要检查
- **ttkan_scraper.py** - 需要检查

### 2. 前端在线查看器 - 需要Cookie 预加载

#### 漫画在线阅读器
- **app/reader/[chapterId].js** - 需要在加载图片前访问 cookie_url

#### 小说在线阅读器  
- **app/novel-reader/[chapterId].js** - 需要在加载内容前访问 cookie_url

#### 视频在线播放器
- **app/player/[episodeId].js** - 需要在播放前访问 cookie_url

## 修复策略

### 后端修复（Python）

在每个爬虫的主要内容获取方法中（get_chapter_images, get_episode_detail, get_chapter_content），添加：

```python
def get_chapter_images(self, chapter_id):
    """获取章节图片"""
    try:
        # 1. 先访问首页获取 Cookie
        logger.debug("访问首页获取Cookie...")
        home_response = self._make_request(self.base_url, verify_ssl=False)
        if home_response:
            logger.debug("成功获取主页Cookie")
        
        # 2. 然后访问目标页面
        # ... 后续逻辑
```

### 前端修复（JavaScript）

在在线查看器组件中，加载资源前先访问 cookie_url：

```javascript
// 1. 从 API 获取配置
const response = await api.get(`/chapters/${chapterId}/download-info?source=${source}`);
const { images, download_config } = response.data.data;

// 2. 访问 cookie_url 获取 Cookie
if (download_config?.cookie_url) {
  try {
    await fetch(download_config.cookie_url, {
      method: 'GET',
      credentials: 'include', // 重要：保存 Cookie
      headers: download_config.headers
    });
  } catch (error) {
    console.warn('获取Cookie失败:', error);
  }
}

// 3. 然后加载图片（浏览器会自动携带 Cookie）
```

## 优先级

### 高优先级（影响主要功能）
1. hmzxa_scraper.py - HMZXA 是主要数据源之一
2. baozimh_scraper.py - 包子漫画是主要数据源
3. 在线阅读器（reader/[chapterId].js）- 用户最常用

### 中优先级
4. guoman8_scraper.py - 国漫数据源
5. 视频爬虫 - 视频功能
6. 在线播放器

### 低优先级  
7. 小说爬虫 - 使用频率较低
8. 在线小说阅读器

## 实施计划

1. ✅ **第一步**：修复 xmanhua_scraper.py（已完成）
2. ✅ **第二步**：修复其他主要漫画爬虫（已完成）
   - ✅ hmzxa_scraper.py
   - ✅ baozimh_scraper.py
   - ✅ guoman8_scraper.py
   - ✅ animezilla_scraper.py（已有实现）
3. ✅ **第三步**：修复视频爬虫（已完成）
   - ✅ thanju_scraper.py
   - ✅ mjwu_scraper.py
   - ✅ yinghua_scraper.py
4. ✅ **第四步**：修复小说爬虫（已完成）
   - ✅ kanunu8_scraper.py
   - ✅ ttkan_scraper.py
5. ✅ **第五步**：修复前端在线查看器（已完成）
   - ✅ app/reader/[chapterId].js - 漫画在线阅读器
   - ✅ app/novel-reader/[chapterId].js - 小说在线阅读器
   - ✅ app/player/[episodeId].js - 视频在线播放器

## 注意事项

1. **Session 一致性**：确保使用同一个 requests.Session 对象，这样 Cookie 会自动保持
2. **代理配置**：访问首页时也要使用代理配置
3. **SSL 验证**：保持与原代码一致的 SSL 验证设置
4. **错误处理**：即使访问首页失败，也要继续尝试获取内容
5. **性能优化**：可以缓存 Cookie，避免每次都访问首页
