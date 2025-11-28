import requests
import time
import random
from abc import ABC, abstractmethod

class BaseScraper(ABC):
    """爬虫基类,所有数据源都需要继承此类"""
    
    def __init__(self, base_url, proxy_config=None):
        self.base_url = base_url
        self.proxy_config = proxy_config
        self.headers = {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/120.0.0.0 Safari/537.36'
            ),
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        
        # 配置代理
        if proxy_config and proxy_config.get('enabled'):
            proxy_type = proxy_config.get('type', 'http')
            proxy_host = proxy_config.get('host', '127.0.0.1')
            proxy_port = proxy_config.get('port', 7897)
            proxy_url = f'{proxy_type}://{proxy_host}:{proxy_port}'
            self.session.proxies = {
                'http': proxy_url,
                'https': proxy_url
            }
            print(f"使用代理: {proxy_url}")

    def _delay(self):
        """随机延迟,避免请求过快"""
        time.sleep(random.uniform(0.5, 1.5))

    def _make_request(self, url, verify_ssl=True):
        """发送HTTP请求"""
        try:
            self._delay()
            
            # requests会自动处理gzip，但确保Accept-Encoding头存在
            response = self.session.get(url, timeout=10, verify=verify_ssl)
            response.raise_for_status()
            
            # 如果响应编码不正确，尝试自动检测
            if response.encoding is None or response.encoding.lower() == 'iso-8859-1':
                # ISO-8859-1是requests的默认值，通常不正确
                response.encoding = response.apparent_encoding
            
            return response
        except requests.RequestException as e:
            print(f'请求失败: {url}, 错误: {e}')
            return None

    @abstractmethod
    def get_hot_comics(self, page=1, limit=20):
        """获取热门漫画"""
        pass

    @abstractmethod
    def get_latest_comics(self, page=1, limit=20):
        """获取最新漫画"""
        pass

    @abstractmethod
    def search_comics(self, keyword, page=1, limit=20):
        """搜索漫画"""
        pass

    @abstractmethod
    def get_comic_detail(self, comic_id):
        """获取漫画详情"""
        pass

    @abstractmethod
    def get_chapters(self, comic_id):
        """获取章节列表"""
        pass

    @abstractmethod
    def get_chapter_images(self, chapter_id):
        """获取章节图片列表"""
        pass

    @abstractmethod
    def get_categories(self):
        """获取分类列表"""
        pass

    @abstractmethod
    def get_comics_by_category(self, category_id, page=1, limit=20):
        """根据分类获取漫画列表"""
        pass
