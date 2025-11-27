import requests
import time
import random
from abc import ABC, abstractmethod

class BaseScraper(ABC):
    """爬虫基类,所有数据源都需要继承此类"""
    
    def __init__(self, base_url):
        self.base_url = base_url
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

    def _delay(self):
        """随机延迟,避免请求过快"""
        time.sleep(random.uniform(0.5, 1.5))

    def _make_request(self, url):
        """发送HTTP请求"""
        try:
            self._delay()
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
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
