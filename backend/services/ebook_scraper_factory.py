from services.kanunu8_scraper import KanuNu8Scraper
import logging

logger = logging.getLogger(__name__)

class EbookScraperFactory:
    """电子书爬虫工厂类"""
    
    _scrapers = {
        'kanunu8': {
            'class': KanuNu8Scraper,
            'name': '努努书坊',
            'description': '努努书坊(kanunu8.com) - 提供大量免费电子书',
            'enabled': True
        }
    }
    
    _default_source = 'kanunu8'
    
    @classmethod
    def get_scraper(cls, source=None, proxy_config=None):
        """获取爬虫实例"""
        if source is None:
            source = cls._default_source
        
        if source not in cls._scrapers:
            logger.warning(f"未知的数据源: {source}, 使用默认数据源: {cls._default_source}")
            source = cls._default_source
        
        scraper_info = cls._scrapers[source]
        
        if not scraper_info['enabled']:
            logger.warning(f"数据源已禁用: {source}, 使用默认数据源: {cls._default_source}")
            source = cls._default_source
            scraper_info = cls._scrapers[source]
        
        logger.info(f"创建爬虫实例: {scraper_info['name']}")
        return scraper_info['class'](proxy_config)
    
    @classmethod
    def get_available_sources(cls):
        """获取所有可用的数据源"""
        sources = []
        for source_id, info in cls._scrapers.items():
            if info['enabled']:
                sources.append({
                    'id': source_id,
                    'name': info['name'],
                    'description': info['description']
                })
        return sources
    
    @classmethod
    def register_scraper(cls, source_id, scraper_class, name, description, enabled=True):
        """注册新的爬虫"""
        cls._scrapers[source_id] = {
            'class': scraper_class,
            'name': name,
            'description': description,
            'enabled': enabled
        }
        logger.info(f"注册新的爬虫: {name} ({source_id})")
