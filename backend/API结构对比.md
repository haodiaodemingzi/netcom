# HMZXA与Xmanhua API返回结构对比

## ✅ 已统一的API结构

### 1. get_categories()
**返回结构：**
```json
{
  "categories": [
    {
      "id": "49",
      "name": "热血",
      "url": "https://hmzxa.com/category/tags/49"
    }
  ],
  "total": 41
}
```

### 2. get_comics_by_category(category_id, page, limit)
**返回结构：**
```json
{
  "comics": [
    {
      "id": "yijielieqiren",
      "title": "《異界獵妻人》",
      "cover": "https://...",
      "latestChapter": "異界獵妻人 - 第104話",
      "status": "ongoing"
    }
  ],
  "hasMore": true,
  "total": 20,
  "page": 1,
  "limit": 20,
  "totalPages": 4
}
```

### 3. get_hot_comics(page, limit)
**返回结构：** 同 get_comics_by_category

### 4. get_latest_comics(page, limit)
**返回结构：** 同 get_comics_by_category

### 5. search_comics(keyword, page, limit)
**返回结构：** 同 get_comics_by_category
**注意：** HMZXA暂不支持关键词搜索，返回默认分类

### 6. get_comic_detail(comic_id)
**返回结构：**
```json
{
  "id": "yijielieqiren",
  "title": "《異界獵妻人》",
  "cover": "https://...",
  "author": "",
  "description": "简介：异界猎妻人...",
  "status": "ongoing",
  "rating": 0.0,
  "categories": ["热血", "冒险", "悬疑"],
  "updateTime": ""
}
```

### 7. get_chapters(comic_id)
**返回结构：**
```json
{
  "chapters": [
    {
      "id": "73615",
      "title": "異界獵妻人 - 第1話",
      "order": 1,
      "updateTime": "2025-06-24"
    }
  ],
  "total": 104
}
```

### 8. get_chapter_images(chapter_id)
**返回结构：**
```json
{
  "images": [
    {
      "page": 1,
      "url": "https://p8.jmpic.xyz/upload_s/..."
    }
  ],
  "total": 20
}
```

## 🔧 前端无需改动

所有API返回结构已与xmanhua保持一致，前端代码无需修改。

## 📦 下载适配器

前端已创建 `HmzxaAdapter`，使用方式：

```javascript
// 在请求时指定 source=hmzxa
await api.get('/comics', { params: { source: 'hmzxa' } })

// 下载时指定数据源
await downloadManager.downloadChapters(comicId, comicTitle, chapters, 'hmzxa')
```

## ⚠️ 差异说明

1. **author字段**: HMZXA网站详情页不显示作者，返回空字符串
2. **rating字段**: HMZXA网站无评分，返回0.0
3. **updateTime字段**: 
   - 漫画详情页无更新时间，返回空字符串
   - 章节列表有更新时间（格式：2025-06-24）
4. **search功能**: HMZXA不支持关键词搜索，调用时返回默认分类结果
