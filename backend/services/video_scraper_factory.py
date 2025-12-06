from .thanju_scraper import ThanjuScraper

class VideoScraperFactory:
    """视频爬虫工厂类"""
    
    _scrapers = {
        'thanju': ThanjuScraper,
    }
    
    @classmethod
    def create_scraper(cls, source_id, proxy_config=None):
        """创建指定数据源的爬虫实例"""
        scraper_class = cls._scrapers.get(source_id)
        if not scraper_class:
            raise ValueError(f'不支持的数据源: {source_id}')
        return scraper_class(proxy_config)
    
    @classmethod
    def get_available_sources(cls):
        """获取所有可用的数据源列表"""
        return [
            {
                'id': 'thanju',
                'name': '热播韩剧网',
                'description': '热播韩剧网(thanju.com) - 提供最新韩剧资源'
            }
        ]
    
    @classmethod
    def get_sources_dict(cls):
        """获取数据源字典格式"""
        sources = {}
        for source in cls.get_available_sources():
            sources[source['id']] = {
                'name': source['name'],
                'description': source.get('description', '')
            }
        return sources

