import time
import requests
import json
import os
import urllib3

# 禁用SSL警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_cookies_and_headers(target_url):
    print("1. 正在使用requests获取 Cookie...")
    
    # 设置User-Agent
    user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15"
    
    # 创建session
    session = requests.Session()
    session.headers.update({
        "User-Agent": user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://xmanhua.com/"
    })
    
    # 配置代理
    proxies = {
        'http': 'http://127.0.0.1:7897',
        'https': 'http://127.0.0.1:7897'
    }
    
    try:
        # 先访问主页获取基础Cookie
        print("2. 访问主页获取基础Cookie...")
        response = session.get("https://xmanhua.com/", proxies=proxies, timeout=10, verify=False)
        print("主页访问状态码: {}".format(response.status_code))
        
        # 再访问目标页面获取更多Cookie
        print("3. 访问目标页面获取更多Cookie...")
        response = session.get(target_url, proxies=proxies, timeout=10, verify=False)
        print("目标页面访问状态码: {}".format(response.status_code))
        
        # 获取所有Cookie
        cookie_dict = {}
        for cookie in session.cookies:
            cookie_dict[cookie.name] = cookie.value
            
        print("4. 获取成功，共拿到 {} 个 Cookie 参数".format(len(cookie_dict)))
        
        # 打印Cookie信息（调试用）
        for name, value in cookie_dict.items():
            print("  {}: {}".format(name, value[:50] + "..." if len(value) > 50 else value))
        
        return cookie_dict, user_agent

    except Exception as e:
        print("获取Cookie失败: {}".format(e))
        # 返回空字典和默认UA
        return {}, user_agent

# --- 使用示例 ---

# 漫画页面地址（不是图片地址，是网页地址）
page_url = "https://xmanhua.com/m271723"
img_url = "https://image.xmanhua.com/1/73/271723/35_6532.jpg?cid=271723&key=02a16eb5e4670ba90a7392de98fd6a70&uk=707970C804232C298A93E11EACBE37019E2358B7C52FF35539FA84A3D2704BA53369F71CC933AA66"

# 1. 获取 Cookie
cookies, ua = get_cookies_and_headers(page_url)

# 2. 使用获取到的 Cookie 下载图片
headers = {
    "User-Agent": ua,
    "Referer": "https://xmanhua.com/", # 必须带
}

if img_url.startswith("http"):
    print("3. 开始下载图片...")
    proxies = {
        'http': 'http://127.0.0.1:7897',
        'https': 'http://127.0.0.1:7897'
    }
    
    response = requests.get(img_url, headers=headers, cookies=cookies, proxies=proxies, timeout=15)

    response = requests.get(img_url, headers=headers, cookies=cookies, timeout=15)

    if response.status_code == 200:
        filename = "downloaded_auto.jpg"
        filepath = os.path.abspath(filename)
        
        with open(filename, "wb") as f:
            f.write(response.content)
        
        # 获取文件大小
        file_size = os.path.getsize(filename)
        
        print("图片下载成功！")
        print("保存路径: {}".format(filepath))
        print("文件大小: {} bytes ({:.2f} KB)".format(file_size, file_size/1024))
    else:
        print("下载失败: {}".format(response.status_code))
else:
    print("请填入有效的图片 URL")