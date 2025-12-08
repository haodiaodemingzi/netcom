import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote, unquote
from .base_video_scraper import BaseVideoScraper


class BadNewsAVScraper(BaseVideoScraper):
    """Bad.news 日本AV网站视频爬虫"""
    
    def __init__(self, proxy_config=None):
        super().__init__('https://bad.news', proxy_config)
        self.source_id = 'badnews_av'
        self.source_name = 'Bad.news AV'
        # 更新请求头，模拟真实浏览器
        self.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://bad.news/',
        })
        self.session.headers.update(self.headers)

    def get_categories(self):
        """获取分类列表"""
        categories = [
            {'id': 'all', 'name': '热门'},
            {'id': 'rank-week', 'name': '周榜'},
            {'id': 'rank-month', 'name': '月榜'},
            {'id': 'search/type-tags/q-無碼流出', 'name': '無碼流出'},
            {'id': 'search/q-中文字幕', 'name': '中字'},
        ]
        return categories

    def get_videos_by_category(self, category_id='all', page=1, limit=30):
        """根据分类获取视频列表"""
        videos = []
        
        try:
            # 构建URL
            # 将 hot 映射到 all（默认热门分类）
            if category_id == 'all' or category_id == 'hot' or not category_id:
                if page > 1:
                    url = f'{self.base_url}/av/page-{page}'
                else:
                    url = f'{self.base_url}/av'
            else:
                # 分类页面
                if page > 1:
                    url = f'{self.base_url}/av/{category_id}/page-{page}'
                else:
                    url = f'{self.base_url}/av/{category_id}'
            
            response = self._make_request(url)
            if not response:
                return videos
            
            soup = BeautifulSoup(response.text, 'html.parser')
            videos = self._parse_video_list(soup, limit)
            
        except Exception as e:
            print(f'获取视频列表失败: {e}')
            import traceback
            traceback.print_exc()
        
        return videos

    def _normalize_cover(self, url):
        """将封面地址补全为可访问的绝对地址"""
        if not url:
            return ''
        # 过滤占位或内联图
        if url.startswith('data:') or 'lightbox-blank' in url:
            return ''
        if url.startswith('//'):
            return 'https:' + url
        if url.startswith('/'):
            return self.base_url + url
        return url

    def _extract_img_url(self, img):
        """从img标签尽可能多地提取真实封面"""
        if not img:
            return ''
        candidates = [
            img.get('data-echo', ''),
            img.get('data-src', ''),
            img.get('data-original', ''),
            img.get('data-lazy', ''),
            img.get('data-cfsrc', ''),
            img.get('src', ''),
        ]
        # 处理 srcset 的第一个地址
        srcset = img.get('srcset', '')
        if srcset:
            first = srcset.split(',')[0].strip().split(' ')[0]
            candidates.append(first)
        for url in candidates:
            normalized = self._normalize_cover(url)
            if normalized:
                return normalized
        return ''

    def _parse_video_list(self, soup, limit=30):
        """解析视频列表"""
        videos = []
        seen_ids = set()
        
        # 查找所有包含视频链接的元素
        # AV站点视频ID是番号格式（如 bth-040, sprd-1410）
        video_links = soup.find_all('a', href=re.compile(r'/av/[a-zA-Z0-9][a-zA-Z0-9_-]+'))
        
        for link in video_links:
            if len(videos) >= limit:
                break
            
            try:
                # 只处理包含图片的链接（这些是真正的视频卡片）
                img = link.find('img')
                if not img:
                    continue
                
                href = link.get('href', '')
                
                # 排除非视频页面的链接
                if '/search' in href or '/tags' in href or '/page-' in href or '/rank' in href:
                    continue
                
                # 提取视频ID（番号格式）
                video_id_match = re.search(r'/av/([a-zA-Z0-9][a-zA-Z0-9_-]+)(?:/|$)', href)
                if not video_id_match:
                    continue
                
                video_id = video_id_match.group(1)
                if video_id in seen_ids:
                    continue
                seen_ids.add(video_id)
                
                # 获取标题 - 从img alt属性获取
                title = img.get('alt', '')
                
                # 如果没有标题，从链接的title属性获取
                if not title:
                    title = link.get('title', '')
                
                # 如果还没有标题，跳过
                if not title or title == '浏览点击数':
                    continue
                
                # 获取封面 - 该网站使用懒加载，真实图URL在data-echo属性中
                cover = self._extract_img_url(img)
                
                video = {
                    'id': video_id,
                    'title': title,
                    'cover': cover,
                    'source': self.source_id,
                }
                videos.append(video)
                
            except Exception as e:
                print(f'解析视频项失败: {e}')
                continue
        
        return videos

    def get_video_detail(self, video_id):
        """获取视频详情"""
        try:
            # AV站点使用 /av/ 路径
            url = f'{self.base_url}/av/{video_id}'
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 获取标题
            title = ''
            h1 = soup.find('h1')
            if h1:
                title = h1.get_text(strip=True)
            
            if not title:
                title_tag = soup.find('title')
                if title_tag:
                    title = title_tag.get_text(strip=True)
            
            # 获取演员信息
            actors = []
            actor_links = soup.find_all('a', href=re.compile(r'/av/search/type-actors/q-.+'))
            for actor_link in actor_links:
                actor_text = actor_link.get_text(strip=True)
                if actor_text and actor_text not in actors:
                    actors.append(actor_text)
            
            # 获取标签
            tags = []
            tag_links = soup.find_all('a', href=re.compile(r'/av/search/type-tags/q-.+'))
            for tag_link in tag_links:
                tag_text = tag_link.get_text(strip=True)
                if tag_text and tag_text not in tags:
                    tags.append(tag_text)
            
            # 获取简介
            description = ''
            paragraphs = soup.find_all('p')
            for p in paragraphs:
                text = p.get_text(strip=True)
                if text.startswith('简介：'):
                    description = text.replace('简介：', '').strip()
                    break
                elif len(text) > 50 and '简介' not in text and '标签' not in text:
                    # 可能是简介
                    if not description:
                        description = text
            
            # 获取封面图 - 多渠道兜底
            cover = ''
            # 1) 直接在当前页查找包含该视频链接的图片
            current_video_links = soup.find_all('a', href=re.compile(f'/av/{re.escape(video_id)}(?:/|$)'))
            for link in current_video_links:
                img = link.find('img')
                cover = self._extract_img_url(img)
                if cover:
                    break
            # 2) og:image 元标签
            if not cover:
                og = soup.find('meta', property='og:image')
                if og and og.get('content'):
                    cover = self._normalize_cover(og.get('content'))
            # 3) 其他可能的 link 标签
            if not cover:
                link_tag = soup.find('link', rel=re.compile('image', re.I))
                if link_tag and link_tag.get('href'):
                    cover = self._normalize_cover(link_tag.get('href'))
            # 4) 兜底：寻找页面上首个 img
            if not cover:
                first_img = soup.find('img')
                cover = self._extract_img_url(first_img)
            
            detail = {
                'id': video_id,
                'title': title,
                'cover': cover,
                'actors': actors,
                'tags': tags,
                'description': description,
                'source': self.source_id,
            }
            
            return detail
            
        except Exception as e:
            print(f'获取视频详情失败: {e}')
            import traceback
            traceback.print_exc()
            return None

    def get_episodes(self, video_id):
        """获取剧集列表
        
        AV站点每个视频是单集的，所以返回单个剧集
        """
        episodes = []
        
        try:
            # 获取视频详情
            detail = self.get_video_detail(video_id)
            if not detail:
                return episodes
            
            # 创建单个剧集
            episode = {
                'id': video_id,
                'seriesId': video_id,
                'title': detail.get('title', f'第1集'),
                'episodeNumber': 1,
                'playUrl': f'{self.base_url}/av/{video_id}',
                'source': self.source_id,
            }
            episodes.append(episode)
            
        except Exception as e:
            print(f'获取剧集列表失败: {e}')
        
        return episodes

    def get_episode_detail(self, episode_id):
        """获取单个剧集详情（包含播放链接）"""
        try:
            url = f'{self.base_url}/av/{episode_id}'
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 获取标题
            title = ''
            h1 = soup.find('h1')
            if h1:
                title = h1.get_text(strip=True)
            
            # 查找视频URL - 从video标签的data-source属性获取
            video_url = None
            
            # 1. 首先查找video标签的data-source属性（这是网站主要使用的方式）
            video_tag = soup.find('video')
            if video_tag:
                video_url = video_tag.get('data-source', '') or video_tag.get('src', '')
                if not video_url:
                    source_tag = video_tag.find('source')
                    if source_tag:
                        video_url = source_tag.get('src', '')
            
            # 2. 从HTML中用正则匹配video data-source
            if not video_url:
                match = re.search(r'data-source=["\']([^"\']+(\?[^"\']*)?)["\']', response.text)
                if match:
                    video_url = match.group(1)
                    video_url = video_url.replace('&amp;', '&')
            
            # 3. 尝试从script中查找视频URL
            if not video_url:
                scripts = soup.find_all('script')
                for script in scripts:
                    script_text = script.string or ''
                    if not script_text:
                        continue
                    
                    # 查找各种视频URL模式
                    url_patterns = [
                        r'["\'](https?://static\.bad\.news/[^"\']+)["\']',
                        r'["\'](https?://[^"\']+\.m3u8[^"\']*)["\']',
                        r'["\'](https?://[^"\']+\.mp4[^"\']*)["\']',
                    ]
                    
                    for pattern in url_patterns:
                        match = re.search(pattern, script_text, re.IGNORECASE)
                        if match:
                            video_url = match.group(1)
                            video_url = video_url.replace('\\/', '/')
                            break
                    
                    if video_url:
                        break
            
            # 4. 查找iframe
            if not video_url:
                iframe = soup.find('iframe')
                if iframe:
                    iframe_src = iframe.get('src', '')
                    if iframe_src and 'player' in iframe_src:
                        video_url = iframe_src
            
            episode = {
                'id': episode_id,
                'seriesId': episode_id,
                'title': title or f'第1集',
                'episodeNumber': 1,
                'videoUrl': video_url,
                'playUrl': url,
                'source': self.source_id,
            }
            
            return episode
            
        except Exception as e:
            print(f'获取剧集详情失败: {e}')
            import traceback
            traceback.print_exc()
            return None

    def search_videos(self, keyword, page=1, limit=30):
        """搜索视频"""
        videos = []
        
        try:
            encoded_keyword = quote(keyword)
            
            if page > 1:
                url = f'{self.base_url}/av/search/q-{encoded_keyword}/page-{page}'
            else:
                url = f'{self.base_url}/av/search/q-{encoded_keyword}/via-log'
            
            response = self._make_request(url)
            if not response:
                return videos
            
            soup = BeautifulSoup(response.text, 'html.parser')
            videos = self._parse_video_list(soup, limit)
            
        except Exception as e:
            print(f'搜索视频失败: {e}')
            import traceback
            traceback.print_exc()
        
        return videos

    def get_tags(self, limit=100):
        """获取标签列表"""
        tags = []
        
        try:
            url = f'{self.base_url}/av/tags'
            response = self._make_request(url)
            if not response:
                return tags
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找所有标签链接
            tag_links = soup.find_all('a', href=re.compile(r'/av/search/(type-tags/)?q-.+'))
            
            seen_tags = set()
            for link in tag_links:
                if len(tags) >= limit:
                    break
                
                tag_text = link.get_text(strip=True)
                # 移除标签后面的数字
                tag_name = re.sub(r'\s*\d+$', '', tag_text).strip()
                
                if tag_name and tag_name not in seen_tags:
                    seen_tags.add(tag_name)
                    
                    # 从 href 中提取标签 ID
                    href = link.get('href', '')
                    tag_match = re.search(r'/av/search/(type-tags/)?q-(.+?)(/|$)', href)
                    if tag_match:
                        tag_id = unquote(tag_match.group(2))
                        tags.append({
                            'id': tag_id,
                            'name': tag_name
                        })
            
        except Exception as e:
            print(f'获取标签列表失败: {e}')
            import traceback
            traceback.print_exc()
        
        return tags

    def get_videos_by_tag(self, tag_id, page=1, limit=30):
        """根据标签获取视频列表"""
        videos = []
        
        try:
            encoded_tag = quote(tag_id)
            
            if page > 1:
                url = f'{self.base_url}/av/search/type-tags/q-{encoded_tag}/page-{page}'
            else:
                url = f'{self.base_url}/av/search/type-tags/q-{encoded_tag}'
            
            response = self._make_request(url)
            if not response:
                return videos
            
            soup = BeautifulSoup(response.text, 'html.parser')
            videos = self._parse_video_list(soup, limit)
            
        except Exception as e:
            print(f'根据标签获取视频失败: {e}')
            import traceback
            traceback.print_exc()
        
        return videos
