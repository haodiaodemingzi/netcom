#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
一夜听书网(huanting.cc) 爬虫测试脚本
"""

import sys
import logging

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 导入爬虫
from services.huanting_scraper import HuantingScraper


def test_get_categories(scraper):
    """测试获取分类列表"""
    print("\n" + "="*50)
    print("测试: 获取分类列表")
    print("="*50)

    result = scraper.get_categories()
    print(f"分类数量: {len(result['categories'])}")
    for cat in result['categories']:
        print(f"  - {cat['id']}: {cat['name']}")
    return result


def test_get_programs(scraper, category='all'):
    """测试获取节目列表"""
    print("\n" + "="*50)
    print(f"测试: 获取节目列表 (分类: {category})")
    print("="*50)

    result = scraper.get_programs(category=category, page=1, limit=10)
    print(f"节目数量: {result['total']}")
    print(f"是否还有更多: {result['hasMore']}")
    for prog in result['programs'][:3]:
        print(f"\n节目: {prog['title']}")
        print(f"  ID: {prog['id']}")
        print(f"  主播: {prog['author']}")
        print(f"  状态: {prog['status']}")
        print(f"  封面: {prog['cover'][:50]}..." if prog['cover'] and len(prog['cover']) > 50 else f"  封面: {prog['cover']}")
    return result


def test_get_program_detail(scraper, program_id):
    """测试获取节目详情"""
    print("\n" + "="*50)
    print(f"测试: 获取节目详情 (ID: {program_id})")
    print("="*50)

    result = scraper.get_program_detail(program_id)
    if result:
        print(f"标题: {result['title']}")
        print(f"主播: {result['author']}")
        print(f"状态: {result['status']}")
        print(f"集数: {result['episodes']}")
        print(f"描述: {result['description'][:100]}..." if result['description'] and len(result['description']) > 100 else f"描述: {result['description']}")
        print(f"封面: {result['cover'][:50]}..." if result['cover'] and len(result['cover']) > 50 else f"封面: {result['cover']}")
    else:
        print("获取详情失败")
    return result


def test_get_episodes(scraper, program_id):
    """测试获取章节列表"""
    print("\n" + "="*50)
    print(f"测试: 获取章节列表 (节目ID: {program_id})")
    print("="*50)

    result = scraper.get_episodes(program_id, page=1, limit=10)
    print(f"章节数量: {result['total']}")
    print(f"是否还有更多: {result['hasMore']}")
    for ep in result['episodes'][:3]:
        print(f"  - {ep['order']}. {ep['title']} (ID: {ep['id']})")
    return result


def test_get_episode_detail(scraper, episode_id):
    """测试获取章节详情和音频链接"""
    print("\n" + "="*50)
    print(f"测试: 获取章节详情/音频链接 (ID: {episode_id})")
    print("="*50)

    result = scraper.get_episode_detail(episode_id)
    if result:
        print(f"标题: {result['title']}")
        print(f"时长: {result['duration']}")
        print(f"音频URL: {result['audioUrl'][:80]}..." if result['audioUrl'] and len(result['audioUrl']) > 80 else f"音频URL: {result['audioUrl']}")
    else:
        print("获取章节详情失败")
    return result


def main():
    """主测试函数"""
    print("\n" + "="*60)
    print("一夜听书网(huanting.cc) 爬虫测试")
    print("="*60)

    # 初始化爬虫
    scraper = HuantingScraper()

    # 测试1: 获取分类
    categories = test_get_categories(scraper)

    # 测试2: 获取热门节目
    programs = test_get_programs(scraper, category='all')

    # 如果有节目，测试详情
    if programs['programs']:
        test_program_id = programs['programs'][0]['id']
        print(f"\n>>> 使用节目ID进行后续测试: {test_program_id}")

        # 测试3: 获取节目详情
        detail = test_get_program_detail(scraper, test_program_id)

        # 测试4: 获取章节列表
        episodes = test_get_episodes(scraper, test_program_id)

        # 如果有章节，测试章节详情
        if episodes['episodes']:
            test_episode_id = episodes['episodes'][0]['id']
            print(f"\n>>> 使用章节ID进行音频测试: {test_episode_id}")

            # 测试5: 获取章节详情/音频链接
            episode_detail = test_get_episode_detail(scraper, test_episode_id)

    # 测试特定分类
    print("\n" + "="*60)
    print("测试特定分类: 玄幻武侠 (xuanhuan)")
    print("="*60)
    xuanhuan_programs = test_get_programs(scraper, category='xuanhuan')

    print("\n" + "="*60)
    print("测试完成!")
    print("="*60)


if __name__ == '__main__':
    main()
