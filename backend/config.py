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
        },
        'download_config': {
            'referer': 'https://xmanhua.com/',
            'cookie_url': 'https://xmanhua.com/',
            'headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            }
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
        },
        'download_config': {
            'referer': 'https://hmzxa.com/',
            'cookie_url': 'https://hmzxa.com/',
            'headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            }
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
        },
        'download_config': {
            'referer': 'https://18h.animezilla.com/',
            'cookie_url': 'https://18h.animezilla.com/manga',
            'headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            }
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
        },
        'download_config': {
            'referer': 'https://www.baozimh.com/',
            'cookie_url': 'https://www.baozimh.com/',
            'headers': {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            }
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

# 播客数据源配置
PODCAST_SOURCES = {
    'ximalaya': {
        'name': '喜马拉雅',
        'base_url': 'https://www.ximalaya.com',
        'enabled': True,
        'description': '喜马拉雅 - 有声书、相声评书、音乐等音频内容'
    },
    'lizhi': {
        'name': '荔枝FM',
        'base_url': 'https://www.lizhi.fm',
        'enabled': True,
        'description': '荔枝FM - 情感、音乐、故事等播客内容'
    },
    'huanting': {
        'name': '一夜听书网',
        'base_url': 'https://www.huanting.cc',
        'enabled': True,
        'description': '一夜听书网 - 有声小说,玄幻武侠,都市言情,恐怖悬疑等音频内容',
        'download_config': {
            'headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.huanting.cc/'
            }
        }
    }
}

# 默认播客数据源
DEFAULT_PODCAST_SOURCE = 'ximalaya'
