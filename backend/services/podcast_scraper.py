"""
播客爬虫基类

提供播客数据抓取的基础功能,具体数据源需要继承此类实现具体逻辑
"""


class BasePodcastScraper:
    """播客爬虫基类"""

    def __init__(self, base_url=None, proxy_config=None):
        self.base_url = base_url
        self.proxy_config = proxy_config

    def get_sources(self):
        """获取数据源信息"""
        raise NotImplementedError

    def get_categories(self):
        """获取分类列表"""
        raise NotImplementedError

    def get_programs(self, category='all', page=1, limit=20):
        """获取播客节目列表"""
        raise NotImplementedError

    def get_hot_programs(self, page=1, limit=20):
        """获取热门播客"""
        raise NotImplementedError

    def get_latest_programs(self, page=1, limit=20):
        """获取最新播客"""
        raise NotImplementedError

    def get_program_detail(self, program_id):
        """获取播客详情"""
        raise NotImplementedError

    def get_episodes(self, program_id, page=1, limit=50):
        """获取节目单集列表"""
        raise NotImplementedError

    def get_episode_detail(self, episode_id):
        """获取单集详情(含音频地址)"""
        raise NotImplementedError

    def search(self, keyword, page=1, limit=20):
        """搜索播客"""
        raise NotImplementedError


class XimalayaScraper(BasePodcastScraper):
    """喜马拉雅播客爬虫(预留实现)"""

    def __init__(self):
        super().__init__(base_url='https://www.ximalaya.com')

    def _mock_programs(self, category, page, limit):
        """生成模拟数据"""
        categories = {
            '有声书': ['三国演义', '西游记', '红楼梦', '水浒传', '封神演义'],
            '相声评书': ['单田芳评书集', '郭德纲相声', '侯宝林相声', '马三立相声'],
            '音乐': ['古典音乐', '流行歌曲', '民谣故事', '音乐鉴赏'],
            '情感': ['夜听', '情感故事', '心理治愈', '星座运势'],
            '知识': ['晓说', '罗辑思维', '樊登读书', '得到精选'],
            '儿童': ['童话故事', '儿童国学', '宝宝巴士', '凯叔讲故事'],
            '历史': ['百家讲坛', '历史故事', '史记精选', '中华上下五千年']
        }

        titles = categories.get(category, categories['有声书'])
        start_idx = (page - 1) * limit

        programs = []
        for i in range(limit):
            idx = start_idx + i
            title = titles[idx % len(titles)]
            programs.append({
                'id': str(100000 + idx),
                'title': f'{title} #{idx + 1}',
                'cover': f'https://picsum.photos/seed/podcast{idx}/200/200',
                'author': f'主播{chr(65 + (idx % 26))}',
                'source': 'ximalaya',
                'episodes': 50 + (idx % 100),
                'description': f'这是{title}的详细内容介绍...',
                'updateTime': '2024-12-01'
            })

        return {
            'programs': programs,
            'hasMore': start_idx + limit < 200,
            'total': 200
        }

    def get_categories(self):
        """获取分类列表(模拟数据)"""
        return {
            'categories': [
                {'id': 'all', 'name': '全部'},
                {'id': '有声书', 'name': '有声书'},
                {'id': '相声评书', 'name': '相声评书'},
                {'id': '音乐', 'name': '音乐'},
                {'id': '情感', 'name': '情感'},
                {'id': '知识', 'name': '知识'},
                {'id': '儿童', 'name': '儿童'},
                {'id': '历史', 'name': '历史'}
            ]
        }

    def get_programs(self, category='all', page=1, limit=20):
        """获取播客节目列表(模拟数据)"""
        return self._mock_programs(category, page, limit)

    def get_hot_programs(self, page=1, limit=20):
        """获取热门播客(模拟数据)"""
        return self._mock_programs('有声书', page, limit)

    def get_latest_programs(self, page=1, limit=20):
        """获取最新播客(模拟数据)"""
        return self._mock_programs('all', page, limit)

    def get_program_detail(self, program_id):
        """获取播客详情(模拟数据)"""
        return {
            'id': program_id,
            'title': '三国演义',
            'cover': 'https://picsum.photos/seed/detail/400/400',
            'author': '单田芳',
            'source': 'ximalaya',
            'episodes': 200,
            'description': '经典评书三国演义,讲述东汉末年群雄割据的波澜壮阔历史...',
            'playCount': '1.2亿',
            'updateTime': '2024-12-01'
        }

    def get_episodes(self, program_id, page=1, limit=50):
        """获取节目单集列表(模拟数据)"""
        episodes = []
        start_idx = (page - 1) * limit

        for i in range(limit):
            idx = start_idx + i
            is_played = idx < 10
            episodes.append({
                'id': f'ep_{program_id}_{idx + 1:03d}',
                'title': f'第{idx + 1}回 桃园三结义',
                'duration': 1800 + (idx * 60),
                'publishTime': f'2024-{1 + (idx % 12):02d}-{(1 + (idx * 3) % 28):02d}',
                'order': idx + 1,
                'isPlayed': is_played,
                'progress': 1800 if is_played else 0
            })

        return {
            'episodes': episodes,
            'hasMore': start_idx + limit < 200,
            'total': 200
        }

    def get_episode_detail(self, episode_id):
        """获取单集详情(模拟数据)"""
        return {
            'id': episode_id,
            'title': '第一回 桃园三结义',
            'programId': '123456',
            'programTitle': '三国演义',
            'duration': 1800,
            'publishTime': '2024-01-01',
            'audioUrl': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            'audioUrlBackup': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
        }

    def search(self, keyword, page=1, limit=20):
        """搜索播客(模拟数据)"""
        return self._mock_programs(keyword, page, limit)


