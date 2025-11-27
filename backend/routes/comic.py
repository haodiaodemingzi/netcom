from flask import Blueprint, request, jsonify
from services.scraper_factory import ScraperFactory
from services.cache import cache_response

comic_bp = Blueprint('comic', __name__)

@comic_bp.route('/comics/hot', methods=['GET'])
@cache_response(timeout=300, key_prefix='hot')
def get_hot_comics():
    """获取热门漫画"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        data = scraper.get_hot_comics(page, limit)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/comics/latest', methods=['GET'])
@cache_response(timeout=300, key_prefix='latest')
def get_latest_comics():
    """获取最新漫画"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        data = scraper.get_latest_comics(page, limit)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/comics/<comic_id>', methods=['GET'])
@cache_response(timeout=600, key_prefix='detail')
def get_comic_detail(comic_id):
    """获取漫画详情"""
    source = request.args.get('source', None)
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        data = scraper.get_comic_detail(comic_id)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/comics/<comic_id>/chapters', methods=['GET'])
@cache_response(timeout=600, key_prefix='chapters')
def get_chapters(comic_id):
    """获取章节列表"""
    source = request.args.get('source', None)
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        data = scraper.get_chapters(comic_id)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/chapters/<chapter_id>/images', methods=['GET'])
@cache_response(timeout=1800, key_prefix='images')
def get_chapter_images(chapter_id):
    """获取章节图片"""
    source = request.args.get('source', None)
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        data = scraper.get_chapter_images(chapter_id)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/comics/category', methods=['GET'])
def get_comics_by_category():
    """按分类获取漫画"""
    category = request.args.get('category', 'all')
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        # 根据分类返回不同数据
        if category == 'completed':
            data = scraper.get_hot_comics(page, limit)
        elif category == 'ongoing':
            data = scraper.get_latest_comics(page, limit)
        else:
            data = scraper.get_hot_comics(page, limit)
        
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
