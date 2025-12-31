from flask import Blueprint, request, jsonify
from services.podcast_scraper_factory import PodcastScraperFactory
from utils.decorators import (
    handle_errors, get_source_param, get_pagination_params,
    success_response
)
import logging

logger = logging.getLogger(__name__)

podcast_bp = Blueprint('podcast', __name__)


@podcast_bp.route('/podcast/sources', methods=['GET'])
@handle_errors("获取数据源列表失败")
def get_sources():
    """获取所有可用数据源"""
    return success_response(PodcastScraperFactory.get_available_sources())


@podcast_bp.route('/podcast/categories', methods=['GET'])
@handle_errors("获取分类列表失败")
def get_categories():
    """获取分类列表"""
    source = get_source_param('fm139')
    scraper = PodcastScraperFactory.get_scraper(source)
    return success_response(scraper.get_categories())


@podcast_bp.route('/podcast/programs', methods=['GET'])
@handle_errors("获取播客列表失败")
def get_programs():
    """获取播客节目列表（按分类）"""
    category = request.args.get('category', 'all')
    page, limit = get_pagination_params()
    source = get_source_param('fm139')
    scraper = PodcastScraperFactory.get_scraper(source)
    return success_response(scraper.get_programs(category, page, limit))


@podcast_bp.route('/podcast/programs/hot', methods=['GET'])
@handle_errors("获取热门播客失败")
def get_hot_programs():
    """获取热门播客"""
    page, limit = get_pagination_params()
    source = get_source_param('fm139')
    scraper = PodcastScraperFactory.get_scraper(source)
    return success_response(scraper.get_hot_programs(page, limit))


@podcast_bp.route('/podcast/programs/latest', methods=['GET'])
@handle_errors("获取最新播客失败")
def get_latest_programs():
    """获取最新播客"""
    page, limit = get_pagination_params()
    source = get_source_param('fm139')
    scraper = PodcastScraperFactory.get_scraper(source)
    return success_response(scraper.get_latest_programs(page, limit))


@podcast_bp.route('/podcast/programs/<program_id>', methods=['GET'])
@handle_errors("获取播客详情失败")
def get_program_detail(program_id):
    """获取播客详情"""
    source = get_source_param('fm139')
    scraper = PodcastScraperFactory.get_scraper(source)
    return success_response(scraper.get_program_detail(program_id))


@podcast_bp.route('/podcast/programs/<program_id>/episodes', methods=['GET'])
@handle_errors("获取单集列表失败")
def get_episodes(program_id):
    """获取节目单集列表"""
    page, limit = get_pagination_params(1, 50)
    source = get_source_param('fm139')
    scraper = PodcastScraperFactory.get_scraper(source)
    return success_response(scraper.get_episodes(program_id, page, limit))


@podcast_bp.route('/podcast/episodes/<episode_id>', methods=['GET'])
@handle_errors("获取单集详情失败")
def get_episode_detail(episode_id):
    """获取单集详情（含音频地址）"""
    source = get_source_param('fm139')
    scraper = PodcastScraperFactory.get_scraper(source)
    return success_response(scraper.get_episode_detail(episode_id))


@podcast_bp.route('/podcast/search', methods=['GET'])
@handle_errors("搜索播客失败")
def search_programs():
    """搜索播客"""
    keyword = request.args.get('keyword', '')
    if not keyword:
        return jsonify({'error': '缺少keyword参数'}), 400

    page, limit = get_pagination_params()
    source = get_source_param('fm139')
    scraper = PodcastScraperFactory.get_scraper(source)
    return success_response(scraper.search(keyword, page, limit))
