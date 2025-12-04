# -*- coding: utf-8 -*-
import sys
import os
sys.path.append(os.path.dirname(__file__))

from services.kanunu8_scraper import KanuNu8Scraper
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_html_structure():
    """测试页面HTML结构"""
    logger.info("=" * 80)
    logger.info("测试: 页面HTML结构")
    logger.info("=" * 80)
    
    scraper = KanuNu8Scraper()
    
    # 测试一个具体的书籍ID
    test_book_id = "2444"  
    
    logger.info(f"测试书籍ID: {test_book_id}")
    
    # 构建书籍详情URL
    book_url = scraper._build_book_url(test_book_id)
    logger.info(f"书籍URL: {book_url}")
    
    response = scraper._make_request(book_url)
    if not response:
        logger.error("无法获取页面")
        return
    
    # 保存HTML到文件以便检查
    with open('book_detail.html', 'w', encoding='utf-8') as f:
        f.write(response.text)
    logger.info("HTML内容已保存到 book_detail.html")
    
    # 查找可能的简介选择器
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 查找所有包含"简介"、"内容"、"介绍"等关键词的元素
    keywords = ['简介', '内容', '介绍', 'summary', 'desc', 'description']
    
    for keyword in keywords:
        elements = soup.find_all(text=lambda text: text and keyword in text)
        if elements:
            logger.info(f"找到包含 '{keyword}' 的文本:")
            for i, element in enumerate(elements[:5]):  # 只显示前5个
                logger.info(f"  {i+1}. {element.strip()}")
    
    # 查找可能包含简介的class或id
    possible_classes = ['summary', 'desc', 'description', 'intro', 'content', 'info']
    for class_name in possible_classes:
        elements = soup.find_all(class_=class_name)
        if elements:
            logger.info(f"找到class='{class_name}'的元素:")
            for i, element in enumerate(elements[:3]):  # 只显示前3个
                text = element.get_text(strip=True)
                if text:
                    logger.info(f"  {i+1}. {text[:100]}...")

if __name__ == "__main__":
    test_html_structure()
