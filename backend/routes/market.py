from flask import Blueprint, request, jsonify
from services.source_market import SourceMarket
import logging

logger = logging.getLogger(__name__)

market_bp = Blueprint('market', __name__)

# 初始化数据源市场服务
source_market = SourceMarket()

@market_bp.route('/market/sources', methods=['GET'])
def get_market_sources():
    """获取市场数据源列表"""
    try:
        category = request.args.get('category', 'all')
        search = request.args.get('search', '').strip()
        
        if search:
            # 搜索数据源
            sources = source_market.search_sources(search, category)
        else:
            # 按分类获取
            sources = source_market.get_sources_by_category(category)
        
        return jsonify({
            'sources': sources,
            'total': len(sources),
            'category': category,
            'search': search
        }), 200
    except Exception as e:
        logger.error(f"获取市场数据源失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'sources': [],
            'total': 0,
            'error': str(e)
        }), 500

@market_bp.route('/market/sources/<source_id>', methods=['GET'])
def get_source_detail(source_id):
    """获取数据源详情"""
    try:
        source = source_market.get_source_by_id(source_id)
        
        if not source:
            return jsonify({'error': '数据源不存在'}), 404
        
        return jsonify(source), 200
    except Exception as e:
        logger.error(f"获取数据源详情失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@market_bp.route('/market/categories', methods=['GET'])
def get_market_categories():
    """获取市场分类列表"""
    try:
        categories = source_market.get_categories()
        return jsonify({
            'categories': categories,
            'total': len(categories)
        }), 200
    except Exception as e:
        logger.error(f"获取市场分类失败: {str(e)}")
        return jsonify({
            'categories': [],
            'total': 0,
            'error': str(e)
        }), 500

