from flask import Blueprint, request, jsonify
from services.source_market import SourceMarket
from services.activation_service import ActivationService
import logging

logger = logging.getLogger(__name__)

market_bp = Blueprint('market', __name__)

# 初始化数据源市场服务
source_market = SourceMarket()
activation_service = ActivationService()
DEFAULT_VISIBLE_IDS = {"baozimh", "ttkan", "mjwu"}

@market_bp.route('/market/activate', methods=['POST'])
def activate_market():
    """激活码校验"""
    try:
        data = request.get_json(silent=True) or {}
        code = (data.get('code') or '').strip()
        if not code:
            return jsonify({'success': False, 'message': '激活码不能为空'}), 400

        token = activation_service.verify_code(code)
        if not token:
            return jsonify({'success': False, 'message': '无效的激活码'}), 400

        return jsonify({'success': True, 'token': token}), 200
    except Exception as e:
        logger.error(f"激活码校验失败: {str(e)}")
        return jsonify({'success': False, 'message': '服务器错误'}), 500


def _filter_sources_for_guest(sources):
    """未激活时仅保留默认可见数据源"""
    return [item for item in sources if item.get('id') in DEFAULT_VISIBLE_IDS]


@market_bp.route('/market/sources', methods=['GET'])
def get_market_sources():
    """获取市场数据源列表"""
    try:
        category = request.args.get('category', 'all')
        search = request.args.get('search', '').strip()
        # 优先从请求头获取 token，如果没有再从 query parameter 获取
        token = (request.headers.get('X-Activation-Token') or '').strip()
        if not token:
            token = request.args.get('token', '').strip()
        activated = activation_service.is_token_valid(token)

        if search:
            sources = source_market.search_sources(search, category)
        else:
            sources = source_market.get_sources_by_category(category)

        if not activated:
            sources = _filter_sources_for_guest(sources)

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
        # 优先从请求头获取 token，如果没有再从 query parameter 获取
        token = (request.headers.get('X-Activation-Token') or '').strip()
        if not token:
            token = request.args.get('token', '').strip()
        activated = activation_service.is_token_valid(token)
        source = source_market.get_source_by_id(source_id)

        if not source:
            return jsonify({'error': '数据源不存在'}), 404

        if not activated and source.get('id') not in DEFAULT_VISIBLE_IDS:
            return jsonify({'error': '未激活无法查看该数据源'}), 403

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

