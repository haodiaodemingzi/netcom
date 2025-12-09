# -*- coding: utf-8 -*-
"""测试18H Animezilla爬虫"""
import sys
sys.path.insert(0, '.')

from services.animezilla_scraper import AnimezillaScraper

def test_scraper():
    print("=== 测试 18H Animezilla 爬虫 ===")
    
    s = AnimezillaScraper()
    print("爬虫初始化成功")
    
    # 测试获取热门漫画
    print("\n1. 测试获取热门漫画...")
    result = s.get_hot_comics(1, 5)
    print(f"   获取到 {len(result['comics'])} 部漫画")
    if result['comics']:
        comic = result['comics'][0]
        print(f"   第一部: {comic.get('title', 'N/A')[:50]}...")
        print(f"   ID: {comic.get('id', 'N/A')}")
        print(f"   封面: {comic.get('cover', 'N/A')[:50]}..." if comic.get('cover') else "   封面: 无")
    
    # 测试获取漫画详情
    if result['comics']:
        comic_id = result['comics'][0]['id']
        print(f"\n2. 测试获取漫画详情 (ID: {comic_id})...")
        detail = s.get_comic_detail(comic_id)
        if detail:
            print(f"   标题: {detail.get('title', 'N/A')[:50]}...")
            print(f"   作者: {detail.get('author', 'N/A')}")
            print(f"   标签: {detail.get('categories', [])[:5]}")
        else:
            print("   获取详情失败")
    
    # 测试获取章节
    if result['comics']:
        comic_id = result['comics'][0]['id']
        print(f"\n3. 测试获取章节列表 (ID: {comic_id})...")
        chapters = s.get_chapters(comic_id)
        print(f"   获取到 {chapters['total']} 个章节")
        if chapters['chapters']:
            print(f"   第一章: {chapters['chapters'][0].get('title', 'N/A')}")
    
    # 测试获取分类
    print("\n4. 测试获取分类...")
    categories = s.get_categories()
    print(f"   获取到 {categories['total']} 个分类")
    if categories['categories']:
        print(f"   前5个分类: {[c['name'] for c in categories['categories'][:5]]}")
    
    print("\n=== 测试完成 ===")

if __name__ == '__main__':
    test_scraper()
