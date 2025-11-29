# HMZXA漫画下载适配说明

## 🎯 实现目标

为HMZXA数据源实现完整的图片下载功能，包括：
1. 访问首页获取cookie
2. 使用cookie下载图片
3. 保持公共下载逻辑不变
4. 仅修改图片下载相关部分

## ✅ 已完成的修改

### 1. DownloadManager (`services/downloadManager.js`)

#### 修改cookie缓存机制
```javascript
// 改为按数据源分别缓存
this.cachedCookies = new Map(); // 按数据源缓存cookie
this.cookiesExpireTime = new Map(); // 按数据源记录过期时间
```

#### 扩展getCookies方法
```javascript
async getCookies(source = 'xmanhua') {
  // 根据数据源访问不同的主站
  const sourceUrls = {
    'xmanhua': 'https://xmanhua.com/',
    'hmzxa': 'https://hmzxa.com/',
    'guoman8': 'https://www.guoman8.cc/'
  };
  
  // 访问主站获取cookie并缓存5分钟
  // ...
}
```

#### 修改handleTaskStart方法
```javascript
async handleTaskStart(task) {
  // 根据task.source获取对应数据源的cookie
  const cookies = await this.getCookies(task.source || 'xmanhua');
  task.cookies = cookies;
  // ...
}
```

#### 注册HmzxaAdapter
```javascript
this.adapters = {
  guoman8: new Guoman8Adapter(this.apiClient),
  xmanhua: new XmanhuaAdapter(this.apiClient),
  hmzxa: new HmzxaAdapter(this.apiClient, this), // 传入downloadManager引用
};
```

### 2. HmzxaAdapter (`services/download/adapters/HmzxaAdapter.js`)

#### 添加downloadManager引用
```javascript
constructor(apiClient, downloadManager) {
  super(apiClient);
  this.downloadManager = downloadManager;
}
```

#### 实现getDownloadHeaders方法
```javascript
async getDownloadHeaders() {
  // 获取HMZXA的cookie
  const cookies = await this.downloadManager.getCookies('hmzxa');
  
  const headers = {
    'User-Agent': '...',
    'Accept': 'image/...',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Referer': 'https://hmzxa.com/'
  };
  
  if (cookies) {
    headers['Cookie'] = cookies;
  }
  
  return headers;
}
```

### 3. ImageDownloader (`services/download/ImageDownloader.js`)

#### 根据数据源设置Referer
```javascript
// 根据数据源设置不同的Referer
const referers = {
  'xmanhua': 'https://xmanhua.com/',
  'hmzxa': 'https://hmzxa.com/',
  'guoman8': 'https://www.guoman8.cc/'
};
const referer = referers[task.source] || 'https://xmanhua.com/';

const downloadHeaders = {
  'User-Agent': '...',
  'Referer': referer,
  'Accept': 'image/...',
  'Accept-Language': 'zh-CN,zh;q=0.9'
};

// 如果task有cookies，添加到headers
if (task.cookies) {
  downloadHeaders['Cookie'] = task.cookies;
  console.log(`使用${task.source}的Cookie下载`);
}
```

## 🔄 工作流程

1. **添加下载任务**
   ```javascript
   await downloadManager.downloadChapters(comicId, comicTitle, chapters, 'hmzxa');
   ```

2. **创建DownloadTask**
   ```javascript
   const task = new DownloadTask(
     chapterId,
     comicId,
     comicTitle,
     chapterTitle,
     images,
     'hmzxa' // source参数
   );
   ```

3. **开始下载**
   - `handleTaskStart` 被调用
   - 根据 `task.source = 'hmzxa'` 获取HMZXA的cookie
   - Cookie存入 `task.cookies`

4. **下载图片**
   - `ImageDownloader.downloadImage` 被调用
   - 根据 `task.source` 设置正确的Referer: `https://hmzxa.com/`
   - 使用 `task.cookies` 设置Cookie头
   - 调用 `FileSystem.downloadAsync` 下载图片

5. **Cookie缓存**
   - 每个数据源的cookie独立缓存
   - 缓存时间：5分钟
   - 过期后自动重新获取

## 📦 数据源配置

### 当前支持的数据源

| 数据源 | 主站URL | Cookie获取 | Referer |
|--------|---------|-----------|---------|
| xmanhua | https://xmanhua.com/ | ✅ | https://xmanhua.com/ |
| hmzxa | https://hmzxa.com/ | ✅ | https://hmzxa.com/ |
| guoman8 | https://www.guoman8.cc/ | ✅ | https://www.guoman8.cc/ |

## 🎨 特点

1. **零侵入**: 公共下载逻辑完全不变，只扩展了数据源支持
2. **自动化**: Cookie自动获取、缓存和刷新
3. **可扩展**: 新增数据源只需在3个地方添加URL配置
4. **统一接口**: 所有数据源使用相同的下载流程

## 🚀 使用方式

### 前端调用示例

```javascript
// 1. 获取章节列表
const chapters = await api.get(`/comics/${comicId}/chapters`, {
  params: { source: 'hmzxa' }
});

// 2. 下载章节
await downloadManager.downloadChapters(
  comicId,
  comicTitle,
  chapters,
  'hmzxa' // 指定数据源
);
```

### 下载日志示例

```
开始执行下载任务: 第1话, 共20张图片, 数据源: hmzxa
获取到hmzxa的Cookie: xxxxx
📥 下载: https://p8.jmpic.xyz/upload_s/...
💾 保存: /path/to/file.jpg
使用hmzxa的Cookie下载
✅ 成功: 123456 bytes
```

## ⚠️ 注意事项

1. Cookie有效期为5分钟，过期后自动重新获取
2. 图片URL必须是完整的HTTP/HTTPS地址
3. 下载失败会自动重试3次
4. 每次下载都会带上正确的Referer和Cookie

## 🔧 故障排查

### 如果下载失败

1. 检查日志中是否成功获取Cookie
2. 确认图片URL是否正确
3. 验证Referer是否匹配数据源
4. 查看是否有网络错误

### 如果Cookie获取失败

1. 检查网络连接
2. 确认主站URL是否可访问
3. 查看控制台错误日志

## 📝 总结

HMZXA下载适配已完成，与xmanhua使用相同的下载机制：
- ✅ 访问首页自动获取cookie
- ✅ Cookie自动缓存和刷新
- ✅ 下载时自动带上cookie和referer
- ✅ 支持断点续传和失败重试
- ✅ 完全兼容现有下载流程

前端只需在调用时指定`source='hmzxa'`即可！
