# -*- coding: utf-8 -*-
"""
漫画下载脚本 - 用于下载 twbzmg.com (包子漫画) 的章节图片
"""

import os
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time

# 请求头，模拟浏览器访问
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://www.twbzmg.com/'
}

IMAGE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://www.twbzmg.com/'
}


def parse_chapter_url(url):
    """
    解析章节URL，提取漫画ID和章节信息
    """
    # 匹配 /comic/chapter/{comic_id}/{chapter_info}.html
    pattern = r'/comic/chapter/([^/]+)/([^.]+)\.html'
    match = re.search(pattern, url)
    if match:
        comic_id = match.group(1)
        chapter_info = match.group(2)
        return comic_id, chapter_info
    return None, None


def get_chapter_images(url):
    """
    获取章节页面中的所有图片URL
    """
    print(f"正在获取章节页面: {url}")
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        html = response.text
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # 查找所有 amp-img 标签（这个站点使用AMP）
        amp_imgs = soup.find_all('amp-img')
        image_urls = []
        
        for img in amp_imgs:
            src = img.get('src', '')
            alt = img.get('alt', '')
            # 过滤出漫画图片（包含 scomic 或 bzcdn 的URL）
            if 'bzcdn' in src and 'scomic' in src:
                image_urls.append({
                    'url': src,
                    'alt': alt
                })
        
        # 也检查普通 img 标签
        imgs = soup.find_all('img')
        for img in imgs:
            src = img.get('src', '')
            alt = img.get('alt', '')
            if 'bzcdn' in src and 'scomic' in src:
                # 避免重复
                if not any(item['url'] == src for item in image_urls):
                    image_urls.append({
                        'url': src,
                        'alt': alt
                    })
        
        # 按URL中的数字排序
        def extract_number(item):
            match = re.search(r'/(\d+)\.jpg', item['url'])
            return int(match.group(1)) if match else 0
        
        image_urls.sort(key=extract_number)
        
        # 去重
        seen = set()
        unique_images = []
        for item in image_urls:
            if item['url'] not in seen:
                seen.add(item['url'])
                unique_images.append(item)
        
        return unique_images
        
    except Exception as e:
        print(f"获取章节页面失败: {e}")
        return []


def download_image(url, save_path, max_retries=3):
    """
    下载单张图片
    """
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=IMAGE_HEADERS, timeout=60, stream=True)
            response.raise_for_status()
            
            with open(save_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            return True
            
        except Exception as e:
            print(f"  下载失败 (尝试 {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2)
    
    return False


def download_chapter(url, output_dir=None):
    """
    下载整个章节的所有图片
    
    Args:
        url: 章节页面URL
        output_dir: 输出目录，默认为当前目录下的 downloads 文件夹
    """
    # 解析URL获取漫画信息
    comic_id, chapter_info = parse_chapter_url(url)
    
    if not comic_id:
        print("无法解析URL，请检查URL格式")
        return False
    
    print(f"漫画ID: {comic_id}")
    print(f"章节信息: {chapter_info}")
    
    # 获取图片列表
    images = get_chapter_images(url)
    
    if not images:
        print("未找到任何图片")
        return False
    
    print(f"找到 {len(images)} 张图片")
    
    # 创建输出目录
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(__file__), 'downloads')
    
    chapter_dir = os.path.join(output_dir, comic_id, chapter_info)
    os.makedirs(chapter_dir, exist_ok=True)
    
    print(f"保存目录: {chapter_dir}")
    print("-" * 50)
    
    # 下载所有图片
    success_count = 0
    for i, img_info in enumerate(images, 1):
        img_url = img_info['url']
        # 从URL提取文件名
        filename = os.path.basename(img_url.split('?')[0])
        save_path = os.path.join(chapter_dir, filename)
        
        print(f"正在下载 [{i}/{len(images)}]: {filename}")
        
        if os.path.exists(save_path):
            print(f"  文件已存在，跳过")
            success_count += 1
            continue
        
        if download_image(img_url, save_path):
            print(f"  下载成功")
            success_count += 1
        else:
            print(f"  下载失败")
        
        # 添加短暂延迟，避免请求过快
        time.sleep(0.5)
    
    print("-" * 50)
    print(f"下载完成: {success_count}/{len(images)} 张图片")
    print(f"保存位置: {chapter_dir}")
    
    return success_count == len(images)


if __name__ == '__main__':
    # 示例：下载指定章节
    chapter_url = "https://www.twbzmg.com/comic/chapter/hanghaiwang-weitianrongyilang_i6wg8y/0_1163.html"
    
    print("=" * 60)
    print("包子漫画下载器")
    print("=" * 60)
    
    download_chapter(chapter_url)
