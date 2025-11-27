import requests
from bs4 import BeautifulSoup
import time
import random

class KomiicScraper:
    """Komiic漫画网站爬虫"""
    
    def __init__(self):
        self.base_url = 'https://komiic.com'
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

    def get_hot_comics(self, page=1, limit=20):
        """获取热门漫画"""
        # 这里返回模拟数据,实际需要根据网站结构解析
        return {
            'comics': self._generate_mock_comics(page, limit),
            'hasMore': page < 5,
            'total': 100
        }

    def get_latest_comics(self, page=1, limit=20):
        """获取最新漫画"""
        return {
            'comics': self._generate_mock_comics(page, limit, 'latest'),
            'hasMore': page < 5,
            'total': 100
        }

    def search_comics(self, keyword, page=1, limit=20):
        """搜索漫画"""
        return {
            'comics': self._generate_mock_comics(page, limit, keyword),
            'hasMore': page < 3,
            'total': 50
        }

    def get_comic_detail(self, comic_id):
        """获取漫画详情"""
        return {
            'id': comic_id,
            'title': f'测试漫画 {comic_id}',
            'cover': f'https://picsum.photos/300/400?random={comic_id}',
            'author': '测试作者',
            'description': (
                '这是一部精彩的漫画作品,讲述了主人公的冒险故事。'
                '故事情节跌宕起伏,人物形象鲜明,画风精美。'
            ),
            'status': 'ongoing' if int(comic_id) % 2 == 0 else 'completed',
            'rating': round(random.uniform(7.0, 9.5), 1),
            'categories': ['冒险', '热血', '搞笑'],
            'updateTime': '2024-01-15',
        }

    def get_chapters(self, comic_id):
        """获取章节列表"""
        chapters = []
        chapter_count = random.randint(50, 200)
        
        for i in range(1, chapter_count + 1):
            chapters.append({
                'id': f'{comic_id}_{i}',
                'title': f'第 {i} 话',
                'order': i,
                'updateTime': '2024-01-15',
                'isRead': False,
            })
        
        return {
            'chapters': chapters,
            'total': len(chapters)
        }

    def get_chapter_images(self, chapter_id):
        """获取章节图片列表"""
        image_count = random.randint(15, 40)
        images = []
        
        for i in range(1, image_count + 1):
            images.append({
                'page': i,
                'url': f'https://picsum.photos/800/1200?random={chapter_id}_{i}',
            })
        
        return {
            'images': images,
            'total': len(images)
        }

    def _generate_mock_comics(self, page, limit, prefix='comic'):
        """生成模拟漫画数据"""
        comics = []
        start = (page - 1) * limit
        
        for i in range(start, start + limit):
            comic_id = i + 1
            comics.append({
                'id': str(comic_id),
                'title': f'{prefix} 漫画标题 {comic_id}',
                'cover': f'https://picsum.photos/300/400?random={comic_id}',
                'latestChapter': f'第 {random.randint(1, 200)} 话',
                'status': 'ongoing' if comic_id % 2 == 0 else 'completed',
                'rating': round(random.uniform(7.0, 9.5), 1),
                'updateTime': '2024-01-15',
            })
        
        return comics

# 创建全局实例
scraper = KomiicScraper()
