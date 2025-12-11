import json
import os
from typing import List, Dict, Optional
from .meta_image_fetcher import get_meta_image

class SourceMarket:
    """数据源市场服务类"""
    
    def __init__(self, config_path=None):
        """初始化数据源市场"""
        if config_path is None:
            # 默认配置文件路径
            current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(current_dir, 'data', 'source_market.json')
        
        self.config_path = config_path
        self._config = None
        self._icon_cache = {}  # 缓存已获取的图标
        self._load_config()
    
    def _load_config(self):
        """加载配置文件"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self._config = json.load(f)
        except FileNotFoundError:
            print(f'警告: 配置文件不存在: {self.config_path}')
            self._config = {'sources': [], 'categories': []}
        except json.JSONDecodeError as e:
            print(f'错误: 配置文件格式错误: {e}')
            self._config = {'sources': [], 'categories': []}
    
    def _is_placeholder_icon(self, icon_url: str) -> bool:
        """检查是否是占位符图标"""
        if not icon_url:
            return True
        # 检查是否是via.placeholder.com的占位符
        return 'via.placeholder.com' in icon_url or 'placeholder' in icon_url.lower()
    
    def _get_source_icon(self, source: Dict) -> str:
        """获取数据源的图标：直接使用配置中的 icon，占位符也原样返回"""
        current_icon = source.get('icon', '')
        return current_icon or ''
    
    def _enrich_source(self, source: Dict) -> Dict:
        """丰富数据源信息，包括自动获取图标"""
        enriched = source.copy()
        # 自动获取图标
        enriched['icon'] = self._get_source_icon(source)
        return enriched
    
    def get_all_sources(self) -> List[Dict]:
        """获取所有数据源"""
        sources = self._config.get('sources', [])
        # 为每个数据源自动获取图标
        return [self._enrich_source(s) for s in sources]
    
    def get_sources_by_category(self, category: str) -> List[Dict]:
        """根据分类获取数据源"""
        if category == 'all':
            return self.get_all_sources()
        
        sources = self.get_all_sources()
        return [s for s in sources if s.get('category') == category and s.get('enabled', True)]
    
    def get_source_by_id(self, source_id: str) -> Optional[Dict]:
        """根据ID获取数据源详情"""
        sources = self._config.get('sources', [])
        for source in sources:
            if source.get('id') == source_id:
                return self._enrich_source(source)
        return None
    
    def search_sources(self, keyword: str, category: str = 'all') -> List[Dict]:
        """搜索数据源"""
        sources = self.get_sources_by_category(category)
        
        if not keyword:
            return sources
        
        keyword_lower = keyword.lower()
        results = []
        
        for source in sources:
            # 搜索名称、描述、标签
            name = source.get('name', '').lower()
            description = source.get('description', '').lower()
            tags = [tag.lower() for tag in source.get('tags', [])]
            
            if (keyword_lower in name or 
                keyword_lower in description or 
                any(keyword_lower in tag for tag in tags)):
                results.append(source)
        
        return results
    
    def get_categories(self) -> List[Dict]:
        """获取分类列表"""
        return self._config.get('categories', [])
    
    def is_source_enabled(self, source_id: str) -> bool:
        """检查数据源是否启用"""
        source = self.get_source_by_id(source_id)
        return source is not None and source.get('enabled', True)

