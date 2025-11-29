# -*- coding: utf-8 -*-
"""
测试HMZXA爬虫
"""

import sys
import logging
from services.hmzxa_scraper import HmzxaScraper

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_categories():
    """测试获取分类列表"""
    logger.info("=" * 50)
    logger.info("测试: 获取分类列表")
    logger.info("=" * 50)
    
    scraper = HmzxaScraper()
    result = scraper.get_categories()
    
    logger.info(f"获取到 {result.get('total', 0)} 个分类")
    if result.get('categories'):
        logger.info("前5个分类:")
        for cat in result['categories'][:5]:
            logger.info(f"  - ID: {cat['id']}, 名称: {cat['name']}")
    
    return result


def test_search_comics(category='49', page=1):
    """测试获取分类漫画"""
    logger.info("=" * 50)
    logger.info(f"测试: 获取漫画列表 (分类={category}, 页码={page})")
    logger.info("=" * 50)
    
    scraper = HmzxaScraper()
    result = scraper.get_comics_by_category(category, page=page)
    
    logger.info(f"当前页: {result.get('page', page)}")
    logger.info(f"总页数: {result.get('totalPages', 1)}")
    logger.info(f"是否有更多: {result.get('hasMore', False)}")
    logger.info(f"获取到 {len(result.get('comics', []))} 部漫画")
    if result.get('comics'):
        logger.info("前3部漫画:")
        for comic in result['comics'][:3]:
            logger.info(f"  - ID: {comic['id']}")
            logger.info(f"    标题: {comic['title']}")
            logger.info(f"    封面: {comic['cover'][:50]}..." if comic['cover'] else "    封面: 无")
            logger.info(f"    最新章节: {comic.get('latestChapter', '无')}")
    
    return result


def test_comic_detail(comic_id):
    """测试获取漫画详情"""
    logger.info("=" * 50)
    logger.info(f"测试: 获取漫画详情 (ID={comic_id})")
    logger.info("=" * 50)
    
    scraper = HmzxaScraper()
    result = scraper.get_comic_detail(comic_id)
    
    if result:
        logger.info(f"标题: {result.get('title')}")
        logger.info(f"封面: {result.get('cover', '')[:50]}..." if result.get('cover') else "封面: 无")
        logger.info(f"标签: {', '.join(result.get('tags', []))}")
        logger.info(f"人气: {result.get('popularity', '无')}")
        logger.info(f"简介: {result.get('description', '')[:100]}...")
    else:
        logger.error("获取详情失败")
    
    return result


def test_chapters(comic_id):
    """测试获取章节列表"""
    logger.info("=" * 50)
    logger.info(f"测试: 获取章节列表 (ID={comic_id})")
    logger.info("=" * 50)
    
    scraper = HmzxaScraper()
    result = scraper.get_chapters(comic_id)
    
    logger.info(f"获取到 {result.get('total', 0)} 个章节")
    if result.get('chapters'):
        logger.info("前5个章节:")
        for chapter in result['chapters'][:5]:
            logger.info(f"  - ID: {chapter['id']}")
            logger.info(f"    标题: {chapter['title']}")
        
        logger.info("最后5个章节:")
        for chapter in result['chapters'][-5:]:
            logger.info(f"  - ID: {chapter['id']}")
            logger.info(f"    标题: {chapter['title']}")
    
    return result


def test_chapter_images(chapter_id):
    """测试获取章节图片"""
    logger.info("=" * 50)
    logger.info(f"测试: 获取章节图片 (ID={chapter_id})")
    logger.info("=" * 50)
    
    scraper = HmzxaScraper()
    result = scraper.get_chapter_images(chapter_id)
    
    logger.info(f"获取到 {result.get('total', 0)} 张图片")
    if result.get('images'):
        logger.info("前3张图片:")
        for img in result['images'][:3]:
            logger.info(f"  - 页码: {img['page']}")
            logger.info(f"    URL: {img['url'][:80]}...")
    
    return result


if __name__ == '__main__':
    try:
        # 1. 测试获取分类
        categories = test_categories()
        
        # 2. 测试搜索漫画（使用第一个分类）
        category_id = '49'  # 热血
        comics = test_search_comics(category=category_id, page=1)
        
        # 3. 测试获取漫画详情（使用第一部漫画）
        if comics.get('comics'):
            first_comic = comics['comics'][0]
            comic_id = first_comic['id']
            
            detail = test_comic_detail(comic_id)
            
            # 4. 测试获取章节列表
            chapters = test_chapters(comic_id)
            
            # 5. 测试获取章节图片（使用第一章）
            if chapters.get('chapters'):
                first_chapter = chapters['chapters'][0]
                chapter_id = first_chapter['id']
                
                images = test_chapter_images(chapter_id)
        
        logger.info("=" * 50)
        logger.info("所有测试完成！")
        logger.info("=" * 50)
        
    except Exception as e:
        logger.error(f"测试过程中出错: {e}", exc_info=True)
        sys.exit(1)
