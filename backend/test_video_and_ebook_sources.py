# -*- coding: utf-8 -*-
"""
测试视频和电子书数据源的基本功能 (带详细日志)
快速验证所有视频和电子书爬虫是否正常工作, 并将详细的 API 响应数据记录到日志文件
"""

import logging
import json
import sys
import os

# 添加backend目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.video_scraper_factory import VideoScraperFactory
from services.ebook_scraper_factory import EbookScraperFactory
from services.source_market import SourceMarket

LOG_FILE = 'backend/test_video_ebook_sources.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, mode='w', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def log_api_response(api_name, params, response_data, error=None):
    """记录 API 调用的详细信息"""
    logger.info(f"\n{'─'*80}")
    logger.info(f"API: {api_name}")
    if params:
        logger.info(f"参数: {json.dumps(params, ensure_ascii=False, indent=2)}")
    
    if error:
        logger.error(f"错误: {error}")
    else:
        # 限制日志输出长度
        if isinstance(response_data, dict):
            limited_data = {}
            for key, value in response_data.items():
                if isinstance(value, (str, int, float, bool)) or value is None:
                    limited_data[key] = value
                elif isinstance(value, list):
                    limited_data[key] = f"[{len(value)}项]" if len(value) > 3 else value[:3]
                elif isinstance(value, dict):
                    limited_data[key] = f"{{{len(value)}键}}"
                else:
                    limited_data[key] = str(type(value))
            logger.info(f"响应数据:\n{json.dumps(limited_data, ensure_ascii=False, indent=2)}")
        else:
            logger.info(f"响应数据: {str(response_data)[:500]}")
    logger.info(f"{'─'*80}\n")

def test_video_source(source_id, source_info):
    """测试单个视频数据源"""
    logger.info(f"\n{'='*80}")
    logger.info(f"  测试视频数据源: {source_info['name']} ({source_id})")
    logger.info(f"{'='*80}\n")
    
    print(f"\n{'='*60}")
    print(f"  测试视频数据源: {source_info['name']} ({source_id})")
    print(f"{'='*60}")
    
    try:
        scraper = VideoScraperFactory.create_scraper(source_id)
        
        print("\n1. 测试获取分类...")
        logger.info("1. 测试获取分类...")
        try:
            categories = scraper.get_categories()
            log_api_response('get_categories', None, categories)
            if categories and isinstance(categories, dict):
                print(f"   ✓ 分类数量: {categories.get('total', len(categories.get('categories', [])))}")
                if categories.get('categories'):
                    print(f"   ✓ 示例: {categories['categories'][0]['name']}")
        except Exception as e:
            log_api_response('get_categories', None, None, error=str(e))
            logger.warning(f"获取分类失败(可能不支持): {e}")
        
        print("\n2. 测试获取热门视频...")
        logger.info("2. 测试获取热门视频...")
        try:
            hot = scraper.get_series_list(category='hot', page=1, limit=3)
            log_api_response('get_series_list', {'category': 'hot', 'page': 1, 'limit': 3}, hot)
            if hot and isinstance(hot, dict):
                series_list = hot.get('series', [])
                print(f"   ✓ 视频数量: {len(series_list)}")
                if series_list:
                    print(f"   ✓ 示例: {series_list[0].get('title', 'N/A')}")
        except Exception as e:
            log_api_response('get_series_list', {'category': 'hot', 'page': 1, 'limit': 3}, None, error=str(e))
            raise
        
        print("\n3. 测试搜索功能...")
        logger.info("3. 测试搜索功能...")
        try:
            search = scraper.search_videos("test", page=1, limit=3)
            log_api_response('search_videos', {'keyword': 'test', 'page': 1, 'limit': 3}, search)
            if search and isinstance(search, dict):
                series_list = search.get('series', [])
                print(f"   ✓ 搜索结果: {len(series_list)} 个")
        except Exception as e:
            log_api_response('search_videos', {'keyword': 'test', 'page': 1, 'limit': 3}, None, error=str(e))
            logger.warning(f"搜索失败(可能不支持): {e}")
        
        if hot and isinstance(hot, dict):
            series_list = hot.get('series', [])
            if series_list:
                video_id = series_list[0].get('id')
                
                print(f"\n4. 测试获取视频详情 (ID: {video_id})...")
                logger.info(f"4. 测试获取视频详情 (ID: {video_id})...")
                try:
                    detail = scraper.get_series_detail(video_id)
                    log_api_response('get_series_detail', {'series_id': video_id}, detail)
                    if detail:
                        print(f"   ✓ 标题: {detail.get('title', 'N/A')}")
                except Exception as e:
                    log_api_response('get_series_detail', {'series_id': video_id}, None, error=str(e))
                    raise
                
                print(f"\n5. 测试获取剧集列表...")
                logger.info("5. 测试获取剧集列表...")
                try:
                    episodes = scraper.get_episodes(video_id)
                    log_api_response('get_episodes', {'series_id': video_id}, episodes)
                    if episodes:
                        if isinstance(episodes, list):
                            print(f"   ✓ 剧集数量: {len(episodes)}")
                        elif isinstance(episodes, dict):
                            print(f"   ✓ 剧集数量: {len(episodes.get('episodes', []))}")
                except Exception as e:
                    log_api_response('get_episodes', {'series_id': video_id}, None, error=str(e))
                    raise
        
        logger.info(f"\n✅ {source_info['name']} 测试通过\n")
        print(f"\n✅ {source_info['name']} 测试通过")
        return True
        
    except Exception as e:
        logger.error(f"\n❌ {source_info['name']} 测试失败: {e}\n")
        print(f"\n❌ {source_info['name']} 测试失败: {e}")
        return False

