#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试天天看小说(ttkan.co) 分页功能
验证第1页HTML解析和第2页API解析是否正常工作
"""

import sys
import os
import logging
import json

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.ttkan_scraper import TtkanScraper

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_page_1():
    """测试第1页 - HTML解析"""
    print("\n" + "=" * 60)
    print("测试第1页 - HTML解析")
    print("=" * 60)
    
    scraper = TtkanScraper()
    category_id = 'youxi'  # 游戏分类
    
    result = scraper.get_books_by_category(category_id, page=1, limit=18)
    
    books = result.get('books', [])
    total = result.get('total', 0)
    has_more = result.get('hasMore', False)
    
    print(f"分类: {category_id}")
    print(f"获取 {len(books)} 本书籍")
    print(f"总计: {total}")
    print(f"有更多页: {has_more}")
    
    if books:
        print(f"\n前5本书籍:")
        for i, book in enumerate(books[:5]):
            print(f"  {i+1}. 《{book['title']}》")
            print(f"     作者: {book.get('author', '未知')}")
            print(f"     ID: {book['id']}")
            if book.get('cover'):
                print(f"     封面: {book['cover'][:60]}...")
            if book.get('description'):
                print(f"     简介: {book['description'][:50]}...")
    
    return len(books) > 0

def test_page_2():
    """测试第2页 - API解析"""
    print("\n" + "=" * 60)
    print("测试第2页 - API解析")
    print("=" * 60)
    
    scraper = TtkanScraper()
    category_id = 'youxi'  # 游戏分类
    
    result = scraper.get_books_by_category(category_id, page=2, limit=18)
    
    books = result.get('books', [])
    total = result.get('total', 0)
    has_more = result.get('hasMore', False)
    
    print(f"分类: {category_id}")
    print(f"获取 {len(books)} 本书籍")
    print(f"总计: {total}")
    print(f"有更多页: {has_more}")
    
    if books:
        print(f"\n前5本书籍:")
        for i, book in enumerate(books[:5]):
            print(f"  {i+1}. 《{book['title']}》")
            print(f"     作者: {book.get('author', '未知')}")
            print(f"     ID: {book['id']}")
            if book.get('cover'):
                print(f"     封面: {book['cover'][:60]}...")
            if book.get('description'):
                print(f"     简介: {book['description'][:50]}...")
    
    return len(books) > 0

def test_page_3():
    """测试第3页 - API解析"""
    print("\n" + "=" * 60)
    print("测试第3页 - API解析")
    print("=" * 60)
    
    scraper = TtkanScraper()
    category_id = 'youxi'  # 游戏分类
    
    result = scraper.get_books_by_category(category_id, page=3, limit=18)
    
    books = result.get('books', [])
    total = result.get('total', 0)
    has_more = result.get('hasMore', False)
    
    print(f"分类: {category_id}")
    print(f"获取 {len(books)} 本书籍")
    print(f"总计: {total}")
    print(f"有更多页: {has_more}")
    
    if books:
        print(f"\n前3本书籍:")
        for i, book in enumerate(books[:3]):
            print(f"  {i+1}. 《{book['title']}》")
            print(f"     作者: {book.get('author', '未知')}")
            print(f"     ID: {book['id']}")
    
    return len(books) > 0

def test_api_directly():
    """直接测试API接口"""
    print("\n" + "=" * 60)
    print("直接测试API接口")
    print("=" * 60)
    
    scraper = TtkanScraper()
    api_url = f"{scraper.base_url}/api/nq/amp_novel_list"
    params = {
        'language': 'cn',
        'limit': 18,
        'type': 'youxi',
        'filter': '*',
        'page': 2
    }
    
    print(f"API URL: {api_url}")
    print(f"参数: {params}")
    
    try:
        response = scraper._make_request(api_url, params=params)
        if response:
            print(f"状态码: {response.status_code}")
            print(f"Content-Type: {response.headers.get('Content-Type', 'unknown')}")
            
            try:
                data = response.json()
                print(f"响应类型: {type(data)}")
                
                if isinstance(data, list):
                    print(f"返回列表长度: {len(data)}")
                    if data:
                        print(f"第一项类型: {type(data[0])}")
                        print(f"第一项内容预览:")
                        if isinstance(data[0], dict):
                            print(json.dumps(data[0], ensure_ascii=False, indent=2)[:500])
                        else:
                            print(str(data[0])[:500])
                elif isinstance(data, dict):
                    print(f"返回字典键: {list(data.keys())}")
                    if 'items' in data:
                        print(f"items长度: {len(data['items'])}")
                
            except Exception as e:
                print(f"JSON解析失败: {e}")
                print(f"响应内容预览:")
                print(response.text[:1000])
        else:
            print("请求失败!")
    except Exception as e:
        print(f"请求异常: {e}")
    
    return True

def run_all_tests():
    """运行所有测试"""
    print("\n" + "#" * 60)
    print("#  天天看小说分页功能测试")
    print("#" * 60)
    
    results = []
    
    # 测试直接API
    try:
        results.append(("直接测试API", test_api_directly()))
    except Exception as e:
        logger.error(f"直接API测试失败: {e}", exc_info=True)
        results.append(("直接测试API", False))
    
    # 测试第1页
    try:
        results.append(("第1页HTML", test_page_1()))
    except Exception as e:
        logger.error(f"第1页测试失败: {e}", exc_info=True)
        results.append(("第1页HTML", False))
    
    # 测试第2页
    try:
        results.append(("第2页API", test_page_2()))
    except Exception as e:
        logger.error(f"第2页测试失败: {e}", exc_info=True)
        results.append(("第2页API", False))
    
    # 测试第3页
    try:
        results.append(("第3页API", test_page_3()))
    except Exception as e:
        logger.error(f"第3页测试失败: {e}", exc_info=True)
        results.append(("第3页API", False))
    
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
