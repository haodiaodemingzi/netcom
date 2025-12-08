from flask import Blueprint, request, jsonify
from services.scraper_factory import ScraperFactory
from services.cache import cache_response
from utils.decorators import (
    handle_errors, get_source_param, get_pagination_params,
    success_response, error_response
)
import logging

logger = logging.getLogger(__name__)

comic_bp = Blueprint('comic', __name__)

@comic_bp.route('/comics/hot', methods=['GET'])
@cache_response(timeout=300, key_prefix='hot')
@handle_errors("获取热门漫画失败")
def get_hot_comics():
    """获取热门漫画"""
    page, limit = get_pagination_params()
    source = get_source_param()
    scraper = ScraperFactory.get_scraper(source)
    return success_response(scraper.get_hot_comics(page, limit))

@comic_bp.route('/comics/latest', methods=['GET'])
@cache_response(timeout=300, key_prefix='latest')
@handle_errors("获取最新漫画失败")
def get_latest_comics():
    """获取最新漫画"""
    page, limit = get_pagination_params()
    source = get_source_param()
    scraper = ScraperFactory.get_scraper(source)
    return success_response(scraper.get_latest_comics(page, limit))

@comic_bp.route('/comics/<comic_id>', methods=['GET'])
@cache_response(timeout=600, key_prefix='detail')
@handle_errors("获取漫画详情失败")
def get_comic_detail(comic_id):
    """获取漫画详情"""
    source = get_source_param()
    scraper = ScraperFactory.get_scraper(source)
    return success_response(scraper.get_comic_detail(comic_id))

@comic_bp.route('/comics/<comic_id>/chapters', methods=['GET'])
@cache_response(timeout=600, key_prefix='chapters')
@handle_errors("获取章节列表失败")
def get_chapters(comic_id):
    """获取章节列表"""
    source = get_source_param()
    scraper = ScraperFactory.get_scraper(source)
    return success_response(scraper.get_chapters(comic_id))

@comic_bp.route('/chapters/<chapter_id>/images/<int:page>', methods=['GET'])
@cache_response(timeout=1800, key_prefix='image_page')
def get_chapter_image_by_page(chapter_id, page):
    """获取章节的单张图片"""
    source = request.args.get('source', None)
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        data = scraper.get_chapter_images(chapter_id)
        images = data.get('images', []) if isinstance(data, dict) else []
        total = data.get('total', len(images)) if isinstance(data, dict) else len(images)
        
        if page < 1 or page > total:
            return jsonify({'error': '页码超出范围', 'page': page, 'total': total}), 400
        
        image = images[page - 1]
        result = {
            'page': page,
            'url': image.get('url'),
            'total': total
        }
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"获取单页图片失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/chapters/<chapter_id>/images', methods=['GET'])
@cache_response(timeout=1800, key_prefix='images')
@handle_errors("获取章节图片失败")
def get_chapter_images(chapter_id):
    """获取章节图片"""
    source = get_source_param()
    scraper = ScraperFactory.get_scraper(source)
    return success_response(scraper.get_chapter_images(chapter_id))

@comic_bp.route('/categories', methods=['GET'])
@handle_errors("获取分类列表失败")
def get_categories():
    """获取分类列表"""
    source = get_source_param()
    scraper = ScraperFactory.get_scraper(source)
    return success_response(scraper.get_categories())

@comic_bp.route('/comics/category', methods=['GET'])
def get_comics_by_category():
    """按分类获取漫画"""
    category = request.args.get('category', 'all')
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        
        # 如果是特殊分类,使用原有逻辑
        if category == 'completed':
            data = scraper.get_hot_comics(page, limit)
        elif category == 'ongoing':
            data = scraper.get_latest_comics(page, limit)
        else:
            # 使用新的分类接口
            data = scraper.get_comics_by_category(category, page, limit)
        
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"按分类获取漫画失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/chapters/<chapter_id>/download-info', methods=['GET'])
def get_chapter_download_info(chapter_id):
    """获取章节下载信息 - 返回所有图片链接供前端下载"""
    source = request.args.get('source', None)
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        
        # 获取章节图片信息
        result = scraper.get_chapter_images(chapter_id)
        
        if not result or not result.get('images'):
            return jsonify({
                'success': False,
                'message': '未找到章节图片',
                'data': {
                    'images': [],
                    'total': 0,
                    'download_config': {}
                }
            }), 404
        
        # 构建下载配置信息
        download_config = {
            'base_url': 'https://xmanhua.com',
            'headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
                'Referer': 'https://xmanhua.com/',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            },
            'cookie_urls': [
                'https://xmanhua.com/',
            ]
        }
        
        # 返回图片列表和下载配置
        response_data = {
            'success': True,
            'data': {
                'images': result['images'],
                'total': result['total'],
                'expected_total': result.get('expected_total', result['total']),
                'download_config': download_config,
                'chapter_id': chapter_id
            }
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"获取章节下载信息失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': str(e),
            'data': {
                'images': [],
                'total': 0,
                'download_config': {}
            }
        }), 500
