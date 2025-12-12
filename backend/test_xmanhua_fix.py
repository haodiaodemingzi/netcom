# -*- coding: utf-8 -*-
"""
测试 Xmanhua 图片获取 - 验证 Cookie 传递
"""

import sys
import os
import logging

# 设置详细的日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 添加backend目录到路径
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# 使用绝对导入
from services.xmanhua_scraper import XmanhuaScraper

def main():
    print("=" * 70)
    print("测试 Xmanhua 图片获取功能 - Cookie 传递验证")
    print("=" * 70)
    
    chapter_id = 'm451717'
    print(f"\n测试章节: {chapter_id}")
    print("-" * 70)
    
    try:
        # 创建 scraper
        scraper = XmanhuaScraper()
        
        # 获取章节图片
        print("\n开始获取章节图片...\n")
        result = scraper.get_chapter_images(chapter_id)
        
        print("\n" + "=" * 70)
        print("测试结果:")
        print("=" * 70)
        
        total = result.get('total', 0)
        expected = result.get('expected_total', 0)
        images = result.get('images', [])
        
        print(f"获取到的图片数: {total}")
        print(f"期望的图片数: {expected}")
        
        if images:
            print(f"\n前3张图片URL:")
            for img in images[:3]:
                url = img['url']
                # 检查URL是否包含必要的参数
                has_cid = 'cid=' in url
                has_key = 'key=' in url
                has_uk = 'uk=' in url
                
                print(f"\n  第{img['page']}页:")
                print(f"    URL: {url[:80]}...")
                print(f"    参数检查: cid={has_cid}, key={has_key}, uk={has_uk}")
            
            if len(images) > 3:
                print(f"\n  ... 还有 {len(images)-3} 张图片")
            
            # 验证结果
            if total == expected and total > 0:
                print("\n" + "=" * 70)
                print("✅ 测试成功！所有图片URL已获取")
                print("=" * 70)
                return True
            else:
                print("\n" + "=" * 70)
                print(f"⚠️  警告：获取的图片数({total})与期望数({expected})不一致")
                print("=" * 70)
                return total > 0
        else:
            print("\n❌ 失败：未获取到任何图片")
            print("\n请检查上面的日志输出，特别注意:")
            print("  1. Cookie 是否正确传递")
            print("  2. API 响应状态码")
            print("  3. API 响应内容")
            return False
            
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
