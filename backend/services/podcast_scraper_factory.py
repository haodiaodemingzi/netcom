from .podcast_scraper import XimalayaScraper, LizhiScraper
from config import PODCAST_SOURCES

class PodcastScraperFactory:
    """播客爬虫工厂类"""

    _scrapers = {
        'ximalaya': XimalayaScraper,
        'lizhi': LizhiScraper,
    }

    _instances = {}

    @classmethod
    def get_scraper(cls, source=None):
        """获取播客爬虫实例"""
        if source is None:
            source = 'ximalaya'

        # 检查数据源是否存在且启用
        if source not in PODCAST_SOURCES:
            raise ValueError(f'未知的数据源: {source}')

        if not PODCAST_SOURCES[source]['enabled']:
            raise ValueError(f'数据源已禁用: {source}')

        # 单例模式
        if source not in cls._instances:
            scraper_class = cls._scrapers.get(source)
            if not scraper_class:
                raise ValueError(f'数据源未实现: {source}')

            cls._instances[source] = scraper_class()

        return cls._instances[source]

    @classmethod
    def get_available_sources(cls):
        """获取所有可用的数据源"""
        return {
            'sources': {
                key: {
                    'id': key,
                    'name': value['name'],
                    'enabled': value['enabled']
                }
                for key, value in PODCAST_SOURCES.items()
                if value['enabled']
            }
        }
