#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试 Bad.news AV 数据源的 API 接口
"""

import requests
import json

BASE_URL = 'http://localhost:5000/api'

def test_get_sources():
    """测试获取数据源列表"""
    print("\n========== 测试获取数据源列表 ==========")
    response = requests.get(f'{BASE_URL}/videos/sources')
    data = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"数据源: {json.dumps(data, ensure_ascii=False, indent=2)}")
    
    assert 'badnews' in data['sources'], "Bad.news数据源应该存在"
    print("✓ 数据源列表测试通过")

def test_get_categories():
    """测试获取分类"""
    print("\n========== 测试获取分类 ==========")
    response = requests.get(f'{BASE_URL}/videos/categories', params={'source': 'badnews'})
    categories = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"分类数量: {len(categories)}")
    for cat in categories:
        print(f"  - {cat['name']} (id: {cat['id']})")
    
    assert len(categories) > 0, "分类列表不能为空"
    print("✓ 分类测试通过")

def test_get_videos():
    """测试获取视频列表"""
    print("\n========== 测试获取视频列表 ==========")
    response = requests.get(f'{BASE_URL}/videos/series', params={
        'source': 'badnews',
        'category': 'all',
        'page': 1,
        'limit': 5
    })
    data = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"视频数量: {len(data['series'])}")
    
    for video in data['series']:
        print(f"\n  视频ID: {video['id']}")
        print(f"  标题: {video['title']}")
        print(f"  时长: {video.get('duration', 'N/A')}")
    
    assert len(data['series']) > 0, "视频列表不能为空"
    print("\n✓ 视频列表测试通过")
    
    return data['series'][0]['id'] if data['series'] else None

def test_get_video_detail(video_id):
    """测试获取视频详情"""
    print(f"\n========== 测试获取视频详情 (ID: {video_id}) ==========")
    response = requests.get(f'{BASE_URL}/videos/series/{video_id}', params={'source': 'badnews'})
    detail = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"标题: {detail['title']}")
    print(f"演员: {', '.join(detail.get('actors', []))}")
    print(f"标签: {', '.join(detail.get('tags', []))}")
    
    assert detail['id'] == video_id, "视频ID不匹配"
    print("\n✓ 视频详情测试通过")

def test_get_episode_detail(video_id):
    """测试获取播放链接"""
    print(f"\n========== 测试获取播放链接 (ID: {video_id}) ==========")
    response = requests.get(f'{BASE_URL}/videos/episodes/{video_id}', params={'source': 'badnews'})
    episode = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"标题: {episode['title']}")
    print(f"视频URL: {episode.get('videoUrl', 'N/A')[:100]}...")
    
    assert episode.get('videoUrl'), "视频URL不能为空"
    print("\n✓ 播放链接测试通过")

def test_search_videos():
    """测试搜索"""
    print("\n========== 测试搜索功能 ==========")
    response = requests.get(f'{BASE_URL}/videos/search', params={
        'source': 'badnews',
        'keyword': '中文字幕',
        'page': 1,
        'limit': 5
    })
    data = response.json()
    
    print(f"状态码: {response.status_code}")
    print(f"搜索结果: {len(data['series'])} 个")
    
    for video in data['series'][:3]:
        print(f"  - {video['title']}")
    
    print("\n✓ 搜索功能测试通过")

def main():
    """运行所有测试"""
    print("=" * 60)
    print("Bad.news AV API 测试")
    print("=" * 60)
    
    try:
        # 1. 测试数据源
        test_get_sources()
        
        # 2. 测试分类
        test_get_categories()
        
        # 3. 测试视频列表
        video_id = test_get_videos()
        
        if video_id:
            # 4. 测试视频详情
            test_get_video_detail(video_id)
            
            # 5. 测试播放链接
            test_get_episode_detail(video_id)
        
        # 6. 测试搜索
        test_search_videos()
        
        print("\n" + "=" * 60)
        print("✓ 所有 API 测试完成!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
