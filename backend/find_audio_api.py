#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""分析huanting音频API获取方式"""
import requests
import re
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.huanting.cc/'
}

# 获取播放页面
url = 'https://www.huanting.cc/ting/x0CN3IjM.html'
print(f'获取页面: {url}')
response = requests.get(url, headers=headers, timeout=15)
html = response.text

# 搜索所有可能的URL
print('\n=== 搜索页面中的所有URL ===')
all_urls = re.findall(r'https?://[^\s"\'<>]+', html)
audio_urls = [u for u in all_urls if any(ext in u.lower() for ext in ['.mp3', '.m4a', '.ts', '.m3u8', '/audio/', '/play/', '/api/'])]
for au in audio_urls[:10]:
    print(f'  {au[:100]}')

# 查找data-url属性
print('\n=== 查找data-url属性 ===')
data_urls = re.findall(r'data-url=["\']([^"\']+)["\']', html)
for du in data_urls[:10]:
    print(f'  {du}')

# 尝试从episode ID构造API
episode_id = 'x0CN3IjM'
print(f'\n=== 尝试构造API (episode_id: {episode_id}) ===')

# 常见的API模式
api_patterns = [
    f'https://www.huanting.cc/dplayer/{episode_id}.json',
    f'https://www.huanting.cc/api.php?url=/ting/{episode_id}.html',
    f'https://www.huanting.cc/api/play/{episode_id}',
    f'https://www.huanting.cc/api/audio/{episode_id}',
    f'https://www.huanting.cc/player/parsedata/{episode_id}',
    f'https://ip.ting23.com/dplayer/{episode_id}.json',
    f'https://ip.ting23.com/api.php?url=/ting/{episode_id}.html',
    f'https://ip.ting23.com/api/audio/{episode_id}',
]

# 也尝试从其他信息推导
# 有些网站使用 book_id 和 episode_number
# x0CN3IjM 可能是编码后的ID

for api_url in api_patterns:
    print(f'\n尝试: {api_url}')
    try:
        r = requests.get(api_url, headers=headers, timeout=10)
        if r.status_code == 200:
            content = r.text.strip()
            if content and len(content) > 10:
                print(f'  ✓ 状态: {r.status_code}')
                print(f'  Content-Type: {r.headers.get("Content-Type")}')
                print(f'  响应: {content[:300]}')
                # 尝试解析JSON
                try:
                    data = json.loads(content)
                    print(f'  JSON数据: {json.dumps(data, ensure_ascii=False)[:200]}')
                except:
                    pass
        else:
            print(f'  ✗ 状态: {r.status_code}')
    except Exception as e:
        print(f'  ✗ 错误: {e}')

# 查找可能的加密/编码信息
print('\n=== 查找可能的配置数据 ===')
# 搜索可能包含配置的script变量
config_patterns = [
    r'var\s+(\w+)\s*=\s*\{',
    r'window\.\w+\s*=\s*\{',
    r'let\s+\w+\s*=\s*\{',
    r'const\s+\w+\s*=\s*\{',
]
for pattern in config_patterns:
    matches = re.findall(pattern, html)
    if matches:
        print(f'Pattern {pattern}: {matches[:5]}')
