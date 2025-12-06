from flask import Blueprint, request, jsonify, Response, stream_with_context
from services.video_scraper_factory import VideoScraperFactory
import logging
import requests
from urllib.parse import urlparse, urlencode
import subprocess
import os
import tempfile
import threading
import time
from datetime import datetime

logger = logging.getLogger(__name__)

video_bp = Blueprint('video', __name__)

@video_bp.route('/videos/sources', methods=['GET'])
def get_sources():
    """获取所有可用的视频数据源"""
    try:
        sources = VideoScraperFactory.get_sources_dict()
        return jsonify({'sources': sources}), 200
    except Exception as e:
        logger.error(f"获取数据源列表失败: {str(e)}")
        return jsonify({
            'sources': {
                'thanju': {
                    'name': '热播韩剧网',
                    'description': '热播韩剧网(thanju.com) - 提供最新韩剧资源'
                }
            }
        }), 200

@video_bp.route('/videos/categories', methods=['GET'])
def get_categories():
    """获取视频分类列表"""
    source = request.args.get('source', 'thanju')
    
    try:
        scraper = VideoScraperFactory.create_scraper(source)
        categories = scraper.get_categories()
        return jsonify(categories), 200
    except Exception as e:
        logger.error(f"获取分类列表失败: {str(e)}")
        return jsonify([]), 200

@video_bp.route('/videos/series', methods=['GET'])
def get_series_list():
    """获取视频列表"""
    category = request.args.get('category', 'hot')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    source = request.args.get('source', 'thanju')
    
    try:
        scraper = VideoScraperFactory.create_scraper(source)
        videos = scraper.get_videos_by_category(category, page, limit)
        
        return jsonify({
            'series': videos,
            'hasMore': len(videos) >= limit,
            'total': len(videos)
        }), 200
    except Exception as e:
        logger.error(f"获取视频列表失败: {str(e)}")
        return jsonify({
            'series': [],
            'hasMore': False,
            'total': 0
        }), 200

@video_bp.route('/videos/series/<series_id>', methods=['GET'])
def get_series_detail(series_id):
    """获取视频详情"""
    source = request.args.get('source', 'thanju')
    
    try:
        scraper = VideoScraperFactory.create_scraper(source)
        detail = scraper.get_video_detail(series_id)
        
        if detail:
            return jsonify(detail), 200
        else:
            return jsonify({'error': '视频不存在'}), 404
    except Exception as e:
        logger.error(f"获取视频详情失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@video_bp.route('/videos/series/<series_id>/episodes', methods=['GET'])
def get_episodes(series_id):
    """获取剧集列表"""
    source = request.args.get('source', 'thanju')
    
    try:
        scraper = VideoScraperFactory.create_scraper(source)
        episodes = scraper.get_episodes(series_id)
        
        return jsonify(episodes), 200
    except Exception as e:
        logger.error(f"获取剧集列表失败: {str(e)}")
        return jsonify([]), 200

@video_bp.route('/videos/episodes/<episode_id>', methods=['GET'])
def get_episode_detail(episode_id):
    """获取单个剧集详情"""
    source = request.args.get('source', 'thanju')
    
    try:
        logger.info(f"获取剧集详情: episode_id={episode_id}, source={source}")
        scraper = VideoScraperFactory.create_scraper(source)
        episode = scraper.get_episode_detail(episode_id)
        
        logger.info(f"剧集详情结果: episode={episode is not None}, videoUrl={episode.get('videoUrl') if episode else None}")
        
        if episode:
            return jsonify(episode), 200
        else:
            logger.warning(f"剧集不存在: episode_id={episode_id}")
            return jsonify({'error': '剧集不存在'}), 404
    except Exception as e:
        logger.error(f"获取剧集详情失败: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

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

@video_bp.route('/videos/proxy', methods=['GET'])
def proxy_video():
    """代理视频流，添加必要的请求头（Referer、Cookie等）"""
    video_url = request.args.get('url')
    series_id = request.args.get('series_id')
    source = request.args.get('source', 'thanju')
    
    if not video_url:
        return jsonify({'error': '缺少视频URL参数'}), 400
    
    try:
        # 根据数据源设置请求头
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
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
        
        # 转发Range请求头（用于视频断点续传）
        if 'Range' in request.headers:
            headers['Range'] = request.headers['Range']
        
        # 请求视频流
        response = requests.get(
            video_url,
            headers=headers,
            stream=True,
            timeout=30,
            verify=True
        )
        
        # 设置响应头
        response_headers = {}
        
        # 检查是否是m3u8文件，设置正确的Content-Type
        if video_url.endswith('.m3u8') or 'm3u8' in video_url:
            response_headers['Content-Type'] = 'application/vnd.apple.mpegurl'
            # 对于m3u8文件，需要处理文本内容，可能需要修改其中的URL
            # 但先尝试直接返回，看看是否能正常工作
        elif 'Content-Type' in response.headers:
            response_headers['Content-Type'] = response.headers['Content-Type']
        else:
            # 默认Content-Type
            response_headers['Content-Type'] = 'video/mp2t' if video_url.endswith('.ts') else 'application/octet-stream'
        
        if 'Content-Length' in response.headers:
            response_headers['Content-Length'] = response.headers['Content-Length']
        if 'Accept-Ranges' in response.headers:
            response_headers['Accept-Ranges'] = response.headers['Accept-Ranges']
        if 'Content-Range' in response.headers:
            response_headers['Content-Range'] = response.headers['Content-Range']
        
        # 允许跨域
        response_headers['Access-Control-Allow-Origin'] = '*'
        response_headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response_headers['Access-Control-Allow-Headers'] = 'Range'
        
        # 对于m3u8文件，可能需要处理内容
        if video_url.endswith('.m3u8') or 'm3u8' in video_url:
            # 读取m3u8内容
            content = response.text
            # 流式返回m3u8内容
            def generate():
                yield content.encode('utf-8')
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
    
    if not m3u8_url or not episode_id:
        return jsonify({'error': '缺少必要参数'}), 400
    
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
                # 构建 FFmpeg 命令
                # 使用 -c copy 快速复制（如果编码兼容）
                # 如果不行，使用 -c:v libx264 -c:a aac 重新编码
                cmd = [
                    'ffmpeg',
                    '-i', m3u8_url,
                    '-c', 'copy',
                    '-bsf:a', 'aac_adtstoasc',
                    '-y',  # 覆盖已存在的文件
                    output_path
                ]
                
                logger.info(f'开始转换视频: {episode_id}, 命令: {" ".join(cmd)}')
                
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
                
                for line in process.stderr:
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
                    error_msg = process.stderr.read() if process.stderr else '转换失败'
                    with video_conversion_lock:
                        if task_id in video_conversion_tasks:
                            video_conversion_tasks[task_id]['status'] = 'failed'
                            video_conversion_tasks[task_id]['error'] = error_msg
                    logger.error(f'视频转换失败: {episode_id}, 错误: {error_msg}')
                    
            except Exception as e:
                logger.error(f'视频转换异常: {episode_id}, 错误: {str(e)}')
                with video_conversion_lock:
                    if task_id in video_conversion_tasks:
                        video_conversion_tasks[task_id]['status'] = 'failed'
                        video_conversion_tasks[task_id]['error'] = str(e)
        
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