def test_ebook_source(source_id, source_info):
    """测试单个电子书数据源"""
    logger.info(f"\n{'='*80}")
    logger.info(f"  测试电子书数据源: {source_info['name']} ({source_id})")
    logger.info(f"{'='*80}\n")
    
    print(f"\n{'='*60}")
    print(f"  测试电子书数据源: {source_info['name']} ({source_id})")
    print(f"{'='*60}")
    
    try:
        scraper = EbookScraperFactory.get_scraper(source=source_id)
        
        print("\n1. 测试获取分类...")
        logger.info("1. 测试获取分类...")
        try:
            categories = scraper.get_categories()
            log_api_response('get_categories', None, categories)
            if categories and isinstance(categories, dict):
                print(f"   ✓ 分类数量: {categories.get('total', len(categories.get('categories', [])))}")
                if categories.get('categories'):
                    print(f"   ✓ 示例: {categories['categories'][0]['name']}")
        except Exception as e:
            log_api_response('get_categories', None, None, error=str(e))
            logger.warning(f"获取分类失败(可能不支持): {e}")
        
        print("\n2. 测试获取热门书籍...")
        logger.info("2. 测试获取热门书籍...")
        try:
            hot = scraper.get_books_by_category('hot', page=1, limit=3)
            log_api_response('get_books_by_category', {'category': 'hot', 'page': 1, 'limit': 3}, hot)
            if hot and isinstance(hot, dict):
                books = hot.get('books', [])
                print(f"   ✓ 书籍数量: {len(books)}")
                if books:
                    print(f"   ✓ 示例: {books[0].get('title', 'N/A')}")
        except Exception as e:
            log_api_response('get_books_by_category', {'category': 'hot', 'page': 1, 'limit': 3}, None, error=str(e))
            raise
        
        print("\n3. 测试搜索功能...")
        logger.info("3. 测试搜索功能...")
        try:
            search = scraper.search_books("test", page=1, limit=3)
            log_api_response('search_books', {'keyword': 'test', 'page': 1, 'limit': 3}, search)
            if search and isinstance(search, dict):
                books = search.get('books', [])
                print(f"   ✓ 搜索结果: {len(books)} 个")
        except Exception as e:
            log_api_response('search_books', {'keyword': 'test', 'page': 1, 'limit': 3}, None, error=str(e))
            logger.warning(f"搜索失败(可能不支持): {e}")
        
        if hot and isinstance(hot, dict):
            books = hot.get('books', [])
            if books:
                book_id = books[0].get('id')
                
                print(f"\n4. 测试获取书籍详情 (ID: {book_id})...")
                logger.info(f"4. 测试获取书籍详情 (ID: {book_id})...")
                try:
                    detail = scraper.get_book_detail(book_id)
                    log_api_response('get_book_detail', {'book_id': book_id}, detail)
                    if detail:
                        print(f"   ✓ 标题: {detail.get('title', 'N/A')}")
                except Exception as e:
                    log_api_response('get_book_detail', {'book_id': book_id}, None, error=str(e))
                    raise
                
                print(f"\n5. 测试获取章节列表...")
                logger.info("5. 测试获取章节列表...")
                try:
                    chapters = detail.get('chapters', []) if detail else []
                    if chapters:
                        print(f"   ✓ 章节数量: {len(chapters)}")
                    else:
                        print(f"   ⚠️  未获取到章节列表")
                except Exception as e:
                    logger.warning(f"获取章节列表失败: {e}")
        
        logger.info(f"\n✅ {source_info['name']} 测试通过\n")
        print(f"\n✅ {source_info['name']} 测试通过")
        return True
        
    except Exception as e:
        logger.error(f"\n❌ {source_info['name']} 测试失败: {e}\n")
        print(f"\n❌ {source_info['name']} 测试失败: {e}")
        return False

