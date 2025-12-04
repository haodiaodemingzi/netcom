# -*- coding: utf-8 -*-
import sys
import os
sys.path.append(os.path.dirname(__file__))

from services.kanunu8_scraper import KanuNu8Scraper
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_book_description():
    """测试书籍详情和简介提取"""
    logger.info("=" * 80)
    logger.info("测试: 获取书籍详情和简介")
    logger.info("=" * 80)
    
    scraper = KanuNu8Scraper()
    
    # 测试一个具体的书籍ID
    test_book_id = "2444"  # 可以替换成其他书籍ID
    
    logger.info(f"测试书籍ID: {test_book_id}")
    result = scraper.get_book_detail(test_book_id)
    
    if result:
        logger.info(f"书名: {result.get('title', 'N/A')}")
        logger.info(f"作者: {result.get('author', 'N/A')}")
        logger.info(f"简介: {result.get('description', 'N/A')}")
        logger.info(f"章节数: {result.get('totalChapters', 0)}")
        logger.info(f"URL: {result.get('url', 'N/A')}")
    else:
        logger.error("获取书籍详情失败")

if __name__ == "__main__":
    test_book_description()
