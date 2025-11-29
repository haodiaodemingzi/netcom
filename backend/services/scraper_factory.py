from .xmanhua_scraper import XmanhuaScraper
from .hmzxa_scraper import HmzxaScraper
from config import COMIC_SOURCES, DEFAULT_SOURCE

class ScraperFactory:
    """爬虫工厂类,根据数据源创建对应的爬虫实例"""
    
    _scrapers = {
        'xmanhua': XmanhuaScraper,
        'hmzxa': HmzxaScraper,
    }
    
    _instances = {}
    
    @classmethod
    def get_scraper(cls, source=None):
        """获取爬虫实例"""
        if source is None:
            source = DEFAULT_SOURCE
        
        # 检查数据源是否存在且启用
        if source not in COMIC_SOURCES:
            raise ValueError(f'未知的数据源: {source}')
        
        if not COMIC_SOURCES[source]['enabled']:
            raise ValueError(f'数据源已禁用: {source}')
        
        # 单例模式,避免重复创建
        if source not in cls._instances:
            scraper_class = cls._scrapers.get(source)
            if not scraper_class:
                raise ValueError(f'数据源未实现: {source}')
            
            # 获取代理配置
            proxy_config = COMIC_SOURCES[source].get('proxy', None)
            
            # 创建实例，传入代理配置
            if source in ['xmanhua', 'hmzxa']:
                cls._instances[source] = scraper_class(proxy_config)
            else:
                cls._instances[source] = scraper_class()
        
        return cls._instances[source]
    
    @classmethod
    def get_available_sources(cls):
        """获取所有可用的数据源"""
        return {
            key: {
                'name': value['name'],
                'description': value['description'],
                'enabled': value['enabled'],
            }
            for key, value in COMIC_SOURCES.items()
            if value['enabled']
        }
