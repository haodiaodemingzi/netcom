# -*- coding: utf-8 -*-
"""
测试所有数据源的基本功能 (带详细日志)
快速验证所有爬虫是否正常工作, 并将详细的 API 响应数据记录到日志文件
"""

import logging
import json
from services.scraper_factory import ScraperFactory
from config import COMIC_SOURCES

LOG_FILE = 'backend/test_all_sources.log'

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
        logger.info(f"响应数据:\n{json.dumps(response_data, ensure_ascii=False, indent=2)}")
    logger.info(f"{'─'*80}\n")

def test_source(source_id, source_info):
    """测试单个数据源"""
    logger.info(f"\n{'='*80}")
    logger.info(f"  测试数据源: {source_info['name']} ({source_id})")
    logger.info(f"{'='*80}\n")
    
    print(f"\n{'='*60}")
    print(f"  测试数据源: {source_info['name']} ({source_id})")
    print(f"{'='*60}")
    
    try:
        scraper = ScraperFactory.get_scraper(source_id)
        
        print("\n1. 测试获取分类...")
        logger.info("1. 测试获取分类...")
        try:
            categories = scraper.get_categories()
            log_api_response('get_categories', None, categories)
            print(f"   ✓ 分类数量: {categories['total']}")
            if categories['categories']:
                print(f"   ✓ 示例: {categories['categories'][0]['name']}")
        except Exception as e:
            log_api_response('get_categories', None, None, error=str(e))
            raise
        
        print("\n2. 测试获取热门漫画...")
        logger.info("2. 测试获取热门漫画...")
        try:
            hot = scraper.get_hot_comics(page=1, limit=3)
            log_api_response('get_hot_comics', {'page': 1, 'limit': 3}, hot)
            print(f"   ✓ 漫画数量: {len(hot['comics'])}")
            if hot['comics']:
                print(f"   ✓ 示例: {hot['comics'][0]['title']}")
        except Exception as e:
            log_api_response('get_hot_comics', {'page': 1, 'limit': 3}, None, error=str(e))
            raise
        
        print("\n3. 测试搜索功能...")
        logger.info("3. 测试搜索功能...")
        try:
            search = scraper.search_comics("test", page=1, limit=3)
            log_api_response('search_comics', {'keyword': 'test', 'page': 1, 'limit': 3}, search)
            print(f"   ✓ 搜索结果: {len(search['comics'])} 个")
        except Exception as e:
            log_api_response('search_comics', {'keyword': 'test', 'page': 1, 'limit': 3}, None, error=str(e))
            raise
        
        if hot['comics']:
            comic_id = hot['comics'][0]['id']
            
            print(f"\n4. 测试获取漫画详情 (ID: {comic_id})...")
            logger.info(f"4. 测试获取漫画详情 (ID: {comic_id})...")
            try:
                detail = scraper.get_comic_detail(comic_id)
                log_api_response('get_comic_detail', {'comic_id': comic_id}, detail)
                if detail:
                    print(f"   ✓ 标题: {detail['title']}")
            except Exception as e:
                log_api_response('get_comic_detail', {'comic_id': comic_id}, None, error=str(e))
                raise
            
            print(f"\n5. 测试获取章节列表...")
            logger.info("5. 测试获取章节列表...")
            try:
                chapters = scraper.get_chapters(comic_id)
                log_api_response('get_chapters', {'comic_id': comic_id}, chapters)
                print(f"   ✓ 章节数量: {chapters['total']}")
            except Exception as e:
                log_api_response('get_chapters', {'comic_id': comic_id}, None, error=str(e))
                raise
            
            if chapters['chapters']:
                chapter_id = chapters['chapters'][0]['id']
                print(f"\n6. 测试获取章节图片 (ID: {chapter_id})...")
                logger.info(f"6. 测试获取章节图片 (ID: {chapter_id})...")
                try:
                    images = scraper.get_chapter_images(chapter_id)
                    log_api_response('get_chapter_images', {'chapter_id': chapter_id}, images)
                    print(f"   ✓ 图片数量: {images['total']}")
                except Exception as e:
                    log_api_response('get_chapter_images', {'chapter_id': chapter_id}, None, error=str(e))
                    raise
        
        logger.info(f"\n✅ {source_info['name']} 测试通过\n")
        print(f"\n✅ {source_info['name']} 测试通过")
        return True
        
    except Exception as e:
        logger.error(f"\n❌ {source_info['name']} 测试失败: {e}\n")
        print(f"\n❌ {source_info['name']} 测试失败: {e}")
        return False

def main():
    """测试所有数据源"""
    logger.info("\n" + "🧪 测试所有数据源".center(80, "=") + "\n")
    print("\n" + "🧪 测试所有数据源".center(60, "=") + "\n")
    
    results = {}
    
    for source_id, source_info in COMIC_SOURCES.items():
        if not source_info['enabled']:
            logger.info(f"⏭️  跳过已禁用的数据源: {source_info['name']}")
            print(f"\n⏭️  跳过已禁用的数据源: {source_info['name']}")
            continue
        
        results[source_id] = test_source(source_id, source_info)
    
    logger.info("\n" + "="*80)
    logger.info("  测试结果汇总")
    logger.info("="*80 + "\n")
    
    print("\n" + "="*60)
    print("  测试结果汇总")
    print("="*60 + "\n")
    
    for source_id, success in results.items():
        status = "✅ 通过" if success else "❌ 失败"
        name = COMIC_SOURCES[source_id]['name']
        logger.info(f"  {name:15} {status}")
        print(f"  {name:15} {status}")
    
    total = len(results)
    passed = sum(results.values())
    
    logger.info(f"\n总计: {passed}/{total} 个数据源测试通过")
    print(f"\n总计: {passed}/{total} 个数据源测试通过")
    
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
