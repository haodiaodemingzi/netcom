import re
from bs4 import BeautifulSoup
from .base_video_scraper import BaseVideoScraper

class ThanjuScraper(BaseVideoScraper):
    """热播韩剧网(thanju.com)视频爬虫"""
    
    def __init__(self, proxy_config=None):
        super().__init__('https://www.thanju.com', proxy_config)
        self.source_id = 'thanju'
        self.source_name = '热播韩剧网'

    def get_categories(self):
        """获取分类列表"""
        categories = []
        
        try:
            # 从列表页面获取分类
            url = f'{self.base_url}/list-select-id-1-order-addtime.html'
            response = self._make_request(url)
            if response:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # 添加默认分类
                categories.append({'id': 'hot', 'name': '热门'})
                categories.append({'id': 'latest', 'name': '最新'})
                
                # 解析年份分类
                year_links = soup.find_all('a', href=re.compile(r'/list-select-id-1-type--area--year-\d+'))
                seen_years = set()
                for link in year_links:
                    href = link.get('href', '')
                    year_match = re.search(r'year-(\d{4})', href)
                    if year_match:
                        year = year_match.group(1)
                        if year not in seen_years:
                            seen_years.add(year)
                            categories.append({'id': year, 'name': f'{year}年'})
        except Exception as e:
            print(f'获取分类失败: {e}')
        
        # 如果解析失败，返回默认分类
        if not categories:
            categories = [
                {'id': 'hot', 'name': '热门'},
                {'id': 'latest', 'name': '最新'},
            ]
        
        return categories

    def get_videos_by_category(self, category_id='hot', page=1, limit=20):
        """根据分类获取视频列表"""
        videos = []
        
        try:
            # 构建URL
            if category_id == 'hot':
                base_url_path = '/list-select-id-1-order-hits'
            elif category_id == 'latest':
                base_url_path = '/list-select-id-1-order-addtime'
            elif category_id.isdigit() and len(category_id) == 4:
                # 年份分类
                base_url_path = f'/list-select-id-1-type--area--year-{category_id}-star--state--order-addtime'
            else:
                base_url_path = '/list-select-id-1-order-addtime'
            
            # 添加分页
            if page > 1:
                url = f'{self.base_url}{base_url_path}-p-{page}.html'
            else:
                url = f'{self.base_url}{base_url_path}.html'
            
            response = self._make_request(url)
            if not response:
                return videos
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找视频列表容器 - 根据实际HTML结构
            # 视频项通常在ul或div容器中
            video_containers = soup.find_all(['ul', 'div'], class_=re.compile(r'list|vod|video'))
            if not video_containers:
                # 尝试查找所有包含detail链接的容器
                video_containers = [soup]
            
            seen_ids = set()
            
            # 优先查找新的HTML结构：class="myui-vodlist__box" 的div
            video_boxes = soup.find_all('div', class_=re.compile(r'myui-vodlist__box'))
            if video_boxes:
                for box in video_boxes:
                    if len(videos) >= limit:
                        break
                    
                    # 查找detail链接
                    detail_link = box.find('a', href=re.compile(r'/detail/\d+\.html'))
                    if not detail_link:
                        continue
                    
                    href = detail_link.get('href', '')
                    video_id_match = re.search(r'/detail/(\d+)\.html', href)
                    if not video_id_match:
                        continue
                    
                    video_id = video_id_match.group(1)
                    if video_id in seen_ids:
                        continue
                    seen_ids.add(video_id)
                    
                    video = self._parse_video_item_new(box, video_id)
                    if video:
                        videos.append(video)
            else:
                # 备用方案：查找所有包含/detail/链接的元素
                for container in video_containers:
                    detail_links = container.find_all('a', href=re.compile(r'/detail/\d+\.html'))
                    
                    for link in detail_links:
                        href = link.get('href', '')
                        video_id_match = re.search(r'/detail/(\d+)\.html', href)
                        if not video_id_match:
                            continue
                        
                        video_id = video_id_match.group(1)
                        if video_id in seen_ids:
                            continue
                        seen_ids.add(video_id)
                        
                        # 向上查找父容器（通常是li或div）
                        parent = link.find_parent(['li', 'div'])
                        if not parent:
                            # 继续向上查找
                            parent = link.find_parent(['article', 'section'])
                        if not parent:
                            parent = link.parent
                        
                        if parent:
                            video = self._parse_video_item_from_link(link, parent, video_id)
                            if video:
                                videos.append(video)
                                if len(videos) >= limit:
                                    break
                    
                    if len(videos) >= limit:
                        break
            
        except Exception as e:
            print(f'获取视频列表失败: {e}')
            import traceback
            traceback.print_exc()
        
        return videos

    def _parse_video_item_new(self, box, video_id):
        """从新的HTML结构解析单个视频项（myui-vodlist__box）"""
        try:
            # 标题 - 从 h4.title > a 中获取
            title = None
            title_elem = box.find('h4', class_='title')
            if title_elem:
                title_link = title_elem.find('a')
                if title_link:
                    title = title_link.get_text(strip=True) or title_link.get('title', '')
            
            if not title:
                return None
            
            # 封面 - 从 a.myui-vodlist__thumb 的 style 属性中获取
            cover = ''
            thumb_link = box.find('a', class_='myui-vodlist__thumb')
            if thumb_link:
                style = thumb_link.get('style', '')
                # 提取 background: url(...) 中的URL
                url_match = re.search(r'background:\s*url\(([^)]+)\)', style)
                if url_match:
                    cover = url_match.group(1).strip('\'"')
                    # 处理协议相对路径
                    if cover.startswith('//'):
                        cover = 'https:' + cover
                    elif cover.startswith('/'):
                        cover = self.base_url + cover
                    elif not cover.startswith('http'):
                        cover = 'https://' + cover.lstrip('/')
            
            # 评分 - 从 span.pic-tag 中获取
            rating = None
            pic_tag = box.find('span', class_='pic-tag')
            if pic_tag:
                rating_text = pic_tag.get_text(strip=True)
                rating_match = re.search(r'豆瓣\s*([\d.]+)\s*分', rating_text)
                if rating_match:
                    try:
                        rating = float(rating_match.group(1))
                    except:
                        pass
            
            # 集数/状态 - 从 span.pic-text 中获取
            episodes = None
            status = '连载中'
            pic_text = box.find('span', class_='pic-text')
            if pic_text:
                episode_text = pic_text.get_text(strip=True)
                if '集全' in episode_text:
                    episodes_match = re.search(r'(\d+)集全', episode_text)
                    if episodes_match:
                        try:
                            episodes = int(episodes_match.group(1))
                            status = '完结'
                        except:
                            pass
                elif re.search(r'第\d+集', episode_text):
                    # 提取当前集数
                    episode_match = re.search(r'第(\d+)集', episode_text)
                    if episode_match:
                        try:
                            episodes = int(episode_match.group(1))
                        except:
                            pass
                    status = '连载中'
            
            # 演员 - 从 p.text > a 中获取
            actors = []
            text_elem = box.find('p', class_='text')
            if text_elem:
                actor_links = text_elem.find_all('a', href=re.compile(r'/search/'))
                for actor_link in actor_links[:4]:  # 最多取4个
                    actor_name = actor_link.get_text(strip=True)
                    if actor_name and actor_name not in actors:
                        actors.append(actor_name)
            
            video = {
                'id': video_id,
                'title': title,
                'cover': cover or f'https://via.placeholder.com/200x300?text={title}',
                'rating': rating,
                'episodes': episodes,
                'status': status,
                'actors': actors,
                'source': self.source_id,
            }
            
            return video
            
        except Exception as e:
            print(f'解析视频项错误: {e}')
            import traceback
            traceback.print_exc()
            return None
    
    def _parse_video_item_from_link(self, link, parent, video_id):
        """从链接和父容器解析视频项"""
        try:
            # 标题 - 优先从h4标题中获取
            title = None
            heading = parent.find(['h4', 'h3', 'h2'])
            if heading:
                title_link = heading.find('a', href=re.compile(r'/detail/\d+\.html'))
                if title_link:
                    title = title_link.get_text(strip=True)
                else:
                    title = heading.get_text(strip=True)
            
            # 如果还没有标题，从链接文本获取（但可能包含评分信息）
            if not title:
                link_text = link.get_text(strip=True)
                # 如果链接文本包含"豆瓣"或"集"，说明这是评分/集数链接，不是标题
                if '豆瓣' not in link_text and '集' not in link_text:
                    title = link_text
                else:
                    # 查找其他包含detail链接的元素
                    other_links = parent.find_all('a', href=re.compile(r'/detail/\d+\.html'))
                    for other_link in other_links:
                        other_text = other_link.get_text(strip=True)
                        if '豆瓣' not in other_text and '集' not in other_text and len(other_text) > 2:
                            title = other_text
                            break
            
            if not title:
                return None
            
            # 查找封面 - 优先从 style 属性中获取（新HTML结构）
            cover = ''
            thumb_link = parent.find('a', class_=re.compile(r'thumb|vodlist__thumb'))
            if thumb_link:
                style = thumb_link.get('style', '')
                # 提取 background: url(...) 中的URL
                url_match = re.search(r'background:\s*url\(([^)]+)\)', style)
                if url_match:
                    cover = url_match.group(1).strip('\'"')
                    # 处理协议相对路径
                    if cover.startswith('//'):
                        cover = 'https:' + cover
                    elif cover.startswith('/'):
                        cover = self.base_url + cover
                    elif not cover.startswith('http'):
                        cover = 'https://' + cover.lstrip('/')
            
            # 如果没有从style获取到，尝试从img标签获取
            if not cover:
                img_elem = parent.find('img')
                if not img_elem:
                    # 尝试查找包含图片的div
                    img_container = parent.find('div', class_=re.compile(r'pic|img|cover|poster'))
                    if img_container:
                        img_elem = img_container.find('img')
                
                if img_elem:
                    cover = img_elem.get('src', '') or img_elem.get('data-src', '') or img_elem.get('data-original', '')
                    if cover:
                        # 处理相对路径
                        if cover.startswith('//'):
                            cover = 'https:' + cover
                        elif cover.startswith('/'):
                            cover = self.base_url + cover
                        elif not cover.startswith('http'):
                            cover = self.base_url + '/' + cover
            
            # 查找评分
            rating = None
            rating_text = parent.get_text()
            rating_match = re.search(r'豆瓣([\d.]+)分', rating_text)
            if rating_match:
                try:
                    rating = float(rating_match.group(1))
                except:
                    pass
            
            # 查找集数/状态
            episodes = None
            status = '连载中'
            status_text = parent.get_text()
            if '集全' in status_text:
                episodes_match = re.search(r'(\d+)集全', status_text)
                if episodes_match:
                    try:
                        episodes = int(episodes_match.group(1))
                        status = '完结'
                    except:
                        pass
            elif re.search(r'第\d+集', status_text):
                status = '连载中'
            
            # 查找演员
            actors = []
            actor_links = parent.find_all('a', href=re.compile(r'/search/'))
            for actor_link in actor_links[:4]:  # 最多取4个
                actor_name = actor_link.get_text(strip=True)
                if actor_name and actor_name not in actors:
                    actors.append(actor_name)
            
            video = {
                'id': video_id,
                'title': title,
                'cover': cover or f'https://via.placeholder.com/200x300?text={title}',
                'rating': rating,
                'episodes': episodes,
                'status': status,
                'actors': actors,
                'source': self.source_id,
            }
            
            return video
            
        except Exception as e:
            print(f'解析视频项错误: {e}')
            return None

    def get_video_detail(self, video_id):
        """获取视频详情"""
        try:
            url = f'{self.base_url}/detail/{video_id}.html'
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 标题
            title_elem = soup.find('h1')
            title = title_elem.get_text(strip=True) if title_elem else ''
            
            # 封面 - 尝试多种方式查找
            cover = ''
            # 1. 查找包含alt属性的图片（匹配标题）
            img_elem = soup.find('img', alt=title)
            if not img_elem and title:
                # 尝试部分匹配
                img_elem = soup.find('img', alt=re.compile(re.escape(title[:5]) if len(title) > 5 else title))
            
            # 2. 查找封面容器
            if not img_elem:
                cover_container = soup.find('div', class_=re.compile(r'cover|poster|pic|img'))
                if cover_container:
                    img_elem = cover_container.find('img')
            
            # 3. 查找所有图片，选择包含 /U/vod/ 的图片（这是封面图片的特征）
            if not img_elem:
                all_imgs = soup.find_all('img')
                for img in all_imgs:
                    src = img.get('src', '') or img.get('data-src', '') or img.get('data-original', '')
                    if src and '/U/vod/' in src:
                        img_elem = img
                        break
            
            if img_elem:
                cover = img_elem.get('src', '') or img_elem.get('data-src', '') or img_elem.get('data-original', '')
                if cover:
                    # 处理相对路径
                    if cover.startswith('//'):
                        cover = 'https:' + cover
                    elif cover.startswith('/'):
                        cover = self.base_url + cover
                    elif not cover.startswith('http'):
                        cover = 'https://' + cover.lstrip('/')
            
            # 评分
            rating = None
            rating_text = soup.get_text()
            rating_match = re.search(r'评分[：:]\s*([\d.]+)', rating_text)
            if rating_match:
                rating = float(rating_match.group(1))
            
            # 年份
            year = None
            year_match = re.search(r'年份[：:]\s*(\d{4})', rating_text)
            if year_match:
                year = int(year_match.group(1))
            
            # 导演
            director = ''
            director_elem = soup.find(string=re.compile(r'导演'))
            if director_elem:
                director_link = director_elem.find_next('a')
                if director_link:
                    director = director_link.get_text(strip=True)
            
            # 主演
            actors = []
            actors_elem = soup.find(string=re.compile(r'主演'))
            if actors_elem:
                parent = actors_elem.find_parent()
                if parent:
                    actor_links = parent.find_all('a', href=re.compile(r'/search/'))
                    for link in actor_links:
                        actor = link.get_text(strip=True)
                        if actor:
                            actors.append(actor)
            
            # 更新状态
            status = '连载中'
            episodes = None
            status_text = soup.get_text()
            if '集全' in status_text:
                episodes_match = re.search(r'(\d+)集全', status_text)
                if episodes_match:
                    episodes = int(episodes_match.group(1))
                    status = '完结'
            
            # 标签
            tags = []
            tags_elem = soup.find(string=re.compile(r'标签'))
            if tags_elem:
                parent = tags_elem.find_parent()
                if parent:
                    tag_text = parent.get_text()
                    tag_match = re.search(r'标签[：:]\s*(.+)', tag_text)
                    if tag_match:
                        tags = [t.strip() for t in tag_match.group(1).split() if t.strip()]
            
            # 简介
            description = ''
            desc_elem = soup.find(string=re.compile(r'简介|剧情'))
            if desc_elem:
                parent = desc_elem.find_parent()
                if parent:
                    desc_text = parent.get_text()
                    desc_match = re.search(r'(?:简介|剧情)[：:]\s*(.+)', desc_text, re.DOTALL)
                    if desc_match:
                        description = desc_match.group(1).strip()
            
            detail = {
                'id': video_id,
                'title': title,
                'cover': cover,
                'rating': rating,
                'year': year,
                'director': director,
                'actors': actors,
                'episodes': episodes,
                'status': status,
                'tags': tags,
                'description': description,
                'source': self.source_id,
            }
            
            return detail
            
        except Exception as e:
            print(f'获取视频详情失败: {e}')
            return None

    def get_episodes(self, video_id):
        """获取剧集列表"""
        episodes = []
        
        try:
            url = f'{self.base_url}/detail/{video_id}.html'
            response = self._make_request(url)
            if not response:
                return episodes
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 直接查找所有包含/play/的链接（格式：/play/2429/1-1.html）
            episode_links = soup.find_all('a', href=re.compile(r'/play/\d+/\d+-\d+\.html'))
            seen_episodes = {}  # 使用字典，key为episode_num，只保留第一个播放源（playlist_id=1）
            
            if episode_links:
                for link in episode_links:
                    episode_url = link.get('href', '')
                    episode_text = link.get_text(strip=True)
                    
                    # 提取剧集信息
                    episode_match = re.search(r'/play/(\d+)/(\d+)-(\d+)\.html', episode_url)
                    if episode_match:
                        series_id = episode_match.group(1)
                        playlist_id = episode_match.group(2)
                        episode_num = episode_match.group(3)
                        
                        # 只保留第一个播放源的剧集（playlist_id=1），避免重复
                        if playlist_id != '1' or episode_num in seen_episodes:
                            continue
                        
                        # 确定剧集标题
                        if episode_text and episode_text.isdigit():
                            episode_title = f'第{episode_text}集'
                        elif episode_text:
                            episode_title = episode_text
                        else:
                            episode_title = f'第{episode_num}集'
                        
                        episode = {
                            'id': f'{series_id}_{playlist_id}_{episode_num}',
                            'seriesId': series_id,
                            'title': episode_title,
                            'episodeNumber': int(episode_num),
                            'playUrl': self.base_url + episode_url if not episode_url.startswith('http') else episode_url,
                            'source': self.source_id,
                        }
                        seen_episodes[episode_num] = episode
                
                # 转换为列表并按集数排序
                episodes = list(seen_episodes.values())
                episodes.sort(key=lambda x: x['episodeNumber'])
            
        except Exception as e:
            print(f'获取剧集列表失败: {e}')
            import traceback
            traceback.print_exc()
        
        return episodes

    def get_episode_detail(self, episode_id):
        """获取单个剧集详情（包含播放链接）"""
        try:
            # episode_id格式: seriesId_playlistId_episodeNum
            parts = episode_id.split('_')
            if len(parts) != 3:
                return None
            
            series_id, playlist_id, episode_num = parts
            url = f'{self.base_url}/play/{series_id}/{playlist_id}-{episode_num}.html'
            
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找视频播放链接
            video_url = None
            
            # 尝试多种方式查找视频链接
            # 1. iframe中的src - 可能是播放器iframe
            iframe = soup.find('iframe')
            if iframe:
                iframe_src = iframe.get('src', '')
                if iframe_src:
                    # 如果是iframe，可能需要进一步解析iframe内容
                    # 但通常iframe指向的是播放器页面，不是直接视频链接
                    # 先尝试从iframe URL中提取
                    if 'play' in iframe_src or 'player' in iframe_src:
                        # 可能需要请求iframe页面获取真实视频链接
                        # 这里先记录iframe URL
                        video_url = iframe_src
                    else:
                        video_url = iframe_src
            
            # 2. video标签
            if not video_url:
                video_tag = soup.find('video')
                if video_tag:
                    video_url = video_tag.get('src', '') or video_tag.get('data-src', '') or video_tag.get('data-url', '')
                    # 查找source标签
                    if not video_url:
                        source_tag = video_tag.find('source')
                        if source_tag:
                            video_url = source_tag.get('src', '')
            
            # 3. script中的视频链接 - 更详细的模式
            if not video_url:
                scripts = soup.find_all('script')
                for script in scripts:
                    script_text = script.string or ''
                    if not script_text:
                        continue
                    # 查找常见的视频链接模式
                    url_patterns = [
                        r'["\'](https?://[^"\']+\.mp4[^"\']*)["\']',
                        r'["\'](https?://[^"\']+\.m3u8[^"\']*)["\']',
                        r'url["\']?\s*[:=]\s*["\'](https?://[^"\']+)["\']',
                        r'video["\']?\s*[:=]\s*["\'](https?://[^"\']+)["\']',
                        r'src["\']?\s*[:=]\s*["\'](https?://[^"\']+\.(?:mp4|m3u8)[^"\']*)["\']',
                        r'playurl["\']?\s*[:=]\s*["\'](https?://[^"\']+)["\']',
                        r'play_url["\']?\s*[:=]\s*["\'](https?://[^"\']+)["\']',
                    ]
                    for pattern in url_patterns:
                        match = re.search(pattern, script_text, re.IGNORECASE)
                        if match:
                            video_url = match.group(1)
                            break
                    if video_url:
                        break
            
            # 4. 如果还是没有找到，尝试从页面中查找所有可能的视频链接
            if not video_url:
                # 查找所有包含视频扩展名的链接
                all_links = soup.find_all('a', href=re.compile(r'\.(mp4|m3u8)', re.IGNORECASE))
                if all_links:
                    video_url = all_links[0].get('href', '')
                    if video_url and not video_url.startswith('http'):
                        video_url = self.base_url + video_url
            
            # 获取剧集标题（从URL或页面中提取）
            episode_title = f'第{episode_num}集'
            title_elem = soup.find('h1') or soup.find('title')
            if title_elem:
                title_text = title_elem.get_text(strip=True)
                # 尝试从标题中提取集数信息
                title_match = re.search(r'第?(\d+)集', title_text)
                if title_match:
                    episode_title = f'第{title_match.group(1)}集'
                elif episode_num:
                    episode_title = f'第{episode_num}集'
            
            episode = {
                'id': episode_id,
                'seriesId': series_id,
                'title': episode_title,
                'episodeNumber': int(episode_num) if episode_num else None,
                'videoUrl': video_url,
                'playUrl': url,  # 原始播放页面URL
                'source': self.source_id,
            }
            
            return episode
            
        except Exception as e:
            print(f'获取剧集详情失败: {e}')
            return None

    def search_videos(self, keyword, page=1, limit=20):
        """搜索视频"""
        videos = []
        
        try:
            from urllib.parse import quote
            encoded_keyword = quote(keyword)
            url = f'{self.base_url}/search/{encoded_keyword}.html'
            
            response = self._make_request(url)
            if not response:
                return videos
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找搜索结果
            video_items = soup.find_all('div', class_=re.compile(r'item|card|video'))
            if not video_items:
                video_items = soup.select('ul li, .list-item, .video-item')
            
            for item in video_items[:limit]:
                try:
                    # 查找链接
                    link = item.find('a', href=re.compile(r'/detail/\d+\.html'))
                    if link:
                        href = link.get('href', '')
                        video_id_match = re.search(r'/detail/(\d+)\.html', href)
                        if video_id_match:
                            video_id = video_id_match.group(1)
                            parent = item
                            video = self._parse_video_item_from_link(link, parent, video_id)
                            if video:
                                videos.append(video)
                except Exception as e:
                    print(f'解析搜索结果失败: {e}')
                    continue
            
        except Exception as e:
            print(f'搜索视频失败: {e}')
        
        return videos

