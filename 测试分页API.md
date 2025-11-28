# 测试分页API

## 快速测试方法

### 方法1: 使用浏览器或Postman

启动后端服务器后，访问以下URL：

#### 测试第1页
```
http://localhost:5000/api/comics/category?category=31&page=1&limit=20&source=xmanhua
```

#### 测试第2页
```
http://localhost:5000/api/comics/category?category=31&page=2&limit=20&source=xmanhua
```

#### 测试第3页
```
http://localhost:5000/api/comics/category?category=31&page=3&limit=20&source=xmanhua
```

### 方法2: 使用curl命令

```bash
# 第1页
curl "http://localhost:5000/api/comics/category?category=31&page=1&limit=20&source=xmanhua"

# 第2页  
curl "http://localhost:5000/api/comics/category?category=31&page=2&limit=20&source=xmanhua"

# 第3页
curl "http://localhost:5000/api/comics/category?category=31&page=3&limit=20&source=xmanhua"
```

## 检查要点

### 1. 查看返回的JSON
每个响应应该包含：
```json
{
  "comics": [...],
  "hasMore": true/false,
  "total": 20,
  "page": 1,
  "limit": 20,
  "totalPages": 10
}
```

### 2. 对比不同页的数据
- **第1页的第1个漫画ID** vs **第2页的第1个漫画ID** → 应该不同
- **第1页的最后漫画ID** vs **第2页的最后漫画ID** → 应该不同
- 检查是否有重复的漫画ID

### 3. 查看后端日志
后端控制台应该打印：
```
================================================================================
[分页请求] 分类ID: 31, 页码: 1, 限制: 20
[分页请求] 完整URL: https://xmanhua.com/manga-list-31-0-10-p1/
================================================================================
[分页] 检测到分页控件，总页数: 10, 当前页: 1
[分页] 本页返回 20 个漫画，hasMore=true, totalPages=10
```

## 诊断结果

### ✅ 分页正常
- 不同页返回不同的漫画
- `hasMore` 正确反映是否有更多页
- `totalPages` 显示总页数

### ❌ 分页异常

#### 情况1: 所有页返回相同数据
**可能原因**: 缓存问题
**解决方案**: 
1. 检查 `@cache_response` 装饰器
2. 确保缓存key包含page参数
3. 或暂时禁用缓存测试

#### 情况2: hasMore总是false
**可能原因**: 分页控件未找到
**解决方案**:
1. 查看日志中"[分页] 未找到分页控件"
2. 检查HTML选择器是否正确
3. 手动查看网页源代码，找到分页容器的class

#### 情况3: 第2页返回0个结果
**可能原因**: URL格式错误
**解决方案**:
1. 在浏览器中直接访问生成的URL
2. 检查网站真实的分页URL格式
3. 修改 `xmanhua_scraper.py` 中的URL构建逻辑

## 下一步操作

1. **启动后端**: `cd backend && python app.py`
2. **测试API**: 在浏览器访问上面的URL
3. **对比结果**: 检查第1页和第2页是否不同
4. **查看日志**: 观察后端控制台输出

如果发现问题，请提供：
- 第1页和第2页返回的JSON数据
- 后端控制台的完整日志
- 浏览器直接访问分页URL的结果
