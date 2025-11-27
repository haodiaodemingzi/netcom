# -*- coding: utf-8 -*-
"""
测试所有数据源的基本功能
快速验证所有爬虫是否正常工作
"""

from services.scraper_factory import ScraperFactory
from config import COMIC_SOURCES

def test_source(source_id, source_info):
    """测试单个数据源"""
    print(f"\n{'='*60}")
    print(f"  测试数据源: {source_info['name']} ({source_id})")
    print(f"{'='*60}")
    
    try:
        scraper = ScraperFactory.get_scraper(source_id)
        
        # 测试获取分类
        print("\n1. 测试获取分类...")
        categories = scraper.get_categories()
        print(f"   ✓ 分类数量: {categories['total']}")
        if categories['categories']:
            print(f"   ✓ 示例: {categories['categories'][0]['name']}")
        
        # 测试获取热门漫画
        print("\n2. 测试获取热门漫画...")
        hot = scraper.get_hot_comics(page=1, limit=3)
        print(f"   ✓ 漫画数量: {len(hot['comics'])}")
        if hot['comics']:
            print(f"   ✓ 示例: {hot['comics'][0]['title']}")
        
        # 测试搜索
        print("\n3. 测试搜索功能...")
        search = scraper.search_comics("test", page=1, limit=3)
        print(f"   ✓ 搜索结果: {len(search['comics'])} 个")
        
        # 如果有漫画，测试详情和章节
        if hot['comics']:
            comic_id = hot['comics'][0]['id']
            
            print(f"\n4. 测试获取漫画详情 (ID: {comic_id})...")
            detail = scraper.get_comic_detail(comic_id)
            if detail:
                print(f"   ✓ 标题: {detail['title']}")
            
            print(f"\n5. 测试获取章节列表...")
            chapters = scraper.get_chapters(comic_id)
            print(f"   ✓ 章节数量: {chapters['total']}")
            
            if chapters['chapters']:
                chapter_id = chapters['chapters'][0]['id']
                print(f"\n6. 测试获取章节图片 (ID: {chapter_id})...")
                images = scraper.get_chapter_images(chapter_id)
                print(f"   ✓ 图片数量: {images['total']}")
        
        print(f"\n✅ {source_info['name']} 测试通过")
        return True
        
    except Exception as e:
        print(f"\n❌ {source_info['name']} 测试失败: {e}")
        return False

def main():
    """测试所有数据源"""
    print("\n" + "🧪 测试所有数据源".center(60, "=") + "\n")
    
    results = {}
    
    for source_id, source_info in COMIC_SOURCES.items():
        if not source_info['enabled']:
            print(f"\n⏭️  跳过已禁用的数据源: {source_info['name']}")
            continue
        
        results[source_id] = test_source(source_id, source_info)
    
    # 汇总结果
    print("\n" + "="*60)
    print("  测试结果汇总")
    print("="*60 + "\n")
    
    for source_id, success in results.items():
        status = "✅ 通过" if success else "❌ 失败"
        name = COMIC_SOURCES[source_id]['name']
        print(f"  {name:15} {status}")
    
    total = len(results)
    passed = sum(results.values())
    print(f"\n总计: {passed}/{total} 个数据源测试通过")
    
    if passed == total:
        print("\n🎉 所有数据源测试通过！")
    else:
        print(f"\n⚠️  有 {total - passed} 个数据源测试失败")

if __name__ == "__main__":
    main()
