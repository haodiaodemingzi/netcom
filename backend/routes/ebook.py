from flask import Blueprint, request, jsonify
from services.ebook_scraper_factory import EbookScraperFactory
from services.cache import cache_response
from utils.decorators import (
    handle_errors, get_source_param, get_pagination_params,
    success_response, not_found_response, bad_request_response
)
import logging
import threading
import time
import asyncio

logger = logging.getLogger(__name__)

ebook_bp = Blueprint('ebook', __name__)

# 全局缓存所有书籍元数据
all_books_metadata = {
    'books': [],
    'last_updated': None,
    'is_loading': False
}

# 并发配置
METADATA_CONFIG = {
    'max_concurrent': 10,             # 最大并发请求数
    'request_timeout': 30,            # 请求超时(秒)
    'retry_times': 3,                 # 重试次数
    'retry_delay': 1,                 # 重试延迟(秒)
}

@ebook_bp.route('/ebooks/categories', methods=['GET'])
@cache_response(timeout=3600, key_prefix='ebook_categories')
@handle_errors("获取分类失败")
def get_categories():
    """获取所有分类"""
    source = get_source_param()
    scraper = EbookScraperFactory.get_scraper(source)
    return success_response(scraper.get_categories())

@ebook_bp.route('/ebooks/category/<category_id>', methods=['GET'])
@cache_response(timeout=600, key_prefix='ebook_category')
@handle_errors("获取分类书籍失败")
def get_books_by_category(category_id):
    """根据分类获取书籍列表"""
    page, limit = get_pagination_params()
    source = get_source_param()
    scraper = EbookScraperFactory.get_scraper(source)
    return success_response(scraper.get_books_by_category(category_id, page, limit))

@ebook_bp.route('/ebooks/<book_id>', methods=['GET'])
@cache_response(timeout=1800, key_prefix='ebook_detail')
@handle_errors("获取书籍详情失败")
def get_book_detail(book_id):
    """获取书籍详情"""
    source = get_source_param()
    scraper = EbookScraperFactory.get_scraper(source)
    data = scraper.get_book_detail(book_id)
    if not data:
        return not_found_response("未找到书籍")
    return success_response(data)

@ebook_bp.route('/ebooks/<book_id>/chapters', methods=['GET'])
@cache_response(timeout=1800, key_prefix='ebook_chapters')
@handle_errors("获取章节列表失败")
def get_chapters(book_id):
    """获取章节列表"""
    source = get_source_param()
    scraper = EbookScraperFactory.get_scraper(source)
    return success_response(scraper.get_chapters(book_id))

@ebook_bp.route('/ebooks/chapters/<chapter_id>/content', methods=['GET'])
@cache_response(timeout=3600, key_prefix='ebook_content')
@handle_errors("获取章节内容失败")
def get_chapter_content(chapter_id):
    """获取章节内容"""
    source = get_source_param()
    scraper = EbookScraperFactory.get_scraper(source)
    data = scraper.get_chapter_content(chapter_id)
    if not data:
        return not_found_response("未找到章节")
    return success_response(data)

@ebook_bp.route('/ebooks/search', methods=['GET'])
@cache_response(timeout=300, key_prefix='ebook_search')
@handle_errors("搜索书籍失败")
def search_books():
    """搜索书籍"""
    keyword = request.args.get('keyword', '')
    if not keyword:
        return bad_request_response("请提供搜索关键词")
    page, limit = get_pagination_params()
    source = get_source_param()
    scraper = EbookScraperFactory.get_scraper(source)
    return success_response(scraper.search_books(keyword, page, limit))

@ebook_bp.route('/ebooks/sources', methods=['GET'])
@handle_errors("获取数据源列表失败")
def get_sources():
    """获取所有可用的电子书数据源"""
    sources = EbookScraperFactory.get_available_sources()
    return success_response({'sources': sources})

