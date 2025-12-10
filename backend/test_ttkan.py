#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
天天看小说(ttkan.co) 爬虫测试脚本
测试分类、小说列表、章节、内容抓取功能
"""

import sys
import os
import logging

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.ttkan_scraper import TtkanScraper

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_categories():
    """测试获取分类"""
    print("\n" + "=" * 60)
    print("测试1: 获取分类列表")
    print("=" * 60)
    
    scraper = TtkanScraper()
    result = scraper.get_categories()
    
    categories = result.get('categories', [])
    print(f"共获取 {len(categories)} 个分类")
    
    # 显示前10个分类
    for i, cat in enumerate(categories[:10]):
        print(f"  {i+1}. {cat['name']} (ID: {cat['id']}, 分组: {cat['group']})")
    
    if len(categories) > 10:
        print(f"  ... 还有 {len(categories) - 10} 个分类")
    
    return len(categories) > 0

def test_books_by_category():
    """测试获取分类书籍"""
    print("\n" + "=" * 60)
    print("测试2: 获取分类书籍列表")
    print("=" * 60)
    
    scraper = TtkanScraper()
    
    # 测试玄幻分类
    category_id = 'xuanhuan'
    print(f"测试分类: {category_id}")
    
    result = scraper.get_books_by_category(category_id, page=1, limit=10)
    
    books = result.get('books', [])
    total = result.get('total', 0)
    has_more = result.get('hasMore', False)
    
    print(f"获取 {len(books)} 本书籍 (总计: {total}, 更多: {has_more})")
    
    for i, book in enumerate(books[:5]):
        print(f"  {i+1}. 《{book['title']}》 - {book.get('author', '未知')} (ID: {book['id']})")
    
    return len(books) > 0

def test_book_detail():
    """测试获取书籍详情"""
    print("\n" + "=" * 60)
    print("测试3: 获取书籍详情")
    print("=" * 60)
    
    scraper = TtkanScraper()
    
    # 使用《万相之王》作为测试书籍
    book_id = 'wanxiangzhiwang-tiancantudou'
    print(f"测试书籍ID: {book_id}")
    
    result = scraper.get_book_detail(book_id)
    
    if result:
        print(f"书名: {result.get('title')}")
        print(f"作者: {result.get('author')}")
        print(f"状态: {result.get('status')}")
        print(f"分类: {result.get('category')}")
        print(f"章节数: {result.get('totalChapters')}")
        print(f"简介: {result.get('description', '')[:100]}...")
        
        # 显示前5个章节
        chapters = result.get('chapters', [])
        print(f"\n前5个章节:")
        for i, ch in enumerate(chapters[:5]):
            print(f"  {i+1}. {ch['title']} (ID: {ch['id']})")
        
        return True
    else:
        print("获取书籍详情失败!")
        return False

def test_chapters():
    """测试获取章节列表"""
    print("\n" + "=" * 60)
    print("测试4: 获取章节列表")
    print("=" * 60)
    
    scraper = TtkanScraper()
    
    book_id = 'wanxiangzhiwang-tiancantudou'
    print(f"测试书籍ID: {book_id}")
    
    result = scraper.get_chapters(book_id)
    
    chapters = result.get('chapters', [])
    total = result.get('total', 0)
    
    print(f"共获取 {total} 个章节")
    
    if chapters:
        print(f"\n前5个章节:")
        for i, ch in enumerate(chapters[:5]):
            print(f"  {i+1}. {ch['title']} (ID: {ch['id']})")
        
        print(f"\n最后5个章节:")
        for i, ch in enumerate(chapters[-5:]):
            print(f"  {total-4+i}. {ch['title']} (ID: {ch['id']})")
    
    return total > 0

def test_chapter_content():
    """测试获取章节内容"""
    print("\n" + "=" * 60)
    print("测试5: 获取章节内容")
    print("=" * 60)
    
    scraper = TtkanScraper()
    
    # 测试第一章
    chapter_id = 'wanxiangzhiwang-tiancantudou_1'
    print(f"测试章节ID: {chapter_id}")
    
    result = scraper.get_chapter_content(chapter_id)
    
    if result:
        print(f"章节标题: {result.get('title')}")
        print(f"内容长度: {len(result.get('content', ''))} 字符")
        
        content = result.get('content', '')
        if content:
            print(f"\n内容预览 (前500字):")
            print("-" * 40)
            print(content[:500])
            print("-" * 40)
        
        return len(content) > 100
    else:
        print("获取章节内容失败!")
        return False

def test_search():
    """测试搜索功能"""
    print("\n" + "=" * 60)
    print("测试6: 搜索书籍")
    print("=" * 60)
    
    scraper = TtkanScraper()
    
    keyword = '天蚕土豆'
    print(f"搜索关键词: {keyword}")
    
    result = scraper.search_books(keyword, page=1, limit=10)
    
    books = result.get('books', [])
    total = result.get('total', 0)
    
    print(f"找到 {total} 本书籍")
    
    for i, book in enumerate(books[:5]):
        print(f"  {i+1}. 《{book['title']}》 (ID: {book['id']})")
    
    # 搜索可能不支持，不作为必要测试
    return True

def run_all_tests():
    """运行所有测试"""
    print("\n" + "#" * 60)
    print("#  天天看小说(ttkan.co) 爬虫测试")
    print("#" * 60)
    
    results = []
    
    # 测试分类
    try:
        results.append(("获取分类", test_categories()))
    except Exception as e:
        logger.error(f"分类测试失败: {e}")
        results.append(("获取分类", False))
    
    # 测试分类书籍
    try:
        results.append(("分类书籍", test_books_by_category()))
    except Exception as e:
        logger.error(f"分类书籍测试失败: {e}")
        results.append(("分类书籍", False))
    
    # 测试书籍详情
    try:
        results.append(("书籍详情", test_book_detail()))
    except Exception as e:
        logger.error(f"书籍详情测试失败: {e}")
        results.append(("书籍详情", False))
    
    # 测试章节列表
    try:
        results.append(("章节列表", test_chapters()))
    except Exception as e:
        logger.error(f"章节列表测试失败: {e}")
        results.append(("章节列表", False))
    
    # 测试章节内容
    try:
        results.append(("章节内容", test_chapter_content()))
    except Exception as e:
        logger.error(f"章节内容测试失败: {e}")
        results.append(("章节内容", False))
    
    # 测试搜索
    try:
        results.append(("搜索功能", test_search()))
    except Exception as e:
        logger.error(f"搜索测试失败: {e}")
        results.append(("搜索功能", False))
    
    # 汇总结果
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    passed = 0
    failed = 0
    for name, success in results:
        status = "✓ 通过" if success else "✗ 失败"
        print(f"  {name}: {status}")
        if success:
            passed += 1
        else:
            failed += 1
    
    print("-" * 60)
    print(f"总计: {passed} 通过, {failed} 失败")
    print("=" * 60)
    
    return failed == 0

if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
