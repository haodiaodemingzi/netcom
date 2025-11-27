#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试脚本：下载指定章节的所有图片
使用已有的XmanhuaScraper类
"""

import sys
import os
import requests

# 添加services目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'services'))

from xmanhua_scraper import XmanhuaScraper

def download_chapter_images(chapter_id, use_proxy=False, proxy_config=None):
    """下载章节的所有图片
    
    Args:
        chapter_id: 章节ID，例如 'm119988'
        use_proxy: 是否使用代理
        proxy_config: 代理配置字典，例如 {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}
    """
    
    print(f"章节ID: {chapter_id}")
    
    # 创建爬虫实例
    if use_proxy and proxy_config:
        print(f"使用代理: {proxy_config}")
        scraper = XmanhuaScraper(proxy_config=proxy_config)
    else:
        scraper = XmanhuaScraper()
    
    # 1. 获取章节图片URL
    print(f"\n正在获取章节图片...")
    result = scraper.get_chapter_images(chapter_id)
    
    if not result or not result.get('images'):
        print("获取图片失败！")
        return
    
    images = result['images']
    total = result['total']
    
    print(f"\n成功获取 {total} 张图片URL")
    
    # 2. 创建下载目录
    cid = chapter_id.replace('m', '')
    download_dir = f"downloads/chapter_{cid}"
    os.makedirs(download_dir, exist_ok=True)
    print(f"下载目录: {download_dir}")
    
    # 3. 下载所有图片
    print(f"\n开始下载图片...")
    
    # 创建session用于下载
    session = requests.Session()
    if use_proxy and proxy_config:
        session.proxies.update(proxy_config)
    
    download_headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
        'Referer': f'https://xmanhua.com/{chapter_id}/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    }
    
    success_count = 0
    
    for img_info in images:
        page_num = img_info['page']
        img_url = img_info['url']
        
        # 从URL提取文件扩展名
        ext = '.jpg'
        if '.' in img_url.split('?')[0]:
            ext = '.' + img_url.split('?')[0].split('.')[-1]
        
        filename = f"{page_num:03d}{ext}"
        filepath = os.path.join(download_dir, filename)
        
        # 如果文件已存在，跳过
        if os.path.exists(filepath):
            print(f"  第{page_num}页: 已存在，跳过")
            success_count += 1
            continue
        
        try:
            img_response = session.get(
                img_url,
                headers=download_headers,
                timeout=30,
                verify=False,
                stream=True
            )
            
            if img_response.status_code == 200:
                with open(filepath, 'wb') as f:
                    for chunk in img_response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                file_size = os.path.getsize(filepath)
                success_count += 1
                
                if page_num <= 3 or page_num == total:
                    print(f"  第{page_num}页: 下载成功 ({file_size/1024:.1f}KB)")
            else:
                print(f"  第{page_num}页: 下载失败 - HTTP {img_response.status_code}")
                
        except Exception as e:
            print(f"  第{page_num}页: 下载异常 - {e}")
            continue
    
    if success_count > 3 and success_count < total:
        print(f"  ...")
    
    print(f"\n下载完成！成功: {success_count}/{total}")
    print(f"保存位置: {os.path.abspath(download_dir)}")


if __name__ == '__main__':
    # 测试章节ID
    chapter_id = 'm119988'
    
    # 代理配置
    USE_PROXY = False  # 设置为True启用代理
    PROXY_URL = 'http://127.0.0.1:7890'  # 修改为你的代理地址
    
    print("=" * 60)
    print("X漫画章节图片下载器")
    print("=" * 60)
    
    proxy_config = None
    if USE_PROXY:
        print(f"\n代理模式: 启用")
        print(f"代理地址: {PROXY_URL}")
        proxy_config = {
            'http': PROXY_URL,
            'https': PROXY_URL
        }
    else:
        print(f"\n代理模式: 禁用")
    
    download_chapter_images(chapter_id, use_proxy=USE_PROXY, proxy_config=proxy_config)
    
    print("\n" + "=" * 60)
    print("完成！")
    print("=" * 60)
