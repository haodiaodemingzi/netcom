import random
from .base_scraper import BaseScraper

class KomiicScraper(BaseScraper):
    """Komiic漫画网站爬虫"""
    
    def __init__(self):
        super().__init__('https://komiic.com')

    def get_categories(self):
        """获取分类列表"""
        return {
            'categories': [
                {'id': '1', 'name': '热血', 'url': ''},
                {'id': '2', 'name': '冒险', 'url': ''},
                {'id': '3', 'name': '搞笑', 'url': ''},
            ],
            'total': 3
        }

    def get_comics_by_category(self, category_id, page=1, limit=20):
        """根据分类获取漫画列表"""
        return {
            'comics': self._generate_mock_comics(
                page, limit, f'分类{category_id}'
            ),
            'hasMore': page < 5,
            'total': 100
        }

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

class ManhuaguiScraper(BaseScraper):
    """漫画柜爬虫"""
    
    def __init__(self):
        super().__init__('https://www.manhuagui.com')

    def get_categories(self):
        return {
            'categories': [
                {'id': '1', 'name': '热血', 'url': ''},
                {'id': '2', 'name': '恋爱', 'url': ''},
            ],
            'total': 2
        }

    def get_comics_by_category(self, category_id, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, f'漫画柜分类{category_id}'
            ),
            'hasMore': page < 5,
            'total': 100
        }

    def get_hot_comics(self, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, '漫画柜'
            ),
            'hasMore': page < 5,
            'total': 100
        }

    def get_latest_comics(self, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, '漫画柜最新'
            ),
            'hasMore': page < 5,
            'total': 100
        }

    def search_comics(self, keyword, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, f'漫画柜-{keyword}'
            ),
            'hasMore': page < 3,
            'total': 50
        }

    def get_comic_detail(self, comic_id):
        return {
            'id': comic_id,
            'title': f'漫画柜-漫画 {comic_id}',
            'cover': f'https://picsum.photos/300/400?random={comic_id}',
            'author': '漫画柜作者',
            'description': '来自漫画柜的精彩漫画作品。',
            'status': 'ongoing' if int(comic_id) % 2 == 0 else 'completed',
            'rating': round(random.uniform(7.0, 9.5), 1),
            'categories': ['冒险', '热血'],
            'updateTime': '2024-01-15',
        }

    def get_chapters(self, comic_id):
        chapters = []
        chapter_count = random.randint(30, 150)
        
        for i in range(1, chapter_count + 1):
            chapters.append({
                'id': f'{comic_id}_{i}',
                'title': f'第 {i} 话',
                'order': i,
                'updateTime': '2024-01-15',
                'isRead': False,
            })
        
        return {'chapters': chapters, 'total': len(chapters)}

    def get_chapter_images(self, chapter_id):
        image_count = random.randint(10, 30)
        images = []
        
        for i in range(1, image_count + 1):
            images.append({
                'page': i,
                'url': (
                    f'https://picsum.photos/800/1200?'
                    f'random={chapter_id}_{i}'
                ),
            })
        
        return {'images': images, 'total': len(images)}

    def _generate_mock_comics(self, page, limit, prefix='comic'):
        comics = []
        start = (page - 1) * limit
        
        for i in range(start, start + limit):
            comic_id = i + 1
            comics.append({
                'id': str(comic_id),
                'title': f'{prefix} {comic_id}',
                'cover': f'https://picsum.photos/300/400?random={comic_id}',
                'latestChapter': f'第 {random.randint(1, 200)} 话',
                'status': (
                    'ongoing' if comic_id % 2 == 0 else 'completed'
                ),
                'rating': round(random.uniform(7.0, 9.5), 1),
                'updateTime': '2024-01-15',
            })
        
        return comics