class LizhiScraper(BasePodcastScraper):
    """荔枝FM播客爬虫(预留实现)"""

    def __init__(self):
        super().__init__(base_url='https://www.lizhi.fm')

    def get_categories(self):
        """获取分类列表"""
        return {
            'categories': [
                {'id': 'all', 'name': '全部'},
                {'id': '情感', 'name': '情感'},
                {'id': '音乐', 'name': '音乐'},
                {'id': '相声', 'name': '相声'},
                {'id': '故事', 'name': '故事'},
                {'id': '资讯', 'name': '资讯'}
            ]
        }

    def get_programs(self, category='all', page=1, limit=20):
        """获取播客节目列表"""
        return {
            'programs': [
                {
                    'id': 'lz_001',
                    'title': f'荔枝播客 #{page}',
                    'cover': 'https://picsum.photos/seed/lz/200/200',
                    'author': '主播A',
                    'source': 'lizhi',
                    'episodes': 30,
                    'description': '荔枝FM播客节目',
                    'updateTime': '2024-12-01'
                }
            ],
            'hasMore': False,
            'total': 1
        }

    def get_hot_programs(self, page=1, limit=20):
        """获取热门播客"""
        return self.get_programs('all', page, limit)

    def get_latest_programs(self, page=1, limit=20):
        """获取最新播客"""
        return self.get_programs('all', page, limit)

    def get_program_detail(self, program_id):
        """获取播客详情"""
        return {
            'id': program_id,
            'title': '荔枝播客',
            'cover': 'https://picsum.photos/seed/lz_detail/400/400',
            'author': '主播A',
            'source': 'lizhi',
            'episodes': 30,
            'description': '荔枝FM播客详情',
            'playCount': '100万',
            'updateTime': '2024-12-01'
        }

    def get_episodes(self, program_id, page=1, limit=50):
        """获取节目单集列表"""
        return {
            'episodes': [
                {
                    'id': f'ep_lz_{program_id}_001',
                    'title': '第一期',
                    'duration': 1200,
                    'publishTime': '2024-01-01',
                    'order': 1,
                    'isPlayed': False,
                    'progress': 0
                }
            ],
            'hasMore': False,
            'total': 1
        }

    def get_episode_detail(self, episode_id):
        """获取单集详情"""
        return {
            'id': episode_id,
            'title': '第一期',
            'programId': program_id if hasattr(program_id, '__iter__') else 'lz_001',
            'programTitle': '荔枝播客',
            'duration': 1200,
            'publishTime': '2024-01-01',
            'audioUrl': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
        }

    def search(self, keyword, page=1, limit=20):
        """搜索播客"""
        return self.get_programs(keyword, page, limit)
