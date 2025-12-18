import json
import logging
import re
from urllib.parse import quote, urljoin

import execjs
from bs4 import BeautifulSoup

from .base_video_scraper import BaseVideoScraper

logger = logging.getLogger(__name__)


class NetflixgcScraper(BaseVideoScraper):
    def __init__(self, proxy_config=None):
        super().__init__("https://www.netflixgc.com", proxy_config)
        self.source_id = "netflixgc"
        self.source_name = "奈飞工厂"
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

        url = self._build_category_url(str(category_id), page)
        resp = self._make_request(url)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        return _parse_video_list(soup, limit, self.source_id, self.base_url)

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
            }

        decrypted = self._parse_and_decrypt_video_url(encrypted_url, url)
        title = _extract_episode_title(soup, ep_int)

        return {
            "id": f"{series_id}_{sid}_{ep_int or episode_num}",
            "seriesId": series_id,
            "title": title,
            "episodeNumber": ep_int,
            "videoUrl": decrypted,
            "playUrl": url,
            "source": self.source_id,
        }

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


def _normalize_video_url(url, base_url):
    if _is_blank(url):
        return None

    value = str(url).strip()
    if value.startswith("//"):
        return "https:" + value
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if value.startswith("/"):
        return urljoin(base_url, value)
    return value


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
