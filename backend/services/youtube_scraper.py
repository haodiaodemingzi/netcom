import json
import logging
import os
import shutil
import subprocess
import sys
from urllib.parse import urlparse

from .base_video_scraper import BaseVideoScraper

logger = logging.getLogger(__name__)


class YouTubeScraper(BaseVideoScraper):
    def __init__(self, proxy_config=None):
        super().__init__('https://www.youtube.com', proxy_config)
        self.source_id = 'youtube'
        self.source_name = 'YouTube'
        self._channels = None
        self._video_cache = {}

    def get_categories(self):
        channels = self._load_channels()
        if not channels:
            return []

        categories = []
        for channel in channels:
            channel_id = channel.get('id')
            name = channel.get('name')
            if not channel_id or not name:
                continue
            categories.append({'id': channel_id, 'name': name})
        return categories

    def get_videos_by_category(self, category_id, page=1, limit=20):
        if not category_id:
            return []

        safe_page = page if isinstance(page, int) and page > 0 else 1
        safe_limit = limit if isinstance(limit, int) and limit > 0 else 20

        channel_url = self._get_channel_url_by_id(category_id)
        if not channel_url:
            return []

        start = (safe_page - 1) * safe_limit + 1
        end = safe_page * safe_limit

        playlist_url = self._normalize_channel_videos_url(channel_url)
        data = self._yt_dlp_json(
            [
                '--dump-single-json',
                '--flat-playlist',
                *self._yt_dlp_lang_args(),
                '--playlist-start',
                str(start),
                '--playlist-end',
                str(end),
                playlist_url,
            ],
            timeout=60,
        )
        if not isinstance(data, dict):
            data = self._yt_dlp_json(
                [
                    '--dump-single-json',
                    '--flat-playlist',
                    '--playlist-start',
                    str(start),
                    '--playlist-end',
                    str(end),
                    playlist_url,
                ],
                timeout=60,
            )
        if not isinstance(data, dict):
            return []

        entries = data.get('entries')
        if not isinstance(entries, list) or not entries:
            data = self._yt_dlp_json(
                [
                    '--dump-single-json',
                    '--flat-playlist',
                    '--playlist-start',
                    str(start),
                    '--playlist-end',
                    str(end),
                    playlist_url,
                ],
                timeout=60,
            )
            if not isinstance(data, dict):
                return []
            entries = data.get('entries')
            if not isinstance(entries, list) or not entries:
                return []

        videos = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue

            video_id = entry.get('id')
            title = entry.get('title')
            if not video_id or not title:
                continue

            cover = self._pick_thumbnail(entry)
            videos.append({
                'id': video_id,
                'title': title,
                'cover': cover or f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
                'source': self.source_id,
            })
        return videos

    def get_video_detail(self, video_id):
        if not video_id:
            return None

        cached = self._get_cached_video(video_id)
        if cached:
            return cached

        url = self._video_watch_url(video_id)
        data = self._yt_dlp_json([*self._yt_dlp_lang_args(), '-j', url], timeout=60)
        if not isinstance(data, dict):
            data = self._yt_dlp_json(['-j', url], timeout=60)
        if not isinstance(data, dict):
            return None

        title = data.get('title')
        if not title:
            return None

        detail = {
            'id': video_id,
            'title': title,
            'cover': data.get('thumbnail') or f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
            'description': data.get('description') or '',
            'uploader': data.get('uploader') or '',
            'source': self.source_id,
        }
        self._put_cached_video(video_id, detail)
        return detail

    def get_episodes(self, video_id):
        if not video_id:
            return []

        detail = self.get_video_detail(video_id)
        title = None
        if isinstance(detail, dict):
            title = detail.get('title')

        return [
            {
                'id': video_id,
                'seriesId': video_id,
                'title': title or '视频',
                'episodeNumber': 1,
                'playUrl': self._video_watch_url(video_id),
                'source': self.source_id,
            }
        ]

    def get_episode_detail(self, episode_id):
        if not episode_id:
            return None

        detail = self.get_video_detail(episode_id)
        title = None
        if isinstance(detail, dict):
            title = detail.get('title')

        watch_url = self._video_watch_url(episode_id)

        mp4_url = self._yt_dlp_first_url(
            [
                *self._yt_dlp_lang_args(),
                '-f',
                'best[ext=mp4][acodec!=none]/best[ext=mp4]/best',
                '-g',
                watch_url,
            ],
            timeout=60,
        )
        if not mp4_url:
            mp4_url = self._yt_dlp_first_url(
                [
                    '-f',
                    'best[ext=mp4][acodec!=none]/best[ext=mp4]/best',
                    '-g',
                    watch_url,
                ],
                timeout=60,
            )
        if not mp4_url:
            logger.error('youtube episode url empty episode_id=%s', episode_id)
            return None

        mp4_url = self._ensure_mp4_hint(mp4_url)

        return {
            'id': episode_id,
            'seriesId': episode_id,
            'title': title or '视频',
            'episodeNumber': 1,
            'playUrl': watch_url,
            'videoUrl': mp4_url,
            'source': self.source_id,
        }

    def search_videos(self, keyword, page=1, limit=20):
        if not keyword:
            return []

        safe_page = page if isinstance(page, int) and page > 0 else 1
        safe_limit = limit if isinstance(limit, int) and limit > 0 else 20

        start = (safe_page - 1) * safe_limit
        end = safe_page * safe_limit
        fetch_limit = end
        if fetch_limit <= 0:
            return []

        data = self._yt_dlp_json(
            ['--dump-single-json', '--flat-playlist', *self._yt_dlp_lang_args(), f'ytsearchdate{fetch_limit}:{keyword}'],
            timeout=60,
        )
        if not isinstance(data, dict):
            data = self._yt_dlp_json(
                ['--dump-single-json', '--flat-playlist', f'ytsearchdate{fetch_limit}:{keyword}'],
                timeout=60,
            )
        if not isinstance(data, dict):
            return []

        entries = data.get('entries')
        if not isinstance(entries, list) or not entries:
            data = self._yt_dlp_json(
                ['--dump-single-json', '--flat-playlist', f'ytsearchdate{fetch_limit}:{keyword}'],
                timeout=60,
            )
            if not isinstance(data, dict):
                return []
            entries = data.get('entries')
            if not isinstance(entries, list) or not entries:
                return []

        page_entries = entries[start:end]
        if not page_entries:
            return []

        videos = []
        for entry in page_entries:
            if not isinstance(entry, dict):
                continue
            video_id = entry.get('id')
            title = entry.get('title')
            if not video_id or not title:
                continue
            cover = self._pick_thumbnail(entry)
            videos.append({
                'id': video_id,
                'title': title,
                'cover': cover or f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
                'source': self.source_id,
            })
        return videos

    def _load_channels(self):
        if isinstance(self._channels, list):
            return self._channels

        path = self._channels_file_path()
        if not path:
            self._channels = []
            return self._channels

        if not os.path.exists(path):
            self._channels = []
            return self._channels

        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            logger.error('load youtube channels failed path=%s err=%s', path, str(e))
            self._channels = []
            return self._channels

        if not isinstance(data, list):
            self._channels = []
            return self._channels

        self._channels = data
        return self._channels

    def _get_channel_url_by_id(self, channel_id):
        channels = self._load_channels()
        if not channels:
            return None

        for channel in channels:
            if not isinstance(channel, dict):
                continue

            cid = channel.get('id')
            if cid != channel_id:
                continue

            url = channel.get('url')
            if not url:
                continue
            return url

        return None

    def _channels_file_path(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.abspath(os.path.join(current_dir, '..', 'data'))
        return os.path.join(data_dir, 'youtube_channels.json')

    def _normalize_channel_videos_url(self, channel_url):
        if not channel_url:
            return channel_url

        parsed = urlparse(channel_url)
        if not parsed.scheme:
            return channel_url

        if parsed.path.endswith('/videos'):
            return channel_url

        return channel_url.rstrip('/') + '/videos'

    def _video_watch_url(self, video_id):
        return f'https://www.youtube.com/watch?v={video_id}'

    def _yt_dlp_lang_args(self):
        return ['--extractor-args', 'youtube:lang=zh-CN']

    def _ensure_mp4_hint(self, url):
        if not url:
            return url

        lower_url = url.lower()
        if 'mp4' in lower_url:
            return url

        join_char = '&' if '?' in url else '?'
        return f'{url}{join_char}__netcom_format=mp4'

    def _yt_dlp_json(self, args, timeout=30):
        output = self._run_yt_dlp(args, timeout)
        if not output:
            return None

        content = output.strip()
        if not content:
            return None

        try:
            return json.loads(content)
        except Exception as e:
            logger.error('yt-dlp json parse failed err=%s output=%s', str(e), content[:300])
            return None

    def _yt_dlp_first_url(self, args, timeout=30):
        output = self._run_yt_dlp(args, timeout)
        if not output:
            return None

        lines = [line.strip() for line in output.splitlines() if line and line.strip()]
        if not lines:
            return None

        return lines[0]

    def _yt_dlp_common_args(self):
        args = []

        if sys.platform.startswith('linux'):
            cookies_path = '/root/yt_cookies.txt'
            if os.path.exists(cookies_path):
                args.extend(['--cookies', cookies_path])
            else:
                logger.warning('youtube cookies file missing path=%s', cookies_path)

            node_runtime = '/usr/bin/node'
            if os.path.exists(node_runtime):
                args.extend(['--js-runtimes', f'node:{node_runtime}'])
            else:
                logger.warning('node runtime missing path=%s for youtube scraper', node_runtime)

        return args

    def _run_yt_dlp(self, args, timeout=30):
        if not args:
            return None

        cmd = self._resolve_yt_dlp_cmd()
        if not cmd:
            logger.error('yt-dlp not found in PATH and python -m yt_dlp unavailable')
            return None

        cmd.extend(self._yt_dlp_common_args())
        cmd.extend(args)
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        except Exception as e:
            logger.error('yt-dlp run failed cmd=%s err=%s', ' '.join(cmd), str(e))
            return None

        if result.returncode != 0:
            stderr = (result.stderr or '').strip()
            logger.error('yt-dlp failed cmd=%s code=%s stderr=%s', ' '.join(cmd), result.returncode, stderr[-600:])
            return None

        return result.stdout

    def _resolve_yt_dlp_cmd(self):
        yt_dlp_path = shutil.which('yt-dlp')
        if yt_dlp_path:
            return [yt_dlp_path]

        if sys.executable:
            return [sys.executable, '-m', 'yt_dlp']

        return None

    def _pick_thumbnail(self, data):
        if not isinstance(data, dict):
            return None

        thumb = data.get('thumbnail')
        if thumb:
            return thumb

        thumbs = data.get('thumbnails')
        if not isinstance(thumbs, list) or not thumbs:
            return None

        best = None
        best_width = -1
        for item in thumbs:
            if not isinstance(item, dict):
                continue

            url = item.get('url')
            if not url:
                continue

            width = item.get('width')
            width_value = width if isinstance(width, int) else -1
            if width_value > best_width:
                best_width = width_value
                best = url

        return best

    def _get_cached_video(self, video_id):
        if not video_id:
            return None

        value = self._video_cache.get(video_id)
        if not isinstance(value, dict):
            return None

        return value

    def _put_cached_video(self, video_id, detail):
        if not video_id or not isinstance(detail, dict):
            return

        if len(self._video_cache) > 2000:
            self._video_cache.clear()

        self._video_cache[video_id] = detail

    def _contains_cjk(self, text):
        if not text or not isinstance(text, str):
            return False

        for ch in text:
            if '\u4e00' <= ch <= '\u9fff':
                return True

        return False
