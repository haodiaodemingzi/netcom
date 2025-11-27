# 漫画阅读器后端 API

基于 Flask 的漫画数据采集和 API 服务。

## 功能特性

- 漫画数据采集
- RESTful API 接口
- 数据缓存机制
- 反爬虫处理

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置:

```bash
cp .env.example .env
```

### 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

## API 文档

### 漫画相关

#### 获取热门漫画

```
GET /api/comics/hot?page=1&limit=20
```

#### 获取最新漫画

```
GET /api/comics/latest?page=1&limit=20
```

#### 获取漫画详情

```
GET /api/comics/:id
```

#### 获取章节列表

```
GET /api/comics/:id/chapters
```

#### 获取章节图片

```
GET /api/chapters/:id/images
```

### 搜索相关

#### 搜索漫画

```
GET /api/comics/search?keyword=关键词&page=1&limit=20
```

#### 获取热门搜索

```
GET /api/search/hot
```

## 项目结构

```
backend/
├── app.py              # 应用入口
├── routes/             # 路由
│   ├── comic.py       # 漫画相关路由
│   └── search.py      # 搜索相关路由
├── services/          # 服务层
│   ├── scraper.py    # 数据采集
│   └── cache.py      # 缓存服务
└── requirements.txt   # 依赖列表
```

## 注意事项

1. 当前使用模拟数据,实际部署需要实现真实的爬虫逻辑
2. 建议使用 Redis 替代内存缓存以提高性能
3. 注意遵守目标网站的 robots.txt 和使用条款
4. 建议添加请求频率限制和代理池
