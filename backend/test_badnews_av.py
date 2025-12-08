#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Bad.news AV站点爬虫测试
测试 /av 路径的日本AV视频爬取功能
"""

from services.badnews_scraper import BadNewsScraper

def test_categories():
    """测试获取分类列表"""
    print("\n========== 测试获取分类列表 ==========")
    scraper = BadNewsScraper()
    categories = scraper.get_categories()
    
    print(f"分类数量: {len(categories)}")
    for cat in categories:
        print(f"  - {cat['name']} (id: {cat['id']})")
    
    assert len(categories) > 0, "分类列表不能为空"
    print("✓ 分类列表测试通过")

def test_video_list():
    """测试获取视频列表"""
    print("\n========== 测试获取视频列表 ==========")
    scraper = BadNewsScraper()
    
    # 测试热门分类
    videos = scraper.get_videos_by_category('all', page=1, limit=5)
    
    print(f"视频数量: {len(videos)}")
    for video in videos:
        print(f"\n视频ID: {video['id']}")
        print(f"标题: {video['title']}")
        print(f"封面: {video.get('cover', 'N/A')[:80]}...")
        print(f"时长: {video.get('duration', 'N/A')}")
    
    assert len(videos) > 0, "视频列表不能为空"
    assert all('id' in v and 'title' in v for v in videos), "视频必须包含id和title"
    print("\n✓ 视频列表测试通过")
    
    return videos[0]['id'] if videos else None

def test_video_detail(video_id):
    """测试获取视频详情"""
    print(f"\n========== 测试获取视频详情 (ID: {video_id}) ==========")
    scraper = BadNewsScraper()
    
    detail = scraper.get_video_detail(video_id)
    
    if detail:
        print(f"标题: {detail['title']}")
        print(f"封面: {detail.get('cover', 'N/A')[:80]}...")
        print(f"演员: {', '.join(detail.get('actors', []))}")
        print(f"标签: {', '.join(detail.get('tags', []))}")
        
        assert detail['id'] == video_id, "视频ID不匹配"
        assert detail['title'], "标题不能为空"
        print("\n✓ 视频详情测试通过")
    else:
        print("✗ 获取视频详情失败")
    
    return detail

def test_episode_detail(video_id):
    """测试获取播放链接"""
    print(f"\n========== 测试获取播放链接 (ID: {video_id}) ==========")
    scraper = BadNewsScraper()
    
    episode = scraper.get_episode_detail(video_id)
    
    if episode:
        print(f"标题: {episode['title']}")
        print(f"播放URL: {episode.get('playUrl', 'N/A')}")
        print(f"视频URL: {episode.get('videoUrl', 'N/A')[:100]}...")
        
        assert episode['id'] == video_id, "剧集ID不匹配"
        assert episode.get('videoUrl'), "视频URL不能为空"
        print("\n✓ 播放链接测试通过")
    else:
        print("✗ 获取播放链接失败")
    
    return episode

def test_search():
    """测试搜索功能"""
    print("\n========== 测试搜索功能 ==========")
    scraper = BadNewsScraper()
    
    keyword = "中文字幕"
    videos = scraper.search_videos(keyword, page=1, limit=5)
    
    print(f"搜索关键词: {keyword}")
    print(f"搜索结果数量: {len(videos)}")
    
    for video in videos[:3]:
        print(f"\n  - {video['title']}")
        print(f"    ID: {video['id']}")
    
    if len(videos) > 0:
        print("\n✓ 搜索功能测试通过")
    else:
        print("\n⚠ 搜索结果为空")

def test_pagination():
    """测试分页功能"""
    print("\n========== 测试分页功能 ==========")
    scraper = BadNewsScraper()
    
    # 获取第1页
    page1 = scraper.get_videos_by_category('all', page=1, limit=5)
    # 获取第2页
    page2 = scraper.get_videos_by_category('all', page=2, limit=5)
    
    print(f"第1页视频数: {len(page1)}")
    print(f"第2页视频数: {len(page2)}")
    
    if len(page1) > 0 and len(page2) > 0:
        # 检查两页的视频ID不重复
        page1_ids = set(v['id'] for v in page1)
        page2_ids = set(v['id'] for v in page2)
        overlap = page1_ids & page2_ids
        
        if len(overlap) == 0:
            print("✓ 分页功能测试通过（两页视频无重复）")
        else:
            print(f"⚠ 警告: 两页有{len(overlap)}个重复视频")
    else:
        print("⚠ 分页数据不足以测试")

def main():
    """运行所有测试"""
    print("=" * 60)
    print("Bad.news AV站点爬虫测试")
    print("=" * 60)
    
    try:
        # 1. 测试分类
        test_categories()
        
        # 2. 测试视频列表
        video_id = test_video_list()
        
        if video_id:
            # 3. 测试视频详情
            test_video_detail(video_id)
            
            # 4. 测试播放链接
            test_episode_detail(video_id)
        
        # 5. 测试搜索
        test_search()
        
        # 6. 测试分页
        test_pagination()
        
        print("\n" + "=" * 60)
        print("✓ 所有测试完成!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
