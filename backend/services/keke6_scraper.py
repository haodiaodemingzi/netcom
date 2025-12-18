import re
import time
import uuid
import base64
import hmac
import hashlib
import logging
import execjs
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote

from .base_video_scraper import BaseVideoScraper


logger = logging.getLogger(__name__)


class Keke6Scraper(BaseVideoScraper):
    def __init__(self, proxy_config=None):
        super().__init__('https://www.keke6.app', proxy_config)
        self.source_id = 'keke6'
        self.source_name = '可可影视'
        self._api_base = 'https://43.248.102.222:51080'
        self._app_id = 'kkdy'
        self._os = 'pc'
        self._user_channel = 'c1'
        self._hash_key = 'te@9fs#5tbf8#dx7zw8nx'
        self._aes_key = 'ayt5wy5afwmwrpb19k9s3psx3dymyd0n'
        self._aes_iv = 'b3t069ijy7pirw0j'
        self._device_id = str(uuid.uuid4())
        self.headers.update(
            {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': self.base_url + '/',
            }
        )
        self.session.headers.update(self.headers)

    def get_categories(self):
        return [
            {'id': '1', 'name': '电影'},
            {'id': '2', 'name': '连续剧'},
            {'id': '3', 'name': '动漫'},
            {'id': '4', 'name': '综艺纪录'},
            {'id': '6', 'name': '短剧'},
            {'id': 'new', 'name': '今日更新'},
        ]

    def get_videos_by_category(self, category_id, page=1, limit=20):
        safe_category = str(category_id or '').strip()
        safe_page = int(page) if str(page).isdigit() else 1
        safe_limit = int(limit) if str(limit).isdigit() else 20

        url_candidates = self._build_list_urls(safe_category, safe_page)
        for url in url_candidates:
            soup = self._get_soup(url)
            if soup is None:
                continue
            videos = self._parse_video_cards(soup, safe_limit)
            if videos:
                return videos

        return []

    def get_video_detail(self, video_id):
        safe_id = str(video_id or '').strip()
        if not safe_id:
            return None

        url = f'{self.base_url}/detail/{safe_id}.html'
        soup = self._get_soup(url)
        if soup is None:
            return None

        title = self._extract_text(soup.find('h1'))
        if not title:
            title = self._extract_title_from_doc(soup)

        cover = self._extract_og_meta(soup, 'og:image')
        if not cover:
            cover = self._extract_cover_from_page(soup)

        tags = self._extract_tags(soup)
        description = self._extract_description(soup)
        rating = self._extract_rating(soup)

        return {
            'id': safe_id,
            'title': title,
            'cover': cover,
            'rating': rating,
            'tags': tags,
            'description': description,
            'source': self.source_id,
        }

    def get_episodes(self, video_id):
        safe_id = str(video_id or '').strip()
        if not safe_id:
            return []

        url = f'{self.base_url}/detail/{safe_id}.html'
        soup = self._get_soup(url)
        if soup is None:
            return []

        links = soup.find_all('a', href=re.compile(rf'/play/{re.escape(safe_id)}-\d+-\d+\.html'))
        if not links:
            links = soup.find_all('a', href=re.compile(r'/play/\d+-\d+-\d+\.html'))

        episodes = []
        seen = set()
        idx = 0
        for a in links:
            href = a.get('href', '')
            if not href:
                continue
            m = re.search(r'/play/(\d+)-(\d+)-(\d+)\.html', href)
            if not m:
                continue
            vod_id = m.group(1)
            if vod_id != safe_id:
                continue
            line_id = m.group(2)
            episode_real_id = m.group(3)
            eid = f'{vod_id}-{line_id}-{episode_real_id}'
            if eid in seen:
                continue
            seen.add(eid)
            idx += 1
            title = self._extract_text(a)
            if not title:
                title = f'第{idx}集'
            episodes.append(
                {
                    'id': eid,
                    'seriesId': vod_id,
                    'title': title,
                    'episodeNumber': idx,
                    'playUrl': self.base_url + href,
                    'source': self.source_id,
                }
            )

        return episodes

    def get_episode_detail(self, episode_id):
        safe_episode_id = str(episode_id or '').strip()
        if not safe_episode_id:
            return None

        parts = safe_episode_id.split('-')
        if len(parts) != 3:
            return None

        vod_id, line_id, real_episode_id = parts
        play_url = f'{self.base_url}/play/{vod_id}-{line_id}-{real_episode_id}.html'
        soup = self._get_soup(play_url)
        if soup is None:
            return {
                'id': safe_episode_id,
                'seriesId': vod_id,
                'title': safe_episode_id,
                'episodeNumber': 1,
                'videoUrl': None,
                'playUrl': play_url,
                'source': self.source_id,
            }

        title = self._extract_title_from_doc(soup)
        if not title:
            title = safe_episode_id

        video_url = self._extract_m3u8_from_html(str(soup))
        if not video_url:
            video_url = self._try_get_play_url_from_api(vod_id, real_episode_id, soup)

        return {
            'id': safe_episode_id,
            'seriesId': vod_id,
            'title': title,
            'episodeNumber': 1,
            'videoUrl': video_url,
            'playUrl': play_url,
            'source': self.source_id,
        }

    def search_videos(self, keyword, page=1, limit=20):
        safe_keyword = str(keyword or '').strip()
        if not safe_keyword:
            return []

        safe_page = int(page) if str(page).isdigit() else 1
        safe_limit = int(limit) if str(limit).isdigit() else 20

        t_hex = self._aes_encrypt_hex(safe_keyword)
        url_candidates = []
        url_candidates.append(f'{self.base_url}/search?k={quote(safe_keyword)}')
        if t_hex:
            url_candidates.append(f'{self.base_url}/search?t={t_hex}&k={quote(safe_keyword)}')

        if safe_page > 1:
            url_candidates = [u + f'&page={safe_page}' for u in url_candidates]

        for url in url_candidates:
            soup = self._get_soup(url)
            if soup is None:
                continue
            videos = self._parse_video_cards(soup, safe_limit)
            if videos:
                return videos

        return []

    def _build_proxy_url(self, video_url, series_id):
        if not video_url:
            return None
        return (
            f'/api/videos/proxy?url={quote(video_url, safe="")}'
            f'&series_id={quote(str(series_id))}'
            f'&source={quote(self.source_id)}'
        )

    def _build_list_urls(self, category_id, page):
        if category_id == 'new':
            if page > 1:
                return [
                    f'{self.base_url}/label/new-{page}.html',
                    f'{self.base_url}/label/new.html',
                ]
            return [f'{self.base_url}/label/new.html']

        if not category_id.isdigit():
            category_id = '1'

        if page > 1:
            return [
                f'{self.base_url}/channel/{category_id}-{page}.html',
                f'{self.base_url}/channel/{category_id}.html',
            ]
        return [f'{self.base_url}/channel/{category_id}.html']

    def _get_soup(self, url):
        if not url:
            return None

        try:
            self._delay()
            resp = self.session.get(url, timeout=15)
            resp.raise_for_status()
            if resp.encoding is None or resp.encoding.lower() == 'iso-8859-1':
                resp.encoding = resp.apparent_encoding
            return BeautifulSoup(resp.text, 'html.parser')
        except requests.RequestException as e:
            logger.error('keke6 request failed url=%s err=%s', url, e)
            return None

    def _parse_video_cards(self, soup, limit):
        if soup is None:
            return []

        links = soup.find_all('a', href=re.compile(r'/detail/\d+\.html'))
        videos = []
        seen = set()

        for link in links:
            if len(videos) >= limit:
                break

            href = link.get('href', '')
            if not href:
                continue

            m = re.search(r'/detail/(\d+)\.html', href)
            if not m:
                continue

            vid = m.group(1)
            if vid in seen:
                continue
            seen.add(vid)

            parent = link.find_parent(['div', 'li', 'article', 'section']) or link
            title = link.get('title') or self._extract_text(link) or self._extract_text(parent.find(['h3', 'h4']))
            if not title:
                continue

            cover = self._extract_cover_from_container(parent)
            rating = self._extract_rating(parent)
            status_text = self._extract_text(parent)

            videos.append(
                {
                    'id': vid,
                    'title': title,
                    'cover': cover,
                    'rating': rating,
                    'status': status_text,
                    'source': self.source_id,
                }
            )

        return videos

    def _extract_cover_from_container(self, container):
        if not container:
            return ''

        img = container.find('img')
        if img:
            cover = img.get('data-src') or img.get('data-original') or img.get('src')
            return self._normalize_url(cover)

        style_holder = container.find(lambda tag: tag.has_attr('style') and 'url(' in tag.get('style', ''))
        if not style_holder:
            return ''

        style = style_holder.get('style', '')
        m = re.search(r'url\(([^)]+)\)', style)
        if not m:
            return ''

        return self._normalize_url(m.group(1).strip('"\''))

    def _extract_cover_from_page(self, soup):
        if soup is None:
            return ''

        img = soup.find('img')
        if img:
            cover = img.get('data-src') or img.get('data-original') or img.get('src')
            return self._normalize_url(cover)
        return ''

    def _extract_title_from_doc(self, soup):
        if soup is None:
            return ''

        title = self._extract_text(soup.find('title'))
        if not title:
            return ''

        return re.sub(r'[-|｜_].*$', '', title).strip()

    def _extract_rating(self, soup_or_container):
        if soup_or_container is None:
            return None

        text = soup_or_container.get_text(' ', strip=True)
        if not text:
            return None

        m = re.search(r'豆瓣[:：]?\s*([0-9.]+)\s*分', text)
        if not m:
            m = re.search(r'([0-9.]+)\s*分', text)
        if not m:
            return None

        try:
            return float(m.group(1))
        except ValueError:
            return None

    def _extract_tags(self, soup):
        if soup is None:
            return []

        tags = []
        for a in soup.find_all('a', href=re.compile(r'^/show/')):
            t = self._extract_text(a)
            if not t:
                continue
            if t not in tags:
                tags.append(t)
            if len(tags) >= 10:
                break
        return tags

    def _extract_description(self, soup):
        if soup is None:
            return ''

        desc = self._extract_og_meta(soup, 'og:description')
        if desc:
            return desc

        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            content = meta_desc.get('content', '')
            return str(content or '').strip()

        return ''

    def _extract_og_meta(self, soup, prop):
        if soup is None:
            return ''

        m = soup.find('meta', attrs={'property': prop})
        if not m:
            return ''

        return str(m.get('content', '') or '').strip()

    def _extract_text(self, tag):
        if not tag:
            return ''
        return tag.get_text(strip=True)

    def _normalize_url(self, url):
        if not url:
            return ''

        safe = str(url).strip().strip('"\'')
        if safe.startswith('//'):
            return 'https:' + safe
        if safe.startswith('/'):
            return self.base_url + safe
        return safe

    def _extract_m3u8_from_html(self, html):
        if not html:
            return None

        m = re.search(r'https?://[^\s"\']+\.m3u8[^\s"\']*', html)
        if not m:
            return None
        return m.group(0)

    def _try_get_play_url_from_api(self, vod_id, episode_id, soup):
        paths = self._extract_api_paths_from_play_page(soup)
        play_paths = [p for p in paths if 'play' in p.lower()]
        for path in play_paths[:5]:
            data = self._call_api_try_parse('get', path, {'vodId': vod_id, 'episodeId': episode_id})
            url = self._extract_m3u8_from_any(data)
            if url:
                return url
        return None

    def _extract_api_paths_from_play_page(self, soup):
        if soup is None:
            return []

        html = str(soup)
        matches = re.findall(r'/vod/[a-zA-Z0-9]+', html)
        unique = []
        for m in matches:
            if m not in unique:
                unique.append(m)
        return unique

    def _extract_m3u8_from_any(self, obj):
        if obj is None:
            return None

        if isinstance(obj, str):
            return self._extract_m3u8_from_html(obj)

        if isinstance(obj, dict):
            for v in obj.values():
                url = self._extract_m3u8_from_any(v)
                if url:
                    return url
            return None

        if isinstance(obj, list):
            for v in obj:
                url = self._extract_m3u8_from_any(v)
                if url:
                    return url
            return None

        return None

    def _call_api_try_parse(self, method, path, extra_params):
        resp = self._call_api(method, path, extra_params)
        if resp is None:
            return None

        content_type = resp.headers.get('Content-Type', '')
        if 'application/json' in content_type:
            try:
                return resp.json()
            except ValueError:
                return resp.text

        if resp.content:
            decrypted = self._aes_decrypt_bytes(resp.content)
            if decrypted:
                return decrypted

        return resp.text

    def _call_api(self, method, path, extra_params=None):
        safe_path = str(path or '').strip()
        if not safe_path.startswith('/'):
            return None

        params = self._build_base_params()
        if extra_params and isinstance(extra_params, dict):
            for k, v in extra_params.items():
                params[k] = '' if v is None else v

        ts = int(time.time() * 1000)
        query_raw = self._params_to_query_string(params)
        sign = self._sign_request(method, safe_path, query_raw, ts)
        params['ts'] = ts
        params['sign'] = sign

        try:
            self._delay()
            url = self._api_base + safe_path
            return requests.request(method.upper(), url, params=params, timeout=15, verify=False)
        except requests.RequestException as e:
            logger.error('keke6 api request failed url=%s path=%s err=%s', self._api_base, safe_path, e)
            return None

    def _build_base_params(self):
        return {
            'os': self._os,
            'appId': self._app_id,
            'userChannel': self._user_channel,
            'userLevel': 1,
        }

    def _params_to_query_string(self, params):
        if not isinstance(params, dict):
            return ''

        order = ['os', 'appId', 'userChannel', 'userLevel']
        parts = []
        for k in order:
            if k in params:
                parts.append(f'{k}={params[k]}')
        for k, v in params.items():
            if k in order:
                continue
            parts.append(f'{k}={v}')
        return '&'.join(parts)

    def _sign_request(self, method, url, query_raw, ts):
        method_str = str(method or 'get').lower()
        url_str = str(url or '')
        query_str = str(query_raw or '')
        ts_str = str(ts)

        extra = self._build_sign_extra()
        msg = f'{method_str}|{url_str}|{query_str}|{ts_str}|{extra}'
        digest = hmac.new(self._hash_key.encode('utf-8'), msg.encode('utf-8'), hashlib.sha1).hexdigest()
        return digest

    def _build_sign_extra(self):
        package = self._get_top_level_domain(self.base_url)
        return f'appId={self._app_id}&package={package}&deviceId={self._device_id}'

    def _get_top_level_domain(self, url):
        safe = str(url or '')
        safe = safe.replace('https://', '').replace('http://', '')
        safe = safe.split('/')[0]
        parts = [p for p in safe.split('.') if p]
        if len(parts) >= 2:
            return '.'.join(parts[-2:])
        return safe

    def _aes_encrypt_hex(self, plaintext):
        safe = str(plaintext or '')
        try:
            ctx = execjs.compile(
                """
                const crypto = require('crypto')
                function encryptHex(text, key, iv) {
                  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'))
                  cipher.setAutoPadding(true)
                  let out = cipher.update(String(text), 'utf8', 'hex')
                  out += cipher.final('hex')
                  return out
                }
                """
            )
            return ctx.call('encryptHex', safe, 'mwrpb19k9s0n', 'b3t069ijy789000')
        except Exception as e:
            logger.error('keke6 aes encrypt failed err=%s', e)
            return None

    def _aes_decrypt_bytes(self, data_bytes):
        if not data_bytes:
            return None

        try:
            b64 = base64.b64encode(data_bytes).decode('utf-8')
            return self._aes_decrypt_base64(b64)
        except Exception as e:
            logger.error('keke6 base64 encode failed err=%s', e)
            return None

    def _aes_decrypt_base64(self, cipher_b64):
        safe = str(cipher_b64 or '').strip()
        if not safe:
            return None

        try:
            ctx = execjs.compile(
                """
                const crypto = require('crypto')
                function decryptBase64(b64, key, iv) {
                  const buf = Buffer.from(String(b64), 'base64')
                  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'))
                  decipher.setAutoPadding(true)
                  let out = decipher.update(buf)
                  out = Buffer.concat([out, decipher.final()])
                  return out.toString('utf8')
                }
                """
            )
            return ctx.call('decryptBase64', safe, self._aes_key, self._aes_iv)
        except Exception as e:
            logger.error('keke6 aes decrypt failed err=%s', e)
            return None
