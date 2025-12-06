# -*- coding: utf-8 -*-
"""测试 Bad.news 爬虫"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.badnews_scraper import BadNewsScraper


def test_categories():
    """测试获取分类"""
    print("\n=== 测试获取分类 ===")
    scraper = BadNewsScraper()
    categories = scraper.get_categories()
    print(f"分类数量: {len(categories)}")
    for cat in categories:
        print(f"  - {cat['id']}: {cat['name']}")
    return len(categories) > 0


def test_video_list():
    """测试获取视频列表"""
    print("\n=== 测试获取视频列表 ===")
    scraper = BadNewsScraper()
    videos = scraper.get_videos_by_category('all', page=1, limit=10)
    print(f"视频数量: {len(videos)}")
    for i, video in enumerate(videos[:5]):
        print(f"  {i+1}. ID:{video['id']} - {video['title'][:30]}...")
        print(f"     封面: {video.get('cover', 'N/A')[:50]}...")
    return len(videos) > 0


def test_video_detail():
    """测试获取视频详情"""
    print("\n=== 测试获取视频详情 ===")
    scraper = BadNewsScraper()
    
    # 先获取一个视频ID
    videos = scraper.get_videos_by_category('all', page=1, limit=1)
    if not videos:
        print("无法获取视频列表")
        return False
    
    video_id = videos[0]['id']
    print(f"测试视频ID: {video_id}")
    
    detail = scraper.get_video_detail(video_id)
    if detail:
        print(f"  标题: {detail.get('title', 'N/A')[:50]}")
        print(f"  标签: {detail.get('tags', [])[:5]}")
        print(f"  简介: {detail.get('description', 'N/A')[:100]}...")
        return True
    else:
        print("获取详情失败")
        return False


def test_episodes():
    """测试获取剧集列表"""
    print("\n=== 测试获取剧集列表 ===")
    scraper = BadNewsScraper()
    
    # 先获取一个视频ID
    videos = scraper.get_videos_by_category('all', page=1, limit=1)
    if not videos:
        print("无法获取视频列表")
        return False
    
    video_id = videos[0]['id']
    print(f"测试视频ID: {video_id}")
    
    episodes = scraper.get_episodes(video_id)
    print(f"剧集数量: {len(episodes)}")
    for ep in episodes:
        print(f"  - {ep['title']} (ID: {ep['id']})")
    return len(episodes) > 0


def test_episode_detail():
    """测试获取剧集详情"""
    print("\n=== 测试获取剧集详情 ===")
    scraper = BadNewsScraper()
    
    # 先获取一个视频ID
    videos = scraper.get_videos_by_category('all', page=1, limit=1)
    if not videos:
        print("无法获取视频列表")
        return False
    
    video_id = videos[0]['id']
    print(f"测试视频ID: {video_id}")
    
    episode = scraper.get_episode_detail(video_id)
    if episode:
        print(f"  标题: {episode.get('title', 'N/A')[:50]}")
        print(f"  播放URL: {episode.get('playUrl', 'N/A')}")
        print(f"  视频URL: {episode.get('videoUrl', 'N/A')}")
        return True
    else:
        print("获取剧集详情失败")
        return False


def test_search():
    """测试搜索功能"""
    print("\n=== 测试搜索功能 ===")
    scraper = BadNewsScraper()
    
    keyword = "JK"
    print(f"搜索关键词: {keyword}")
    
    videos = scraper.search_videos(keyword, page=1, limit=5)
    print(f"搜索结果数量: {len(videos)}")
    for i, video in enumerate(videos[:3]):
        print(f"  {i+1}. ID:{video['id']} - {video['title'][:30]}...")
    return len(videos) > 0


def test_pagination():
    """测试翻页功能"""
    print("\n=== 测试翻页功能 ===")
    scraper = BadNewsScraper()
    
    # 第1页
    page1 = scraper.get_videos_by_category('all', page=1, limit=5)
    print(f"第1页视频数量: {len(page1)}")
    
    # 第2页
    page2 = scraper.get_videos_by_category('all', page=2, limit=5)
    print(f"第2页视频数量: {len(page2)}")
    
    # 检查是否不同
    if page1 and page2:
        page1_ids = set(v['id'] for v in page1)
        page2_ids = set(v['id'] for v in page2)
        overlap = page1_ids.intersection(page2_ids)
        print(f"两页重复视频数: {len(overlap)}")
        return len(page1) > 0 and len(page2) > 0 and len(overlap) == 0
    return False


def main():
    """运行所有测试"""
    print("=" * 60)
    print("Bad.news 爬虫测试")
    print("=" * 60)
    
    results = {
        '分类获取': test_categories(),
        '视频列表': test_video_list(),
        '视频详情': test_video_detail(),
        '剧集列表': test_episodes(),
        '剧集详情': test_episode_detail(),
        '搜索功能': test_search(),
        '翻页功能': test_pagination(),
    }
    
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    for name, result in results.items():
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {name}: {status}")
    
    passed = sum(1 for r in results.values() if r)
    total = len(results)
    print(f"\n总计: {passed}/{total} 通过")
    
    return all(results.values())


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
