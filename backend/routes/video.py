from flask import Blueprint, request, jsonify, Response, stream_with_context
from services.video_scraper_factory import VideoScraperFactory
from utils.decorators import (
    handle_errors, get_source_param, get_pagination_params,
    success_response, not_found_response, bad_request_response
)
import logging
import requests
import re
from urllib.parse import urlparse, urlencode, urljoin, urlsplit, urlunsplit, unquote, quote
import subprocess
import os
import tempfile
import threading
import time
from datetime import datetime

logger = logging.getLogger(__name__)

video_bp = Blueprint('video', __name__)


def _is_blank(value):
    if value is None:
        return True
    if isinstance(value, str):
        return len(value.strip()) == 0
    return False


def _build_proxy_url(target_url, source, series_id, play_referer):
    if _is_blank(target_url):
        return None

    params = {'url': target_url}
    if not _is_blank(source):
        params['source'] = str(source).strip()
    if not _is_blank(series_id):
        params['series_id'] = str(series_id).strip()
    if not _is_blank(play_referer):
        params['play_referer'] = str(play_referer).strip()

    base = request.host_url.rstrip('/') + '/api/videos/proxy'
    return base + '?' + urlencode(params)


def _decode_percent_u(value):
    if _is_blank(value):
        return value

    def repl(m):
        hex_str = m.group(1)
        try:
            return chr(int(hex_str, 16))
        except Exception:
            return m.group(0)

    return re.sub(r'%u([0-9a-fA-F]{4})', repl, str(value))


def _normalize_media_url(raw_url):
    if _is_blank(raw_url):
        return None

    value = str(raw_url).strip().replace('\\/', '/').replace('&amp;', '&')
    if _is_blank(value):
        return None

    for _ in range(3):
        if '%25u' not in value and '%u' not in value and '%' not in value:
            break
        try:
            next_value = unquote(value)
        except Exception:
            break
        if next_value == value:
            break
        value = next_value

    value = _decode_percent_u(value)

    try:
        parts = urlsplit(value)
    except Exception:
        return value

    if _is_blank(parts.scheme) or _is_blank(parts.netloc):
        return value

    path = quote(parts.path or '', safe='/%')
    query = quote(parts.query or '', safe='=&%')
    fragment = quote(parts.fragment or '', safe='')
    return urlunsplit((parts.scheme, parts.netloc, path, query, fragment))


def _rewrite_m3u8_line_uri_attr(line, m3u8_url, source, series_id, play_referer):
    if _is_blank(line) or 'URI="' not in line:
        return line

    m = re.search(r'URI="([^"]+)"', line)
    if not m:
        return line

    uri_value = m.group(1)
    absolute = urljoin(m3u8_url, uri_value)
    proxied = _build_proxy_url(absolute, source, series_id, play_referer)
    if _is_blank(proxied):
        return line

    return line.replace(f'URI="{uri_value}"', f'URI="{proxied}"')


def _rewrite_m3u8_content(m3u8_text, m3u8_url, source, series_id, play_referer):
    if _is_blank(m3u8_text) or _is_blank(m3u8_url):
        return m3u8_text

    lines = str(m3u8_text).splitlines()
    out_lines = []
    for raw in lines:
        line = raw.strip()
        if _is_blank(line):
            out_lines.append('')
            continue

        if line.startswith('#EXT-X-KEY') or line.startswith('#EXT-X-MAP'):
            out_lines.append(_rewrite_m3u8_line_uri_attr(line, m3u8_url, source, series_id, play_referer))
            continue

        if line.startswith('#'):
            out_lines.append(line)
            continue

        absolute = urljoin(m3u8_url, line)
        proxied = _build_proxy_url(absolute, source, series_id, play_referer)
        out_lines.append(proxied or line)

    return '\n'.join(out_lines) + '\n'

