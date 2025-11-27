import re
import json
from bs4 import BeautifulSoup
from .base_scraper import BaseScraper

class Guoman8Scraper(BaseScraper):
    """国漫8采集器 - www.guoman8.cc"""
    
    def __init__(self):
        super().__init__('https://www.guoman8.cc')
        self.headers.update({
            'Referer': self.base_url,
        })

    def get_categories(self):
        """获取分类列表"""
        try:
            response = self._make_request(self.base_url)
            if not response:
                return {'categories': [], 'total': 0}
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # 选择器: body > div.w998.nav-bar.shadow > 
            # div.nav-sub.fl > div > div > div.filter.genre > ul > li
            categories = []
            genre_ul = soup.select_one(
                'div.filter.genre > ul'
            )
            
            if genre_ul:
                li_items = genre_ul.find_all('li')
                for li in li_items:
                    link = li.find('a')
                    if link:
                        href = link.get('href', '')
                        name = link.get_text(strip=True)
                        
                        # 提取分类ID (例如: /list/smid-1)
                        match = re.search(r'smid-(\d+)', href)
                        if match:
                            category_id = match.group(1)
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
            print(f'获取分类失败: {e}')
            return {'categories': [], 'total': 0}

    def get_comics_by_category(self, category_id, page=1, limit=20):
        """根据分类获取漫画列表"""
        try:
            # 构建URL: /list/smid-{category_id}-p-{page}
            if page == 1:
                url = f'{self.base_url}/list/smid-{category_id}'
            else:
                url = f'{self.base_url}/list/smid-{category_id}-p-{page}'
            
            response = self._make_request(url)
            if not response:
                return {'comics': [], 'hasMore': False, 'total': 0}
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # 获取漫画列表: #contList > li
            comics = []
            cont_list = soup.select('#contList > li')
            
            for li in cont_list:
                try:
                    # 获取链接
                    link = li.find('a', class_='bcover')
                    if not link:
                        continue
                    
                    href = link.get('href', '')
                    # 提取漫画ID (例如: /44958/)
                    match = re.search(r'/(\d+)/', href)
                    if not match:
                        continue
                    
                    comic_id = match.group(1)
                    
                    # 获取封面
                    img = link.find('img')
                    cover = img.get('src', '') if img else ''
                    
                    # 获取标题
                    title_elem = li.find('dt')
                    title = title_elem.get_text(strip=True) if title_elem else ''
                    
                    # 获取最新章节
                    latest_elem = li.find('dd', class_='tags')
                    latest_chapter = ''
                    if latest_elem:
                        latest_chapter = latest_elem.get_text(strip=True)
                    
                    comics.append({
                        'id': comic_id,
                        'title': title,
                        'cover': cover if cover.startswith('http') 
                                else self.base_url + cover,
                        'latestChapter': latest_chapter,
                        'status': 'ongoing',
                        'updateTime': '',
                    })
                except Exception as e:
                    print(f'解析漫画项失败: {e}')
                    continue
            
            # 获取分页信息
            has_more = False
            pager = soup.select_one('div.book-list div.pager')
            if pager:
                next_link = pager.find('a', text='下一页')
                has_more = next_link is not None
            
            return {
                'comics': comics,
                'hasMore': has_more,
                'total': len(comics)
            }
        except Exception as e:
            print(f'获取分类漫画失败: {e}')
            return {'comics': [], 'hasMore': False, 'total': 0}

    def get_hot_comics(self, page=1, limit=20):
        """获取热门漫画"""
        # 使用首页推荐作为热门
        return self.get_comics_by_category('1', page, limit)

    def get_latest_comics(self, page=1, limit=20):
        """获取最新漫画"""
        # 使用最新更新分类
        return self.get_comics_by_category('2', page, limit)

    def search_comics(self, keyword, page=1, limit=20):
        """搜索漫画"""
        try:
            # 构建搜索URL
            search_url = f'{self.base_url}/search/{keyword}'
            if page > 1:
                search_url += f'-p-{page}'
            
            response = self._make_request(search_url)
            if not response:
                return {'comics': [], 'hasMore': False, 'total': 0}
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # 解析搜索结果
            comics = []
            cont_list = soup.select('#contList > li')
            
            for li in cont_list:
                try:
                    link = li.find('a', class_='bcover')
                    if not link:
                        continue
                    
                    href = link.get('href', '')
                    match = re.search(r'/(\d+)/', href)
                    if not match:
                        continue
                    
                    comic_id = match.group(1)
                    
                    img = link.find('img')
                    cover = img.get('src', '') if img else ''
                    
                    title_elem = li.find('dt')
                    title = title_elem.get_text(strip=True) if title_elem else ''
                    
                    comics.append({
                        'id': comic_id,
                        'title': title,
                        'cover': cover if cover.startswith('http') 
                                else self.base_url + cover,
                        'latestChapter': '',
                        'status': 'ongoing',
                    })
                except Exception as e:
                    continue
            
            return {
                'comics': comics,
                'hasMore': len(comics) >= limit,
                'total': len(comics)
            }
        except Exception as e:
            print(f'搜索失败: {e}')
            return {'comics': [], 'hasMore': False, 'total': 0}

    def get_comic_detail(self, comic_id):
        """获取漫画详情"""
        try:
            url = f'{self.base_url}/{comic_id}/'
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # 封面: body > div.w998.bc.cf > div.fl.w728 > 
            # div.book-cont.cf > div.book-cover.fl > p > img
            cover_img = soup.select_one(
                'div.book-cover.fl > p > img'
            )
            cover = cover_img.get('src', '') if cover_img else ''
            
            # 标题和介绍: div.book-detail.pr.fr
            detail_div = soup.select_one('div.book-detail.pr.fr')
            
            title = ''
            author = ''
            description = ''
            status = 'ongoing'
            categories = []
            
            if detail_div:
                # 标题
                title_elem = detail_div.find('h1')
                if title_elem:
                    title = title_elem.get_text(strip=True)
                
                # 作者和状态
                info_list = detail_div.find_all('li')
                for li in info_list:
                    text = li.get_text(strip=True)
                    if '作者' in text:
                        author = text.replace('作者:', '').strip()
                    elif '状态' in text:
                        if '完结' in text:
                            status = 'completed'
                    elif '类型' in text or '题材' in text:
                        # 提取分类
                        links = li.find_all('a')
                        categories = [
                            a.get_text(strip=True) for a in links
                        ]
                
                # 简介
                intro_div = detail_div.find('div', class_='intro')
                if intro_div:
                    description = intro_div.get_text(strip=True)
            
            return {
                'id': comic_id,
                'title': title,
                'cover': cover if cover.startswith('http') 
                        else self.base_url + cover,
                'author': author,
                'description': description,
                'status': status,
                'categories': categories,
                'rating': 0,
                'updateTime': '',
            }
        except Exception as e:
            print(f'获取漫画详情失败: {e}')
            return None

    def get_chapters(self, comic_id):
        """获取章节列表"""
        try:
            url = f'{self.base_url}/{comic_id}/'
            response = self._make_request(url)
            if not response:
                return {'chapters': [], 'total': 0}
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # 章节列表: #chpater-list-1 > ul > li
            chapters = []
            chapter_ul = soup.select_one('#chpater-list-1 > ul')
            
            if chapter_ul:
                li_items = chapter_ul.find_all('li')
                for index, li in enumerate(li_items):
                    link = li.find('a')
                    if link:
                        href = link.get('href', '')
                        title = link.get_text(strip=True)
                        
                        # 提取章节ID (例如: /45043/01.html)
                        match = re.search(
                            r'/(\d+)/([^/]+)\.html', 
                            href
                        )
                        if match:
                            chapter_id = f"{match.group(1)}_{match.group(2)}"
                            
                            chapters.append({
                                'id': chapter_id,
                                'title': title,
                                'order': index + 1,
                                'updateTime': '',
                                'isRead': False,
                            })
            
            return {
                'chapters': chapters,
                'total': len(chapters)
            }
        except Exception as e:
            print(f'获取章节列表失败: {e}')
            return {'chapters': [], 'total': 0}

    def get_chapter_images(self, chapter_id):
        """获取章节图片列表"""
        try:
            # 解析chapter_id (格式: 45043_01)
            parts = chapter_id.split('_')
            if len(parts) != 2:
                return {'images': [], 'total': 0}
            
            comic_id, chapter_num = parts
            url = f'{self.base_url}/{comic_id}/{chapter_num}.html'
            
            response = self._make_request(url)
            if not response:
                return {'images': [], 'total': 0}
            
            # 解析JavaScript获取图片数组
            images = self._extract_images_from_js(response.text)
            
            return {
                'images': images,
                'total': len(images)
            }
        except Exception as e:
            print(f'获取章节图片失败: {e}')
            return {'images': [], 'total': 0}

    def _extract_images_from_js(self, html):
        """从JavaScript代码中提取图片URL"""
        try:
            # 查找包含图片数组的JavaScript代码
            # 格式: var s={..., 'B':[图片数组], ...}
            
            # 方法1: 正则提取eval函数中的加密代码
            pattern = r"eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split"
            match = re.search(pattern, html, re.DOTALL)
            
            if match:
                # 这里需要解密JavaScript
                # 简化处理: 直接查找图片URL模式
                img_pattern = r'https?://[^\s\'"]+\.(?:jpg|jpeg|png|gif|webp)'
                img_urls = re.findall(img_pattern, html)
                
                images = []
                for index, url in enumerate(img_urls):
                    images.append({
                        'page': index + 1,
                        'url': url
                    })
                
                return images
            
            # 方法2: 查找直接的图片数组
            # 查找类似 'B':['url1','url2'] 的模式
            array_pattern = r"'B'\s*:\s*\[(.*?)\]"
            array_match = re.search(array_pattern, html, re.DOTALL)
            
            if array_match:
                urls_str = array_match.group(1)
                # 提取所有URL
                url_pattern = r"'(https?://[^']+)'"
                urls = re.findall(url_pattern, urls_str)
                
                images = []
                for index, url in enumerate(urls):
                    images.append({
                        'page': index + 1,
                        'url': url
                    })
                
                return images
            
            return []
        except Exception as e:
            print(f'提取图片URL失败: {e}')
            return []
