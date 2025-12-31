"""
播客API测试脚本

测试所有播客相关接口
"""

import requests
import json

# API配置
BASE_URL = "http://localhost:5000/api/podcast"


def print_section(title):
    """打印分隔线"""
    print("\n" + "=" * 50)
    print(f"  {title}")
    print("=" * 50)


def print_response(response):
    """打印响应结果"""
    print(f"状态码: {response.status_code}")
    try:
        data = response.json()
        print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
    except:
        print(f"响应: {response.text}")


def test_sources():
    """测试获取数据源列表"""
    print_section("1. 获取数据源列表")
    response = requests.get(f"{BASE_URL}/sources")
    print_response(response)
    return response.status_code == 200


def test_categories():
    """测试获取分类列表"""
    print_section("2. 获取分类列表")
    response = requests.get(f"{BASE_URL}/categories?source=ximalaya")
    print_response(response)
    return response.status_code == 200


def test_programs():
    """测试获取播客节目列表"""
    print_section("3. 获取播客节目列表（按分类）")
    response = requests.get(f"{BASE_URL}/programs?category=有声书&page=1&limit=5&source=ximalaya")
    print_response(response)
    return response.status_code == 200


def test_hot_programs():
    """测试获取热门播客"""
    print_section("4. 获取热门播客")
    response = requests.get(f"{BASE_URL}/programs/hot?page=1&limit=5&source=ximalaya")
    print_response(response)
    return response.status_code == 200


def test_latest_programs():
    """测试获取最新播客"""
    print_section("5. 获取最新播客")
    response = requests.get(f"{BASE_URL}/programs/latest?page=1&limit=5&source=ximalaya")
    print_response(response)
    return response.status_code == 200


def test_program_detail():
    """测试获取播客详情"""
    print_section("6. 获取播客详情")
    program_id = "123456"
    response = requests.get(f"{BASE_URL}/programs/{program_id}?source=ximalaya")
    print_response(response)
    return response.status_code == 200


def test_episodes():
    """测试获取节目单集列表"""
    print_section("7. 获取节目单集列表")
    program_id = "123456"
    response = requests.get(f"{BASE_URL}/programs/{program_id}/episodes?page=1&limit=10&source=ximalaya")
    print_response(response)
    return response.status_code == 200


def test_episode_detail():
    """测试获取单集详情"""
    print_section("8. 获取单集详情（含音频地址）")
    episode_id = "ep_123456_001"
    response = requests.get(f"{BASE_URL}/episodes/{episode_id}?source=ximalaya")
    print_response(response)
    return response.status_code == 200


def test_search():
    """测试搜索播客"""
    print_section("9. 搜索播客")
    response = requests.get(f"{BASE_URL}/search?keyword=三国&page=1&limit=5&source=ximalaya")
    print_response(response)
    return response.status_code == 200


def test_lizhi_source():
    """测试荔枝FM数据源"""
    print_section("10. 测试荔枝FM数据源")

    # 测试分类
    response = requests.get(f"{BASE_URL}/categories?source=lizhi")
    print("荔枝FM分类:")
    print_response(response)

    # 测试节目列表
    response = requests.get(f"{BASE_URL}/programs?source=lizhi")
    print("\n荔枝FM节目列表:")
    print_response(response)

    return response.status_code == 200


def main():
    """主测试函数"""
    print("\n" + "=" * 50)
    print("  播客API测试")
    print("=" * 50)

    # 检查后端是否运行
    try:
        response = requests.get(f"{BASE_URL}/sources", timeout=5)
    except requests.exceptions.RequestException as e:
        print(f"\n错误: 无法连接到后端服务器 ({BASE_URL})")
        print("请确保后端服务正在运行: python backend/app.py")
        return

    # 运行所有测试
    tests = [
        ("获取数据源列表", test_sources),
        ("获取分类列表", test_categories),
        ("获取播客节目列表", test_programs),
        ("获取热门播客", test_hot_programs),
        ("获取最新播客", test_latest_programs),
        ("获取播客详情", test_program_detail),
        ("获取节目单集列表", test_episodes),
        ("获取单集详情", test_episode_detail),
        ("搜索播客", test_search),
        ("测试荔枝FM数据源", test_lizhi_source),
    ]

    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n错误: {e}")
            results.append((name, False))

    # 打印测试结果汇总
    print_section("测试结果汇总")
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{status} - {name}")

    print(f"\n总计: {passed}/{total} 通过")
    print("=" * 50)


if __name__ == "__main__":
    main()