@video_bp.route('/videos/sources', methods=['GET'])
@handle_errors("获取数据源列表失败")
def get_sources():
    """获取所有可用的视频数据源"""
    sources = VideoScraperFactory.get_sources_dict()
    return success_response({'sources': sources})

@video_bp.route('/videos/categories', methods=['GET'])
@handle_errors("获取分类列表失败")
def get_categories():
    """获取视频分类列表"""
    source = request.args.get('source', 'thanju')
    scraper = VideoScraperFactory.create_scraper(source)
    return success_response(scraper.get_categories())

@video_bp.route('/videos/series', methods=['GET'])
@handle_errors("获取视频列表失败")
def get_series_list():
    """获取视频列表"""
    category = request.args.get('category', 'hot')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    source = request.args.get('source', 'thanju')
    
    scraper = VideoScraperFactory.create_scraper(source)
    videos = scraper.get_videos_by_category(category, page, limit)
    return success_response({
        'series': videos,
        'hasMore': len(videos) >= limit,
        'total': len(videos)
    })

@video_bp.route('/videos/series/<path:series_id>', methods=['GET'])
@handle_errors("获取视频详情失败")
def get_series_detail(series_id):
    """获取视频详情"""
    source = request.args.get('source', 'thanju')
    scraper = VideoScraperFactory.create_scraper(source)
    detail = scraper.get_video_detail(series_id)
    if detail:
        return success_response(detail)
    return not_found_response("视频不存在")

@video_bp.route('/videos/series/<path:series_id>/episodes', methods=['GET'])
@handle_errors("获取剧集列表失败")
def get_episodes(series_id):
    """获取剧集列表"""
    source = request.args.get('source', 'thanju')
    scraper = VideoScraperFactory.create_scraper(source)
    return success_response(scraper.get_episodes(series_id))

@video_bp.route('/videos/episodes/<path:episode_id>', methods=['GET'])
@handle_errors("获取剧集详情失败")
def get_episode_detail(episode_id):
    """获取单个剧集详情"""
    source = request.args.get('source', 'thanju')
    try:
        scraper = VideoScraperFactory.create_scraper(source)
    except ValueError as e:
        logger.error("获取剧集详情数据源不支持 source=%s episode_id=%s err=%s", source, episode_id, e)
        return bad_request_response(str(e))
    episode = scraper.get_episode_detail(episode_id)
    if episode:
        return success_response(episode)
    return not_found_response("剧集不存在")

@video_bp.route('/videos/episodes/<path:episode_id>/config', methods=['GET'])
@handle_errors("获取剧集配置失败")
def get_episode_config(episode_id):
    """获取剧集播放前的配置
    
    前端会先访问 cookie_url 预热 Cookie
    """
    source = request.args.get('source', 'thanju')
    try:
        scraper = VideoScraperFactory.create_scraper(source)
    except ValueError as e:
        logger.error("获取剧集配置数据源不支持 source=%s episode_id=%s err=%s", source, episode_id, e)
        return bad_request_response(str(e))

    base_url = getattr(scraper, 'base_url', None)
    headers = getattr(scraper, 'headers', None)
    safe_headers = headers if isinstance(headers, dict) else {}

    cookie_url = None
    if base_url:
        cookie_url = base_url.rstrip('/') + '/'

    return jsonify(
        {
            'success': True,
            'data': {
                'cookie_url': cookie_url,
                'headers': safe_headers,
            },
        }
    ), 200

@video_bp.route('/videos/search', methods=['GET'])
def search_videos():
    """搜索视频"""
    keyword = request.args.get('keyword', '')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    source = request.args.get('source', 'thanju')
    
    if not keyword:
        return jsonify({
            'series': [],
            'hasMore': False,
            'total': 0
        }), 200
    
    try:
        scraper = VideoScraperFactory.create_scraper(source)
        videos = scraper.search_videos(keyword, page, limit)
        
        # 判断是否还有更多结果（如果返回的结果数等于limit，可能还有更多）
        has_more = len(videos) >= limit
        
        return jsonify({
            'series': videos,
            'hasMore': has_more,
            'total': len(videos),
            'page': page,
            'limit': limit
        }), 200
    except Exception as e:
        logger.error(f"搜索视频失败: {str(e)}")
        return jsonify({
            'series': [],
            'hasMore': False,
            'total': 0
        }), 200

