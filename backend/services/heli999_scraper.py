import logging
import re
from urllib.parse import quote, urljoin, urlparse, parse_qs

from bs4 import BeautifulSoup

from .base_video_scraper import BaseVideoScraper

logger = logging.getLogger(__name__)


class Heli999Scraper(BaseVideoScraper):
    def __init__(self, proxy_config=None):
        super().__init__('https://www.heli999.com', proxy_config)
        self.source_id = 'heli999'
        self.source_name = '河狸影视'
        self.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Referer': f'{self.base_url}/',
        })
        self.session.headers.update(self.headers)

    def get_categories(self):
        return [
            {'id': '1', 'name': '电影'},
            {'id': '2', 'name': '电视剧'},
            {'id': '3', 'name': '综艺'},
            {'id': '4', 'name': '动漫'},
            {'id': '29', 'name': '短剧'},
        ]

    def get_videos_by_category(self, category_id, page=1, limit=20):
        if self._is_blank(category_id):
            return []

        url = self._build_category_url(category_id, page)
        resp = self._make_request(url)
        if not resp:
            url = self._build_category_url_query(category_id, page)
            resp = self._make_request(url)

        if not resp:
            return []

        soup = BeautifulSoup(resp.text, 'html.parser')
        return self._parse_list_page(soup, limit)

    def get_video_detail(self, video_id):
        if self._is_blank(video_id):
            return None

        detail_url = f'{self.base_url}/shipingdetail/{video_id}.html'
        resp = self._make_request(detail_url)
        if not resp:
            return None

        soup = BeautifulSoup(resp.text, 'html.parser')
        title = self._extract_title(soup) or str(video_id)
        cover = self._extract_cover(soup, title)
        description = self._extract_description(soup)
        tags = self._extract_tags(soup)
        year = self._extract_year(soup)
        area = self._extract_area(soup)
        actors = self._extract_people(soup, '主演')

        return {
            'id': str(video_id),
            'title': title,
            'cover': cover,
            'description': description,
            'tags': tags,
            'year': year,
            'area': area,
            'actors': actors,
            'source': self.source_id,
        }

    def get_episodes(self, video_id):
        if self._is_blank(video_id):
            return []

        detail_url = f'{self.base_url}/shipingdetail/{video_id}.html'
        resp = self._make_request(detail_url)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, 'html.parser')
        return self._extract_play_links_as_episodes(str(video_id), soup)

    def get_episode_detail(self, episode_id):
        parsed = self._parse_episode_id(episode_id)
        if not parsed:
            return None

        series_id, sid, nid = parsed
        play_page_url = f'{self.base_url}/shipingplay/{series_id}-{sid}-{nid}.html'

        resp = self._make_request(play_page_url)
        if not resp:
            return None

        video_url = self._extract_video_url_from_play_page(resp.text)
        title = self._extract_title_from_play_html(resp.text)
        episode_title = title or f'第{nid}集'

        return {
            'id': episode_id,
            'seriesId': series_id,
            'title': episode_title,
            'episodeNumber': int(nid) if str(nid).isdigit() else 1,
            'videoUrl': video_url or play_page_url,
            'playUrl': play_page_url,
            'source': self.source_id,
        }

    def search_videos(self, keyword, page=1, limit=20):
        if self._is_blank(keyword):
            return []

        encoded = quote(str(keyword))
        url = f'{self.base_url}/shipingsearch/-------------.html?wd={encoded}&page={int(page)}'
        resp = self._make_request(url)
        if not resp:
            url = f'{self.base_url}/index.php/vod/search.html?wd={encoded}&page={int(page)}'
            resp = self._make_request(url)

        if not resp:
            return []

        soup = BeautifulSoup(resp.text, 'html.parser')
        return self._parse_list_page(soup, limit)

    def _build_category_url(self, category_id, page):
        if int(page) <= 1:
            return f'{self.base_url}/shipingtype/{category_id}.html'
        return f'{self.base_url}/shipingtype/{category_id}-{int(page)}.html'

    def _build_category_url_query(self, category_id, page):
        if int(page) <= 1:
            return f'{self.base_url}/shipingtype/{category_id}.html'
        return f'{self.base_url}/shipingtype/{category_id}.html?page={int(page)}'

    def _parse_list_page(self, soup, limit):
        if not soup:
            return []

        links = soup.find_all('a', href=re.compile(r'/shipingdetail/\d+\.html'))
        videos = []
        seen = set()

        for a in links:
            if len(videos) >= int(limit):
                break

            href = a.get('href', '')
            video_id = self._extract_video_id_from_href(href)
            if self._is_blank(video_id) or video_id in seen:
                continue

            title = self._extract_title_from_link(a)
            if self._is_blank(title):
                continue

            cover = self._extract_cover_from_link(a, title)
            videos.append({
                'id': video_id,
                'title': title,
                'cover': cover,
                'source': self.source_id,
            })
            seen.add(video_id)

        return videos

    def _extract_video_id_from_href(self, href):
        if self._is_blank(href):
            return ''

        match = re.search(r'/shipingdetail/(\d+)\.html', str(href))
        if not match:
            return ''

        return match.group(1)

    def _extract_title_from_link(self, link):
        if not link:
            return ''

        data_name = link.get('data-name', '')
        if not self._is_blank(data_name):
            return str(data_name).strip()

        img = link.find('img')
        if img:
            alt = img.get('alt', '')
            if not self._is_blank(alt):
                return str(alt).strip()

        text = link.get_text(strip=True)
        if not self._is_blank(text):
            return str(text).strip()

        return ''

    def _extract_cover_from_link(self, link, title):
        if not link:
            return self._placeholder_cover(title)

        img = link.find('img')
        if img:
            for key in ['data-src', 'data-original', 'data-echo', 'src']:
                cover = img.get(key, '')
                normalized = self._normalize_url(cover)
                if not self._is_blank(normalized):
                    return normalized

        style = link.get('style', '')
        if not self._is_blank(style):
            match = re.search(r'url\(([^)]+)\)', style)
            if match:
                normalized = self._normalize_url(match.group(1).strip('"\''))
                if not self._is_blank(normalized):
                    return normalized

        return self._placeholder_cover(title)

    def _placeholder_cover(self, title):
        safe_title = quote(str(title)[:20]) if title is not None else ''
        return f'https://via.placeholder.com/200x300?text={safe_title}'

    def _normalize_url(self, url):
        if self._is_blank(url):
            return ''

        value = str(url).strip()
        if value.startswith('//'):
            return 'https:' + value
        if value.startswith('/'):
            return self.base_url + value
        if value.startswith('http://') or value.startswith('https://'):
            return value

        return urljoin(self.base_url + '/', value)

    def _extract_title(self, soup):
        if not soup:
            return ''

        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
            if not self._is_blank(title):
                return title

        meta = soup.find('meta', attrs={'property': 'og:title'})
        if meta:
            title = meta.get('content', '')
            if not self._is_blank(title):
                return str(title).strip()

        return ''

    def _extract_cover(self, soup, title):
        if not soup:
            return self._placeholder_cover(title)

        meta = soup.find('meta', attrs={'property': 'og:image'})
        if meta:
            cover = self._normalize_url(meta.get('content', ''))
            if not self._is_blank(cover):
                return cover

        img = soup.find('img', alt=title) if title else None
        if img:
            cover = self._normalize_url(img.get('data-src', '') or img.get('src', ''))
            if not self._is_blank(cover):
                return cover

        return self._placeholder_cover(title)

    def _extract_description(self, soup):
        if not soup:
            return ''

        meta = soup.find('meta', attrs={'name': 'description'})
        if meta:
            content = meta.get('content', '')
            if not self._is_blank(content):
                return str(content).strip()

        candidates = soup.find_all(['div', 'p'], class_=re.compile(r'desc|content|info', re.IGNORECASE))
        for node in candidates:
            text = node.get_text(' ', strip=True)
            if self._is_blank(text):
                continue
            if '简介' in text or '剧情' in text:
                return text

        return ''

    def _extract_tags(self, soup):
        if not soup:
            return []

        tags = []
        seen = set()

        for a in soup.find_all('a', href=True):
            href = a.get('href', '')
            if self._is_blank(href):
                continue
            if '/shipingtype/' not in href and '/shipingshow/' not in href:
                continue

            text = a.get_text(strip=True)
            if self._is_blank(text) or text in seen:
                continue

            seen.add(text)
            tags.append(text)

            if len(tags) >= 10:
                break

        return tags

    def _extract_year(self, soup):
        if not soup:
            return ''

        text = soup.get_text(' ', strip=True)
        match = re.search(r'\b(19\d{2}|20\d{2})\b', text)
        if not match:
            return ''

        return match.group(1)

    def _extract_area(self, soup):
        if not soup:
            return ''

        for a in soup.find_all('a', href=re.compile(r'/shipingshow/')):
            text = a.get_text(strip=True)
            if self._is_blank(text):
                continue
            if '/' in text or '大陆' in text or '香港' in text or '美国' in text:
                return text

        return ''

    def _extract_people(self, soup, label):
        if not soup or self._is_blank(label):
            return []

        text_nodes = soup.find_all(string=re.compile(rf'{re.escape(label)}：'))
        if not text_nodes:
            return []

        container = text_nodes[0].parent
        if not container:
            return []

        names = []
        seen = set()
        for a in container.find_all('a'):
            name = a.get_text(strip=True)
            if self._is_blank(name) or name in seen:
                continue
            seen.add(name)
            names.append(name)

            if len(names) >= 30:
                break

        return names

    def _extract_play_links_as_episodes(self, series_id, soup):
        if self._is_blank(series_id) or not soup:
            return []

        links = soup.find_all('a', href=re.compile(r'/shipingplay/\d+-\d+-\d+\.html'))
        episodes = []
        seen = set()

        for a in links:
            href = a.get('href', '')
            parsed = self._parse_play_href(href)
            if not parsed:
                continue

            vid, sid, nid = parsed
            if vid != series_id:
                continue

            key = f'{sid}_{nid}'
            if key in seen:
                continue

            seen.add(key)
            title = a.get_text(strip=True) or f'第{nid}集'
            episodes.append({
                'id': f'{series_id}_{sid}_{nid}',
                'seriesId': series_id,
                'title': title,
                'episodeNumber': int(nid) if str(nid).isdigit() else len(episodes) + 1,
                'playUrl': self._normalize_url(href),
                'source': self.source_id,
            })

            if len(episodes) >= 300:
                break

        if episodes:
            return episodes

        fallback = soup.find('a', href=re.compile(rf'/shipingplay/{re.escape(series_id)}-\d+-\d+\.html'))
        if not fallback:
            return []

        href = fallback.get('href', '')
        parsed = self._parse_play_href(href)
        if not parsed:
            return []

        _, sid, nid = parsed
        return [{
            'id': f'{series_id}_{sid}_{nid}',
            'seriesId': series_id,
            'title': '第1集',
            'episodeNumber': 1,
            'playUrl': self._normalize_url(href),
            'source': self.source_id,
        }]

    def _parse_play_href(self, href):
        if self._is_blank(href):
            return None

        match = re.search(r'/shipingplay/(\d+)-(\d+)-(\d+)\.html', str(href))
        if not match:
            return None

        return match.group(1), match.group(2), match.group(3)

    def _parse_episode_id(self, episode_id):
        if self._is_blank(episode_id):
            return None

        parts = str(episode_id).split('_')
        if len(parts) != 3:
            return None

        series_id, sid, nid = parts
        if self._is_blank(series_id) or self._is_blank(sid) or self._is_blank(nid):
            return None

        return series_id, sid, nid

    def _extract_video_url_from_play_page(self, html):
        if self._is_blank(html):
            return None

        iframe_src_list = re.findall(r'<iframe[^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE)
        for iframe_src in iframe_src_list:
            extracted = self._extract_m3u8_url_from_iframe_src(iframe_src)
            if self._is_blank(extracted):
                continue
            return extracted

        m3u8_match = re.search(r'(https?://[^\s"\']+\.m3u8[^\s"\']*)', html)
        if m3u8_match:
            return m3u8_match.group(1)

        return None

    def _extract_m3u8_url_from_iframe_src(self, iframe_src):
        if self._is_blank(iframe_src):
            return None

        normalized = self._normalize_url(iframe_src)
        parsed = urlparse(normalized)
        qs = parse_qs(parsed.query or '')
        url_values = qs.get('url')
        if url_values and url_values[0]:
            return url_values[0]

        return None

    def _extract_title_from_play_html(self, html):
        if self._is_blank(html):
            return ''

        match = re.search(r"var\s+vod_name\s*=\s*'([^']+)'", html)
        if match:
            title = match.group(1).strip()
            if not self._is_blank(title):
                return title

        match = re.search(r'<title>([^<]+)</title>', html, re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            if not self._is_blank(title):
                return title

        return ''

    def _is_blank(self, text):
        if text is None:
            return True
        return not str(text).strip()
