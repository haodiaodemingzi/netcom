"""
测试meta图片获取功能
"""
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.meta_image_fetcher import get_meta_image
from services.source_market import SourceMarket

def test_meta_image_fetcher():
    """测试meta图片获取"""
    print("=" * 50)
    print("测试meta图片获取功能")
    print("=" * 50)
    
    test_urls = [
        "https://www.thanju.com",
        "https://bad.news",
        "https://xmanhua.com",
    ]
    
    for url in test_urls:
        print(f"\n测试URL: {url}")
        try:
            image_url = get_meta_image(url)
            if image_url:
                print(f"✓ 成功获取图片: {image_url}")
            else:
                print("✗ 未找到图片")
        except Exception as e:
            print(f"✗ 错误: {e}")

def test_source_market():
    """测试数据源市场自动获取图标"""
    print("\n" + "=" * 50)
    print("测试数据源市场自动获取图标")
    print("=" * 50)
    
    market = SourceMarket()
    sources = market.get_all_sources()
    
    print(f"\n找到 {len(sources)} 个数据源:")
    for source in sources:
        print(f"\n数据源: {source.get('name')} ({source.get('id')})")
        print(f"  URL: {source.get('url', 'N/A')}")
        print(f"  图标: {source.get('icon', 'N/A')}")
        if source.get('icon') and 'via.placeholder.com' not in source.get('icon', ''):
            print(f"  ✓ 已获取真实图标")
        else:
            print(f"  - 使用占位符或未获取到图标")

if __name__ == '__main__':
    try:
        test_meta_image_fetcher()
        test_source_market()
        print("\n" + "=" * 50)
        print("测试完成")
        print("=" * 50)
    except Exception as e:
        import traceback
        print(f"\n测试失败: {e}")
        traceback.print_exc()

