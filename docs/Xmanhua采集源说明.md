# X漫画采集源说明

## 基本信息

- **网站名称**: X漫画
- **网站地址**: https://www.xmanhua.com
- **数据源ID**: `xmanhua`
- **实现文件**: `backend/services/xmanhua_scraper.py`

## 实现功能

### 1. 获取分类列表 `get_categories()`

**URL**: `https://www.xmanhua.com`

**CSS选择器**: `body > div.class-con > div > div a`

**返回数据**:
```json
{
  "categories": [
    {
      "id": "31",
      "name": "热血",
      "url": "https://www.xmanhua.com/manga-list-31-0-10-p1/"
    }
  ],
  "total": 10
}
```

### 2. 获取分类漫画 `get_comics_by_category(category_id, page, limit)`

**URL格式**: `/manga-list-{category_id}-0-10-p{page}/`

**示例**: `https://www.xmanhua.com/manga-list-31-0-10-p1/`

**CSS选择器**: 
- 漫画列表: `body > div:nth-child(4) > ul > li`
- 备用选择器: `ul.manga-list-1-list > li`

**返回数据**:
```json
{
  "comics": [
    {
      "id": "70xm",
      "title": "海贼王",
      "cover": "https://...",
      "latestChapter": "第1234话",
      "status": "ongoing"
    }
  ],
  "hasMore": true,
  "total": 20
}
```

### 3. 获取热门漫画 `get_hot_comics(page, limit)`

使用第一个分类(ID: 31)的漫画列表

### 4. 获取最新漫画 `get_latest_comics(page, limit)`

使用第一个分类(ID: 31)的漫画列表

### 5. 搜索漫画 `search_comics(keyword, page, limit)`

**URL格式**: `/search?keyword={keyword}`

**示例**: `https://www.xmanhua.com/search?keyword=海贼王`

**CSS选择器**: `ul.manga-list-1-list > li`

### 6. 获取漫画详情 `get_comic_detail(comic_id)`

**URL格式**: `/{comic_id}/`

**示例**: `https://www.xmanhua.com/70xm/`

**CSS选择器**:
- 封面: `body > div.detail-info-1 > div > div > img.detail-info-cover`
- 介绍: `body > div.detail-info-2 > div > div > p`
- 评分: `body > div.detail-info-1 > div > div > p.detail-info-stars > span`
- 标题: `h1.detail-info-title`
- 作者: `p.detail-info-author`
- 状态: `p.detail-info-update`

**状态解析**:
- 文本示例: "已完結| 共205章, 2023-02-09"
- 提取: 完结状态、章节数、更新时间

**返回数据**:
```json
{
  "id": "70xm",
  "title": "海贼王",
  "cover": "https://...",
  "author": "尾田荣一郎",
  "description": "...",
  "status": "completed",
  "rating": 9.5,
  "categories": [],
  "updateTime": "2023-02-09"
}
```

### 7. 获取章节列表 `get_chapters(comic_id)`

**URL格式**: `/{comic_id}/`

**CSS选择器**: `#chapterlistload > a`

**返回数据**:
```json
{
  "chapters": [
    {
      "id": "m271588",
      "title": "第1话",
      "order": 1,
      "updateTime": ""
    }
  ],
  "total": 205
}
```

### 8. 获取章节图片 `get_chapter_images(chapter_id)`

**实现逻辑**:
1. 访问第一页获取总页数
2. 遍历所有页面获取图片

**URL格式**: 
- 第一页: `/{chapter_id}/`
- 其他页: `/{chapter_id}-p{page_num}/`

**示例**:
- `https://www.xmanhua.com/m10347/`
- `https://www.xmanhua.com/m10347-p2/`

**CSS选择器**:
- 页码列表: `div.reader-bottom-page-list > a.chapterpage`
- 当前页码: `label#lbcurrentpage`
- 图片: `img#imgCurrent`
- 备用图片选择器: `div.reader-main-img img`

**页码解析**:
```html
<div class="reader-bottom-page-list" style="display: none;">
    <a href="/m10347/" id="page1" class="chapterpage now">頁碼 1/19</a>
    <a href="/m10347-p2/" id="page2" class="chapterpage">頁碼 2/19</a>
    ...
</div>
```

**返回数据**:
```json
{
  "images": [
    {
      "page": 1,
      "url": "https://..."
    },
    {
      "page": 2,
      "url": "https://..."
    }
  ],
  "total": 19
}
```

## 技术要点

### 1. 分页处理

- 分类漫画支持分页: `/manga-list-{id}-0-10-p{page}/`
- 章节图片需要遍历所有页面获取

### 2. 多页图片获取

章节图片分散在多个页面中，需要：
1. 解析总页数
2. 循环访问每一页
3. 提取每页的图片URL

### 3. 状态解析

从文本 "已完結| 共205章, 2023-02-09" 中提取:
- 完结状态: `已完結` → `completed`
- 更新时间: 正则提取日期 `\d{4}-\d{2}-\d{2}`

### 4. 选择器备用方案

多个CSS选择器作为备选，提高兼容性

## API使用示例

### 获取分类列表

```bash
curl "http://localhost:5000/api/categories?source=xmanhua"
```

### 获取分类漫画

```bash
curl "http://localhost:5000/api/comics/category?source=xmanhua&category=31&page=1&limit=20"
```

### 搜索漫画

```bash
curl "http://localhost:5000/api/comics/search?source=xmanhua&keyword=海贼王"
```

### 获取漫画详情

```bash
curl "http://localhost:5000/api/comics/70xm?source=xmanhua"
```

### 获取章节列表

```bash
curl "http://localhost:5000/api/comics/70xm/chapters?source=xmanhua"
```

### 获取章节图片

```bash
curl "http://localhost:5000/api/chapters/m271588/images?source=xmanhua"
```

## 注意事项

1. **多页图片**: 章节图片需要访问多个页面，会增加请求次数
2. **请求延迟**: 已设置0.5-1.5秒随机延迟，避免被封IP
3. **选择器变化**: 网站结构可能变化，需要定期检查
4. **繁体中文**: 网站使用繁体中文，注意文本处理

## 测试

运行测试脚本:

```bash
cd backend
py -3 test_xmanhua.py
```

## 优化建议

1. **缓存页码信息**: 避免重复解析总页数
2. **并发获取图片**: 使用线程池并发获取多页图片
3. **错误重试**: 添加请求失败重试机制
4. **图片预加载**: 提前获取下一章节图片URL
