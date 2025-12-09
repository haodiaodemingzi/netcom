#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
美剧屋爬虫测试脚本
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.mjwu_scraper import MjwuScraper
import json


def test_categories():
    """测试获取分类"""
    print("\n" + "="*50)
    print("Test 1: Get Categories")
    print("="*50)
    
    scraper = MjwuScraper()
    categories = scraper.get_categories()
    
    print(f"Category count: {len(categories)}")
    for cat in categories:
        print(f"  - {cat['name']} (id: {cat['id']})")
    
    return len(categories) > 0


def test_video_list():
    """测试获取视频列表"""
    print("\n" + "="*50)
    print("Test 2: Get Video List (Page 1)")
    print("="*50)
    
    scraper = MjwuScraper()
    videos = scraper.get_videos_by_category('meiju', page=1, limit=10)
    
    print(f"Video count: {len(videos)}")
    if videos:
        print("\nFirst 3 videos:")
        for i, video in enumerate(videos[:3], 1):
            print(f"\nVideo {i}:")
            print(f"  ID: {video['id']}")
            print(f"  Title: {video['title']}")
            print(f"  Status: {video.get('status', 'N/A')}")
            print(f"  Score: {video.get('score', 'N/A')}")
            print(f"  Cover: {video.get('cover', 'N/A')[:80]}...")
    
    return len(videos) > 0


def test_video_detail():
    """测试获取视频详情"""
    print("\n" + "="*50)
    print("Test 3: Get Video Detail")
    print("="*50)
    
    scraper = MjwuScraper()
    videos = scraper.get_videos_by_category('meiju', page=1, limit=1)
    if not videos:
        print("Failed to get video list, skip detail test")
        return False
    
    video_id = videos[0]['id']
    print(f"Test video ID: {video_id}")
    
    detail = scraper.get_video_detail(video_id)
    
    if detail:
        print(f"\nVideo detail:")
        print(f"  Title: {detail.get('title', 'N/A')}")
        print(f"  Score: {detail.get('score', 'N/A')}")
        print(f"  Status: {detail.get('status', 'N/A')}")
        print(f"  Area: {detail.get('area', 'N/A')}")
        print(f"  Year: {detail.get('year', 'N/A')}")
        print(f"  Actors: {', '.join(detail.get('actors', []))}")
        print(f"  Tags: {', '.join(detail.get('tags', []))}")
        print(f"  Description: {detail.get('description', 'N/A')[:100]}...")
        return True
    else:
        print("Failed to get detail")
        return False


def test_episodes():
    """测试获取剧集列表"""
    print("\n" + "="*50)
    print("Test 4: Get Episode List")
    print("="*50)
    
    scraper = MjwuScraper()
    videos = scraper.get_videos_by_category('meiju', page=1, limit=1)
    if not videos:
        print("Failed to get video list, skip episode test")
        return False
    
    video_id = videos[0]['id']
    print(f"Test video ID: {video_id}")
    
    episodes = scraper.get_episodes(video_id)
    
    print(f"\nEpisode count: {len(episodes)}")
    if episodes:
        print(f"\nFirst 3 episodes:")
        for i, ep in enumerate(episodes[:3], 1):
            print(f"\n  Episode {i}:")
            print(f"    ID: {ep['id']}")
            print(f"    Title: {ep['title']}")
            print(f"    Number: {ep['episodeNumber']}")
            print(f"    Play URL: {ep.get('playUrl', 'N/A')}")
    
    return len(episodes) > 0


def test_episode_detail():
    """测试获取剧集详情"""
    print("\n" + "="*50)
    print("Test 5: Get Episode Detail")
    print("="*50)
    
    scraper = MjwuScraper()
    videos = scraper.get_videos_by_category('meiju', page=1, limit=1)
    if not videos:
        print("Failed to get video list, skip episode detail test")
        return False
    
    video_id = videos[0]['id']
    episodes = scraper.get_episodes(video_id)
    if not episodes:
        print("Failed to get episode list, skip episode detail test")
        return False
    
    episode_id = episodes[0]['id']
    print(f"Test episode ID: {episode_id}")
    
    episode_detail = scraper.get_episode_detail(episode_id)
    
    if episode_detail:
        print(f"\nEpisode detail:")
        print(f"  Title: {episode_detail.get('title', 'N/A')}")
        print(f"  Number: {episode_detail.get('episodeNumber', 'N/A')}")
        print(f"  Play URL: {episode_detail.get('playUrl', 'N/A')}")
        print(f"  Video URL: {episode_detail.get('videoUrl', 'N/A')}")
        return True
    else:
        print("Failed to get episode detail")
        return False


def test_search():
    """测试搜索功能"""
    print("\n" + "="*50)
    print("Test 6: Search Videos")
    print("="*50)
    
    scraper = MjwuScraper()
    keyword = "power"
    print(f"Search keyword: {keyword}")
    
    results = scraper.search_videos(keyword, page=1, limit=5)
    
    print(f"\nSearch results: {len(results)}")
    if results:
        print(f"\nFirst 3 results:")
        for i, video in enumerate(results[:3], 1):
            print(f"\n  Result {i}:")
            print(f"    ID: {video['id']}")
            print(f"    Title: {video['title']}")
            print(f"    Status: {video.get('status', 'N/A')}")
    
    return len(results) > 0


def test_pagination():
    """测试分页功能"""
    print("\n" + "="*50)
    print("Test 7: Pagination")
    print("="*50)
    
    scraper = MjwuScraper()
    
    page1 = scraper.get_videos_by_category('meiju', page=1, limit=5)
    print(f"Page 1 videos: {len(page1)}")
    
    page2 = scraper.get_videos_by_category('meiju', page=2, limit=5)
    print(f"Page 2 videos: {len(page2)}")
    
    if page1 and page2:
        page1_ids = set(v['id'] for v in page1)
        page2_ids = set(v['id'] for v in page2)
        is_different = len(page1_ids & page2_ids) == 0
        print(f"Pages are different: {is_different}")
        return is_different
    
    return False


def main():
    """运行所有测试"""
    print("\n" + "="*70)
    print("Mjwu Scraper Function Tests")
    print("="*70)
    
    results = {}
    
    try:
        results['Categories'] = test_categories()
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        results['Categories'] = False
    
    try:
        results['Video List'] = test_video_list()
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        results['Video List'] = False
    
    try:
        results['Video Detail'] = test_video_detail()
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        results['Video Detail'] = False
    
    try:
        results['Episode List'] = test_episodes()
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        results['Episode List'] = False
    
    try:
        results['Episode Detail'] = test_episode_detail()
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        results['Episode Detail'] = False
    
    try:
        results['Search'] = test_search()
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        results['Search'] = False
    
    try:
        results['Pagination'] = test_pagination()
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
        results['Pagination'] = False
    
    print("\n" + "="*70)
    print("Test Summary")
    print("="*70)
    for test_name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"{test_name}: {status}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    print(f"\nTotal: {passed}/{total} tests passed")
    print("="*70)
    
    return passed == total


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
