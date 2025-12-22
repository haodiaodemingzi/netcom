from flask import Blueprint, request, jsonify, Response
from services.scraper_factory import ScraperFactory
from services.cache import cache_response
from utils.decorators import (
    handle_errors, get_source_param, get_pagination_params,
    success_response, error_response
)
from config import COMIC_SOURCES
import logging
import requests

logger = logging.getLogger(__name__)

comic_bp = Blueprint('comic', __name__)

@comic_bp.route('/source-config', methods=['GET'])
def get_source_config():
    """获取数据源配置（用于前端动态获取下载配置）"""
    source = request.args.get('source', None)
    
    if not source:
        return jsonify({'error': '缺少source参数'}), 400
    
    source_config = COMIC_SOURCES.get(source, {})
    if not source_config:
        return jsonify({'error': f'未知数据源: {source}'}), 404
    
    return jsonify({
        'source': source,
        'name': source_config.get('name', ''),
        'base_url': source_config.get('base_url', ''),
        'download_config': source_config.get('download_config', {})
    }), 200

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
        
        # 从配置中获取该数据源的下载配置
        source_config = COMIC_SOURCES.get(source, {})
        dl_config = source_config.get('download_config', {})
        base_url = source_config.get('base_url', '')
        
        # 构建下载配置信息（从后端配置动态获取）
        download_config = {
            'base_url': base_url,
            'referer': dl_config.get('referer', base_url + '/'),
            'cookie_url': dl_config.get('cookie_url', base_url + '/'),
            'headers': dl_config.get('headers', {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            })
        }
        
        # 返回图片列表和下载配置
        response_data = {
            'success': True,
            'data': {
                'images': result['images'],
                'total': result['total'],
                'expected_total': result.get('expected_total', result['total']),
                'download_config': download_config,
                'chapter_id': chapter_id,
                'source': source
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

@comic_bp.route('/proxy/image', methods=['GET'])
def proxy_image():
    """图片代理: 服务端代为拉取目标图片, 解决前端 CORS / Cookie 问题"""
    target_url = request.args.get('url', '').strip()
    source = request.args.get('source', None)
    
    if not target_url:
        return jsonify({'error': '缺少 url 参数'}), 400
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
        download_config = {}
        if source:
            source_config = COMIC_SOURCES.get(source, {})
            download_config = source_config.get('download_config', {})
            if isinstance(download_config, dict):
                extra_headers = download_config.get('headers', {})
                if isinstance(extra_headers, dict):
                    headers.update({str(k): str(v) for k, v in extra_headers.items()})
                if download_config.get('referer'):
                    headers.setdefault('Referer', download_config.get('referer'))
        session = requests.Session()
        session.headers.update(headers)
        
        # 若配置了 cookie_url, 先访问以获取 Set-Cookie
        cookie_url = ''
        if isinstance(download_config, dict):
            cookie_url = download_config.get('cookie_url') or ''
        if cookie_url:
            try:
                session.get(cookie_url, timeout=8, allow_redirects=True)
            except Exception as _:
                pass
        
        resp = session.get(target_url, timeout=12, allow_redirects=True, stream=True)
        if not resp.ok:
            return jsonify({'error': f'拉取失败: {resp.status_code}'}), resp.status_code
        
        content_type = resp.headers.get('Content-Type', 'application/octet-stream')
        return Response(resp.content, status=200, content_type=content_type)
    except Exception as e:
        logger.error(f"代理下载失败: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
