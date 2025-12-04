from bs4 import BeautifulSoup
from services.base_ebook_scraper import BaseEbookScraper
import re
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KanuNu8Scraper(BaseEbookScraper):
    """努努书坊(kanunu8.com)爬虫实现"""
    
    def __init__(self, proxy_config=None):
        super().__init__('https://www.kanunu8.com', proxy_config)
        self.category_entry_url = f'{self.base_url}/genres.html'
    
    def get_categories(self):
        """获取所有分类"""
        try:
            logger.info(f"开始获取分类列表: {self.category_entry_url}")
            response = self._make_request(self.category_entry_url)
            if not response:
                return {'categories': []}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            categories = []
            
            # 查找所有 .cat-list 区块
            cat_lists = soup.select('.cat-list')
            logger.info(f"找到 {len(cat_lists)} 个分类区块")
            
            for cat_list in cat_lists:
                # 获取分组名称
                h2 = cat_list.find('h2')
                if not h2:
                    continue
                    
                group_name = h2.get_text(strip=True)
                logger.info(f"处理分组: {group_name}")
                
                # 获取该分组下的所有分类链接
                links = cat_list.select('ul li a')
                for link in links:
                    category_name = link.get_text(strip=True)
                    category_url = link.get('href', '')
                    
                    if not category_url:
                        continue
                    
                    # 处理相对路径
                    if category_url.startswith('/'):
                        category_url = self.base_url + category_url
                    elif not category_url.startswith('http'):
                        category_url = self.base_url + '/' + category_url
                    
                    # 判断是否是作家链接,需要二次抓取
                    if self._is_writer_category(category_url):
                        logger.info(f"  检测到作家分类链接,进行二次抓取: {category_name}")
                        writer_categories = self._fetch_writer_subcategories(category_url, group_name)
                        categories.extend(writer_categories)
                    else:
                        # 生成分类ID(从URL中提取)
                        category_id = self._extract_category_id(category_url)
                        
                        # 只保留有效的分类(数字.html结尾或目录形式)
                        # 跳过 writer, shuping 等非书籍分类
                        if self._is_valid_book_category(category_url):
                            categories.append({
                                'id': category_id,
                                'name': category_name,
                                'url': category_url,
                                'group': group_name,
                                'type': 'normal'
                            })
                            logger.info(f"  - {category_name}: {category_id}")
                        else:
                            logger.info(f"  跳过非书籍分类: {category_name} ({category_url})")
            
            logger.info(f"成功获取 {len(categories)} 个分类")
            return {'categories': categories}
            
        except Exception as e:
            logger.error(f"获取分类列表失败: {str(e)}")
            return {'categories': []}
    
    def _is_writer_category(self, url):
        """判断是否是作家分类链接,需要二次抓取"""
        # 作家入口链接,需要进入后再抓取具体作家
        # 包括: author.html, author1.html, author2.html等, authors.html, /files/15.html
        return (
            '/author' in url and url.endswith('.html') or
            url.endswith('authors.html') or
            '/files/15.html' in url
        )
    
    def _is_valid_book_category(self, url):
        """判断是否是有效的书籍分类"""
        # 有效的书籍分类:
        # 1. 数字.html结尾: /files/7.html, /files/311.html
        # 2. 目录形式: /files/chinese/, /wuxia/, /tuili/
        # 3. 专题: /zt/
        # 无效的分类:
        # - /files/writer/ (作家目录)
        # - /shuping/ (书评)
        # - /files/little/ (短篇,可能没有分页)
        # - love.kanunu8.com (外部站点)
        
        # 跳过外部站点
        if 'love.kanunu8.com' in url:
            return False
        
        # 跳过作家目录
        if '/files/writer/' in url and url.endswith('/'):
            return False
        
        # 跳过书评和短篇
        if '/shuping/' in url or '/files/little/' in url:
            return False
        
        # 数字.html结尾的都是有效分类
        if re.search(r'/\d+\.html$', url):
            return True
        
        # 目录形式的分类
        if url.endswith('/') and ('/files/' in url or '/wuxia/' in url or '/tuili/' in url or '/zt/' in url):
            return True
        
        return False
    
    def _fetch_writer_subcategories(self, writer_url, parent_group):
        """抓取作家分类的子分类"""
        try:
            logger.info(f"    抓取作家子分类: {writer_url}")
            response = self._make_request(writer_url)
            if not response:
                return []
            
            soup = BeautifulSoup(response.text, 'html.parser')
            subcategories = []
            
            # 查找作家列表中的 .cat-list
            cat_lists = soup.select('.cat-list')
            logger.info(f"    找到 {len(cat_lists)} 个作家分组")
            
            for cat_list in cat_lists:
                h2 = cat_list.find('h2')
                if not h2:
                    continue
                
                subgroup_name = h2.get_text(strip=True)
                logger.info(f"    处理作家分组: {subgroup_name}")
                
                # 获取作家链接
                links = cat_list.select('ul li a')
                for link in links:
                    writer_name = link.get_text(strip=True)
                    writer_page_url = link.get('href', '')
                    
                    if not writer_page_url:
                        continue
                    
                    # 处理相对路径
                    if writer_page_url.startswith('/'):
                        writer_page_url = self.base_url + writer_page_url
                    elif not writer_page_url.startswith('http'):
                        writer_page_url = self.base_url + '/' + writer_page_url
                    
                    # 提取作家ID,根据URL路径判断
                    # /files/writer/8236.html -> 8236
                    # /zj/11088.html -> 11088
                    if '/files/writer/' in writer_page_url:
                        match = re.search(r'/files/writer/(\d+)\.html', writer_page_url)
                        if match:
                            writer_id = match.group(1)
                        else:
                            writer_id = self._extract_category_id(writer_page_url)
                    elif '/zj/' in writer_page_url:
                        match = re.search(r'/zj/(\d+)\.html', writer_page_url)
                        if match:
                            writer_id = match.group(1)
                        else:
                            writer_id = self._extract_category_id(writer_page_url)
                    else:
                        # 其他情况,可能又是入口链接,跳过
                        if self._is_writer_category(writer_page_url):
                            logger.info(f"      跳过作家入口链接: {writer_name}")
                            continue
                        writer_id = self._extract_category_id(writer_page_url)
                    
                    subcategories.append({
                        'id': f'writer_{writer_id}',
                        'name': f'{writer_name}',
                        'url': writer_page_url,
                        'originalUrl': writer_page_url,  # 保存原始URL用于构建分页
                        'group': f'{parent_group} - {subgroup_name}',
                        'type': 'writer'
                    })
                    logger.info(f"      - 作家: {writer_name} (ID: writer_{writer_id})")
            
            logger.info(f"    成功获取 {len(subcategories)} 个作家分类")
            return subcategories
            
        except Exception as e:
            logger.error(f"抓取作家子分类失败: {str(e)}")
            return []
    
    def _extract_category_id(self, url):
        """从URL中提取分类ID"""
        # 示例: /files/chinese/ -> chinese
        # 示例: /wuxia/ -> wuxia
        # 示例: /files/7.html -> 7
        match = re.search(r'/([^/]+?)(?:\.html)?/?$', url)
        if match:
            return match.group(1)
        return url.split('/')[-1] or url.split('/')[-2]
    
    def get_books_by_category(self, category_id, page=1, limit=20):
        """根据分类获取书籍列表"""
        try:
            # 构建分类URL
            category_url = self._build_category_url(category_id, page)
            logger.info(f"获取分类书籍: {category_url}")
            
            # 请求分类页面
            response = self._make_request(category_url)
            
            # 如果是作家分类且第一次请求失败,尝试 /zj/ 目录
            if not response and category_id.startswith('writer_'):
                writer_id = category_id.replace('writer_', '')
                if writer_id.isdigit():
                    # 尝试 /zj/ 目录
                    if page == 1:
                        category_url = f'{self.base_url}/zj/{writer_id}.html'
                    else:
                        category_url = f'{self.base_url}/zj/{writer_id}_{page}.html'
                    logger.info(f"尝试 /zj/ 目录: {category_url}")
                    response = self._make_request(category_url)
            
            if not response:
                return {'books': [], 'total': 0, 'page': page, 'hasMore': False}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            books = []
            
            # 查找书籍列表容器
            neirong = soup.select_one('.neirong')
            if not neirong:
                logger.warning("未找到 .neirong 容器")
                return {'books': [], 'total': 0, 'page': page, 'hasMore': False}
            
            # 查找所有书籍表格
            tables = neirong.find_all('table')
            logger.info(f"找到 {len(tables)} 个书籍条目")
            
            for table in tables:
                try:
                    link = table.select_one('a')
                    if not link:
                        continue
                    
                    # 提取书名和作者
                    text = link.get_text(strip=True)
                    book_url = link.get('href', '')
                    
                    # 解析 "作者: 书名" 格式
                    author = ''
                    title = text
                    if ':' in text or '：' in text:
                        parts = re.split(r'[：:]', text, 1)
                        if len(parts) == 2:
                            author = parts[0].strip()
                            title = parts[1].strip()
                    
                    # 处理URL
                    if book_url.startswith('/'):
                        book_url = self.base_url + book_url
                    elif not book_url.startswith('http'):
                        book_url = self.base_url + '/' + book_url
                    
                    # 提取书籍ID
                    book_id = self._extract_book_id(book_url)
                    
                    # 判断书籍类型
                    book_type = 'zt' if '/zt/' in book_url else 'book'
                    
                    books.append({
                        'id': book_id,
                        'title': title,
                        'author': author,
                        'url': book_url,
                        'type': book_type,
                        'categoryId': category_id
                    })
                    
                except Exception as e:
                    logger.error(f"解析书籍条目失败: {str(e)}")
                    continue
            
            # 获取分页信息
            pagination = self._parse_pagination(soup)
            
            logger.info(f"成功获取 {len(books)} 本书籍")
            return {
                'books': books,
                'total': pagination['total'],
                'page': page,
                'totalPages': pagination['totalPages'],
                'hasMore': pagination['hasMore']
            }
            
        except Exception as e:
            logger.error(f"获取分类书籍失败: {str(e)}")
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}
    
    def _build_category_url(self, category_id, page=1):
        """构建分类URL"""
        # 根据category_id构建URL
        # 示例: chinese -> /files/chinese/
        # 示例: wuxia -> /wuxia/
        # 示例: 7 -> /files/7.html
        # 示例: writer_8236 -> /files/writer/8236.html (作家)
        # 示例: writer_308 -> /zj/308.html (作家,zj目录)
        
        # 处理作家分类
        if category_id.startswith('writer_'):
            writer_id = category_id.replace('writer_', '')
            
            # 判断是数字ID还是字母ID
            if writer_id.isdigit():
                # 数字ID,需要判断是在 /files/writer/ 还是 /zj/ 目录
                # 默认尝试 /files/writer/,如果失败会由上层处理
                if page == 1:
                    # 先尝试 /files/writer/
                    return f'{self.base_url}/files/writer/{writer_id}.html'
                else:
                    # 分页格式: /files/writer/8236_2.html
                    return f'{self.base_url}/files/writer/{writer_id}_{page}.html'
            else:
                # 字母ID,如 author, author1 等(这些不应该被请求,因为已经被跳过了)
                if page == 1:
                    return f'{self.base_url}/{writer_id}.html'
                else:
                    return f'{self.base_url}/{writer_id}_{page}.html'
        
        # 处理普通分类
        if page == 1:
            # 第一页
            if category_id.isdigit():
                return f'{self.base_url}/files/{category_id}.html'
            else:
                return f'{self.base_url}/files/{category_id}/'
        else:
            # 其他页
            if category_id.isdigit():
                return f'{self.base_url}/files/{category_id}_{page}.html'
            else:
                return f'{self.base_url}/files/{category_id}/{page}.html'
    
    def _parse_pagination(self, soup):
        """解析分页信息"""
        try:
            book_nav = soup.select_one('.book-nav')
            if not book_nav:
                return {'total': 0, 'totalPages': 1, 'hasMore': False}
            
            # 查找所有页码链接
            page_links = book_nav.find_all('a')
            max_page = 1
            
            for link in page_links:
                text = link.get_text(strip=True)
                href = link.get('href', '')
                
                # 提取页码
                if text.isdigit():
                    max_page = max(max_page, int(text))
                
                # 从末页链接提取总页数
                if '末页' in text:
                    match = re.search(r'/(\d+)\.html', href)
                    if match:
                        max_page = max(max_page, int(match.group(1)))
            
            return {
                'total': max_page * 20,  # 估算总数
                'totalPages': max_page,
                'hasMore': max_page > 1
            }
            
        except Exception as e:
            logger.error(f"解析分页信息失败: {str(e)}")
            return {'total': 0, 'totalPages': 1, 'hasMore': False}
    
    def _extract_book_id(self, url):
        """从URL中提取书籍ID"""
        # 示例: /book2/11009/ -> book2_11009
        # 示例: /book5/changxiangsi/ -> book5_changxiangsi
        # 示例: /zt/zt_11293.html -> zt_11293
        
        if '/zt/' in url:
            # 专题类: /zt/zt_11293.html
            match = re.search(r'/zt/([^/]+)\.html', url)
            if match:
                return match.group(1)
        else:
            # book类: /book5/changxiangsi/ 或 /book3/7781/
            match = re.search(r'/(book\d+)/([^/]+)/?', url)
            if match:
                return f"{match.group(1)}_{match.group(2)}"
        
        # 兜底方案
        return url.split('/')[-2] if url.endswith('/') else url.split('/')[-1].replace('.html', '')
    
    def get_book_detail(self, book_id):
        """获取书籍详情"""
        try:
            # 构建书籍详情URL
            book_url = self._build_book_url(book_id)
            logger.info(f"获取书籍详情: {book_url}")
            
            response = self._make_request(book_url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 提取书名和作者
            title = ''
            author = ''
            
            # 从 .catalog 容器中提取书名和作者
            catalog = soup.select_one('.catalog')
            if catalog:
                # 提取书名: <h1>长相思(全集)</h1>
                h1 = catalog.find('h1')
                if h1:
                    title = h1.get_text(strip=True)
                
                # 提取作者: <div class="info">作者：桐华</div>
                info_div = catalog.select_one('.info')
                if info_div:
                    info_text = info_div.get_text(strip=True)
                    # 解析 "作者：桐华" 格式
                    if '：' in info_text or ':' in info_text:
                        author = re.split(r'[：:]', info_text, 1)[1].strip()
            
            # 如果没找到,尝试从页面标题提取
            if not title:
                page_title = soup.find('title')
                if page_title:
                    title = page_title.get_text(strip=True)
            
            # 获取章节列表
            chapters_data = self._parse_chapters_from_detail(soup, book_id, book_url)
            
            return {
                'id': book_id,
                'title': title,
                'author': author,
                'url': book_url,
                'chapters': chapters_data['chapters'],
                'totalChapters': chapters_data['total']
            }
            
        except Exception as e:
            logger.error(f"获取书籍详情失败: {str(e)}")
            return None
    
    def _build_book_url(self, book_id):
        """构建书籍详情URL"""
        # 书籍详情页面URL格式:
        # /book5/changxiangsi/ (目录形式,无index.html)
        # /book3/7781/ (目录形式)
        # /zt/zt_11293.html (专题形式)
        
        if book_id.startswith('zt_'):
            # 专题类书籍
            return f'{self.base_url}/zt/{book_id}.html'
        elif book_id.startswith('book'):
            # book类书籍: book3_7781 -> /book3/7781/
            parts = book_id.split('_')
            if len(parts) == 2:
                return f'{self.base_url}/{parts[0]}/{parts[1]}/'
            else:
                return f'{self.base_url}/{book_id}/'
        else:
            # 其他格式: changxiangsi -> /book5/changxiangsi/
            # 这种情况需要从原始URL推断,但我们没有保存
            # 暂时返回一个可能的路径
            return f'{self.base_url}/book5/{book_id}/'
    
    def _parse_chapters_from_detail(self, soup, book_id, book_url):
        """从详情页解析章节列表"""
        try:
            chapters = []
            
            # 查找所有章节列表容器: <div class="mulu-list">
            mulu_lists = soup.select('.mulu-list')
            if not mulu_lists:
                logger.warning("未找到章节列表容器")
                return {'chapters': [], 'total': 0}
            
            logger.info(f"找到 {len(mulu_lists)} 个章节分组")
            
            chapter_order = 1
            for mulu_list in mulu_lists:
                # 查找该分组下的所有章节链接
                chapter_links = mulu_list.select('ul li a')
                
                for link in chapter_links:
                    chapter_title = link.get_text(strip=True)
                    chapter_url = link.get('href', '')
                    
                    if not chapter_url:
                        continue
                    
                    # 处理相对路径
                    if chapter_url.startswith('/'):
                        chapter_url = self.base_url + chapter_url
                    elif not chapter_url.startswith('http'):
                        # 相对于书籍详情页的路径,如: 202264.html
                        # book_url: https://www.kanunu8.com/book5/changxiangsi/
                        if book_url.endswith('/'):
                            chapter_url = book_url + chapter_url
                        else:
                            chapter_url = book_url + '/' + chapter_url
                    
                    # 提取章节ID
                    chapter_id = self._extract_chapter_id(chapter_url, book_id)
                    
                    chapters.append({
                        'id': chapter_id,
                        'bookId': book_id,
                        'title': chapter_title,
                        'url': chapter_url,
                        'order': chapter_order
                    })
                    chapter_order += 1
            
            logger.info(f"成功解析 {len(chapters)} 个章节")
            return {'chapters': chapters, 'total': len(chapters)}
            
        except Exception as e:
            logger.error(f"解析章节列表失败: {str(e)}")
            return {'chapters': [], 'total': 0}
    
    def _extract_chapter_id(self, url, book_id):
        """提取章节ID"""
        # 示例: /book2/11009/119534.html -> book2_11009_119534
        match = re.search(r'/(\d+)\.html', url)
        if match:
            return f"{book_id}_{match.group(1)}"
        
        return url.split('/')[-1].replace('.html', '')
    
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
            # 构建章节URL
            chapter_url = self._build_chapter_url(chapter_id)
            logger.info(f"获取章节内容: {chapter_url}")
            
            response = self._make_request(chapter_url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 提取章节标题
            title = ''
            title_elem = soup.find('title')
            if title_elem:
                title = title_elem.get_text(strip=True)
            
            # 使用提供的选择器提取正文容器
            # body > div:nth-child(1) > table:nth-child(5) > tbody > tr > td:nth-child(2) > p
            # 这个选择器指向包含所有段落的容器
            content = ''
            
            # 尝试多种选择器
            # 方法1: 直接选择td容器,然后提取所有p标签
            td_elem = soup.select_one('body > div:nth-child(1) > table:nth-child(5) > tbody > tr > td:nth-child(2)')
            
            if td_elem:
                # 提取该td下的所有p标签,保留原始换行
                paragraphs = td_elem.find_all('p')
                if paragraphs:
                    # 使用get_text(separator='\n')保留br标签的换行
                    # 然后用两个换行符分隔不同的p标签
                    content_parts = []
                    for p in paragraphs:
                        # 保留p标签内的br换行
                        p_text = p.get_text(separator='\n', strip=True)
                        if p_text:
                            content_parts.append(p_text)
                    content = '\n\n'.join(content_parts)
                    logger.info(f"成功提取 {len(paragraphs)} 个段落")
            
            # 如果没找到,尝试其他方法
            if not content:
                # 方法2: 查找所有p标签
                all_p = soup.find_all('p')
                if all_p:
                    content_parts = []
                    for p in all_p:
                        p_text = p.get_text(separator='\n', strip=True)
                        if p_text:
                            content_parts.append(p_text)
                    content = '\n\n'.join(content_parts)
                    logger.info(f"使用备用方法提取 {len(all_p)} 个段落")
            
            return {
                'id': chapter_id,
                'title': title,
                'content': content,
                'url': chapter_url
            }
            
        except Exception as e:
            logger.error(f"获取章节内容失败: {str(e)}")
            return None
    
    def _build_chapter_url(self, chapter_id):
        """构建章节URL"""
        # 示例: book2_11009_119534 -> /book2/11009/119534.html
        parts = chapter_id.split('_')
        if len(parts) >= 3:
            book_folder = parts[0]
            book_num = parts[1]
            chapter_num = parts[2]
            return f'{self.base_url}/{book_folder}/{book_num}/{chapter_num}.html'
        
        return f'{self.base_url}/{chapter_id}.html'
    
    def search_books(self, keyword, page=1, limit=20):
        """搜索书籍"""
        # 努努书坊可能没有搜索功能,这里返回空结果
        logger.warning("努努书坊暂不支持搜索功能")
        return {
            'books': [],
            'total': 0,
            'page': page,
            'keyword': keyword
        }
