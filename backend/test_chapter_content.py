# -*- coding: utf-8 -*-
import sys
import os
sys.path.append(os.path.dirname(__file__))

from services.kanunu8_scraper import KanuNu8Scraper
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_chapter_content():
    """测试章节内容获取"""
    logger.info("=" * 80)
    logger.info("测试: 获取章节内容")
    logger.info("=" * 80)
    
    scraper = KanuNu8Scraper()
    
    # 测试几个不同的章节ID格式
    test_chapters = [
        "book5_daqiaoxqiao_141687",  # 标准格式
        "141687.htm",                 # HTML格式
    ]
    
    for chapter_id in test_chapters:
        logger.info(f"\n测试章节ID: {chapter_id}")
        result = scraper.get_chapter_content(chapter_id)
        
        if result:
            logger.info(f"标题: {result.get('title', 'N/A')}")
            logger.info(f"URL: {result.get('url', 'N/A')}")
            content = result.get('content', '')
            logger.info(f"内容长度: {len(content)}")
            logger.info(f"内容预览: {content[:200]}...")
        else:
            logger.error("获取章节内容失败")

if __name__ == "__main__":
    test_chapter_content()
