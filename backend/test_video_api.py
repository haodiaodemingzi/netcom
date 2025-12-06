#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
视频API测试脚本
测试所有视频相关的API接口
"""

import requests
import json
import sys
from datetime import datetime

# API基础URL
BASE_URL = 'http://localhost:5000/api'

def print_section(title):
    """打印分节标题"""
    print('\n' + '='*60)
    print(f'  {title}')
    print('='*60)

def print_result(name, response, show_data=True):
    """打印测试结果"""
    status = '✓' if response.status_code == 200 else '✗'
    print('\n{} {}'.format(status, name))
    print('   状态码: {}'.format(response.status_code))
    
    if show_data and response.status_code == 200:
        try:
            data = response.json()
            # 只显示部分数据，避免输出过长
            if isinstance(data, dict):
                if 'sources' in data:
                    print(f'   数据源数量: {len(data.get("sources", {}))}')
                    for source_id, source_info in data.get("sources", {}).items():
                        print(f'     - {source_id}: {source_info.get("name", "")}')
                elif 'series' in data:
                    series_list = data.get('series', [])
                    print(f'   视频数量: {len(series_list)}')
                    if series_list:
                        print(f'   示例视频: {series_list[0].get("title", "N/A")}')
                        print(f'   hasMore: {data.get("hasMore", False)}')
                        print(f'   total: {data.get("total", 0)}')
                elif isinstance(data, list):
                    print(f'   返回列表长度: {len(data)}')
                    if data:
                        print(f'   示例: {data[0].get("name", data[0].get("id", "N/A"))}')
                else:
                    # 显示关键字段
                    key_fields = ['id', 'title', 'name', 'videoUrl', 'episodes']
                    for key in key_fields:
                        if key in data:
                            value = data[key]
                            if isinstance(value, (str, int, float)):
                                print(f'   {key}: {value}')
                            elif isinstance(value, list) and len(value) > 0:
                                print(f'   {key}: [{len(value)}项]')
        except Exception as e:
            print(f'   响应数据: {response.text[:200]}')
    elif response.status_code != 200:
        try:
            error = response.json()
            print(f'   错误: {error.get("error", response.text[:100])}')
        except:
            print(f'   错误: {response.text[:100]}')

def test_get_sources():
    """测试获取数据源列表"""
    print_section('测试：获取视频数据源列表')
    
    url = f'{BASE_URL}/videos/sources'
    response = requests.get(url)
    print_result('GET /videos/sources', response)
    
    return response.status_code == 200

def test_get_categories():
    """测试获取分类列表"""
    print_section('测试：获取视频分类列表')
    
    url = f'{BASE_URL}/videos/categories'
    params = {'source': 'thanju'}
    response = requests.get(url, params=params)
    print_result('GET /videos/categories', response)
    
    return response.status_code == 200

def test_get_series_list():
    """测试获取视频列表"""
    print_section('测试：获取视频列表')
    
    test_cases = [
        {'category': 'hot', 'name': '热门视频'},
        {'category': 'latest', 'name': '最新视频'},
        {'category': '2025', 'name': '2025年视频'},
    ]
    
    all_passed = True
    for case in test_cases:
        url = f'{BASE_URL}/videos/series'
        params = {
            'category': case['category'],
            'page': 1,
            'limit': 10,
            'source': 'thanju'
        }
        response = requests.get(url, params=params)
        passed = response.status_code == 200
        if not passed:
            all_passed = False
        print_result(f'GET /videos/series ({case["name"]})', response)
    
    return all_passed

def test_get_series_detail():
    """测试获取视频详情"""
    print_section('测试：获取视频详情')
    
    # 先获取一个视频ID
    url = f'{BASE_URL}/videos/series'
    params = {'category': 'hot', 'page': 1, 'limit': 1, 'source': 'thanju'}
    response = requests.get(url, params=params)
    
    if response.status_code == 200:
        data = response.json()
        series_list = data.get('series', [])
        if series_list:
            video_id = series_list[0].get('id')
            if video_id:
                # 测试获取详情
                detail_url = f'{BASE_URL}/videos/series/{video_id}'
                detail_params = {'source': 'thanju'}
                detail_response = requests.get(detail_url, params=detail_params)
                print_result(f'GET /videos/series/{video_id}', detail_response)
                return detail_response.status_code == 200
    
    print_result('GET /videos/series/<id> (未找到测试视频)', response, show_data=False)
    return False

def test_get_episodes():
    """测试获取剧集列表"""
    print_section('测试：获取剧集列表')
    
    # 先获取一个视频ID
    url = f'{BASE_URL}/videos/series'
    params = {'category': 'hot', 'page': 1, 'limit': 1, 'source': 'thanju'}
    response = requests.get(url, params=params)
    
    if response.status_code == 200:
        data = response.json()
        series_list = data.get('series', [])
        if series_list:
            video_id = series_list[0].get('id')
            if video_id:
                # 测试获取剧集列表
                episodes_url = f'{BASE_URL}/videos/series/{video_id}/episodes'
                episodes_params = {'source': 'thanju'}
                episodes_response = requests.get(episodes_url, params=episodes_params)
                print_result(f'GET /videos/series/{video_id}/episodes', episodes_response)
                return episodes_response.status_code == 200
    
    print_result('GET /videos/series/<id>/episodes (未找到测试视频)', response, show_data=False)
    return False

def test_get_episode_detail():
    """测试获取单个剧集详情"""
    print_section('测试：获取单个剧集详情')
    
    # 先获取一个视频ID和剧集ID
    url = f'{BASE_URL}/videos/series'
    params = {'category': 'hot', 'page': 1, 'limit': 1, 'source': 'thanju'}
    response = requests.get(url, params=params)
    
    if response.status_code == 200:
        data = response.json()
        series_list = data.get('series', [])
        if series_list:
            video_id = series_list[0].get('id')
            if video_id:
                # 获取剧集列表
                episodes_url = f'{BASE_URL}/videos/series/{video_id}/episodes'
                episodes_params = {'source': 'thanju'}
                episodes_response = requests.get(episodes_url, params=episodes_params)
                
                if episodes_response.status_code == 200:
                    episodes_data = episodes_response.json()
                    if isinstance(episodes_data, list) and len(episodes_data) > 0:
                        episode_id = episodes_data[0].get('id')
                        if episode_id:
                            # 测试获取剧集详情
                            episode_url = f'{BASE_URL}/videos/episodes/{episode_id}'
                            episode_params = {'source': 'thanju'}
                            episode_response = requests.get(episode_url, params=episode_params)
                            print_result(f'GET /videos/episodes/{episode_id}', episode_response)
                            return episode_response.status_code == 200
    
    print_result('GET /videos/episodes/<id> (未找到测试剧集)', response, show_data=False)
    return False

def test_search_videos():
    """测试搜索视频"""
    print_section('测试：搜索视频')
    
    test_keywords = ['亲爱的', '操控']
    
    all_passed = True
    for keyword in test_keywords:
        url = f'{BASE_URL}/videos/search'
        params = {
            'keyword': keyword,
            'page': 1,
            'limit': 10,
            'source': 'thanju'
        }
        response = requests.get(url, params=params)
        passed = response.status_code == 200
        if not passed:
            all_passed = False
        print_result(f'GET /videos/search (关键词: {keyword})', response)
    
    return all_passed

def main():
    """主测试函数"""
    print('\n' + '='*60)
    print('  视频API接口测试')
    print('='*60)
    print(f'测试时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'API地址: {BASE_URL}')
    
    # 检查服务是否运行
    try:
        health_response = requests.get('http://localhost:5000/health', timeout=2)
        if health_response.status_code != 200:
            print('\n✗ 后端服务未正常运行，请先启动后端服务')
            print('  启动命令: cd backend && python app.py')
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print('\n✗ 无法连接到后端服务，请先启动后端服务')
        print('  启动命令: cd backend && python app.py')
        sys.exit(1)
    
    # 运行所有测试
    results = {}
    
    results['获取数据源'] = test_get_sources()
    results['获取分类'] = test_get_categories()
    results['获取视频列表'] = test_get_series_list()
    results['获取视频详情'] = test_get_series_detail()
    results['获取剧集列表'] = test_get_episodes()
    results['获取剧集详情'] = test_get_episode_detail()
    results['搜索视频'] = test_search_videos()
    
    # 打印测试总结
    print_section('测试总结')
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    failed = total - passed
    
    print(f'\n总测试数: {total}')
    print(f'通过: {passed} ✓')
    print(f'失败: {failed} ✗')
    print('\n详细结果:')
    for test_name, result in results.items():
        status = '✓' if result else '✗'
        print(f'  {status} {test_name}')
    
    # 返回退出码
    if failed == 0:
        print('\n✓ 所有测试通过！')
        sys.exit(0)
    else:
        print(f'\n✗ {failed} 个测试失败')
        sys.exit(1)

if __name__ == '__main__':
    main()