class CopymangaScraper(BaseScraper):
    """拷贝漫画爬虫"""
    
    def __init__(self):
        super().__init__('https://www.copymanga.site')

    def get_categories(self):
        return {
            'categories': [
                {'id': '1', 'name': '搞笑', 'url': ''},
                {'id': '2', 'name': '恋爱', 'url': ''},
            ],
            'total': 2
        }

    def get_comics_by_category(self, category_id, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, f'拷贝漫画分类{category_id}'
            ),
            'hasMore': page < 5,
            'total': 100
        }

    def get_hot_comics(self, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, '拷贝漫画'
            ),
            'hasMore': page < 5,
            'total': 100
        }

    def get_latest_comics(self, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, '拷贝漫画最新'
            ),
            'hasMore': page < 5,
            'total': 100
        }

    def search_comics(self, keyword, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, f'拷贝漫画-{keyword}'
            ),
            'hasMore': page < 3,
            'total': 50
        }

    def get_comic_detail(self, comic_id):
        return {
            'id': comic_id,
            'title': f'拷贝漫画-作品 {comic_id}',
            'cover': f'https://picsum.photos/300/400?random={comic_id}',
            'author': '拷贝漫画作者',
            'description': '来自拷贝漫画的优质作品。',
            'status': 'ongoing' if int(comic_id) % 2 == 0 else 'completed',
            'rating': round(random.uniform(7.0, 9.5), 1),
            'categories': ['搞笑', '恋爱'],
            'updateTime': '2024-01-15',
        }

    def get_chapters(self, comic_id):
        chapters = []
        chapter_count = random.randint(40, 180)
        
        for i in range(1, chapter_count + 1):
            chapters.append({
                'id': f'{comic_id}_{i}',
                'title': f'第 {i} 话',
                'order': i,
                'updateTime': '2024-01-15',
                'isRead': False,
            })
        
        return {'chapters': chapters, 'total': len(chapters)}

    def get_chapter_images(self, chapter_id):
        image_count = random.randint(12, 35)
        images = []
        
        for i in range(1, image_count + 1):
            images.append({
                'page': i,
                'url': (
                    f'https://picsum.photos/800/1200?'
                    f'random={chapter_id}_{i}'
                ),
            })
        
        return {'images': images, 'total': len(images)}

    def _generate_mock_comics(self, page, limit, prefix='comic'):
        comics = []
        start = (page - 1) * limit
        
        for i in range(start, start + limit):
            comic_id = i + 1
            comics.append({
                'id': str(comic_id),
                'title': f'{prefix} {comic_id}',
                'cover': f'https://picsum.photos/300/400?random={comic_id}',
                'latestChapter': f'第 {random.randint(1, 200)} 话',
                'status': (
                    'ongoing' if comic_id % 2 == 0 else 'completed'
                ),
                'rating': round(random.uniform(7.0, 9.5), 1),
                'updateTime': '2024-01-15',
            })
        
        return comics


class MockScraper(BaseScraper):
    """测试数据爬虫"""
    
    def __init__(self):
        super().__init__('http://localhost')

    def get_categories(self):
        return {
            'categories': [
                {'id': '1', 'name': '热血', 'url': ''},
                {'id': '2', 'name': '冒险', 'url': ''},
                {'id': '3', 'name': '搞笑', 'url': ''},
                {'id': '4', 'name': '恋爱', 'url': ''},
            ],
            'total': 4
        }

    def get_comics_by_category(self, category_id, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, f'分类{category_id}'
            ),
            'hasMore': page < 5,
            'total': 100
        }

    def get_hot_comics(self, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(page, limit),
            'hasMore': page < 5,
            'total': 100
        }

    def get_latest_comics(self, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, 'latest'
            ),
            'hasMore': page < 5,
            'total': 100
        }

    def search_comics(self, keyword, page=1, limit=20):
        return {
            'comics': self._generate_mock_comics(
                page, limit, keyword
            ),
            'hasMore': page < 3,
            'total': 50
        }

    def get_comic_detail(self, comic_id):
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
        
        return {'chapters': chapters, 'total': len(chapters)}

    def get_chapter_images(self, chapter_id):
        image_count = random.randint(15, 40)
        images = []
        
        for i in range(1, image_count + 1):
            images.append({
                'page': i,
                'url': (
                    f'https://picsum.photos/800/1200?'
                    f'random={chapter_id}_{i}'
                ),
            })
        
        return {'images': images, 'total': len(images)}

    def _generate_mock_comics(self, page, limit, prefix='comic'):
        comics = []
        start = (page - 1) * limit
        
        for i in range(start, start + limit):
            comic_id = i + 1
            comics.append({
                'id': str(comic_id),
                'title': f'{prefix} 漫画标题 {comic_id}',
                'cover': f'https://picsum.photos/300/400?random={comic_id}',
                'latestChapter': f'第 {random.randint(1, 200)} 话',
                'status': (
                    'ongoing' if comic_id % 2 == 0 else 'completed'
                ),
                'rating': round(random.uniform(7.0, 9.5), 1),
                'updateTime': '2024-01-15',
            })
        
        return comics
