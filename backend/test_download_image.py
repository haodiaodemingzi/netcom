#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试下载单张图片 - 使用完整的headers和cookies
"""

import requests
import os
from urllib.parse import urlparse

def download_image():
    """下载指定的图片"""
    
    url = 'https://image.xmanhua.com/1/73/113884/1_7501.jpg?cid=113884&key=c44b3f28c66c6312d3898be8607c9379&uk=707970C804232C298A93E11EACBE370101B44FBA55680CD0A436873420E8F4C9'
    
    headers = {
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9',
        'priority': 'u=1, i',
        'referer': 'https://xmanhua.com/',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
    }
    
    cookies = {
        'MANGABZ_MACHINEKEY': 'af80533c-99aa-4f41-8dbd-f4f23e1ed716',
        '_ga': 'GA1.1.1587533929.1764215750',
        'mangabzcookieenabletest': '1',
        'perf_dv6Tr4n': '1',
        'firsturl': 'https%3A%2F%2Fxmanhua.com%2Fm113884%2F',
        'ComicHistoryitem_zh': 'History=73,638998649385805692,113884,1,0,0,0,563&ViewType=0',
        'readhistory_time': '1-73-113884-1',
        'mangabzimgpage': '271588|1:1,119177|1:1,119638|1:1,119988|2:1,271714|2:1,271722|1:1,271723|1:1,113884|1:1',
        'mangabzimgcooke': '271588%7C10%2C119177%7C2%2C119638%7C2%2C119988%7C16%2C271714%7C16%2C271722%7C2%2C271723%7C2%2C113884%7C2',
        '_ga_RV4ME3C1XE': 'GS2.1.s1764237618$o4$g1$t1764239370$j26$l0$h0',
        'image_time_cookie': '119988|638998610278504716|1,271714|638998644322211440|3,271722|638998645551166761|1,271723|638998648941612600|3,113884|638998649722771314|1'
    }
    
    # 设置代理
    proxies = {
        'http': 'http://127.0.0.1:7897',
        'https': 'http://127.0.0.1:7897'
    }
    
    try:
        print("开始下载图片...")
        print("URL: {}".format(url))
        print("Headers数量: {}".format(len(headers)))
        print("Cookies数量: {}".format(len(cookies)))
        
        # 尝试不同的方法来解决SSL问题
        import ssl
        
        # 方法1: 尝试不使用代理
        print("尝试方法1: 不使用代理...")
        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=30,
                verify=False,
                stream=True
            )
            print("方法1成功!")
        except Exception as e1:
            print("方法1失败: {}".format(str(e1)[:100]))
            
            # 方法2: 使用代理但设置不同的SSL选项
            print("尝试方法2: 使用代理但禁用SSL验证...")
            try:
                session = requests.Session()
                session.headers.update(headers)
                
                # 完全禁用SSL验证
                session.verify = False
                
                response = session.get(
                    url,
                    proxies=proxies,
                    timeout=30,
                    stream=True
                )
                print("方法2成功!")
            except Exception as e2:
                print("方法2失败: {}".format(str(e2)[:100]))
                
                # 方法3: 尝试HTTP而不是HTTPS
                print("尝试方法3: 使用HTTP...")
                http_url = url.replace('https://', 'http://')
                try:
                    response = requests.get(
                        http_url,
                        headers=headers,
                        proxies=proxies,
                        timeout=30,
                        stream=True
                    )
                    print("方法3成功!")
                except Exception as e3:
                    print("方法3失败: {}".format(str(e3)[:100]))
                    raise Exception("所有方法都失败了")
        
        print("响应状态码: {}".format(response.status_code))
        print("Content-Type: {}".format(response.headers.get('Content-Type', 'unknown')))
        print("Content-Length: {}".format(response.headers.get('Content-Length', 'unknown')))
        
        if response.status_code == 200:
            # 从URL中提取文件名
            parsed_url = urlparse(url)
            filename = os.path.basename(parsed_url.path)
            if not filename:
                filename = "downloaded_image.jpg"
            
            # 确保文件名有扩展名
            if not filename.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                filename += '.jpg'
            
            # 保存文件
            filepath = os.path.join(os.getcwd(), filename)
            
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            file_size = os.path.getsize(filepath)
            print(f"图片下载成功!")
            print(f"保存路径: {filepath}")
            print(f"文件大小: {file_size} bytes ({file_size/1024:.2f} KB)")
            
            return True
            
        else:
            print(f"下载失败，状态码: {response.status_code}")
            print(f"响应内容: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"下载出错: {e}")
        return False

def test_without_cookies():
    """测试不使用cookies的情况"""
    print("\n" + "="*60)
    print("测试不使用cookies下载")
    print("="*60)
    
    url = 'https://image.xmanhua.com/1/73/113884/1_7501.jpg?cid=113884&key=c44b3f28c66c6312d3898be8607c9379&uk=707970C804232C298A93E11EACBE370101B44FBA55680CD0A436873420E8F4C9'
    
    headers = {
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9',
        'referer': 'https://xmanhua.com/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
    }
    
    proxies = {
        'http': 'http://127.0.0.1:7897',
        'https': 'http://127.0.0.1:7897'
    }
    
    try:
        response = requests.get(
            url,
            headers=headers,
            proxies=proxies,
            timeout=30,
            verify=False
        )
        
        print(f"响应状态码: {response.status_code}")
        if response.status_code != 200:
            print(f"响应内容: {response.text[:200]}")
        else:
            print("不使用cookies也能成功访问!")
            
    except Exception as e:
        print(f"请求出错: {e}")

if __name__ == '__main__':
    print("="*60)
    print("测试图片下载")
    print("="*60)
    
    # 禁用SSL警告
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    # 测试完整的cookies下载
    success = download_image()
    
    if not success:
        # 如果失败，测试不使用cookies
        test_without_cookies()
