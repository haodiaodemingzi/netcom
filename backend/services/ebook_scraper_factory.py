from services.kanunu8_scraper import KanuNu8Scraper
from services.ttkan_scraper import TtkanScraper
from services.cddaoyue_scraper import CddaoyueScraper
from services.youshu_scraper import YoushuScraper
from services.cool18_scraper import Cool18Scraper
import logging
from services.source_market import SourceMarket

logger = logging.getLogger(__name__)

class EbookScraperFactory:
    """电子书爬虫工厂类"""
    
    _scrapers = {
        'ttkan': {
            'class': TtkanScraper,
            'name': '天天看小说',
            'description': '天天看小说(ttkan.co) - 海量小说免费阅读',
        },
        'youshu': {
            'class': YoushuScraper,
            'name': '优书网',
            'description': '优书网(youshu.me) - 书籍元数据 + 跨源阅读',
        },
        'cddaoyue': {
            'class': CddaoyueScraper,
            'name': '独阅读',
            'description': '独阅读(cddaoyue.cn) - 高书龄读者小说站',
        },
        'cool18': {
            'class': Cool18Scraper,
            'name': 'Cool18 论坛小说',
            'description': '可配置论坛小说数据源',
        }
     }

    _default_source = 'ttkan'
    _source_market = None

    @classmethod
    def _get_source_market(cls):
        if cls._source_market is not None:
            return cls._source_market
        cls._source_market = SourceMarket()
        return cls._source_market

    @classmethod
    def _pick_first_enabled_source(cls):
        for sid, info in cls._scrapers.items():
            runtime_enabled = cls._is_enabled(sid, info.get('enabled', True))
            if runtime_enabled:
                return sid
        return cls._default_source

    @classmethod
    def _get_market_source(cls, source_id):
        if not source_id:
            return None
        market = cls._get_source_market()
        src = market.get_source_by_id(source_id)
        return src if isinstance(src, dict) else None

    @classmethod
    def _is_enabled(cls, source_id, default_enabled=True):
        src = cls._get_market_source(source_id)
        if not src:
            return default_enabled
        enabled = src.get('enabled')
        if isinstance(enabled, bool):
            return enabled
        return default_enabled

    @classmethod
    def _get_proxy_config(cls, source_id):
        src = cls._get_market_source(source_id)
        if not src:
            return None
        proxy_cfg = src.get('proxy')
        return proxy_cfg if isinstance(proxy_cfg, dict) else None
    
    @classmethod
    def get_scraper(cls, source=None, proxy_config=None):
        """获取爬虫实例"""
        if source is None:
            source = cls._default_source
            default_info = cls._scrapers.get(source) or {}
            if not cls._is_enabled(source, default_info.get('enabled', True)):
                source = cls._pick_first_enabled_source()
        
        if source not in cls._scrapers:
            logger.warning('未知的数据源: %s 使用默认数据源: %s', source, cls._default_source)
            source = cls._default_source
        
        scraper_info = cls._scrapers[source]
        runtime_enabled = cls._is_enabled(source, scraper_info.get('enabled', True))
        
        if not runtime_enabled:
            logger.warning('数据源已禁用: %s 使用默认数据源: %s', source, cls._default_source)
            source = cls._default_source
            scraper_info = cls._scrapers[source]
            proxy_config = None

        effective_proxy = proxy_config
        if effective_proxy is None:
            effective_proxy = cls._get_proxy_config(source)
        
        logger.info('创建爬虫实例: %s', scraper_info.get('name'))
        return scraper_info['class'](effective_proxy)
    
    @classmethod
    def get_available_sources(cls):
        """获取所有可用的数据源"""
        sources = []
        for source_id, info in cls._scrapers.items():
            runtime_enabled = cls._is_enabled(source_id, info.get('enabled', True))
            if runtime_enabled:
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
        logger.info('注册新的爬虫: %s (%s)', name, source_id)
