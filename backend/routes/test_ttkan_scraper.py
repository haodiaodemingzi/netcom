#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试天天看小说爬虫功能
"""

import sys
import os

# 添加项目路径到 sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.ttkan_scraper import TtkanScraper
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def test_categories():
    """测试获取分类列表"""
    print("\n" + "="*60)
    print("测试 1: 获取分类列表")
    print("="*60)
    
    scraper = TtkanScraper()
    result = scraper.get_categories()
    
    if isinstance(result, dict) and 'categories' in result:
        categories = result['categories']
        print(f"✓ 成功获取 {len(categories)} 个分类")
        print("\n前5个分类:")
        for i, cat in enumerate(categories[:5], 1):
            print(f"  {i}. {cat['name']} (ID: {cat['id']}, 分组: {cat.get('group', 'N/A')})")
        return categories
    else:
        print(f"✗ 获取分类失败: {result}")
        return []

def test_books_by_category(category_id='lianzai'):
    """测试获取分类书籍列表"""
    print("\n" + "="*60)
    print(f"测试 2: 获取分类书籍 (分类ID: {category_id})")
    print("="*60)
    
    scraper = TtkanScraper()
    result = scraper.get_books_by_category(category_id, page=1, limit=10)
    
    if isinstance(result, dict) and 'books' in result:
        books = result['books']
        print(f"✓ 成功获取 {len(books)} 本书籍")
        print(f"  总数: {result.get('total', 'N/A')}")
        print(f"  当前页: {result.get('page', 'N/A')}")
        print(f"  是否有更多: {result.get('hasMore', 'N/A')}")
        
        if books:
            print("\n前3本书籍:")
            for i, book in enumerate(books[:3], 1):
                print(f"  {i}. {book.get('title', 'N/A')}")
                print(f"     作者: {book.get('author', 'N/A')}")
                print(f"     ID: {book.get('id', 'N/A')}")
                print(f"     封面: {book.get('cover', 'N/A')[:60]}...")
            return books[0]['id'] if books else None
        else:
            print("  警告: 书籍列表为空")
            return None
    else:
        print(f"✗ 获取书籍失败: {result}")
        return None

def test_book_detail(book_id):
    """测试获取书籍详情"""
    print("\n" + "="*60)
    print(f"测试 3: 获取书籍详情 (书籍ID: {book_id})")
    print("="*60)
    
    if not book_id:
        print("✗ 跳过测试: 没有可用的书籍ID")
        return None
    
    scraper = TtkanScraper()
    detail = scraper.get_book_detail(book_id)
    
    if detail:
        print(f"✓ 成功获取书籍详情")
        print(f"  书名: {detail.get('title', 'N/A')}")
        print(f"  作者: {detail.get('author', 'N/A')}")
        print(f"  状态: {detail.get('status', 'N/A')}")
        print(f"  分类: {detail.get('category', 'N/A')}")
        print(f"  简介: {detail.get('description', 'N/A')[:100]}...")
        return detail
    else:
        print(f"✗ 获取书籍详情失败")
        return None

def test_chapters(book_id):
    """测试获取章节列表"""
    print("\n" + "="*60)
    print(f"测试 4: 获取章节列表 (书籍ID: {book_id})")
    print("="*60)
    
    if not book_id:
        print("✗ 跳过测试: 没有可用的书籍ID")
        return None
    
    scraper = TtkanScraper()
    chapters = scraper.get_chapters(book_id)
    
    if chapters:
        print(f"✓ 成功获取 {len(chapters)} 个章节")
        if chapters:
            print("\n前3个章节:")
            for i, chapter in enumerate(chapters[:3], 1):
                print(f"  {i}. {chapter.get('title', 'N/A')}")
                print(f"     ID: {chapter.get('id', 'N/A')}")
            return chapters[0]['id'] if chapters else None
        else:
            print("  警告: 章节列表为空")
            return None
    else:
        print(f"✗ 获取章节列表失败")
        return None

def test_chapter_content(chapter_id):
    """测试获取章节内容"""
    print("\n" + "="*60)
    print(f"测试 5: 获取章节内容 (章节ID: {chapter_id})")
    print("="*60)
    
    if not chapter_id:
        print("✗ 跳过测试: 没有可用的章节ID")
        return None
    
    scraper = TtkanScraper()
    content = scraper.get_chapter_content(chapter_id)
    
    if content:
        print(f"✓ 成功获取章节内容")
        print(f"  章节标题: {content.get('title', 'N/A')}")
        print(f"  内容长度: {len(content.get('content', ''))} 字符")
        print(f"  内容预览: {content.get('content', 'N/A')[:200]}...")
        return content
    else:
        print(f"✗ 获取章节内容失败")
        return None

def test_search(keyword='青山'):
    """测试搜索功能"""
    print("\n" + "="*60)
    print(f"测试 6: 搜索书籍 (关键词: {keyword})")
    print("="*60)
    
    scraper = TtkanScraper()
    result = scraper.search_books(keyword, page=1, limit=5)
    
    if isinstance(result, dict) and 'books' in result:
        books = result['books']
        print(f"✓ 成功搜索到 {len(books)} 本书籍")
        if books:
            print("\n搜索结果:")
            for i, book in enumerate(books, 1):
                print(f"  {i}. {book.get('title', 'N/A')} - {book.get('author', 'N/A')}")
        return books
    else:
        print(f"✗ 搜索失败: {result}")
        return []

def main():
    """主测试流程"""
    print("\n" + "="*60)
    print("天天看小说爬虫功能测试")
    print("="*60)
    
    try:
        # 1. 测试获取分类
        categories = test_categories()
        
        # 2. 测试获取书籍列表
        book_id = test_books_by_category('lianzai')
        
        # 3. 测试获取书籍详情
        if book_id:
            test_book_detail(book_id)
            
            # 4. 测试获取章节列表
            chapter_id = test_chapters(book_id)
            
            # 5. 测试获取章节内容
            if chapter_id:
                test_chapter_content(chapter_id)
        
        # 6. 测试搜索功能
        test_search('青山')
        
        print("\n" + "="*60)
        print("测试完成!")
        print("="*60)
        
    except Exception as e:
        logger.error(f"测试过程中发生错误: {str(e)}", exc_info=True)
        print(f"\n✗ 测试失败: {str(e)}")
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
