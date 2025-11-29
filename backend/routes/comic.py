from flask import Blueprint, request, jsonify
from services.scraper_factory import ScraperFactory
from services.cache import cache_response
import logging
import json
import time

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

comic_bp = Blueprint('comic', __name__)

@comic_bp.route('/comics/hot', methods=['GET'])
@cache_response(timeout=300, key_prefix='hot')
def get_hot_comics():
    """获取热门漫画"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    logger.info(f"获取热门漫画 - 页码: {page}, 限制: {limit}, 数据源: {source}")
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_hot_comics(page, limit)
        logger.info(f"成功获取热门漫画, 数量: {len(data.get('comics', []))}")
        if data.get('comics'):
            first_comic = data['comics'][0]
            logger.info(f"第一个漫画数据 - ID: {first_comic.get('id')}, 标题: {first_comic.get('title')}, 封面: {first_comic.get('cover')}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取热门漫画失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/comics/latest', methods=['GET'])
@cache_response(timeout=300, key_prefix='latest')
def get_latest_comics():
    """获取最新漫画"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    logger.info(f"获取最新漫画 - 页码: {page}, 限制: {limit}, 数据源: {source}")
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_latest_comics(page, limit)
        logger.info(f"成功获取最新漫画, 数量: {len(data.get('comics', []))}")
        if data.get('comics'):
            first_comic = data['comics'][0]
            logger.info(f"第一个漫画数据 - ID: {first_comic.get('id')}, 标题: {first_comic.get('title')}, 封面: {first_comic.get('cover')}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取最新漫画失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/comics/<comic_id>', methods=['GET'])
@cache_response(timeout=600, key_prefix='detail')
def get_comic_detail(comic_id):
    """获取漫画详情"""
    source = request.args.get('source', None)
    
    logger.info(f"获取漫画详情 - ID: {comic_id}, 数据源: {source}")
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_comic_detail(comic_id)
        logger.info(f"成功获取漫画详情 - 标题: {data.get('title')}, 封面: {data.get('cover')}, 状态: {data.get('status')}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取漫画详情失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/comics/<comic_id>/chapters', methods=['GET'])
@cache_response(timeout=600, key_prefix='chapters')
def get_chapters(comic_id):
    """获取章节列表"""
    source = request.args.get('source', None)
    
    logger.info(f"获取章节列表 - 漫画ID: {comic_id}, 数据源: {source}")
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_chapters(comic_id)
        logger.info(f"成功获取章节列表, 数量: {len(data.get('chapters', []))}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取章节列表失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/chapters/<chapter_id>/images/<int:page>', methods=['GET'])
@cache_response(timeout=1800, key_prefix='image_page')
def get_chapter_image_by_page(chapter_id, page):
    """获取章节的单张图片"""
    source = request.args.get('source', None)
    
    logger.info(f"获取单页图片 - 章节ID: {chapter_id}, 页码: {page}, 数据源: {source}")
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        
        data = scraper.get_chapter_images(chapter_id)
        images = data.get('images', []) if isinstance(data, dict) else []
        total = data.get('total', len(images)) if isinstance(data, dict) else len(images)
        
        if page < 1 or page > total:
            logger.warning(f"页码超出范围: {page}, 总页数: {total}")
            return jsonify({'error': '页码超出范围', 'page': page, 'total': total}), 400
        
        image = images[page - 1]
        result = {
            'page': page,
            'url': image.get('url'),
            'total': total
        }
        
        logger.info(f"成功获取第{page}页图片, URL: {image.get('url')[:100]}...")
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"获取单页图片失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/chapters/<chapter_id>/images', methods=['GET'])
@cache_response(timeout=1800, key_prefix='images')
def get_chapter_images(chapter_id):
    """获取章节图片"""
    source = request.args.get('source', None)
    
    logger.info(f"获取章节图片 - 章节ID: {chapter_id}, 数据源: {source}")
    
    try:
        start_ts = time.time()
        scraper = ScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_chapter_images(chapter_id)
        duration_ms = int((time.time() - start_ts) * 1000)
        
        images = data.get('images', []) if isinstance(data, dict) else []
        total = data.get('total', len(images)) if isinstance(data, dict) else len(images)
        expected_total = data.get('expected_total') if isinstance(data, dict) else None
        
        logger.info(f"成功获取章节图片, 数量: {total}, 预期: {expected_total}, 耗时: {duration_ms}ms")
        
        # 打印前几张图片用于调试
        for img in images[:5]:
            logger.info(f"样例图片 - 第{img.get('page')}页: {img.get('url')}")
        if len(images) > 5:
            logger.info(f"... 共 {len(images)} 张, 仅展示前 5 张")
        
        # 打印部分JSON以便排查
        try:
            preview_json = json.dumps(data, ensure_ascii=False)[:1500]
            logger.info(f"返回的JSON数据预览: {preview_json}")
        except Exception:
            logger.info("返回的数据无法序列化为JSON字符串")
        
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取章节图片失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/categories', methods=['GET'])
def get_categories():
    """获取分类列表"""
    source = request.args.get('source', None)
    
    logger.info(f"获取分类列表 - 数据源: {source}")
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_categories()
        logger.info(f"成功获取分类列表, 数量: {len(data.get('categories', []))}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取分类列表失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/comics/category', methods=['GET'])
def get_comics_by_category():
    """按分类获取漫画"""
    category = request.args.get('category', 'all')
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    logger.info(f"按分类获取漫画 - 分类: {category}, 页码: {page}, 限制: {limit}, 数据源: {source}")
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        
        # 如果是特殊分类,使用原有逻辑
        if category == 'completed':
            data = scraper.get_hot_comics(page, limit)
        elif category == 'ongoing':
            data = scraper.get_latest_comics(page, limit)
        else:
            # 使用新的分类接口
            data = scraper.get_comics_by_category(category, page, limit)
        
        logger.info(f"成功获取分类漫画, 数量: {len(data.get('comics', []))}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"按分类获取漫画失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@comic_bp.route('/chapters/<chapter_id>/download-info', methods=['GET'])
def get_chapter_download_info(chapter_id):
    """获取章节下载信息 - 返回所有图片链接供前端下载"""
    source = request.args.get('source', None)
    
    logger.info(f"获取章节下载信息 - 章节ID: {chapter_id}, 数据源: {source}")
    
    try:
        scraper = ScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        
        # 获取章节图片信息
        result = scraper.get_chapter_images(chapter_id)
        
        if not result or not result.get('images'):
            logger.warning(f"未获取到章节图片: {chapter_id}")
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
        
        logger.info(f"成功获取章节下载信息: {len(result['images'])} 张图片")
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
