# -*- coding: utf-8 -*-
"""
HMZXA漫画采集源
网站: hmzxa.com
"""

import re
import logging
from bs4 import BeautifulSoup
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class HmzxaScraper(BaseScraper):
    """HMZXA漫画网爬虫"""
    
    def __init__(self, proxy_config=None):
        super().__init__('https://hmzxa.com', proxy_config)
        logger.info("初始化HMZXA爬虫")
    
    def get_comics_by_category(self, category_id, page=1, limit=20):
        """
        根据分类获取漫画列表
        URL格式: /category/tags/{category_id}/page/{page}
        """
        try:
            # 构建URL
            if page == 1:
                url = f'{self.base_url}/category/tags/{category_id}'
            else:
                url = f'{self.base_url}/category/tags/{category_id}/page/{page}'
            
            logger.info(f"请求分类漫画列表: {url}, 分类ID={category_id}, 页码={page}")
            
            response = self._make_request(url)
            if not response:
                return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            comics = []
            
            # 查找漫画列表
            comic_list = soup.find('ul', class_='acgn-comic-list')
            if comic_list:
                items = comic_list.find_all('li', class_='acgn-item')[:limit]
                
                for item in items:
                    try:
                        # 获取链接和标题
                        title_link = item.find('h3', class_='acgn-title').find('a')
                        if not title_link:
                            continue
                        
                        href = title_link.get('href', '')
                        title = title_link.get('title', '').replace('漫画', '').strip()
                        comic_id = href.strip('/').replace('.html', '')
                        
                        # 获取封面
                        thumbnail = item.find('a', class_='acgn-thumbnail')
                        cover_img = thumbnail.find('img') if thumbnail else None
                        cover = ''
                        if cover_img:
                            style = cover_img.get('style', '')
                            cover_match = re.search(r"url\('([^']+)'\)", style)
                            if cover_match:
                                cover = cover_match.group(1)
                        
                        # 获取最新章节
                        latest_chapter = ''
                        desc_div = item.find('div', class_='acgn-desc')
                        if desc_div:
                            latest_link = desc_div.find('a', class_='latest-cartoon')
                            if latest_link:
                                latest_chapter = latest_link.get('title', '')
                        
                        comics.append({
                            'id': comic_id,
                            'title': title,
                            'cover': cover,
                            'latestChapter': latest_chapter,
                            'status': 'ongoing'
                        })
                    except Exception as e:
                        logger.debug(f"解析漫画项失败: {e}")
                        continue
            
            # 解析分页信息
            has_more = False
            total_pages = 1
            
            # 查找分页控件 <div class="acgn-pages">
            pagination = soup.find('div', class_='acgn-pages')
            if pagination:
                # 查找所有页码链接
                page_links = pagination.find_all('a')
                page_numbers = []
                
                for link in page_links:
                    text = link.get_text(strip=True)
                    # 提取数字页码
                    if text.isdigit():
                        page_numbers.append(int(text))
                    # 检查是否有下一页
                    elif 'acgn-next' in link.get('class', []):
                        has_more = True
                
                if page_numbers:
                    total_pages = max(page_numbers)
                    if page < total_pages:
                        has_more = True
            else:
                # 如果没找到分页控件，用返回数量判断
                has_more = len(comics) >= limit
            
            logger.info(f"本页返回 {len(comics)} 部漫画, hasMore={has_more}, totalPages={total_pages}")
            
            return {
                'comics': comics,
                'hasMore': has_more,
                'total': len(comics),
                'page': page,
                'limit': limit,
                'totalPages': total_pages
            }
        except Exception as e:
            logger.error(f"获取分类漫画失败: {e}", exc_info=True)
            return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
    
    def get_hot_comics(self, page=1, limit=20):
        """获取热门漫画 - 使用热血分类"""
        return self.get_comics_by_category('49', page, limit)
    
    def get_latest_comics(self, page=1, limit=20):
        """获取最新漫画 - 使用热血分类"""
        return self.get_comics_by_category('49', page, limit)
    
    def get_categories(self):
        """获取分类列表"""
        try:
            url = f'{self.base_url}/category/'
            logger.info(f"请求分类页面: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'categories': []}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            categories = []
            
            # 查找分类列表 <dd class="acgn-bd">
            category_dd = soup.find('dd', class_='acgn-bd')
            if category_dd:
                # 跳过"全部"，只获取具体分类
                category_links = category_dd.find_all('a', class_='acgn-sort-attr')
                for link in category_links:
                    href = link.get('href', '')
                    title = link.get('title', '')
                    
                    # 解析分类ID /category/tags/49
                    match = re.search(r'/category/tags/(\d+)', href)
                    if match and title and '全部' not in title:
                        category_id = match.group(1)
                        # 去除"漫画"后缀
                        name = title.replace('漫画', '').strip()
                        
                        categories.append({
                            'id': category_id,
                            'name': name,
                            'url': f'{self.base_url}/category/tags/{category_id}'
                        })
            
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
        搜索或浏览漫画
        keyword: 搜索关键词（暂不支持）
        page: 页码
        limit: 每页数量
        """
        # HMZXA网站暂不支持关键词搜索，使用默认分类浏览
        logger.info(f"搜索漫画: keyword='{keyword}', page={page}")
        if keyword:
            logger.warning("HMZXA暂不支持关键词搜索，返回默认分类")
        
        # 使用热血分类作为默认
        return self.get_comics_by_category('49', page, limit)
    
    def get_comic_detail(self, comic_id):
        """获取漫画详情"""
        try:
            url = f'{self.base_url}/{comic_id}.html'
            logger.info(f"请求漫画详情: {url}")
            
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找详情区域
            detail_div = soup.find('div', class_='acgn-model-detail-frontcover')
            if not detail_div:
                return None
            
            # 标题
            title_h1 = detail_div.find('h1', class_='title')
            title = title_h1.get('title', '').replace('漫画', '').strip() if title_h1 else ''
            
            # 封面
            cover_img = detail_div.find('img', class_='thumb')
            cover = ''
            if cover_img:
                style = cover_img.get('style', '')
                cover_match = re.search(r"url\('([^']+)'\)", style)
                if cover_match:
                    cover = cover_match.group(1)
            
            # 标签
            tags = []
            tags_ul = detail_div.find('ul', class_='tags')
            if tags_ul:
                tag_links = tags_ul.find_all('a')
                tags = [link.text.strip() for link in tag_links]
            
            # 人气
            popularity = ''
            sort_p = detail_div.find('p', class_='sort')
            if sort_p:
                total_em = sort_p.find('em', class_='num')
                if total_em:
                    popularity = total_em.text.strip()
            
            # 简介
            description = ''
            desc_div = detail_div.find('div', class_='desc')
            if desc_div:
                desc_p = desc_div.find('p', class_='desc-content')
                if desc_p:
                    # 移除"简介："标题
                    desc_text = desc_p.get_text(strip=True)
                    description = desc_text.replace('简介：', '').replace('介绍:', '').strip()
            
            # 获取第一章节链接（开始阅读按钮）
            first_chapter_link = ''
            read_btn = detail_div.find('a', class_='btn-read')
            if read_btn:
                first_chapter_link = read_btn.get('href', '')
            
            return {
                'id': comic_id,
                'title': title,
                'cover': cover,
                'author': '',
                'description': description,
                'status': 'ongoing',
                'rating': 0.0,
                'categories': tags,
                'updateTime': ''
            }
        except Exception as e:
            logger.error(f"获取漫画详情失败: {e}", exc_info=True)
            return None
    
    def get_chapters(self, comic_id):
        """获取章节列表"""
        try:
            url = f'{self.base_url}/{comic_id}.html'
            logger.info(f"请求章节列表: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'chapters': [], 'total': 0}
            
            chapters = []
            
            # 从script标签中提取chapter_list变量
            # var chapter_list = [{'id':72424,'name':'...','url':'/72424.html',...}];
            chapter_list_pattern = r"var\s+chapter_list\s*=\s*(\[.*?\]);"
            match = re.search(chapter_list_pattern, response.text, re.DOTALL)
            
            if match:
                chapter_list_json = match.group(1)
                try:
                    import json
                    # 将JavaScript对象格式转换为JSON格式（单引号转双引号）
                    chapter_list_json = chapter_list_json.replace("'", '"')
                    chapter_data = json.loads(chapter_list_json)
                    
                    for idx, item in enumerate(chapter_data):
                        chapter_id = str(item.get('id', ''))
                        chapter_name = item.get('name', '')
                        chapter_time = item.get('time', '')
                        
                        chapters.append({
                            'id': chapter_id,
                            'title': chapter_name,
                            'order': idx + 1,
                            'updateTime': chapter_time
                        })
                    
                    logger.info(f"从JS变量中获取到{len(chapters)}个章节")
                except json.JSONDecodeError as e:
                    logger.error(f"解析章节JSON失败: {e}")
            else:
                logger.warning("未找到chapter_list变量")
            
            return {
                'chapters': chapters,
                'total': len(chapters)
            }
        except Exception as e:
            logger.error(f"获取章节列表失败: {e}", exc_info=True)
            return {'chapters': [], 'total': 0}
    
    def get_chapter_images(self, chapter_id):
        """获取章节图片列表"""
        try:
            url = f'{self.base_url}/{chapter_id}.html'
            logger.info(f"请求章节图片: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'images': [], 'total': 0}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            images = []
            
            # 查找所有图片标签
            # 图片在内容区域，通常有特定的class或在特定的容器内
            # 这里需要根据实际页面结构调整选择器
            img_tags = soup.find_all('img', src=re.compile(r'\.jpg|\.png|\.webp'))
            
            page_num = 1
            for img in img_tags:
                src = img.get('src', '')
                alt = img.get('alt', '')
                
                # 过滤掉非内容图片（如广告、logo等）
                # 匹配图床URL格式：数字目录/数字文件名.jpg
                if src and re.search(r'/\d+/\d+\.(jpg|png|webp|jpeg)', src):
                    images.append({
                        'page': page_num,
                        'url': src
                    })
                    page_num += 1
            
            logger.info(f"获取到{len(images)}张图片")
            
            return {
                'images': images,
                'total': len(images)
            }
        except Exception as e:
            logger.error(f"获取章节图片失败: {e}", exc_info=True)
            return {'images': [], 'total': 0}
