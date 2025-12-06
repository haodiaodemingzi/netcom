import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote, unquote
from .base_video_scraper import BaseVideoScraper


class BadNewsScraper(BaseVideoScraper):
    """Bad.news H动漫网站视频爬虫"""
    
    def __init__(self, proxy_config=None):
        super().__init__('https://bad.news', proxy_config)
        self.source_id = 'badnews'
        self.source_name = 'Bad.news H动漫'
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
            {'id': 'all', 'name': '全部'},
            {'id': '3D', 'name': '3D动画'},
            {'id': '同人', 'name': '同人作品'},
            {'id': 'Cosplay', 'name': 'Cosplay'},
        ]
        return categories

    def get_videos_by_category(self, category_id='all', page=1, limit=30):
        """根据分类获取视频列表"""
        videos = []
        
        try:
            # 构建URL
            if category_id == 'all' or not category_id:
                if page > 1:
                    url = f'{self.base_url}/dm/page-{page}'
                else:
                    url = f'{self.base_url}/dm'
            else:
                # 分类页面
                encoded_cat = quote(category_id)
                if page > 1:
                    url = f'{self.base_url}/dm/type/q-{encoded_cat}/page-{page}'
                else:
                    url = f'{self.base_url}/dm/type/q-{encoded_cat}'
            
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

    def _parse_video_list(self, soup, limit=30):
        """解析视频列表"""
        videos = []
        seen_ids = set()
        
        # 查找所有article元素（视频卡片）
        articles = soup.find_all('article')
        
        for article in articles:
            if len(videos) >= limit:
                break
            
            try:
                # 查找链接
                link = article.find('a', href=re.compile(r'/dm/play/id-\d+'))
                if not link:
                    continue
                
                href = link.get('href', '')
                video_id_match = re.search(r'/dm/play/id-(\d+)', href)
                if not video_id_match:
                    continue
                
                video_id = video_id_match.group(1)
                if video_id in seen_ids:
                    continue
                seen_ids.add(video_id)
                
                # 获取标题
                title = ''
                # 从h4标题获取
                h4 = article.find('h4')
                if h4:
                    title_link = h4.find('a')
                    if title_link:
                        title = title_link.get_text(strip=True)
                    else:
                        title = h4.get_text(strip=True)
                
                # 如果还没有标题，从链接title属性获取
                if not title:
                    title = link.get('title', '')
                
                # 从img的alt获取
                if not title:
                    img = link.find('img')
                    if img:
                        title = img.get('alt', '')
                
                if not title:
                    continue
                
                # 获取封面 - 该网站使用懒加载，真实图URL在data-echo属性中
                cover = ''
                img = article.find('img')
                if img:
                    # 优先从data-echo获取（懒加载真实URL）
                    cover = img.get('data-echo', '') or img.get('data-src', '') or img.get('data-original', '') or img.get('src', '')
                    # 过滤掉占位图
                    if cover and 'lightbox-blank' in cover:
                        cover = ''
                    if cover and not cover.startswith('http'):
                        if cover.startswith('//'):
                            cover = 'https:' + cover
                        elif cover.startswith('/'):
                            cover = self.base_url + cover
                
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
            url = f'{self.base_url}/dm/play/id-{video_id}'
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
            
            # 获取标签
            tags = []
            # 查找标签段落
            tag_links = soup.find_all('a', href=re.compile(r'/dm/search/q-.+/type-tag'))
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
            
            # 获取封面 - 从相关推荐中获取
            cover = ''
            # 尝试从相关推荐中找到当前视频的封面
            current_video_links = soup.find_all('a', href=re.compile(f'/dm/play/id-{video_id}'))
            for link in current_video_links:
                img = link.find('img')
                if img:
                    # 优先从data-echo获取（懒加载真实URL）
                    cover = img.get('data-echo', '') or img.get('data-src', '') or img.get('src', '')
                    # 过滤掉占位图
                    if cover and 'lightbox-blank' in cover:
                        cover = ''
                    if cover:
                        break
            
            detail = {
                'id': video_id,
                'title': title,
                'cover': cover,
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
        
        这个网站每个视频是单集的，所以返回单个剧集
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
                'playUrl': f'{self.base_url}/dm/play/id-{video_id}',
                'source': self.source_id,
            }
            episodes.append(episode)
            
        except Exception as e:
            print(f'获取剧集列表失败: {e}')
        
        return episodes

    def get_episode_detail(self, episode_id):
        """获取单个剧集详情（包含播放链接）"""
        try:
            url = f'{self.base_url}/dm/play/id-{episode_id}'
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 获取标题
            title = ''
            h1 = soup.find('h1')
            if h1:
                title = h1.get_text(strip=True)
            
            # 查找视频URL
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
                url = f'{self.base_url}/dm/search/q-{encoded_keyword}/page-{page}'
            else:
                url = f'{self.base_url}/dm/search/q-{encoded_keyword}/via-log'
            
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
            url = f'{self.base_url}/dm/tags'
            response = self._make_request(url)
            if not response:
                return tags
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找所有标签链接
            tag_links = soup.find_all('a', href=re.compile(r'/dm/search/q-.+/type-tag'))
            
            seen_tags = set()
            for link in tag_links:
                if len(tags) >= limit:
                    break
                
                tag_text = link.get_text(strip=True)
                # 移除标签后面的数字
                tag_name = re.sub(r'\s*\d+$', '', tag_text).strip()
                
                if tag_name and tag_name not in seen_tags:
                    seen_tags.add(tag_name)
                    
                    # 从href中提取标签ID
                    href = link.get('href', '')
                    tag_match = re.search(r'/dm/search/q-(.+)/type-tag', href)
                    if tag_match:
                        tag_id = unquote(tag_match.group(1))
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
                url = f'{self.base_url}/dm/search/q-{encoded_tag}/type-tag/page-{page}'
            else:
                url = f'{self.base_url}/dm/search/q-{encoded_tag}/type-tag'
            
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
