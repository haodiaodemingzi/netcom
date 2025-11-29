import os

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
        'enabled': False,
        'description': '模拟测试数据源',
    },
    'guoman8': {
        'name': '国漫8',
        'base_url': 'https://www.guoman8.cc',
        'enabled': True,
        'description': '国漫8漫画网',
    },
    'xmanhua': {
        'name': 'X漫画',
        'base_url': 'https://xmanhua.com',
        'enabled': True,
        'description': 'X漫画网',
        'proxy': {
            'enabled': True,  # 生产服务器不需要代理，改为False
            'host': '127.0.0.1',
            'port': 7897,
            'type': 'http'
        }
    },
    'hmzxa': {
        'name': 'HMZXA漫画',
        'base_url': 'https://hmzxa.com',
        'enabled': True,
        'description': 'HMZXA漫画网',
        'proxy': {
            'enabled': False,
            'host': '127.0.0.1',
            'port': 7897,
            'type': 'http'
        }
    },
}

# 默认数据源
DEFAULT_SOURCE = 'xmanhua'

# 缓存配置
CACHE_TIMEOUT = {
    'hot': 300,
    'latest': 300,
    'detail': 600,
    'chapters': 600,
    'images': 1800,
}
