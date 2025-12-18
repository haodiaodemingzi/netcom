import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote, urljoin
from .base_video_scraper import BaseVideoScraper


class MjwuScraper(BaseVideoScraper):
    """美剧屋(mjwu.cc)视频爬虫"""
    
    def __init__(self, proxy_config=None):
        super().__init__('https://www.mjwu.cc', proxy_config)
        self.source_id = 'mjwu'
        self.source_name = '美剧屋'
        # 更新请求头，模拟真实浏览器
        self.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://www.mjwu.cc/',
        })
        self.session.headers.update(self.headers)

    def get_categories(self):
        """获取分类列表 - 从网站动态爬取"""
        categories = []
        
        try:
            # 请求美剧分类页面获取所有分类
            url = f'{self.base_url}/type/meiju/'
            response = self._make_request(url)
            if not response:
                return self._get_default_categories()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 1. 添加排序入口（最新、最热、评分）
            categories.append({'id': 'by_time', 'name': '🔥 最新', 'type': 'sort', 'url': '/show/meiju/by/time/'})
            categories.append({'id': 'by_hits', 'name': '📊 最热', 'type': 'sort', 'url': '/show/meiju/by/hits/'})
            categories.append({'id': 'by_score', 'name': '⭐ 高分', 'type': 'sort', 'url': '/show/meiju/by/score/'})
            
            # 2. 获取类型分类（剧情、喜剧、动作等）
            filter_wraps = soup.find_all('div', class_='hl-filter-wrap')
            
            for wrap in filter_wraps:
                filter_text = wrap.find('div', class_='hl-filter-text')
                if not filter_text:
                    continue
                
                label = filter_text.get_text(strip=True)
                filter_items = wrap.find_all('li', class_='hl-filter-item')
                
                for item in filter_items:
                    link = item.find('a')
                    if not link:
                        continue
                    
                    href = link.get('href', '')
                    name = link.get_text(strip=True)
                    
                    if not name or name == '全部' or not href:
                        continue
                    
                    # 解析URL类型
                    if '/class/' in href:
                        cat_type = 'genre'
                        cat_id = f"class_{name}"
                    elif '/area/' in href:
                        cat_type = 'area'
                        cat_id = f"area_{name}"
                    elif '/year/' in href:
                        cat_type = 'year'
                        cat_id = f"year_{name}"
                    else:
                        continue
                    
                    categories.append({
                        'id': cat_id,
                        'name': name,
                        'type': cat_type,
                        'url': href
                    })
            
            # 去重
            seen = set()
            unique_categories = []
            for cat in categories:
                if cat['id'] not in seen:
                    seen.add(cat['id'])
                    unique_categories.append(cat)
            
            return unique_categories if unique_categories else self._get_default_categories()
            
        except Exception as e:
            print(f'获取分类失败: {e}')
            import traceback
            traceback.print_exc()
            return self._get_default_categories()
    
    def _get_default_categories(self):
        """默认分类列表"""
        return [
            {'id': 'by_time', 'name': '🔥 最新', 'type': 'sort', 'url': '/show/meiju/by/time/'},
            {'id': 'by_hits', 'name': '📊 最热', 'type': 'sort', 'url': '/show/meiju/by/hits/'},
            {'id': 'by_score', 'name': '⭐ 高分', 'type': 'sort', 'url': '/show/meiju/by/score/'},
            {'id': 'meiju', 'name': '美剧', 'type': 'main'},
            {'id': 'dianying', 'name': '电影', 'type': 'main'},
        ]

    def get_videos_by_category(self, category_id='meiju', page=1, limit=30):
        """根据分类获取视频列表"""
        videos = []
        
        try:
            # 根据分类ID构建URL
            url = self._build_category_url(category_id, page)
            
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
    
    def _build_category_url(self, category_id, page=1):
        """根据分类ID构建URL"""
        # 排序分类：by_time, by_hits, by_score
        if category_id.startswith('by_'):
            sort_type = category_id.replace('by_', '')
            if page > 1:
                return f'{self.base_url}/show/meiju/by/{sort_type}/page/{page}.html'
            return f'{self.base_url}/show/meiju/by/{sort_type}/'
        
        # 类型分类：class_剧情
        if category_id.startswith('class_'):
            class_name = category_id.replace('class_', '')
            if page > 1:
                return f'{self.base_url}/show/meiju/class/{quote(class_name)}/page/{page}.html'
            return f'{self.base_url}/show/meiju/class/{quote(class_name)}/'
        
        # 地区分类：area_美国
        if category_id.startswith('area_'):
            area_name = category_id.replace('area_', '')
            if page > 1:
                return f'{self.base_url}/show/meiju/area/{quote(area_name)}/page/{page}.html'
            return f'{self.base_url}/show/meiju/area/{quote(area_name)}/'
        
        # 年份分类：year_2025
        if category_id.startswith('year_'):
            year = category_id.replace('year_', '')
            if page > 1:
                return f'{self.base_url}/show/meiju/year/{year}/page/{page}.html'
            return f'{self.base_url}/show/meiju/year/{year}/'
        
        # 默认主分类：meiju, dianying
        if page > 1:
            return f'{self.base_url}/type/{category_id}/page/{page}.html'
        return f'{self.base_url}/type/{category_id}/'

    def _normalize_cover(self, url):
        """将封面地址补全为可访问的绝对地址"""
        if not url:
            return ''
        # 过滤占位或内联图
        if url.startswith('data:') or 'lightbox-blank' in url or 'placeholder' in url:
            return ''
        if url.startswith('//'):
            return 'https:' + url
        if url.startswith('/'):
            return self.base_url + url
        if not url.startswith('http'):
            return self.base_url + '/' + url
        return url

    def _extract_img_url(self, img):
        """从img标签尽可能多地提取真实封面"""
        if not img:
            return ''
        # 美剧屋使用懒加载，图片URL在data-original属性中
        candidates = [
            img.get('data-original', ''),  # 美剧屋主要使用这个
            img.get('data-src', ''),
            img.get('data-echo', ''),
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
        
        # 查找所有视频项 - 美剧屋使用 hl-list-item 或 hl-vod-item 类
        video_items = soup.find_all('li', class_=re.compile(r'hl-(list|vod)-item'))
        
        for item in video_items:
            if len(videos) >= limit:
                break
            
            try:
                # 查找视频链接
                link = item.find('a', class_='hl-item-thumb')
                if not link:
                    link = item.find('a', href=re.compile(r'/vod/\d+/'))
                
                if not link:
                    continue
                
                href = link.get('href', '')
                
                # 提取视频ID - 从URL中提取
                video_id_match = re.search(r'/vod/(\d+)/', href)
                if not video_id_match:
                    continue
                
                video_id = video_id_match.group(1)
                if video_id in seen_ids:
                    continue
                seen_ids.add(video_id)
                
                # 获取标题 - 从链接的title属性或文本中获取
                title = link.get('title', '')
                if not title:
                    title_elem = item.find('div', class_='hl-item-title')
                    if title_elem:
                        title_link = title_elem.find('a')
                        if title_link:
                            title = title_link.get('title', '') or title_link.get_text(strip=True)
                
                if not title:
                    continue
                
                # 获取封面 - 美剧屋的封面URL在<a>标签的data-original属性中，不是在<img>中
                cover = ''
                # 首先从a标签的data-original获取
                cover = link.get('data-original', '')
                if cover:
                    cover = self._normalize_cover(cover)
                
                # 如果没有，尝试从嵌套的img标签获取
                if not cover:
                    img = link.find('img')
                    cover = self._extract_img_url(img)
                
                # 获取更新状态（如：全8集、更新至2集等）
                status = ''
                status_elem = item.find('span', class_='hl-pic-text')
                if status_elem:
                    status = status_elem.get_text(strip=True)
                
                # 获取评分
                score = ''
                score_elem = item.find('span', class_='hl-tag-3')
                if score_elem:
                    score = score_elem.get_text(strip=True)
                
                video = {
                    'id': video_id,
                    'title': title,
                    'cover': cover if cover else f'https://via.placeholder.com/200x300?text={quote(title[:20])}',
                    'source': self.source_id,
                    'status': status,
                    'score': score,
                }
                videos.append(video)
                
            except Exception as e:
                print(f'解析视频项失败: {e}')
                continue
        
        return videos

    def _clean_detail_title(self, title):
        if not title:
            return ''
        safe_title = re.sub(r'\s+', ' ', str(title)).strip()
        safe_title = re.sub(r'\s*[-|｜_]\s*美剧屋.*$', '', safe_title).strip()
        return safe_title

    def _extract_detail_title(self, soup):
        if not soup:
            return ''

        h1 = soup.find('h1', class_='hl-dc-title')
        if h1:
            title = self._clean_detail_title(h1.get_text(strip=True))
            if title:
                return title

        title_elem = soup.find('div', class_='hl-item-title')
        if title_elem:
            title = self._clean_detail_title(title_elem.get_text(strip=True))
            if title:
                return title

        og_title = soup.find('meta', attrs={'property': 'og:title'})
        if og_title:
            title = self._clean_detail_title(og_title.get('content', ''))
            if title:
                return title

        doc_title = soup.find('title')
        if doc_title:
            title = self._clean_detail_title(doc_title.get_text(strip=True))
            if title:
                return title

        return ''

    def get_video_detail(self, video_id):
        """获取视频详情"""
        try:
            url = f'{self.base_url}/vod/{video_id}/'
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 获取标题
            title = self._extract_detail_title(soup)
            
            # 获取封面 - 美剧屋的封面URL在data-original属性中，可能在<a>或<span>标签上
            cover = ''
            # 方法1: 从span.hl-item-thumb的data-original属性获取
            cover_elem = soup.find('span', class_='hl-item-thumb')
            if cover_elem:
                cover = cover_elem.get('data-original', '')
                if cover:
                    cover = self._normalize_cover(cover)
            
            # 方法2: 从封面链接a.hl-item-thumb的data-original属性获取
            if not cover:
                cover_link = soup.find('a', class_='hl-item-thumb')
                if cover_link:
                    cover = cover_link.get('data-original', '')
                    if cover:
                        cover = self._normalize_cover(cover)
            
            # 方法3: 从hl-item-thumb div中获取
            if not cover:
                cover_div = soup.find('div', class_='hl-item-thumb')
                if cover_div:
                    # 尝试从嵌套的元素获取
                    for child in cover_div.find_all(['a', 'span', 'img']):
                        cover = child.get('data-original', '') or child.get('src', '')
                        if cover:
                            cover = self._normalize_cover(cover)
                            break
            
            # 获取评分
            score = ''
            score_elem = soup.find('span', class_='hl-tag-3')
            if score_elem:
                score = score_elem.get_text(strip=True)
            
            # 获取更新状态
            status = ''
            status_elem = soup.find('span', class_='hl-pic-text')
            if status_elem:
                status = status_elem.get_text(strip=True)
            
            # 获取简介
            description = ''
            desc_elem = soup.find('div', class_='hl-col-xs-12')
            if desc_elem:
                desc_text = desc_elem.get_text(strip=True)
                # 提取简介部分
                if '简介：' in desc_text:
                    description = desc_text.split('简介：')[-1].strip()
                elif '剧情：' in desc_text:
                    description = desc_text.split('剧情：')[-1].strip()
            
            # 获取演员列表
            actors = []
            info_items = soup.find_all('div', class_='hl-full-box')
            for info_box in info_items:
                text = info_box.get_text(strip=True)
                if '主演：' in text:
                    actor_text = text.split('主演：')[-1].split('导演：')[0].strip()
                    actors = [a.strip() for a in actor_text.split('/') if a.strip()]
                    break
            
            # 获取标签/类型
            tags = []
            for info_box in info_items:
                text = info_box.get_text(strip=True)
                if '类型：' in text:
                    tag_text = text.split('类型：')[-1].split('地区：')[0].strip()
                    tags = [t.strip() for t in tag_text.split('/') if t.strip()]
                    break
            
            # 获取地区
            area = ''
            for info_box in info_items:
                text = info_box.get_text(strip=True)
                if '地区：' in text:
                    area = text.split('地区：')[-1].split('年份：')[0].strip()
                    break
            
            # 获取年份
            year = ''
            for info_box in info_items:
                text = info_box.get_text(strip=True)
                if '年份：' in text:
                    year = text.split('年份：')[-1].strip()
                    break
            
            detail = {
                'id': video_id,
                'title': title,
                'name': title,
                'cover': cover,
                'score': score,
                'status': status,
                'actors': actors,
                'tags': tags,
                'description': description,
                'area': area,
                'year': year,
                'source': self.source_id,
            }
            
            return detail
            
        except Exception as e:
            print(f'获取视频详情失败: {e}')
            import traceback
            traceback.print_exc()
            return None

    def get_episodes(self, video_id):
        """获取剧集列表"""
        episodes = []
        
        try:
            url = f'{self.base_url}/vod/{video_id}/'
            response = self._make_request(url)
            if not response:
                return episodes
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找播放列表 - 美剧屋使用 hl-plays-list
            play_list = soup.find('ul', class_='hl-plays-list')
            if not play_list:
                # 尝试查找ID为hl-plays-list的元素
                play_list = soup.find('ul', id='hl-plays-list')
            
            if play_list:
                # 查找所有剧集链接
                episode_links = play_list.find_all('a', href=re.compile(r'/play/'))
                
                for link in episode_links:
                    try:
                        href = link.get('href', '')
                        if not href:
                            continue
                        
                        # 提取剧集信息 - URL格式：/play/12561-1-1/
                        episode_match = re.search(r'/play/(\d+)-(\d+)-(\d+)/?', href)
                        if not episode_match:
                            continue
                        
                        series_id = episode_match.group(1)  # 视频ID
                        play_source = episode_match.group(2)  # 播放源
                        episode_num = episode_match.group(3)  # 集数
                        
                        # 构造剧集ID
                        episode_id = f"{series_id}_{play_source}_{episode_num}"
                        
                        # 获取剧集标题
                        episode_title = link.get_text(strip=True)
                        if not episode_title:
                            episode_title = f'第{episode_num}集'
                        
                        # 构建播放URL
                        play_url = urljoin(self.base_url, href)
                        
                        episode = {
                            'id': episode_id,
                            'seriesId': video_id,
                            'title': episode_title,
                            'episodeNumber': int(episode_num),
                            'playUrl': play_url,
                            'source': self.source_id,
                        }
                        episodes.append(episode)
                        
                    except Exception as e:
                        print(f'解析剧集失败: {e}')
                        continue
            
        except Exception as e:
            print(f'获取剧集列表失败: {e}')
            import traceback
            traceback.print_exc()
        
        return episodes

    def get_episode_detail(self, episode_id):
        """获取单个剧集详情（包含播放链接）"""
        try:
            import json
            
            # 先访问首页获取Cookie
            print('访问首页获取Cookie...')
            home_response = self._make_request(self.base_url)
            if home_response:
                print('成功获取首页Cookie')
            
            # 从episode_id中解析出信息
            # episode_id格式：12561_1_1
            parts = episode_id.split('_')
            if len(parts) != 3:
                print(f'Invalid episode_id format: {episode_id}')
                return None
            
            series_id, play_source, episode_num = parts
            
            # 构建播放页面URL - 格式: /play/12561-1-1/
            play_page_url = f'{self.base_url}/play/{series_id}-{play_source}-{episode_num}/'
            response = self._make_request(play_page_url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 获取标题
            title = ''
            h2 = soup.find('h2')
            if h2:
                title = h2.get_text(strip=True)
            
            # 查找视频URL - 从player_aaaa变量中提取
            video_url = None
            
            # 从页面HTML中提取player_aaaa变量
            player_match = re.search(r'player_aaaa\s*=\s*(\{[^<]+\})', response.text)
            if player_match:
                try:
                    player_data = json.loads(player_match.group(1))
                    
                    # 获取编码后的URL
                    encoded_url = player_data.get('url', '')
                    
                    if encoded_url:
                        # 请求解析接口获取真正的m3u8地址
                        parse_url = f'https://api.apiimg.com/dplay/super.php?id={encoded_url}'
                        
                        # 带上cookie和referer请求解析接口
                        parse_headers = {
                            'User-Agent': self.headers.get('User-Agent', ''),
                            'Referer': 'https://www.mjwu.cc/',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        }
                        
                        parse_response = self.session.get(parse_url, headers=parse_headers, timeout=15)
                        if parse_response and parse_response.status_code == 200:
                            # 从返回的HTML中提取lineList数组
                            line_match = re.search(r'const\s+lineList\s*=\s*(\[.*?\]);', parse_response.text)
                            if line_match:
                                try:
                                    line_list = json.loads(line_match.group(1))
                                    if line_list and len(line_list) > 0:
                                        # 取第一个线路的URL作为视频地址
                                        video_url = line_list[0].get('url', '')
                                        print(f'获取到m3u8地址: {video_url}')
                                except json.JSONDecodeError as e:
                                    print(f'解析lineList失败: {e}')
                        
                        # 如果没获取到m3u8，使用解析页面URL作为备用
                        if not video_url:
                            video_url = parse_url
                        
                except json.JSONDecodeError as e:
                    print(f'解析player_aaaa失败: {e}')
            
            # 如果没找到，尝试查找iframe
            if not video_url:
                iframe = soup.find('iframe')
                if iframe:
                    video_url = iframe.get('src', '')
            
            episode = {
                'id': episode_id,
                'seriesId': series_id,
                'title': title or f'第{episode_num}集',
                'episodeNumber': int(episode_num),
                'videoUrl': video_url,
                'playUrl': play_page_url,
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
            # 构建搜索URL
            # 美剧屋搜索格式：/search/--/?wd=关键词 或 /search/--/page/{page}.html?wd=关键词
            if page > 1:
                url = f'{self.base_url}/search/--/page/{page}.html?wd={quote(keyword)}'
            else:
                url = f'{self.base_url}/search/--/?wd={quote(keyword)}'
            
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
