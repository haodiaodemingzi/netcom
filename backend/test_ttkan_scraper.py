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
    print("Test 1: Get Categories")
    print("="*60)
    
    scraper = TtkanScraper()
    result = scraper.get_categories()
    
    if isinstance(result, dict) and 'categories' in result:
        categories = result['categories']
        print(f"[OK] Got {len(categories)} categories")
        print("\nFirst 5 categories:")
        for i, cat in enumerate(categories[:5], 1):
            print(f"  {i}. {cat['name']} (ID: {cat['id']}, Group: {cat.get('group', 'N/A')})")
        return categories
    else:
        print(f"[FAIL] Get categories failed: {result}")
        return []

def test_books_by_category(category_id='lianzai'):
    """测试获取分类书籍列表"""
    print("\n" + "="*60)
    print(f"Test 2: Get Books by Category (ID: {category_id})")
    print("="*60)
    
    scraper = TtkanScraper()
    result = scraper.get_books_by_category(category_id, page=1, limit=10)
    
    if isinstance(result, dict) and 'books' in result:
        books = result['books']
        print(f"[OK] Got {len(books)} books")
        print(f"  Total: {result.get('total', 'N/A')}")
        print(f"  Page: {result.get('page', 'N/A')}")
        print(f"  Has More: {result.get('hasMore', 'N/A')}")
        
        if books:
            print("\nFirst 3 books:")
            for i, book in enumerate(books[:3], 1):
                print(f"  {i}. {book.get('title', 'N/A')}")
                print(f"     Author: {book.get('author', 'N/A')}")
                print(f"     ID: {book.get('id', 'N/A')}")
                print(f"     Cover: {book.get('cover', 'N/A')[:60]}...")
            return books[0]['id'] if books else None
        else:
            print("  [WARN] Book list is empty")
            return None
    else:
        print(f"[FAIL] Get books failed: {result}")
        return None

def test_book_detail(book_id):
    """测试获取书籍详情"""
    print("\n" + "="*60)
    print(f"Test 3: Get Book Detail (ID: {book_id})")
    print("="*60)
    
    if not book_id:
        print("[SKIP] No book ID available")
        return None
    
    scraper = TtkanScraper()
    detail = scraper.get_book_detail(book_id)
    
    if detail:
        print(f"[OK] Got book detail")
        print(f"  Title: {detail.get('title', 'N/A')}")
        print(f"  Author: {detail.get('author', 'N/A')}")
        print(f"  Status: {detail.get('status', 'N/A')}")
        print(f"  Category: {detail.get('category', 'N/A')}")
        desc = detail.get('description', 'N/A')
        print(f"  Description: {desc[:100]}...")
        return detail
    else:
        print(f"[FAIL] Get book detail failed")
        return None

def test_chapters(book_id):
    """测试获取章节列表"""
    print("\n" + "="*60)
    print(f"Test 4: Get Chapters (Book ID: {book_id})")
    print("="*60)
    
    if not book_id:
        print("[SKIP] No book ID available")
        return None
    
    scraper = TtkanScraper()
    chapters = scraper.get_chapters(book_id)
    
    if chapters:
        print(f"[OK] Got {len(chapters)} chapters")
        if chapters:
            print("\nFirst 3 chapters:")
            for i, chapter in enumerate(chapters[:3], 1):
                print(f"  {i}. {chapter.get('title', 'N/A')}")
                print(f"     ID: {chapter.get('id', 'N/A')}")
            return chapters[0]['id'] if chapters else None
        else:
            print("  [WARN] Chapter list is empty")
            return None
    else:
        print(f"[FAIL] Get chapters failed")
        return None

def test_chapter_content(chapter_id):
    """测试获取章节内容"""
    print("\n" + "="*60)
    print(f"Test 5: Get Chapter Content (ID: {chapter_id})")
    print("="*60)
    
    if not chapter_id:
        print("[SKIP] No chapter ID available")
        return None
    
    scraper = TtkanScraper()
    content = scraper.get_chapter_content(chapter_id)
    
    if content:
        print(f"[OK] Got chapter content")
        print(f"  Title: {content.get('title', 'N/A')}")
        print(f"  Content Length: {len(content.get('content', ''))} chars")
        print(f"  Preview: {content.get('content', 'N/A')[:200]}...")
        return content
    else:
        print(f"[FAIL] Get chapter content failed")
        return None

def test_search(keyword='qingshan'):
    """测试搜索功能"""
    print("\n" + "="*60)
    print(f"Test 6: Search Books (Keyword: {keyword})")
    print("="*60)
    
    scraper = TtkanScraper()
    result = scraper.search_books(keyword, page=1, limit=5)
    
    if isinstance(result, dict) and 'books' in result:
        books = result['books']
        print(f"[OK] Found {len(books)} books")
        if books:
            print("\nSearch results:")
            for i, book in enumerate(books, 1):
                print(f"  {i}. {book.get('title', 'N/A')} - {book.get('author', 'N/A')}")
        return books
    else:
        print(f"[FAIL] Search failed: {result}")
        return []

def main():
    """主测试流程"""
    print("\n" + "="*60)
    print("TTKAN Scraper Function Test")
    print("="*60)
    
    try:
        # 1. Test get categories
        categories = test_categories()
        
        # 2. Test get books by category
        book_id = test_books_by_category('lianzai')
        
        # 3. Test get book detail
        if book_id:
            test_book_detail(book_id)
            
            # 4. Test get chapters
            chapter_id = test_chapters(book_id)
            
            # 5. Test get chapter content
            if chapter_id:
                test_chapter_content(chapter_id)
        
        # 6. Test search
        test_search('qingshan')
        
        print("\n" + "="*60)
        print("All Tests Completed!")
        print("="*60)
        
    except Exception as e:
        logger.error(f"Error during test: {str(e)}", exc_info=True)
        print(f"\n[FAIL] Test failed: {str(e)}")
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
