# -*- coding: utf-8 -*-
"""
X漫画采集源
网站: www.xmanhua.com
"""

import re
import urllib3
import hashlib
import execjs
from datetime import datetime
from urllib.parse import quote
from bs4 import BeautifulSoup
from .base_scraper import BaseScraper

# 禁用SSL警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class XmanhuaScraper(BaseScraper):
    """X漫画爬虫实现"""
    
    def __init__(self, proxy_config=None):
        self.base_url = 'https://xmanhua.com'
        super().__init__(self.base_url, proxy_config)
        # 添加更多headers
        self.session.headers.update({
            'Referer': self.base_url,
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        })
    
    def get_categories(self):
        """
        获取分类列表
        URL: /manga-list/
        选择器: body > div.class-con > div > div:nth-child(1) > a
        """
        try:
            url = f'{self.base_url}/manga-list/'
            response = self._make_request(url, verify_ssl=False)
            soup = BeautifulSoup(response.text, 'lxml')
            
            categories = []
            
            # 获取所有分类
            category_items = soup.select('body > div.class-con > div > div:nth-child(1) > a')
            
            for item in category_items:
                # 跳过"全部"等非具体分类
                if 'active' in item.get('class', []):
                    continue
                
                href = item.get('href', '')
                name = item.get_text(strip=True)
                
                if href and name:
                    # 从URL中提取分类ID
                    # 例如: /manga-list-31-0-10-p1/ -> 31
                    match = re.search(r'/manga-list-(\d+)-', href)
                    category_id = match.group(1) if match else ''
                    
                    if category_id:
                        categories.append({
                            'id': category_id,
                            'name': name,
                            'url': self.base_url + href
                        })
            
            return {
                'categories': categories,
                'total': len(categories)
            }
        except Exception as e:
            print(f"获取分类失败: {e}")
            return {'categories': [], 'total': 0}
    
    def get_comics_by_category(self, category_id, page=1, limit=20):
        """
        获取分类下的漫画列表
        URL格式: /manga-list-{category_id}-0-10-p{page}/
        选择器: body > div:nth-child(4) > ul > li
        """
        try:
            # 构建URL
            url = f'{self.base_url}/manga-list-{category_id}-0-10-p{page}/'
            print(f"请求分类漫画URL: {url}")
            
            response = self._make_request(url, verify_ssl=False)
            soup = BeautifulSoup(response.text, 'lxml')
            
            comics = []
            
            # 获取漫画列表
            comic_items = soup.select('ul.mh-list > li')
            
            # 如果第一个选择器没找到，尝试其他可能的选择器
            if not comic_items:
                comic_items = soup.select('body > div:nth-child(4) > ul > li')
            
            for item in comic_items[:limit]:
                try:
                    # 获取漫画链接和ID
                    link_elem = item.select_one('div.mh-item > a')
                    if not link_elem:
                        link_elem = item.select_one('a')
                    if not link_elem:
                        continue
                    
                    href = link_elem.get('href', '')
                    
                    # 提取漫画ID
                    # 例如: /73xm/ -> 73xm
                    comic_id = href.strip('/').split('/')[-1] if href else ''
                    
                    # 获取封面
                    img_elem = item.select_one('img.mh-cover')
                    if not img_elem:
                        img_elem = item.select_one('img')
                    cover = img_elem.get('src', '') if img_elem else ''
                    if cover and not cover.startswith('http'):
                        cover = self.base_url + cover
                    
                    # 获取标题
                    title = ''
                    title_elem = item.select_one('h2.title > a')
                    if title_elem:
                        title = title_elem.get('title', '').strip()
                        if not title:
                            title = title_elem.get_text(strip=True)
                    
                    # 获取最新章节
                    chapter_elem = item.select_one('p.chapter > a')
                    latest_chapter = chapter_elem.get_text(strip=True) if chapter_elem else ''
                    
                    if comic_id:
                        comic_data = {
                            'id': comic_id,
                            'title': title,
                            'cover': cover,
                            'latestChapter': latest_chapter,
                            'status': 'ongoing'
                        }
                        comics.append(comic_data)
                        
                        # 调试输出前3个漫画的信息
                        if len(comics) <= 3:
                            print(f"漫画 #{len(comics)}: ID={comic_id}, 标题={title}, 封面={cover[:50] if cover else 'None'}")
                except Exception as e:
                    print(f"解析单个漫画失败: {e}")
                    continue
            
            # 检查是否有下一页
            has_more = len(comic_items) >= limit
            
            return {
                'comics': comics,
                'hasMore': has_more,
                'total': len(comics)
            }
        except Exception as e:
            print(f"获取分类漫画失败: {e}")
            return {'comics': [], 'hasMore': False, 'total': 0}
    
    def get_hot_comics(self, page=1, limit=20):
        """获取热门漫画 - 使用第一个分类"""
        return self.get_comics_by_category('31', page, limit)
    
    def get_latest_comics(self, page=1, limit=20):
        """获取最新漫画 - 使用更新列表"""
        return self.get_comics_by_category('31', page, limit)
    
    def search_comics(self, keyword, page=1, limit=20):
        """
        搜索漫画
        URL格式: /search?title=关键词
        选择器: body > div:nth-child(4) > ul > li
        """
        try:
            # URL编码关键词
            from urllib.parse import quote
            encoded_keyword = quote(keyword)
            url = f'{self.base_url}/search?title={encoded_keyword}'
            print(f"搜索URL: {url}")
            
            response = self._make_request(url, verify_ssl=False)
            soup = BeautifulSoup(response.text, 'lxml')
            
            comics = []
            
            # 搜索结果选择器
            comic_items = soup.select('body > div:nth-child(4) > ul > li')
            
            for item in comic_items[:limit]:
                try:
                    # 获取漫画链接
                    link_elem = item.select_one('div.mh-item > a')
                    if not link_elem:
                        continue
                    
                    href = link_elem.get('href', '')
                    comic_id = href.strip('/').split('/')[-1] if href else ''
                    
                    # 获取封面
                    img_elem = item.select_one('img.mh-cover')
                    cover = img_elem.get('src', '') if img_elem else ''
                    if cover and not cover.startswith('http'):
                        cover = self.base_url + cover
                    
                    # 获取标题
                    title_elem = item.select_one('h2.title > a')
                    title = title_elem.get_text(strip=True) if title_elem else ''
                    
                    # 获取最新章节
                    chapter_elem = item.select_one('p.chapter > a')
                    latest_chapter = chapter_elem.get_text(strip=True) if chapter_elem else ''
                    
                    if comic_id:
                        comics.append({
                            'id': comic_id,
                            'title': title,
                            'cover': cover,
                            'latestChapter': latest_chapter,
                            'status': 'ongoing'
                        })
                except Exception as e:
                    print(f"解析搜索结果失败: {e}")
                    continue
            
            return {
                'comics': comics,
                'hasMore': False,
                'total': len(comics)
            }
        except Exception as e:
            print(f"搜索失败: {e}")
            return {'comics': [], 'hasMore': False, 'total': 0}
    
    def get_comic_detail(self, comic_id):
        """
        获取漫画详情
        URL: /{comic_id}/
        封面: body > div.detail-info-1 > div > div > img.detail-info-cover
        介绍: body > div.detail-info-2 > div > div > p
        评分: body > div.detail-info-1 > div > div > p.detail-info-stars > span
        """
        try:
            url = f'{self.base_url}/{comic_id}/'
            print(f"请求详情URL: {url}")
            
            response = self._make_request(url, verify_ssl=False)
            soup = BeautifulSoup(response.text, 'lxml')
            
            # 获取标题
            title_elem = soup.select_one('h1.detail-info-title')
            if not title_elem:
                title_elem = soup.select_one('title')
            title = title_elem.get_text(strip=True) if title_elem else ''
            
            # 获取封面
            cover_elem = soup.select_one('body > div.detail-info-1 > div > div > img.detail-info-cover')
            if not cover_elem:
                cover_elem = soup.select_one('img.detail-info-cover')
            cover = cover_elem.get('src', '') if cover_elem else ''
            if cover and not cover.startswith('http'):
                cover = self.base_url + cover
            
            # 获取介绍
            desc_elem = soup.select_one('body > div.detail-info-2 > div > div > p')
            if not desc_elem:
                desc_elem = soup.select_one('p.detail-info-tip')
            description = desc_elem.get_text(strip=True) if desc_elem else ''
            
            # 获取评分
            rating_elem = soup.select_one('body > div.detail-info-1 > div > div > p.detail-info-stars > span')
            if not rating_elem:
                rating_elem = soup.select_one('span.detail-info-stars-score')
            rating = 0
            if rating_elem:
                rating_text = rating_elem.get_text(strip=True)
                try:
                    rating = float(rating_text)
                except:
                    rating = 0
            
            # 获取作者
            author_elem = soup.select_one('p.detail-info-author')
            author = author_elem.get_text(strip=True).replace('作者：', '') if author_elem else '未知'
            
            # 获取状态和章节数
            # 解析: 已完結| 共205章, 2023-02-09
            status_elem = soup.select_one('p.detail-info-update')
            status = 'ongoing'
            update_time = ''
            if status_elem:
                status_text = status_elem.get_text(strip=True)
                if '已完結' in status_text or '完结' in status_text:
                    status = 'completed'
                # 提取更新时间
                date_match = re.search(r'\d{4}-\d{2}-\d{2}', status_text)
                if date_match:
                    update_time = date_match.group(0)
            
            return {
                'id': comic_id,
                'title': title,
                'cover': cover,
                'author': author,
                'description': description,
                'status': status,
                'rating': rating,
                'categories': [],
                'updateTime': update_time
            }
        except Exception as e:
            print(f"获取漫画详情失败: {e}")
            return None
    
    def get_chapters(self, comic_id):
        """
        获取章节列表
        选择器: #chapterlistload > a
        """
        try:
            url = f'{self.base_url}/{comic_id}/'
            print(f"请求章节列表URL: {url}")
            
            response = self._make_request(url, verify_ssl=False)
            soup = BeautifulSoup(response.text, 'lxml')
            
            chapters = []
            
            # 获取章节列表
            chapter_items = soup.select('#chapterlistload > a')
            
            for idx, item in enumerate(chapter_items):
                href = item.get('href', '')
                title = item.get_text(strip=True)
                
                # 提取章节ID
                # 例如: /m271588/ -> m271588
                chapter_id = href.strip('/').split('/')[-1] if href else ''
                
                if chapter_id:
                    chapters.append({
                        'id': chapter_id,
                        'title': title,
                        'order': idx + 1,
                        'updateTime': ''
                    })
            
            return {
                'chapters': chapters,
                'total': len(chapters)
            }
        except Exception as e:
            print(f"获取章节列表失败: {e}")
            return {'chapters': [], 'total': 0}
    
    def get_chapter_images(self, chapter_id):
        """
        获取章节图片
        使用 chapterimage.ashx API 接口获取图片
        """
        try:
            first_page_url = f'{self.base_url}/{chapter_id}/'
            print(f"请求章节第一页: {first_page_url}")
            
            response = self._make_request(first_page_url, verify_ssl=False)
            if not response:
                return {'images': [], 'total': 0}
            
            html_content = response.text
            
            # 从JavaScript变量中提取信息
            image_count_match = re.search(r'var XMANHUA_IMAGE_COUNT=(\d+);', html_content)
            cid_match = re.search(r'var XMANHUA_CID=(\d+);', html_content)
            mid_match = re.search(r'var XMANHUA_MID=(\d+);', html_content)
            viewsign_dt_match = re.search(r'var XMANHUA_VIEWSIGN_DT="([^"]+)";', html_content)
            viewsign_match = re.search(r'var XMANHUA_VIEWSIGN="([^"]+)";', html_content)
            
            if not image_count_match:
                print("未找到XMANHUA_IMAGE_COUNT变量")
                return {'images': [], 'total': 0}
            
            total_pages = int(image_count_match.group(1))
            cid = cid_match.group(1) if cid_match else chapter_id.replace('m', '')
            mid = mid_match.group(1) if mid_match else ''
            viewsign_dt = viewsign_dt_match.group(1) if viewsign_dt_match else ''
            viewsign = viewsign_match.group(1) if viewsign_match else ''
            
            print(f"漫画ID: {mid}, 章节ID: {cid}, 总页数: {total_pages}")
            print(f"签名时间: {viewsign_dt}, 签名: {viewsign}")
            
            images = []
            
            # 使用 chapterimage.ashx API 获取每一页的图片
            for page_num in range(1, total_pages + 1):
                # 构建API URL
                api_url = f'{self.base_url}/{chapter_id}/chapterimage.ashx'
                
                # 构建请求参数，使用从页面提取的签名
                params = {
                    'cid': cid,
                    'page': page_num,
                    'key': '',
                    '_cid': cid,
                    '_mid': mid,
                    '_dt': viewsign_dt,
                    '_sign': viewsign
                }
                
                # 设置请求头
                headers = {
                    'Accept': '*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                    'Referer': f'{self.base_url}/{chapter_id}/',
                    'X-Requested-With': 'XMLHttpRequest'
                }
                
                try:
                    # 使用session发送请求
                    self.session.headers.update(headers)
                    api_response = self.session.get(
                        api_url,
                        params=params,
                        timeout=10,
                        verify=False
                    )
                    
                    if api_response and api_response.text:
                        response_text = api_response.text.strip()
                        
                        # API返回的是混淆的JavaScript代码
                        # 需要执行eval来获取真实的图片URL数组
                        try:
                            # 执行混淆的JavaScript代码
                            js_code = response_text + '; d;'
                            ctx = execjs.compile(js_code)
                            result = ctx.eval('d')
                            
                            if result and len(result) > 0:
                                img_url = result[0]
                                
                                if img_url and not img_url.startswith('http'):
                                    img_url = 'https:' + img_url if img_url.startswith('//') else self.base_url + img_url
                                
                                if img_url:
                                    images.append({
                                        'page': page_num,
                                        'url': img_url
                                    })
                                    
                                    if page_num <= 3:
                                        print(f"  第{page_num}页: {img_url}")
                            else:
                                print(f"  第{page_num}页: JavaScript执行结果为空")
                        except Exception as js_error:
                            print(f"  第{page_num}页: JavaScript执行失败 - {js_error}")
                            print(f"  响应内容: {response_text[:200]}")
                except Exception as e:
                    print(f"获取第{page_num}页失败: {e}")
                    continue
            
            if len(images) > 3:
                print(f"  ... (共{total_pages}页，已获取{len(images)}页)")
            
            return {
                'images': images,
                'total': len(images),
                'expected_total': total_pages
            }
        except Exception as e:
            print(f"获取章节图片失败: {e}")
            return {'images': [], 'total': 0}
