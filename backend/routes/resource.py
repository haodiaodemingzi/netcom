"""
统一资源路由基类

提供统一的接口模式：
- GET /api/{resource_type}/sources - 获取数据源
- GET /api/{resource_type}/categories - 获取分类
- GET /api/{resource_type}/list - 获取列表
- GET /api/{resource_type}/{id} - 获取详情
- GET /api/{resource_type}/{id}/chapters - 获取章节列表
- GET /api/{resource_type}/search - 搜索
"""
from flask import Blueprint, request, jsonify
import logging

logger = logging.getLogger(__name__)


class BaseResourceRoute:
    """
    统一资源路由基类
    
    子类需要实现:
    - get_scraper_factory() - 返回对应的ScraperFactory
    - get_resource_name() - 返回资源名称（如'comic', 'video', 'ebook'）
    """
    
    def __init__(self, blueprint, scraper_factory, resource_name):
        self.bp = blueprint
        self.factory = scraper_factory
        self.resource_name = resource_name
        
    def register_routes(self):
        """注册所有路由"""
        self._register_sources_route()
        self._register_categories_route()
        self._register_list_route()
        self._register_detail_route()
        self._register_search_route()
    
    def _get_source(self, default=None):
        """获取数据源参数"""
        return request.args.get('source', default)
    
    def _get_pagination(self, default_limit=20):
        """获取分页参数"""
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', default_limit, type=int)
        return page, limit
    
    def _get_scraper(self, source=None):
        """获取爬虫实例"""
        source = source or self._get_source()
        if hasattr(self.factory, 'get_scraper'):
            return self.factory.get_scraper(source)
        elif hasattr(self.factory, 'create_scraper'):
            return self.factory.create_scraper(source)
        raise NotImplementedError("Factory must have get_scraper or create_scraper method")
    
    def _success(self, data, code=200):
        """成功响应"""
        return jsonify(data), code
    
    def _error(self, message, code=500):
        """错误响应"""
        return jsonify({'error': message}), code
    
    def _not_found(self, message="资源不存在"):
        """404响应"""
        return self._error(message, 404)
    
    def _register_sources_route(self):
        """注册获取数据源路由"""
        @self.bp.route(f'/{self.resource_name}s/sources', methods=['GET'])
        def get_sources():
            try:
                if hasattr(self.factory, 'get_sources_dict'):
                    sources = self.factory.get_sources_dict()
                elif hasattr(self.factory, 'get_available_sources'):
                    sources = self.factory.get_available_sources()
                else:
                    sources = {}
                return self._success({'sources': sources})
            except Exception as e:
                logger.error(f"获取{self.resource_name}数据源失败: {str(e)}")
                return self._error(str(e))
    
    def _register_categories_route(self):
        """注册获取分类路由"""
        @self.bp.route(f'/{self.resource_name}s/categories', methods=['GET'])
        def get_categories():
            try:
                scraper = self._get_scraper()
                data = scraper.get_categories()
                return self._success(data)
            except Exception as e:
                logger.error(f"获取{self.resource_name}分类失败: {str(e)}")
                return self._error(str(e))
    
    def _register_list_route(self):
        """注册获取列表路由"""
        @self.bp.route(f'/{self.resource_name}s/list', methods=['GET'])
        def get_list():
            try:
                page, limit = self._get_pagination()
                category = request.args.get('category', 'all')
                scraper = self._get_scraper()
                
                # 根据资源类型调用不同方法
                if hasattr(scraper, f'get_{self.resource_name}s_by_category'):
                    data = getattr(scraper, f'get_{self.resource_name}s_by_category')(category, page, limit)
                elif hasattr(scraper, 'get_list'):
                    data = scraper.get_list(category, page, limit)
                else:
                    data = {'items': [], 'hasMore': False}
                
                return self._success(data)
            except Exception as e:
                logger.error(f"获取{self.resource_name}列表失败: {str(e)}")
                return self._error(str(e))
    
    def _register_detail_route(self):
        """注册获取详情路由"""
        @self.bp.route(f'/{self.resource_name}s/<item_id>', methods=['GET'])
        def get_detail(item_id):
            try:
                scraper = self._get_scraper()
                
                # 根据资源类型调用不同方法
                if hasattr(scraper, f'get_{self.resource_name}_detail'):
                    data = getattr(scraper, f'get_{self.resource_name}_detail')(item_id)
                elif hasattr(scraper, 'get_detail'):
                    data = scraper.get_detail(item_id)
                else:
                    return self._not_found()
                
                if not data:
                    return self._not_found()
                    
                return self._success(data)
            except Exception as e:
                logger.error(f"获取{self.resource_name}详情失败: {str(e)}")
                return self._error(str(e))
    
    def _register_search_route(self):
        """注册搜索路由"""
        @self.bp.route(f'/{self.resource_name}s/search', methods=['GET'])
        def search():
            try:
                keyword = request.args.get('keyword', '')
                page, limit = self._get_pagination()
                
                if not keyword:
                    return jsonify({
                        f'{self.resource_name}s': [],
                        'hasMore': False,
                        'total': 0
                    }), 200
                
                scraper = self._get_scraper()
                
                # 根据资源类型调用不同方法
                if hasattr(scraper, f'search_{self.resource_name}s'):
                    data = getattr(scraper, f'search_{self.resource_name}s')(keyword, page, limit)
                elif hasattr(scraper, 'search'):
                    data = scraper.search(keyword, page, limit)
                else:
                    data = {f'{self.resource_name}s': [], 'hasMore': False}
                
                return self._success(data)
            except Exception as e:
                logger.error(f"搜索{self.resource_name}失败: {str(e)}")
                return self._error(str(e))


def create_unified_resource_blueprint(name, scraper_factory, resource_name):
    """
    创建统一资源蓝图的工厂函数
    
    Args:
        name: 蓝图名称
        scraper_factory: 爬虫工厂类
        resource_name: 资源名称（如'comic', 'video', 'ebook'）
    
    Returns:
        配置好路由的Blueprint
    """
    bp = Blueprint(name, __name__)
    resource = BaseResourceRoute(bp, scraper_factory, resource_name)
    resource.register_routes()
    return bp
