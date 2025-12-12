import re
import json
from urllib.parse import quote, urljoin, unquote
from bs4 import BeautifulSoup

from .base_video_scraper import BaseVideoScraper


class YinghuaScraper(BaseVideoScraper):
    """樱花动漫(yinghuajinju.com) 视频爬虫

    说明：
    - 仅使用 requests + BeautifulSoup 运行，Playwright 仅用于开发分析。
    - 尽量使用弹性解析策略，避免因样式变化导致崩溃。
    """

    def __init__(self, proxy_config=None):
        super().__init__("http://www.yinghuajinju.com", proxy_config)
        self.source_id = "yinghua"
        self.source_name = "樱花动漫"

    # ---------- 对外接口 ----------
    def get_categories(self):
        """返回类型分类列表"""
        categories = [
            {"id": "hot", "name": "热门"},
            {"id": "66", "name": "热血"},
            {"id": "64", "name": "格斗"},
            {"id": "91", "name": "恋爱"},
            {"id": "70", "name": "校园"},
            {"id": "67", "name": "搞笑"},
            {"id": "83", "name": "神魔"},
            {"id": "81", "name": "机战"},
            {"id": "75", "name": "科幻"},
            {"id": "84", "name": "青春"},
            {"id": "73", "name": "魔法"},
            {"id": "61", "name": "冒险"},
            {"id": "69", "name": "运动"},
            {"id": "77", "name": "剧情"},
            {"id": "99", "name": "后宫"},
            {"id": "80", "name": "战争"},
        ]
        return categories

    def get_videos_by_category(self, category_id="hot", page=1, limit=20):
        url = self._build_list_url(category_id, page)
        resp = self._make_request(url, verify_ssl=False)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        # 首页(热门)结构与分类页不同，使用不同的解析方法
        if category_id == "hot":
            videos = self._extract_video_cards(soup, limit)
        else:
            videos = self._extract_search_results(soup, limit)
        return videos[:limit]

    def get_video_detail(self, video_id):
        raw_id = self._decode_id(video_id)
        detail_url = self._ensure_full_url(raw_id)
        resp = self._make_request(detail_url, verify_ssl=False)
        if not resp:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        title = self._first_text(
            [
                soup.find("h1"),
                soup.find("h2"),
                soup.find("div", class_=re.compile("title")),
            ]
        )
        cover = self._find_cover(soup)
        description = self._find_description(soup)
        tags = self._find_tags(soup)
        author = self._find_author(soup, resp.text)
        # 解析“更新至xx集/话”
        episodes = self._parse_int(self._search_text(resp.text, r"更新至\s*(\d+)\s*[集话]"))
        if episodes is None:
            episodes = self._parse_int(self._search_text(resp.text, r"(\d+)集全"))
        if episodes is None:
            episodes = self._parse_int(self._search_text(resp.text, r"(\d+)话全"))
        year = self._search_text(resp.text, r"(20\d{2}|19\d{2})")
        rating = self._parse_float(self._search_text(resp.text, r"([\d.]+)\s*分"))

        return {
            "id": video_id,
            "title": title or video_id,
            "cover": cover,
            "description": description,
            "tags": tags,
            "author": author,
            "area": None,
            "year": year,
            "status": None,
            "rating": rating if rating is not None else 0.0,
            "source": self.source_id,
            "episodes": episodes,
        }

    def get_episodes(self, video_id):
        raw_id = self._decode_id(video_id)
        detail_url = self._ensure_full_url(raw_id)
        resp = self._make_request(detail_url, verify_ssl=False)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        episode_links = soup.find_all("a", href=re.compile(r"(play|/p/|/v/).*\.html"))
        episodes = []
        seen = set()

        for link in episode_links:
            href = link.get("href", "")
            ep_id = self._normalize_id(href, keep_ext=True)
            if not ep_id or ep_id in seen:
                continue
            seen.add(ep_id)

            title = link.get_text(strip=True) or f"第{len(episodes)+1}集"
            play_page = self._ensure_full_url(href)
            episodes.append(
                {
                    "id": self._encode_id(ep_id),
                    "seriesId": video_id,
                    "title": title,
                    "playPageUrl": play_page,
                    "videoUrl": None,
                    "source": self.source_id,
                }
            )
            if len(episodes) >= 200:
                break

        # 如果未找到剧集，尝试把详情页本身作为单集
        if not episodes:
            media_url = self._extract_media_url(resp.text)
            episodes.append(
                {
                    "id": self._encode_id(f"{raw_id}_1"),
                    "seriesId": video_id,
                    "title": "第1集",
                    "playPageUrl": detail_url,
                    "videoUrl": media_url,
                    "source": self.source_id,
                }
            )

        return episodes

    def get_episode_detail(self, episode_id):
        raw_ep_id = self._decode_id(episode_id)
        play_url = self._ensure_full_url(raw_ep_id)
        resp = self._make_request(play_url, verify_ssl=False)
        if not resp:
            return None

        media_url = self._extract_media_url(resp.text)
        title = self._search_text(resp.text, r"title>([^<]+)")

        return {
            "id": episode_id,
            "seriesId": None,
            "title": title or episode_id,
            "videoUrl": media_url or play_url,
            "playPageUrl": play_url,
            "source": self.source_id,
        }

    def search_videos(self, keyword, page=1, limit=20):
        if not keyword:
            return []
        # 使用正确的搜索URL格式: /search/{keyword}/ 或 /search/{keyword}/page/{page}.html
        encoded_keyword = quote(keyword)
        if page > 1:
            search_url = f"{self.base_url}/search/{encoded_keyword}/page/{page}.html"
        else:
            search_url = f"{self.base_url}/search/{encoded_keyword}/"
        
        resp = self._make_request(search_url, verify_ssl=False)
        if not resp:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        return self._extract_search_results(soup, limit)[:limit]

    # ---------- 工具方法 ----------
    def _build_list_url(self, category_id, page):
        """构建分类列表页URL"""
        # 热门走首页
        if category_id == "hot":
            if page > 1:
                return f"{self.base_url}/index.php?m=vod-index-pg-{page}.html"
            return self.base_url
        
        # 其他分类使用数字ID路径格式: /{id}/ 或 /{id}/{page}.html
        if page > 1:
            return f"{self.base_url}/{category_id}/{page}.html"
        return f"{self.base_url}/{category_id}/"

    def _first_text(self, elements):
        """返回第一个非空文本"""
        for el in elements:
            if not el:
                continue
            txt = el.get_text(strip=True)
            if txt:
                return txt
        return None

    def _ensure_full_url(self, href):
        if href.startswith("http"):
            return href
        if not href.startswith("/"):
            href = "/" + href
        return urljoin(self.base_url, href)

    def _normalize_id(self, href, fallback=None, keep_ext=False):
        if not href:
            return fallback
        # 去掉域名
        if href.startswith("http"):
            href = href.split("://", 1)[-1]
            href = href[href.find("/") :]
        href = href.lstrip("/")
        if not keep_ext:
            href = re.sub(r"\.html?$", "", href)
        return href or fallback

    def _encode_id(self, raw_id: str) -> str:
        """将包含/的原始id编码，便于作为路由参数"""
        if not raw_id:
            return raw_id
        return quote(raw_id, safe="")

    def _decode_id(self, encoded_id: str) -> str:
        if not encoded_id:
            return encoded_id
        try:
            return unquote(encoded_id)
        except Exception:
            return encoded_id

    def _extract_video_cards(self, soup, limit):
        videos = []
        seen = set()

        # 优先：含有图片的链接
        for link in soup.find_all("a", href=True):
            if len(videos) >= limit:
                break
            img = link.find("img")
            if not img:
                continue

            href = link["href"]
            if ".html" not in href:
                continue

            vid = self._normalize_id(href, keep_ext=False)
            if not vid or vid in seen:
                continue
            seen.add(vid)

            # 获取标题 - 多种方式尝试
            title = img.get("alt") or ""
            if not title:
                title = link.get("title") or ""
            if not title:
                # 尝试从链接文本中提取，去除更新信息
                text = link.get_text(strip=True)
                # 去除 "更新至xxx" 或 "全集" 等后缀
                title = re.sub(r'(更新至.*|全集.*|\d+集全.*|最新.*)', '', text).strip()
            if not title:
                # 从父元素找标题
                parent = link.find_parent(["li", "div"])
                if parent:
                    h_tag = parent.find(["h2", "h3", "h4"])
                    if h_tag:
                        title = h_tag.get_text(strip=True)
            if not title:
                # 最后回退到vid，但清理一下格式
                title = vid.replace("show/", "").replace(".html", "")
            
            cover = img.get("data-src") or img.get("src") or ""
            cover = self._ensure_full_url(cover) if cover.startswith("/") else cover

            desc = link.get("title") or ""
            ep_text = link.get_text(" ", strip=True)
            episodes = self._parse_int(self._search_text(ep_text, r"更新至\s*(\d+)"))
            if episodes is None:
                episodes = self._parse_int(self._search_text(ep_text, r"(\d+)[集话]"))
            rating = self._parse_float(self._search_text(ep_text, r"([\d.]+)分"))

            videos.append(
                {
                    "id": self._encode_id(self._normalize_id(href, keep_ext=True)),
                    "title": title,
                    "cover": cover,
                    "description": desc,
                    "rating": rating if rating is not None else 0.0,
                    "status": None,
                    "episodes": episodes,
                    "source": self.source_id,
                    "detailUrl": self._ensure_full_url(href),
                }
            )

        return videos

    def _extract_search_results(self, soup, limit):
        """解析搜索结果页面"""
        videos = []
        seen = set()
        
        # 搜索结果在 li 元素中，链接格式为 /show/xxxx.html
        items = soup.find_all("li")
        for item in items:
            if len(videos) >= limit:
                break
            
            # 找到详情链接 (/show/xxxx.html 格式)
            link = item.find("a", href=re.compile(r"/show/\d+\.html"))
            if not link:
                continue
            
            href = link.get("href", "")
            vid = self._normalize_id(href, keep_ext=False)
            if not vid or vid in seen:
                continue
            seen.add(vid)
            
            # 获取标题 - 优先从 h2 > a 获取
            title = ""
            h2_tag = item.find("h2")
            if h2_tag:
                title_link = h2_tag.find("a")
                if title_link:
                    title = title_link.get("title") or title_link.get_text(strip=True)
            if not title:
                title = vid
            # 清理标题中的 font 标签
            title = re.sub(r'<[^>]+>', '', title)
            
            # 获取封面
            img = item.find("img")
            cover = ""
            if img:
                cover = img.get("data-src") or img.get("src") or ""
                if cover.startswith("/"):
                    cover = self._ensure_full_url(cover)
            
            # 获取描述
            desc = ""
            p_tag = item.find("p")
            if p_tag:
                desc = p_tag.get_text(strip=True)
            
            # 获取集数信息
            item_text = item.get_text(" ", strip=True)
            episodes = self._parse_int(self._search_text(item_text, r"更新至\s*(\d+)集"))
            if episodes is None:
                episodes = self._parse_int(self._search_text(item_text, r"(\d+)集全"))
            
            # 状态（全集/更新中）
            status = None
            if "全集" in item_text:
                status = "全集"
            elif "更新至" in item_text:
                status = "更新中"
            
            videos.append({
                "id": self._encode_id(self._normalize_id(href, keep_ext=True)),
                "title": title,
                "cover": cover,
                "description": desc,
                "rating": 0.0,
                "status": status,
                "episodes": episodes,
                "source": self.source_id,
                "detailUrl": self._ensure_full_url(href),
            })
        
        # 如果 li 解析没结果，回退到通用解析
        if not videos:
            videos = self._extract_video_cards(soup, limit)
        
        return videos

    def _extract_media_url(self, html):
        if not html:
            return None
        # 常见 m3u8/mp4 直链
        match = re.search(r"(https?://[^\"'\s]+\.(?:m3u8|mp4)[^\"'\s]*)", html)
        if match:
            return self._clean_video_url(match.group(1))

        # 有些页面把链接放在 JSON 里
        json_like = re.search(r"\{[^\}]*?(m3u8|mp4)[^\}]*\}", html)
        if json_like:
            try:
                data = json.loads(json_like.group(0))
                for v in data.values():
                    if isinstance(v, str) and ("m3u8" in v or "mp4" in v):
                        return self._clean_video_url(v)
            except Exception:
                pass
        return None

    def _clean_video_url(self, url):
        """清理视频URL末尾的 $mp4, $ff 等标记"""
        if not url:
            return url
        # 移除末尾的 $xxx 标记 (如 $mp4, $ff, $m3u8 等)
        url = re.sub(r'\$[a-zA-Z0-9]+$', '', url)
        return url

    def _find_cover(self, soup):
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return og["content"]
        img = soup.find("img", class_=re.compile("cover|poster|thumb"))
        if img and img.get("src"):
            return self._ensure_full_url(img["src"]) if img["src"].startswith("/") else img["src"]
        return None

    def _find_description(self, soup):
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            return meta["content"]
        desc = soup.find("div", class_=re.compile("content|desc|info"))
        if desc:
            return desc.get_text(" ", strip=True)
        return ""

    def _find_tags(self, soup):
        tags = []
        tag_links = soup.find_all("a", href=re.compile("tag|type|category"))
        for link in tag_links:
            text = link.get_text(strip=True)
            if text and text not in tags:
                tags.append(text)
        return tags

    def _search_text(self, text, pattern):
        if not text:
            return None
        m = re.search(pattern, text)
        return m.group(1) if m else None

    def _find_author(self, soup, raw_text):
        """尝试从详情页解析作者/主演/声优等信息"""
        # 先从结构化文本查找
        info_blocks = soup.find_all(["p", "li", "div", "span"])
        for block in info_blocks:
            content = block.get_text(" ", strip=True)
            if not content:
                continue
            author = self._search_text(content, r"(导演|作者|声优|主演|编剧)[：:\s]+([^：:\s]+)")
            if author:
                return author

        # 再从原始HTML做一次回退搜索
        author = self._search_text(raw_text, r"(导演|作者|声优|主演|编剧)[：:\s]+([^<\s]{1,30})")
        return author

    def _parse_int(self, value):
        try:
            return int(value)
        except Exception:
            return None

    def _parse_float(self, value):
        try:
            return float(value)
        except Exception:
            return None