async def fetch_page_async(scraper, category_id, page, limit, category, config, semaphore):
    """异步获取单页数据"""
    async with semaphore:  # 控制并发数
        for attempt in range(config['retry_times']):
            try:
                # 在线程池中执行同步的scraper调用
                loop = asyncio.get_event_loop()
                books_data = await loop.run_in_executor(
                    None,
                    scraper.get_books_by_category,
                    category_id,
                    page,
                    limit
                )
                
                books = books_data.get('books', [])
                
                if not books:
                    return []
                
                # 添加分类信息
                for book in books:
                    book['category'] = category.get('name')
                    book['category_id'] = category.get('id')
                    book['group'] = category.get('group', '')
                
                return books
                
            except Exception as e:
                if attempt == config['retry_times'] - 1:
                    logger.error(f"获取分类{category_id}第{page}页失败: {str(e)}")
                    return []
                else:
                    await asyncio.sleep(config['retry_delay'] * (attempt + 1))
        
        return []

async def fetch_category_books_async(category, scraper, config, semaphore):
    """异步获取单个分类的所有书籍"""
    try:
        category_books = []
        
        # 先获取第一页确定是否有更多数据
        first_page_books = await fetch_page_async(
            scraper, 
            category.get('id'), 
            1, 
            50, 
            category, 
            config, 
            semaphore
        )
        
        if not first_page_books:
            return category_books
        
        category_books.extend(first_page_books)
        
        # 获取第一页的元数据判断是否有更多页
        loop = asyncio.get_event_loop()
        first_page_data = await loop.run_in_executor(
            None,
            scraper.get_books_by_category,
            category.get('id'),
            1,
            50
        )
        
        # 如果有更多页面,并发获取
        if first_page_data.get('hasMore', False):
            # 估算总页数
            total_pages = min(20, len(first_page_books) // 30 + 5)
            
            # 创建异步任务列表
            tasks = []
            for page_num in range(2, total_pages + 1):
                task = fetch_page_async(
                    scraper,
                    category.get('id'),
                    page_num,
                    50,
                    category,
                    config,
                    semaphore
                )
                tasks.append(task)
            
            # 并发执行所有任务
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 收集结果
            for result in results:
                if isinstance(result, list):
                    category_books.extend(result)
                elif isinstance(result, Exception):
                    logger.warning(f"页面获取异常: {str(result)}")
        
        logger.info(f"分类 {category.get('name')} 完成: {len(category_books)}本书")
        return category_books
        
    except Exception as e:
        logger.error(f"获取分类 {category.get('name')} 失败: {str(e)}")
        return []

async def fetch_all_metadata_async(source, config):
    """异步获取所有元数据"""
    try:
        # 获取scraper和分类列表
        scraper = EbookScraperFactory.get_scraper(source)
        categories_data = scraper.get_categories()
        categories = categories_data.get('categories', [])
        
        # 过滤掉作家分类
        filtered_categories = [cat for cat in categories if cat.get('type') != 'writer']
        
        logger.info(f"共{len(filtered_categories)}个分类, 开始异步抓取(最大并发: {config['max_concurrent']})...")
        
        # 创建信号量控制并发
        semaphore = asyncio.Semaphore(config['max_concurrent'])
        
        # 创建所有分类的异步任务
        tasks = []
        for category in filtered_categories:
            task = fetch_category_books_async(category, scraper, config, semaphore)
            tasks.append(task)
        
        # 并发执行所有分类抓取
        all_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 合并所有结果
        all_books = []
        for idx, result in enumerate(all_results):
            if isinstance(result, list):
                all_books.extend(result)
            elif isinstance(result, Exception):
                logger.error(f"分类 {filtered_categories[idx].get('name')} 抓取失败: {str(result)}")
        
        # 去重
        unique_books = {}
        for book in all_books:
            if book.get('id'):
                unique_books[book['id']] = book
        
        final_books = list(unique_books.values())
        
        logger.info(f"异步抓取完成! 原始{len(all_books)}本, 去重后{len(final_books)}本书籍")
        
        return final_books
        
    except Exception as e:
        logger.error(f"异步抓取失败: {str(e)}")
        return []

def load_all_books_metadata_background(source='kanunu8'):
    """后台线程加载所有书籍元数据 - 异步IO版本"""
    global all_books_metadata
    
    if all_books_metadata['is_loading']:
        logger.info("元数据正在加载中,跳过本次请求")
        return
    
    all_books_metadata['is_loading'] = True
    logger.info(f"开始后台加载所有书籍元数据 - 数据源: {source}")
    
    try:
        # 创建新的事件循环
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # 运行异步抓取
            final_books = loop.run_until_complete(
                fetch_all_metadata_async(source, METADATA_CONFIG)
            )
            
            all_books_metadata['books'] = final_books
            all_books_metadata['last_updated'] = time.time()
            all_books_metadata['is_loading'] = False
            
            logger.info(f"元数据加载完成! 共{len(final_books)}本书籍")
            
        finally:
            loop.close()
        
    except Exception as e:
        logger.error(f"加载元数据失败: {str(e)}")
        all_books_metadata['is_loading'] = False

@ebook_bp.route('/ebooks/metadata/all', methods=['GET'])
def get_all_books_metadata():
    """获取所有书籍元数据 - 立即返回,后台加载"""
    source = request.args.get('source', 'kanunu8')
    force_reload = request.args.get('force_reload', 'false').lower() == 'true'
    
    # 如果需要加载且未在加载中,启动后台线程
    if (not all_books_metadata['books'] or force_reload) and not all_books_metadata['is_loading']:
        thread = threading.Thread(target=load_all_books_metadata_background, args=(source,))
        thread.daemon = True
        thread.start()
        logger.info("已启动后台线程加载元数据,立即返回当前数据")
    
    # 立即返回当前数据(可能为空)
    return jsonify({
        'books': all_books_metadata['books'],
        'total': len(all_books_metadata['books']),
        'last_updated': all_books_metadata['last_updated'],
        'is_loading': all_books_metadata['is_loading'],
        'message': '后台正在加载元数据' if all_books_metadata['is_loading'] else '数据已就绪'
    }), 200

@ebook_bp.route('/ebooks/metadata/status', methods=['GET'])
def get_metadata_status():
    """获取元数据加载状态"""
    return jsonify({
        'total': len(all_books_metadata['books']),
        'last_updated': all_books_metadata['last_updated'],
        'is_loading': all_books_metadata['is_loading']
    }), 200

@ebook_bp.route('/ebooks/metadata/config', methods=['GET', 'POST'])
def metadata_config():
    """获取或更新元数据抓取配置"""
    global METADATA_CONFIG
    
    if request.method == 'GET':
        return jsonify(METADATA_CONFIG), 200
    
    elif request.method == 'POST':
        try:
            new_config = request.get_json()
            
            # 验证配置参数
            valid_keys = ['max_concurrent', 'request_timeout', 'retry_times', 'retry_delay']
            for key in valid_keys:
                if key in new_config:
                    if key in ['max_concurrent', 'request_timeout', 'retry_times']:
                        if not isinstance(new_config[key], int) or new_config[key] < 1:
                            return jsonify({'error': f'{key} 必须是大于0的整数'}), 400
                    elif key == 'retry_delay':
                        if not isinstance(new_config[key], (int, float)) or new_config[key] < 0:
                            return jsonify({'error': f'{key} 必须是非负数'}), 400
            
            # 更新配置
            for key, value in new_config.items():
                if key in valid_keys:
                    METADATA_CONFIG[key] = value
            
            logger.info(f"元数据配置已更新: {METADATA_CONFIG}")
            return jsonify(METADATA_CONFIG), 200
            
        except Exception as e:
            logger.error(f"更新配置失败: {str(e)}")
            return jsonify({'error': str(e)}), 500
