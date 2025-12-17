import re
import logging
from bs4 import BeautifulSoup
from urllib.parse import quote

from .base_video_scraper import BaseVideoScraper

logger = logging.getLogger(__name__)


class BadNewsOriginalVideoScraper(BaseVideoScraper):
    def __init__(self, proxy_config=None):
        super().__init__('https://bad.news', proxy_config)
        self.source_id = '原创视频'
        self.source_name = '原创视频'
        self.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://bad.news/',
        })
        self.session.headers.update(self.headers)

    def get_categories(self):
        return [
            {'id': 'porn/sort-hot', 'name': '热门'},
            {'id': 'porn/sort-new', 'name': '最新'},
            {'id': 'porn/sort-score', 'name': '得分'},
            {'id': 'porn/sort-better', 'name': '精选'},
            {'id': 'long-porn', 'name': '长视频'},
        ]

    def get_videos_by_category(self, category_id='long-porn', page=1, limit=30):
        normalized_category = self._normalize_category(category_id)
        url = self._build_tag_url(normalized_category, page)

        response = self._make_request(url)
        if not response:
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        return self._parse_video_list_from_soup(soup, limit)

    def get_video_detail(self, video_id):
        if self._is_blank(video_id):
            return None

        url = f'{self.base_url}/ai/{video_id}'
        response = self._make_request(url)
        if not response:
            return None

        soup = BeautifulSoup(response.text, 'html.parser')
        container = self._find_topic_container_by_id(soup, video_id)
        if not container:
            return None

        title = self._extract_title(container)
        cover = self._normalize_url(self._extract_cover_from_container(container))
        tags = self._extract_tags(container)

        if self._is_blank(title):
            title = video_id

        return {
            'id': video_id,
            'title': title,
            'cover': cover,
            'tags': tags,
            'description': '',
            'source': self.source_id,
        }

    def get_episodes(self, video_id):
        if self._is_blank(video_id):
            return []

        detail = self.get_video_detail(video_id)
        title = ''
        if detail:
            title = detail.get('title', '')

        if self._is_blank(title):
            title = '第1集'

        return [
            {
                'id': video_id,
                'seriesId': video_id,
                'title': title,
                'episodeNumber': 1,
                'playUrl': f'{self.base_url}/ai/{video_id}',
                'source': self.source_id,
            }
        ]

    def get_episode_detail(self, episode_id):
        if self._is_blank(episode_id):
            return None

        url = f'{self.base_url}/ai/{episode_id}'
        response = self._make_request(url)
        if not response:
            return None

        soup = BeautifulSoup(response.text, 'html.parser')
        container = self._find_topic_container_by_id(soup, episode_id)
        if not container:
            logger.error('未找到匹配的内容容器 episode_id=%s url=%s', episode_id, url)
            return None

        title = self._extract_title(container)
        if self._is_blank(title):
            title = '第1集'

        video_url = self._extract_video_url(container)
        cover = self._normalize_url(self._extract_cover_from_container(container))

        return {
            'id': episode_id,
            'seriesId': episode_id,
            'title': title,
            'episodeNumber': 1,
            'videoUrl': video_url,
            'cover': cover,
            'playUrl': url,
            'source': self.source_id,
        }

    def search_videos(self, keyword, page=1, limit=30):
        if self._is_blank(keyword):
            return []

        encoded = quote(keyword)
        url = self._build_search_url(encoded, page)

        response = self._make_request(url)
        if not response:
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        return self._parse_video_list_from_soup(soup, limit)

    def _build_tag_url(self, category_id, page):
        if page and int(page) > 1:
            return f'{self.base_url}/tag/{category_id}/page-{int(page)}'
        return f'{self.base_url}/tag/{category_id}'

    def _build_search_url(self, encoded_keyword, page):
        if page and int(page) > 1:
            return f'{self.base_url}/search/q-{encoded_keyword}/via-log/page-{int(page)}'
        return f'{self.base_url}/search/q-{encoded_keyword}/via-log'

    def _normalize_category(self, category_id):
        if self._is_blank(category_id) or category_id in {'hot', 'all'}:
            return 'porn/sort-hot'

        allowed = {
            'porn/sort-hot',
            'porn/sort-new',
            'porn/sort-score',
            'porn/sort-better',
            'long-porn',
        }
        if category_id not in allowed:
            return 'porn/sort-hot'

        return category_id

    def _parse_video_list_from_soup(self, soup, limit):
        if not soup:
            return []

        videos = []
        seen_ids = set()

        video_tags = soup.find_all('video')
        for video_tag in video_tags:
            if len(videos) >= limit:
                break

            container = self._find_container_from_video(video_tag)
            if not container:
                continue

            topic_id = self._extract_topic_id_from_container(container)
            if self._is_blank(topic_id) or topic_id in seen_ids:
                continue

            title = self._extract_title(container)
            if self._is_blank(title):
                continue

            cover = self._normalize_url(self._extract_cover_from_video_tag(video_tag))

            videos.append({
                'id': topic_id,
                'title': title,
                'cover': cover,
                'source': self.source_id,
            })
            seen_ids.add(topic_id)

        return videos

    def _find_container_from_video(self, video_tag):
        if not video_tag:
            return None

        current = video_tag
        depth = 0
        while current and depth < 8:
            if self._extract_topic_id_from_container(current):
                return current
            current = getattr(current, 'parent', None)
            depth += 1
        return None

    def _find_topic_container_by_id(self, soup, topic_id):
        if not soup or self._is_blank(topic_id):
            return None

        download_link = soup.find('a', href=re.compile(rf'/ajax/topic/{re.escape(topic_id)}/download'))
        if download_link:
            container = self._walk_up_until_has_video(download_link)
            if container:
                return container

        ai_link = soup.find('a', href=re.compile(rf'/ai/{re.escape(topic_id)}(?:/|$)'))
        if ai_link:
            container = self._walk_up_until_has_video(ai_link)
            if container:
                return container

        return None

    def _walk_up_until_has_video(self, node):
        current = node
        depth = 0
        while current and depth < 10:
            if getattr(current, 'name', None) and current.find('video'):
                return currenmg
            current = getattr(current, 'parent', None)
            depth += 1
        return None

    def _extract_topic_id_from_container(self, container):
        if not container:
            return ''

        link = container.find('a', href=re.compile(r'/ajax/topic/(\d+)/download'))
        if link:
            href = link.get('href', '')
            match = re.search(r'/ajax/topic/(\d+)/download', href)
            if match:
                return match.group(1)

        link = container.find('a', href=re.compile(r'/ai/(\d+)'))
        if link:
            href = link.get('href', '')
            match = re.search(r'/ai/(\d+)', href)
            if match:
                return match.group(1)

        return ''

    def _extract_title(self, container):
        if not container:
            return ''

        title_node = container.find(['h3', 'h2', 'h4'])
        if title_node:
            title = title_node.get_text(strip=True)
            if not self._is_blank(title):
                return title

        return ''

    def _extract_cover_from_video_tag(self, video_tag):
        if not video_tag:
            return ''
        poster = video_tag.get('poster', '') or ''
        if not self._is_blank(poster):
            return poster

        data_poster = video_tag.get('data-poster', '') or ''
        if not self._is_blank(data_poster):
            return data_poster

        return ''

    def _extract_cover_from_container(self, container):
        if not container:
            return ''

        video_tag = container.find('video')
        if video_tag:
            poster = video_tag.get('poster', '')
            if not self._is_blank(poster):
                return poster

            data_poster = video_tag.get('data-poster', '')
            if not self._is_blank(data_poster):
                return data_poster

        img = container.find('img')
        if img:
            return img.get('data-echo', '') or img.get('data-src', '') or img.get('src', '')

        return ''

    def _extract_video_url(self, container):
        if not container:
            return None

        video_tag = container.find('video')
        if not video_tag:
            return None

        url = video_tag.get('data-source', '') or video_tag.get('src', '')
        if not self._is_blank(url):
            return url.replace('&amp;', '&')

        source_tag = video_tag.find('source')
        if source_tag:
            src = source_tag.get('src', '')
            if not self._is_blank(src):
                return src.replace('&amp;', '&')

        return None

    def _extract_tags(self, container):
        if not container:
            return []

        tags = []
        seen = set()
        for link in container.find_all('a', href=re.compile(r'^/tag/')):
            text = link.get_text(strip=True)
            if self._is_blank(text):
                continue
            if text in {'短视频', '长视频'}:
                continue
            if text in seen:
                continue
            seen.add(text)
            tags.append(text)
        return tags

    def _normalize_url(self, url):
        if self._is_blank(url):
            return ''
        if url.startswith('//'):
            return 'https:' + url
        if url.startswith('/'):
            return self.base_url + url
        return url

    def _is_blank(self, text):
        if text is None:
            return True
        return not str(text).strip()