@video_bp.route('/videos/tags', methods=['GET'])
def get_tags():
    """获取视频标签列表（热搜标签）"""
    source = request.args.get('source', 'thanju')
    limit = int(request.args.get('limit', 100))
    
    try:
        scraper = VideoScraperFactory.create_scraper(source)
        # 检查爬虫是否支持获取标签
        if hasattr(scraper, 'get_tags'):
            tags = scraper.get_tags(limit)
            return jsonify({
                'tags': tags,
                'total': len(tags)
            }), 200
        else:
            return jsonify({
                'tags': [],
                'total': 0,
                'message': '该数据源不支持标签功能'
            }), 200
    except Exception as e:
        logger.error(f"获取标签列表失败: {str(e)}")
        return jsonify({
            'tags': [],
            'total': 0,
            'error': str(e)
        }), 200

@video_bp.route('/videos/tags/<tag_id>', methods=['GET'])
def get_videos_by_tag(tag_id):
    """根据标签获取视频列表"""
    source = request.args.get('source', 'thanju')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 30))
    
    try:
        scraper = VideoScraperFactory.create_scraper(source)
        # 检查爬虫是否支持按标签获取视频
        if hasattr(scraper, 'get_videos_by_tag'):
            videos = scraper.get_videos_by_tag(tag_id, page, limit)
            return jsonify({
                'series': videos,
                'hasMore': len(videos) >= limit,
                'total': len(videos),
                'tag': tag_id
            }), 200
        else:
            return jsonify({
                'series': [],
                'hasMore': False,
                'total': 0,
                'message': '该数据源不支持标签功能'
            }), 200
    except Exception as e:
        logger.error(f"按标签获取视频失败: {str(e)}")
        return jsonify({
            'series': [],
            'hasMore': False,
            'total': 0,
            'error': str(e)
        }), 200

