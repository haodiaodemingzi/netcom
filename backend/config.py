# 数据源配置
COMIC_SOURCES = {
    'komiic': {
        'name': 'Komiic',
        'base_url': 'https://komiic.com',
        'enabled': True,
        'description': 'Komiic 漫画源',
    },
    'manhuagui': {
        'name': '漫画柜',
        'base_url': 'https://www.manhuagui.com',
        'enabled': True,
        'description': '漫画柜数据源',
    },
    'copymanga': {
        'name': '拷贝漫画',
        'base_url': 'https://www.copymanga.site',
        'enabled': True,
        'description': '拷贝漫画数据源',
    },
    'mock': {
        'name': '测试数据',
        'base_url': 'http://localhost',
        'enabled': True,
        'description': '模拟测试数据源',
    },
}

# 默认数据源
DEFAULT_SOURCE = 'mock'

# 缓存配置
CACHE_TIMEOUT = {
    'hot': 300,
    'latest': 300,
    'detail': 600,
    'chapters': 600,
    'images': 1800,
}
