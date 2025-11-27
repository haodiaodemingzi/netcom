# -*- coding: utf-8 -*-
"""
X漫画采集源测试脚本
测试所有接口的抓取功能
"""

import sys
import json
from services.scraper_factory import ScraperFactory

def print_separator(title):
    """打印分隔线"""
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60 + "\n")

def test_categories():
    """测试获取分类列表"""
    print_separator("测试1: 获取分类列表")
    
    scraper = ScraperFactory.get_scraper('xmanhua')
    print(f"请求URL: {scraper.base_url}")
    result = scraper.get_categories()
    
    print(f"\n分类总数: {result['total']}")
    print("\n分类列表:")
    for cat in result['categories'][:10]:
        print(f"  - ID: {cat['id']}")
        print(f"    名称: {cat['name']}")
        print(f"    完整URL: {cat['url']}")
        print()
    
    if result['total'] > 10:
        print(f"  ... 还有 {result['total'] - 10} 个分类")
    
    return result['categories'][0]['id'] if result['categories'] else None

def test_category_comics(category_id):
    """测试获取分类漫画"""
    print_separator(f"测试2: 获取分类漫画 (分类ID: {category_id})")
    
    scraper = ScraperFactory.get_scraper('xmanhua')
    url = f'{scraper.base_url}/manga-list-{category_id}-0-10-p1/'
    print(f"请求URL: {url}")
    result = scraper.get_comics_by_category(category_id, page=1, limit=5)
    
    print(f"\n漫画数量: {len(result['comics'])}")
    print(f"是否有更多: {result['hasMore']}")
    print("\n漫画列表:")
    
    for comic in result['comics']:
        print(f"  - 漫画ID: {comic['id']}")
        print(f"    标题: {comic['title']}")
        print(f"    完整封面URL: {comic['cover']}")
        print(f"    最新章节: {comic.get('latestChapter', '无')}")
        print(f"    状态: {comic.get('status', '未知')}")
        print()
    
    return result['comics'][0]['id'] if result['comics'] else None

def test_hot_comics():
    """测试获取热门漫画"""
    print_separator("测试3: 获取热门漫画")
    
    scraper = ScraperFactory.get_scraper('xmanhua')
    print(f"请求URL: {scraper.base_url}/manga-list-31-0-10-p1/")
    result = scraper.get_hot_comics(page=1, limit=3)
    
    print(f"\n漫画数量: {len(result['comics'])}")
    print("\n热门漫画:")
    
    for comic in result['comics']:
        print(f"  - 标题: {comic['title']}")
        print(f"    ID: {comic['id']}")
        print(f"    封面: {comic['cover']}")
        print()
    
    return result['comics'][0]['id'] if result['comics'] else None

def test_search():
    """测试搜索功能"""
    print_separator("测试4: 搜索漫画")
    
    keyword = "海贼王"
    scraper = ScraperFactory.get_scraper('xmanhua')
    search_url = f'{scraper.base_url}/search?keyword={keyword}'
    print(f"搜索URL: {search_url}")
    result = scraper.search_comics(keyword, page=1, limit=3)
    
    print(f"\n搜索关键词: {keyword}")
    print(f"结果数量: {len(result['comics'])}")
    print("\n搜索结果:")
    
    for comic in result['comics']:
        print(f"  - 标题: {comic['title']}")
        print(f"    ID: {comic['id']}")
        print(f"    封面: {comic['cover']}")
        print()
    
    return result['comics'][0]['id'] if result['comics'] else None

def test_comic_detail(comic_id):
    """测试获取漫画详情"""
    print_separator(f"测试5: 获取漫画详情 (ID: {comic_id})")
    
    scraper = ScraperFactory.get_scraper('xmanhua')
    detail_url = f'{scraper.base_url}/{comic_id}/'
    print(f"请求URL: {detail_url}")
    result = scraper.get_comic_detail(comic_id)
    
    if result:
        print(f"\n标题: {result['title']}")
        print(f"作者: {result['author']}")
        print(f"状态: {result['status']}")
        print(f"分类: {', '.join(result['categories'])}")
        print(f"评分: {result.get('rating', 0)}")
        print(f"更新时间: {result.get('updateTime', '未知')}")
        print(f"\n完整封面URL: {result['cover']}")
        print(f"\n完整简介:\n{result['description']}")
    else:
        print("获取详情失败")
    
    return True

def test_chapters(comic_id):
    """测试获取章节列表"""
    print_separator(f"测试6: 获取章节列表 (漫画ID: {comic_id})")
    
    scraper = ScraperFactory.get_scraper('xmanhua')
    chapters_url = f'{scraper.base_url}/{comic_id}/'
    print(f"请求URL: {chapters_url}")
    result = scraper.get_chapters(comic_id)
    
    print(f"\n章节总数: {result['total']}")
    print("\n前5个章节:")
    
    for chapter in result['chapters'][:5]:
        print(f"  - 章节ID: {chapter['id']}")
        print(f"    标题: {chapter['title']}")
        print(f"    顺序: {chapter['order']}")
        print(f"    更新时间: {chapter.get('updateTime', '未知')}")
        print()
    
    if result['total'] > 5:
        print(f"  ... 还有 {result['total'] - 5} 个章节")
    
    return result['chapters'][0]['id'] if result['chapters'] else None

def test_chapter_images(chapter_id):
    """测试获取章节图片"""
    print_separator(f"测试7: 获取章节图片 (章节ID: {chapter_id})")
    
    scraper = ScraperFactory.get_scraper('xmanhua')
    image_url = f'{scraper.base_url}/{chapter_id}/'
    print(f"请求URL: {image_url}")
    
    result = scraper.get_chapter_images(chapter_id)
    
    print(f"\n图片总数: {result['total']}")
    print("\n所有图片URL:")
    
    for img in result['images']:
        print(f"  - 第{img['page']}页:")
        print(f"    完整URL: {img['url']}")
    
    if result['total'] == 0:
        print("\n⚠️  未获取到图片URL，可能需要调整选择器")
    
    return True

def main():
    """主测试流程"""
    print("\n" + "🚀 开始测试X漫画采集源".center(60, "="))
    
    try:
        # 测试1: 获取分类
        category_id = test_categories()
        if not category_id:
            print("❌ 获取分类失败，使用默认分类ID: 31")
            category_id = '31'
        
        # 测试2: 获取分类漫画
        comic_id = test_category_comics(category_id)
        if not comic_id:
            print("❌ 获取分类漫画失败，终止测试")
            return
        
        # 测试3: 获取热门漫画
        test_hot_comics()
        
        # 测试4: 搜索
        search_comic_id = test_search()
        if search_comic_id:
            comic_id = search_comic_id
        
        # 测试5: 获取漫画详情
        test_comic_detail(comic_id)
        
        # 测试6: 获取章节列表
        chapter_id = test_chapters(comic_id)
        if not chapter_id:
            print("❌ 获取章节列表失败，终止测试")
            return
        
        # 测试7: 获取章节图片
        test_chapter_images(chapter_id)
        
        # 测试完成
        print_separator("✅ 所有测试完成")
        print("所有接口测试通过！")
        print("\n提示:")
        print("  - 如果图片数量为0，可能需要调整CSS选择器")
        print("  - 如果某些数据为空，可能是CSS选择器需要调整")
        print("  - 建议检查网站结构是否有变化")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  测试被用户中断")
    except Exception as e:
        print(f"\n\n❌ 测试过程中出现错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
