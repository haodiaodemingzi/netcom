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

---

## 播客接口

### 基础信息
- **Base URL**: `/api/podcast` (独立 blueprint)
- **source 参数**: 用于指定数据源，默认 `ximalaya`
- **分页参数**: `page` (默认1), `limit` (默认20)
- **响应格式**: 使用 `success_response` 包装

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/podcast/sources` | 获取所有可用数据源 |
| GET | `/api/podcast/categories` | 获取分类列表 |
| GET | `/api/podcast/programs` | 获取播客节目列表 |
| GET | `/api/podcast/programs/hot` | 获取热门播客 |
| GET | `/api/podcast/programs/latest` | 获取最新播客 |
| GET | `/api/podcast/programs/<id>` | 获取播客详情 |
| GET | `/api/podcast/programs/<id>/episodes` | 获取节目单集列表 |
| GET | `/api/podcast/episodes/<id>` | 获取单集详情（含音频地址） |
| GET | `/api/podcast/search` | 搜索播客 |

### 1. 获取数据源列表

**接口**: `GET /api/podcast/sources`

**响应**:
```json
{
  "success": true,
  "data": {
    "sources": {
      "ximalaya": {
        "id": "ximalaya",
        "name": "喜马拉雅",
        "enabled": true
      },
      "lizhi": {
        "id": "lizhi",
        "name": "荔枝FM",
        "enabled": true
      }
    }
  }
}
```

### 2. 获取分类列表

**接口**: `GET /api/podcast/categories`

**参数**:
- `source` (可选): 数据源ID

**响应**:
```json
{
  "success": true,
  "data": {
    "categories": [
      {"id": "all", "name": "全部"},
      {"id": "有声书", "name": "有声书"},
      {"id": "相声评书", "name": "相声评书"},
      {"id": "音乐", "name": "音乐"},
      {"id": "情感", "name": "情感"},
      {"id": "知识", "name": "知识"},
      {"id": "儿童", "name": "儿童"},
      {"id": "历史", "name": "历史"}
    ]
  }
}
```

### 3. 获取播客节目列表（按分类）

**接口**: `GET /api/podcast/programs`

**参数**:
- `category` (可选): 分类ID,默认 "all"
- `page` (可选): 页码
- `limit` (可选): 每页数量
- `source` (可选): 数据源ID

**响应**:
```json
{
  "success": true,
  "data": {
    "programs": [
      {
        "id": "123456",
        "title": "三国演义",
        "cover": "https://example.com/cover.jpg",
        "author": "单田芳",
        "source": "ximalaya",
        "episodes": 200,
        "description": "经典评书三国演义...",
        "updateTime": "2024-01-15"
      }
    ],
    "hasMore": true,
    "total": 100
  }
}
```

### 4. 获取热门播客

**接口**: `GET /api/podcast/programs/hot`

**参数**:
- `page` (可选): 页码
- `limit` (可选): 每页数量
- `source` (可选): 数据源ID

**响应格式同 programs 接口**

### 5. 获取最新播客

**接口**: `GET /api/podcast/programs/latest`

**参数**:
- `page` (可选): 页码
- `limit` (可选): 每页数量
- `source` (可选): 数据源ID

**响应格式同 programs 接口**

### 6. 获取播客详情

**接口**: `GET /api/podcast/programs/<id>`

**参数**:
- `source` (可选): 数据源ID

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "123456",
    "title": "三国演义",
    "cover": "https://example.com/cover.jpg",
    "author": "单田芳",
    "source": "ximalaya",
    "episodes": 200,
    "description": "经典评书三国演义...",
    "playCount": "1.2亿",
    "updateTime": "2024-01-15"
  }
}
```

### 7. 获取节目单集列表

**接口**: `GET /api/podcast/programs/<id>/episodes`

**参数**:
- `page` (可选): 页码
- `limit` (可选): 每页数量,默认 50
- `source` (可选): 数据源ID

**响应**:
```json
{
  "success": true,
  "data": {
    "episodes": [
      {
        "id": "ep_001",
        "title": "第一回 桃园三结义",
        "duration": 1800,
        "publishTime": "2020-01-01",
        "order": 1,
        "isPlayed": false,
        "progress": 0
      },
      {
        "id": "ep_002",
        "title": "第二回 张飞怒打督邮",
        "duration": 2100,
        "publishTime": "2020-01-08",
        "order": 2,
        "isPlayed": true,
        "progress": 2100
      }
    ],
    "hasMore": false,
    "total": 200
  }
}
```

### 8. 获取单集详情（含音频地址）

**接口**: `GET /api/podcast/episodes/<id>`

**参数**:
- `source` (可选): 数据源ID

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "ep_001",
    "title": "第一回 桃园三结义",
    "programId": "123456",
    "programTitle": "三国演义",
    "duration": 1800,
    "publishTime": "2020-01-01",
    "audioUrl": "https://example.com/audio.mp3",
    "audioUrlBackup": "https://backup.example.com/audio.mp3"
  }
}
```

### 9. 搜索播客

**接口**: `GET /api/podcast/search`

**参数**:
- `keyword` (必需): 搜索关键词
- `page` (可选): 页码
- `limit` (可选): 每页数量
- `source` (可选): 数据源ID

**响应**:
```json
{
  "success": true,
  "data": {
    "programs": [
      {
        "id": "123456",
        "title": "三国演义",
        "cover": "https://example.com/cover.jpg",
        "author": "单田芳",
        "source": "ximalaya",
        "episodes": 200
      }
    ],
    "hasMore": false,
    "total": 1
  }
}
```

### 数据模型

#### PodcastSourceInfo
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 数据源ID |
| name | string | 数据源名称 |
| enabled | boolean | 是否启用 |

#### PodcastCategory
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 分类ID |
| name | string | 分类名称 |

#### PodcastSummary (播客列表项)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 播客ID |
| title | string | 标题 |
| cover | string | 封面图URL |
| source | string | 数据源ID |
| author | string? | 作者/主播 |
| episodes | int | 节目数量 |
| description | string? | 简介 |
| updateTime | string? | 更新时间 |

#### PodcastDetail (播客详情)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 播客ID |
| title | string | 标题 |
| cover | string | 封面图URL |
| source | string | 数据源ID |
| author | string? | 作者/主播 |
| episodes | int | 节目数量 |
| description | string? | 简介 |
| playCount | string? | 播放量 |
| updateTime | string? | 更新时间 |

#### PodcastEpisode (播客单集)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 单集ID |
| title | string | 标题 |
| duration | int | 时长(秒) |
| publishTime | string? | 发布时间 |
| order | int | 序号 |
| isPlayed | boolean | 是否已播放 |
| progress | int | 播放进度(秒) |
| audioUrl | string? | 音频地址 |
| audioUrlBackup | string? | 备用音频地址 |

#### EpisodeDetail (单集详情)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 单集ID |
| title | string | 标题 |
| programId | string | 所属节目ID |
| programTitle | string | 所属节目标题 |
| duration | int | 时长(秒) |
| publishTime | string? | 发布时间 |
| audioUrl | string | 音频地址 |
| audioUrlBackup | string? | 备用音频地址 |
