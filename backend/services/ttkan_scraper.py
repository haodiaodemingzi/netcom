from bs4 import BeautifulSoup
from services.base_ebook_scraper import BaseEbookScraper
import re
import logging
import json

logger = logging.getLogger(__name__)

class TtkanScraper(BaseEbookScraper):
    """天天看小说(ttkan.co)爬虫实现"""
    
    def __init__(self, proxy_config=None):
        super().__init__('https://cn.ttkan.co', proxy_config)
        self.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://cn.ttkan.co/',
        })
        self.session.headers.update(self.headers)
        
        # 预定义分类列表
        self.categories_list = [
            {'id': 'lianzai', 'name': '连载', 'group': '状态'},
            {'id': 'suixuan', 'name': '随选', 'group': '状态'},
            {'id': 'xuanhuan', 'name': '玄幻', 'group': '类型'},
            {'id': 'dushi', 'name': '都市', 'group': '类型'},
            {'id': 'xianxia', 'name': '仙侠', 'group': '类型'},
            {'id': 'gudaiyanqing', 'name': '言情', 'group': '类型'},
            {'id': 'chuanyuechongsheng', 'name': '穿越', 'group': '类型'},
            {'id': 'youxi', 'name': '游戏', 'group': '类型'},
            {'id': 'kehuan', 'name': '科幻', 'group': '类型'},
            {'id': 'xuanyi', 'name': '悬疑', 'group': '类型'},
            {'id': 'lingyi', 'name': '灵异', 'group': '类型'},
            {'id': 'lishi', 'name': '历史', 'group': '类型'},
            {'id': 'qingchun', 'name': '青春', 'group': '类型'},
            {'id': 'junshi', 'name': '军事', 'group': '类型'},
            {'id': 'jingji', 'name': '竞技', 'group': '类型'},
            {'id': 'yanqing', 'name': '现言', 'group': '类型'},
            {'id': 'qita', 'name': '其它', 'group': '类型'},
        ]
    
    def get_categories(self):
        """获取所有分类"""
        try:
            logger.info("获取分类列表")
            categories = []
            
            for cat in self.categories_list:
                # 为每个大分类添加子分类(按字母排序)
                categories.append({
                    'id': cat['id'],
                    'name': cat['name'],
                    'url': f"{self.base_url}/novel/class/{cat['id']}",
                    'group': cat['group'],
                    'type': 'normal'
                })
                
            logger.info(f"成功获取 {len(categories)} 个分类")
            return {'categories': categories}
            
        except Exception as e:
            logger.error(f"获取分类列表失败: {str(e)}")
            return {'categories': []}
    
    def get_books_by_category(self, category_id, page=1, limit=20):
        """根据分类获取书籍列表"""
        try:
            books = []
            
            # 第2页及以后使用API接口
            if page > 1:
                api_url = f"{self.base_url}/api/nq/amp_novel_list"
                params = {
                    'type': category_id,
                    'filter': '*',
                    'page': page,
                    'limit': limit,
                    'language': 'cn',
                    '__amp_source_origin': self.base_url
                }
                logger.info(f"使用API获取第{page}页: {api_url}")
                
                response = self._make_request(api_url, params=params)
                if not response:
                    return {'books': [], 'total': 0, 'page': page, 'hasMore': False}
                
                try:
                    data = response.json()
                    if isinstance(data, dict) and 'items' in data:
                        items = data.get('items', [])
                        for item in items:
                            books.append(self._parse_api_novel_item(item, category_id))
                    elif isinstance(data, list):
                        for item in data:
                            books.append(self._parse_api_novel_item(item, category_id))
                    
                    # 去重
                    unique_books = {}
                    for book in books:
                        if book and book.get('id') and book['id'] not in unique_books:
                            unique_books[book['id']] = book
                    books = list(unique_books.values())
                    
                    logger.info(f"API返回 {len(books)} 本书籍")
                    return {
                        'books': books,
                        'total': len(books),
                        'page': page,
                        'totalPages': page + 1,
                        'hasMore': len(books) >= limit
                    }
                except Exception as e:
                    logger.error(f"解析API响应失败: {str(e)}")
                    return {'books': [], 'total': 0, 'page': page, 'hasMore': False}
            
            # 第1页使用HTML解析
            category_url = f"{self.base_url}/novel/class/{category_id}"
            logger.info(f"获取分类书籍: {category_url}")
            
            response = self._make_request(category_url)
            if not response:
                return {'books': [], 'total': 0, 'page': page, 'hasMore': False}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找所有包含 novel_cell 的 div (不限制在特定的 pure-g 容器中)
            novel_items = soup.find_all('div', class_=lambda x: x and 'novel_cell' in x)
            logger.info(f"找到 {len(novel_items)} 个小说条目")
            
            for item in novel_items:
                try:
                    # 查找书籍链接 - 可能在 h3 > a 或直接在 a 标签中
                    link = item.find('a', href=re.compile(r'/novel/chapters/'))
                    if not link:
                        continue
                    
                    book_url = link.get('href', '')
                    if not book_url.startswith('http'):
                        book_url = self.base_url + book_url
                    
                    # 提取书籍ID
                    book_id = self._extract_book_id(book_url)
                    if not book_id:
                        logger.debug(f"无法提取书籍ID: {book_url}")
                        continue
                    
                    # 提取书名 - 从 h3 标签或链接文本中获取
                    h3 = item.find('h3')
                    if h3:
                        title = h3.get_text(strip=True)
                    else:
                        title = link.get_text(strip=True)
                    
                    if not title:
                        logger.debug(f"无法提取书名: {book_id}")
                        continue
                    
                    # 构建封面图片URL
                    cover = f"https://static.ttkan.co/cover/{book_id}.jpg?w=75&h=100&q=100"
                    
                    # 提取作者和简介 - 从 ul > li 中提取
                    author = ''
                    description = ''
                    
                    # 查找 ul 标签
                    ul = item.find('ul')
                    if ul:
                        lis = ul.find_all('li', recursive=False)
                        for li in lis:
                            text = li.get_text(strip=True)
                            if '作者：' in text or '作者:' in text:
                                author = text.replace('作者：', '').replace('作者:', '').strip()
                            elif '简介：' in text or '简介:' in text:
                                description = text.replace('简介：', '').replace('简介:', '').strip()
                    
                    books.append({
                        'id': book_id,
                        'title': title,
                        'author': author,
                        'description': description,
                        'cover': cover,
                        'url': book_url,
                        'categoryId': category_id
                    })
                    
                except Exception as e:
                    logger.warning(f"解析书籍条目失败: {str(e)}")
                    continue
            
            # 去重
            unique_books = {}
            for book in books:
                if book['id'] not in unique_books:
                    unique_books[book['id']] = book
            books = list(unique_books.values())
            
            total = len(books)
            logger.info(f"成功获取 {total} 本书籍")
            
            # 检查是否有amp-list (表示有更多页面)
            has_more = bool(soup.find('amp-list'))
            
            return {
                'books': books[:limit],  # 第一页只返回limit数量
                'total': total,
                'page': page,
                'totalPages': page + 1 if has_more else page,
                'hasMore': has_more
            }
            
        except Exception as e:
            logger.error(f"获取分类书籍失败: {str(e)}")
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}
    
    def _extract_book_id(self, url):
        """从URL中提取书籍ID"""
        # 示例: /novel/chapters/wanxiangzhiwang-tiancantudou -> wanxiangzhiwang-tiancantudou
        match = re.search(r'/novel/chapters/([^/]+)', url)
        if match:
            return match.group(1)
        return None
    
    def _parse_api_novel_item(self, item, category_id):
        """解析API返回的小说条目
        API返回JSON格式:
        {
            "id": 173407,
            "name": "书名",
            "description": "简介",
            "type": "gudaiyanqing",
            "author": "作者",
            "novel_id": "nongxideyouxiantianyuan-fengzefangfei",
            "topic_img": "nongxideyouxiantianyuan-fengzefangfei.jpg"
        }
        """
        try:
            if not isinstance(item, dict):
                return None
            
            # 提取novel_id作为书籍ID
            novel_id = item.get('novel_id', '')
            if not novel_id:
                return None
            
            # 构建URL
            book_url = f"{self.base_url}/novel/chapters/{novel_id}"
            
            # 构建封面URL
            topic_img = item.get('topic_img', '')
            cover = ''
            if topic_img:
                cover = f"https://static.ttkan.co/cover/{topic_img}?w=75&h=100&q=100"
            
            return {
                'id': novel_id,
                'title': item.get('name', ''),
                'author': item.get('author', ''),
                'description': item.get('description', ''),
                'cover': cover,
                'url': book_url,
                'categoryId': category_id
            }
            
        except Exception as e:
            logger.debug(f"解析API小说条目失败: {str(e)}")
            return None
    
    def get_book_detail(self, book_id):
        """获取书籍详情"""
        try:
            book_url = f"{self.base_url}/novel/chapters/{book_id}"
            logger.info(f"获取书籍详情: {book_url}")
            
            response = self._make_request(book_url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 提取书名 - 从标题中提取
            title = ''
            title_elem = soup.find('title')
            if title_elem:
                title_text = title_elem.get_text(strip=True)
                # 格式: 《万相之王》 最新章节， 天蚕土豆 作品 - 玄幻小说 - 天天看小说
                match = re.search(r'《([^》]+)》', title_text)
                if match:
                    title = match.group(1)
            
            # 尝试从页面内容获取
            if not title:
                h1 = soup.find('h1')
                if h1:
                    title = h1.get_text(strip=True)
            
            # 提取作者
            author = ''
            page_text = soup.get_text()
            author_match = re.search(r'作者[：:]\s*([^\n]+)', page_text)
            if author_match:
                author = author_match.group(1).strip()
            
            # 提取简介
            description = ''
            desc_match = re.search(r'简介[：:]*\s*(.+?)(?:章节目录|$)', page_text, re.DOTALL)
            if desc_match:
                description = desc_match.group(1).strip()[:500]  # 限制长度
            
            # 提取状态
            status = '连载'
            if '状态：完结' in page_text or '状态：完结' in page_text:
                status = '完结'
            
            # 提取分类
            category = ''
            cat_match = re.search(r'类别[：:]\s*(\w+)', page_text)
            if cat_match:
                category = cat_match.group(1).strip()
            
            # 获取章节列表
            chapters = self._parse_chapters_from_page(soup, book_id)
            
            # 构建封面URL
            cover = f"https://static.ttkan.co/cover/{book_id}.jpg?w=75&h=100&q=100"
            
            return {
                'id': book_id,
                'title': title,
                'author': author,
                'cover': cover,
                'description': description,
                'status': status,
                'category': category,
                'url': book_url,
                'chapters': chapters,
                'totalChapters': len(chapters)
            }
            
        except Exception as e:
            logger.error(f"获取书籍详情失败: {str(e)}")
            return None
    
    def _parse_chapters_from_page(self, soup, book_id):
        """从详情页解析章节列表"""
        try:
            chapters = []
            seen_ids = set()  # 用于去重
            
            # 查找所有章节链接
            # 格式: /novel/pagea/wanxiangzhiwang-tiancantudou_1.html
            chapter_links = soup.find_all('a', href=re.compile(r'/novel/pagea/'))
            
            logger.info(f"找到 {len(chapter_links)} 个章节链接")
            
            order = 0
            for link in chapter_links:
                chapter_title = link.get_text(strip=True)
                chapter_url = link.get('href', '')
                
                if not chapter_url or not chapter_title:
                    continue
                
                # 处理相对路径
                if not chapter_url.startswith('http'):
                    chapter_url = self.base_url + chapter_url
                
                # 提取章节ID
                # /novel/pagea/wanxiangzhiwang-tiancantudou_1.html -> wanxiangzhiwang-tiancantudou_1
                chapter_id = self._extract_chapter_id(chapter_url, book_id)
                
                # 去重: 跳过已存在的章节ID
                if chapter_id in seen_ids:
                    continue
                seen_ids.add(chapter_id)
                
                order += 1
                chapters.append({
                    'id': chapter_id,
                    'bookId': book_id,
                    'title': chapter_title,
                    'url': chapter_url,
                    'order': order
                })
            
            logger.info(f"成功解析 {len(chapters)} 个章节(去重后)")
            return chapters
            
        except Exception as e:
            logger.error(f"解析章节列表失败: {str(e)}")
            return []
    
    def _extract_chapter_id(self, url, book_id):
        """提取章节ID"""
        # /novel/pagea/wanxiangzhiwang-tiancantudou_1.html -> wanxiangzhiwang-tiancantudou_1
        match = re.search(r'/novel/pagea/([^/]+)\.html', url)
        if match:
            return match.group(1)
        
        # 备用方案
        match = re.search(r'_(\d+)\.html', url)
        if match:
            return f"{book_id}_{match.group(1)}"
        
        return f"{book_id}_{url.split('/')[-1].replace('.html', '')}"
    
    def get_chapters(self, book_id):
        """获取章节列表"""
        try:
            book_detail = self.get_book_detail(book_id)
            if not book_detail:
                return {'chapters': [], 'total': 0}
            
            return {
                'chapters': book_detail['chapters'],
                'total': book_detail['totalChapters']
            }
            
        except Exception as e:
            logger.error(f"获取章节列表失败: {str(e)}")
            return {'chapters': [], 'total': 0}
    
    def get_chapter_content(self, chapter_id):
        """获取章节内容"""
        try:
            # 先访问首页获取Cookie
            logger.info("访问首页获取Cookie...")
            home_response = self._make_request(self.base_url)
            if home_response:
                logger.info("成功获取首页Cookie")
            
            # 构建章节URL
            chapter_url = f"{self.base_url}/novel/pagea/{chapter_id}.html"
            logger.info(f"获取章节内容: {chapter_url}")
            
            response = self._make_request(chapter_url)
            if not response:
                logger.error(f"无法获取章节页面: {chapter_url}")
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 提取章节标题
            title = ''
            title_elem = soup.find('title')
            if title_elem:
                title_text = title_elem.get_text(strip=True)
                # 格式: 《万相之王》 第1章 我有三个相宫 - 天天看小说
                match = re.search(r'》\s*(.+?)\s*-\s*天天看', title_text)
                if match:
                    title = match.group(1).strip()
                else:
                    title = title_text
            
            # 移除导航栏等不需要的元素
            for nav in soup.find_all(['nav', 'header', 'footer', 'script', 'style']):
                nav.decompose()
            
            # 移除包含导航链接的区域
            for a in soup.find_all('a'):
                parent = a.parent
                if parent and len(parent.get_text(strip=True)) < 100:
                    parent.decompose()
            
            # 提取正文内容
            content = ''
            
            # 方法1: 查找文章内容区域
            article = soup.find('article')
            if article:
                content = article.get_text(separator='\n\n', strip=True)
            
            # 方法2: 查找包含大量文字的div
            if not content or len(content) < 100:
                all_divs = soup.find_all('div')
                max_text = ''
                for div in all_divs:
                    # 跳过包含导航链接的div
                    if div.find('a', href=re.compile(r'/novel/')):
                        continue
                    text = div.get_text(separator='\n', strip=True)
                    # 过滤掉导航等短文本,找最长的内容块
                    if len(text) > len(max_text) and len(text) > 500:
                        # 排除包含导航关键词的区域
                        if not re.search(r'(上一章|下一章|返回目录|我的书架|繁體){2,}', text):
                            max_text = text
                if max_text:
                    content = max_text
            
            # 方法3: 提取所有p标签的正文
            if not content or len(content) < 100:
                paragraphs = soup.find_all('p')
                content_parts = []
                for p in paragraphs:
                    p_text = p.get_text(strip=True)
                    # 过滤掉短文本和导航
                    if p_text and len(p_text) > 20:
                        if not re.search(r'(上一章|下一章|返回目录|我的书架|天天看小说)', p_text):
                            content_parts.append(p_text)
                if content_parts:
                    content = '\n\n'.join(content_parts)
            
            # 清理内容
            if content:
                # 移除多余的空行
                content = re.sub(r'\n{3,}', '\n\n', content)
                # 移除导航文字和网站名
                content = re.sub(r'(上一章|下一章|返回目录|加入书架|投推荐票|天天看小说|我的书架|繁體|首页)[^\n]*', '', content)
                # 移除章节标题的重复
                content = re.sub(rf'^.*?{re.escape(title)}\s*', '', content, count=2) if title else content
                # 移除开头的书名链接
                content = re.sub(r'^《[^》]+》[^\n]*\n', '', content)
                content = content.strip()
            
            logger.info(f"成功获取章节内容, 长度: {len(content)}")
            
            # 提取书籍ID
            book_id = chapter_id.rsplit('_', 1)[0] if '_' in chapter_id else chapter_id
            
            return {
                'id': chapter_id,
                'bookId': book_id,
                'title': title,
                'content': content,
                'url': chapter_url
            }
            
        except Exception as e:
            logger.error(f"获取章节内容失败: {str(e)}")
            return None
    
    def search_books(self, keyword, page=1, limit=20):
        """搜索书籍 - 使用API接口"""
        try:
            api_url = f"{self.base_url}/api/nq/amp_novel_list"
            params = {
                'type': '*',  # 搜索所有类型
                'filter': keyword,  # 搜索关键词
                'page': page,
                'limit': limit,
                'language': 'cn',
                '__amp_source_origin': self.base_url
            }
            logger.info(f"搜索书籍: {keyword}, 页码: {page}")
            
            response = self._make_request(api_url, params=params)
            if not response:
                logger.warning("搜索请求失败")
                return {'books': [], 'total': 0, 'page': page, 'keyword': keyword, 'hasMore': False}
            
            try:
                data = response.json()
                books = []
                
                # 解析API返回的数据
                if isinstance(data, list):
                    for item in data:
                        book = self._parse_api_novel_item(item, '')
                        if book:
                            books.append(book)
                elif isinstance(data, dict) and 'items' in data:
                    for item in data.get('items', []):
                        book = self._parse_api_novel_item(item, '')
                        if book:
                            books.append(book)
                
                # 去重
                unique_books = {}
                for book in books:
                    if book.get('id') and book['id'] not in unique_books:
                        unique_books[book['id']] = book
                books = list(unique_books.values())
                
                logger.info(f"搜索完成, 找到 {len(books)} 本书籍")
                return {
                    'books': books,
                    'total': len(books),
                    'page': page,
                    'keyword': keyword,
                    'hasMore': len(books) >= limit
                }
                
            except Exception as e:
                logger.error(f"解析搜索结果失败: {str(e)}")
                return {'books': [], 'total': 0, 'page': page, 'keyword': keyword, 'hasMore': False}
            
        except Exception as e:
            logger.error(f"搜索书籍失败: {str(e)}")
            return {'books': [], 'total': 0, 'page': page, 'keyword': keyword, 'hasMore': False}
