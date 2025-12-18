from bs4 import BeautifulSoup
from services.base_ebook_scraper import BaseEbookScraper
from services.ttkan_scraper import TtkanScraper
import logging
import re

logger = logging.getLogger(__name__)


class YoushuScraper(BaseEbookScraper):
    _SORT_CATEGORY_URL_RE = re.compile(r"^/sort/(\d+)/1\.html$")
    _BOOK_URL_RE = re.compile(r"^/book/(\d+)$")

    def __init__(self, proxy_config=None):
        super().__init__('https://www.youshu.me', proxy_config)
        self._categories_entry_url = f'{self.base_url}/sort/0/1.html'
        self._ttkan = TtkanScraper(proxy_config)
        self._book_id_mapping = {}

    def get_categories(self):
        response = self._make_request(self._categories_entry_url)
        if not response:
            return {'categories': []}

        soup = BeautifulSoup(response.text, 'html.parser')
        category_map = {}

        for a in soup.find_all('a', href=True):
            href = a.get('href')
            if not href:
                continue

            match = self._SORT_CATEGORY_URL_RE.match(href)
            if not match:
                continue

            category_id = match.group(1)
            name = a.get_text(strip=True)
            if not name:
                continue

            category_map[category_id] = {
                'id': category_id,
                'name': name,
                'url': f'{self.base_url}{href}',
                'group': self._get_category_group(category_id),
                'type': 'normal',
            }

        if '0' not in category_map:
            category_map['0'] = {
                'id': '0',
                'name': '全部',
                'url': self._categories_entry_url,
                'group': '全部',
                'type': 'normal',
            }

        categories = list(category_map.values())
        categories.sort(key=lambda x: int(x.get('id', '0')))
        return {'categories': categories}

    def get_books_by_category(self, category_id, page=1, limit=20):
        if not category_id:
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

        page = 1 if not page or page < 1 else page
        limit = 20 if not limit or limit < 1 else limit

        url = f'{self.base_url}/sort/{category_id}/{page}.html'
        response = self._make_request(url)
        if not response:
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

        soup = BeautifulSoup(response.text, 'html.parser')
        books = self._parse_books_from_sort_page(soup, category_id)
        total_pages = self._parse_total_pages_from_sort_page(soup, category_id)

        return {
            'books': books[:limit],
            'total': max(total_pages, 1) * limit,
            'page': page,
            'totalPages': max(total_pages, 1),
            'hasMore': page < total_pages if total_pages else False,
        }

    def get_book_detail(self, book_id):
        if not book_id:
            return None

        meta = self._get_book_metadata(book_id)
        if not meta:
            return None

        title = meta.get('title', '')
        author = meta.get('author', '')
        ttkan_book_id = self._resolve_ttkan_book_id(book_id, title, author)
        if not ttkan_book_id:
            return meta

        ttkan_chapters = self._ttkan.get_chapters(ttkan_book_id)
        raw_chapters = ttkan_chapters.get('chapters', []) if isinstance(ttkan_chapters, dict) else []
        if not raw_chapters:
            return meta

        chapters = []
        for ch in raw_chapters:
            if not isinstance(ch, dict):
                continue
            origin_id = ch.get('id')
            if not origin_id:
                continue

            chapters.append({
                'id': self._encode_chapter_id(book_id, origin_id),
                'bookId': book_id,
                'title': ch.get('title', ''),
                'url': ch.get('url', ''),
                'order': ch.get('order', 0),
            })

        meta['chapters'] = chapters
        meta['totalChapters'] = len(chapters)
        return meta

    def get_chapters(self, book_id):
        if not book_id:
            return {'chapters': [], 'total': 0}

        meta = self._get_book_metadata(book_id)
        if not meta:
            return {'chapters': [], 'total': 0}

        title = meta.get('title', '')
        author = meta.get('author', '')

        ttkan_book_id = self._resolve_ttkan_book_id(book_id, title, author)
        if not ttkan_book_id:
            return {'chapters': [], 'total': 0}

        ttkan_chapters = self._ttkan.get_chapters(ttkan_book_id)
        raw_chapters = ttkan_chapters.get('chapters', []) if isinstance(ttkan_chapters, dict) else []
        if not raw_chapters:
            return {'chapters': [], 'total': 0}

        chapters = []
        for ch in raw_chapters:
            if not isinstance(ch, dict):
                continue
            origin_id = ch.get('id')
            if not origin_id:
                continue

            chapters.append({
                'id': self._encode_chapter_id(book_id, origin_id),
                'bookId': book_id,
                'title': ch.get('title', ''),
                'url': ch.get('url', ''),
                'order': ch.get('order', 0),
            })

        return {'chapters': chapters, 'total': len(chapters)}

    def get_chapter_content(self, chapter_id):
        if not chapter_id:
            return None

        decoded = self._decode_chapter_id(chapter_id)
        if not decoded:
            return None

        youshu_book_id, ttkan_chapter_id = decoded
        content = self._ttkan.get_chapter_content(ttkan_chapter_id)
        if not isinstance(content, dict):
            return None

        content['id'] = chapter_id
        content['bookId'] = youshu_book_id
        return content

    def search_books(self, keyword, page=1, limit=20):
        logger.info('youshu 暂不支持站内搜索 keyword=%s page=%s limit=%s', keyword, page, limit)
        return {
            'books': [],
            'total': 0,
            'page': page,
            'keyword': keyword,
            'hasMore': False,
        }

    def _parse_books_from_sort_page(self, soup, category_id):
        if soup is None:
            return []

        books = []
        seen = set()

        for a in soup.find_all('a', href=True):
            href = a.get('href')
            if not href:
                continue

            match = self._BOOK_URL_RE.match(href)
            if not match:
                continue

            book_id = match.group(1)
            if not book_id or book_id in seen:
                continue

            title = a.get_text(strip=True)
            if not title:
                continue

            seen.add(book_id)
            books.append({
                'id': book_id,
                'title': title,
                'author': '',
                'url': f'{self.base_url}{href}',
                'categoryId': category_id,
            })

        return books

    def _parse_total_pages_from_sort_page(self, soup, category_id):
        if soup is None:
            return 1

        max_page = 1
        page_re = re.compile(rf"^/sort/{re.escape(str(category_id))}/(\d+)\.html$")

        for a in soup.find_all('a', href=True):
            href = a.get('href')
            if not href:
                continue

            match = page_re.match(href)
            if not match:
                continue

            page_str = match.group(1)
            if not page_str or not page_str.isdigit():
                continue

            max_page = max(max_page, int(page_str))

        return max_page

    def _parse_title_from_detail(self, soup):
        if soup is None:
            return ''

        title_tag = soup.find('title')
        if not title_tag:
            return ''

        title_text = title_tag.get_text(strip=True)
        if not title_text:
            return ''

        return title_text.split('-', 1)[0].strip()

    def _parse_author_from_detail(self, soup):
        if soup is None:
            return ''

        author_link = soup.find('a', href=re.compile(r'/modules/article/authorarticle\.php\?author='))
        if not author_link:
            return ''

        return author_link.get_text(strip=True)

    def _parse_description_from_detail(self, soup):
        if soup is None:
            return ''

        text = soup.get_text('\n', strip=True)
        if not text:
            return ''

        match = re.search(r'内容介绍\s*(.+?)\s*作品信息', text, re.DOTALL)
        if not match:
            return ''

        description = match.group(1).strip()
        if len(description) > 800:
            return description[:800]
        return description

    def _parse_read_url_from_detail(self, soup):
        if soup is None:
            return ''

        for a in soup.find_all('a', href=True):
            if a.get_text(strip=True) != '点击阅读':
                continue
            href = a.get('href')
            if not href:
                continue
            if href.startswith('http'):
                return href
            return f'{self.base_url}{href}'

        return ''

    def _parse_rating_from_detail(self, soup):
        if soup is None:
            return ''

        text = soup.get_text('\n', strip=True)
        if not text:
            return ''

        match = re.search(r'优书评分.*?\n([0-9]+\.?[0-9]*)\n', text, re.DOTALL)
        if not match:
            return ''

        return match.group(1).strip()

    def _resolve_ttkan_book_id(self, youshu_book_id, title, author):
        if not youshu_book_id:
            return None

        cached = self._book_id_mapping.get(youshu_book_id)
        if cached:
            return cached

        if not title:
            return None

        candidates = self._ttkan.search_books(title, page=1, limit=10)
        items = candidates.get('books', []) if isinstance(candidates, dict) else []
        if not items:
            return None

        norm_title = self._normalize_title(title)
        norm_author = self._normalize_title(author)

        best = None
        for item in items:
            if not isinstance(item, dict):
                continue

            item_id = item.get('id')
            item_title = item.get('title', '')
            item_author = item.get('author', '')

            if not item_id or not item_title:
                continue

            if self._normalize_title(item_title) == norm_title:
                if not norm_author:
                    best = item_id
                    break
                if self._normalize_title(item_author) == norm_author:
                    best = item_id
                    break
                if best is None:
                    best = item_id

        if not best:
            return None

        self._book_id_mapping[youshu_book_id] = best
        logger.info('youshu 映射完成 youshu_book_id=%s ttkan_book_id=%s', youshu_book_id, best)
        return best

    def _encode_chapter_id(self, youshu_book_id, ttkan_chapter_id):
        if not youshu_book_id or not ttkan_chapter_id:
            return ''
        return f'youshu::{youshu_book_id}::ttkan::{ttkan_chapter_id}'

    def _decode_chapter_id(self, chapter_id):
        if not chapter_id:
            return None

        if not chapter_id.startswith('youshu::'):
            return None

        parts = chapter_id.split('::')
        if len(parts) != 4:
            return None

        if parts[0] != 'youshu' or parts[2] != 'ttkan':
            return None

        if not parts[1] or not parts[3]:
            return None

        return parts[1], parts[3]

    def _get_book_metadata(self, book_id):
        if not book_id:
            return None

        url = f'{self.base_url}/book/{book_id}'
        response = self._make_request(url)
        if not response:
            return None

        soup = BeautifulSoup(response.text, 'html.parser')
        title = self._parse_title_from_detail(soup)
        author = self._parse_author_from_detail(soup)
        description = self._parse_description_from_detail(soup)
        read_url = self._parse_read_url_from_detail(soup)
        rating = self._parse_rating_from_detail(soup)

        return {
            'id': book_id,
            'title': title,
            'author': author,
            'description': description,
            'url': url,
            'readUrl': read_url,
            'rating': rating,
            'chapters': [],
            'totalChapters': 0,
        }

    def _normalize_title(self, text):
        if not text:
            return ''

        return re.sub(r'\s+|[《》\[\]（）()\-—_·,，。.!！?？:："“”\'\u3000]', '', str(text)).lower()

    def _get_category_group(self, category_id):
        if not category_id or not str(category_id).isdigit():
            return '全部'

        cid = int(category_id)
        if cid == 0:
            return '全部'

        if 1 <= cid <= 16:
            return '男频'

        if 17 <= cid <= 27:
            return '女频'

        return '全部'
