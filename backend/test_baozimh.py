#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试包子漫画爬虫
"""

import sys
sys.path.insert(0, '.')

from services.baozimh_scraper import BaozimhScraper

def test_baozimh():
    print("=" * 60)
    print("测试包子漫画爬虫")
    print("=" * 60)
    
    scraper = BaozimhScraper()
    
    # 1. 测试分类
    print("\n[1] 测试获取分类...")
    categories = scraper.get_categories()
    print(f"分类数量: {categories['total']}")
    print(f"前5个分类: {[c['name'] for c in categories['categories'][:5]]}")
    
    # 2. 测试热门漫画
    print("\n[2] 测试获取热门漫画...")
    hot_comics = scraper.get_hot_comics(1, 5)
    print(f"热门漫画数量: {len(hot_comics['comics'])}")
    for comic in hot_comics['comics'][:5]:
        print(f"  - {comic['title']} (ID: {comic['id']})")
    
    # 3. 测试漫画详情（如果有热门漫画）
    if hot_comics['comics']:
        comic_id = hot_comics['comics'][0]['id']
        print(f"\n[3] 测试获取漫画详情: {comic_id}...")
        detail = scraper.get_comic_detail(comic_id)
        if detail:
            print(f"  标题: {detail['title']}")
            print(f"  作者: {detail['author']}")
            print(f"  状态: {detail['status']}")
            print(f"  章节数: {detail['totalChapters']}")
        else:
            print("  获取详情失败")
        
        # 4. 测试章节列表
        print(f"\n[4] 测试获取章节列表...")
        chapters = scraper.get_chapters(comic_id)
        print(f"  章节数量: {chapters['total']}")
        if chapters['chapters']:
            print(f"  前3个章节: {[c['title'] for c in chapters['chapters'][:3]]}")
            
            # 5. 测试章节图片
            if chapters['chapters']:
                chapter_id = chapters['chapters'][0]['id']
                print(f"\n[5] 测试获取章节图片: {chapter_id}...")
                images = scraper.get_chapter_images(chapter_id)
                print(f"  图片数量: {images['total']}")
                if images['images']:
                    print(f"  前3张图片URL: ")
                    for img in images['images'][:3]:
                        print(f"    - {img['url'][:80]}...")
    
    # 6. 测试搜索
    print("\n[6] 测试搜索: 斗破苍穹...")
    search_result = scraper.search_comics("斗破苍穹", 1, 5)
    print(f"搜索结果数量: {len(search_result['comics'])}")
    for comic in search_result['comics'][:3]:
        print(f"  - {comic['title']}")
    
    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)

if __name__ == '__main__':
    test_baozimh()
