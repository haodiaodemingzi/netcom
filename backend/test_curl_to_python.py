#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试curl转Python - 获取包含uk参数的JS代码
"""

import requests
import re

def test_api_request():
    """测试API请求，获取包含uk参数的JS代码"""
    
    url = 'https://xmanhua.com/m271714/chapterimage.ashx'
    
    params = {
        'cid': '271714',
        'page': '1',
        'key': '',
        '_cid': '271714',
        '_mid': '73',
        '_dt': '2025-11-27 18:01:02',
        '_sign': '705cde11657b8d1bc17c0cee79cc5600'
    }
    
    headers = {
        'accept': '*/*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'priority': 'u=1, i',
        'referer': 'https://xmanhua.com/m271714/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
        'x-requested-with': 'XMLHttpRequest'
    }
    
    cookies = {
        'MANGABZ_MACHINEKEY': 'af80533c-99aa-4f41-8dbd-f4f23e1ed716',
        '_ga': 'GA1.1.1587533929.1764215750',
        'NGSERVERID': '2faf5748ecd5cda6b63627cc33f222a5',
        'perf_dv6Tr4n': '1',
        'mangabzcookieenabletest': '1',
        'firsturl': 'https%3A%2F%2Fxmanhua.com%2Fm271714%2F',
        'ComicHistoryitem_zh': 'History=73,638998632372375769,271714,2,0,0,0,582&ViewType=0',
        'readhistory_time': '1-73-271714-2',
        'image_time_cookie': '119177|638998605509996123|0,119638|638998605592648845|0,119988|638998610278504716|1,271714|638998632378206977|1',
        'mangabzimgpage': '271588|1:1,119177|1:1,119638|1:1,119988|2:1,271714|2:1',
        'mangabzimgcooke': '271588%7C10%2C119177%7C2%2C119638%7C2%2C119988%7C16%2C271714%7C16',
        '_ga_RV4ME3C1XE': 'GS2.1.s1764237618$o4$g0$t1764237660$j18$l0$h0'
    }
    
    try:
        print("发送API请求...")
        print(f"URL: {url}")
        print(f"参数: {params}")
        print(f"Cookie数量: {len(cookies)}")
        
        proxies = {
            'http': 'http://127.0.0.1:7897',
            'https': 'http://127.0.0.1:7897'
        }
        
        response = requests.get(
            url,
            params=params,
            headers=headers,
            #cookies=cookies,
            proxies=proxies,
            timeout=10,
            verify=False
        )
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容长度: {len(response.text)}")
        print(f"响应内容: {response.text[:500]}...")
        
        # 提取uk参数
        uk_value = extract_uk_from_js(response.text)
        if uk_value:
            print(f"\n成功提取uk参数: {uk_value}")
        else:
            print("\n未找到uk参数")
            
        return response.text
        
    except Exception as e:
        print(f"请求失败: {e}")
        return None

def extract_uk_from_js(js_code):
    """从JS代码中提取uk参数"""
    try:
        # 查找split('|')部分
        split_match = re.search(r"'([^']+)'\.split\('\|'\)", js_code)
        if split_match:
            tokens = split_match.group(1).split('|')
            print(f"找到 {len(tokens)} 个tokens")
            
            # 查找uk和对应的值
            if 'uk' in tokens:
                uk_index = tokens.index('uk')
                print(f"uk在索引 {uk_index}")
                print(f"uk附近的tokens: {tokens[max(0, uk_index-3):uk_index+10]}")
                
                # 遍历整个数组查找长的十六进制字符串
                for i, token in enumerate(tokens):
                    if len(token) > 40 and re.match(r'^[A-F0-9]+$', token):
                        print(f"在索引 {i} 找到uk值: {token}")
                        return token
            
            # 如果没找到uk关键字，直接查找长字符串
            for i, token in enumerate(tokens):
                if len(token) > 40 and re.match(r'^[A-F0-9]+$', token):
                    print(f"直接找到长字符串在索引 {i}: {token}")
                    return token
        
        return None
    except Exception as e:
        print(f"提取uk失败: {e}")
        return None

if __name__ == '__main__':
    print("=" * 60)
    print("测试curl转Python - 获取uk参数")
    print("=" * 60)
    
    # 禁用SSL警告
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    test_api_request()