@video_bp.route('/videos/proxy', methods=['GET'])
def proxy_video():
    """代理视频流，添加必要的请求头（Referer、Cookie等）"""
    video_url = request.args.get('url')
    series_id = request.args.get('series_id')
    source = request.args.get('source', 'thanju')
    play_referer = request.args.get('play_referer')
    
    if not video_url:
        return jsonify({'error': '缺少视频URL参数'}), 400

    normalized_url = _normalize_media_url(video_url)
    if not _is_blank(normalized_url):
        video_url = normalized_url
    
    try:
        is_m3u8 = video_url.endswith('.m3u8') or 'm3u8' in video_url

        # 根据数据源设置请求头
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site',
        }
        
        # 根据数据源设置Referer
        if source == 'thanju':
            if series_id:
                headers['Referer'] = f'https://www.thanju.com/detail/{series_id}.html'
            else:
                headers['Referer'] = 'https://www.thanju.com/'
        elif source == 'netflixgc':
            if play_referer:
                headers['Referer'] = play_referer
            elif series_id:
                headers['Referer'] = f'https://www.netflixgc.com/play/{series_id}-1-1.html'
            else:
                headers['Referer'] = 'https://www.netflixgc.com/'
            headers['Origin'] = 'https://www.netflixgc.com'
        elif source == 'badnews' or source == 'badnews_av' or source == '原创视频':
            headers['Referer'] = 'https://bad.news/'
            headers['Origin'] = 'https://bad.news'
        elif source == 'heli999':
            if series_id:
                headers['Referer'] = f'https://www.heli999.com/shipingdetail/{series_id}.html'
            else:
                headers['Referer'] = 'https://www.heli999.com/'
            headers['Origin'] = 'https://www.heli999.com'

        elif source == 'keke6':
            if series_id:
                headers['Referer'] = f'https://www.keke6.app/detail/{series_id}.html'
            else:
                headers['Referer'] = 'https://www.keke6.app/'
            headers['Origin'] = 'https://www.keke6.app'
        
        # 转发Range请求头（用于视频断点续传）
        if 'Range' in request.headers:
            headers['Range'] = request.headers['Range']
        
        # 请求视频流
        response = requests.get(
            video_url,
            headers=headers,
            stream=not is_m3u8,
            timeout=30,
            verify=True
        )
        
        # 设置响应头
        response_headers = {}
        
        # 检查是否是m3u8文件，设置正确的Content-Type
        if is_m3u8:
            response_headers['Content-Type'] = 'application/vnd.apple.mpegurl'
        elif 'Content-Type' in response.headers:
            response_headers['Content-Type'] = response.headers['Content-Type']
        else:
            # 默认Content-Type
            response_headers['Content-Type'] = 'video/mp2t' if video_url.endswith('.ts') else 'application/octet-stream'
        
        if (not is_m3u8) and ('Content-Length' in response.headers):
            response_headers['Content-Length'] = response.headers['Content-Length']
        if 'Accept-Ranges' in response.headers:
            response_headers['Accept-Ranges'] = response.headers['Accept-Ranges']
        if 'Content-Range' in response.headers:
            response_headers['Content-Range'] = response.headers['Content-Range']
        
        # 允许跨域
        response_headers['Access-Control-Allow-Origin'] = '*'
        response_headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response_headers['Access-Control-Allow-Headers'] = 'Range'
        
        if is_m3u8:
            play_referer_value = play_referer
            if _is_blank(play_referer_value) and series_id and source == 'netflixgc':
                play_referer_value = f'https://www.netflixgc.com/detail/{series_id}.html'

            if response.encoding is None or str(response.encoding).lower() == 'iso-8859-1':
                response.encoding = response.apparent_encoding

            effective_m3u8_url = response.url or video_url
            logger.info(
                "m3u8 代理重写 source=%s series_id=%s req_url=%s effective_url=%s",
                source,
                series_id,
                video_url,
                effective_m3u8_url,
            )
            rewritten = _rewrite_m3u8_content(response.text, effective_m3u8_url, source, series_id, play_referer_value)

            def generate():
                yield (rewritten or '').encode('utf-8')
        else:
            # 流式返回视频数据
            def generate():
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk
        
        return Response(
            stream_with_context(generate()),
            status=response.status_code,
            headers=response_headers
        )
        
    except requests.RequestException as e:
        logger.error(f"代理视频失败: {str(e)}")
        return jsonify({'error': f'代理视频失败: {str(e)}'}), 500
    except Exception as e:
        logger.error(f"代理视频异常: {str(e)}")
        return jsonify({'error': f'代理视频异常: {str(e)}'}), 500

# 视频转换任务存储（用于跟踪转换进度）
video_conversion_tasks = {}
video_conversion_lock = threading.Lock()

