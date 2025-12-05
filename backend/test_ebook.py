# -*- coding: utf-8 -*-
import sys
import os
sys.path.append(os.path.dirname(__file__))

from services.kanunu8_scraper import KanuNu8Scraper
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_get_categories():
    """测试获取分类列表"""
    logger.info("=" * 80)
    logger.info("测试: 获取分类列表")
    logger.info("=" * 80)
    
    scraper = KanuNu8Scraper()
    result = scraper.get_categories()
    
    logger.info(f"\n获取到 {len(result.get('categories', []))} 个分类:")
    
    # 按分组显示
    groups = {}
    for cat in result.get('categories', []):
        group = cat.get('group', '未分组')
        if group not in groups:
            groups[group] = []
        groups[group].append(cat)
    
    for group, cats in groups.items():
        logger.info(f"\n【{group}】")
        for cat in cats:
            logger.info(f"  - {cat['name']} (ID: {cat['id']}, URL: {cat['url']})")
    
    return result

def test_get_books_by_category(category_id='wuxia', page=1):
    """测试获取分类下的书籍列表"""
    logger.info("=" * 80)
    logger.info(f"测试: 获取分类书籍 - 分类ID: {category_id}, 页码: {page}")
    logger.info("=" * 80)
    
    scraper = KanuNu8Scraper()
    result = scraper.get_books_by_category(category_id, page)
    
    logger.info(f"\n获取到 {len(result.get('books', []))} 本书籍:")
    logger.info(f"总数: {result.get('total')}, 当前页: {result.get('page')}, 总页数: {result.get('totalPages')}, 还有更多: {result.get('hasMore')}")
    
    for idx, book in enumerate(result.get('books', [])[:10], 1):
        logger.info(f"\n{idx}. {book['title']}")
        logger.info(f"   作者: {book['author']}")
        logger.info(f"   ID: {book['id']}")
        logger.info(f"   类型: {book['type']}")
        logger.info(f"   URL: {book['url']}")
    
    if len(result.get('books', [])) > 10:
        logger.info(f"\n... 还有 {len(result.get('books', [])) - 10} 本书籍未显示")
    
    return result

def test_get_book_detail(book_id):
    """测试获取书籍详情"""
    logger.info("=" * 80)
    logger.info(f"测试: 获取书籍详情 - 书籍ID: {book_id}")
    logger.info("=" * 80)
    
    scraper = KanuNu8Scraper()
    result = scraper.get_book_detail(book_id)
    
    if not result:
        logger.error("未获取到书籍详情")
        return None
    
    logger.info(f"\n书名: {result['title']}")
    logger.info(f"作者: {result['author']}")
    logger.info(f"ID: {result['id']}")
    logger.info(f"URL: {result['url']}")
    logger.info(f"总章节数: {result['totalChapters']}")
    
    logger.info(f"\n前10个章节:")
    for idx, chapter in enumerate(result.get('chapters', [])[:10], 1):
        logger.info(f"  {idx}. {chapter['title']} (ID: {chapter['id']})")
    
    if len(result.get('chapters', [])) > 10:
        logger.info(f"  ... 还有 {len(result.get('chapters', [])) - 10} 个章节未显示")
    
    return result

def test_get_chapter_content(chapter_id):
    """测试获取章节内容"""
    logger.info("=" * 80)
    logger.info(f"测试: 获取章节内容 - 章节ID: {chapter_id}")
    logger.info("=" * 80)
    
    scraper = KanuNu8Scraper()
    result = scraper.get_chapter_content(chapter_id)
    
    if not result:
        logger.error("未获取到章节内容")
        return None
    
    logger.info(f"\n章节标题: {result['title']}")
    logger.info(f"章节ID: {result['id']}")
    logger.info(f"URL: {result['url']}")
    logger.info(f"内容长度: {len(result['content'])} 字符")
    
    # 打印完整内容
    logger.info(f"\n完整章节内容:")
    logger.info("=" * 80)
    logger.info(result['content'])
    logger.info("=" * 80)
    
    return result

def main():
    """主测试流程"""
    try:
        # 1. 测试获取分类
        logger.info("\n\n")
        categories_result = test_get_categories()
        
        if not categories_result.get('categories'):
            logger.error("未获取到分类,停止测试")
            return
        
        # 选择第一个非作家分类进行测试
        first_category = None
        for cat in categories_result['categories']:
            if not cat['id'].startswith('writer_'):
                first_category = cat
                break
        
        if not first_category:
            logger.error("未找到非作家分类,停止测试")
            return
        
        category_id = first_category['id']
        
        # 2. 测试获取分类下的书籍
        logger.info("\n\n")
        books_result = test_get_books_by_category(category_id, page=1)
        
        if not books_result.get('books'):
            logger.warning("未获取到书籍,尝试下一个分类")
            # 尝试其他分类
            for cat in categories_result['categories']:
                if not cat['id'].startswith('writer_') and cat['id'] != category_id:
                    category_id = cat['id']
                    logger.info(f"\n尝试分类: {cat['name']} ({category_id})")
                    books_result = test_get_books_by_category(category_id, page=1)
                    if books_result.get('books'):
                        first_category = cat
                        break
            
            if not books_result.get('books'):
                logger.error("所有分类都未获取到书籍,停止测试")
                return
        
        # 选择第一本书进行测试,如果失败则尝试其他书籍
        book_detail = None
        first_book = None
        
        for book in books_result['books'][:5]:  # 尝试前5本书
            first_book = book
            book_id = first_book['id']
            
            # 3. 测试获取书籍详情
            logger.info("\n\n")
            book_detail = test_get_book_detail(book_id)
            
            if book_detail and book_detail.get('chapters'):
                break
            else:
                logger.warning(f"书籍 {book['title']} 获取失败,尝试下一本")
        
        if not book_detail or not book_detail.get('chapters'):
            logger.error("所有书籍都未获取到详情或章节,停止测试")
            return
        
        # 选择第一章进行测试
        first_chapter = book_detail['chapters'][0]
        chapter_id = first_chapter['id']
        
        # 4. 测试获取章节内容
        logger.info("\n\n")
        chapter_content = test_get_chapter_content(chapter_id)
        
        # 测试总结
        logger.info("\n\n")
        logger.info("=" * 80)
        logger.info("测试总结")
        logger.info("=" * 80)
        logger.info(f"✓ 分类数量: {len(categories_result.get('categories', []))}")
        logger.info(f"✓ 测试分类: {first_category['name']} ({category_id})")
        logger.info(f"✓ 书籍数量: {len(books_result.get('books', []))}")
        logger.info(f"✓ 测试书籍: {first_book['title']} by {first_book['author']}")
        logger.info(f"✓ 章节数量: {book_detail.get('totalChapters', 0)}")
        logger.info(f"✓ 测试章节: {first_chapter['title']}")
        logger.info(f"✓ 章节内容长度: {len(chapter_content['content']) if chapter_content else 0} 字符")
        logger.info("\n所有测试完成!")
        
    except Exception as e:
        logger.error(f"测试过程中出错: {str(e)}", exc_info=True)

if __name__ == '__main__':
    main()
