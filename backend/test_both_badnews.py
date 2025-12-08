#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试badnews和badnews_av两个数据源"""

from services.badnews_scraper import BadNewsScraper
from services.badnews_av_scraper import BadNewsAVScraper

def test_badnews_hentai():
    """测试H动漫数据源"""
    print("=" * 50)
    print("测试 Bad.news H动漫数据源 (badnews)")
    print("=" * 50)
    
    scraper = BadNewsScraper()
    
    # 检查source_id
    print(f"\nSource ID: {scraper.source_id}")
    assert scraper.source_id == 'badnews', "H动漫source_id应该是badnews"
    
    # 检查分类
    print(f"\n获取分类...")
    categories = scraper.get_categories()
    print(f"分类数量: {len(categories)}")
    print(f"分类: {[cat['name'] for cat in categories]}")
    assert '全部' in [cat['name'] for cat in categories], "应该包含'全部'分类"
    assert '3D动画' in [cat['name'] for cat in categories], "应该包含'3D动画'分类"
    
    # 检查视频列表
    print(f"\n获取视频列表...")
    videos = scraper.get_videos_by_category('all', page=1, limit=3)
    if videos:
        print(f"获取到 {len(videos)} 个视频")
        video = videos[0]
        print(f"第一个视频: {video['title']}")
        print(f"视频ID: {video['id']}")
        # 获取详情检查URL
        detail = scraper.get_video_detail(video['id'])
        if detail:
            episodes = scraper.get_episodes(video['id'])
            if episodes:
                playUrl = episodes[0].get('playUrl', '')
                print(f"PlayURL: {playUrl}")
                assert '/dm/' in playUrl, "PlayURL应该包含/dm/路径"
    
    print("\n✓ H动漫数据源测试通过!")

def test_badnews_av():
    """测试AV数据源"""
    print("\n" + "=" * 50)
    print("测试 Bad.news AV数据源 (badnews_av)")
    print("=" * 50)
    
    scraper = BadNewsAVScraper()
    
    # 检查source_id
    print(f"\nSource ID: {scraper.source_id}")
    assert scraper.source_id == 'badnews_av', "AV的source_id应该是badnews_av"
    
    # 检查分类
    print(f"\n获取分类...")
    categories = scraper.get_categories()
    print(f"分类数量: {len(categories)}")
    print(f"分类: {[cat['name'] for cat in categories]}")
    assert '热门' in [cat['name'] for cat in categories], "应该包含'热门'分类"
    assert '周榜' in [cat['name'] for cat in categories], "应该包含'周榜'分类"
    
    # 检查视频列表
    print(f"\n获取视频列表...")
    videos = scraper.get_videos_by_category('all', page=1, limit=3)
    if videos:
        print(f"获取到 {len(videos)} 个视频")
        video = videos[0]
        print(f"第一个视频: {video['title']}")
        print(f"视频ID: {video['id']}")
        # 获取详情检查URL
        detail = scraper.get_video_detail(video['id'])
        if detail:
            episodes = scraper.get_episodes(video['id'])
            if episodes:
                playUrl = episodes[0].get('playUrl', '')
                print(f"PlayURL: {playUrl}")
                assert '/av/' in playUrl, "PlayURL应该包含/av/路径"
    
    print("\n✓ AV数据源测试通过!")

if __name__ == '__main__':
    try:
        test_badnews_hentai()
        test_badnews_av()
        
        print("\n" + "=" * 50)
        print("所有测试通过! 两个数据源都正常工作!")
        print("=" * 50)
        
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