@video_bp.route('/videos/convert', methods=['POST'])
def convert_video():
    """将 m3u8 转换为 mp4（异步转换，返回任务ID）"""
    data = request.get_json()
    m3u8_url = data.get('m3u8_url')
    episode_id = data.get('episode_id')
    series_id = data.get('series_id')
    source = data.get('source', 'thanju')
    play_referer = data.get('play_referer')
    
    if not m3u8_url or not episode_id:
        return jsonify({'error': '缺少必要参数'}), 400

    normalized_m3u8 = _normalize_media_url(m3u8_url)
    if not _is_blank(normalized_m3u8):
        m3u8_url = normalized_m3u8
    
    try:
        # 检查 FFmpeg 是否可用
        try:
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True, timeout=5)
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            return jsonify({'error': 'FFmpeg 未安装或不可用。请安装 FFmpeg: https://ffmpeg.org/download.html'}), 500
        
        # 创建临时目录存储转换后的文件
        temp_dir = tempfile.gettempdir()
        output_dir = os.path.join(temp_dir, 'netcom_videos', series_id or 'default')
        os.makedirs(output_dir, exist_ok=True)
        
        output_path = os.path.join(output_dir, f'{episode_id}.mp4')
        
        # 检查文件是否已存在
        if os.path.exists(output_path):
            return jsonify({
                'success': True,
                'task_id': f'{episode_id}_converted',
                'status': 'completed',
                'download_url': f'/api/videos/download/{series_id or "default"}/{episode_id}.mp4',
                'message': '视频已转换'
            }), 200
        
        # 创建转换任务
        task_id = f'{episode_id}_{int(time.time())}'
        
        with video_conversion_lock:
            video_conversion_tasks[task_id] = {
                'episode_id': episode_id,
                'series_id': series_id,
                'm3u8_url': m3u8_url,
                'output_path': output_path,
                'status': 'processing',
                'progress': 0,
                'started_at': datetime.now().isoformat(),
                'error': None
            }
        
        # 在后台线程中执行转换
        def convert_in_background():
            try:
                # 根据数据源设置请求头
                headers = []
                if source == 'thanju':
                    if series_id:
                        referer = f'https://www.thanju.com/detail/{series_id}.html'
                    else:
                        referer = 'https://www.thanju.com/'
                    headers.append(f'Referer: {referer}')
                elif source == 'netflixgc':
                    if play_referer:
                        referer = play_referer
                    elif series_id:
                        referer = f'https://www.netflixgc.com/detail/{series_id}.html'
                    else:
                        referer = 'https://www.netflixgc.com/'
                    headers.append(f'Referer: {referer}')
                    headers.append('Origin: https://www.netflixgc.com')
                elif source == 'badnews' or source == 'badnews_av' or source == '原创视频':
                    headers.append('Referer: https://bad.news/')
                    headers.append('Origin: https://bad.news')
                elif source == 'heli999':
                    if series_id:
                        headers.append(f'Referer: https://www.heli999.com/shipingdetail/{series_id}.html')
                    else:
                        headers.append('Referer: https://www.heli999.com/')
                    headers.append('Origin: https://www.heli999.com')

                # 添加通用请求头
                headers.append('User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
                
                # 处理 m3u8 文件
                import requests as req_lib
                import re
                from urllib.parse import urljoin, urlparse
                import concurrent.futures
                
                input_url = m3u8_url  # 默认使用原始 URL
                use_concat_method = False  # 是否使用concat方法（用于.jpeg等非标准扩展名）
                concat_list_path = None
                segments_dir = None
                
                try:
                    # 下载 m3u8 文件内容
                    response_headers = {}
                    for h in headers:
                        if ':' in h:
                            key, value = h.split(':', 1)
                            response_headers[key.strip()] = value.strip()
                    
                    m3u8_response = req_lib.get(m3u8_url, headers=response_headers, timeout=30)
                    m3u8_response.raise_for_status()
                    m3u8_content = m3u8_response.text
                    
                    # 检查是否包含非标准扩展名（如 .jpeg, .jpg, .png 等）
                    # FFmpeg HLS demuxer 对这些扩展名有硬编码限制，需要使用 concat 方法
                    if re.search(r'\.(jpeg|jpg|png|gif|webp)(\?|$|\s)', m3u8_content, re.IGNORECASE):
                        logger.info(f'检测到非标准扩展名，使用分片下载+concat方法: {episode_id}')
                        use_concat_method = True
                        
                        # 解析 m3u8 URL 的 base URL
                        parsed_url = urlparse(m3u8_url)
                        base_url = f'{parsed_url.scheme}://{parsed_url.netloc}{os.path.dirname(parsed_url.path)}/'
                        
                        # 提取所有分片URL
                        segment_urls = []
                        lines = m3u8_content.split('\n')
                        for line in lines:
                            line = line.strip()
                            if line and not line.startswith('#'):
                                if not line.startswith('http://') and not line.startswith('https://'):
                                    segment_urls.append(urljoin(base_url, line))
                                else:
                                    segment_urls.append(line)
                        
                        logger.info(f'共发现 {len(segment_urls)} 个分片')
                        
                        # 创建临时目录存放分片
                        temp_dir = tempfile.gettempdir()
                        segments_dir = os.path.join(temp_dir, 'netcom_videos', series_id or 'default', 'segments', episode_id)
                        os.makedirs(segments_dir, exist_ok=True)
                        
                        # 并发下载分片（限制并发数以避免被封）
                        downloaded_segments = []
                        failed_count = 0
                        total_segments = len(segment_urls)
                        
                        def download_segment(args):
                            idx, url = args
                            segment_path = os.path.join(segments_dir, f'segment_{idx:06d}.ts')
                            try:
                                # 如果文件已存在且大小>0，跳过下载
                                if os.path.exists(segment_path) and os.path.getsize(segment_path) > 0:
                                    return (idx, segment_path, True)
                                
                                resp = req_lib.get(url, headers=response_headers, timeout=60)
                                resp.raise_for_status()
                                with open(segment_path, 'wb') as f:
                                    f.write(resp.content)
                                return (idx, segment_path, True)
                            except Exception as e:
                                logger.warning(f'下载分片 {idx} 失败: {e}')
                                return (idx, segment_path, False)
                        
                        # 使用线程池并发下载，同时更新进度
                        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                            futures = {executor.submit(download_segment, (i, url)): i for i, url in enumerate(segment_urls)}
                            completed = 0
                            for future in concurrent.futures.as_completed(futures):
                                idx, segment_path, success = future.result()
                                completed += 1
                                if success:
                                    downloaded_segments.append((idx, segment_path))
                                else:
                                    failed_count += 1
                                
                                # 更新下载进度（占总进度的80%）
                                download_progress = (completed / total_segments) * 0.8
                                with video_conversion_lock:
                                    if task_id in video_conversion_tasks:
                                        video_conversion_tasks[task_id]['progress'] = download_progress
                                        video_conversion_tasks[task_id]['status'] = f'downloading ({completed}/{total_segments})'
                                
                                # 每200个分片打印一次日志
                                if completed % 200 == 0:
                                    logger.info(f'分片下载进度: {completed}/{total_segments}')
                        
                        logger.info(f'分片下载完成: {len(downloaded_segments)} 成功, {failed_count} 失败')
                        
                        if len(downloaded_segments) == 0:
                            raise Exception('所有分片下载失败')
                        
                        # 按序号排序
                        downloaded_segments.sort(key=lambda x: x[0])
                        
                        # 创建 concat 列表文件
                        concat_list_path = os.path.join(segments_dir, 'concat_list.txt')
                        with open(concat_list_path, 'w', encoding='utf-8') as f:
                            for idx, segment_path in downloaded_segments:
                                # concat demuxer 需要使用正斜杠，并且路径需要转义单引号
                                safe_path = segment_path.replace('\\', '/').replace("'", "'\\''")
                                f.write(f"file '{safe_path}'\n")
                        
                        input_url = concat_list_path
                        
                        # 更新状态
                        with video_conversion_lock:
                            if task_id in video_conversion_tasks:
                                video_conversion_tasks[task_id]['status'] = 'merging'
                    else:
                        pass  # 标准HLS方法
                        
                except Exception as m3u8_error:
                    logger.warning(f'处理 m3u8 文件失败: {m3u8_error}')
                    # 如果处理失败，仍尝试使用原始URL（可能会失败）
                    input_url = m3u8_url
                    use_concat_method = False
                
                # 构建 FFmpeg 命令
                cmd = ['ffmpeg']
                
                if use_concat_method:
                    # 使用 concat demuxer 合并下载的分片
                    cmd.extend([
                        '-f', 'concat',
                        '-safe', '0',  # 允许绝对路径
                        '-i', input_url,
                        '-c', 'copy',
                        '-bsf:a', 'aac_adtstoasc',
                        '-movflags', '+faststart',
                        '-y',
                        output_path
                    ])
                else:
                    # 使用标准 HLS 方法
                    cmd.extend(['-protocol_whitelist', 'file,http,https,tcp,tls,crypto'])
                    
                    if headers:
                        headers_str = '\r\n'.join(headers) + '\r\n'
                        cmd.extend(['-headers', headers_str])
                    
                    cmd.extend(['-allowed_extensions', 'ALL'])
                    cmd.extend([
                        '-i', input_url,
                        '-c', 'copy',
                        '-bsf:a', 'aac_adtstoasc',
                        '-movflags', '+faststart',
                        '-y',
                        output_path
                    ])
                
                logger.info(f'开始转换视频: {episode_id}')
                
                # 执行 FFmpeg 转换
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    universal_newlines=True
                )
                
                # 解析进度（从 stderr 读取）
                duration = 0
                current_time = 0
                stderr_output = []
                
                for line in process.stderr:
                    stderr_output.append(line)
                    # 提取总时长
                    if 'Duration:' in line:
                        duration_match = line.split('Duration:')[1].split(',')[0].strip()
                        try:
                            time_parts = duration_match.split(':')
                            duration = int(time_parts[0]) * 3600 + int(time_parts[1]) * 60 + float(time_parts[2])
                        except:
                            pass
                    
                    # 提取当前时间
                    if 'time=' in line:
                        time_match = line.split('time=')[1].split(' ')[0]
                        try:
                            time_parts = time_match.split(':')
                            current_time = int(time_parts[0]) * 3600 + int(time_parts[1]) * 60 + float(time_parts[2])
                            if duration > 0:
                                progress = min(current_time / duration, 1.0)
                                with video_conversion_lock:
                                    if task_id in video_conversion_tasks:
                                        video_conversion_tasks[task_id]['progress'] = progress
                        except:
                            pass
                
                # 等待进程完成
                process.wait()
                
                if process.returncode == 0 and os.path.exists(output_path):
                    with video_conversion_lock:
                        if task_id in video_conversion_tasks:
                            video_conversion_tasks[task_id]['status'] = 'completed'
                            video_conversion_tasks[task_id]['progress'] = 1.0
                    logger.info(f'视频转换完成: {episode_id}')
                else:
                    # 获取完整的错误信息
                    error_msg = '\n'.join(stderr_output[-20:]) if stderr_output else f'FFmpeg 返回码: {process.returncode}'
                    with video_conversion_lock:
                        if task_id in video_conversion_tasks:
                            video_conversion_tasks[task_id]['status'] = 'failed'
                            video_conversion_tasks[task_id]['error'] = error_msg
                    logger.error(f'视频转换失败: {episode_id}, 返回码: {process.returncode}')
                    logger.error(f'FFmpeg 错误输出: {error_msg}')
                
                # 清理临时分片文件（无论成功还是失败）
                if use_concat_method and segments_dir and os.path.exists(segments_dir):
                    try:
                        import shutil
                        shutil.rmtree(segments_dir)
                        logger.info(f'已清理临时分片目录: {segments_dir}')
                    except Exception as cleanup_error:
                        logger.warning(f'清理临时分片目录失败: {cleanup_error}')
                    
            except Exception as e:
                logger.error(f'视频转换异常: {episode_id}, 错误: {str(e)}')
                with video_conversion_lock:
                    if task_id in video_conversion_tasks:
                        video_conversion_tasks[task_id]['status'] = 'failed'
                        video_conversion_tasks[task_id]['error'] = str(e)
                
                # 异常时也要清理
                if segments_dir and os.path.exists(segments_dir):
                    try:
                        import shutil
                        shutil.rmtree(segments_dir)
                        logger.info(f'异常后已清理临时分片目录: {segments_dir}')
                    except:
                        pass
        
        # 启动后台转换线程
        thread = threading.Thread(target=convert_in_background, daemon=True)
        thread.start()
        
        return jsonify({
            'success': True,
            'task_id': task_id,
            'status': 'processing',
            'message': '转换任务已启动'
        }), 202
        
    except Exception as e:
        logger.error(f"启动视频转换失败: {str(e)}", exc_info=True)
        return jsonify({'error': f'启动转换失败: {str(e)}'}), 500

