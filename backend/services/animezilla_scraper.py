# -*- coding: utf-8 -*-
"""
18H Animezilla漫画采集源
网站: 18h.animezilla.com
"""

import re
import logging
import asyncio
import aiohttp
from urllib.parse import quote, unquote
from bs4 import BeautifulSoup
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class AnimezillaScraper(BaseScraper):
    """18H Animezilla漫画网爬虫"""
    
    def __init__(self, proxy_config=None):
        super().__init__('https://18h.animezilla.com', proxy_config)
        logger.info("初始化18H Animezilla爬虫")
        self._initialized = False
    
    def _ensure_initialized(self):
        """确保已访问首页获取cookie"""
        if not self._initialized:
            try:
                logger.info("首次访问首页获取cookie")
                response = self._make_request(f'{self.base_url}/manga')
                if response:
                    self._initialized = True
                    logger.info("首页访问成功，cookie已保存")
            except Exception as e:
                logger.warning(f"首页访问失败: {e}")
    
    def _parse_comic_list(self, soup, limit=20):
        """解析漫画列表通用方法"""
        comics = []
        
        # 查找article标签
        articles = soup.find_all('article')[:limit]
        
        for article in articles:
            try:
                # 获取标题和链接
                h2 = article.find('h2')
                if not h2:
                    continue
                    
                title_link = h2.find('a')
                if not title_link:
                    continue
                
                href = title_link.get('href', '')
                title = title_link.get_text(strip=True)
                
                # 从URL提取ID: /manga/4322 -> 4322
                match = re.search(r'/manga/(\d+)', href)
                if not match:
                    continue
                comic_id = match.group(1)
                
                # 获取封面
                cover = ''
                img = article.find('img')
                if img:
                    cover = img.get('src', '') or img.get('data-src', '')
                
                # 获取标签
                tags = []
                tag_list = article.find('ul') or article.find('list')
                if tag_list:
                    tag_links = tag_list.find_all('a')
                    tags = [link.get_text(strip=True) for link in tag_links[:5]]
                
                # 提取作者（从标题格式 [中文A漫][作者名] 标题 [页数P]）
                author = ''
                author_match = re.search(r'\[中文[A成]漫\]\[([^\]]+)\]', title)
                if author_match:
                    author = author_match.group(1)
                
                comics.append({
                    'id': comic_id,
                    'title': title,
                    'cover': cover,
                    'author': author,
                    'tags': tags,
                    'latestChapter': '单行本',
                    'status': 'completed'
                })
            except Exception as e:
                logger.debug(f"解析漫画项失败: {e}")
                continue
        
        return comics
    
    def get_comics_by_category(self, category_id, page=1, limit=20):
        """
        根据分类获取漫画列表
        URL格式: /topic/{category_id} 或 /topic/{category_id}/page/{page}
        """
        try:
            # category_id 可能是URL编码的标签名
            if page == 1:
                url = f'{self.base_url}/topic/{category_id}'
            else:
                url = f'{self.base_url}/topic/{category_id}/page/{page}'
            
            logger.info(f"请求分类漫画列表: {url}, 分类ID={category_id}, 页码={page}")
            
            response = self._make_request(url)
            if not response:
                return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            comics = self._parse_comic_list(soup, limit)
            
            # 解析分页
            has_more = False
            pagination = soup.find('nav', class_='navigation') or soup.find('div', class_='pagination')
            if pagination:
                next_link = pagination.find('a', class_='next') or pagination.find('a', string=re.compile(r'下一?頁|Next'))
                has_more = next_link is not None
            else:
                has_more = len(comics) >= limit
            
            return {
                'comics': comics,
                'hasMore': has_more,
                'total': len(comics),
                'page': page,
                'limit': limit
            }
        except Exception as e:
            logger.error(f"获取分类漫画失败: {e}", exc_info=True)
            return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
    
    def get_hot_comics(self, page=1, limit=20):
        """获取热门漫画 - 使用主漫画列表"""
        try:
            if page == 1:
                url = f'{self.base_url}/manga'
            else:
                url = f'{self.base_url}/manga/page/{page}'
            
            logger.info(f"请求热门漫画列表: {url}, 页码={page}")
            
            response = self._make_request(url)
            if not response:
                return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            comics = self._parse_comic_list(soup, limit)
            
            # 检查是否有下一页
            has_more = False
            # 查找分页链接
            page_links = soup.find_all('a', href=re.compile(r'/manga/page/\d+'))
            if page_links:
                page_numbers = []
                for link in page_links:
                    match = re.search(r'/page/(\d+)', link.get('href', ''))
                    if match:
                        page_numbers.append(int(match.group(1)))
                if page_numbers and page < max(page_numbers):
                    has_more = True
            else:
                has_more = len(comics) >= limit
            
            return {
                'comics': comics,
                'hasMore': has_more,
                'total': len(comics),
                'page': page,
                'limit': limit
            }
        except Exception as e:
            logger.error(f"获取热门漫画失败: {e}", exc_info=True)
            return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
    
    def get_latest_comics(self, page=1, limit=20):
        """获取最新漫画 - 使用主漫画列表"""
        return self.get_hot_comics(page, limit)
    
    def get_categories(self):
        """获取分类列表（从热门标签中获取）"""
        try:
            url = f'{self.base_url}/manga'
            logger.info(f"请求分类页面: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'categories': []}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            categories = []
            seen_ids = set()
            
            # 从页面中查找所有topic链接
            topic_links = soup.find_all('a', href=re.compile(r'/topic/'))
            
            for link in topic_links:
                href = link.get('href', '')
                name = link.get_text(strip=True)
                
                # 提取分类ID
                match = re.search(r'/topic/([^/]+)', href)
                if match and name and len(name) < 20:
                    category_id = match.group(1)
                    
                    # 去重
                    if category_id in seen_ids:
                        continue
                    seen_ids.add(category_id)
                    
                    # 解码URL编码的ID
                    display_name = unquote(category_id)
                    if display_name != name:
                        display_name = name
                    
                    categories.append({
                        'id': category_id,
                        'name': display_name,
                        'url': f'{self.base_url}/topic/{category_id}'
                    })
            
            # 限制返回数量并去重
            categories = categories[:50]
            
            logger.info(f"获取到{len(categories)}个分类")
            return {
                'categories': categories,
                'total': len(categories)
            }
        except Exception as e:
            logger.error(f"获取分类列表失败: {e}", exc_info=True)
            return {'categories': [], 'total': 0}
    
    def search_comics(self, keyword='', page=1, limit=20):
        """
        搜索漫画 - 此网站使用标签搜索
        keyword: 搜索关键词
        page: 页码
        limit: 每页数量
        """
        try:
            if not keyword:
                logger.info(f"无搜索关键词，返回默认列表")
                return self.get_hot_comics(page, limit)
            
            # 使用topic进行搜索
            encoded_keyword = quote(keyword)
            if page == 1:
                url = f'{self.base_url}/topic/{encoded_keyword}'
            else:
                url = f'{self.base_url}/topic/{encoded_keyword}/page/{page}'
            
            logger.info(f"搜索漫画: keyword='{keyword}', page={page}, url={url}")
            
            response = self._make_request(url)
            if not response:
                # 如果标签搜索失败，尝试返回空结果
                return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            comics = self._parse_comic_list(soup, limit)
            
            has_more = len(comics) >= limit
            
            return {
                'comics': comics,
                'hasMore': has_more,
                'total': len(comics),
                'page': page,
                'limit': limit
            }
        except Exception as e:
            logger.error(f"搜索漫画失败: {e}", exc_info=True)
            return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
    
    def get_comic_detail(self, comic_id):
        """获取漫画详情"""
        try:
            url = f'{self.base_url}/manga/{comic_id}'
            logger.info(f"请求漫画详情: {url}")
            
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 标题
            h1 = soup.find('h1')
            title = h1.get_text(strip=True) if h1 else ''
            
            # 提取作者（从标题格式 [中文A漫][作者名] 标题 [页数P]）
            author = ''
            author_match = re.search(r'\[中文[A成]漫\]\[([^\]]+)\]', title)
            if author_match:
                author = author_match.group(1)
            
            # 提取页数
            page_count = 0
            page_match = re.search(r'\[(\d+)P\]', title)
            if page_match:
                page_count = int(page_match.group(1))
            
            # 封面
            cover = ''
            article = soup.find('article')
            if article:
                # 查找主图片链接内的图片
                img_link = article.find('a', href=re.compile(rf'/manga/{comic_id}/\d+'))
                if img_link:
                    img = img_link.find('img')
                    if img:
                        cover = img.get('src', '') or img.get('data-src', '')
                
                # 如果没找到，尝试其他方式
                if not cover:
                    img = article.find('img')
                    if img:
                        cover = img.get('src', '') or img.get('data-src', '')
            
            # 标签 - 查找article内包含/topic/链接的列表
            tags = []
            if article:
                # 查找所有指向/topic/的链接
                topic_links = article.find_all('a', href=re.compile(r'/topic/'))
                for link in topic_links:
                    tag_name = link.get_text(strip=True)
                    if tag_name and len(tag_name) < 20:  # 过滤太长的文本
                        tags.append(tag_name)
                # 去重并保持顺序
                seen = set()
                unique_tags = []
                for tag in tags:
                    if tag not in seen:
                        seen.add(tag)
                        unique_tags.append(tag)
                tags = unique_tags[:30]  # 限制数量
            
            # 评分
            rating = 0.0
            rating_elem = soup.find('strong', string=re.compile(r'\d+\.\d+/\d+'))
            if rating_elem:
                rating_match = re.search(r'(\d+\.\d+)/\d+', rating_elem.get_text())
                if rating_match:
                    rating = float(rating_match.group(1))
            
            return {
                'id': comic_id,
                'title': title,
                'cover': cover,
                'author': author,
                'description': f'共{page_count}页' if page_count else '',
                'status': 'completed',
                'rating': rating,
                'categories': tags,
                'updateTime': '',
                'pageCount': page_count
            }
        except Exception as e:
            logger.error(f"获取漫画详情失败: {e}", exc_info=True)
            return None
    
    def get_chapters(self, comic_id):
        """获取章节列表 - 单行本只有一个章节"""
        try:
            # 先获取详情以获取页数
            detail = self.get_comic_detail(comic_id)
            
            page_count = 0
            title = '单行本'
            
            if detail:
                page_count = detail.get('pageCount', 0)
                title = detail.get('title', '单行本')
            
            # 单行本只返回一个章节
            chapters = [{
                'id': comic_id,
                'title': f'全本 ({page_count}P)' if page_count else title,
                'order': 1,
                'updateTime': ''
            }]
            
            logger.info(f"获取到1个章节")
            
            return {
                'chapters': chapters,
                'total': 1
            }
        except Exception as e:
            logger.error(f"获取章节列表失败: {e}", exc_info=True)
            return {'chapters': [], 'total': 0}
    
    def get_chapter_images(self, chapter_id):
        """获取章节图片列表"""
        try:
            # 确保已初始化（获取cookie）
            self._ensure_initialized()
            
            # 先获取第一页确定总页数
            url = f'{self.base_url}/manga/{chapter_id}'
            logger.info(f"请求章节图片: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'images': [], 'total': 0}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            images = []
            
            # 从标题中提取总页数
            total_pages = 0
            h1 = soup.find('h1')
            if h1:
                title = h1.get_text(strip=True)
                page_match = re.search(r'\[(\d+)P\]', title)
                if page_match:
                    total_pages = int(page_match.group(1))
            
            # 如果从标题获取不到页数，从分页导航获取
            if not total_pages:
                # 查找尾页链接
                last_page_link = soup.find('a', string=re.compile(r'尾頁|末页|Last'))
                if last_page_link:
                    href = last_page_link.get('href', '')
                    match = re.search(r'/(\d+)$', href)
                    if match:
                        total_pages = int(match.group(1))
            
            # 如果还是获取不到，尝试从分页数字获取
            if not total_pages:
                page_links = soup.find_all('a', href=re.compile(rf'/manga/{chapter_id}/\d+'))
                page_numbers = []
                for link in page_links:
                    match = re.search(r'/(\d+)$', link.get('href', ''))
                    if match:
                        page_numbers.append(int(match.group(1)))
                if page_numbers:
                    total_pages = max(page_numbers)
            
            logger.info(f"总页数: {total_pages}")
            
            if not total_pages:
                logger.error("无法获取总页数")
                return {'images': [], 'total': 0}
            
            # 使用异步并发获取所有页面的图片URL
            logger.info(f"开始并发获取{total_pages}张图片...")
            images = asyncio.run(self._fetch_images_async(chapter_id, total_pages))
            
            logger.info(f"获取到{len(images)}张图片")
            
            return {
                'images': images,
                'total': len(images)
            }
        except Exception as e:
            logger.error(f"获取章节图片失败: {e}", exc_info=True)
            return {'images': [], 'total': 0}
    
    async def _fetch_images_async(self, chapter_id, total_pages):
        """异步并发获取所有页面的图片URL"""
        images = []
        
        # 创建异步HTTP会话，复用session的cookie
        connector = aiohttp.TCPConnector(limit=10)  # 最多10个并发连接
        timeout = aiohttp.ClientTimeout(total=30)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            # 创建所有页面的任务
            tasks = []
            for page_num in range(1, total_pages + 1):
                task = self._fetch_single_page_image(session, chapter_id, page_num)
                tasks.append(task)
            
            # 并发执行所有任务，每10个打印一次进度
            for i in range(0, len(tasks), 10):
                batch = tasks[i:i+10]
                results = await asyncio.gather(*batch, return_exceptions=True)
                
                for result in results:
                    if isinstance(result, dict) and result:
                        images.append(result)
                    elif isinstance(result, Exception):
                        logger.warning(f"获取页面失败: {result}")
                
                # 打印进度
                current = min(i + 10, total_pages)
                logger.info(f"进度: {current}/{total_pages} ({int(current/total_pages*100)}%)")
        
        # 按页码排序
        images.sort(key=lambda x: x['page'])
        return images
    
    async def _fetch_single_page_image(self, session, chapter_id, page_num):
        """异步获取单个页面的图片URL"""
        page_url = f'{self.base_url}/manga/{chapter_id}/{page_num}'
        
        try:
            # 使用与session相同的headers和cookies
            headers = self.session.headers.copy()
            cookies = {cookie.name: cookie.value for cookie in self.session.cookies}
            
            async with session.get(page_url, headers=headers, cookies=cookies, ssl=False) as response:
                if response.status != 200:
                    logger.warning(f"第{page_num}页请求失败: HTTP {response.status}")
                    return None
                
                html = await response.text()
                page_soup = BeautifulSoup(html, 'html.parser')
                
                # 查找article内的主图片
                article = page_soup.find('article')
                if article:
                    # 查找id='comic'的img标签
                    img = article.find('img', id='comic')
                    if img:
                        img_url = img.get('src', '') or img.get('data-src', '')
                        if img_url and img_url.startswith('http'):
                            return {
                                'page': page_num,
                                'url': img_url
                            }
                    
                    # 如果没找到，尝试查找包含链接内的img
                    img_link = article.find('a', href=re.compile(rf'/manga/{chapter_id}/\d+'))
                    if img_link:
                        img = img_link.find('img')
                        if img:
                            img_url = img.get('src', '') or img.get('data-src', '')
                            if img_url and img_url.startswith('http'):
                                return {
                                    'page': page_num,
                                    'url': img_url
                                }
                
                logger.warning(f"第{page_num}页未找到图片")
                return None
                
        except Exception as e:
            logger.error(f"获取第{page_num}页图片失败: {e}")
            return None
    
    def get_image_from_page(self, page_url):
        """从页面URL获取实际图片URL"""
        try:
            response = self._make_request(page_url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找主图片
            article = soup.find('article')
            if article:
                imgs = article.find_all('img')
                for img in imgs:
                    src = img.get('src', '') or img.get('data-src', '')
                    if src and not ('ad' in src.lower() or 'banner' in src.lower()):
                        return src
            
            return None
        except Exception as e:
            logger.error(f"获取页面图片失败: {e}")
            return None
