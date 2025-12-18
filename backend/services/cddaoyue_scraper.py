from bs4 import BeautifulSoup
from services.base_ebook_scraper import BaseEbookScraper
import logging
import re
from urllib.parse import quote

logger = logging.getLogger(__name__)


class CddaoyueScraper(BaseEbookScraper):
    def __init__(self, proxy_config=None):
        super().__init__('https://www.cddaoyue.cn', proxy_config)
        self.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': f'{self.base_url}/index',
        })
        self.session.headers.update(self.headers)

    def get_categories(self):
        try:
            url = f'{self.base_url}/index/book_list'
            response = self._make_request(url)
            if not response:
                return {'categories': []}

            soup = BeautifulSoup(response.text, 'html.parser')
            categories = self._parse_categories(soup)
            return {'categories': categories}
        except Exception as e:
            logger.error('get_categories failed url=%s error=%s', f'{self.base_url}/index/book_list', str(e))
            return {'categories': []}

    def get_books_by_category(self, category_id, page=1, limit=20):
        if not category_id:
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

        page = page if isinstance(page, int) and page > 0 else 1
        limit = limit if isinstance(limit, int) and limit > 0 else 20

        try:
            url = self._build_category_url(str(category_id), page)
            response = self._make_request(url)
            if not response:
                return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

            soup = BeautifulSoup(response.text, 'html.parser')
            books = self._parse_books_from_list_page(soup, str(category_id))
            total_pages = self._parse_total_pages(soup)
            has_more = total_pages is not None and page < total_pages

            total = 0
            if total_pages is not None:
                total = total_pages * limit

            return {
                'books': books[:limit],
                'total': total,
                'page': page,
                'totalPages': total_pages or page,
                'hasMore': has_more,
            }
        except Exception as e:
            logger.error('get_books_by_category failed category_id=%s page=%s error=%s', str(category_id), page, str(e))
            return {'books': [], 'total': 0, 'page': page, 'hasMore': False}

    def get_book_detail(self, book_id):
        if not book_id:
            return None

        try:
            book_id_str = str(book_id)
            book_url = f'{self.base_url}/book/book_detail/{book_id_str}'
            response = self._make_request(book_url)
            if not response:
                return None

            soup = BeautifulSoup(response.text, 'html.parser')
            title = self._parse_book_title(soup)
            if not title:
                return None

            author = self._parse_book_author(soup)
            description = self._parse_book_description(soup)
            cover = self._parse_book_cover(soup)
            chapters = self._parse_chapters(soup, book_id_str)

            return {
                'id': book_id_str,
                'title': title,
                'author': author,
                'description': description,
                'cover': cover,
                'url': book_url,
                'chapters': chapters,
                'totalChapters': len(chapters),
            }
        except Exception as e:
            logger.error('get_book_detail failed book_id=%s error=%s', str(book_id), str(e))
            return None

    def get_chapters(self, book_id):
        if not book_id:
            return {'chapters': [], 'total': 0}

        try:
            book_detail = self.get_book_detail(book_id)
            if not book_detail:
                return {'chapters': [], 'total': 0}

            return {'chapters': book_detail.get('chapters', []), 'total': book_detail.get('totalChapters', 0)}
        except Exception as e:
            logger.error('get_chapters failed book_id=%s error=%s', str(book_id), str(e))
            return {'chapters': [], 'total': 0}

    def get_chapter_content(self, chapter_id):
        if not chapter_id:
            return None

        try:
            chapter_id_str = str(chapter_id)
            chapter_url = f'{self.base_url}/chapter/book_chapter_detail/{chapter_id_str}'

            response = self._make_request(chapter_url)
            if not response:
                return None

            soup = BeautifulSoup(response.text, 'html.parser')
            title = self._parse_chapter_title(soup)
            content = self._parse_chapter_content(soup)
            if not content:
                return None

            return {
                'id': chapter_id_str,
                'title': title,
                'content': content,
                'url': chapter_url,
            }
        except Exception as e:
            logger.error('get_chapter_content failed chapter_id=%s error=%s', str(chapter_id), str(e))
            return None

    def search_books(self, keyword, page=1, limit=20):
        keyword = keyword or ''
        keyword = keyword.strip()
        if not keyword:
            return {'books': [], 'total': 0, 'page': page, 'keyword': keyword, 'hasMore': False}

        page = page if isinstance(page, int) and page > 0 else 1
        limit = limit if isinstance(limit, int) and limit > 0 else 20
        if page > 1:
            return {'books': [], 'total': 0, 'page': page, 'keyword': keyword, 'hasMore': False}

        try:
            url = f'{self.base_url}/index/get_search_book_list/{quote(keyword)}'
            response = self._make_request(url)
            if not response:
                return {'books': [], 'total': 0, 'page': page, 'keyword': keyword, 'hasMore': False}

            soup = BeautifulSoup(response.text, 'html.parser')
            books = self._parse_books_from_search_page(soup)

            return {
                'books': books[:limit],
                'total': len(books),
                'page': page,
                'keyword': keyword,
                'hasMore': False,
            }
        except Exception as e:
            logger.error('search_books failed keyword=%s error=%s', keyword, str(e))
            return {'books': [], 'total': 0, 'page': page, 'keyword': keyword, 'hasMore': False}

    def _build_category_url(self, category_id, page):
        safe_category_id = category_id if category_id.isdigit() else '0'
        return f'{self.base_url}/index/book_list/{safe_category_id}/0/week_click/0/0/0/{page}'

    def _parse_categories(self, soup):
        if soup is None:
            return []

        categories = []
        seen = set()
        for a in soup.select('a[href*="/index/book_list/"]'):
            href = a.get('href') or ''
            m = re.search(r'/index/book_list/(\d+)/', href)
            if not m:
                continue

            cid = m.group(1)
            name = (a.get_text(strip=True) or '').strip()
            if not name:
                continue

            if cid in seen:
                continue

            seen.add(cid)
            categories.append({
                'id': cid,
                'name': name,
                'url': self._absolute_url(href),
                'group': '分类',
                'type': 'normal',
            })

        return categories

    def _parse_total_pages(self, soup):
        if soup is None:
            return None

        text = soup.get_text(' ', strip=True)
        m = re.search(r'/\s*(\d+)\s*页', text)
        if not m:
            return None

        try:
            pages = int(m.group(1))
            return pages if pages > 0 else None
        except Exception:
            return None

    def _parse_books_from_list_page(self, soup, category_id):
        if soup is None:
            return []

        items = []
        for a in soup.select('a[href*="/book/book_detail/"]'):
            href = a.get('href') or ''
            m = re.search(r'/book/book_detail/(\d+)', href)
            if not m:
                continue

            book_id = m.group(1)
            title = self._parse_book_title_from_anchor(a)
            if not title:
                continue

            parent = a.find_parent(['li', 'div'])
            cover = self._parse_cover_from_container(parent)
            author = self._parse_author_from_container(parent, title)

            items.append({
                'id': book_id,
                'title': title,
                'author': author,
                'description': '',
                'cover': cover,
                'url': self._absolute_url(href),
                'categoryId': category_id,
            })

        unique = {}
        for b in items:
            bid = b.get('id')
            if not bid:
                continue

            existing = unique.get(bid)
            if not existing:
                unique[bid] = b
                continue

            if self._is_better_title(b.get('title', ''), existing.get('title', '')):
                unique[bid] = b

        return list(unique.values())

    def _parse_books_from_search_page(self, soup):
        if soup is None:
            return []

        items = []
        for li in soup.select('li'):
            a = li.select_one('a[href*="/book/book_detail/"]')
            if not a:
                continue

            href = a.get('href') or ''
            m = re.search(r'/book/book_detail/(\d+)', href)
            if not m:
                continue

            book_id = m.group(1)
            title = self._parse_book_title_from_anchor(a)
            if not title:
                continue

            cover = self._parse_cover_from_container(li)
            author = self._parse_author_from_container(li, title)
            desc = ''
            desc_node = li.find(string=True)
            if desc_node:
                desc = ''

            items.append({
                'id': book_id,
                'title': title,
                'author': author,
                'description': desc,
                'cover': cover,
                'url': self._absolute_url(href),
            })

        unique = {}
        for b in items:
            bid = b.get('id')
            if not bid:
                continue

            existing = unique.get(bid)
            if not existing:
                unique[bid] = b
                continue

            if self._is_better_title(b.get('title', ''), existing.get('title', '')):
                unique[bid] = b

        return list(unique.values())

    def _parse_book_title_from_anchor(self, anchor):
        if anchor is None:
            return ''

        raw = (anchor.get_text(' ', strip=True) or '').strip()
        if not raw:
            return ''

        for token in ['人气', '收藏', '点击', '推荐', '月票', '打赏', '催更']:
            if token in raw:
                raw = raw.split(token, 1)[0].strip()
                break

        if not raw:
            return ''

        # 书名一般在最前面
        return raw.split(' ', 1)[0].strip() if ' ' in raw else raw

    def _is_better_title(self, new_title, old_title):
        new_title = (new_title or '').strip()
        old_title = (old_title or '').strip()

        if not new_title:
            return False
        if not old_title:
            return True

        bad_tokens = ['人气', '收藏', '点击', '推荐', '月票', '打赏', '催更']
        new_bad = any(t in new_title for t in bad_tokens)
        old_bad = any(t in old_title for t in bad_tokens)
        if old_bad and not new_bad:
            return True
        if new_bad and not old_bad:
            return False

        return len(new_title) < len(old_title)

    def _parse_cover_from_container(self, container):
        if container is None:
            return ''

        img = container.find('img')
        if not img:
            return ''

        return self._parse_cover(img)

    def _parse_cover(self, img):
        if img is None:
            return ''

        src = img.get('src') or img.get('data-src') or img.get('data-original') or ''
        return self._absolute_url(src)

    def _parse_author_from_container(self, container, title):
        if container is None:
            return ''

        texts = [t.strip() for t in container.stripped_strings if t and t.strip()]
        if not texts:
            return ''

        filtered = []
        for t in texts:
            if t == title:
                continue
            if '人气' in t or '收藏' in t or '点击' in t:
                continue
            if t.startswith('作者'):
                t = t.replace('作者', '').replace(':', '').strip()
            filtered.append(t)

        if not filtered:
            return ''

        return filtered[0]

    def _parse_book_title(self, soup):
        if soup is None:
            return ''

        title_node = soup.select_one('h1')
        if title_node:
            return (title_node.get_text(strip=True) or '').strip()

        meta_title = soup.title.get_text(strip=True) if soup.title else ''
        if meta_title:
            return (meta_title.split('最新章节', 1)[0] or '').strip() or (meta_title.split(' - ', 1)[0] or '').strip()

        return ''

    def _parse_book_author(self, soup):
        if soup is None:
            return ''

        meta_title = soup.title.get_text(strip=True) if soup.title else ''
        m = re.search(r'最新章节\(([^)]+)\)', meta_title)
        if m:
            return (m.group(1) or '').strip()

        return ''

    def _parse_book_description(self, soup):
        if soup is None:
            return ''

        p = soup.find('p')
        if not p:
            return ''

        return (p.get_text(' ', strip=True) or '').strip()

    def _parse_book_cover(self, soup):
        if soup is None:
            return ''

        img = soup.find('img')
        if not img:
            return ''

        return self._parse_cover(img)

    def _parse_chapters(self, soup, book_id):
        if soup is None:
            return []

        chapters = []
        order = 1
        for a in soup.select('a[href*="/chapter/book_chapter_detail/"]'):
            href = a.get('href') or ''
            m = re.search(r'/chapter/book_chapter_detail/(\d+)', href)
            if not m:
                continue

            cid = m.group(1)
            title = (a.get_text(strip=True) or '').strip()
            if not title:
                continue

            chapters.append({
                'id': cid,
                'bookId': book_id,
                'title': title,
                'url': self._absolute_url(href),
                'order': order,
            })
            order += 1

        return chapters

    def _parse_chapter_title(self, soup):
        if soup is None:
            return ''

        meta_title = soup.title.get_text(strip=True) if soup.title else ''
        if meta_title and ' - ' in meta_title:
            return (meta_title.split(' - ')[0] or '').strip()

        return meta_title.strip()

    def _parse_chapter_content(self, soup):
        if soup is None:
            return ''

        best_text = ''
        best_len = 0

        for div in soup.find_all('div'):
            ps = div.find_all('p')
            if not ps:
                continue

            text_parts = []
            for p in ps:
                t = (p.get_text(' ', strip=True) or '').strip()
                if not t:
                    continue

                text_parts.append(t)

            joined = '\n\n'.join(text_parts).strip()
            if len(joined) <= best_len:
                continue

            best_text = joined
            best_len = len(joined)

        if best_text:
            return best_text

        ps = soup.find_all('p')
        if not ps:
            return ''

        text_parts = []
        for p in ps:
            t = (p.get_text(' ', strip=True) or '').strip()
            if not t:
                continue

            text_parts.append(t)

        return '\n\n'.join(text_parts).strip()

    def _absolute_url(self, url):
        url = url or ''
        if not url:
            return ''
        if url.startswith('http://') or url.startswith('https://'):
            return url
        if url.startswith('/'):
            return self.base_url + url
        return self.base_url + '/' + url
