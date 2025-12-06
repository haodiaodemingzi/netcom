from flask import Blueprint, request, jsonify, Response, stream_with_context
from services.video_scraper_factory import VideoScraperFactory
import logging
import requests
from urllib.parse import urlparse, urlencode

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

