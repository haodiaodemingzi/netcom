# -*- coding: utf-8 -*-
"""
包子漫画采集源
网站: www.baozimh.com
"""

import re
import logging
from urllib.parse import quote, urljoin
from bs4 import BeautifulSoup
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class BaozimhScraper(BaseScraper):
    """包子漫画爬虫"""
    
    def __init__(self, proxy_config=None):
        super().__init__('https://www.baozimh.com', proxy_config)
        logger.info("初始化包子漫画爬虫")
        
        # 更新headers
        self.session.headers.update({
            'Referer': self.base_url,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        })
        
        # 分类映射
        self.type_categories = [
            {'id': 'lianai', 'name': '恋爱'},
            {'id': 'chunai', 'name': '纯爱'},
            {'id': 'gufeng', 'name': '古风'},
            {'id': 'yineng', 'name': '异能'},
            {'id': 'xuanyi', 'name': '悬疑'},
            {'id': 'juqing', 'name': '剧情'},
            {'id': 'kehuan', 'name': '科幻'},
            {'id': 'qihuan', 'name': '奇幻'},
            {'id': 'xuanhuan', 'name': '玄幻'},
            {'id': 'chuanyue', 'name': '穿越'},
            {'id': 'mouxian', 'name': '冒险'},
            {'id': 'tuili', 'name': '推理'},
            {'id': 'wuxia', 'name': '武侠'},
            {'id': 'gedou', 'name': '格斗'},
            {'id': 'zhanzheng', 'name': '战争'},
            {'id': 'rexie', 'name': '热血'},
            {'id': 'gaoxiao', 'name': '搞笑'},
            {'id': 'danuzhu', 'name': '大女主'},
            {'id': 'dushi', 'name': '都市'},
            {'id': 'zongcai', 'name': '总裁'},
            {'id': 'hougong', 'name': '后宫'},
            {'id': 'richang', 'name': '日常'},
            {'id': 'hanman', 'name': '韩漫'},
            {'id': 'shaonian', 'name': '少年'},
            {'id': 'qita', 'name': '其它'},
        ]
        
        # 地区分类
        self.region_categories = [
            {'id': 'cn', 'name': '国漫'},
            {'id': 'jp', 'name': '日本'},
            {'id': 'kr', 'name': '韩国'},
            {'id': 'en', 'name': '欧美'},
        ]
    
    def get_categories(self):
        """获取分类列表"""
        try:
            logger.info("获取包子漫画分类列表")
            
            categories = []
            
            # 添加类型分类
            for cat in self.type_categories:
                categories.append({
                    'id': f"type_{cat['id']}",
                    'name': cat['name'],
                    'url': f"{self.base_url}/classify?type={cat['id']}&region=all&state=all&filter=*"
                })
            
            # 添加地区分类
            for cat in self.region_categories:
                categories.append({
                    'id': f"region_{cat['id']}",
                    'name': cat['name'],
                    'url': f"{self.base_url}/classify?type=all&region={cat['id']}&state=all&filter=*"
                })
            
            logger.info(f"获取到 {len(categories)} 个分类")
            return {
                'categories': categories,
                'total': len(categories)
            }
        except Exception as e:
            logger.error(f"获取分类失败: {e}", exc_info=True)
            return {'categories': [], 'total': 0}
    
    def _extract_title_from_id(self, comic_id):
        """从comic_id中提取漫画标题
        comic_id格式: title-author, 例如:
        - doupocangqiong-zhiyinmankerenxiang -> 斗破苍穹
        - wuliandianfeng-pikapi -> 武炼巅峰
        """
        if not comic_id:
            return ''
        
        # 分割标题和作者部分
        parts = comic_id.split('-')
        if len(parts) >= 1:
            # 第一部分是拼音标题
            title_pinyin = parts[0]
            # 校正格式
            return title_pinyin.replace('_', ' ').title()
        
        return comic_id
    
    def _parse_classify_url(self, category_id):
        """解析分类ID为URL参数"""
        type_val = 'all'
        region_val = 'all'
        
        if category_id.startswith('type_'):
            type_val = category_id.replace('type_', '')
        elif category_id.startswith('region_'):
            region_val = category_id.replace('region_', '')
        
        return type_val, region_val
    
    def _parse_comic_list(self, soup, limit=20):
        """解析漫画列表"""
        comics = []
        
        # 包子漫画的卡片结构: 每个漫画有多个 a 标签
        # 第一个链接通常只包含分类标签，第二个链接包含标题和作者
        comic_links = soup.select('a[href^="/comic/"]')
        
        logger.info(f"找到 {len(comic_links)} 个漫画链接")
        
        # 先按comic_id分组所有链接
        comic_id_links = {}
        for link in comic_links:
            href = link.get('href', '')
            match = re.search(r'/comic/([^/?]+)', href)
            if not match:
                continue
            comic_id = match.group(1)
            
            if comic_id not in comic_id_links:
                comic_id_links[comic_id] = []
            comic_id_links[comic_id].append(link)
        
        # 所有分类标签名称
        type_tags = {cat['name'] for cat in self.type_categories}
        region_tags = {cat['name'] for cat in self.region_categories}
        all_tags = type_tags | region_tags | {'連載中', '已完結', '连载中', '已完结'}
        
        for comic_id, links in comic_id_links.items():
            try:
                cover = ''
                title = ''
                author = ''
                tags = []
                
                # 遍历同一漫画的所有链接，提取最佳信息
                for link in links:
                    # 优先从 aria-label 或 title 属性获取标题（这些是最准确的）
                    if not title:
                        title = link.get('aria-label', '') or link.get('title', '')
                    
                    # 获取封面图片（从 amp-img 或 img 标签获取）
                    if not cover:
                        # 先尝试 amp-img 标签
                        amp_img = link.find('amp-img')
                        if amp_img:
                            cover = amp_img.get('src', '') or amp_img.get('data-src', '')
                        else:
                            # 回退到普通 img 标签
                            img = link.find('img')
                            if img:
                                cover = img.get('src', '') or img.get('data-src', '') or img.get('data-original', '')
                        
                        if cover and cover.startswith('//'):
                            cover = 'https:' + cover
                    
                    # 获取作者（从 comics-card__info 链接的 small.tags 标签获取）
                    if not author:
                        small_tag = link.find('small', class_='tags')
                        if small_tag:
                            author_text = small_tag.get_text(strip=True)
                            # 格式通常是 "原著+作者" 或直接作者名
                            if '+' in author_text:
                                parts = author_text.split('+')
                                author = parts[-1].strip()
                            else:
                                author = author_text
                    
                    # 获取标签
                    if not tags:
                        tag_elems = link.select('.tab') or link.select('.tag')
                        for tag in tag_elems[:3]:
                            tag_text = tag.get_text(strip=True)
                            if tag_text:
                                tags.append(tag_text)
                
                # 如果标题仍然为空或太短，使用comic_id
                if not title or len(title) < 2:
                    title = comic_id.replace('-', ' ').title()
                
                # 如果封面为空，尝试使用默认封面URL格式
                if not cover:
                    cover = f'https://static-tw.baozimh.com/cover/{comic_id}.jpg?w=285&h=375&q=100'
                
                comics.append({
                    'id': comic_id,
                    'title': title,
                    'cover': cover,
                    'author': author,
                    'tags': tags,
                    'source': 'baozimh',
                })
                
                if len(comics) >= limit:
                    break
                    
            except Exception as e:
                logger.debug(f"解析漫画项失败: {e}")
                continue
        
        return comics
    
    def get_comics_by_category(self, category_id, page=1, limit=20):
        """根据分类获取漫画列表"""
        try:
            type_val, region_val = self._parse_classify_url(category_id)
            
            # 包子漫画使用无限滚动，page参数可能需要特殊处理
            url = f'{self.base_url}/classify?type={type_val}&region={region_val}&state=all&filter=*&page={page}'
            
            logger.info(f"请求分类漫画: {url}")
            
            response = self._make_request(url)
            if not response:
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
            logger.error(f"获取分类漫画失败: {e}", exc_info=True)
            return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
    
    def get_hot_comics(self, page=1, limit=20):
        """获取热门漫画"""
        try:
            url = f'{self.base_url}/classify?type=all&region=all&state=all&filter=*'
            logger.info(f"请求热门漫画: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            comics = self._parse_comic_list(soup, limit)
            
            # 根据页码跳过部分漫画
            start = (page - 1) * limit
            end = start + limit
            page_comics = comics[start:end] if start < len(comics) else []
            
            has_more = len(comics) > end
            
            return {
                'comics': page_comics if page_comics else comics[:limit],
                'hasMore': has_more,
                'total': len(comics),
                'page': page,
                'limit': limit
            }
        except Exception as e:
            logger.error(f"获取热门漫画失败: {e}", exc_info=True)
            return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
    
    def get_latest_comics(self, page=1, limit=20):
        """获取最新漫画"""
        try:
            url = f'{self.base_url}/list/new'
            logger.info(f"请求最新漫画: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            comics = self._parse_comic_list(soup, limit * page)
            
            # 分页
            start = (page - 1) * limit
            end = start + limit
            page_comics = comics[start:end] if start < len(comics) else []
            
            has_more = len(comics) > end
            
            return {
                'comics': page_comics,
                'hasMore': has_more,
                'total': len(comics),
                'page': page,
                'limit': limit
            }
        except Exception as e:
            logger.error(f"获取最新漫画失败: {e}", exc_info=True)
            return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
    
    def search_comics(self, keyword, page=1, limit=20):
        """搜索漫画"""
        try:
            # 包子漫画搜索通过直接请求
            encoded_keyword = quote(keyword)
            url = f'{self.base_url}/search?q={encoded_keyword}'
            
            logger.info(f"搜索漫画: {keyword}, URL: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'comics': [], 'hasMore': False, 'total': 0, 'page': page, 'limit': limit}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            comics = self._parse_comic_list(soup, limit)
            
            return {
                'comics': comics,
                'hasMore': len(comics) >= limit,
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
            url = f'{self.base_url}/comic/{comic_id}'
            logger.info(f"请求漫画详情: {url}")
            
            response = self._make_request(url)
            if not response:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 从meta标签提取数据（包子漫画使用Vue.js动态渲染，需要从meta获取）
            # 书名: og:novel:book_name
            title = comic_id
            title_meta = soup.find('meta', {'name': 'og:novel:book_name'})
            if title_meta:
                title = title_meta.get('content', comic_id)
            
            # 作者: og:novel:author
            author = ''
            author_meta = soup.find('meta', {'name': 'og:novel:author'})
            if author_meta:
                author = author_meta.get('content', '')
            
            # 封面: og:image
            cover = ''
            cover_meta = soup.find('meta', {'name': 'og:image'})
            if cover_meta:
                cover = cover_meta.get('content', '')
                if cover.startswith('//'):
                    cover = 'https:' + cover
            
            # 描述: description meta
            description = ''
            desc_meta = soup.find('meta', {'name': 'description'})
            if desc_meta:
                description = desc_meta.get('content', '')
            
            # 状态: og:novel:status
            status = 'ongoing'
            status_meta = soup.find('meta', {'name': 'og:novel:status'})
            if status_meta:
                status_text = status_meta.get('content', '')
                if '完結' in status_text or '完结' in status_text:
                    status = 'completed'
                else:
                    status = 'ongoing'
            
            # 分类/标签: og:novel:category
            tags = []
            cat_meta = soup.find('meta', {'name': 'og:novel:category'})
            if cat_meta:
                cat_text = cat_meta.get('content', '')
                # 格式如 "玄幻,types.mohuan,types.dongzuo"
                for cat in cat_text.split(','):
                    # 过滤掉types.xxx格式的
                    if not cat.startswith('types.'):
                        tags.append(cat)
            
            # 最新章节: og:novel:latest_chapter_name
            latest_chapter = ''
            latest_meta = soup.find('meta', {'name': 'og:novel:latest_chapter_name'})
            if latest_meta:
                latest_chapter = latest_meta.get('content', '')
            
            # 获取章节数
            chapters = self.get_chapters(comic_id)
            total_chapters = len(chapters.get('chapters', []))
            
            return {
                'id': comic_id,
                'title': title,
                'author': author,
                'cover': cover,
                'description': description,
                'status': status,
                'tags': tags[:5],
                'totalChapters': total_chapters,
                'latestChapter': latest_chapter,
                'source': 'baozimh',
            }
        except Exception as e:
            logger.error(f"获取漫画详情失败: {e}", exc_info=True)
            return None
    
    def get_chapters(self, comic_id):
        """获取章节列表"""
        try:
            url = f'{self.base_url}/comic/{comic_id}'
            logger.info(f"请求章节列表: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'chapters': [], 'total': 0}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            chapters = []
            
            # 查找章节链接 - 包子漫画的章节链接格式
            # /user/page_direct?comic_id=xxx&section_slot=0&chapter_slot=N
            chapter_links = soup.select('a[href*="chapter_slot"]')
            
            if not chapter_links:
                # 备用选择器
                chapter_links = soup.select('.pure-g a[href*="page_direct"]')
            
            logger.info(f"找到 {len(chapter_links)} 个章节链接")
            
            seen_slots = set()
            for link in chapter_links:
                try:
                    href = link.get('href', '')
                    title = link.get_text(strip=True)
                    
                    # 过滤掉非章节链接（如"收藏"、"目录"等）
                    if not title or title in ['收藏', '目录', '上一话', '下一话']:
                        continue
                    
                    # 提取chapter_slot作为章节ID
                    slot_match = re.search(r'chapter_slot=(\d+)', href)
                    if slot_match:
                        slot = slot_match.group(1)
                        
                        # 避免重复
                        if slot in seen_slots:
                            continue
                        seen_slots.add(slot)
                        
                        # 构建章节ID: comic_id_slot
                        chapter_id = f"{comic_id}_{slot}"
                        
                        chapters.append({
                            'id': chapter_id,
                            'title': title,
                            'url': href,
                        })
                except Exception as e:
                    logger.debug(f"解析章节失败: {e}")
                    continue
            
            # 按slot排序
            chapters.sort(key=lambda x: int(x['id'].split('_')[-1]))
            
            logger.info(f"解析到 {len(chapters)} 个章节")
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
            # 解析chapter_id: comic_id_slot
            parts = chapter_id.rsplit('_', 1)
            if len(parts) != 2:
                logger.error(f"无效的章节ID: {chapter_id}")
                return {'images': [], 'total': 0}
            
            comic_id, slot = parts
            
            # 使用API或直接请求章节页面
            url = f'{self.base_url}/user/page_direct?comic_id={comic_id}&section_slot=0&chapter_slot={slot}'
            logger.info(f"请求章节图片: {url}")
            
            response = self._make_request(url)
            if not response:
                return {'images': [], 'total': 0}
            
            soup = BeautifulSoup(response.text, 'html.parser')
            images = []
            
            # 查找图片 - 尝试多种选择器
            img_elems = soup.select('.comic-contain img') or \
                       soup.select('.comic-page img') or \
                       soup.select('img[src*="static"]') or \
                       soup.select('img')
            
            logger.info(f"找到 {len(img_elems)} 个图片元素")
            
            for idx, img in enumerate(img_elems):
                src = img.get('src', '') or img.get('data-src', '') or img.get('data-original', '')
                
                # 过滤非漫画图片
                if not src:
                    continue
                if 'logo' in src.lower() or 'icon' in src.lower():
                    continue
                if 'advertisement' in src.lower() or 'ad' in src.lower():
                    continue
                
                # 确保是完整URL
                if src.startswith('//'):
                    src = 'https:' + src
                elif src.startswith('/'):
                    src = urljoin(self.base_url, src)
                
                images.append({
                    'index': idx,
                    'url': src,
                    'width': 0,
                    'height': 0,
                })
            
            logger.info(f"获取到 {len(images)} 张图片")
            return {
                'images': images,
                'total': len(images)
            }
        except Exception as e:
            logger.error(f"获取章节图片失败: {e}", exc_info=True)
            return {'images': [], 'total': 0}