@video_bp.route('/videos/convert/status/<task_id>', methods=['GET'])
def get_convert_status(task_id):
    """获取视频转换状态"""
    with video_conversion_lock:
        task = video_conversion_tasks.get(task_id)
    
    if not task:
        return jsonify({'error': '任务不存在'}), 404
    
    response_data = {
        'task_id': task_id,
        'status': task['status'],
        'progress': task['progress'],
        'started_at': task['started_at'],
    }
    
    if task['status'] == 'completed':
        response_data['download_url'] = f'/api/videos/download/{task["series_id"] or "default"}/{task["episode_id"]}.mp4'
    elif task['status'] == 'failed':
        response_data['error'] = task['error']
    
    return jsonify(response_data), 200

@video_bp.route('/videos/download/<series_id>/<episode_id>.mp4', methods=['GET'])
def download_converted_video(series_id, episode_id):
    """下载转换后的 mp4 视频文件，下载完成后删除服务器上的临时文件"""
    file_path = None
    try:
        temp_dir = tempfile.gettempdir()
        file_path = os.path.join(temp_dir, 'netcom_videos', series_id, f'{episode_id}.mp4')
        
        if not os.path.exists(file_path):
            return jsonify({'error': '文件不存在'}), 404
        
        file_size = os.path.getsize(file_path)
        
        def generate():
            nonlocal file_path
            file_handle = None
            try:
                file_handle = open(file_path, 'rb')
                while True:
                    chunk = file_handle.read(8192)
                    if not chunk:
                        break
                    yield chunk
            finally:
                # 关闭文件句柄
                if file_handle:
                    try:
                        file_handle.close()
                    except:
                        pass
                
                # 下载完成后删除文件（延迟一点确保文件已关闭）
                def delete_file_after_delay():
                    time.sleep(1)  # 等待1秒确保文件流完全关闭
                    try:
                        if file_path and os.path.exists(file_path):
                            os.remove(file_path)
                            logger.info(f'已删除临时视频文件: {file_path}')
                            
                            # 如果目录为空，也删除目录
                            series_dir = os.path.dirname(file_path)
                            if os.path.exists(series_dir) and not os.listdir(series_dir):
                                os.rmdir(series_dir)
                                logger.info(f'已删除空目录: {series_dir}')
                    except Exception as delete_error:
                        logger.error(f'删除临时文件失败: {file_path}, 错误: {str(delete_error)}')
                
                # 在后台线程中删除文件
                threading.Thread(target=delete_file_after_delay, daemon=True).start()
        
        return Response(
            stream_with_context(generate()),
            mimetype='video/mp4',
            headers={
                'Content-Type': 'video/mp4',
                'Content-Length': str(file_size),
                'Content-Disposition': f'attachment; filename="{episode_id}.mp4"',
                'Access-Control-Allow-Origin': '*',
            }
        )
        
    except Exception as e:
        logger.error(f"下载转换后的视频失败: {str(e)}")
        # 如果出错，也尝试删除文件
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f'出错后已删除临时视频文件: {file_path}')
        except:
            pass
        return jsonify({'error': f'下载失败: {str(e)}'}), 500

