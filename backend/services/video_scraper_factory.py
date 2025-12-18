from .thanju_scraper import ThanjuScraper
from .badnews_scraper import BadNewsScraper
from .badnews_av_scraper import BadNewsAVScraper
from .badnews_original_video_scraper import BadNewsOriginalVideoScraper
from .mjwu_scraper import MjwuScraper
from .yinghua_scraper import YinghuaScraper
from .heli999_scraper import Heli999Scraper
from .youtube_scraper import YouTubeScraper
from .didahd_scraper import DidahdScraper
from .netflixgc_scraper import NetflixgcScraper
from .keke6_scraper import Keke6Scraper

class VideoScraperFactory:
    """视频爬虫工厂类"""
    
    _scrapers = {
        'thanju': ThanjuScraper,
        'badnews': BadNewsScraper,
        'badnews_av': BadNewsAVScraper,
        '原创视频': BadNewsOriginalVideoScraper,
        'mjwu': MjwuScraper,
        'yinghua': YinghuaScraper,
        'heli999': Heli999Scraper,
        'youtube': YouTubeScraper,
        'didahd': DidahdScraper,
        'netflixgc': NetflixgcScraper,
        'keke6': Keke6Scraper,
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
            },
            {
                'id': 'youtube',
                'name': 'YouTube订阅',
                'description': 'YouTube - 订阅博主视频列表'
            },
            {
                'id': 'keke6',
                'name': '可可影视',
                'description': '可可影视(keke6.app) - 电影 连续剧 动漫 综艺纪录 短剧'
            },
            {
                'id': 'didahd',
                'name': '嘀嗒影视',
                'description': '嘀嗒影视(didahd.pro) - 电影电视剧动漫综艺'
            },
            {
                'id': 'heli999',
                'name': '河狸影视',
                'description': '河狸影视(heli999.com) - 电影/电视剧/综艺/动漫/短剧'
            },
            {
                'id': '原创视频',
                'name': '原创视频',
                'description': 'Bad.news - 标签页短视频与长视频'
            },
            {
                'id': 'badnews',
                'name': 'Bad.news H动漫',
                'description': 'Bad.news - H动漫在线观看'
            },
            {
                'id': 'badnews_av',
                'name': 'Bad.news AV',
                'description': 'Bad.news - 日本AV在线观看'
            },
            {
                'id': 'mjwu',
                'name': '美剧屋',
                'description': '美剧屋(mjwu.cc) - 提供最新美剧、电影资源'
            },
            {
                'id': 'yinghua',
                'name': '樱花动漫',
                'description': '樱花动漫(yinghuajinju.com) - 日本/国漫/美漫资源'
            },
            {
                'id': 'netflixgc',
                'name': '奈飞工厂',
                'description': '奈飞工厂(netflixgc.com) - 电影/连续剧/综艺/纪录片/漫剧'
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

