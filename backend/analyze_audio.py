#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""分析huanting音频URL获取方式"""
import requests
from bs4 import BeautifulSoup
import re
import json

url = 'https://www.huanting.cc/ting/x0CN3IjM.html'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.huanting.cc/'
}
response = requests.get(url, headers=headers, timeout=15)
soup = BeautifulSoup(response.text, 'lxml')

# 查找data-url属性
items = soup.find_all('li', class_='section-item')
print(f'找到 {len(items)} 个 section-item')
for item in items[:5]:
    data_url = item.get('data-url')
    data_atp = item.get('data-atp')
    item_id = item.get('id')
    print(f'ID: {item_id}, data-url: {data_url}, data-atp: {data_atp}')

# 查找所有可能的播放信息
print('\n=== 查找音频相关配置 ===')
html = response.text

# 搜索可能的API模式或播放URL
patterns = [
    (r'https?://[^\s"\'<>]+\.m4a', 'm4a URL'),
    (r'https?://[^\s"\'<>]+\.mp3', 'mp3 URL'),
    (r'audioUrl["\']?\s*[:=]\s*["\']([^"\']+)["\']', 'audioUrl变量'),
    (r'["\']src["\']?\s*[:=]\s*["\']([^"\']+\.mp3[^"\']*)["\']', 'src变量'),
    (r'https?://[a-zA-Z0-9\-\.]+/audio/[^\s"\'<>]+', '音频API路径'),
]

for pattern, name in patterns:
    matches = re.findall(pattern, html, re.IGNORECASE)
    if matches:
        print(f'\n[{name}] 找到 {len(matches)} 个匹配:')
        for m in matches[:3]:
            print(f'  {m[:100]}')

# 检查是否有隐藏的iframe或player配置
print('\n=== 检查iframe ===')
iframes = soup.find_all('iframe')
for iframe in iframes:
    print(f'iframe src: {iframe.get("src")}')

# 尝试直接访问可能的API端点
print('\n=== 尝试API端点 ===')
# 从episode ID推导可能的API模式
episode_id = 'x0CN3IjM'
api_patterns = [
    f'https://www.huanting.cc/ting/{episode_id}.json',
    f'https://www.huanting.cc/api/player/{episode_id}',
    f'https://www.huanting.cc/api/audio/{episode_id}',
    f'https://ip.ting23.com/ting/{episode_id}.json',
    f'https://ip.ting23.com/api/player/{episode_id}',
]

for api_url in api_patterns:
    try:
        r = requests.get(api_url, headers=headers, timeout=10)
        if r.status_code == 200:
            print(f'\n✓ {api_url}')
            print(f'  响应: {r.text[:200]}')
    except Exception as e:
        pass
