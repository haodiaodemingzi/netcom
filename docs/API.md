# API 接口文档

## 基础信息

- **Base URL**: `http://localhost:5000/api`
- **数据格式**: JSON
- **字符编码**: UTF-8

## 漫画接口

### 1. 获取热门漫画

**接口**: `GET /comics/hot`

**参数**:
- `page` (可选): 页码,默认 1
- `limit` (可选): 每页数量,默认 20

**响应**:
```json
{
  "comics": [
    {
      "id": "1",
      "title": "漫画标题",
      "cover": "封面图片URL",
      "latestChapter": "最新章节",
      "status": "ongoing",
      "rating": 8.5,
      "updateTime": "2024-01-15"
    }
  ],
  "hasMore": true,
  "total": 100
}
```

### 2. 获取最新漫画

**接口**: `GET /comics/latest`

**参数**: 同热门漫画

**响应**: 同热门漫画

### 3. 搜索漫画

**接口**: `GET /comics/search`

**参数**:
- `keyword` (必需): 搜索关键词
- `page` (可选): 页码
- `limit` (可选): 每页数量

**响应**: 同热门漫画

### 4. 获取漫画详情

**接口**: `GET /comics/:id`

**响应**:
```json
{
  "id": "1",
  "title": "漫画标题",
  "cover": "封面图片URL",
  "author": "作者",
  "description": "简介",
  "status": "ongoing",
  "rating": 8.5,
  "categories": ["冒险", "热血"],
  "updateTime": "2024-01-15"
}
```

### 5. 获取章节列表

**接口**: `GET /comics/:id/chapters`

**响应**:
```json
{
  "chapters": [
    {
      "id": "1_1",
      "title": "第 1 话",
      "order": 1,
      "updateTime": "2024-01-15",
      "isRead": false
    }
  ],
  "total": 100
}
```

### 6. 获取章节图片

**接口**: `GET /chapters/:id/images`

**响应**:
```json
{
  "images": [
    {
      "page": 1,
      "url": "图片URL"
    }
  ],
  "total": 20
}
```

## 错误响应

所有接口在发生错误时返回:

```json
{
  "error": "错误信息"
}
```

HTTP 状态码:
- `200`: 成功
- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器错误
