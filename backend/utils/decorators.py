"""
统一的装饰器工具模块

提供：
- handle_errors: 统一错误处理装饰器
- log_request: 统一请求日志装饰器
"""
from functools import wraps
from flask import jsonify, request
import logging
import time

logger = logging.getLogger(__name__)


def handle_errors(error_message="操作失败"):
    """
    统一错误处理装饰器
    
    用法:
        @handle_errors("获取数据失败")
        def my_route():
            ...
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                return f(*args, **kwargs)
            except Exception as e:
                logger.error(
                    '%s path=%s query=%s err=%s',
                    error_message,
                    request.path,
                    request.query_string.decode('utf-8', errors='ignore'),
                    str(e),
                    exc_info=True,
                )
                return jsonify({'error': str(e)}), 500
        return wrapper
    return decorator


def log_request(operation_name=None):
    """
    统一请求日志装饰器（仅在DEBUG模式下记录）
    
    用法:
        @log_request("获取用户列表")
        def get_users():
            ...
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            # 获取操作名称
            op_name = operation_name or f.__name__
            
            # 执行函数
            result = f(*args, **kwargs)
            
            # 计算耗时
            duration = int((time.time() - start_time) * 1000)
            
            # 仅在DEBUG级别记录日志
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(f"{op_name} 完成, 耗时: {duration}ms")
            
            return result
        return wrapper
    return decorator


def get_source_param(default=None):
    """
    统一获取source参数
    
    从请求参数中获取source参数，如果没有则返回默认值
    """
    return request.args.get('source', default)


def get_pagination_params(default_page=1, default_limit=20):
    """
    统一获取分页参数
    
    返回: (page, limit)
    """
    page = request.args.get('page', default_page, type=int)
    limit = request.args.get('limit', default_limit, type=int)
    return page, limit


def success_response(data, status_code=200):
    """
    统一成功响应格式
    """
    return jsonify(data), status_code


def error_response(message, status_code=500, error_code=None):
    """
    统一错误响应格式
    """
    response = {'error': message}
    if error_code:
        response['code'] = error_code
    return jsonify(response), status_code


def not_found_response(message="资源不存在"):
    """
    统一404响应
    """
    return error_response(message, 404)


def bad_request_response(message="请求参数错误"):
    """
    统一400响应
    """
    return error_response(message, 400)


class RouteHelper:
    """
    路由辅助类，提供常用的参数获取和响应生成方法
    """
    
    @staticmethod
    def get_source(default=None):
        """获取数据源参数"""
        return get_source_param(default)
    
    @staticmethod
    def get_pagination(default_page=1, default_limit=20):
        """获取分页参数"""
        return get_pagination_params(default_page, default_limit)
    
    @staticmethod
    def get_category():
        """获取分类参数"""
        return request.args.get('category', 'all')
    
    @staticmethod
    def get_keyword():
        """获取搜索关键词参数"""
        return request.args.get('keyword', '')
    
    @staticmethod
    def success(data, code=200):
        """成功响应"""
        return success_response(data, code)
    
    @staticmethod
    def error(message, code=500):
        """错误响应"""
        return error_response(message, code)
    
    @staticmethod
    def not_found(message="资源不存在"):
        """404响应"""
        return not_found_response(message)
    
    @staticmethod
    def bad_request(message="请求参数错误"):
        """400响应"""
        return bad_request_response(message)
