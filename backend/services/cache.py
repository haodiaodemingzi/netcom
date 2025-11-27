import json
from functools import wraps
import os

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
            # 生成缓存键
            cache_key = f'{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}'
            
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
