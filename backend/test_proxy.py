# -*- coding: utf-8 -*-
"""
代理连接测试脚本
"""

import requests
import socket

def test_port(host, port):
    """测试端口是否开放"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except:
        return False

def test_proxy(proxy_url, test_url='http://www.baidu.com'):
    """测试代理是否可用"""
    try:
        proxies = {
            'http': proxy_url,
            'https': proxy_url
        }
        response = requests.get(test_url, proxies=proxies, timeout=5, verify=False)
        return response.status_code == 200
    except Exception as e:
        print(f"  错误: {e}")
        return False

def main():
    print("="*60)
    print("  代理连接测试")
    print("="*60)
    
    host = '127.0.0.1'
    common_ports = [7890, 7891, 7897, 7899, 10808, 10809, 8080, 1080]
    
    print(f"\n1. 检测本地端口开放状态:")
    open_ports = []
    for port in common_ports:
        is_open = test_port(host, port)
        status = "✓ 开放" if is_open else "✗ 关闭"
        print(f"   端口 {port}: {status}")
        if is_open:
            open_ports.append(port)
    
    if not open_ports:
        print("\n❌ 没有检测到开放的代理端口")
        print("\n建议:")
        print("  1. 启动代理软件（Clash/V2Ray等）")
        print("  2. 检查代理软件的端口配置")
        return
    
    print(f"\n2. 测试代理连接 (使用百度测试):")
    working_proxies = []
    
    for port in open_ports:
        print(f"\n   测试 HTTP 代理 http://{host}:{port}")
        if test_proxy(f'http://{host}:{port}'):
            print(f"   ✓ HTTP 代理可用")
            working_proxies.append(('http', port))
        else:
            print(f"   ✗ HTTP 代理不可用")
        
        print(f"\n   测试 SOCKS5 代理 socks5://{host}:{port}")
        if test_proxy(f'socks5://{host}:{port}'):
            print(f"   ✓ SOCKS5 代理可用")
            working_proxies.append(('socks5', port))
        else:
            print(f"   ✗ SOCKS5 代理不可用")
    
    print("\n" + "="*60)
    print("  测试结果")
    print("="*60)
    
    if working_proxies:
        print("\n✅ 找到可用的代理配置:\n")
        for proxy_type, port in working_proxies:
            print(f"   类型: {proxy_type}, 端口: {port}")
            print(f"   配置: 'type': '{proxy_type}', 'port': {port}\n")
        
        print("建议在 config.py 中使用以上配置")
    else:
        print("\n❌ 没有找到可用的代理")
        print("\n建议:")
        print("  1. 检查代理软件是否正常运行")
        print("  2. 查看代理软件的日志")
        print("  3. 尝试重启代理软件")

if __name__ == "__main__":
    main()
