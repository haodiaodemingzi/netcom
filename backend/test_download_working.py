#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试下载图片 - 使用成功的curl参数
"""

import requests
import os
from urllib.parse import urlparse
import ssl
import urllib3

def download_image_working():
    """使用成功的curl参数下载图片"""
    
    # 使用你成功的curl URL
    url = 'https://image.xmanhua.com/1/73/271723/1_4950.jpg?cid=271723&key=02a16eb5e4670ba90a7392de98fd6a70&uk=707970C804232C298A93E11EACBE37019E2358B7C52FF355751384A41E96DA3B'
    
    headers = {
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9',
        'priority': 'i',
        'referer': 'https://xmanhua.com/',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
    }
    
    # 使用你curl命令中的完整Cookie字符串
    cookie_string = "mangabz_machinekey=af80533c-99aa-4f41-8dbd-f4f23e1ed716; _ga=GA1.1.1587533929.1764215750; mangabzcookieenabletest=1; perf_dv6tr4n=1; mangabzimgpage=271588|1:1,119177|1:1,119638|1:1,119988|2:1,271714|2:1,271722|1:1,271723|1:1,113884|1:1; mangabzimgcooke=271588%7C10%2C119177%7C2%2C119638%7C2%2C119988%7C16%2C271714%7C16%2C271722%7C2%2C271723%7C2%2C113884%7C2; firsturl=https%3A%2F%2Fxmanhua.com%2Fm271723%2F; comic_historyitem_zh=History=73,638998655894924127,271723,1,0,0,0,587&ViewType=0; readhistory_time=1-73-271723-1; _ga_rv4me3c1xe=GS2.1.s1764237618$o4$g1$t1764239987$j59$l0$h0; image_time_cookie=119988|638998610278504716|1,271714|638998644322211440|3,271722|638998645551166761|1,271723|638998655896623648|4,113884|638998649722771314|1"
    
    # 将Cookie字符串添加到headers中
    headers['cookie'] = cookie_string  # 使用小写的cookie，和Node.js fetch一致
    
    try:
        print("开始下载图片...")
        print("URL: {}".format(url))
        
        # 方法1: 不使用代理，直接连接
        print("\n尝试方法1: 直接连接（不使用代理）...")
        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=30,
                verify=False,
                stream=True
            )
            print("方法1成功! 状态码: {}".format(response.status_code))
            
        except Exception as e1:
            print("方法1失败: {}".format(str(e1)[:150]))
            
            # 方法2: 使用代理
            print("\n尝试方法2: 使用代理...")
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
                    verify=False,
                    stream=True
                )
                print("方法2成功! 状态码: {}".format(response.status_code))
                
            except Exception as e2:
                print("方法2失败: {}".format(str(e2)[:150]))
                
                # 方法3: 使用session并设置SSL上下文
                print("\n尝试方法3: 使用session和自定义SSL...")
                try:
                    session = requests.Session()
                    
                    # 设置SSL适配器
                    from requests.adapters import HTTPAdapter
                    from urllib3.util.ssl_ import create_urllib3_context
                    
                    class SSLAdapter(HTTPAdapter):
                        def init_poolmanager(self, *args, **kwargs):
                            ctx = create_urllib3_context()
                            ctx.set_ciphers('DEFAULT@SECLEVEL=1')
                            kwargs['ssl_context'] = ctx
                            return super().init_poolmanager(*args, **kwargs)
                    
                    session.mount('https://', SSLAdapter())
                    session.headers.update(headers)
                    
                    response = session.get(
                        url,
                        timeout=30,
                        verify=False,
                        stream=True
                    )
                    print("方法3成功! 状态码: {}".format(response.status_code))
                    
                except Exception as e3:
                    print("方法3失败: {}".format(str(e3)[:150]))
                    raise Exception("所有方法都失败了")
        
        # 检查响应
        if response.status_code == 200:
            print("Content-Type: {}".format(response.headers.get('Content-Type', 'unknown')))
            print("Content-Length: {}".format(response.headers.get('Content-Length', 'unknown')))
            
            # 保存文件
            filename = "downloaded_image_working.jpg"
            filepath = os.path.join(os.getcwd(), filename)
            
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            file_size = os.path.getsize(filepath)
            print("图片下载成功!")
            print("保存路径: {}".format(filepath))
            print("文件大小: {} bytes ({:.2f} KB)".format(file_size, file_size/1024))
            
            return True
            
        else:
            print("下载失败，状态码: {}".format(response.status_code))
            return False
            
    except Exception as e:
        print("下载出错: {}".format(e))
        return False

if __name__ == '__main__':
    print("="*60)
    print("测试图片下载 - 使用成功的curl参数")
    print("="*60)
    
    # 禁用SSL警告
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    download_image_working()
