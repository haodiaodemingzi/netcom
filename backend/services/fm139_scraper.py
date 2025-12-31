# -*- coding: utf-8 -*-
"""
139FM Podcast Scraper

Crawl podcasts from https://139fm.click/podcasts
"""

from services.podcast_scraper import BasePodcastScraper
from bs4 import BeautifulSoup
import requests
import logging
import re
import json
import time
import base64

logger = logging.getLogger(__name__)


class Fm139Scraper(BasePodcastScraper):
    """139FM Podcast Scraper"""

    # 分类映射 (从页面推断)
    CATEGORIES = {
        'all': '全部',
        'area-1': '长篇有声',
    }

    def __init__(self, proxy_config=None):
        super().__init__(
            base_url='https://139fm.click',
            proxy_config=proxy_config
        )
        self.session = requests.Session()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Referer': 'https://139fm.click/'
        }
        self.session.headers.update(headers)

    def _make_request(self, url, timeout=15):
        """发送HTTP请求"""
        try:
            response = self.session.get(url, timeout=timeout)
            response.raise_for_status()
            response.encoding = 'utf-8'
            return response
        except Exception as e:
            logger.error(f"Request failed: {url}, error: {e}")
            return None

    def _delay(self):
        """请求延迟"""
        time.sleep(0.5 + (time.time() % 1.0))

    def _rot13(self, s):
        """ROT13 变换 - 用于解密 139FM 音频 URL

        将字母表中的每个字母向后移动 13 位：
        - a-z 变成 n-za-m
        - A-Z 变成 N-ZA-M
        """
        result = []
        a_code = ord('a')
        a_end = a_code + 26  # z
        A_code = ord('A')
        A_end = A_code + 26  # Z

        for char in s:
            code = ord(char)
            # 小写字母 a-z，向后移 13 位
            if a_code <= code < a_end:
                result.append(chr((code - a_code + 13) % 26 + a_code))
            # 大写字母 A-Z，向后移 13 位
            elif A_code <= code < A_end:
                result.append(chr((code - A_code + 13) % 26 + A_code))
            else:
                result.append(char)
        return ''.join(result)

    def _decrypt_string(self, encrypted_str):
        """解密单个加密字符串

        解密步骤：
        1. ROT13 变换
        2. Base64 解码
        3. 再次 ROT13 变换
        """
        try:
            # 第一步: ROT13 变换
            step1 = self._rot13(encrypted_str)
            # 第二步: Base64 解码
            step2 = base64.b64decode(step1).decode('utf-8')
            # 第三步: 再次 ROT13 变换
            step3 = self._rot13(step2)
            return step3
        except Exception as e:
            logger.warning(f"Decrypt failed: {e}")
            return ''

    def _extract_audio_urls(self, html):
        """从页面 HTML 中提取并解密音频 URL 列表

        页面中的数据结构：
        var _conf = {
            a: ['加密字符串1', '加密字符串2', ...],
            c: ''
        };
        var lists = _a();  // 解密后的音频URL数组
        """
        # 提取 _conf.a 数组中的加密字符串
        # 格式: a: ['encrypted1','','','',]
        conf_match = re.search(r'_conf\s*=\s*\{[^}]*a\s*:\s*\[([^\]]+)\]', html, re.DOTALL)
        if not conf_match:
            return []

        # 提取所有单引号或双引号包裹的字符串
        encrypted_strings = re.findall(r"['\"]([^'\"]+)['\"]", conf_match.group(1))

        audio_urls = []
        for enc_str in encrypted_strings:
            if enc_str:  # 跳过空字符串
                decrypted = self._decrypt_string(enc_str)
                if decrypted and decrypted.startswith('http'):
                    # 解密后的字符串可能包含多个 URL，用逗号分隔
                    urls = decrypted.split(',')
                    audio_urls.extend(urls)

        return audio_urls

    def get_categories(self):
        """获取分类列表"""
        categories = [{'id': 'all', 'name': '全部'}]

        # 从页面动态获取分类
        response = self._make_request(f'{self.base_url}/podcasts')
        if response:
            soup = BeautifulSoup(response.text, 'lxml')
            # 查找 area 链接
            area_links = soup.select('a[href*="/podcasts/?area="]')
            for link in area_links:
                href = link.get('href', '')
                name = link.get_text(strip=True)
                area_match = re.search(r'area=(\d+)', href)
                if area_match:
                    area_id = f'area-{area_match.group(1)}'
                    categories.append({'id': area_id, 'name': name})

        return {'categories': categories}

    def get_programs(self, category='all', page=1, limit=20):
        """获取节目列表"""
        self._delay()

        # 构建URL
        url = f'{self.base_url}/podcasts'
        if category != 'all':
            # 处理 area-1 -> area=1
            if category.startswith('area-'):
                area_id = category.split('-')[1]
                url = f'{self.base_url}/podcasts/?area={area_id}'
            elif category.startswith('tag-'):
                tag_name = category.split('-', 1)[1]
                url = f'{self.base_url}/podcasts/?tag={tag_name}'

        response = self._make_request(url)
        if not response:
            return {'programs': [], 'hasMore': False, 'total': 0}

        soup = BeautifulSoup(response.text, 'lxml')
        programs = []

        # 查找所有节目链接
        podcast_links = soup.select('a[href*="/podcast/"]')
        seen_ids = set()

        for link in podcast_links[:limit * 2]:
            try:
                href = link.get('href', '')
                text = link.get_text(strip=True)

                if not href or not text:
                    continue

                # 提取节目ID
                podcast_id = re.search(r'/podcast/(\d+)', href)
                if not podcast_id:
                    continue
                podcast_id = podcast_id.group(1)

                # 去重
                if podcast_id in seen_ids:
                    continue
                seen_ids.add(podcast_id)

                # 获取封面（从 img 标签或父元素）
                cover = ''
                img = link.find('img')
                if img:
                    cover = img.get('src', '') or img.get('data-src', '')

                programs.append({
                    'id': podcast_id,
                    'title': text,
                    'cover': cover,
                    'author': '',
                    'source': 'fm139',
                    'description': '',
                    'episodes': 0,
                    'updateTime': ''
                })

                if len(programs) >= limit:
                    break
            except Exception as e:
                logger.warning(f"Parse program failed: {e}")
                continue

        return {
            'programs': programs,
            'hasMore': len(podcast_links) > len(seen_ids) and len(programs) >= limit,
            'total': len(programs)
        }

    def get_hot_programs(self, page=1, limit=20):
        """获取热门节目"""
        # 使用 /hot 排行页面
        self._delay()
        url = f'{self.base_url}/hot'
        # 使用类似的解析逻辑
        return self._parse_programs_from_url(url, page, limit)

    def get_latest_programs(self, page=1, limit=20):
        """获取最新节目"""
        # 使用 /update 更新页面
        self._delay()
        url = f'{self.base_url}/update'
        return self._parse_programs_from_url(url, page, limit)

    def _parse_programs_from_url(self, url, page, limit):
        """从指定URL解析节目列表"""
        response = self._make_request(url)
        if not response:
            return {'programs': [], 'hasMore': False, 'total': 0}

        soup = BeautifulSoup(response.text, 'lxml')
        programs = []
        podcast_links = soup.select('a[href*="/podcast/"]')

        for link in podcast_links[:limit]:
            try:
                href = link.get('href', '')
                text = link.get_text(strip=True)

                podcast_id = re.search(r'/podcast/(\d+)', href)
                if not podcast_id:
                    continue

                programs.append({
                    'id': podcast_id.group(1),
                    'title': text,
                    'cover': '',
                    'author': '',
                    'source': 'fm139',
                    'description': '',
                    'episodes': 0,
                    'updateTime': ''
                })
            except Exception as e:
                logger.warning(f"Parse program failed: {e}")
                continue

        return {
            'programs': programs,
            'hasMore': False,
            'total': len(programs)
        }

    def get_program_detail(self, program_id):
        """获取节目详情"""
        self._delay()

        url = f'{self.base_url}/podcast/{program_id}'
        response = self._make_request(url)
        if not response:
            return None

        html = response.text

        # 提取标题
        title_match = re.search(r'<title>(.*?)(?:全集|免费|-139FM)', html)
        title = title_match.group(1) if title_match else ''

        # 提取封面
        cover = ''
        cover_match = re.search(r'"cover_art_url"\s*:\s*"([^"]+)"', html)
        if cover_match:
            cover = cover_match.group(1)

        # 提取主播
        artist = ''
        artist_match = re.search(r'"artist"\s*:\s*"节目：([^"]+)"', html)
        if artist_match:
            artist = artist_match.group(1)

        # 提取简介
        description = ''
        desc_match = re.search(r'"desc"\s*:\s*"简介：([^"]+)"', html)
        if desc_match:
            description = desc_match.group(1)

        # 统计集数
        episodes = 0
        songs_match = re.search(r'var innersongs\s*=\s*(\[.*?\]);', html, re.DOTALL)
        if songs_match:
            try:
                # 清理尾随逗号
                songs_json = re.sub(r',\s*([\]}])', r'\1', songs_match.group(1))
                songs = json.loads(songs_json)
                episodes = len(songs)
            except:
                pass

        return {
            'id': program_id,
            'title': title,
            'cover': cover,
            'author': artist,
            'source': 'fm139',
            'description': description,
            'episodes': episodes,
            'updateTime': ''
        }

    def get_episodes(self, program_id, page=1, limit=50):
        """获取单集列表"""
        self._delay()

        url = f'{self.base_url}/podcast/{program_id}'
        response = self._make_request(url)
        if not response:
            return {'episodes': [], 'hasMore': False, 'total': 0}

        html = response.text
        episodes = []

        # 提取 innersongs 数组
        songs_match = re.search(r'var innersongs\s*=\s*(\[.*?\]);', html, re.DOTALL)
        if not songs_match:
            return {'episodes': [], 'hasMore': False, 'total': 0}

        try:
            # 清理尾随逗号
            songs_json = re.sub(r',\s*([\]}])', r'\1', songs_match.group(1))
            songs = json.loads(songs_json)

            for i, song in enumerate(songs):
                # 提取集数标题
                name = song.get('name', '')
                # 清理标题 (去掉节目名前缀)
                episode_title = name.split('-', 1)[-1].strip() if '-' in name else name

                episodes.append({
                    'id': f'{program_id}_{i + 1}',
                    'title': episode_title,
                    'duration': 0,
                    'publishTime': '',
                    'order': i + 1,
                    'isPlayed': False,
                    'progress': 0
                })

        except Exception as e:
            logger.warning(f"Parse episodes failed: {e}")

        return {
            'episodes': episodes,
            'hasMore': False,
            'total': len(episodes)
        }

    def get_episode_detail(self, episode_id):
        """获取单集详情（含音频URL）"""
        program_id, episode_num = episode_id.rsplit('_', 1)
        episode_num = int(episode_num) - 1  # 转换为0-based索引

        self._delay()
        url = f'{self.base_url}/podcast/{program_id}'
        response = self._make_request(url)
        if not response:
            return None

        html = response.text

        # 提取并解密音频 URL 列表
        audio_urls = self._extract_audio_urls(html)

        # 提取 innersongs
        songs_match = re.search(r'var innersongs\s*=\s*(\[.*?\]);', html, re.DOTALL)
        if not songs_match:
            return None

        try:
            songs_json = re.sub(r',\s*([\]}])', r'\1', songs_match.group(1))
            songs = json.loads(songs_json)

            if episode_num >= len(songs):
                return None

            song = songs[episode_num]
            title = song.get('name', '').split('-', 1)[-1].strip()
            cover = song.get('cover_art_url', '')

            # 获取对应索引的音频 URL
            audio_url = ''
            if episode_num < len(audio_urls):
                audio_url = audio_urls[episode_num].strip()

            return {
                'id': episode_id,
                'title': title,
                'duration': 0,
                'publishTime': '',
                'audioUrl': audio_url,
                'audioUrlBackup': audio_url,  # 备用URL相同
                'cover': cover
            }

        except Exception as e:
            logger.warning(f"Parse episode detail failed: {e}")
            return None

    def search(self, keyword, page=1, limit=20):
        """搜索播客（暂未实现）"""
        raise NotImplementedError("Search not implemented for 139FM")