def main():
    """测试所有视频和电子书数据源"""
    logger.info("\n" + "🧪 测试所有视频和电子书数据源".center(80, "=") + "\n")
    print("\n" + "🧪 测试所有视频和电子书数据源".center(60, "=") + "\n")
    
    # 获取source_market配置
    market = SourceMarket()
    all_sources = market.get_all_sources()
    
    results = {'video': {}, 'ebook': {}}
    
    # 测试视频数据源
    print("\n" + "🎬 测试视频数据源".center(60, "─") + "\n")
    video_sources = VideoScraperFactory.get_available_sources()
    for source in video_sources:
        source_id = source['id']
        source_info = {'name': source['name']}
        results['video'][source_id] = test_video_source(source_id, source_info)
    
    # 测试电子书数据源
    print("\n" + "📖 测试电子书数据源".center(60, "─") + "\n")
    ebook_sources = EbookScraperFactory.get_available_sources()
    for source in ebook_sources:
        source_id = source['id']
        source_info = {'name': source['name']}
        results['ebook'][source_id] = test_ebook_source(source_id, source_info)
    
    # 打印测试结果汇总
    logger.info("\n" + "="*80)
    logger.info("  测试结果汇总")
    logger.info("="*80 + "\n")
    
    print("\n" + "="*60)
    print("  测试结果汇总")
    print("="*60 + "\n")
    
    # 视频数据源结果
    print("\n🎬 视频数据源:")
    logger.info("\n🎬 视频数据源:")
    for source_id, success in results['video'].items():
        status = "✅ 通过" if success else "❌ 失败"
        name = next((s['name'] for s in video_sources if s['id'] == source_id), source_id)
        logger.info(f"  {name:15} {status}")
        print(f"  {name:15} {status}")
    
    # 电子书数据源结果
    print("\n📖 电子书数据源:")
    logger.info("\n📖 电子书数据源:")
    for source_id, success in results['ebook'].items():
        status = "✅ 通过" if success else "❌ 失败"
        name = next((s['name'] for s in ebook_sources if s['id'] == source_id), source_id)
        logger.info(f"  {name:15} {status}")
        print(f"  {name:15} {status}")
    
    # 统计
    video_total = len(results['video'])
    video_passed = sum(results['video'].values())
    ebook_total = len(results['ebook'])
    ebook_passed = sum(results['ebook'].values())
    total = video_total + ebook_total
    passed = video_passed + ebook_passed
    
    logger.info(f"\n视频数据源: {video_passed}/{video_total} 个测试通过")
    logger.info(f"电子书数据源: {ebook_passed}/{ebook_total} 个测试通过")
    logger.info(f"总计: {passed}/{total} 个数据源测试通过")
    
    print(f"\n视频数据源: {video_passed}/{video_total} 个测试通过")
    print(f"电子书数据源: {ebook_passed}/{ebook_total} 个测试通过")
    print(f"总计: {passed}/{total} 个数据源测试通过")
    
    if passed == total:
        logger.info("\n🎉 所有数据源测试通过！")
        print("\n🎉 所有数据源测试通过！")
    else:
        logger.warning(f"\n⚠️  有 {total - passed} 个数据源测试失败")
        print(f"\n⚠️  有 {total - passed} 个数据源测试失败")
    
    logger.info(f"\n详细日志已保存到: {LOG_FILE}")
    print(f"\n📝 详细日志已保存到: {LOG_FILE}")

if __name__ == "__main__":
    main()
