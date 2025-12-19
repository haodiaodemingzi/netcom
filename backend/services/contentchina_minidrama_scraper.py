import base64
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

import requests

from .base_video_scraper import BaseVideoScraper

logger = logging.getLogger(__name__)


class ContentChinaMiniDramaScraper(BaseVideoScraper):
    def __init__(self, proxy_config=None):
        super().__init__("https://minidrama.contentchina.com", proxy_config)
        self.source_id = "contentchina_minidrama"
        self.source_name = "喜福网短剧"
        self.api_base_url = "https://minidrama-api.contentchina.com"
        self._uuid = str(uuid.uuid4())
        self.headers.update(
            {
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://minidrama.contentchina.com/",
                "x-uuid": self._uuid,
            }
        )
        self.session.headers.update(self.headers)

    def get_categories(self):
        left = self._get_category_list(True)
        right = self._get_category_list(False)

        categories = [{"id": "all", "name": "全部"}]
        seen = {"all"}

        for item in (left + right):
            if not isinstance(item, dict):
                continue

            cid = item.get("id")
            name = item.get("name")
            if cid is None or not name:
                continue

            cid_str = str(cid)
            if cid_str in seen:
                continue

            seen.add(cid_str)
            categories.append({"id": cid_str, "name": str(name)})

        return categories

    def get_videos_by_category(self, category_id="all", page=1, limit=24):
        safe_page = self._safe_int(page) or 1
        safe_limit = self._safe_int(limit) or 24
        if safe_page < 1:
            safe_page = 1
        if safe_limit < 1:
            safe_limit = 24

        params = {"pageSize": safe_limit, "currentPage": safe_page}
        safe_category = str(category_id or "all").strip()
        if safe_category and safe_category != "all" and safe_category.isdigit():
            params["filterCategories[]"] = safe_category

        payload = self._get_json("/web/v1/drama/list", params)
        data = self._safe_get(payload, ["data", "data"], default=[])
        if not isinstance(data, list):
            return []

        results = []
        for item in data:
            normalized = self._normalize_series(item)
            if not normalized:
                continue
            results.append(normalized)
            if len(results) >= safe_limit:
                break

        return results

    def get_video_detail(self, video_id):
        album_id = str(video_id or "").strip()
        if not album_id:
            return None

        payload = self._get_json("/web/v1/drama/detail", {"albumId": album_id})
        serial = self._safe_get(payload, ["data", "serialData"], default={})
        if not isinstance(serial, dict) or not serial:
            return None

        detail = self._normalize_series(serial)
        if not detail:
            return None

        intro = serial.get("introduction")
        if isinstance(intro, str) and intro.strip():
            detail["description"] = intro.strip()

        return detail

    def get_episodes(self, video_id):
        album_id = str(video_id or "").strip()
        if not album_id:
            return []

        payload = self._get_json("/web/v1/drama/detail", {"albumId": album_id})
        episode_list = self._safe_get(payload, ["data", "episodeList"], default=[])
        if not isinstance(episode_list, list):
            return []

        results = []
        for ep in episode_list:
            seq = self._safe_int(self._safe_get(ep, ["sequence"], default=None))
            if not seq:
                continue
            results.append(
                {
                    "id": f"{album_id}_{seq}",
                    "seriesId": album_id,
                    "title": f"第{seq}集",
                    "episodeNumber": seq,
                    "playUrl": f"{self.base_url}/play/{album_id}.html?seq={seq}",
                    "source": self.source_id,
                }
            )

        results.sort(key=lambda x: self._safe_int(x.get("episodeNumber")) or 0)
        return results

    def get_episode_detail(self, episode_id):
        parsed = self._parse_episode_id(episode_id)
        if not parsed:
            return None

        album_id, seq = parsed
        auth_payload = self._get_json(
            "/web/v1/drama/play_auth",
            {"albumId": album_id, "seq": seq},
        )
        auth_data = self._safe_get(auth_payload, ["data"], default={})
        if not isinstance(auth_data, dict) or not auth_data:
            return None

        play_auth = auth_data.get("playAuth")
        vid = auth_data.get("vid")
        if not isinstance(play_auth, str) or not play_auth:
            return None
        if not isinstance(vid, str) or not vid:
            return None

        decoded = self._decode_play_auth(play_auth)
        if not decoded:
            return None

        play_url = self._resolve_play_url(decoded, vid)
        if not play_url:
            return None

        return {
            "id": f"{album_id}_{seq}",
            "seriesId": album_id,
            "title": f"第{seq}集",
            "episodeNumber": seq,
            "videoUrl": play_url,
            "playUrl": f"{self.base_url}/play/{album_id}.html?seq={seq}",
            "source": self.source_id,
        }

    def search_videos(self, keyword, page=1, limit=24):
        safe_keyword = str(keyword or "").strip()
        if not safe_keyword:
            return []

        safe_page = self._safe_int(page) or 1
        safe_limit = self._safe_int(limit) or 24
        if safe_page < 1:
            safe_page = 1
        if safe_limit < 1:
            safe_limit = 24

        target_offset = (safe_page - 1) * safe_limit
        page_size = 50
        current_page = 1
        matched = 0
        results = []

        while True:
            payload = self._get_json(
                "/web/v1/drama/list",
                {"pageSize": page_size, "currentPage": current_page},
            )
            items = self._safe_get(payload, ["data", "data"], default=[])
            if not isinstance(items, list) or not items:
                return results

            for raw in items:
                normalized = self._normalize_series(raw)
                if not normalized:
                    continue

                title = normalized.get("title")
                if not isinstance(title, str):
                    continue
                if safe_keyword not in title:
                    continue

                if matched < target_offset:
                    matched += 1
                    continue

                results.append(normalized)
                matched += 1

                if len(results) >= safe_limit:
                    return results

            pagination = self._safe_get(payload, ["data", "pagination"], default={})
            total_pages = None
            if isinstance(pagination, dict):
                total_pages = self._safe_int(pagination.get("totalPages"))

            if total_pages and current_page >= total_pages:
                return results

            current_page += 1
            if current_page > 50:
                return results

    def _get_category_list(self, is_left):
        payload = self._get_json(
            "/web/v1/home/categoryList",
            {"isLeft": 1 if is_left else 0},
        )
        categories = self._safe_get(payload, ["data", "categories"], default=[])
        if not isinstance(categories, list):
            return []
        return categories

    def _get_json(self, path, params):
        safe_path = str(path or "").strip()
        if not safe_path:
            return None

        url = self.api_base_url.rstrip("/") + safe_path
        try:
            self._delay()
            resp = self.session.get(url, params=params, timeout=15, verify=True)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error("ContentChina 请求失败 url=%s err=%s", url, str(e))
            return None
        except ValueError as e:
            logger.error("ContentChina 解析JSON失败 url=%s err=%s", url, str(e))
            return None

    def _normalize_series(self, item):
        if not isinstance(item, dict):
            return None

        album_id = item.get("albumId")
        title = item.get("title")
        if album_id is None or not isinstance(title, str) or not title.strip():
            return None

        cover = item.get("coverUrl")
        if not isinstance(cover, str) or not cover.strip():
            cover = ""

        actors = item.get("leadActor")
        if not isinstance(actors, list):
            actors = []

        categories = item.get("categories")
        if not isinstance(categories, list):
            categories = []

        total = self._safe_int(item.get("total"))

        return {
            "id": str(album_id),
            "title": title.strip(),
            "cover": cover.strip(),
            "episodes": total,
            "actors": [str(a) for a in actors if a],
            "tags": [str(t) for t in categories if t],
            "source": self.source_id,
        }

    def _parse_episode_id(self, episode_id):
        safe = str(episode_id or "").strip()
        if not safe:
            return None

        parts = safe.split("_")
        if len(parts) != 2:
            return None

        album_id = parts[0].strip()
        seq = self._safe_int(parts[1])
        if not album_id or not seq:
            return None

        return album_id, seq

    def _decode_play_auth(self, play_auth):
        safe = str(play_auth or "").strip()
        if not safe:
            return None

        padded = safe + "=" * ((4 - len(safe) % 4) % 4)
        try:
            raw = base64.urlsafe_b64decode(padded.encode("utf-8"))
            text = raw.decode("utf-8", errors="ignore")
            data = json.loads(text)
            return data if isinstance(data, dict) else None
        except Exception as e:
            logger.error("ContentChina 解码playAuth失败 err=%s", str(e))
            return None

    def _resolve_play_url(self, decoded, video_id):
        access_key_id = decoded.get("AccessKeyId")
        access_key_secret = decoded.get("AccessKeySecret")
        security_token = decoded.get("SecurityToken")
        region = decoded.get("Region")
        auth_info = decoded.get("AuthInfo")

        if not all(
            isinstance(v, str) and v
            for v in [access_key_id, access_key_secret, security_token, region, auth_info]
        ):
            return None

        endpoint = f"https://vod.{region}.aliyuncs.com/"
        params = {
            "AccessKeyId": access_key_id,
            "Action": "GetPlayInfo",
            "AuthInfo": auth_info,
            "AuthTimeout": 7200,
            "Channel": "HTML5",
            "Format": "JSON",
            "Formats": "",
            "PlayConfig": json.dumps(
                {"PlayDomain": "minidrama-alivod.contentchina.com"},
                separators=(",", ":"),
            ),
            "PlayerVersion": "2.28.4",
            "ReAuthInfo": "{}",
            "SecurityToken": security_token,
            "SignatureMethod": "HMAC-SHA1",
            "SignatureNonce": str(uuid.uuid4()),
            "SignatureVersion": "1.0",
            "StreamType": "video",
            "Timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "Version": "2017-03-21",
            "VideoId": video_id,
        }

        signature = self._sign_aliyun(params, access_key_secret)
        if not signature:
            return None
        params["Signature"] = signature

        try:
            self._delay()
            resp = self.session.get(endpoint, params=params, timeout=20, verify=True)
            resp.raise_for_status()
            payload = resp.json()
        except requests.RequestException as e:
            logger.error(
                "ContentChina GetPlayInfo失败 videoId=%s region=%s err=%s",
                video_id,
                region,
                str(e),
            )
            return None
        except ValueError as e:
            logger.error("ContentChina GetPlayInfo解析失败 videoId=%s err=%s", video_id, str(e))
            return None

        play_infos = self._safe_get(payload, ["PlayInfoList", "PlayInfo"], default=[])
        if not isinstance(play_infos, list) or not play_infos:
            return None

        for info in play_infos:
            if not isinstance(info, dict):
                continue
            url = info.get("PlayURL")
            if isinstance(url, str) and url.strip():
                return url.strip()

        return None

    def _sign_aliyun(self, params, access_key_secret):
        if not isinstance(params, dict) or not params:
            return None
        if not isinstance(access_key_secret, str) or not access_key_secret:
            return None

        pairs = []
        for k, v in params.items():
            if v is None:
                continue
            pairs.append((str(k), str(v)))
        pairs.sort(key=lambda x: x[0])

        canonicalized = "&".join(
            f"{self._percent_encode(k)}={self._percent_encode(v)}" for k, v in pairs
        )
        string_to_sign = "GET&%2F&" + self._percent_encode(canonicalized)

        try:
            key = (access_key_secret + "&").encode("utf-8")
            message = string_to_sign.encode("utf-8")
            digest = hmac.new(key, message, hashlib.sha1).digest()
            return base64.b64encode(digest).decode("utf-8")
        except Exception as e:
            logger.error("ContentChina 生成签名失败 err=%s", str(e))
            return None

    def _percent_encode(self, value):
        if value is None:
            return ""
        return quote(str(value), safe="~")

    def _safe_get(self, data, keys, default=None):
        if not isinstance(data, dict):
            return default
        if not keys:
            return default

        current = data
        for k in keys:
            if not isinstance(current, dict):
                return default
            current = current.get(k)
            if current is None:
                return default
        return current

    def _safe_int(self, value):
        try:
            return int(value)
        except Exception:
            return None
