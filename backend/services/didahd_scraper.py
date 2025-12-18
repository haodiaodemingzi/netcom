import json
import logging
import re
from urllib.parse import quote, unquote

from bs4 import BeautifulSoup

from .base_video_scraper import BaseVideoScraper

logger = logging.getLogger(__name__)


class DidahdScraper(BaseVideoScraper):
    def __init__(self, proxy_config=None):
        super().__init__("https://www.didahd.pro", proxy_config)
        self.source_id = "didahd"
        self.source_name = "嘀嗒影视"
        self.headers.update(
            {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Referer": self.base_url + "/",
            }
        )
        self.session.headers.update(self.headers)

    def get_categories(self):
        return [
            {"id": "hot", "name": "热播"},
            {"id": "new", "name": "最近更新"},
            {"id": "1", "name": "电影"},
            {"id": "2", "name": "电视剧"},
            {"id": "3", "name": "纪录片"},
            {"id": "4", "name": "动漫"},
            {"id": "5", "name": "综艺"},
        ]

    def get_videos_by_category(self, category_id="hot", page=1, limit=20):
        url = self._build_category_url(category_id, page)
        resp = self._make_request(url)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        return self._parse_video_list(soup, limit)

    def get_video_detail(self, video_id):
        if not video_id:
            return None

        url = f"{self.base_url}/detail/{video_id}.html"
        resp = self._make_request(url)
        if not resp:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")
        title = self._first_text([soup.find("h1"), soup.find("title")])
        cover = self._find_cover(soup)
        description = self._find_description(soup)
        tags = self._find_tags(soup)

        return {
            "id": str(video_id),
            "title": title or str(video_id),
            "cover": cover,
            "description": description,
            "tags": tags,
            "source": self.source_id,
        }

    def get_episodes(self, video_id):
        if not video_id:
            return []

        url = f"{self.base_url}/detail/{video_id}.html"
        resp = self._make_request(url)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        links = soup.find_all("a", href=re.compile(r"/play/\d+-\d+-\d+\.html"))
        episodes = []
        seen = set()

        for link in links:
            href = link.get("href", "")
            m = re.search(r"/play/(\d+)-(\d+)-(\d+)\.html", href)
            if not m:
                continue

            series_id = m.group(1)
            sid = m.group(2)
            nid = m.group(3)
            episode_key = f"{series_id}_{sid}_{nid}"
            if episode_key in seen:
                continue
            seen.add(episode_key)

            text = link.get_text(strip=True)
            episode_number = self._safe_int(nid) or 1
            title = text or f"第{episode_number}集"

            episodes.append(
                {
                    "id": episode_key,
                    "seriesId": series_id,
                    "title": title,
                    "episodeNumber": episode_number,
                    "playUrl": self.base_url + href,
                    "source": self.source_id,
                    "_sid": self._safe_int(sid) or 0,
                }
            )

        episodes.sort(key=lambda x: self._episode_sort_key(x))
        for ep in episodes:
            ep.pop("_sid", None)
        return episodes

    def get_episode_detail(self, episode_id):
        parsed = self._parse_episode_id(episode_id)
        if not parsed:
            return None

        series_id, sid, nid = parsed
        play_url = f"{self.base_url}/play/{series_id}-{sid}-{nid}.html"
        resp = self._make_request(play_url)
        if not resp:
            return None

        player_data = self._extract_player_data(resp.text)
        if not player_data:
            return None

        raw_title = None
        vod_data = player_data.get("vod_data") or {}
        if isinstance(vod_data, dict):
            raw_title = vod_data.get("vod_name")

        video_url = self._decode_player_url(player_data)
        if self._is_netdisk_url(video_url):
            video_url = None

        return {
            "id": f"{series_id}_{sid}_{nid}",
            "seriesId": str(series_id),
            "title": raw_title or f"第{self._safe_int(nid) or 1}集",
            "episodeNumber": self._safe_int(nid) or 1,
            "videoUrl": video_url,
            "playUrl": play_url,
            "source": self.source_id,
        }

    def search_videos(self, keyword, page=1, limit=20):
        if not keyword:
            return []

        encoded = self._encode_search_keyword(keyword)
        url = f"{self.base_url}/search/{encoded}.html"
        resp = self._make_request(url)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        return self._parse_video_list(soup, limit)

    def _encode_search_keyword(self, keyword):
        safe = (keyword or "").strip()
        if not safe:
            return ""
        return "-" + quote(safe) + "------------"

    def _build_category_url(self, category_id, page):
        safe_page = self._safe_int(page) or 1
        safe_category = str(category_id or "hot").strip()

        if safe_category == "hot":
            return f"{self.base_url}/label/hot.html"
        if safe_category == "new":
            return f"{self.base_url}/label/new.html"

        if safe_category.isdigit():
            return f"{self.base_url}/show/{safe_category}--------{safe_page}---.html"

        if safe_page <= 1:
            return f"{self.base_url}/"
        return f"{self.base_url}/label/new.html"

    def _parse_video_list(self, soup, limit):
        if not soup:
            return []

        results = []
        seen = set()
        for link in soup.find_all("a", href=re.compile(r"/detail/\d+\.html")):
            if len(results) >= (self._safe_int(limit) or 20):
                break

            href = link.get("href", "")
            m = re.search(r"/detail/(\d+)\.html", href)
            if not m:
                continue

            vid = m.group(1)
            if vid in seen:
                continue
            seen.add(vid)

            title = link.get("title") or link.get_text(strip=True)
            if not title:
                img = link.find("img")
                if img:
                    title = img.get("alt")

            if not title:
                continue

            cover = self._extract_img_url(link.find("img"))
            if not cover:
                cover = self._find_cover(link)

            results.append({"id": vid, "title": title, "cover": cover, "source": self.source_id})

        return results

    def _first_text(self, nodes):
        for node in nodes or []:
            if not node:
                continue
            text = getattr(node, "get_text", None)
            if callable(text):
                value = node.get_text(strip=True)
            else:
                value = str(node).strip()
            if value:
                return value
        return ""

    def _find_cover(self, soup):
        if not soup:
            return ""

        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return self._normalize_cover(og.get("content"))

        img = soup.find("img")
        return self._extract_img_url(img)

    def _find_description(self, soup):
        if not soup:
            return ""

        text = soup.get_text("\n", strip=True)
        m = re.search(r"剧情简介[:：]\s*(.+)", text)
        if m:
            return m.group(1).strip()

        return ""

    def _find_tags(self, soup):
        if not soup:
            return []

        tags = []
        for a in soup.find_all("a", href=re.compile(r"/show/")):
            t = a.get_text(strip=True)
            if not t:
                continue
            if t not in tags and len(tags) < 30:
                tags.append(t)
        return tags

    def _normalize_cover(self, url):
        if not url:
            return ""
        if url.startswith("//"):
            return "https:" + url
        if url.startswith("/"):
            return self.base_url + url
        if not url.startswith("http"):
            return self.base_url + "/" + url.lstrip("/")
        return url

    def _extract_img_url(self, img):
        if not img:
            return ""
        candidates = [
            img.get("data-original", ""),
            img.get("data-src", ""),
            img.get("data-echo", ""),
            img.get("src", ""),
        ]
        for c in candidates:
            normalized = self._normalize_cover(c)
            if normalized:
                return normalized
        return ""

    def _parse_episode_id(self, episode_id):
        safe = str(episode_id or "").strip()
        if not safe:
            return None

        parts = safe.split("_")
        if len(parts) == 3 and all(p.isdigit() for p in parts):
            return parts[0], parts[1], parts[2]

        m = re.search(r"(\d+)-(\d+)-(\d+)", safe)
        if m:
            return m.group(1), m.group(2), m.group(3)

        return None

    def _extract_player_data(self, html):
        if not html:
            return None

        m = re.search(r"var\s+player_aaaa\s*=", html)
        if not m:
            return None

        start = html.find("{", m.end())
        if start < 0:
            return None

        raw = self._extract_balanced_braces(html, start)
        if not raw:
            return None

        try:
            return json.loads(raw)
        except Exception as e:
            logger.warning("解析 player_aaaa 失败 source=%s err=%s", self.source_id, str(e))
            fixed = self._try_fix_json(raw)
            if not fixed:
                return None

            try:
                return json.loads(fixed)
            except Exception as e2:
                logger.warning("解析 player_aaaa 兜底失败 source=%s err=%s", self.source_id, str(e2))
                return None

    def _extract_balanced_braces(self, text, start_index):
        if not text:
            return None
        if start_index is None or start_index < 0 or start_index >= len(text):
            return None
        if text[start_index] != "{":
            return None

        depth = 0
        in_string = False
        quote_char = ""
        escaped = False

        for i in range(start_index, len(text)):
            ch = text[i]

            if in_string:
                if escaped:
                    escaped = False
                    continue
                if ch == "\\":
                    escaped = True
                    continue
                if ch == quote_char:
                    in_string = False
                    quote_char = ""
                continue

            if ch == '"' or ch == "'":
                in_string = True
                quote_char = ch
                continue

            if ch == "{":
                depth += 1
                continue
            if ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start_index : i + 1]
                continue

        return None

    def _try_fix_json(self, raw):
        if not raw:
            return None

        fixed = raw.strip()
        fixed = re.sub(r",\s*([}\]])", r"\1", fixed)
        return fixed

    def _normalize_play_url(self, url):
        if not url:
            return None
        if not isinstance(url, str):
            return None

        if url.startswith("//"):
            return "https:" + url
        if url.startswith("/"):
            return self.base_url.rstrip("/") + url
        return url

    def _decode_player_url(self, player_data):
        if not isinstance(player_data, dict):
            return None

        url = player_data.get("url")
        if not isinstance(url, str) or not url:
            return None

        encrypt = str(player_data.get("encrypt") or "0")
        if encrypt == "1":
            return self._normalize_play_url(unquote(url))
        if encrypt == "2":
            return self._normalize_play_url(self._decode_base64_url(url))
        if encrypt == "3":
            return self._normalize_play_url(self._decode_encrypt3(url))
        return self._normalize_play_url(url)

    def _decode_base64_url(self, value):
        if not value:
            return None

        try:
            import base64

            decoded = base64.b64decode(value).decode("utf-8", errors="ignore")
            return unquote(decoded)
        except Exception:
            return unquote(value)

    def _decode_encrypt3(self, value):
        if not value:
            return None

        if value.startswith("http"):
            return value

        decoded = unquote(value)
        if decoded.startswith("http"):
            return decoded

        hex_decoded = self._try_hex_to_text(decoded)
        if hex_decoded:
            base64_decoded = self._try_base64_to_text(hex_decoded)
            if base64_decoded:
                final_url = unquote(base64_decoded)
                if final_url:
                    return final_url

        return decoded

    def _try_hex_to_text(self, value):
        if not value:
            return None
        if len(value) % 2 != 0:
            return None

        if not re.fullmatch(r"[0-9a-fA-F]+", value):
            return None

        try:
            raw = bytes.fromhex(value)
            return raw.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.warning("encrypt3 hex 解码失败 source=%s err=%s", self.source_id, str(e))
            return None

    def _try_base64_to_text(self, value):
        if not value:
            return None

        try:
            import base64

            raw = base64.b64decode(value)
            return raw.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.warning("encrypt3 base64 解码失败 source=%s err=%s", self.source_id, str(e))
            return None

    def _is_netdisk_url(self, url):
        if not url:
            return False
        lower = url.lower()
        if "pan.quark.cn" in lower:
            return True
        if "pan.baidu.com" in lower:
            return True
        return False

    def _safe_int(self, value):
        try:
            return int(value)
        except Exception:
            return None

    def _episode_sort_key(self, episode):
        sid = self._safe_int(episode.get("_sid")) or 0
        number = self._safe_int(episode.get("episodeNumber")) or 0
        prefer = 0
        if sid in (1, 2):
            prefer = 1
        return prefer, sid, number
