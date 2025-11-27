# -*- coding: utf-8 -*-
"""
测试网站是否可访问
"""

import requests
import urllib3

# 禁用SSL警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def test_website(url, use_proxy=True):
    """测试网站访问"""
    print(f"\n测试访问: {url}")
    
    proxies = None
    if use_proxy:
        proxies = {
            'http': 'http://127.0.0.1:7897',
            'https': 'http://127.0.0.1:7897'
        }
        print("使用代理: http://127.0.0.1:7897")
    else:
        print("不使用代理")
    
    try:
        # 尝试1: 禁用SSL验证
        print("\n方式1: 禁用SSL验证")
        response = requests.get(url, proxies=proxies, verify=False, timeout=10)
        print(f"✓ 成功! 状态码: {response.status_code}")
        print(f"  内容长度: {len(response.text)} 字符")
        return True
    except Exception as e:
        print(f"✗ 失败: {e}")
    
    try:
        # 尝试2: 使用HTTP而不是HTTPS
        http_url = url.replace('https://', 'http://')
        print(f"\n方式2: 使用HTTP协议 ({http_url})")
        response = requests.get(http_url, proxies=proxies, timeout=10)
        print(f"✓ 成功! 状态码: {response.status_code}")
        print(f"  内容长度: {len(response.text)} 字符")
        return True
    except Exception as e:
        print(f"✗ 失败: {e}")
    
    return False

def main():
    print("="*60)
    print("  网站访问测试")
    print("="*60)
    
    test_url = 'https://www.xmanhua.com'
    
    # 测试1: 使用代理
    print("\n【测试1: 使用代理访问】")
    test_website(test_url, use_proxy=True)
    
    # 测试2: 不使用代理
    print("\n" + "="*60)
    print("\n【测试2: 不使用代理访问】")
    test_website(test_url, use_proxy=False)
    
    print("\n" + "="*60)
    print("  测试完成")
    print("="*60)

if __name__ == "__main__":
    main()
