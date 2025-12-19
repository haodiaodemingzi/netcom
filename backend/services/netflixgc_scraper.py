import json
import base64
import logging
import re
from urllib.parse import quote, urljoin, unquote

import execjs
from bs4 import BeautifulSoup

from .base_video_scraper import BaseVideoScraper

logger = logging.getLogger(__name__)


class NetflixgcScraper(BaseVideoScraper):
    def __init__(self, proxy_config=None):
        super().__init__("https://www.netflixgc.com", proxy_config)
        self.source_id = "netflixgc"
        self.source_name = "奈飞工厂"
        self._list_api_url = self.base_url + "/index.php/ds_api/vod"
        self.headers.update(
            {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Referer": self.base_url + "/",
            }
        )
        self.session.headers.update(self.headers)
        self._decrypt_ctx = execjs.compile(
            """
            const crypto = require('crypto');
            function decryptAesBase64(cipherText, keyStr, ivStr) {
              if (!cipherText || !keyStr || !ivStr) {
                return null;
              }
              const key = Buffer.from(keyStr, 'utf8');
              const iv = Buffer.from(ivStr, 'utf8');
              const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
              decipher.setAutoPadding(true);
              let decrypted = decipher.update(String(cipherText), 'base64', 'utf8');
              decrypted += decipher.final('utf8');
              return decrypted;
            }
            """
        )

    def get_categories(self):
        return [
            {"id": "1", "name": "电影"},
            {"id": "2", "name": "连续剧"},
            {"id": "24", "name": "纪录片"},
            {"id": "3", "name": "漫剧"},
            {"id": "23", "name": "综艺"},
            {"id": "30", "name": "伦理"},
        ]

    def get_videos_by_category(self, category_id, page=1, limit=20):
        if _is_blank(category_id):
            return []

        api_videos = self._get_videos_by_category_via_api(category_id, page, limit)
        if api_videos is not None:
            return api_videos

        url = self._build_category_url(str(category_id), page)
        resp = self._make_request(url)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        return _parse_video_list(soup, limit, self.source_id, self.base_url)

    def _get_videos_by_category_via_api(self, category_id, page, limit):
        type_id = _safe_int(category_id)
        if not type_id:
            return None

        page_int = _safe_int(page) or 1
        limit_int = _safe_int(limit) or 20

        payload = {
            "type": str(type_id),
            "class": "",
            "area": "",
            "year": "",
            "lang": "",
            "version": "",
            "state": "",
            "letter": "",
            "time": "",
            "level": "0",
            "weekday": "",
            "by": "time",
            "page": str(page_int),
        }

        referer = self._build_category_url(str(type_id), page_int)
        headers = {
            "User-Agent": self.headers.get("User-Agent"),
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": referer,
        }

        self._delay()
        try:
            resp = self.session.post(self._list_api_url, data=payload, headers=headers, timeout=10, verify=True)
            resp.raise_for_status()
            if resp.encoding is None or resp.encoding.lower() == "iso-8859-1":
                resp.encoding = resp.apparent_encoding
        except Exception as e:
            logger.error("netflixgc 分类列表接口请求失败 category_id=%s page=%s url=%s err=%s", category_id, page, self._list_api_url, e)
            return None

        try:
            data = resp.json()
        except Exception as e:
            logger.error("netflixgc 分类列表接口解析失败 category_id=%s page=%s url=%s err=%s", category_id, page, self._list_api_url, e)
            return None

        items = None
        if isinstance(data, dict):
            items = data.get("list")
        if not isinstance(items, list):
            return []

        videos = []
        for it in items:
            if len(videos) >= limit_int:
                break
            if not isinstance(it, dict):
                continue

            vid = it.get("vod_id")
            vid_str = str(vid).strip() if vid is not None else ""
            if _is_blank(vid_str):
                url_value = it.get("url")
                if url_value is not None:
                    m = re.search(r"/detail/(\d+)\.html", str(url_value))
                    if m:
                        vid_str = m.group(1)
            if _is_blank(vid_str):
                continue

            title_value = it.get("vod_name")
            title = str(title_value).strip() if title_value is not None else ""
            if _is_blank(title):
                continue

            cover_value = it.get("vod_pic")
            cover = str(cover_value).strip() if cover_value is not None else ""
            if _is_blank(cover):
                cover = f"https://via.placeholder.com/200x300?text={title}"

            videos.append({"id": vid_str, "title": title, "cover": cover, "source": self.source_id})

        return videos

    def get_video_detail(self, video_id):
        if _is_blank(video_id):
            return None

        url = f"{self.base_url}/detail/{video_id}.html"
        resp = self._make_request(url)
        if not resp:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")
        title = _first_text([soup.find("h1"), soup.find("title")]) or str(video_id)
        cover = _find_cover(soup, title, self.base_url)
        description = _find_description(soup)
        tags = _find_tags(soup)
        year = _find_year(soup)

        return {
            "id": str(video_id),
            "title": title,
            "cover": cover,
            "description": description,
            "tags": tags,
            "year": year,
            "source": self.source_id,
        }

    def get_episodes(self, video_id):
        if _is_blank(video_id):
            return []

        url = f"{self.base_url}/detail/{video_id}.html"
        resp = self._make_request(url)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        links = soup.find_all("a", href=re.compile(r"/play/\d+-\d+-\d+\.html"))
        if not links:
            return []

        source_priority = _source_priority()
        best_by_episode = {}

        for link in links:
            href = link.get("href", "")
            m = re.search(r"/play/(\d+)-(\d+)-(\d+)\.html", href)
            if not m:
                continue

            series_id = m.group(1)
            sid = m.group(2)
            ep_num_raw = m.group(3)
            episode_number = _safe_int(ep_num_raw)
            if not episode_number:
                continue

            cur = best_by_episode.get(episode_number)
            if cur and source_priority.get(cur.get("_sid"), 999) <= source_priority.get(sid, 999):
                continue

            text = link.get_text(strip=True)
            title = text or f"第{episode_number}集"

            best_by_episode[episode_number] = {
                "id": f"{series_id}_{sid}_{episode_number}",
                "seriesId": series_id,
                "title": title,
                "episodeNumber": episode_number,
                "playUrl": self.base_url + href,
                "source": self.source_id,
                "_sid": sid,
            }

        episodes = list(best_by_episode.values())
        episodes.sort(key=lambda x: x.get("episodeNumber") or 0)
        for ep in episodes:
            ep.pop("_sid", None)
        return episodes

    def get_episode_detail(self, episode_id):
        if _is_blank(episode_id):
            return None

        parts = str(episode_id).split("_")
        if len(parts) != 3:
            return None

        series_id, sid, episode_num = parts
        result = self._get_episode_detail_from_source(series_id, sid, episode_num)
        if result and result.get("videoUrl"):
            return result

        for alt_sid in _fallback_source_ids(sid):
            alt = self._get_episode_detail_from_source(series_id, alt_sid, episode_num)
            if alt and alt.get("videoUrl"):
                alt["id"] = f"{series_id}_{alt_sid}_{_safe_int(episode_num) or episode_num}"
                return alt

        return result

    def search_videos(self, keyword, page=1, limit=20):
        if _is_blank(keyword):
            return []

        url = self._build_search_url(keyword, page)
        resp = self._make_request(url)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        return _parse_video_list(soup, limit, self.source_id, self.base_url)

    def _get_episode_detail_from_source(self, series_id, sid, episode_num):
        if _is_blank(series_id) or _is_blank(sid) or _is_blank(episode_num):
            return None

        ep_int = _safe_int(episode_num)
        url = f"{self.base_url}/play/{series_id}-{sid}-{episode_num}.html"
        play_headers = _build_play_headers(series_id, sid, episode_num)
        headers = {
            "User-Agent": self.headers.get("User-Agent"),
            "Referer": f"{self.base_url}/detail/{series_id}.html",
            "Accept": self.headers.get("Accept"),
            "Accept-Language": self.headers.get("Accept-Language"),
        }

        self._delay()
        try:
            resp = self.session.get(url, headers=headers, timeout=10, verify=True)
            resp.raise_for_status()
            if resp.encoding is None or resp.encoding.lower() == "iso-8859-1":
                resp.encoding = resp.apparent_encoding
        except Exception as e:
            logger.error("netflixgc 播放页请求失败 series_id=%s sid=%s episode_num=%s url=%s err=%s", series_id, sid, episode_num, url, e)
            return None

        soup = BeautifulSoup(resp.text, "html.parser")
        player = _extract_player_config(resp.text)
        encrypted_url = player.get("url") if isinstance(player, dict) else None
        if _is_blank(encrypted_url):
            return {
                "id": f"{series_id}_{sid}_{ep_int or episode_num}",
                "seriesId": series_id,
                "title": f"第{ep_int}集" if ep_int else str(episode_num),
                "episodeNumber": ep_int,
                "videoUrl": None,
                "playUrl": url,
                "source": self.source_id,
                "videoHeaders": play_headers,
            }

        decrypted = self._parse_and_decrypt_video_url(encrypted_url, url)
        decrypted = self._resolve_variant_m3u8_url(decrypted)
        title = _extract_episode_title(soup, ep_int)

        return {
            "id": f"{series_id}_{sid}_{ep_int or episode_num}",
            "seriesId": series_id,
            "title": title,
            "episodeNumber": ep_int,
            "videoUrl": decrypted,
            "playUrl": url,
            "source": self.source_id,
            "videoHeaders": play_headers,
        }

    def _resolve_variant_m3u8_url(self, url):
        if _is_blank(url):
            return None

        text_url = str(url).strip()
        if _is_blank(text_url):
            return None

        if '.m3u8' not in text_url.lower() and 'm3u8' not in text_url.lower():
            return text_url

        headers = {
            'User-Agent': self.headers.get('User-Agent'),
            'Accept': '*/*',
        }

        try:
            resp = self.session.get(text_url, headers=headers, timeout=10, verify=True)
            resp.raise_for_status()
            if resp.encoding is None or resp.encoding.lower() == 'iso-8859-1':
                resp.encoding = resp.apparent_encoding
        except Exception as e:
            logger.warning('netflixgc 获取 m3u8 失败 url=%s err=%s', text_url, e)
            return text_url

        body = resp.text or ''
        if '#EXT-X-STREAM-INF' not in body:
            return resp.url or text_url

        best_bw = -1
        best_uri = None
        pending_bw = None
        for raw_line in body.splitlines():
            line = (raw_line or '').strip()
            if not line:
                continue
            if line.startswith('#EXT-X-STREAM-INF'):
                m = re.search(r'BANDWIDTH=(\d+)', line)
                pending_bw = int(m.group(1)) if m else 0
                continue
            if line.startswith('#'):
                continue
            uri = line
            bw = pending_bw if pending_bw is not None else 0
            pending_bw = None
            if bw > best_bw:
                best_bw = bw
                best_uri = uri

        base_url = resp.url or text_url
        if _is_blank(best_uri):
            return base_url

        return urljoin(base_url, best_uri)

    def _parse_and_decrypt_video_url(self, encrypted_url, referer_url):
        if _is_blank(encrypted_url):
            return None

        parse_url = "https://cjbfq.netflixgc.tv/player/ec.php?code=netflix&if=1&url=" + quote(str(encrypted_url), safe="")
        headers = {
            "User-Agent": self.headers.get("User-Agent"),
            "Referer": referer_url,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        self._delay()
        try:
            resp = self.session.get(parse_url, headers=headers, timeout=10, verify=True)
            resp.raise_for_status()
            if resp.encoding is None or resp.encoding.lower() == "iso-8859-1":
                resp.encoding = resp.apparent_encoding
        except Exception as e:
            logger.error("netflixgc 解析页请求失败 url=%s err=%s", parse_url, e)
            return None

        config = _extract_config_from_parser(resp.text)
        if not config:
            return None

        uid = None
        if isinstance(config.get("config"), dict):
            uid = config["config"].get("uid")
        if _is_blank(uid):
            uid = config.get("uid")

        cipher = config.get("url")
        plain = self._decrypt(cipher, uid)
        return _normalize_video_url(plain, "https://cjbfq.netflixgc.tv/")

    def _decrypt(self, cipher_text, uid):
        if _is_blank(cipher_text) or _is_blank(uid):
            return None

        key_str = f"2890{uid}tB959C"
        iv_str = "2F131BE91247866E"
        try:
            plain = self._decrypt_ctx.call("decryptAesBase64", str(cipher_text), key_str, iv_str)
        except Exception as e:
            logger.error("netflixgc 解密失败 uid=%s err=%s", uid, e)
            return None

        if _is_blank(plain):
            return None

        return str(plain).strip()

    def _build_category_url(self, category_id, page):
        page_int = _safe_int(page) or 1
        if page_int <= 1:
            return f"{self.base_url}/vodshow/{category_id}-----------.html"
        return f"{self.base_url}/vodshow/{category_id}-----------{page_int}---.html"

    def _build_search_url(self, keyword, page):
        page_int = _safe_int(page) or 1
        key = quote(str(keyword))
        if page_int <= 1:
            return f"{self.base_url}/vodsearch/{key}-------------.html"
        return f"{self.base_url}/vodsearch/{key}----------{page_int}---.html"


def _extract_player_config(html):
    if _is_blank(html):
        return None

    m = re.search(r"player_aaaa\s*=\s*(\{.*?\})\s*;", html, re.DOTALL)
    if not m:
        m = re.search(r"var\s+player_aaaa\s*=\s*(\{.*?\})\s*;", html, re.DOTALL)

    if not m:
        url_match = re.search(r'"url"\s*:\s*"((?:[^"\\]|\\.)+)"', html)
        if not url_match:
            return None
        return {"url": url_match.group(1).replace("\\/", "/")}

    raw = m.group(1)
    try:
        cleaned = raw.replace("\\/", "/")
        return json.loads(cleaned)
    except Exception:
        url_match = re.search(r'"url"\s*:\s*"((?:[^"\\]|\\.)+)"', raw)
        if not url_match:
            return None
        return {"url": url_match.group(1).replace("\\/", "/")}


def _extract_config_from_parser(html):
    if _is_blank(html):
        return None

    m = re.search(r"let\s+ConFig\s*=\s*(\{.*?\})\s*,\s*box\s*=", html, re.DOTALL)
    if not m:
        m = re.search(r"ConFig\s*=\s*(\{.*?\})\s*,\s*box\s*=", html, re.DOTALL)
    if not m:
        return None

    raw = m.group(1)
    try:
        cleaned = raw.replace("\\/", "/")
        return json.loads(cleaned)
    except Exception as e:
        logger.error("netflixgc 解析 ConFig 失败 err=%s", e)
        return None


def _build_play_headers(series_id, sid, episode_num):
    if _is_blank(series_id):
        return {}
    referer_url = f"https://www.netflixgc.com/play/{series_id}-{sid}-{episode_num}.html"
    return {
        "Referer": referer_url,
        "Origin": "https://www.netflixgc.com",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }


def _normalize_video_url(video_url, base_prefix=None):
    if _is_blank(video_url):
        return None

    raw = str(video_url).strip()
    if _is_blank(raw):
        return None

    raw = raw.replace("\\/", "/").replace("&amp;", "&")

    decoded = None
    if re.fullmatch(r"[A-Za-z0-9_\-+/=]+", raw or "") and len(raw) >= 16:
        padded = raw + ("=" * (-len(raw) % 4))
        for decoder in (base64.b64decode, base64.urlsafe_b64decode):
            try:
                candidate = decoder(padded)
                text = candidate.decode("utf-8", errors="ignore").strip()
                if not _is_blank(text):
                    decoded = text
                    break
            except Exception:
                continue

    if decoded and not _is_blank(decoded):
        raw = decoded.replace("\\/", "/").replace("&amp;", "&")

    for _ in range(2):
        if "%" not in raw:
            break
        try:
            next_raw = unquote(raw)
        except Exception:
            break
        if next_raw == raw:
            break
        raw = next_raw

    if raw.startswith("http://") or raw.startswith("https://"):
        return raw

    if raw.startswith("//"):
        if isinstance(base_prefix, str) and base_prefix.startswith("http://"):
            return "http:" + raw
        return "https:" + raw

    if isinstance(base_prefix, str) and not _is_blank(base_prefix):
        return urljoin(base_prefix, raw)

    return raw


def _parse_video_list(soup, limit, source_id, base_url):
    if not soup or not limit:
        return []

    seen = set()
    videos = []

    links = soup.find_all("a", href=re.compile(r"/detail/\d+\.html"))
    for link in links:
        if len(videos) >= limit:
            break

        href = link.get("href", "")
        m = re.search(r"/detail/(\d+)\.html", href)
        if not m:
            continue

        vid = m.group(1)
        if vid in seen:
            continue

        parent = link.find_parent(["li", "div", "article", "section"]) or link.parent
        item = _parse_video_item(link, parent, vid, source_id, base_url)
        if not item:
            continue

        seen.add(vid)
        videos.append(item)

    return videos


def _parse_video_item(link, parent, video_id, source_id, base_url):
    title = link.get("title") or link.get_text(strip=True)
    if _is_blank(title) and parent:
        title = _first_text([parent.find("h4"), parent.find("h3"), parent.find("h2")])
    if _is_blank(title):
        return None

    cover = _find_cover_from_parent(parent, title, base_url)
    return {
        "id": str(video_id),
        "title": title,
        "cover": cover,
        "source": source_id,
    }


def _find_cover_from_parent(parent, title, base_url):
    if not parent:
        return f"https://via.placeholder.com/200x300?text={title}"

    thumb = parent.find("a", class_=re.compile(r"thumb|vodlist__thumb"))
    if thumb:
        style = thumb.get("style", "")
        url_match = re.search(r"url\(([^)]+)\)", style)
        if url_match:
            return _abs_url(base_url, url_match.group(1).strip("\"'"))

    img = parent.find("img")
    if img:
        src = img.get("data-original") or img.get("data-src") or img.get("src")
        if not _is_blank(src):
            return _abs_url(base_url, src)

    return f"https://via.placeholder.com/200x300?text={title}"


def _find_cover(soup, title, base_url):
    if not soup:
        return ""

    img = None
    if not _is_blank(title):
        img = soup.find("img", alt=title)
    if not img:
        img = soup.find("img")
    if not img:
        return ""

    src = img.get("data-original") or img.get("data-src") or img.get("src")
    return _abs_url(base_url, src) if src else ""


def _find_description(soup):
    if not soup:
        return ""

    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        return meta.get("content", "").strip()

    text = soup.get_text("\n", strip=True)
    m = re.search(r"简介\s*(.+)", text)
    if not m:
        return ""

    value = m.group(1).strip()
    return value[:800]


def _find_tags(soup):
    if not soup:
        return []

    tags = []
    for a in soup.find_all("a", href=re.compile(r"/vodsearch/")):
        t = a.get_text(strip=True)
        if _is_blank(t) or t in tags:
            continue
        tags.append(t)
        if len(tags) >= 12:
            break

    return tags


def _find_year(soup):
    if not soup:
        return None

    text = soup.get_text("\n", strip=True)
    m = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    if not m:
        return None

    return _safe_int(m.group(1))


def _extract_episode_title(soup, episode_number):
    if not soup:
        return f"第{episode_number}集" if episode_number else ""

    h1 = soup.find("h1")
    if h1:
        t = h1.get_text(strip=True)
        if not _is_blank(t):
            return t

    title = soup.find("title")
    if title:
        t = title.get_text(strip=True)
        if not _is_blank(t):
            return t

    return f"第{episode_number}集" if episode_number else ""


def _fallback_source_ids(current_sid):
    s = str(current_sid)
    candidates = ["6", "5", "4", "3", "2", "1"]
    return [x for x in candidates if x != s]


def _source_priority():
    return {"6": 0, "5": 1, "4": 2, "3": 3, "2": 4, "1": 5}


def _abs_url(base_url, url):
    if _is_blank(url):
        return ""

    value = str(url).strip().strip('"').strip("'")
    if value.startswith("//"):
        return "https:" + value
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if value.startswith("/"):
        return base_url + value
    return base_url + "/" + value


def _first_text(nodes):
    for node in nodes or []:
        if not node:
            continue
        t = node.get_text(strip=True) if hasattr(node, "get_text") else str(node).strip()
        if not _is_blank(t):
            return t
    return ""


def _safe_int(value):
    try:
        return int(str(value))
    except Exception:
        return None


def _is_blank(value):
    return value is None or str(value).strip() == ""
