# -*- coding: utf-8 -*-
"""
视频爬虫测试脚本
直接测试thanju_scraper的功能
"""

import sys
import os
import io

# 设置标准输出编码为UTF-8（Windows兼容）
if sys.platform == 'win32':
    # Windows系统设置UTF-8编码
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 添加当前目录到路径（与test_ebook.py保持一致）
sys.path.append(os.path.dirname(__file__))

from services.thanju_scraper import ThanjuScraper
import json
import logging

# 配置日志，确保UTF-8编码
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
# 设置日志处理器编码
for handler in logging.root.handlers:
    if hasattr(handler, 'stream') and hasattr(handler.stream, 'encoding'):
        if handler.stream.encoding != 'utf-8':
            handler.stream = io.TextIOWrapper(handler.stream.buffer, encoding='utf-8', errors='replace')

logger = logging.getLogger(__name__)

def test_get_categories():
    """测试获取分类列表"""
    logger.info("=" * 80)
    logger.info("测试: 获取分类列表")
    logger.info("=" * 80)
    
    scraper = ThanjuScraper()
    categories = scraper.get_categories()
    
    logger.info("\n获取到 {} 个分类:".format(len(categories)))
    for cat in categories:
        logger.info("  - {} (ID: {})".format(cat['name'], cat['id']))
    
    return categories

def test_get_videos_by_category(category_id='hot', page=1, limit=5):
    """测试获取分类下的视频列表"""
    logger.info("=" * 80)
    logger.info("测试: 获取分类视频 - 分类ID: {}, 页码: {}, 数量: {}".format(category_id, page, limit))
    logger.info("=" * 80)
    
    scraper = ThanjuScraper()
    videos = scraper.get_videos_by_category(category_id, page, limit)
    
    logger.info("\n获取到 {} 个视频:".format(len(videos)))
    for i, video in enumerate(videos[:5], 1):
        logger.info("\n视频 {}:".format(i))
        logger.info("  ID: {}".format(video.get('id', 'N/A')))
        logger.info("  标题: {}".format(video.get('title', 'N/A')))
        logger.info("  评分: {}".format(video.get('rating', 'N/A')))
        logger.info("  集数: {}".format(video.get('episodes', 'N/A')))
        logger.info("  状态: {}".format(video.get('status', 'N/A')))
        logger.info("  演员: {}".format(', '.join(video.get('actors', [])) if video.get('actors') else 'N/A'))
        logger.info("  封面: {}".format(video.get('cover', 'N/A')[:80] if video.get('cover') else 'N/A'))
        logger.info("  数据源: {}".format(video.get('source', 'N/A')))
        logger.info("\n  完整JSON数据:")
        import json
        logger.info("  {}".format(json.dumps(video, ensure_ascii=False, indent=2)))
    
    return videos

def test_get_video_detail(video_id=None):
    """测试获取视频详情"""
    logger.info("=" * 80)
    logger.info("测试: 获取视频详情")
    logger.info("=" * 80)
    
    scraper = ThanjuScraper()
    
    # 如果没有提供ID，先获取一个视频列表
    if not video_id:
        videos = scraper.get_videos_by_category('hot', 1, 1)
        if not videos:
            logger.error("无法获取测试视频ID")
            return None
        video_id = videos[0].get('id')
        logger.info("使用视频ID: {}".format(video_id))
    
    detail = scraper.get_video_detail(video_id)
    
    if detail:
        logger.info("\n视频详情:")
        logger.info("  ID: {}".format(detail.get('id', 'N/A')))
        logger.info("  标题: {}".format(detail.get('title', 'N/A')))
        logger.info("  评分: {}".format(detail.get('rating', 'N/A')))
        logger.info("  年份: {}".format(detail.get('year', 'N/A')))
        logger.info("  导演: {}".format(detail.get('director', 'N/A')))
        logger.info("  主演: {}".format(', '.join(detail.get('actors', [])) if detail.get('actors') else 'N/A'))
        logger.info("  集数: {}".format(detail.get('episodes', 'N/A')))
        logger.info("  状态: {}".format(detail.get('status', 'N/A')))
        logger.info("  标签: {}".format(', '.join(detail.get('tags', [])) if detail.get('tags') else 'N/A'))
        logger.info("  封面: {}".format(detail.get('cover', 'N/A')[:80] if detail.get('cover') else 'N/A'))
        logger.info("  简介: {}".format(detail.get('description', 'N/A')[:200] if detail.get('description') else 'N/A'))
        logger.info("  数据源: {}".format(detail.get('source', 'N/A')))
        logger.info("\n  完整JSON数据:")
        import json
        logger.info("  {}".format(json.dumps(detail, ensure_ascii=False, indent=2)))
    else:
        logger.error("获取视频详情失败")
    
    return detail

