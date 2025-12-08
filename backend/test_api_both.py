#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试两个数据源的API"""
import requests

BASE_URL = 'http://127.0.0.1:5000/api/videos'

def test_sources():
    """测试数据源列表"""
    print("=" * 50)
    print("测试数据源列表API")
    print("=" * 50)
    
    response = requests.get(f'{BASE_URL}/sources')
    result = response.json()
    sources = result.get('sources', {})
    
    print(f"\n可用数据源 ({len(sources)}):")
    for source_id, source_info in sources.items():
        print(f"  - {source_id}: {source_info['name']}")
        print(f"    描述: {source_info['description']}")
    
    assert len(sources) == 3, f"应该3个数据源，实际: {len(sources)}"
    
    assert 'badnews' in sources, "应该包含badnews"
    assert 'badnews_av' in sources, "应该包含badnews_av"
    
    print("\n✓ 数据源列表测试通过!")

def test_badnews_hentai_api():
    """测试H动漫API"""
    print("\n" + "=" * 50)
    print("测试 Bad.news H动漫 API (source=badnews)")
    print("=" * 50)
    
    # 测试分类
    print("\n获取分类...")
    response = requests.get(f'{BASE_URL}/categories', params={'source': 'badnews'})
    categories = response.json()
    print(f"分类: {[c['name'] for c in categories]}")
    assert '全部' in [c['name'] for c in categories], "应该包含'全部'分类"
    
    # 测试视频列表
    print("\n获取视频列表...")
    response = requests.get(f'{BASE_URL}/series', params={
        'source': 'badnews',
        'category': 'all',
        'page': 1,
        'limit': 3
    })
    result = response.json()
    videos = result.get('series', [])
    print(f"获取到 {len(videos)} 个视频")
    
    if videos:
        video_id = videos[0]['id']
        print(f"第一个视频ID: {video_id}")
        
        # 测试视频详情
        print("\n获取视频详情...")
        response = requests.get(f'{BASE_URL}/series/{video_id}', params={'source': 'badnews'})
        detail = response.json()
        print(f"视频标题: {detail.get('title')}")
        
        # 测试播放链接
        print("\n获取播放链接...")
        response = requests.get(f'{BASE_URL}/episodes/{video_id}', params={'source': 'badnews'})
        episode = response.json()
        play_url = episode.get('playUrl', '')
        print(f"PlayURL: {play_url}")
        assert '/dm/' in play_url, "H动漫PlayURL应该包含/dm/"
    
    print("\n✓ H动漫API测试通过!")

def test_badnews_av_api():
    """测试AV API"""
    print("\n" + "=" * 50)
    print("测试 Bad.news AV API (source=badnews_av)")
    print("=" * 50)
    
    # 测试分类
    print("\n获取分类...")
    response = requests.get(f'{BASE_URL}/categories', params={'source': 'badnews_av'})
    categories = response.json()
    print(f"分类: {[c['name'] for c in categories]}")
    assert '热门' in [c['name'] for c in categories], "应该包含'热门'分类"
    assert '周榜' in [c['name'] for c in categories], "应该包含'周榜'分类"
    
    # 测试视频列表
    print("\n获取视频列表...")
    response = requests.get(f'{BASE_URL}/series', params={
        'source': 'badnews_av',
        'category': 'all',
        'page': 1,
        'limit': 3
    })
    result = response.json()
    videos = result.get('series', [])
    print(f"获取到 {len(videos)} 个视频")
    
    if videos:
        video_id = videos[0]['id']
        print(f"第一个视频ID: {video_id}")
        
        # 测试视频详情
        print("\n获取视频详情...")
        response = requests.get(f'{BASE_URL}/series/{video_id}', params={'source': 'badnews_av'})
        detail = response.json()
        print(f"视频标题: {detail.get('title')}")
        
        # 测试播放链接
        print("\n获取播放链接...")
        response = requests.get(f'{BASE_URL}/episodes/{video_id}', params={'source': 'badnews_av'})
        episode = response.json()
        play_url = episode.get('playUrl', '')
        print(f"PlayURL: {play_url}")
        assert '/av/' in play_url, "AV PlayURL应该包含/av/"
    
    print("\n✓ AV API测试通过!")

if __name__ == '__main__':
    try:
        test_sources()
        test_badnews_hentai_api()
        test_badnews_av_api()
        
        print("\n" + "=" * 50)
        print("所有API测试通过! 两个数据源都正常工作!")
        print("  - badnews: H动漫 (路径 /dm/)")
        print("  - badnews_av: AV (路径 /av/)")
        print("=" * 50)
        
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
