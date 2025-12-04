from flask import Blueprint, request, jsonify
from services.ebook_scraper_factory import EbookScraperFactory
from services.cache import cache_response
import logging
import json
import threading
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ebook_bp = Blueprint('ebook', __name__)

# 全局缓存所有书籍元数据
all_books_metadata = {
    'books': [],
    'last_updated': None,
    'is_loading': False
}

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

def load_all_books_metadata_background(source='kanunu8'):
    """后台线程加载所有书籍元数据"""
    global all_books_metadata
    
    if all_books_metadata['is_loading']:
        logger.info("元数据正在加载中,跳过本次请求")
        return
    
    all_books_metadata['is_loading'] = True
    logger.info(f"开始后台加载所有书籍元数据 - 数据源: {source}")
    
    try:
        scraper = EbookScraperFactory.get_scraper(source)
        categories_data = scraper.get_categories()
        categories = categories_data.get('categories', [])
        
        # 过滤掉作家分类
        filtered_categories = [cat for cat in categories if cat.get('type') != 'writer']
        
        all_books = []
        total_categories = len(filtered_categories)
        
        for idx, category in enumerate(filtered_categories, 1):
            try:
                logger.info(f"正在加载分类 [{idx}/{total_categories}]: {category.get('name')}")
                
                # 获取该分类的所有书籍(多页)
                page = 1
                while True:
                    books_data = scraper.get_books_by_category(category.get('id'), page, 50)
                    books = books_data.get('books', [])
                    
                    if not books:
                        break
                    
                    # 添加分类信息到每本书
                    for book in books:
                        book['category'] = category.get('name')
                        book['category_id'] = category.get('id')
                        book['group'] = category.get('group', '')
                    
                    all_books.extend(books)
                    logger.info(f"  第{page}页: 获取{len(books)}本书, 累计{len(all_books)}本")
                    
                    if not books_data.get('hasMore', False):
                        break
                    
                    page += 1
                    time.sleep(0.5)  # 避免请求过快
                    
            except Exception as e:
                logger.error(f"加载分类 {category.get('name')} 失败: {str(e)}")
                continue
        
        all_books_metadata['books'] = all_books
        all_books_metadata['last_updated'] = time.time()
        all_books_metadata['is_loading'] = False
        
        logger.info(f"元数据加载完成! 共{len(all_books)}本书籍")
        
    except Exception as e:
        logger.error(f"加载元数据失败: {str(e)}")
        all_books_metadata['is_loading'] = False

@ebook_bp.route('/ebooks/metadata/all', methods=['GET'])
def get_all_books_metadata():
    """获取所有书籍元数据"""
    source = request.args.get('source', 'kanunu8')
    force_reload = request.args.get('force_reload', 'false').lower() == 'true'
    
    # 如果没有数据或强制重新加载,启动后台线程
    if not all_books_metadata['books'] or force_reload:
        if not all_books_metadata['is_loading']:
            thread = threading.Thread(target=load_all_books_metadata_background, args=(source,))
            thread.daemon = True
            thread.start()
            logger.info("已启动后台线程加载元数据")
            
            # 立即返回空数据,不等待加载完成
            return jsonify({
                'books': [],
                'total': 0,
                'last_updated': None,
                'is_loading': True,
                'message': '正在后台加载元数据,请稍后刷新'
            }), 200
    
    return jsonify({
        'books': all_books_metadata['books'],
        'total': len(all_books_metadata['books']),
        'last_updated': all_books_metadata['last_updated'],
        'is_loading': all_books_metadata['is_loading']
    }), 200

@ebook_bp.route('/ebooks/metadata/status', methods=['GET'])
def get_metadata_status():
    """获取元数据加载状态"""
    return jsonify({
        'total': len(all_books_metadata['books']),
        'last_updated': all_books_metadata['last_updated'],
        'is_loading': all_books_metadata['is_loading']
    }), 200
