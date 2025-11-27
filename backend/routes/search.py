from flask import Blueprint, request, jsonify
from services.scraper_factory import ScraperFactory
from services.cache import cache_response

search_bp = Blueprint('search', __name__)

@search_bp.route('/comics/search', methods=['GET'])
def search_comics():
    """搜索漫画"""
    keyword = request.args.get('keyword', '')
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    if not keyword:
        return jsonify({
            'error': '搜索关键词不能为空'
        }), 400
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        data = scraper.search_comics(keyword, page, limit)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@search_bp.route('/search/hot', methods=['GET'])
@cache_response(timeout=3600, key_prefix='hot_search')
def get_hot_searches():
    """获取热门搜索"""
    hot_keywords = [
        '海贼王',
        '火影忍者',
        '进击的巨人',
        '鬼灭之刃',
        '咒术回战',
        '间谍过家家',
        '我的英雄学院',
        '东京喰种',
    ]
    
    return jsonify({
        'keywords': hot_keywords
    }), 200
