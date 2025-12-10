# -*- coding: utf-8 -*-
"""测试代理管理器"""

from services.proxy_manager import proxy_manager

# 测试订阅内容（从你的订阅链接获取的Base64）
subscription_data = """dHJvamFuOi8vZGYyNjA1YTItMjRmNS00MjYwLThhNmQtOWYzNzM3ZmY5OTQyQGgwMGtnYWExLnN0YXIxMS54eXo6NjAwMTA/YWxsb3dJbnNlY3VyZT0xJnBlZXI9Zy5hbGljZG4uY29tJnNuaT1nLmFsaWNkbi5jb20jJUU1JTg5JUE5JUU0JUJEJTk5JUU2JUI1JTgxJUU5JTg3JThGJUVGJUJDJTlBMTM0LjMxJTIwR0INCnRyb2phbjovL2RmMjYwNWEyLTI0ZjUtNDI2MC04YTZkLTlmMzczN2ZmOTk0MkBoMDBrZ2FhMS5zdGFyMTEueHl6OjYwMDEwP2FsbG93SW5zZWN1cmU9MSZwZWVyPWcuYWxpY2RuLmNvbSZzbmk9Zy5hbGljZG4uY29tIyVFOCVCNyU5RCVFNyVBNiVCQiVFNCVCOCU4QiVFNiVBQyVBMSVFOSU4NyU4RCVFNyVCRCVBRSVFNSU4OSVBOSVFNCVCRCU5OSVFRiVCQyU5QTElMjAlRTUlQTQlQTkNCnRyb2phbjovL2RmMjYwNWEyLTI0ZjUtNDI2MC04YTZkLTlmMzczN2ZmOTk0MkBoMDBrZ2FhMS5zdGFyMTEueHl6OjYwMDEwP2FsbG93SW5zZWN1cmU9MSZwZWVyPWcuYWxpY2RuLmNvbSZzbmk9Zy5hbGljZG4uY29tIyVFNSVBNSU5NyVFOSVBNCU5MCVFNSU4OCVCMCVFNiU5QyU5RiVFRiVCQyU5QTIwMjYtMDQtMTENCnRyb2phbjovL2RmMjYwNWEyLTI0ZjUtNDI2MC04YTZkLTlmMzczN2ZmOTk0MkBoMDBrZ2FhMS5zdGFyMTEueHl6OjYwMDEwP2FsbG93SW5zZWN1cmU9MSZwZWVyPWcuYWxpY2RuLmNvbSZzbmk9Zy5hbGljZG4uY29tIyVGMCU5RiU4NyVBRCVGMCU5RiU4NyVCMCUyMCVFOSVBNiU5OSVFNiVCOCVBRiUyMDAxDQp0cm9qYW46Ly9kZjI2MDVhMi0yNGY1LTQyNjAtOGE2ZC05ZjM3MzdmZjk5NDJAaDAwa2diYjIuc3RhcjExLnh5ejo2MDAxMT9hbGxvd0luc2VjdXJlPTEmcGVlcj1nLmFsaWNkbi5jb20mc25pPWcuYWxpY2RuLmNvbSMlRjAlOUYlODclQUQlRjAlOUYlODclQjAlMjAlRTklQTYlOTklRTYlQjglQUYlMjAwMg=="""

print("="*60)
print("测试代理管理器")
print("="*60)

# 解析订阅
print("\n1. 解析订阅内容...")
proxy_manager.parse_subscription(subscription_data)

print(f"\n2. 解析结果:")
print(f"   总节点数: {len(proxy_manager.nodes)}")

if proxy_manager.nodes:
    print(f"\n3. 前5个节点详情:")
    for i, node in enumerate(proxy_manager.nodes[:5]):
        print(f"\n   节点 {i+1}:")
        print(f"   - 名称: {node.name}")
        print(f"   - 协议: {node.protocol}")
        print(f"   - 服务器: {node.server}")
        print(f"   - 端口: {node.port}")
        print(f"   - 密码: {node.password[:20]}...")
        if node.sni:
            print(f"   - SNI: {node.sni}")
    
    # 选择第一个节点
    print(f"\n4. 选择第一个节点...")
    proxy_manager.select_node(0)
    
    selected = proxy_manager.get_selected_node()
    if selected:
        print(f"\n5. 当前选中节点:")
        print(f"   - 名称: {selected['name']}")
        print(f"   - 服务器: {selected['server']}:{selected['port']}")
        print(f"   - 协议: {selected['protocol']}")
else:
    print("\n   ❌ 未解析到任何节点")

print("\n" + "="*60)
print("测试完成")
print("="*60)