def test_get_episodes(video_id=None):
    """测试获取剧集列表"""
    logger.info("=" * 80)
    logger.info("测试: 获取剧集列表")
    logger.info("=" * 80)
    
    scraper = ThanjuScraper()
    
    # 如果没有提供ID，先获取一个视频列表
    if not video_id:
        videos = scraper.get_videos_by_category('hot', 1, 1)
        if not videos:
            logger.error("无法获取测试视频ID")
            return None
        video_id = videos[0].get('id')
        logger.info("使用视频ID: {}".format(video_id))
    
    episodes = scraper.get_episodes(video_id)
    
    logger.info("\n获取到 {} 个剧集:".format(len(episodes)))
    for i, episode in enumerate(episodes[:10], 1):
        logger.info("\n  剧集 {}:".format(i))
        logger.info("    标题: {}".format(episode.get('title', 'N/A')))
        logger.info("    ID: {}".format(episode.get('id', 'N/A')))
        logger.info("    系列ID: {}".format(episode.get('seriesId', 'N/A')))
        logger.info("    集数: {}".format(episode.get('episodeNumber', 'N/A')))
        logger.info("    播放链接: {}".format(episode.get('playUrl', 'N/A')[:100] if episode.get('playUrl') else 'N/A'))
        logger.info("    数据源: {}".format(episode.get('source', 'N/A')))
    
    if episodes:
        logger.info("\n  完整JSON数据 (前3个):")
        import json
        for i, episode in enumerate(episodes[:3], 1):
            logger.info("  剧集 {}:".format(i))
            logger.info("    {}".format(json.dumps(episode, ensure_ascii=False, indent=4)))
    
    return episodes

def test_get_episode_detail(episode_id=None):
    """测试获取单个剧集详情"""
    logger.info("=" * 80)
    logger.info("测试: 获取单个剧集详情")
    logger.info("=" * 80)
    
    scraper = ThanjuScraper()
    
    # 如果没有提供ID，先获取一个视频和剧集
    if not episode_id:
        videos = scraper.get_videos_by_category('hot', 1, 1)
        if not videos:
            logger.error("无法获取测试视频ID")
            return None
        video_id = videos[0].get('id')
        episodes = scraper.get_episodes(video_id)
        if not episodes:
            logger.error("无法获取测试剧集ID")
            return None
        episode_id = episodes[0].get('id')
        logger.info("使用剧集ID: {}".format(episode_id))
    
    episode = scraper.get_episode_detail(episode_id)
    
    if episode:
        logger.info("\n剧集详情:")
        logger.info("  ID: {}".format(episode.get('id', 'N/A')))
        logger.info("  视频链接: {}".format(episode.get('videoUrl', 'N/A')[:100] if episode.get('videoUrl') else 'N/A'))
    else:
        logger.error("获取剧集详情失败")
    
    return episode

def test_search_videos(keyword='亲爱的', page=1, limit=5):
    """测试搜索视频"""
    logger.info("=" * 80)
    logger.info("测试: 搜索视频 - 关键词: {}, 页码: {}, 数量: {}".format(keyword, page, limit))
    logger.info("=" * 80)
    
    scraper = ThanjuScraper()
    videos = scraper.search_videos(keyword, page, limit)
    
    logger.info("\n搜索到 {} 个视频:".format(len(videos)))
    for i, video in enumerate(videos[:5], 1):
        logger.info("\n视频 {}:".format(i))
        logger.info("  ID: {}".format(video.get('id', 'N/A')))
        logger.info("  标题: {}".format(video.get('title', 'N/A')))
        logger.info("  评分: {}".format(video.get('rating', 'N/A')))
        logger.info("  状态: {}".format(video.get('status', 'N/A')))
    
    return videos

def main():
    """主测试函数"""
    logger.info("=" * 80)
    logger.info("视频爬虫测试")
    logger.info("=" * 80)
    
    results = {}
    
    try:
        # 测试获取分类
        results['获取分类'] = test_get_categories() is not None
        
        # 测试获取视频列表
        results['获取热门视频'] = len(test_get_videos_by_category('hot', 1, 5)) > 0
        results['获取最新视频'] = len(test_get_videos_by_category('latest', 1, 5)) > 0
        
        # 测试获取视频详情
        results['获取视频详情'] = test_get_video_detail() is not None
        
        # 测试获取剧集列表
        results['获取剧集列表'] = len(test_get_episodes()) > 0
        
        # 测试获取剧集详情
        results['获取剧集详情'] = test_get_episode_detail() is not None
        
        # 测试搜索
        results['搜索视频'] = len(test_search_videos('亲爱的')) > 0
        
    except Exception as e:
        logger.error("测试过程中发生错误: {}".format(str(e)))
        import traceback
        traceback.print_exc()
    
    # 打印测试总结
    logger.info("\n" + "=" * 80)
    logger.info("测试总结")
    logger.info("=" * 80)
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    failed = total - passed
    
    logger.info("\n总测试数: {}".format(total))
    logger.info("通过: {} ✓".format(passed))
    logger.info("失败: {} ✗".format(failed))
    logger.info("\n详细结果:")
    for test_name, result in results.items():
        status = '✓' if result else '✗'
        logger.info("  {} {}".format(status, test_name))
    
    if failed == 0:
        logger.info("\n✓ 所有测试通过！")
        return 0
    else:
        logger.info("\n✗ {} 个测试失败".format(failed))
        return 1

if __name__ == '__main__':
    sys.exit(main())

