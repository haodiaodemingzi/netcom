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
    
    def extract_uk_from_tokens(self, packed_code):
        """直接从token数组中提取uk值"""
        try:
            # 查找split('|')部分
            split_match = re.search(r"'([^']+)'\.split\('\|'\)", packed_code)
            if split_match:
                tokens = split_match.group(1).split('|')
                
                # 查找uk和对应的值
                if 'uk' in tokens:
                    uk_index = tokens.index('uk')
                    
                    # 查找长字符串（uk值）
                    for i, token in enumerate(tokens):
                        if len(token) > 40 and re.match(r'^[A-F0-9]+$', token):
                            return token
                
                # 如果没找到uk关键字，直接查找长字符串
                for i, token in enumerate(tokens):
                    if len(token) > 40 and re.match(r'^[A-F0-9]+$', token):
                        return token
            
            return None
        except Exception:
            return None
    
    def get_categories(self):
        """
        获取分类列表
        URL: /manga-list/
        选择器: body > div.class-con > div > div:nth-child(1) > a
        """
        try:
            print(f"\n{'='*60}")
            print(f"[分类] 开始获取分类列表")
            print(f"{'='*60}")
            
            url = f'{self.base_url}/manga-list/'
            print(f"[分类] 请求URL: {url}")
            
            response = self._make_request(url, verify_ssl=False)
            if not response:
                print(f"[分类] ✗ 请求失败")
                return {'categories': [], 'total': 0}
            
            print(f"[分类] ✓ 请求成功，状态码: {response.status_code}")
            print(f"[分类] HTML长度: {len(response.text)} 字符")
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            categories = []
            
            # 获取所有分类
            print(f"\n[分类] 开始解析分类列表")
            print(f"[分类] 选择器: body > div.class-con > div > div:nth-child(1) > a")
            category_items = soup.select('body > div.class-con > div > div:nth-child(1) > a')
            print(f"[分类] 找到 {len(category_items)} 个分类链接")
            
            parsed_count = 0
            for idx, item in enumerate(category_items):
                # 跳过"全部"等非具体分类
                if 'active' in item.get('class', []):
                    if idx < 5:
                        print(f"[分类] 跳过: active类的链接")
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
                        parsed_count += 1
                        
                        # 打印前5个分类
                        if parsed_count <= 5:
                            print(f"[分类] {parsed_count}. ID={category_id}, 名称={name}, URL={href}")
            
            if parsed_count > 5:
                print(f"[分类] ... (共{parsed_count}个分类)")
            
            print(f"\n[分类] ✓ 成功解析 {len(categories)} 个分类")
            print(f"{'='*60}\n")
            
            return {
                'categories': categories,
                'total': len(categories)
            }
        except Exception as e:
            print(f"[分类] ✗ 获取分类失败: {e}")
            import traceback
            traceback.print_exc()
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
            
            # 调试：打印响应信息
            print(f"[调试] 响应状态码: {response.status_code}")
            print(f"[调试] Content-Encoding: {response.headers.get('Content-Encoding', 'none')}")
            print(f"[调试] Content-Type: {response.headers.get('Content-Type', 'none')}")
            print(f"[调试] 响应编码: {response.encoding}")
            print(f"[调试] 响应内容长度: {len(response.text)} 字符")
            
            # 检查是否是有效的HTML
            html_preview = response.text[:500]
            if '<html' in html_preview.lower() or '<!doctype' in html_preview.lower():
                print(f"[调试] ✓ HTML内容正常")
                print(f"[调试] 响应内容预览 (前200字符): {html_preview[:200]}")
            else:
                print(f"[调试] ✗ HTML内容异常，可能是压缩或编码问题")
                print(f"[调试] 原始内容 (前100字节): {response.content[:100]}")
                print(f"[调试] 文本内容 (前200字符): {html_preview[:200]}")
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            comics = []
            
            # 获取漫画列表
            comic_items = soup.select('ul.mh-list > li')
            print(f"[调试] 找到 ul.mh-list > li: {len(comic_items)} 个")
            
            # 如果第一个选择器没找到，尝试其他可能的选择器
            if not comic_items:
                comic_items = soup.select('body > div:nth-child(4) > ul > li')
                print(f"[调试] 备选选择器找到: {len(comic_items)} 个")
            
            # 再试试其他选择器
            if not comic_items:
                all_ul = soup.select('ul')
                print(f"[调试] 页面中所有ul标签: {len(all_ul)} 个")
                all_li = soup.select('li')
                print(f"[调试] 页面中所有li标签: {len(all_li)} 个")
            
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
            title_elem = soup.select_one('body > div.detail-info-1 > div > div > p.detail-info-title')
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
            rating_elem = soup.select_one('p.detail-info-stars')
            rating = ''
            if rating_elem:
                rating_text = rating_elem.get_text(strip=True)
                # 提取评分中的数字并转换为float
                rating_match = re.search(r'[\d\.]+', rating_text)
                rating = float(rating_match.group(0)) if rating_match else 0.0
            
            # 获取作者
            author_elem = soup.select_one('p.detail-info-tip > span:nth-child(1)')
            author = ''
            if author_elem:
                # 提取所有作者链接
                author_links = author_elem.select('a')
                if author_links:
                    authors = [a.get_text(strip=True) for a in author_links]
                    author = ', '.join(authors)
                else:
                    author = author_elem.get_text(strip=True).replace('作者：', '')
            if not author:
                author = '未知'
            
            # 获取状态
            status_elem = soup.select_one('p.detail-info-tip > span:nth-child(2) > span')
            status = 'ongoing'
            if status_elem:
                status_text = status_elem.get_text(strip=True)
                if '已完結' in status_text or '完结' in status_text or '已完结' in status_text:
                    status = 'completed'
            
            # 获取更新时间和状态
            update_time = ''
            detail_list_title = soup.select_one('div.detail-list-form-title')
            if detail_list_title:
                title_text = detail_list_title.get_text(strip=True)
                # 提取更新时间，格式如 "前天 20:54" 或 "2024-01-01"
                time_match = re.search(r'(\d{4}-\d{2}-\d{2}|\d+天前|前天|昨天)\s*\d{2}:\d{2}', title_text)
                if time_match:
                    update_time = time_match.group(0)
                # 如果没有匹配到，尝试只匹配日期
                elif re.search(r'\d{4}-\d{2}-\d{2}', title_text):
                    date_match = re.search(r'\d{4}-\d{2}-\d{2}', title_text)
                    update_time = date_match.group(0)
                
                # 从这里也可以获取状态信息
                if '連載中' in title_text or '连载中' in title_text:
                    status = 'ongoing'
                elif '已完結' in title_text or '完结' in title_text:
                    status = 'completed'
            
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
            
            # API每次返回当前页的图片URL（通常是2张：当前页和下一页）
            # 需要逐页请求来获取所有图片
            api_url = f'{self.base_url}/{chapter_id}/chapterimage.ashx'
            
            # 设置请求头
            headers = {
                'Accept': '*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Referer': f'{self.base_url}/{chapter_id}/',
                'X-Requested-With': 'XMLHttpRequest',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Priority': 'u=1, i'
            }
            
            # 确保session有必要的Cookie（通过访问章节页面获取）
            print(f"  确保获取必要的Cookie...")
            
            # 逐页获取图片
            for page_num in range(1, total_pages + 1):
                # 构建请求参数
                params = {
                    'cid': cid,
                    'page': str(page_num),
                    'key': '',
                    '_cid': cid,
                    '_mid': mid,
                    '_dt': viewsign_dt,
                    '_sign': viewsign
                }
                
                headers = {
                    'accept': '*/*',
                    'accept-language': 'zh-CN,zh;q=0.9',
                    'priority': 'u=1, i',
                    'referer': f'{self.base_url}/{chapter_id}/',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
                    'x-requested-with': 'XMLHttpRequest'
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
                        try:
                            # 调试：打印原始JS代码
                            if page_num == 1:
                                print(f"  原始JS代码: {response_text[:300]}...")
                            
                            # 执行混淆的JavaScript代码
                            js_code = response_text + '; d;'
                            ctx = execjs.compile(js_code)
                            result = ctx.eval('d')
                            
                            # 从JS代码中提取uk参数
                            uk_value = self.extract_uk_from_tokens(response_text)
                            if page_num == 1:
                                if uk_value:
                                    print(f"  成功提取uk参数: {uk_value[:50]}...")
                                else:
                                    print(f"  未找到uk参数")
                            
                            # 调试：打印JS执行结果
                            if page_num == 1:
                                print(f"  JS执行结果: {result}")
                            
                            # result是一个数组，通常包含2个URL（当前页和下一页）
                            # 我们只取第一个，即当前页的URL
                            if result and isinstance(result, list) and len(result) > 0:
                                img_url = result[0]  # 取第一个URL，即当前页
                                
                                # 调试：打印原始URL
                                if page_num <= 3:
                                    print(f"  第{page_num}页原始URL: {img_url}")
                                
                                if img_url:
                                    # 确保URL是完整的
                                    if not img_url.startswith('http'):
                                        img_url = 'https:' + img_url if img_url.startswith('//') else self.base_url + img_url
                                    
                                    # 如果URL以&uk=结尾且我们有uk值，则补充完整
                                    if uk_value and img_url.endswith('&uk='):
                                        img_url = img_url + uk_value
                                        if page_num <= 3:
                                            print(f"  第{page_num}页补充uk后: {img_url[:100]}...")
                                    
                                    images.append({
                                        'page': page_num,
                                        'url': img_url
                                    })
                                    
                                    # 只打印前3张的URL
                                    if page_num <= 3:
                                        print(f"  第{page_num}页最终URL: {img_url[:100]}...")
                            else:
                                print(f"  第{page_num}页: JavaScript执行结果为空")
                        except Exception as js_error:
                            print(f"  第{page_num}页: JavaScript执行失败 - {js_error}")
                            print(f"  响应内容: {response_text[:200]}")
                except Exception as e:
                    print(f"  第{page_num}页: 请求失败 - {e}")
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
