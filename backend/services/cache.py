import json
from functools import wraps
import os
from flask import request

# 简单的内存缓存实现
_cache = {}

def get_cache(key):
    """获取缓存"""
    return _cache.get(key)

def set_cache(key, value, timeout=3600):
    """设置缓存"""
    _cache[key] = value
    return True

def delete_cache(key):
    """删除缓存"""
    if key in _cache:
        del _cache[key]
        return True
    return False

def clear_cache():
    """清空所有缓存"""
    _cache.clear()
    return True

def cache_response(timeout=3600, key_prefix=''):
    """缓存装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 生成缓存键, 将查询参数与请求路径纳入, 防止不同数据源/分页/查询条件串缓存
            try:
                query_params = request.args.to_dict(flat=True) if request else {}
                path = request.path if request else ''
            except Exception:
                # 兜底处理, 避免在非请求上下文报错
                query_params = {}
                path = ''

            key_data = {
                'prefix': key_prefix,
                'func': func.__name__,
                'path': path,
                'args': args,
                'kwargs': kwargs,
                'query': query_params,
            }
            # 使用json确保键稳定, default=str 兜底不可序列化对象
            cache_key = json.dumps(key_data, ensure_ascii=False, sort_keys=True, default=str)
            
            # 尝试从缓存获取
            cached_data = get_cache(cache_key)
            if cached_data is not None:
                return cached_data
            
            # 执行函数并缓存结果
            result = func(*args, **kwargs)
            set_cache(cache_key, result, timeout)
            
            return result
        return wrapper
    return decorator
