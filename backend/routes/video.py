from flask import Blueprint, request, jsonify
from services.video_scraper_factory import VideoScraperFactory
import logging

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
        scraper = VideoScraperFactory.create_scraper(source)
        episode = scraper.get_episode_detail(episode_id)
        
        if episode:
            return jsonify(episode), 200
        else:
            return jsonify({'error': '剧集不存在'}), 404
    except Exception as e:
        logger.error(f"获取剧集详情失败: {str(e)}")
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
        
        return jsonify({
            'series': videos,
            'hasMore': len(videos) >= limit,
            'total': len(videos)
        }), 200
    except Exception as e:
        logger.error(f"搜索视频失败: {str(e)}")
        return jsonify({
            'series': [],
            'hasMore': False,
            'total': 0
        }), 200

