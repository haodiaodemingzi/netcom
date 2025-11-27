# 国漫8采集源实现说明

## 数据源信息

- **网站**: https://www.guoman8.cc
- **名称**: 国漫8
- **类型**: 国产漫画网站

## 实现功能

### ✅ 已实现接口

1. **get_categories()** - 获取分类列表
2. **get_comics_by_category()** - 根据分类获取漫画列表(支持分页)
3. **get_hot_comics()** - 获取热门漫画
4. **get_latest_comics()** - 获取最新漫画
5. **search_comics()** - 搜索漫画
6. **get_comic_detail()** - 获取漫画详情
7. **get_chapters()** - 获取章节列表
8. **get_chapter_images()** - 获取章节图片URL数组

## 采集规则

### 1. 分类列表
```
选择器: div.filter.genre > ul > li
提取: 分类名称和ID
```

### 2. 分类漫画列表
```
URL格式: /list/smid-{category_id}-p-{page}
选择器: #contList > li
提取: 漫画ID、标题、封面、最新章节
```

### 3. 漫画详情
```
URL格式: /{comic_id}/
封面: div.book-cover.fl > p > img
介绍: div.book-detail.pr.fr
```

### 4. 章节列表
```
选择器: #chpater-list-1 > ul > li
提取: 章节ID、标题
```

### 5. 章节图片
```
URL格式: /{comic_id}/{chapter_num}.html
方法: 解析JavaScript代码提取图片URL数组
```

## 技术要点

### JavaScript解密

章节页面的图片URL被加密在JavaScript代码中:

```javascript
eval(function(p,a,c,k,e,d){...})
```

当前实现使用正则表达式提取图片URL,未来可以优化为:
- 使用 PyExecJS 执行JS代码
- 或使用 Selenium 渲染页面

### 反爬虫处理

- User-Agent 伪装
- Referer 设置
- 请求延迟(0.5-1.5秒随机延迟)

## API使用示例

### 获取分类列表
```bash
GET /api/categories?source=guoman8
```

### 获取分类漫画
```bash
GET /api/comics/category?source=guoman8&category=1&page=1
```

### 获取漫画详情
```bash
GET /api/comics/45043?source=guoman8
```

### 获取章节列表
```bash
GET /api/comics/45043/chapters?source=guoman8
```

### 获取章节图片
```bash
GET /api/chapters/45043_01/images?source=guoman8
```

## 数据格式

### 分类数据
```json
{
  "categories": [
    {
      "id": "1",
      "name": "热血",
      "url": "https://www.guoman8.cc/list/smid-1"
    }
  ],
  "total": 10
}
```

### 漫画列表
```json
{
  "comics": [
    {
      "id": "45043",
      "title": "腹腹教师",
      "cover": "https://...",
      "latestChapter": "第23话",
      "status": "ongoing"
    }
  ],
  "hasMore": true,
  "total": 20
}
```

### 章节图片
```json
{
  "images": [
    {"page": 1, "url": "https://..."},
    {"page": 2, "url": "https://..."}
  ],
  "total": 28
}
```

## 注意事项

1. **图片URL解密**: 当前使用简化的正则提取,可能不稳定
2. **反爬虫**: 需要注意请求频率,避免被封IP
3. **图片防盗链**: 图片可能需要正确的Referer才能访问
4. **错误处理**: 已添加异常捕获,但需要监控日志

## 优化建议

1. 使用 PyExecJS 或 js2py 正确解密JavaScript
2. 添加代理IP池支持
3. 实现更完善的错误重试机制
4. 添加数据验证和清洗
5. 优化图片URL提取算法
