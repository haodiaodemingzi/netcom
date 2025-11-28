# -*- coding: utf-8 -*-
"""
测试分页功能
"""
import sys
import os

# 添加父目录到路径
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from services.xmanhua_scraper import XmanhuaScraper

print(f"当前工作目录: {os.getcwd()}")
print(f"脚本目录: {current_dir}")

def test_pagination():
    """测试分页功能"""
    print("="*80)
    print("开始测试分页功能")
    print("="*80)
    
    scraper = XmanhuaScraper()
    
    # 测试第1页
    print("\n>>> 测试第1页")
    page1 = scraper.get_comics_by_category('31', page=1, limit=20)
    print(f"第1页结果: {len(page1['comics'])} 个漫画")
    print(f"hasMore: {page1['hasMore']}")
    if page1['comics']:
        print(f"第1个漫画: ID={page1['comics'][0]['id']}, 标题={page1['comics'][0]['title']}")
        print(f"最后1个漫画: ID={page1['comics'][-1]['id']}, 标题={page1['comics'][-1]['title']}")
    
    # 测试第2页
    print("\n>>> 测试第2页")
    page2 = scraper.get_comics_by_category('31', page=2, limit=20)
    print(f"第2页结果: {len(page2['comics'])} 个漫画")
    print(f"hasMore: {page2['hasMore']}")
    if page2['comics']:
        print(f"第1个漫画: ID={page2['comics'][0]['id']}, 标题={page2['comics'][0]['title']}")
        print(f"最后1个漫画: ID={page2['comics'][-1]['id']}, 标题={page2['comics'][-1]['title']}")
    
    # 测试第3页
    print("\n>>> 测试第3页")
    page3 = scraper.get_comics_by_category('31', page=3, limit=20)
    print(f"第3页结果: {len(page3['comics'])} 个漫画")
    print(f"hasMore: {page3['hasMore']}")
    if page3['comics']:
        print(f"第1个漫画: ID={page3['comics'][0]['id']}, 标题={page3['comics'][0]['title']}")
        print(f"最后1个漫画: ID={page3['comics'][-1]['id']}, 标题={page3['comics'][-1]['title']}")
    
    # 比较页面是否有重复
    print("\n>>> 检查页面重复")
    if page1['comics'] and page2['comics']:
        page1_ids = set(c['id'] for c in page1['comics'])
        page2_ids = set(c['id'] for c in page2['comics'])
        common = page1_ids & page2_ids
        if common:
            print(f"⚠️  警告: 第1页和第2页有 {len(common)} 个重复漫画!")
            print(f"重复ID: {list(common)[:5]}")
        else:
            print(f"✓ 第1页和第2页没有重复")
    
    if page2['comics'] and page3['comics']:
        page2_ids = set(c['id'] for c in page2['comics'])
        page3_ids = set(c['id'] for c in page3['comics'])
        common = page2_ids & page3_ids
        if common:
            print(f"⚠️  警告: 第2页和第3页有 {len(common)} 个重复漫画!")
            print(f"重复ID: {list(common)[:5]}")
        else:
            print(f"✓ 第2页和第3页没有重复")
    
    print("\n" + "="*80)
    print("测试完成!")
    print("="*80)

if __name__ == '__main__':
    test_pagination()
