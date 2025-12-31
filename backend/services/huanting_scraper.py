# -*- coding: utf-8 -*-
"""
Huanting Audiobook Scraper

Crawl audiobooks from https://www.huanting.cc/
"""

from services.podcast_scraper import BasePodcastScraper
from bs4 import BeautifulSoup
import requests
import logging
import re
import time

logger = logging.getLogger(__name__)


class HuantingScraper(BasePodcastScraper):
    """Huanting.cc Audiobook Scraper"""

    CATEGORIES = {
        'xuanhuan': '玄幻武侠',
        'dushi': '都市言情',
        'kongbu': '恐怖悬疑',
        'xingzhen': '刑侦推理',
        'zhichang': '职场商战',
        'junshi': '军事历史',
        'wangyou': '网游竞技'
    }

    def __init__(self, proxy_config=None):
        super().__init__(
            base_url='https://www.huanting.cc',
            proxy_config=proxy_config
        )
        self.session = requests.Session()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://www.huanting.cc/'
        }
        self.session.headers.update(headers)

    def _make_request(self, url, timeout=15):
        """Send HTTP request"""
        try:
            response = self.session.get(url, timeout=timeout)
            response.raise_for_status()
            response.encoding = response.apparent_encoding or 'utf-8'
            return response
        except Exception as e:
            logger.error(f"Request failed: {url}, error: {e}")
            return None

    def _delay(self):
        """Request delay"""
        time.sleep(0.5 + (time.time() % 1.0))

    def get_categories(self):
        """Get category list"""
        categories = [{'id': 'all', 'name': '全部'}]
        for cat_id, cat_name in self.CATEGORIES.items():
            categories.append({'id': cat_id, 'name': cat_name})
        return {'categories': categories}

    def get_programs(self, category='all', page=1, limit=20):
        """Get program list by category"""
        self._delay()

        if category == 'all':
            url = f'{self.base_url}/'
        else:
            url = f'{self.base_url}/{category}/'

        response = self._make_request(url)
        if not response:
            return {'programs': [], 'hasMore': False, 'total': 0}

        soup = BeautifulSoup(response.text, 'lxml')
        programs = []

        # Parse book list - 实际HTML结构: <li><a class="pic" href="/book/2274.html">...</a><span class="text">...</span></li>
        book_items = soup.select('li:has(a[href*="/book/"])')

        for item in book_items[:limit]:
            try:
                # 获取链接和ID
                link_tag = item.select_one('a[href*="/book/"]')
                if not link_tag:
                    continue

                href = link_tag.get('href', '')
                # 匹配 /book/2274.html 格式
                book_id = re.search(r'/book/(\d+)\.html', href)
                if not book_id:
                    continue
                book_id = book_id.group(1)

                # 获取标题 - 在 span.text 中的链接文本
                title_span = item.select_one('span.text a')
                if title_span:
                    title = title_span.text.strip()
                else:
                    title = link_tag.get('title', '') or link_tag.text.strip()

                # 获取封面图片
                img_tag = item.select_one('img')
                cover = img_tag.get('src', '') if img_tag else ''

                # 获取状态 (完结/连载)
                status = 'Unknown'
                em_tag = item.select_one('em')
                if em_tag:
                    status = em_tag.text.strip()

                programs.append({
                    'id': book_id,
                    'title': title,
                    'cover': cover,
                    'author': '',
                    'source': 'huanting',
                    'description': '',
                    'status': status,
                    'episodes': 0,
                    'updateTime': ''
                })
            except Exception as e:
                logger.warning(f"Parse program failed: {e}")
                continue

        return {
            'programs': programs,
            'hasMore': len(programs) >= limit,
            'total': len(programs)
        }

    def get_hot_programs(self, page=1, limit=20):
        """Get hot programs"""
        return self.get_programs('all', page, limit)

    def get_latest_programs(self, page=1, limit=20):
        """Get latest programs"""
        return self.get_programs('all', page, limit)

    def get_program_detail(self, program_id):
        """Get program detail"""
        self._delay()

        url = f'{self.base_url}/book/{program_id}.html'
        response = self._make_request(url)
        if not response:
            return None

        soup = BeautifulSoup(response.text, 'lxml')

        title = ''
        cover = ''
        author = ''
        announcer = ''
        description = ''
        status = 'Unknown'
        episodes = 0

        # 获取标题
        title_tag = soup.select_one('h1')
        if title_tag:
            title = title_tag.text.strip().replace('有声小说', '')

        # 获取封面
        img_tag = soup.select_one('.right img, .img img')
        if img_tag:
            cover = img_tag.get('src', '')

        # 获取作者和主播信息
        author_span = soup.select_one('span.author')
        if author_span:
            author_text = author_span.text.strip()
            if '：' in author_text or ':' in author_text:
                author = author_text.split('：')[-1].split(':')[-1].strip()
            else:
                author = author_text.replace('作者', '').strip()

        announcer_span = soup.select_one('span.announcer')
        if announcer_span:
            announcer_text = announcer_span.text.strip()
            if '：' in announcer_text or ':' in announcer_text:
                announcer = announcer_text.split('：')[-1].split(':')[-1].strip()
            else:
                announcer = announcer_text.replace('主播', '').strip()

        # 合并作者和主播
        author = f'{author} / {announcer}' if announcer else author

        # 获取状态
        status_span = soup.select_one('span.other a')
        if status_span:
            status = status_span.text.strip()

        # 获取简介
        abstract_div = soup.select_one('.abstract')
        if abstract_div:
            # 移除h2标题
            h2 = abstract_div.find('h2')
            if h2:
                h2.decompose()
            description = abstract_div.get_text('\n', strip=True).replace('简介：', '').strip()

        # 统计章节数（通过/ting/链接）
        episode_links = soup.select('a[href*="/ting/"]')
        episodes = len(episode_links)

        return {
            'id': program_id,
            'title': title,
            'cover': cover,
            'author': author,
            'source': 'huanting',
            'description': description,
            'status': status,
            'episodes': episodes,
            'updateTime': ''
        }

    def get_episodes(self, program_id, page=1, limit=50):
        """Get episode list"""
        self._delay()

        # 章节列表在详情页中
        url = f'{self.base_url}/book/{program_id}.html'
        response = self._make_request(url)
        if not response:
            return {'episodes': [], 'hasMore': False, 'total': 0}

        soup = BeautifulSoup(response.text, 'lxml')
        episodes = []
        seen_ids = set()  # 用于去重

        # 查找所有章节链接 /ting/*.html
        chapter_links = soup.select('a[href*="/ting/"]')

        for link in chapter_links[:limit * 2]:  # 获取更多以便去重
            try:
                href = link.get('href', '')
                title = link.text.strip()

                if not title or not href:
                    continue

                # 提取episode_id - /ting/x0CN3IjM.html
                episode_id = re.search(r'/ting/([^/]+)\.html', href)
                if not episode_id:
                    continue
                episode_id = episode_id.group(1)

                # 跳过重复的episode_id
                if episode_id in seen_ids:
                    continue
                seen_ids.add(episode_id)

                episodes.append({
                    'id': episode_id,
                    'title': title,
                    'duration': 0,
                    'publishTime': '',
                    'order': len(episodes) + 1,
                    'isPlayed': False,
                    'progress': 0
                })

                if len(episodes) >= limit:
                    break
            except Exception as e:
                logger.warning(f"Parse episode failed: {e}")
                continue

        return {
            'episodes': episodes,
            'hasMore': len(chapter_links) > len(seen_ids) and len(episodes) >= limit,
            'total': len(episodes)
        }

    def get_episode_detail(self, episode_id):
        """Get episode detail with audio URL"""
        self._delay()

        url = f'{self.base_url}/ting/{episode_id}.html'
        response = self._make_request(url)
        if not response:
            return None

        soup = BeautifulSoup(response.text, 'lxml')

        title = ''
        audio_url = ''

        # 获取标题
        title_tag = soup.select_one('h1, .title')
        if title_tag:
            title = title_tag.text.strip()

        # 尝试从audio标签获取
        audio_tag = soup.select_one('audio[source], source[src]')
        if audio_tag:
            audio_url = audio_tag.get('src', '')

        # 如果没有找到音频URL，尝试从script中提取
        if not audio_url:
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string:
                    # 查找各种可能的音频URL格式
                    patterns = [
                        r'(https?://[^\s"\'<>]+\.mp3[^\s"\'<>]*)',
                        r'(https?://[^\s"\'<>]+\.m4a[^\s"\'<>]*)',
                        r'["\']audioUrl["\']:\s*["\']([^"\']+)["\']',
                        r'["\']src["\']:\s*["\']([^"\']+\.mp3[^"\']*)["\']',
                    ]
                    for pattern in patterns:
                        match = re.search(pattern, script.string)
                        if match:
                            audio_url = match.group(1)
                            break
                    if audio_url:
                        break

        # 注意: 该网站音频URL通过JavaScript动态加载，可能无法直接抓取
        # 前端需要处理空audioUrl的情况，可能需要使用其他方式播放

        return {
            'id': episode_id,
            'title': title,
            'duration': 0,
            'publishTime': '',
            'audioUrl': audio_url,
            'audioUrlBackup': audio_url,
            'playUrl': url  # 提供播放页面URL作为备选
        }

    def search(self, keyword, page=1, limit=20):
        """Search programs (not implemented in MVP)"""
        raise NotImplementedError("Search will be implemented in future version")
