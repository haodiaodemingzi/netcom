import base64
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode, urljoin, urlparse, parse_qsl, urlunparse

from bs4 import BeautifulSoup

from services.base_ebook_scraper import BaseEbookScraper
from services.source_market import SourceMarket

logger = logging.getLogger(__name__)


class GenericBbsEbookScraper(BaseEbookScraper):
    _source_market = None

    @classmethod
    def _get_source_market(cls):
        if cls._source_market is not None:
            return cls._source_market
        cls._source_market = SourceMarket()
        return cls._source_market

    @classmethod
    def _get_market_source(cls, source_id: str):
        sid = (source_id or '').strip()
        if not sid:
            return None
        market = cls._get_source_market()
        src = market.get_source_by_id(sid)
        return src if isinstance(src, dict) else None

    def __init__(self, source_id: str, proxy_config: Optional[Dict[str, Any]] = None):
        self.source_id = (source_id or '').strip()
        source = self._get_market_source(self.source_id) or {}
        self.enabled = bool(source.get('enabled'))
        base_url = (source.get('base_url') or '').strip()
        site_rules = source.get('site_rules')
        self.source_config = site_rules if isinstance(site_rules, dict) else {}
        super().__init__(base_url, proxy_config)

    def get_categories(self):
        if not self.enabled:
            return {'categories': []}

        category_entry_url = (self.source_config.get('category_entry_url') or '').strip()
        if not category_entry_url:
            logger.error('category_entry_url missing source_id=%s', self.source_id)
            return {'categories': []}

        category_entry_url = self._abs_url(category_entry_url)
        response = self._make_request(category_entry_url)
        if not response:
            logger.error('get_categories request failed source_id=%s url=%s', self.source_id, category_entry_url)
            return {'categories': []}

        soup = BeautifulSoup(response.text, 'html.parser')
        link_selector = (self.source_config.get('category_link_selector') or '').strip()
        if not link_selector:
            logger.error('category_link_selector missing source_id=%s', self.source_id)
            return {'categories': []}

        group = (self.source_config.get('category_group') or '分类').strip()
        categories: List[Dict[str, Any]] = []
        seen = set()

        for a in soup.select(link_selector):
            href = (a.get('href') or '').strip()
            name = (a.get_text(strip=True) or '').strip()
            if not href or not name:
                continue

            url = self._abs_url(href, category_entry_url)
            if not url:
                continue

            cid = self._encode_url_id(url)
            if not cid or cid in seen:
                continue

            seen.add(cid)
            categories.append({'id': cid, 'name': name, 'url': url, 'group': group, 'type': 'normal'})

        return {'categories': categories}

    def get_books_by_category(self, category_id, page=1, limit=20):
        cid = (str(category_id) if category_id is not None else '').strip()
        if not cid:
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

        if not self.enabled:
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

        page = page if isinstance(page, int) and page > 0 else 1
        limit = limit if isinstance(limit, int) and limit > 0 else 20

        category_url = self._decode_url_id(cid)
        if not category_url:
            logger.error('category_id decode failed source_id=%s category_id=%s', self.source_id, cid)
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

        list_url = self._apply_page_param(category_url, page)
        if not list_url:
            logger.error('category paging not supported source_id=%s category_url=%s page=%s', self.source_id, category_url, page)
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

        response = self._make_request(list_url)
        if not response:
            logger.error('get_books_by_category request failed source_id=%s url=%s', self.source_id, list_url)
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

        soup = BeautifulSoup(response.text, 'html.parser')
        thread_selector = (self.source_config.get('thread_link_selector') or '').strip()
        if not thread_selector:
            logger.error('thread_link_selector missing source_id=%s', self.source_id)
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

        books: List[Dict[str, Any]] = []
        seen = set()

        for a in soup.select(thread_selector):
            href = (a.get('href') or '').strip()
            title = (a.get_text(strip=True) or '').strip()
            if not href or not title:
                continue

            url = self._abs_url(href, list_url)
            if not url:
                continue

            bid = self._encode_url_id(url)
            if not bid or bid in seen:
                continue

            seen.add(bid)
            books.append({'id': bid, 'title': title, 'author': '', 'description': '', 'cover': '', 'url': url, 'categoryId': cid})

        has_more = self._has_next_page(soup)
        if not has_more:
            has_more = len(books) >= limit

        total = 0
        if has_more:
            total = page * limit + 1

        return {'books': books[:limit], 'total': total, 'page': page, 'totalPages': page + 1 if has_more else page, 'hasMore': has_more}

    def get_book_detail(self, book_id):
        bid = (str(book_id) if book_id is not None else '').strip()
        if not bid:
            return None

        if not self.enabled:
            return None

        thread_url = self._decode_url_id(bid)
        if not thread_url:
            logger.error('book_id decode failed source_id=%s book_id=%s', self.source_id, bid)
            return None

        response = self._make_request(thread_url)
        if not response:
            logger.error('get_book_detail request failed source_id=%s url=%s', self.source_id, thread_url)
            return None

        soup = BeautifulSoup(response.text, 'html.parser')
        title = self._extract_text_by_selector(soup, self.source_config.get('thread_title_selector'))
        if not title:
            title = (soup.title.get_text(strip=True) if soup.title else '').strip()

        content = self._extract_text_by_selector(soup, self.source_config.get('thread_content_selector'), preserve_newlines=True)
        if not content:
            logger.error('thread_content empty source_id=%s url=%s', self.source_id, thread_url)
            return None

        chapters = self._discover_chapters(soup, bid, thread_url, title)

        return {
            'id': bid,
            'title': title,
            'author': '',
            'description': '',
            'cover': '',
            'url': thread_url,
            'chapters': chapters,
            'totalChapters': len(chapters),
            'firstChapterContent': content,
        }

    def get_chapters(self, book_id):
        detail = self.get_book_detail(book_id)
        if not detail:
            return {'chapters': [], 'total': 0}

        chapters = detail.get('chapters', [])
        return {'chapters': chapters, 'total': len(chapters)}

    def get_chapter_content(self, chapter_id):
        cid = (str(chapter_id) if chapter_id is not None else '').strip()
        if not cid:
            return None

        if not self.enabled:
            return None

        url = self._decode_url_id(cid)
        if not url:
            logger.error('chapter_id decode failed source_id=%s chapter_id=%s', self.source_id, cid)
            return None

        response = self._make_request(url)
        if not response:
            logger.error('get_chapter_content request failed source_id=%s url=%s', self.source_id, url)
            return None

        soup = BeautifulSoup(response.text, 'html.parser')
        title = self._extract_text_by_selector(soup, self.source_config.get('thread_title_selector'))
        if not title:
            title = (soup.title.get_text(strip=True) if soup.title else '').strip()

        content = self._extract_text_by_selector(soup, self.source_config.get('thread_content_selector'), preserve_newlines=True)
        if not content:
            logger.error('chapter content empty source_id=%s url=%s', self.source_id, url)
            return None

        return {'id': cid, 'title': title, 'content': content, 'url': url}

    def search_books(self, keyword, page=1, limit=20):
        kw = (keyword or '').strip()
        return {'books': [], 'total': 0, 'page': page, 'keyword': kw, 'hasMore': False}

    def _discover_chapters(self, soup: BeautifulSoup, book_id: str, thread_url: str, title: str):
        chapters: List[Dict[str, Any]] = []
        chapters.append({'id': book_id, 'bookId': book_id, 'title': title or '正文', 'url': thread_url, 'order': 1})

        selectors = self.source_config.get('chapter_link_selectors')
        if not isinstance(selectors, list) or not selectors:
            return chapters

        links: List[str] = []
        for sel in selectors:
            if not isinstance(sel, str) or not sel.strip():
                continue
            for a in soup.select(sel.strip()):
                href = (a.get('href') or '').strip()
                if not href:
                    continue
                abs_url = self._abs_url(href, thread_url)
                if abs_url:
                    links.append(abs_url)

        comment_sel = (self.source_config.get('comment_container_selector') or '').strip()
        if comment_sel:
            for container in soup.select(comment_sel):
                for a in container.select('a[href]'):
                    href = (a.get('href') or '').strip()
                    if not href:
                        continue
                    abs_url = self._abs_url(href, thread_url)
                    if abs_url:
                        links.append(abs_url)

        seen = {thread_url}
        order = 1
        for url in links:
            if not url or url in seen:
                continue
            seen.add(url)
            order += 1
            cid = self._encode_url_id(url)
            if not cid:
                continue

            t = ''
            for a in soup.find_all('a'):
                href = (a.get('href') or '').strip()
                abs_href = self._abs_url(href, thread_url)
                if abs_href == url:
                    t = (a.get_text(strip=True) or '').strip()
                    break

            chapters.append({'id': cid, 'bookId': book_id, 'title': t or '章节', 'url': url, 'order': order})

        return chapters

    def _has_next_page(self, soup: BeautifulSoup):
        sel = (self.source_config.get('next_page_selector') or '').strip()
        if not sel:
            return False
        return bool(soup.select_one(sel))

    def _apply_page_param(self, url: str, page: int):
        if page <= 1:
            return url

        page_param = (self.source_config.get('page_param') or '').strip()
        if not page_param:
            return ''

        parsed = urlparse(url)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query[page_param] = str(page)
        new_query = urlencode(query, doseq=True)
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))

    def _abs_url(self, href: str, base: str = ''):
        h = (href or '').strip()
        if not h:
            return ''

        if h.startswith('http://') or h.startswith('https://'):
            return h

        base_url = (base or self.base_url or '').strip()
        if not base_url:
            return ''

        return urljoin(base_url, h)

    def _encode_url_id(self, url: str):
        u = (url or '').strip()
        if not u:
            return ''

        raw = u.encode('utf-8')
        encoded = base64.urlsafe_b64encode(raw).decode('ascii')
        return encoded.rstrip('=')

    def _decode_url_id(self, encoded_id: str):
        eid = (encoded_id or '').strip()
        if not eid:
            return ''

        padding = '=' * (-len(eid) % 4)
        try:
            raw = base64.urlsafe_b64decode((eid + padding).encode('ascii'))
            return raw.decode('utf-8')
        except Exception as e:
            logger.error('decode_url_id failed source_id=%s encoded_id=%s err=%s', self.source_id, eid, str(e))
            return ''

    def _extract_text_by_selector(self, soup: BeautifulSoup, selector: Any, preserve_newlines: bool = False):
        sel = (selector or '').strip() if isinstance(selector, str) else ''
        if not sel:
            return ''

        node = soup.select_one(sel)
        if not node:
            return ''

        separator = '\n\n' if preserve_newlines else ' '
        return (node.get_text(separator=separator, strip=True) or '').strip()


