from flask import Blueprint, request, jsonify
from services.ebook_scraper_factory import EbookScraperFactory
from services.cache import cache_response
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ebook_bp = Blueprint('ebook', __name__)

@ebook_bp.route('/ebooks/categories', methods=['GET'])
@cache_response(timeout=3600, key_prefix='ebook_categories')
def get_categories():
    """获取所有分类"""
    source = request.args.get('source', None)
    
    logger.info(f"获取电子书分类 - 数据源: {source}")
    
    try:
        scraper = EbookScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_categories()
        logger.info(f"成功获取分类, 数量: {len(data.get('categories', []))}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取分类失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@ebook_bp.route('/ebooks/category/<category_id>', methods=['GET'])
@cache_response(timeout=600, key_prefix='ebook_category')
def get_books_by_category(category_id):
    """根据分类获取书籍列表"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    logger.info(f"获取分类书籍 - 分类ID: {category_id}, 页码: {page}, 限制: {limit}, 数据源: {source}")
    
    try:
        scraper = EbookScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_books_by_category(category_id, page, limit)
        logger.info(f"成功获取书籍, 数量: {len(data.get('books', []))}")
        if data.get('books'):
            first_book = data['books'][0]
            logger.info(f"第一本书 - ID: {first_book.get('id')}, 标题: {first_book.get('title')}, 作者: {first_book.get('author')}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取分类书籍失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@ebook_bp.route('/ebooks/<book_id>', methods=['GET'])
@cache_response(timeout=1800, key_prefix='ebook_detail')
def get_book_detail(book_id):
    """获取书籍详情"""
    source = request.args.get('source', None)
    
    logger.info(f"获取书籍详情 - ID: {book_id}, 数据源: {source}")
    
    try:
        scraper = EbookScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_book_detail(book_id)
        
        if not data:
            logger.warning(f"未找到书籍: {book_id}")
            return jsonify({'error': '未找到书籍'}), 404
        
        logger.info(f"成功获取书籍详情 - 标题: {data.get('title')}, 作者: {data.get('author')}, 章节数: {data.get('totalChapters')}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取书籍详情失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@ebook_bp.route('/ebooks/<book_id>/chapters', methods=['GET'])
@cache_response(timeout=1800, key_prefix='ebook_chapters')
def get_chapters(book_id):
    """获取章节列表"""
    source = request.args.get('source', None)
    
    logger.info(f"获取章节列表 - 书籍ID: {book_id}, 数据源: {source}")
    
    try:
        scraper = EbookScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_chapters(book_id)
        logger.info(f"成功获取章节列表, 数量: {len(data.get('chapters', []))}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取章节列表失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@ebook_bp.route('/ebooks/chapters/<chapter_id>/content', methods=['GET'])
@cache_response(timeout=3600, key_prefix='ebook_content')
def get_chapter_content(chapter_id):
    """获取章节内容"""
    source = request.args.get('source', None)
    
    logger.info(f"获取章节内容 - 章节ID: {chapter_id}, 数据源: {source}")
    
    try:
        scraper = EbookScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.get_chapter_content(chapter_id)
        
        if not data:
            logger.warning(f"未找到章节: {chapter_id}")
            return jsonify({'error': '未找到章节'}), 404
        
        content_length = len(data.get('content', ''))
        logger.info(f"成功获取章节内容 - 标题: {data.get('title')}, 内容长度: {content_length}")
        
        # 只打印部分内容用于调试
        content_preview = data.get('content', '')[:200]
        logger.info(f"内容预览: {content_preview}...")
        
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"获取章节内容失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@ebook_bp.route('/ebooks/search', methods=['GET'])
@cache_response(timeout=300, key_prefix='ebook_search')
def search_books():
    """搜索书籍"""
    keyword = request.args.get('keyword', '')
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    source = request.args.get('source', None)
    
    logger.info(f"搜索书籍 - 关键词: {keyword}, 页码: {page}, 限制: {limit}, 数据源: {source}")
    
    if not keyword:
        return jsonify({'error': '请提供搜索关键词'}), 400
    
    try:
        scraper = EbookScraperFactory.get_scraper(source)
        logger.info(f"使用爬虫: {type(scraper).__name__}")
        data = scraper.search_books(keyword, page, limit)
        logger.info(f"搜索成功, 结果数量: {len(data.get('books', []))}")
        logger.info(f"返回的JSON数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"搜索书籍失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@ebook_bp.route('/ebooks/sources', methods=['GET'])
def get_sources():
    """获取所有可用的电子书数据源"""
    try:
        sources = EbookScraperFactory.get_available_sources()
        return jsonify({'sources': sources}), 200
    except Exception as e:
        logger.error(f"获取数据源列表失败: {str(e)}")
        return jsonify({'error': str(e)}), 500
