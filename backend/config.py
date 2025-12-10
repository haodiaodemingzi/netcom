import os

# 数据源配置
COMIC_SOURCES = {
    'xmanhua': {
        'name': 'X漫画',
        'base_url': 'https://xmanhua.com',
        'enabled': True,
        'description': 'X漫画网',
        'proxy': {
            'enabled': True,
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
    'animezilla': {
        'name': '18H成人漫画',
        'base_url': 'https://18h.animezilla.com',
        'enabled': True,
        'description': '18H宅宅愛動漫 - 中文成人H漫画单行本',
        'proxy': {
            'enabled': False,
            'host': '127.0.0.1',
            'port': 7897,
            'type': 'http'
        }
    },
    'baozimh': {
        'name': '包子漫画',
        'base_url': 'https://www.baozimh.com',
        'enabled': True,
        'description': '包子漫画 - 海量漫画免费在线阅读',
        'proxy': {
            'enabled': False,
            'host': '127.0.0.1',
            'port': 7897,
            'type': 'http'
        }
    },
}

# 默认数据源 - 动态获取第一个启用的数据源
DEFAULT_SOURCE = next(
    (key for key, value in COMIC_SOURCES.items() if value.get('enabled', False)),
    None
)

# 缓存配置
CACHE_TIMEOUT = {
    'hot': 300,
    'latest': 300,
    'detail': 600,
    'chapters': 600,
    'images': 1800,
}
